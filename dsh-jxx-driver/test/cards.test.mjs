/** cards.mjs 单元测试：fixture 目录上的纯读函数。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanBoard, parseTicketFile, cardDeps, ticketCardId, ticketNum, listTickets } from '../src/cards.mjs'

function mkBoard(t) {
  const root = mkdtempSync(join(tmpdir(), 'jxx-cards-'))
  t.after(() => {})
  return root
}

test('scanBoard 按后缀/目录分位', (t) => {
  const root = mkBoard(t)
  const open = join(root, 'control', 'cards', 'open')
  mkdirSync(join(root, 'control', 'cards', 'done'), { recursive: true })
  mkdirSync(join(root, 'control', 'held'), { recursive: true })
  mkdirSync(open, { recursive: true })
  writeFileSync(join(open, '94-01-a.md'), 'x')
  writeFileSync(join(open, '94-02-b.claimed.md'), 'x')
  writeFileSync(join(open, '94-03-c.review.md'), 'x')
  writeFileSync(join(root, 'control', 'cards', 'done', '94-00-old.md'), 'x')
  writeFileSync(join(root, 'control', 'held', '94-09-h.md'), 'x')
  const b = scanBoard(root)
  assert.deepEqual(b.inbox.map((c) => c.id), ['94-01-a'])
  assert.deepEqual(b.claimed.map((c) => c.id), ['94-02-b'])
  assert.deepEqual(b.review.map((c) => c.id), ['94-03-c'])
  assert.deepEqual(b.held, ['94-09-h'])
  assert.ok(b.done.has('94-00-old'))
})

test('parseTicketFile 取标题/Status/Blocked by', (t) => {
  const root = mkBoard(t)
  const f = join(root, '01-foo.md')
  writeFileSync(f, '# 加个登录\n\n**Status:** ready-for-agent\n\n**Blocked by:** 01, 03\n')
  const tk = parseTicketFile(f)
  assert.equal(tk.title, '加个登录')
  assert.equal(tk.status, 'ready-for-agent')
  assert.deepEqual(tk.blockedBy, ['1', '3'])
})

test('cardDeps：无依赖/逗号分隔/中文逗号', () => {
  assert.deepEqual(cardDeps('- 依赖: 无——可立即开始'), [])
  assert.deepEqual(cardDeps('- 依赖: 94-01-a, 94-02-b'), ['94-01-a', '94-02-b'])
  assert.deepEqual(cardDeps('- 依赖：94-01-a，94-03-c'), ['94-01-a', '94-03-c'])
  assert.deepEqual(cardDeps('没有依赖行'), [])
})

test('ticketCardId = PRD号-工单基名；ticketNum 取前导数字', () => {
  assert.equal(ticketCardId('.scratch/94-jxx-driver-plugin', '01-scaffold-plugin'), '94-01-scaffold-plugin')
  assert.equal(ticketNum('01-scaffold-plugin'), '1')
  assert.equal(ticketNum('94-02-b'), '94')
})

test('listTickets 只收工单文件，跳过 index/review', (t) => {
  const root = mkBoard(t)
  const dir = join(root, '.scratch', '94-x', 'issues')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '01-a.md'), '# a\n\n**Status:** ready-for-agent\n')
  writeFileSync(join(dir, '00-index.md'), '# idx\n')
  writeFileSync(join(dir, 'review-01.md'), '# r\n')
  const ts = listTickets(join(root, '.scratch', '94-x'))
  assert.equal(ts.length, 1)
  assert.equal(ts[0].base, '01-a')
})
