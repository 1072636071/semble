#!/usr/bin/env node
// studio-config-validate.mjs — POST 前本地静态校验。零依赖、只读、不发网络请求。
// 校验链与写入端点同源（dsh-agent-studio@0.1.5 lib/api.js:297-320 + lib/config.js）：
//   严格 JSON/重复键 → 六池形态 → 四池 id 唯一 → 装载重叠（findLoadConflict 同逻辑）→
//   SectionSchema 形态 → 键名词汇表 → 插值变量白名单（provider/model/cwd + 已知清单）。
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
  '用法: node studio-config-validate.mjs <proposed.json> [--known-variables a,b,c]',
  '',
  '本地校验将要 POST 的配置（六池纯体或 {ok,config} 外壳，自动剥壳）。退出码：0=可 POST，1=有 error。',
  '  --known-variables   平台已注册的插值变量名（逗号分隔，来自 GET /observation 各会话的 variables 键）；',
  '                      不给 = 只拦 malformed 形状，unknown 变量降级为 warning（与写入端点冷启动语义一致）。',
].join('\n');

const args = parseArgs(process.argv.slice(2), USAGE);
const file = args._[0];
if (!file) { console.error(USAGE); console.error('缺少 <proposed.json>'); process.exit(2); }

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
function finish() {
  console.log('校验目标: ' + path.resolve(file));
  console.log('池计数: ' + JSON.stringify(countPools(config)));
  console.log('error: ' + errors.length + '  warning: ' + warnings.length);
  for (const e of errors) console.log('  [error] ' + e);
  for (const w of warnings) console.log('  [warn ] ' + w);
  if (errors.length) { console.log('\n结论: 不可 POST（先修 error）。'); process.exit(1); }
  console.log('结论: 通过（可 POST；warning 逐条人审，POST 后跑 verify 回读对拍）。');
  process.exit(0);
}

// —— 1. 严格 JSON + 重复键检测（JSON.parse 默认静默合并重复键）——
const raw = fs.readFileSync(path.resolve(file), 'utf8');
try { JSON.parse(raw); } catch (e) { err('不是合法 JSON: ' + e.message); finish(); process.exit(2); }
{
  let inStr = false, esc = false;
  let cur = null;
  let token = '';
  let line = 1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\n') line++;
    if (inStr) {
      token += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') {
        inStr = false;
        const after = raw.slice(i + 1).replace(/^[ \t]*/, '')[0];
        if (after === ':' && cur && cur.isObj) {
          const key = token.slice(1, -1);
          if (cur.keys.has(key)) err('重复键: 第 ' + line + ' 行附近键 "' + key + '" 重复（JSON.parse 会静默合并、后者覆盖——几乎一定是手误）');
          else cur.keys.add(key);
        }
        token = '';
      }
      continue;
    }
    if (ch === '"') { inStr = true; token = '"'; continue; }
    if (ch === '{') { cur = { isObj: true, keys: new Set(), parent: cur }; continue; }
    if (ch === '[') { cur = { isObj: false, keys: new Set(), parent: cur }; continue; }
    if (ch === '}' || ch === ']') { cur = cur ? cur.parent : null; continue; }
  }
}

let parsed = JSON.parse(raw);
let config = parsed;
if (parsed && typeof parsed === 'object' && 'config' in parsed && !('agents' in parsed)) {
  warn('输入是 {ok,config} 外壳——按 .config 剥壳校验（POST 时也要剥壳，坑③）。');
  config = parsed.config;
}
if (!config || typeof config !== 'object') { err('剥壳后没有配置对象'); finish(); process.exit(2); }

// —— 2. 六池形态 ——
const POOL_KEYS = ['agents', 'promptSets', 'toolSets', 'skillSets', 'runtimeContextOff', 'bindings'];
for (const k of POOL_KEYS) {
  if (config[k] === undefined) warn('缺 ' + k + '：POST 时该键不参与写入（四件套缺一会 400；skillSets/runtimeContextOff 漏发=保持原值）。建议六池全量。');
}
for (const k of ['agents', 'promptSets', 'toolSets', 'skillSets', 'runtimeContextOff']) {
  if (config[k] !== undefined && !Array.isArray(config[k])) err(k + ' 必须是数组（四池全部是数组不是字典——数组整体替换语义，config.js:16-22）');
}
if (config.bindings !== undefined && (typeof config.bindings !== 'object' || config.bindings === null || !Array.isArray(config.bindings.presets))) {
  err('bindings 必须是 {presets: [...]} 形态');
}
if (!Array.isArray(config.agents) || !Array.isArray(config.promptSets) || !Array.isArray(config.toolSets) || config.bindings === undefined) {
  err('agents、promptSets、toolSets、bindings 四件套必须一起给全（api.js:292-296）');
  finish(); process.exit(2);
}

