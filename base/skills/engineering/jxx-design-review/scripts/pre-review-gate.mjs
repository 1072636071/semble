#!/usr/bin/env node
// Deterministic pre-review gate for jxx-design-review. Run before `design-review.mjs init`.
// Checks: C1 AC cross-refs, C2 ticket refs, C3 file:line citations, C4 version sync,
// C5 sidecar staleness, C6 stale phrases (config), C7 SQL probe (optional).
// Exit: 0 = pass (warns allowed), 1 = findings, 2 = usage error.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const PRUNE = new Set(['node_modules', '.git', 'dist', '.temp', '.astro', 'coverage', '.next', 'out', 'wt']);
const CODE_EXT = /\.(astro|ts|tsx|mjs|cjs|js|jsx|json|md|xml|css|sql|yml|yaml|html|txt|lock)$/i;
const CITE_EXT = 'astro|ts|tsx|mjs|cjs|js|jsx|json|md|xml|css|sql|yml|yaml|html|txt|lock';

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
function list(v) { return v === undefined ? [] : Array.isArray(v) ? v : [v]; }
function usage(message) { console.error(JSON.stringify({ ok: false, code: 'ERR_USAGE', message })); process.exit(2); }
function rel(root, file) { return path.relative(root, file).split(path.sep).join('/'); }
function readLines(file) { return fs.readFileSync(file, 'utf8').split('\n'); }

const args = argsOf(process.argv.slice(2));
if (!args.root || args.root === true) usage('Missing --root');
if (!args.target || args.target === true) usage('Missing --target');
const root = path.resolve(String(args.root));
const target = path.resolve(root, String(args.target));
if (!fs.existsSync(target) || !fs.statSync(target).isFile()) usage(`Target not found: ${args.target}`);
const targetDir = path.dirname(target);

const config = {};
const configFile = args.config && args.config !== true ? path.resolve(root, String(args.config)) : path.join(targetDir, 'gate-config.json');
if (fs.existsSync(configFile)) {
  try { Object.assign(config, JSON.parse(fs.readFileSync(configFile, 'utf8'))); }
  catch (e) { usage(`Invalid config ${configFile}: ${e.message}`); }
}

// ---- document set ----
const ticketsDir = args.tickets && args.tickets !== true ? path.resolve(root, String(args.tickets)) : path.join(targetDir, 'issues');
const ticketFiles = fs.existsSync(ticketsDir)
  ? fs.readdirSync(ticketsDir).filter((f) => /^\d{2}-.*\.md$/.test(f)).sort().map((f) => path.join(ticketsDir, f))
  : [];
const ticketByNo = new Map(ticketFiles.map((f) => [path.basename(f).slice(0, 2), f]));
const mapFile = args.map && args.map !== true ? path.resolve(root, String(args.map)) : path.join(targetDir, 'map.md');
const humanCheck = path.join(targetDir, 'HUMAN-CHECK.md');
const docs = [target, ...ticketFiles];
if (fs.existsSync(mapFile)) docs.push(mapFile);
if (fs.existsSync(humanCheck)) docs.push(humanCheck);
for (const extra of list(args.extra)) {
  const f = path.resolve(root, String(extra));
  if (fs.existsSync(f) && fs.statSync(f).isFile()) docs.push(f);
}
const docLines = new Map(docs.map((f) => [f, readLines(f)]));
const isTicket = (f) => ticketFiles.includes(f);
const defaultSpace = (f) => (isTicket(f) ? f : target);

const checks = [];
function addCheck(id, name, status, findings) { checks.push({ id, name, status, findings }); }
function finding(severity, file, line, message) { return { severity, file: rel(root, file), line, message }; }

