/**
 * team-spawn 层（PRD 110 工单 01+02 / ADR-0121）：
 * 宿主智能体团队模式（agentTeams）的懒解析、队友名字池、复用预算、SETTLED 机读行解析，
 * 以及编排器接入的团队通道（指令下发 dispatch + SETTLED 回传收割 harvest + 预算退役）。
 *
 * 设计要点：
 *  - resolveAgentTeams 走鸭子类型懒解析，不进 index.mjs 的 inject 静态声明——
 *    无该服务的宿主必须还能装载（现有 ctx.get('commands') 同款可选解析先例）。
 *  - 名字池：角色前缀（dev/merger）+ 字母递增（dev-a、dev-b…）；被占用/重建过的名字跳过；
 *    生成名遵守 lower-kebab-case、≤64、不得为 lead（宿主硬约束）；池耗尽响亮报错转人工。
 *  - 复用预算：每队友完成任务计数；超过 reuseLimit 由 maybeRetire 判 retire，
 *    供上层换名重建 fresh 后继（重建中的交接简报与失败唤醒是工单 03）。
 *  - 团队通道（工单 02）：worker 池（= config.parallel，并发卡各占一个队友、各领卡串行）
 *    与合并专员（池 = 1）走持久队友（spawnTeammate 首次 + sendMessage 复用）；
 *    三维审查者保持一次性 spawn（ADR-0121 D1）。settle 收割 = Lead 会话 team-message 文本里的
 *    `SETTLED: <卡id>`；卡位扫描兜底不动，双路去重（同一卡同一 settle 只收口一次）。
 *  - 失败韧性（工单 03）：同名直发 dispatch(resend)（不在册响亮报错，绝不静默开新名）、
 *    换名重建 rebuild（同一通道摘旧名取新名；「旧名永不复用」由名字池 used 集合自身保证——
 *    池分配即占用、永不回收，rebuild 只摘名册与在飞卡，不触池）。
 */

/** 懒解析宿主 agentTeams 服务：ctx 缺失 / 无 get / 服务缺三方法之一 → undefined（不抛）。 */
export function resolveAgentTeams(ctx) {
  if (!ctx || typeof ctx.get !== 'function') return undefined
  let service
  try {
    service = ctx.get('agentTeams')
  } catch {
    return undefined
  }
  if (!service || typeof service !== 'object') return undefined
  for (const method of ['spawnTeammate', 'sendMessage', 'interrupt']) {
    if (typeof service[method] !== 'function') return undefined
  }
  return service
}

/**
 * merge 卡 id ↔ 开发卡 id 归一（R1 审查重复代码发现项单源化）：
 * `devIdOf('merge-x') === 'x'`（恒等其余输入）；`mergeIdOf('x') === 'merge-x'`（恒等其余输入）。
 * merger 调用点两侧 id 口径混用是首轮实测缺陷源（failHandlerOf 不可达写、简报 base 归一重复），
 * 一切前缀手术收口到这两个助手。
 */
export function devIdOf(cardId) {
  return cardId.startsWith('merge-') ? cardId.slice('merge-'.length) : cardId
}

export function mergeIdOf(cardId) {
  return cardId.startsWith('merge-') ? cardId : `merge-${cardId}`
}

/** 宿主硬约束：队友名 lower-kebab-case、≤64、不得为 lead。 */
export function isValidName(name) {
  return (
    typeof name === 'string' &&
    name.length <= 64 &&
    name !== 'lead' &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
  )
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

/**
 * 队友名字池工厂。taken/retired 里的名字永久跳过（宿主约束：名字永不复用）；
 * 池耗尽响亮报错转人工，不静默兜底。
 */
export function createNamePool({ taken = [], retired = [] } = {}) {
  const used = new Set([...taken, ...retired])
  return {
    /** 取该角色前缀下一个可用名（dev-a、dev-b…），取出即占用。 */
    next(role) {
      // 与 isValidName 同一 kebab 规则（禁止尾连字符），杜绝产出 dev--a 这类过不了自家校验的名字
      if (typeof role !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(role)) {
        throw new Error(`jxx-driver: 名字池角色前缀非法：${JSON.stringify(role)}`)
      }
      for (const letter of LETTERS) {
        const candidate = `${role}-${letter}`
        if (used.has(candidate)) continue
        used.add(candidate)
        return candidate
      }
      throw new Error(`jxx-driver: 名字池耗尽（${role}-a..z 全部被占用/重建过）——转人工处置`)
    },
  }
}

/**
 * 队友复用预算账本：recordCompletion 计数，maybeRetire 按「完成任务数 > reuseLimit」判 retire
 * （工单原文「超过 reuseLimit」= 严格大于；恰好等于不退，测试钉死边界）。
 */
export function createReuseLedger({ reuseLimit } = {}) {
  if (!Number.isSafeInteger(reuseLimit) || reuseLimit < 1) {
    throw new Error(`jxx-driver: reuseLimit 必须是 ≥1 的整数，收到 ${JSON.stringify(reuseLimit)}`)
  }
  const counts = new Map()
  return {
    /** 记一次任务完成。 */
    recordCompletion(name) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    },
    completedCount(name) {
      return counts.get(name) ?? 0
    },
    /** 超过 reuseLimit → retire: true，供上层停发并换名重建（本单不实现重建）。 */
    maybeRetire(name) {
      return { retire: (counts.get(name) ?? 0) > reuseLimit }
    },
  }
}

