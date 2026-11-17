import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const gateScript = fileURLToPath(new URL('../scripts/pre-review-gate.mjs', import.meta.url));
const BT = String.fromCharCode(96);
const span = (s) => BT + s + BT;
const base = path.resolve('.temp/tests/jxx-design-review-gate-v12');
fs.mkdirSync(base, { recursive: true });

// Phase table fixture: the PRD's own phase-gate table plus its boundary table are the only
// inputs. C8 asks 'does every AC evidence file have an owning phase', C9 asks 'is the owning
// phase ordered after the phase that gates the AC'.
const prd = (overrides = {}) => [
  '# PRD: phase demo',
  '',
  '## 验收点（AC）',
  '',
  '- [ ] AC-1 [主路径] 归档状态机 —— ' + span('local-memory-archive.test.js::archive_state_machine') + '。',
  '- [ ] AC-2 [主路径] 阶段闸 —— ' + span('local-memory-rollout.test.js::gate') + '。',
  '- [ ] AC-3 [证据] 只引源码 ' + span('tools/lib/scanner.mjs::scanText') + ' 与其校验器 —— ' + span('local-memory-safety.test.js::allowlist') + '。',
  '',
  '## 实现决策',
  '',
  '| 阶段 | 命令 | 完整 AC | 路由 |',
  '| --- | --- | --- | --- |',
  overrides.gate || ('| P1 | ' + span('npm run test:p1') + ' | 1、2 | legacy |'),
  '| P2 | ' + span('npm run test:p2') + ' | 3 | legacy |',
  '',
  '| 阶段 | 动作 | 路径 | 职责 |',
  '| --- | --- | --- | --- |',
  '| P1 | Create | ' + span('local-memory-archive.test.js') + ' | 归档验收 |',
  overrides.rollout === 'drop' ? '' : ('| P2 | Create | ' + span('local-memory-rollout.test.js') + ' | 阶段闸验收 |'),
  overrides.safety === 'drop' ? '' : ('| P1 | Create | ' + span('local-memory-safety.test.js') + ' | 安全验收 |'),
  '',
].filter((l) => l !== '' || true).join('\n');

function fixture(name, gate) {
  const root = path.join(base, name + '-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  fs.mkdirSync(path.join(root, 'issues'), { recursive: true });
  fs.writeFileSync(path.join(root, 'PRD.md'), prd(gate));
  fs.writeFileSync(path.join(root, 'gate-config.json'), JSON.stringify({ boundary: { phases: ['P1', 'P2'] } }, null, 2) + '\n');
  return root;
}
function run(root) {
  try {
    const stdout = execFileSync(process.execPath, [gateScript, '--root', root, '--target', 'PRD.md', '--json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, report: JSON.parse(stdout) };
  } catch (error) {
    return { code: error.status === undefined ? 2 : error.status, report: JSON.parse(error.stdout || error.stderr) };
  }
}
const check = (report, id) => report.checks.find((c) => c.id === id);

test('C9 goes red when an AC is gated before its evidence exists', () => {
  const { code, report } = run(fixture('phase-order'));
  assert.equal(code, 1);
  const c9 = check(report, 'C9');
  assert.equal(c9.status, 'fail');
  assert.ok(c9.findings.some((f) => f.message.includes('AC-2') && f.message.includes('P2')));
  assert.ok(!c9.findings.some((f) => f.message.includes('AC-1')), 'AC-1 evidence exists in its own phase');
});

test('C9 accepts a partially gated AC', () => {
  const { code, report } = run(fixture('phase-partial', { gate: '| P1 | ' + span('npm run test:p1') + ' | 1、2 本地部分 | legacy |' }));
  assert.equal(code, 0, JSON.stringify(check(report, 'C9').findings));
  assert.equal(check(report, 'C9').status, 'pass');
});

test('C8 goes red when an AC evidence file is owned by no phase', () => {
  const { code, report } = run(fixture('orphan-evidence', { safety: 'drop' }));
  assert.equal(code, 1);
  const c8 = check(report, 'C8');
  assert.equal(c8.status, 'fail');
  assert.ok(c8.findings.some((f) => f.message.includes('local-memory-safety.test.js')));
});

test('boundary checks are skipped when no boundary config exists', () => {
  const root = fixture('no-boundary');
  fs.rmSync(path.join(root, 'gate-config.json'));
  const { code, report } = run(root);
  assert.equal(code, 0);
  assert.equal(check(report, 'C8').status, 'skip');
  assert.equal(check(report, 'C9').status, 'skip');
});
