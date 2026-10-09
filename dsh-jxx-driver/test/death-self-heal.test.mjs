/**
 * 死亡自愈 E2E（PRD 111 工单 01 / BACKLOG #106-A/C · ADR-0122 D1）：
 * worker settle 失败 → 卡位自动回挪 → 前沿重派成功（消灭「重试后卡滞留 claimed 静默」实况）；
 * 合并专员中止 → 即时 notify（不等 10 分钟超时面）+ 合并卡回挪可重派；合并卡纳入受管簿记
 * （影子账只服务重派面，收口仍以主卡为准）；三类死亡事件在 run.history 与 followup 面都有记录。
 * 失败注入口径：stopReason=error = worker/merger 轮次失败（一次性路径 onXxxSettled(err)）。
 * 返工轮补（三维审查发现项）：终局面（超限转人工）的物理卡位与 needs-info 标签、合并卡「领卡后
 * 静默死亡」的僵死自愈（团队路径），两族此前零覆盖。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, renameSync, readdirSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'

// BOARD 定位：env 显式 → 仓内相对兜底（同仓 jxx-ticket-board 副本，不依赖宿主安装面——std 审查发现项 6）→
// 宿主安装面（外置技能目录）。两处都不存在时用例 t.skip 兜底。
// 返工轮 rule 发现项 4a 修正：原兜底路径 `../../jxx-ticket-board/scripts/board.mjs` 在分支树里不存在
// （仓内实际位于 `base/skills/engineering/jxx-ticket-board/`），兜底恒不命中 ⇒ 干净环境静默 t.skip 三条
// E2E；此处改为真实仓内路径，并用 fileURLToPath 取代手写盘符剥壳。
const IN_REPO_BOARD = fileURLToPath(new URL('../../base/skills/engineering/jxx-ticket-board/scripts/board.mjs', import.meta.url))
const BOARD = process.env.JXX_BOARD
  || (existsSync(IN_REPO_BOARD)
    ? IN_REPO_BOARD
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
          if (behavior.mergerHangs) {
            // 「领卡后挂住」形态：先领卡（此时卡在 .md 待领位 → 测试侧自行挪到 .claimed.md），
            // 轮次永不 resolve（模拟队友静默死亡，供失败路直调/僵死面判定用）
            return { result: new Promise(() => {}), dispose: async () => {} }
          }
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
  await waitFor(() => orch.status(agent).cards.some((c) => c.phase === 'claimed'), 15_000, 50, 'worker 领卡（claimed 在飞）')
  await orch.safeHandleFailure(orch.runs.get('sess-heal-94'), cardId, new Error('模拟宿主消息路持续失败'), {
    role: 'dev',
    fail: orch.failHandlerOf(orch.runs.get('sess-heal-94'), cardId, 'dev'),
  })
  await waitFor(() => labelsOf(join(openDir, '94-01-solo.md')) !== '' && /needs-info/.test(labelsOf(join(openDir, '94-01-solo.md'))),
    15_000, 50, '超限后卡回待领位 + needs-info（等待窗语义保留；PRD 111 前红是「回挪了但重发时不回 claimed 位」——由恢复唤醒路 resendTeamDirective 负责落回）')
  // 注：此处必须读**卡面 labels 行**——新投卡模板注释段逐字列了五标签名（含 needs-info），
  // 全文 /needs-info/ 匹配会恒真（与本文件新增用例同一坑，返工轮一并纠正）。
  const followups = agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')
  assert.match(followups, /连续失败/, '团队路径死亡事件 notify（构建内容 3）')
})

/**
 * 卡面 `- labels:` 行读取（断言 needs-info 用）。
 * 存在性安全：等待窗内卡可能正处在别的后缀位（.claimed.md/.review.md）或尚未投出——
 * 此时返回空串让 waitFor 继续轮询，而不是让 readFileSync 抛错把等待窗变成硬失败。
 */
function labelsOf(file) {
  if (!existsSync(file)) return ''
  return (readFileSync(file, 'utf8').match(/^-\s*labels:\s*(.+)$/m) || [])[1] || ''
}

/**
 * 全量 history（**不**用 `status().history`）：那是 `run.history.slice(-20)` 的观测窗，
 * 生命周期长的用例里早期留痕会被后续事件挤出窗口，断言会随事件数漂移（本用例二跑实测踩到）。
 */
function fullHistory(orch, sessionId) {
  return (orch.runs.get(sessionId)?.history || []).map((h) => h.event).join('\n')
}

