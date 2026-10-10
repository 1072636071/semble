/**
 * 派发与通知幂等（PRD 111 工单 05 / ADR-0122 D6）——两个「同一件事被做两次」的实测缺陷：
 *
 * A · 一卡双跑（同一张卡被拉起两个任务并行执行）
 *   根因：`spawn()` 的 `done` 闭包捕获同一个 `rec` 并**无条件** `rec.alive = false`——新一轮 spawn
 *   已在 `spawnWorker` 入口置 `alive = true` 之后，上一轮的 done 回调仍会把 alive 清掉 ⇒ 下一 tick
 *   的就绪前沿（判据只有 `phase !== 'open' || alive`）与僵死扫描随即再派一轮。现场：run
 *   `8e69d682` 的卡 101-04 在 14 分钟内被 spawn 7 次（零 settle）；105-02 / 103-03 / 113-02 同型。
 *   修法：**派发代际闸**（`rec.gen`，本用例组 ①）+ **在飞闸**（通道记名集合 ∩ 存活判据，②）。
 *
 * B · 通知重复投递 + 伪造人类来源
 *   B1 幂等键：同一文案在 `session-75d47c50` 于 06:24/06:31/07:44 各投一次（三个 run）；
 *      「已就位 · decide」随每次插件重载重发 ⇒ 接待台误读为「宿主重启」并误发 stop 打断在飞轮次。
 *   B2 跨重启清场：`halt()` 不清本 run 已注入且仍待领的通知 ⇒ 插件重载后重放过期问候。
 *   B3 来源去伪造：`source: { kind: 'user' }`（宿主契约要求非人类生产方传自己的 source，
 *      `deepseek-harness` @ `d94ac777` · `packages/goal/tool-goal/README.md:72`）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'

const BOARD = process.env.JXX_BOARD
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')

function mkRepo(n) {
  const root = mkdtempSync(join(tmpdir(), `jxx-disp-${n}-`))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'i'], { cwd: root })
  const dir = join(root, '.scratch', `${n}-p`, 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', `${n}-p`, 'PRD.md'),
    `# PRD ${n}\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n`)
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无\n\n## 评论\n')
  return { root, cardId: `${n}-01-solo` }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 一次性路径 stub（`ctx.get('agentTeams')` 恒 undefined）。
 * `holdFirst` 个 worker 轮次**挂住不 resolve**（模拟「上一轮还没结束」），此后正常交付。
 * 这样可以在同一个 run 内制造「新一轮已派出、上一轮 done 迟到」的序列。
 */
function mkOnceCtx(root, { prd, staleWorkerRounds = 0 }) {
  const agent = {
    id: `sess-${prd}`, session: { id: `sess-${prd}`, header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
    inbox: { removed: [], remove(id) { this.removed.push(id); return true } },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { dev: 0, pendingDone: [], labels: [] }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: () => undefined,
    subagents: {
      start: async (_p, req) => {
        const dev = req.label.match(/^jxx-dev-(.+)$/)
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = req.label.match(/^jxx-merger-(.+)$/)
        if (dev) {
          calls.dev += 1
          calls.labels.push(req.label)
          const id = dev[1]
          if (calls.dev <= staleWorkerRounds) {
            // 挂住：返回一个可由测试**稍后手动 settle** 的 handle（迟到 done）
            let resolveIt
            const result = new Promise((res) => { resolveIt = res })
            calls.pendingDone.push(() => resolveIt({ stopReason: 'completed', output: [{ type: 'text', text: '迟到交付' }] }))
            return { result, dispose: async () => {} }
          }
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          if (existsSync(join(openDir, `${id}.claimed.md`))) renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已交付' }] }), dispose: async () => {} }
        }
        if (rev) return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'VERDICT: PASS' }] }), dispose: async () => {} }
        if (mer) {
          const card = `merge-${mer[1]}`
          const from = join(openDir, `${card}.md`)
          if (existsSync(from)) renameSync(from, join(root, 'control', 'cards', 'done', `${card}.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已合入' }] }), dispose: async () => {} }
        }
        throw new Error(`未知角色 ${req.label}`)
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent, calls }
}

const CONFIG = (over = {}) => normalizeConfig({
  boardScript: BOARD, parallel: 3, staleMinutes: 30, maxRetries: 1, autoMerge: true, pollIntervalMs: 50, ...over,
})

async function waitFor(pred, timeoutMs = 15_000, stepMs = 25, label = 'waitFor') {
  const start = Date.now()
  for (;;) {
    const v = await pred()
    if (v) return v
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor 超时：${label}`)
    await new Promise((r) => setTimeout(r, stepMs))
  }
}

