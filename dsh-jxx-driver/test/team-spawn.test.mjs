/**
 * team-spawn 层单测（PRD 110 工单 01 / ADR-0121）：
 * 懒解析鸭子类型（缺服务/缺方法/缺 get → undefined 不抛）、名字池（递增/跳过/耗尽/角色校验）、
 * 复用预算（计数与 retire 边界=严格大于 reuseLimit）、SETTLED 机读行（多行命中/缺失 fail-closed）、
 * config 三新项（teamMode 枚举 / reuseLimit 下限 / teamProvider 非空）。
 * 红绿对照：删 team-spawn.mjs 名字池的 used.has 跳过逻辑 →「跳过已占用名」必红。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAgentTeams, createNamePool, createReuseLedger, parseSettled, isValidName } from '../src/team-spawn.mjs'
import { normalizeConfig } from '../src/config.mjs'

/** 造 mock agentTeams 服务：给哪些方法名就长哪些方法。 */
function mockTeams(methods = ['spawnTeammate', 'sendMessage', 'interrupt']) {
  const service = {}
  for (const m of methods) service[m] = async () => ({})
  return service
}

// ---- resolveAgentTeams：懒解析 + 鸭子类型校验 ----

test('懒解析：ctx.get 命中且三方法齐备 → 返回服务本体', () => {
  const teams = mockTeams()
  const ctx = { get: (key) => (key === 'agentTeams' ? teams : undefined) }
  assert.equal(resolveAgentTeams(ctx), teams)
})

test('懒解析：无 agentTeams 的 ctx（undefined/null/无 get）→ 返回 undefined 不抛', () => {
  assert.equal(resolveAgentTeams({ get: () => undefined }), undefined)
  assert.equal(resolveAgentTeams(undefined), undefined)
  assert.equal(resolveAgentTeams(null), undefined)
  assert.equal(resolveAgentTeams({}), undefined)
})

test('懒解析：get 抛异常 → 返回 undefined 不炸装载', () => {
  const ctx = { get: () => { throw new Error('服务未注册') } }
  assert.equal(resolveAgentTeams(ctx), undefined)
})

test('懒解析：服务缺任一方法（spawnTeammate/sendMessage/interrupt）→ undefined', () => {
  for (const missing of ['spawnTeammate', 'sendMessage', 'interrupt']) {
    const methods = ['spawnTeammate', 'sendMessage', 'interrupt'].filter((m) => m !== missing)
    const ctx = { get: () => mockTeams(methods) }
    assert.equal(resolveAgentTeams(ctx), undefined, `缺 ${missing} 时应判不兼容`)
  }
  // 服务为 null / 非对象同样 undefined
  assert.equal(resolveAgentTeams({ get: () => null }), undefined)
  assert.equal(resolveAgentTeams({ get: () => 42 }), undefined)
})

// ---- 名字池：递增、跳过、耗尽 ----

test('名字池：同角色字母递增（dev-a、dev-b…），生成名合法且不为 lead', () => {
  const pool = createNamePool({})
  const a = pool.next('dev')
  const b = pool.next('dev')
  const c = pool.next('dev')
  assert.deepEqual([a, b, c], ['dev-a', 'dev-b', 'dev-c'])
  for (const name of [a, b, c]) {
    assert.ok(isValidName(name), `${name} 应过 isValidName`)
    assert.notEqual(name, 'lead')
  }
})

test('名字池：taken/retired 里的名字永久跳过（被占用/重建过不复用）', () => {
  const pool = createNamePool({ taken: ['dev-a'], retired: ['dev-b'] })
  assert.equal(pool.next('dev'), 'dev-c')
  // 取出即占用：再次取继续递增，不回吐已发出的名字
  assert.equal(pool.next('dev'), 'dev-d')
})

test('名字池：跨角色互不干扰（dev 与 merger 各自从 a 起）', () => {
  const pool = createNamePool({})
  assert.equal(pool.next('dev'), 'dev-a')
  assert.equal(pool.next('merger'), 'merger-a')
})

test('名字池：单角色 26 个字母耗尽 → 响亮报错转人工', () => {
  const pool = createNamePool({})
  for (let i = 0; i < 26; i++) pool.next('dev')
  assert.throws(() => pool.next('dev'), /名字池耗尽/)
})

test('名字池：角色前缀非法 → 响亮报错（不产出违反命名规则的名字）', () => {
  assert.throws(() => createNamePool({}).next('Dev'), /角色前缀非法/)
  assert.throws(() => createNamePool({}).next(''), /角色前缀非法/)
  // 审查发现项回归：尾连字符角色会产出 dev--a 这类过不了 isValidName 的名字
  assert.throws(() => createNamePool({}).next('dev-'), /角色前缀非法/)
})

test('isValidName：lower-kebab-case、≤64、不得为 lead', () => {
  assert.equal(isValidName('dev-a'), true)
  assert.equal(isValidName('merger-abc'), true)
  assert.equal(isValidName('lead'), false)
  assert.equal(isValidName('Lead'), false)
  assert.equal(isValidName('dev-'), false)
  assert.equal(isValidName('-dev'), false)
  assert.equal(isValidName('dev_a'), false)
  assert.equal(isValidName(''), false)
  assert.equal(isValidName('a'.repeat(64)), true)
  assert.equal(isValidName('a'.repeat(65)), false)
})

// ---- 复用预算：计数与 retire 边界 ----

