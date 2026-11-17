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
    fs.mkdirSync(output, { recursive: true });
    const manifest = {
      schema_version: 1,
      skill: 'jxx-design-review',
      root,
      target: relative(root, target),
      target_sha256: hashFile(target),
      profile,
      status: 'in_progress',
      isolation: 'fresh-context',
      host_instruction_isolation: 'unverified',
      context_files: contexts,
      downgrade,
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
    console.log(JSON.stringify({ ok: true, manifest: manifestFile, stages: manifest.stages.length }));
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
    assertCurrentTarget(manifest);
    validateComplete(manifest);
    const status = need(args, 'status');
    const open = Number(need(args, 'open-findings'));
    if (!Number.isInteger(open) || open < 0) fail('ERR_INVALID_FINDING_COUNT', String(args['open-findings']));
    if (status === 'passed' && open !== 0) fail('ERR_OPEN_FINDINGS', 'passed requires zero open findings');
    if (status === 'changes_required' && open === 0) fail('ERR_OPEN_FINDINGS', 'changes_required requires open findings');
    if (!['passed', 'changes_required'].includes(status)) fail('ERR_INVALID_STATUS', status);
    const backlog = args['backlog-nits'] === undefined ? 0 : Number(args['backlog-nits']);
    if (!Number.isInteger(backlog) || backlog < 0) fail('ERR_INVALID_FINDING_COUNT', 'backlog-nits must be a non-negative integer');
    manifest.status = status;
    manifest.open_findings = open;
    manifest.backlog_nits = backlog;
    manifest.error = null;
    manifest.sealed_at = new Date().toISOString();
    writeJson(file, manifest);
    console.log(JSON.stringify({ ok: true, status, open_findings: open }));
  } else if (command === 'verify') {
    const file = manifestPath(need(args, 'manifest'));
    const manifest = readJson(file);
    assertCurrentTarget(manifest);
    validateComplete(manifest);
    if (manifest.status !== 'passed') fail('ERR_REVIEW_NOT_PASSED', manifest.status);
    console.log(JSON.stringify({ ok: true, status: 'valid', target: manifest.target, target_sha256: manifest.target_sha256 }));
  } else {
    fail('ERR_USAGE', 'Use init, fail, record, seal, or verify');
  }
} catch (error) {
  fail('ERR_EXECUTION', error instanceof Error ? error.message : String(error));
}
