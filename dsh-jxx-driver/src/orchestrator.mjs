/**
 * 编排内核：卡位 watcher（轮询）+ 僵死计时器 + 就绪前沿 + 编程 spawn。
 * 只实现 PROTOCOL 已明写的状态转移；协议没覆盖的一律 blocked 转人工（ADR-0110 D6）。
 * 插件无 rm-wt / 删 control / 批量操作调用面（ADR-0110 D4）。
 */
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Board } from './board.mjs'
import { scanBoard, listTickets, listPrds, prdListText, ticketCardId, ticketNum, cardDeps } from './cards.mjs'
import { adrGate, prdGate, ticketsGate, opsGate } from './gates.mjs'
import { createQuickTicket } from './quick.mjs'
import { workerPrompt, reviewerPrompt, mergerPrompt, reviewerDims, parseVerdict } from './prompts.mjs'

export const STAGES = ['decide', 'adr', 'prd', 'tickets', 'implement', 'ops', 'done']

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
 * 免确认版提示词（config.autoConfirm=true，默认 · ADR-0113）：插件驱动的编排队列
 * **不向用户追问**——决策定稿、PRD seam、工单粒度全部由你按推荐自行拍板并直接落盘。
 * 技能正文里的人工闸门（jxx-to-spec 第 2 步「与用户确认 seam」、jxx-to-tickets 第 4 步
 * 「询问粒度直到用户批准」）是给人手跑会话的，本编排会话明确豁免：**不要 ask_user_question、
 * 不要停下等确认**，把拍板理由写进产出文档（ADR「决策」段 / PRD 对应小节）留痕。
 * 免确认不等于免判断：方案取舍仍要照技能的实质要求做（垂直切片规则、阻塞边、seam 取最高层）。
 */
export const AUTO_CONFIRM_HINTS = {
  ...STAGE_HINTS,
  decide: '由你**直接完成决策**（本编排队列免确认：不再一次一问地 grill 用户，按推荐自行拍板并把取舍理由写进 ADR 的「决策」段）；定稿后把决策写成 ADR（docs/adr/NNNN-<slug>.md，结构：H1 `# ADR-NNNN · 标题` + `## 背景`/`## 决策`/`## 后果`），然后调用 jxx_flow(action=advance)。',
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

  /** 对既有 PRD 直接进入 implement（对应 jxx-ticket-board 的 auto 模式）。
   * 参数解析（ADR-0110 D3：机械解析归插件，语义归 agent）：
   *  - 无参 → 抛 candidates（agent 读 status.prds 自行裁决后带编号重调）；
   *  - 纯数字/NN → 精确编号匹配；
   *  - slug 子串/标题子串 → 唯一命中即用，多命中抛 candidates；
   *  - 自由文本（如"完成这些优化"）→ 同 slug 匹配，不命中抛 candidates + 原文，由 agent 语义裁决。 */
  async auto(agent, prdPrefix) {
    const sessionId = agent.session.id ?? agent.id
    const root = agent.session.header.cwd
    if (!root) throw new Error('jxx-driver: 当前会话没有工作目录（cwd 为空），无法编排')
    if (this.runs.has(sessionId)) throw new Error('本会话已有进行中的编排（/jxx status 查看，/jxx stop 停止）')
    const prds = listPrds(root)
    if (prds.length === 0) {
      throw new Error('jxx-driver: .scratch/ 下没有 PRD——先 /jxx start 走决策→PRD，或确认工作目录正确')
    }
    const raw = String(prdPrefix || '').trim()
    let featureDir
    if (raw === '') {
      const e = new Error('jxx-driver: auto 需要指定 PRD。当前可选：')
      e.code = 'CANDIDATES'
      e.prds = prds
      throw e
    }
    const wanted = raw.replace(/^0+/, '') || raw
    const byNum = prds.filter((p) => p.num === wanted || p.num === raw)
    if (byNum.length === 1) {
      featureDir = byNum[0].dir
    } else {
      const kw = raw.toLowerCase()
      const byText = prds.filter((p) => p.slug.toLowerCase().includes(kw) || p.title.toLowerCase().includes(kw))
      if (byText.length === 1) {
        featureDir = byText[0].dir
      } else {
        const e = new Error(
          (byText.length > 1 ? `jxx-driver: 「${raw}」命中 ${byText.length} 份 PRD，请指定编号：` : `jxx-driver: 「${raw}」匹配不到 PRD。当前可选：`)
          + prdListText(byText.length > 1 ? byText : prds))
        e.code = 'CANDIDATES'
        e.prds = byText.length > 1 ? byText : prds
        e.rawInput = raw
        throw e
      }
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
    this.startWatcher(run)
    this.notify(run, `进入 implement：${eligible.length} 张工单已投卡，编排器接管。并行上限 ${this.config.parallel}。`)
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

  // ---------- 子会话收口回调 ----------

  onWorkerSettled(run, cardId, _text, err) {
    const rec = run.cards.get(cardId)
    if (!rec) return
    if (err) {
      rec.retries = (rec.retries || 0) + 1
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
      writeJsonAtomic(join(run.root, 'control', 'jxx-driver-state.json'), {
        id: run.id, stage: run.stage, idea: run.idea, featureDir: run.featureDir,
        createdAt: run.createdAt, updatedAt: run.updatedAt,
        cards: Object.fromEntries([...run.cards.entries()].map(([id, c]) => [id, { phase: c.phase, retries: c.retries, spawnedAt: c.spawnedAt, note: c.note }])),
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