/** 全量史（`status().history` 是 slice(-10) 且 event 截断，不能用于留痕断言）。 */
const fullHistory = (orch, sessionId) => (orch.runs.get(sessionId)?.history || []).map((h) => h.event).join('\n')
/** 直读 run 自身的史（`newRun` 产出的 run 未登记进 `orch.runs`，测试里须直接用 run.history）。 */
const runHistory = (run) => run.history.map((h) => h.event).join('\n')
/** 建一个已登记进 `orch.runs` 的 run（`dispose()` 只遍历已登记的 run）。 */
function registerRun(orch, agent, sessionId, root) {
  const run = orch.newRun(agent, sessionId, root, 'test', 'implement')
  orch.runs.set(sessionId, run)
  return run
}

// ============ ① 派发代际闸（A 根治） ============

test('A·代际闸：上一轮 done 迟到，不得清新一轮的 alive、不得重复推进卡位', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 序列：首派 worker 挂住（未 resolve）→ 看门狗判僵死重派（第 2 轮，gen=2）→ 第 2 轮交付并把卡
  // 推进到 review → **此时第 1 轮的 done 才迟到**。旧代码：迟到 done 无条件 `rec.alive = false`
  // 并落 onSettled ⇒ 卡被二次推进/前沿再派。新代码：代际不符 ⇒ 留痕忽略。
  const { root, cardId } = mkRepo(70)
  const { ctx, agent, calls } = mkOnceCtx(root, { prd: 70, staleWorkerRounds: 1 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '70')
  await waitFor(() => calls.dev >= 1, 10_000, 25, '首派 worker')
  const run = orch.runs.get('sess-70')
  const rec = run.cards.get(cardId)
  // gen 在 spawn() 内分配（一次性路已 run），首个 spawn 完成前可能尚未落下
  await waitFor(() => rec.gen === 1, 10_000, 25, '首派记 gen=1')

  // 手动制造第 2 轮（模拟看门狗重派；不依赖 30 分钟 staleMinutes）
  orch.spawnWorker(run, cardId)
  await waitFor(() => rec.gen === 2, 10_000, 25, '第二轮派发 gen=2')
  await waitFor(() => existsSync(join(root, 'control', 'cards', 'open', `${cardId}.review.md`)) || rec.alive === false,
    20_000, 25, '第二轮交付')

  // 第 1 轮的 done 迟到：必须被代际闸拦下
  const aliveBefore = rec.alive
  calls.pendingDone[0]()
  await sleep(600)
  assert.match(fullHistory(orch, 'sess-70'), /陈旧轮次 done 忽略（gen 1≠2）/, '迟到 done 必须留痕被忽略')
  assert.equal(rec.alive, aliveBefore, '迟到 done 不得改新一轮 alive')
  assert.equal(rec.gen, 2, '代际未被迟到 done 改动')
})

test('A·代际闸：陈旧 done 不得二次落 settle（卡位不重复推进）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(71)
  const { ctx, agent, calls } = mkOnceCtx(root, { prd: 71, staleWorkerRounds: 1 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '71')
  await waitFor(() => calls.dev >= 1, 10_000, 25, '首派')
  const run = orch.runs.get('sess-71')
  await waitFor(() => run.cards.get(cardId).gen === 1, 10_000, 25, '首派 gen=1')
  // 直接推进第 2 轮并通过 spawn 层再派一次（同 rec 上的新代际）
  orch.spawnWorker(run, cardId)
  await waitFor(() => run.cards.get(cardId).gen === 2, 10_000, 25, 'gen=2')
  const histBefore = fullHistory(orch, 'sess-71')
  calls.pendingDone[0]() // 迟到 done
  await sleep(600)
  const histAfter = fullHistory(orch, 'sess-71')
  assert.match(histAfter, /陈旧轮次 done 忽略/, '有忽略留痕')
  // 关键：忽略分支**不调用 onSettled**（否则会重复回挪/重复 notify）
  assert.equal(
    (histAfter.match(/死亡自愈/g) || []).length,
    (histBefore.match(/死亡自愈/g) || []).length,
    '陈旧 done 不得触发新的自愈落账',
  )
})

