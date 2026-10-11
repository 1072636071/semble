#!/usr/bin/env node
// studio-config-rollback.mjs — 从 {ok,config} 备份剥壳出纯体并 POST 回滚。零依赖。
// 默认 dry-run；--apply 才真写。
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
  '用法: node studio-config-rollback.mjs <backup.json> [--origin http://127.0.0.1:3080] [--apply]',
  '',
  '把操作前备份（GET /config 落的 {ok,config} 外壳）剥壳出 .config 纯体，POST 回写端点恢复。',
  '  默认 dry-run：只剥壳/校验/打印统计与前后差异，不发送。',
  '  --apply       真发送（写头 + UTF-8 字节 body）',
  '  --origin      studio 地址，默认 http://127.0.0.1:3080',
  '',
  '回退后新开会话即恢复；已存在会话下次装配也回到回滚配置。',
].join('\n');

const args = parseArgs(process.argv.slice(2), USAGE);
const file = args._[0];
if (!file) { console.error(USAGE); console.error('缺少 <backup.json>'); process.exit(2); }
const origin = normalizeOrigin(args['--origin'] || 'http://127.0.0.1:3080');
checkUrlAllowed(origin);

let parsed;
try { parsed = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
catch (e) { console.error('读不了/不是合法 JSON: ' + e.message); process.exit(2); }

let config = parsed;
if (parsed && typeof parsed === 'object' && 'config' in parsed && parsed.config && typeof parsed.config === 'object') {
  config = parsed.config;
  console.log('[剥壳] 取 .config 纯体（POST 体要求纯体，直接回外壳=空壳 400，坑③）。');
} else if (!(parsed && typeof parsed === 'object' && 'agents' in parsed)) {
  console.error('输入既不是 {ok,config} 外壳也不是六池纯体，终止。');
  process.exit(3);
} else {
  console.error('[提示] 输入是六池纯体（不是 {ok,config} 外壳），按配置本体处理。');
}

const REQUIRED = ['agents', 'promptSets', 'toolSets', 'bindings'];
const missing = REQUIRED.filter((k) => config[k] === undefined);
if (missing.length) { console.error('备份缺必发键: ' + missing.join(', ') + '——这份备份不完整，别用它回滚。'); process.exit(3); }

console.log('备份统计: ' + JSON.stringify(countPools(config)));
console.log('bindings.presets: ' + JSON.stringify((config.bindings && config.bindings.presets) || []));

// 回滚前后对比（live vs 备份），让人看清会改掉什么
{
  const { status, body } = await studioFetch(origin + '/api/dsh-agent-studio/config', { method: 'GET', headers: { Origin: origin } });
  if (status === 200 && body && body.ok === true) {
    const live = body.config || {};
    console.log('当前 live: ' + JSON.stringify(countPools(live)));
    const pools = ['agents', 'promptSets', 'toolSets', 'skillSets'];
    for (const pool of pools) {
      const ids = (arr) => new Set((arr || []).map((x) => x && x.id));
      const a = ids(live[pool]), b = ids(config[pool]);
      const willRemove = [...a].filter((x) => !b.has(x));
      const willAdd = [...b].filter((x) => !a.has(x));
      if (willRemove.length || willAdd.length) console.log('   ' + pool + ' 将移除 ' + JSON.stringify(willRemove) + ' 将新增 ' + JSON.stringify(willAdd));
    }
    if (JSON.stringify((live.bindings && live.bindings.presets) || []) !== JSON.stringify((config.bindings && config.bindings.presets) || [])) {
      console.log('   bindings 将被覆盖为备份版本：live = ' + JSON.stringify((live.bindings && live.bindings.presets) || []));
    }
  } else {
    console.error('[警告] 读不到当前 live（HTTP ' + status + '），跳过前后对比。');
  }
}

if (!args['--apply']) {
  console.log('');
  console.log('[dry-run] 未发送。确认后加 --apply 真回滚；回滚后用 studio-config-verify.mjs 对拍。');
  process.exit(0);
}

const bodyBytes = Buffer.from(JSON.stringify(config), 'utf8');
const { status, body } = await studioFetch(origin + '/api/dsh-agent-studio/config', {
  method: 'POST',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'x-dsh-agent-studio': '1',
    Origin: origin,
    'content-length': String(bodyBytes.length),
  },
  body: bodyBytes,
});
if (status !== 200 || !body || body.ok !== true) {
  console.error('回滚 POST 失败: HTTP ' + status + ' ' + JSON.stringify(body).slice(0, 500));
  process.exit(1);
}
console.log('回滚成功: HTTP ' + status + ' {"ok":true,"warnings":' + JSON.stringify(body.warnings || []) + '}');
console.log('下一步: 新开会话即恢复；或 node studio-config-get.mjs --out after-rollback.json 与备份对拍。');
