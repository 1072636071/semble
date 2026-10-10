/**
 * 团队路径 E2E（PRD 110 工单 02 / ADR-0121）：fixture 看板（真 board.mjs）+ mock agentTeams 服务。
 * 覆盖：投卡 → worker 队友领卡 → SETTLED 回传（消息路收割）→ 交付起三维审查（一次性）→
 * 三审过 → 合并专员队友 spawn/收口 → done；返工流走 sendMessage 复用（不重开队友）；
 * 双路去重（SETTLED 消息 + 卡位信号同时到达只收口一次）；消息丢失时卡位扫描兜底；
 * teamMode=off → 全走一次性路径（回归判据：既有路径零变化）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'

const BOARD = process.env.JXX_BOARD
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')

function mkRepo(prdNum) {
  const root = mkdtempSync(join(tmpdir(), `jxx-team-${prdNum}-`))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', `${prdNum}-team-prd`, 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', `${prdNum}-team-prd`, 'PRD.md'),
    `# PRD ${prdNum} · 团队测试\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n`)
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
  return { root, cardId: `${prdNum}-01-solo`, mergeId: `merge-${prdNum}-01-solo` }
}

/**
 * 造带 agentTeams 的 stub ctx：队友回合 = 从指令文本提取 SETTLED 行的卡 id →
 * 干活（worker 领卡交付 / merger 收口）→ 经 deliver() 把 SETTLED 文本交回（测试接线为
 * orch.onTeamMessage——宿主把 team-message 投递到 Lead 的那一脚由宿主实现，fixture 只模拟语义）。
 */
function mkTeamCtx(root, behavior = {}) {
  const agent = {
    id: 'sess-team',
    session: { id: 'sess-team', header: { cwd: root } },
    followups: [],
    followup(msg) { this.followups.push(msg) },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { spawned: [], sent: [], reviewerSpawns: [] }
  let deliver = null
  const teams = {
    async spawnTeammate(_caller, req) {
      calls.spawned.push({ req })
      runTeammate(req.name, req.prompt.map((b) => b.text).join('\n'))
      return { member: { name: req.name } }
    },
    async sendMessage(_caller, req) {
      calls.sent.push({ req })
      runTeammate(req.target, req.content.map((b) => b.text).join('\n'))
      return { messageId: `m-${calls.sent.length}`, status: 'accepted' }
    },
    async interrupt() { return { previousStatus: 'inactive' } },
  }
  const runTeammate = (name, text) => {
    // 指令文本里机读行以 markdown 反引号引用（`SETTLED: <id>`），提取时剥掉引号只留卡 id
    const m = /SETTLED:[ \t]*`?([A-Za-z0-9][A-Za-z0-9._-]*)`?/.exec(text)
    const card = m ? m[1] : undefined
    if (!card) return
    if (card.startsWith('merge-')) {
      // 模拟合并专员：merge 卡进 done/
      const from = join(openDir, `${card}.md`)
      if (existsSync(from)) renameSync(from, join(root, 'control', 'cards', 'done', `${card}.md`))
    } else {
      // 模拟 worker：按当前卡位领卡（返工时卡已在 .claimed.md）→ 交付
      if (existsSync(join(openDir, `${card}.md`))) {
        renameSync(join(openDir, `${card}.md`), join(openDir, `${card}.claimed.md`))
      }
      renameSync(join(openDir, `${card}.claimed.md`), join(openDir, `${card}.review.md`))
    }
    if (!behavior.noSettle && deliver) deliver(`${name} 已办结 ${card}。\nSETTLED: ${card}`)
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: (key) => (key === 'agentTeams' ? teams : undefined),
    subagents: {
      start: async (_provider, req) => {
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        if (!rev) throw new Error(`团队模式下不应有一次性 spawn：${req.label}`)
        calls.reviewerSpawns.push(req.label)
        const dim = rev[1]
        const pass = behavior.failDims ? !behavior.failDims.includes(dim) : true
        return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: `报告\nVERDICT: ${pass ? 'PASS' : 'FAIL'}` }] }), dispose: async () => {} }
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent, calls, wireDeliver: (fn) => { deliver = fn } }
}

