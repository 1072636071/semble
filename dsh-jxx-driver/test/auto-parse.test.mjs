/**
 * auto 参数解析（ADR-0118 重写）：只做**显式指定**的确定性匹配——
 * 纯编号（`94` / 补零 `094`）或功能目录名（`94-jxx-driver-plugin`）。
 * 撤除面（钉死为回归）：标题/slug 子串模糊匹配、CANDIDATES 候选清单、PRD 全量扫描。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'
import { findFeatureDir } from '../src/cards.mjs'

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
  const agent = {
    id: 'sess-auto',
    session: { id: 'sess-auto', header: { cwd: root } },
    followups: [],
    followup(msg) { this.followups.push(msg) },
    steer(msg) { this.steered.push(msg) },
    steered: [],
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

test('findFeatureDir：编号精确命中（含补零形态）', () => {
  const root = mkRepo()
  assert.ok(findFeatureDir(root, '94').includes('94-'))
  assert.ok(findFeatureDir(root, '094').includes('94-'), '补零形态也应命中')
  assert.ok(findFeatureDir(root, '93').includes('93-'))
})

test('findFeatureDir：功能目录名精确命中；子串/标题/自然语言一律不命中（ADR-0118 撤除模糊匹配）', () => {
  const root = mkRepo()
  assert.ok(findFeatureDir(root, '94-jxx-driver-plugin').includes('94-'))
  assert.equal(findFeatureDir(root, 'four-panels'), undefined, 'slug 子串不再命中')
  assert.equal(findFeatureDir(root, '编排插件'), undefined, '标题关键词不再命中')
  assert.equal(findFeatureDir(root, '完成这些优化'), undefined, '自然语言不再命中')
  assert.equal(findFeatureDir(root, '95'), undefined, '不存在的编号不命中')
  assert.equal(findFeatureDir(root, ''), undefined)
})

test('findFeatureDir：无 PRD.md 的编号目录不算 PRD', () => {
  const root = mkRepo()
  mkdirSync(join(root, '.scratch', '92-no-prd-file'), { recursive: true })
  assert.equal(findFeatureDir(root, '92'), undefined)
})

test('auto：编号显式指定 → 直进 implement', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const run = await orch.auto(agent, '094')
  assert.ok(run.featureDir.includes('94-'))
  await orch.stop(agent)
})

test('auto：功能目录名显式指定 → 直进 implement', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })
  const run = await orch.auto(agent, '93-four-panels-independent-status')
  assert.ok(run.featureDir.includes('93-'))
  await orch.stop(agent)
})

test('auto：匹配不上 / 空参 → 响亮报错且不列候选、不落 run（ADR-0118 D1）', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  // 空参：说清要什么形态，不给清单
  await assert.rejects(() => orch.auto(agent, ''), (e) => {
    assert.equal(e.code, undefined, '不再有 CANDIDATES 错误码')
    assert.equal(e.prds, undefined, '异常不带候选清单')
    assert.match(e.message, /需要显式指定 PRD/)
    assert.doesNotMatch(e.message, /PRD 9[34] ·/, '不列 PRD 候选')
    return true
  })

  // 自然语言 / 不存在的编号：报错说清形态，且不列候选
  for (const bad of ['完成这些优化', '95', 'four-panels']) {
    await assert.rejects(() => orch.auto(agent, bad), (e) => {
      assert.equal(e.code, undefined)
      assert.equal(e.prds, undefined)
      assert.match(e.message, /找不到 PRD/)
      assert.doesNotMatch(e.message, /就绪工单/, '不渲染候选清单')
      return true
    })
  }

  assert.equal(orch.status(agent).active, false, '失败后不应残留 run')
})