// ---- C1: AC cross-references ----
const defined = new Map();
for (const f of docs) {
  const set = new Set();
  const dup = [];
  docLines.get(f).forEach((text, i) => {
    const m = text.match(/(?:^|\s)- \[[ xX]\] AC-(\d+)/) || text.match(/^\|\s*AC-(\d+)\s*\|/) || text.match(/^\s*\*{0,2}AC-(\d+)\*{0,2}[:：]/);
    if (m) { const id = Number(m[1]); if (set.has(id)) dup.push(finding('fail', f, i + 1, `AC-${id} defined twice`)); set.add(id); }
  });
  defined.set(f, set);
  if (dup.length) addCheck('C1', 'ac-refs', 'fail', dup);
}
const acFindings = [];
const REF = /(工单\s*(\d{2})\s*|PRD\s*|本单\s*|该族\s*)?AC-(\d+)((?:\s*[\/、，,]\s*(?:AC-)?\d+)*)(?:\s*[…–]\s*(\d+))?/g;
for (const f of docs) {
  docLines.get(f).forEach((text, i) => {
    REF.lastIndex = 0;
    let m;
    while ((m = REF.exec(text)) !== null) {
      const [, qualifier, ticketNo, first, chain, rangeEnd] = m;
      const ids = [Number(first)];
      if (chain) for (const c of chain.matchAll(/(\d+)/g)) ids.push(Number(c[1]));
      else if (rangeEnd) for (let n = Number(first) + 1; n <= Number(rangeEnd); n++) ids.push(n);
      let space;
      if (ticketNo) space = ticketByNo.get(ticketNo);
      else if (qualifier && qualifier.trim() === 'PRD') space = target;
      else if (qualifier && /^(本单|该族)/.test(qualifier.trim())) space = f;
      else {
        const lineTicket = text.match(/工单\s*(\d{2})/);
        space = lineTicket && isTicket(f) === false && f !== target ? ticketByNo.get(lineTicket[1]) : defaultSpace(f);
        if (lineTicket && f === mapFile) space = ticketByNo.get(lineTicket[1]) || target;
      }
      if (!space) { acFindings.push(finding('fail', f, i + 1, `reference to unknown ticket 工单 ${ticketNo}`)); continue; }
      for (const id of ids) {
        if (defined.get(space)?.has(id)) continue;
        // Tickets may reference PRD-level ACs unqualified (039 convention); PRD->ticket refs must be qualified.
        if (isTicket(f) && !qualifier && defined.get(target)?.has(id)) continue;
        if (f === mapFile && !qualifier && [...defined.values()].some((s) => s.has(id))) continue;
        const hint = !qualifier && f === target && [...ticketFiles].some((t) => defined.get(t)?.has(id))
          ? ' (cross-space ref must be qualified as 工单 NN AC-M)' : '';
        acFindings.push(finding('fail', f, i + 1, `AC-${id} not defined in ${rel(root, space)}${hint}`));
      }
    }
  });
}
addCheck('C1', 'ac-refs', acFindings.length ? 'fail' : 'pass', acFindings);

// ---- C2: ticket references ----
const ticketFindings = [];
for (const f of docs) {
  docLines.get(f).forEach((text, i) => {
    for (const m of text.matchAll(/工单\s*(\d{2})/g)) {
      if (!ticketByNo.has(m[1])) ticketFindings.push(finding('fail', f, i + 1, `工单 ${m[1]} has no ticket file in ${rel(root, ticketsDir)}`));
    }
  });
}
addCheck('C2', 'ticket-refs', ticketFindings.length ? 'fail' : 'pass', ticketFindings);

// ---- C3: file:line citation validity ----
const extraRoots = list(args['extra-root']).map((r) => path.resolve(String(r)));
const index = new Map();
function walk(dir, rootTag) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!PRUNE.has(e.name)) walk(path.join(dir, e.name), rootTag); }
    else if (CODE_EXT.test(e.name)) {
      const full = path.join(dir, e.name);
      const arr = index.get(e.name) || [];
      arr.push({ full, tag: rootTag });
      index.set(e.name, arr);
    }
  }
}
walk(root, rel(root, root) || '.');
for (const r of extraRoots) walk(r, path.basename(r));
const lineCountCache = new Map();
function lineCount(file) {
  if (!lineCountCache.has(file)) lineCountCache.set(file, readLines(file).length);
  return lineCountCache.get(file);
}
const citeFindings = [];
const CITE = new RegExp(`([A-Za-z0-9_@.\\[\\]/-]+\\.(?:${CITE_EXT})):(\\d+)(?:\\s*[-–]\\s*(\\d+))?`, 'g');
const citeIgnore = list(config.citationIgnore).map((p) => new RegExp(p));
for (const f of docs) {
  docLines.get(f).forEach((text, i) => {
    CITE.lastIndex = 0;
    let m;
    while ((m = CITE.exec(text)) !== null) {
      const [, cite, startRaw, endRaw] = m;
      if (/https?:$/.test(text.slice(Math.max(0, m.index - 6), m.index))) continue;
      if (citeIgnore.some((re) => re.test(cite))) continue;
      const start = Number(startRaw);
      const end = endRaw ? Number(endRaw) : start;
      const base = path.basename(cite);
      let candidates = index.get(base) || [];
      if (cite.includes('/')) candidates = candidates.filter((c) => c.full.split(path.sep).join('/').endsWith(cite));
      if (candidates.length === 0) {
        citeFindings.push(finding('fail', f, i + 1, `citation ${cite}:${startRaw}${endRaw ? '-' + endRaw : ''} — file not found in indexed roots`));
      } else if (candidates.length > 1) {
        citeFindings.push(finding('warn', f, i + 1, `citation ${cite} ambiguous (${candidates.length} matches, e.g. ${candidates.slice(0, 3).map((c) => rel(root, c.full)).join(', ')})`));
      } else if (end > lineCount(candidates[0].full)) {
        citeFindings.push(finding('fail', f, i + 1, `citation ${cite}:${startRaw}-${endRaw} exceeds file length (${lineCount(candidates[0].full)} lines)`));
      }
    }
  });
}
addCheck('C3', 'citations', citeFindings.some((x) => x.severity === 'fail') ? 'fail' : 'pass', citeFindings);

