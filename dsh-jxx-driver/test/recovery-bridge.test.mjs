/**
 * 恢复桥测试（PRD 111 工单 02 / ADR-0122 D2）：宿主重启中断检测 + 响亮上报 + 续接指引（不自动重建）。
 *
 * 覆盖工单四条验收：
 *  ① fixture：伪造 stage=implement 的落盘 run → 装载后告警 + 文件带 interruptedAt + 返回清单；幂等重跑不重复写
 *  ② stage≠implement / 无文件 → 静默（零告警零写入）
 *  ③ 续接 E2E：中断 run 存在 → go track=auto <PRD> → enterImplement「已有卡，复用」→ watcher 正常接管
 *  ④ 装载面无会话上下文时跳过不报错（幂等装载）
 *
 * 判据边界（实现侧三条，逐条配反例）：
 *  - stage=implement（decide/ops/done 不报）
 *  - 内存无对应 run（本进程在跑的 run 不报——注意 `run.id` 与 `runs` 表的 sessionId 是**两个域**）
 *  - 落盘 history 无受控终结标记（`停止：`/`失败：` = halt/failRun 收口，不是中断）
 * 另测：`.lock.json`/`.tmp-*` 不收、坏 JSON 不阻断、已有 interruptedAt 幂等、prdRef 推导、status 只读面。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { Orchestrator } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'
import * as mod from '../src/index.mjs'

// BOARD 定位：env 显式 → 仓内相对兜底（同死自愈测试口径）→ 宿主安装面。两处都不存在时用例 t.skip。
const IN_REPO_BOARD = fileURLToPath(new URL('../../base/skills/engineering/jxx-ticket-board/scripts/board.mjs', import.meta.url))
const BOARD = process.env.JXX_BOARD
  || (existsSync(IN_REPO_BOARD)
    ? IN_REPO_BOARD
    : join(process.env.USERPROFILE || process.env.HOME || '', '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs'))

const CONFIG = (over = {}) => normalizeConfig({
  boardScript: BOARD, parallel: 3, maxRetries: 1, autoMerge: true, pollIntervalMs: 50, ...over,
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(pred, timeoutMs = 30_000, stepMs = 50, label = '') {
  const start = Date.now()
  for (;;) {
    const v = await pred()
    if (v) return v
    if (Date.now() - start > timeoutMs) throw new Error(`waitFor 超时${label ? `：${label}` : ''}`)
    await sleep(stepMs)
  }
}

/** 静默 log 收集器：告警文本是被测面（响亮上报），必须能断言。 */
function mkLog() {
  const warns = []
  const infos = []
  return {
    warns, infos,
    logger: { info: (m) => infos.push(m), warn: (m) => warns.push(m), error: () => {} },
  }
}

/** 造一个只有 runs 目录的临时 root（恢复桥只读 control/jxx-driver-runs/）。 */
function mkRoot() {
  const root = mkdtempSync(join(tmpdir(), 'jxx-rb-'))
  mkdirSync(join(root, 'control', 'jxx-driver-runs'), { recursive: true })
  return root
}

const runsDirOf = (root) => join(root, 'control', 'jxx-driver-runs')
const writeRun = (root, name, obj) => writeFileSync(join(runsDirOf(root), name), JSON.stringify(obj, null, 2))
const readRun = (root, name) => JSON.parse(readFileSync(join(runsDirOf(root), name), 'utf8'))

/** 只提供 orchestrator 直调面（不经 index/apply）的最小 ctx。 */
function mkOrch(over = {}) {
  const { logger, warns, infos } = mkLog()
  const ctx = { agents: { get: () => undefined }, logger, get: () => undefined, ...over }
  return { orch: new Orchestrator(ctx, CONFIG(), logger), warns, infos, ctx }
}

const interruptedRec = (id, featureDir, extra = {}) => ({
  id, stage: 'implement', idea: 'idea', featureDir, updatedAt: 'T', history: [{ event: 'spawn worker' }], ...extra,
})

// ---------- ① 告警 + 标记 + 清单；幂等 ----------

