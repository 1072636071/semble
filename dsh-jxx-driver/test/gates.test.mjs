/** gates.mjs 单元测试：阶段闸门的结构判定。 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { adrGate, prdGate, ticketsGate, opsGate } from '../src/gates.mjs'

function mk(t) {
  const root = mkdtempSync(join(tmpdir(), 'jxx-gates-'))
  t.after(() => {})
  return root
}

const ADR_OK = '# ADR-0110 · 标题\n\n- 状态：已接受\n- 日期：2026-10-02\n\n## 背景\nx\n\n## 决策\ny\n\n## 后果\nz\n'
const PRD_OK = '# PRD 94 · 标题\n\nStatus: ready-for-agent\n\n## 问题陈述\n\n## 用户故事\n\n## 解决方案\n\n## 实现决策\n\n## 测试决策\n'

test('adrGate：无新 ADR 不过；结构缺小节不过；合规过', (t) => {
  const root = mk(t)
  const since = Date.now()
  assert.equal(adrGate(root, since).ok, false)
  mkdirSync(join(root, 'docs', 'adr'), { recursive: true })
  writeFileSync(join(root, 'docs', 'adr', '0110-x.md'), '# ADR-0110 · x\n\n## 背景\n')
  assert.equal(adrGate(root, since).ok, false) // 缺 ## 决策
  writeFileSync(join(root, 'docs', 'adr', '0111-y.md'), ADR_OK.replace('0110', '0111'))
  assert.equal(adrGate(root, since).ok, true)
})

test('prdGate：H1 形态 + 小节顺序', (t) => {
  const root = mk(t)
  const since = Date.now()
  assert.equal(prdGate(root, since).ok, false)
  const dir = join(root, '.scratch', '94-x')
  mkdirSync(dir, { recursive: true })
  // 顺序错：解决方案跑到用户故事前面
  writeFileSync(join(dir, 'PRD.md'), '# PRD 94 · x\n\n## 问题陈述\n\n## 解决方案\n\n## 用户故事\n\n## 实现决策\n\n## 测试决策\n')
  assert.equal(prdGate(root, since).ok, false)
  writeFileSync(join(dir, 'PRD.md'), PRD_OK)
  const g = prdGate(root, since)
  assert.equal(g.ok, true)
  assert.ok(g.featureDir.endsWith('94-x'))
})

test('ticketsGate：无工单不过；缺 Status 不过；全就绪过', (t) => {
  const root = mk(t)
  const dir = join(root, '.scratch', '94-x')
  mkdirSync(join(dir, 'issues'), { recursive: true })
  assert.equal(ticketsGate(dir).ok, false)
  writeFileSync(join(dir, 'issues', '01-a.md'), '# a\n\n**Status:** ready-for-agent\n')
  writeFileSync(join(dir, 'issues', '02-b.md'), '# b\n（没有 Status 行）\n')
  assert.equal(ticketsGate(dir).ok, false)
  writeFileSync(join(dir, 'issues', '02-b.md'), '# b\n\n**Status:** ready-for-agent\n\n**Blocked by:** 01\n')
  const g = ticketsGate(dir)
  assert.equal(g.ok, true)
  assert.equal(g.tickets.length, 2)
})

test('opsGate：无新 retro 不过；写过即过', (t) => {
  const root = mk(t)
  const since = Date.now()
  assert.equal(opsGate(root, since).ok, false)
  mkdirSync(join(root, 'docs', 'retro'), { recursive: true })
  writeFileSync(join(root, 'docs', 'retro', '2026-10-02-x.md'), '# 回顾\n')
  assert.equal(opsGate(root, since).ok, true)
})
