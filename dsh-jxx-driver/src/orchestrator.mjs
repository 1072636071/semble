/**
 * 编排内核：卡位 watcher（轮询）+ 僵死计时器 + 就绪前沿 + 编程 spawn。
 * 只实现 PROTOCOL 已明写的状态转移；协议没覆盖的一律 blocked 转人工（ADR-0110 D6）。
 * 插件无 rm-wt / 删 control / 批量操作调用面（ADR-0110 D4）。
 */
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Board } from './board.mjs'
import { scanBoard, listTickets, findFeatureDir, ticketCardId, ticketNum, cardDeps } from './cards.mjs'
import { adrGate, prdGate, ticketsGate, opsGate } from './gates.mjs'
import { createQuickTicket } from './quick.mjs'
import { workerPrompt, reviewerPrompt, mergerPrompt, memberDirective, reviewerDims, parseVerdict } from './prompts.mjs'
import { resolveAgentTeams, createNamePool, createReuseLedger, createTeamChannel, backoffDelayMs, createMemberProbe, buildHandoffFromCard } from './team-spawn.mjs'

export const STAGES = ['decide', 'adr', 'prd', 'tickets', 'implement', 'ops', 'done']

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
  }

  // ---------- 公共入口 ----------

  start(agent, idea) {
    const sessionId = agent.session.id ?? agent.id
    const root = agent.session.header.cwd
    if (!root) throw new Error('jxx-driver: 当前会话没有工作目录（cwd 为空），无法编排')
    if (this.runs.has(sessionId)) throw new Error('本会话已有进行中的编排（/jxx status 查看，/jxx stop 停止）')
    const run = this.newRun(agent, sessionId, root, idea, 'decide')
    this.runs.set(sessionId, run)
    this.persist(run)
    this.notify(run, `已就位。当前阶段：decide。${this.hints.decide}`)
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
      cards: new Map(), timer: undefined, stopped: false,
      blocked: [], lastError: undefined, controllers: new Set(),
      // 团队路径（PRD 110 工单 02）：通道在 enterImplement 立项一次（非惰性——首个 tick 就要派 worker）。
      // 名字池/预算账本由通道工厂闭包持有，不挂 run（工单 03 换名重建时经 setupTeamChannel 重走）。
      channel: undefined,
      // 团队路径失败韧性（PRD 110 工单 03 / ADR-0121 D3）：LLM 失败不弃会话——
      // 失败先退避重发（同一会话唤醒），连续超限 notify 等用户切模型，救不活才换名重建（有损，最后手段）。
      resilience: { byCard: new Map(), revived: [] },
      // SETTLED 消息收割去重（双路去重：同一卡同一 settle 只收口一次）。
      settledSeen: new Set(), messageHarvestBusy: false,
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
      active: true, stage: run.stage, idea: run.idea, featureDir: run.featureDir,
      stageHint: this.hints[run.stage],
      createdAt: run.createdAt, updatedAt: run.updatedAt,
      cards: run.cards.size ? [...run.cards.entries()].map(([id, c]) => ({ id, phase: c.phase, retries: c.retries })) : [],
      blocked: run.blocked,
      lastError: run.lastError,
      board: board ? {
        inbox: board.inbox.map((c) => c.id),
        claimed: board.claimed.map((c) => c.id),
        review: board.review.map((c) => c.id),
        held: board.held,
        done: [...board.done],
      } : undefined,
      history: run.history.slice(-20),
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

  /** agent/disposed 时清场：停轮询、abort 在飞子会话。 */
  async onAgentDisposed(agent) {
    const sessionId = agent.session?.id ?? agent.id
    const run = this.runs.get(sessionId)
    if (run) await this.halt(run, '宿主会话已释放')
  }

  async dispose() {
    for (const run of [...this.runs.values()]) await this.halt(run, '插件卸载')
    this.runs.clear()
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
    }
    this.persist(run)
    // 团队路径立项（PRD 110 工单 02）：teamMode=auto 且宿主有 agentTeams 才建通道；
    // 惰性解析（无服务的宿主零依赖），建不起来响亮记录并回退一次性路径，不炸编排。
    // 必须先于 startWatcher：首个 tick 会立刻派 worker，通道未建会竞态到一次性路径
    // （实测：先 watcher 后立项 → 首 spawn 报「意外角色」、白耗一次重试预算——2026-10-08 E2E 红转绿的根因）。
    this.setupTeamChannel(run)
    this.startWatcher(run)
    this.notify(run, `进入 implement：${eligible.length} 张工单已投卡，编排器接管。并行上限 ${this.config.parallel}。`
      + (run.channel ? '团队模式：worker/合并专员走持久队友。' : ''))
  }

  /** 团队通道立项（PRD 110 工单 02 / ADR-0121）：服务缺失/构造失败 → run 无通道 = 一次性路径，不抛。 */
  setupTeamChannel(run) {
    if (this.config.teamMode !== 'auto') return
    const teams = resolveAgentTeams(this.ctx)
    if (!teams) return
    try {
      run.channel = createTeamChannel({
        teams,
        agent: run.agent,
        pool: createNamePool({}),
        ledger: createReuseLedger({ reuseLimit: this.config.reuseLimit }),
        provider: this.config.teamProvider,
        log: (msg) => this.log.info(`[jxx-driver] ${msg}`),
      })
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
    const mergeIdOf = (id) => `merge-${id}`

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
          this.spawnMerger(run, id, mergeId)
          run.history.push({ t: nowIso(), event: `${id} 三审全过，投合并卡 ${mergeId}` })
        } else {
          rec.phase = 'await-human-merge'
          run.blocked.push(`${id} 三审全过，autoMerge=false，待人工合并`)
          this.notify(run, `卡 ${id} 三审全过；autoMerge=false，请人工合并。`)
        }
      } else {
        rec.retries = (rec.retries || 0) + 1
        if (rec.retries > this.config.maxRetries) {
          rec.phase = 'blocked'
          const failedDims = dims.filter((d) => rec.reviewResults[d].verdict !== 'PASS')
          run.blocked.push(`${id} 审查不过（${failedDims.join('/')}），返工超限转人工`)
          this.notify(run, `卡 ${id} 审查 ${failedDims.join('/')} 不过，已达返工上限，转人工。`)
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
      if (rec.phase !== 'merging') continue
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
      // 合并专员已 settle 但合并卡没进 done → 看是否被 blocked（带 needs-info）
      if (rec.mergeSettledAt) {
        const mergeFile = join(run.root, 'control', 'cards', 'open', `${mergeId}.md`)
        const mergeBlocked = existsSync(mergeFile) && /-\s*labels:.*needs-info/.test(readFileSync(mergeFile, 'utf8'))
        const stuckMs = Date.now() - Date.parse(rec.mergeSettledAt)
        if (mergeBlocked || stuckMs > 10 * 60_000) {
          rec.phase = 'blocked'
          run.blocked.push(`${id} 合并未收口（合并卡 ${mergeId} 未进 done），转人工`)
          this.notify(run, `卡 ${id} 的合并卡 ${mergeId} 未收口，转人工核查。`)
          this.persist(run)
        }
      }
    }

    // 5) 就绪前沿：inbox 可领卡 + 空闲并行位 → spawn worker
    const activeWorkers = [...run.cards.values()].filter((c) => c.phase === 'claimed' && c.alive).length
    let freeSlots = this.config.parallel - activeWorkers
    for (const c of b.inbox.filter((x) => managed(x.id) && !x.id.startsWith('merge-'))) {
      if (freeSlots <= 0) break
      const rec = run.cards.get(c.id)
      if (rec.phase !== 'open' || rec.alive) continue
      this.spawnWorker(run, c.id)
      freeSlots -= 1
    }

    // 6) 僵死重 spawn：claimed 卡超时且无存活 worker
    const now = Date.now()
    for (const c of b.claimed.filter((x) => managed(x.id))) {
      const rec = run.cards.get(c.id)
      if (!rec || rec.alive || rec.phase !== 'claimed') continue
      if (now - c.mtime < this.config.staleMinutes * 60_000) continue
      rec.retries = (rec.retries || 0) + 1
      if (rec.retries > this.config.maxRetries) {
        rec.phase = 'blocked'
        run.blocked.push(`${c.id} 僵死超 ${this.config.staleMinutes} 分钟且重试超限，转人工`)
        this.notify(run, `卡 ${c.id} 僵死超过 ${this.config.staleMinutes} 分钟，重试已超限，转人工。`)
      } else {
        rec.lastFailure = `僵死超 ${this.config.staleMinutes} 分钟无回传（卡 mtime 无推进）`
        run.history.push({ t: nowIso(), event: `${c.id} 僵死，重 spawn` })
        this.spawnWorker(run, c.id)
      }
      this.persist(run)
    }

    // 7) 全部收口 → 进 ops
    const allDone = run.cards.size > 0 && [...run.cards.values()].every((c) => c.phase === 'done')
    if (allDone) {
      run.stage = 'ops'
      run.updatedAt = nowIso()
      run.history.push({ t: nowIso(), event: '全部工单 done，进 ops' })
      if (run.timer) { clearInterval(run.timer); run.timer = undefined }
      this.persist(run)
      this.notify(run, `全部工单已合并收口。进入运维收尾：请写回顾（docs/retro/），然后 jxx_flow(action=advance)。`)
    }
  }

  safeScan(run) {
    try { return scanBoard(run.root) } catch { return undefined }
  }

  // ---------- spawn ----------

  spawnWorker(run, cardId, extraNote = '') {
    const rec = run.cards.get(cardId)
    rec.phase = 'claimed'
    rec.alive = true
    rec.spawnedAt = nowIso()
    if (run.channel) {
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
      }).then((r) => {
        run.controllers.delete(controller)
        rec.memberName = r.name
        rec.lastFailure = undefined
        this.resilienceReset(run, cardId)
        run.history.push({ t: nowIso(), event: r.fresh ? `team: spawn worker ${cardId}（${r.name}）` : `team: 指令下发 ${cardId} → ${r.name}` })
        this.persist(run)
      }).catch((e) => {
        run.controllers.delete(controller)
        this.handleTeamDispatchFailure(run, cardId, e, {
          role: 'dev',
          fail: (note) => {
            rec.phase = 'blocked'
            rec.lastFailure = note
            run.blocked.push(`${cardId} team worker 连续失败超限：${note}`)
            void run.board?.cardMove(run.root, { id: cardId, to: 'blocked', reason: 'jxx-driver: team worker 连续失败超限，等待用户恢复' }).catch(() => {})
            this.notify(run, `卡 ${cardId} 的队友连续失败 ${note}。可在切换模型后让我继续（jxx_flow 继续或直接说「继续」），我将重新唤醒同一队友。`)
          },
          fallback: () => {
            const prompt = workerPrompt(run.root, cardId) + extraNote
            this.spawn(run, { role: 'dev', cardId, prompt, onSettled: (text, err) => this.onWorkerSettled(run, cardId, text, err) })
          },
        })
        this.persist(run)
      })
      return
    }
    const prompt = workerPrompt(run.root, cardId) + extraNote
    this.spawn(run, { role: 'dev', cardId, prompt, onSettled: (text, err) => this.onWorkerSettled(run, cardId, text, err) })
    run.history.push({ t: nowIso(), event: `spawn worker ${cardId}` })
    this.persist(run)
  }

  spawnReviewers(run, cardId) {
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
    if (run.channel) {
      // 团队路径（PRD 110 工单 02 / ADR-0121 D2）：合并专员持久队友化——同名复用，
      // 超预算时通道自派停发换新名 fresh 后继（交接上下文 = 指令点名合并卡）。
      const controller = new AbortController()
      run.controllers.add(controller)
      void run.channel.dispatch({
        role: 'merger',
        cardId: mergeId,
        prompt: mergerPrompt(run.root, mergeId, cardId, { member: true }),
        signal: controller.signal, // 宿主契约必填（同终审发现项①）
      }).then((r) => {
        run.controllers.delete(controller)
        this.resilienceReset(run, mergeId)
        run.history.push({ t: nowIso(), event: r.fresh ? `team: spawn 合并专员 ${mergeId}（${r.name}）` : `team: 合并专员复用 ${r.name}（${mergeId}）` })
        this.persist(run)
      }).catch((e) => {
        run.controllers.delete(controller)
        this.handleTeamDispatchFailure(run, mergeId, e, {
          role: 'merger',
          fail: (note) => {
            rec.mergeFailureNote = note
            run.blocked.push(`${cardId} 合并未收口（合并卡 ${mergeId} team merger 连续失败超限：${note}），转人工`)
            void run.board?.cardMove(run.root, { id: mergeId, to: 'blocked', reason: `jxx-driver: team merger 连续失败超限（${note}），等待用户恢复` }).catch(() => {})
            this.notify(run, `合并卡 ${mergeId} 的队友连续失败 ${note}。可在切换模型后让我继续，我将重新唤醒同一队友收口。`)
          },
          fallback: () => {
            const prompt = mergerPrompt(run.root, mergeId, cardId)
            this.spawn(run, { role: 'merger', cardId, prompt, onSettled: (text, err) => this.onMergerSettled(run, cardId, text, err) })
          },
        })
        this.persist(run)
      })
      return
    }
    const prompt = mergerPrompt(run.root, mergeId, cardId)
    this.spawn(run, { role: 'merger', cardId, prompt, onSettled: (text, err) => this.onMergerSettled(run, cardId, text, err) })
    run.history.push({ t: nowIso(), event: `spawn 合并专员 ${mergeId}` })
    this.persist(run)
  }

  spawn(run, { role, cardId, prompt, onSettled }) {
    const controller = new AbortController()
    const rec = run.cards.get(cardId)
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
      if (rec) rec.alive = false
      try { onSettled(text, err) } catch (e) { this.log.warn(`[jxx-driver] onSettled 异常：${e.message}`) }
      this.persist(run)
    }
    void start()
  }

  // ---------- 团队路径失败韧性（PRD 110 工单 03 / ADR-0121 D3：LLM 失败不弃会话） ----------

  /**
   * 团队路径派发失败的统一入口：等待用户恢复（默认）→ 同会话退避重发；用户已恢复 → 立即唤醒；
   * 队友已 failed（探针实证）→ 换名重建 fresh 后继 + 卡面交接简报；超限 → fail 回调置卡位转人工。
   * 只对 teamPath 派发失败生效；一次性路径失败走既有 onXxxSettled 语义，逐字节不动。
   */
  handleTeamDispatchFailure(run, cardId, error, { role, fail }) {
    const note = `team 派发失败（${error?.message || String(error)}）`
    if (!run.channel) {
      this.log.warn(`[jxx-driver] ${note}，无通道兜底一次性路径`)
      this.spawnFallback(cardId, role, run)
      return
    }
    const state = this.resilienceState(run, cardId)
    if (state.revived) {
      // 用户已在等待窗内恢复过一次 → 唤醒后的失败是同一会话内的又一次失败，回到退避计数
      state.revived = false
      run.history.push({ t: nowIso(), event: `${cardId} team: 唤醒后再次失败（${error.message}），回到退避计数` })
    }
    state.failures += 1
    state.lastError = error.message || String(error)
    // failed 探针为真 → 会话已死（无复活边），换名重建；否则失败先按「可唤醒」处理。
    // 每次失败都探（宿主 listMembers 只读便宜）：memberFailed 是换名重建的唯一实证门。
    if (state.memberName !== undefined && this.probeOf(run).memberFailed(state.memberName)) {
      this.respawnTeammate(run, cardId, role, state, note)
      return
    }
    if (state.failures > this.config.teamBackoff) {
      // 连续超限（工单 3）：notify + 卡位转人工等待——用户切模型后经 jxx reviveMs 恢复唤醒**同一队友**
      state.waiting = true
      state.waitingSince = nowIso()
      run.history.push({ t: nowIso(), event: `${cardId} team: 连续失败 ${state.failures - 1}/${this.config.teamBackoff} 超限，等待用户恢复（不弃会话）` })
      fail(note)
      return
    }
    this.scheduleTeamResend(run, cardId, role, state, note)
  }

  /** 退避曲线（工单 3：min(2^n * 5s, 60s)）。实例方法 = 测试面可覆写控时，产品语义不变。 */
  backoffDelay(attempt) {
    return backoffDelayMs(attempt)
  }

  /** 同会话退避重发：不 spawnTeammate 新会话，同名 sendMessage 重发当前指令（构建内容 2）。 */
  scheduleTeamResend(run, cardId, role, state, note) {
    const delay = this.backoffDelay(state.failures)
    state.timer = setTimeout(() => {
      state.timer = undefined
      if (run.stopped || run.stage !== 'implement') return
      void (async () => {
        try {
          await this.resendTeamDirective(run, cardId, role, note)
        } catch (e) {
          this.handleTeamDispatchFailure(run, cardId, e, { role, fail: this.failHandlerOf(run, cardId, role) })
        }
      })()
    }, delay)
    if (typeof state.timer.unref === 'function') state.timer.unref()
    run.history.push({ t: nowIso(), event: `${cardId} team: 派发失败（${note}），${delay / 1000}s 后同名重发（不新开会话）` })
    this.persist(run)
  }

  /** 同名重发当前指令：worker = 领卡指令 + 尾注；merger = 合并指令 + 尾注（继续点名 SETTLED 行）。 */
  async resendTeamDirective(run, cardId, role, note) {
    if (role === 'dev') {
      const rec = run.cards.get(cardId)
      // 唤醒落卡位：fail 落过 blocked 的卡移回 claimed（在办），manager 面恢复语义
      if (rec && rec.phase === 'blocked') {
        rec.phase = 'claimed'
        try {
          await run.board?.cardMove(run.root, { id: cardId, to: 'claimed', reason: 'jxx-driver: 用户已恢复，队友唤醒续跑' })
          run.history.push({ t: nowIso(), event: `${cardId} 卡位 blocked → claimed（唤醒恢复）` })
        } catch (e) {
          this.log.warn(`[jxx-driver] ${cardId} 卡位回 claimed 失败：${e.message}`)
        }
      }
    }
    if (role === 'merger') {
      const devId = cardId.slice('merge-'.length)
      const prompt = mergerPrompt(run.root, cardId, devId, { member: true })
        + `\n上次派发失败（自动重发）：${note}\n`
      await run.channel.dispatch({ role: 'merger', cardId, prompt, signal: AbortSignal.any([AbortSignal.timeout(30_000)]) })
      return
    }
    const rec = run.cards.get(cardId)
    if (!rec || rec.phase !== 'claimed') return // 卡已推进/收口：重发作废
    const retryNote = rec.lastFailure ? `上次失败原因：${rec.lastFailure}` : `上次派发失败：${note}`
    const prompt = (rec.memberName ? memberDirective(cardId, retryNote) : workerPrompt(run.root, cardId, { member: true }))
      + `\n上次派发失败（自动重发）：${note}\n`
    // 同名直发（resend）：目标 = 卡账记名 → 通道 cardOwners（首派即败时唯一痕迹）；不得落到名字池开新名
    const hintName = rec.memberName || run.channel.nameOf(cardId)
    await run.channel.dispatch({ role: 'dev', name: hintName, resend: true, cardId, poolSize: this.config.parallel, prompt, signal: AbortSignal.any([AbortSignal.timeout(30_000)]) })
    rec.alive = true
    run.history.push({ t: nowIso(), event: `team: ${cardId} 同名重发 → ${rec.memberName}（同会话唤醒，上下文零丢失）` })
  }

  /**
   * 换名重建（构建内容 4，最后手段）：宿主侧确认 failed（探针）→ 名字池取新名 spawnTeammate fresh 重建；
   * 交接简报从**卡面流转段**提取（≤2000 字符）拼入首条指令。通道 rebuilt 回调换新通道，
   * 新名从池取（宿主约束：旧名永不复用）。失败 → 一次性路径兜底（D3：不弃编排）。
   */
  respawnTeammate(run, cardId, role, state, note) {
    // 旧队友名：卡账（成功过）→ 通道 cardOwners（首派即败时唯一痕迹）；都拿不到 = 定位不了死者，走一次性兜底
    const oldName = state.memberName || run.channel.nameOf(cardId) || undefined
    if (oldName === undefined) {
      this.log.warn(`[jxx-driver] team 换名重建定位不到旧队友名（${cardId}），回退一次性路径`)
      run.history.push({ t: nowIso(), event: `team: 换名重建定位不到旧队友名（${cardId}），回退一次性路径` })
      this.spawnFallback(cardId, role, run)
      return
    }
    if (state.timer) { clearTimeout(state.timer); state.timer = undefined }
    const handoff = this.buildHandoff(run, cardId)
    let newChannel
    try {
      newChannel = run.channel.rebuild({ role, oldName, reason: note })
    } catch (e) {
      this.log.warn(`[jxx-driver] team 通道重建失败（${cardId}）：${e.message}，回退一次性路径`)
      run.history.push({ t: nowIso(), event: `team: 通道重建失败（${cardId}）：${e.message}` })
      this.spawnFallback(cardId, role, run)
      return
    }
    const prevChannel = run.channel
    run.channel = newChannel
    const controller = new AbortController()
    run.controllers.add(controller)
    // 新名一律从池取（rebuild 已把旧名进 taken——宿主约束：名字永不复用）
    const prompt = (role === 'merger'
      ? mergerPrompt(run.root, cardId, cardId.slice('merge-'.length), { member: true })
      : workerPrompt(run.root, cardId, { member: true }))
      + `\n---\n交接简报（前一队友 ${oldName} 因 ${note} 退出，你接手同名卡）：\n${handoff || '（交接简报缺失：卡无可读流转行）'}\n`
    void newChannel.dispatch({ role, cardId, poolSize: this.config.parallel, prompt, signal: controller.signal })
      .then((r) => {
        run.controllers.delete(controller)
        this.resilienceReset(run, cardId)
        run.history.push({ t: nowIso(), event: `team: ${cardId} 换名重建 ${oldName} → ${r.name}（fresh，交接简报 ${handoff ? `${handoff.length} 字符` : '缺失'}）` })
        run.revived.push(`${nowIso()} ${cardId}: ${oldName} → ${r.name}`)
        this.persist(run)
      })
      .catch((e2) => {
        run.controllers.delete(controller)
        run.channel = prevChannel
        this.log.warn(`[jxx-driver] team 重建派发失败（${cardId}）：${e2.message}，回退一次性路径`)
        this.spawnFallback(cardId, role, run)
        this.persist(run)
      })
  }

  /** 一次性路径兜底（D3：彻底救不活也不弃编排）。 */
  spawnFallback(cardId, role, run) {
    if (role === 'merger') {
      const devId = cardId.slice('merge-'.length)
      this.spawn(run, { role: 'merger', cardId: devId, prompt: mergerPrompt(run.root, cardId, devId), onSettled: (text, err) => this.onMergerSettled(run, devId, text, err) })
      return
    }
    const rec = run.cards.get(cardId)
    const extra = rec?.lastFailure ? `\n\n上次失败原因：${rec.lastFailure}` : ''
    this.spawn(run, { role: 'dev', cardId, prompt: workerPrompt(run.root, cardId) + extra, onSettled: (text, err) => this.onWorkerSettled(run, cardId, text, err) })
  }

  /** 一次性路径兜底时该卡派发失败的后续处置（超限 → blocked 转人工）。 */
  failHandlerOf(run, cardId, role) {
    return (note) => {
      const rec = run.cards.get(cardId)
      if (role === 'merger') {
        if (rec) rec.mergeFailureNote = note
        run.blocked.push(`${cardId} 合并未收口（合并卡 merge-${cardId} team merger 连续失败超限：${note}），转人工`)
        this.notify(run, `合并卡 merge-${cardId} 的队友连续失败 ${note}，转人工核查。`)
        return
      }
      if (rec) {
        rec.phase = 'blocked'
        rec.lastFailure = note
        void run.board?.cardMove(run.root, { id: cardId, to: 'blocked', reason: 'jxx-driver: team worker 连续失败超限，等待用户恢复' }).catch(() => {})
      }
      run.blocked.push(`${cardId} team worker 连续失败超限：${note}`)
      this.notify(run, `卡 ${cardId} 的队友连续失败 ${note}。可在切换模型后让我继续（jxx_flow 继续或直接说「继续」），我将重新唤醒同一队友。`)
    }
  }

  /** 卡面交接简报（构建内容 4）：读 open/ 卡文件流转段 → buildHandoffFromCard（≤2000 字符）。 */
  buildHandoff(run, cardId) {
    const base = cardId.startsWith('merge-') ? cardId.slice('merge-'.length) : cardId
    for (const suffix of ['.md', '.claimed.md', '.review.md']) {
      const file = join(run.root, 'control', 'cards', 'open', `${base}${suffix}`)
      if (!existsSync(file)) continue
      try {
        return buildHandoffFromCard(readFileSync(file, 'utf8')).text
      } catch { /* 读不到按缺失处理 */ }
    }
    return ''
  }

  resilienceState(run, cardId) {
    let st = run.resilience.byCard.get(cardId)
    if (!st) {
      st = { failures: 0, timer: undefined, waiting: false, waitingSince: undefined, revived: false, memberName: undefined, lastError: undefined }
      run.resilience.byCard.set(cardId, st)
    }
    const rec = run.cards.get(cardId)
    st.memberName = rec?.memberName
      ?? (cardId.startsWith('merge-') ? run.cards.get(cardId.slice('merge-'.length))?.mergeMemberName : undefined)
      ?? run.channel?.nameOf(cardId) // 首派即败：名字只在通道 cardOwners（成功过才进卡账）
    return st
  }

  resilienceReset(run, cardId) {
    const st = run.resilience.byCard.get(cardId)
    if (!st) return
    if (st.timer) { clearTimeout(st.timer); st.timer = undefined }
    st.failures = 0
    st.waiting = false
    st.waitingSince = undefined
    st.revived = false
    st.lastError = undefined
  }

  /** 成功唤醒账本合并 + 归档记录（build 3：用户恢复后唤醒成功）。 */
  reviveTeamWaiter(run, why) {
    let revived = 0
    for (const [cardId, st] of run.resilience.byCard) {
      if (!st.waiting) continue
      const rec = run.cards.get(cardId)
      const merging = cardId.startsWith('merge-')
      const mainRec = merging ? run.cards.get(cardId.slice('merge-'.length)) : rec
      // 卡位判定：等待窗内卡可能已被 fail 落成 blocked（worker 卡）或停在 merging（合并卡）
      const cardOk = merging ? mainRec?.phase === 'merging' : (rec?.phase === 'claimed' || rec?.phase === 'blocked')
      if (!mainRec || !cardOk) continue
      st.waiting = false
      st.revived = true
      const role = merging ? 'merger' : 'dev'
      setTimeout(() => {
        if (run.stopped || run.stage !== 'implement') return
        void (async () => {
          try {
            await this.resendTeamDirective(run, cardId, role, `用户已恢复（${why}）`)
            this.resilienceReset(run, cardId)
          } catch (e) {
            this.handleTeamDispatchFailure(run, cardId, e, { role, fail: this.failHandlerOf(run, cardId, role) })
          }
        })()
      }, 100)
      revived += 1
      run.history.push({ t: nowIso(), event: `team: ${cardId} 用户恢复，唤醒同一队友（${why}）` })
    }
    if (revived > 0) {
      this.notify(run, `已唤醒 ${revived} 个等待中的队友（${why}），继续同会话推进。`)
      this.persist(run)
    }
    return revived
  }

  probeOf(run) {
    if (!run._probe) run._probe = createMemberProbe({ teams: this.ctx.get?.('agentTeams'), agent: run.agent, log: (msg) => this.log.info(`[jxx-driver] ${msg}`) })
    return run._probe
  }

  // ---------- 子会话收口回调 ----------

  onWorkerSettled(run, cardId, _text, err) {
    const rec = run.cards.get(cardId)
    if (!rec) return
    if (err) {
      rec.retries = (rec.retries || 0) + 1
      rec.lastFailure = err.message // 重试附失败原因（构建内容 3）
      if (rec.retries > this.config.maxRetries) {
        rec.phase = 'blocked'
        run.blocked.push(`${cardId} worker 失败超限：${err.message}`)
        this.notify(run, `卡 ${cardId} worker 失败：${err.message}。已达重试上限，转人工。`)
      } else {
        rec.phase = 'open'
        run.history.push({ t: nowIso(), event: `${cardId} worker 失败（${err.message}），重试 ${rec.retries}` })
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

  onMergerSettled(run, cardId, _text, err) {
    const rec = run.cards.get(cardId)
    if (!rec) return
    if (err) {
      rec.phase = 'blocked'
      run.blocked.push(`${cardId} 合并专员失败：${err.message}`)
      this.notify(run, `卡 ${cardId} 合并专员失败：${err.message}，转人工。`)
      return
    }
    rec.mergeSettledAt = nowIso()
    // 是否真收口，下一个 tick 看合并卡是否进 done/（卡位才是真信号）
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
        // 开发卡：在办（claimed）且 alive 未清——alive 闸堵「同窗口重复消息双计预算」（终审发现项③）
        if (run.cards.get(cardId)) {
          const rec = run.cards.get(cardId)
          return rec.phase === 'claimed' && rec.alive !== false
        }
        // 合并卡（merge-<id>）：主卡 phase=merging 且合并专员 settle 未置位——
        // merge 卡不在 run.cards（编排卡账只录开发卡），闸看主卡（审查发现项②修复）。
        if (cardId.startsWith('merge-')) return run.cards.get(cardId.slice('merge-'.length))?.phase === 'merging'
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
            const devId = cardId.slice('merge-'.length)
            run.cards.get(devId) && (run.cards.get(devId).mergeMemberName = run.channel.nameOf(cardId))
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

  notify(run, text) {
    run.history.push({ t: nowIso(), event: `通知：${text.slice(0, 80)}` })
    run.updatedAt = nowIso()
    try {
      const live = this.ctx.agents.get(run.agent.id)
      if (live === run.agent) {
        run.agent.followup({
          id: randomUUID(),
          role: 'user',
          content: [{ type: 'text', text: `[jxx-driver] ${text}` }],
          source: { kind: 'user' },
        })
      }
    } catch (e) {
      this.log.warn(`[jxx-driver] 通知失败（会话可能已释放）：${e.message}`)
    }
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
        revived: run.revived,
        blocked: run.blocked,
        history: run.history,
      })
    } catch (e) {
      this.log.warn(`[jxx-driver] 状态落盘失败：${e.message}`)
    }
  }

  async halt(run, reason) {
    run.stopped = true
    if (run.timer) { clearInterval(run.timer); run.timer = undefined }
    for (const st of run.resilience?.byCard?.values() || []) { if (st.timer) { clearTimeout(st.timer); st.timer = undefined } }
    for (const c of run.controllers || []) { try { c.abort() } catch { /* noop */ } }
    run.controllers?.clear()
    run.history.push({ t: nowIso(), event: `停止：${reason}` })
    this.persist(run)
    this.runs.delete(run.sessionId)
  }

  failRun(run, msg) {
    run.lastError = msg
    run.history.push({ t: nowIso(), event: `失败：${msg}` })
    this.notify(run, msg)
  }
}
