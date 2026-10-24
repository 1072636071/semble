#!/usr/bin/env node
// studio-config-doctor.mjs — agent 中心配置体检：把「当前到底配了什么、哪里会静默失效」一次说清。
// 零依赖、默认只读（不加 --apply 不动任何状态）。设计目标 = agent 忘了/漂移时的第一诊断位。
//
// 为什么需要它（三类症状，全都不是 POST 能报出来的）：
//   ① 话术让用某工具/技能，三面却没装          → 运行期 guard 拦（坑①）
//   ② orderedSections 与 promptSets 双份文本    → 新路接管旧路后仍投旧文（坑⑮）
//   ③ 空集 / 悬空引用 / 未绑预设的三面缺口      → 绑定即接管后整面为空（坑⑨）
// 本脚本把这三类 + 全部结构面做成一张体检表，一眼定位。

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
  return { status: res.body === null ? status : res.status, body, text };
}
import fs from 'node:fs';
import path from 'node:path';

const USAGE = [
  '用法: node studio-config-doctor.mjs [--origin http://127.0.0.1:3080] [--file <config.json>] [--json] [--strict]',
  '',
  '体检 agent 中心当前配置：先给全景（每个代理的三面 + 段/工具/技能计数），',
  '再跑一致性检查（话术↔工具面、话术↔技能面、坑⑮ 双份文本、空集、悬空引用、绑定缺口）。',
  '只读：不发任何写请求。',
  '  --origin     studio 地址，默认 http://127.0.0.1:3080',
  '  --file       改用本地配置文件（{ok,config} 外壳或纯体都吃），不联网',
  '  --json        机器可读输出（单行 JSON，含 findings 数组）',
  '  --strict      有 error 级发现时退出码 1（CI / 门禁用）',
].join('\n');

const args = parseArgs(process.argv.slice(2), USAGE);
const origin = normalizeOrigin(args['--origin'] || 'http://127.0.0.1:3080');

// —— 取配置：--file 优先，否则 GET live ——
let config = null;
let source = '';
if (args['--file']) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(args['--file']), 'utf8'));
  config = raw && raw.config ? raw.config : raw;
  source = 'file:' + path.resolve(args['--file']);
} else {
  checkUrlAllowed(origin);
  const { status, body } = await studioFetch(origin + '/api/dsh-agent-studio/config', { method: 'GET', headers: { Origin: origin } });
  if (status !== 200 || !body || body.ok !== true) {
    console.error('GET /config 失败: HTTP ' + status + ' ' + JSON.stringify(body).slice(0, 300));
    process.exit(1);
  }
  config = body.config;
  source = 'live:' + origin;
}
if (!config) { console.error('配置为空（' + source + '）：agent-studio 尚未初始化'); process.exit(1); }

// —— 工具面词汇表（全池并集；用于识别「话术里提到的工具名」）——
const TOOL_UNIVERSE = new Set();
for (const t of config.toolSets || []) for (const n of t.tools || []) TOOL_UNIVERSE.add(n);
const SKILL_UNIVERSE = new Set();
for (const s of config.skillSets || []) for (const n of s.skills || []) SKILL_UNIVERSE.add(n);
// 平台技能名（不一定在池里出现过的写法），避免把叙述里的词误判成技能名
const SKILL_HINT = /^(?:jxx-[a-z0-9-]+|open-code-review(?:-delegate)?|kb-router|weknora-kb-ops|weknora-model-ops|lingshu-console|red-green-evidence|deploy-router|session-digest-round|dsh-agent-studio-config|dsh-host-change-verify|dsh-plugin-dev|jxx-ticket-router|memory-gateway(?:-weknora)?|tdai-agent-setup|tdai-memory-capture|find-skills|humanizer|impeccable|mzg-init|ima-skill|browser-skill|kimi-webbridge)$/;
const TOOL_HINT = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*(?:__[a-z0-9_-]+)?$/;

