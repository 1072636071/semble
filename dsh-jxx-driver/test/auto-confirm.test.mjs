/**
 * 免确认（ADR-0113）：插件驱动的编排队列不向用户追问决策定稿 / PRD seam / 工单粒度。
 * 覆盖：config 字段默认与显式关、两套提示词集的分派、关掉后回到人工闸门措辞。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Orchestrator, STAGE_HINTS, AUTO_CONFIRM_HINTS } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'

function mkRoot() {
  const root = mkdtempSync(join(tmpdir(), 'jxx-autoconfirm-'))
  mkdirSync(join(root, 'docs', 'adr'), { recursive: true })
  return root
}

/** ADR 必须在 run 开始后落盘：adrGate 以 run.createdAt 为下界筛「本次新建」。 */
function writeAdr(root) {
  writeFileSync(join(root, 'docs', 'adr', '0113-x.md'), '# ADR-0113 · x\n\n## 背景\nx\n\n## 决策\ny\n\n## 后果\nz\n')
}

function mkCtx(root) {
  const agent = {
    id: 'sess-ac',
    session: { id: 'sess-ac', header: { cwd: root } },
    followups: [],
    followup(msg) { this.followups.push(msg) },
  }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    subagents: { start: async () => { throw new Error('本测试不该 spawn') } },
    logger: { info() {}, warn() {}, error() {} },
  }
  return { ctx, agent }
}

const cfg = (over) => normalizeConfig({ boardScript: join('x', 'board.mjs'), pollIntervalMs: 50, ...over })

test('config.autoConfirm：默认开；可显式关；非布尔响亮报错', () => {
  assert.equal(cfg({}).autoConfirm, true)
  assert.equal(cfg({ autoConfirm: false }).autoConfirm, false)
  assert.equal(cfg({ autoConfirm: true }).autoConfirm, true)
  assert.throws(() => cfg({ autoConfirm: 'yes' }), /autoConfirm/)
})

test('autoConfirm=true：decide/prd/tickets 三段提示词都要求自行拍板、不问用户', () => {
  const root = mkRoot()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, cfg({ autoConfirm: true }), ctx.logger)

  const decideHint = orch.hints.decide
  assert.match(decideHint, /免确认/)
  assert.match(decideHint, /自行拍板/)

  // PRD 段：点名豁免 jxx-to-spec 第 2 步的「与用户确认 seam」
  assert.match(orch.hints.prd, /免确认/)
  assert.match(orch.hints.prd, /跳过 jxx-to-spec 第 2 步/)
  assert.match(orch.hints.prd, /不要停下来等用户确认|不要停下等用户确认/)

  // tickets 段：点名豁免 jxx-to-tickets 第 4 步的「询问粒度直到批准」
  assert.match(orch.hints.tickets, /免确认/)
  assert.match(orch.hints.tickets, /跳过 jxx-to-tickets 第 4 步/)
  assert.match(orch.hints.tickets, /直接发布/)

  // 三个阶段都必须把 ask_user_question 明确**否定**（出现即须带「不要」），
  // 而不是把它当作可选动作推荐给模型
  for (const s of ['decide', 'adr', 'prd', 'tickets']) {
    const hint = orch.hints[s]
    if (/ask_user_question/.test(hint)) {
      assert.match(hint, /不要 ask_user_question/, `${s} 段提到 ask_user_question 时必须是否定式`)
    }
  }
})

test('autoConfirm=false：回到人工闸门措辞，且不泄露免确认话术', () => {
  const root = mkRoot()
  const { ctx } = mkCtx(root)
  const orch = new Orchestrator(ctx, cfg({ autoConfirm: false }), ctx.logger)

  assert.equal(orch.hints, STAGE_HINTS)
  assert.match(orch.hints.decide, /和用户把想法决策清楚/)
  assert.match(orch.hints.decide, /grill/)
  for (const s of ['decide', 'adr', 'prd', 'tickets']) {
    assert.doesNotMatch(orch.hints[s], /免确认/, `${s} 段在关掉后不应提免确认`)
  }
})

test('advance 下发的 hint 走当前提示词集（免确认 vs 人工闸门可切换）', () => {
  const root = mkRoot()
  for (const autoConfirm of [true, false]) {
    const { ctx, agent } = mkCtx(root)
    const orch = new Orchestrator(ctx, cfg({ autoConfirm }), ctx.logger)
    orch.start(agent, '一个想法')
    writeAdr(root) // 必须在 start 之后（adrGate 以下界筛本次新建）
    const a1 = orch.advance(agent) // decide → adr
    assert.equal(a1.advanced, true)
    assert.equal(a1.stage, 'adr')
    const expected = autoConfirm ? AUTO_CONFIRM_HINTS : STAGE_HINTS
    assert.equal(a1.hint, expected.adr)
    assert.equal(orch.status(agent).stageHint, expected.adr)
    void orch.stop(agent)
  }
})

test('start 的会话内通知也按提示词集分派（免确认时不再委派用户定稿）', () => {
  const root = mkRoot()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, cfg({ autoConfirm: true }), ctx.logger)
  orch.start(agent, '一个想法')
  const note = agent.followups.at(-1).content[0].text
  assert.match(note, /当前阶段：decide/)
  assert.match(note, /免确认/)
  void orch.stop(agent)
})

/**
 * 经真实 apply() 装配的端到端一致性：工具描述 / 分流 steer / 返回 hint 三处措辞
 * 都必须跟着 config.autoConfirm 走。曾出现「常量在模块顶层 → 关掉配置仍宣称免确认」
 * 的不一致（自测探针抓到），故此处锁住该属性。
 */
test('E2E：apply 装配后，工具描述与 steer 措辞随 autoConfirm 切换（配置诚实性）', async () => {
  const root = mkRoot()
  const mod = await import('../src/index.mjs')

  const mount = () => {
    let tool
    const ctx = {
      logger: { info() {}, warn() {}, error() {} },
      on() {},
      effect(fn) { fn() },
      get() { return undefined },
      tools: { register(t) { tool = t } },
      systemPrompt: { context() {} },
      subagents: { start: async () => { throw new Error('不该 spawn') } },
      agents: { get: () => undefined },
    }
    return { ctx, tool: () => tool }
  }
  const mkAgent = () => {
    const steered = []
    return {
      steered,
      agent: {
        id: 'sess-e2e', session: { id: 'sess-e2e', header: { cwd: root } },
        steer(m) { steered.push(m.content[0].text) }, followup() {},
      },
    }
  }

  for (const autoConfirm of [true, false]) {
    const { ctx, tool } = mount()
    mod.apply(ctx, { autoConfirm, verbose: false, pollIntervalMs: 50 })
    const { steered, agent } = mkAgent()

    const triage = await tool().execute({ action: 'go', idea: '做点东西' }, { agent })
    const std = await tool().execute({ action: 'go', track: 'standard', idea: '做点东西' }, { agent })

    const all = [tool().description, steered[0], triage.hint, std.hint].join('\n')
    if (autoConfirm) {
      assert.match(all, /免确认/, 'autoConfirm=true 时各处应宣称免确认')
      assert.doesNotMatch(all, /保留人工闸门/, 'autoConfirm=true 时不应出现人工闸门口径')
    } else {
      assert.doesNotMatch(all, /免确认/, 'autoConfirm=false 时不得再宣称免确认（配置诚实性）')
      assert.match(all, /保留人工闸门|ask_user_question/, '关掉后应回到人工闸门/追问口径')
      assert.match(std.hint, /grill/, '关掉后 decide hint 应恢复 grill 措辞')
    }
  }
})
