/**
 * 编排内核：卡位 watcher（轮询）+ 僵死计时器 + 就绪前沿 + 编程 spawn。
 * 只实现 PROTOCOL 已明写的状态转移；协议没覆盖的一律 blocked 转人工（ADR-0110 D6）。
 * 插件无 rm-wt / 删 control / 批量操作调用面（ADR-0110 D4）。
 */
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Board } from './board.mjs'
import { PLUGIN_SOURCE } from './plugin-source.mjs'
import { scanBoard, listTickets, findFeatureDir, ticketCardId, ticketNum, cardDeps } from './cards.mjs'
import { adrGate, prdGate, ticketsGate, opsGate } from './gates.mjs'
import { createQuickTicket } from './quick.mjs'
import { workerPrompt, reviewerPrompt, mergerPrompt, memberDirective, reviewerDims, parseVerdict } from './prompts.mjs'
import { resolveAgentTeams, createNamePool, createReuseLedger, createTeamChannel, backoffDelayMs, createMemberProbe, buildHandoffFromCard, devIdOf, mergeIdOf } from './team-spawn.mjs'

/**
 * 合并指令组装单源（R1 审查重复代码发现项）：resend 重发与换名重建首条指令共用，
 * 差异只在调用方的尾注追加——防止两处 prompt 形态漂移。
 */
function sendMergeDirective(run, mergeId, { member = false } = {}) {
  return mergerPrompt(run.root, mergeId, devIdOf(mergeId), member ? { member: true } : undefined)
}

export const STAGES = ['decide', 'adr', 'prd', 'tickets', 'implement', 'ops', 'done']

/**
 * 死亡自愈 notify 的机读引导尾注（PRD 111 工单 01 构建内容 4，与 02 恢复桥文案同风格）：
 * 转人工类给 card-read 坐标，续接类给 go 指引。
 */
const HUMAN_TAKEOVER_HINT = '人工核查：card-read 该卡看流转段定夺；续接可 jxx_flow(action=go, track=auto, idea=<PRD号>)。'

/**
 * 接待会话角色锁定（ADR-0115 D1）：执行 jxx 插件命令的会话 = 编排接待台，不是工人。
 * 注入面：jxx_flow 工具描述前导、go 分流 steer、各轨道返回 hint、systemPrompt context（四处同一常量，措辞单源）。
 * 边界：需求/决策类文档（ADR/PRD/工单）是与用户沟通的载体，仍由本会话产出；
 * 「任务」= 实现类工作（写代码、领卡、审查、合并）——一律归插件 spawn 的子 agent。
 */
export const SESSION_ROLE = [
  '本会话角色 = jxx 编排接待台（ADR-0115）：',
  '① 你不做任务——不写实现代码、不领卡、不替 worker/审查者/合并专员干活；实现一律由插件 spawn 的子 agent 完成。',
  '② 你的主业是理解用户需求——拿不准就用 ask_user_question 问，把意图聊清再推进；宁多问一句，不自作主张。',
  '③ 关键节点等用户指令——决策定稿前与用户确认；blocked/异常如实上报，不擅自扩大范围。',
  '④ 编排期你只监控——jxx_flow(action=status) 看进度，编排器通知如实转告用户。',
].join('\n')

const ADR_HINT = '读 ADR，用 jxx-to-spec 把决策写成 PRD（.scratch/<NN>-<slug>/PRD.md，H1 `# PRD <NN> · <标题>`，固定小节顺序：问题陈述→用户故事→解决方案→实现决策→测试决策），写完调用 jxx_flow(action=advance)。'

/** 人工闸门版提示词：给人手跑 /jxx 的会话用（技能正文的人工闸门原样生效）。 */
export const STAGE_HINTS = {
  decide: '和用户把想法决策清楚（grill：一次一问、给推荐）；定稿后把决策写成 ADR（docs/adr/NNNN-<slug>.md，结构：H1 `# ADR-NNNN · 标题` + `## 背景`/`## 决策`/`## 后果`），然后调用 jxx_flow(action=advance)。',
  adr: 'ADR 已产出（decide 段闸门已验）。确认 docs/adr/ 下 ADR 就位后调用 jxx_flow(action=advance) 进入 PRD 段。',
  prd: ADR_HINT,
  tickets: '读 PRD，用 jxx-to-tickets 拆成追踪弹工单（issues/<NN>-<slug>.md，每单含 **Status:** ready-for-agent 与 **Blocked by:** 行），写完调用 jxx_flow(action=advance)。',
  implement: '编排进行中：插件自动 spawn worker/审查者/合并专员推进工单。你只需监控；出现异常我会上报。',
  ops: '全部工单已收口。请做运维收尾：把本次经验写进 docs/retro/<YYYY-MM-DD>-<slug>.md（回顾：哪里顺、哪里卡、环境改进建议），然后调用 jxx_flow(action=advance)。PRD 分支收口与 worktree 回收由人决定，插件不做。',
  done: '流程已完成。',
}

/**
 * 免确认版提示词（config.autoConfirm=true，默认 · ADR-0113；适用范围经 ADR-0115 收窄）：
 * 插件驱动的编排队列在 **PRD seam 与工单粒度** 两处不向用户追问——由你按推荐自行拍板并直接落盘。
 * **决策定稿不再豁免**（ADR-0115 D2）：decide 段恢复人工闸门——本会话的主业是理解用户需求，
 * 方向必须经用户确认；实测「decide 也自动」让接待会话把「理解需求」一并自动化掉，违背接待台定位。
 * 技能正文里的人工闸门（jxx-to-spec 第 2 步「与用户确认 seam」、jxx-to-tickets 第 4 步
 * 「询问粒度直到用户批准」）是给人手跑会话的，本编排会话明确豁免：**不要 ask_user_question、
 * 不要停下等确认**，把拍板理由写进产出文档（PRD 对应小节 / map.md）留痕。
 * 免确认不等于免判断：方案取舍仍要照技能的实质要求做（垂直切片规则、阻塞边、seam 取最高层）。
 */
export const AUTO_CONFIRM_HINTS = {
  ...STAGE_HINTS,
  decide: '先和用户把需求聊透（一次一问、给推荐；理不清就继续问，直到用户点头）。**本段恢复人工闸门（ADR-0115）**：决策方向必须经用户确认，不要替用户拍板、不要自行定稿后直接 advance。用户确认后把决策写成 ADR（docs/adr/NNNN-<slug>.md，结构：H1 `# ADR-NNNN · 标题` + `## 背景`/`## 决策`/`## 后果`），然后调用 jxx_flow(action=advance)。后续 PRD seam 与工单粒度两段仍免确认（ADR-0113）。',
  adr: 'ADR 已产出（decide 段闸门已验）。自行核对 docs/adr/ 下 ADR 就位（这是文件自检，不是问用户）后调用 jxx_flow(action=advance) 进入 PRD 段。',
  prd: `读 ADR，用 jxx-to-spec 把决策写成 PRD（.scratch/<NN>-<slug>/PRD.md，H1 \`# PRD <NN> · <标题>\`，固定小节顺序：问题陈述→用户故事→解决方案→实现决策→测试决策）。**免确认（ADR-0113）**：跳过 jxx-to-spec 第 2 步「与用户确认 seam」——你自行按「优先已有 seam、取尽可能高层、seam 越少越好」选定并在 PRD 的「实现决策」段写明选择理由；不要 ask_user_question、不要停下等用户确认。写完调用 jxx_flow(action=advance)。`,
  tickets: `读 PRD，用 jxx-to-tickets 拆成追踪弹工单（issues/<NN>-<slug>.md，每单含 **Status:** ready-for-agent 与 **Blocked by:** 行）。**免确认（ADR-0113）**：跳过 jxx-to-tickets 第 4 步「询问用户粒度/阻塞边直到批准」——你自行按垂直切片规则定稿粒度与阻塞边后**直接发布**，不要 ask_user_question、不要停下等用户批准；粒度取舍理由写进 .scratch/<NN>-<slug>/map.md。写完调用 jxx_flow(action=advance)。`,
}

function nowIso() {
  return new Date().toISOString()
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}

export class Orchestrator {
  constructor(ctx, config, log) {
    this.ctx = ctx
    this.config = config
    this.log = log
    /** 免确认（ADR-0113）：插件驱动的编排队列按 config 选提示词集；默认开。 */
    this.hints = config.autoConfirm ? AUTO_CONFIRM_HINTS : STAGE_HINTS
    /** 一个驱动会话同时只带一个 run（ADR-0110 D1：真相源唯一、防双轨）。 */
    this.runs = new Map() // sessionId -> run
    /** 会话级团队通道缓存（PRD 110 工单 04 / ADR-0121 D4）：run 结束不解散持久队友，
     * 同会话下一个 run 复用同一通道（名册/名字池/预算账本都在闭包里，按名续接）；
     * halt 不清（成员保留），插件卸载 dispose 才清。 */
    this.teamChannels = new Map() // sessionId -> channel
  }

  // ---------- 公共入口 ----------

  start(agent, idea) {
    const sessionId = agent.session.id ?? agent.id
    const root = agent.session.header.cwd
    if (!root) throw new Error('jxx-driver: 当前会话没有工作目录（cwd 为空），无法编排')
    if (this.runs.has(sessionId)) throw new Error('本会话已有进行中的编排（/jxx status 查看，/jxx stop 停止）')
    this.assertNoForeignRun(root, sessionId)
    const run = this.newRun(agent, sessionId, root, idea, 'decide')
    this.runs.set(sessionId, run)
    this.persist(run)
    this.notify(run, `已就位。当前阶段：decide。${this.hints.decide}`, { key: 'stage:decide:ready' })
    return run
  }

  /** 对**显式指定**的既有 PRD 直接进入 implement（对应 jxx-ticket-board 的 auto 模式）。
   * 参数解析（ADR-0118：插件不扫目录、不猜意图、不列候选——要编排哪份由用户/模型给编号）：
   *  - 无参 / 匹配不上 → 响亮报错（只说清要什么形态），不列 PRD 清单；
   *  - 纯数字/NN（含补零形态 `094`）→ 精确编号匹配；
   *  - 功能目录名（如 `94-jxx-driver-plugin`）→ 精确目录名匹配。
   * 标题/slug 子串模糊匹配与 CANDIDATES 候选清单已撤除（ADR-0118 D1/D2）。 */
  async auto(agent, prdRef) {
    const sessionId = agent.session.id ?? agent.id
    const root = agent.session.header.cwd
    if (!root) throw new Error('jxx-driver: 当前会话没有工作目录（cwd 为空），无法编排')
    if (this.runs.has(sessionId)) throw new Error('本会话已有进行中的编排（/jxx status 查看，/jxx stop 停止）')
    this.assertNoForeignRun(root, sessionId)
    const raw = String(prdRef || '').trim()
    if (raw === '') {
      throw new Error('jxx-driver: auto 需要显式指定 PRD（PRD 编号或功能目录名，如 `94` 或 `94-jxx-driver-plugin`）。插件不扫描 .scratch/ 也不猜意图——请把编号给出来。')
    }
    // 确定性匹配：编号（去前导零）或功能目录名（去前导零 + 目录名）
    const wanted = raw.replace(/^0+(?=\d)/, '')
    const featureDir = findFeatureDir(root, wanted)
    if (!featureDir) {
      throw new Error(`jxx-driver: .scratch/ 下找不到 PRD「${raw}」。要编排既有 PRD 请给准确的编号或功能目录名（形如 94 或 94-jxx-driver-plugin）；插件不列候选清单——不确定时先看一下 .scratch/ 有哪些目录。`)
    }
    const run = this.newRun(agent, sessionId, root, `auto ${raw}`, 'implement')
    run.featureDir = featureDir
    this.runs.set(sessionId, run)
    try {
      await this.enterImplement(run)
    } catch (e) {
      this.runs.delete(sessionId)
      throw e
    }
    return run
  }

  newRun(agent, sessionId, root, idea, stage) {
    return {
      id: randomUUID(), root, sessionId, agent, idea,
      stage, createdAt: nowIso(), updatedAt: nowIso(),
      history: [{ t: nowIso(), event: `start：${idea.slice(0, 120)}（stage=${stage}）` }],
      cards: new Map(), timer: undefined, stopped: false, dispatchFrozen: false,
      blocked: [], lastError: undefined, controllers: new Set(),
      // 团队路径（PRD 110 工单 02）：通道在 enterImplement 立项一次（非惰性——首个 tick 就要派 worker）。
      // 名字池/预算账本由通道工厂闭包持有，不挂 run；工单 03 换名重建在**同一通道**上 rebuild（摘名册取新名）。
      // 生命周期（工单 04 / ADR-0121 D4）：通道按会话缓存（this.teamChannels），run 结束不解散
      // 持久队友；本 run 只清自己的收割去重簿记（settledSeen），名册/名字池/预算账本随通道闭包
      // 存续，同会话下一个 run 经 setupTeamChannel 命中缓存按名续接。
      channel: undefined,
      // 团队路径失败韧性（PRD 110 工单 03 / ADR-0121 D3）：LLM 失败不弃会话——
      // 失败先退避重发（同一会话唤醒），连续超限 notify 等用户切模型，救不活才换名重建（有损，最后手段）。
      resilience: { byCard: new Map(), revived: [] },
      // SETTLED 消息收割去重（双路去重：同一卡同一 settle 只收口一次）。
      settledSeen: new Set(), messageHarvestBusy: false,
      // 通知幂等键（工单 05 构建内容 3 / B1）：同 run 同键只投一次；键 → 已投时刻。
      notified: new Map(),
      // 本 run 注入且**仍待领**的通知 id（工单 05 构建内容 4 / B2）：halt/dispose 逐个摘除，
      // 消灭「插件重载后重放过期问候」。
      noticeIds: new Set(),
      // onTeamMessage 的 canSettle/onSettledFor 闭包引用 run 本体（method 定义于类、run 后挂），
      // 由 onTeamMessage 在调用时现场构造——无循环引用问题。
    }
  }

  /** quick 快车道：会话内临时问题/用户口头描述 → 散工单 → 直接进看板流水线（无 PRD）。 */
  async quick(agent, idea, slug) {
    const sessionId = agent.session.id ?? agent.id
    const root = agent.session.header.cwd
    if (!root) throw new Error('jxx-driver: 当前会话没有工作目录（cwd 为空），无法编排')
    if (this.runs.has(sessionId)) throw new Error('本会话已有进行中的编排（/jxx status 查看，/jxx stop 停止）')
    this.assertNoForeignRun(root, sessionId)
    const t = createQuickTicket(root, idea, slug)
    const run = this.newRun(agent, sessionId, root, `quick ${idea.slice(0, 60)}`, 'implement')
    run.featureDir = t.featureDir
    run.quick = true
    this.runs.set(sessionId, run)
    try {
      await this.enterImplement(run)
    } catch (e) {
      this.runs.delete(sessionId)
      throw e
    }
    return { run, ticket: t }
  }

  advance(agent) {
    const sessionId = agent.session.id ?? agent.id
    const run = this.runs.get(sessionId)
    if (!run) throw new Error('本会话没有进行中的编排（/jxx start <想法> 或 /jxx auto <PRD号> 启动）')
    if (run.stopped) throw new Error('编排已停止')
    const gate = this.evalGate(run)
    if (!gate.ok) {
      return { advanced: false, stage: run.stage, missing: gate.missing, hint: '先补齐上述缺口，再 advance' }
    }
    return this.doAdvance(run, gate)
  }