// —— 3. 四池 id 唯一 + bindings.presetId 唯一 ——
function dupIds(items, label) {
  const seen = new Set();
  for (const it of items || []) {
    const id = it && it.id;
    if (typeof id !== 'string' || id === '') { err(label + ' 有成员缺 id'); continue; }
    if (seen.has(id)) err(label + ' id 重复：「' + id + '」出现了两次（findLoadConflict 会 400）');
    seen.add(id);
  }
}
dupIds(config.agents, 'agents');
dupIds(config.promptSets, 'promptSets');
dupIds(config.toolSets, 'toolSets');
dupIds(config.skillSets, 'skillSets');
{
  const seen = new Set();
  for (const b of config.bindings.presets || []) {
    if (!b || typeof b.presetId !== 'string' || typeof b.agentId !== 'string') { err('bindings.presets 有条目缺 presetId/agentId'); continue; }
    if (seen.has(b.presetId)) err('bindings.presets 的 presetId 重复：「' + b.presetId + '」（一个预设只能绑一个代理）');
    seen.add(b.presetId);
  }
}

// —— 4. 装载重叠（findLoadConflict 同逻辑，含豁免名单）——
const PTC_REQUIRED_SECTIONS = ['tools:sdk', 'tools:ptc-only'];   // config.js:440
const REQUIRED_TOOLS = ['skill'];                                // config.js:451
const promptSetById = new Map((config.promptSets || []).map((s) => [s.id, s]));
const toolSetById = new Map((config.toolSets || []).map((s) => [s.id, s]));
const skillSetById = new Map((config.skillSets || []).map((s) => [s.id, s]));
for (const agent of config.agents || []) {
  const label = agent.name ? agent.name : agent.id;
  const secOwner = new Map();
  for (const sid of agent.promptSets || []) {
    const set = promptSetById.get(sid);
    if (!set) { warn('代理「' + label + '」的 promptSets 引用了不存在的集「' + sid + '」（悬空引用：段面静默缺）'); continue; }
    for (const sec of set.sections || []) {
      const name = sec && sec.name;
      if (name === undefined || name === '') continue;
      if (PTC_REQUIRED_SECTIONS.includes(name)) continue;
      if (secOwner.has(name)) err('代理「' + label + '」装载的提示词集「' + secOwner.get(name) + '」与「' + (set.name || set.id) + '」都含段「' + name + '」——已装集之间不允许重叠');
      else secOwner.set(name, set.name || set.id);
    }
  }
  const toolOwner = new Map();
  for (const sid of agent.toolSets || []) {
    const set = toolSetById.get(sid);
    if (!set) { warn('代理「' + label + '」的 toolSets 引用了不存在的集「' + sid + '」（悬空引用：工具面静默缺）'); continue; }
    for (const t of set.tools || []) {
      if (REQUIRED_TOOLS.includes(t)) continue;
      if (toolOwner.has(t)) err('代理「' + label + '」装载的工具集「' + toolOwner.get(t) + '」与「' + (set.name || set.id) + '」都含工具「' + t + '」——已装集之间不允许重叠');
      else toolOwner.set(t, set.name || set.id);
    }
  }
  const skillOwner = new Map();
  for (const sid of agent.skillSets || []) {
    const set = skillSetById.get(sid);
    if (!set) { warn('代理「' + label + '」的 skillSets 引用了不存在的集「' + sid + '」（悬空引用：技能面静默缺）'); continue; }
    for (const s of set.skills || []) {
      if (skillOwner.has(s)) err('代理「' + label + '」装载的技能集「' + skillOwner.get(s) + '」与「' + (set.name || set.id) + '」都含技能「' + s + '」——已装集之间不允许重叠');
      else skillOwner.set(s, set.name || set.id);
    }
  }
  // 坑⑦：每个工具集必带 skill 工具（写入端点不查、静默丢技能面——本地必须查）
  for (const sid of agent.toolSets || []) {
    const set = toolSetById.get(sid);
    if (set && !(set.tools || []).includes('skill')) {
      warn('工具集「' + (set.name || set.id) + '」没带 skill 工具（坑⑦）：skill 是技能目录下发开关，缺了整条技能目录都不注入。');
    }
  }
  // children 悬空 + 词汇表
  for (const c of agent.children || []) {
    if (!config.agents.some((a) => a.id === c)) err('代理「' + label + '」的 children 引用了不存在的代理「' + c + '」（派活时列不出、studio_delegate 报没有该子代理）');
  }
  const BG = ['always-background', 'foreground', 'model-decides'];
  if (agent.background !== undefined && !BG.includes(agent.background)) err('代理「' + label + '」的 background="' + agent.background + '" 不在词汇表 ' + JSON.stringify(BG));
  const TP = ['follow', 'native', 'ptc'];
  if (agent.toolPresentation !== undefined && !TP.includes(agent.toolPresentation)) err('代理「' + label + '」的 toolPresentation="' + agent.toolPresentation + '" 不在词汇表 ' + JSON.stringify(TP));
}