// —— 全景：逐代理解析三面 ——
const promptSetById = new Map((config.promptSets || []).map((s) => [s.id, s]));
const toolSetById = new Map((config.toolSets || []).map((s) => [s.id, s]));
const skillSetById = new Map((config.skillSets || []).map((s) => [s.id, s]));
const MECHANISM = ['run_code', 'structured_output'];

function loaded(agent, pool) {
  const ids = [];
  for (const sid of agent[pool] || []) {
    const set = (pool === 'promptSets' ? promptSetById : pool === 'toolSets' ? toolSetById : skillSetById).get(sid);
    if (set) ids.push(sid);
  }
  return ids;
}
function face(agent, pool) {
  const out = { ids: loaded(agent, pool), sections: 0, items: 0, missing: [] };
  for (const sid of agent[pool] || []) {
    const set = (pool === 'promptSets' ? promptSetById : pool === 'toolSets' ? toolSetById : skillSetById).get(sid);
    if (!set) { out.missing.push(sid); continue; }
    if (pool === 'promptSets') { out.sections += (set.sections || []).length; }
    else out.items += (pool === 'toolSets' ? (set.tools || []).length : (set.skills || []).length);
  }
  return out;
}
function textOf(agent) {
  // 收集「角色规则/人设」类文本：orderedSections 优先（新路），promptSets 兜底（旧路）
  const out = [];
  for (const s of agent.orderedSections || []) if (s && s.text && /^studio:(persona|role-)/.test(s.name)) out.push([s.name, s.text]);
  const ord = new Set((agent.orderedSections || []).map((s) => s.name));
  for (const sid of agent.promptSets || []) {
    const set = promptSetById.get(sid);
    if (!set) continue;
    for (const s of set.sections || []) {
      if (!s || !s.text) continue;
      if (ord.has(s.name)) continue;              // orderedSections 已收录（避免双份误报）
      if (/^studio:(persona|role-)/.test(s.name) || /rules/.test(sid)) out.push([set.id + '::' + s.name, s.text]);
    }
  }
  return out;
}

const agents = (config.agents || []).map((a) => ({
  id: a.id,
  name: a.name || '(未命名)',
  note: a.note || '',
  background: a.background || 'model-decides',
  bound: (config.bindings.presets || []).filter((b) => b.agentId === a.id).map((b) => b.presetId),
  children: a.children || [],
  prompt: face(a, 'promptSets'),
  tool: face(a, 'toolSets'),
  skill: face(a, 'skillSets'),
  orderedCount: (a.orderedSections || []).length,
  hasOrdered: (a.orderedSections || []).length > 0,
  tools: new Set(), skills: new Set(),
}));
for (const a of agents) {
  const raw = (config.agents || []).find((x) => x.id === a.id);
  for (const sid of raw.toolSets || []) { const s = toolSetById.get(sid); if (s) for (const t of s.tools || []) a.tools.add(t); }
  for (const sid of raw.skillSets || []) { const s = skillSetById.get(sid); if (s) for (const t of s.skills || []) a.skills.add(t); }
}

// —— 检查器：error = 会静默失效或已被平台拒；warn = 该看但不一定坏 ——
const findings = [];
const err = (m) => findings.push({ level: 'error', msg: m });
const warn = (m) => findings.push({ level: 'warn', msg: m });
const ok = (m) => findings.push({ level: 'ok', msg });

