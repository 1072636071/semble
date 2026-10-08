/**
 * 生命周期与回退收口（PRD 110 工单 04 / ADR-0121 D4/D5）：
 *  - stop：团队路径在飞队友被 interrupt（fixture 断言调用），一次性路径 AbortController 语义不变（off 档 signal.aborted 实证）；
 *  - run 收口（ops）后持久队友不解散，同会话下一个 run 复用通道按名续接（不新开成员）；
 *  - stop 后在途 dispatch 失败不再回退新开一次性子会话（dispatchFrozen 哨兵，旧名 halted 已更名避免与 stopped 语义叠影）；
 *  - interruptInFlight 通道单测：出册幂等、异常不外泄、不计预算、成员保留在册。
 * 回归判据：既有测试文件零改动全绿（本文件只增不改）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'
import { createNamePool, createReuseLedger, createTeamChannel } from '../src/team-spawn.mjs'

const BOARD = process.env.JXX_BOARD
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')

/** 一个 root 造多份 PRD（同会话两连 run 验证通道复用）。 */
function mkRepoMulti(prdNums) {
  const root = mkdtempSync(join(tmpdir(), 'jxx-lifecycle-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const cards = {}
  for (const n of prdNums) {
    const dir = join(root, '.scratch', `${n}-lifecycle-prd`, 'issues')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(root, '.scratch', `${n}-lifecycle-prd`, 'PRD.md'),
      `# PRD ${n} · 生命周期测试\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n`)
    writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
    cards[n] = { cardId: `${n}-01-solo`, mergeId: `merge-${n}-01-solo` }
  }
  return { root, cards }
}

/**
 * 生命周期 fixture：mock agentTeams 记录 spawn/sent/interrupt 三面调用。
 * 行为开关：noSettleWorker（worker 在飞不干活不回传）/ noSettleMerger（merger 在飞不收口）/
 * hangDev（一次性 dev spawn 挂起不返回，验证 AbortController 语义）/ deferSend（首个 sendMessage 挂起，
 * 由 releaseDefer 拒绝，验证 halted 守卫）。
 */
function mkLifecycleCtx(root, behavior = {}) {
  const agent = {
    id: 'sess-lifecycle',
    session: { id: 'sess-lifecycle', header: { cwd: root } },
    followups: [],
    followup(msg) { this.followups.push(msg) },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { spawned: [], sent: [], interrupted: [], oneshotLabels: [], lastDevSignal: undefined }
  let deliver = null
  let deferReject = null
  const teams = {
    async spawnTeammate(_caller, req) {
      calls.spawned.push({ req })
      runTeammate(req.name, req.prompt.map((b) => b.text).join('\n'))
      return { member: { name: req.name } }
    },
    async sendMessage(_caller, req) {
      calls.sent.push({ req })
      if (behavior.deferSend && !deferReject) {
        // 有意悬挂直到 releaseDefer（规则审查备案）：模拟「派发在途时 stop」窗口，无活跃句柄不阻塞退出
        await new Promise((_res, rej) => { deferReject = rej })
      }
      runTeammate(req.target, req.content.map((b) => b.text).join('\n'))
      return { messageId: `m-${calls.sent.length}`, status: 'accepted' }
    },
    async interrupt(_caller, name) {
      calls.interrupted.push(name)
      return { previousStatus: 'running' }
    },
  }
  const runTeammate = (name, text) => {
    // 指令文本里机读行以 markdown 反引号引用（`SETTLED: <id>`），提取时剥掉引号只留卡 id
    const m = /SETTLED:[ \t]*`?([A-Za-z0-9][A-Za-z0-9._-]*)`?/.exec(text)
    const card = m ? m[1] : undefined
    if (!card) return
    if (card.startsWith('merge-')) {
      if (behavior.noSettleMerger) return // 在飞：不动卡、不回传
      const from = join(openDir, `${card}.md`)
      if (existsSync(from)) renameSync(from, join(root, 'control', 'cards', 'done', `${card}.md`))
    } else {
      if (behavior.noSettleWorker) return // 在飞：不动卡、不回传
      if (existsSync(join(openDir, `${card}.md`))) {
        renameSync(join(openDir, `${card}.md`), join(openDir, `${card}.claimed.md`))
      }
      if (existsSync(join(openDir, `${card}.claimed.md`))) {
        renameSync(join(openDir, `${card}.claimed.md`), join(openDir, `${card}.review.md`))
      }
    }
    deliver?.(`${name} 已办结 ${card}。\nSETTLED: ${card}`)
  }
  const handlers = {}
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: (key) => (key === 'agentTeams' ? teams : undefined),
    on: (event, fn) => { (handlers[event] = handlers[event] || []).push(fn) },
    subagents: {
      start: async (_provider, req) => {
        calls.oneshotLabels.push(req.label)
        const dev = req.label.match(/^jxx-dev-(.+)$/)
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = req.label.match(/^jxx-merger-(.+)$/)
        if (dev) {
          if (behavior.hangDev) {
            calls.lastDevSignal = req.signal
            // 有意悬挂（规则审查备案）：进程级 pending 无活跃句柄，node --test 退出不受阻；dispose 时由 abort 信号语义承接
            return { result: new Promise(() => {}), dispose: async () => {} } // 在飞：永不返回
          }
          const id = dev[1]
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已交付' }] }), dispose: async () => {} }
        }
        if (rev) return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: `报告\nVERDICT: PASS` }] }), dispose: async () => {} }
        if (mer) {
          renameSync(join(openDir, `merge-${mer[1]}.md`), join(root, 'control', 'cards', 'done', `merge-${mer[1]}.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已合入' }] }), dispose: async () => {} }
        }
        throw new Error(`未知角色 ${req.label}`)
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent, calls, handlers, wireDeliver: (fn) => { deliver = fn }, releaseDefer: (err) => deferReject?.(err) }
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

test('stop：团队路径在飞 worker 被 interrupt（宿主调用面断言），run 摘除', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cards } = mkRepoMulti([84])
  const { ctx, agent, calls, wireDeliver } = mkLifecycleCtx(root, { noSettleWorker: true })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver(() => { /* worker 在飞不回传 */ })

  await orch.auto(agent, '84')
  await waitFor(() => calls.spawned.length >= 1)
  assert.equal(orch.status(agent).stage, 'implement')
  assert.ok(existsSync(join(root, 'control', 'cards', 'open', `${cards['84'].cardId}.md`)), 'worker 在飞：卡未被动')

  await orch.stop(agent)
  assert.deepEqual(calls.interrupted, ['dev-a'], '在飞队友 dev-a 应被 teams.interrupt 中断（D4）')
  assert.equal(calls.spawned.length, 1, 'stop 不新增成员')
  assert.equal(calls.sent.length, 0)
  const hist = orch.status(agent) // active:false —— run 已摘除
  assert.equal(hist.active, false)
  assert.ok(existsSync(join(root, 'control', 'cards', 'open', `${cards['84'].cardId}.md`)), '卡留待领位（不发明收尾行为）')
  // interrupt 后持久成员不解散：fixture 无解散面可断言——由通道单测锁 stats().members 与「复用不重建」
})

test('stop：在飞 merger 同样被 interrupt（合并卡在飞出册）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cards } = mkRepoMulti([83])
  const { ctx, agent, calls, wireDeliver } = mkLifecycleCtx(root, { noSettleMerger: true })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => { if (!text.includes('merge-')) orch.onTeamMessage(agent, text) })

  await orch.auto(agent, '83')
  await waitFor(() => calls.spawned.some((s) => s.req.name === 'merger-a'), 30_000)

  await orch.stop(agent)
  assert.deepEqual(calls.interrupted, ['merger-a'], '在飞合并专员应被 interrupt')
  assert.ok(existsSync(join(root, 'control', 'cards', 'open', `${cards['83'].mergeId}.md`)), '合并卡留 open（不代收）')
  assert.equal(orch.status(agent).active, false)
})

test('teamMode=off：stop 不碰 agentTeams，一次性在飞 worker 的 AbortController 语义不变', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root } = mkRepoMulti([82])
  const { ctx, agent, calls } = mkLifecycleCtx(root, { hangDev: true })
  const orch = new Orchestrator(ctx, CONFIG({ teamMode: 'off' }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '82')
  await waitFor(() => calls.oneshotLabels.some((l) => l.startsWith('jxx-dev-')))
  assert.ok(calls.lastDevSignal, '一次性 dev spawn 应收到 AbortSignal（宿主契约）')
  assert.equal(calls.lastDevSignal.aborted, false)

  await orch.stop(agent)
  assert.equal(calls.interrupted.length, 0, 'off 档 stop 不调用 teams.interrupt')
  assert.equal(calls.lastDevSignal.aborted, true, '一次性路径沿用 AbortController 中止（行为不变）')
  assert.equal(orch.status(agent).active, false)
})

test('run 收口不解散：ops 后 stop，同会话下一个 run 复用通道按名续接（不新开成员）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cards } = mkRepoMulti([81, 80])
  const { ctx, agent, calls, wireDeliver } = mkLifecycleCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))

  // run 1：全链到 ops
  await orch.auto(agent, '81')
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.deepEqual(calls.spawned.map((s) => s.req.name).sort(), ['dev-a', 'merger-a'], '首 run 建 dev-a+merger-a')
  assert.equal(calls.interrupted.length, 0, 'run 收口（ops）不解散成员（D4）')

  // run 1 停（此刻无在飞）——成员保留
  await orch.stop(agent)
  assert.deepEqual(calls.interrupted, [], '无在飞时 stop 不 interrupt')
  assert.equal(calls.spawned.length, 2)

  // run 2：同会话复用通道，dev-a/merger-a 按名续接（sendMessage 复用，不 spawnTeammate）
  await orch.auto(agent, '80')
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.equal(calls.spawned.length, 2, '第二 run 零新成员（复用持久队友）')
  assert.deepEqual(calls.interrupted, [])
  const sentTargets = calls.sent.map((s) => s.req.target)
  assert.ok(sentTargets.includes('dev-a'), '第二 run worker 走 dev-a 复用')
  assert.ok(sentTargets.includes('merger-a'), '第二 run merger 走 merger-a 复用')
  const devMsg = calls.sent.find((s) => s.req.target === 'dev-a')
  assert.match(devMsg.req.content[0].text, new RegExp(`SETTLED: ${cards['80'].cardId}`), '复用指令点名第二张卡')
  const hist2 = orch.status(agent).history.map((h) => h.event).join('\n')
  assert.match(hist2, /复用会话既有通道/, '通道按会话续接留痕')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cards['80'].cardId}.md`)))
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cards['80'].mergeId}.md`)))
})

test('stop 后在途 dispatch 失败：不回退新开一次性子会话（dispatchFrozen 哨兵）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cards } = mkRepoMulti([79, 78])
  const { ctx, agent, calls, wireDeliver, releaseDefer } = mkLifecycleCtx(root, { deferSend: true })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))

  // run 1 建成员并正常收口
  await orch.auto(agent, '79')
  await waitFor(() => orch.status(agent).stage === 'ops')
  await orch.stop(agent)

  // run 2：复用 dev-a 走 sendMessage，消息路挂起（宿主重启窗口）→ stop → 再让消息路失败
  await orch.auto(agent, '78')
  await waitFor(() => calls.sent.some((s) => s.req.target === 'dev-a' && s.req.content[0].text.includes(cards['78'].cardId)))
  await orch.stop(agent)
  assert.deepEqual(calls.interrupted, ['dev-a'], '挂起窗口内 dev-a 在飞（在飞卡已入册）→ stop 应 interrupt')
  releaseDefer(new Error('宿主重启，消息路失效'))

  await waitFor(() => orch.status(agent).active === false)
  // 给在途 .catch 一个执行窗：轮询至多 2s（不固定睡眠，规则审查发现项）；守卫生效时不会有任何一次性 spawn
  try { await waitFor(() => calls.oneshotLabels.length > 0, 2000) } catch { /* 未触发 = 守卫生效（预期路径） */ }
  const devOneshot = calls.oneshotLabels.filter((l) => l.startsWith('jxx-dev-'))
  assert.equal(devOneshot.length, 0, 'stop 后 dispatch 失败不得回退新开一次性子会话')
  assert.equal(calls.spawned.length, 2, '也不新开队友')
  assert.ok(existsSync(join(root, 'control', 'cards', 'open', `${cards['78'].cardId}.md`)), '卡留待领位等下个 run 重派')
})

test('会话释放：onAgentDisposed 失效该会话通道缓存（新 run 建新通道，不毒缓存）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cards } = mkRepoMulti([77, 76])
  const { ctx, agent, calls, handlers, wireDeliver } = mkLifecycleCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  wireDeliver((text) => orch.onTeamMessage(agent, text))

  // run 1 建通道（缓存条目落位）并正常收口
  await orch.auto(agent, '77')
  await waitFor(() => orch.status(agent).stage === 'ops')
  await orch.stop(agent)
  assert.equal(orch.teamChannels.has(agent.session.id), true, 'run 收口后通道仍按会话缓存（D4）')

  // 模拟会话释放（agent/disposed 事件）→ 缓存条目必须失效
  await orch.onAgentDisposed(agent)
  assert.equal(orch.teamChannels.has(agent.session.id), false, '会话释放后通道缓存失效（规则审查发现项：防毒缓存）')

  // 同 sessionId 重建会话后的新 run：新建通道（新名字池），对不在册旧名重建 fresh 后继——
  // 宿主会按名字永不复用拒绝，fixture 允许重建（真实宿主的撞名派发失败回退一次性路径已有兜底）
  const agent2 = { id: agent.id, session: agent.session, followups: [], followup(msg) { agent.followups.push(msg) } }
  await orch.auto(agent2, '76')
  await waitFor(() => orch.status(agent2).stage === 'ops')
  const hist3 = orch.status(agent2).history.map((h) => h.event).join('\n')
  assert.doesNotMatch(hist3, /复用会话既有通道/, '缓存已失效：新 run 不得复用旧通道')
  assert.match(hist3, /团队模式：agentTeams 就绪/, '新 run 应新建通道')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cards['76'].cardId}.md`)), '新 run 仍应正常收口')
})