  status(agent) {
    const sessionId = agent.session.id ?? agent.id
    const run = this.runs.get(sessionId)
    if (!run) return { active: false, hint: '本会话没有进行中的编排' }
    const board = run.stage === 'implement' ? this.safeScan(run) : undefined
    return {
      active: true, stage: run.stage, idea: run.idea,
      // 39-02 lossless 面修复（实测「value is not lossless JSON」第二根因）：宿主 lossless JSON
      // walker 对 **undefined 属性值**也判非 lossless（board 缺失 / featureDir 未定 / 无 lastError
      // 的 run 都会踩——implement 之外的 stage 必现），JSON.stringify 会静默丢弃这些键所以测不出；
      // 一律 null 兜底，返回体键集合保持稳定。
      featureDir: run.featureDir ?? null,
      stageHint: this.hints[run.stage],
      createdAt: run.createdAt, updatedAt: run.updatedAt,
      cards: run.cards.size ? [...run.cards.entries()].map(([id, c]) => ({ id, phase: c.phase, retries: c.retries ?? 0 })) : [],
      blocked: run.blocked,
      lastError: run.lastError ?? null,
      // board 只回各泳道卡 id 数组（已是 id 就保留），不回卡对象全文——监控面够用即止
      board: board ? {
        inbox: board.inbox.map((c) => c.id),
        claimed: board.claimed.map((c) => c.id),
        review: board.review.map((c) => c.id),
        held: board.held,
        done: [...board.done],
      } : null,
      // 39-02 监控面瘦身：宿主 MCP 对工具返回体做 lossless JSON 校验（snapshotJsonValue），
      // slice(-20) 全文 history 曾触发「value is not lossless JSON」监控面全瞎——history 截最近
      // 10 条且 event 截 120 字符。undefined 属性值同样会被宿主 walker 拒绝（board 缺失/
      // featureDir 未定/无 lastError 的 run 都会踩），统一 null 兜底；序列化全量史在 run json
      // （control/jxx-driver-runs/）落盘可查，监控面无需重复承载。
      history: run.history.slice(-10).map((h) => ({ t: h.t, event: String(h.event ?? '').slice(0, 120) })),
    }
  }

  async stop(agent) {
    const sessionId = agent.session.id ?? agent.id
    const run = this.runs.get(sessionId)
    if (!run) return { stopped: false, hint: '本会话没有进行中的编排' }
    await this.halt(run, '用户主动停止')
    return { stopped: true }
  }

  /**
   * 用户已恢复（PRD 110 工单 03）：连续失败超限等待窗内——切了模型、或口头说「继续」——
   * 重新 sendMessage 唤醒**同一队友**（上下文零丢失，构建内容 3）；无等待窗 = 无操作提示。
   */
  flowResumed(agent, why = '用户恢复') {
    const sessionId = agent.session.id ?? agent.id
    const run = this.runs.get(sessionId)
    if (!run || run.stopped || run.stage !== 'implement') {
      return { resumed: false, hint: run ? '编排不在 implement 阶段，无需唤醒' : '本会话没有进行中的编排' }
    }
    if (!run.channel) return { resumed: false, hint: '当前是一次性路径，无等待唤醒面' }
    const revived = this.reviveTeamWaiter(run, why)
    if (revived === 0) return { resumed: false, hint: '没有等待恢复的队友（都在跑或无失败记录）' }
    return { resumed: true, revived }
  }

  /** agent/disposed 时清场：停轮询、abort 在飞子会话；并失效该会话的通道缓存
   * （PRD 110 工单 04 规则审查发现项）：缓存闭包持有创建时的 Lead agent 引用，
   * 会话释放后该实例已死，复用即毒缓存（宿主 exact live Lead 校验必拒）。
   * 成员本体仍在宿主 roster（D4 不解散），但插件侧不再复用旧通道；同 session id
   * 重建会话后的新通道由工单 03 的「点名不在册 → 换名重建」路径兜底撞名面。 */
  async onAgentDisposed(agent) {
    const sessionId = agent.session?.id ?? agent.id
    const run = this.runs.get(sessionId)
    if (run) await this.halt(run, '宿主会话已释放')
    if (this.teamChannels.has(sessionId)) {
      this.teamChannels.delete(sessionId)
      this.log.info(`[jxx-driver] 会话已释放，团队通道缓存失效（sessionId=${sessionId}）`)
    }
  }

  async dispose() {
    for (const run of [...this.runs.values()]) await this.halt(run, '插件卸载')
    this.runs.clear()
    this.teamChannels.clear() // 插件卸载才清通道缓存；单 run halt 保留（D4：成员不解散，同会话可续接）
  }

  // ---------- 阶段推进 ----------

  evalGate(run) {
    const since = Date.parse(run.createdAt)
    switch (run.stage) {
      case 'decide':
      case 'adr':
        // adr 段幂等复验：decide 的闸门已验过一次，这里防「ADR 被删/改名后仍推进」（回归：
        // STAGES 列了 adr 而 evalGate 漏 case，run 卡死在 adr 报「未知阶段」——2026-10-03 实测）
        return adrGate(run.root, since)
      case 'prd':
        return prdGate(run.root, since)
      case 'tickets':
        return ticketsGate(run.featureDir)
      case 'ops':
        return opsGate(run.root, Date.parse(run.updatedAt))
      case 'implement':
        return { ok: false, missing: ['implement 阶段由编排器推进，不接受手动 advance；看 /jxx status'] }
      case 'done':
        return { ok: false, missing: ['流程已完成'] }
      default:
        return { ok: false, missing: [`未知阶段 ${run.stage}`] }
    }
  }

  doAdvance(run, gate) {
    const from = run.stage
    const to = STAGES[STAGES.indexOf(from) + 1]
    run.stage = to
    run.updatedAt = nowIso()
    run.history.push({ t: nowIso(), event: `advance：${from} → ${to}` })
    if (to === 'tickets' && gate.featureDir) run.featureDir = gate.featureDir
    this.persist(run)
    this.log.info(`[jxx-driver] ${from} → ${to}`)
    if (to === 'implement') {
      // implement 是异步的：起 watcher，立刻返回
      void this.enterImplement(run).catch((e) => this.failRun(run, `进 implement 失败：${e.message}`))
      return { advanced: true, stage: to, hint: this.hints[to], note: '编排器已接管，开始投卡与 spawn' }
    }
    return { advanced: true, stage: to, hint: this.hints[to] }
  }

  // ---------- implement 编排 ----------

  async enterImplement(run) {
    const board = new Board(this.config.boardScript)
    run.board = board
    if (!existsSync(join(run.root, 'control', 'workspace.json'))) {
      run.history.push({ t: nowIso(), event: '看板不存在，先 init' })
      await board.init(run.root)
    }
    // 投卡（幂等：已存在的卡跳过）
    const tickets = listTickets(run.featureDir)
    const eligible = tickets.filter((t) => t.status === 'ready-for-agent')
    if (eligible.length === 0) {
      this.failRun(run, `${run.featureDir}/issues/ 下没有 Status: ready-for-agent 的工单`)
      return
    }
    for (const t of eligible) {
      const cardId = ticketCardId(run.featureDir, t.base)
      if (run.cards.has(cardId)) continue
      const deps = (t.blockedBy || [])
        .map((n) => tickets.find((x) => ticketNum(x.base) === n))
        .filter(Boolean)
        .map((x) => ticketCardId(run.featureDir, x.base))
      const r = await board.newCard(run.root, { id: cardId, ticketFile: t.file, deps })
      run.cards.set(cardId, { phase: 'open', retries: 0, note: r.created ? '新投' : '已有卡，复用', alive: false })
      run.history.push({ t: nowIso(), event: `投卡 ${cardId}（${r.created ? '新建' : '复用'}）` })
      // 合并卡纳入受管簿记（PRD 111 工单 01 构建内容 2 / BACKLOG #106-C）：曾不在 run.cards，
      // 合并专员中止无重试零痕迹（merge-110-01 实况）。只登记影子账，不提前 newCard——卡文件仍按
      // 原时点在三审过后才投（段 3）；提前投会让复跑 run 把已 done 的合并卡复活（实测红）。
      // 影子账只服务重派面（僵死扫描/回挪/重派上限/前沿重派），收口仍以主卡为准（段 4）。
      const mergeId = mergeIdOf(cardId)
      if (!run.cards.has(mergeId)) {
        run.cards.set(mergeId, { phase: 'open', retries: 0, note: '合并卡影子账（重派面）', alive: false, mergeShadow: true })
      }
    }
    this.persist(run)
    // 团队路径立项（PRD 110 工单 02）：teamMode=auto 且宿主有 agentTeams 才建通道；
    // 惰性解析（无服务的宿主零依赖），建不起来响亮记录并回退一次性路径，不炸编排。
    // 必须先于 startWatcher：首个 tick 会立刻派 worker，通道未建会竞态到一次性路径
    // （实测：先 watcher 后立项 → 首 spawn 报「意外角色」、白耗一次重试预算——2026-10-08 E2E 红转绿的根因）。
    this.setupTeamChannel(run)
    this.startWatcher(run)
    this.notify(run, `进入 implement：${eligible.length} 张工单已投卡，编排器接管。并行上限 ${this.config.parallel}。`
      + (run.channel ? '团队模式：worker/合并专员走持久队友。' : ''), { key: 'stage:implement:enter' })
  }

  /** 团队通道立项（PRD 110 工单 02 / ADR-0121）：服务缺失/构造失败 → run 无通道 = 一次性路径，不抛。 */
  setupTeamChannel(run) {
    if (this.config.teamMode !== 'auto') return
    const teams = resolveAgentTeams(this.ctx)
    if (!teams) return
    // 通道按会话续接（工单 04 / D4）：run 结束不解散持久队友；每 run 新建通道会拿到全新名字池，
    // 对已存在的队友名再 spawnTeammate 必撞宿主「名字永不复用」约束（报错回退一次性路径，白建）——
    // 复用同一通道闭包，名册/池/账本原样续接。
    const cached = this.teamChannels.get(run.sessionId)
    if (cached) {
      run.channel = cached
      run.history.push({ t: nowIso(), event: '团队模式：复用会话既有通道（持久队友按名续接，不解散）' })
      return
    }
    try {
      const channel = createTeamChannel({
        teams,
        agent: run.agent,
        pool: createNamePool({}),
        ledger: createReuseLedger({ reuseLimit: this.config.reuseLimit }),
        provider: this.config.teamProvider,
        log: (msg) => this.log.info(`[jxx-driver] ${msg}`),
      })
      run.channel = channel
      this.teamChannels.set(run.sessionId, channel)
      run.history.push({ t: nowIso(), event: '团队模式：agentTeams 就绪，worker/合并专员走持久队友' })
    } catch (e) {
      // 通道建不起来（参数/宿主异常）→ 响亮记录，回退一次性路径（ADR-0121 D3：不弃编排）
      run.channel = undefined
      this.log.warn(`[jxx-driver] 团队通道建立失败，回退一次性路径：${e.message}`)
      run.history.push({ t: nowIso(), event: `团队通道建立失败，回退一次性路径：${e.message}` })
    }
  }

  startWatcher(run) {
    if (run.timer) return
    run.timer = setInterval(() => {
      void this.tick(run).catch((e) => {
        run.lastError = e.message
        this.log.warn(`[jxx-driver] tick 异常：${e.message}`)
      })
    }, this.config.pollIntervalMs)
    if (typeof run.timer.unref === 'function') run.timer.unref()
    void this.tick(run).catch(() => {})
  }

  async tick(run) {
    if (run.stopped || run.stage !== 'implement') return
    if (run._ticking) return
    run._ticking = true
    try {
      await this.tickInner(run)
    } finally {
      run._ticking = false
    }
  }