test('复用预算：完成任务数 ≤ reuseLimit 不退（边界=严格大于，恰好等于不退）', () => {
  const ledger = createReuseLedger({ reuseLimit: 2 })
  assert.equal(ledger.completedCount('dev-a'), 0)
  assert.deepEqual(ledger.maybeRetire('dev-a'), { retire: false })
  ledger.recordCompletion('dev-a')
  assert.deepEqual(ledger.maybeRetire('dev-a'), { retire: false })
  ledger.recordCompletion('dev-a')
  assert.equal(ledger.completedCount('dev-a'), 2)
  // 恰好等于 reuseLimit：不退
  assert.deepEqual(ledger.maybeRetire('dev-a'), { retire: false })
  // 第 3 次：严格大于 → retire
  ledger.recordCompletion('dev-a')
  assert.deepEqual(ledger.maybeRetire('dev-a'), { retire: true })
})

test('复用预算：每队友独立计数', () => {
  const ledger = createReuseLedger({ reuseLimit: 1 })
  ledger.recordCompletion('dev-a')
  ledger.recordCompletion('dev-a')
  ledger.recordCompletion('dev-b')
  assert.deepEqual(ledger.maybeRetire('dev-a'), { retire: true })
  assert.deepEqual(ledger.maybeRetire('dev-b'), { retire: false })
})

test('复用预算：reuseLimit 非法（0/非整数）→ 响亮报错', () => {
  assert.throws(() => createReuseLedger({ reuseLimit: 0 }), /reuseLimit/)
  assert.throws(() => createReuseLedger({ reuseLimit: 1.5 }), /reuseLimit/)
  assert.throws(() => createReuseLedger({}), /reuseLimit/)
})

// ---- parseSettled：机读行解析（fail-closed） ----

test('SETTLED 解析：多行正文里命中行首 SETTLED 行，返回卡 id', () => {
  const text = '审查发现项已修复，卡已交付。\n\nSETTLED: 110-01-team-spawn-module\n（完）'
  assert.equal(parseSettled(text), '110-01-team-spawn-module')
})

test('SETTLED 解析：容忍行尾 CRLF 与首尾空白', () => {
  assert.equal(parseSettled('done\r\nSETTLED: 110-02-team-worker-path\r\n'), '110-02-team-worker-path')
  assert.equal(parseSettled('SETTLED:   110-03-resilience  '), '110-03-resilience')
})

test('SETTLED 解析：无行首 SETTLED / 小写 / 非字符串 → fail-closed 返回 undefined', () => {
  // 行中间出现 SETTLED 字样不算（^ 在 /m 下锚定行首）
  assert.equal(parseSettled('xxx SETTLED: 110-01-team-spawn-module'), undefined)
  assert.equal(parseSettled('settled: 110-01-team-spawn-module'), undefined)
  assert.equal(parseSettled('普通完工汇报，没有机读行'), undefined)
  assert.equal(parseSettled(''), undefined)
  assert.equal(parseSettled(undefined), undefined)
  assert.equal(parseSettled(42), undefined)
  assert.equal(parseSettled(null), undefined)
})

test('SETTLED 解析：多行 SETTLED 取第一处（双路去重由编排层负责，本层只报第一个）', () => {
  const text = 'SETTLED: 110-01-team-spawn-module\nSETTLED: 110-02-team-worker-path'
  assert.equal(parseSettled(text), '110-01-team-spawn-module')
})

test('SETTLED 解析：冒号后同行无内容 → fail-closed 返回 undefined（不跨行吞下一行）', () => {
  // 审查发现项回归：\s* 跨行匹配会把下一行误当卡 id，修复后必须 undefined
  assert.equal(parseSettled('SETTLED:\n110-01-team-spawn-module'), undefined)
  assert.equal(parseSettled('SETTLED: \r\n110-01-team-spawn-module'), undefined)
  assert.equal(parseSettled('SETTLED:   '), undefined)
})

// ---- config 三新项：teamMode / reuseLimit / teamProvider ----

test('config：团队三新项默认值（teamMode=auto、reuseLimit=8、teamProvider=spawn）', () => {
  const config = normalizeConfig({})
  assert.equal(config.teamMode, 'auto')
  assert.equal(config.reuseLimit, 8)
  assert.equal(config.teamProvider, 'spawn')
})

test('config：teamMode 枚举校验（off 过；其余响亮报错）', () => {
  assert.equal(normalizeConfig({ teamMode: 'off' }).teamMode, 'off')
  assert.equal(normalizeConfig({ teamMode: 'auto' }).teamMode, 'auto')
  assert.throws(() => normalizeConfig({ teamMode: 'on' }), /teamMode/)
  assert.throws(() => normalizeConfig({ teamMode: true }), /teamMode/)
})

test('config：reuseLimit 校验（≥1 整数；0 与小数响亮报错）', () => {
  assert.equal(normalizeConfig({ reuseLimit: 1 }).reuseLimit, 1)
  assert.equal(normalizeConfig({ reuseLimit: 99 }).reuseLimit, 99)
  assert.throws(() => normalizeConfig({ reuseLimit: 0 }), /reuseLimit/)
  assert.throws(() => normalizeConfig({ reuseLimit: 2.5 }), /reuseLimit/)
})

test('config：teamProvider 非空字符串校验（空串响亮报错）', () => {
  assert.equal(normalizeConfig({ teamProvider: 'sonnet' }).teamProvider, 'sonnet')
  assert.throws(() => normalizeConfig({ teamProvider: '' }), /teamProvider/)
  assert.throws(() => normalizeConfig({ teamProvider: 42 }), /teamProvider/)
})