// ---- C4: version marker sync ----
function versionOf(f) {
  const lines = docLines.get(f) || readLines(f);
  for (const text of lines) {
    const m = text.match(/^Version[:：]\s*(?:对齐\s*PRD\s*)?(v?\d+\.\d+)/i) || text.match(/^#\s.*?(v\d+\.\d+)/);
    if (m) return 'v' + m[1].replace(/^v/, '');
  }
  return null;
}
const versionFiles = [target, ...ticketFiles];
if (fs.existsSync(mapFile)) versionFiles.push(mapFile);
if (fs.existsSync(humanCheck)) versionFiles.push(humanCheck);
for (const vf of list(config.versionFiles)) {
  const f = path.resolve(root, String(vf));
  if (fs.existsSync(f) && !versionFiles.includes(f)) { versionFiles.push(f); docLines.set(f, readLines(f)); }
}
const expected = versionOf(target);
const versionFindings = [];
if (expected) {
  for (const f of versionFiles) {
    const v = versionOf(f);
    if (v && v !== expected) versionFindings.push(finding('fail', f, 1, `version marker ${v} != target ${expected}`));
  }
}
addCheck('C4', 'version-sync', versionFindings.length ? 'fail' : 'pass', versionFindings);

// ---- C5: sidecar staleness ----
const sidecarFindings = [];
const sidecars = config.sidecars || [
  { file: '.acmap.json', type: 'acmap' },
  { file: '.acrows.txt', type: 'acrows' },
];
const targetACs = defined.get(target) || new Set();
for (const sc of sidecars) {
  const f = path.resolve(targetDir, String(sc.file));
  if (!fs.existsSync(f)) continue;
  if (sc.type === 'acmap') {
    let keys;
    try { keys = Object.keys(JSON.parse(fs.readFileSync(f, 'utf8'))).map((k) => Number(k.replace(/^AC-/, ''))); }
    catch { sidecarFindings.push(finding('fail', f, 1, 'acmap is not valid JSON')); continue; }
    const missing = [...targetACs].filter((id) => !keys.includes(id));
    const extra = keys.filter((id) => !targetACs.has(id));
    if (missing.length) sidecarFindings.push(finding('fail', f, 1, `acmap missing AC ids: ${missing.join(',')}`));
    if (extra.length) sidecarFindings.push(finding('fail', f, 1, `acmap has stale AC ids: ${extra.join(',')}`));
  } else if (sc.type === 'acrows') {
    const rows = readLines(f).filter((l) => l.trim()).length;
    if (rows !== targetACs.size) sidecarFindings.push(finding('fail', f, 1, `acrows has ${rows} rows, target defines ${targetACs.size} ACs`));
  }
}
addCheck('C5', 'sidecars', sidecarFindings.length ? 'fail' : 'pass', sidecarFindings);

// ---- C8/C9: phase boundary table (opt-in via config.boundary) ----
// Phases name deliverables and the phase that gates them. Two defect classes are fully
// deterministic once that table exists, and both were historically found by hand late:
//  - C8 deliverable-not-carried: an AC names evidence file the boundary table never assigns
//    to any phase, or a phase gate requires an AC no phase owns.
//  - C9 phase-order: an AC is gated at phase Pn while its evidence file is only created in a
//    later phase, so Pn can never pass.
function phaseTable() {
  const cfg = config.boundary;
  if (!cfg || !Array.isArray(cfg.phases)) return null;
  const order = cfg.phases.map(String);
  const boundary = new Map();
  for (const row of docLines.get(target) || []) {
    const m = row.match(cfg.rowPattern ? new RegExp(cfg.rowPattern) : /^\|\s*(P[0-9]+[a-z]?)\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|/);
    if (!m) continue;
    const key = cfg.basename === false ? m[3] : path.basename(m[3]);
    if (!boundary.has(key)) boundary.set(key, []);
    boundary.get(key).push({ phase: m[1], action: m[2], full: m[3] });
  }
  return { order, boundary };
}
const phaseFindings = [];
const table = phaseTable();
if (table) {
  const acLine = new Map();
  (docLines.get(target) || []).forEach((text, i) => {
    const m = text.match(/^\s*- \[ \] AC-(\d+)/);
    if (m) acLine.set(Number(m[1]), i + 1);
  });
  const testRefs = (lineText) => [...lineText.matchAll(/`([\w./-]+\.test\.(?:js|mjs)|test_[\w]+\.py)(?:::[\w]+)?`/g)].map((m) => path.basename(m[1]));
  const rankOf = (phase) => table.order.indexOf(String(phase));
  // C8: every AC's evidence file must be owned by some phase.
  const c8 = [];
  for (const [id, line] of acLine) {
    for (const ref of testRefs(docLines.get(target)[line - 1] || '')) {
      if (!table.boundary.has(ref)) c8.push(finding('fail', target, line, `AC-${id} evidence ${ref} is not assigned to any phase in the boundary table`));
    }
  }
  // C9: an AC gated at phase P must not depend on evidence created only in a later phase.
  const gatePhaseFor = new Map();
  const partialAt = new Set(); // `${phase}#${id}` — AC gated only partially at that phase (本地部分/服务器部分)
  const gateRows = Array.isArray(config.boundary.gates)
    ? config.boundary.gates.map((g) => ({ phase: String(g.phase), acs: String(g.acs || ''), line: 0 }))
    : (docLines.get(target) || []).flatMap((text, i) => {
        const m = text.match(config.boundary.gateRowPattern ? new RegExp(config.boundary.gateRowPattern) : /^\|\s*(P[0-9]+[a-z]?)\s*\|\s*`npm[^`]*`\s*\|\s*([^|]+)\|/);
        return m ? [{ phase: m[1], acs: m[2], line: i + 1 }] : [];
      });
  for (const gate of gateRows) {
    const phase = gate.phase;
    for (const m of gate.acs.matchAll(/(\d+)(?:\s*[～~-]\s*(\d+))?\s*(本地部分|服务器部分|local 部分|server 部分|局部|部分)?/g)) {
      const a = Number(m[1]);
      const b = m[2] ? Number(m[2]) : a;
      for (let n = a; n <= b; n++) {
        if (!gatePhaseFor.has(n)) gatePhaseFor.set(n, phase);
        if (m[3]) partialAt.add(phase + '#' + n);
      }
    }
  }
  const c9 = [];
  for (const [id, phase] of gatePhaseFor) {
    if (partialAt.has(phase + '#' + id)) continue; // AC gated only in part at this phase; its other parts gate later by design
    const line = acLine.get(id);
    if (!line) continue;
    for (const ref of testRefs(docLines.get(target)[line - 1] || '')) {
      const owners = table.boundary.get(ref) || [];
      const created = owners.find((o) => /^create$/i.test(o.action));
      if (!created) continue;
      if (rankOf(created.phase) > rankOf(phase)) {
        c9.push(finding('fail', target, line, `AC-${id} is gated at ${phase} but its evidence ${ref} is only created at ${created.phase}`));
      }
    }
  }
  const all = [...c8, ...c9];
  addCheck('C8', 'deliverable-carried', c8.length ? 'fail' : 'pass', c8);
  addCheck('C9', 'phase-order', c9.length ? 'fail' : 'pass', c9);
  if (all.length === 0) phaseFindings.push(finding('info', target, 1, `${acLine.size} ACs and ${table.boundary.size} boundary rows agree`));
} else {
  addCheck('C8', 'deliverable-carried', 'skip', [finding('info', target, 1, 'config.boundary absent; phase checks skipped')]);
  addCheck('C9', 'phase-order', 'skip', []);
}

// ---- C6: stale phrases ----
const staleFindings = [];
for (const sp of list(config.stalePatterns)) {
  let re;
  try { re = new RegExp(sp.pattern, sp.flags || 'g'); }
  catch (e) { usage(`Invalid stalePattern ${sp.pattern}: ${e.message}`); }
  const scope = sp.scope || 'all';
  for (const f of docs) {
    if (scope === 'target' && f !== target) continue;
    if (scope === 'tickets' && !isTicket(f)) continue;
    if (scope === 'map' && f !== mapFile) continue;
    docLines.get(f).forEach((text, i) => {
      re.lastIndex = 0;
      if (re.test(text)) staleFindings.push(finding('fail', f, i + 1, `stale phrase /${sp.pattern}/ — ${sp.reason || 'superseded by triage'}`));
    });
  }
}
addCheck('C6', 'stale-patterns', staleFindings.length ? 'fail' : 'pass', staleFindings);

// ---- C7: SQL probe (optional) ----
async function sqlProbe() {
  if (!args['sql-probe'] || args['sql-probe'] === true) { addCheck('C7', 'sql-probe', 'skip', []); return; }
  const probeFile = path.resolve(root, String(args['sql-probe']));
  if (!fs.existsSync(probeFile)) { addCheck('C7', 'sql-probe', 'skip', [finding('warn', probeFile, 1, 'probe file not found')]); return; }
  const dbUrl = args['db-url'] && args['db-url'] !== true ? String(args['db-url']) : process.env.BLOG_TEST_DATABASE_URL;
  if (!dbUrl) { addCheck('C7', 'sql-probe', 'skip', [finding('warn', probeFile, 1, 'no --db-url or BLOG_TEST_DATABASE_URL; probe skipped')]); return; }
  const backendRoot = args['backend-root'] && args['backend-root'] !== true ? path.resolve(String(args['backend-root'])) : extraRoots[0] || root;
  let mysql;
  try { mysql = createRequire(path.join(backendRoot, 'package.json'))('mysql2/promise'); }
  catch { addCheck('C7', 'sql-probe', 'skip', [finding('warn', probeFile, 1, `mysql2 not resolvable from ${backendRoot}`)]); return; }
  const raw = fs.readFileSync(probeFile, 'utf8').replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const stmts = raw.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
  const findings = [];
  let conn;
  try {
    conn = await mysql.createConnection({ uri: dbUrl, connectTimeout: 8000 });
    for (const stmt of stmts) {
      const head = stmt.split(/\s+/)[0].toUpperCase();
      let run;
      if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'].includes(head)) run = 'EXPLAIN ' + stmt;
      else if (['SHOW', 'EXPLAIN'].includes(head)) run = stmt;
      else { findings.push(finding('warn', probeFile, 1, `unsupported probe statement (${head}); skipped`)); continue; }
      try { await conn.query(run); }
      catch (e) { findings.push(finding('fail', probeFile, 1, `SQL probe failed: ${e.message} — statement: ${stmt.slice(0, 120)}`)); }
    }
  } catch (e) {
    findings.push(finding('fail', probeFile, 1, `probe connection failed: ${e.message}`));
  } finally { if (conn) await conn.end().catch(() => {}); }
  addCheck('C7', 'sql-probe', findings.some((x) => x.severity === 'fail') ? 'fail' : 'pass', findings);
}

await sqlProbe();

const failCount = checks.reduce((n, c) => n + c.findings.filter((x) => x.severity === 'fail').length, 0);
const warnCount = checks.reduce((n, c) => n + c.findings.filter((x) => x.severity === 'warn').length, 0);
const report = { ok: failCount === 0, root: rel(root, root) || '.', target: rel(root, target), checks, summary: { fail: failCount, warn: warnCount } };
if (args.out && args.out !== true) fs.writeFileSync(path.resolve(root, String(args.out)), JSON.stringify(report, null, 2) + '\n');
if (args.json) {
  console.log(JSON.stringify(report));
} else {
  for (const c of checks) {
    console.log(`[${c.id} ${c.name}] ${c.status.toUpperCase()} (${c.findings.length} findings)`);
    for (const x of c.findings) console.log(`  ${x.severity.toUpperCase()} ${x.file}:${x.line} ${x.message}`);
  }
  console.log(failCount === 0 ? `GATE PASS (warns: ${warnCount})` : `GATE FAIL (fail: ${failCount}, warns: ${warnCount})`);
}
process.exit(failCount === 0 ? 0 : 1);