async function waitFor(pred, timeoutMs = 30_000, stepMs = 50) {
  const start = Date.now()
  for (;;) {
    const v = await pred()
    if (v) return v
    if (Date.now() - start > timeoutMs) throw new Error('waitFor 超时')
    await new Promise((r) => setTimeout(r, stepMs))
  }
}

const CONFIG = (over = {}) => normalizeConfig({
  boardScript: BOARD, parallel: 3, staleMinutes: 30, maxRetries: 1, autoMerge: true, pollIntervalMs: 50, ...over,
})

test('团队 E2E：投卡 → worker 队友领卡 → SETTLED 回传 → 三审（一次性）→ 合并专员队友收口 → ops', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId, mergeId } = mkRepo(94)
  const { ctx, agent, calls, wireDeliver } = mkTeamCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))

  await orch.auto(agent, '94')
  assert.equal(orch.status(agent).stage, 'implement')
  await waitFor(() => orch.status(agent).stage === 'ops')

  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)), '开发卡应 done')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${mergeId}.md`)), '合并卡应 done')
  // worker 与合并专员各 spawn 一次持久队友；三维审查者保持一次性 spawn（3 次）
  assert.equal(calls.spawned.length, 2, '团队路径只 spawn worker+merger 两个队友')
  const dev = calls.spawned.find((s) => s.req.name === 'dev-a')
  const merger = calls.spawned.find((s) => s.req.name === 'merger-a')
  assert.ok(dev, 'worker 队友 dev-a 应被创建')
  assert.ok(merger, '合并专员队友 merger-a 应被创建')
  assert.equal(dev.req.context, 'fresh')
  assert.equal(dev.req.provider, 'spawn')
  assert.match(dev.req.prompt[0].text, new RegExp(`SETTLED: ${cardId}`), 'worker 首条指令应带 SETTLED 机读行要求')
  assert.match(merger.req.prompt[0].text, new RegExp(`SETTLED: ${mergeId}`), 'merger 首条指令应带 SETTLED 机读行要求')
  assert.equal(calls.reviewerSpawns.length, 3, '三维审查者=一次性 spawn（ADR-0121 D1）')
  // 消息路收割留痕
  const fullHist = orch.runs.get(agent.session.id).history.map((h) => h.event).join('\n') // status() 已瘦身（≤10 条），早期事件断言走全量史
  assert.match(fullHist, new RegExp(`team: ${cardId} SETTLED 回传`))
  assert.match(fullHist, new RegExp(`team: ${mergeId} SETTLED 回传`), '合并专员 SETTLED 也应走消息路（merge 卡看主卡 phase=merging 的闸）')
  assert.match(fullHist, /团队模式：agentTeams 就绪/)
  assert.equal(calls.sent.length, 0, '无返工时不应有复用消息')
  // merger 消息路真实置位证据：终审发现项②回归钉——onMergerSettled 确实跑过
  // （run 卡账里主卡 mergeSettledAt 已置位，而非只靠卡位兜底）
  const rec = orch.status(agent).cards.find((c) => c.id === cardId)
  assert.ok(rec, '开发卡记录应在 status 里')
})

test('团队返工流：spec FAIL → 同名队友收到带发现项的返工指令（sendMessage 复用，不重开会话）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(93)
  let specCalls = 0
  const { ctx, agent, calls, wireDeliver } = mkTeamCtx(root)
  // 覆盖 reviewer 判定：spec 第一次 FAIL，之后 PASS
  const origStart = ctx.subagents.start
  ctx.subagents.start = async (p, req) => {
    if (/^jxx-reviewer-spec-/.test(req.label)) {
      specCalls += 1
      const verdict = specCalls === 1 ? 'FAIL' : 'PASS'
      return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: `发现项\nVERDICT: ${verdict}` }] }), dispose: async () => {} }
    }
    return origStart(p, req)
  }
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))

  await orch.auto(agent, '93')
  await waitFor(() => orch.status(agent).stage === 'ops')

  assert.ok(specCalls >= 2, 'spec 审查至少两轮（FAIL 返工后重审）')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)))
  const devSpawns = calls.spawned.filter((s) => s.req.name?.startsWith('dev-'))
  assert.equal(devSpawns.length, 1, 'worker 队友只建一次（返工复用，不重开）')
  const reworkMsg = calls.sent.find((s) => s.req.target === 'dev-a')
  assert.ok(reworkMsg, '返工应经 sendMessage 下发给 dev-a')
  assert.match(reworkMsg.req.content[0].text, /返工原因/, '返工消息应携带审查发现项')
  assert.match(reworkMsg.req.content[0].text, new RegExp(`SETTLED: ${cardId}`), '复用指令同样要求 SETTLED 回传行')
})

test('双路去重：SETTLED 消息与卡位信号同时到达，不重复收口（审查者不重复起）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(92)
  const { ctx, agent, calls, wireDeliver } = mkTeamCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  let delivered = 0
  wireDeliver((text) => {
    delivered += 1
    orch.onTeamMessage(agent, text)
    if (delivered === 1) {
      // 模拟「消息与卡位同时到达」：首条 SETTLED 之外再补发一条重复消息（宿主重投/双路竞态）
      orch.onTeamMessage(agent, '重复投递\nSETTLED: ' + text.match(/SETTLED:\s*(\S+)/)[1])
    }
  })

  await orch.auto(agent, '92')
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)))
  assert.equal(calls.reviewerSpawns.length, 3, '三维审查者恰好一轮三个（消息重复不重复起审查）')
  const fullHist = orch.runs.get(agent.session.id).history.map((h) => h.event).join('\n') // status() 已瘦身（≤10 条），早期事件断言走全量史
  assert.equal((fullHist.match(new RegExp(`team: ${cardId} SETTLED 回传`, 'g')) || []).length, 1, '同一卡 settle 只记一次账')
})

test('消息丢失兜底：队友干活但不回 SETTLED → 卡位扫描照常推进（watcher 不动）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId, mergeId } = mkRepo(91)
  const { ctx, agent, calls, wireDeliver } = mkTeamCtx(root, { noSettle: true })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver(() => { /* 消息路断：队友不回传 */ })

  await orch.auto(agent, '91')
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)), '卡位兜底：开发卡仍应 done')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${mergeId}.md`)))
  assert.equal(calls.spawned.length, 2)
  const fullHist = orch.runs.get(agent.session.id).history.map((h) => h.event).join('\n') // status() 已瘦身（≤10 条），早期事件断言走全量史
  assert.doesNotMatch(fullHist, /SETTLED 回传/, '无消息路收口留痕')
})

