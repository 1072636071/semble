/**
 * 序列化遍历闸（PRD 111 工单 03 / ADR-0122 D3）：lossless-JSON 故障三连发（PRD 97
 * STAGE_HINTS.adr 缺失 / PRD 102 run.cards Map / PRD 110 再现）的防复发闸。
 *
 * 遍历判据（工单构建内容 2）：对 go（四 track 形态）/advance/status/stop 及 start/quick/auto
 * 别名，逐 action 断言「返回值 JSON.parse(JSON.stringify()) 往返无损且宿主可序列化」；
 * status 覆盖「有 run（cards 非空）/无 run」两态。
 *
 * 宿主可序列化判据单源：`assertPlainJson` 按**宿主 lossless-JSON walker 的拒绝面同构枚举**
 * （undefined 属性值 / Map / Set / 函数 / bigint / symbol / 往返键漂移）——39-02 实测宿主对
 * undefined 属性值也判非 lossless，而 JSON.stringify 会静默丢弃这些键所以单跑 stringify 测不出。
 *
 * 红绿对照（工单验收 1，test ⑥ %TEMP% 克隆实证）：临时删 dispatch 出口兜底 → 遍历闸红
 * （status-有run 态注入 Map，PRD 102 实测形态）→ 恢复绿。tip 常态返回已全 plain（DRV-01
 * status 瘦身），Map 藏点需注入才现形——注入即「历史故障回归」的受控重放。
 *
 * 内部约定：JXX_SER_IN_CLONE=1 标记克隆内运行（⑥ 不复入）；JXX_SER_RED_LEG=1 让 test ①
 * 注入 Map（红腿驱动面）；JXX_SER_SKIP_REDLGREEN=1 跳过 ⑥（调试逃生口）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, renameSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'
import * as mod from '../src/index.mjs'

// BOARD 定位：env 显式 → 仓内相对兜底（同恢复桥测试口径）→ 宿主安装面。两处都不存在时用例 t.skip。
const IN_REPO_BOARD = fileURLToPath(new URL('../../base/skills/engineering/jxx-ticket-board/scripts/board.mjs', import.meta.url))
const BOARD = process.env.JXX_BOARD
  || (existsSync(IN_REPO_BOARD)
    ? IN_REPO_BOARD
    : join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs'))

const CONFIG = () => normalizeConfig({
  boardScript: BOARD, parallel: 3, staleMinutes: 30, maxRetries: 1, autoMerge: true, pollIntervalMs: 50,
})

const IN_CLONE = process.env.JXX_SER_IN_CLONE === '1'
const RED_LEG = process.env.JXX_SER_RED_LEG === '1'

/** 断言 v 是「宿主可序列化」的 plain JSON：undefined/Map/Set/函数/bigint/symbol/环形 全拒。 */
function assertPlainJson(v, path = '$') {
  if (v === undefined) throw new Error(`${path} = undefined（宿主 lossless walker 拒绝）`)
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return
  if (typeof v === 'bigint' || typeof v === 'symbol') throw new Error(`${path} = ${typeof v}`)
  if (typeof v === 'function') throw new Error(`${path} = function`)
  const s = Object.prototype.toString.call(v)
  if (s === '[object Map]') throw new Error(`${path} = Map（宿主 lossless walker 拒绝）`)
  if (s === '[object Set]') throw new Error(`${path} = Set（宿主 lossless walker 拒绝）`)
  if (Array.isArray(v)) { v.forEach((x, i) => assertPlainJson(x, `${path}[${i}]`)); return }
  // 往返无损（键集合级）：undefined 属性值会被 stringify 丢弃 ⇒ 往返后键消失 = 判红
  const roundTrip = JSON.parse(JSON.stringify(v))
  assert.deepEqual(Object.keys(roundTrip).sort(), Object.keys(v).sort(),
    `${path} 往返后键集合漂移（undefined 属性值？）`)
  for (const [k, x] of Object.entries(v)) assertPlainJson(x, `${path}.${k}`)
}

