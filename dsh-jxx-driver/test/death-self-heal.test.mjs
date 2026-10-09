/**
 * 死亡自愈 E2E（PRD 111 工单 01 / BACKLOG #106-A/C · ADR-0122 D1）：
 * worker settle 失败 → 卡位自动回挪 → 前沿重派成功（消灭「重试后卡滞留 claimed 静默」实况）；
 * 合并专员中止 → 即时 notify（不等 10 分钟超时面）+ 合并卡回挪可重派；合并卡纳入受管簿记
 * （影子账只服务重派面，收口仍以主卡为准）；三类死亡事件在 run.history 与 followup 面都有记录。
 * 失败注入口径：stopReason=error = worker/merger 轮次失败（一次性路径 onXxxSettled(err)）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, renameSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'

// BOARD 定位：env 显式 → 仓内相对兜底（同仓 jxx-ticket-board 副本，不依赖宿主安装面——std 审查发现项 6）→
// 宿主安装面（外置技能目录）。两处都不存在时用例 t.skip 兜底。
const BOARD = process.env.JXX_BOARD
  || (existsSync(new URL('../../jxx-ticket-board/scripts/board.mjs', import.meta.url))
    ? new URL('../../jxx-ticket-board/scripts/board.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
    : join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs'))

function mkRepo(prdNum) {
  const root = mkdtempSync(join(tmpdir(), `jxx-heal-${prdNum}-`))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', `${prdNum}-heal-prd`, 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', `${prdNum}-heal-prd`, 'PRD.md'),
    `# PRD ${prdNum} · 死亡自愈测试\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n`)
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
  return { root, cardId: `${prdNum}-01-solo`, mergeId: `merge-${prdNum}-01-solo` }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(pred, timeoutMs = 30_000, stepMs = 50, label = '') {
  const start = Date.now()
  for (;;) {
    const v = await pred()
    if (v) return v
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor 超时${label ? `：${label}` : ''}`)
    await sleep(stepMs)
  }
}

const CONFIG = (over = {}) => normalizeConfig({
  boardScript: BOARD, parallel: 3, staleMinutes: 30, maxRetries: 1, autoMerge: true, pollIntervalMs: 50, ...over,
})

/**
 * 一次性路径 stub：worker 前 N 次轮次失败（stopReason=error），此后成功；
 * merger 可选第 M 次中止后成功。记录每次 spawn 的 label。
 */
function mkHealCtx(root, behavior = {}) {
  const agent = {
    id: `sess-heal-${behavior.prd ?? 0}`,
    session: { id: `sess-heal-${behavior.prd ?? 0}`, header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { devLabels: [], mergerLabels: [] }
  const counters = { dev: 0, merger: 0 }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: () => undefined, // 一次性路径（无 agentTeams）
    subagents: {
      start: async (_p, req) => {
        const dev = req.label.match(/^jxx-dev-(.+)$/)
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = req.label.match(/^jxx-merger-(.+)$/)
        if (dev) {
          counters.dev += 1
          calls.devLabels.push(req.label)
          if (counters.dev <= (behavior.failWorker ?? 0)) {
            // 失败前**先领卡**（claimed.md）：复现 #106-A 真死锁形态——卡滞留 claimed 面且
            // alive 未清，无回挪时前沿扫不到（清扫只处理卡账 open 面）→ spec 发现项 1 修正
            const fid = dev[1]
            if (existsSync(join(openDir, `${fid}.md`))) renameSync(join(openDir, `${fid}.md`), join(openDir, `${fid}.claimed.md`))
            return { result: Promise.resolve({ stopReason: 'error', diagnostic: '模拟领卡后轮次失败', output: [] }), dispose: async () => {} }
          }
          const id = dev[1]
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          if (existsSync(join(openDir, `${id}.claimed.md`))) renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已交付' }] }), dispose: async () => {} }
        }
        if (rev) return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '报告\nVERDICT: PASS' }] }), dispose: async () => {} }
        if (mer) {
          counters.merger += 1
          calls.mergerLabels.push(req.label)
          if (counters.merger <= (behavior.abortMerger ?? 0)) {
            // 挂起后异步中止（300ms）：模拟真实中止时序——编排层 dispatch 已完成、合并卡已投出，
            // 中止回调异步到达（同步 resolve 会在 tick 内联完成，测不到回挪-重派环）
            return { result: new Promise((_res, rej) => setTimeout(() => rej(new Error('模拟合并专员中止')), 300)), dispose: async () => {} }
          }
          const card = `merge-${mer[1]}`
          const from = join(openDir, `${card}.md`)
          if (existsSync(from)) renameSync(from, join(root, 'control', 'cards', 'done', `${card}.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已合入 main' }] }), dispose: async () => {} }
        }
        throw new Error(`未知角色 ${req.label}`)
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent, calls }
}

test('死亡自愈：worker 失败 → 卡位自动回 inbox → 前沿重派成功（#106-A 根治）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId, mergeId } = mkRepo(96)
  const { ctx, agent, calls } = mkHealCtx(root, { prd: 96, failWorker: 1 }) // 第 1 轮失败，第 2 轮成功
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '96')
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)), '重派后卡最终 done')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${mergeId}.md`)))
  assert.ok(calls.devLabels.length >= 2, `失败 1 次 + 重派 ≥1 次（卡位自动回挪，前沿看得见；实次 ${calls.devLabels.length}）`)
  const hist = orch.status(agent).history.map((h) => h.event).join('\n')
  assert.match(hist, new RegExp(`死亡自愈：${cardId} 卡位已回挪 inbox`), '回挪留痕（#106-A）')
  assert.match(hist, new RegExp(`${cardId} worker 失败（stopReason=error：模拟领卡后轮次失败），重试 1（卡位已回挪）`), '失败计数留痕')
  const followups = agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')
  assert.match(followups, /worker 第 1 次失败.*已回挪待领位自动重派/, '死亡事件在 followup 面有记录（构建内容 3）')
  assert.match(followups, /card-read/, 'notify 带机读引导（构建内容 4）')
})

