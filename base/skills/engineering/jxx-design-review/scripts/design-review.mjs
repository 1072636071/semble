#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UPSTREAM = 'e9e1f06aa4e26e95cd4ed37210a0632202c429e9';
const STAGES = [
  { id: 'initial-zoom-out', report: '01-initial-zoom-out.md', reviewers: ['egm-zoom-out', 'egm-inventive-catalyst', 'egm-synthesizer'] },
  { id: 'comprehension', report: '02-comprehension.md', reviewers: ['egm-comprehension'] },
  { id: 'design-critique', report: '03-design-critique.md', reviewers: ['egm-design', 'egm-structural', 'egm-style', 'egm-synthesizer'] },
  { id: 'intermediate-zoom-out', report: '04-intermediate-zoom-out.md', reviewers: ['egm-zoom-out', 'egm-synthesizer'] },
  { id: 'implementation-readiness', report: '05-implementation-readiness.md', reviewers: ['egm-implementation-readiness', 'egm-codebase-details', 'egm-style', 'egm-synthesizer'] },
];
const PROFILES = { full: STAGES, feature: STAGES.slice(0, 4), readiness: STAGES.slice(4) };
const SEVERITIES = ['Blocker', 'Major', 'Nit'];
const STATES = ['open', 'fixed', 'rejected', 'accepted', 'backlog'];
const COUNTED_OPEN = new Set(['open']);

function argsOf(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) { out._.push(token); continue; }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) { out[key] = true; continue; }
    i++;
    if (out[key] === undefined) out[key] = value;
    else out[key] = Array.isArray(out[key]) ? [...out[key], value] : [out[key], value];
  }
  return out;
}
function list(value) { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function need(args, key) { if (!args[key] || args[key] === true) fail('ERR_MISSING_ARGUMENT', `Missing --${key}`); return args[key]; }
function fail(code, message) { console.error(JSON.stringify({ ok: false, code, message })); process.exit(1); }
function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function resolveInside(root, value) {
  const resolved = path.resolve(root, value);
  if (!inside(root, resolved)) fail('ERR_CONTEXT_OUTSIDE_ROOT', `Path escapes root: ${value}`);
  return resolved;
}
function relative(root, value) { return path.relative(root, value).split(path.sep).join('/'); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function hashFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function manifestPath(value) { return path.resolve(value); }
function assertCurrentTarget(manifest) {
  const target = resolveInside(manifest.root, manifest.target);
  if (!fs.existsSync(target)) fail('ERR_MISSING_TARGET', manifest.target);
  if (hashFile(target) !== manifest.target_sha256) fail('ERR_STALE_REVIEW', 'Target changed; start a new review round');
}
function selectedStage(manifest, id) {
  const stage = manifest.stages.find((entry) => entry.id === id);
  if (!stage) fail('ERR_INVALID_STAGE', `Stage not in profile: ${id}`);
  return stage;
}
function validateComplete(manifest) {
  for (const stage of manifest.stages) {
    if (stage.status !== 'completed' || stage.isolation !== 'fresh-context') fail('ERR_INCOMPLETE_REVIEW', `Stage not completed: ${stage.id}`);
    const expected = [...stage.expected_reviewers].sort();
    const actual = [...(stage.reviewers || [])].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) fail('ERR_REVIEWER_MISMATCH', `Reviewer set mismatch: ${stage.id}`);
    const report = resolveInside(manifest.root, stage.report);
    if (!fs.existsSync(report) || fs.statSync(report).size === 0) fail('ERR_MISSING_REPORT', stage.report);
  }
}

// ---- findings ledger (v1.2.0) ----
// A ledger is the machine-readable counterpart of a consolidated report. Without it a round's
// findings live only in prose, so the next round cannot tell "same mechanism again" from "new".
function loadLedger(file, manifest) {
  const resolved = resolveInside(manifest.root, file);
  if (!fs.existsSync(resolved)) fail('ERR_MISSING_LEDGER', file);
  let data;
  try { data = readJson(resolved); } catch (error) { fail('ERR_LEDGER_INVALID', `${file}: ${error.message}`); }
  if (!data || typeof data !== 'object' || !Array.isArray(data.findings)) fail('ERR_LEDGER_INVALID', `${file}: findings[] required`);
  const seen = new Set();
  const findings = data.findings.map((raw, index) => {
    const at = `findings[${index}]`;
    if (!raw || typeof raw !== 'object') fail('ERR_LEDGER_INVALID', `${at} must be an object`);
    const id = String(raw.id || '').trim();
    if (!id) fail('ERR_LEDGER_INVALID', `${at}.id required`);
    if (seen.has(id)) fail('ERR_LEDGER_INVALID', `duplicate finding id ${id}`);
    seen.add(id);
    if (!SEVERITIES.includes(raw.severity)) fail('ERR_LEDGER_INVALID', `${at}.severity must be one of ${SEVERITIES.join('/')}`);
    const state = String(raw.state || 'open');
    if (!STATES.includes(state)) fail('ERR_LEDGER_INVALID', `${at}.state must be one of ${STATES.join('/')}`);
    const mechanism = String(raw.mechanism || '').trim();
    if (!mechanism) fail('ERR_LEDGER_INVALID', `${at}.mechanism required (stable slug naming the mechanism, not the sentence)`);
    return {
      id,
      severity: raw.severity,
      mechanism,
      state,
      title: String(raw.title || '').trim(),
      evidence: raw.evidence === undefined ? null : String(raw.evidence),
      fix: raw.fix === undefined ? null : String(raw.fix),
      accepted_reason: raw.accepted_reason === undefined ? null : String(raw.accepted_reason),
    };
  });
  const openCounted = findings.filter((f) => COUNTED_OPEN.has(f.state) && f.severity !== 'Nit');
  const nitBacklog = findings.filter((f) => f.severity === 'Nit' && f.state !== 'fixed');
  return { file: relative(manifest.root, resolved), findings, openFindings: openCounted.length, nitBacklog: nitBacklog.length };
}
function priorLedgers(manifest, histories) {
  const scanned = [];
  for (const dir of list(histories)) {
    const root = path.resolve(String(dir));
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) fail('ERR_MISSING_HISTORY', String(dir));
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(root, entry.name, 'findings.json');
      if (!fs.existsSync(file)) continue;
      try {
        const data = readJson(file);
        if (!Array.isArray(data.findings)) continue;
        scanned.push({ round: entry.name, findings: data.findings });
      } catch { /* a corrupt sibling ledger is not this round's failure */ }
    }
  }
  return scanned;
}
// A mechanism open in the immediately preceding ledger AND still open now is a stall: the
// revision did not close the mechanism, it only re-worded the sentence that was cited.
function stalledMechanisms(current, histories, manifest) {
  const stalls = [];
  if (histories.length === 0) return stalls;
  const currentRound = path.basename(path.dirname(manifest.__file));
  const ordered = histories
    .filter((h) => h.round !== currentRound)
    .sort((a, b) => a.round.localeCompare(b.round, undefined, { numeric: true }));
  const previous = ordered[ordered.length - 1];
  if (!previous) return stalls;
  const before = new Map();
  for (const f of previous.findings) {
    if (COUNTED_OPEN.has(f.state) && f.severity !== 'Nit') before.set(f.mechanism, f);
  }
  for (const f of current) {
    if (!COUNTED_OPEN.has(f.state) || f.severity === 'Nit') continue;
    if (before.has(f.mechanism)) stalls.push({ mechanism: f.mechanism, finding: f.id, previous_finding: before.get(f.mechanism).id, previous_round: previous.round, severity: f.severity });
  }
  return stalls;
}

