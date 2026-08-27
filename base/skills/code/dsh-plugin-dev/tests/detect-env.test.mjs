// detect-env.mjs 的单元/E2E 测试（node:test 运行器）
// 运行：node --test tests/detect-env.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(skillRoot, 'scripts', 'detect-env.mjs')

function runDetect(env = {}) {
  const out = execFileSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return JSON.parse(out)
}

test('unit: 输出包含固定结构字段', () => {
  const r = runDetect()
  assert.ok(r.env && 'DSH_PROJECT_PATH' in r.env && 'DSH_DEPLOY' in r.env && 'DSH_HOME' in r.env)
  assert.ok(typeof r.checks.nodeVersion === 'string')
  assert.ok(Array.isArray(r.assumptions) && Array.isArray(r.recommendations))
})

test('unit: 环境变量未设置时产生 assumptions', () => {
  const r = runDetect({ DSH_PROJECT_PATH: '', DSH_DEPLOY: '', DSH_HOME: '' })
  assert.ok(r.assumptions.some((a) => a.includes('DSH_PROJECT_PATH')))
  assert.ok(r.assumptions.some((a) => a.includes('DSH_DEPLOY')))
  assert.ok(r.assumptions.some((a) => a.includes('DSH_HOME')))
})

test('unit: 已设置的变量被采用且校验路径存在性', () => {
  const r = runDetect({ DSH_PROJECT_PATH: skillRoot, DSH_DEPLOY: 'npm-global', DSH_HOME: skillRoot })
  assert.equal(r.env.DSH_PROJECT_PATH, skillRoot)
  assert.equal(r.checks.projectPathExists, true)
  assert.equal(r.checks.deployModeKnown, true)
  assert.ok(!r.assumptions.some((a) => a.includes('DSH_HOME 未设置')))
})

test('unit: 不存在的项目路径产生告警且不崩溃', () => {
  const r = runDetect({ DSH_PROJECT_PATH: 'Z:\\no\\such\\path' })
  assert.equal(r.checks.projectPathExists, false)
  assert.ok(r.assumptions.some((a) => a.includes('路径不存在')))
})

test('unit: 非约定 DSH_DEPLOY 值被标记', () => {
  const r = runDetect({ DSH_DEPLOY: 'weird-mode' })
  assert.equal(r.checks.deployModeKnown, false)
})

test('e2e: 退出码为 0 且 stdout 为合法 JSON', () => {
  const out = execFileSync(process.execPath, [script], { encoding: 'utf8' })
  assert.doesNotThrow(() => JSON.parse(out))
})
