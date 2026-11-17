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
  assert.equal(result.code, 'ERR_TARGET_MUTATED_DURING_ROUND');
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
// ---- v1.2.0: duplicate-round guard, findings ledger, mechanism stall, status ----
function ledgerFile(root, name, findings) {
  const file = path.join(root, name);
  fs.writeFileSync(file, JSON.stringify({ schema_version: 1, findings }, null, 2) + '\n');
  return file;
}
function withRounds(root, names) {
  for (const name of names) fs.mkdirSync(path.join(root, name), { recursive: true });
  return path.join(root, names[0]);
}

test('init refuses a second round on an already sealed target hash', () => {
  const root = fixture('dup-round');
  fs.appendFileSync(path.join(root, 'PRD.md'), '- [ ] AC-1 [主路径] demo —— \x60a.test.js::x\x60\n');
  const first = path.join(root, 'review', 'r001');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', first, '--profile', 'readiness']);
  const manifest = path.join(first, 'manifest.json');
  complete(root, manifest);
  assert.equal(run(root, ['seal', '--manifest', manifest, '--status', 'passed', '--open-findings', '0']).status, 'passed');
  const second = path.join(root, 'review', 'r002');
  const blocked = run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', second, '--profile', 'readiness'], true);
  assert.equal(blocked.code, 'ERR_DUPLICATE_ROUND');
  assert.ok(blocked.message.includes('r001'));
  const forced = run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', path.join(root, 'review', 'r003'), '--profile', 'readiness', '--force-duplicate-round', '需要按新裁决重审']);
  assert.equal(forced.duplicate_of, 1);
});

test('seal rejects an open-findings count that disagrees with the ledger', () => {
  const root = fixture('ledger-mismatch');
  const output = path.join(root, 'review');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', output, '--profile', 'readiness']);
  const manifest = path.join(output, 'manifest.json');
  complete(root, manifest);
  const ledger = ledgerFile(root, 'findings.json', [
    { id: 'F-01', severity: 'Blocker', mechanism: 'index-replace', state: 'open' },
  ]);
  const result = run(root, ['seal', '--manifest', manifest, '--status', 'changes_required', '--open-findings', '0', '--findings', ledger], true);
  assert.equal(result.code, 'ERR_FINDINGS_MISMATCH');
});

test('seal derives backlog_nits from the ledger when not passed explicitly', () => {
  const root = fixture('ledger-nits');
  const output = path.join(root, 'review');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', output, '--profile', 'readiness']);
  const manifest = path.join(output, 'manifest.json');
  complete(root, manifest);
  const ledger = ledgerFile(root, 'findings.json', [
    { id: 'F-01', severity: 'Blocker', mechanism: 'index-replace', state: 'fixed' },
    { id: 'F-02', severity: 'Nit', mechanism: 'wording', state: 'open' },
    { id: 'F-03', severity: 'Nit', mechanism: 'wording', state: 'backlog' },
  ]);
  const sealed = run(root, ['seal', '--manifest', manifest, '--status', 'passed', '--open-findings', '0', '--findings', ledger]);
  assert.equal(sealed.status, 'passed');
  assert.equal(sealed.backlog_nits, 2);
  const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert.equal(data.finding_counts.blocker, 1);
  assert.equal(data.finding_counts.nit, 2);
  assert.equal(data.ledger_file, 'findings.json');
});

test('a mechanism open in two consecutive rounds blocks seal until accepted', () => {
  const root = fixture('stall');
  const rounds = path.join(root, 'review');
  withRounds(rounds, ['r001']);
  ledgerFile(path.join(rounds, 'r001'), 'findings.json', [
    { id: 'F-01', severity: 'Major', mechanism: 'canonical-golden', state: 'open' },
  ]);
  const output = path.join(rounds, 'r002');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', output, '--profile', 'readiness']);
  const manifest = path.join(output, 'manifest.json');
  complete(root, manifest);
  const ledger = path.join(output, 'findings.json');
  fs.writeFileSync(ledger, JSON.stringify({ schema_version: 1, findings: [
    { id: 'F-01', severity: 'Major', mechanism: 'canonical-golden', state: 'open' },
  ] }, null, 2) + '\n');
  const blocked = run(root, ['seal', '--manifest', manifest, '--status', 'changes_required', '--open-findings', '1', '--findings', ledger, '--histories', rounds], true);
  assert.equal(blocked.code, 'ERR_MECHANISM_STALLED');
  assert.ok(blocked.message.includes('canonical-golden'));
  const accepted = run(root, ['seal', '--manifest', manifest, '--status', 'changes_required', '--open-findings', '1', '--findings', ledger, '--histories', rounds, '--accept-mechanism', 'canonical-golden', '--reason', '用户裁决：先落实现代再回填 golden']);
  assert.equal(accepted.stalls, 1);
  const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert.equal(data.mechanism_stalls[0].accepted, true);
});

