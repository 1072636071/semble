/**
 * dsh-jxx-driver — jxx 流程编排插件。
 * 薄驱动：control/ 卡目录 + .scratch/ 工单是唯一真相源；插件只做 watcher + 计时器 + spawn + 状态机。
 * 设计裁决见 TencentDB-Agent-Memory 仓 docs/adr/0110-jxx-driver-plugin.md。
 *
 * 四个面：
 *  - 工具 jxx_flow（模型面）：go / advance / status / stop
 *  - 命令 /jxx（人面）：同一内核
 *  - systemPrompt context：每轮注入当前阶段 + 下一步
 *  - agent/disposed 监听：宿主释放时清场
 */

import { normalizeConfig } from './config.mjs'
import { Orchestrator, STAGES, SESSION_ROLE } from './orchestrator.mjs'
import { randomUUID as cryptoUUID } from 'node:crypto'

export const name = 'jxx-driver'
export const inject = ['subagents', 'systemPrompt', 'agents', 'tools']

const FLOW_TOOL = 'jxx_flow'

/** 免确认口径（ADR-0113，经 ADR-0115 收窄）：只豁免 PRD seam 与工单粒度；决策定稿必须经用户确认。 */
const AUTO_CONFIRM_NOTE = '本编排队列**部分免确认**（ADR-0113，ADR-0115 收窄）：PRD seam、工单粒度由你按推荐拍板并直接落盘（理由写 PRD 对应小节 / map.md），这两处不要 ask_user_question、不要停下等确认；**决策定稿除外**——decide 段必须把需求与用户聊透并获确认后再落 ADR。'

/** autoConfirm=false 时的对照口径：恢复人工闸门——该问就问，别替用户拍板。 */
const MANUAL_CONFIRM_NOTE = '本编排队列**保留人工闸门**（config.autoConfirm=false）：决策取舍、PRD seam、工单粒度都先与用户确认再落盘，不要替用户拍板。'

/** @param {boolean} autoConfirm 决定⑤项与尾注的措辞（config 可关，措辞必须跟着走）。 */
function flowDescription(autoConfirm) {
  return [
    SESSION_ROLE,
    '',
    'jxx 流程编排统一入口：驱动「想法 → 决策 → ADR → PRD → 工单 → 实现审查 → 运维」。一个 action=go 吃所有输入，内部按规模分流：',
    '① 小任务（单点修复/文案/小函数，一次提交能收口）→ 建一张散工单直接进看板流水线（开发→三维审查→合并 main），不产 ADR/PRD；',
    '② 中任务（跨多文件/要拆 2-5 张工单/有设计取舍但不必 ADR）→ 先定决策，产出 ADR（如需要）+ PRD + 工单，再进自动编排；',
    '③ 大任务（新系统/架构级/跨会话多 PRD）→ 决策 + ADR 必出，PRD 拆分与里程碑规划后再编排；',
    '④ 要编排某份**已知编号**的既有 PRD → 调 jxx_flow(action="go", track="auto", idea="<PRD 编号或功能目录名>")——编号由你/用户给出，插件不扫目录、不猜、不列候选；',
    autoConfirm
      ? '⑤ 拿不准规模/方案时**自己按推荐拍板**继续（免确认）；只有当输入意图本身有歧义、拍错轨道会白干时才用 ask_user_question 澄清（例如用户只说「把那块优化一下」却没说清是哪块——问清要做什么，而不是问怎么拆）。'
      : '⑤ 调查后仍无法定规模/方案的 → 用 ask_user_question 让用户在「自动决策（给推荐）/手动决策（逐项拍板）」间选择。',
    '另：action=status 看阶段与卡位；action=stop 停止并中止在飞子会话；action=advance 仅用于 start 走出的阶段链（go 已内含推进）。',
    autoConfirm ? AUTO_CONFIRM_NOTE : MANUAL_CONFIRM_NOTE,
  ].join('')
}