test('恢复桥①：stage=implement 的中断 run → 告警 + 落盘 interruptedAt/resumeHint + 返回清单', () => {
  const root = mkRoot()
  const featureDir = join(root, '.scratch', '111-jxx-driver-silent-death-remediation')
  writeRun(root, 'a.json', interruptedRec('a-id', featureDir))
  const { orch, warns } = mkOrch()

  const found = orch.recoverInterruptedRuns(root)

  assert.equal(found.length, 1, '应识别 1 个中断 run')
  assert.equal(found[0].id, 'a-id')
  assert.match(found[0].lastEvent, /spawn worker/, '清单带中断前最后事件')
  assert.match(found[0].resumeHint, /jxx_flow\(action="go", track="auto", idea="111"\)/,
    'resumeHint 从 featureDir 推 PRD 编号')

  const rec = readRun(root, 'a.json')
  assert.ok(rec.interruptedAt, '落盘文件带 interruptedAt')
  assert.equal(rec.resumeHint, found[0].resumeHint, '落盘 resumeHint 与清单一致')
  assert.equal(rec.idea, 'idea', '就地合并不改其他字段')
  assert.equal(rec.history.length, 1, 'history 原样保留')

  assert.ok(warns.some((w) => /上次编排中断于宿主重启/.test(w)), '响亮告警（可 grep 的固定前缀）')
  assert.ok(warns.some((w) => /续接请执行/.test(w)), '告警含续接指引')
  assert.ok(warns.some((w) => /a-id/.test(w) && /111-jxx-driver-silent-death-remediation/.test(w)),
    '告警含取证坐标（run id + 工作目录）')
})

test('恢复桥①幂等：重跑不重复报、不重写（第二次返回空清单且零新告警）', () => {
  const root = mkRoot()
  writeRun(root, 'a.json', interruptedRec('a-id', join(root, '.scratch', '111-x')))
  const { orch, warns } = mkOrch()

  const first = orch.recoverInterruptedRuns(root)
  const afterFirst = readRun(root, 'a.json').interruptedAt
  const warnsAfterFirst = warns.length

  const second = orch.recoverInterruptedRuns(root)

  assert.equal(first.length, 1)
  assert.deepEqual(second, [], '幂等：第二次不重复报')
  assert.equal(warns.length, warnsAfterFirst, '幂等：第二次零新告警')
  assert.equal(readRun(root, 'a.json').interruptedAt, afterFirst, '幂等：不重写标记')
})

// ---------- ② 静默面（逐条反例） ----------

test('恢复桥②：stage≠implement 静默（decide/ops/done 零告警零写入）', () => {
  const root = mkRoot()
  for (const stage of ['decide', 'adr', 'prd', 'tickets', 'ops', 'done']) {
    writeRun(root, `${stage}.json`, { id: `id-${stage}`, stage, updatedAt: 'T', history: [] })
  }
  const { orch, warns } = mkOrch()

  const found = orch.recoverInterruptedRuns(root)

  assert.deepEqual(found, [], '非 implement 相位不报')
  assert.equal(warns.length, 0, '零告警')
  for (const stage of ['decide', 'adr', 'prd', 'tickets', 'ops', 'done']) {
    assert.equal(readRun(root, `${stage}.json`).interruptedAt, undefined, `${stage} 零写入`)
  }
})

test('恢复桥②：无 runs 目录 / 空目录 / 无 root 静默不抛', () => {
  const { orch, warns } = mkOrch()
  const bare = mkdtempSync(join(tmpdir(), 'jxx-rb-bare-')) // 连 control/ 都没有

  assert.deepEqual(orch.recoverInterruptedRuns(bare), [], '无目录 → 空清单')
  assert.deepEqual(orch.recoverInterruptedRuns(undefined), [], '无 root → 空清单')
  assert.deepEqual(orch.recoverInterruptedRuns(''), [], '空 root → 空清单')

  const root = mkRoot()
  assert.deepEqual(orch.recoverInterruptedRuns(root), [], '空 runs 目录 → 空清单')
  assert.equal(warns.length, 0, '全程零告警')
})