for (const a of agents) {
  const raw = (config.agents || []).find((x) => x.id === a.id);
  const label = a.name + '（' + a.id + '）';

  // ① 话术↔工具面：角色文本要求用某工具但工具集没装（禁语上下文豁免）
  // ② 话术↔技能面：同上
  const NEG = /(?:不|别|勿|禁止|不得|无需|不需要|跳过)[^。\n]{0,40}$/;
  const seen = new Set();
  for (const [where, text] of textOf(raw)) {
    for (const m of text.matchAll(/\`([A-Za-z_][A-Za-z0-9_]*(?:__[A-Za-z0-9_-]+)?)\`/g)) {
      const w = m[1];
      if (!TOOL_UNIVERSE.has(w) || a.tools.has(w)) continue;
      if (NEG.test(text.slice(Math.max(0, m.index - 60), m.index))) continue;
      const k = 'tool:' + w; if (seen.has(k)) continue; seen.add(k);
      err(label + ' · ' + where + '：话术要求用工具 \`' + w + '\`，但工具集未装 → 运行期 guard 拦（坑①）');
    }
    for (const m of text.matchAll(/([A-Za-z][A-Za-z0-9-]*)/g)) {
      const w = m[1];
      if (!SKILL_HINT.test(w) || !SKILL_UNIVERSE.has(w) || a.skills.has(w)) continue;
      if (NEG.test(text.slice(Math.max(0, m.index - 60), m.index))) continue;
      const k = 'skill:' + w; if (seen.has(k)) continue; seen.add(k);
      err(label + ' · ' + where + '：话术要求用技能 \`' + w + '\`，但技能集未装 → 技能目录里看不到（坑⑥）');
    }
  }

  // ③ 坑⑮：orderedSections（新路）与 promptSets（旧路）双份文本不一致
  const ord = raw.orderedSections || [];
  if (ord.length) {
    for (const s of ord) {
      if (!/^studio:(persona|role-)/.test(s.name)) continue;
      const fromSets = [];
      for (const sid of raw.promptSets || []) {
        const set = promptSetById.get(sid);
        if (!set) continue;
        for (const x of set.sections || []) if (x && x.name === s.name && x.text) fromSets.push([set.id, x.text]);
      }
      if (!s.text && fromSets.length) {
        err(label + ' · 坑⑮：orderedSections.' + s.name + ' 无 text 而 ' + fromSets.map((f) => f[0]).join('/') + ' 有 → 新路接管后该段静默不投递');
      } else if (s.text && fromSets.length && fromSets.every((f) => f[1] !== s.text)) {
        err(label + ' · 坑⑮：orderedSections.' + s.name + ' 与 ' + fromSets.map((f) => f[0]).join('/') + ' 文本不一致 → 改了一处另一处仍是旧文');
      }
    }
  }

  // ④ 空面 / 空集（有意留空要在 note 里声明，否则视为漂移）
  const INTENTIONAL = /(?:无技能面|no-skill-face|无工具面|no-tool-face|无段面|no-prompt-face)/;
  const intentional = (a.note || '').match(INTENTIONAL);
  if (!a.skill.ids.length && !intentional) warn(label + '：未装任何技能集（技能面全空；要技能就补 skillSets；确实不需要就在 note 里写「无技能面」）');
  if (!a.tool.ids.length && !intentional) warn(label + '：未装任何工具集（工具面全空；机制工具 run_code/structured_output 除外什么都不给）');
  if (!a.prompt.ids.length) err(label + '：未装任何提示词集（段面投递空清单）');
  for (const pool of ['prompt', 'tool', 'skill']) {
    for (const sid of a[pool].missing) err(label + '：装载了不存在的' + ({ prompt: '提示词', tool: '工具', skill: '技能' })[pool] + '集「' + sid + '」（悬空引用，整面静默缺）');
  }

  // ⑤ 工具集漏 skill（坑⑦：技能目录总开关）
  for (const sid of raw.toolSets || []) {
    const set = toolSetById.get(sid);
    if (set && !(set.tools || []).includes('skill')) warn(label + ' · 工具集「' + (set.name || set.id) + '」没带 skill 工具（坑⑦）→ 整条技能目录不注入');
  }

  // ⑥ 绑定即接管：绑了预设却有空面 = 该预设下三面残缺
  if (a.bound.length && (!a.tool.ids.length || !a.prompt.ids.length)) {
    err(label + '：已绑定预设 ' + a.bound.join(',') + ' 但工具面/段面为空 → 绑定即接管，中间态会话直接缺面（坑⑨）');
  }
  if (a.bound.length && !a.skill.ids.length && !intentional) {
    warn(label + '：已绑定预设 ' + a.bound.join(',') + ' 且技能面为空 → 若这是有意的（该模式不需要技能），在 note 里写「无技能面」消警');
  }

  // ⑦ children 悬空（派活列不出）
  for (const ch of a.children) {
    if (!(config.agents || []).some((x) => x.id === ch)) err(label + '：children 引用不存在的代理「' + ch + '」（派活时列不出）');
  }
}

// ⑧ 四池 id 唯一（写入端点会 400，提前说）
for (const pool of ['agents', 'promptSets', 'toolSets', 'skillSets']) {
  const seen = new Set();
  for (const it of config[pool] || []) {
    if (!it || typeof it.id !== 'string' || it.id === '') { err(pool + ' 有成员缺 id'); continue; }
    if (seen.has(it.id)) err(pool + ' id 重复：「' + it.id + '」（写入端点 findLoadConflict 会 400）');
    seen.add(it.id);
  }
}
// ⑨ bindings.presetId 唯一 + agentId 存在
{
  const seen = new Set();
  for (const b of (config.bindings && config.bindings.presets) || []) {
    if (!b || typeof b.presetId !== 'string' || typeof b.agentId !== 'string') { err('bindings.presets 有条目缺 presetId/agentId'); continue; }
    if (seen.has(b.presetId)) err('bindings.presets 的 presetId 重复：「' + b.presetId + '」');
    seen.add(b.presetId);
    if (!(config.agents || []).some((x) => x.id === b.agentId)) err('bindings.presets 的 agentId「' + b.agentId + '」不存在（预设绑到幽灵代理 = 三面全空）');
  }
}

const errCount = findings.filter((f) => f.level === 'error').length;
const warnCount = findings.filter((f) => f.level === 'warn').length;

if (args['--json']) {
  console.log(JSON.stringify({
    source, pools: {
      agents: (config.agents || []).length,
      promptSets: (config.promptSets || []).length,
      toolSets: (config.toolSets || []).length,
      skillSets: (config.skillSets || []).length,
      bindings: ((config.bindings || {}).presets || []).length,
    },
    agents: agents.map((a) => ({ id: a.id, name: a.name, background: a.background, bound: a.bound, children: a.children, promptSets: a.prompt.ids, toolSets: a.tool.ids, skillSets: a.skill.ids, sections: a.prompt.sections, tools: a.tool.items, skills: a.skill.items, orderedSections: a.orderedCount })),
    findings,
    summary: { error: errCount, warn: warnCount },
  }));
} else {
  const W = 22;
  const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); };
  const padL = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
  console.log('# agent 中心配置体检（' + source + '）');
  console.log('池: agents ' + (config.agents || []).length + ' · promptSets ' + (config.promptSets || []).length + ' · toolSets ' + (config.toolSets || []).length + ' · skillSets ' + (config.skillSets || []).length + ' · bindings ' + (((config.bindings || {}).presets) || []).length);
  console.log('');
  console.log('| 代理 | 后台 | 绑定 | 段 | 工具 | 技能 | 子代理 | 提示词集 / 工具集 / 技能集 |');
  console.log('|' + '-'.repeat(W) + '|---|---|---|---|---|---|---|--------------|');
  for (const a of agents) {
    console.log('| ' + pad(a.id + ' ' + a.name, W) + ' | ' + pad(a.background.replace('-background', ''), 2) + ' | ' + pad(a.bound.join(',') || '-', 4) + ' | ' + padL(a.prompt.sections, 2) + ' | ' + padL(a.tool.items, 2) + ' | ' + padL(a.skill.items, 2) + ' | ' + padL(a.children.length, 2) + ' | ' + a.prompt.ids.length + '/' + a.tool.ids.length + '/' + a.skill.ids.length + ' |');
  }
  console.log('');
  console.log('## 发现项（error ' + errCount + ' · warn ' + warnCount + '）');
  if (!findings.length) console.log('  无。三面与话术一致，无空集、无悬空引用、无坑⑮ 双份文本。');
  for (const f of findings) console.log('  [' + (f.level === 'error' ? 'ERROR' : 'warn ') + '] ' + f.msg);
  console.log('');
  console.log('口径：error = 会静默失效或已被平台拒；warn = 该看但不一定坏。修法见 SKILL.md 与 references/pitfalls.md。');
}

if (args['--strict'] && errCount > 0) process.exit(1);