/**
 * 机读行解析：匹配正文中的 `SETTLED: <卡id>` 行，返回卡 id 或 undefined。
 * fail-closed：非字符串 / 无匹配行 / 小写 settled: / 冒号后同行无内容 一律 undefined，宁缺勿错。
 * （spec 原式 `/^SETTLED:\s*(.+)\s*$/m` 的冒号后 `\s*` 可跨行吞下一行——审查发现项，改为逐行
 * 切分 + 仅同行 `[ \t]` 空白，卡 id 空白兜底 undefined；首个命中行即定论，不 scavenging 后续行。）
 */
export function parseSettled(text) {
  if (typeof text !== 'string') return undefined
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^SETTLED:[ \t]*(.*)$/.exec(rawLine)
    if (m) {
      const id = m[1].trim()
      return id === '' ? undefined : id
    }
  }
  return undefined
}

/**
 * 团队通道工厂（PRD 110 工单 02 / ADR-0121 D1/D2）：worker/合并专员的持久队友指令下发与 SETTLED 回传收割。
 *  - dispatch：返工/重试的点名队友仍在册 → sendMessage 复用（同一会话带上下文接指令）；
 *    无点名 / 点名已退役不在册 → 先把同角色超预算的旧队友「停发」（不再接新活、从名册摘除，
 *    宿主约束名字永不复用，在飞轮次不追杀——生命周期收口在工单 03/04），再复用同角色未超预算者，
 *    最后从名字池取新名 spawnTeammate 建 fresh 后继；交接上下文 = 指令文本自带卡号与最新状态
 *    （worker 返工附审查发现、重试附失败原因；merger 交接简报是工单 03 的活）。
 *  - harvest：解析投递到 Lead 的 team-message 文本（末行 `SETTLED: <cardId>`）→ 卡在办（phase=claimed）
 *    才收口——onSettled 语义与一次性路径完全一致；卡位是唯一真相信号，消息丢失时 watcher 兜底
 *    照常推进，双路（消息 + 卡位）天然去重（ADR-0110：不引入第二真相源）。
 *  - 预算真源唯一：retire 判定只走 ledger.maybeRetire（账本构造时已注入 reuseLimit），本工厂不收第二份。
 */
