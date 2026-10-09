/**
 * 失败韧性 E2E（PRD 110 工单 03 / ADR-0121 D3：LLM 失败不弃会话）：
 * 团队路径派发失败 → 同会话退避重发（不新开成员）；连续超限 → notify 等用户切模型（卡位 blocked）→
 * 用户恢复 → 唤醒**同一队友**（同一会话，上下文零丢失）；探针实证 failed → 换名重建 fresh 后继 +
 * 交接简报来自卡面流转段（≤2000 字符）；退避异步不阻塞 watcher；teamBackoff=0 直转人工；go「继续」唤醒。
 * 失败注入口径：spawnTeammate 抛错 = 首派失败（新会话没建成）；sendMessage 抛错 = 既有队友轮次派发失败。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'
import { backoffDelayMs, createMemberProbe, buildHandoffFromCard } from '../src/team-spawn.mjs'

const BOARD = process.env.JXX_BOARD
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')

function mkRepo(prdNum) {
  const root = mkdtempSync(join(tmpdir(), `jxx-res-${prdNum}-`))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', `${prdNum}-res-prd`, 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', `${prdNum}-res-prd`, 'PRD.md'),
    `# PRD ${prdNum} · 韧性测试\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n`)
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
  return { root, cardId: `${prdNum}-01-solo`, mergeId: `merge-${prdNum}-01-solo` }
}

function mkFlowLine(text) {
  return `- 2026-10-08 21:00 | inbox->claimed | jxx-driver | ${text}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 带 agentTeams + listMembers 探针的 stub ctx；sendMessage 失败次数可编排（failTimes 次后恢复）。 */
function mkResTeamCtx(root, behavior = {}) {
  behavior.failCounters = behavior.failCounters || {}
  const agent = {
    id: `sess-res-${behavior.prd ?? 0}`,
    session: { id: `sess-res-${behavior.prd ?? 0}`, header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { spawned: [], sent: [], sendTargets: [] }
  const members = new Map()
  const dimFails = {}
  let deliver = null
  const failOnce = (name) => {
    if (behavior.failNames?.includes(name) && (behavior.failCounters[name] ?? 0) < (behavior.failTimes ?? 1)) {
      behavior.failCounters[name] = (behavior.failCounters[name] ?? 0) + 1
      return true
    }
    return false
  }
  const teams = {
    async spawnTeammate(_caller, req) {
      calls.spawned.push({ req })
      if (behavior.failSpawnNames?.includes(req.name)) {
        members.set(req.name, { name: req.name, status: 'failed' })
        // 模拟真实失败延迟（150ms）：给编排器的退避重发留出时间——测简报竞态由产品 backoffDelay 覆写控制
        await new Promise((r) => setTimeout(r, 150))
        throw new Error(`模拟 spawn 失败（${req.name}）`)
      }
      members.set(req.name, { name: req.name, status: 'running' })
      if (!behavior.noWorkOnSpawn) runTeammate(req.name, req.prompt.map((b) => b.text).join('\n'))
      return { member: { name: req.name } }
    },
    async sendMessage(_caller, req) {
      calls.sent.push({ req })
      calls.sendTargets.push(req.target)
      if (failOnce(req.target)) throw new Error(`模拟 sendMessage 失败（${req.target}）`)
      runTeammate(req.target, req.content.map((b) => b.text).join('\n'))
      return { messageId: `m-${calls.sent.length}`, status: 'accepted' }
    },
    async interrupt() { return { previousStatus: 'inactive' } },
    listMembers(_caller) {
      return [{ id: 'lead', name: 'lead', role: 'lead', status: 'running', diagnostics: [] },
        ...[...members.values()]]
    },
    _members: members,
  }
  const runTeammate = (name, text) => {
    // 指令文本里机读行以 markdown 反引号引用（`SETTLED: <id>`），提取时剥掉引号只留卡 id
    const m = /SETTLED:[ \t]*`?([A-Za-z0-9][A-Za-z0-9._-]*)`?/.exec(text)
    const card = m ? m[1] : undefined
    if (!card) return
    if (card.startsWith('merge-')) {
      const from = join(openDir, `${card}.md`)
      if (existsSync(from)) renameSync(from, join(root, 'control', 'cards', 'done', `${card}.md`))
    } else {
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
      start: async (_p, req) => {
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        if (!rev) throw new Error(`团队模式下不应有一次性 spawn：${req.label}`)
        // failDims 只失败 failDimsTimes 轮（默认 1）——之后转 PASS，保证返工链可收敛（审查重试走既有 maxRetries 面）
        const dim = rev[1]
        dimFails[dim] = (dimFails[dim] ?? 0)
        const wantFail = behavior.failDims?.includes(dim) && dimFails[dim] < (behavior.failDimsTimes ?? 1)
        if (wantFail) dimFails[dim] += 1
        return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: `报告\nVERDICT: ${wantFail ? 'FAIL' : 'PASS'}` }] }), dispose: async () => {} }
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent, calls, teams, wireDeliver: (fn) => { deliver = fn }, behavior }
}