// —— 5. SectionSchema 形态 ——
const noText = [];
for (const set of config.promptSets || []) {
  for (const sec of set.sections || []) {
    if (!sec || typeof sec !== 'object') { err('提示词集「' + (set.name || set.id) + '」有非对象 section'); continue; }
    if (typeof sec.name !== 'string') err('提示词集「' + (set.name || set.id) + '」有 section 缺 name（name 必填）');
    if (sec.enabled !== undefined && typeof sec.enabled !== 'boolean') err('段「' + sec.name + '」的 enabled 必须是 boolean');
    if (sec.text !== undefined && typeof sec.text !== 'string') err('段「' + sec.name + '」的 text 必须是 string（带 text=自定义段/覆盖平台正文；不带=引用平台预设段）');
    if (typeof sec.name === 'string' && sec.name !== '' && sec.text === undefined) {
      noText.push((set.name || set.id) + ' / ' + sec.name);
    }
  }
}

if (noText.length) {
  warn('有 ' + noText.length + ' 个段没带 text（=引用平台预设段）：该预设下没有这个段名时会静默不投递。清单: ' + noText.join('、') + '（复刻前先对 observation）。');
}

// —— 6. 插值变量白名单（与平台扫描语义对齐）——
const BUILTIN = ['provider', 'model', 'cwd'];   // config.js:506
const known = args['--known-variables'] ? String(args['--known-variables']).split(',').map((s) => s.trim()).filter(Boolean) : null;
const VAR_NAME = /^[a-z][a-z0-9_]*$/;           // config.js:508
for (const set of config.promptSets || []) {
  for (const sec of set.sections || []) {
    const text = sec && sec.text;
    if (typeof text !== 'string' || text === '') continue;
    let last = 0;
    for (;;) {
      const open = text.indexOf('{{', last);
      if (open < 0) break;
      const m = /^\{\{([^{}]*)\}\}/.exec(text.slice(open));
      if (m === null) { last = open + 2; continue; } // 孤立 {{ 是字面量
      const name = m[1];
      if (!VAR_NAME.test(name)) { err('段「' + (sec.name || '未命名') + '」有不合法插值 {{' + name + '}}：变量名只能小写字母开头的小写字母/数字/下划线（渲染期必抛）'); last = open + m[0].length; continue; }
      if (!BUILTIN.includes(name) && known && !known.includes(name)) {
        err('段「' + (sec.name || '未命名') + '」引用了未注册变量 {{' + name + '}}（渲染期请求直接失败）。当前已知: ' + [...BUILTIN, ...known].sort().join(', '));
      } else if (!BUILTIN.includes(name) && !known) {
        warn('段「' + (sec.name || '未命名') + '」用了非内置变量 {{' + name + '}}：未给 --known-variables，无法确认已注册（写入端点清单不可用时也会收进 warnings）。');
      }
      last = open + m[0].length;
    }
  }
}

finish();
