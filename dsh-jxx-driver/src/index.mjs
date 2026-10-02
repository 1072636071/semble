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

export const name = 'jxx-driver'
export const inject = ['subagents', 'systemPrompt', 'agents', 'tools']

const FLOW_TOOL = 'jxx_flow'

const FLOW_DESCRIPTION = [
  'jxx 流程编排：驱动「想法 → 决策 → ADR → PRD → 工单 → 实现审查 → 运维」的自动推进。',
  'action=start <idea>：从想法开始（先决策后产出）；',
  'action=auto <prdPrefix>：对既有 PRD 直进编排（投卡→开发→三维审查→合并）；',
  'action=advance：当前阶段产物已落盘后推进到下一阶段（gate 不过会告诉你缺什么）；',
  'action=status：查看当前阶段 / 卡位 / 受阻项；',
  'action=stop：停止编排并中止在飞子会话。',
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
        action: { type: 'string', enum: ['start', 'auto', 'advance', 'status', 'stop'] },
        idea: { type: 'string', description: 'start 时的想法陈述' },
        prd: { type: 'string', description: 'auto 时的 PRD 编号前缀（如 94）' },
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
      description: 'jxx 流程编排（/jxx start <想法> · /jxx auto <PRD号> · /jxx status · /jxx stop）',
      input: { hint: 'start <想法> | auto <PRD号> | status | stop' },
      handler: async ({ agent, rawInput }) => {
        const { action, rest } = parseCommandInput(rawInput)
        try {
          const value = await dispatch(orch, { action, idea: rest, prd: rest }, agent)
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
    case 'start': {
      if (!args.idea || !args.idea.trim()) throw new Error('start 需要 idea（想法陈述）')
      orch.start(agent, args.idea.trim())
      return { ok: true, stage: 'decide', hint: '先和用户把决策聊透；产出 ADR 后调用 jxx_flow(action=advance)' }
    }
    case 'auto': {
      if (!args.prd || !args.prd.trim()) throw new Error('auto 需要 prd（PRD 编号前缀，如 94）')
      const run = await orch.auto(agent, args.prd.trim())
      return { ok: true, stage: 'implement', runId: run.id, hint: '编排器已接管' }
    }
    case 'advance':
      return orch.advance(agent)
    case 'status':
      return orch.status(agent)
    case 'stop':
      return orch.stop(agent)
    default:
      throw new Error(`未知 action：${args.action}（合法：start/auto/advance/status/stop）`)
  }
}

function parseCommandInput(raw) {
  const text = String(raw || '').trim()
  if (!text || text === 'status') return { action: 'status', rest: '' }
  if (text === 'stop') return { action: 'stop', rest: '' }
  if (text.startsWith('start')) return { action: 'start', rest: text.slice(5).trim() }
  if (text.startsWith('auto')) return { action: 'auto', rest: text.slice(4).trim() }
  return { action: 'status', rest: '' }
}

function renderFlowValue(value) {
  if (value == null) return '(无返回)'
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}