const args = argsOf(process.argv.slice(2));
const command = args._[0];
try {
  if (command === 'init') {
    const root = path.resolve(need(args, 'root'));
    const target = resolveInside(root, need(args, 'target'));
    const output = resolveInside(root, need(args, 'output'));
    const profile = need(args, 'profile');
    if (!PROFILES[profile]) fail('ERR_INVALID_PROFILE', profile);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) fail('ERR_MISSING_TARGET', relative(root, target));
    const manifestFile = path.join(output, 'manifest.json');
    if (fs.existsSync(manifestFile)) fail('ERR_ROUND_EXISTS', relative(root, manifestFile));
    const contexts = list(args.context).map((item) => {
      const file = resolveInside(root, item);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail('ERR_MISSING_CONTEXT', item);
      return relative(root, file);
    });
    let downgrade = null;
    if (args['downgrade-from'] && args['downgrade-from'] !== true) {
      const approval = args.approval;
      if (!approval || approval === true) fail('ERR_DOWNGRADE_UNAPPROVED', 'Profile downgrade requires --approval with the user decision text');
      const prevFile = path.resolve(String(args['downgrade-from']));
      if (!fs.existsSync(prevFile)) fail('ERR_MISSING_PRIOR_ROUND', String(args['downgrade-from']));
      const prev = readJson(prevFile);
      downgrade = { from: prevFile, prev_profile: prev.profile, prev_status: prev.status, approval: String(approval) };
    }
    // Same-hash duplicate rounds: a round that already sealed this exact target hash has
    // already produced its findings. Re-dispatching the same bytes buys nothing but cost.
    const targetHash = hashFile(target);
    const duplicateOf = [];
    for (const dir of [output, path.dirname(output), ...list(args.histories).map((d) => path.resolve(String(d)))]) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sibling = path.join(dir, entry.name, 'manifest.json');
        if (!fs.existsSync(sibling)) continue;
        try {
          const other = readJson(sibling);
          if (other.target_sha256 === targetHash && ['passed', 'changes_required'].includes(other.status)) {
            duplicateOf.push({ round: entry.name, manifest: relative(root, sibling), status: other.status, open_findings: other.open_findings });
          }
        } catch { /* ignore unreadable siblings */ }
      }
    }
    if (duplicateOf.length > 0 && !(args['force-duplicate-round'] && args['force-duplicate-round'] !== true)) {
      fail('ERR_DUPLICATE_ROUND', `target ${targetHash.slice(0, 12)} already sealed in ${duplicateOf.map((d) => d.round + '(' + d.status + ')').join(', ')}; pass --force-duplicate-round "<reason>" to override`);
    }
    fs.mkdirSync(output, { recursive: true });
    const manifest = {
      schema_version: 2,
      skill: 'jxx-design-review',
      root,
      target: relative(root, target),
      target_sha256: targetHash,
      profile,
      status: 'in_progress',
      isolation: 'fresh-context',
      host_instruction_isolation: 'unverified',
      context_files: contexts,
      downgrade,
      duplicate_of: duplicateOf,
      duplicate_override: duplicateOf.length > 0 ? String(args['force-duplicate-round']) : null,
      ledger_file: null,
      finding_counts: null,
      mechanism_stalls: [],
      open_findings: null,
      backlog_nits: null,
      error: null,
      upstream_commit: UPSTREAM,
      created_at: new Date().toISOString(),
      stages: PROFILES[profile].map((stage) => ({
        id: stage.id,
        status: 'pending',
        isolation: 'fresh-context',
        expected_reviewers: stage.reviewers,
        reviewers: [],
        report: relative(root, path.join(output, stage.report)),
      })),
    };
    writeJson(manifestFile, manifest);
    console.log(JSON.stringify({ ok: true, manifest: manifestFile, stages: manifest.stages.length, duplicate_of: duplicateOf.length }));
  } else if (command === 'fail') {
    const file = manifestPath(need(args, 'manifest'));
    const manifest = readJson(file);
    const code = need(args, 'code');
    manifest.status = code === 'ERR_FRESH_CONTEXT_UNAVAILABLE' ? 'not_run' : 'incomplete';
    manifest.error = { code, message: String(args.message || code) };
    manifest.updated_at = new Date().toISOString();
    writeJson(file, manifest);
    console.log(JSON.stringify({ ok: true, status: manifest.status, code }));
  } else if (command === 'record') {
    const file = manifestPath(need(args, 'manifest'));
    const manifest = readJson(file);
    assertCurrentTarget(manifest);
    const stage = selectedStage(manifest, need(args, 'stage'));
    const reviewers = list(args.reviewer).sort();
    if (JSON.stringify([...stage.expected_reviewers].sort()) !== JSON.stringify(reviewers)) fail('ERR_REVIEWER_MISMATCH', stage.id);
    const report = resolveInside(manifest.root, need(args, 'report'));
    if (!fs.existsSync(report) || fs.statSync(report).size === 0) fail('ERR_MISSING_REPORT', relative(manifest.root, report));
    stage.reviewers = reviewers;
    stage.report = relative(manifest.root, report);
    stage.status = 'completed';
    stage.completed_at = new Date().toISOString();
    writeJson(file, manifest);
    console.log(JSON.stringify({ ok: true, stage: stage.id, status: stage.status }));
  } else if (command === 'seal') {
    const file = manifestPath(need(args, 'manifest'));
    const manifest = readJson(file);
    manifest.__file = file;
    assertCurrentTarget(manifest);
    validateComplete(manifest);
    const status = need(args, 'status');
    if (!['passed', 'changes_required'].includes(status)) fail('ERR_INVALID_STATUS', status);
    const declared = Number(need(args, 'open-findings'));
    if (!Number.isInteger(declared) || declared < 0) fail('ERR_INVALID_FINDING_COUNT', String(args['open-findings']));
    let backlog = args['backlog-nits'] === undefined ? null : Number(args['backlog-nits']);
    if (backlog !== null && (!Number.isInteger(backlog) || backlog < 0)) fail('ERR_INVALID_FINDING_COUNT', 'backlog-nits must be a non-negative integer');

    let open = declared;
    if (args.findings && args.findings !== true) {
      const ledger = loadLedger(String(args.findings), manifest);
      if (ledger.openFindings !== declared) {
        fail('ERR_FINDINGS_MISMATCH', `--open-findings ${declared} but ledger counts ${ledger.openFindings} open Blocker/Major`);
      }
      manifest.ledger_file = ledger.file;
      manifest.finding_counts = {
        total: ledger.findings.length,
        blocker: ledger.findings.filter((f) => f.severity === 'Blocker').length,
        major: ledger.findings.filter((f) => f.severity === 'Major').length,
        nit: ledger.findings.filter((f) => f.severity === 'Nit').length,
        open: ledger.openFindings,
      };
      if (backlog === null) backlog = ledger.nitBacklog;
      const stalls = stalledMechanisms(ledger.findings, priorLedgers(manifest, args.histories), manifest);
      const accepted = list(args['accept-mechanism']).map(String);
      const unaccepted = stalls.filter((s) => !accepted.includes(s.mechanism));
      manifest.mechanism_stalls = stalls.map((s) => ({ ...s, accepted: accepted.includes(s.mechanism) }));
      if (unaccepted.length > 0) {
        fail('ERR_MECHANISM_STALLED', `mechanism(s) open in two consecutive rounds: ${unaccepted.map((s) => s.mechanism + ' (' + s.finding + ')').join(', ')}; close the whole mechanism or pass --accept-mechanism <slug> --reason "<why>"`);
      }
      if (unaccepted.length === 0 && accepted.length > 0) {
        manifest.mechanism_acceptance_reason = String(args.reason || '');
      }
    }
    if (status === 'passed' && open !== 0) fail('ERR_OPEN_FINDINGS', 'passed requires zero open Blockers/Majors');
    if (status === 'changes_required' && open === 0) fail('ERR_OPEN_FINDINGS', 'changes_required requires open findings');
    manifest.status = status;
    manifest.open_findings = open;
    manifest.backlog_nits = backlog === null ? 0 : backlog;
    manifest.error = null;
    manifest.sealed_at = new Date().toISOString();
    writeJson(file, manifest);
    console.log(JSON.stringify({ ok: true, status, open_findings: open, backlog_nits: manifest.backlog_nits, ledger: manifest.ledger_file, stalls: manifest.mechanism_stalls.length }));
  } else if (command === 'status') {
    const root = path.resolve(need(args, 'root'));
    const roundsDir = path.resolve(need(args, 'rounds'));
    const targetHash = args.target && args.target !== true ? hashFile(resolveInside(root, String(args.target))) : null;
    if (!fs.existsSync(roundsDir)) fail('ERR_MISSING_ROUNDS', String(args.rounds));
    const rows = [];
    for (const entry of fs.readdirSync(roundsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestFile = path.join(roundsDir, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestFile)) continue;
      let manifest;
      try { manifest = readJson(manifestFile); } catch { continue; }
      rows.push({
        round: entry.name,
        profile: manifest.profile,
        status: manifest.status,
        target_sha256: manifest.target_sha256,
        open_findings: manifest.open_findings,
        backlog_nits: manifest.backlog_nits,
        ledger: manifest.ledger_file || null,
        stalls: (manifest.mechanism_stalls || []).length,
        created_at: manifest.created_at,
        sealed_at: manifest.sealed_at || null,
      });
    }
    rows.sort((a, b) => a.round.localeCompare(b.round, undefined, { numeric: true }));
    const sealedPassed = rows.filter((r) => r.status === 'passed').map((r) => r.round);
    const inFlight = rows.filter((r) => ['in_progress', 'incomplete', 'not_run'].includes(r.status)).map((r) => r.round);
    const duplicateHashes = Object.entries(rows.reduce((acc, r) => { (acc[r.target_sha256] ||= []).push(r.round); return acc; }, {})).filter(([, v]) => v.length > 1).map(([hash, rounds]) => ({ hash: hash.slice(0, 12), rounds }));
    const latest = rows[rows.length - 1] || null;
    const boundToCurrent = targetHash === null ? null : rows.some((r) => r.target_sha256 === targetHash);
    const report = {
      ok: true,
      rounds: rows,
      summary: {
        total: rows.length,
        passed: sealedPassed,
        in_flight: inFlight,
        duplicate_hashes: duplicateHashes,
        latest_round: latest && latest.round,
        latest_target_matches_current: targetHash === null ? 'not_checked' : boundToCurrent,
      },
      next: sealedPassed.length > 0 ? 'sealed' : (targetHash !== null && boundToCurrent ? 'resume: a round already binds the current target hash' : 'new_round'),
    };
    if (args.out && args.out !== true) fs.writeFileSync(path.resolve(root, String(args.out)), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } else if (command === 'verify') {
    const file = manifestPath(need(args, 'manifest'));
    const manifest = readJson(file);
    assertCurrentTarget(manifest);
    validateComplete(manifest);
    if (manifest.status !== 'passed') fail('ERR_REVIEW_NOT_PASSED', manifest.status);
    console.log(JSON.stringify({ ok: true, status: 'valid', target: manifest.target, target_sha256: manifest.target_sha256, ledger: manifest.ledger_file || null }));
  } else {
    fail('ERR_USAGE', 'Use init, fail, record, seal, status, or verify');
  }
} catch (error) {
  fail('ERR_EXECUTION', error instanceof Error ? error.message : String(error));
}
