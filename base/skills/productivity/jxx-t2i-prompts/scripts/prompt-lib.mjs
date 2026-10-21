#!/usr/bin/env node
// 文生图提示词模板库：内置模板 + 用户沉淀库的统一读写入口。零依赖。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILTIN_DIR = path.resolve(HERE, '..', 'references', 'templates');

function homeDir() {
  const argIdx = process.argv.indexOf('--home');
  if (argIdx > -1 && process.argv[argIdx + 1]) return path.resolve(process.argv[argIdx + 1]);
  if (process.env.T2I_PROMPT_HOME) return path.resolve(process.env.T2I_PROMPT_HOME);
  return path.join(os.homedir(), '.agents', 't2i-prompts');
}

// 项目副本：让「改过的模板」随所在仓库一起版本化，而不只在全局用户库里
function findProjectRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, '.git')) || existsSync(path.join(dir, 'AGENTS.md'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function projectDir() {
  const i = process.argv.indexOf('--project-home');
  if (i > -1 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  if (process.env.T2I_PROJECT_HOME) return path.resolve(process.env.T2I_PROJECT_HOME);
  const root = findProjectRoot(process.cwd());
  return root ? path.join(root, '.scratch', 't2i-prompts') : null;
}

function mirrorTo(dir, home) {
  if (!dir) return 0;
  mkdirSync(dir, { recursive: true });
  const userEntries = scan(home);
  for (const e of userEntries) {
    writeFileSync(path.join(dir, e.fileName), e.raw, 'utf8');
  }
  const rows = userEntries
    .sort((a, b) => String(a.meta.category).localeCompare(String(b.meta.category)))
    .map((e) => [e.meta.id ?? '?', e.meta.name ?? '?', e.meta.category ?? '?', e.meta.verified ?? '?']);
  const body = ['# 项目提示词模板副本', '', '> 由 scripts/prompt-lib.mjs 从全局库同步，勿手改。全局库：' + home, '', table(rows, ['id', 'name', 'category', 'verified'])].join('\n');
  writeFileSync(path.join(dir, 'index.md'), body + '\n', 'utf8');
  return userEntries.length;
}

const REQUIRED_FM = ['id', 'name', 'category', 'tags', 'source', 'verified'];
const REQUIRED_SECTIONS = ['## 骨架', '## 完整示例', '## 来源'];

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      meta[kv[1]] = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      meta[kv[1]] = v.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: text.slice(m[0].length) };
}

function scan(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'index.md')
    .map((f) => {
      const full = path.join(dir, f);
      const raw = readFileSync(full, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      return { file: full, fileName: f, meta, body, raw, layer: dir === BUILTIN_DIR ? 'builtin' : 'user' };
    });
}

function allEntries(home) {
  return [...scan(BUILTIN_DIR), ...scan(home)];
}

function audit(entry) {
  const errors = [];
  for (const k of REQUIRED_FM) {
    if (!entry.meta[k] || (Array.isArray(entry.meta[k]) && !entry.meta[k].length)) errors.push('frontmatter 缺 ' + k);
  }
  if (entry.meta.id && path.basename(entry.fileName, '.md') !== entry.meta.id) {
    errors.push('文件名应与 id 一致：' + entry.meta.id + '.md');
  }
  for (const s of REQUIRED_SECTIONS) {
    if (!entry.body.includes(s)) errors.push('缺小节 ' + s);
  }
  const neg = entry.body.includes('## 负面提示词');
  const exSec = entry.body.match(/## 完整示例\s*\r?\n([\s\S]*?)(?=\r?\n## |$)/);
  const exText = exSec ? exSec[1].trim() : '';
  if (exText.length < 40) {
    errors.push('完整示例过短（' + exText.length + ' 字符，需 ≥40），无法直接投喂');
  }
  if (/待填|TODO|占位/.test(entry.raw)) {
    errors.push('含占位符（待填 / TODO / 占位），先填实再入库');
  }
  return { errors, hasNegative: neg };
}

function pad(s, n) {
  const width = [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
  return String(s) + ' '.repeat(Math.max(0, n - width));
}

function line(str) {
  return [...str].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
}

function table(rows, headers) {
  const widths = headers.map((h, i) => Math.max(line(h), ...rows.map((r) => line(r[i] ?? ''))));
  const fmt = (r) => r.map((c, i) => pad(c ?? '', widths[i] + 2)).join('').trimEnd();
  const out = [fmt(headers), fmt(widths.map((w) => '-'.repeat(w)))];
  for (const r of rows) out.push(fmt(r));
  return out.join('\n');
}

function renderIndex(home) {
  mkdirSync(home, { recursive: true });
  const entries = allEntries(home).map((e) => ({ ...e, ...audit(e) }));
  entries.sort((a, b) => String(a.meta.category).localeCompare(String(b.meta.category)) || String(a.meta.id).localeCompare(String(b.meta.id)));
  const rows = entries.map((e) => [e.meta.id ?? '?', e.meta.name ?? '?', e.meta.category ?? '?', e.layer, Array.isArray(e.meta.tags) ? e.meta.tags.join(' ') : (e.meta.tags ?? ''), e.meta.verified ?? '?']);
  const head = ['# 文生图提示词模板索引', '', '> 本文件由 scripts/prompt-lib.mjs 自动重建，勿手改。', '', table(rows, ['id', 'name', 'category', 'layer', 'tags', 'verified'])];
  const broken = entries.filter((e) => e.errors.length);
  if (broken.length) {
    head.push('', '## 待修', '');
    for (const b of broken) head.push('- ' + b.meta.id + '（' + b.file + '）：' + b.errors.join('；'));
  }
  const text = head.join('\n');
  writeFileSync(path.join(home, 'index.md'), text + '\n', 'utf8');
  return text;
}

function cmdInit(home) {
  mkdirSync(home, { recursive: true });
  const text = renderIndex(home);
  console.log('用户库：' + home);
  console.log('内置库：' + BUILTIN_DIR);
  console.log(text.split('\n').slice(0, 12).join('\n'));
}

function cmdList(home, filter) {
  const entries = allEntries(home).filter((e) => !filter || JSON.stringify(e.meta).toLowerCase().includes(filter.toLowerCase()) || e.body.toLowerCase().includes(filter.toLowerCase()));
  if (!entries.length) return console.log('无匹配模板。');
  const rows = entries.map((e) => [e.meta.id ?? '?', e.meta.name ?? '?', e.meta.category ?? '?', e.layer, e.meta.verified ?? '?']);
  console.log(table(rows, ['id', 'name', 'category', 'layer', 'verified']));
  console.log('\n共 ' + entries.length + ' 条。取全文：node prompt-lib.mjs show <id>');
}

function cmdShow(home, id) {
  const hit = allEntries(home).find((e) => e.meta.id === id || e.fileName === id + '.md');
  if (!hit) {
    console.log('未找到：' + id);
    process.exitCode = 2;
    return;
  }
  console.log(hit.raw.trim());
}

function cmdNew(home, id, name) {
  if (!id) {
    console.log('用法：node prompt-lib.mjs new <id> [name]');
    process.exitCode = 2;
    return;
  }
  mkdirSync(home, { recursive: true });
  const file = path.join(home, id + '.md');
  if (existsSync(file) || allEntries(home).some((e) => e.meta.id === id)) {
    console.log('id 已存在：' + id);
    process.exitCode = 1;
    return;
  }
  writeFileSync(file, skeleton(id, name || id), 'utf8');
  console.log('已创建骨架：' + file);
  console.log('填完跑：node prompt-lib.mjs add ' + file);
}

function syncProject(home) {
  const pd = projectDir();
  if (pd && !process.argv.includes('--no-mirror')) {
    const n = mirrorTo(pd, home);
    console.log('项目副本已同步：' + pd + '（' + n + ' 条，含 index.md）');
  } else if (!pd) {
    console.log('未检测到项目根（.git / AGENTS.md），跳过项目副本；需要时用 --project-home <dir>。');
  }
}

function cmdAdd(home, src, force) {
  if (!src || !existsSync(src)) {
    console.log('用法：node prompt-lib.mjs add <file.md> [--force]');
    process.exitCode = 2;
    return;
  }
  const raw = readFileSync(src, 'utf8');
  const entry = { file: src, fileName: path.basename(src), meta: parseFrontmatter(raw).meta, body: parseFrontmatter(raw).body, raw };
  const { errors } = audit(entry);
  if (errors.length) {
    console.log('校验失败，未入库：');
    for (const e of errors) console.log(' - ' + e);
    process.exitCode = 1;
    return;
  }
  mkdirSync(home, { recursive: true });
  const dest = path.join(home, entry.meta.id + '.md');
  const clash = allEntries(home).find((e) => e.meta.id === entry.meta.id);
  if (clash && clash.layer === 'builtin') {
    console.log('id 与内置模板重复：' + entry.meta.id + '（' + clash.file + '）');
    console.log('定制内置模板请 fork：node prompt-lib.mjs copy ' + entry.meta.id + ' <新id> "新名字"');
    process.exitCode = 1;
    return;
  }
  if (clash && !force) {
    console.log('id 冲突：' + entry.meta.id + ' 已存在于 ' + clash.file + '（加 --force 覆盖用户库条目）');
    process.exitCode = 1;
    return;
  }
  copyFileSync(src, dest);
  console.log('已入库：' + dest);
  renderIndex(home);
  console.log('索引已重建。');
  syncProject(home);
}

function cmdCopy(home, srcId, newId, newName) {
  if (!srcId || !newId) {
    console.log('用法：node prompt-lib.mjs copy <已有id> <新id> [新名字]');
    process.exitCode = 2;
    return;
  }
  const src = allEntries(home).find((e) => e.meta.id === srcId);
  if (!src) {
    console.log('未找到：' + srcId);
    process.exitCode = 2;
    return;
  }
  if (allEntries(home).some((e) => e.meta.id === newId)) {
    console.log('新 id 已被占用：' + newId);
    process.exitCode = 1;
    return;
  }
  mkdirSync(home, { recursive: true });
  let text = src.raw.replace(/^id\s*:\s*.*$/m, 'id: ' + newId);
  if (newName) text = text.replace(/^name\s*:\s*.*$/m, 'name: ' + newName);
  text = text.replace(/^source\s*:\s*(.*)$/m, (m0, v) => 'source: ' + (v || '未注明') + '（fork 自 ' + srcId + '）');
  const dest = path.join(home, newId + '.md');
  writeFileSync(dest, text, 'utf8');
  console.log('已复制：' + src.file + ' → ' + dest);
  renderIndex(home);
  syncProject(home);
  console.log('下一步：改骨架/词库/示例，改完跑 node prompt-lib.mjs add ' + dest);
}

function cmdMirror(home) {
  const pd = projectDir();
  if (!pd) {
    console.log('未检测到项目根；用 --project-home <dir> 指定。');
    process.exitCode = 2;
    return;
  }
  const n = mirrorTo(pd, home);
  console.log('已同步 ' + n + ' 条到项目副本：' + pd);
}

function cmdCheck(home) {
  const entries = allEntries(home);
  let bad = 0;
  for (const e of entries) {
    const { errors, hasNegative } = audit(e);
    if (errors.length) {
      bad++;
      console.log('[FAIL] ' + e.fileName + '\n  ' + errors.join('\n  '));
    } else {
      console.log('[ OK ] ' + e.fileName + (hasNegative ? '' : '  （无负面词小节，可接受）'));
    }
  }
  renderIndex(home);
  console.log('\n共 ' + entries.length + ' 条，失败 ' + bad + ' 条。索引已重建：' + path.join(home, 'index.md'));
  const pd = projectDir();
  if (pd && existsSync(pd)) {
    const drift = scan(pd).filter((e) => {
      const g = path.join(home, e.fileName);
      return !existsSync(g) || readFileSync(g, 'utf8') !== e.raw;
    });
    console.log(drift.length
      ? '项目副本与全局库不一致 ' + drift.length + ' 条（' + drift.map((d) => d.fileName).join(', ') + '）→ node prompt-lib.mjs mirror'
      : '项目副本与全局库一致：' + pd);
  }
  if (bad) process.exitCode = 1;
}

function skeleton(id, name) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    '---',
    'id: ' + id,
    'name: ' + name,
    'category: portrait',
    'tags: [待填]',
    'source: 待填（URL 或「用户自创」）',
    'verified: ' + today,
    'quality: 3',
    '---',
    '',
    '# ' + name,
    '',
    '## 骨架',
    '[主体描述], [面部特征], [发型与发饰], [服装与配饰], [动作与神态], [场景与背景], [光影与画质], [风格与渲染]',
    '',
    '## 模块词库',
    '',
    '| 模块 | 可用词 |',
    '| --- | --- |',
    '| 主体描述 | 待填 |',
    '',
    '## 完整示例',
    '待填（可直接投喂的一段话）',
    '',
    '## 负面提示词',
    'low quality, blurry, deformed',
    '',
    '## 调参备注',
    '- 待填',
    '',
    '## 来源',
    '- 来源：待填',
    '- 验证：待填（哪台模型、跑了几张、命中率）',
    '',
  ].join('\n');
}

const [cmd, ...rest] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const home = homeDir();
const force = process.argv.includes('--force');
switch (cmd) {
  case 'init': cmdInit(home); break;
  case 'list': cmdList(home, rest[0]); break;
  case 'search': cmdList(home, rest.join(' ')); break;
  case 'show': cmdShow(home, rest[0]); break;
  case 'new': cmdNew(home, rest[0], rest.slice(1).join(' ')); break;
  case 'add': cmdAdd(home, path.resolve(rest[0] || ''), force); break;
  case 'copy': cmdCopy(home, rest[0], rest[1], rest.slice(2).join(' ')); break;
  case 'mirror': cmdMirror(home); break;
  case 'check': cmdCheck(home); break;
  default:
    console.log('文生图提示词模板库\n\n用法：\n  node prompt-lib.mjs init                建用户库 + 索引\n  node prompt-lib.mjs list [keyword]      列模板（内置 + 用户）\n  node prompt-lib.mjs search <keyword>    同上，语义化别名\n  node prompt-lib.mjs show <id>           打印模板全文\n  node prompt-lib.mjs new <id> [name]     生成空白模板骨架\n  node prompt-lib.mjs add <file.md>       校验后入库并重建索引\n  node prompt-lib.mjs copy <id> <新id> [名字]  基于已有模板 fork 一个变体\n  node prompt-lib.mjs mirror              把用户库同步成本项目副本（.scratch/t2i-prompts/）\n  node prompt-lib.mjs check               全库校验 + 重建索引\n\n用户库：' + home + '（T2I_PROMPT_HOME 或 --home 可改）\n内置库：' + BUILTIN_DIR);
}
