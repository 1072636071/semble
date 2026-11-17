import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/design-review.mjs', import.meta.url));
const base = path.resolve('.temp/tests/jxx-design-review');
fs.mkdirSync(base, { recursive: true });
function fixture(name) {
  const root = path.join(base, `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'PRD.md'), '# PRD\n\nInitial design.\n');
  return root;
}
function run(root, args, expectFailure = false) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(stdout);
  } catch (error) {
    if (!expectFailure) throw error;
    return JSON.parse(error.stderr);
  }
}
function complete(root, manifest) {
  const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  for (const stage of data.stages) {
    fs.writeFileSync(path.join(root, stage.report), `# ${stage.id}\n\nFindings resolved.\n`);
    const args = ['record', '--manifest', manifest, '--stage', stage.id, '--report', stage.report];
    for (const reviewer of stage.expected_reviewers) args.push('--reviewer', reviewer);
    assert.equal(run(root, args).ok, true);
  }
}

test('sealed review becomes stale when the target changes', () => {
  const root = fixture('stale');
  const output = path.join(root, 'review');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', output, '--profile', 'full']);
  const manifest = path.join(output, 'manifest.json');
  complete(root, manifest);
  assert.equal(run(root, ['seal', '--manifest', manifest, '--status', 'passed', '--open-findings', '0']).status, 'passed');
  assert.equal(run(root, ['verify', '--manifest', manifest]).status, 'valid');
  fs.appendFileSync(path.join(root, 'PRD.md'), '\nChanged after review.\n');
  const result = run(root, ['verify', '--manifest', manifest], true);
  assert.equal(result.code, 'ERR_STALE_REVIEW');
});

test('fresh-context failure is not_run and cannot verify', () => {
  const root = fixture('not-run');
  const output = path.join(root, 'review');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', output, '--profile', 'feature']);
  const manifest = path.join(output, 'manifest.json');
  assert.equal(run(root, ['fail', '--manifest', manifest, '--code', 'ERR_FRESH_CONTEXT_UNAVAILABLE']).status, 'not_run');
  assert.equal(run(root, ['verify', '--manifest', manifest], true).code, 'ERR_INCOMPLETE_REVIEW');
});

test('record rejects a reduced reviewer set', () => {
  const root = fixture('reviewers');
  const output = path.join(root, 'review');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', output, '--profile', 'readiness']);
  const manifest = path.join(output, 'manifest.json');
  fs.writeFileSync(path.join(root, 'readiness.md'), '# Readiness\n');
  const result = run(root, ['record', '--manifest', manifest, '--stage', 'implementation-readiness', '--report', 'readiness.md', '--reviewer', 'egm-style'], true);
  assert.equal(result.code, 'ERR_REVIEWER_MISMATCH');
});

test('downgrade without user approval is rejected', () => {
  const root = fixture('downgrade');
  const first = path.join(root, 'r001');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', first, '--profile', 'full']);
  const result = run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', path.join(root, 'r002'), '--profile', 'readiness', '--downgrade-from', path.join(first, 'manifest.json')], true);
  assert.equal(result.code, 'ERR_DOWNGRADE_UNAPPROVED');
});

test('approved downgrade is recorded in the manifest', () => {
  const root = fixture('downgrade-ok');
  const first = path.join(root, 'r001');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', first, '--profile', 'full']);
  const second = path.join(root, 'r002');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', second, '--profile', 'readiness', '--downgrade-from', path.join(first, 'manifest.json'), '--approval', '用户批准降档：架构 SOUND，仅余机制细节']);
  const data = JSON.parse(fs.readFileSync(path.join(second, 'manifest.json'), 'utf8'));
  assert.equal(data.profile, 'readiness');
  assert.equal(data.downgrade.prev_profile, 'full');
  assert.ok(data.downgrade.approval.includes('用户批准'));
});

test('seal records nit backlog without blocking passed', () => {
  const root = fixture('backlog');
  const output = path.join(root, 'review');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', output, '--profile', 'readiness']);
  const manifest = path.join(output, 'manifest.json');
  complete(root, manifest);
  const sealed = run(root, ['seal', '--manifest', manifest, '--status', 'passed', '--open-findings', '0', '--backlog-nits', '12']);
  assert.equal(sealed.status, 'passed');
  const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert.equal(data.backlog_nits, 12);
  assert.equal(run(root, ['verify', '--manifest', manifest]).status, 'valid');
});
