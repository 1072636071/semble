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
 * 团队 stub：merger 首派（spawnTeammate）**瞬时故障一次**（resilienceState 注释明示的「首派即败」形态），
 * 此后供给正常。dev 侧即时交付以把链路推到合并窗。
 */
function mkMergerFailCtx(root, { prd, mergerFailTimes = 1 }) {
  const agent = {
    id: `sess-mr-${prd}`, session: { id: `sess-mr-${prd}`, header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
    inbox: { remove() { return true } },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { mergerSpawnTries: 0, mergerSends: 0, spawned: [] }
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
      calls.spawned.push(req.name)
      if (String(req.description || '').startsWith('jxx-driver merger')) {
        calls.mergerSpawnTries += 1
        if (calls.mergerSpawnTries <= mergerFailTimes) {
          throw new Error('E_MERGER_TRANSIENT: merger 首派宿主瞬时故障')
        }
      }
      members.set(req.name, { name: req.name, status: 'running' })
      // worker 侧即时交付（把链路推进到合并窗）；merger 侧等待 SETTLED 回传
      if (String(req.description || '').startsWith('jxx-driver dev')) {
        const text = req.prompt.map((b) => b.text).join('\n')
        const m = /(?:^|\s)(\d+-[a-z0-9-]+)/.exec(text)
        if (m) {
          const id = m[1]
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          if (existsSync(join(openDir, `${id}.claimed.md`))) renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
        }
      } else {
        handle(req.prompt.map((b) => b.text).join('\n'))
      }
      return { member: { name: req.name } }
    },
    async sendMessage(_c, req) {
      calls.mergerSends += 1
      handle(req.content.map((b) => b.text).join('\n'))
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
