import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/pre-review-gate.mjs', import.meta.url));
const base = path.resolve('.temp/tests/jxx-design-review-gate');
fs.mkdirSync(base, { recursive: true });

// Fixture mirrors the real 039 PRD/ticket/map formats (checkbox AC defs, Version lines, qualified refs).
function fixture(name) {
  const root = path.join(base, `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(path.join(root, 'issues'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/foo.ts'), 'line1\nline2\nline3\n');
  fs.writeFileSync(path.join(root, 'PRD.md'), [
    '# PRD: demo',
    '',
    'Version: v4.7',
    '',
    '- [ ] AC-1 [主路径] 当保存时回读一致 —— 验证:机器 node .test/a.mjs',
    '- [ ] AC-2 [主路径] 当发布时读回含标题（src/foo.ts:1-3） —— 验证:机器 node .test/b.mjs',
    '正文引用 AC-2 与工单 00 AC-6。',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'issues/00-demo.md'), [
    '# 00 demo',
    '',
    'Version: 对齐 PRD v4.7（同步）',
    '',
    '- [ ] AC-6 [主路径] 当 emit 后外壳字节一致 —— 验证:机器 node scripts/t.mjs',
    '消费 PRD AC-1。',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'map.md'), '# demo — 映射（PRD v4.7）\n\n| 工单 00 | AC-6 |\n');
  return root;
}
function run(root, extra = [], expectFailure = false) {
  try {
    const stdout = execFileSync(process.execPath, [script, '--root', root, '--target', 'PRD.md', '--json', ...extra], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, report: JSON.parse(stdout) };
  } catch (error) {
    if (!expectFailure && error.status !== 1) throw error;
    return { code: error.status, report: JSON.parse(error.stdout || error.stderr) };
  }
}
const check = (report, id) => report.checks.find((c) => c.id === id);

test('clean fixture passes all checks', () => {
  const root = fixture('clean');
  const { code, report } = run(root);
  assert.equal(code, 0);
  assert.equal(report.ok, true);
  for (const id of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) assert.equal(check(report, id).status, 'pass', id);
  assert.equal(check(report, 'C7').status, 'skip');
});

test('C1 goes red on undefined AC ref', () => {
  const root = fixture('bad-ac');
  fs.appendFileSync(path.join(root, 'PRD.md'), '引用 AC-99。\n');
  const { code, report } = run(root, [], true);
  assert.equal(code, 1);
  assert.equal(check(report, 'C1').status, 'fail');
  assert.ok(check(report, 'C1').findings.some((f) => f.message.includes('AC-99')));
});

test('C1 goes red on unqualified cross-space ref in PRD', () => {
  const root = fixture('cross-space');
  fs.appendFileSync(path.join(root, 'PRD.md'), '外壳比对见 AC-6。\n');
  const { code, report } = run(root, [], true);
  assert.equal(code, 1);
  const f = check(report, 'C1').findings.find((x) => x.message.includes('AC-6'));
  assert.ok(f, 'AC-6 exists only in ticket 00; PRD must qualify');
  assert.ok(f.message.includes('工单 NN AC-M'));
});

test('C1 accepts qualified cross-space ref and slash chains', () => {
  const root = fixture('qualified');
  fs.appendFileSync(path.join(root, 'PRD.md'), '见工单 00 AC-6 与 AC-1/2。\n');
  const { code, report } = run(root);
  assert.equal(code, 0);
  assert.equal(check(report, 'C1').status, 'pass');
});

test('C1 goes red on duplicate AC definition', () => {
  const root = fixture('dup-ac');
  fs.appendFileSync(path.join(root, 'PRD.md'), '- [ ] AC-1 [主路径] 重复定义 —— 验证:机器 node .test/a.mjs\n');
  const { code, report } = run(root, [], true);
  assert.equal(code, 1);
  assert.ok(check(report, 'C1').findings.some((f) => f.message.includes('defined twice')));
});

test('C2 goes red on missing ticket', () => {
  const root = fixture('bad-ticket');
  fs.appendFileSync(path.join(root, 'PRD.md'), '由工单 99 承接。\n');
  const { code, report } = run(root, [], true);
  assert.equal(code, 1);
  assert.ok(check(report, 'C2').findings.some((f) => f.message.includes('工单 99')));
});

test('C3 goes red on missing cited file and on line overrun', () => {
  const root = fixture('bad-cite');
  fs.appendFileSync(path.join(root, 'PRD.md'), '证据 src/nope.ts:10 与 src/foo.ts:1-99。\n');
  const { code, report } = run(root, [], true);
  assert.equal(code, 1);
  const msgs = check(report, 'C3').findings.map((f) => f.message);
  assert.ok(msgs.some((m) => m.includes('src/nope.ts') && m.includes('not found')));
  assert.ok(msgs.some((m) => m.includes('src/foo.ts') && m.includes('exceeds')));
});

test('C4 goes red on version drift across artifacts', () => {
  const root = fixture('version-drift');
  fs.writeFileSync(path.join(root, 'map.md'), '# demo — 映射（PRD v4.6）\n');
  const { code, report } = run(root, [], true);
  assert.equal(code, 1);
  assert.ok(check(report, 'C4').findings.some((f) => f.file === 'map.md' && f.message.includes('v4.6 != target v4.7')));
});

test('C5 goes red on stale acmap sidecar', () => {
  const root = fixture('sidecar');
  fs.writeFileSync(path.join(root, '.acmap.json'), JSON.stringify({ 'AC-1': 1, 'AC-77': 77 }));
  const { code, report } = run(root, [], true);
  assert.equal(code, 1);
  const msgs = check(report, 'C5').findings.map((f) => f.message);
  assert.ok(msgs.some((m) => m.includes('missing AC ids: 2')));
  assert.ok(msgs.some((m) => m.includes('stale AC ids: 77')));
});

test('C6 goes red on configured stale phrase', () => {
  const root = fixture('stale');
  fs.appendFileSync(path.join(root, 'PRD.md'), 'buildId 用 INTERVAL 1 MILLISECOND 推进。\n');
  fs.writeFileSync(path.join(root, 'gate-config.json'), JSON.stringify({
    stalePatterns: [{ pattern: 'INTERVAL 1 MILLISECOND', reason: 'Y1: MySQL has no MILLISECOND unit; use 1000 MICROSECOND' }],
  }));
  const { code, report } = run(root, [], true);
  assert.equal(code, 1);
  assert.ok(check(report, 'C6').findings.some((f) => f.message.includes('Y1')));
});

test('C7 skips without db url and does not fail the gate', () => {
  const root = fixture('sql-skip');
  fs.writeFileSync(path.join(root, 'probe.sql'), 'SELECT 1;\n');
  const { code, report } = run(root, ['--sql-probe', 'probe.sql']);
  assert.equal(code, 0);
  assert.equal(check(report, 'C7').status, 'skip');
});

test('C1 allows unqualified ticket-to-PRD AC fallback but not the reverse', () => {
  const root = fixture('ticket-fallback');
  fs.appendFileSync(path.join(root, 'issues/00-demo.md'), '本单回归覆盖 AC-2。\n');
  const { code, report } = run(root);
  assert.equal(code, 0);
  assert.equal(check(report, 'C1').status, 'pass');
});

test('C3 honors citationIgnore for external package sources', () => {
  const root = fixture('cite-ignore');
  fs.appendFileSync(path.join(root, 'PRD.md'), '取证 core/runtime.js:82。\n');
  const failing = run(root, [], true);
  assert.equal(failing.code, 1);
  fs.writeFileSync(path.join(root, 'gate-config.json'), JSON.stringify({ citationIgnore: ['core/runtime\\.js'] }));
  const { code, report } = run(root);
  assert.equal(code, 0);
  assert.equal(check(report, 'C3').status, 'pass');
});
// ---- v1.3.2: PRD AC 对照表的首列是「定义」不是「引用」 ----
// 背景：拆工时后 AC 编号在工单内自 1 起（跨工单必然重复），PRD AC 对照表首列写源 PRD 编号。
// gate 若扫描首列，会把定义当引用而在重编号下误报。
test('C1 ignores the definition column of the PRD AC table in map.md', () => {
  const root = path.join(base, 'prd-ac-col-' + Date.now());
  fs.mkdirSync(path.join(root, 'issues'), { recursive: true });
  fs.writeFileSync(path.join(root, 'PRD.md'), ['# PRD: demo', '', 'Version: v1.0', '', '本文件只留 AC 索引。', ''].join('\n'));
  fs.writeFileSync(path.join(root, 'issues/03-core.md'), [
    '# 03 core', '', 'Version: v1.0', '',
    '- [ ] AC-1 [主路径] 当保存时回读一致 —— 验证:机器 node .test/a.mjs', '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'map.md'), [
    '# demo — 映射', '',
    '## PRD AC 对照', '',
    '| PRD AC | 条目 | 工单与 AC | 判定 |',
    '| --- | --- | --- | --- |',
    '| AC-7 | 源 PRD 第 7 条 | 03：AC-1（工单 03） | covered |',
    '| AC-8 | 源 PRD 第 8 条 | 03：AC-1（工单 03） | covered |',
    '',
  ].join('\n'));
  const { report } = run(root);
  assert.equal(check(report, 'C1').status, 'pass');
});

test('C1 still flags an undefined ref outside the PRD AC table', () => {
  const root = path.join(base, 'prd-ac-outside-' + Date.now());
  fs.mkdirSync(path.join(root, 'issues'), { recursive: true });
  fs.writeFileSync(path.join(root, 'PRD.md'), ['# PRD: demo', '', 'Version: v1.0', '', '正文引用 AC-99。', ''].join('\n'));
  fs.writeFileSync(path.join(root, 'issues/03-core.md'), [
    '# 03 core', '', 'Version: v1.0', '',
    '- [ ] AC-1 [主路径] 当保存时回读一致 —— 验证:机器 node .test/a.mjs', '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'map.md'), '# demo — 映射\n');
  const { report } = run(root);
  assert.equal(check(report, 'C1').status, 'fail');
});