// ============ ② 在飞闸（A 防重入） ============

test('A·在飞闸：同卡已有在飞轮次（团队路径）→ 拒绝重复派发且不静默吞', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 团队路径：dispatch 成功（指令入箱）但 worker **不领卡不回传**（39-01 形态）。此时通道 inFlight
  // 含该卡 ⇒ 再调 spawnWorker 必须被在飞闸挡下（旧代码只看 alive，而 alive 会被陈旧 done 误清）。
  const { root, cardId } = mkRepo(72)
  const agent = {
    id: 'sess-72', session: { id: 'sess-72', header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
    inbox: { removed: [], remove(id) { this.removed.push(id); return true } },
  }
  const calls = { spawned: [], sent: [] }
  const members = new Map()
  const teams = {
    async spawnTeammate(_c, req) { calls.spawned.push(req); members.set(req.name, { name: req.name, status: 'running' }); return { member: { name: req.name } } },
    async sendMessage(_c, req) { calls.sent.push(req); return { messageId: `m-${calls.sent.length}`, status: 'accepted' } },
    async interrupt() { return { previousStatus: 'running' } },
    listMembers() { return [...members.values()] },
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: (k) => (k === 'agentTeams' ? teams : undefined),
    subagents: {
      start: async (_p, req) => {
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        if (!rev) throw new Error(`团队模式不应有一次性 spawn：${req.label}`)
        return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'VERDICT: PASS' }] }), dispose: async () => {} }
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 30 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '72')
  const run = orch.runs.get('sess-72')
  await waitFor(() => calls.sent.length + calls.spawned.length >= 1, 10_000, 25, '首派已下发')
  // 队友报 running ⇒ 轮次健在 ⇒ 在飞闸必须挡下
  members.set([...members.keys()][0], { name: [...members.keys()][0], status: 'running' })
  run.cards.get(cardId).memberName = [...members.keys()][0]
  const dispatchedBefore = calls.sent.length
  orch.spawnWorker(run, cardId)
  await sleep(300)
  assert.equal(calls.sent.length, dispatchedBefore, '轮次健在时不得重复下发指令')
  assert.match(fullHistory(orch, 'sess-72'), /已有在飞轮次，跳过重复派发（在飞闸）/, '在飞闸留痕')

  // 对照：把队友报成 inactive（轮次已死）⇒ 陈旧簿记必须**放行**重派（看门狗清账形态），
  // 否则看门狗会被自己的防重入闸锁死（39-02 实测：run 冻结）
  members.set([...members.keys()][0], { name: [...members.keys()][0], status: 'inactive' })
  orch.spawnWorker(run, cardId)
  await waitFor(() => calls.sent.length > dispatchedBefore, 10_000, 25, '队友失联后允许重派清账')
})

