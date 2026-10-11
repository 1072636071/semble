/**
 * merger 退避重发回归（PRD 111 工单 05 返工 r2）——修 r1 在飞闸打死 merger 韧性链的回归。
 *
 * 缺陷链（r1，spec 复评发现项 1 / 高）：
 *   merger 首派宿主瞬时故障 → `handleTeamDispatchFailure` 排退避重发 → 重发走
 *   `resendTeamDirective` 的 merger 分支，而该分支当时**没带 `resend: true`**
 *   → 被 r1 新加的在飞闸当「同卡非 resend 重投」响亮拒绝
 *   → 拒绝经 spawnMerger 的 catch 回流韧性入口，**每拒一次烧一次失败预算**
 *   → 连续失败超 teamBackoff → 转人工（基线 642d467b 同序列可自愈）。
 *
 * 本用例的判据**在基线 642d467b 与 r2 上都必须绿**（防再回归）：断言「merger 首派失败后
 * 退避重发真的跑起来了、且韧性计数被清零收敛」，而不是断言某个实现细节。
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

function mkRepo(n) {
  const root = mkdtempSync(join(tmpdir(), `jxx-mresend-${n}-`))
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
async function waitFor(pred, timeoutMs = 20_000, stepMs = 25, label = 'waitFor') {
  const start = Date.now()
  for (;;) {
    const v = await pred()
    if (v) return v
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor 超时：${label}`)
    await new Promise((r) => setTimeout(r, stepMs))
  }
}

/**
 * 团队 stub（r3 扩面）：
 *  - `mergerFailTimes`：merger 首派（spawnTeammate）瞬时故障次数（「首派即败 / 不在册」形态）；
 *  - `devFailTimes`：dev 首派（spawnTeammate）瞬时故障次数（dev 侧同型形态，r3 发现项 2 用）；
 *  - `mergerStaysInFlight`：merger 收到指令后**不搬合并卡**（卡留在在飞态）——r3「在册续发」用例
 *    需要该前提（否则合并卡迅速收口、在飞闸自然失效，测不到续发面）；
 *  - 记录 `mergerDirectives`：真正**投递到合并队友**的指令正文（行为判据：续发是否真的落地）。
 * dev 侧成功派发后即时交付以把链路推到合并窗。
 */
