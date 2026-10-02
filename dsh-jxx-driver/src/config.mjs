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

export function normalizeConfig(raw) {
  if (raw === undefined || raw === null) raw = {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`jxx-driver: config 必须是对象，收到 ${JSON.stringify(raw)}`)
  }
  const boardScript = raw.boardScript !== undefined
    ? raw.boardScript
    : join(homedir(), '.agents', 'skills', 'jxx-ticket-board', 'scripts', 'board.mjs')
  if (typeof boardScript !== 'string' || boardScript.trim() === '') {
    throw new Error('jxx-driver: config.boardScript 必须是非空字符串')
  }
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
    /** 卡位轮询间隔毫秒。 */
    pollIntervalMs: intField(raw, 'pollIntervalMs', 5000, { min: 50 }),
    /** 打点日志。 */
    verbose: boolField(raw, 'verbose', false),
  }
}
