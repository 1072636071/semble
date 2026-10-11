#!/usr/bin/env node
// studio-config-get.mjs — GET /api/dsh-agent-studio/config 落盘备份。零依赖、只读。
// 也可 --observation 拉观察快照（复刻三面的数据源）。
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
  '用法: node studio-config-get.mjs [--origin http://127.0.0.1:3080] [--out <file>] [--observation]',
  '',
  'GET /config（或 /observation）并把响应 JSON 落盘。只读操作，不改 studio 任何状态。',
  '  --origin       studio 地址，默认 http://127.0.0.1:3080',
  '  --out          输出文件；缺省打印到 stdout（config 端点缺省打印 .config 纯体摘要，落盘才保留 {ok,config} 外壳）',
  '  --observation  改拉 GET /observation（各会话实际投递的段/工具/技能 + 机制工具名单）',
].join('\n');

const args = parseArgs(process.argv.slice(2), USAGE);
const origin = normalizeOrigin(args['--origin'] || 'http://127.0.0.1:3080');
checkUrlAllowed(origin);
const endpoint = args['--observation'] ? '/api/dsh-agent-studio/observation' : '/api/dsh-agent-studio/config';

const { status, body } = await studioFetch(origin + endpoint, {
  method: 'GET',
  headers: { Origin: origin },
});
if (status !== 200 || !body || body.ok !== true) {
  console.error('GET ' + endpoint + ' 失败: HTTP ' + status + ' ' + JSON.stringify(body).slice(0, 300));
  process.exit(1);
}

if (args['--observation']) {
  const summary = {
    ok: true,
    origin,
    sessions: (body.sessions || []).map((s) => ({ sessionId: s.sessionId, presetId: s.presetId, sections: (s.sections || []).length, tools: s.tools ? (s.tools.visible || []).length : null, skills: (s.skills || []).length })),
    cachedPresets: Object.keys(body.cached || {}),
    mechanismTools: body.mechanismTools || [],
  };
  if (args['--out']) {
    writeUtf8NoBom(path.resolve(args['--out']), JSON.stringify(body, null, 2) + '\n');
    console.log('observation 已存: ' + path.resolve(args['--out']));
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
} else if (args['--out']) {
  writeUtf8NoBom(path.resolve(args['--out']), JSON.stringify(body, null, 2) + '\n');
  const cfg = body.config || {};
  console.log('config 已存: ' + path.resolve(args['--out']) + '（保留 {ok,config} 外壳；POST 前要 .config 剥壳）');
  console.log('池计数: ' + JSON.stringify(countPools(cfg)));
  console.log('bindings.presets: ' + JSON.stringify(cfg.bindings ? cfg.bindings.presets : []));
} else {
  // stdout 模式：直接给 .config 纯体（方便管道接 validate），外加 stderr 摘要
  console.error('池计数: ' + JSON.stringify(countPools(body.config || {})) + '  （stdout 为 .config 纯体；要 {ok,config} 外壳用 --out）');
  process.stdout.write(JSON.stringify(body.config ?? null, null, 2) + '\n');
}
