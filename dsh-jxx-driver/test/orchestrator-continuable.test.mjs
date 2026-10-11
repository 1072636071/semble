/**
 * 可续接子代理面（修「领导者误以为子代理可交互 → 每次发消息就重复创建子代理」）：
 *  - 句柄持久化：spawn 登记 run.subagents（key=role:cardId → childId）+ 卡账 subagentId 镜像 + persist 落盘；
 *  - 二次调用复用：同 role/card 再 spawn 不再 start，改 sendMessage 续推，回调刷新到本轮接线；
 *  - 结算收割：宿主 subagent-settled 结算通知按 childId 反查 → 该轮 onSettled 收口（alive 清位语义不变），
 *    结算即出册（run.subagents 摘 key + subagentId 镜像清位）——结算后重派同卡走新 spawn，不续推旧 child；
 *  - 无 continuable API 的宿主回退一次性 start()（旧语义）；
 *  - 防重复纪律注入：SESSION_ROLE 四要素 + ⑤⑦续接纪律（四注入面同一常量）+ starter 无「拉起新会话」暗示。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Orchestrator, SESSION_ROLE } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** continuable stub：startContinuable 即受理（返回稳定 childId），settle 通知由测试显式投递。 */
function mkContinuableCtx(root, behavior = {}) {
  const agent = {
    id: 'sess-cont',
    session: { id: 'sess-cont', header: { cwd: root } },
    followups: [],
    followup(msg) { this.followups.push(msg) },
  }
  const calls = { continuable: [], messages: [], oneshot: [] }
  const settledBodies = []
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    subagents: {
      async startContinuable(spec) {
        calls.continuable.push(spec)
        const childId = behavior.childId ?? `child-${calls.continuable.length}`
        settledBodies.push({ childId })
        return { childId, messageId: `m-${calls.continuable.length}` }
      },
      async sendMessage(sender, targetId, content) {
        calls.messages.push({ sender: sender?.id, targetId, text: content.map((b) => b.text).join('\n') })
        return 'inbox-1'
      },
      async start(provider, req) {
        calls.oneshot.push({ provider, req })
        return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '一次性完成' }] }), dispose: async () => {} }
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  const settle = (childId, text) => {
    // 模拟宿主结算消息投递：与 index.mjs 的 session/event 接线同一入口
    orch.onSubagentSettledMessage({ session: agent.session }, {
      source: { kind: 'subagent-settled', form: 'notice', summary: 'Background subagent finished', senderSessionId: childId },
      content: [{ type: 'text', text }],
    })
  }
  const orch = new Orchestrator(ctx, normalizeConfig({ pollIntervalMs: 50 }), ctx.logger)
  return { orch, ctx, agent, calls, settle }
}

function minimalRun(root) {
  const cardId = '71-01-solo'
  return {
    id: 'r-cont', root, sessionId: 'sess-cont', agent: { id: 'sess-cont', followup() {} },
    stage: 'implement', stopped: false,
    cards: new Map([[cardId, { phase: 'claimed', alive: true, retries: 0 }]]),
    channel: undefined, controllers: new Set(),
    resilience: { byCard: new Map(), revived: [] },
    history: [], blocked: [], board: undefined,
  }
}

test('continuable：spawn 走 startContinuable + 句柄持久化（簿记 + 卡账镜像 + run json）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-cont-'))
  const { orch, calls } = mkContinuableCtx(root)
  const run = minimalRun(root)
  orch.runs.set(run.sessionId, run)

  const settled = []
  orch.spawn(run, { role: 'dev', cardId: '71-01-solo', prompt: '领卡施工', onSettled: (t, e) => settled.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))

  assert.equal(calls.continuable.length, 1, '走 continuable 通道（不落一次性 start）')
  assert.equal(calls.oneshot.length, 0)
  assert.equal(calls.continuable[0].provider, 'spawn')
  assert.equal(calls.continuable[0].label, 'jxx-dev-71-01-solo')
  assert.equal(run.subagents.get('dev:71-01-solo'), 'child-1', 'childId 登记进 run.subagents')
  assert.equal(run.cards.get('71-01-solo').subagentId, 'child-1', '卡账 subagentId 镜像')
  assert.ok(run.history.some((h) => /continuable: spawn dev 71-01-solo/.test(h.event)), 'spawn 留痕')
  const runFile = join(root, 'control', 'jxx-driver-runs', `${run.id}.json`)
  assert.ok(existsSync(runFile), 'run json 已落盘')
  assert.equal(JSON.parse(readFileSync(runFile, 'utf8')).subagents['dev:71-01-solo'], 'child-1', 'childId 进持久化面')
})