export function createTeamChannel({ teams, agent, pool, ledger, provider = 'spawn', log } = {}) {
  if (!teams || typeof teams !== 'object') {
    throw new Error(`jxx-driver: createTeamChannel 需要已解析的 agentTeams 服务，收到 ${JSON.stringify(teams)}`)
  }
  if (!agent) throw new Error('jxx-driver: createTeamChannel 需要 Lead agent（caller 凭据，exact live Agent）')
  if (!pool || typeof pool.next !== 'function') {
    throw new Error('jxx-driver: createTeamChannel 需要名字池（createNamePool 产物）')
  }
  if (!ledger || typeof ledger.maybeRetire !== 'function') {
    throw new Error('jxx-driver: createTeamChannel 需要复用预算账本（createReuseLedger 产物）')
  }
  if (log === undefined) log = () => {}

  /** name -> { role, completed }（completed 与 ledger 同步推进，派发侧直接判复用）。 */
  const members = new Map()
  /** cardId -> 最近一次派发的队友名（settle 时计预算用）。 */
  const cardOwners = new Map()
  /** 在飞卡集合（dispatch 入册、harvest 出册）——「队友空闲」= 名下无在飞卡。 */
  const inFlight = new Set()
  let retiredTotal = 0
  const recordCompletion = (name) => {
    ledger.recordCompletion(name)
    const m = members.get(name)
    if (m) m.completed += 1
  }
  /** 该队友名下在飞卡数（0 = 空闲，可接新卡）。 */
  const loadOf = (name) => [...inFlight].filter((c) => cardOwners.get(c) === name).length

  /** 通道本体（具名自引用：rebuild 返回自身，编排层直接换引用）。 */
  const api = {
    /**
     * 指令下发。返回 { name, fresh, retired }：fresh = 本次 spawnTeammate 新建；
     * retired = 本次因超预算停发的旧队友数。
     *
     * 池语义（工单 02 构建内容 2：worker 池 = poolSize，各领卡串行）：无点名时——
     * ① 先把「超预算且空闲（名下无在飞卡）」的同角色旧队友停发（在飞的退役留给工单 03 收口）；
     * ② 复用空闲且未超预算的队友（多个空闲取完成数最少者）；
     * ③ 在册同角色数 < poolSize → 名字池取新名 spawnTeammate（并发卡各得一个队友）；
     * ④ 池满且全员忙 → 取在飞最少者复用（宿主信箱按序投递 = 该队友串行领卡）。
     */
    async dispatch({ role, name: hintName, cardId, prompt, description, signal, poolSize = 1, resend = false }) {
      if (typeof role !== 'string' || role === '') {
        throw new Error(`jxx-driver: dispatch 缺角色前缀，收到 ${JSON.stringify(role)}`)
      }
      if (!Number.isSafeInteger(poolSize) || poolSize < 1) {
        throw new Error(`jxx-driver: dispatch poolSize 必须是 ≥1 的整数，收到 ${JSON.stringify(poolSize)}`)
      }
      const retires = []
      let name = hintName
      if (resend) {
        // 同名直发（工单 03 同会话唤醒）：目标必须显式点名且在册——不在册响亮报错，绝不静默开新名
        if (name === undefined || !members.has(name)) {
          throw new Error(`jxx-driver: 同名重发目标不在册：${JSON.stringify(name)}（换名重建或一次性路径由上层裁决）`)
        }
      } else if (name === undefined || !members.has(name)) {
        if (name !== undefined) log(`team: 点名 ${name} 已不在册（退役/历史名册），按新名重建 fresh 后继`)
        for (const [n, m] of members) {
          if (m.role === role && loadOf(n) === 0 && ledger.maybeRetire(n).retire) {
            retires.push(n)
            members.delete(n) // 停发：不再接新活（名字永不复用，后继走新名）
          }
        }
        const idle = [...members.entries()]
          .filter(([n, m]) => m.role === role && loadOf(n) === 0 && !ledger.maybeRetire(n).retire)
          .sort((a, b) => a[1].completed - b[1].completed)
        const roleCount = [...members.values()].filter((m) => m.role === role).length
        if (idle.length > 0) name = idle[0][0]
        else if (roleCount < poolSize) name = pool.next(role)
        else {
          // 池满且全员忙（或空闲者都到预算）：取在飞最少者复用——宿主信箱保证其串行消化
          const busy = [...members.entries()].filter(([, m]) => m.role === role)
          if (busy.length === 0) name = pool.next(role)
          else name = busy.sort((a, b) => loadOf(a[0]) - loadOf(b[0]))[0][0]
        }
      }
      if (!isValidName(name)) {
        throw new Error(`jxx-driver: 队友名非法：${JSON.stringify(name)}（须 lower-kebab-case、≤64、非 lead）`)
      }
      if (cardId !== undefined) {
        cardOwners.set(cardId, name)
        if (!inFlight.has(cardId)) inFlight.add(cardId) // 在飞入册（返工重派同一卡不重复计）
      }
      retiredTotal += retires.length
      if (members.has(name)) {
        await teams.sendMessage(agent, {
          target: name,
          content: [{ type: 'text', text: prompt }],
          signal,
        })
        log(`team: 指令下发 ${name}（复用，角色 ${role}${cardId ? `，卡 ${cardId}` : ''}）`)
        return { name, fresh: false, retired: retires.length }
      }
      await teams.spawnTeammate(agent, {
        name,
        description: description ?? (cardId ? `jxx-driver ${role} · ${cardId}` : `jxx-driver ${role}`),
        prompt: [{ type: 'text', text: prompt }],
        context: 'fresh',
        provider,
        signal,
      })
      members.set(name, { role, completed: 0 })
      log(`team: 队友新建 ${name}（角色 ${role}${retires.length ? `；到预算退役 ${retires.join('/')}` : ''}）`)
      return { name, fresh: true, retired: retires.length }
    },

    /**
     * SETTLED 收割器：命中机读行且 canSettle(cardId) 判可收 → 计预算 + 出册
     * + onSettledFor(cardId)（编排层按卡给回调，语义同一次性路径）+ persist，返回卡 id；
     * 其余一律 undefined 不动手（重复/迟到消息幂等，双路去重）。
     * canSettle 由编排层注入（审查发现项②③）：开发卡 = phase=claimed 且 alive 未清
     * （alive 闸堵住「同窗口重复消息双计预算」）；合并卡 = 对应开发卡 phase=merging 且
     * mergeSettledAt 未置位——merge 卡不在编排卡账（run.cards 只录开发卡），闸必须看主卡。
     */
    harvest({ canSettle, onSettledFor, persist }) {
      if (typeof canSettle !== 'function') {
        throw new Error('jxx-driver: createTeamChannel.harvest 需要 canSettle(cardId) 谓词')
      }
      if (typeof onSettledFor !== 'function') {
        throw new Error('jxx-driver: createTeamChannel.harvest 需要 onSettledFor(cardId) 回调解析器')
      }
      return (messageText) => {
        if (typeof messageText !== 'string') return undefined
        const cardId = parseSettled(messageText)
        if (cardId === undefined) return undefined
        if (!canSettle(cardId)) return undefined
        const memberName = cardOwners.get(cardId)
        if (memberName !== undefined) recordCompletion(memberName)
        inFlight.delete(cardId) // 出册：该队友名下少一张在飞卡
        try {
          onSettledFor(cardId)(messageText, undefined)
        } catch (e) {
          log(`team: onSettled 异常：${e.message}`)
        }
        try {
          persist()
        } catch (e) {
          log(`team: persist 异常：${e.message}`)
        }
        return cardId
      }
    },

    /** 卡 → 最近派发的队友名（测试/诊断用）。 */
    nameOf(cardId) {
      return cardOwners.get(cardId)
    },

    /**
     * 换名重建（PRD 110 工单 03 构建内容 4，最后手段）：宿主探针确认旧队友 failed 后调用——
     * 从名册摘除旧名（退租，名字池永不再发它）并把其名下在飞卡出册；同通道复用
     * （dispatch 无点名时池自然给出新名 fresh 后继）。旧名不存在于名册（如首派即败，spawnTeammate
     * 失败没登记）也照常退租——名字池的 used 集合由池自己持有，重建侧只摘名册。
     * 返回通道自身（编排层直接换引用）。
     */
    rebuild({ role, oldName, reason } = {}) {
      if (typeof role !== 'string' || role === '') {
        throw new Error(`jxx-driver: rebuild 缺角色前缀，收到 ${JSON.stringify(role)}`)
      }
      if (typeof oldName !== 'string' || oldName === '') {
        throw new Error(`jxx-driver: rebuild 缺旧队友名，收到 ${JSON.stringify(oldName)}`)
      }
      const had = members.delete(oldName)
      for (const [card, owner] of [...cardOwners]) {
        if (owner === oldName) {
          cardOwners.delete(card)
          inFlight.delete(card)
        }
      }
      log(`team: 换名重建（${role}）：${oldName} 退租${had ? '' : '（名册无记录）'}${reason ? `——${reason}` : ''}`)
      return api
    },

    /** 名册视图（测试/诊断用）。 */
    list() {
      return [...members.entries()].map(([name, m]) => ({ name, ...m }))
    },

    /** 统计（测试/诊断用）。 */
    stats() {
      return { members: members.size, retiredTotal }
    },
  }
  return api
}

