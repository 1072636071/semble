/**
 * team-spawn 层单测（PRD 110 工单 01+02 / ADR-0121）：
 * 懒解析鸭子类型（缺服务/缺方法/缺 get → undefined 不抛）、名字池（递增/跳过/耗尽/角色校验）、
 * 复用预算（计数与 retire 边界=严格大于 reuseLimit）、SETTLED 机读行（多行命中/缺失 fail-closed）、
 * config 三新项（teamMode 枚举 / reuseLimit 下限 / teamProvider 非空）、
 * 团队通道（工单 02：spawn 首建 + sendMessage 复用 + 超预算停发换新名 + SETTLED 收割去重）。
 * 红绿对照：删 team-spawn.mjs 名字池的 used.has 跳过逻辑 →「跳过已占用名」必红。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAgentTeams, createNamePool, createReuseLedger, createTeamChannel, parseSettled, isValidName } from '../src/team-spawn.mjs'
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

// ---- 团队通道（工单 02）：指令下发 + SETTLED 收割 + 预算退役 ----

/** 记录调用面调用的 mock agentTeams 服务（spawnTeammate 返回即建；sendMessage 即投）。 */
function mockTeamsChannel() {
  const calls = { spawned: [], sent: [] }
  return {
    calls,
    service: {
      async spawnTeammate(caller, req) { calls.spawned.push({ caller, req }); return { member: { name: req.name } } },
      async sendMessage(caller, req) { calls.sent.push({ caller, req }); return { messageId: 'm1', status: 'accepted' } },
      async interrupt() { return { previousStatus: 'inactive' } },
    },
  }
}

function mkChannel(teams, { reuseLimit = 8 } = {}) {
  const logs = []
  return {
    logs,
    channel: createTeamChannel({
      teams,
      agent: { id: 'lead-1' },
      pool: createNamePool({}),
      ledger: createReuseLedger({ reuseLimit }),
      provider: 'spawn',
      log: (m) => logs.push(m),
    }),
  }
}

test('通道：首次 dispatch 走 spawnTeammate（context=fresh、provider 透传、名池取名）', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  const r = await channel.dispatch({ role: 'dev', cardId: '110-02-team-worker-path', prompt: '首条指令', signal: undefined })
  assert.equal(r.fresh, true)
  assert.equal(r.name, 'dev-a')
  assert.equal(calls.spawned.length, 1)
  const req = calls.spawned[0].req
  assert.equal(req.name, 'dev-a')
  assert.equal(req.context, 'fresh')
  assert.equal(req.provider, 'spawn')
  assert.equal(req.prompt[0].text, '首条指令')
  assert.ok(req.description.includes('110-02-team-worker-path'), 'description 默认带卡 id')
  assert.equal(calls.sent.length, 0)
})

test('通道：同角色二次 dispatch 走 sendMessage 复用（不重开队友）', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: '第一轮' })
  const r = await channel.dispatch({ role: 'dev', cardId: 'a2', prompt: '第二轮' })
  assert.equal(r.fresh, false)
  assert.equal(r.name, 'dev-a')
  assert.equal(calls.spawned.length, 1, '仍只有一次 spawnTeammate')
  assert.equal(calls.sent.length, 1)
  assert.equal(calls.sent[0].req.target, 'dev-a')
  assert.equal(calls.sent[0].req.content[0].text, '第二轮')
  // 结构化复面（修「领导者重复创建子代理」）：复用返回 memberName + keep=true，卡→成员登记可回查
  assert.equal(r.memberName, 'dev-a', '复用返回 memberName（结构化登记面）')
  assert.equal(r.keep, true, '复用返回 keep=true（不重建信号）')
  assert.equal(channel.memberOf('a2'), 'dev-a', 'memberOf 按卡回查承接队友')
  assert.equal(channel.memberOf('a1'), 'dev-a', '首建卡的成员登记同样在册')
})

