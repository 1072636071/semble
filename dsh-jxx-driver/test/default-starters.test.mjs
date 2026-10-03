/**
 * 子 agent 默认提示词固化（ADR-0115 D3）双闸：
 *  ① 同步闸：src/default-starters/{dev,reviewer,merger}.md 必须与技能真源
 *     base/skills/engineering/jxx-ticket-board/assets/starter-*.tmpl.md 逐字节一致——
 *     技能模板是真源，插件副本是固化快照；改了模板必须同步重拷（失败信息给出拷贝命令）。
 *  ② 行为闸：control/starter 缺失时 starter() 走内置副本并完成占位符替换（{{ROOT}} 等）；
 *     存在时优先用项目渲染产物（项目可能定制过，不可被内置副本盖掉）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { workerPrompt, reviewerPrompt, mergerPrompt } from '../src/prompts.mjs'

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_ASSETS = join(PLUGIN_ROOT, '..', 'base', 'skills', 'engineering', 'jxx-ticket-board', 'assets')

const PAIRS = [
  ['dev.md', 'starter-dev.tmpl.md'],
  ['reviewer.md', 'starter-reviewer.tmpl.md'],
  ['merger.md', 'starter-merger.tmpl.md'],
]

test('同步：内置默认提示词与技能 starter 模板逐字节一致（防双份漂移）', () => {
  for (const [ours, theirs] of PAIRS) {
    const a = readFileSync(join(PLUGIN_ROOT, 'src', 'default-starters', ours), 'utf8')
    const b = readFileSync(join(SKILL_ASSETS, theirs), 'utf8')
    assert.equal(
      a, b,
      `default-starters/${ours} 与技能模板 ${theirs} 漂移——以技能模板为准重新拷贝：`
      + `copy "base\\skills\\engineering\\jxx-ticket-board\\assets\\${theirs}" "dsh-jxx-driver\\src\\default-starters\\${ours}"`,
    )
  }
})

test('兜底：control/starter 缺失时用内置副本并替换占位符（不再是 3 行裸奔兜底）', () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-starter-'))

  const w = workerPrompt(root, '01-x')
  assert.ok(w.includes(join(root, 'control', 'PROTOCOL.md')), 'worker 提示词应含渲染后的 PROTOCOL 路径')
  assert.doesNotMatch(w, /\{\{ROOT\}\}/)
  assert.match(w, /开发组成员/)
  assert.match(w, /原子改名就是防抢/) // 角色纪律在，不是最小兜底
  assert.match(w, /优先领取卡片 `01-x`/)

  const r = reviewerPrompt(root, '01-x', 'std')
  assert.match(r, /\*\*std\*\*/)
  assert.doesNotMatch(r, /\{\{(ROOT|REVIEW_DIMENSION|CARD_ID|BASE_BRANCH)\}\}/)
  assert.match(r, /VERDICT/)

  const m = mergerPrompt(root, 'merge-01-x', '01-x')
  assert.match(m, /合并专员/)
  assert.match(m, /merge-check/) // 预演冲突面纪律在
  assert.doesNotMatch(m, /\{\{ROOT\}\}/)
  assert.match(m, /合并卡 `merge-01-x`/)
})

test('优先：control/starter 存在时用项目渲染产物（项目定制不被内置副本盖掉）', () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-starter-'))
  mkdirSync(join(root, 'control', 'starter'), { recursive: true })
  writeFileSync(join(root, 'control', 'starter', 'dev.md'), '项目定制版 starter', 'utf8')
  assert.match(workerPrompt(root, '01-x'), /项目定制版 starter/)
})
