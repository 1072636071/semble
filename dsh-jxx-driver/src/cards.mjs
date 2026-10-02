/** 卡位扫描与工单解析——只读 control/ 与 .scratch/，不做任何写操作。 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

export const CARD_ID_RE = /^[a-z]?\d[\da-z-]*$/i

/** 卡位三态 + 暂缓道 + 收口位。全部来自文件名/目录，不解析卡面。 */
export function scanBoard(root) {
  const openDir = join(root, 'control', 'cards', 'open')
  const doneDir = join(root, 'control', 'cards', 'done')
  const heldDir = join(root, 'control', 'held')
  const inbox = []
  const claimed = []
  const review = []
  if (existsSync(openDir)) {
    for (const name of readdirSync(openDir)) {
      if (!name.endsWith('.md')) continue
      const full = join(openDir, name)
      const mtime = statSync(full).mtimeMs
      if (name.endsWith('.claimed.md')) claimed.push({ id: name.slice(0, -11), file: full, mtime })
      else if (name.endsWith('.review.md')) review.push({ id: name.slice(0, -10), file: full, mtime })
      else inbox.push({ id: name.slice(0, -3), file: full, mtime })
    }
  }
  const readIds = (dir) => existsSync(dir)
    ? readdirSync(dir).filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3))
    : []
  return {
    inbox, claimed, review,
    held: readIds(heldDir),
    done: new Set(readIds(doneDir)),
    archived: new Set(readIds(join(root, 'control', 'cards', 'archived'))),
  }
}

export function readCardField(content, field) {
  const re = new RegExp(`^-\\s*${field}[：:]\\s*(.+)$`, 'm')
  const m = content.match(re)
  return m ? m[1].trim() : undefined
}

/** 卡面 `- 依赖:` 行 → 卡 id 数组；「无」开头或缺行 = 无依赖。 */
export function cardDeps(content) {
  const raw = readCardField(content, '依赖')
  if (!raw || raw.startsWith('无')) return []
  return raw.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean)
}

/** 工单文件解析：`# 标题` / `**Status:** x`（粗体把冒号包进去）/ `**Blocked by:** 01, 02`。 */
export function parseTicketFile(path) {
  const content = readFileSync(path, 'utf8')
  const title = (content.match(/^#\s+(.+)$/m) || [])[1]?.trim() || basename(path, '.md')
  // `**Status:** x` 与 `Status: x` 两种写法都要吃（粗体的冒号在星号内侧）
  const status = (content.match(/\bStatus\b\s*\*{0,2}\s*[：:]\s*\*{0,2}\s*([A-Za-z-]+)/) || [])[1] || 'unknown'
  const blockedRaw = (content.match(/\bBlocked by\b\s*\*{0,2}\s*[：:]\s*\*{0,2}\s*(.+)/) || [])[1] || ''
  const blockedBy = blockedRaw.startsWith('无') || blockedRaw.trim() === ''
    ? []
    : blockedRaw.split(/[,，]/).map((s) => s.trim().replace(/^0*(\d+)$/, '$1')).filter((s) => /^\d+$/.test(s))
  return { file: path, title, status, blockedBy, base: basename(path, '.md') }
}

/** 功能目录（.scratch/<NN>-<slug>/）下全部工单文件，按文件名排序。 */
export function listTickets(featureDir) {
  const issuesDir = join(featureDir, 'issues')
  if (!existsSync(issuesDir)) return []
  return readdirSync(issuesDir)
    .filter((n) => n.endsWith('.md') && !/^00-.*index/i.test(n) && !/^review-/i.test(n))
    .sort()
    .map((n) => parseTicketFile(join(issuesDir, n)))
}

/** 工单号（文件名前导数字）→ 卡 id 的映射。卡 id = <PRD号>-<工单文件基名>。 */
export function ticketCardId(featureDir, ticketBase) {
  const prdNum = (basename(featureDir).match(/^(\d+)/) || [])[1]
  if (!prdNum) throw new Error(`jxx-driver: 功能目录名缺前导编号：${featureDir}`)
  return `${prdNum}-${ticketBase}`
}

export function ticketNum(base) {
  const m = base.match(/^(\d+)-/)
  return m ? String(parseInt(m[1], 10)) : undefined
}

/** 列出 .scratch/ 下全部 PRD：编号、slug、标题、就绪工单数（auto 参数解析的数据面）。 */
export function listPrds(root) {
  const scratch = join(root, '.scratch')
  if (!existsSync(scratch)) return []
  const out = []
  for (const name of readdirSync(scratch)) {
    const m = name.match(/^(\d+)-(.+)$/)
    if (!m) continue
    const dir = join(scratch, name)
    const prdFile = join(dir, 'PRD.md')
    if (!existsSync(prdFile)) continue
    let title = name
    try {
      title = (readFileSync(prdFile, 'utf8').match(/^#\s+(.+)$/m) || [])[1]?.trim() || name
    } catch { /* 读不了就用目录名 */ }
    let tickets = []
    try { tickets = listTickets(dir) } catch { /* issues/ 缺失按 0 处理 */ }
    out.push({
      num: String(parseInt(m[1], 10)),
      slug: m[2],
      dir,
      title,
      ready: tickets.filter((t) => t.status === 'ready-for-agent').length,
      total: tickets.length,
    })
  }
  return out
}

/** 候选清单的人读渲染（错误消息与 steer 共用）。 */
export function prdListText(prds) {
  if (!prds || prds.length === 0) return '\n  （.scratch/ 下没有 PRD）'
  return '\n' + prds.map((p) => `  - ${p.num} · ${p.title}（就绪工单 ${p.ready}/${p.total}）`).join('\n')
}