/**
 * 工单判据全量：JSON.parse(JSON.stringify()) 往返 deep-equal 无损 **且** 宿主可序列化。
 * 口径（spec 审查 F2 追认留痕）：「往返无损」按**结构级**判定——JSON.parse(JSON.stringify(v))
 * 的输出对 plain JSON 域是幂等不动点，二次往返 deep-equal 即证明输出已落在该域内；时点值
 * 全等不做（有 run 态下 watcher/重试计时器会推进 retries 等可变字段，等待窗口不可控）。
 * 值级无损由 assertPlainJson 的键集合级往返 + 宿主拒绝面同构枚举承接。
 */
function assertLosslessRoundTrip(v) {
  const a = JSON.parse(JSON.stringify(v))
  const b = JSON.parse(JSON.stringify(a))
  assert.deepEqual(b, a, 'JSON 往返一次后再往返应 deep-equal（结构稳定）')
  assertPlainJson(v)
}

/** 最小 git 仓 fixture：go/status/advance/stop 的编排面都落在真实看板上。 */
function mkRepo() {
  const root = mkdtempSync(join(tmpdir(), 'jxx-ser-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', '96-go-prd', 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', '96-go-prd', 'PRD.md'),
    '# PRD 96 · 序列化闸\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n')
  writeFileSync(join(dir, '01-one.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
  return root
}

/** 最小 ctx：一次性路径 worker 子会话（领取→交付卡位推进）；审查/合并照 go.test 口径。 */
function mkCtx(root) {
  const agent = {
    id: 'sess-ser',
    session: { id: 'sess-ser', header: { cwd: root } },
    followups: [], steered: [],
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

// ---------- ① status 两态矩阵（有 run cards 非空 / 无 run）----------
// RED_LEG=1 时给 orch.status 包一层注入：有 run 返回体的 cards 换成 Map（PRD 102 实测形态）。
// 这正是「临时删兜底后闸红」的红源——克隆红绿对照（⑥）靠它驱动。

test('遍历闸①：status 有 run（cards 非空）与无 run 两态返回值宿主可序列化', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // 有 run 态：真实看板投卡，run.cards 至少含开发卡 + 合并卡影子账两条
  const rootA = mkRepo()
  const { ctx: ctxA, agent: agentA } = mkCtx(rootA)
  const orchA = new Orchestrator(ctxA, CONFIG(), ctxA.logger)
  t.after(async () => { await orchA.dispose() })
  const runA = await orchA.auto(agentA, '96')
  assert.ok(runA.cards.size >= 1, '前置：有 run 态的 cards 非空')

  if (RED_LEG) {
    const origStatus = orchA.status.bind(orchA)
    orchA.status = (a) => {
      const st = origStatus(a)
      if (st.active === true) st.cards = new Map(runA.cards) // 注入：仅有 run 态（PRD 102 形态）
      return st
    }
  }

  const stActive = await mod.dispatch(orchA, { action: 'status' }, agentA)
  assert.equal(stActive.active, true)
  if (!RED_LEG) assert.ok(stActive.cards.length >= 1, 'status-有run 的 cards 非空（条目全程保留，只 set 不删）')
  assertLosslessRoundTrip(stActive)

  // 无 run 态：真实 stop 路径清场（halt 摘 runs 表），非伪造
  await orchA.stop(agentA)
  const stIdle = await mod.dispatch(orchA, { action: 'status' }, agentA)
  assert.equal(stIdle.active, false)
  assertLosslessRoundTrip(stIdle)
})

// ---------- ② 全 action × 形态矩阵 ----------

test('遍历闸②：go 四形态 + start/quick/auto 别名 + advance/stop 逐 action 返回值宿主可序列化', async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  // go 四 track 形态（工单「go（四 track 形态）」＝工具 schema track 枚举四值 + 无 track 分流，
  // spec 审查 F1 收口：deep 与 standard 共用 runStandard 同形返回，照跑同闸）
  const matrix = [
    { action: 'go', idea: '做一个新模块', track: 'standard', route: 'standard' },
    { action: 'go', idea: '大架构级改造', track: 'deep', route: 'standard' },
    { action: 'go', idea: '侧栏数字不对，应该是 3', track: 'quick', route: 'quick' },
    { action: 'go', idea: '96', track: 'auto', route: 'auto' },
    { action: 'go', idea: '做点东西', track: undefined, triage: true },
    // 旧别名（工单「及 start/quick/auto 别名」）
    { action: 'start', idea: '再做一个模块', route: 'standard' },
    { action: 'quick', idea: '又一个问题', route: 'quick' },
    { action: 'auto', idea: '96', route: 'auto' },
  ]
  for (const [i, m] of matrix.entries()) {
    const root = mkRepo()
    const { ctx, agent } = mkCtx(root)
    const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
    t.after(async () => { await orch.dispose() })
    const value = await mod.dispatch(orch, { action: m.action, idea: m.idea, track: m.track }, agent)
    if (m.triage) assert.equal(value.routed, 'pending-model-triage', `形态 #${i} 走模型分流`)
    else assert.equal(value.route, m.route, `形态 #${i}（action=${m.action}）路由正确`)
    assertLosslessRoundTrip(value)
    if (value.stage === 'implement') await orch.stop(agent)
  }

  // advance：无 run 抛错路径（报错不属返回体兜底面）+ decide 阶段闸不过路径（返回体）
  {
    const root = mkRepo()
    const { ctx, agent } = mkCtx(root)
    const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
    t.after(async () => { await orch.dispose() })
    await assert.rejects(() => mod.dispatch(orch, { action: 'advance' }, agent),
      (e) => /没有进行中的编排/.test(e.message), 'advance 无 run 抛错')
    orch.start(agent, '做一个新模块')
    const gateFail = await mod.dispatch(orch, { action: 'advance' }, agent)
    assert.equal(gateFail.advanced, false)
    assertLosslessRoundTrip(gateFail)
    await orch.stop(agent)
  }

  // stop：无 run 返回 { stopped:false, hint }；有 run 停止返回 { stopped:true }
  {
    const root = mkRepo()
    const { ctx, agent } = mkCtx(root)
    const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
    t.after(async () => { await orch.dispose() })
    const stopIdle = await mod.dispatch(orch, { action: 'stop' }, agent)
    assert.equal(stopIdle.stopped, false)
    assertLosslessRoundTrip(stopIdle)
    const run = await orch.auto(agent, '96')
    const stopActive = await mod.dispatch(orch, { action: 'stop' }, agent)
    assert.equal(stopActive.stopped, true)
    assertLosslessRoundTrip(stopActive)
    assert.equal(run.stopped, true)
  }
})

// ---------- ③ 闸形判据：兜底在位的绿 + 注入 Map 必红的单点实证 ----------

test('遍历闸③：注入 Map 的原始 status 返回必判红；dispatch 出口全分支以 serializeValue 兜底', async (t) => {
  const root = mkRepo()
  const { ctx, agent } = mkCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  // 绿腿：dispatch 出口兜底在位，真实 status 返回（无 run 态）可序列化
  const st = await mod.dispatch(orch, { action: 'status' }, agent)
  assertLosslessRoundTrip(st)

  // 闸能红：PRD 102 实测形态（run.cards Map 溜进 status-有run 返回）怼向判据必抛，且点名 Map
  const poisoned = {
    active: true, stage: 'implement', idea: 'poison',
    featureDir: join(root, '.scratch', '96-go-prd'), stageHint: 'x',
    createdAt: 'T', updatedAt: 'T',
    cards: new Map([['96-01-one', { phase: 'open', retries: 0 }]]),
    blocked: [], lastError: null, board: null, history: [],
  }
  let redHit = null
  try { assertLosslessRoundTrip(poisoned) } catch (e) { redHit = e }
  assert.ok(redHit, '红腿：带 Map 的 status-有run 返回必须判红')
  assert.match(redHit.message, /Map/, '红腿错误点名 Map')

  // 防退化自检：dispatch 每个分支都以 serializeValue 包裹（删兜底 = 该 action 失闸，静态即红）。
  // case 标签后可能带同行注释（如 `case 'start': // 旧入口别名 …`），用有界非贪婪容忍。
  const src = readFileSync(fileURLToPath(new URL('../src/index.mjs', import.meta.url)), 'utf8')
  for (const branch of ['go', 'advance', 'status', 'resumed', 'stop', 'start', 'quick', 'auto']) {
    assert.match(src, new RegExp(`case '${branch}':[\\s\\S]{0,120}?return serializeValue\\(`),
      `dispatch 出口 case '${branch}' 必须以 serializeValue 兜底`)
  }
})

// ---------- ④ 兜底语义单测：降级保 plain、降级失败不炸工具面 ----------

test('遍历闸④：serializeValue 降级语义——Map/Set 降级、undefined 键丢弃、环形引用降级为 error 对象 + warn 留痕', () => {
  // 降级留痕（std 审查发现项收口）：兜底触发 = 返回体带毒实证，必须 warn 不静默
  {
    const warns = []
    const a = {}
    a.self = a // 环形引用：JSON.stringify 直接抛 ⇒ 兜底降级为 { error: 'non-serializable' } 不炸工具面
    const err = mod.serializeValue(a, { warn: (m) => warns.push(m) }, 'jxx_flow(status)')
    assert.deepEqual(err, { error: 'non-serializable' })
    assert.equal(warns.length, 1, '降级必须 warn 留痕（不静默吞）')
    assert.match(warns[0], /non-serializable/)
    assert.match(warns[0], /jxx_flow\(status\)/, '留痕带调用标签（可定位哪个 action 中毒）')
    // 无 logger 直驱（测试/旧调用面）也不抛——留痕是能力增强，不改变降级语义
    assert.doesNotThrow(() => mod.serializeValue(a.self))
  }

  // Map/Set → {}（toJSON 语义）；undefined 属性值 / 属性级函数值 → 键被丢弃；plain 值原样
  assert.deepEqual(mod.serializeValue({
    m: new Map([['k', 1]]), s: new Set([1, 2]), u: undefined, f: () => 1, plain: 'ok',
  }), { m: {}, s: {}, plain: 'ok' })

  // plain 值恒等（兜底不得破坏正常返回）
  assert.deepEqual(mod.serializeValue(null), null)
  assert.deepEqual(mod.serializeValue('str'), 'str')
  assert.deepEqual(mod.serializeValue(42), 42)
  assert.deepEqual(mod.serializeValue(true), true)
  assert.deepEqual(mod.serializeValue([1, 2, 3]), [1, 2, 3])
  assert.deepEqual(mod.serializeValue({ ok: true, nested: { arr: [1, 'a', null] } }),
    { ok: true, nested: { arr: [1, 'a', null] } })
  // 顶层 undefined / 顶层函数经 stringify→undefined 转 null，不让 undefined 直穿
  assert.equal(mod.serializeValue(undefined), null)
  assert.equal(mod.serializeValue(() => 1), null)
})

// ---------- ⑤ 宿主入口装配面：经 apply() 注册的工具全链路兜底 + render 稳定 ----------

test('遍历闸⑤：apply() 装配后 jxx_flow 工具 execute 返回值可序列化且 render 产出文本', async (t) => {
  let tool
  const mountCtx = {
    logger: { info() {}, warn() {}, error() {} },
    on() {},
    effect(fn) { fn() },
    get() { return undefined },
    tools: { register(t2) { tool = t2 } },
    systemPrompt: { context() {} },
    subagents: { start: async () => { throw new Error('不该 spawn') } },
    agents: { get: () => undefined },
  }
  mod.apply(mountCtx, { autoConfirm: true, verbose: false, pollIntervalMs: 50 })
  const root = mkRepo()
  const agent = { id: 'sess-mount', session: { id: 'sess-mount', header: { cwd: root } }, followup() {}, steer() {} }
  const value = await tool.execute({ action: 'status' }, { agent })
  assertLosslessRoundTrip(value)
  const rendered = tool.output.render(null, value)
  assert.ok(Array.isArray(rendered) && rendered.length >= 1, 'render 产出渲染块')
  assert.ok(rendered[0].type === 'text' && rendered[0].text.length > 0, '渲染产出非空文本')
})

// ---------- ⑥ 红绿对照（工单验收 1 实证）：删兜底 → 遍历闸红（status-有run 命中 Map）→ 恢复绿 ----------

/**
 * %TEMP% 克隆实证（同 111-02 先例）：克隆本仓 → 补工作树未提交改动 →
 *  1) 绿基线：原样跑本测试套件（克隆内，JXX_SER_IN_CLONE=1）→ 全绿；
 *  2) 红腿：临时删 index.mjs status/go 分支的 serializeValue 兜底 + JXX_SER_RED_LEG=1
 *     （test ① 注入 PRD 102 形态 Map）→ 套件红，输出点名 Map；
 *  3) 恢复绿：还原 index.mjs → 同注入套件复绿。
 * 克隆目录用后即清；JXX_SER_SKIP_REDLGREEN=1 可跳过本用例。
 */
test('遍历闸⑥：红绿对照（%TEMP% 克隆实证）——删兜底 → 闸红 → 恢复绿', { skip: (IN_CLONE || process.env.JXX_SER_SKIP_REDLGREEN === '1') ? '红绿对照驱动面内部不复入' : false }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const repoDir = fileURLToPath(new URL('../..', import.meta.url)) // JwikisSkills 仓根（本 worktree）
  const tmp = mkdtempSync(join(tmpdir(), 'jxx-ser-rg-'))
  t.after(() => { try { rmSync(tmp, { recursive: true, force: true }) } catch { /* 清理失败不判红 */ } })
  const cloneDir = join(tmp, 'clone')
  execFileSync('git', ['clone', '--depth', '1', '--no-hardlinks', '--quiet', repoDir, cloneDir])
  // 工作树未提交改动（本工单 src/index.mjs + 本测试文件 + package.json）补进克隆
  for (const rel of ['dsh-jxx-driver/src/index.mjs', 'dsh-jxx-driver/test/serialization.test.mjs', 'dsh-jxx-driver/package.json']) {
    const from = join(repoDir, rel)
    if (existsSync(from)) {
      mkdirSync(join(cloneDir, rel, '..'), { recursive: true })
      writeFileSync(join(cloneDir, rel), readFileSync(from, 'utf8'))
    }
  }
  const pluginDir = join(cloneDir, 'dsh-jxx-driver')
  // 子套件环境：必须剥离父测试 runner 注入的 NODE_TEST_CONTEXT——否则孙进程 `node --test`
  // 判定「run() 被递归调用」整体跳过测试文件（实测：0 用例、exit 0，红腿静默失红）。
  const parentEnv = { ...process.env }
  delete parentEnv.NODE_TEST_CONTEXT
  const baseEnv = { ...parentEnv, JXX_SER_IN_CLONE: '1', JXX_SER_SKIP_REDLGREEN: undefined, JXX_BOARD: BOARD }
  const runSuite = (env) => {
    try {
      execFileSync(process.execPath, ['--test', 'test/serialization.test.mjs'],
        { cwd: pluginDir, encoding: 'utf8', env: { ...baseEnv, ...env } })
      return { ok: true, out: '' }
    } catch (e) {
      return { ok: false, out: `${e.stdout ?? ''}\n${e.stderr ?? ''}` }
    }
  }

  // 1) 绿基线（无注入）
  const green1 = runSuite({})
  assert.ok(green1.ok, `绿基线应全绿：\n${green1.out.slice(-2000)}`)

  // 2) 红腿：删兜底（status/go 两分支）+ 注入 Map
  // （std 审查发现项 5 留痕：.replace() 与源码措辞强耦合是设计前提——形态漂移时 notEqual 响亮失败，
  //   重构 dispatch 的同时必须同步本补丁字面。）
  const idxPath = join(pluginDir, 'src', 'index.mjs')
  const original = readFileSync(idxPath, 'utf8')
  const stripped = original
    .replace('return serializeValue(await goDispatch(orch, args, agent), log, `jxx_flow(${args.action})`)', 'return await goDispatch(orch, args, agent)')
    .replace('return serializeValue(await orch.status(agent), log, `jxx_flow(${args.action})`)', 'return await orch.status(agent)')
  assert.notEqual(stripped, original, '删兜底补丁必须命中（形态漂移时响亮失败）')
  writeFileSync(idxPath, stripped)
  const red = runSuite({ JXX_SER_RED_LEG: '1' })
  assert.ok(!red.ok, `删兜底 + status-有run 注入 Map ⇒ 遍历闸必须红（子套件输出尾部：\n${red.out.slice(-1200)}）`)
  assert.match(red.out, /Map/, `红腿输出须点名 Map（status-有run 态命中；输出尾部：\n${red.out.slice(-1200)}）`)

  // 3) 恢复绿：还原兜底，同注入复绿
  writeFileSync(idxPath, original)
  const green2 = runSuite({ JXX_SER_RED_LEG: '1' })
  assert.ok(green2.ok, `恢复绿应全绿（注入被兜底降级）：\n${green2.out.slice(-2000)}`)
})
