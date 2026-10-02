/** 子会话提示词：直接读 control/starter/*.md 现成渲染产物，插件不另写协议。 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function starter(root, role) {
  const file = join(root, 'control', 'starter', `${role}.md`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  // 兜底：starter 缺失（未经 board init 渲染）时给最小入职指令，不编造协议
  return [
    `你是工单公告板的${role}成员。`,
    `第一步，完整阅读协议真源：Read ${join(root, 'control', 'PROTOCOL.md')}`,
    '你的全部工作规则以该文件为准。',
  ].join('\n')
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