test('恢复桥②：未收口的 run 若已在内存（本进程在跑）不报——run.id 与 sessionId 是两个域', () => {
  const root = mkRoot()
  const { orch, warns, ctx } = mkOrch()
  // 真跑一个 run 进内存并落盘：runs 表按 sessionId 索引，落盘文件名的 id 是另生的 uuid
  const agent = { id: 'sess-live', session: { id: 'sess-live', header: { cwd: root } }, followup() {}, steer() {} }
  const run = orch.newRun(agent, 'sess-live', root, 'live', 'implement')
  orch.runs.set('sess-live', run)
  orch.persist(run)
  assert.ok(existsSync(join(runsDirOf(root), `${run.id}.json`)), '活 run 已落盘')
  assert.notEqual(run.id, 'sess-live', '前提：run.id ≠ sessionId（否则本用例无意义）')
  assert.equal(typeof ctx.agents.get, 'function')

  const found = orch.recoverInterruptedRuns(root)

  assert.deepEqual(found, [], '本进程在跑的 run 不是中断')
  assert.equal(warns.length, 0, '零告警')
  assert.equal(readRun(root, `${run.id}.json`).interruptedAt, undefined, '活 run 不被标记')
})

test('恢复桥②：落盘 history 带受控终结标记（停止/失败）不报——防历史 run 每次装载全报', () => {
  const root = mkRoot()
  for (const [name, event] of [
    ['stopped.json', '停止：用户主动停止'],
    ['halted.json', '停止：宿主会话已释放'],
    ['failed.json', '失败：进 implement 失败：board.mjs new-card 失败'],
  ]) {
    writeRun(root, name, { id: name, stage: 'implement', updatedAt: 'T', history: [{ event: 'spawn worker' }, { event }] })
  }
  const { orch, warns } = mkOrch()

  const found = orch.recoverInterruptedRuns(root)

  assert.deepEqual(found, [], '受控收口的 run 不是中断')
  assert.equal(warns.length, 0, '零告警')
  for (const name of ['stopped.json', 'halted.json', 'failed.json']) {
    assert.equal(readRun(root, name).interruptedAt, undefined, `${name} 不被标记`)
  }
})

test('恢复桥②：.lock.json 与 .tmp-* 不收、坏 JSON 跳过（不阻断、不误判）', () => {
  const root = mkRoot()
  const d = runsDirOf(root)
  // 锁文件 stage 也是 implement——若误收会把在跑的 run 报成中断（它有 lock 无终止标记）
  writeRun(root, 'live.lock.json', { id: 'live', stage: 'implement', updatedAt: 'T' })
  writeFileSync(join(d, 'half.json.tmp-123-abc'), '{"id":"half","stage":"implement"')
  writeFileSync(join(d, 'broken.json'), 'not json {{{')
  writeRun(root, 'real.json', interruptedRec('real-id', join(root, '.scratch', '111-x')))
  const { orch, warns } = mkOrch()

  const found = orch.recoverInterruptedRuns(root)

  assert.deepEqual(found.map((f) => f.id), ['real-id'], '只有真 run 被识别')
  assert.equal(readRun(root, 'live.lock.json').interruptedAt, undefined, '锁文件未被标记')
  assert.ok(warns.some((w) => /上次编排中断于宿主重启/.test(w)), '真 run 照常告警')
})

test('恢复桥②：多个中断 run 逐条独立上报（清单长度 = 命中数）', () => {
  const root = mkRoot()
  writeRun(root, '1.json', interruptedRec('id-1', join(root, '.scratch', '111-a')))
  writeRun(root, '2.json', interruptedRec('id-2', join(root, '.scratch', '112-b')))
  writeRun(root, '3.json', { id: 'id-3', stage: 'done', updatedAt: 'T', history: [] })
  const { orch, warns } = mkOrch()

  const found = orch.recoverInterruptedRuns(root)

  assert.deepEqual(found.map((f) => f.id).sort(), ['id-1', 'id-2'])
  assert.ok(warns.some((w) => /共识别 2 个中断 run/.test(w)), '汇总行报明总数')
})

// ---------- ④ 装载面（apply）----------