async function waitFor(pred, timeoutMs = 30_000, stepMs = 25) {
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

// ---- 单元：退避曲线 / 探针 / 交接简报 ----

test('退避曲线：min(2^n * 5s, 60s)（n 从 0 计幂）——5s、10s、20s、40s、60s 封顶；非法入参响亮报错', () => {
  assert.equal(backoffDelayMs(1), 5_000)
  assert.equal(backoffDelayMs(2), 10_000)
  assert.equal(backoffDelayMs(3), 20_000)
  assert.equal(backoffDelayMs(4), 40_000)
  assert.equal(backoffDelayMs(5), 60_000)
  assert.equal(backoffDelayMs(9), 60_000)
  assert.throws(() => backoffDelayMs(0), /backoffDelayMs/)
  assert.throws(() => backoffDelayMs(1.5), /backoffDelayMs/)
})

test('成员探针：listMembers 缺失 → 恒 false（不抛）；status=failed/unknown 按表取值；探针异常吞掉按未知；memberBusy 已移除（R2 教训）', () => {
  const agent = { id: 'a1' }
  const probe = createMemberProbe({ teams: { listMembers: () => [
    { name: 'dev-a', status: 'failed' }, { name: 'dev-b', status: 'running' }, { name: 'dev-c', status: 'inactive' },
  ] }, agent, log: () => {} })
  assert.equal(probe.memberFailed('dev-a'), true)
  assert.equal(probe.memberFailed('dev-b'), false)
  assert.equal(probe.memberFailed('dev-c'), false)
  assert.equal(probe.memberFailed('dev-不存在的'), false)
  // memberBusy 已随 R2 修复移除：running（回合执行中）与「重发会双份投递」无实证因果，
  // 且「跳过重发且不重挂」曾把重试链静默杀死——探针面只暴露 memberFailed
  assert.equal(probe.memberBusy, undefined)
  const noProbe = createMemberProbe({ teams: { spawnTeammate() {}, sendMessage() {}, interrupt() {} }, agent, log: () => {} })
  assert.equal(noProbe.memberFailed('dev-a'), false)
  assert.equal(noProbe.memberBusy, undefined)
  const throwProbe = createMemberProbe({ teams: { listMembers: () => { throw new Error('boom') } }, agent, log: () => {} })
  assert.equal(throwProbe.memberFailed('dev-a'), false)
  assert.throws(() => createMemberProbe({}), /agentTeams/)
  assert.throws(() => createMemberProbe({ teams: { listMembers() {} } }), /Lead/)
})

test('交接简报：全文流转行都识别（领取记录 + 流转段）、保留最近记录、2000 字符截断（先保最近）、无命中 matched=false', () => {
  const longText = 'x'.repeat(3000)
  const card = [
    '# 卡',
    '',
    '## 领取记录',
    '（说明文字不是流转行）',
    mkFlowLine('领卡施工'),
    '',
    '## 流转追加段',
    '',
    mkFlowLine('第二次流转：交付待审'),
    ' indented 非 - 开头行',
    mkFlowLine('第三次流转（最新）：合并受阻 ' + longText),
  ].join('\n')
  const r = buildHandoffFromCard(card)
  assert.equal(r.matched, true)
  assert.equal(r.lines, 3, '流转段 3 条命中（前段 1 条同格式也命中——全文流转行都识别）')
  assert.ok(r.text.length <= 2000, `截断后应 ≤2000，实际 ${r.text.length}`)
  assert.ok(r.text.includes('第三次流转'), '最新行硬截到预算（≤2000 是硬上限，保证最新的先保住）')
  assert.ok(!r.text.includes('第二次流转'), '更旧的行被预算挤掉（保最近优先）')
  assert.ok(!r.text.includes('领卡施工'), '最早的行被预算挤掉')
  assert.equal(r.truncated, true)
  assert.equal(buildHandoffFromCard('没有任何流转行的文本').matched, false)
  assert.equal(buildHandoffFromCard('').matched, false)
  assert.equal(buildHandoffFromCard(undefined).matched, false)
  // ISO T 分隔 + Z 尾时间戳也命中
  const r2 = buildHandoffFromCard('- 2026-10-08T13:51:58.575Z | held->inbox | jxx-driver | 依赖已就绪\n')
  assert.equal(r2.matched, true)
})

// ---- config ----

test('config：teamBackoff 默认 3；0 合法（关退避直转人工）；负数/小数响亮报错', () => {
  assert.equal(normalizeConfig({}).teamBackoff, 3)
  assert.equal(normalizeConfig({ teamBackoff: 0 }).teamBackoff, 0)
  assert.equal(normalizeConfig({ teamBackoff: 5 }).teamBackoff, 5)
  assert.throws(() => normalizeConfig({ teamBackoff: -1 }), /teamBackoff/)
  assert.throws(() => normalizeConfig({ teamBackoff: 0.5 }), /teamBackoff/)
  assert.throws(() => normalizeConfig({ teamBackoff: 'x' }), /teamBackoff/)
})

// ---- E2E：同会话重发恢复（返工派发失败一次 → 同名重发 → 收口） ----

test('韧性 E2E：worker 轮次失败 → 同名重发（不新开成员）→ 恢复后同一会话完成 SETTLED', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId, mergeId } = mkRepo(88)
  const { ctx, agent, calls, wireDeliver } = mkResTeamCtx(root, {
    prd: 88, failDims: ['spec'], failNames: ['dev-a'], failTimes: 1,
  })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))
  orch.backoffDelay = () => 80

  await orch.auto(agent, '88')
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)), '卡最终 done')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${mergeId}.md`)))
  assert.equal(calls.spawned.filter((s) => s.req.name?.startsWith('dev-')).length, 1, 'worker 队友只建一个（失败不弃会话）')
  assert.equal(calls.sendTargets.filter((n) => n === 'dev-a').length, 2, '返工派发失败一次 + 同名重发成功一次')
  const hist = orch.status(agent).history.map((h) => h.event).join('\n')
  assert.match(hist, /同名重发/, '应有同名重发留痕')
  assert.doesNotMatch(hist, /换名重建/, '一次失败不该触发换名重建')
})

test('韧性 E2E：连续失败超限 → notify 含「切换模型后唤醒」语义且卡位 blocked；恢复后唤醒同一队友收口', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId, mergeId } = mkRepo(87)
  const { ctx, agent, calls, teams, behavior, wireDeliver } = mkResTeamCtx(root, {
    prd: 87, failDims: ['spec'], failNames: ['dev-a'], failTimes: 4, // 4 连败 > teamBackoff 3 → 等待窗
  })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))
  orch.backoffDelay = () => 60

  await orch.auto(agent, '87')
  await waitFor(() => agent.followups.some((m) => /切换模型后让我继续/.test(m.content?.[0]?.text || '')), 15_000)
  // cardMove blocked 是 fire-and-forget（物理移卡稍后于 notify）——等卡真的回待领位 + needs-info
  await waitFor(() => {
    if (!existsSync(join(root, 'control', 'cards', 'open', `${cardId}.md`))) return false
    return /needs-info/.test(readFileSync(join(root, 'control', 'cards', 'open', `${cardId}.md`), 'utf8'))
  }, 15_000, '卡位应落 blocked（回待领位 + needs-info）')
  const cardText = readFileSync(join(root, 'control', 'cards', 'open', `${cardId}.md`), 'utf8')
  assert.match(cardText, /needs-info/)
  // 模拟用户恢复：探针转 running + 失败计数封顶（此后 sendMessage 成功）→ flowResumed 唤醒同一队友
  teams._members.get('dev-a').status = 'running'
  behavior.failCounters['dev-a'] = 99
  const r = orch.flowResumed(agent, '测试恢复')
  assert.equal(r.resumed, true)
  assert.equal(r.revived, 1)
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)), '唤醒后同一队友把卡做完')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${mergeId}.md`)))
  assert.equal(calls.spawned.filter((s) => s.req.name?.startsWith('dev-')).length, 1, '全程只建一个 worker 队友')
  assert.ok(calls.sendTargets.filter((n) => n === 'dev-a').length >= 5, '唤醒后仍发同名队友（4 败 + 1 成功）')
  const hist = orch.status(agent).history.map((h) => h.event).join('\n')
  assert.match(hist, /用户恢复，唤醒同一队友/)
})