// ---------- 失败韧性原语（PRD 110 工单 03 / ADR-0121 D3：LLM 失败不弃会话） ----------

/**
 * 同会话退避序列：第 n 次失败（n 从 1 起）后的重发等待 = min(2^n * 5s, 60s)（工单原文，
 * n 从 0 计幂——首次失败等 5s）。曲线：5s、10s、20s、40s、60s、60s…封顶；
 * attempt 上限保护防指数溢出。
 */
export function backoffDelayMs(attempt) {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error(`jxx-driver: backoffDelayMs 需要从 1 起的失败次数，收到 ${JSON.stringify(attempt)}`)
  }
  if (attempt > 30) return 60_000
  return Math.min(2 ** (attempt - 1) * 5_000, 60_000)
}

/**
 * 失败态探针（工单 03 构建内容 4）：宿主公开面只有 `listMembers(caller)`（同步），
 * 返回 `TeamMemberView[]`（types.ts:58-67：`status: 'running' | 'inactive' | 'provisioning' | 'failed'`）。
 * 判据（鸭子类型，缺 listMembers = 无探针 → 恒 false，唤醒语义兜底）：
 *  - `memberFailed`：存在点名成员且 status === 'failed' —— 会话已死，sendMessage 不会唤醒它，
 *    只能换名重建 fresh 后继（roster.ts:296 失败已定格、无复活边）；
 *  - （R2 教训，勿再加 `memberBusy` 闸：status==='running' 口径 = 回合执行中，与「重发会双份投递」
 *    无实证因果；曾经它跳过重发且不重挂计时器，重试链静默死亡，E2E 全挂——重复投递由卡位复查
 *    与 harvest 去重兜住，见 orchestrator.scheduleTeamResend 注释。）
 */
