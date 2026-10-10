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
    /** 重试预算上限（单源语义定义，各消费面同口径引用——PRD 111-01 rule 审查发现项）：
     * ① worker 路（onWorkerSettled 失败分支）：retries > maxRetries → blocked；maxRetries=1 时
     *    worker 共 2 次机会（首派 + 1 重试）；
     * ② 合并卡路：影子账（merge- 键）retries 有 **3 个写点**、各承载一次独立的「本轮失败」事实
     *    （onMergerSettled 失败路 / 段 6 僵死面 / 段 4 未收口超时面，明细见 orchestrator 对应注释），
     *    前沿重派面只读不写（防同一次失败被记两次）。注意段 6 与失败路会看到**同一次**失败，
     *    故二者之间有 mergeFailedAt 互斥（R2 rule 审查发现项：无此闸则一次失败扣两次预算、
     *    maxRetries=1 下白丢那次重派）。同式 `retries > maxRetries` 判超限，maxRetries=1 时
     *    合并卡失败 1 次后重派 1 次、再失败即 blocked（比 worker 路少 1 次机会——合并卡失败
     *    成本低、重派风险高，收紧）；
     * ③ 僵死路（worker/合并卡同构）：同 worker 口径，且合并卡僵死面自带超限转人工出口。
     * 三处消费面改语义前先读本注释对齐，防分裂漂移。 */
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
    /** 团队路径失败韧性（PRD 110 工单 03 / ADR-0121 D3）：同会话退避重发的连续失败上限，
     * 超限 → notify 等用户切模型（等待恢复不弃会话）；0 = 关闭退避重发（失败立即转人工）。 */
    teamBackoff: intField(raw, 'teamBackoff', 3, { min: 0 }),
    /** 团队路径的 spawn provider（与一次性路径默认 provider 同名，不引入第二套）。 */
    teamProvider: nonEmptyStringField(raw, 'teamProvider', 'spawn'),
    /** 打点日志。 */
    verbose: boolField(raw, 'verbose', false),
  }
}