test('status summarises rounds and detects a target already bound', () => {
  const root = fixture('status');
  const rounds = path.join(root, 'review');
  const output = path.join(rounds, 'r001');
  run(root, ['init', '--root', root, '--target', 'PRD.md', '--output', output, '--profile', 'readiness']);
  const report = run(root, ['status', '--root', root, '--rounds', rounds, '--target', 'PRD.md']);
  assert.equal(report.summary.total, 1);
  assert.equal(report.summary.latest_round, 'r001');
  assert.equal(report.summary.latest_target_matches_current, true);
  assert.equal(report.next, 'resume: a round already binds the current target hash');
});

// ---- v1.3.0: round budget (default max 3; no new round once the last round left no Blocker) ----
function sealRound(root, out, findings, status, open) {
  const manifest = path.join(out, "manifest.json");
  complete(root, manifest);
  const ledger = path.join(out, "findings.json");
  fs.writeFileSync(ledger, JSON.stringify({ schema_version: 1, findings }, null, 2) + "\n");
  const sealed = run(root, ["seal", "--manifest", manifest, "--status", status, "--open-findings", String(open), "--findings", ledger]);
  assert.equal(sealed.status, status);
  return manifest;
}
function newRound(root, name, extra = []) {
  fs.appendFileSync(path.join(root, "PRD.md"), "\nrevision for " + name + "\n");
  const out = path.join(root, "review", name);
  run(root, ["init", "--root", root, "--target", "PRD.md", "--output", out, "--profile", "readiness", ...extra]);
  return out;
}

test("round budget blocks a fourth round when the last round left no Blocker", () => {
  const root = fixture("budget-exhausted");
  for (const name of ["r001", "r002", "r003"]) {
    sealRound(root, newRound(root, name), [{ id: "F-" + name, severity: "Major", mechanism: "m", state: "open" }], "changes_required", 1);
  }
  fs.appendFileSync(path.join(root, "PRD.md"), "\nrevision for r004\n");
  const blocked = run(root, ["init", "--root", root, "--target", "PRD.md", "--output", path.join(root, "review", "r004"), "--profile", "readiness"], true);
  assert.equal(blocked.code, "ERR_ROUND_BUDGET_EXHAUSTED");
  assert.match(blocked.message, /no open Blocker/);
});

test("round budget allows one more round only with an open Blocker plus approval", () => {
  const root = fixture("budget-blocker");
  for (const name of ["r001", "r002", "r003"]) {
    sealRound(root, newRound(root, name), [{ id: "B-" + name, severity: "Blocker", mechanism: "blk", state: "open" }], "changes_required", 1);
  }
  fs.appendFileSync(path.join(root, "PRD.md"), "\nrevision for r004\n");
  const noApproval = run(root, ["init", "--root", root, "--target", "PRD.md", "--output", path.join(root, "review", "r004"), "--profile", "readiness"], true);
  assert.equal(noApproval.code, "ERR_ROUND_BUDGET_EXHAUSTED");
  assert.match(noApproval.message, /Blocker/);
  fs.appendFileSync(path.join(root, "PRD.md"), "\nrevision for r005\n");
  const approved = run(root, ["init", "--root", root, "--target", "PRD.md", "--output", path.join(root, "review", "r005"), "--profile", "readiness", "--approval", "用户批准第 4 轮：仍有未处置 Blocker"]);
  assert.equal(approved.ok, true);
});

test("round budget honours an explicit --max-rounds", () => {
  const root = fixture("budget-raise");
  for (const name of ["r001", "r002"]) {
    sealRound(root, newRound(root, name), [{ id: "F-" + name, severity: "Major", mechanism: "m", state: "open" }], "changes_required", 1);
  }
  fs.appendFileSync(path.join(root, "PRD.md"), "\nrevision for r003\n");
  const blocked = run(root, ["init", "--root", root, "--target", "PRD.md", "--output", path.join(root, "review", "r003"), "--profile", "readiness", "--max-rounds", "2"], true);
  assert.equal(blocked.code, "ERR_ROUND_BUDGET_EXHAUSTED");
  fs.appendFileSync(path.join(root, "PRD.md"), "\nrevision for r004\n");
  const raised = run(root, ["init", "--root", root, "--target", "PRD.md", "--output", path.join(root, "review", "r004"), "--profile", "readiness", "--max-rounds", "5"]);
  assert.equal(raised.ok, true);
});