export function createMemberProbe({ teams, agent, log } = {}) {
  if (!teams || typeof teams !== 'object') {
    throw new Error(`jxx-driver: createMemberProbe 需要已解析的 agentTeams 服务，收到 ${JSON.stringify(teams)}`)
  }
  if (!agent) throw new Error('jxx-driver: createMemberProbe 需要 Lead agent（caller 凭据）')
  if (log === undefined) log = () => {}
  const findMember = (name) => {
    if (typeof teams.listMembers !== 'function') return undefined
    try {
      return teams.listMembers(agent).find((m) => m && m.name === name)
    } catch (e) {
      log(`team: listMembers 探针异常（按未知处理）：${e.message}`)
      return undefined
    }
  }
  return {
    /** 点名队友已 failed（宿主判定会话已死）→ 换名重建。探针缺失 → 恒 false。 */
    memberFailed(name) {
      return findMember(name)?.status === 'failed'
    },
  }
}

/** 流转行识别（卡内文法 §4）：`- ` 起头 + 日期列（`2026-10-08 21:51` / 含秒 / ISO `T` 分隔）。 */
const FLOW_LINE = /^- \d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?(?:\s*(?:UTC[+-]\d|\+\d{2}:?\d{2}))?\s*\|\s*\S/

/**
 * 交接简报提取器（工单 03 构建内容 4）：从卡面「流转追加段」按行提取流转行，
 * 保留**最近的**流转记录、总字符预算 `maxChars`（默认 2000，工单上限）装不下即止。
 * 返回 { text, lines, chars, truncated, matched }：matched=false = 无卡文本或零命中
 * （text 为空串，上层拼「（交接简报缺失：卡无可读流转行）」）。
 */
export function buildHandoffFromCard(cardText, { maxChars = 2000 } = {}) {
  if (typeof cardText !== 'string' || cardText === '') {
    return { text: '', lines: 0, chars: 0, truncated: false, matched: false }
  }
  const lines = cardText.split(/\r?\n/).filter((l) => FLOW_LINE.test(l))
  if (lines.length === 0) {
    return { text: '', lines: 0, chars: 0, truncated: false, matched: false }
  }
  const kept = []
  let used = 0
  let truncated = false
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    let piece = line
    if (used + piece.length + 1 > maxChars) {
      // 剩余预算装不下整行：硬截到剩余预算（工单口径 ≤2000 是硬上限）；装不下任何内容（含换行）
      // 时直接丢弃该行——保住 join 后 text.length ≤ maxChars 的硬边界
      piece = piece.slice(0, Math.max(0, maxChars - used - 1))
      truncated = true
      if (piece.length > 0) {
        kept.push(piece)
        used += piece.length
      }
      break
    }
    kept.push(piece)
    used += piece.length + 1 // +1 = join 的换行
  }
  const text = kept.reverse().join('\n')
  return { text, lines: lines.length, chars: text.length, truncated, matched: true }
}
