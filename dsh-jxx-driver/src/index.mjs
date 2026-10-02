/**
 * dsh-jxx-driver — jxx 流程编排插件。
 * 薄驱动：control/ 卡目录 + .scratch/ 工单是唯一真相源；插件只做 watcher + 计时器 + spawn + 状态机。
 * 设计裁决见 TencentDB-Agent-Memory 仓 docs/adr/0110-jxx-driver-plugin.md。
 *
 * 四个面：
 *  - 工具 jxx_flow（模型面）：start / auto / advance / status / stop
 *  - 命令 /jxx（人面）：同一内核
 *  - systemPrompt context：每轮注入当前阶段 + 下一步
 *  - agent/disposed 监听：宿主释放时清场
 */

import { normalizeConfig } from './config.mjs'
import { Orchestrator, STAGES } from './orchestrator.mjs'
import { listPrds } from './cards.mjs'
import { randomUUID as cryptoUUID } from 'node:crypto'

export const name = 'jxx-driver'
export const inject = ['subagents', 'systemPrompt', 'agents', 'tools']

const FLOW_TOOL = 'jxx_flow'

const FLOW_DESCRIPTION = [
  'jxx 流程编排统一入口：驱动「想法 → 决策 → ADR → PRD → 工单 → 实现审查 → 运维」。一个 action=go 吃所有输入，内部按规模分流：',
  '① 小任务（单点修复/文案/小函数，一次提交能收口）→ 建一张散工单直接进看板流水线（开发→三维审查→合并 main），不产 ADR/PRD；',
  '② 中任务（跨多文件/要拆 2-5 张工单/有设计取舍但不必 ADR）→ 先 grill 决策，产出 ADR（如需要）+ PRD + 工单，再进自动编排；',
  '③ 大任务（新系统/架构级/跨会话多 PRD）→ grill + ADR 必出，PRD 拆分与里程碑规划后再编排；',
  '④ 输入指向既有 PRD（编号/标题可匹配）→ 直接对该 PRD 自动编排；',
  '⑤ 调查后仍无法定规模/方案的 → 用 ask_user_question 让用户在「自动决策（给推荐）/手动决策（逐项拍板）」间选择。',
  '另：action=status 看阶段与卡位；action=stop 停止并中止在飞子会话；action=advance 仅用于 start 走出的阶段链（go 已内含推进）。',
].join('')

export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)
  const orch = new Orchestrator(ctx, config, ctx.logger)

  // ---- 工具面 ----
  ctx.tools.register({
    name: FLOW_TOOL,
    description: FLOW_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['go', 'advance', 'status', 'stop'] },
        idea: { type: 'string', description: 'go 时的输入：想法/问题描述/PRD 编号或标题关键词，任意形态' },
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
      input: { hint: '<想法或问题描述或PRD号> | status | stop' },
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
        `[jxx-driver] 编排进行中 · 阶段 ${run.stage}/${STAGES.length}`,
        `下一步：${run.stage === 'implement' ? '编排器正在推进工单（看 /jxx status）' : '完成后调用 jxx_flow(action=advance)'}`,
        run.featureDir ? `工作目录：${run.featureDir}` : '',
      ].filter(Boolean).join('\n')
    },
  })

  // ---- 宿主释放清场 ----
  ctx.on('agent/disposed', ({ agent }) => { void orch.onAgentDisposed(agent) })

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
    case 'auto': // 旧入口别名 = go（PRD 匹配是 auto 内建路径）
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
 * 机械层只提供事实（PRD 匹配、既有候选）与三条通道（quick/standard/auto 的既有实现）。
 * 分流结果以 `route` 字段返回 + steer 一条提示，模型按 route 行动；不唯一/拿不准 → 返回
 * needsDecision，由模型用 ask_user_question 让用户在「自动决策 / 手动决策」间选。
 */
