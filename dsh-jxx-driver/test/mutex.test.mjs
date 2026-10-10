/** 双编排器互斥（PRD 108 retro P0-2）：assertNoForeignRun / persist 落锁 / halt·failRun 摘锁。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { Orchestrator } = await import('../src/orchestrator.mjs')

function mkOrch() {
  const logs = []
  const orch = new Orchestrator({}, { parallel: 3, staleMinutes: 30, maxRetries: 1, pollIntervalMs: 50 }, {
    info: () => {}, warn: (m) => logs.push(m), error: () => {},
  })
  return { orch, logs }
}

function mkRoot(t) {
  const root = mkdtempSync(join(tmpdir(), 'jxx-mutex-'))
  t.after(() => {})
  mkdirSync(join(root, 'control', 'jxx-driver-runs'), { recursive: true })
  return root
}

function agentFor(root, sessionId) {
  return { session: { id: sessionId, header: { cwd: root } }, id: sessionId, steer: () => {} }
}

test('assertNoForeignRun：无锁目录 → 放行', (t) => {
  const { orch } = mkOrch()
  const root = mkRoot(t)
  orch.assertNoForeignRun(root, 'session-a') // 不抛即过
})

test('assertNoForeignRun：他方活跃锁 → 抛错且消息含 run id 与清理指引', (t) => {
  const { orch } = mkOrch()
  const root = mkRoot(t)
  // updatedAt 取「现在」：陈旧锁（>24h 未更新）被防御性放行（宿主崩溃残留），互斥闸只对活跃锁兑现
  const fresh = new Date().toISOString()
  writeFileSync(join(root, 'control', 'jxx-driver-runs', 'run-b.lock.json'), JSON.stringify({
    id: 'run-b', sessionId: 'session-b', stage: 'implement', startedAt: fresh, updatedAt: fresh,
  }))
  assert.throws(() => orch.assertNoForeignRun(root, 'session-a'), (e) => {
    return /run-b/.test(e.message) && /lock\.json/.test(e.message) && /互踩/.test(e.message)
  })
})

test('assertNoForeignRun：本会话自己的锁 → 放行（同会话重启场景）', (t) => {
  const { orch } = mkOrch()
  const root = mkRoot(t)
  writeFileSync(join(root, 'control', 'jxx-driver-runs', 'run-a.lock.json'), JSON.stringify({
    id: 'run-a', sessionId: 'session-a', stage: 'implement', updatedAt: '2026-10-09T01:00:00Z',
  }))
  orch.assertNoForeignRun(root, 'session-a') // 不抛即过
})

test('assertNoForeignRun：陈旧锁（>24h 未更新）→ 放行 + warn', (t) => {
  const { orch, logs } = mkOrch()
  const root = mkRoot(t)
  const stale = new Date(Date.now() - 25 * 3600_000).toISOString()
  writeFileSync(join(root, 'control', 'jxx-driver-runs', 'run-dead.lock.json'), JSON.stringify({
    id: 'run-dead', sessionId: 'session-dead', stage: 'implement', startedAt: stale, updatedAt: stale,
  }))
  orch.assertNoForeignRun(root, 'session-a') // 不抛即过
  assert.ok(logs.some((m) => /陈旧互斥锁/.test(m)), 'warn 应点名陈旧锁')
})

test('assertNoForeignRun：坏 JSON 锁文件 → 放行（不因残留损坏文件堵死启动）', (t) => {
  const { orch } = mkOrch()
  const root = mkRoot(t)
  writeFileSync(join(root, 'control', 'jxx-driver-runs', 'broken.lock.json'), '{not json')
  orch.assertNoForeignRun(root, 'session-a') // 不抛即过
})

// ---------- persist 落锁 / halt 摘锁 生命周期 ----------

function fakeAgent(root, sessionId) {
  return { session: { id: sessionId, header: { cwd: root } }, id: sessionId, steer: () => {}, dispose: async () => {} }
}

test('persist 落锁 → halt 摘锁（生命周期闭环）', async (t) => {
  const { orch } = mkOrch()
  const root = mkRoot(t)
  const agent = fakeAgent(root, 'session-a')
  // start 走 decide 阶段（不进 implement，避免 watcher 干扰）——手动造 run 面替代：
  const run = orch.newRun(agent, 'session-a', root, 'test', 'decide')
  orch.runs.set('session-a', run)
  orch.persist(run)
  const lockPath = join(root, 'control', 'jxx-driver-runs', `${run.id}.lock.json`)
  assert.ok(existsSync(lockPath), 'persist 后锁文件应在')
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  assert.equal(lock.sessionId, 'session-a')
  assert.equal(lock.stage, 'decide')
  await orch.halt(run, '测试收口')
  assert.ok(!existsSync(lockPath), 'halt 后锁文件应摘除')
  assert.ok(!orch.runs.has('session-a'))
})

test('failRun 摘锁（run 终结路径）', (t) => {
  const { orch } = mkOrch()
  const root = mkRoot(t)
  const agent = fakeAgent(root, 'session-a')
  const run = orch.newRun(agent, 'session-a', root, 'test', 'implement')
  run.featureDir = join(root, '.scratch', 'fake')
  orch.runs.set('session-a', run)
  orch.persist(run)
  orch.failRun(run, '测试失败终结')
  const lockPath = join(root, 'control', 'jxx-driver-runs', `${run.id}.lock.json`)
  assert.ok(!existsSync(lockPath), 'failRun 后锁文件应摘除')
})

test('start 遇他方活跃锁 → 响亮拒绝（互斥入口真闸）', async (t) => {
  const { orch } = mkOrch()
  const root = mkRoot(t)
  const fresh = new Date().toISOString()
  writeFileSync(join(root, 'control', 'jxx-driver-runs', 'run-b.lock.json'), JSON.stringify({
    id: 'run-b', sessionId: 'session-b', stage: 'implement', startedAt: fresh, updatedAt: fresh,
  }))
  assert.throws(() => orch.start(fakeAgent(root, 'session-a'), '测试想法'), /另一编排会话在跑/)
})
