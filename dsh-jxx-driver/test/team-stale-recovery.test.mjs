/**
 * 僵死看门狗双信号回归 + status 瘦身（39-02 drv-fix）：
 *  - 主缺陷回归：团队路径 dispatch 成功（指令入箱）但 worker 恒不启动回合（roster 恒 inactive）
 *    → 卡面 mtime 超时后看门狗必须兑付自愈链——旧判据 `!rec.alive → continue` 与
 *    「派发成功即置 alive=true」互斥，39-01 卡实测 run 冻结 40+ 分钟无人接管。
 *    修复（基于 PRD 111 工单 01 的成员存活探针面）：alive=true 时再问宿主「这位队友还在跑吗」，
 *    回合执行中（status='running'）让位、失联（inactive）放行判死。
 *  - 长跑保护：回合执行中（running）的 worker 即使卡面超时也不得被误杀；
 *  - memberInactive 探针：仅 inactive 为 true，running/failed/未知/缺失/异常 → false（不误杀）；
 *  - status() 瘦身：宿主 MCP lossless JSON 校验曾因 slice(-20) 全文 history + undefined 属性值
 *    （board/featureDir/lastError）报「value is not lossless JSON」监控面全瞎——
 *    history ≤10 条、event 截 120 字符、undefined 一律 null 兜底（宿主 walker 对 undefined
 *    属性值判非 lossless，而 JSON.stringify 会静默丢弃这些键，测试必须按 walker 口径验）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'
import { createMemberProbe } from '../src/team-spawn.mjs'

const BOARD = process.env.JXX_BOARD
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')

function mkRepo(prdNum) {
  const root = mkdtempSync(join(tmpdir(), `jxx-stale-${prdNum}-`))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', `${prdNum}-stale-prd`, 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', `${prdNum}-stale-prd`, 'PRD.md'),
    `# PRD ${prdNum} · 僵死看门狗\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n`)
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
  return { root, cardId: `${prdNum}-01-solo` }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 回拨卡面 mtime（staleMinutes 下限 1 分钟，测试用 utimes 快进时钟）。 */
const ageCard = (file, minutes = 2) => {
  const past = new Date(Date.now() - minutes * 60_000)
  utimesSync(file, past, past)
}

/**
 * worker 恒不动作的团队 stub：spawnTeammate 成功（成员按 memberStatus 落 roster）、
 * sendMessage 永远「投递成功」但 worker 不领卡不回传不写卡——正是 39-01 实测的
 * 「dispatch resolve ≠ 回合在跑」僵死形态。审查者（一次性路径）照常 PASS 保链路可达。
 */
function mkStaleTeamCtx(root, prdNum, memberStatus = 'inactive') {
  const agent = {
    id: `sess-st-${prdNum}`,
    session: { id: `sess-st-${prdNum}`, header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
  }
  const calls = { spawned: [], sent: [], sendTargets: [] }
  const members = new Map()
  const teams = {
    async spawnTeammate(_caller, req) {
      calls.spawned.push({ req })
      members.set(req.name, { name: req.name, status: memberStatus })
      return { member: { name: req.name } }
    },
    async sendMessage(_caller, req) {
      calls.sent.push({ req })
      calls.sendTargets.push(req.target)
      return { messageId: `m-${calls.sent.length}`, status: 'accepted' }
    },
    async interrupt() { return { previousStatus: 'inactive' } },
    listMembers() { return [...members.values()] },
    _members: members,
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: (key) => (key === 'agentTeams' ? teams : undefined),
    subagents: {
      start: async (_p, req) => {
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        if (!rev) throw new Error(`团队模式下不应有一次性 spawn：${req.label}`)
        return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '报告\nVERDICT: PASS' }] }), dispose: async () => {} }
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent, calls, teams }
}