test('continuable：二次 spawn 同 role/card 复用（sendMessage 续推，不重复 start，回调刷新）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-cont-reuse-'))
  const { orch, calls } = mkContinuableCtx(root)
  const run = minimalRun(root)
  orch.runs.set(run.sessionId, run)

  const first = []
  orch.spawn(run, { role: 'dev', cardId: '71-01-solo', prompt: '第一轮指令', onSettled: (t, e) => first.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(calls.continuable.length, 1)

  const second = []
  orch.spawn(run, { role: 'dev', cardId: '71-01-solo', prompt: '第二轮续推', onSettled: (t, e) => second.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))

  assert.equal(calls.continuable.length, 1, '同 role/card 二次 spawn 不再 startContinuable（防重复创建的核心闸）')
  assert.equal(calls.messages.length, 1, '改走 sendMessage 续推')
  assert.equal(calls.messages[0].targetId, 'child-1', '续推目标 = 已登记 childId')
  assert.equal(calls.messages[0].text, '第二轮续推')
  assert.ok(run.history.some((h) => /已有子代理.*sendMessage 续推不重建/.test(h.event)), '复用留痕')
  // 结算走**最新**回调（第二轮的 onSettled）
  orch.settleOneChild(run, 'child-1', '续推轮完工', undefined)
  assert.deepEqual(second, [['续推轮完工', undefined]], '结算喂给最新接线回调')
  assert.deepEqual(first, [], '首轮回调已被刷新，不再触发（防 stale 闭包双收）')
})

test('continuable：结算通知按 childId 反查收口（alive 清位 + persist）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-cont-settle-'))
  const { orch, calls, settle } = mkContinuableCtx(root)
  const run = minimalRun(root)
  orch.runs.set(run.sessionId, run)

  const settled = []
  orch.spawn(run, { role: 'dev', cardId: '71-01-solo', prompt: '领卡施工', onSettled: (t, e) => settled.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(run.cards.get('71-01-solo').alive, true, '在飞闸置位')

  settle('child-1', 'worker 完工\nSETTLED: 71-01-solo')
  assert.deepEqual(settled, [['worker 完工\nSETTLED: 71-01-solo', undefined]], '结算通知 → onSettled（文本透传）')
  assert.equal(run.cards.get('71-01-solo').alive, false, '结算清在飞闸（与一次性路径 done() 同口径）')
  assert.equal(run.subagentCallbacks.size, 0, '回调簿记兑现即清（防重复结算）')
  // 幂等：同 childId 重复结算不再触发回调
  settle('child-1', '重复结算')
  assert.equal(settled.length, 1, '重复结算幂等')
})

test('continuable：结算出册——重派已结算卡走新 spawn（新 childId），不给旧 child 发消息', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-cont-resettle-'))
  const { orch, calls, settle } = mkContinuableCtx(root)
  const run = minimalRun(root)
  orch.runs.set(run.sessionId, run)

  const first = []
  orch.spawn(run, { role: 'dev', cardId: '71-01-solo', prompt: '第一轮指令', onSettled: (t, e) => first.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(run.subagents.get('dev:71-01-solo'), 'child-1')

  settle('child-1', '第一轮完工')
  assert.deepEqual(first, [['第一轮完工', undefined]], '第一轮结算兑现')
  assert.equal(run.subagents.get('dev:71-01-solo'), undefined, '结算即出册（run.subagents 摘 key）')
  assert.equal(run.cards.get('71-01-solo').subagentId, undefined, '卡账 subagentId 镜像随结算清位')

  // 重投入口（返工重派 / 重审起三维 / 合并卡回挪重派 / 段0 清扫回 open）对已结算卡再派：
  // 必须走新 startContinuable（新 childId），绝不向旧 child send_message——宿主会静默冷恢复
  // 旧 child（deliverToChild→coldResume）带上一轮上下文跨轮续跑，破「每轮新子会话」语义。
  const second = []
  orch.spawn(run, { role: 'dev', cardId: '71-01-solo', prompt: '重派指令', onSettled: (t, e) => second.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(calls.continuable.length, 2, '已出册 → 新 spawn（不命中复用面）')
  assert.equal(calls.messages.length, 0, '不对已结算旧 child 发消息（防静默冷恢复）')
  assert.equal(run.subagents.get('dev:71-01-solo'), 'child-2', '新 childId 顶替登记')
  assert.equal(run.cards.get('71-01-solo').subagentId, 'child-2', '卡账镜像指向新 child')
  orch.settleOneChild(run, 'child-2', '重派轮完工', undefined)
  assert.deepEqual(second, [['重派轮完工', undefined]], '重派轮结算走本轮回调')
})

test('continuable：merger 结算不代清开发卡 alive（影子账口径不变）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-cont-merge-'))
  const { orch, settle } = mkContinuableCtx(root)
  const run = minimalRun(root)
  run.cards.set('merge-71-01-solo', { phase: 'open', alive: true, retries: 0 })
  orch.runs.set(run.sessionId, run)

  const settled = []
  orch.spawn(run, { role: 'merger', cardId: '71-01-solo', prompt: '合并施工', onSettled: (t, e) => settled.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(run.subagents.get('merger:71-01-solo'), 'child-1')
  assert.equal(run.cards.get('71-01-solo').alive, true, 'spawn 层不代清开发卡 alive（历史口径）')

  settle('child-1', '已合入')
  assert.deepEqual(settled, [['已合入', undefined]])
  assert.equal(run.cards.get('71-01-solo').alive, true, 'merger 结算仍不碰开发卡 alive')
})

test('continuable：宿主无 startContinuable → 回退一次性 start()（旧语义不变）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-cont-legacy-'))
  const agent = { id: 'sess-legacy', session: { id: 'sess-legacy', header: { cwd: root } }, followup() {} }
  const oneshot = []
  const ctx = {
    agents: { get: () => undefined },
    subagents: {
      async start(provider, req) {
        oneshot.push({ provider, req })
        return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '旧路径完成' }] }), dispose: async () => {} }
      },
    },
    logger: { info() {}, warn() {}, error() {} },
  }
  const orch = new Orchestrator(ctx, normalizeConfig({}), ctx.logger)
  const run = minimalRun(root)
  run.agent = agent
  orch.runs.set(run.sessionId, run)
  const settled = []
  orch.spawn(run, { role: 'dev', cardId: '71-01-solo', prompt: '旧路径指令', onSettled: (t, e) => settled.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(oneshot.length, 1, '回退走一次性 start')
  assert.equal(run.subagents.size, 0, '一次性路径不登记簿记')
  assert.deepEqual(settled, [['旧路径完成', undefined]], 'result 即收口（旧语义）')
  assert.equal(run.cards.get('71-01-solo').alive, false, 'done 清在飞闸')
})