test('通道：同名复用不新建（同卡重派只 sendMessage，spawnTeammate 恰好一次）', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  const first = await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: '首派' })
  assert.equal(first.fresh, true)
  // 同一卡重派（返工/重试场景）：点名 first.memberName → 必须复用，绝不新建。
  // 合并注（111 冲突收口）：远端 PRD 111 工单 05 在飞闸（a5b7ef92..4f98bae3，时间上早于本地本测试）
  // 规定「同卡在飞 + 非 resend 重投」非法；其闸测试原话「resend 不受在飞闸限制（走同名 sendMessage）」
  // ——显式点名重派走 resend 协议即为双方共识的合法路径，重派复用语义零改变（下方断言逐字保留）。
  const again = await channel.dispatch({ role: 'dev', name: first.memberName, cardId: 'a1', prompt: '重派续推', resend: true })
  assert.equal(again.fresh, false, '同名复用 fresh=false')
  assert.equal(again.keep, true, '同名复用 keep=true')
  assert.equal(again.memberName, first.memberName, '承接队友不变')
  assert.equal(calls.spawned.length, 1, '同名复用不新建：spawnTeammate 全程恰好一次')
  assert.equal(calls.sent.length, 1, '续推走 sendMessage')
  assert.equal(calls.sent[0].req.target, first.memberName)
})

test('通道：在飞闸×同名复用共存（合并 111-05）：同卡在飞非 resend 重投响亮拒绝，点名重派走 resend 复用不新建', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: '首派' })
  // 在飞闸面（工单 05 语义，与 dispatch-notify-idempotency 闸测试同口径）：非 resend 重投必须拒绝
  await assert.rejects(
    () => channel.dispatch({ role: 'dev', cardId: 'a1', prompt: '重投' }),
    /已有在飞轮次.*拒绝重复派发/,
    '同卡非 resend 重投必须响亮抛错（不静默吞）',
  )
  assert.equal(calls.sent.length, 0, '被拒的重投不得下发到信箱')
  // 复用面（可续接化 5ad27d10 语义）：合法重派 = 显式点名在册队友 + resend → 只 sendMessage 不新建
  const again = await channel.dispatch({ role: 'dev', name: channel.nameOf('a1'), cardId: 'a1', prompt: '重派续推', resend: true })
  assert.equal(again.fresh, false, 'resend 点名重派 fresh=false')
  assert.equal(again.keep, true, 'resend 点名重派 keep=true')
  assert.equal(again.memberName, channel.nameOf('a1'), '承接队友不变')
  assert.equal(calls.spawned.length, 1, '重派不新建：spawnTeammate 全程恰好一次')
  assert.equal(calls.sent.length, 1, '重派走 sendMessage')
  assert.equal(calls.sent[0].req.target, channel.nameOf('a1'))
})

test('通道：memberOf 出册不删（harvest 后仍按名可续接）+ members 簿记观测面', async () => {
  const { service } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p' })
  const cards = new Map([['a1', { phase: 'claimed', alive: true }]])
  const h = channel.harvest({ canSettle: () => true, onSettledFor: () => () => {}, persist: () => {} })
  h('SETTLED: a1')
  assert.equal(channel.nameOf('a1'), 'dev-a', 'cardOwners 保留（重发/兜底定位口径，既有语义）')
  assert.equal(channel.memberOf('a1'), 'dev-a', '结构化成员登记同样在册——续接语义的簿记基础')
  assert.deepEqual(channel.members(), [{ name: 'dev-a', role: 'dev', completed: 1 }])
})

test('通道：merger 与 dev 各自独立名池（角色前缀区分）', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  const w = await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p' })
  const m = await channel.dispatch({ role: 'merger', cardId: 'merge-a1', prompt: 'p' })
  assert.equal(w.name, 'dev-a')
  assert.equal(m.name, 'merger-a')
})

test('通道：点名队友不在册（历史名册）→ 按新名建 fresh 后继，不用失效名', async () => {
  const { service, calls } = mockTeamsChannel()
  const pool = createNamePool({ taken: ['dev-a'] }) // dev-a 已被本 run 之外的过往占用
  const channel = createTeamChannel({
    teams: service, agent: { id: 'lead-1' }, pool, ledger: createReuseLedger({ reuseLimit: 8 }),
  })
  const r = await channel.dispatch({ role: 'dev', name: 'dev-a', cardId: 'a1', prompt: 'p' })
  assert.equal(r.fresh, true)
  assert.notEqual(r.name, 'dev-a')
  assert.equal(calls.spawned[0].req.name, r.name)
})

