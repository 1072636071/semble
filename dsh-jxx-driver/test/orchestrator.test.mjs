/**
 * 编排器 E2E：fixture 看板（真 board.mjs）+ stub ctx.subagents。
 * 覆盖：投卡→开发→三维审查→合并→done 全流转、审查 FAIL 返工、worker 失败重试、held 依赖释放、stop 清场。
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'

const BOARD = process.env.JXX_BOARD
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')

function mkRepo() {
  const root = mkdtempSync(join(tmpdir(), 'jxx-e2e-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', '99-test-prd', 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', '99-test-prd', 'PRD.md'),
    '# PRD 99 · 测试 PRD\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n')
  writeFileSync(join(dir, '01-first.md'), '# 第一张\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
  writeFileSync(join(dir, '02-second.md'), '# 第二张\n\n**Status:** ready-for-agent\n\n**Blocked by:** 01\n\n## 评论\n')
  return { root, featureDir: join(root, '.scratch', '99-test-prd') }
}

/** 造一个最小 stub ctx + 驱动会话 agent。 */
function mkCtx(root, behavior = {}) {
  const agent = {
    id: 'sess-1',
    session: { id: 'sess-1', header: { cwd: root } },
    followups: [],
    followup(msg) { this.followups.push(msg) },
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    subagents: {
      start: async (_provider, req) => {
        const label = req.label
        const dev = label.match(/^jxx-dev-(.+)$/)
        const rev = label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = label.match(/^jxx-merger-(.+)$/)
        if (dev) {
          const id = dev[1]
          if (behavior.workerError) return { result: Promise.resolve({ stopReason: 'error', diagnostic: '模拟失败', output: [] }), dispose: async () => {} }
          // 模拟 worker：按当前卡位领卡（返工时卡已在 .claimed.md）→ 交付
          const openDir = join(root, 'control', 'cards', 'open')
          if (existsSync(join(openDir, `${id}.md`))) {
            renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          }
          renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已交付' }] }), dispose: async () => {} }
        }
        if (rev) {
          const dim = rev[1]
          const pass = behavior.failDims ? !behavior.failDims.includes(dim) : true
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: `报告\nVERDICT: ${pass ? 'PASS' : 'FAIL'}` }] }), dispose: async () => {} }
        }
        if (mer) {
          const id = mer[1]
          // 模拟合并专员：merge 卡进 done/（协议：merge 卡由合并专员移，开发卡由编排者移）
          renameSync(join(root, 'control', 'cards', 'open', `merge-${id}.md`), join(root, 'control', 'cards', 'done', `merge-${id}.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '已合入 main' }] }), dispose: async () => {} }
        }
        throw new Error(`未知角色 ${label}`)
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent }
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

const CONFIG = () => normalizeConfig({
  boardScript: BOARD, parallel: 3, staleMinutes: 30, maxRetries: 1, autoMerge: true, pollIntervalMs: 50,
})

test('E2E：auto 直进 implement，两卡（02 依赖 01）全自动走到 done → ops', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, featureDir } = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '99')
  assert.equal(orch.status(agent).stage, 'implement')
  // 两张卡都投出
  assert.ok(existsSync(join(root, 'control', 'cards', 'open', '99-01-first.md')) || existsSync(join(root, 'control', 'cards', 'open', '99-01-first.claimed.md')) || existsSync(join(root, 'control', 'cards', 'open', '99-01-first.review.md')))
  // 02 依赖 01 → 进 held
  assert.ok(existsSync(join(root, 'control', 'held', '99-02-second.md')), '02 应在 held 等依赖')

  await waitFor(() => orch.status(agent).stage === 'ops')
  // 双卡都 done
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', '99-01-first.md')), '01 应 done')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', '99-02-second.md')), '02 应 done')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', 'merge-99-01-first.md')), '01 的合并卡应 done')
  // 有通知进会话
  assert.ok(agent.followups.length > 0, '应有会话内汇报')
  const st = orch.status(agent)
  assert.equal(st.stage, 'ops')
})

test('E2E：审查 FAIL → 返工一次 → 全过 → done', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkdtempSync(join(tmpdir(), 'jxx-e2e-rework-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', '98-one', 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', '98-one', 'PRD.md'),
    '# PRD 98 · 单卡\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n')
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无\n\n## 评论\n')

  // spec 维度第一次 FAIL、之后 PASS：用计数器模拟
  let specCalls = 0
  const { ctx, agent } = mkCtx(root, {})
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

  await orch.auto(agent, '98')
  await waitFor(() => orch.status(agent).stage === 'ops')
  assert.ok(specCalls >= 2, 'spec 审查应至少跑两次（第一次 FAIL 返工后重审）')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', '98-01-solo.md')))
  const fullHist = orch.runs.get(agent.session.id).history.map((h) => h.event).join('\n') // status() 已瘦身（≤10 条），早期事件断言走全量史
  assert.match(fullHist, /返工/)
})

test('E2E：worker 持续失败 → 重试一次 → blocked 转人工', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkdtempSync(join(tmpdir(), 'jxx-e2e-fail-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', '97-fail', 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', '97-fail', 'PRD.md'),
    '# PRD 97 · 失败测试\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n')
  writeFileSync(join(dir, '01-bad.md'), '# 失败卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无\n\n## 评论\n')
  const { ctx, agent } = mkCtx(root, { workerError: true })
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  await orch.auto(agent, '97')
  await waitFor(() => {
    const st = orch.status(agent)
    return st.cards.length && st.cards[0].phase === 'blocked'
  })
  const st = orch.status(agent)
  assert.ok(st.blocked.length > 0, 'blocked 列表应有记录')
  assert.ok(agent.followups.some((m) => /转人工/.test(m.content[0].text)), '应通知转人工')
})

test('E2E：stop 清场（停轮询、无残留 run）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root } = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  await orch.auto(agent, '99')
  const r = await orch.stop(agent)
  assert.equal(r.stopped, true)
  assert.equal(orch.status(agent).active, false)
})

test('gates：advance 在 decide 阶段无 ADR 被拒', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-gate-'))
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  orch.start(agent, '一个想法')
  const r = orch.advance(agent)
  assert.equal(r.advanced, false)
  assert.ok(r.missing.length > 0)
  await orch.stop(agent)
})

test('gates：decide → adr → prd 逐段推进（回归：evalGate 曾漏 adr case 卡死在 adr）', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-gate-adr-'))
  mkdirSync(join(root, 'docs', 'adr'), { recursive: true })
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  orch.start(agent, '一个想法')
  assert.equal(orch.status(agent).stage, 'decide')

  // ADR 必须在 run 开始后落盘——adrGate 以 run.createdAt 为下界筛「本次新建」，
  // 先写后 start 会因 mtime < createdAt 被判成旧文件（同毫秒才侥幸通过，是测试夹具的脆弱点）
  writeFileSync(join(root, 'docs', 'adr', '0112-x.md'), '# ADR-0112 · x\n\n## 背景\nx\n\n## 决策\ny\n')

  const a1 = orch.advance(agent) // decide：adrGate 验 ADR → adr
  assert.equal(a1.advanced, true)
  assert.equal(a1.stage, 'adr')

  const a2 = orch.advance(agent) // adr：幂等复验 ADR → prd（修复前这里报「未知阶段 adr」）
  assert.equal(a2.advanced, true)
  assert.equal(a2.stage, 'prd')
  assert.ok(a2.hint && a2.hint.includes('PRD'), 'prd 段应下发提示词')
})