  async tickInner(run) {
    const board = run.board
    const b = scanBoard(run.root)
    const managed = (id) => run.cards.has(id)
    // （原局部 lambda mergeIdOf 已删——它曾遮蔽导入的 mergeIdOf，R2 重审发现项；直接用模块级归一助手）

    // 0) 清扫：worker 已 settle 但卡面仍停在 inbox（没领成）→ 回 open 等下一圈重派
    for (const c of b.inbox.filter((x) => managed(x.id) && !x.id.startsWith('merge-'))) {
      const rec = run.cards.get(c.id)
      if (rec && rec.phase === 'claimed' && !rec.alive) rec.phase = 'open'
    }

    // 1) held 依赖已齐 → 释放回 inbox（board.mjs 依赖闸门语义的补位）
    for (const id of b.held.filter(managed)) {
      const file = join(run.root, 'control', 'held', `${id}.md`)
      const deps = cardDeps(readFileSync(file, 'utf8'))
      if (deps.length > 0 && deps.every((d) => b.done.has(d))) {
        await board.cardMove(run.root, { id, to: 'inbox', reason: 'jxx-driver: 依赖已就绪，自动释放' })
        run.history.push({ t: nowIso(), event: `释放 held 卡 ${id}` })
        this.persist(run)
      }
    }

    // 2) 交付（卡到 .review.md）→ 起三维审查
    for (const c of b.review.filter((x) => managed(x.id))) {
      const rec = run.cards.get(c.id)
      if (!rec || rec.phase === 'reviewing' || rec.phase === 'merging' || rec.phase === 'done' || rec.phase === 'blocked') continue
      rec.phase = 'reviewing'
      rec.reviewResults = {}
      this.spawnReviewers(run, c.id)
      run.history.push({ t: nowIso(), event: `${c.id} 交付，起三维审查` })
      this.persist(run)
    }

    // 3) 审查结论收口（三维齐才评）
    for (const [id, rec] of run.cards) {
      if (rec.phase !== 'reviewing' || !rec.reviewResults) continue
      const dims = reviewerDims()
      if (!dims.every((d) => rec.reviewResults[d])) continue
      const allPass = dims.every((d) => rec.reviewResults[d].verdict === 'PASS')
      if (allPass) {
        rec.phase = 'merging'
        if (this.config.autoMerge) {
          const mergeId = mergeIdOf(id)
          await board.newCard(run.root, { id: mergeId, level: 'L1', keepInbox: true })
          // 首派不挂影子 alive 闸：spawnMerger 完成即返回，一次性路径回调（含失败回挪）走 onMergerSettled
          this.spawnMerger(run, id, mergeId)
          run.history.push({ t: nowIso(), event: `${id} 三审全过，投合并卡 ${mergeId}` })
        } else {
          rec.phase = 'await-human-merge'
          run.blocked.push(`${id} 三审全过，autoMerge=false，待人工合并`)
          this.notify(run, `卡 ${id} 三审全过；autoMerge=false，请人工合并。`, { key: `card:${id}:await-human-merge` })
        }
      } else {
        rec.retries = (rec.retries || 0) + 1
        if (rec.retries > this.config.maxRetries) {
          rec.phase = 'blocked'
          const failedDims = dims.filter((d) => rec.reviewResults[d].verdict !== 'PASS')
          run.blocked.push(`${id} 审查不过（${failedDims.join('/')}），返工超限转人工`)
          this.notify(run, `卡 ${id} 审查 ${failedDims.join('/')} 不过，已达返工上限，转人工。`, { key: `card:${id}:rework-overlimit` })
          this.log.warn(`[jxx-driver] ${id} 审查返工超限`)
        } else {
          const findings = dims
            .filter((d) => rec.reviewResults[d].verdict !== 'PASS')
            .map((d) => `- ${d}: ${rec.reviewResults[d].reason || '有发现项（详见卡内流转段）'}`)
            .join('\n')
          rec.phase = 'open'
          rec.reviewResults = undefined
          await board.cardMove(run.root, { id, to: 'claimed', reason: `jxx-driver: 审查发现项，第 ${rec.retries} 次返工` })
          run.history.push({ t: nowIso(), event: `${id} 审查不过，第 ${rec.retries} 次返工` })
          this.spawnWorker(run, id, `\n\n---\n返工原因（第 ${rec.retries} 次）：审查未过，发现项：\n${findings}\n`)
        }
      }
      this.persist(run)
    }

    // 4) 合并收口：合并卡 done → 编排者把开发卡移 done（PROTOCOL §5.2-7）
    for (const [id, rec] of run.cards) {
      if (rec.phase !== 'merging' || rec.mergeShadow) continue
      const mergeId = mergeIdOf(id)
      if (b.done.has(mergeId) || b.done.has(id)) {
        if (!b.done.has(id)) {
          await board.cardMove(run.root, { id, to: 'done', reason: 'jxx-driver: 合并完成，编排收口' })
        }
        rec.phase = 'done'
        run.history.push({ t: nowIso(), event: `${id} 已合并 done` })
        this.persist(run)
        continue
      }
      // 合并专员已 settle 但合并卡没进 done → 看是否被 blocked（带 needs-info）。
      // #106-C「中止即报」已由 onMergerSettled(err) 路即时处置（回挪+notify+重派），此处的 10 分钟
      // 超时面只兜「settle 成功但合并卡迟迟不进 done」的面；onMergerSettled 置位前 mergeSettledAt=undefined 不进此块
      if (rec.mergeSettledAt) {
        const mergeFile = join(run.root, 'control', 'cards', 'open', `${mergeId}.md`)
        const mergeBlocked = existsSync(mergeFile) && /-\s*labels:.*needs-info/.test(readFileSync(mergeFile, 'utf8'))
        const stuckMs = Date.now() - Date.parse(rec.mergeSettledAt)
        if (mergeBlocked || stuckMs > 10 * 60_000) {
          // 主卡账保持 merging（曾误写 rec.phase='blocked'——会把后续合并卡重派的收口挡死）；
          // 超时面只降级合并卡本身：回待领位（needs-info）+ 下 tick 由合并卡前沿重派（#106-C 自愈）
          const mergeRec = run.cards.get(mergeId)
          if (mergeRec && !mergeRec.alive) {
            mergeRec.phase = 'open'
            mergeRec.retries = (mergeRec.retries || 0) + 1
            await this.selfHealReturnToInbox(run, mergeId, { to: 'inbox', reason: `jxx-driver: 合并专员 settle 后 ${Math.round(stuckMs / 60000)} 分钟未收口，回挪重派` })
          }
          run.blocked.push(`${id} 合并未收口（合并卡 ${mergeId} 未进 done），合并卡已回挪待重派`)
          this.notify(run, `卡 ${id} 的合并卡 ${mergeId} 未收口（${mergeBlocked ? '被转人工' : 'settle 后超 10 分钟'}），已回挪待领位自动重派。${HUMAN_TAKEOVER_HINT}`, { key: `merge:${mergeId}:unsettled` })
          rec.mergeSettledAt = undefined
          this.persist(run)
        }
      }
    }

    // 5) 就绪前沿：inbox 可领卡 + 空闲并行位 → spawn worker（合并卡重派同构受管，#106-C）
    const activeWorkers = [...run.cards.values()].filter((c) => c.phase === 'claimed' && c.alive && !c.mergeShadow).length
    let freeSlots = this.config.parallel - activeWorkers
    for (const c of b.inbox.filter((x) => managed(x.id) && !x.id.startsWith('merge-'))) {
      if (freeSlots <= 0) break
      const rec = run.cards.get(c.id)
      if (rec.phase !== 'open' || rec.alive) continue
      this.spawnWorker(run, c.id)
      freeSlots -= 1
    }
    // 合并卡回挪重派（#106-C 自愈）：本 tick 的 b.inbox 快照可能早于本 tick 内异步回挪——
    // 重新扫一次 open/ 确保刚回挪的合并卡下一 tick（而非再下一 tick）就被前沿看到
    const bNow = scanBoard(run.root)
    for (const c of bNow.inbox.filter((x) => managed(x.id) && x.id.startsWith('merge-'))) {
      const rec = run.cards.get(c.id)
      if (!rec || rec.phase !== 'open' || rec.alive) continue
      if (rec.resilienceOwned) continue // 韧性链在管（退避计时/等待窗）——前沿不抢（工单 03 语义）
      const devId = devIdOf(c.id)
      const devRec = run.cards.get(devId)
      if (!devRec || devRec.phase !== 'merging') continue // 主卡不在合并窗（已被回挪降级/收口）→ 不派
      if (devRec.mergeSettledAt !== undefined) continue // 首派 settle 成功后走段 4 收口/超时面，不经前沿重派（防 done 竞速窗口复活，R3 实录）
      if ((rec.retries || 0) > this.config.maxRetries) {
        // 重派预算 = 影子账 retries（写点仅本循环之外的 3 处：段 4 未收口超时面 / 段 6 僵死面 /
        // onMergerSettled 失败路；三处细节见各自注释——其中段 6 与失败路之间另有 mergeFailedAt
        // 互斥，防同一次失败被两处各记一次）。前沿只读不写：否则一次失败被记两次，maxRetries=1 时
        // 重派一发出即误判超限（R3 调试实证）
        rec.phase = 'blocked'
        run.blocked.push(`${c.id} 合并卡重派超限（失败 ${rec.retries}/${this.config.maxRetries}），转人工`)
        this.notify(run, `合并卡 ${c.id} 重派已达上限，转人工。${HUMAN_TAKEOVER_HINT}`, { key: `merge:${c.id}:redispatch-overlimit` })
        // spec 审查发现项 2：转人工必须落到卡位与 triage 面上——三态板的阻塞列由 labels 的
        // needs-info 表达（PROTOCOL §0），只改卡账会让该卡留在「待领取」列、verify 第 5 路也不报警
        await this.selfHealReturnToInbox(run, c.id, { to: 'blocked', reason: 'jxx-driver: 合并卡重派超限，回待领位转人工' })
        this.persist(run)
        continue
      }
      this.spawnMerger(run, devId, c.id)
      break // 本 tick 最多重派一张合并卡（重派是异步的，防止同 tick 内重复入队）
    }

    // 6) 僵死重 spawn：claimed 卡超时且无存活 worker（#106-C：合并卡同构受管——与开发卡同一判据面）。
    // 判死面 = 物理 claimed（合并专员真把卡领走了）+ **影子不在飞** + **队友不在跑**（团队路径）
    // + 主卡仍在合并窗且本轮未 settle + 卡 mtime 超 staleMinutes（领走后零推进）。
    // 为什么必须换掉旧守卫：旧式 `rec.phase !== 'claimed'` 比的是**影子账 phase**，而它是「重派路由位」
    // （写面仅 open/blocked，全文无 claimed 写路径）⇒ 守卫恒真、整段退化成死代码。这正是 R1 三维审查
    // std#1 与 rule#1 独立同判的阻断项（团队路径：合并专员领卡后静默死亡 ⇒ 零自愈/零 notify/零重派）。
    // 为什么 alive 单闸不够、必须再叠**队友存活探针**（PRD 111 修订 1 / D6「同一张卡同一时刻只有一个
    // 在飞轮次」，不可让步；R2 三维审查 spec 维度 High#1）：团队路径 dispatch **投递成功**即清
    // shadow.alive，而「投递成功 ≠ 回合存活」——此后 alive=false 与轮次是否在跑无关，单凭 alive+卡面
    // 静默会把合法耗时超过 staleMinutes 的**长合并回合**判死重派（实证 mergerCalls 1→2，两个合并专员
    // 可能同时动同一分支），默认档下还会把仍在工作的回合误判「超限转人工」。
    // 故判死前问宿主「这位队友还在跑吗」（roundInFlight：名单里 status==='running' ⇒ 让位）。
    // D6 覆盖边界（如实声明，勿夸大）：本段（僵死面）是 D6 的**判死侧**守护——队友仍在跑 ⇒ 不让位，
    // 判死重派只会有一个在飞轮次。**但段 5 就绪前沿的合并卡重派循环另有 D6 缺口**：合并卡是
    // `keepInbox: true` 投的，队友被投递后**尚未把卡挪走**时卡仍在物理 open/，而 dispatch 已清
    // shadow.alive ⇒ 前沿每 tick 重投指令（R5 spec 复审实证：4s 内 65 次重复派发、该循环
    // 从不消费存活信号）。该循环与本单父提交**逐字节相同**，且 PRD 111 修订 1 明写「派发代际闸
    // （rec.gen + 在飞闸，含团队路径 inFlight 拒重投）」归**工单 05** ⇒ 本单**不修、也不声称已修**。
    // 覆盖边界（如实声明，勿夸大）：团队路径（ADR-0121 默认形态）两卡种均自愈——成员失联
    // （inactive/failed/查无此人）即放行判死；成员仍在跑则让位。**一次性路径**（teamMode=off / 宿主无
    // agentTeams）无成员观测面（roundInFlight 走 alive 位兜底）⇒ 自愈仍受 `alive` 闸约束：合并轮 alive
    // 只在 onMergerSettled 归位，挂死轮次永不清位 ⇒ 该形态不自愈，长挂由人工/停止清场面兜底。
    // 转人工有**两个出口**，落法同源（回待领位 + needs-info + run.blocked 落账），按哪一面先判到为定：
    //   ① 本段僵死面超限（staleAttempt > maxRetries）——回挪前就已烧完预算，就地转人工；
    //   ② 前沿重派超限（就绪前沿的合并卡重派分支）——回挪成功、点开重派时才发现预算已尽。
    const now = Date.now()
    for (const c of b.claimed.filter((x) => managed(x.id) && x.id.startsWith('merge-'))) {
      const rec = run.cards.get(c.id)
      if (!rec) continue
      // 重入守卫（R2 三维审查 std#1：与开发卡侧同构，此前合并侧缺此闸 ⇒ 回挪持续失败时无界循环）：
      // 本段只接管「仍在合并窗、状态机尚未判终局」的卡（影子 phase=open 是重派路由位）。
      // 一旦判成 blocked（超限转人工），下一 tick 不再重入——否则 cardMove 抛错被
      // selfHealReturnToInbox 有意吞掉后返回 false，卡物理位留在 claimed、守卫又只看 alive，
      // 就会每 tick 重复「retries++ → blocked.push → notify → 回挪再失败」（实测 5 秒 +79 次）。
      if (rec.phase !== 'open') continue
      const devRec = run.cards.get(devIdOf(c.id))
      if (!devRec || devRec.phase !== 'merging') continue // 主卡不在合并窗（已收口/已降级）→ 不接管
      // 韧性链在管（退避计时/等待窗）→ 重派面不抢（工单 03 语义，与前沿重派同一互斥闸）
      if (rec.resilienceOwned) continue
      // 本轮已 settle（成功回传）→ 交段 4 的收口/10 分钟超时面，绝不在僵死面重派：那会与
      // done 竞速窗口抢跑，把已收口的合并卡复活（R3 调试实录的同型风险）
      if (devRec.mergeSettledAt !== undefined) continue
      // 在飞判据（R2 spec 审查 High#1）：团队路径看成员 status（队友 inactive/failed ⇒ 失联放行），
      // 一次性路径退回 alive 位（与 HEAD 同语义，零行为漂移）。判据实现见 roundInFlight 注释。
      if (this.mergerRoundInFlight(run, devRec, rec)) continue
      // 卡面仍新鲜（领走后有推进）⇒ 不判死。此闸在僵死/终局两分支之前：既保住「不误杀在干活
      // 的轮次」的既有语义，也让下面的幂等终局**只在该卡真的静默超时后**才落下
      // （避免与失败路那次可能仍在飞行中的 cardMove 竞速）。
      if (now - c.mtime < this.config.staleMinutes * 60_000) continue
      // 这一轮是否已由失败路落过账？是则**本段不重复计数**（同一次失败被失败路与本段各 +1
      // 就是「一次失败扣两次预算」——生产默认 maxRetries=1 下只失败 1 次即 retries=2 > 1
      // 直接转人工，本该保留的那次重派被白扣，R2 rule 审查严重发现项）。
      // 但**不能只 `continue` 让位**（R3 rule 审查严重发现项 F1）：失败路的回挪可能失败
      // （卡被人工动过/权限问题等），此时卡物理位仍在 claimed/ 而卡账 phase 已被失败路置回 open
      // —— 就绪前沿只扫物理 open/ 面 ⇒ 看不见它；若本段也无条件让位，就再没有面接管，
      // 卡永久滞留「处理中」（实测：静置 10s / ~200 tick 零动作、零终局、零重派、零通知），
      // 正是本单要根治的静默死亡形态。故命中该标记时做**幂等终局**：不计数、不重派，
      // 但把本轮判为 blocked 转人工（回待领位 + needs-info），保证有界收敛。
      // 卡面对账的**条件性**（R6 spec 复审发现项 1，勿读成无条件）：needs-info 随 `cardMove` 落到
      // labels 行；若该次物理回挪本身失败（`selfHealReturnToInbox` 有意吞错只留痕），卡会留在
      // `.claimed.md` 且 labels 行不带 needs-info ⇒ 此分支下「卡面可对账」**不成立**，只能靠
      // `run.blocked` 落账 + history 留痕对账（卡账已 blocked，三态板阻塞列按 labels 改道收不到它）。
      // 取舍：不在终局里硬改 labels（绕过 card-move 单源会与看板锁/竞速面打架），
      // 该残形态由人工按 run.blocked 处置。
      // 幂等由 `mergeFailedHandledAt` 保证：同一轮失败只判终局一次，不每 tick 重复落账。
      if (devRec.mergeFailedAt !== undefined) {
        if (devRec.mergeFailedHandledAt === devRec.mergeFailedAt) continue // 本轮已判过终局
        devRec.mergeFailedHandledAt = devRec.mergeFailedAt
        rec.phase = 'blocked'
        run.blocked.push(`${c.id} 合并专员失败后卡位未推进（${devRec.mergeFailedAt}），转人工（预算不重复扣）`)
        run.history.push({ t: nowIso(), event: `${c.id} 合并专员失败后卡位未推进，转人工（幂等终局，不重复计数）` })
        this.notify(run, `合并卡 ${c.id} 本轮已失败（${devRec.mergeFailedAt}）且卡位超时未推进，转人工处理；不重复重派以免双跑。${HUMAN_TAKEOVER_HINT}`, { key: `merge:${c.id}:failed-idempotent-terminal` })
        await this.selfHealReturnToInbox(run, c.id, { to: 'blocked', reason: 'jxx-driver: 合并轮已失败且卡位未推进，回待领位转人工' })
        this.persist(run)
        continue
      }
      rec.retries = (rec.retries || 0) + 1
      const staleAttempt = rec.retries
      rec.lastFailure = `僵死超 ${this.config.staleMinutes} 分钟无回传（合并卡）`
      if (staleAttempt > this.config.maxRetries) {
        // 重试上限对合并卡同构生效（工单《构建内容 2》）：僵死面自己也要有终局出口——只依赖
        // 「前沿重派超限分支」会在回挪失败时留下无界循环（卡物理位一直在 claimed、前沿看不到它，
        // 每 tick 重复判死 + 烧计数）。此处直接转人工：回待领位 + needs-info，卡面可读、verify 可对账
        rec.phase = 'blocked'
        run.blocked.push(`${c.id} 合并卡僵死且重试超限（${staleAttempt}/${this.config.maxRetries}），转人工`)
        this.notify(run, `合并卡 ${c.id} 的合并专员领卡后超 ${this.config.staleMinutes} 分钟无回传，重试已超限，转人工。${HUMAN_TAKEOVER_HINT}`, { key: `merge:${c.id}:stale-overlimit` })
        await this.selfHealReturnToInbox(run, c.id, { to: 'blocked', reason: 'jxx-driver: 合并卡僵死超限，回待领位转人工' })
        this.persist(run)
        continue
      }
      rec.phase = 'open'
      run.history.push({ t: nowIso(), event: `${c.id} 合并卡僵死（第 ${staleAttempt} 次失败），回挪重派` })
      const moved = await this.selfHealReturnToInbox(run, c.id, { to: 'inbox', reason: 'jxx-driver: 合并卡僵死，回挪重派' })
      // 键含失败次数：每次僵死各投一次（真事件不得被去重吃掉）
      this.notify(run, `卡 ${c.id} 的合并专员领卡后超 ${this.config.staleMinutes} 分钟无回传（第 ${staleAttempt} 次失败），${moved ? '合并卡已回挪待领位自动重派' : '回挪未执行（交前沿/人工面兜底）'}；若连续僵死将转人工。${HUMAN_TAKEOVER_HINT}`, { key: `merge:${c.id}:stale-${staleAttempt}` })
      this.persist(run)
    }
    // 39-02 首派型僵死扫描位补全：卡仍在 inbox 但卡账已 claimed 的形态（团队路径 dispatch 成功
    // 而 worker 从不领卡——39-01 实测 run 冻结 40+ 分钟的原始形态）此前零覆盖：本段只扫物理
    // claimed 面，首派型僵死卡永远进不了僵死面。并入扫描位；一次性路径不受影响（其卡账 claim
    // 只在 worker 真领卡后发生，无此形态）。
    const claimedStaleCandidates = [
      ...b.claimed.filter((x) => managed(x.id) && !x.id.startsWith('merge-')),
      ...(run.channel ? b.inbox.filter((x) => managed(x.id) && !x.id.startsWith('merge-')) : []),
    ]
    for (const c of claimedStaleCandidates) {
      const rec = run.cards.get(c.id)
      if (!rec || rec.phase !== 'claimed') continue
      // 在飞判据（R2 spec 审查 High#2）：团队路径看成员 status（队友领卡后静默挂死 ⇒ inactive ⇒
      // 本段接管自愈）；一次性路径退回 alive 位（与 HEAD 同语义，零行为漂移）
      if (this.devRoundInFlight(run, c.id, rec)) continue
      if (now - c.mtime < this.config.staleMinutes * 60_000) continue
      rec.retries = (rec.retries || 0) + 1
      if (rec.retries > this.config.maxRetries) {
        rec.phase = 'blocked'
        run.blocked.push(`${c.id} 僵死超 ${this.config.staleMinutes} 分钟且重试超限，转人工`)
        // spec 审查发现项 1（同根第三处）：终局面同样要动物理卡位——只改卡账会让卡滞留
        // 「处理中」泳道且前沿/僵死两面都不再接管（前沿只收 open、僵死只收 claimed）= 本单要根治的死锁
        await this.selfHealReturnToInbox(run, c.id, { to: 'blocked', reason: 'jxx-driver: 僵死超限，卡位回待领位转人工' })
        // spec 审查低项留痕：僵死超限走 maxRetries 面、不置 st.waiting——用户「继续」只能唤醒
        // waiting 卡；此 notify 的唤醒承诺仅在「曾发生派发失败（挂过等待窗）」时兑现，纯 stale 不承诺
        this.notify(run, `卡 ${c.id} 僵死超过 ${this.config.staleMinutes} 分钟，重试已超限，转人工。若编排器曾上报过「等待用户恢复」类连续失败（等待窗内说「继续」可唤醒同一队友），可在切换模型后让我继续；纯无响应僵死请人工核查卡面后重投。`, { key: `card:${c.id}:stale-overlimit` })
      } else {
        // 轮次无 SETTLED 回传且卡位无推进（构建内容 1 的 stale 面）：记入该卡连续失败计数，
        // 重派失败会接续退避/等待/换名重建链；重派本身仍走既有 spawnWorker（幂等重领卡）
        const st = this.resilienceState(run, c.id)
        st.failures += 1
        st.role = 'dev'
        st.fail = st.fail ?? this.failHandlerOf(run, c.id, 'dev')
        rec.lastFailure = `僵死超 ${this.config.staleMinutes} 分钟无回传（卡 mtime 无推进）`
        run.history.push({ t: nowIso(), event: `${c.id} 僵死（第 ${st.failures} 次失败），重 spawn` })
        this.spawnWorker(run, c.id)
      }
      this.persist(run)
    }

    // 7) 全部收口 → 进 ops（合并卡影子账只服务重派面，不参与 allDone 判定；
    // blocked 等人工的卡也挡 ops——编排未收口，不能假设人工面会替它跑完）
    const allDone = run.cards.size > 0
      && [...run.cards.values()].every((c) => c.phase === 'done' || c.mergeShadow)
    if (allDone) {
      run.stage = 'ops'
      run.updatedAt = nowIso()
      // 生命周期（工单 04 / ADR-0121 D4）：run 结束**不**解散持久队友——成员留在宿主 roster，
      // 同会话下一个 run 按名续接；只清本 run 的收割去重簿记（settledSeen）与在飞集（应已空，
      // 卡全 done 即全部 settle 出册）。通道对象本身随 run 存续到 halt/dispose 再清。
      run.settledSeen?.clear()
      run.history.push({ t: nowIso(), event: '全部工单 done，进 ops（持久队友不解散，同会话下个 run 按名续接）' })
      if (run.timer) { clearInterval(run.timer); run.timer = undefined }
      this.persist(run)
      this.notify(run, `全部工单已合并收口。进入运维收尾：请写回顾（docs/retro/），然后 jxx_flow(action=advance)。`, { key: 'stage:ops:enter' })
    }
  }