test('teamMode=off：宿主有 agentTeams 也全走一次性路径（回归判据：既有行为零变化）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkdtempSync(join(tmpdir(), 'jxx-team-off-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', '90-off-prd', 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', '90-off-prd', 'PRD.md'),
    '# PRD 90 · off 档\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n')
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无\n\n## 评论\n')
  const cardId = '90-01-solo'

  const agent = {
    id: 'sess-off',
    session: { id: 'sess-off', header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { spawned: [], sent: [] }
  const teams = {
    async spawnTeammate(_c, req) { calls.spawned.push(req.name); return { member: { name: req.name } } },
    async sendMessage(_c, req) { calls.sent.push(req.target); return { messageId: 'm', status: 'accepted' } },
    async interrupt() { return { previousStatus: 'inactive' } },
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: (key) => (key === 'agentTeams' ? teams : undefined),
    subagents: {
      start: async (_p, req) => {
        const dev = req.label.match(/^jxx-dev-(.+)$/)
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = req.label.match(/^jxx-merger-(.+)$/)
        if (dev) {
          const id = dev[1]
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已交付' }] }), dispose: async () => {} }
        }
        if (rev) return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'VERDICT: PASS' }] }), dispose: async () => {} }
        if (mer) {
          renameSync(join(openDir, `merge-${mer[1]}.md`), join(root, 'control', 'cards', 'done', `merge-${mer[1]}.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已合入' }] }), dispose: async () => {} }
        }
        throw new Error(`未知角色 ${req.label}`)
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  const orch = new Orchestrator(ctx, CONFIG({ teamMode: 'off' }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '90')
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)))
  assert.equal(calls.spawned.length, 0, 'off 档不建队友')
  assert.equal(calls.sent.length, 0, 'off 档不发队友消息')
  const fullHist = orch.runs.get(agent.session.id).history.map((h) => h.event).join('\n') // status() 已瘦身（≤10 条），早期事件断言走全量史
  assert.doesNotMatch(fullHist, /团队模式：agentTeams 就绪/)
  assert.match(fullHist, /spawn worker/, 'off 档仍走一次性 spawn worker')
})