// ---- v1.3.1: review and edit are strictly serial — the target is frozen during a round ----
// 冻结是物理的：直接 writeFileSync 会被 EPERM 拒绝。要模拟"外部强改"必须先剥掉只读位。
function forceWrite(file, content) {
  try { fs.chmodSync(file, 0o644); } catch { /* ignore */ }
  if (process.platform === "win32") {
    try { require("node:child_process").execFileSync("attrib", ["-R", file], { stdio: "ignore" }); } catch { /* ignore */ }
  }
  fs.writeFileSync(file, content);
}

test("init physically freezes the target: a plain write is refused", () => {
  const root = fixture("freeze-physical");
  const output = path.join(root, "review");
  const res = run(root, ["init", "--root", root, "--target", "PRD.md", "--output", output, "--profile", "readiness"]);
  assert.equal(res.frozen, true);
  let refused = false;
  try { fs.writeFileSync(path.join(root, "PRD.md"), "# PRD\n\nedited\n"); } catch (error) { refused = error.code === "EPERM" || error.code === "EACCES"; }
  assert.equal(refused, true, "frozen target must refuse a plain write");
  const guard = run(root, ["guard", "--manifest", path.join(output, "manifest.json")]);
  assert.equal(guard.ok, true);
  assert.equal(guard.verdict, "intact");
});

test("guard detects a forced edit and reports the round void", () => {
  const root = fixture("freeze-guard");
  const output = path.join(root, "review");
  run(root, ["init", "--root", root, "--target", "PRD.md", "--output", output, "--profile", "readiness"]);
  forceWrite(path.join(root, "PRD.md"), "# PRD\n\nforced edit\n");
  const guard = run(root, ["guard", "--manifest", path.join(output, "manifest.json")]);
  assert.equal(guard.ok, false);
  assert.equal(guard.target_changed, true);
  assert.match(guard.verdict, /TARGET MUTATED DURING ROUND/);
  // --strict 时 exit 1，但报告仍写在 stdout
  const strictOut = (() => {
    try { return JSON.parse(execFileSync(process.execPath, [script, "guard", "--manifest", path.join(output, "manifest.json"), "--strict"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })); }
    catch (error) { return JSON.parse(error.stdout); }
  })();
  assert.equal(strictOut.ok, false);
});

test("record refuses a forced mid-round edit and stamps the mutation", () => {
  const root = fixture("freeze-record");
  const output = path.join(root, "review");
  run(root, ["init", "--root", root, "--target", "PRD.md", "--output", output, "--profile", "readiness"]);
  const manifest = path.join(output, "manifest.json");
  forceWrite(path.join(root, "PRD.md"), "# PRD\n\nmid-round edit\n");
  const stage = JSON.parse(fs.readFileSync(manifest, "utf8")).stages[0];
  fs.writeFileSync(path.join(root, stage.report), "x\n");
  const args = ["record", "--manifest", manifest, "--stage", stage.id, "--report", stage.report];
  for (const r of stage.expected_reviewers) args.push("--reviewer", r);
  const blocked = run(root, args, true);
  assert.equal(blocked.code, "ERR_TARGET_MUTATED_DURING_ROUND");
  const after = JSON.parse(fs.readFileSync(manifest, "utf8"));
  assert.equal(after.status, "incomplete");
  assert.equal(after.target_mutations.length, 1);
  assert.equal(after.target_mutations[0].detected_by.startsWith("record:"), true);
});

test("fail unfreezes the target so the next round may edit it", () => {
  const root = fixture("freeze-unfreeze");
  const output = path.join(root, "review");
  run(root, ["init", "--root", root, "--target", "PRD.md", "--output", output, "--profile", "readiness"]);
  const manifest = path.join(output, "manifest.json");
  const failed = run(root, ["fail", "--manifest", manifest, "--code", "ERR_STAGE_FAILED", "--message", "stop"]);
  assert.equal(failed.unfrozen, true);
  fs.writeFileSync(path.join(root, "PRD.md"), "# PRD\n\neditable again\n");
  assert.ok(fs.readFileSync(path.join(root, "PRD.md"), "utf8").includes("editable again"));
});