  safeScan(run) {
    try { return scanBoard(run.root) } catch { return undefined }
  }

  /**
   * 死亡自愈回挪（PRD 111 工单 01 构建内容 1 / BACKLOG #106-A）：失败落账后把卡挪回待领位，
   * 由就绪前沿自动重派（消灭「重试后卡滞留 claimed 静默死亡」实况）。一次性与团队两路共用；
   * 物理挪卡失败（卡被人工动过/已收口等）只留痕不拖死收口链。
   */
  async selfHealReturnToInbox(run, cardId, { to = 'inbox', reason }) {
    // to 透传 board.mjs 语义：inbox = 回待领位重派；blocked = 回待领位 + needs-info（等待窗保留转人工标记）
    const target = to === 'blocked' ? 'blocked' : 'inbox'
    // 收口守卫（R3 调试实证）：失败回调与卡位推进竞速时，卡可能已被 fixture/人工收口进 done/——
    // 对已收口卡执行 cardMove(inbox) 会把它从 done/ 复活回 open/（merge-95 调试实录），必须跳过
    const doneDir = join(run.root, 'control', 'cards', 'done')
    const archivedDir = join(run.root, 'control', 'cards', 'archived')
    if (existsSync(join(doneDir, `${cardId}.md`)) || existsSync(join(archivedDir, `${cardId}.md`))) {
      run.history.push({ t: nowIso(), event: `死亡自愈：${cardId} 已收口/归档，跳过回挪（竞速守卫）` })
      return false
    }
    try {
      await run.board?.cardMove(run.root, { id: cardId, to: target, reason })
      run.history.push({ t: nowIso(), event: `死亡自愈：${cardId} 卡位已回挪 ${target}（${reason}）` })
      return true
    } catch (e) {
      run.history.push({ t: nowIso(), event: `死亡自愈：${cardId} 回挪失败（${e.message}）——卡可能已被人工处置，交前沿/人工面兜底` })
      this.log.warn(`[jxx-driver] ${cardId} 死亡自愈回挪失败：${e.message}`)
      return false
    }
  }

  // ---------- spawn ----------

  spawnWorker(run, cardId, extraNote = '') {
    const rec = run.cards.get(cardId)
    // 在飞闸（工单 05 构建内容 2 / A 防重入，ADR-0122 D6）：**已有真在飞轮次**时不重复派发。
    // 判据是「通道记名集合 ∩ 轮次仍健在」的**合取**，两个条件各有分工：
    //  - `inFlightOf(cardId)`：按卡记名、显式出册的**集合语义**——比 `rec.alive` 单轮布尔强（后者会被
    //    陈旧 done 误清，见 spawn() 代际闸的 A 根因实证）；
    //  - `devRoundInFlight(run, cardId, rec)`：轮次**真的还在跑**的统一存活判据（团队路问宿主 roster；
    //    一次性路/alive 兜底）。
    // 只取前者会把「簿记未出册但队友已死」的**僵死自愈重派**一起挡掉（39-02 看门狗实测：dispatch
    // 成功但 worker 恒 inactive，inFlight 里那张卡永不自行出册 ⇒ 自愈链被自己的防重入闸锁死）。
    // 故存活判据为假时视为「陈旧簿记」，放行重派（这正是看门狗要做的清账动作），并把它作为
    // `allowInFlight` 传给通道，越过通道侧的同一道闸。
    // 返工/重试等**显式**重发走 `resendTeamDirective`（dispatch resend=true），不经本闸。
    let staleBookkeeping = false
    if (run.channel && run.channel.inFlightOf?.(cardId) === true) {
      if (this.devRoundInFlight(run, cardId, rec)) {
        run.history.push({ t: nowIso(), event: `${cardId} 已有在飞轮次，跳过重复派发（在飞闸）` })
        this.persist(run)
        return
      }
      staleBookkeeping = true // 簿记在册但轮次已不在跑 ⇒ 陈旧账，本次重派顺带清账
    }
    rec.phase = 'claimed'
    rec.alive = true
    rec.spawnedAt = nowIso()
    if (run.channel) {
      // 39-02 取舍留痕（派发成功 ≠ worker 在跑）：此处不采用「派发后置 alive=false」——
      // 清扫段（tick 0）与就绪前沿都以 alive 挡在飞派发，清位须另引第三种在飞标记（与通道
      // inFlight 语义重复）；僵死兑付改由看门狗在飞判据承担：团队路径轮次存活问宿主
      // roster（devRoundInFlight → roundInFlight），alive=true 不再是免死金牌。
      // 团队路径（PRD 110 工单 02）：worker 走持久队友——点名队友（返工/重试）→ sendMessage 复用，
      // 无点名 → 通道自派（复用同角色未超预算者或取新名 spawnTeammate）。
      // 失败不弃编排：通道抛错 → 响亮记录后回退一次性路径（D3 的重试/唤醒语义是工单 03）。
      const controller = new AbortController()
      run.controllers.add(controller)
      // 重试附失败原因（构建内容 3）：返工发现项走 extraNote；上次失败原因走 lastFailure
      const retryNote = extraNote || (rec.lastFailure ? `上次失败原因：${rec.lastFailure}` : '')
      void run.channel.dispatch({
        role: 'dev',
        name: rec.memberName,
        cardId,
        poolSize: this.config.parallel, // worker 池 = parallel（工单 02 构建内容 2：各领卡串行）
        prompt: rec.memberName
          ? memberDirective(cardId, retryNote)
          : workerPrompt(run.root, cardId, { member: true }) + extraNote,
        signal: controller.signal, // 宿主契约必填（AbortSignal.any 对 undefined 抛 TypeError，终审发现项①）
        allowInFlight: staleBookkeeping, // 轮次已被判死（陈旧簿记）⇒ 越过通道侧在飞闸重派清账
      }).then((r) => {
        run.controllers.delete(controller)
        rec.memberName = r.name
        rec.lastFailure = undefined
        this.resilienceReset(run, cardId)
        run.history.push({ t: nowIso(), event: r.fresh ? `team: spawn worker ${cardId}（${r.name}）` : `team: 指令下发 ${cardId} → ${r.name}` })
        this.persist(run)
      }).catch(async (e) => {
        run.controllers.delete(controller)
        // 返工上下文（extraNote）记卡账：重发/重建/兜底三路都必须带上，不能只随本次调用蒸发
        if (extraNote) rec.reworkNote = extraNote
        if (run.dispatchFrozen) { this.persist(run); return } // stop 后不再走失败处置/回退派发（工单 04 生命周期收口）
        try {
          await this.safeHandleFailure(run, cardId, e, {
            role: 'dev',
            fail: this.failHandlerOf(run, cardId, 'dev') // fail 处置单源：failHandlerOf 按 cardId 语义落账
          })
        } catch (healErr) {
          this.log.warn(`[jxx-driver] ${cardId} 死亡自愈处置异常：${healErr.message}`)
        }
        this.persist(run)
      })
      return
    }
    const prompt = workerPrompt(run.root, cardId) + extraNote
    this.spawn(run, { role: 'dev', cardId, prompt, onSettled: (text, err) => { this.onWorkerSettled(run, cardId, text, err).catch((e2) => this.log.warn(`[jxx-driver] ${cardId} 收口回调异常：${e2.message}`)) } })
    run.history.push({ t: nowIso(), event: `spawn worker ${cardId}` })
    this.persist(run)
  }

  spawnReviewers(run, cardId) {
    // 在飞闸的**reviewer 排除依据**（R1 spec 审查发现项 3，如实留痕）：
    // 本函数不做「记名集合 ∩ 存活判据」式防重入，与 dev/merger 不对称——这是**架构自洽**而非疏漏：
    //  ① 前沿对 reviewer 的防重入闸 = `rec.phase === 'reviewing'`（见 tickInner 审查段：置相位与
    //     调用本函数**同步相邻**，中间无 await 窗口 ⇒ 不存在「已置 reviewing 又被再派」的交错）；
    //  ② reviewer 在团队模式下也走**一次性 spawn**（不上通道 dispatch）⇒ 通道 `inFlight` 里
    //     从来就没有 reviewer 键，「按卡记名集合」对它恒为空，故该判据对它**无定义**；
    //  ③ 代际闸同样排除 reviewer（三维是**同卡并行扇出**，共享代际会互相判陈旧 —— 见 spawn() 注释）。
    // 若将来 reviewer 改走通道派发，必须在此补对称判据（届时 ①②③ 三条前提需同步复核）。
    for (const dim of reviewerDims()) {
      const prompt = reviewerPrompt(run.root, cardId, dim)
      this.spawn(run, {
        role: `reviewer-${dim}`, cardId, prompt,
        onSettled: (text, err) => this.onReviewerSettled(run, cardId, dim, text, err),
      })
    }
    run.history.push({ t: nowIso(), event: `spawn 3 审查者 ${cardId}` })
    this.persist(run)
  }