export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)
  const orch = new Orchestrator(ctx, config, ctx.logger)

  // ---- 工具面 ----
  ctx.tools.register({
    name: FLOW_TOOL,
    description: flowDescription(config.autoConfirm),
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['go', 'advance', 'status', 'stop'] },
        idea: { type: 'string', description: 'go 时的输入：想法/问题描述，或 track="auto" 时的 PRD 编号/功能目录名' },
        track: { type: 'string', enum: ['auto', 'quick', 'standard', 'deep'], description: 'go 可选：强制指定轨道（quick=散工单快车道 / standard=决策+PRD+编排 / deep=大任务 ADR+里程碑；缺省由你按描述语义判定）' },
        slug: { type: 'string', description: 'quick 轨道可选：工单 slug（kebab-case）；缺省从 idea 推导' },
      },
      required: ['action'],
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: renderFlowValue(value) }],
    },
    async execute(args, exec) {
      const agent = exec.agent
      if (!agent) throw new Error('jxx_flow 需要一个调用方会话')
      return dispatch(orch, args, agent)
    },
  })

  // ---- 命令面（可选服务；缺 commands 时只走工具面）----
  const commands = typeof ctx.get === 'function' ? ctx.get('commands') : undefined
  if (commands && typeof commands.register === 'function') {
    commands.register({
      name: 'jxx',
      description: 'jxx 流程编排统一入口（/jxx <想法|问题|PRD号>——自动分流；/jxx status · /jxx stop）',
      input: { hint: '<想法或问题描述，或已知 PRD 编号> | status | stop' },
      handler: async ({ agent, rawInput }) => {
        const { action, rest, track } = parseCommandInput(rawInput)
        try {
          const value = await dispatch(orch, { action, idea: rest, prd: rest, track, slug: undefined }, agent)
          return { kind: 'success', text: renderFlowValue(value) }
        } catch (e) {
          return { kind: 'error', text: e.message }
        }
      },
    })
  }

  // ---- 上下文注入（每轮当前阶段 + 下一步；无 run 时返回空串不占历史）----
  ctx.systemPrompt.context({
    name: 'jxx-driver:stage',
    order: 125,
    text: ({ agent }) => {
      if (!agent) return ''
      const run = orch.runs.get(agent.session?.id ?? agent.id)
      if (!run || run.stopped) return ''
      return [
        `[jxx-driver] 编排进行中 · 阶段 ${run.stage}/${STAGES.length} · 接待台角色：不做任务、只监控与沟通（ADR-0115）`,
        `下一步：${run.stage === 'implement' ? '编排器正在推进工单（看 /jxx status）' : '完成后调用 jxx_flow(action=advance)'}`,
        run.featureDir ? `工作目录：${run.featureDir}` : '',
      ].filter(Boolean).join('\n')
    },
  })

  // ---- 宿主释放清场 ----
  ctx.on('agent/disposed', ({ agent }) => { void orch.onAgentDisposed(agent) })

  // ---- 团队消息收割（PRD 110 工单 02 / ADR-0121）：Lead 收到队友完工回调 ----
  // 投递到 Lead 的 team-message user 消息（宿主 mailbox 经 session/append 落账）：
  // 文本末行 `SETTLED: <卡id>` → 编排器按消息路收口；卡位扫描兜底不动，双路去重。
  ctx.on('session/event', (session, event) => {
    try {
      if (!event || event.type !== 'user/message') return
      if (event.data?.source?.kind !== 'team-message') return
      const blocks = Array.isArray(event.data.content) ? event.data.content : []
      const text = blocks.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n')
      if (text !== '') orch.onTeamMessage(session?.id !== undefined ? { session } : undefined, text)
    } catch (e) {
      ctx.logger.warn(`[jxx-driver] 团队消息收割失败：${e.message}`)
    }
  })

  ctx.effect(() => () => { void orch.dispose() }, 'jxx-driver dispose')

  ctx.logger.info(`[jxx-driver] 已装载（board=${config.boardScript}，parallel=${config.parallel}，autoMerge=${config.autoMerge}）`)
}

// ---------- 内部 ----------

async function dispatch(orch, args, agent) {
  switch (args.action) {
    case 'go':
      return goDispatch(orch, args, agent)
    case 'start': // 旧入口别名 = standard 轨道
      return goDispatch(orch, { ...args, action: 'go', track: args.track ?? 'standard' }, agent)
    case 'quick': // 旧入口别名 = quick 轨道
      return goDispatch(orch, { ...args, action: 'go', track: args.track ?? 'quick' }, agent)
    case 'auto': // 旧入口别名 = go（显式 PRD 编号编排是 auto 内建路径）
      return goDispatch(orch, { ...args, action: 'go', idea: args.idea ?? args.prd, track: args.track ?? 'auto' }, agent)
    case 'advance':
      return orch.advance(agent)
    case 'status':
      return orch.status(agent)
    case 'stop':
      return orch.stop(agent)
    default:
      throw new Error(`未知 action：${args.action}（合法：go/advance/status/stop；start/quick/auto 仍作为别名可用）`)
  }
}

/**
 * 统一入口 go：一个 action 吃所有输入，分流判断归会话模型（ADR-0110 D3——语义归 LLM）。
 * 机械层只提供三条通道（quick/standard/auto 的既有实现），**不扫目录、不猜意图、不列候选**
 * （ADR-0118：既有 PRD 推荐已撤除，要编排哪份由用户/模型给出编号）。
 * 分流结果以 `route` 字段返回 + steer 一条提示，模型按 route 行动。
 */
