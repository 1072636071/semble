/**
 * 子会话提示词两级供给（ADR-0115 D3·默认提示词固化）：
 *  1) control/starter/<role>.md —— board init 的渲染产物、项目真源（可能被项目定制），存在即优先用；
 *  2) src/default-starters/<role>.md —— 插件内置固化副本（技能 starter 模板逐字节快照，
 *     与 base/skills/engineering/jxx-ticket-board/assets/ 的一致性由 test/default-starters.test.mjs 锁死）。
 * 两级共用同一套占位符替换（与 board.mjs init 的 render() 对齐）。
 * 旧版「3 行最小兜底」已退役——那等于让子 agent 裸奔（没有角色纪律、没有卡内文法、没有交付口径）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_STARTER_DIR = join(dirname(fileURLToPath(import.meta.url)), 'default-starters')

/** 与 board.mjs init 的 render() 同一套占位符（starter 三模板实际只用 {{ROOT}}；REPO_* 属 PROTOCOL，防御性一并处理）。 */
function renderPlaceholders(text, root) {
  return text
    .replaceAll('{{ROOT}}', root)
    .replaceAll('{{REPO_PATH}}', root)
    .replaceAll('{{REPO_URL}}', '')
    .replaceAll('{{BASE_BRANCH}}', 'origin/main')
}

function starter(root, role, { member } = {}) {
  const file = join(root, 'control', 'starter', `${role}.md`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const builtin = join(DEFAULT_STARTER_DIR, `${role}.md`)
  if (!existsSync(builtin)) {
    throw new Error(`jxx-driver: 内置默认提示词缺失（default-starters/${role}.md）——插件安装不完整，请重装`)
  }
  // member 模式（团队/可续接路径）剔除模板首行的「拉起新会话」残留：这些 starter 是
  // 「人手拉起新会话时整段粘贴」的历史产物；编排 spawn 的持久队友/可续接子代理不是新会话，
  // 由本插件经 send_message 续接（subagentId/memberName 在编排账上，粘给谁由编排器管）。
  const raw = readFileSync(builtin, 'utf8')
  return renderPlaceholders(
    member ? raw.replace(/^# .*\n/, '') : raw,
    root,
  )
}

/**
 * 「先落盘再回报」通用纪律（PRD 108 retro P1-3）：子会话可能随宿主 turn 边界死亡——
 * 回报发了但交付物只在会话内存里 = 交付物丢失。所有角色的提示词尾注统一追加：
 * 交付物（报告/簿记/patch 文本）**完成即落盘**，回报只引用路径与机读行。
 * 单源常量：worker/审查者/合并专员三处尾注共用，防措辞漂移。
 */
const DISK_FIRST_NOTE = '\n\n---\n落盘与回报纪律：每个交付物（报告、簿记、patch 文本）**完成一份就落盘一份**（写入文件），回报只引用已落盘的路径——会话可能被随时中断，先落盘的东西才保得住。完工（或受阻停手）经 send_message 向 lead 回报；lead 的续接指令也会经 send_message 发给你——你是可续接的后台会话，收到新指令接着干，不需要也不应该新建会话。\n'

/** 团队路径 worker 尾注（PRD 110 工单 02）：完工回报末行机读行，供编排器收割 settle；一次性路径不追加（现行为逐字节不变）。 */
const SETTLED_WORKER_NOTE = (cardId) => `\n\n---\n机读要求（团队模式）：完工（或受阻停手）后用 send_message 向 lead 回报一句话进展，回报文本的最后一行必须单独一行写 \`SETTLED: ${cardId}\`（卡 id 原样，不带其他字符）。`

export function workerPrompt(root, cardId, { member } = {}) {
  return starter(root, 'dev')
    + DISK_FIRST_NOTE
    + `\n\n---\n本次指定：优先领取卡片 \`${cardId}\`（你由 jxx-driver 编排器拉起；只领这一张，领不到就停下来回报，不要发明新活）。\n`
    + (member ? SETTLED_WORKER_NOTE(cardId) : '')
}

const VERDICT_DIRECTIVE = '\n\n---\n机读要求：回复正文的最后一行必须单独一行写 `VERDICT: PASS` 或 `VERDICT: FAIL`（全大写，不带其他字符）。审查报告正文照常写回卡内「流转追加段」。\n'

export function reviewerPrompt(root, cardId, dimension) {
  const base = starter(root, 'reviewer')
    .replaceAll('{{REVIEW_DIMENSION}}', dimension)
    .replaceAll('{{CARD_ID}}', cardId)
    .replaceAll('{{BASE_BRANCH}}', 'origin/main')
  return base + DISK_FIRST_NOTE + VERDICT_DIRECTIVE
}

/** 团队路径合并专员首条指令尾注：消息式指令需点名任务与回传行（一次性路径不追加）。 */
const MERGER_ASSIGN = (mergeId, cardId) => `\n\n---\n本次指定：合并卡 \`${mergeId}\`（对应开发卡 \`${cardId}\`）。\n`
const MERGER_MEMBER_NOTE = (mergeId, cardId) => MERGER_ASSIGN(mergeId, cardId)
  + `机读要求（团队模式）：本轮收口（或受阻停手）后用 send_message 向 lead 回报一句话结果，回报文本的最后一行必须单独一行写 \`SETTLED: ${mergeId}\`（卡 id 原样，不带其他字符）。`

export function mergerPrompt(root, mergeId, cardId, { member } = {}) {
  return starter(root, 'merger', { member }) + DISK_FIRST_NOTE + (member ? MERGER_MEMBER_NOTE(mergeId, cardId) : MERGER_ASSIGN(mergeId, cardId))
}

/**
 * 团队模式下发给**已有队友**的复用指令（PRD 110 工单 02）：持久队友已带着角色提示词上下文，
 * 消息只点任务与回报要求。首条指令已含 `SETTLED: <卡id>` 机读行要求，复用指令继续点名同一行，
 * 保证每轮回报末行都有机读行（编排器按行收割，行缺失 = 不收口）。
 */
export function memberDirective(cardId, note = '') {
  return [
    `[jxx-driver] 领卡施工：\`${cardId}\`。你是持久队友/可续接子代理：lead 经 send_message 给你续接指令——按最新一条指令干活即可，不要新建会话或重复领卡。`,
    note ? note.trim() : '',
    `本轮完工（或受阻停手）后用 send_message 向 lead 回报一句话进展，回报文本的最后一行必须单独一行写 \`SETTLED: ${cardId}\`（卡 id 原样，不带其他字符）。`,
  ].filter(Boolean).join('\n') + '\n'
}

const DIMS = ['std', 'spec', 'rule']
export function reviewerDims() {
  return DIMS
}

/** 从 reviewer 输出提取机读结论；缺失 = FAIL（fail-closed，见 ADR-0110 D3）。 */
export function parseVerdict(text) {
  const m = String(text || '').match(/^VERDICT:\s*(PASS|FAIL)\s*$/m)
  return m ? m[1] : 'FAIL'
}
