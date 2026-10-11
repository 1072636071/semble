#!/usr/bin/env node
// studio-config-post.mjs — 安全 POST /api/dsh-agent-studio/config。零依赖。
// 默认 dry-run（不发送）；--apply 才真写。输入是六池纯体（或 {ok,config} 外壳——自动剥壳并提示）。
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
  '用法: node studio-config-post.mjs <proposed.json> [--origin http://127.0.0.1:3080] [--apply]',
  '',
  '把配置 POST 到 studio 写端点。四件套 agents/promptSets/toolSets/bindings 必给全，建议六池全量。',
  '  默认 dry-run：只剥壳/校验/打印统计，不发送。',
  '  --apply       真发送（带写头 x-dsh-agent-studio:1 + application/json; charset=utf-8，UTF-8 字节 body）',
  '  --origin      studio 地址，默认 http://127.0.0.1:3080',
  '',
  '发送后务必跑 studio-config-verify.mjs 回读对拍（POST 成功 ≠ 内容对）。',
].join('\n');

const args = parseArgs(process.argv.slice(2), USAGE);
const file = args._[0];
if (!file) { console.error(USAGE); console.error('缺少 <proposed.json>'); process.exit(2); }
const origin = normalizeOrigin(args['--origin'] || 'http://127.0.0.1:3080');
checkUrlAllowed(origin);

let raw;
try { raw = fs.readFileSync(path.resolve(file), 'utf8'); }
catch (e) { console.error('读不了 ' + file + ': ' + e.message); process.exit(2); }

let parsed;
try { parsed = JSON.parse(raw); }
catch (e) { console.error('不是合法 JSON: ' + e.message); process.exit(3); }

let config = parsed;
if (parsed && typeof parsed === 'object' && 'config' in parsed && !('agents' in parsed)) {
  console.error('[提示] 输入是 {ok,config} 外壳——已自动剥壳出 .config 纯体（POST 体要求六池纯体，坑③）。');
  config = parsed.config;
}
if (!config || typeof config !== 'object') { console.error('剥壳后没有配置对象'); process.exit(3); }

const REQUIRED = ['agents', 'promptSets', 'toolSets', 'bindings'];
const missing = REQUIRED.filter((k) => config[k] === undefined);
if (missing.length) {
  console.error('缺必发键: ' + missing.join(', ') + '（四件套必须一起给全；POST 体=六池纯体，不是 GET 外壳）');
  process.exit(3);
}
if (config.skillSets === undefined) console.error('[警告] 未发 skillSets：服务端按「保持原值」处理。推荐六池全量，避免「忘了发」与「故意不发」分不清。');
if (config.runtimeContextOff === undefined) console.error('[警告] 未发 runtimeContextOff：服务端按「保持原值」处理。');

console.log('dry-run 统计: ' + JSON.stringify(countPools(config)));
const bindings = config.bindings && config.bindings.presets ? config.bindings.presets : [];
console.log('bindings.presets: ' + JSON.stringify(bindings));
console.log('agents ids: ' + JSON.stringify((config.agents || []).map((a) => a.id)));

if (!args['--apply']) {
  console.log('');
  console.log('[dry-run] 未发送。确认无误后加 --apply 真写；POST 后跑 studio-config-verify.mjs 回读对拍。');
  process.exit(0);
}

// UTF-8 字节 body（绕开一切默认编码坑，等价于 PS 的 [Text.Encoding]::UTF8.GetBytes）
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
  console.error('POST 失败: HTTP ' + status + ' ' + JSON.stringify(body).slice(0, 500));
  process.exit(1);
}
console.log('POST 成功: HTTP ' + status + ' {"ok":true,"warnings":' + JSON.stringify(body.warnings || []) + '}');
if ((body.warnings || []).length) {
  console.error('[人审] 服务端 warnings:');
  for (const w of body.warnings) console.error('  - ' + w);
}
console.log('下一步（必做）: node studio-config-verify.mjs <proposed.json> --origin ' + origin + ' --backup <backup.json>');