test('通道：同名队友超预算 → 停发退役 + 换新名 fresh 后继（名字不复用）', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service, { reuseLimit: 1 })
  await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p' })
  await channel.dispatch({ role: 'dev', cardId: 'a2', prompt: 'p' }) // 复用 dev-a（计 1 ≤ 1，不退）
  // 记满预算：completed=2 > reuseLimit=1（两卡都经通道派发，harvest 各计一次）
  const cards = new Map([['a1', { phase: 'claimed', alive: true }], ['a2', { phase: 'claimed', alive: true }]])
  const h = channel.harvest({ canSettle: (id) => cards.get(id)?.phase === 'claimed' && cards.get(id).alive !== false, onSettledFor: () => () => {}, persist: () => {} })
  h('SETTLED: a1')
  h('SETTLED: a2')
  const r = await channel.dispatch({ role: 'dev', cardId: 'a3', prompt: '第三轮' })
  assert.equal(r.retired, 1)
  assert.equal(r.fresh, true)
  assert.equal(r.name, 'dev-b')
  assert.equal(calls.spawned.length, 2)
  assert.equal(calls.spawned[1].req.name, 'dev-b')
  assert.equal(channel.stats().retiredTotal, 1)
  // 退役名不再接活：后续派发不会回到 dev-a
  const r2 = await channel.dispatch({ role: 'dev', cardId: 'a4', prompt: 'p' })
  assert.equal(r2.name, 'dev-b')
})

test('通道：未超预算不退（复用继续）——retire 边界在通道层同样成立', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service, { reuseLimit: 3 })
  await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p' })
  const cards = new Map([['a1', { phase: 'claimed', alive: true }], ['a2', { phase: 'claimed', alive: true }], ['a3', { phase: 'claimed', alive: true }]])
  const h = channel.harvest({ canSettle: (id) => cards.get(id)?.phase === 'claimed' && cards.get(id).alive !== false, onSettledFor: () => () => {}, persist: () => {} })
  h('SETTLED: a1')
  h('SETTLED: a2')
  h('SETTLED: a3')
  const r = await channel.dispatch({ role: 'dev', cardId: 'a4', prompt: 'p' })
  assert.equal(r.retired, 0)
  assert.equal(r.fresh, false, '恰好等于 reuseLimit 不退役（严格大于语义）')
  assert.equal(r.name, 'dev-a')
  assert.equal(calls.spawned.length, 1)
})

test('通道：harvest 命中卡在办 → onSettledFor 回调 + 计预算 + persist，返回卡 id', async () => {
  const { service } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p' })
  const settled = []
  const cards = new Map([['a1', { phase: 'claimed', alive: true }]])
  const h = channel.harvest({
    canSettle: (id) => cards.get(id)?.phase === 'claimed' && cards.get(id).alive !== false,
    onSettledFor: (cardId) => (text, err) => settled.push([cardId, text, err]),
    persist: () => {},
  })
  const got = h('已交付。\nSETTLED: a1')
  assert.equal(got, 'a1')
  assert.deepEqual(settled, [['a1', '已交付。\nSETTLED: a1', undefined]])
  // 卡状态归编排层（onSettledFor 内清 alive）；通道只管计量与出册
  assert.equal(cards.get('a1').alive, true)
  assert.equal(channel.nameOf('a1'), 'dev-a')
  assert.equal(channel.list()[0].completed, 1)
})

test('通道：harvest 对非在办卡幂等（重复/迟到消息不二次收口——双路去重的第二路闸门）', async () => {
  const { service } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p' })
  let calls = 0
  const cards = new Map([['a1', { phase: 'reviewing', alive: false }]]) // 已被卡位路推进
  const h = channel.harvest({ canSettle: () => false, onSettledFor: () => () => { calls += 1 }, persist: () => {} })
  assert.equal(h('SETTLED: a1'), undefined)
  assert.equal(calls, 0)
  assert.equal(h('普通消息无机读行'), undefined)
  assert.equal(h(42), undefined)
  assert.equal(h(undefined), undefined)
})

test('通道：harvest 回调抛异常不外泄（收割不炸监听面）', async () => {
  const { service } = mockTeamsChannel()
  const { channel, logs } = mkChannel(service)
  await channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p' })
  const cards = new Map([['a1', { phase: 'claimed', alive: true }]])
  const h = channel.harvest({ canSettle: () => true, onSettledFor: () => () => { throw new Error('boom') }, persist: () => {} })
  assert.equal(h('SETTLED: a1'), 'a1')
  assert.ok(logs.some((l) => l.includes('onSettled 异常')))
})

