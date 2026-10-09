/** board.mjs 封装单测（PRD 108 收口 retro P0-1）：newCard 幂等契约——
 * 新看板脚本（exit 0 打 `exists:`）、旧版脚本（die exit 1 + stderr 已存在）、
 * 正常创建、真实失败四态全分支；parseExisting 纯逻辑全分支。
 * 走 Board._runImpl 注入口，不 spawn 真实 node（本机 execFile(process.execPath) 有
 * ENOENT 环境坑，见 retro「跑法假红」条目）。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Board, _parseExistingForTest as parseExisting } from '../src/board.mjs'

// ---------- parseExisting 纯逻辑全分支 ----------

test('parseExisting：新看板脚本形态（stdout exists: 行）→ reused + path', () => {
  const r = parseExisting('new-card: 依赖自动取自工单 Blocked by → "01"\nnew-card: 卡 108-02-x 已存在（control/cards/open/108-02-x.md）——幂等跳过 exists: E:/repo/control/cards/open/108-02-x.md')
  assert.equal(r.reused, true)
  assert.equal(r.path, 'E:/repo/control/cards/open/108-02-x.md')
})

test('parseExisting：stdout 含「已存在」但无 exists: 行 → reused（宽容形态）', () => {
  const r = parseExisting('new-card: 卡 108-02-x 已存在')
  assert.equal(r.reused, true)
  assert.equal(r.path, '')
})

test('parseExisting：stderr 含「已存在」（旧版 die 形态降级）→ reused', () => {
  const r = parseExisting('', 'board: 卡 108-02-x 已存在')
  assert.equal(r.reused, true)
})

test('parseExisting：正常创建输出 → null（非复用）', () => {
  const r = parseExisting('new-card: open/108-02-x.md 已创建（L2 · labels: ready-for-agent）', '')
  assert.equal(r, null)
})

test('parseExisting：空输出 → null', () => {
  assert.equal(parseExisting('', ''), null)
})

// ---------- newCard 四态（_runImpl 注入，不 spawn 真实 node） ----------

function boardWithRunner(impl) {
  const b = new Board('fake-board.mjs')
  b._runImpl = impl
  return b
}

test('newCard：新脚本幂等 exists: → created false / reused true / path 带', async () => {
  const b = boardWithRunner(async () => ({
    stdout: 'new-card: 卡 108-02-x 已存在（control/cards/open/108-02-x.md）——幂等跳过 exists: E:/repo/control/cards/open/108-02-x.md',
    stderr: '',
  }))
  const r = await b.newCard('E:/repo', { id: '108-02-x' })
  assert.equal(r.created, false)
  assert.equal(r.reused, true)
  assert.equal(r.path, 'E:/repo/control/cards/open/108-02-x.md')
})

test('newCard：stdout 含「已存在」无 exists: 行（宽容形态）→ created false / reused true', async () => {
  const b = boardWithRunner(async () => ({ stdout: 'new-card: 卡 108-02-x 已存在', stderr: '' }))
  const r = await b.newCard('E:/repo', { id: '108-02-x' })
  assert.equal(r.created, false)
  assert.equal(r.reused, true)
})

test('newCard：旧版 die exit 1 + stderr 已存在 → reject 被降级为复用，不 throw', async () => {
  const b = boardWithRunner(async () => {
    throw new Error('board.mjs new-card 失败：board: 卡 108-02-x 已存在')
  })
  const r = await b.newCard('E:/repo', { id: '108-02-x' })
  assert.equal(r.created, false)
  assert.equal(r.reused, true)
})

test('newCard：正常创建 → created true / reused false', async () => {
  const b = boardWithRunner(async () => ({
    stdout: 'new-card: open/108-02-x.md 已创建（L2 · labels: ready-for-agent）',
    stderr: '',
  }))
  const r = await b.newCard('E:/repo', { id: '108-02-x' })
  assert.equal(r.created, true)
  assert.equal(r.reused, false)
})

test('newCard：真实失败（非已存在）仍 reject——不吞真错误', async () => {
  const b = boardWithRunner(async () => {
    throw new Error('board.mjs new-card 失败：board: 缺少 --id')
  })
  await assert.rejects(() => b.newCard('E:/repo', { id: '' }), /缺少 --id/)
})

// ---------- 其余方法走 _runImpl 注入同样可测（顺带覆盖，防回退到硬编码 run） ----------

test('cardMove 走注入口', async () => {
  let captured = null
  const b = boardWithRunner(async (script, args) => {
    captured = args
    return { stdout: 'moved', stderr: '' }
  })
  await b.cardMove('E:/repo', { id: '108-02-x', to: 'done', reason: '收口' })
  assert.deepEqual(captured, ['card-move', '--root', 'E:/repo', '--id', '108-02-x', '--to', 'done', '--actor', 'jxx-driver', '--reason', '收口'])
})

test('verify 失败返回 ok:false 而非 reject', async () => {
  const b = boardWithRunner(async () => {
    throw new Error('verify: 发现 29 处出入')
  })
  const r = await b.verify('E:/repo')
  assert.equal(r.ok, false)
  assert.match(r.output, /29 处出入/)
})