test('A·在飞闸：通道 dispatch 对同卡在飞（非 resend）响亮拒绝', { timeout: 30_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 直测通道语义（不经编排层）：同卡第二次 dispatch（非 resend）必须抛错、且错误文本可读。
  const { createTeamChannel, createNamePool, createReuseLedger } = await import('../src/team-spawn.mjs')
  const agent = { id: 'lead-1', session: { id: 'lead-1' } }
  const sent = []
  const spawned = []
  const teams = {
    async spawnTeammate(_c, req) { spawned.push(req); return { member: { name: req.name } } },
    async sendMessage(_c, req) { sent.push(req); return { messageId: 'm', status: 'accepted' } },
    async interrupt() { return { previousStatus: 'inactive' } },
    listMembers() { return [] },
  }
  const channel = createTeamChannel({ teams, agent, log: () => {}, pool: createNamePool(), ledger: createReuseLedger({ reuseLimit: 3 }) })
  // 首派走 spawnTeammate（无点名 → 取新名建成员），不是 sendMessage——故判据用 spawned
  await channel.dispatch({ role: 'dev', cardId: 'c1', prompt: '第一轮', signal: new AbortController().signal })
  assert.equal(spawned.length, 1, '首派建成员（spawnTeammate）')
  assert.equal(channel.inFlightOf('c1'), true, '首派后该卡入在飞册')
  await assert.rejects(
    () => channel.dispatch({ role: 'dev', cardId: 'c1', prompt: '第二轮', signal: new AbortController().signal }),
    /已有在飞轮次.*拒绝重复派发/,
    '同卡非 resend 重投必须响亮抛错（不静默吞）',
  )
  assert.equal(sent.length, 0, '被拒的第二次不得下发到信箱')
  // resend 是合法逃生口（唤醒/重发同一会话）：须显式点名在册队友
  await channel.dispatch({ role: 'dev', cardId: 'c1', prompt: '重发', signal: new AbortController().signal, resend: true, name: channel.nameOf('c1') })
  assert.equal(sent.length, 1, 'resend 不受在飞闸限制（走同名 sendMessage）')
})

// ============ ③ 通知幂等键（B1） ============

