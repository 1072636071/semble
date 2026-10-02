/** quick 快车道：会话内临时问题 → 散工单（跳过 ADR/PRD），直接进看板流水线。 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** .scratch/ 下下一个全局 topic 编号（目录与散文件都算，与 issue-flow next-topic 同口径）。 */
export function nextTopicNum(root) {
  const scratch = join(root, '.scratch')
  let max = 0
  if (existsSync(scratch)) {
    for (const name of readdirSync(scratch)) {
      const m = name.match(/^(\d+)[-.]/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
  }
  return max + 1
}

/** slug 推导：ASCII 词 → kebab（最多 6 段 60 字符）；中文/过短 → 'quick' 回落。 */
export function slugify(idea) {
  const ascii = String(idea).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (ascii.length >= 3) {
    return ascii.split('-').filter(Boolean).slice(0, 6).join('-').slice(0, 60).replace(/-+$/, '') || 'quick'
  }
  return 'quick'
}

/**
 * 建散工单：.scratch/<NN>-<slug>/issues/01-<slug>.md（doc-structure 工单契约形态，无 PRD.md）。
 * @returns {{ featureDir, ticketFile, ticketBase, cardId }}
 */
export function createQuickTicket(root, idea, slug) {
  const text = String(idea || '').trim()
  if (!text) throw new Error('quick 需要 idea（问题描述）')
  const s = (typeof slug === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(slug)) ? slug : slugify(text)
  const num = nextTopicNum(root)
  const padded = String(num).padStart(2, '0')
  const featureDir = join(root, '.scratch', `${padded}-${s}`)
  const issuesDir = join(featureDir, 'issues')
  mkdirSync(issuesDir, { recursive: true })
  const ticketBase = `01-${s}`
  const ticketFile = join(issuesDir, `${ticketBase}.md`)
  if (existsSync(ticketFile)) throw new Error(`quick: 工单文件已存在（不应发生，编号自增保证唯一）：${ticketFile}`)
  const title = text.length > 60 ? text.slice(0, 60) + '…' : text
  const today = new Date().toISOString().slice(0, 10)
  const body = [
    `# ${title}`,
    '',
    '**Status:** ready-for-agent',
    '',
    '**Blocked by:** 无——可立即开始',
    '',
    `**构建内容：** ${text}`,
    '',
    '**验收标准：**',
    '',
    '- [ ] 描述的问题不再复现（或行为与描述一致），修复点在评论留痕',
    '',
    '## 评论',
    '',
    `- ${today} · jxx-driver quick 快车道创建：来源 = 会话内问题描述，跳过 ADR/PRD 直接进看板流水线（散工单，合并目标 main）。`,
    '',
  ].join('\n') + '\n'
  writeFileSync(ticketFile, body, 'utf8')
  // cardId 与 enterImplement 的 ticketCardId 同构：补零目录号 + 工单基名
  return { featureDir, ticketFile, ticketBase, cardId: `${padded}-${ticketBase}` }
}