test('通道：构造缺件（无服务/无 agent/无名池/无账本）→ 响亮报错', () => {
  const { service } = mockTeamsChannel()
  assert.throws(() => createTeamChannel({}), /agentTeams/)
  assert.throws(() => createTeamChannel({ teams: service }), /Lead agent/)
  assert.throws(() => createTeamChannel({ teams: service, agent: { id: 'x' } }), /名字池/)
  assert.throws(() => createTeamChannel({ teams: service, agent: { id: 'x' }, pool: createNamePool({}) }), /预算账本/)
})

test('通道：worker 池语义——并发卡各占一个队友（roleCount < poolSize 取新名），不全员压一人', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  const p1 = channel.dispatch({ role: 'dev', cardId: 'a1', prompt: 'p', poolSize: 3 })
  const p2 = channel.dispatch({ role: 'dev', cardId: 'a2', prompt: 'p', poolSize: 3 })
  const [r1, r2] = await Promise.all([p1, p2])
  assert.notEqual(r1.name, r2.name, '并发两卡应各得一个队友（池=3）')
  assert.equal(calls.spawned.length, 2)
  // 第三卡：池未满继续取新名
  const r3 = await channel.dispatch({ role: 'dev', cardId: 'a3', prompt: 'p', poolSize: 3 })
  assert.equal(calls.spawned.length, 3)
  // 第四卡：池满且全员忙 → 取在飞最少者复用（不超池）
  const r4 = await channel.dispatch({ role: 'dev', cardId: 'a4', prompt: 'p', poolSize: 3 })
  assert.equal(calls.spawned.length, 3, '池满不再 spawn')
  assert.equal(r4.fresh, false)
  // 完工出册后释放队友：a1 settle → 其队友空闲，下一卡复用该空闲者
  const h = channel.harvest({ canSettle: () => true, onSettledFor: () => () => {}, persist: () => {} })
  h('SETTLED: a1')
  const r5 = await channel.dispatch({ role: 'dev', cardId: 'a5', prompt: 'p', poolSize: 3 })
  assert.equal(r5.fresh, false, '空闲队友优先复用，不再新建')
  assert.equal(channel.nameOf('a5'), channel.nameOf('a1'))
})

test('通道：poolSize 非法（0/小数）→ 响亮报错', async () => {
  const { service } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  await assert.rejects(() => channel.dispatch({ role: 'dev', cardId: 'x', prompt: 'p', poolSize: 0 }), /poolSize/)
  await assert.rejects(() => channel.dispatch({ role: 'dev', cardId: 'x', prompt: 'p', poolSize: 1.5 }), /poolSize/)
})

test('通道：merger 不受池影响（默认 poolSize=1，同名串行复用）', async () => {
  const { service, calls } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  await channel.dispatch({ role: 'merger', cardId: 'merge-a1', prompt: 'p' })
  await channel.dispatch({ role: 'merger', cardId: 'merge-a2', prompt: 'p' })
  assert.equal(calls.spawned.length, 1, 'merger 池=1：第二张合并卡复用同一队友')
  assert.equal(calls.sent.length, 1)
})

test('通道：harvest 缺 canSettle → 响亮报错（闸必须由编排层显式注入）', async () => {
  const { service } = mockTeamsChannel()
  const { channel } = mkChannel(service)
  assert.throws(() => channel.harvest({ onSettledFor: () => () => {} }), /canSettle/)
})

test('通道：prompt 逐字节确认——workerPrompt 带 member 才有 SETTLED 尾注，一次性路径不变', async () => {
  // 经 orchestrator 的接线断言放 E2E；此处只锁 prompts 纯函数
  const { workerPrompt, mergerPrompt } = await import('../src/prompts.mjs')
  const withMember = workerPrompt('E:\\r', '110-02-team-worker-path', { member: true })
  const without = workerPrompt('E:\\r', '110-02-team-worker-path')
  assert.match(withMember, /SETTLED: 110-02-team-worker-path/)
  assert.equal(without, workerPrompt('E:\\r', '110-02-team-worker-path'), '无 member 与默认一致')
  assert.ok(!without.includes('SETTLED:'), '一次性路径不带 SETTLED 尾注（现行为逐字节不变）')
  const mergerMember = mergerPrompt('E:\\r', 'merge-x', 'x', { member: true })
  assert.match(mergerMember, /SETTLED: merge-x/)
  assert.ok(!mergerPrompt('E:\\r', 'merge-x', 'x').includes('SETTLED:'))
})