/** 经真实 apply() 装配；withRoots 决定 agents.roots() 是否可达会话 cwd。 */
function mountApply(root, { withRoots }) {
  const { logger, warns, infos } = mkLog()
  const registry = { tool: undefined }
  const ctx = {
    logger,
    on() {},
    effect(fn) { fn() },
    get(name) {
      if (name === 'agents' && withRoots) {
        return { roots: () => [{ id: 'sess', session: { id: 'sess', header: { cwd: root } } }] }
      }
      return undefined
    },
    tools: { register(t) { registry.tool = t } },
    systemPrompt: { context() {} },
    subagents: { start: async () => { throw new Error('本用例不该 spawn') } },
    agents: { get: () => undefined },
  }
  return { ctx, warns, infos, registry }
}

test('恢复桥④：apply() 可达会话 cwd 时装载即扫（告警 + 标记 + 不阻塞装载）', () => {
  const root = mkRoot()
  writeRun(root, 'x.json', interruptedRec('x-id', join(root, '.scratch', '111-foo')))
  const { ctx, warns, registry } = mountApply(root, { withRoots: true })

  mod.apply(ctx, { verbose: false })

  assert.ok(registry.tool, '装载完成（工具面已注册）')
  assert.ok(warns.some((w) => /上次编排中断于宿主重启/.test(w) && /x-id/.test(w)), '装载即告警')
  assert.ok(readRun(root, 'x.json').interruptedAt, '装载即标记')
})

test('恢复桥④：无会话上下文（agents.roots 不可达）跳过不报错，且不阻断装载', () => {
  const root = mkRoot()
  writeRun(root, 'x.json', interruptedRec('x-id', join(root, '.scratch', '111-foo')))
  const { ctx, warns, registry } = mountApply(root, { withRoots: false })

  assert.doesNotThrow(() => mod.apply(ctx, { verbose: false }), '装载不得因恢复桥失败而失败')
  assert.ok(registry.tool, '装载完成（工具面已注册）')
  assert.equal(warns.filter((w) => /上次编排中断于宿主重启/.test(w)).length, 0, '无上下文时不猜路径、不报')
  assert.equal(readRun(root, 'x.json').interruptedAt, undefined, '无上下文时不写标记')
})

test('恢复桥④：幂等装载——同一现场二次 apply 不重复告警', () => {
  const root = mkRoot()
  writeRun(root, 'x.json', interruptedRec('x-id', join(root, '.scratch', '111-foo')))
  const first = mountApply(root, { withRoots: true })
  mod.apply(first.ctx, { verbose: false })
  const second = mountApply(root, { withRoots: true })

  mod.apply(second.ctx, { verbose: false })

  assert.equal(second.warns.filter((w) => /上次编排中断于宿主重启/.test(w)).length, 0, '二次装载不重复报')
})

// ---------- ③ 工具面只读面 + status ----------

test('恢复桥③：listInterruptedRuns 是只读面（含已标记项、不写文件、不告警）', () => {
  const root = mkRoot()
  writeRun(root, 'a.json', interruptedRec('a-id', join(root, '.scratch', '111-x')))
  const { orch, warns } = mkOrch()
  orch.recoverInterruptedRuns(root) // 先标记一次
  const warnsAfterMark = warns.length

  const listed = orch.listInterruptedRuns(root)

  assert.equal(listed.length, 1, '标记过的仍算「中断未续接」⇒ 持续可见')
  assert.ok(listed[0].interruptedAt, '带上已标记时间（空串 = 尚未报过）')
  assert.equal(warns.length, warnsAfterMark, '只读面零告警')
})

test('恢复桥③：status 无内存 run 时附 interruptedRuns 摘要；有 run 时不附', () => {
  const root = mkRoot()
  writeRun(root, 'a.json', interruptedRec('a-id', join(root, '.scratch', '111-x')))
  const { orch } = mkOrch()
  const fresh = { id: 'sess-fresh', session: { id: 'sess-fresh', header: { cwd: root } }, followup() {}, steer() {} }

  const st = orch.status(fresh)

  assert.equal(st.active, false)
  assert.equal(st.interruptedRuns.length, 1, '无 run 时透出中断摘要')
  assert.match(st.hint, /中断/, 'hint 提示有待续接 run')

  // 有 run：不附摘要（本会话在跑的不是中断）
  const live = { id: 'sess-live2', session: { id: 'sess-live2', header: { cwd: root } }, followup() {}, steer() {} }
  const run = orch.newRun(live, 'sess-live2', root, 'idea', 'implement')
  orch.runs.set('sess-live2', run)
  const stLive = orch.status(live)
  assert.equal(stLive.active, true)
  assert.equal(stLive.interruptedRuns, undefined, '有 run 时不附中断摘要')
})