test('韧性 E2E：队友 failed（探针实证）→ 换名重建 + 交接简报来自卡面流转段（≤2000）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId, mergeId } = mkRepo(86)
  const { ctx, agent, calls, wireDeliver } = mkResTeamCtx(root, { prd: 86, failSpawnNames: ['dev-a'] })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))
  orch.backoffDelay = () => 60

  await orch.auto(agent, '86')
  // 卡在 inbox（spawn 失败未移卡）：backoff 窗口内补流转行（交接简报素材）
  await sleep(30)
  const cardFile = join(root, 'control', 'cards', 'open', `${cardId}.md`)
  writeFileSync(cardFile, readFileSync(cardFile, 'utf8').replace('## 流转追加段', `## 流转追加段\n\n${mkFlowLine('worker dev-a 领卡施工（将因会话失败换名重建）')}`))

  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)), '换名重建后卡最终 done')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${mergeId}.md`)))
  const devSpawns = calls.spawned.filter((s) => s.req.name?.startsWith('dev-'))
  assert.equal(devSpawns.length, 2, 'dev-a 失败 + dev-b 重建，恰好两次 spawnTeammate')
  assert.equal(devSpawns[0].req.name, 'dev-a')
  assert.equal(devSpawns[1].req.name, 'dev-b', '重建走名字池下一名（旧名不复用）')
  assert.ok(devSpawns[1].req.prompt[0].text.includes('交接简报'), '重建首条指令带交接简报段')
  assert.ok(devSpawns[1].req.prompt[0].text.includes('dev-a 领卡施工'), '简报内容来自卡面流转段')
  const hist = orch.status(agent).history.map((h) => h.event).join('\n')
  assert.match(hist, /换名重建 dev-a → dev-b/)
  assert.match(hist, /交接简报 \d+ 字符/)
})

test('韧性：退避计时不阻塞 watcher tick（异步 setTimeout，tick 照常轮询）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(85)
  const { ctx, agent, wireDeliver } = mkResTeamCtx(root, {
    prd: 85, failDims: ['spec'], failNames: ['dev-a'], failTimes: 1,
  })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))
  orch.backoffDelay = () => 150
  await orch.auto(agent, '85')
  // 失败发生在返工派发；等待窗内（150ms 退避未到）tick 仍在推进（不抛不卡）
  await sleep(80)
  const st = orch.status(agent)
  assert.equal(st.stage, 'implement', '等待窗内编排仍在 implement（watcher 没被退避阻塞）')
  assert.ok(st.cards.length > 0)
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)))
})

test('韧性：teamBackoff=0 → 失败立即超限（不重发、卡 blocked + needs-info 等用户恢复）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(84)
  const { ctx, agent, calls, teams, behavior, wireDeliver } = mkResTeamCtx(root, {
    prd: 84, failDims: ['spec'], failNames: ['dev-a'], failTimes: 1,
  })
  const orch = new Orchestrator(ctx, CONFIG({ teamBackoff: 0 }), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))
  await orch.auto(agent, '84')
  await waitFor(() => agent.followups.some((m) => /切换模型后让我继续/.test(m.content?.[0]?.text || '')), 15_000)
  assert.equal(calls.sent.length, 1, '只有失败的那次派发，无自动重发')
  await waitFor(() => {
    if (!existsSync(join(root, 'control', 'cards', 'open', `${cardId}.md`))) return false
    return /needs-info/.test(readFileSync(join(root, 'control', 'cards', 'open', `${cardId}.md`), 'utf8'))
  }, 15_000, '卡位 blocked（待领位 + needs-info）')
  // 恢复 → 唤醒收口
  teams._members.get('dev-a').status = 'running'
  behavior.failCounters['dev-a'] = 99
  const r = orch.flowResumed(agent, '测试恢复')
  assert.equal(r.resumed, true)
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)))
})

test('韧性：go「继续」唤醒等待中的队友（恢复识别 → flowResumed 同一内核入口）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(83)
  const { ctx, agent, teams, behavior, wireDeliver } = mkResTeamCtx(root, {
    prd: 83, failDims: ['spec'], failNames: ['dev-a'], failTimes: 4,
  })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))
  orch.backoffDelay = () => 50
  await orch.auto(agent, '83')
  await waitFor(() => agent.followups.some((m) => /切换模型后让我继续/.test(m.content?.[0]?.text || '')), 15_000)
  teams._members.get('dev-a').status = 'running'
  behavior.failCounters['dev-a'] = 99
  // goDispatch 的恢复识别面（idea="继续"）与 flowResumed 是同一内核入口——直接验证 flowResumed
  const r2 = orch.flowResumed(agent, '用户口头恢复')
  assert.equal(r2.resumed, true)
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)))
})

test('韧性：jxx_flow action="resumed" 显式恢复 + go「继续」未命中 hint 进分流材料（index 层恢复识别面）', async () => {
  const mod = await import('../src/index.mjs')
  let tool
  const mountCtx = {
    logger: { info() {}, warn() {}, error() {} },
    on() {}, effect(fn) { fn() }, get() { return undefined },
    tools: { register(t) { tool = t } },
    systemPrompt: { context() {} },
    subagents: { start: async () => { throw new Error('不该 spawn') } },
    agents: { get: () => undefined },
  }
  mod.apply(mountCtx, { autoConfirm: true, verbose: false, pollIntervalMs: 50 })
  // action="resumed"（新增动作）：无编排会话 → 不炸、resumed=false 且带提示
  const r = await tool.execute({ action: 'resumed' }, { agent: { id: 'sess-resume', session: { id: 'sess-resume' } } })
  assert.equal(r.resumed, false)
  assert.ok(r.hint)
  // go「继续」未命中等待窗 → 不拦截，恢复说明附进分流 steer 材料（模型知道「继续」为何没生效）
  const steered = []
  const agent2 = {
    id: 'sess-resume2', session: { id: 'sess-resume2' },
    steer(m) { steered.push(m.content?.[0]?.text ?? String(m)) }, followup() {},
  }
  const r2 = await tool.execute({ action: 'go', idea: '继续' }, { agent: agent2 })
  assert.notEqual(r2.route, 'resumed')
  assert.equal(steered.length, 1)
  assert.match(steered[0], /- 注：本会话没有进行中的编排/, 'steer 材料应带 flowResumed 未命中说明（- 注：前缀）')
})

test('韧性：换名重建定位不到旧队友名 → 一次性路径兜底不炸（R2 重审 spawnFallback 参数错位回归）', async (t) => {
  const { root, cardId } = mkRepo(81)
  const spawned = []
  const agent = { id: 'sess-fb', session: { id: 'sess-fb' }, followups: [], followup(m) { this.followups.push(m) } }
  const orch = new Orchestrator({
    agents: { get: () => undefined },
    get: () => undefined, // 无 agentTeams：本测试直接驱动 respawnTeammate，不经通道
    subagents: { start: async (_p, req) => { spawned.push(req.label); return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '一次性兜底完成' }] }), dispose: async () => {} } } },
    logger: { info() {}, warn() {}, error() {} },
  }, CONFIG(), { info() {}, warn() {}, error() {} })
  test.after(async () => { await orch.dispose() })
  // 最小 run：卡在办、通道 cardOwners 无痕（nameOf → undefined）、无等待账
  const run = {
    id: 'r-fb', root, sessionId: agent.id, agent,
    stage: 'implement', stopped: false,
    cards: new Map([[cardId, { id: cardId, phase: 'claimed', alive: true, retries: 0 }]]),
    channel: { nameOf: () => undefined },
    controllers: new Set(),
    resilience: { byCard: new Map(), revived: [] },
    history: [], blocked: [], board: undefined,
  }
  // 修复前：spawnFallback(cardId, role, run) 实参错位 → this.spawn(run=字符串).cards TypeError 当场炸
  orch.respawnTeammate(run, cardId, 'dev', { memberName: undefined, failures: 1 }, '测试注入：定位不到旧名')
  await waitFor(() => spawned.includes(`jxx-dev-${cardId}`))
  assert.match(run.history.map((h) => h.event).join('\n'), /定位不到旧队友名/, '定位不到旧名的留痕在案')
  assert.ok(spawned.every((l) => !l.includes('undefined')), 'spawn label 无 undefined 污染（参数未错位）')
})

// ---- 一次性路径不受影响（回归判据） ----

test('韧性：一次性路径（无 channel）worker 失败走既有 onWorkerSettled 重试语义（逐字节不动）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkdtempSync(join(tmpdir(), 'jxx-res-off-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', '82-off-res', 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', '82-off-res', 'PRD.md'),
    '# PRD 82 · off 韧性\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n')
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无\n\n## 评论\n')
  const agent = {
    id: 'sess-res-off', session: { id: 'sess-res-off', header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    subagents: {
      start: async (_p, req) => {
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = req.label.match(/^jxx-merger-(.+)$/)
        if (rev) return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'VERDICT: PASS' }] }), dispose: async () => {} }
        if (mer) {
          renameSync(join(openDir, `merge-${mer[1]}.md`), join(root, 'control', 'cards', 'done', `merge-${mer[1]}.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已合入' }] }), dispose: async () => {} }
        }
        return { result: Promise.resolve({ stopReason: 'error', diagnostic: '模拟失败', output: [] }), dispose: async () => {} }
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  await orch.auto(agent, '82')
  await waitFor(() => {
    const st = orch.status(agent)
    return st.cards.length && st.cards[0].phase === 'blocked'
  })
  const st = orch.status(agent)
  assert.ok(st.blocked.length > 0)
  assert.ok(agent.followups.some((m) => /转人工/.test(m.content[0].text)), '一次性路径仍走既有「转人工」语义')
})