async function goDispatch(orch, args, agent) {
  const idea = String(args.idea ?? '').trim()
  const track = args.track // 模型可显式指定：auto | quick | standard | deep

  // 1) 模型指定 auto 轨或输入长得像编号 → 走显式 PRD 编排（编号必须给准，不做模糊推荐）
  if (track === 'auto' || /^\d{1,4}$/.test(idea)) {
    return runAuto(orch, agent, idea)
  }

  // 2) 模型显式选了轨道 → 直达
  if (track === 'quick') {
    if (!idea) throw new Error('go(track="quick") 需要 idea（问题描述）')
    return runQuick(orch, agent, idea, args.slug)
  }
  if (track === 'standard' || track === 'deep') {
    if (!idea) throw new Error(`go(track="${track}") 需要 idea（想法陈述）`)
    return runStandard(orch, agent, idea)
  }

  // 3) 其余输入：机械层不做语义判断，返回分流材料，由模型裁决轨道
  //    （规模判断需要读代码/看上下文——这正是 LLM 的活）
  const steerMsg = [
    `[jxx-driver] go 收到输入：「${idea}」。请先做规模分流（读代码/查上下文后再定）：`,
    `- 小任务（单点修复/文案/小函数，一次提交收口）→ 调 jxx_flow(action="go", track="quick", idea="<问题描述>")`,
    `- 中任务（跨多文件/2-5 张工单/有取舍）→ 调 jxx_flow(action="go", track="standard", idea="<想法>")——先定决策再 ADR+PRD+工单+编排`,
    `- 大任务（新系统/架构级/跨会话）→ 调 jxx_flow(action="go", track="deep", idea="<想法>")——ADR 必出，PRD 拆分与里程碑规划`,
    `- 若用户明确指向某份已知编号的既有 PRD → 调 jxx_flow(action="go", track="auto", idea="<编号或功能目录名>")（插件不扫目录、不猜意图、不列候选——编号得给准）`,
    orch.config.autoConfirm
      ? '轨迹定了就直接走，不要就规模/方案回头问用户（本编排免确认，见下）。'
      : '调查后仍无法定规模或方案 → ask_user_question 问用户选「自动决策（按你的推荐走）/ 手动决策（逐项拍板）」。',
    orch.config.autoConfirm ? AUTO_CONFIRM_NOTE : MANUAL_CONFIRM_NOTE,
    '',
    SESSION_ROLE,
  ].join('\n')
  if (agent && typeof agent.steer === 'function') {
    agent.steer({
      id: cryptoUUID(),
      role: 'user',
      content: [{ type: 'text', text: steerMsg }],
      source: { kind: 'user' },
    })
  }
  return {
    ok: true, routed: 'pending-model-triage', input: idea,
    hint: orch.config.autoConfirm
      ? '已把分流材料 steer 给你：先调查定规模，再带 track 重调 go；免确认——自己按推荐拍板，别就规模/方案回头问用户'
      : '已把分流材料 steer 给你：先调查定规模，再带 track 重调 go；拿不准用 ask_user_question 问用户（自动决策 vs 手动决策）',
  }
}

/** track=quick：散工单快车道。 */
async function runQuick(orch, agent, idea, slug) {
  const { run, ticket } = await orch.quick(agent, idea, slug)
  return {
    ok: true, route: 'quick', stage: 'implement', runId: run.id,
    featureDir: ticket.featureDir, ticketFile: ticket.ticketFile, cardId: ticket.cardId,
    hint: '散工单已建并进入看板流水线（开发→三维审查→合并 main）；无需 ADR/PRD。你只监控与上报，不自己动手改代码（ADR-0115 接待台角色）',
  }
}

/** track=standard/deep：进入 decide 阶段链（决策→ADR→PRD→工单→编排；deep 由模型在 decide 段自行加重）。 */
function runStandard(orch, agent, idea) {
  orch.start(agent, idea)
  return {
    ok: true, route: 'standard', stage: 'decide',
    hint: orch.config.autoConfirm
      ? '先把需求与用户聊透、经用户确认后定稿 ADR（ADR-0115：决策不自动拍板）；之后 PRD seam 与工单粒度免确认，大任务 ADR 必出、多 PRD 时做里程碑规划；产出后 jxx_flow(action="advance") 逐段推进'
      : '先和用户把决策聊透（grill，一次一问给推荐）；大任务 ADR 必出、多 PRD 时做里程碑规划。产出 ADR 后 jxx_flow(action="advance") 逐段推进',
  }
}

/**
 * track=auto：对**显式给出**的既有 PRD 直接进编排（ADR-0118）。
 * 匹配不上就响亮报错——不列候选、不猜意图（要编排哪份由用户/模型给编号）。
 */
async function runAuto(orch, agent, idea) {
  const run = await orch.auto(agent, idea)
  return { ok: true, route: 'auto', stage: 'implement', runId: run.id, featureDir: run.featureDir, hint: '编排器已接管。你只监控与上报，不自己动手（ADR-0115 接待台角色）' }
}

function parseCommandInput(raw) {
  const text = String(raw || '').trim()
  if (text === 'stop') return { action: 'stop', rest: '' }
  if (text === 'status' || text === '') return { action: 'status', rest: '' } // 裸 /jxx 才是查状态
  if (text.startsWith('go')) return { action: 'go', rest: text.slice(2).trim() }
  // 旧别名仍可打：/jxx auto 94 等（都汇入 go）
  if (text.startsWith('start')) return { action: 'go', rest: text.slice(5).trim(), track: 'standard' }
  if (text.startsWith('quick')) return { action: 'go', rest: text.slice(5).trim(), track: 'quick' }
  if (text.startsWith('auto')) return { action: 'go', rest: text.slice(4).trim(), track: 'auto' } // /jxx auto <PRD编号>
  return { action: 'go', rest: text } // 裸输入（如「解决问题」）= go（模型分流）
}

function renderFlowValue(value) {
  if (value == null) return '(无返回)'
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}
