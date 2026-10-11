#!/usr/bin/env node
// studio-config-verify.mjs — POST 后验证。零依赖、只读（只 GET，不写）。
// GET live 与期望文件深相等比对；bindings 与备份逐字未动；列出新增/改动条目；可选错字扫描。
// —— 共享小工具（每个脚本自带一份，保持零依赖、单文件可跑）——
function parseArgs(argv, usage) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { console.log(usage); process.exit(0); }
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { args[a] = next; i++; }
      else args[a] = true;
    } else args._.push(a);
  }
  return args;
}
function normalizeOrigin(origin) {
  return String(origin).replace(/\/+$/, '');
}
function checkUrlAllowed(url) {
  const u = new URL(url);
  const host = u.hostname;
  const loopback = host === 'localhost' || host === '[::1]' || /^127\./.test(host);
  if (!loopback) {
    console.error('拒绝：目标主机不是回环地址（' + host + '）。本脚本只允许操作本机 studio（localhost / [::1] / 127.x.x.x）。');
    process.exit(4);
  }
}
async function studioFetch(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = { ok: false, error: '响应不是 JSON：' + text.slice(0, 200) }; }
  return { status: res.status, body, text };
}
function writeUtf8NoBom(path, text) {
  // 统一 LF、UTF-8 无 BOM（Windows 坑自守）
  fs.writeFileSync(path, text.replace(/\r\n/g, '\n'), 'utf8');
}
function countPools(config) {
  const out = {};
  out.agents = (config.agents || []).length;
  out.promptSets = (config.promptSets || []).length;
  out.toolSets = (config.toolSets || []).length;
  out.skillSets = (config.skillSets || []).length;
  out.bindings = (config.bindings && Array.isArray(config.bindings.presets)) ? config.bindings.presets.length : 0;
  out.runtimeContextOff = Array.isArray(config.runtimeContextOff) ? config.runtimeContextOff.length : 0;
  return out;
}
import fs from 'node:fs';
import path from 'node:path';

const USAGE = [
  '用法: node studio-config-verify.mjs <proposed.json> [--origin http://127.0.0.1:3080] [--backup backup.json] [--typo-scan]',
  '',
  'POST 之后的回读对拍（POST 成功 ≠ 内容对，坑②）:',
  '  1. GET /config 的 live.config 与 proposed（剥壳后）深相等？',
  '  2. bindings.presets 与操作前备份逐字未动？（未传 --backup 则跳过该项并提示）',
  '  3. 新增/改动条目清单（相对备份）。',
  '  --typo-scan  对 live 的段名/工具名/技能名做常见错字启发式扫描（首尾空白、全角字符、工具名含空白）。',
  '退出码：0=全部通过，1=有失败项。',
].join('\n');

const args = parseArgs(process.argv.slice(2), USAGE);
const file = args._[0];
if (!file) { console.error(USAGE); console.error('缺少 <proposed.json>'); process.exit(2); }
const origin = normalizeOrigin(args['--origin'] || 'http://127.0.0.1:3080');
checkUrlAllowed(origin);

function unwrap(x) { return x && typeof x === 'object' && 'config' in x && !('agents' in x) ? x.config : x; }
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; return a.every((v, i) => deepEqual(v, b[i])); }
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