test('恢复桥③：无中断 status 文案与既有口径一致（不制造新提示语）', () => {
  const root = mkRoot()
  const { orch } = mkOrch()
  const agent = { id: 'sess-none', session: { id: 'sess-none', header: { cwd: root } }, followup() {}, steer() {} }

  const st = orch.status(agent)

  assert.equal(st.active, false)
  assert.equal(st.interruptedRuns, undefined)
  assert.equal(st.hint, '本会话没有进行中的编排', '无中断时保持既有 hint 原文')
})

// ---------- 续接指引推导 ----------

test('恢复桥：resumeHint 的 PRD 编号推导（去前导零 / 无数字前缀回退目录名）', () => {
  const root = mkRoot()
  const cases = [
    ['94-jxx-driver-plugin', '94'],
    ['094-zero-padded', '94'],
    ['111-jxx-driver-silent-death-remediation', '111'],
    ['no-numeric-prefix', 'no-numeric-prefix'],
  ]
  for (const [dir, want] of cases) {
    writeRun(root, `${want}.json`, interruptedRec(`id-${want}`, join(root, '.scratch', dir)))
  }
  const { orch } = mkOrch()

  const found = orch.recoverInterruptedRuns(root)

  for (const [, want] of cases) {
    const row = found.find((f) => f.id === `id-${want}`)
    assert.ok(row, `识别 ${want}`)
    assert.ok(row.resumeHint.includes(`idea="${want}"`), `${want}: resumeHint=${row.resumeHint}`)
  }
})

// ---------- ③ 续接 E2E（真 PRD + 真 board.mjs）----------

/** 真仓夹具：PRD + 一张 ready-for-agent 工单（与死自愈测试同形）。 */
function mkRepo(prdNum) {
  const root = mkdtempSync(join(tmpdir(), `jxx-rb-e2e-${prdNum}-`))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root })
  const dir = join(root, '.scratch', `${prdNum}-rb-prd`, 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, '.scratch', `${prdNum}-rb-prd`, 'PRD.md'),
    `# PRD ${prdNum} · 恢复桥测试\n\n**Status:** ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n`)
  writeFileSync(join(dir, '01-solo.md'), '# 单卡\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n\n## 评论\n')
  return { root, cardId: `${prdNum}-01-solo` }
}