async function goDispatch(orch, args, agent) {
  const idea = String(args.idea ?? '').trim()
  const track = args.track // 模型可显式指定：auto | quick | standard | deep
  const prds = listPrdsSafe(orch, agent)

  // 1) 模型指定 auto 轨或输入长得像编号 → 走 PRD 匹配
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
    `- 中任务（跨多文件/2-5 张工单/有取舍）→ 调 jxx_flow(action="go", track="standard", idea="<想法>")——先 grill 决策再 ADR+PRD+工单+编排`,
    `- 大任务（新系统/架构级/跨会话）→ 调 jxx_flow(action="go", track="deep", idea="<想法>")——ADR 必出，PRD 拆分与里程碑规划`,
    `- 若输入其实指向某个已有 PRD（如「完成这些优化」= 某编号）→ 调 jxx_flow(action="go", track="auto", idea="<编号>")`,
    prds.length > 0 ? `既有 PRD：${prds.map((p) => `${p.num}·${p.title}`).join(' / ')}` : '（.scratch/ 下暂无 PRD）',
    '调查后仍无法定规模或方案 → ask_user_question 问用户选「自动决策（按你的推荐走）/ 手动决策（逐项拍板）」。',
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
    prds: prds.map((p) => ({ num: p.num, title: p.title, ready: p.ready, total: p.total })),
    hint: '已把分流材料 steer 给你：先调查定规模，再带 track 重调 go；拿不准用 ask_user_question 问用户（自动决策 vs 手动决策）',
  }
}

/** track=quick：散工单快车道。 */
async function runQuick(orch, agent, idea, slug) {
  const { run, ticket } = await orch.quick(agent, idea, slug)
  return {
    ok: true, route: 'quick', stage: 'implement', runId: run.id,
    featureDir: ticket.featureDir, ticketFile: ticket.ticketFile, cardId: ticket.cardId,
    hint: '散工单已建并进入看板流水线（开发→三维审查→合并 main）；无需 ADR/PRD',
  }
}

/** track=standard/deep：进入 decide 阶段链（决策→ADR→PRD→工单→编排；deep 由模型在 decide 段自行加重）。 */
function runStandard(orch, agent, idea) {
  orch.start(agent, idea)
  return {
    ok: true, route: 'standard', stage: 'decide',
    hint: '先和用户把决策聊透（grill，一次一问给推荐）；大任务 ADR 必出、多 PRD 时做里程碑规划。产出 ADR 后 jxx_flow(action="advance") 逐段推进',
  }
}

/** track=auto：PRD 匹配直进编排。 */
async function runAuto(orch, agent, idea) {
  try {
    const run = await orch.auto(agent, idea)
    return { ok: true, route: 'auto', stage: 'implement', runId: run.id, featureDir: run.featureDir, hint: '编排器已接管' }
  } catch (e) {
    if (e.code === 'CANDIDATES') {
      if (agent && typeof agent.steer === 'function') {
        agent.steer({
          id: cryptoUUID(),
          role: 'user',
          content: [{ type: 'text', text: `[jxx-driver] 「${idea}」命中多份 PRD，请选出用户意图对应的一份（必要时问用户），然后 jxx_flow(action="go", track="auto", idea="<编号>")：\n${e.message.split('：').slice(1).join('：')}` }],
          source: { kind: 'user' },
        })
      }
      return {
        ok: false, needsChoice: true, input: idea,
        prds: (e.prds || []).map((p) => ({ num: p.num, title: p.title, ready: p.ready, total: p.total })),
        message: e.message,
        hint: '从 prds 里选出用户意图对应的一份，带编号重调 go(track="auto")；拿不准就问用户',
      }
    }
    throw e
  }
}

function listPrdsSafe(orch, agent) {
  try {
    const root = agent?.session?.header?.cwd
    return root ? listPrds(root) : []
  } catch { return [] }
}

function parseCommandInput(raw) {
  const text = String(raw || '').trim()
  if (text === 'stop') return { action: 'stop', rest: '' }
  if (text === 'status' || text === '') return { action: 'status', rest: '' } // 裸 /jxx 才是查状态
  if (text.startsWith('go')) return { action: 'go', rest: text.slice(2).trim() }
  // 旧别名仍可打：/jxx auto 94 等（都汇入 go）
  if (text.startsWith('start')) return { action: 'go', rest: text.slice(5).trim(), track: 'standard' }
  if (text.startsWith('quick')) return { action: 'go', rest: text.slice(5).trim(), track: 'quick' }
  if (text.startsWith('auto')) return { action: 'go', rest: text.slice(4).trim(), track: 'auto' }
  return { action: 'go', rest: text } // 裸输入（如「解决问题」）= go（模型分流）
}

function renderFlowValue(value) {
  if (value == null) return '(无返回)'
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}