const proposed = unwrap(JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')));
const { status, body } = await studioFetch(origin + '/api/dsh-agent-studio/config', { method: 'GET', headers: { Origin: origin } });
if (status !== 200 || !body || body.ok !== true) { console.error('GET live 失败: HTTP ' + status + ' ' + JSON.stringify(body).slice(0, 200)); process.exit(1); }
const live = body.config || {};

const failures = [];

// 1. live vs proposed 深相等（逐池报差异位置）
for (const pool of ['agents', 'promptSets', 'toolSets', 'skillSets', 'runtimeContextOff', 'bindings']) {
  const lv = live[pool], pv = proposed[pool];
  if (pv === undefined) continue; // 没发=没参与
  if (deepEqual(lv ?? null, pv)) console.log('PASS ' + pool + '（live 与期望一致）');
  else {
    failures.push(pool);
    console.log('FAIL ' + pool + '（live 与期望不一致）');
    if (Array.isArray(pv) && Array.isArray(lv ?? [])) {
      const ids = (arr) => (arr || []).map((x) => (x && x.id) || '?');
      const onlyLive = ids(lv).filter((x) => !ids(pv).includes(x));
      const onlyProp = ids(pv).filter((x) => !ids(lv).includes(x));
      if (onlyLive.length) console.log('   仅 live 有: ' + JSON.stringify(onlyLive));
      if (onlyProp.length) console.log('   仅期望有: ' + JSON.stringify(onlyProp));
    } else if (pool === 'bindings') {
      console.log('   live.bindings.presets = ' + JSON.stringify((lv && lv.presets) || []));
      console.log('   期望 bindings.presets = ' + JSON.stringify((pv && pv.presets) || []));
    } else {
      console.log('   live = ' + JSON.stringify(lv) + '  期望 = ' + JSON.stringify(pv));
    }
  }
}

// 2. bindings 与备份逐字未动
let backupCfg = null;
if (args['--backup']) {
  try { backupCfg = unwrap(JSON.parse(fs.readFileSync(path.resolve(args['--backup']), 'utf8'))); }
  catch (e) { console.error('备份读不了: ' + e.message); process.exit(2); }
  const bBefore = JSON.stringify((backupCfg.bindings && backupCfg.bindings.presets) || []);
  const bLive = JSON.stringify((live.bindings && live.bindings.presets) || []);
  if (bBefore === bLive) console.log('PASS bindings 与备份逐字一致（' + ((backupCfg.bindings && backupCfg.bindings.presets) || []).length + ' 条未动）');
  else { failures.push('bindings-vs-backup'); console.log('FAIL bindings 与备份不一致！\n   备份 = ' + bBefore + '\n   live  = ' + bLive); }
} else {
  console.log('SKIP bindings-vs-backup（未给 --backup；强建议带上操作前备份）');
}

// 3. 新增/改动条目（相对备份）
if (backupCfg) {
  console.log('相对备份的变化:');
  for (const pool of ['agents', 'promptSets', 'toolSets', 'skillSets']) {
    const before = backupCfg[pool] || [], after = live[pool] || [];
    const byId = (arr) => new Map(arr.map((x) => [x.id, JSON.stringify(x)]));
    const mb = byId(before), ma = byId(after);
    const added = [...ma.keys()].filter((k) => !mb.has(k));
    const removed = [...mb.keys()].filter((k) => !ma.has(k));
    const changed = [...ma.keys()].filter((k) => mb.has(k) && mb.get(k) !== ma.get(k));
    if (added.length) console.log('   ' + pool + ' 新增: ' + JSON.stringify(added));
    if (removed.length) console.log('   ' + pool + ' 删除: ' + JSON.stringify(removed));
    if (changed.length) console.log('   ' + pool + ' 改动: ' + JSON.stringify(changed));
  }
  const bb = (backupCfg.bindings && backupCfg.bindings.presets) || [];
  const ba = (live.bindings && live.bindings.presets) || [];
  const bDiff = JSON.stringify(bb) !== JSON.stringify(ba);
  console.log('   bindings: ' + (bDiff ? '有变化（若非有意绑定/解绑，这是事故）' : '无变化'));
}

// 4. 可选错字扫描
if (args['--typo-scan']) {
  const issues = [];
  const scanName = (where, s) => {
    if (typeof s !== 'string') return;
    if (s !== s.trim()) issues.push(where + ': 名字带首尾空白「' + s + '」');
    if (/[\uFF01-\uFF5E]/.test(s)) issues.push(where + ': 名字含全角字符「' + s + '」');
    if (/\s/.test(s) && s.includes('__')) issues.push(where + ': 工具名风格却含空白「' + s + '」');
  };
  for (const a of live.agents || []) {
    scanName('agents[' + a.id + '].id', a.id);
    for (const t of a.toolSets || []) scanName('agents[' + a.id + '].toolSets', t);
    for (const p of a.promptSets || []) scanName('agents[' + a.id + '].promptSets', p);
    for (const s of a.skillSets || []) scanName('agents[' + a.id + '].skillSets', s);
  }
  for (const s of live.toolSets || []) for (const t of s.tools || []) scanName('toolSets[' + s.id + ']', t);
  for (const s of live.skillSets || []) for (const t of s.skills || []) scanName('skillSets[' + s.id + ']', t);
  if (issues.length) { console.log('错字扫描（启发式）发现 ' + issues.length + ' 处疑似问题:'); issues.forEach((x) => console.log('   ' + x)); }
  else console.log('错字扫描（启发式）: 未发现疑似问题');
}

if (failures.length) { console.log('\n结论: FAIL（' + failures.join(', ') + '）——回滚见 studio-config-rollback.mjs。'); process.exit(1); }
console.log('\n结论: PASS。再按 workflows §验证 新开会话逐面核对（脚本对不了语义）。');
