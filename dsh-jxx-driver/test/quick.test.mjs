/** quick 快车道：临时问题 → 散工单（无 PRD）→ 编排接管。 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, renameSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'
import { createQuickTicket, slugify, nextTopicNum } from '../src/quick.mjs'

const BOARD = process.env.JXX_BOARD
  || join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')

function mkRepo() {
  const root = mkdtempSync(join(tmpdir(), 'jxx-quick-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  return root
}

function mkCtx(root) {
  const agent = {
    id: 'sess-quick',
    session: { id: 'sess-quick', header: { cwd: root } },
    followups: [],
    followup(msg) { this.followups.push(msg) },
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

test('slugify：ASCII kebab / 中文回落 quick', () => {
  assert.equal(slugify('Fix 409 Error on Drag'), 'fix-409-error-on-drag')
  assert.equal(slugify('修一个中文问题'), 'quick')
  assert.equal(slugify('ab'), 'quick')
})

test('createQuickTicket：目录/文件/契约形态/编号自增', () => {
  const root = mkRepo()
  assert.equal(nextTopicNum(root), 1)
  const t1 = createQuickTicket(root, '拖卡时 409 报错，应该串行化', 'drag-409')
  assert.ok(t1.featureDir.includes('-drag-409'))
  assert.equal(t1.cardId, '01-01-drag-409', '卡 id = 补零目录号 + 工单基名（与 ticketCardId 同构）')
  const body = readFileSync(t1.ticketFile, 'utf8')
  assert.match(body, /\*\*Status:\*\* ready-for-agent/)
  assert.match(body, /\*\*Blocked by:\*\* 无——可立即开始/)
  assert.match(body, /## 评论/)
  assert.doesNotMatch(body, /# PRD /)
  assert.equal(nextTopicNum(root) > 1, true)
  const t2 = createQuickTicket(root, '另一个小问题')
  assert.notEqual(t1.featureDir, t2.featureDir, '编号自增不撞目录')
})

test('E2E：quick 一张散工单走完 看板流水线 → ops', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  const { run, ticket } = await orch.quick(agent, '侧栏数字不对，应该是 3', 'sidebar-count')
  assert.equal(run.stage, 'implement')
  assert.ok(existsSync(ticket.ticketFile))

  await new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (orch.status(agent).stage === 'ops') { clearInterval(timer); resolve() }
      else if (Date.now() - start > 30_000) { clearInterval(timer); reject(new Error('waitFor 超时')) }
    }, 50)
  })

  // 散工单走到 done
  const doneDir = join(root, 'control', 'cards', 'done')
  const doneNames = readdirSync(doneDir)
  assert.ok(doneNames.some((n) => n.endsWith('01-sidebar-count.md')), `done 里应有散工单卡：${doneNames.join(',')}`)
  assert.ok(doneNames.includes(`merge-${ticket.cardId}.md`), `合并卡应 done（merge-${ticket.cardId}），实际：${doneNames.join(',')}`)
})