/** 一次性路径 stub：worker 领卡 → 三审 PASS → 合并卡 done（与死自愈测试同形，够跑通 watcher）。 */
function mkE2eCtx(root) {
  const agent = {
    id: 'sess-rb-e2e', session: { id: 'sess-rb-e2e', header: { cwd: root } },
    followups: [], followup(msg) { this.followups.push(msg) }, steer() {},
  }
  const openDir = join(root, 'control', 'cards', 'open')
  const calls = { dev: [], merger: [] }
  const ctx = {
    agents: { get: (id) => (id === agent.id ? agent : undefined) },
    get: () => undefined, // 无 agentTeams → 一次性路径
    subagents: {
      start: async (_p, req) => {
        const dev = req.label.match(/^jxx-dev-(.+)$/)
        const rev = req.label.match(/^jxx-reviewer-(\w+)-(.+)$/)
        const mer = req.label.match(/^jxx-merger-(.+)$/)
        if (dev) {
          calls.dev.push(req.label)
          const id = dev[1]
          if (existsSync(join(openDir, `${id}.md`))) renameSync(join(openDir, `${id}.md`), join(openDir, `${id}.claimed.md`))
          renameSync(join(openDir, `${id}.claimed.md`), join(openDir, `${id}.review.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'done' }] }), dispose: async () => {} }
        }
        if (rev) return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'VERDICT: PASS' }] }), dispose: async () => {} }
        if (mer) {
          calls.merger.push(req.label)
          const id = mer[1]
          renameSync(join(openDir, `merge-${id}.md`), join(root, 'control', 'cards', 'done', `merge-${id}.md`))
          return { result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'merged' }] }), dispose: async () => {} }
        }
        throw new Error(`未知角色 ${req.label}`)
      },
    },
  }
  return { ctx: { ...ctx, logger: mkLog().logger }, agent, calls }
}

test('恢复桥③续接 E2E：中断 run 存在 → go track=auto <PRD> → enterImplement 复用既有卡 → watcher 正常接管', { timeout: 60_000 }, async (t) => {
  if (!existsSync(BOARD)) { t.skip('本机未装 jxx-ticket-board'); return }
  const { root, cardId } = mkRepo(93)
  const { ctx, agent, calls } = mkE2eCtx(root)
  const orch = new Orchestrator(ctx, CONFIG(), ctx.logger)
  t.after(async () => { await orch.dispose() })

  // 第 1 步：造「上次中断」现场——先让编排真跑起来把卡投出去，然后**模拟宿主崩溃**：
  // 直接丢弃内存 run（等价于进程没了），落盘文件保留且**不带** halt/failRun 的终结标记。
  await orch.auto(agent, '93')
  await waitFor(() => orch.status(agent).cards.some((c) => c.phase === 'claimed' || c.phase === 'open'), 15_000, 50, '投卡完成')
  const liveRunId = [...orch.runs.values()][0].id
  await orch.dispose() // 停掉 watcher（不再有定时器），但**不**当作中断：本用例只借它清场
  orch.runs.clear()
  // 重写落盘记录：抹掉 dispose 推入的「停止：」行，还原成崩溃现场（无终结标记）
  const persisted = readRun(root, `${liveRunId}.json`)
  persisted.stage = 'implement'
  persisted.history = persisted.history.filter((h) => !/^(停止：|失败：)/.test(String(h.event)))
  writeRun(root, `${liveRunId}.json`, persisted)

  // 第 2 步：装载面识别中断（这就是宿主重启后的第一眼）
  const found = orch.recoverInterruptedRuns(root)
  const hit = found.find((f) => f.id === liveRunId)
  assert.ok(hit, `崩溃现场应被识别为中断（found=${JSON.stringify(found.map((f) => f.id))}）`)
  assert.equal(hit.resumeHint, 'jxx_flow(action="go", track="auto", idea="93")', '续接指引指向该 PRD 编号')
  assert.ok(readRun(root, `${liveRunId}.json`).interruptedAt, '落盘带 interruptedAt')

  // 第 3 步：按指引续接——go track=auto <PRD>，走**真实的 auto 入口**
  const cardBefore = existsSync(join(root, 'control', 'cards', 'open', `${cardId}.md`))
    || existsSync(join(root, 'control', 'cards', 'open', `${cardId}.claimed.md`))
    || existsSync(join(root, 'control', 'cards', 'open', `${cardId}.review.md`))
  assert.ok(cardBefore, '续接前卡已在现场（这正是「复用」的前提）')
  await orch.auto(agent, '93')

  // 复用语义：不重复投卡（同 id 卡仍只有一张），watcher 接管并把流程推到底
  const openNames = existsSync(join(root, 'control', 'cards', 'open'))
    ? readdirSync(join(root, 'control', 'cards', 'open')) : []
  assert.equal(openNames.filter((n) => n.startsWith(cardId)).length <= 1, true,
    `复用既有卡：同 id 卡不应重复（open=${openNames.join(',')}）`)
  const hist = orch.status(agent).history.map((h) => h.event).join('\n')
  assert.match(hist, /复用/, 'enterImplement 记录「复用」而非「新建」')

  await waitFor(() => orch.status(agent).stage === 'ops', 45_000, 50, 'watcher 接管并推进到 ops')
  assert.ok(existsSync(join(root, 'control', 'cards', 'done', `${cardId}.md`)), '续接后卡最终 done')
  assert.ok(calls.dev.length >= 1, '续接后 worker 照常被派')
})