  spawnMerger(run, cardId, mergeId) {
    const rec = run.cards.get(cardId)
    rec.mergeSettledAt = undefined
    rec.mergeFailureNote = undefined
    rec.mergeFailedAt = undefined // 新一轮开跑：清上一轮的失败标记（段 6 以此识别「本轮是否已失败过」）
    rec.mergeFailedHandledAt = undefined
    const shadow = run.cards.get(mergeId)
    // 影子账生命周期口径（R1 三维审查 rule#2 纠偏：旧注释称「清位/回 open 只看 onMergerSettled」，
    // 与同文件其它面的写点不符——R2 rule 审查再纠「单源管理」措辞过强：置在飞确为 spawnMerger
    // **单源**，但清在飞不止 onMergerSettled，故按实况写全，不再声称单源）：
    //  - 置在飞：**仅本处**（alive=true；phase 不动——phase 是重派路由位，写面只有 open/blocked）；
    //  - 清在飞：本处两条派发路的回调——团队路 dispatch 的 .then/.catch、一次性路 onMergerSettled
    //    （成功 settle 置 mergeSettledAt / 失败回挪）。**段 6 僵死面不清 alive**（它以 `rec.alive`
    //    为否决闸，见该段注释：卡面静默无法区分「轮次挂了」与「轮次在干长活」，清位即等于允许双跑）；
    //  - 回 open：onMergerSettled 失败回挪面；终局转人工则是 blocked。
    // 注意：另有两条合并派发入口（resendTeamDirective 的 merger 分支、spawnFallback('merger')）
    // 走的是「同一轮的续发/兜底重建」，**不在此处置位**——它们的轮次存活由段 6 的队友存活探针
    // （roundInFlight 的成员观测面）与卡位信号判定，不依赖本处 alive 置位（R2 rule 审查发现项 2）。
    if (shadow) shadow.alive = true
    if (run.channel) {
      // 团队路径（PRD 110 工单 02 / ADR-0121 D2）：合并专员持久队友化——同名复用，
      // 超预算时通道自派停发换新名 fresh 后继（交接上下文 = 指令点名合并卡）。
      //
      // 在飞闸逃生口（与 spawnWorker 同源）：段 6 僵死面/重派面判死一张合并卡后**必须能重派**
      // （那正是清陈旧簿记的动作）。通道的 inFlight 对合并卡键（merge- 前缀）同样会因「投递成功但
      // 队友从不动作」而永不自行出册；若在此硬拒，合并卡僵死自愈会被自己的防重入闸锁死
      // （本轮实测：段 6 判死 → 回挪 → 前沿重派被 dispatch 拒绝 ⇒ 卡回不来，run 不收口）。
      // 判据与 spawnWorker 一致：**轮次已被证明不在跑**时才放行（`mergerRoundInFlight` 为假）。
      const mergerStaleBookkeeping = run.channel.inFlightOf?.(mergeId) === true
        && !this.mergerRoundInFlight(run, rec, shadow)
      const controller = new AbortController()
      run.controllers.add(controller)
      void run.channel.dispatch({
        role: 'merger',
        cardId: mergeId,
        prompt: mergerPrompt(run.root, mergeId, cardId, { member: true }),
        signal: controller.signal, // 宿主契约必填（同终审发现项①）
        allowInFlight: mergerStaleBookkeeping, // 轮次已判死（陈旧簿记）⇒ 越过通道侧在飞闸重派清账
      }).then((r) => {
        run.controllers.delete(controller)
        if (shadow) shadow.alive = false
        // 记名（R2 spec 审查 High#1）：段 6 判死前要用 mergeMemberName 问宿主「这位队友还在跑吗」。
        // 投递成功即清 alive 是既有语义（投递 ≠ 回合存活），故存活判定不能只看 alive，必须有真探针。
        if (r?.name) rec.mergeMemberName = r.name
        this.resilienceReset(run, mergeId)
        run.history.push({ t: nowIso(), event: r.fresh ? `team: spawn 合并专员 ${mergeId}（${r.name}）` : `team: 合并专员复用 ${r.name}（${mergeId}）` })
        this.persist(run)
      }).catch(async (e) => {
        run.controllers.delete(controller)
        if (shadow) shadow.alive = false
        if (run.dispatchFrozen) { this.persist(run); return } // stop 后不再走失败处置/回退派发（工单 04 生命周期收口）
        try {
          await this.safeHandleFailure(run, mergeId, e, {
            role: 'merger',
            fail: this.failHandlerOf(run, mergeId, 'merger') // 单源落账（failHandlerOf 按 merger 语义记 mergeFailureNote；spawnMerger 作用域无 role 变量，必须显式传）
          })
        } catch (healErr) {
          this.log.warn(`[jxx-driver] ${mergeId} 死亡自愈处置异常：${healErr.message}`)
        }
        this.persist(run)
      })
      return
    }
    const prompt = mergerPrompt(run.root, mergeId, cardId)
    // 一次性路径合并派发口径（R1 三维审查 rule#4b 纠偏：旧注释首行「label 用 merge id」与紧随的
    // 事实行自相矛盾，已删）：
    //  - cardId 传**开发卡 id**：spawn() 用它取 rec，label 由 role 拼接 = `jxx-merger-<devId>`（不带
    //    merge- 前缀，与既有测试/账面正则口径一致）；
    //  - 开发卡 rec 的 alive **不**由本层代清（spawn() 按 role 判归属，merger 轮不碰开发卡在飞闸）；
    //    合并轮的生存信号 = 影子账 alive，由 spawnMerger 置位 / onMergerSettled 归位单源管理；
    //  - onSettled 回开发卡口径（onMergerSettled 内部归一 merge 卡）。
    this.spawn(run, { role: 'merger', cardId, prompt, onSettled: (text, err) => this.onMergerSettled(run, cardId, text, err) })
    run.history.push({ t: nowIso(), event: `spawn 合并专员 ${mergeId}` })
    this.persist(run)
  }

  spawn(run, { role, cardId, prompt, onSettled }) {
    const controller = new AbortController()
    const rec = run.cards.get(cardId)
    // 在飞闸归属（R1 三维审查 std#2：旧注释宣称「recOfLabel 置 undefined」，代码却按 `cardId` 前缀
    // 判——一次性路径的合并派发传的是**开发卡 id**（spawnMerger 尾部的 this.spawn），不带 merge- 前缀，于是该 rec
    // 取到开发卡并在 done() 里代清了它的 alive，与注释相反）。真实归属按**角色**判：
    //  - worker：rec 就是在飞闸本体（失败时清 alive，清扫/僵死面才能接管）；
    //  - merger：合并轮的生存周期记在**影子账**（mergeId）上，由 spawnMerger 置位、onMergerSettled
    //    与团队路 dispatch 回调清位管理（段 6 僵死面不写 alive，只读作否决闸），spawn 层不得代清
    //    开发卡 alive（跨卡写，且与影子账双重清位竞速）。
    // 合并卡 label 仍拼 `jxx-merger-<devId>`（既有 fixture/账面口径，不带 merge- 前缀）。
    //
    // **派发代际闸**（工单 05 构建内容 1 / A 根治，ADR-0122 D6）：每卡记 `rec.gen`（每次派发自增），
    // 本轮 `done` 只在 `rec.gen === myGen` 时才动状态。根因实证：`done` 闭包捕获同一个 `rec` 并
    // **无条件** `rec.alive = false`（旧实现）——新一轮 spawn 已在 `spawnWorker` 入口置 `alive = true`
    // 之后，**上一轮的 done 回调仍会把 alive 清掉** ⇒ 下一 tick 的就绪前沿（判据只有
    // `phase !== 'open' || alive`）与僵死扫描随即再派一轮，同卡两轮并行
    // （run `8e69d682` 实测 14 分钟内 7 次 spawn、零 settle）。
    //
    // 代际**只对「拥有在飞生命周期」的轮次生效**（worker / merger）：
    //  - worker（role === 'dev'，注意**不是** 'worker'——历史命名如此）→ 开发卡 `rec.gen`
    //    （owns `rec.alive`）；
    //  - merger → 影子账 `shadow.gen`（owns `shadow.alive`）——spawn 层**不得**动开发卡代际
    //    （与「spawn 层不代清开发卡 alive」同一跨卡写约束）；
    //  - **reviewer 不参与**：三维审查是同卡的**并行扇出**（std/spec/rule 三个同时派），若也计入同一
    //    代际，后两个的 gen 会互相判陈旧 ⇒ 只第一个 reviewer 的 verdict 落账，另两维静默丢失
    //    （本轮实测：3 个 reviewer 共享 gen 直接打断死亡自愈全链）。reviewer 的 done 不拥有在飞位，
    //    故既不继承代际闸、也不被闸拦。
    const recOfLabel = role === 'merger' ? undefined : rec
    const gated = role === 'merger' || role === 'dev'
    const genRec = !gated ? undefined : (role === 'merger' ? run.cards.get(mergeIdOf(cardId)) : rec)
    const myGen = genRec ? (genRec.gen ?? 0) + 1 : undefined
    if (genRec) genRec.gen = myGen
    run.controllers.add(controller)
    const start = async () => {
      let handle
      try {
        handle = await this.ctx.subagents.start('spawn', {
          label: `jxx-${role}-${cardId}`,
          prompt: [{ type: 'text', text: prompt }],
          parent: run.agent,
          signal: controller.signal,
        })
        const result = await handle.result
        const text = Array.isArray(result?.output)
          ? result.output.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n')
          : String(result?.output ?? '')
        if (result?.stopReason && result.stopReason !== 'completed') {
          done(text, new Error(`stopReason=${result.stopReason}${result.diagnostic ? `：${result.diagnostic}` : ''}`))
        } else {
          done(text, undefined)
        }
      } catch (e) {
        done('', e)
      } finally {
        run.controllers.delete(controller)
        if (handle && typeof handle.dispose === 'function') await handle.dispose().catch(() => {})
      }
    }
    const done = (text, err) => {
      // 代际闸（工单 05 构建内容 1）：陈旧轮次的 done **不得**改新一轮状态——见 spawn() 头部注释的
      // 根因实证。留痕后直接返回：既不清 alive，也不落 settle（否则会二次推进已由新一轮接管的卡）。
      if (genRec && myGen !== undefined && genRec.gen !== myGen) {
        run.history.push({ t: nowIso(), event: `${cardId} 陈旧轮次 done 忽略（gen ${myGen}≠${genRec.gen}）` })
        this.persist(run)
        return
      }
      if (recOfLabel) recOfLabel.alive = false
      // onSettled 可能 async（PRD 111 死亡自愈回挪是 await 面）：同步异常照吞，Promise 拒绝落 warn——
      // 都不能逃出回调（Node ≥15 unhandledRejection 崩进程）
      try { const r = onSettled(text, err); if (r && typeof r.catch === 'function') r.catch((e) => this.log.warn(`[jxx-driver] onSettled 异常：${e.message}`)) } catch (e) { this.log.warn(`[jxx-driver] onSettled 异常：${e.message}`) }
      this.persist(run)
    }
    void start()
  }

  // ---------- 团队路径失败韧性（PRD 110 工单 03 / ADR-0121 D3：LLM 失败不弃会话） ----------

  /** 重发指令的信箱投递超时（sendMessage 排队+投递的宽限窗口；超时按派发失败计）。 */
  static RESEND_TIMEOUT_MS = 30_000

  /**
   * 退避曲线（工单 3：min(2^n * 5s, 60s)）。实例方法 = 测试面可覆写控时，产品语义不变。
   * 口径留痕（spec「重试计入既有 maxRetries 语义」的偏差说明）：团队路径的连续失败上限走
   * 独立 config.teamBackoff（默认 3，0=关）——maxRetries 的既有语义是「审查返工 / 一次性路径
   * worker 失败」的重试上限（另一条状态机），两套上限服务不同故障面，不共用计数器；
   * 理由与边界见工单自证段与卡面终审清单。
   */
  backoffDelay(attempt) {
    return backoffDelayMs(attempt)
  }

  /**
   * 团队路径派发失败的统一入口（只经 safeHandleFailure 调用）：等待用户恢复（默认）→ 同会话退避重发；
   * 用户已恢复 → 立即唤醒；队友已 failed（探针实证）→ 换名重建 fresh 后继 + 卡面交接简报；
   * 超限 → fail 回调置卡位转人工。一次性路径失败走既有 onXxxSettled 语义，不经此入口。
   */
  handleTeamDispatchFailure(run, cardId, error, { role, fail }) {
    const note = `team 派发失败（${error?.message || String(error)}）`
    if (!run.channel) {
      // 防御分支：现调用点都在通道存在的 catch 内；留作加固（通道被外部清空的未来路径）
      this.log.warn(`[jxx-driver] ${note}，无通道兜底一次性路径`)
      this.spawnFallback(run, cardId, role)
      return
    }
    const state = this.resilienceState(run, cardId)
    state.role = role
    state.fail = fail // 原始 fail 闭包捕获了正确的卡 id 口径（worker=开发卡 / merger=merge 卡），后续失败复用同一闭包，杜绝多副本漂移
    if (state.revived) {
      // 用户已在等待窗内恢复过一次 → 唤醒后的失败是同一会话内的又一次失败，回到退避计数
      state.revived = false
      run.history.push({ t: nowIso(), event: `${cardId} team: 唤醒后再次失败（${error.message}），回到退避计数` })
    }
    state.failures += 1
    state.lastError = error.message || String(error) // 仅观测面（run json 排查用），不参与判路
    // failed 探针为真 → 会话已死（宿主 roster 无复活边），换名重建；否则失败先按「可唤醒」处理。
    // 每次失败都探（宿主 listMembers 只读便宜）：memberFailed 是换名重建的唯一实证门。
    if (state.memberName !== undefined && this.probeOf(run).memberFailed(state.memberName)) {
      this.respawnTeammate(run, cardId, role, state, note)
      return
    }
    if (state.failures > this.config.teamBackoff) {
      // 连续超限（构建内容 3）：notify + 卡位转人工等待——用户切模型后经 jxx_flow resumed / go「继续」恢复唤醒**同一队友**
      state.waiting = true
      const owningRec = run.cards.get(cardId)
      if (owningRec) owningRec.resilienceOwned = true // 合并卡影子账：等待窗内前沿不抢（PRD 111 #106-C 重派面与韧性链互斥）
      state.waitingSince = nowIso() // 仅观测面（run json 排查用），不参与判路
      run.history.push({ t: nowIso(), event: `${cardId} team: 连续失败 ${state.failures} 次，超过退避上限 ${this.config.teamBackoff}，等待用户恢复（不弃会话）` })
      fail(note)
      return
    }
    this.scheduleTeamResend(run, cardId, role, state, note)
  }

  /** 韧性入口防炸圈：失败处理自身异常不得逃出 catch 处理器（Node ≥15 unhandledRejection 会崩进程）。
   * async 化（PRD 111 #106-A）：failHandlerOf 超限分支现含 await 回挪，异常仍被本层吞掉留痕。 */
  async safeHandleFailure(run, cardId, error, opts) {
    try {
      await this.handleTeamDispatchFailure(run, cardId, error, opts)
    } catch (e) {
      this.log.warn(`[jxx-driver] team 失败处理自身异常（${cardId}）：${e.message}`)
    }
  }

