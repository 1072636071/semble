/** 配置校验：非法值响亮报错（插件装载即失败），不静默吞掉。 */
import { homedir } from 'node:os'
import { join } from 'node:path'

function intField(c, key, def, { min = 1 } = {}) {
  const v = c[key]
  if (v === undefined) return def
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min) {
    throw new Error(`jxx-driver: config.${key} 必须是 ≥${min} 的整数，收到 ${JSON.stringify(v)}`)
  }
  return v
}

function boolField(c, key, def) {
  const v = c[key]
  if (v === undefined) return def
  if (typeof v !== 'boolean') {
    throw new Error(`jxx-driver: config.${key} 必须是布尔值，收到 ${JSON.stringify(v)}`)
  }
  return v
}

const TEAM_MODES = ['auto', 'off']

function teamModeField(c, key, def) {
  const v = c[key]
  if (v === undefined) return def
  if (typeof v !== 'string' || !TEAM_MODES.includes(v)) {
    throw new Error(`jxx-driver: config.${key} 必须是 ${TEAM_MODES.map((m) => `'${m}'`).join(' | ')} 之一，收到 ${JSON.stringify(v)}`)
  }
  return v
}

function nonEmptyStringField(c, key, def) {
  const v = c[key]
  if (v === undefined) return def
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`jxx-driver: config.${key} 必须是非空字符串，收到 ${JSON.stringify(v)}`)
  }
  return v
}

export function normalizeConfig(raw) {
  if (raw === undefined || raw === null) raw = {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`jxx-driver: config 必须是对象，收到 ${JSON.stringify(raw)}`)
  }
  // boardScript 校验句式统一走 nonEmptyStringField（PRD 110 工单 01 三维审查顺延项，
  // T89 v6 留痕「由工单 02 接线时落实」——此前为与助手同语义的内联校验，报错形态不变）
  const boardScript = nonEmptyStringField(
    raw,
    'boardScript',
    join(homedir(), '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs'),
  )
  return {
    /** board.mjs 脚本绝对路径（jxx-ticket-board 已装副本）。 */
    boardScript,
    /** 并行 worker 上限。 */
    parallel: intField(raw, 'parallel', 3),
    /** claimed 卡无存活 worker 且 mtime 超过该分钟数 → 判僵死重 spawn。 */
    staleMinutes: intField(raw, 'staleMinutes', 30),
    /** worker 失败重试次数（超过 → blocked 转人工）。 */
    maxRetries: intField(raw, 'maxRetries', 1, { min: 0 }),
    /** 三维审查全过后是否自动 spawn 合并专员（ADR-011 默认回合 main）。 */
    autoMerge: boolField(raw, 'autoMerge', true),
    /** 免确认：插件驱动的编排队列不向用户追问（决策定稿 / PRD seam / 工单粒度），
     * 技能正文里的人工闸门保持不变——那是给人手跑会话的（ADR-0113）。 */
    autoConfirm: boolField(raw, 'autoConfirm', true),
    /** 卡位轮询间隔毫秒。 */
    pollIntervalMs: intField(raw, 'pollIntervalMs', 5000, { min: 50 }),
    /** 团队模式开关（PRD 110 / ADR-0121）：auto = 宿主有 agentTeams 时 worker/合并专员走持久队友；off = 全走既有一次性路径。 */
    teamMode: teamModeField(raw, 'teamMode', 'auto'),
    /** 队友复用预算：完成任务数超过该值判 retire，供上层换名重建 fresh 后继。 */
    reuseLimit: intField(raw, 'reuseLimit', 8, { min: 1 }),
    /** 团队路径的 spawn provider（与一次性路径默认 provider 同名，不引入第二套）。 */
    teamProvider: nonEmptyStringField(raw, 'teamProvider', 'spawn'),
    /** 打点日志。 */
    verbose: boolField(raw, 'verbose', false),
  }
}