test('死亡自愈：合并专员中止 → 即时 notify（不等 10 分钟）+ 合并卡回挪重派成功（#106-C）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId, mergeId } = mkRepo(95)
  const { ctx, agent, calls } = mkHealCtx(root, { prd: 95, abortMerger: 1 }) // merger 第 1 次中止
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '95')
  await waitFor(() => orch.status(agent).stage === 'ops', 45_000)
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)))
  const doneNames = readdirSync(join(root, 'control', 'cards', 'done'))
  assert.ok(doneNames.includes(`${mergeId}.md`), `合并卡回挪后重派成功（done 目录：${doneNames.join(',')}；followups：${agent.followups.map((m) => (m.content?.[0]?.text || '').slice(0, 80)).join(' | ')}）`)
  assert.ok(calls.mergerLabels.length >= 2, `merger 中止 1 次 + 重派 ≥1 次（合并卡可重派，验收 2；实次 ${calls.mergerLabels.length}）`)
  // 回挪留痕：合并卡在 open/（keepInbox 语义）时只落账不动物理位——history 无「死亡自愈」行，
  // 自愈证据落在 shadow 簿记 retries ≥1 + 重派成功（上两断言已实证）；failure 留痕在 run.blocked.push
  // （spec 审查发现项 4 补验：中止落账面有记录）
  const stBlocked = orch.status(agent)
  assert.ok(stBlocked.blocked.some((b) => b.includes('合并专员失败')), '合并中止在 run.blocked 落账留痕')
  const followups = agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')
  assert.match(followups, /合并专员中止/, '中止即报（不等 10 分钟超时面）')
  // 合并卡影子账进入受管簿记（构建内容 2）
  const st = orch.status(agent)
  assert.ok(st.cards.some((c) => c.id === mergeId), '合并卡在 run.cards 受管簿记（status 面可查）')
})

test('死亡自愈：teamBackoff 面失败超限 → 卡回待领位带 needs-info（等待窗语义保留，恢复可唤醒）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(94)
  const agent = {
    id: 'sess-heal-94', session: { id: 'sess-heal-94', header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
  }
  // 团队路径：worker 领卡（claimed）在飞；直驱 safeHandleFailure 模拟派发失败 ——
  // teamBackoff=0 → 立即超限 → failHandlerOf 回挪 blocked（待领位 + needs-info，等待窗语义保留）
  // （fixture 首派走 spawnTeammate 不走 sendMessage，sendMessage 恒失败驱动不了 resend 链——直驱最小面）
  const openDir = join(root, 'control', 'cards', 'open')
  const teams = {
    async spawnTeammate(_c, req) {
      if (existsSync(join(openDir, '94-01-solo.md'))) {
        renameSync(join(openDir, '94-01-solo.md'), join(openDir, '94-01-solo.claimed.md'))
      }
      return { member: { name: req.name } }
    },
    async sendMessage() { throw new Error('模拟宿主消息路持续失败') },
    async interrupt() { return { previousStatus: 'inactive' } },
    listMembers: () => [{ id: 'lead', name: 'lead', role: 'lead', status: 'running', diagnostics: [] }, { id: 'm1', name: 'dev-a', role: 'teammate', status: 'inactive', diagnostics: [] }],
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: (k) => (k === 'agentTeams' ? teams : undefined),
    subagents: { start: async () => { throw new Error('团队模式下不应有一次性 spawn') } },
    logger: { info() {}, warn() {}, error() {} },
  }
  const orch = new Orchestrator(ctx, CONFIG({ teamBackoff: 0 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '94')
  await waitFor(() => orch.status(agent).cards.some((c) => c.phase === 'claimed'), 15_000, 'worker 领卡（claimed 在飞）')
  await orch.safeHandleFailure(orch.runs.get('sess-heal-94'), cardId, new Error('模拟宿主消息路持续失败'), {
    role: 'dev',
    fail: orch.failHandlerOf(orch.runs.get('sess-heal-94'), cardId, 'dev'),
  })
  await waitFor(() => {
    if (!existsSync(join(openDir, '94-01-solo.md'))) return false
    return /needs-info/.test(readFileSync(join(openDir, '94-01-solo.md'), 'utf8'))
  }, 15_000, '超限后卡回待领位 + needs-info（等待窗语义保留；PRD 111 前红是「回挪了但重发时不回 claimed 位」——由恢复唤醒路 resendTeamDirective 负责落回）')
  const followups = agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')
  assert.match(followups, /连续失败/, '团队路径死亡事件 notify（构建内容 3）')
})