// ---- interruptInFlight 通道单测 ----

test('interruptInFlight：出册幂等、异常不外泄、不计预算、成员保留在册', async () => {
  const ledger = createReuseLedger({ reuseLimit: 8 })
  const logLines = []
  const sent = []
  const channel = createTeamChannel({
    teams: {
      async spawnTeammate(_c, req) { return { member: { name: req.name } } },
      async sendMessage(_c, req) { sent.push(req.target); return { messageId: 'm', status: 'accepted' } },
      async interrupt() { return { previousStatus: 'running' } },
    },
    agent: { id: 'a' },
    pool: createNamePool({}),
    ledger,
    log: (m) => logLines.push(m),
  })
  // 造两张在飞：a1→dev-a（fresh）、a2→dev-b（池 2）
  const r1 = await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p', poolSize: 2 })
  const r2 = await channel.dispatch({ role: 'dev', cardId: 'a2', prompt: 'p', poolSize: 2 })
  assert.deepEqual([r1.name, r2.name], ['dev-a', 'dev-b'])

  const interruptCalls = []
  const attempted = channel.interruptInFlight((cardId, name) => {
    interruptCalls.push([cardId, name])
    if (cardId === 'a1') throw new Error('已不在册（宿主侧竞态）') // 异常不外泄
  })
  assert.deepEqual(attempted, ['a1', 'a2'])
  assert.deepEqual(interruptCalls, [['a1', 'dev-a'], ['a2', 'dev-b']])
  assert.ok(logLines.some((l) => l.includes('中断在飞队友失败')), 'interrupt 异常落日志不外泄')
  assert.deepEqual(channel.interruptInFlight(() => {}), [], '幂等：已出册的卡不再中断')
  assert.equal(ledger.completedCount('dev-a'), 0, 'interrupt 不是完工，不计预算')
  assert.equal(channel.stats().members, 2, '成员保留在册（D4 不解散）')
  // 出册后再派发：dev-a 空闲可复用（在飞集合已清）
  const r3 = await channel.dispatch({ role: 'dev', cardId: 'a3', prompt: 'p', poolSize: 2 })
  assert.equal(r3.name, 'dev-a')
  assert.equal(r3.fresh, false)
  assert.ok(sent.includes('dev-a'))
  // 非法参数响亮报错
  assert.throws(() => channel.interruptInFlight('nope'), /interruptFn/)
})