async function waitFor(pred, timeoutMs = 15_000, stepMs = 25) {
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

// ---- 主回归：恒 inactive 的僵死 worker 必须被看门狗接管（旧代码 alive 互斥永不兑付） ----

test('僵死看门狗回归：团队路径 dispatch 成功但 worker 恒 inactive → 卡面超时后自愈链兑付、卡账降级', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(79)
  const { ctx, agent, calls } = mkStaleTeamCtx(root, 79, 'inactive')
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, pollIntervalMs: 50, maxRetries: 1 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '79')
  await waitFor(() => calls.spawned.length >= 1, 5_000, 25) // 首派走 spawnTeammate（worker 收到指令但永不动作）
  // 修复前：rec.alive=true 恒挡看门狗 → run 冻结（39-01 实测 40+ 分钟）。修复后：roster 反证
  // inactive（无回合在跑）+ mtime 过期 → 判僵死重 spawn（重派同一队友），再僵死 → retries 超限
  // blocked 转人工（回待领位 + needs-info，PRD 111 #106-A 同源终局面）。
  // staleMinutes 下限 1 分钟，测试用 utimes 快进卡面时钟。
  ageCard(join(root, 'control', 'cards', 'open', `${cardId}.md`))
  await waitFor(() => agent.followups.some((m) => /僵死超过 1 分钟/.test(m.content?.[0]?.text || '')), 10_000, 50)
  await waitFor(() => {
    const file = join(root, 'control', 'cards', 'open', `${cardId}.md`)
    if (!existsSync(file)) return false
    return /needs-info/.test(readFileSync(file, 'utf8'))
  }, 10_000, 50, '超限后卡回待领位 + needs-info（终局真兑付，不是只改卡账）')
  const st = orch.status(agent)
  JSON.stringify(st) // 监控面冒烟：瘦身后序列化不再抛（lossless 校验口径见下方专项用例）
  assert.equal(st.cards[0].phase, 'blocked', '僵死重试超限后卡转人工（卡账降级）')
  assert.ok(st.blocked.length > 0, 'blocked 列表有记录')
  assert.ok(calls.sent.length >= 1, `看门狗重派链走通（重派走同名 sendMessage，实际 ${calls.sent.length} 次）`)
  assert.equal(calls.spawned.filter((s) => s.req.name?.startsWith('dev-')).length, 1, '重派不新开成员（spawnTeammate 仍只 1 次，不弃会话）')
  assert.match(st.history.map((h) => h.event).join('\n'), /僵死（第 1 次失败），重 spawn/, '僵死重派留痕在案')
})

// ---- 长跑保护：回合执行中（running）的 worker 不被误杀 ----

test('长跑保护：卡面超时但 worker roster=running（回合执行中）→ 看门狗不杀、不重派', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(78)
  const { ctx, agent, calls } = mkStaleTeamCtx(root, 78, 'running')
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, pollIntervalMs: 50, maxRetries: 1 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '78')
  await waitFor(() => calls.spawned.length >= 1, 5_000, 25) // 首派走 spawnTeammate
  // 首派型僵死位（卡仍在 inbox，恒 running 的 worker 不领卡）——mtime 快进到过期后多轮 tick：
  // roster 反证不成立（memberInactive=false）⇒ roundInFlight 让位，看门狗不得动手。
  ageCard(join(root, 'control', 'cards', 'open', `${cardId}.md`))
  await sleep(400) // ≥8 ticks（pollIntervalMs=50），任何一轮误杀都会留下重派/blocked 痕迹
  assert.equal(calls.spawned.filter((s) => s.req.name?.startsWith('dev-')).length, 1, 'roster=running 的长跑 worker 不被重 spawn（不误杀）')
  assert.equal(calls.sent.length, 0, '无同名重派投递（看门狗未动手）')
  const st = orch.status(agent)
  assert.equal(st.cards[0].phase, 'claimed', '卡仍在办（未被判僵死）')
  assert.doesNotMatch(st.history.map((h) => h.event).join('\n'), /重 spawn/, '无僵死重 spawn 留痕')
})

// ---- memberInactive 探针单元 ----