  /**
   * 同会话退避重发（构建内容 2）：不 spawnTeammate 新会话，同名 sendMessage 重发当前指令。
   * 异步 setTimeout：退避等待不占 watcher tick（验收 4）。
   * 不设「重发前 busy 跳过」闸：spec 的重发面 = 派发失败（sendMessage 已抛错/拒收）后同名重试，
   * 卡位复查 + harvest 去重已兜住重复收口；探针 running 口径（回合执行中）与「重发会双份投递」
   * 并无实证因果——而「跳过且不重挂」会静默杀死重试链（实测 E2E 全挂的活性缺陷，R2 修）。
   */
  scheduleTeamResend(run, cardId, role, state, note) {
    const delay = this.backoffDelay(state.failures)
    state.timer = setTimeout(() => {
      state.timer = undefined
      if (run.stopped || run.stage !== 'implement') return
      void (async () => {
        try {
          await this.resendTeamDirective(run, cardId, role, note)
        } catch (e) {
          // 重发失败 = 又一次派发失败：回统一入口（计数/探针/超限判定全部复用原 fail 闭包）
          await this.safeHandleFailure(run, cardId, e, { role, fail: state.fail })
        }
      })()
    }, delay)
    if (typeof state.timer.unref === 'function') state.timer.unref()
    run.history.push({ t: nowIso(), event: `${cardId} team: 派发失败（${note}），${delay / 1000}s 后同名重发（不新开会话）` })
    this.persist(run)
  }

  /**
   * 同名重发当前指令（构建内容 2/3）：worker = 领卡指令 + 返工上下文 + 尾注；merger = 合并指令 + 尾注
   * （继续点名 SETTLED 行）。目标 = 卡账记名 → 通道 cardOwners（首派即败时唯一痕迹），resend 直发模式
   * 不在册响亮报错——绝不静默开新名（换名重建须走 respawnTeammate 明路）。
   */
  async resendTeamDirective(run, cardId, role, note) {
    if (role === 'merger') {
      const mergeId = mergeIdOf(cardId)
      const prompt = sendMergeDirective(run, mergeId, { member: true })
        + `\n上次派发失败（自动重发）：${note}\n`
      await run.channel.dispatch({ role: 'merger', cardId: mergeId, prompt, signal: AbortSignal.any([AbortSignal.timeout(Orchestrator.RESEND_TIMEOUT_MS)]) })
      return
    }
    const rec = run.cards.get(cardId)
    if (!rec) return
    if (rec.phase === 'blocked' || rec.phase === 'open') {
      // 唤醒落卡位：fail 落过 blocked 的卡先移回 claimed（在办）再重发。
      // PRD 111 #106-A 后超限回挪的物理位是待领位（open），open + 等待窗也属「可唤醒」——
      // 但必须显式排除韧性链已释放（failures=0）的真前沿卡（PRD 111 R3 回归补丁）。
      const st = run.resilience.byCard.get(cardId)
      if (rec.phase === 'open' && (!st || (!st.waiting && !st.failures))) return
      const prevPhase = rec.phase // 先存原相位再置 claimed——留痕要如实记录「从哪来」（R2 审查死代码发现项修）
      rec.phase = 'claimed'
      try {
        await run.board?.cardMove(run.root, { id: cardId, to: 'claimed', reason: 'jxx-driver: 用户已恢复，队友唤醒续跑' })
        run.history.push({ t: nowIso(), event: `${cardId} 卡位 ${prevPhase} → claimed（唤醒恢复）` })
      } catch (e) {
        this.log.warn(`[jxx-driver] ${cardId} 卡位回 claimed 失败：${e.message}`)
      }
    } else if (rec.phase !== 'claimed') {
      return // 卡已推进/收口：重发作废
    }
    const retryNote = [
      rec.reworkNote ? `返工上下文（务必先读）：\n${rec.reworkNote}` : '',
      rec.lastFailure ? `上次失败原因：${rec.lastFailure}` : '',
      `上次派发失败：${note}`,
    ].filter(Boolean).join('\n')
    const prompt = rec.memberName
      ? memberDirective(cardId, retryNote)
      : workerPrompt(run.root, cardId, { member: true }) + `\n${retryNote}\n`
    // 同名直发（resend）：目标 = 卡账记名 → 通道 cardOwners（首派即败时唯一痕迹）；不得落到名字池开新名
    const hintName = rec.memberName || run.channel.nameOf(cardId)
    await run.channel.dispatch({ role: 'dev', name: hintName, resend: true, cardId, poolSize: this.config.parallel, prompt, signal: AbortSignal.any([AbortSignal.timeout(Orchestrator.RESEND_TIMEOUT_MS)]) })
    rec.alive = true
    run.history.push({ t: nowIso(), event: `team: ${cardId} 同名重发 → ${hintName}（同会话唤醒，上下文零丢失）` })
  }

  /**
   * 换名重建（构建内容 4，最后手段）：宿主侧确认 failed（探针）→ 名字池取新名 spawnTeammate fresh 重建；
   * 首条指令 = 角色提示词 + 返工上下文 + 卡面交接简报（≤2000 字符，构建内容 4）。
   * rebuild 在**同一通道**上摘除旧名（名册退租；「旧名永不复用」由名字池 used 集合自身保证——
   * 池分配即占用、永不回收，rebuild 不触池）。重建派发失败 → 一次性路径兜底（D3：不弃编排）。
   */
  respawnTeammate(run, cardId, role, state, note) {
    // 旧队友名：卡账（成功过）→ 通道 cardOwners（首派即败时唯一痕迹）；都拿不到 = 定位不了死者，走一次性兜底
    const oldName = state.memberName || run.channel.nameOf(cardId) || undefined
    if (oldName === undefined) {
      this.log.warn(`[jxx-driver] team 换名重建定位不到旧队友名（${cardId}），回退一次性路径`)
      run.history.push({ t: nowIso(), event: `team: 换名重建定位不到旧队友名（${cardId}），回退一次性路径` })
      this.spawnFallback(run, cardId, role)
      return
    }
    if (state.timer) { clearTimeout(state.timer); state.timer = undefined }
    const handoff = this.buildHandoff(run, cardId)
    try {
      run.channel.rebuild({ role, oldName, reason: note })
    } catch (e) {
      this.log.warn(`[jxx-driver] team 通道重建失败（${cardId}）：${e.message}，回退一次性路径`)
      run.history.push({ t: nowIso(), event: `team: 通道重建失败（${cardId}）：${e.message}` })
      this.spawnFallback(run, cardId, role)
      return
    }
    const controller = new AbortController()
    run.controllers.add(controller)
    const rec = role === 'dev' ? run.cards.get(cardId) : undefined
    const prompt = (role === 'merger'
      ? sendMergeDirective(run, mergeIdOf(cardId), { member: true })
      : workerPrompt(run.root, cardId, { member: true }))
      + (rec?.reworkNote ? `\n返工上下文（务必先读）：\n${rec.reworkNote}\n` : '')
      + `\n---\n交接简报（前一队友 ${oldName} 因 ${note} 退出，你接手同名卡）：\n${handoff || '（交接简报缺失：卡无可读流转行）'}\n`
    void run.channel.dispatch({ role, cardId, poolSize: this.config.parallel, prompt, signal: controller.signal })
      .then((r) => {
        run.controllers.delete(controller)
        this.resilienceReset(run, cardId)
        run.history.push({ t: nowIso(), event: `team: ${cardId} 换名重建 ${oldName} → ${r.name}（fresh，交接简报 ${handoff ? `${handoff.length} 字符` : '缺失'}）` })
        run.resilience.revived.push(`${nowIso()} ${cardId}: ${oldName} → ${r.name}`)
        this.persist(run)
      })
      .catch((e2) => {
        run.controllers.delete(controller)
        this.log.warn(`[jxx-driver] team 重建派发失败（${cardId}）：${e2.message}，回退一次性路径`)
        this.spawnFallback(run, cardId, role)
        this.persist(run)
      })
  }

  /** 一次性路径兜底（D3：彻底救不活也不弃编排）。返工上下文一并带上——丢上下文的兜底等于白兜。 */
  spawnFallback(run, cardId, role) {
    if (role === 'merger') {
      const devId = devIdOf(cardId)
      this.spawn(run, { role: 'merger', cardId: devId, prompt: sendMergeDirective(run, mergeIdOf(cardId)), onSettled: (text, err) => this.onMergerSettled(run, devId, text, err) })
      return
    }
    const rec = run.cards.get(cardId)
    let extra = ''
    if (rec?.reworkNote) extra = `\n\n---\n返工上下文（务必先读）：\n${rec.reworkNote}\n`
    else if (rec?.lastFailure) extra = `\n\n上次失败原因：${rec.lastFailure}`
    this.spawn(run, { role: 'dev', cardId, prompt: workerPrompt(run.root, cardId) + extra, onSettled: (text, err) => this.onWorkerSettled(run, cardId, text, err) })
  }

  /**
   * fail 处置单源（工单 03 超限转人工的落账口径）：worker 连续失败超限 → 卡 blocked + notify 等恢复；
   * merger 超限 → 记 mergeFailureNote + notify 转人工。cardId 参数 = 调用点口径（worker=开发卡 id；
   * merger=merge 卡 id，可带 merge- 前缀——devId 在方法内归一）。
   * PRD 111 #106-A：超限也统一回挪卡位（卡账=blocked 落账不变；物理卡位回待领位 + needs-info，
   * 卡面可读、前沿不再把它当在办管理，唤醒恢复面负责拉回）。
   */
  failHandlerOf(run, cardId, role) {
    return (note) => {
      const rec = run.cards.get(cardId)
      if (role === 'merger') {
        // R1 审查发现项（rule Low，已修）：曾写 rec.mergeFailureNote（rec 按 cardId 取，merger 调用点
        // 传的是 mergeId 而 run.cards 键 = 开发卡 id → 恒 undefined 不可达）；merge 账记在主卡
        const devRec = run.cards.get(devIdOf(cardId))
        if (devRec) devRec.mergeFailureNote = note
        run.blocked.push(`${cardId} 合并未收口（合并卡 ${cardId} team merger 连续失败超限：${note}），转人工`)
        this.notify(run, `合并卡 ${cardId} 的队友连续失败 ${note}，转人工核查。`, { key: `merge:${cardId}:team-overlimit` })
        return
      }
      if (rec) {
        rec.phase = 'blocked'
        rec.lastFailure = note
        void this.selfHealReturnToInbox(run, cardId, { to: 'blocked', reason: `jxx-driver: team 连续失败超限（${note.slice(0, 80)}），卡位回待领位` }).catch(() => {})
      }
      run.blocked.push(`${cardId} team worker 连续失败超限：${note}`)
      this.notify(run, `卡 ${cardId} 的队友连续失败 ${note}。可在切换模型后让我继续（jxx_flow 继续或直接说「继续」），我将重新唤醒同一队友。`, { key: `card:${cardId}:team-overlimit` })
    }
  }

  /** 卡面交接简报（构建内容 4）：读 open/ 卡文件流转段 → buildHandoffFromCard（≤2000 字符）。 */
  buildHandoff(run, cardId) {
    // merger 重建简报读开发卡流转段（merge 卡首派前流转段近乎为空，开发卡史更丰富）——
    // spec 字面「卡文件 control/cards/open/<id>.md」按此口径理解，R1 审查留痕
    const base = devIdOf(cardId)
    for (const suffix of ['.md', '.claimed.md', '.review.md']) {
      const file = join(run.root, 'control', 'cards', 'open', `${base}${suffix}`)
      if (!existsSync(file)) continue
      try {
        return buildHandoffFromCard(readFileSync(file, 'utf8')).text
      } catch (e) {
        // 降级语义（简报缺失可接受），但留痕——简报质量直接影响重建质量
        this.log.warn(`[jxx-driver] 交接简报读卡失败（${file}）：${e.message}`)
      }
    }
    return ''
  }

  /** 每卡韧性状态：failures 计数 / 退避计时器 / 等待标记 / fail 闭包（原始捕获，单源复用）/ 目标队友名。 */
  resilienceState(run, cardId) {
    let st = run.resilience.byCard.get(cardId)
    if (!st) {
      st = { failures: 0, timer: undefined, waiting: false, waitingSince: undefined, revived: false, role: undefined, fail: undefined, memberName: undefined, lastError: undefined }
      run.resilience.byCard.set(cardId, st)
    }
    const rec = run.cards.get(devIdOf(cardId))
    st.memberName = (cardId.startsWith('merge-') ? rec?.mergeMemberName : rec?.memberName)
      ?? run.channel?.nameOf(cardId) // 首派即败：名字只在通道 cardOwners（成功过才进卡账）
    return st
  }

  /** 成功派发/收口后清零韧性计数（保留 memberName 供后续失败定位）。 */
  resilienceReset(run, cardId) {
    const st = run.resilience.byCard.get(cardId)
    if (!st) return
    if (st.timer) { clearTimeout(st.timer); st.timer = undefined }
    st.failures = 0
    st.waiting = false
    st.waitingSince = undefined
    st.revived = false
    st.lastError = undefined
    const owned = run.cards.get(cardId)
    if (owned) owned.resilienceOwned = false // 韧性链释放，前沿可接管（重派面）
  }

  /**
   * 成功唤醒账本合并 + 归档记录（构建内容 3：用户恢复后唤醒成功）。
   * 只清等待窗内、卡位仍可续跑（claimed/blocked）的卡；唤醒 = 同名 sendMessage 重发当前指令。
   */
  reviveTeamWaiter(run, why) {
    let revived = 0
    for (const [cardId, st] of run.resilience.byCard) {
      if (!st.waiting) continue
      const rec = run.cards.get(cardId)
      const merging = cardId.startsWith('merge-')
      const mainRec = merging ? run.cards.get(devIdOf(cardId)) : rec
      // 卡位判定：等待窗内卡可能已被 fail 落成 blocked（worker 卡）或停在 merging（合并卡）。
      // PRD 111 #106-A 后 failHandlerOf 把物理卡位回挪待领位（卡账仍 blocked）——重发前卡位回 claimed 由
      // resendTeamDirective 负责，这里只需放行；一次性路径的 onWorkerSettled 重试链不受影响（不经等待窗）。
      const cardOk = merging
        ? mainRec?.phase === 'merging'
        : (rec?.phase === 'claimed' || rec?.phase === 'blocked' || (rec?.phase === 'open' && st.failures > 0))
      if (!mainRec || !cardOk) continue
      st.waiting = false
      st.revived = true
      const role = st.role ?? (merging ? 'merger' : 'dev')
      // 100ms 让「已唤醒」followup 先于重发指令入队；句柄不挂 state（halt 靠 run.stopped 闸兜底，窗口极短）
      const t = setTimeout(() => {
        if (run.stopped || run.stage !== 'implement') return
        void (async () => {
          try {
            await this.resendTeamDirective(run, cardId, role, `用户已恢复（${why}）`)
            this.resilienceReset(run, cardId)
          } catch (e) {
            this.safeHandleFailure(run, cardId, e, { role, fail: st.fail })
          }
        })()
      }, 100)
      if (typeof t.unref === 'function') t.unref()
      revived += 1
      run.history.push({ t: nowIso(), event: `team: ${cardId} 用户恢复，唤醒同一队友（${why}）` })
    }
    if (revived > 0) {
      this.notify(run, `已唤醒 ${revived} 个等待中的队友（${why}），继续同会话推进。`, { key: 'team:revive-waiters' })
      this.persist(run)
    }
    return revived
  }