function mkMergerFailCtx(root, { prd, mergerFailTimes = 1, devFailTimes = 0, mergerStaysInFlight = false }) {
  const agent = {
    id: `sess-mr-${prd}`, session: { id: `sess-mr-${prd}`, header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
    inbox: { remove() { return true } },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { mergerSpawnTries: 0, mergerSends: 0, spawned: [], devSpawns: 0, devNames: [], mergerDirectives: [] }
  const members = new Map()
  let deliver = null
  const SETTLED = /SETTLED:[ \t]*`?([A-Za-z0-9][A-Za-z0-9._-]*)`?/g
  const handle = (text) => {
    for (const m of text.matchAll(SETTLED)) {
      const card = m[1]
      if (!deliver) continue
      if (card.startsWith('merge-')) {
        // 合并专员收口：合并卡进 done（开发卡由收口面处理）
        const from = join(openDir, `${card}.md`)
        if (existsSync(from)) renameSync(from, join(root, 'control', 'cards', 'done', `${card}.md`))
      } else {
        if (existsSync(join(openDir, `${card}.md`))) renameSync(join(openDir, `${card}.md`), join(openDir, `${card}.claimed.md`))
        if (existsSync(join(openDir, `${card}.claimed.md`))) renameSync(join(openDir, `${card}.claimed.md`), join(openDir, `${card}.review.md`))
      }
      deliver(`${card} 已办结。\nSETTLED: ${card}`)
    }
  }
  const teams = {
    async spawnTeammate(_c, req) {
      const isMerger = String(req.description || '').startsWith('jxx-driver merger')
      const isDev = String(req.description || '').startsWith('jxx-driver dev')
      calls.spawned.push(req.name)
      if (isMerger) {
        calls.mergerSpawnTries += 1
        if (calls.mergerSpawnTries <= mergerFailTimes) {
          throw new Error('E_MERGER_TRANSIENT: merger 首派宿主瞬时故障')
        }
      }
      if (isDev) {
        calls.devSpawns += 1
        if (calls.devSpawns <= devFailTimes) {
          throw new Error('E_DEV_TRANSIENT: dev 首派宿主瞬时故障')
        }
        calls.devNames.push(req.name)
      }
      members.set(req.name, { name: req.name, status: 'running' })
      // worker 侧即时交付（把链路推进到合并窗）；merger 侧等待 SETTLED 回传
      if (isDev) {
        const text = req.prompt.map((b) => b.text).join('\n')
        const m = /(?:^|\s)(\d+-[a-z0-9-]+)/.exec(text)
        if (m) {
          const id = m[1]
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          if (existsSync(join(openDir, `${id}.claimed.md`))) renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
        }
      } else if (!mergerStaysInFlight) {
        handle(req.prompt.map((b) => b.text).join('\n'))
      }
      return { member: { name: req.name } }
    },
    async sendMessage(_c, req) {
      calls.mergerSends += 1
      const text = req.content.map((b) => b.text).join('\n')
      // 行为判据：只有**真正投递到合并队友**的指令才入账（被闸/被硬拒的投递走不到这里）
      if (String(req.target || '').startsWith('merger-')) calls.mergerDirectives.push(text)
      if (!mergerStaysInFlight) handle(text)
      return { messageId: `m-${calls.mergerSends}`, status: 'accepted' }
    },
    async interrupt() { return { previousStatus: 'inactive' } },
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
  return { ctx, agent, calls, wireDeliver: (fn) => { deliver = fn } }
}

const CONFIG = (over = {}) => normalizeConfig({
  boardScript: BOARD, parallel: 3, staleMinutes: 30, maxRetries: 1, autoMerge: true, pollIntervalMs: 50, teamBackoff: 3, ...over,
})

test('merger 韧性回归：首派即败 → 退避重发续跑（不得被在飞闸拒成烧穿转人工）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root } = mkRepo(86)
  const { ctx, agent, calls, wireDeliver } = mkMergerFailCtx(root, { prd: 86, mergerFailTimes: 1 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  orch.backoffDelay = () => 10 // 测试提速：产品语义不变（与既有韧性测试同一手法）
  t.after(async () => { await orch.dispose() })

  wireDeliver((text) => orch.onTeamMessage(agent, text))
  await orch.auto(agent, '86')
  const run = orch.runs.get('sess-mr-86')
  const mergeId = 'merge-86-01-solo'

  // 等 merger 首派失败发生（瞬时故障注入生效）
  await waitFor(() => calls.mergerSpawnTries >= 1, 20_000, 25, 'merger 首派已尝试')
  // 等退避重发把链路救回来：供给恢复后 merger 应被成功派发/复用（spawn 第 2 次或 sendMessage 下发）
  await waitFor(() => calls.mergerSpawnTries >= 2 || calls.mergerSends >= 1, 25_000, 25,
    'merger 退避重发真的跑起来了（被在飞闸拒的话这里必超时）')

  const hist = (run.history || []).map((h) => h.event).join('\n')
  const st = run.resilience?.byCard?.get(mergeId)
  // 核心判据：**韧性链不得烧穿**（两个硬拒形态与终局都不得出现）
  assert.ok(!/超过退避上限/.test(hist),
    `merger 退避重发不得被拒成烧穿转人工（历史：${hist.split('\n').filter((l) => /merge|退避|重发|拒绝/.test(l)).join(' | ')}）`)
  assert.ok(!/已有在飞轮次.*拒绝重复派发/.test(hist),
    '退避重发不得被在飞闸拒绝（resend 语义应越过该闸）')
  assert.ok(!/同名重发目标不在册/.test(hist),
    '首派即败时不得硬走同名直发（应交池建 fresh 后继）')
  // 收敛：不得停在等待用户恢复的等待窗（计数未烧穿的自然结果）
  assert.ok(!st?.waiting, '不得停在等待用户恢复的等待窗')
  assert.ok((st?.failures ?? 0) <= 1, `失败计数不得累积（实际 ${st?.failures}）`)
})

test('merger 韧性回归：重发目标不在册（首派即败）时交池建 fresh，不硬拒', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 「首派即败」时 `spawnTeammate` 抛错 ⇒ `members.set` 永不执行 ⇒ 该名**不在册**。
  // 此时同名直发（resend）会撞通道的「同名重发目标不在册」硬拒 —— r2 实测：只补 resend 会立刻
  // 暴露这第二道坎。正解是交回池路径建 fresh 后继（= 基线自愈语义）。
  const { root } = mkRepo(87)
  const { ctx, agent, calls, wireDeliver } = mkMergerFailCtx(root, { prd: 87, mergerFailTimes: 1 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  orch.backoffDelay = () => 10
  t.after(async () => { await orch.dispose() })

  wireDeliver((text) => orch.onTeamMessage(agent, text))
  await orch.auto(agent, '87')
  const run = orch.runs.get('sess-mr-87')

  await waitFor(() => calls.mergerSpawnTries >= 2 || calls.mergerSends >= 1, 25_000, 25, 'merger 重发已跑起来')
  const hist = (run.history || []).map((h) => h.event).join('\n')
  // 判据只断言**行为**（不绑实现文案）：两种硬拒形态都不得出现——
  //  ①「同名重发目标不在册」（首派即败时硬走同名直发的后果）
  //  ②「已有在飞轮次…拒绝重复派发」（被在飞闸拒）
  assert.ok(!/同名重发目标不在册/.test(hist), '首派即败后不得走硬拒的同名直发（应交池建 fresh）')
  assert.ok(!/已有在飞轮次.*拒绝重复派发/.test(hist), '退避重发不得被在飞闸拒绝')
  // 池路径真的建成了后继（merger-a 已被池占用 ⇒ 给 merger-b）
  assert.ok(calls.spawned.length >= 2, `应发生第二次 spawn（池建后继；实际 ${JSON.stringify(calls.spawned)}）`)
  assert.equal(new Set(calls.spawned).size, calls.spawned.length, '后继用新名（名字不复用）')
  assert.ok(!/超过退避上限/.test(hist), '该路径同样不得烧穿转人工')
})

// ============ r3 补锁（spec 发现项 1/2：把 r1/r2 的机制真正上锁） ============

test('merger 韧性回归（在册续发）：队友已在册 + 续发失败 → 同名直发续跑，不被在飞闸拒', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // spec 发现项 1（r3）：r1 被原始指名的形态是「**在册**队友 + 续发失败」——退避重发走同名直发，
  // 而 r1 的 merger 分支没带 `resend: true` ⇒ 被自己的在飞闸拒 ⇒ 烧穿。r2 的既有用例只注入了
  // 「首派即败 / 不在册 ⇒ 池路径」形态，**`resend: true` 那条腿落在死代码里、全仓零覆盖**。
  // 本用例直接驱动韧性链所走的同一入口（`resendTeamDirective`）：merger 首派**成功**（进名册、
  // 合并卡在飞）后，令该队友的 sendMessage 瞬时失败一次，随后连续续发。
  // 三腿对照实测（底稿探针，见卡面 r3 交付记录）：基线 `642d467b` 绿 / r1 `d31a5988` 红（4×在飞闸） / r2 绿。
  const { root } = mkRepo(88)
  const { ctx, agent, calls, wireDeliver } = mkMergerFailCtx(root, { prd: 88, mergerFailTimes: 0, mergerStaysInFlight: true })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  orch.backoffDelay = () => 5
  t.after(async () => { await orch.dispose() })

  wireDeliver((text) => orch.onTeamMessage(agent, text))
  await orch.auto(agent, '88')
  const run = orch.runs.get('sess-mr-88')
  const mergeId = 'merge-88-01-solo'

  // 在册前提：merger 首派成功进名册，且该卡在飞。**判据不绑实现 API**——`hasMember`/`inFlightOf`
  // 是本单新增的通道访问器，基线没有；用它们做前提断言会让基线误红（实则行为等价）。
  // 故只断言可观测行为：首派已发生 + 队友名已在册（由 nameOf 与后续投递共同体现）。
  await waitFor(() => calls.mergerSpawnTries >= 1 && run.channel.nameOf(mergeId) !== undefined, 20_000, 25, 'merger 首派成功')
  const rosterName = run.channel.nameOf(mergeId)
  assert.ok(rosterName !== undefined, 'merger 首派后通道已记名（在册前提）')

  // 令该在册队友的 sendMessage 瞬时失败一次（首条续发失败），此后恢复正常
  let sendFailLeft = 1
  const realSend = ctx.get('agentTeams').sendMessage
  ctx.get('agentTeams').sendMessage = async (c, req) => {
    if (String(req.target || '') === rosterName && sendFailLeft > 0) {
      sendFailLeft -= 1
      throw new Error('E_MERGER_SEND_TRANSIENT: 在册续发瞬时失败')
    }
    return realSend(c, req)
  }

  // 连续续发 4 次：第 1 次撞瞬时失败、其后必须成功（r1 形态下 4 次全被在飞闸拒）
  const outcomes = []
  for (let i = 1; i <= 4; i++) {
    try { await orch.resendTeamDirective(run, mergeId, 'merger', `r3 在册续发 #${i}`); outcomes.push('ok') } catch { outcomes.push('threw') }
  }

  const hist = (run.history || []).map((h) => h.event).join('\n')
  const st = run.resilience?.byCard?.get(mergeId)
  // 行为判据（不绑实现文案）：两个硬拒形态与烧穿终局都不得出现，且续发最终收敛
  assert.ok(!/已有在飞轮次.*拒绝重复派发/.test(hist),
    `在册续发不得被在飞闸拒（r1 回归形态；历史：${hist.split('\n').filter((l) => /重发|拒绝|退避/.test(l)).join(' | ')}）`)
  assert.ok(!/同名重发目标不在册/.test(hist), '在册续发不得走「不在册」硬拒')
  assert.ok(!/超过退避上限/.test(hist), '在册续发不得烧穿转人工')
  assert.ok(!st?.waiting, '不得停在等待用户恢复的等待窗')
  assert.ok(outcomes.slice(1).every((o) => o === 'ok'),
    `瞬时失败恢复后续发必须成功（实际 ${JSON.stringify(outcomes)}）`)
  // 续发真的投递到该队友（行为面：指令进了信箱，不是被闸吞掉）
  assert.ok(calls.mergerDirectives.length >= 3,
    `续发指令必须真的投递给在册队友（实际 ${calls.mergerDirectives.length} 条）`)
})

test('dev 韧性回归（池路径续发）：dev 首派即败 → 交池建 fresh 后继续跑，不硬拒', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // spec 发现项 2（r3）：r2 把 dev 分支同源化为「在册 ⇒ 同名直发 / 不在册 ⇒ 池路径建 fresh」，
  // 修掉了**基线即存在**的存量缺陷（基线 dev 分支恒 `resend: true` + 未在册名 ⇒ 撞「不在册」硬拒
  // ⇒ 烧穿），但该分支此前零覆盖。本用例把这条腿锁住。
  // 三腿对照实测：基线 `642d467b` **红**（存量缺陷）/ r1 `d31a5988` 红 / r2 绿——**此腿的基线红
  // 不是 r1 引入的回归**，而是 r2 新修的存量缺陷，卡面已如实区分。
  const { root } = mkRepo(89)
  const { ctx, agent, calls, wireDeliver } = mkMergerFailCtx(root, { prd: 89, mergerFailTimes: 0, devFailTimes: 1 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  orch.backoffDelay = () => 10
  t.after(async () => { await orch.dispose() })

  wireDeliver((text) => orch.onTeamMessage(agent, text))
  await orch.auto(agent, '89')
  const run = orch.runs.get('sess-mr-89')
  const devId = '89-01-solo'

  // dev 首派即败（未进名册）⇒ 韧性链退避重发 ⇒ 应走池路径建 fresh 后继（dev-b）
  await waitFor(() => calls.devSpawns >= 2 && calls.devNames.length >= 1, 30_000, 25,
    'dev 续发必须走池路径建成后继（基线/r1 形态下这里必超时：撞「不在册」硬拒）')

  const hist = (run.history || []).map((h) => h.event).join('\n')
  const st = run.resilience?.byCard?.get(devId)
  assert.ok(!/同名重发目标不在册/.test(hist),
    `dev 首派即败后不得走硬拒的同名直发（历史：${hist.split('\n').filter((l) => /重发|不在册|退避/.test(l)).join(' | ')}）`)
  assert.ok(!/超过退避上限/.test(hist), '该路径不得烧穿转人工')
  assert.ok(!st?.waiting, '不得停在等待用户恢复的等待窗')
  assert.ok(calls.devNames.length >= 1, `池路径建成了后继（实际 ${JSON.stringify(calls.devNames)}）`)
  assert.equal(new Set(calls.devNames).size, calls.devNames.length, '后继用新名（名字不复用）')
})
