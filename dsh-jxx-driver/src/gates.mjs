/** 阶段闸门：全部是对文件系统的只读判定，gate 不过 = 报告缺什么，不猜。 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { listTickets } from './cards.mjs'

const ADR_REQUIRED_SECTIONS = ['## 背景', '## 决策']
const PRD_REQUIRED_SECTIONS = ['## 问题陈述', '## 用户故事', '## 解决方案', '## 实现决策', '## 测试决策']

function newestMd(dir, sinceMs, filter) {
  if (!existsSync(dir)) return undefined
  const hits = readdirSync(dir)
    .filter((n) => n.endsWith('.md') && (!filter || filter(n)))
    .map((n) => join(dir, n))
    .filter((p) => statSync(p).mtimeMs >= sinceMs)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  return hits[0]
}

/** decide → prd：流程开始后须有结构合规的新 ADR。 */
export function adrGate(root, sinceMs) {
  const file = newestMd(join(root, 'docs', 'adr'), sinceMs, (n) => /^\d{4}-/.test(n))
  if (!file) return { ok: false, missing: ['docs/adr/ 下没有本次流程开始后新建的 ADR（NNNN-<slug>.md）'] }
  const content = readFileSync(file, 'utf8')
  const missing = []
  if (!/^#\s+ADR-\d{4}\s*·/m.test(content)) missing.push('H1 须为 `# ADR-<NNNN> · <标题>`')
  for (const s of ADR_REQUIRED_SECTIONS) if (!content.includes(s)) missing.push(`缺小节 ${s}`)
  return missing.length ? { ok: false, file, missing } : { ok: true, file }
}

/** prd → tickets：本次流程后新建的 PRD，须满足结构契约（H1 + 固定顺序必需小节）。 */
export function prdGate(root, sinceMs) {
  const scratchDir = join(root, '.scratch')
  if (!existsSync(scratchDir)) return { ok: false, missing: ['.scratch/ 下没有 PRD'] }
  const candidates = []
  for (const dir of readdirSync(scratchDir)) {
    const p = join(scratchDir, dir, 'PRD.md')
    if (existsSync(p) && statSync(p).mtimeMs >= sinceMs) candidates.push(p)
  }
  if (candidates.length === 0) return { ok: false, missing: ['.scratch/ 下没有本次流程开始后新建的 PRD.md'] }
  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  const file = candidates[0]
  const content = readFileSync(file, 'utf8')
  const missing = []
  if (!/^#\s+PRD\s+\d+\s*·/m.test(content)) missing.push('H1 须为 `# PRD <NN> · <标题>`')
  let last = -1
  for (const s of PRD_REQUIRED_SECTIONS) {
    const i = content.indexOf(s)
    if (i < 0) { missing.push(`缺小节 ${s}`); continue }
    if (i < last) missing.push(`小节顺序错：${s} 应在前序小节之后`)
    last = i
  }
  return missing.length ? { ok: false, file, missing } : { ok: true, file, featureDir: join(file, '..') }
}

/** tickets → implement：功能目录 issues/ 下 ≥1 工单、每单有 Status 行、至少一单 ready-for-agent。 */
export function ticketsGate(featureDir) {
  const tickets = listTickets(featureDir)
  if (tickets.length === 0) return { ok: false, missing: [`${featureDir}/issues/ 下没有工单文件`] }
  const missing = []
  for (const t of tickets) {
    if (t.status === 'unknown') missing.push(`${t.base}：缺 **Status:** 行`)
  }
  if (missing.length) return { ok: false, missing, tickets }
  if (!tickets.some((t) => t.status === 'ready-for-agent')) {
    return { ok: false, missing: ['没有 Status: ready-for-agent 的工单（triage 后再推进）'], tickets }
  }
  return { ok: true, tickets }
}

/** ops → done：流程进入 ops 后须有新 retro。 */
export function opsGate(root, sinceMs) {
  const file = newestMd(join(root, 'docs', 'retro'), sinceMs)
  if (!file) return { ok: false, missing: ['docs/retro/ 下没有本次收尾后新建的回顾'] }
  return { ok: true, file }
}
