/**
 * 接待会话角色锁定（ADR-0115 D1）：执行 jxx 插件命令的会话 = 编排接待台。
 * 锁两处：① SESSION_ROLE 常量四要素齐备；② 经真实 apply() 装配后，
 * 工具描述 / go 分流 steer / 轨道 hint 都带角色锁定话术（autoConfirm 两档同此——角色不随免确认开关漂移）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SESSION_ROLE } from '../src/orchestrator.mjs'

test('SESSION_ROLE：接待台四要素齐备（不做任务/理解需求/等用户指令/只监控）', () => {
  assert.match(SESSION_ROLE, /编排接待台/)
  assert.match(SESSION_ROLE, /不做任务/)
  assert.match(SESSION_ROLE, /理解用户需求/)
  assert.match(SESSION_ROLE, /等用户指令/)
  assert.match(SESSION_ROLE, /只监控/)
})

test('E2E：工具描述与 go steer 注入角色锁定（autoConfirm 两档都有）；decide 两档都交互', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-role-'))
  const mod = await import('../src/index.mjs')

  for (const autoConfirm of [true, false]) {
    let tool
    const ctx = {
      logger: { info() {}, warn() {}, error() {} },
      on() {},
      effect(fn) { fn() },
      get() { return undefined },
      tools: { register(t) { tool = t } },
      systemPrompt: { context() {} },
      subagents: { start: async () => { throw new Error('本测试不该 spawn') } },
      agents: { get: () => undefined },
    }
    mod.apply(ctx, { autoConfirm, verbose: false, pollIntervalMs: 50 })

    // ① 工具描述带角色锁定
    assert.match(tool.description, /编排接待台/, `autoConfirm=${autoConfirm} 工具描述应带接待台角色`)
    assert.match(tool.description, /不做任务/)

    const steered = []
    const agent = {
      id: `sess-role-${autoConfirm}`,
      session: { id: `sess-role-${autoConfirm}`, header: { cwd: root } },
      steer(m) { steered.push(m.content[0].text) },
      followup() {},
    }

    // ② go 分流 steer 带角色锁定
    await tool.execute({ action: 'go', idea: '做点东西' }, { agent })
    assert.equal(steered.length, 1, 'go 无 track 应 steer 一条分流材料')
    assert.match(steered[0], /编排接待台/)

    // ③ standard 轨道的 decide hint 两档都是交互式（ADR-0115：决策不自动拍板）
    const std = await tool.execute({ action: 'go', track: 'standard', idea: '做点东西' }, { agent })
    if (autoConfirm) {
      assert.match(std.hint, /用户确认/, 'autoConfirm=true 的 decide 也必须等用户确认')
      assert.doesNotMatch(std.hint, /自行按推荐把决策定稿/, '不得再宣称决策自动拍板')
    } else {
      assert.match(std.hint, /grill/)
    }
    await tool.execute({ action: 'stop' }, { agent })
  }
})