test('死亡自愈：一次性路径 worker 失败超限 → 卡回待领位 + needs-info（终局面不再滞留 claimed）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // spec 审查发现项 1 的回归面：maxRetries=0 ⇒ 首轮失败即超限（现有 3 用例只覆盖重试路 failWorker=1，
  // 超限/终局面零覆盖）。修前实测：卡停 `open/<id>.claimed.md`、无后缀待领位文件不存在、卡账 blocked
  // ⇒ 前沿（只收 open）与僵死扫描（只收 claimed）都不再接管，卡永久滞留「处理中」泳道。
  const { root, cardId } = mkRepo(92)
  const { ctx, agent } = mkHealCtx(root, { prd: 92, failWorker: 99 }) // 恒失败 ⇒ 必然走到超限终局
  const orch = new Orchestrator(ctx, CONFIG({ maxRetries: 0 }), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const openDir = join(root, 'control', 'cards', 'open')

  await orch.auto(agent, '92')
  // 等「回挪落痕」而非仅等文件到位：cardMove 是 await 面，文件先改名、history 行后落，
  // 只等文件会让断言读到半程状态（本用例首跑实测踩到）。
  await waitFor(() => fullHistory(orch, 'sess-heal-92').includes('卡位已回挪 blocked'),
    30_000, 50, '超限后回挪到待领位 + needs-info')
  assert.match(labelsOf(join(openDir, `${cardId}.md`)), /needs-info/, `超限卡面带 needs-info（实际 labels: ${labelsOf(join(openDir, `${cardId}.md`))}）`)
  assert.ok(!existsSync(join(openDir, `${cardId}.claimed.md`)), '卡不再滞留在办位（.claimed.md 已消失）')
  const st = orch.status(agent)
  assert.ok(st.cards.some((c) => c.id === cardId && c.phase === 'blocked'), '卡账 phase=blocked（与物理位一致）')
  assert.ok(st.blocked.some((b) => b.includes('失败超限')), 'run.blocked 落账超限')
  assert.match(fullHistory(orch, 'sess-heal-92'), new RegExp(`死亡自愈：${cardId} 卡位已回挪 blocked`), '超限回挪留痕')
  const followups = agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')
  assert.match(followups, /已达重试上限，转人工/, '终局 notify 即时上报')
})

/**
 * 团队路径 fixture（合并卡僵死 / 开发轮存活判据多用例共用）：dev 与合并专员都走持久队友，
 * 审查者走一次性子会话；SETTLED 回传经 orch.onTeamMessage 收割。
 * - `silentMergerRounds`：前 N 轮合并专员「领卡后静默死亡」（挪到 .claimed.md + mtime 回拨 + 报 inactive）
 * - `devStatus`：dev 队友在 listMembers 里报的宿主状态（running = 健在；inactive/failed = 失联）
 * - `devHangs`：dev 队友领卡后**不回传 SETTLED**（模拟 #106-A 的「领卡后静默挂死」实况）
 */
function mkTeamHealCtx(root, { prd, silentMergerRounds = 0, devStatus = 'running', devHangs = false, devCardId, liveMerger = false }) {
  const agent = {
    id: `sess-team-${prd}`, session: { id: `sess-team-${prd}`, header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { mergerRounds: 0, grabs: 0, devDispatches: 0 }
  const members = new Map()
  let deliver = null
  let lastMergerName = null // 合并专员名（判死面的存活探针按名查 status）
  const SETTLED = /SETTLED:[ \t]*`?([A-Za-z0-9][A-Za-z0-9._-]*)`?/
  /** dev 队友领卡后挂住：物理挪到 .claimed.md + mtime 回拨（卡面看似僵死） */
  const devGrabAndHang = (card) => {
    if (!card) return
    const from = join(openDir, `${card}.md`)
    if (existsSync(from)) renameSync(from, join(openDir, `${card}.claimed.md`))
    const cl = join(openDir, `${card}.claimed.md`)
    if (existsSync(cl)) {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
      utimesSync(cl, past, past)
    }
  }
  const handle = (text) => {
    const m = SETTLED.exec(text)
    if (!m) return
    const card = m[1]
    if (card.startsWith('merge-')) {
      calls.mergerRounds += 1
      const from = join(openDir, `${card}.md`)
      if (liveMerger) {
        // 在飞长合并轮：领卡 + 卡面回拨（看似僵死），但宿主仍报 running（队友真在干长活）⇒ 让位
        calls.grabs += 1
        if (existsSync(from)) renameSync(from, join(openDir, `${card}.claimed.md`))
        const claimed = join(openDir, `${card}.claimed.md`)
        if (existsSync(claimed)) {
          const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
          utimesSync(claimed, past, past)
        }
        if (lastMergerName) members.set(lastMergerName, { name: lastMergerName, status: 'running' })
        return
      }
      if (calls.mergerRounds <= silentMergerRounds) {
        // 静默死亡形态（#106-C 生产默认）：领卡（挪到 .claimed.md）后**永无 SETTLED 回传**。
        // 团队路径的 alive 在 dispatch 投递成功时已清（.then），故此处卡面成为唯一判死信号。
        calls.grabs += 1
        if (existsSync(from)) renameSync(from, join(openDir, `${card}.claimed.md`))
        const claimed = join(openDir, `${card}.claimed.md`)
        if (existsSync(claimed)) {
          const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
          utimesSync(claimed, past, past)
        }
        // 队友「失联」：宿主侧如实报为 inactive（R3 rule 审查 F4 要求判死面消费真存活信号——
        // 若这里仍报 running，roundInFlight 存活闸会正确地把本轮判为健在而不自愈）
        if (lastMergerName) members.set(lastMergerName, { name: lastMergerName, status: 'inactive' })
        return
      }
      if (existsSync(from)) renameSync(from, join(root, 'control', 'cards', 'done', `${card}.md`))
      return
    }
    if (existsSync(join(openDir, `${card}.md`))) renameSync(join(openDir, `${card}.md`), join(openDir, `${card}.claimed.md`))
    if (existsSync(join(openDir, `${card}.claimed.md`))) renameSync(join(openDir, `${card}.claimed.md`), join(openDir, `${card}.review.md`))
    if (deliver) deliver(`已办结 ${card}。\nSETTLED: ${card}`)
  }
  const teams = {
    async spawnTeammate(_c, req) {
      members.set(req.name, { name: req.name, status: devStatus })
      // 角色靠 description 判（channel.dispatch 组装：`jxx-driver <role> · <cardId>`）——
      // 名字由宿主名字池生成、不含 role 字样，按名字正则判会全部漏认（R2 实证）
      const isMerger = String(req.description || '').includes('merger')
      if (isMerger) lastMergerName = req.name
      else calls.devDispatches += 1
      const text = req.prompt.map((b) => b.text).join('\n')
      if (devHangs && !isMerger) { devGrabAndHang(devCardId); return { member: { name: req.name } } }
      handle(text)
      return { member: { name: req.name } }
    },
    async sendMessage(_c, req) {
      const text = req.content.map((b) => b.text).join('\n')
      // dev 挂死形态：同名复用（重派）同样不回传（否则指令模板里的 `SETTLED: <卡id>` 教学行
      // 会被 handle 当成真回传，本轮提前推进、僵死面永不再接管——本用例首跑即踩此坑）
      if (devHangs && !/合并卡/.test(text)) { calls.devDispatches += 1; devGrabAndHang(devCardId); return { messageId: 'm-dev', status: 'accepted' } }
      if (req.member && text.includes('merge-')) lastMergerName = req.member
      handle(text)
      return { messageId: `m-${calls.mergerRounds}`, status: 'accepted' }
    },
    async interrupt() { return { previousStatus: devStatus } },
    listMembers: () => [{ id: 'lead', name: 'lead', role: 'lead', status: 'running', diagnostics: [] }, ...[...members.values()]],
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: (k) => (k === 'agentTeams' ? teams : undefined),
    subagents: {
      start: async (_p, req) => {
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        if (!rev) throw new Error(`团队模式下不应有一次性 spawn：${req.label}`)
        return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '报告\nVERDICT: PASS' }] }), dispose: async () => {} }
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent, calls, openDir, wireDeliver: (fn) => { deliver = fn } }
}