test('continuable：SESSION_ROLE 续接纪律注入（⑤⑦ 与四要素同源）', () => {
  assert.match(SESSION_ROLE, /⑤ 续接纪律/, '⑤ 续接纪律在常量内（单源注入四面）')
  assert.match(SESSION_ROLE, /studio_list_subagents/)
  assert.match(SESSION_ROLE, /list_agents/)
  assert.match(SESSION_ROLE, /send_message 续接/)
  assert.match(SESSION_ROLE, /同一角色\/卡只 spawn 一次/, '禁止同角色重复 spawn 的措辞在案')
  assert.match(SESSION_ROLE, /⑥ 一次性子代理不可续接/, '⑥ 一次性不可续接说明在案')
  assert.match(SESSION_ROLE, /not-resumable/)
  assert.match(SESSION_ROLE, /⑦ 续推入口/, '⑦ 续推入口在案')
  assert.match(SESSION_ROLE, /resumed/)
  // 四要素不回退（session-role.test.mjs 同款断言，双保险）
  assert.match(SESSION_ROLE, /编排接待台/)
  assert.match(SESSION_ROLE, /不做任务/)
})

test('continuable：worker starter 无「拉起新会话」暗示，回报走 send_message（团队 member 模式与裸渲染两面）', async () => {
  const { workerPrompt } = await import('../src/prompts.mjs')
  const root = mkdtempSync(join(tmpdir(), 'jxx-cont-starter-'))
  const raw = readFileSync(join(PLUGIN_ROOT, 'src', 'default-starters', 'dev.md'), 'utf8')
  assert.ok(!raw.includes('拉起新会话时整段粘贴'), '模板标题不再有「拉起新会话时整段粘贴」暗示')
  const w = workerPrompt(root, '71-01-solo', { member: true })
  assert.ok(!w.includes('拉起新会话时整段粘贴'), 'member 渲染产物无该暗示')
  assert.match(w, /send_message 向 lead 回报/, '完工回报 = send_message（团队 member 模式）')
  assert.match(w, /续接/, '续接语义在案')
  assert.doesNotMatch(w, /\{\{ROOT\}\}/, '占位符照常渲染')
})

test('continuable：spawn 幂等防御——手工 run 无簿记字段不炸（hand-rolled fixture 兼容）', async () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-cont-guard-'))
  const { orch, calls } = mkContinuableCtx(root)
  const run = minimalRun(root)
  delete run.subagents
  delete run.subagentCallbacks
  orch.runs.set(run.sessionId, run)
  const settled = []
  orch.spawn(run, { role: 'dev', cardId: '71-01-solo', prompt: 'p', onSettled: (t, e) => settled.push([t, e]) })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(calls.continuable.length, 1)
  assert.equal(run.subagents.get('dev:71-01-solo'), 'child-1', '防御初始化后正常登记')
})
