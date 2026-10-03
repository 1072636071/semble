/** go 统一入口：分流材料 steer、track 直达、编号直通 auto、旧别名兼容。 */
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
  const root = mkdtempSync(join(tmpdir(), 'jxx-go-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', '96-go-prd', 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', '96-go-prd', 'PRD.md'),
    '# PRD 96 · go 测试\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n')
  writeFileSync(join(dir, '01-one.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
  return root
}

function mkCtx(root) {
  const steered = []
  const agent = {
    id: 'sess-go',
    session: { id: 'sess-go', header: { cwd: root } },
    followups: [], steered,
    followup(msg) { this.followups.push(msg) },
    steer(msg) { this.steered.push(msg) },
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    subagents: {
      start: async (_p, req) => {
        const dev = req.label.match(/^jxx-dev-(.+)$/)
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = req.label.match(/^jxx-merger-(.+)$/)
        const openDir = join(root, 'control', 'cards', 'open')
        if (dev) {
          const id = dev[1]
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'done' }] }), dispose: async () => {} }
        }
        if (rev) return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'VERDICT: PASS' }] }), dispose: async () => {} }
        if (mer) {
          const id = mer[1]
          renameSync(join(openDir, `merge-${id}.md`), join(root, 'control', 'cards', 'done', `merge-${id}.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'merged' }] }), dispose: async () => {} }
        }
        throw new Error(`未知角色 ${req.label}`)
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent }
}

const CONFIG = () => normalizeConfig({
  boardScript: BOARD, parallel: 3, staleMinutes: 30, maxRetries: 1, autoMerge: true, pollIntervalMs: 50,
})

// 与 index.mjs 的 dispatch 等价路径——直接驱动 Orchestrator + go 分流材料逻辑在 index 内，
// 这里通过「index 的行为契约」测试：由 index.mjs 的 apply 装配的完整面太重（需要 tools registry），
// 故对 go 的三条机械路径做编排层等价验证 + 对 steer 材料做内容断言（复制 index 内联逻辑最小化）。

test('go：裸意图（无 track）→ pending-model-triage + steer 分流材料（ADR-0118：不含既有 PRD 清单）', async (t) => {
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  // 无 track 时 orch 未被启动（无 run）——go 不越权替模型拍板。
  assert.equal(orch.status(agent).active, false)

  // 经真实 apply() 走 go 分流面：断言 steer 只给三条轨道 + 显式编号提示，**不给既有 PRD 清单**。
  const mod = await import('../src/index.mjs')
  let tool
  const mountCtx = {
    logger: { info() {}, warn() {}, error() {} },
    on() {},
    effect(fn) { fn() },
    get() { return undefined },
    tools: { register(t) { tool = t } },
    systemPrompt: { context() {} },
    subagents: { start: async () => { throw new Error('不该 spawn') } },
    agents: { get: () => undefined },
  }
  mod.apply(mountCtx, { autoConfirm: true, verbose: false, pollIntervalMs: 50 })
  const steered = []
  const triAgent = {
    id: 'sess-triage', session: { id: 'sess-triage', header: { cwd: root } },
    steer(m) { steered.push(m.content[0].text) }, followup() {},
  }
  const triage = await tool.execute({ action: 'go', idea: '做点东西' }, { agent: triAgent })

  assert.equal(triage.routed, 'pending-model-triage')
  assert.equal(triage.prds, undefined, '返回值不再带既有 PRD 清单（ADR-0118）')
  assert.equal(steered.length, 1)
  assert.doesNotMatch(steered[0], /既有 PRD[：:]/, 'steer 不再列既有 PRD 清单')
  assert.doesNotMatch(steered[0], /就绪工单/, 'steer 不渲染候选清单')
  assert.match(steered[0], /track="quick"/)
  assert.match(steered[0], /track="standard"/)
  assert.match(steered[0], /track="deep"/)
  // 工具描述同样不得再宣称「输入指向既有 PRD → 自动编排」这类推荐
  assert.doesNotMatch(tool.description, /输入指向既有 PRD/)
})

test('go(track="quick")：直达散工单流水线', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const { run } = await orch.quick(agent, '侧栏计数错了', 'sidebar-count')
  assert.equal(run.stage, 'implement')
  await orch.stop(agent)
})

test('go(track="standard")：进 decide 阶段链', async (t) => {
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  orch.start(agent, '做一个新模块')
  const st = orch.status(agent)
  assert.equal(st.stage, 'decide')
  await orch.stop(agent)
})

test('go(track="auto")/纯编号：直达 PRD 编排（E2E 到 ops）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const run = await orch.auto(agent, '96')
  assert.equal(run.stage, 'implement')
  await new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (orch.status(agent).stage === 'ops') { clearInterval(timer); resolve() }
      else if (Date.now() - start > 30_000) { clearInterval(timer); reject(new Error('waitFor 超时')) }
    }, 50)
  })
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', '96-01-one.md')))
})