  /**
   * 成员状态探针（构建内容 4）：懒初始化挂在 run 上（每个 run 只建一次）。
   * 防抛：ctx.get 抛错/服务缺失 → 得到「恒 false」探针（唤醒语义兜底）；探针自身异常走 warn——
   * 韧性链路绝不因探针抛错而炸。
   */
  probeOf(run) {
    if (!run._probe) {
      let teams
      try {
        teams = typeof this.ctx.get === 'function' ? this.ctx.get('agentTeams') : undefined
      } catch (e) {
        this.log.warn(`[jxx-driver] agentTeams 服务解析失败，探针降级恒 false：${e.message}`)
      }
      // teams 缺失（服务下线/解析失败）→ 降级「恒 false」探针而非抛错：createMemberProbe 对
      // teams 缺省是响亮 throw，而调用面（僵死在飞判据/失败韧性）都按「无反证」处理——宁可漏杀
      // 不误杀，tick 不因探针炸（39-02 顺手加固）
      run._probe = teams
        ? createMemberProbe({ teams, agent: run.agent, log: (msg) => this.log.warn(`[jxx-driver] ${msg}`) })
        : { canObserve: () => false, memberStatus: () => undefined, memberFailed: () => false, memberInactive: () => false }
    }
    return run._probe
  }

  /**
   * 「这一轮的轮次是否仍在飞」——僵死面判死前的**唯一**在飞判据（PRD 111 工单 01 R2 spec 审查
   * High#1/#2 同根修复）。两条执行路径的观测面不同，故按「能否观测到成员」分派，不猜、不混用：
   *
   * - **有成员观测面**（团队路径 / ADR-0121 默认形态）：以宿主 `listMembers` 的 `status` 为准。
   *   **活跃态 = 在飞，让位**（`running` / `provisioning`）；**失联态 = 放行判死**（`inactive` /
   *   `failed` / 查无此人）。
   *   为什么 `provisioning` 也算在飞（R6 spec 复审发现项）：宿主语义里它是**活跃态**——
   *   `packages/experimental/tool-agent-team/src/index.ts:39` 的
   *   `ACTIVE_WAIT_STATUSES = new Set(['running', 'provisioning'])`（「正在创建成员」= 本轮已受理、
   *   尚未开跑）明确把二者并列为「能推进」的成员态；`agent-team/src/types.ts` 亦把 `provisioning`
   *   列为 live phase。若把它划入失联面，宿主对**已领卡**的成员报 `provisioning` 时就会被判死重派
   *   ⇒ 两个专员同时动同一分支，**破 D6 不变量**。故宁可让位（该轮很快会转 `running`）。
   *   为什么不能只看 `alive`：团队路径的 `alive` 语义是「派发动作是否还在途中」而非「回合是否存活」
   *   ——合并轮在 dispatch **投递成功**即被清位（投递 ≠ 回合存活），开发轮则相反（派发后无人清位，
   *   挂死轮次的 `alive` 永为 true）。单看它两头出错：合并轮把合法长回合误判死重派（实测 1→2，
   *   破 D6），开发轮让「队友领卡后静默挂死」零自愈（#106-A 的实况形态）。
   * - **无成员观测面**（一次性路径：teamMode=off / 宿主无 agentTeams / listMembers 不可用）：
   *   退回 `alive` 位否决——一次性 API 不提供「轮次是否存活」的观测面，放开该闸即等于允许双跑
   *   （D6 破），故宁可不救「疑似仍在跑的活轮」，长挂由人工/停止清场面兜底。
   */
  roundInFlight(run, rec) {
    try {
      const probe = this.probeOf(run)
      // 成员名未登记（如 dispatch 尚未返回、名册未记）⇒ 无法按名查询，退回 alive 位——
      // 此时 alive 仍为 true（置位后未被清），保住「投递在途」这一在飞态
      if (typeof probe.canObserve === 'function' && probe.canObserve() && rec?.memberName !== undefined) {
        const status = probe.memberStatus(rec.memberName)
        return status === 'running' || status === 'provisioning' // 活跃态集合见上方注释（宿主 ACTIVE_WAIT_STATUSES）
      }
    } catch (e) {
      this.log.warn(`[jxx-driver] 轮次存活探针异常（按未观测=回退 alive 位处理）：${e.message}`)
    }
    return rec?.alive === true
  }

  /** 合并轮的成员名记在**主卡**的 mergeMemberName（团队路径 dispatch .then 记名）。 */
  mergerRoundInFlight(run, devRec, shadow) {
    if (!run.channel) return shadow?.alive === true
    return this.roundInFlight(run, { memberName: devRec?.mergeMemberName, alive: shadow?.alive })
  }

  /**
   * 开发轮的在飞判据（R2 spec 审查 High#2）：团队路径看成员 status（队友领卡后静默挂死 ⇒
   * inactive ⇒ 僵死面接管自愈）；一次性路径退回 alive 位（与既有语义一致，零行为漂移）。
   * cardId 入参取卡 id：merge- 卡（影子账重派）成员名在**主卡** mergeMemberName、在飞位在影子账，
   * 普通开发卡成员名在自身 memberName——按 id 归一后统一走 roundInFlight，不猜不混。
   */
  devRoundInFlight(run, cardId, rec) {
    if (!run.channel) return rec?.alive === true
    const merging = cardId.startsWith('merge-')
    const devRec = run.cards.get(devIdOf(cardId))
    return this.roundInFlight(run, {
      memberName: merging ? devRec?.mergeMemberName : rec?.memberName,
      alive: rec?.alive,
    })
  }

  // ---------- 子会话收口回调 ----------

  async onWorkerSettled(run, cardId, _text, err) {
    const rec = run.cards.get(cardId)
    if (!rec) return
    if (err) {
      rec.retries = (rec.retries || 0) + 1
      // 本次判定号快照（spec 审查发现项 3）：下面 await 回挪期间同一卡的下一次 settle 可能交叉进入，
      // 事后读 rec.retries 会让「第 N 次」留痕与本次判定错位（探针实录同卡同时出现「已达上限」与
      // 「已回挪重派」两条互斥结论，且行号显示为 2 而该次实为 1）
      const attempt = rec.retries
      rec.lastFailure = err.message // 重试附失败原因（构建内容 3）
      rec.alive = false
      if (attempt > this.config.maxRetries) {
        rec.phase = 'blocked'
        run.blocked.push(`${cardId} worker 失败超限：${err.message}`)
        this.notify(run, `卡 ${cardId} worker 失败：${err.message}。已达重试上限，转人工。${HUMAN_TAKEOVER_HINT}`, { key: `card:${cardId}:worker-overlimit` })
        // spec 审查发现项 1：一次性路径的终局面同样要回挪物理卡位——只改卡账会让卡滞留
        // `.claimed.md`（前沿只收 phase==='open'、僵死扫描只收 phase==='claimed'，两处都不再接管），
        // 且一次性路径无 resilience 等待窗，「继续」也救不回；与团队路 failHandlerOf 的落法同源
        // （to='blocked' → 待领位 + needs-info，PROTOCOL §0 的 blocked 语义、verify 第 5 路可对账）
        await this.selfHealReturnToInbox(run, cardId, { to: 'blocked', reason: `jxx-driver: worker 失败超限（${err.message.slice(0, 80)}），卡位回待领位` })
      } else {
        rec.phase = 'open'
        // 死亡自愈（#106-A 根治）：卡账回 open 后必须物理回挪卡位，否则前沿看不到、重派死锁（110-03 实况 9h56m）
        const moved = await this.selfHealReturnToInbox(run, cardId, { to: 'inbox', reason: `jxx-driver: worker 失败（${err.message}），回挪待重派` })
        run.history.push({ t: nowIso(), event: `${cardId} worker 失败（${err.message}），重试 ${attempt}${moved ? '（卡位已回挪）' : '（回挪失败，见上）'}` })
        // notify 如实按 moved 分支（spec 审查发现项 3：回挪失败时文案与实况不符）
        const healNote = moved ? '已回挪待领位自动重派' : '回挪未执行（交前沿/人工面兜底）'
        // 键含尝试号：**不同**失败各投一次（去重不得把真事件吃掉），同一次失败的重复触发才去重
        this.notify(run, `卡 ${cardId} worker 第 ${attempt} 次失败（${err.message}），${healNote}；若连续失败将转人工。${HUMAN_TAKEOVER_HINT}`, { key: `card:${cardId}:worker-fail-${attempt}` })
      }
    }
    // 成功时不改 phase——卡位才是真信号，下一个 tick 扫到 .review.md 才起审查
  }

  onReviewerSettled(run, cardId, dim, text, err) {
    const rec = run.cards.get(cardId)
    if (!rec) return
    if (!rec.reviewResults) rec.reviewResults = {}
    if (err) {
      rec.reviewResults[dim] = { verdict: 'FAIL', reason: `审查者异常：${err.message}` }
    } else {
      const verdict = parseVerdict(text)
      rec.reviewResults[dim] = { verdict, reason: verdict === 'FAIL' && !/^VERDICT:/m.test(text || '') ? '缺 VERDICT 行，fail-closed' : undefined }
    }
    run.history.push({ t: nowIso(), event: `${cardId} 审查者 ${dim} 回：${rec.reviewResults[dim].verdict}` })
  }

  async onMergerSettled(run, cardId, _text, err) {
    const rec = run.cards.get(cardId)
    const shadow = run.cards.get(mergeIdOf(cardId))
    if (!rec) return
    if (err) {
      // 合并专员中止即报（#106-C：曾零重试零痕迹中止）——合并卡回待领位，下 tick 前沿重派。
      // retries 写点如实口径（R1 三维审查 rule#2：本注释曾宣称「只在此处 +1 / 前沿僵死面只读不写」，
      // 与代码不符——返工只改了前沿处 :553 的同名注释、漏了本处，现按实况对齐）：
      // 影子账（merge- 键）retries 共 **3 个写点**，各承载一次独立的「本轮失败」事实：
      //   ① 段 4 未收口超时面（mergeRec.retries）：settle 成功后长期不进 done
      //   ② 段 6 僵死面（rec.retries）：合并专员领卡后 mtime 超 staleMinutes 而无存活队友
      //   ③ 本处（onMergerSettled 失败路）：派发/轮次失败回调
      // **但 ② 与本处并非天然互斥**（R2 rule 审查严重发现项）：本处把卡回挪回 open 并清 alive 后，
      // 段 6 的判死前置闸会全部放行，若照样 +1 就是对同一次失败再扣一次预算——生产默认
      // maxRetries=1 下只失败 1 次即 retries=2 > 1 直接转人工，本该保留的那次重派被白扣。
      // 故本处落账时打 **mergeFailedAt 时间戳**；段 6 见该标记**不再计数、不再重派**，改做
      // 幂等终局（卡位超时仍未推进 ⇒ blocked 转人工，见段 6 注释）——既防双扣，也防「回挪失败时
      // 卡被两面同时让位而永久滞留」（R3 rule 审查严重发现项 F1）。
      // 判超限一律用本处快照式读取（`(x||0) > maxRetries`），不要在 await 前后重复读同一计数。
      const mergeId = mergeIdOf(cardId)
      if (shadow) { shadow.alive = false; shadow.retries = (shadow.retries || 0) + 1; shadow.phase = 'open' }
      rec.mergeFailedAt = nowIso() // 供段 6 僵死面识别「本轮已失败」，防同一次失败双扣预算
      run.blocked.push(`${cardId} 合并专员失败：${err.message}，合并卡回挪待重派`)
      // 物理回挪仅当合并卡文件不在 open/（被合并专员挪走）时执行——keepInbox 投卡的合并卡
      // 物理位置始终在待领位，无需回挪；且异步 cardMove 与重派成功路竞速会把已收口（done/）
      // 的合并卡搬回 open/（R3 调试实录），非必要不动物理位。
      const mergeOpen = existsSync(join(run.root, 'control', 'cards', 'open', `${mergeId}.md`))
      let healNote = '合并卡待领位自动重派' // keepInbox 投卡物理位本就在待领位：不动物理位只落账
      if (!mergeOpen) {
        const moved = await this.selfHealReturnToInbox(run, mergeId, { to: 'inbox', reason: `jxx-driver: 合并专员中止（${err.message}），回挪重派` })
        healNote = moved ? '合并卡已回挪待领位自动重派' : '合并卡回挪未执行（交前沿/人工面兜底）'
      }
      // 键含错误签名：**不同**中止各投一次（去重不得吃掉真事件），同一次中止的重复触发才去重
      this.notify(run, `卡 ${cardId} 合并专员中止：${err.message}。${healNote}；若连续中止转人工。${HUMAN_TAKEOVER_HINT}`, { key: `merge:${cardId}:abort-${err.message.slice(0, 40)}` })
      return
    }
    rec.mergeSettledAt = nowIso()
    if (shadow) shadow.alive = false // 成功 settle 清在飞闸
    // 成功 settle：影子账 phase 保持 open（影子 phase 是重派路由位，写面只有 open/blocked，
    // 从无 claimed 写路径——R1 三维审查 std#1/rule#1 穷举确认）；是否真收口由段 4 看合并卡
    // 是否进 done/ 决定（卡位才是真信号），失败回挪面才把它置回 open。
  }

  /**
   * Lead 信箱收割（PRD 110 工单 02）：index.mjs 在 session/event 上监听到投递给 Lead 的
   * team-message user 消息后调这里——从文本解析 `SETTLED: <卡id>`，判可收才按消息路收口。
   * 卡位扫描兜底不动：消息丢失时 watcher 照常推进；双路去重 = canSettle 闸（收口后闸即关，
   * 迟到/重复消息不再动手）+ settledSeen 记账；messageHarvestBusy 是逐消息互斥哨兵
   * （单线程下防同消息重入，并发到达的消息交卡位兜底——审查发现项⑧改名澄清）。
   */
  onTeamMessage(agent, messageText) {
    const sessionId = agent?.session?.id ?? agent?.id
    const run = sessionId ? this.runs.get(sessionId) : undefined
    if (!run || run.stopped || run.stage !== 'implement' || !run.channel) return
    if (run.messageHarvestBusy) return
    run.messageHarvestBusy = true
    try {
      const canSettle = (cardId) => {
        // 合并卡（merge-<id>）：主卡 phase=merging 且合并专员 settle 未置位——闸看主卡（审查发现项②修复）。
        // PRD 111 #106-C 后合并卡影子账也在 run.cards，**必须先判 merge- 前缀**再走开发卡分支，
        // 否则影子账（phase=open）抢先命中开发卡闸把 merger SETTLED 永久拒收（三类红同根，R3 修）。
        if (cardId.startsWith('merge-')) return run.cards.get(devIdOf(cardId))?.phase === 'merging'
        // 开发卡：在办（claimed）且 alive 未清——alive 闸堵「同窗口重复消息双计预算」（终审发现项③）
        const rec = run.cards.get(cardId)
        if (rec) return rec.phase === 'claimed' && rec.alive !== false
        return false
      }
      const settled = run.channel.harvest({
        canSettle,
        onSettledFor: (cardId) => (text, err) => {
          if (!run.settledSeen.has(cardId)) {
            run.settledSeen.add(cardId)
            run.history.push({ t: nowIso(), event: `team: ${cardId} SETTLED 回传，按消息路收口` })
          }
          if (cardId.startsWith('merge-')) {
            const devId = devIdOf(cardId)
            const devRec = run.cards.get(devId)
            if (devRec) devRec.mergeMemberName = run.channel.nameOf(cardId)
            this.resilienceReset(run, cardId)
            this.onMergerSettled(run, devId, text, err)
          } else {
            const rec = run.cards.get(cardId)
            if (rec) rec.alive = false // 本轮结束：alive 清位（卡未推进时僵死重 spawn 面才能接管）
            this.resilienceReset(run, cardId)
            this.onWorkerSettled(run, cardId, text, err)
          }
        },
        persist: () => this.persist(run),
      })
      const cardId = settled(messageText)
      if (cardId !== undefined) this.log.info(`[jxx-driver] team: 收到 ${cardId} SETTLED 回传（消息路）`)
    } finally {
      run.messageHarvestBusy = false
    }
  }

