/**
 * 三表一致性闸（PRD 100-01）：STAGES / evalGate / STAGE_HINTS 必须同步——
 * PRD 97 实测：STAGES 列了 adr 段而 evalGate 漏 case → run 卡死「未知阶段 adr」；
 * STAGE_HINTS 缺 adr 键 → doAdvance 返回 hint:undefined 被宿主 lossless 序列化器拒收。
 * 本文件钉死「增删阶段必须三表同步」，防同类漂移复发（修复点状，闸门长效）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Orchestrator, STAGES, STAGE_HINTS } from '../src/orchestrator.mjs'
import { normalizeConfig } from '../src/config.mjs'

/** evalGate 黑盒探针：造最小 run，看它是否落在「未知阶段」兜底。 */
function gateMissingOf(root, stage) {
  const orch = new Orchestrator(
    { logger: { info() {}, warn() {}, error() {} } },
    normalizeConfig({}),
    { info() {}, warn() {}, error() {} },
  )
  const gate = orch.evalGate({
    root, stage, featureDir: join(root, '.scratch', 'fake'),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    cards: new Map(), blocked: [], history: [],
  })
  assert.ok(gate && Array.isArray(gate.missing), `evalGate(${stage}) 应返回 { ok, missing } 形态`)
  return gate.missing
}

// done 段未豁免而是一并纳入断言：它有 hint 且 evalGate 走显式 case 返回「流程已完成」
// （非「未知阶段」missing），天然通过——比工单要求的「豁免」更强，零特判。
test('一致性：STAGES 的每个可推进段在 STAGE_HINTS 都有提示词（缺了 → advance 返回 undefined hint，宿主序列化拒收）', () => {
  for (const stage of STAGES) {
    const hint = STAGE_HINTS[stage]
    assert.ok(typeof hint === 'string' && hint.length > 0, `STAGE_HINTS 缺 ${stage}（或非字符串）`)
  }
  // 反向：STAGE_HINTS 不应有 STAGES 之外的孤儿键（删段后忘删提示词同样算漂移）
  for (const key of Object.keys(STAGE_HINTS)) {
    assert.ok(STAGES.includes(key), `STAGE_HINTS 有 STAGES 之外的孤儿键：${key}`)
  }
})

test('一致性：STAGES 的每个段经 evalGate 都不落「未知阶段」兜底', () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-consistency-'))
  for (const stage of STAGES) {
    const missing = gateMissingOf(root, stage)
    const unknown = missing.filter((m) => /未知阶段/.test(m))
    assert.deepEqual(unknown, [], `evalGate 对 ${stage} 报了未知阶段：${unknown.join('; ')}`)
  }
})

test('persist：按 run id 分文件落盘（jxx-driver-runs/<runId>.json），不再写旧单文件', () => {
  const root = mkdtempSync(join(tmpdir(), 'jxx-persist-'))
  const orch = new Orchestrator(
    { logger: { info() {}, warn() {}, error() {} } },
    normalizeConfig({}),
    { info() {}, warn() {}, error() {} },
  )
  const runId = 'test-run-1234'
  orch.persist({
    root, id: runId, stage: 'decide', idea: 'x', featureDir: undefined,
    createdAt: nowIso(), updatedAt: nowIso(),
    cards: new Map(), blocked: [], history: [],
  })
  const runFile = join(root, 'control', 'jxx-driver-runs', `${runId}.json`)
  assert.ok(existsSync(runFile), 'run 自有文件应存在')
  const parsed = JSON.parse(readFileSync(runFile, 'utf8'))
  assert.equal(parsed.id, runId)
  assert.equal(parsed.stage, 'decide')
  // 旧单文件不再被写入（单写者覆写问题消除的判据）
  assert.equal(existsSync(join(root, 'control', 'jxx-driver-state.json')), false, '旧 jxx-driver-state.json 不应再被创建')
  // 第二个 run 落自己的文件，互不覆盖
  const otherId = 'test-run-5678'
  orch.persist({
    root, id: otherId, stage: 'prd', idea: 'y', featureDir: undefined,
    createdAt: nowIso(), updatedAt: nowIso(),
    cards: new Map(), blocked: [], history: [],
  })
  assert.equal(JSON.parse(readFileSync(join(root, 'control', 'jxx-driver-runs', `${otherId}.json`), 'utf8')).id, otherId)
  assert.equal(JSON.parse(readFileSync(runFile, 'utf8')).id, runId, '先写 run 的文件不被后写 run 覆盖')
  assert.equal(readdirSync(join(root, 'control', 'jxx-driver-runs')).length, 2)
})

function nowIso() {
  return new Date().toISOString()
}