test('memberInactive 探针：仅 status=inactive 判真；running/failed/未知/查无/缺失/异常 → false（不误杀）', () => {
  const agent = { id: 'a1' }
  const probe = createMemberProbe({ teams: { listMembers: () => [
    { name: 'dev-a', status: 'inactive' }, { name: 'dev-b', status: 'running' },
    { name: 'dev-c', status: 'failed' }, { name: 'dev-d', status: 'provisioning' },
  ] }, agent, log: () => {} })
  assert.equal(probe.memberInactive('dev-a'), true)
  assert.equal(probe.memberInactive('dev-b'), false, 'running = 回合执行中，不得判僵死')
  assert.equal(probe.memberInactive('dev-c'), false, 'failed 走 memberFailed/换名重建面，不混用')
  assert.equal(probe.memberInactive('dev-d'), false)
  assert.equal(probe.memberInactive('dev-不存在的'), false, '查无此人 = 无反证，不杀')
  assert.equal(probe.memberInactive(undefined), false)
  const noList = createMemberProbe({ teams: { spawnTeammate() {}, sendMessage() {}, interrupt() {} }, agent, log: () => {} })
  assert.equal(noList.memberInactive('dev-a'), false, '无 listMembers → 恒 false（不误杀）')
  const throwProbe = createMemberProbe({ teams: { listMembers: () => { throw new Error('boom') } }, agent, log: () => {} })
  assert.equal(throwProbe.memberInactive('dev-a'), false, '探针异常吞掉按未知（不误杀）')
})

// ---- status() 瘦身（39-02 次缺陷：宿主 lossless JSON 拒绝 → 监控面全瞎） ----

/**
 * 宿主 lossless JSON 校验的测试侧同构（packages/util/values 的 walkJsonValue 判据）：
 * undefined 属性值 / 循环引用 / NaN·Infinity 都判非 lossless。JSON.stringify 会静默丢弃
 * undefined 键所以测不出来——必须按 walker 口径遍历，才能钉住「board: undefined」这类真缺陷。
 */
function assertLossless(value, path = '$') {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value) && !Object.is(value, -0), `${path} 非有限数（lossless walker 拒绝）`)
    return
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) assertLossless(value[i], `${path}[${i}]`)
    return
  }
  if (typeof value === 'object') {
    assert.ok(value !== undefined, `${path} 为 undefined（宿主 walker 判非 lossless）`)
    for (const [k, v] of Object.entries(value)) assertLossless(v, `${path}.${k}`)
    return
  }
  assert.fail(`${path} 类型不可 lossless 序列化：${typeof value}`)
}

test('status() 瘦身：lossless 口径全树无 undefined、history ≤10 条、event 截 120 字符、保留最近', async (t) => {
  const orch = new Orchestrator({}, { parallel: 3, staleMinutes: 30, maxRetries: 1, pollIntervalMs: 50 }, { info() {}, warn() {}, error() {} })
  const agent = { id: 'sess-slim', session: { id: 'sess-slim' } }
  const run = orch.newRun(agent, 'sess-slim', join(tmpdir(), 'jxx-slim-nonexistent'), '测试想法', 'decide')
  orch.runs.set('sess-slim', run)
  t.after(async () => { await orch.dispose() })
  for (let i = 0; i < 25; i++) {
    run.history.push({ t: new Date().toISOString(), event: `事件 ${i}：${'x'.repeat(200)}` })
  }
  // 修复前两处真实断点（宿主 walker 口径）：① slice(-20) 全文 history 体量膨胀；
  // ② featureDir/lastError/board 为 undefined 属性值——walker 直接判非 lossless，
  // 正是「value is not lossless JSON」的根因（JSON.stringify 静默丢键，测不出）
  const st = orch.status(agent)
  assertLossless(st)
  const json = JSON.stringify(st)
  assert.ok(json.length > 0, 'JSON.stringify 不抛')
  assert.ok(st.history.length <= 10, `history 截最近 10 条，实际 ${st.history.length}`)
  for (const h of st.history) {
    assert.equal(typeof h.event, 'string')
    assert.ok(h.event.length <= 120, `event 截 120 字符，实际 ${h.event.length}`)
  }
  assert.match(st.history.at(-1).event, /^事件 24：/, '保留的是最近的条目')
  assert.ok(!json.includes('x'.repeat(200)), '长 event 已被截断')
  // undefined → null 兜底：键集合稳定（implement 之外的 stage 没有 featureDir/board/lastError）
  assert.equal(st.featureDir, null)
  assert.equal(st.board, null)
  assert.equal(st.lastError, null)
  assert.ok('featureDir' in st && 'board' in st && 'lastError' in st, '键不消失（宿主消费面结构稳定）')
})
