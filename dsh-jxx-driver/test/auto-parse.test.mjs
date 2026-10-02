/** auto 参数解析：编号精确 / slug 唯一命中 / 多候选 / 自然语言意图返回候选清单。 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'
import { listPrds } from '../src/cards.mjs'

const BOARD = process.env.JXX_BOARD
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')

function mkRepo() {
  const root = mkdtempSync(join(tmpdir(), 'jxx-auto-parse-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  for (const [num, slug, title] of [
    ['94', 'jxx-driver-plugin', '# PRD 94 · jxx-driver 编排插件'],
    ['93', 'four-panels-independent-status', '# PRD 93 · 四面板独立状态'],
  ]) {
    const dir = join(root, '.scratch', `${num}-${slug}`)
    mkdirSync(join(dir, 'issues'), { recursive: true })
    writeFileSync(join(dir, 'PRD.md'), `${title}\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n`)
    writeFileSync(join(dir, 'issues', '01-x.md'), `# ${slug}\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n`)
  }
  return root
}

function mkCtx(root) {
  const steered = []
  const agent = {
    id: 'sess-auto',
    session: { id: 'sess-auto', header: { cwd: root } },
    followups: [],
    followup(msg) { this.followups.push(msg) },
    steer(msg) { this.steered.push(msg) },
    steered,
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

test('listPrds 读出编号/标题/就绪数', () => {
  const root = mkRepo()
  const prds = listPrds(root)
  assert.equal(prds.length, 2)
  assert.ok(prds.find((p) => p.num === '94' && p.ready === 1 && p.total === 1))
})

test('auto：编号精确命中（含补零形态）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const run = await orch.auto(agent, '094') // 补零形态也应命中 94
  assert.ok(run.featureDir.includes('94-'))
  await orch.stop(agent)
})

test('auto：slug 关键词唯一命中', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const run = await orch.auto(agent, 'four-panels')
  assert.ok(run.featureDir.includes('93-'))
  await orch.stop(agent)
})

test('auto：自然语言意图 → CANDIDATES 异常带全量清单，不落 run', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  await assert.rejects(
    () => orch.auto(agent, '完成这些优化'),
    (e) => {
      assert.equal(e.code, 'CANDIDATES')
      assert.equal(e.prds.length, 2)
      assert.match(e.message, /当前可选/)
      return true
    },
  )
  assert.equal(orch.status(agent).active, false, '失败后不应残留 run')
})

test('auto：空参数 → CANDIDATES；多关键词多命中 → 只列命中项', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  await assert.rejects(() => orch.auto(agent, ''), (e) => e.code === 'CANDIDATES' && e.prds.length === 2)
  await assert.rejects(
    () => orch.auto(agent, 'PRD'), // 两份标题都含 "PRD" → 多命中
    (e) => e.code === 'CANDIDATES' && e.prds.length === 2 && /请指定编号/.test(e.message),
  )
})