test('死亡自愈：合并专员领卡后静默死亡（团队路径）→ 僵死扫描接管并重派成功', { timeout: 90_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // R1 三维审查 std#1 / rule#1 的共同阻断面：合并卡影子账 phase 从不为 claimed，旧守卫
  // `rec.phase !== 'claimed'` 恒真 ⇒ 整段死代码，「合并专员领卡后不回传」零自愈/零 notify/零重派。
  // 本用例即该形态的判据，且用**生产默认形态**（ADR-0121 团队路径：dispatch 投递成功即清 alive，
  // 故「在飞闸已放 + 卡面零推进」= 队友失联的判定面成立，这正是原阻断项的实际 fixture）。
  const { root, cardId, mergeId } = mkRepo(91)
  const { ctx, agent, calls, wireDeliver } = mkTeamHealCtx(root, { prd: 91, silentMergerRounds: 1 })
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  // deliver 必须赶在 auto 之前接好：首个 SETTLED（dev 交付）就会经它回灌
  wireDeliver((text) => orch.onTeamMessage(agent, text))
  await orch.auto(agent, '91')
  await waitFor(() => fullHistory(orch, 'sess-team-91').includes('卡位已回挪'),
    60_000, 50, '合并卡僵死扫描接管并完成回挪（旧守卫恒真时此处超时）')
  const hist = fullHistory(orch, 'sess-team-91')
  assert.match(hist, new RegExp(`${mergeId} 合并卡僵死（第 1 次失败）`), '僵死判定留痕（自愈链被驱动）')
  assert.match(hist, new RegExp(`死亡自愈：${mergeId} 卡位已回挪`), '回挪留痕（卡位真的被搬回待领位）')
  const followups = agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')
  assert.match(followups, /合并专员领卡后超 1 分钟无回传/, '僵死 notify 即时上报（旧实现零 notify）')
  assert.match(followups, /card-read/, 'notify 带机读引导（构建内容 4）')
  // 重派后本轮正常收口 → 全链走到 ops（自愈不是「换个地方卡住」）
  await waitFor(() => orch.status(agent).stage === 'ops', 60_000, 50, '僵死自愈后重派成功并收口')
  assert.ok(calls.mergerRounds >= 2, `僵死后合并卡被重派（实次 ${calls.mergerRounds}）`)
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${mergeId}.md`)), '合并卡最终收口 done')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)), '开发卡随合并收口 done')
})

test('死亡自愈：合并卡重派超限 → 回待领位 + needs-info（前沿超限分支的判据）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // spec 审查发现项 2 点名的分支（`合并卡重派超限，回待领位转人工`）：修前它只改卡账不动物理位与
  // labels ⇒ 合并卡留在看板「待领取」列、triage 轴失联、verify 第 5 路不报警。本用例是它的判据
  // ——去掉该分支的回挪，本用例必红（R2 审查指出该分支此前无用例守护）。
  // fixture：合并专员连续中止（abortMerger=2）→ 影子 retries 2 > maxRetries 1 → 前沿判超限。
  const { root, cardId, mergeId } = mkRepo(90)
  const { ctx, agent, calls } = mkHealCtx(root, { prd: 90, abortMerger: 2 })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const openDir = join(root, 'control', 'cards', 'open')

  await orch.auto(agent, '90')
  await waitFor(() => labelsOf(join(openDir, `${mergeId}.md`)) !== '' && /needs-info/.test(labelsOf(join(openDir, `${mergeId}.md`))),
    40_000, 50, '重派超限后合并卡回待领位 + needs-info')
  const st = orch.status(agent)
  assert.ok(st.cards.some((c) => c.id === mergeId && c.phase === 'blocked'), '合并卡影子账转 blocked（与物理位一致）')
  assert.ok(st.blocked.some((b) => b.includes('合并卡重派超限')), `run.blocked 落账前沿超限（实际：${JSON.stringify(st.blocked)}）`)
  assert.ok(!existsSync(join(openDir, `${mergeId}.claimed.md`)), '合并卡不再滞留在办位')
  assert.ok(calls.mergerLabels.length >= 2, `重派确实发生过（实次 ${calls.mergerLabels.length}）`)
  assert.ok(existsSync(join(openDir, `${cardId}.review.md`)), '开发卡仍停在待审位（未被合并动作误动）')
})

test('死亡自愈：合并卡僵死重试超限 → 回待领位 + needs-info（僵死面超限出口的判据）', { timeout: 90_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 僵死面自有终局出口（`合并卡僵死且重试超限`）：每轮重派的队友都领卡后失联 ⇒
  // 第 1 次判死重派（budget 1/1 未超）→ 第 2 次判死时 2 > maxRetries ⇒ 就地转人工。
  // 该出口保证「回挪前预算已尽」时仍有界收敛，不依赖前沿分支（spec 审查发现项 2 的同族出口）。
  const { root, mergeId } = mkRepo(88)
  const { ctx, agent, calls, openDir, wireDeliver } = mkTeamHealCtx(root, { prd: 88, silentMergerRounds: 99 })
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  wireDeliver((text) => orch.onTeamMessage(agent, text))
  await orch.auto(agent, '88')
  await waitFor(() => labelsOf(join(openDir, `${mergeId}.md`)) !== '' && /needs-info/.test(labelsOf(join(openDir, `${mergeId}.md`))),
    60_000, 50, '僵死超限后合并卡回待领位 + needs-info')
  const st = orch.status(agent)
  assert.ok(st.cards.some((c) => c.id === mergeId && c.phase === 'blocked'), '合并卡影子账转 blocked')
  // 必须锁定**僵死面**这个具体出口的文案（R2 三维审查 std#3：先前用 /合并卡.*超限/ 是 OR 匹配，
  // 前沿超限分支会顶替满足断言 ⇒ 该分支实际零守护，强制置 false 仍 8/8 全绿）
  assert.ok(st.blocked.some((b) => /僵死且重试超限/.test(b)), `run.blocked 落账僵死面超限（实际：${JSON.stringify(st.blocked)}）`)
  assert.ok(!existsSync(join(openDir, `${mergeId}.claimed.md`)), '合并卡不再滞留在办位')
  assert.ok(calls.grabs >= 2, `僵死判定确实发生过 ≥2 轮（实次 ${calls.grabs}）`)
})

test('有界性：回挪持续失败时僵死面不得每 tick 重入（无界循环回归判据）', { timeout: 90_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // R2 三维审查 std#1：僵死面超限分支一度只改卡账不设重入闸 —— cardMove 持续失败时
  // selfHealReturnToInbox 有意吞错返回 false，卡物理位留在 claimed、守卫又只看 alive，
  // 于是每 tick 重复「retries++ → blocked.push → notify → 回挪再失败」（实测 5s +80 次）。
  // 本用例把 merge 卡的回挪打成恒失败，断言判终局后不再重入（有界）。
  const { root, mergeId } = mkRepo(87)
  const { ctx, agent, wireDeliver } = mkTeamHealCtx(root, { prd: 87, silentMergerRounds: 99 })
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  wireDeliver((text) => orch.onTeamMessage(agent, text))
  await orch.auto(agent, '87')
  // 把「合并卡」的回挪打成恒失败（模拟卡被人工动过/权限问题等持续性失败），其余卡位操作照常
  const run = orch.runs.get('sess-team-87')
  const realMove = run.board.cardMove.bind(run.board)
  run.board.cardMove = async (r, opts) => {
    if (opts.id.startsWith('merge-')) throw new Error('模拟回挪持续失败')
    return realMove(r, opts)
  }
  // 等到第一次判死留痕（此后若每次 tick 都重入，blocked/retries 会线性增长）
  await waitFor(() => fullHistory(orch, 'sess-team-87').includes('合并卡僵死'), 60_000, 50, '僵死面被判到（回挪会失败）')
  const snap = () => ({ blocked: run.blocked.length, retries: run.cards.get(mergeId)?.retries ?? 0 })
  const a = snap()
  await new Promise((r) => setTimeout(r, 3000)) // ~60 tick @50ms：无界循环会在此期间线性增长
  const b = snap()
  assert.ok(b.blocked - a.blocked <= 1, `判终局后不得每 tick 重入（3s 内 blocked +${b.blocked - a.blocked}，无界时为数十次）`)
  assert.ok(b.retries - a.retries <= 1, `retries 不得每 tick 递增（3s 内 +${b.retries - a.retries}）`)
  // 判死确实发生过（回挪失败仍应落账与留痕，只是不再重入）
  assert.ok(run.blocked.some((x) => /僵死且重试超限/.test(x)), `僵死面超限落账（实际：${JSON.stringify(run.blocked)}）`)
  assert.ok(/合并卡僵死/.test(fullHistory(orch, 'sess-team-87')), '僵死判定留痕')
  assert.ok(!existsSync(join(root, 'control', 'cards', 'done', `${mergeId}.md`)), '回挪恒失败时不得假收敛为 done')
})

test('活轮保护：团队路径开发轮「仍在执行」不得被判死（R2 spec 审查 High#2 的反面）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 卡面 mtime 静默**不能**区分「队友挂了」与「队友在干长活」（R2 spec 审查 High#1）。故判死面必须
  // 消费成员存活信号：本用例里 dev 队友领卡后卡面回拨 2h（看似僵死），但宿主仍报 `running` ⇒
  // 不得判死、不得回挪、不得重派（D6：同时刻只有一个在飞轮次）。
  const { root, cardId } = mkRepo(86)
  const { ctx, agent, openDir } = mkTeamHealCtx(root, { prd: 86, devStatus: 'running', devHangs: true, devCardId: cardId })
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, maxRetries: 3, autoMerge: false }), ctx.logger)
  t.after(async () => { await orch.dispose() })
  await orch.auto(agent, '86')
  await waitFor(() => fullHistory(orch, 'sess-team-86').includes('spawn'), 20_000, 50, '开发轮已派出')
  await new Promise((r) => setTimeout(r, 3000)) // ~50 tick @60ms：无存活闸则必然判死
  const hist = fullHistory(orch, 'sess-team-86')
  assert.ok(!/僵死/.test(hist), `在飞开发轮不得被判死（历史：${hist.replace(/\n/g, ' | ')}）`)
  assert.ok(!/死亡自愈/.test(hist), '在飞开发轮不得被回挪')
  assert.ok(existsSync(join(openDir, `${cardId}.claimed.md`)), '卡仍在队友手上（未被搬走）')
  assert.equal(orch.status(agent).cards.find((c) => c.id === cardId)?.phase, 'claimed', '卡账仍在办（未被降级）')
})

test('死亡自愈：团队路径开发轮「队友失联」→ 僵死面接管（R2 spec 审查 High#2 正面）', { timeout: 90_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // #106-A 的实况形态：开发卡队友领卡后静默挂死（宿主 status=inactive）。HEAD 的 `!rec.alive` 闸
  // 在此形态下**零自愈**（alive 只在 settle 时清位，挂死轮次永不清）⇒ 卡滞留 claimed（实测 9h56m）。
  // 本用例即该形态的判据：成员失联 ⇒ 放行判死 ⇒ 回挪 + notify + 重派。
  const { root, cardId } = mkRepo(85)
  const { ctx, agent, calls } = mkTeamHealCtx(root, { prd: 85, devStatus: 'inactive', devHangs: true, devCardId: cardId })
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, maxRetries: 1, autoMerge: false }), ctx.logger)
  t.after(async () => { await orch.dispose() })
  await orch.auto(agent, '85')
  await waitFor(() => /僵死/.test(fullHistory(orch, 'sess-team-85')), 60_000, 50,
    `队友失联后僵死面接管（HEAD 的 !rec.alive 闸下此处必超时；历史=${fullHistory(orch, 'sess-team-85').replace(/\n/g, ' | ')}）`)
  const hist = fullHistory(orch, 'sess-team-85')
  assert.match(hist, new RegExp(`${cardId} 僵死`), '僵死判定留痕（自愈面被驱动）')
  // 自愈真的动了手：要么把卡重派给队友（devDispatches 增长），要么判终局转人工（卡账降级）。
  // 二者都在 HEAD 的 `!rec.alive` 闸下不可能发生（挂死轮次永不清位 ⇒ 本段整段不可达）。
  // 重派在**下一 tick** 才发生（段 5 前沿先于段 6 僵死面），故等它而非即时断言。
  const healed = () => calls.devDispatches >= 2 || orch.status(agent).cards.find((c) => c.id === cardId)?.phase === 'blocked'
  await waitFor(healed, 40_000, 50,
    `失联后必须有自愈动作（devDispatches=${calls.devDispatches} phase=${orch.status(agent).cards.find((c) => c.id === cardId)?.phase}）`)
  const followups = agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')
  // 重派会再派一轮（同样挂住）⇒ 预算 1 耗尽后转人工/自愈留痕；只断言「有人上报过」不足以
  // 证明自愈面被驱动，故锁具体文案（僵死判定/回挪/转人工任一）
  await waitFor(() => /僵死|回挪|转人工|重试/.test(agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')), 30_000, 50,
    `僵死面 notify 即时上报（HEAD 的 !rec.alive 闸下零 notify；实际 followups=${JSON.stringify(agent.followups.map((m) => m.content?.[0]?.text || ''))}）`)
  const after = agent.followups.map((m) => m.content?.[0]?.text || '').join('\n')
  assert.match(after, /僵死|回挪|转人工|重试/, 'notify 含僵死/回挪/转人工文案')
})

test('预算不重复扣：合并轮失败一次只烧一格（失败路与僵死面互斥，R2 rule 审查严重项）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 同一次失败会同时触达两处：onMergerSettled 失败回调（+1）与段 6 僵死面（判死面全放行）。
  // 若无互斥，一次失败即 retries=2 > maxRetries=1 → 直接转人工，本该保留的那次重派被白扣
  // （R2 rule 审查严重发现项：生产默认 staleMinutes=30/maxRetries=1 下实测复现）。
  // 本用例的判据：只失败 1 轮时**不得**转人工超限，且必须真的重派出去（mergerLabels ≥2）。
  const { root, mergeId } = mkRepo(84)
  // 首轮合并失败（abortMerger=1）→ 失败路回挪；次轮成功收口
  const { ctx, agent, calls } = mkHealCtx(root, { prd: 84, abortMerger: 1 })
  const orch = new Orchestrator(ctx, CONFIG({ maxRetries: 1 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '84')
  await waitFor(() => calls.mergerLabels.length >= 2, 40_000, 50, '一次失败后仍应重派（预算未被双扣）')
  const st = orch.status(agent)
  const shadow = st.cards.find((c) => c.id === mergeId)
  assert.ok(!st.blocked.some((b) => /重派超限|僵死且重试超限/.test(b)),
    `仅失败 1 次不得判超限转人工（实际 blocked=${JSON.stringify(st.blocked)} retries=${shadow?.retries}）`)
  assert.ok((shadow?.retries ?? 0) <= 1, `一次失败只记一格预算（实际 retries=${shadow?.retries}）`)
  await waitFor(() => orch.status(agent).stage === 'ops', 40_000, 50, '重派后正常收口')
})

test('D6 不变量：团队路径合并轮「仍在执行」不得被判死重派（成员存活面判据）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 团队路径 dispatch **投递成功**即清 shadow.alive ⇒ alive 与「回合是否存活」无关；若判死面只看
  // alive + 卡面静默，合法长合并回合会被夺卡重派（实测 1→2，破 D6）。本用例让合并专员领卡后
  // 卡面回拨 2h（看似僵死）但宿主仍报 `running` ⇒ 必须让位，且一次都不得重派。
  const { root, mergeId } = mkRepo(83)
  const { ctx, agent, calls } = mkTeamHealCtx(root, { prd: 83, devStatus: 'running', liveMerger: true, devCardId: '83-01-solo' })
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, maxRetries: 3 }), ctx.logger)
  t.after(async () => { await orch.dispose() })
  await orch.auto(agent, '83')
  await waitFor(() => calls.mergerRounds >= 1, 40_000, 50, '合并专员已派出并在飞')
  await new Promise((r) => setTimeout(r, 3000)) // ~50 tick：无存活闸则必然判死重派
  const hist = fullHistory(orch, 'sess-team-83')
  assert.equal(calls.mergerRounds, 1, `在飞合并轮不得被重复派发（D6；实次 ${calls.mergerRounds}）`)
  assert.ok(!/合并卡僵死/.test(hist), '在飞合并轮不得被误判僵死')
  assert.ok(!/死亡自愈：.*merge-/.test(hist), '在飞合并轮不得被回挪')
  assert.equal(orch.status(agent).cards.find((c) => c.id === mergeId)?.phase, 'open', '影子账未判终局')
})

test('预算不重复扣：卡滞留 claimed 时失败路与僵死面不得各记一次（互斥闸判据）', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 触发面（R2 rule 审查严重发现项）：合并专员**领卡后**轮次失败 → 失败路记 retries=1 并尝试回挪；
  // 若回挪失败（卡被人工动过/权限等），卡物理位仍在 .claimed.md ⇒ 段 6 僵死面对**同一次失败**
  // 再记一次 ⇒ retries=2 > maxRetries=1 直接转人工，本该保留的那次重派被白扣。
  // 本用例确定性驱动该组合：先让卡停在 claimed，再直调失败回调，最后跑一拍。
  const { root, cardId, mergeId } = mkRepo(82)
  // abortMerger 大到「永不成功」：合并专员轮次挂住后中止，卡停在 claimed 面（本用例要的形态）
  const { ctx, agent, calls } = mkHealCtx(root, { prd: 82, abortMerger: 99, mergerHangs: true })
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, maxRetries: 1 }), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const openDir = join(root, 'control', 'cards', 'open')

  await orch.auto(agent, '82')
  await waitFor(() => calls.mergerLabels.length >= 1 && /三审全过/.test(fullHistory(orch, 'sess-heal-82')), 40_000, 50, '合并轮已派出')
  const run = orch.runs.get('sess-heal-82')
  // ① 合并专员领卡（物理位 .claimed.md）+ 卡面 mtime 回拨（超 staleMinutes）
  const claimed = join(openDir, `${mergeId}.claimed.md`)
  if (!existsSync(claimed)) {
    const at = join(openDir, `${mergeId}.md`)
    if (existsSync(at)) renameSync(at, claimed)
  }
  assert.ok(existsSync(claimed), '前置：合并卡停在领卡位')
  const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
  utimesSync(claimed, past, past)
  // ② 回挪恒失败：卡物理位留在 claimed（正是段 6 会接管的形态）
  const realMove = run.board.cardMove.bind(run.board)
  run.board.cardMove = async (r, opts) => {
    if (opts.id === mergeId) throw new Error('模拟回挪失败（卡位被人工占用）')
    return realMove(r, opts)
  }
  // ③ 失败路落账（同一次失败）
  await orch.onMergerSettled(run, cardId, '', new Error('模拟合并轮次失败'))
  const afterFail = run.cards.get(mergeId)?.retries
  assert.equal(afterFail, 1, `失败路先记一格（实际 ${afterFail}）`)
  assert.ok(run.cards.get(cardId)?.mergeFailedAt !== undefined, '失败路留下 mergeFailedAt 标记')
  // ④ 跑若干拍：僵死面看到同一张滞留 claimed 的卡，**不得**再记一次
  await new Promise((r) => setTimeout(r, 1000))
  const retriesNow = run.cards.get(mergeId)?.retries
  assert.equal(retriesNow, 1, `同一次失败只烧一格预算（实际 ${retriesNow}；无互斥闸时为 2 ⇒ 直接转人工）`)
  assert.ok(!run.blocked.some((b) => /僵死且重试超限/.test(b)),
    `不得因同一次失败判超限（实际 blocked=${JSON.stringify(run.blocked)}）`)
})

test('有界性：合并轮失败且回挪失败时不得闭死（卡位滞留 claimed 的幂等终局判据）', { timeout: 90_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // R3 rule 审查严重发现项 F1：失败路落 mergeFailedAt 后若僵死面「完全让位」，而失败路的回挪又
  // 失败（卡被人工动过/权限等，物理位仍在 .claimed.md），就再没有任何面接管——就绪前沿只扫物理
  // open/ 面看不见它、僵死面被标记否决 ⇒ 卡永久滞留「处理中」（实测静置 10s/~200 tick 零动作、
  // 零终局、零重派、零通知），正是本单要根治的静默死亡形态，比原「双扣预算」更隐蔽。
  // 本用例即该形态的判据：回挪恒失败时必须有幂等终局（blocked 转人工 + needs-info）。
  const { root, cardId, mergeId } = mkRepo(81)
  const { ctx, agent, calls } = mkHealCtx(root, { prd: 81, mergerHangs: true })
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, maxRetries: 1 }), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const openDir = join(root, 'control', 'cards', 'open')

  await orch.auto(agent, '81')
  await waitFor(() => calls.mergerLabels.length >= 1, 40_000, 50, '合并轮已派出')
  const run = orch.runs.get('sess-heal-81')
  // ① 合并专员领卡 + 卡面 mtime 回拨
  const claimed = join(openDir, `${mergeId}.claimed.md`)
  if (!existsSync(claimed)) {
    const at = join(openDir, `${mergeId}.md`)
    if (existsSync(at)) renameSync(at, claimed)
  }
  assert.ok(existsSync(claimed), '前置：合并卡停在领卡位')
  const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
  utimesSync(claimed, past, past)
  // ② 回挪恒失败：卡物理位留在 claimed（F1 形态）
  const realMove = run.board.cardMove.bind(run.board)
  run.board.cardMove = async (r, opts) => {
    if (opts.id === mergeId) throw new Error('模拟回挪持续失败')
    return realMove(r, opts)
  }
  // ③ 失败路落账（同一次失败，打 mergeFailedAt）
  await orch.onMergerSettled(run, cardId, '', new Error('模拟合并轮次失败'))
  assert.ok(run.cards.get(cardId)?.mergeFailedAt !== undefined, '失败路留下 mergeFailedAt 标记')
  assert.equal(run.cards.get(mergeId)?.retries, 1, '预算只烧一格')
  // ④ 幂等终局必须落下：既有终局（blocked/回挪留痕），又有预算不被重复扣
  await waitFor(() => run.blocked.some((b) => /合并专员失败后卡位未推进|僵死且重试超限/.test(b)),
    40_000, 50, `失败且回挪失败时必须有界收敛（实际 blocked=${JSON.stringify(run.blocked)} retries=${run.cards.get(mergeId)?.retries}）`)
  assert.equal(run.cards.get(mergeId)?.retries, 1, `终局不得再烧预算（实际 ${run.cards.get(mergeId)?.retries}）`)
  // ⑤ 幂等：静置一段不得重复落账（每 tick 重复转人工 = 有界性破）
  const blockedBefore = run.blocked.length
  await new Promise((r) => setTimeout(r, 2000))
  assert.equal(run.blocked.length, blockedBefore, `终局必须幂等，不得每 tick 重复落账（${blockedBefore} → ${run.blocked.length}）`)
})

test('死亡自愈：开发卡「僵死超限」终局面必须回挪卡位（同根第三处出口的判据）', { timeout: 90_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // R5 spec 复审发现项 1：本条在冻结面上**零守护**（把回挪行改为 `Promise.resolve(false)` 后
  // 全量 118/118 仍全绿）。形态 = 团队路径 dev 队友领卡后失联 + mtime 超 staleMinutes + 已超重试上限
  // ⇒ 终局面必须动物理卡位（回待领位 + needs-info），否则卡滞留「处理中」泳道、前沿/僵死两面
  // 都不再接管（前沿只收 open、僵死只收 claimed）= 本单要根治的死锁。
  const { root, cardId } = mkRepo(80)
  const { ctx, agent } = mkTeamHealCtx(root, { prd: 80, devStatus: 'inactive', devHangs: true, devCardId: cardId })
  // maxRetries=0 ⇒ 首次判死即超限，直接走终局出口（不再依赖重派多轮）
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, maxRetries: 0, autoMerge: false }), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const openDir = join(root, 'control', 'cards', 'open')

  await orch.auto(agent, '80')
  await waitFor(() => /僵死超/.test(fullHistory(orch, 'sess-team-80')), 60_000, 50,
    `开发卡僵死超限终局必须落痕（历史=${fullHistory(orch, 'sess-team-80').replace(/\n/g, ' | ')}）`)
  // 终局出口的核心断言：物理卡位被搬出 claimed 位（不动物理位 = 卡滞留「处理中」= 未闭合）
  await waitFor(() => !existsSync(join(openDir, `${cardId}.claimed.md`)), 40_000, 50,
    '僵死超限终局面必须回挪物理卡位（只改卡账会让卡滞留处理中泳道）')
  const st = orch.status(agent)
  assert.ok(st.cards.some((c) => c.id === cardId && c.phase === 'blocked'), '卡账转 blocked 与物理位一致')
  assert.ok(st.blocked.some((b) => /僵死超.*超限/.test(b)), `run.blocked 落账超限（实际：${JSON.stringify(st.blocked)}）`)
})

test('D6 不变量：仍在飞的合并轮次（卡面静默）不得被误判死重复派发', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // PRD 111 修订 1 / D6：同一张卡同一时刻只有一个在飞轮次。一次性路径里 spawn 的轮次活着
  // （result 挂起）⇒ alive=true 必须否决僵死判定；卡面 mtime 静默**不能**区分「轮次挂了」与
  // 「轮次在干长活」（R2 三维审查 spec 维度 High 实证：去掉 alive 闸后健在轮次被误杀、
  // mergerCalls 1→2）。本用例为该不变量的判据。
  const { root, mergeId } = mkRepo(89)
  const openDir = join(root, 'control', 'cards', 'open')
  const agent = {
    id: 'sess-heal-89', session: { id: 'sess-heal-89', header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) },
  }
  let mergerCalls = 0
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: () => undefined,
    subagents: {
      start: async (_p, req) => {
        const dev = req.label.match(/^jxx-dev-(.+)$/)
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = req.label.match(/^jxx-merger-(.+)$/)
        if (dev) {
          const id = dev[1]
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          if (existsSync(join(openDir, `${id}.claimed.md`))) renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已交付' }] }), dispose: async () => {} }
        }
        if (rev) return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '报告\nVERDICT: PASS' }] }), dispose: async () => {} }
        if (mer) {
          mergerCalls += 1
          // 领卡 + 卡面 mtime 回拨（「看起来静默」），但轮次**仍在飞**（result 永不 resolve）
          const from = join(openDir, `${mergeId}.md`)
          if (existsSync(from)) renameSync(from, join(openDir, `${mergeId}.claimed.md`))
          const claimed = join(openDir, `${mergeId}.claimed.md`)
          if (existsSync(claimed)) {
            const past = new Date(Date.now() - 2 * 60 * 60 * 1000)
            utimesSync(claimed, past, past)
          }
          return { result: new Promise(() => {}), dispose: async () => {} }
        }
        throw new Error(`未知角色 ${req.label}`)
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  const orch = new Orchestrator(ctx, CONFIG({ staleMinutes: 1, maxRetries: 3 }), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '89')
  await waitFor(() => mergerCalls >= 1, 30_000, 50, '合并专员已派出并在飞')
  // 给足 tick 数：staleMinutes=1 且 mtime 已回拨 2h，若判死面不看 alive 则必然重派
  await new Promise((r) => setTimeout(r, 4000))
  const hist = fullHistory(orch, 'sess-heal-89')
  assert.equal(mergerCalls, 1, `在飞轮次不得被重复派发（D6；实次 ${mergerCalls}）`)
  assert.ok(!/合并卡僵死/.test(hist), '在飞轮次不得被误判僵死')
  assert.ok(!/死亡自愈：.*合并卡/.test(hist), '在飞轮次不得被回挪')
  assert.ok(existsSync(join(openDir, `${mergeId}.claimed.md`)), '合并卡仍在合并专员手上（未被搬走）')
})
