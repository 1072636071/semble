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

function starter(root, role) {
  const file = join(root, 'control', 'starter', `${role}.md`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  const builtin = join(DEFAULT_STARTER_DIR, `${role}.md`)
  if (!existsSync(builtin)) {
    throw new Error(`jxx-driver: 内置默认提示词缺失（default-starters/${role}.md）——插件安装不完整，请重装`)
  }
  return renderPlaceholders(readFileSync(builtin, 'utf8'), root)
}

export function workerPrompt(root, cardId) {
  return starter(root, 'dev')
    + `\n\n---\n本次指定：优先领取卡片 \`${cardId}\`（你由 jxx-driver 编排器拉起；只领这一张，领不到就停下来回报，不要发明新活）。\n`
}

const VERDICT_DIRECTIVE = '\n\n---\n机读要求：回复正文的最后一行必须单独一行写 `VERDICT: PASS` 或 `VERDICT: FAIL`（全大写，不带其他字符）。审查报告正文照常写回卡内「流转追加段」。\n'

export function reviewerPrompt(root, cardId, dimension) {
  const base = starter(root, 'reviewer')
    .replaceAll('{{REVIEW_DIMENSION}}', dimension)
    .replaceAll('{{CARD_ID}}', cardId)
    .replaceAll('{{BASE_BRANCH}}', 'origin/main')
  return base + VERDICT_DIRECTIVE
}

export function mergerPrompt(root, mergeId, cardId) {
  return starter(root, 'merger')
    + `\n\n---\n本次指定：合并卡 \`${mergeId}\`（对应开发卡 \`${cardId}\`）。\n`
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