  // ---------- 工具 ----------

  /**
   * 编排器 → 会话通知（工单 05 构建内容 3/4/5）。
   *
   * - **幂等键**（B1）：`opts.key` 给语义键时「同 run 同键只投一次」——重复触发只留痕不入信箱。
   *   根因实证：同一文案 `[jxx-driver] 进入 implement：…` 在 `session-75d47c50` 于 06:24/06:31/07:44
   *   各投一次（来自三个不同 run）；「已就位 · decide」随插件重载逐次重发（retro 已记 4 次）⇒
   *   接待台误读为「宿主重启」并误发 stop，打断两张卡的在飞轮次。
   * - **待领通知记账**（B2）：记下注入的 message id 到 `run.noticeIds`，`halt()`/`dispose()` 对
   *   **仍待领**的逐个摘除，消灭「插件重载后重放过期问候」。
   * - **来源去伪造**（B3）：source 用插件自有 kind `'jxx-driver'`，**不再**冒充 `{ kind: 'user' }`。
   *   宿主契约取证（`deepseek-harness` @ `d94ac777`）：
   *   ① `packages/llm/llm/src/message.ts:103-115` —— `MessageSourceMap` 是 merge-extensible 求和类型，
   *      「each producer declares its own `kind` in its own module; there is no shared catch-all
   *      `plugin` kind」；`user: { kind: 'user' }` 仅是其中之一。
   *   ② `packages/api/session-controller/src/commands.ts:331-335` + `:415-420` —— `kind: 'user'` 的
   *      真实生产方是浏览器 `session/prompt` RPC（`{ kind:'user', rpcId }`）⇒ 它是**真人输入**的专用 kind。
   *   ③ `packages/goal/tool-goal/README.md:72`（规范依据，逐字）：「**`{ kind: 'user' }` is assigned by
   *      `Agent.followup()` and `steer()` when their caller omits a source, so plugins, schedulers, and
   *      other non-human producers must pass their own source rather than inheriting human authority.**」
   *   ④ 现役范式：`tool-goal:14-16` / `time-context:15-17` / `repeat-tool-reminder:15-17` 均
   *      `declare module` + 自有 kind 名 + `ContextFormed`。
   *   本仓是纯 JS（无 TS 构建），故运行时以普通对象传值；`declare module` 的类型面说明见上方坐标。
   */
  notify(run, text, opts = {}) {
    const key = opts.key
    // B1 幂等键：同 run 同键只投一次（重复触发只留痕，不再入信箱）
    if (key !== undefined) {
      if (!run.notified) run.notified = new Map()
      const prev = run.notified.get(key)
      if (prev !== undefined) {
        run.history.push({ t: nowIso(), event: `通知去重（key=${key}，首次 ${prev}）：${text.slice(0, 60)}` })
        return false
      }
      run.notified.set(key, nowIso())
    }
    run.history.push({ t: nowIso(), event: `通知：${text.slice(0, 80)}` })
    run.updatedAt = nowIso()
    try {
      const live = this.ctx.agents.get(run.agent.id)
      if (live === run.agent) {
        const id = randomUUID()
        run.agent.followup({
          id,
          role: 'user',
          content: [{ type: 'text', text: `[jxx-driver] ${text}` }],
          // B3：插件自有 kind，不冒充人类来源（坐标见本方法头注释）
          source: { ...PLUGIN_SOURCE },
        })
        // B2：记待领通知 id，供 halt/dispose 摘除（插件重载后不再重放过期问候）
        if (!run.noticeIds) run.noticeIds = new Set()
        run.noticeIds.add(id)
      }
    } catch (e) {
      this.log.warn(`[jxx-driver] 通知失败（会话可能已释放）：${e.message}`)
    }
    return true
  }

  /**
   * 摘除本 run 仍**待领**的通知（工单 05 构建内容 4 / B2）。`halt()`/`dispose()` 调用。
   * 宿主契约：`agent.inbox.remove(id)`；失败仅 warn，**不阻断停止链**（通知清场是尽力而为，
   * 停不下来比留一条过期问候严重得多）。已消费的通知 remove 会返回 false/抛错，属正常。
   */
  dropPendingNotices(run) {
    const ids = run.noticeIds
    if (!ids || ids.size === 0) return 0
    let dropped = 0
    const inbox = run.agent?.inbox
    for (const id of [...ids]) {
      try {
        if (inbox && typeof inbox.remove === 'function') {
          const ok = inbox.remove(id)
          if (ok !== false) dropped += 1
        }
      } catch (e) {
        this.log.warn(`[jxx-driver] 摘除待领通知失败（${id}）：${e.message}`)
      }
    }
    ids.clear()
    return dropped
  }

  persist(run) {
    run.updatedAt = nowIso()
    try {
      // 按 run id 分文件落盘（PRD 100-01）：单文件 `jxx-driver-state.json` 是「单写者」假设，
      // 多编排 run 并存时后写者会整文件覆盖先写者的执行史（PRD 97 实测被另一 run 覆写）。
      // 每个 run 写自己的 `jxx-driver-runs/<runId>.json`，读侧无需解析、写侧天然无锁竞争；
      // 旧单文件不再写入（历史 run 的执行史由 ledger.md 只追加账本与卡面承载，不迁移）。
      writeJsonAtomic(join(run.root, 'control', 'jxx-driver-runs', `${run.id}.json`), {
        id: run.id, stage: run.stage, idea: run.idea, featureDir: run.featureDir,
        createdAt: run.createdAt, updatedAt: run.updatedAt,
        cards: Object.fromEntries([...run.cards.entries()].map(([id, c]) => [id, {
          phase: c.phase, retries: c.retries, spawnedAt: c.spawnedAt, note: c.note,
          memberName: c.memberName, mergeMemberName: c.mergeMemberName, mergeFailureNote: c.mergeFailureNote,
        }])),
        resilience: Object.fromEntries([...(run.resilience?.byCard?.entries() || [])].map(([id, st]) => [id, {
          failures: st.failures, waiting: st.waiting, waitingSince: st.waitingSince, memberName: st.memberName, lastError: st.lastError,
        }])),
        // R1 审查发现项（std High / rule Medium，已修）：曾误写 `run.revived`——字段从未初始化，
        // 序列化恒 undefined，换名重建账本在 run json 观测面静默丢失；真账本在 run.resilience.revived
        revived: run.resilience?.revived ?? [],
        blocked: run.blocked,
        history: run.history,
      })
      // 双编排器互斥锁（PRD 108 retro P0-2）：`control/` 卡目录与 git 是共享状态机，
      // 两台 dsh 各挂一个 jxx-driver 同时编排会互踩（PRD 108 实测 7bc3c0aa 直落 main
      // 绕过审查闸）。锁文件 = run 活跃的机器可读证据；halt/detach 时摘除。
      writeJsonAtomic(join(run.root, 'control', 'jxx-driver-runs', `${run.id}.lock.json`), {
        id: run.id, sessionId: run.sessionId, stage: run.stage,
        startedAt: run.createdAt, updatedAt: run.updatedAt, reason: 'active',
      })
    } catch (e) {
      this.log.warn(`[jxx-driver] 状态落盘失败：${e.message}`)
    }
  }

  /** 摘除互斥锁（halt 与 failRun 收尾共用；文件缺失 = 幂等 no-op）。 */
  releaseLock(run) {
    try {
      const lockPath = join(run.root, 'control', 'jxx-driver-runs', `${run.id}.lock.json`)
      if (existsSync(lockPath)) rmSync(lockPath)
    } catch { /* 锁摘除失败不阻断停止流程（lock 只影响新 run 启动判定） */ }
  }

  /**
   * 双编排器互斥判定（PRD 108 retro P0-2）：扫 `control/jxx-driver-runs/*.lock.json`，
   * 存在**非本会话**的活跃锁 = 另一台 dsh 的编排正在同一检出上跑 → 拒绝启动并响亮报错。
   * 陈旧锁防御：updatedAt 超过 24h 视为孤儿（宿主崩溃未清理），放行并附警告。
   */
  assertNoForeignRun(root, sessionId) {
    const dir = join(root, 'control', 'jxx-driver-runs')
    if (!existsSync(dir)) return
    const now = Date.now()
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.lock.json')) continue
      try {
        const lock = JSON.parse(readFileSync(join(dir, f), 'utf8'))
        if (lock.sessionId === sessionId) continue // 同会话重启场景放行（单会话单 run 闸在 runs.has 已挡）
        const age = now - Date.parse(lock.updatedAt ?? lock.startedAt ?? 0)
        if (Number.isFinite(age) && age > 24 * 3600_000) {
          this.log.warn(`[jxx-driver] 陈旧互斥锁放行（${f}，${Math.round(age / 3600_000)}h 未更新——宿主崩溃残留）`)
          continue
        }
        throw new Error(
          `jxx-driver: 检出上已有另一编排会话在跑（run ${lock.id}，${lock.stage} 阶段，${lock.sessionId}）。`
          + ' 同一仓库的 control/ 卡目录与 git 是共享状态机，并行编排会互踩（PRD 108 实测直落 main 绕过审查闸）。'
          + ' 若确认对方已死，可删除 control/jxx-driver-runs/<id>.lock.json 后重试。',
        )
      } catch (e) {
        // 坏 JSON / 文件消失等锁文件自身问题 → 放行（不因残留损坏文件堵死启动）；
        // 只有本方法主动抛的互斥错误才向上传播。
        if (/另一编排会话在跑/.test(e.message)) throw e
        continue
      }
    }
  }

  /**
   * 停止/清场（PRD 110 工单 04 / ADR-0121 D4 生命周期收口）：
   *  - 一次性路径：沿用 AbortController.abort()（在飞子会话被宿主中止）——语义不变；
   *  - 团队路径：对在飞队友逐个 `teams.interrupt(run.agent, name)`（中断当前轮次、保留会话与
   *    待办信箱，宿主 roster.ts:204 契约；持久成员**不散伙**）；interrupt 后仍 abort 派发信号，
   *    dispatch 的 sendMessage/spawnTeammate 若还在途也随之终止；
   *  - run 收尾：清本 run 收割簿记（settledSeen）、timer、controllers；runs 表摘除本 run。
   *  复用语义：成员不解散（durable roster 按设计持久），同会话下一个 run 经 setupTeamChannel
   *  重建通道按名续接；宿主重启/队友 failed 的按名解析失败 → 走 03 的重建路径（dispatch 首行
   *  「点名不在册」分支已在）。stop 后本 run 不再派发：tick 首行 run.stopped 短路（run 总闸）
   *  + dispatchFrozen 哨兵挡住已在途的 dispatch 回退分支（只挡派发，不动卡位，防 stop 后
   *  静默新开一次性子会话）。
   */
  async halt(run, reason) {
    run.stopped = true
    if (run.timer) { clearInterval(run.timer); run.timer = undefined }
    if (run.channel && run.agent) {
      const teams = resolveAgentTeams(this.ctx)
      if (!teams) {
        // 留痕口径（std 审查发现项）：通道在但宿主服务解析不到（异常路径）——响亮记录，不静默跳过中断
        run.history.push({ t: nowIso(), event: '团队路径停止：宿主 agentTeams 解析不到，在飞队友无法 interrupt（交卡位兜底）' })
        this.log.warn('[jxx-driver] 团队路径停止：agentTeams 解析不到，跳过 interrupt')
      }
      if (teams) {
        const attempted = run.channel.interruptInFlight((_cardId, memberName) => {
          // 宿主契约（deepseek-harness agent-team index.ts:221）：interrupt(caller=exact live Lead, targetName)
          // 中断该队友在飞轮次、保留其会话与待办信箱；成员保留在册（D4 不解散）。
          const r = teams.interrupt(run.agent, memberName)
          run.history.push({ t: nowIso(), event: `team: 中断在飞队友 ${memberName}（previousStatus=${r?.previousStatus ?? 'unknown'}）` })
        })
        if (attempted.length > 0) {
          run.history.push({ t: nowIso(), event: `团队路径停止：中断在飞 ${attempted.length} 张卡的在飞轮次，持久成员不解散` })
          this.log.info(`[jxx-driver] 团队路径停止：interrupt 在飞队友 ×${attempted.length}`)
        }
      }
    }
    // 韧性退避计时器（工单 03）随 stop 清理——挂着 timer 的重发不得越过 stop 存活。
    for (const st of run.resilience?.byCard?.values() || []) { if (st.timer) { clearTimeout(st.timer); st.timer = undefined } }
    for (const c of run.controllers || []) { try { c.abort() } catch { /* noop */ } }
    run.controllers?.clear()
    run.dispatchFrozen = true // stop 后在途 dispatch 的回退分支不再新开一次性子会话（工单 04 生命周期收口）
    run.settledSeen?.clear() // 本 run 的收割去重簿记随 run 清场；成员名册/预算账本随通道闭包存续（D4）
    // 跨重启清场（工单 05 构建内容 4 / B2）：摘除本 run **仍待领**的通知，消灭「插件重载后重放过期
    // 问候」（实测：「已就位 · decide」随每次插件重载重发，接待台误读为宿主重启并误发 stop）。
    const dropped = this.dropPendingNotices(run)
    if (dropped > 0) run.history.push({ t: nowIso(), event: `停止：摘除 ${dropped} 条仍待领的本 run 通知（防重放）` })
    run.history.push({ t: nowIso(), event: `停止：${reason}` })
    this.persist(run)
    this.releaseLock(run)
    this.runs.delete(run.sessionId)
  }

  failRun(run, msg) {
    run.lastError = msg
    run.history.push({ t: nowIso(), event: `失败：${msg}` })
    // 幂等键（R1 spec 审查发现项 2）：工单 B1 根因原文点名「failRun、阶段通知、唤醒通知等多条路径
    // 都会调」，全文件唯此处曾无键。run 终结面本身触达有限（advance 对 implement 阶段拒绝手动重入、
    // failRun 即摘除本 run），键面仍按语义补齐以收口「既有调用点按语义补键」的字面要求。
    this.notify(run, msg, { key: 'run:fail' })
    this.releaseLock(run) // failRun = run 终结（入口三条路径 catch 后 runs.delete），互斥锁随终结摘除
  }
}