test('B1·通知幂等键：同 run 同键调两次只入一条，重复触发留痕「通知去重」', { timeout: 30_000 }, async (t) => {
  const { root } = mkRepo(73)
  const { ctx, agent } = mkOnceCtx(root, { prd: 73 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const run = registerRun(orch, agent, 'sess-73', root)

  const first = orch.notify(run, '同一文案', { key: 'stage:x:enter' })
  const second = orch.notify(run, '同一文案', { key: 'stage:x:enter' })
  const third = orch.notify(run, '同一文案', { key: 'stage:x:enter' })
  assert.equal(first, true, '首次投放')
  assert.equal(second, false, '同键第二次被去重')
  assert.equal(third, false, '同键第三次被去重')
  assert.equal(agent.followups.length, 1, '信箱只入一条')
  assert.match(runHistory(run), /通知去重（key=stage:x:enter/, '去重留痕')

  // 不同键各投一次（去重不得吃掉真事件）
  orch.notify(run, '另一件事', { key: 'stage:y:enter' })
  assert.equal(agent.followups.length, 2, '不同键独立投放')
  // 不带键 = 既有语义（每次都投，零行为漂移）
  orch.notify(run, '无键通知')
  orch.notify(run, '无键通知')
  assert.equal(agent.followups.length, 4, '无键通知保持既有「每次都投」语义')
})

test('B1·回归：进入 implement 通知带键（实测缺陷的原始文案）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root } = mkRepo(74)
  const { ctx, agent } = mkOnceCtx(root, { prd: 74 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  await orch.auto(agent, '74')
  const run = orch.runs.get('sess-74')
  assert.ok(run.notified.has('stage:implement:enter'), '进入 implement 通知必须带幂等键')
  const before = agent.followups.length
  await orch.enterImplement(run) // 再次触发（模拟重复推进）
  assert.equal(agent.followups.length, before, '重复 enterImplement 不得再投一条「进入 implement」')
  assert.match(fullHistory(orch, 'sess-74'), /通知去重（key=stage:implement:enter/, '去重留痕')
})

// ============ ④ 跨重启清场（B2） ============

test('B2·halt 摘除仍待领的通知；已消费的不影响、失败不阻断停止链', { timeout: 30_000 }, async (t) => {
  const { root } = mkRepo(75)
  const { ctx, agent } = mkOnceCtx(root, { prd: 75 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  const run = registerRun(orch, agent, 'sess-75', root)

  orch.notify(run, '待领一', { key: 'k1' })
  orch.notify(run, '待领二', { key: 'k2' })
  assert.equal(run.noticeIds.size, 2, '两条待领通知已记账')
  await orch.halt(run, '测试停止')
  assert.equal(agent.inbox.removed.length, 2, 'halt 逐个摘除待领通知')
  assert.equal(run.noticeIds.size, 0, '记账清空')

  // 失败不阻断停止链：inbox.remove 抛错时 halt 仍须完成（run 从 runs 表摘除）
  const { root: root2 } = mkRepo(76)
  const a2 = {
    id: 'sess-76', session: { id: 'sess-76', header: { cwd: root2 } },
    followups: [], followup(m) { this.followups.push(m) },
    inbox: { remove() { throw new Error('模拟宿主实现异常') } },
  }
  const ctx2 = {
    agents: { get: (id) => (id === a2.id ? a2 : undefined) },
    get: () => undefined,
    subagents: { start: async () => ({ result: Promise.resolve({ stopReason: 'completed', output: [] }), dispose: async () => {} }) },
    logger: { info() {}, warn() {}, error() {} },
  }
  const orch2 = new Orchestrator(ctx2, CONFIG(), ctx2.logger)
  const run2 = registerRun(orch2, a2, 'sess-76', root2)
  orch2.notify(run2, '待领', { key: 'k' })
  await orch2.halt(run2, '测试停止（remove 抛错）')
  assert.equal(orch2.runs.has('sess-76'), false, 'remove 抛错不得阻断停止链（run 已摘除）')
})

test('B2·dispose 同样摘除待领通知（插件卸载路径）', { timeout: 30_000 }, async (t) => {
  const { root } = mkRepo(77)
  const { ctx, agent } = mkOnceCtx(root, { prd: 77 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  const run = registerRun(orch, agent, 'sess-77', root)
  orch.notify(run, '待领', { key: 'k' })
  await orch.dispose()
  assert.equal(agent.inbox.removed.length, 1, 'dispose 经 halt 摘除待领通知')
})

// ============ ⑤ 来源去伪造（B3） ============

test('B3·来源断言：notify 注入消息的 source.kind 不得为 user（防回退机读断言）', { timeout: 30_000 }, async (t) => {
  const { root } = mkRepo(78)
  const { ctx, agent } = mkOnceCtx(root, { prd: 78 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const run = registerRun(orch, agent, 'sess-78', root)

  orch.notify(run, '来源断言样本', { key: 'src' })
  assert.equal(agent.followups.length, 1, '有注入')
  const msg = agent.followups[0]
  assert.ok(msg.source, '注入消息必须带 source（不带 = 宿主按真人输入归属）')
  assert.notEqual(msg.source.kind, 'user', '插件通知不得冒充人类来源')
  assert.equal(msg.source.kind, 'jxx-driver', '用插件自有 kind（宿主契约：merge-extensible 求和类型）')
  // 宿主契约：source 必须是可枚举/可序列化的普通对象（不是 undefined/函数）
  assert.equal(typeof msg.source, 'object', 'source 是普通对象')
  assert.ok(JSON.stringify(msg.source).includes('jxx-driver'), 'source 可序列化')
})

test('B3·steer 面无伪造：本插件不经 steer 注入（留痕防回退）', async (t) => {
  // 工单构建内容 5 要求「steer 面若同样伪造则同单内一并改」。本插件**没有** steer 调用点
  // （只有 followup），故无需改动；此用例把该事实钉住——将来若新增 steer，必须一并带 source。
  // 注意：必须**剥掉注释**再扫，否则本文件/源码里的契约说明文本（含 `kind: 'user'` 字样）会假命中
  //（本用例首跑即踩：把方法头注释里的契约原文当成了代码）。
  const raw = readFileSync(new URL('../src/orchestrator.mjs', import.meta.url), 'utf8')
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 块注释
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '')) // 行注释（本仓注释一律纯 //，无 URL 场景）
    .join('\n')
  assert.ok(!/\.steer\(/.test(code), '当前实现不经 steer 注入（若新增须同单带自有 source）')
  assert.ok(!/kind:\s*'user'/.test(code), '代码内不得再有伪造 user 来源')
  assert.match(code, /kind:\s*'jxx-driver'/, 'notify 注入使用插件自有 kind')
})
