#!/usr/bin/env node
// ship.mjs — 跨厂商 Skills/Agent 分发动词。
// 零参数 = 全流程（派生 + 安装 + 验证 + 清理）；子命令 init / derive / install / check。
// 平台清单与派生规则由 vendors.json 配置驱动，脚本零硬编码。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = path.join(__dirname, 'vendors.json');
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---------------------------------------------------------------- YAML 子集

function parseScalar(v) {
  v = v.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"');
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => parseScalar(s.trim()));
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    const inner = v.slice(1, -1).trim();
    const obj = {};
    if (inner) {
      for (const pair of inner.split(',')) {
        const m = pair.match(/^\s*([^:]+):\s*(.*)$/);
        if (m) obj[m[1].trim()] = parseScalar(m[2]);
      }
    }
    return obj;
  }
  return v;
}

function splitKV(text) {
  // 首个不在引号/方括号/花括号内的冒号
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    else if (c === ':' && depth === 0) {
      const key = text.slice(0, i).trim();
      const rest = text.slice(i + 1).trim();
      const blockMatch = rest.match(/^(\|-?|>)$/);
      return { key, value: blockMatch ? '' : rest, block: blockMatch ? blockMatch[1] : null };
    }
  }
  throw new Error(`无法解析 YAML 键值对: ${text}`);
}

function parseYaml(text) {
  const lines = text.split(/\r?\n/).map((l) => ({ raw: l, indent: l.match(/^\s*/)[0].length, text: l.trim() }));
  let idx = 0;
  const skipBlank = () => { while (idx < lines.length && (lines[idx].text === '' || lines[idx].text.startsWith('#'))) idx++; };
  const peekIndent = () => { let j = idx; while (j < lines.length && (lines[j].text === '' || lines[j].text.startsWith('#'))) j++; return j < lines.length ? lines[j].indent : -1; };

  function parseNode(indent) {
    skipBlank();
    if (idx >= lines.length) return null;
    if (lines[idx].indent < indent) return null;
    if (lines[idx].indent > indent) throw new Error(`意外的缩进: ${lines[idx].text}`);
    if (lines[idx].text.startsWith('- ')) return parseList(indent);
    return parseMapping(indent);
  }

  function parseMapping(indent) {
    const obj = {};
    while (true) {
      skipBlank();
      if (idx >= lines.length) break;
      const line = lines[idx];
      if (line.indent < indent) break;
      if (line.indent > indent) throw new Error(`意外的缩进: ${line.text}`);
      if (line.text.startsWith('- ')) break;
      const { key, value, block } = splitKV(line.text);
      idx++;
      let parsed;
      if (block !== null) {
        const blockLines = [];
        const base = line.indent + 2;
        while (idx < lines.length && lines[idx].indent > line.indent) { blockLines.push(lines[idx].raw.slice(Math.min(base, lines[idx].indent))); idx++; }
        parsed = blockLines.join('\n');
        if (block === '|') parsed += '\n';
      } else if (value === '') {
        const ni = peekIndent();
        parsed = ni > line.indent ? parseNode(ni) : null;
      } else {
        parsed = parseScalar(value);
      }
      obj[key] = parsed;
    }
    return obj;
  }

  function parseList(indent) {
    const arr = [];
    while (true) {
      skipBlank();
      if (idx >= lines.length) break;
      const line = lines[idx];
      if (line.indent < indent) break;
      if (line.indent > indent) throw new Error(`意外的缩进: ${line.text}`);
      if (!line.text.startsWith('- ')) break;
      const rest = line.text.slice(2).trim();
      idx++;
      if (rest === '') {
        const ni = peekIndent();
        arr.push(ni > line.indent ? parseNode(ni) : null);
      } else if (/^[A-Za-z0-9_-]+:/.test(rest)) {
        const { key, value, block } = splitKV(rest);
        const item = {};
        if (block !== null) {
          const base = line.indent + 2;
          const blockLines = [];
          while (idx < lines.length && lines[idx].indent > line.indent) { blockLines.push(lines[idx].raw.slice(Math.min(base, lines[idx].indent))); idx++; }
          item[key] = blockLines.join('\n');
        } else if (value === '') {
          const ni = peekIndent();
          item[key] = ni > line.indent ? parseNode(ni) : null;
        } else {
          item[key] = parseScalar(value);
        }
        arr.push(item);
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  return parseNode(0) || {};
}

function yamlScalar(v) {
  if (typeof v === 'string') {
    if (v.includes('\n')) {
      const lines = v.split('\n');
      return '|-\n' + lines.map((l) => '  ' + l).join('\n');
    }
    if (/[:#\[\]{},]/.test(v) || v !== v.trim() || v === '') return JSON.stringify(v);
    return v;
  }
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function serializeYaml(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out.push(`${pad}${k}:`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push(`${pad}${k}: []`);
      } else {
        out.push(`${pad}${k}:`);
        for (const item of v) {
          if (item && typeof item === 'object') {
            const first = Object.entries(item)[0];
            const keys = Object.keys(item);
            if (keys.length === 1) {
              const fk = keys[0];
              const fv = item[fk];
              if (fv === null || fv === undefined) {
                out.push(`${pad}  - ${fk}:`);
              } else if (typeof fv === 'object') {
                if (Array.isArray(fv)) {
                  out.push(`${pad}  - ${fk}: []`);
                } else if (Object.keys(fv).length === 0) {
                  out.push(`${pad}  - ${fk}: {}`);
                } else {
                  out.push(`${pad}  - ${fk}:`);
                  out.push(serializeYaml(fv, indent + 4));
                }
              } else {
                out.push(`${pad}  - ${fk}: ${yamlScalar(fv)}`);
              }
            } else {
              out.push(`${pad}  -`);
              out.push(serializeYaml(item, indent + 4));
            }
          } else {
            out.push(`${pad}  - ${yamlScalar(item)}`);
          }
        }
      }
    } else if (v && typeof v === 'object') {
      out.push(`${pad}${k}:`);
      out.push(serializeYaml(v, indent + 2));
    } else {
      out.push(`${pad}${k}: ${yamlScalar(v)}`);
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- frontmatter

function parseFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text, text };
  return { meta: parseYaml(m[1]), body: m[2] || '', text };
}

function renderDoc(meta, body) {
  return `---\n${serializeYaml(meta)}\n---\n\n${body.replace(/^\n/, '')}`;
}

function stripXVendors(meta) {
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k === 'x-vendors' || k === 'x-install') continue;
    out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------- 内联源技能
//
// `x-inline: true` 的技能不单独安装：安装期把它的正文（含递归引用到的其它
// inline 源）注入到引用它的技能 SKILL.md 末尾。两个目的：
//   1. 技能列表里少一行常驻 description，省 context；
//   2. 引用技能自带被依赖技能的原文，agent 不必再读第二个文件。
// 注入块由固定 marker 界定，重复 install 幂等；块内 manifest 记录每个源的正文
// hash 与注入模板 hash，`ship check` 据此做漂移门禁——改了源技能或注入逻辑
// 却没重跑 install 就报 E_INLINE_STALE，提醒同步依赖技能。
const INLINE_START = '<!-- ship:inline:start -->';
const INLINE_END = '<!-- ship:inline:end -->';
const INLINE_BLOCK_RE = /<!-- ship:inline:start -->[\s\S]*?<!-- ship:inline:end -->\r?\n?/;
const INLINE_REF_RE = /(?<![\w/])(?:\/|`)([a-z][a-z0-9-]*)`?/g;
const INLINE_MANIFEST_RE = /<!-- ship:inline:manifest ([^>]*) -->/;

// x-inline 取值归一化沿用 x-install 的解析器（boolean / 带行尾注释都能认）。
function getXInline(filePath) {
  let meta = {};
  try {
    meta = parseFrontmatter(filePath).meta || {};
  } catch {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (fm) {
      const line = fm[1].split(/\r?\n/).find((l) => /^\s*x-inline\s*:/.test(l));
      if (line) return normalizeXInstallValue(line.split(/:/).slice(1).join(':').trim()) === 'true';
    }
    return false;
  }
  return normalizeXInstallValue(meta['x-inline']) === 'true';
}

// 内联源表：name → { name, body, hash, srcPath, srcMode }。
// 结果挂在 config 上缓存，一次 install/check 只扫一遍源。
function inlineSourceMap(config) {
  if (config.inlineSourceCache) return config.inlineSourceCache;
  const map = new Map();
  for (const skill of listSkillDirs(config)) {
    if (!getXInline(skill.srcPath)) continue;
    let body;
    try { body = parseFrontmatter(skill.srcPath).body; } catch { continue; }
    map.set(skill.name, {
      name: skill.name,
      body,
      hash: crypto.createHash('sha256').update(body, 'utf-8').digest('hex').slice(0, 12),
      srcPath: skill.srcPath,
      srcMode: skill.srcMode,
    });
  }
  config.inlineSourceCache = map;
  return map;
}

// 正文里指向本地文件的链接：内联进别的技能目录后必然断，check 要挡住。
function inlineLocalLinks(body) {
  return [...body.matchAll(/\]\(([^)]+)\)/g)]
    .map((m) => m[1].trim())
    .filter((u) => !/^(https?:|#|mailto:|\/|\{\{)/.test(u));
}

// 递归收集正文引用的 inline 源（`/name` 或反引号 `name` 形式），seen 防环、去重。
// bundles：{ 被引源: [伴随源...] }——同一功能对的源（grilling + grill-me）一起注入，
// 这样「本身没有独立引用者」的伴随源也有宿主，改它同样会让宿主的 manifest 过期。
function inlineRefsIn(body, sources, seen = new Set(), bundles = {}) {
  const found = new Map();
  const visit = (name) => {
    if (!sources.has(name) || seen.has(name)) return;
    const src = sources.get(name);
    seen.add(name);
    found.set(name, src);
    for (const extra of bundles[name] || []) visit(extra);
    for (const [n, s] of inlineRefsIn(src.body, sources, seen, bundles)) found.set(n, s);
  };
  for (const m of body.matchAll(INLINE_REF_RE)) visit(m[1]);
  return found;
}

// 注入模板自身的指纹：块文本、引导语、引用正则、幂等逻辑任一变更都算模板变更。
// 纳入 manifest ⇒ 只改 ship 注入逻辑、没重跑 install 时也能被 E_INLINE_STALE 挡住。
// 取相关函数的源码而非手维护版本号：改代码即改指纹，不会忘。
function inlineTemplateHash() {
  const sig = [
    buildInlineBlock.toString(), finalizeSkillContent.toString(),
    INLINE_START, INLINE_END, INLINE_REF_RE.source, INLINE_BLOCK_RE.source,
  ].join('\u0000');
  return crypto.createHash('sha256').update(sig, 'utf-8').digest('hex').slice(0, 12);
}

function inlineManifest(names, refs) {
  const sources = [...names].map((n) => `${n}=${refs.get(n).hash}`).join(' ');
  return `${sources} template=${inlineTemplateHash()}`;
}

// 生成注入块；无引用返回 null。names 按字典序固定，保证产物确定、可比对。
function buildInlineBlock(body, sources, bundles = {}) {
  const refs = inlineRefsIn(body, sources, new Set(), bundles);
  if (refs.size === 0) return null;
  const names = [...refs.keys()].sort();
  const parts = [
    INLINE_START,
    `<!-- ship:inline:manifest ${inlineManifest(names, refs)} -->`,
    '',
    '## 内联技能原文（ship install 展开 · 勿手改）',
    '',
    '以下技能不单独安装，正文在此直接给出。按本段内容执行，不要再去找同名技能文件。',
    `本技能正文与本段内出现的 ${names.map((n) => `\`/${n}\``).join('、')} 等字样是依赖标记，指本块对应的 \`###\` 段——不是要调用另一个技能文件，也不是要去加载同名技能；段与段之间互相引用同理。`,
    '改这些源技能后必须重跑 `node base/scripts/ship.mjs install`，再跑 `check` 过门禁。',
    '',
  ];
  for (const n of names) parts.push(`### ${n}`, '', refs.get(n).body.trim(), '');
  parts.push(INLINE_END, '');
  return { block: parts.join('\n'), names };
}

// 幂等注入：已有旧块先整块摘掉，再 append 当前块。
// 路由技能（config.inlineExcludeConsumers）不接收注入——它们的价值是轻量指针清单。
function finalizeSkillContent(content, body, skill, config) {
  if ((config.inlineExcludeConsumers || []).includes(skill.name)) return { content, names: [] };
  // srcMode 消费者不注入：CodeArts 派生会把正文换成英文块，掺入中文源会语言混杂。
  if (skill.srcMode) return { content, names: [] };
  const built = buildInlineBlock(body, inlineSourceMap(config), config.inlineBundles || {});
  if (!built) return { content, names: [] };
  const clean = content.replace(INLINE_BLOCK_RE, '').replace(/\s+$/, '');
  return { content: `${clean}\n\n${built.block}\n`, names: built.names };
}

// 内联源旧副本的归属判定：源改了 frontmatter 后内容指纹会变，光靠指纹认不出，
// 故补 name 自证（frontmatter / 正文）+ 安装清单 + 指纹三条腿，任一命中即认。
function looksLikeInlineRetire(entryDir, name, manifest, knownHashes) {
  const skillMd = path.join(entryDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return true;
  if (manifest && manifest.has(name)) return true;
  try {
    const raw = fs.readFileSync(skillMd, 'utf-8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fm && new RegExp(`^name:\s*${name}\s*$`, 'm').test(fm[1])) return true;
    if (raw.includes(`name: ${name}`) || raw.includes(`/${name}`)) return true;
    return knownHashes.has(sha256(skillMd));
  } catch { return false; }
}

// 漂移门禁：已安装副本里的 inline manifest 必须与当前源正文一致。
// 副本不存在（未安装 / CI）时跳过——不把「还没装」误报成漂移。
function checkInlineIntegrity(config) {
  const errors = [];
  const sources = inlineSourceMap(config);
  if (sources.size === 0) return errors;
  const bundles = config.inlineBundles || {};
  for (const [trigger, extras] of Object.entries(bundles)) {
    if (!sources.has(trigger)) errors.push(deriveError('E_INLINE_BUNDLE', trigger, '*', `inlineBundles 的键 ${trigger} 不是 x-inline 源`));
    if (!Array.isArray(extras)) { errors.push(deriveError('E_INLINE_BUNDLE', trigger, '*', `inlineBundles.${trigger} 必须是数组`)); continue; }
    for (const e of extras) if (!sources.has(e)) errors.push(deriveError('E_INLINE_BUNDLE', trigger, '*', `inlineBundles 的伴随源 ${e} 不是 x-inline 源`));
  }
  for (const [name, src] of sources) {
    if (src.srcMode) errors.push(deriveError('E_INLINE_UNSUPPORTED', src.srcPath, '*', `inline 源 ${name} 必须是 plain SKILL.md（SKILL.src.md 派生版不内联）`));
    if (extractEnBlock(src.body)) errors.push(deriveError('E_INLINE_UNSUPPORTED', src.srcPath, '*', `inline 源 ${name} 正文不得含 <!--en--> 块（派生版语言会混杂）`));
    const links = inlineLocalLinks(src.body);
    if (links.length) errors.push(deriveError('E_INLINE_LOCAL_LINK', src.srcPath, '*', `inline 源 ${name} 正文含本地相对链接 ${links.join(', ')}；内联进其它技能目录后链接会断`));
  }
  const exclude = new Set(config.inlineExcludeConsumers || []);
  const candidates = listSkillDirs(config).filter((s) => !sources.has(s.name) && !exclude.has(s.name) && getXInstall(s.srcPath) !== false);
  const checked = new Set();
  const hosted = new Set();
  for (const c of candidates) {
    let body;
    try { body = parseFrontmatter(c.srcPath).body; } catch { continue; }
    const refs = inlineRefsIn(body, sources, new Set(), bundles);
    if (refs.size === 0) continue;
    // 派生型消费者拿不到中文内联块：直接挡住，避免静默丢依赖。
    if (c.srcMode) {
      errors.push(deriveError('E_INLINE_UNSUPPORTED', c.srcPath, '*', `依赖技能 ${c.name} 是 SKILL.src.md 派生型，不能接收内联源；改为 plain SKILL.md 或去掉对 ${[...refs.keys()].join(', ')} 的引用`));
      continue;
    }
    for (const n of refs.keys()) hosted.add(n);
    const expected = inlineManifest([...refs.keys()].sort(), refs);
    // 同一消费者跨 7 家厂商只报一条：把过期目录收进同一句，不刷屏。
    const stale = [];
    let firstActual = null;
    for (const vendor of config.vendors) {
      for (const dir of [vendor.userSkills, vendor.projectSkills]) {
        if (!dir) continue;
        const dest = path.join(dir, c.name, 'SKILL.md');
        if (checked.has(dest) || !fs.existsSync(dest)) continue;
        checked.add(dest);
        let raw;
        try { raw = fs.readFileSync(dest, 'utf-8'); } catch { continue; }
        const m = raw.match(INLINE_MANIFEST_RE);
        if (!m || m[1].trim() !== expected) {
          stale.push(dest);
          if (firstActual === null) firstActual = m ? m[1].trim() : '无内联块';
        }
      }
    }
    if (stale.length) {
      errors.push(deriveError('E_INLINE_STALE', stale[0], '*',
        `依赖技能 ${c.name} 的内联副本在 ${stale.length} 处目标过期（期望 ${expected}，实际 ${firstActual}；例：${stale[0]}）。改源后重跑 node base/scripts/ship.mjs install，并复核 ${c.name} 的描述与流程是否仍与源一致`));
    }
  }
  // 无宿主的 inline 源：改了没人知道，等于把内容弄丢。
  for (const name of sources.keys()) {
    if (!hosted.has(name)) errors.push(deriveError('E_INLINE_ORPHAN', sources.get(name).srcPath, '*', `inline 源 ${name} 没有任何已安装技能引用，正文不会出现在任何宿主里；补引用或把它改回普通技能`));
  }
  return errors;
}

// ---------------------------------------------------------------- 工具函数

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function rmrf(p, guards = []) {
  const resolved = path.resolve(p);
  if (!resolved || resolved === path.parse(resolved).root) {
    throw new Error(`拒绝删除路径根: ${p}`);
  }
  for (const g of guards) {
    if (!g) continue;
    const gr = path.resolve(g);
    if (resolved === gr || gr.startsWith(resolved)) {
      throw new Error(`拒绝删除受保护目录: ${resolved}（保护根: ${gr}）`);
    }
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`源目录不存在: ${src}`);
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 复制源目录附属文件（references/ scripts/ 等），跳过源标记文件与已存在目标项
function copyAuxFiles(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === 'SKILL.src.md' || entry.name === 'AGENT.src.md') continue;
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (fs.existsSync(d)) continue;
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function hasCJK(text) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

function extractEnBlock(body) {
  const m = body.match(/<!--en-->\r?\n([\s\S]*?)\r?\n<!--\/en-->/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------- 配置

// 自动定位“用户主目录”：优先 os.homedir()，回退到 USERPROFILE/HOME 环境变量，
// 再回退到常见用户目录根部（C:\Users、/Users、/home）下首个真实存在的目录，
// 从而即使运行身份与技能实际所在用户不一致，也能自己找到用户目录。
function detectUserHome() {
  const candidates = [];
  if (os.homedir && os.homedir()) candidates.push(os.homedir());
  if (process.env.USERPROFILE) candidates.push(process.env.USERPROFILE);
  if (process.env.HOME && process.env.HOME !== process.env.USERPROFILE) candidates.push(process.env.HOME);

  const roots = [];
  if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
    roots.push(path.join(process.env.HOMEDRIVE, process.env.HOMEPATH));
  }
  if (process.platform === 'win32') {
    if (process.env.SystemDrive) roots.push(path.join(process.env.SystemDrive, 'Users'));
    roots.push('C:\\Users');
  } else {
    roots.push('/Users', '/home');
  }
  for (const root of roots) {
    try {
      for (const name of fs.readdirSync(root)) {
        const dir = path.join(root, name);
        if (name === 'Public' || name === 'All Users' || name === 'Default' || name === 'Default User') continue;
        if (fs.statSync(dir).isDirectory()) candidates.push(dir);
      }
    } catch { /* 忽略不可读的根 */ }
  }

  const seen = new Set();
  for (const dir of candidates) {
    if (!dir) continue;
    const resolved = path.resolve(dir);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (fs.existsSync(resolved)) return resolved;
  }
  // 实在找不到就退回 os.homedir()（可能不存在，但至少给出确定值）
  return path.resolve(os.homedir() || (process.env.HOME || ''));
}

// 自动定位“项目根”：优先显式 projectRoot。
// 否则：1) vendors.json 所在目录自身含标志（.git/AGENTS.md/CONTEXT.md）即项目根（嵌入式/fixture 布局）；
//      2) 向上找含 .git 的仓库根（只认 .git，不认 AGENTS.md/CONTEXT.md，避免子目录/用户主目录里的同名文件误判）；
//      3) 都未命中回退 vendors.json 所在目录。
function detectProjectRoot(configDir) {
  const start = path.resolve(configDir);
  if (fs.existsSync(path.join(start, '.git')) || fs.existsSync(path.join(start, 'AGENTS.md')) || fs.existsSync(path.join(start, 'CONTEXT.md'))) {
    return start;
  }
  let cur = start;
  for (let i = 0; i < 8; i++) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
    if (fs.existsSync(path.join(cur, '.git'))) return cur;
  }
  return start;
}

function loadConfig(configPath, userHomeOverride) {
  const configPathResolved = path.resolve(configPath);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPathResolved, 'utf-8'));
  } catch (e) {
    throw new Error(`配置文件无法读取/解析 ${configPathResolved}: ${e.message}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`配置文件必须是 JSON 对象: ${configPathResolved}`);
  }
  const configDir = path.dirname(configPathResolved);
  const userHome = userHomeOverride || detectUserHome();
  if (!fs.existsSync(userHome)) {
    throw new Error(`用户目录不存在: ${userHome}`);
  }
  const resolve = (p) => {
    if (typeof p !== 'string' || !p.trim()) throw new Error(`无效的目录配置值: ${JSON.stringify(p)}`);
    if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) return path.join(userHome, p.slice(2));
    if (p.startsWith('~')) return path.join(userHome, p.slice(1));
    if (path.isAbsolute(p)) return p;
    return path.join(configDir, p);
  };

  const projectRoot = raw.projectRoot ? path.resolve(configDir, raw.projectRoot) : detectProjectRoot(configDir);
  if (!fs.existsSync(projectRoot)) {
    throw new Error(`项目根不存在: ${projectRoot}（可在 vendors.json 配置 projectRoot 覆盖）`);
  }
  // 项目级路径必须落在项目根内，防止越界写/清
  const assertInside = (child, label) => {
    const rel = path.relative(projectRoot, child);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`${label} 越出项目根: ${child}（项目根: ${projectRoot}）`);
    }
  };

  const skillsBase = path.join(configDir, raw.skillsSource || 'skills');
  const agentsBase = raw.agentsSource ? path.join(configDir, raw.agentsSource) : null;
  const buckets = Array.isArray(raw.buckets) ? raw.buckets : [];
  const managedPrefixes = Array.isArray(raw.managedPrefixes) ? raw.managedPrefixes : [];
  if (managedPrefixes.length === 0) {
    console.warn('[warn] managedPrefixes 为空，残留清理将不生效');
  }
  const vendors = Object.entries(raw.vendors || {}).map(([id, v]) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      throw new Error(`vendors.${id} 配置必须是对象`);
    }
    const vendor = {
      id,
      label: v.label || id,
      derive: !!v.derive,
      userSkills: v.user?.skills ? resolve(v.user.skills) : null,
      userAgents: v.user?.agents ? resolve(v.user.agents) : null,
      projectSkills: v.project?.skills ? path.join(projectRoot, v.project.skills) : null,
      projectAgents: v.project?.agents ? path.join(projectRoot, v.project.agents) : null,
    };
    if (vendor.projectSkills) assertInside(vendor.projectSkills, `vendors.${id}.project.skills`);
    if (vendor.projectAgents) assertInside(vendor.projectAgents, `vendors.${id}.project.agents`);
    return vendor;
  });
  if (vendors.length === 0) {
    console.warn('[warn] vendors 为空，无目标平台');
  }
  return {
    configDir,
    projectRoot,
    userHome,
    buckets,
    managedPrefixes,
    preserveOnInstall: raw.preserveOnInstall && typeof raw.preserveOnInstall === 'object' && !Array.isArray(raw.preserveOnInstall) ? raw.preserveOnInstall : {},
    // 上游自带安装器维护的目标：<技能名>: [vendorId...]。这些目录由第三方应用写入（可能带只读 ACL），
    // 本仓安装器不碰，记为 skipped 而非失败——否则每次 install 都因 EPERM 报错。
    foreignInstalled: raw.foreignInstalled && typeof raw.foreignInstalled === 'object' && !Array.isArray(raw.foreignInstalled) ? raw.foreignInstalled : {},
    skillsBase,
    agentsBase,
    inlineExcludeConsumers: Array.isArray(raw.inlineExcludeConsumers) ? raw.inlineExcludeConsumers : [],
    inlineBundles: raw.inlineBundles && typeof raw.inlineBundles === 'object' && !Array.isArray(raw.inlineBundles) ? raw.inlineBundles : {},
    vendors,
  };
}

// ---------------------------------------------------------------- 源发现

function listSkillDirs(config) {
  const result = [];
  for (const bucket of config.buckets) {
    const base = path.join(config.skillsBase, bucket);
    if (!fs.existsSync(base)) continue;
    let entries;
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch (e) {
      console.warn(`[warn] 无法读取技能桶目录 ${base}: ${e.message}`);
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(base, entry.name);
      if (fs.existsSync(path.join(dir, 'SKILL.src.md'))) {
        result.push({ name: entry.name, dir, srcPath: path.join(dir, 'SKILL.src.md'), srcMode: true, bucket });
      } else if (fs.existsSync(path.join(dir, 'SKILL.md'))) {
        result.push({ name: entry.name, dir, srcPath: path.join(dir, 'SKILL.md'), srcMode: false, bucket });
      }
    }
  }
  return result;
}

function listAgents(config) {
  if (!config.agentsBase || !fs.existsSync(config.agentsBase)) return [];
  const result = [];
  let entries;
  try {
    entries = fs.readdirSync(config.agentsBase, { withFileTypes: true });
  } catch (e) {
    console.warn(`[warn] 无法读取 agent 目录 ${config.agentsBase}: ${e.message}`);
    return [];
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const file = path.join(config.agentsBase, entry.name);
      result.push({ name: entry.name.replace(/\.md$/, ''), file, srcMode: false });
    } else if (entry.isDirectory()) {
      const src = path.join(config.agentsBase, entry.name, 'AGENT.src.md');
      if (fs.existsSync(src)) result.push({ name: entry.name, file: src, dir: path.join(config.agentsBase, entry.name), srcMode: true });
    }
  }
  return result;
}

// x-install 取值归一化。YAML 允许 `x-install: false   # 说明` 这种行尾注释，
// 但子集解析器 parseScalar 会把它整体当字符串（"false   # 说明"），
// 于是 `v === false` 不成立、静默退回 'user'——`kimi-webbridge` 因此被误分发到 7 家平台
// （2026-10-26 安全审查 SEC-02）。这里先剥注释再比较，两条解析路径共用。
function normalizeXInstallValue(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === null || v === undefined) return '';
  let s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim();
  const hash = s.indexOf(' #');
  if (hash >= 0) s = s.slice(0, hash).trim();
  return s.toLowerCase();
}

// x-install 语义：缺省 / true → 'user'（用户级 + 项目级均装）；'project' → 仅项目级；false → 不装
function getXInstall(filePath) {
  if (getXInline(filePath)) return false; // x-inline 源不单独安装
  let meta = {};
  try {
    meta = parseFrontmatter(filePath).meta || {};
  } catch {
    // 子集 YAML 解析器对部分合法 frontmatter（如多行 flow 序列）会抛错；
    // 安装决策只需 x-install，退化为正则提取，不影响派生引擎（派生只针对可正常解析的 src 技能）。
    const raw = fs.readFileSync(filePath, 'utf-8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (fm) {
      const line = fm[1].split(/\r?\n/).find((l) => /^\s*x-install\s*:/.test(l));
      if (line) {
        const v = normalizeXInstallValue(line.split(/:/).slice(1).join(':').trim());
        if (v === 'false') return false;
        if (v === 'project') return 'project';
        if (v === 'true') return 'user';
      }
    }
  }
  const v = normalizeXInstallValue(meta['x-install']);
  if (v === 'false') return false;
  if (v === 'project') return 'project';
  return 'user';
}

// 安装目标：'user' 级技能在用户级与项目级都装；'project' 级技能仅项目级装；false 不装
// 按 vendor 排除清单：agent/技能 frontmatter 的 x-skip-vendors: [vendorId,...] 表示
// 不安装到列出的 vendor（用于「普通 .md agent 原样复制到所有用户级目录」时排除个别 vendor）。
// 只依赖 x-skip-vendors，退回正则提取以便普通 .md 也能生效。
function getSkipVendors(filePath) {
  let meta = {};
  try {
    meta = parseFrontmatter(filePath).meta || {};
  } catch {
    const raw2 = fs.readFileSync(filePath, 'utf-8');
    const fm = raw2.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (fm) {
      const line = fm[1].split(/\r?\n/).find((l) => /^\s*x-skip-vendors\s*:/.test(l));
      if (line) {
        const v = line.split(/:/).slice(1).join(':').trim();
        return v
          .replace(/^\s*\[/, '')
          .replace(/]\s*$/, '')
          .split(/,/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return [];
  }
  const v = meta['x-skip-vendors'];
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}
function shouldInstallForTarget(xInstallValue, projectTarget) {
  if (xInstallValue === false) return false;
  if (xInstallValue === 'project') return projectTarget === true;
  return true;
}

// ---------------------------------------------------------------- 派生

function deriveError(code, file, vendor, detail) {
  return { code, file, vendor, detail };
}

// Kimi Work 技能风格：frontmatter 只保留 name + description（与其内置技能一致），
// 剥掉 x-install / x-vendors / metadata.version 等分发元数据。
function kimiStyleFrontmatter(name, meta) {
  const description = typeof meta.description === 'string' ? meta.description : '';
  return { name, description };
}

function deriveSkill(vendor, skill, config) {
  let parsed;
  try {
    parsed = parseFrontmatter(skill.srcPath);
  } catch (e) {
    return { error: deriveError('E_PARSE', skill.srcPath, vendor.id, `frontmatter 解析失败: ${e.message}`) };
  }
  const { meta, body } = parsed;
  const xv = meta['x-vendors'] || {};
  const common = stripXVendors(meta);
  if (!vendor.derive) {
    // 未调研厂商：透传派生（剥 x-vendors/x-install，其余原样）
    return { name: skill.name, frontmatter: common, body, mode: 'passthrough' };
  }
  switch (vendor.id) {
    case 'kimi': {
      return { name: skill.name, frontmatter: kimiStyleFrontmatter(skill.name, common), body, mode: 'derive' };
    }
    case 'opencode': {
      delete common.name;
      return { name: skill.name, frontmatter: common, body, mode: 'derive' };
    }
    case 'codebuddy': {
      common.name = skill.name;
      Object.assign(common, xv.codebuddy || {});
      return { name: skill.name, frontmatter: common, body, mode: 'derive' };
    }
    case 'codearts': {
      const ca = xv.codearts || {};
      const enDesc = ca['description-en'];
      if (!enDesc) return { error: deriveError('E_CODEARTS_DESCRIPTION', skill.srcPath, 'codearts', '缺少 x-vendors.codearts.description-en（5 行编号列表）') };
      const enBody = extractEnBlock(body);
      if (!enBody) {
        if (hasCJK(body)) return { error: deriveError('E_CODEARTS_EN_BODY', skill.srcPath, 'codearts', '正文含中文且缺少 <!--en--> 英文块') };
        return { name: `huawei-cloud-${ca.product || 'codebuddy'}-${skill.name}`, frontmatter: { name: `huawei-cloud-${ca.product || 'codebuddy'}-${skill.name}`, description: enDesc, tags: ca.tags || [skill.name] }, body, mode: 'derive' };
      }
      return { name: `huawei-cloud-${ca.product || 'codebuddy'}-${skill.name}`, frontmatter: { name: `huawei-cloud-${ca.product || 'codebuddy'}-${skill.name}`, description: enDesc, tags: ca.tags || [skill.name] }, body: enBody, mode: 'derive' };
    }
    case 'trae': {
      common.name = skill.name;
      Object.assign(common, xv.trae || {});
      return { name: skill.name, frontmatter: common, body, mode: 'derive' };
    }
    default:
      return { name: skill.name, frontmatter: common, body, mode: 'passthrough' };
  }
}

function deriveAgent(vendor, agent, config) {
  if (!agent.srcMode) {
    // 普通 .md：原样复制（无派生）
    return { copy: true };
  }
  let parsed;
  try {
    parsed = parseFrontmatter(agent.file);
  } catch (e) {
    return { error: deriveError('E_PARSE', agent.file, vendor.id, `frontmatter 解析失败: ${e.message}`) };
  }
  const { meta, body } = parsed;
  const xv = meta['x-vendors'] || {};
  const common = stripXVendors(meta);
  if (!vendor.derive) {
    const fm = { ...common, name: agent.name };
    return { name: agent.name, frontmatter: fm, body, mode: 'passthrough' };
  }
  switch (vendor.id) {
    case 'kimi': {
      return { name: agent.name, frontmatter: kimiStyleFrontmatter(agent.name, common), body, mode: 'derive' };
    }
    case 'opencode': {
      delete common.name;
      return { name: agent.name, frontmatter: common, body, mode: 'derive' };
    }
    case 'codebuddy': {
      common.name = agent.name;
      Object.assign(common, xv.codebuddy || {});
      return { name: agent.name, frontmatter: common, body, mode: 'derive' };
    }
    case 'codearts': {
      const ca = xv.codearts || {};
      const enDesc = ca['description-en'];
      if (!enDesc) return { error: deriveError('E_CODEARTS_DESCRIPTION', agent.file, 'codearts', '缺少 x-vendors.codearts.description-en（5 行编号列表）') };
      const enBody = extractEnBlock(body);
      if (!enBody) {
        if (hasCJK(body)) return { error: deriveError('E_CODEARTS_EN_BODY', agent.file, 'codearts', '正文含中文且缺少 <!--en--> 英文块') };
        return { name: `huawei-cloud-${ca.product || 'codebuddy'}-${agent.name}`, frontmatter: { name: `huawei-cloud-${ca.product || 'codebuddy'}-${agent.name}`, description: enDesc, tags: ca.tags || [agent.name] }, body, mode: 'derive' };
      }
      return { name: `huawei-cloud-${ca.product || 'codebuddy'}-${agent.name}`, frontmatter: { name: `huawei-cloud-${ca.product || 'codebuddy'}-${agent.name}`, description: enDesc, tags: ca.tags || [agent.name] }, body: enBody, mode: 'derive' };
    }
    case 'trae': {
      common.name = agent.name;
      Object.assign(common, xv.trae || {});
      return { name: agent.name, frontmatter: common, body, mode: 'derive' };
    }
    default:
      return { name: agent.name, frontmatter: common, body, mode: 'passthrough' };
  }
}

function renderDerived(d) {
  return renderDoc(d.frontmatter, d.body);
}

// ---------------------------------------------------------------- derive 子命令

function runDerive(config, { dryRun }) {
  const plan = [];
  const errors = [];
  const derivedSkills = []; // { skill, vendor, d }，供辅助文件复制复用，避免重复派生

  for (const skill of listSkillDirs(config)) {
    if (!skill.srcMode) continue;
    if (getXInstall(skill.srcPath) === false) continue; // x-install: false 技能跳过派生
    for (const vendor of config.vendors) {
      const d = deriveSkill(vendor, skill, config);
      derivedSkills.push({ skill, vendor, d });
      if (d.error) { errors.push(d.error); continue; }
      plan.push({ kind: 'skill', skill: skill.name, vendor: vendor.id, file: `${d.name}/SKILL.md`, render: () => finalizeSkillContent(renderDerived(d), d.body, skill, config).content });
    }
  }
  for (const agent of listAgents(config)) {
    if (!agent.srcMode) continue;
    if (getXInstall(agent.file) === false) continue; // x-install: false agent 跳过派生
    for (const vendor of config.vendors) {
      const d = deriveAgent(vendor, agent, config);
      if (d.error) { errors.push(d.error); continue; }
      plan.push({ kind: 'agent', skill: agent.name, vendor: vendor.id, file: `${d.name}.md`, render: () => renderDerived(d) });
    }
  }

  if (!dryRun) {
    for (const item of plan) {
      const rel = path.join('.generated', item.vendor, item.file);
      const abs = path.join(config.configDir, rel);
      try {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, item.render(), 'utf-8');
      } catch (e) {
        errors.push(deriveError('E_WRITE', rel, item.vendor, `写入失败: ${e.message}`));
        continue;
      }
      item.generatedPath = abs;
    }
    // 复制辅助文件（references/ scripts/ 等）到派生目录，保证 .generated 可整体作为技能目录
    for (const { skill, vendor, d } of derivedSkills) {
      if (d.error) continue;
      const destDir = path.join(config.configDir, '.generated', vendor.id, d.name);
      try {
        copyAuxFiles(skill.dir, destDir);
      } catch (e) {
        errors.push(deriveError('E_COPY', destDir, vendor.id, `辅助文件复制失败: ${e.message}`));
      }
    }
  }
  return { plan, errors };
}

// 安装时保护「技能运行时状态」子目录（如 quarkclouddrive 的登录态 deepseek/）。
// 直拷分支会 rmrf 整个目标目录再复制，状态目录必须先进临时区暂存、覆盖完再放回。
function stashPreserved(destDir, rels) {
  const stashes = [];
  for (const rel of rels) {
    const p = path.join(destDir, rel);
    if (!fs.existsSync(p)) continue;
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-preserve-'));
    const tmp = path.join(tmpRoot, 'payload');
    try {
      fs.renameSync(p, tmp);
    } catch {
      copyDir(p, tmp);
      fs.rmSync(p, { recursive: true, force: true });
    }
    stashes.push({ rel, from: tmp, tmpRoot });
  }
  return stashes;
}
function restorePreserved(destDir, stashes) {
  for (const s of stashes) {
    const dest = path.join(destDir, s.rel);
    try {
      fs.rmSync(dest, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try {
        fs.renameSync(s.from, dest);
      } catch {
        copyDir(s.from, dest);
      }
    } finally {
      try { fs.rmSync(s.tmpRoot, { recursive: true, force: true }); } catch { /* 忽略清理失败 */ }
    }
  }
}

// ---------------------------------------------------------------- install

function targetSkillsDir(config, vendor, project) {
  return project ? vendor.projectSkills : vendor.userSkills;
}
function targetAgentsDir(config, vendor, project) {
  return project ? vendor.projectAgents : vendor.userAgents;
}

// 安装清单：记录本仓往这个 skills 目录装过哪些名字（残留清理的归属判据，SEC-03）。
// 只看 managedPrefixes 前缀会删掉用户自建的同名开头技能（实测 jxx-my-own-skill 被删）。
// 清单存在 => 只清理清单里的名字；清单缺失（升级后第一次跑）=> 回退到内容指纹判定，
// 仍不认的目录一律保留——宁可留一份旧残留（下次起被清单覆盖），也不误删用户技能。
const INSTALL_MANIFEST = '.ship-installed.json';

function readInstallManifest(skillsTarget) {
  try {
    const p = path.join(skillsTarget, INSTALL_MANIFEST);
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return Array.isArray(data && data.names) ? new Set(data.names) : null;
  } catch {
    return null;
  }
}

function writeInstallManifest(skillsTarget, names) {
  try {
    const p = path.join(skillsTarget, INSTALL_MANIFEST);
    const prev = readInstallManifest(skillsTarget) || new Set();
    const merged = Array.from(new Set([...prev, ...names])).sort();
    fs.writeFileSync(p, JSON.stringify({ updatedAt: new Date().toISOString(), names: merged }, null, 2) + '\n', 'utf-8');
  } catch { /* 清单写失败不影响安装，只是下次清理更保守 */ }
}

// 无清单时的回退判据：内容指纹。目录里没有 SKILL.md（空目录/半次安装残骸）按残留处理。
function looksInstalledByThisRepo(destDir, knownHashes) {
  const skillMd = path.join(destDir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) return true;
  try {
    return knownHashes.has(sha256(skillMd));
  } catch {
    return false;
  }
}

function runInstall(config, { dryRun, project }) {
  const installed = []; // { dest, expectedHash }
  const skipped = [];
  const failures = [];
  const inlined = []; // { skill, names }，供 CLI 打印内联摘要

  const allSkills = listSkillDirs(config);
  const skills = allSkills.filter((s) => shouldInstallForTarget(getXInstall(s.srcPath), project));
  // 残留清理依据“源中全部技能”，而非“本次应装的技能”，
  // 避免误删 x-install: project / false 的已装目录（它们在本次目标级别本就不装）。
  // 名字须按“该厂商的落盘名”算：src 技能经派生可能改名（如 CodeArts 的 huawei-cloud-<product>- 前缀），
  // 只比源目录名会把刚装好的派生副本当残留删掉（本仓 tool-intro 迁移前踩过）。
  // x-inline 源不进「当前应存在」集合：它已不再单独安装，旧副本由下方残留清理收走。
  const expectedNamesFor = (vendor) => new Set(allSkills.filter((s) => !getXInline(s.srcPath)).map((s) => {
    if (!s.srcMode) return s.name;
    const d = deriveSkill(vendor, s, config);
    return d.error ? s.name : d.name;
  }));
  // 残留下的「本仓产物」指纹表（每个厂商一份，惰性计算）。
  // 收录：源 SKILL.md / SKILL.src.md 原文哈希 + 该厂商派生渲染结果的哈希。
  const knownHashesCache = new Map();
  const knownHashesFor = (vendor) => {
    if (knownHashesCache.has(vendor.id)) return knownHashesCache.get(vendor.id);
    const set = new Set();
    for (const s of allSkills) {
      for (const f of [s.srcPath, path.join(s.dir, 'SKILL.md')]) {
        try { if (fs.existsSync(f)) set.add(sha256(f)); } catch { /* 忽略读失败 */ }
      }
      if (s.srcMode) {
        const d = deriveSkill(vendor, s, config);
        if (!d.error) {
          try { set.add(crypto.createHash('sha256').update(renderDerived(d), 'utf-8').digest('hex')); } catch { /* 忽略渲染失败 */ }
        }
      }
    }
    knownHashesCache.set(vendor.id, set);
    return set;
  };
  // 危险操作护栏：禁止 rmrf 这些根目录自身或其祖先
  const guards = [config.configDir, config.projectRoot, config.skillsBase, config.agentsBase, config.userHome];
  const inlineSourceNames = new Set(inlineSourceMap(config).keys());

  for (const vendor of config.vendors) {
    const skillsTarget = targetSkillsDir(config, vendor, project);
    if (skillsTarget) {
      for (const skill of skills) {
        if (skill.srcMode) {
          const d = deriveSkill(vendor, skill, config);
          if (d.error) {
            failures.push({ ...d.error, action: `skip ${vendor.label} install of ${skill.name}` });
            continue;
          }
          let content;
          try {
            const fin = finalizeSkillContent(renderDerived(d), d.body, skill, config);
            content = fin.content;
            if (fin.names.length) inlined.push({ skill: skill.name, names: fin.names });
          } catch (e) {
            failures.push({ code: 'E_RENDER', file: skill.srcPath, vendor: vendor.id, detail: `派生渲染失败: ${e.message}`, action: `skip ${vendor.label} install of ${skill.name}` });
            continue;
          }
          const destDir = path.join(skillsTarget, d.name);
          const destFile = path.join(destDir, 'SKILL.md');
          const expected = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
          if (!dryRun) {
            try {
              fs.mkdirSync(destDir, { recursive: true });
              fs.writeFileSync(destFile, content, 'utf-8');
              copyAuxFiles(skill.dir, destDir);
            } catch (e) {
              failures.push({ code: 'E_WRITE', file: destFile, vendor: vendor.id, detail: `写入失败: ${e.message}`, action: `skip ${vendor.label} install of ${skill.name}` });
              continue;
            }
          }
          installed.push({ dest: destFile, expectedHash: expected, vendor: vendor.id, skillsTarget });
        } else {
          const destDir = path.join(skillsTarget, skill.name);
          const foreign = (config.foreignInstalled || {})[skill.name] || [];
          if (foreign.includes(vendor.id)) {
            skipped.push(`${vendor.label}: ${skill.name} 由上游安装器维护（${destDir}），本仓跳过`);
            continue;
          }
          // Kimi Work 风格适配：普通 SKILL.md 也把 frontmatter 归一化为 name + description；
          // 解析失败则回退原样复制（与透传派生行为一致）。
          let kimiContent = null;
          if (vendor.id === 'kimi') {
            try {
              const parsed = parseFrontmatter(skill.srcPath);
              kimiContent = renderDoc(kimiStyleFrontmatter(skill.name, parsed.meta), parsed.body);
            } catch (e) {
              failures.push({ code: 'E_PARSE', file: skill.srcPath, vendor: vendor.id, detail: `Kimi 归一化失败，回退原样复制: ${e.message}`, action: `fallback raw copy for ${skill.name}` });
            }
          }
          const preserveRels = (config.preserveOnInstall || {})[skill.name] || [];
          // 内联注入按「最终内容」算：srcMode / kimi / plain 三条路先得出应有文本，
          // 再写盘并据此算 expectedHash；dry-run 也用同一份文本做预览基准。
          const baseContent = kimiContent !== null ? kimiContent : fs.readFileSync(skill.srcPath, 'utf-8');
          let baseBody;
          try { baseBody = parseFrontmatter(skill.srcPath).body; } catch { baseBody = baseContent.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''); }
          const fin = finalizeSkillContent(baseContent, baseBody, skill, config);
          const finalContent = fin.content;
          if (fin.names.length) inlined.push({ skill: skill.name, names: fin.names });
          let stashes = [];
          if (!dryRun) {
            try {
              stashes = stashPreserved(destDir, preserveRels);
              if (kimiContent !== null) {
                fs.mkdirSync(destDir, { recursive: true });
                fs.writeFileSync(path.join(destDir, 'SKILL.md'), kimiContent, 'utf-8');
                copyAuxFiles(skill.dir, destDir);
              } else {
                rmrf(destDir, guards);
                copyDir(skill.dir, destDir);
              }
              if (finalContent !== baseContent) fs.writeFileSync(path.join(destDir, 'SKILL.md'), finalContent, 'utf-8');
            } catch (e) {
              restorePreserved(destDir, stashes);
              failures.push({ code: 'E_INSTALL', file: destDir, vendor: vendor.id, detail: `安装失败: ${e.message}`, action: `skip ${vendor.label} install of ${skill.name}` });
              continue;
            }
            restorePreserved(destDir, stashes);
          }
          const expectedHash = crypto.createHash('sha256').update(finalContent, 'utf-8').digest('hex');
          installed.push({ dest: path.join(destDir, 'SKILL.md'), expectedHash, vendor: vendor.id, skillsTarget });
        }
      }
    }

    // 残留清理（仅 skills 目录，只动 managedPrefixes 前缀）
    // 归属判据（2026-10-26 安全审查 SEC-03）：光看前缀会删掉用户自建的同名开头技能
    // （实测 jxx-my-own-skill / tdai-my-own-skill）。只有「本仓曾经装过」的才算残留——
    // 判据优先用安装清单（.ship-installed.json），无清单时回退内容指纹；两样都不认的一律不碰。
    if (skillsTarget && fs.existsSync(skillsTarget) && !dryRun) {
      const expectedNames = expectedNamesFor(vendor);
      const manifest = readInstallManifest(skillsTarget);
      const installedNames = [];
      for (const entry of fs.readdirSync(skillsTarget, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        // 先登记「当前应存在的名字」——清单必须记全量，不能只记前缀命中的，
        // 否则 kb-router / lexiang 这类无前缀技能永远进不了清单，以后就再也清不掉。
        if (expectedNames.has(entry.name)) { installedNames.push(entry.name); continue; }
        if (!config.managedPrefixes.some((p) => entry.name.startsWith(p))) continue;
        const entryDir = path.join(skillsTarget, entry.name);
        // x-inline 源的旧副本：源已不再安装，这里主动收走（环境里的技能列表因此变少）。
        // 归属判据比指纹宽一档：源改了 frontmatter 后指纹会变，靠 SKILL.md 的 name 自证。
        if (inlineSourceNames.has(entry.name)) {
          if (looksLikeInlineRetire(entryDir, entry.name, manifest, knownHashesFor(vendor))) {
            try {
              rmrf(entryDir, guards);
              skipped.push(`cleaned inline-source ${entry.name} from ${vendor.label}（已内联进引用技能，不再单独安装）`);
            } catch (e) {
              failures.push({ code: 'E_CLEAN', file: entryDir, vendor: vendor.id, detail: `inline 源旧副本清理失败: ${e.message}`, action: 'continue' });
            }
          } else {
            skipped.push(`keep ${entry.name} from ${vendor.label}（不像本仓 inline 源旧副本，视为用户自有技能）`);
          }
          continue;
        }
        // 空目录 / 没有入口文件 ⇒ 必然是装了一半的残骸（用户技能一定带 SKILL.md）
        const hasEntry = fs.existsSync(path.join(entryDir, 'SKILL.md'));
        if (hasEntry) {
          const owned = manifest ? manifest.has(entry.name) : looksInstalledByThisRepo(entryDir, knownHashesFor(vendor));
          if (!owned) {
            skipped.push(`keep ${entry.name} from ${vendor.label}（前缀像本仓、但不是本仓装的 ⇒ 视为用户自有技能，不清理）`);
            continue;
          }
        }
        try {
          rmrf(entryDir, guards);
        } catch (e) {
          failures.push({ code: 'E_CLEAN', file: entryDir, vendor: vendor.id, detail: `残留清理失败: ${e.message}`, action: 'continue' });
          continue;
        }
        skipped.push(`cleaned ${entry.name} from ${vendor.label}`);
      }
      // 清单只记「本次仍存在」的名字：已装但被清掉的自然退出，下次不再需要前缀兜底。
      writeInstallManifest(skillsTarget, installedNames);
    }
  }

  // Agent 分发
const allAgents = listAgents(config).filter((a) => shouldInstallForTarget(getXInstall(a.file), project));
const skipVendorMap = new Map(allAgents.map((a) => [a.name, getSkipVendors(a.file)]));
  for (const vendor of config.vendors) {
  const agents = allAgents.filter((a) => !(skipVendorMap.get(a.name) || []).includes(vendor.id));
  if (agents.length === 0) {
    skipped.push(`agents all skipped for ${vendor.label} (x-skip-vendors)`);
    continue;
  }
    const agentsTarget = targetAgentsDir(config, vendor, project);
    if (!agentsTarget) {
      skipped.push(`agents dir not declared for ${vendor.label} — skipped`);
      continue;
    }
    for (const agent of agents) {
      if (!agent.srcMode) {
        const destFile = path.join(agentsTarget, path.basename(agent.file));
        if (!dryRun) {
          try {
            fs.mkdirSync(agentsTarget, { recursive: true });
            fs.copyFileSync(agent.file, destFile);
          } catch (e) {
            failures.push({ code: 'E_COPY', file: destFile, vendor: vendor.id, detail: `复制失败: ${e.message}`, action: `skip ${vendor.label} install of ${agent.name}` });
            continue;
          }
        }
        installed.push({ dest: destFile, expectedHash: sha256(agent.file) });
      } else {
        const d = deriveAgent(vendor, agent, config);
        if (d.error) {
          failures.push({ ...d.error, action: `skip ${vendor.label} install of ${agent.name}` });
          continue;
        }
        let content;
        try {
          content = renderDerived(d);
        } catch (e) {
          failures.push({ code: 'E_RENDER', file: agent.file, vendor: vendor.id, detail: `派生渲染失败: ${e.message}`, action: `skip ${vendor.label} install of ${agent.name}` });
          continue;
        }
        const destFile = path.join(agentsTarget, `${d.name}.md`);
        const expected = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
        if (!dryRun) {
          try {
            fs.mkdirSync(agentsTarget, { recursive: true });
            fs.writeFileSync(destFile, content, 'utf-8');
          } catch (e) {
            failures.push({ code: 'E_WRITE', file: destFile, vendor: vendor.id, detail: `写入失败: ${e.message}`, action: `skip ${vendor.label} install of ${agent.name}` });
            continue;
          }
        }
        installed.push({ dest: destFile, expectedHash: expected });
      }
    }
  }

  // 内联摘要按「技能 + 源集合」去重：多家厂商各装一次，只报一行。
  const inlineSummary = [...new Map(inlined.map((i) => [`${i.skill}|${i.names.join(',')}`, i])).values()];
  return { installed, skipped, failures, inlined: inlineSummary };
}

// ---------------------------------------------------------------- verify

// 共享目标目录的最终写入者判定：同一 dest 可能被多家 vendor 先后写入
// （如 opencode 与 kimi 都指向 ~/.agents/skills，kimi 后写并归一化 frontmatter），
// 后写者覆盖先写者。此时只有「最后写入者」的派生基准与磁盘一致，
// 若按每家各自基准校验，先写者永远误报 MISMATCH——那是覆盖噪音，不是真实失配。
// 因此：共目录场景只让最后写入者的基准参与校验，先写者的条目跳过（其结果已被覆盖，无校验意义）。
function lastWriterByDest(installed) {
  const last = new Map();
  for (const item of installed) {
    if (!item || !item.dest) continue;
    last.set(item.dest, item);
  }
  return last;
}

function runVerify(config, installed) {
  const results = [];
  const lastWriters = lastWriterByDest(installed);
  for (const item of installed) {
    if (!item || !item.dest || !item.expectedHash) continue;
    if (item !== lastWriters.get(item.dest)) {
      // 该 dest 还有后写者；其结果由后写者代表，避免重复/误导
      continue;
    }
    if (!fs.existsSync(item.dest)) {
      results.push({ dest: item.dest, status: 'MISSING', vendor: item.vendor });
      continue;
    }
    let actual;
    try {
      actual = sha256(item.dest);
    } catch (e) {
      results.push({ dest: item.dest, status: 'ERROR', detail: e.message, vendor: item.vendor });
      continue;
    }
    results.push({
      dest: item.dest,
      status: actual === item.expectedHash ? 'OK' : 'MISMATCH',
      vendor: item.vendor,
    });
  }
  return results;
}

// ---------------------------------------------------------------- check

// 未安装技能索引新鲜度：卸载/新增技能或改过 description 后没重跑生成器，
// jxx-ask-matt 的索引就会指向错的状态——归入 check 门禁挡住。
// 用子进程保持生成器 CLI 可单独运行的契约。
function runAskMattIndexGate() {
  const tool = path.join(__dirname, 'ask-matt-index.mjs');
  if (!fs.existsSync(tool)) return [];
  const res = spawnSync(process.execPath, [tool, '--check'], { encoding: 'utf-8' });
  if (res.status === 0) return [];
  return [{
    code: 'E_ASK_MATT_INDEX', vendor: '*',
    file: path.join(__dirname, '..', 'skills', 'engineering', 'jxx-ask-matt', 'references', 'not-installed-skills.md'),
    detail: `jxx-ask-matt 的未安装技能索引过期：${String(res.stdout || '').trim()}（跑 node base/scripts/ask-matt-index.mjs 刷新）`,
  }];
}

// 技能宪章机器闸：ship check 顺带跑 skill-lint，任何 P0（frontmatter 解析不出
// name/description、技能目录缺入口文件）都算分发链硬故障，必须挡住。
// 用子进程而非 import：skill-lint 是独立 CLI，保持其可单独运行的契约不变。
function runSkillLintGate(config) {
  const lintPath = path.join(__dirname, 'skill-lint.mjs');
  if (!fs.existsSync(lintPath)) return [];
  const skillsBase = config.skillsBase;
  const res = spawnSync(process.execPath, [lintPath, '--strict', '--root', skillsBase], { encoding: 'utf-8' });
  if (res.status === 0) return [];
  const out = String(res.stderr || '') + String(res.stdout || '');
  const m = out.match(/存在 P0 级发现（(\d+) 条）/);
  const count = m ? m[1] : '?';
  return [{ code: 'E_SKILL_P0', vendor: '*', file: skillsBase, detail: `skill-lint --strict 报 ${count} 条 P0（frontmatter 解析失败或技能目录缺入口文件），详见 node base/scripts/skill-lint.mjs --strict` }];
}

// description 预算与调用策略是独立硬契约；第三方 description 超长仅 warning，不进入 errors。
function runSkillContractGate(config) {
  const tool = path.join(__dirname, 'skill-contract.mjs');
  if (!fs.existsSync(tool)) return [];
  const res = spawnSync(process.execPath, [tool, '--root', config.skillsBase, '--json'], { encoding: 'utf-8' });
  if (res.status === 0) return [];
  let detail = String(res.stderr || res.stdout || res.error || 'skill-contract 执行失败').trim();
  try {
    const report = JSON.parse(res.stdout);
    detail = report.errors.map((item) => `${item.code} ${item.skill || ''}: ${item.message}`).join('；');
  } catch {
    // 非 JSON 故障保留原输出，便于定位扫描或进程错误。
  }
  return [{ code: 'E_SKILL_CONTRACT', vendor: '*', file: config.skillsBase, detail }];
}

function runCheck(config) {
  const errors = [];
  const { errors: deriveErrors } = runDerive(config, { dryRun: true });
  errors.push(...deriveErrors);
  errors.push(...checkInlineIntegrity(config));
  errors.push(...runAskMattIndexGate());
  errors.push(...runSkillLintGate(config));
  errors.push(...runSkillContractGate(config));
  return errors;
}

// ---------------------------------------------------------------- init

function runInit({ type, name, bucket, config }) {
  if (!type || !name) {
    return { error: '用法: ship init --type skill|agent --name <name> [--bucket <bucket>]' };
  }
  if (type !== 'skill' && type !== 'agent') {
    return { error: `未知 type: ${type}（仅支持 skill / agent）` };
  }
  if (!NAME_RE.test(name) || name.length > 64) {
    return { error: `非法 name: ${name}（须匹配 ^[a-z0-9]+(-[a-z0-9]+)*$ 且 ≤64）` };
  }
  let targetDir;
  let tplPath;
  if (type === 'skill') {
    const b = bucket || 'productivity';
    if (config.buckets.length > 0 && !config.buckets.includes(b)) {
      return { error: `未知 bucket: ${b}（可用: ${config.buckets.join(', ')}）` };
    }
    targetDir = path.join(config.skillsBase, b, name);
    tplPath = path.join(__dirname, 'templates', 'skill', 'SKILL.src.md');
  } else {
    if (!config.agentsBase) {
      return { error: 'vendors.json 未配置 agentsSource，无法创建 agent' };
    }
    targetDir = path.join(config.agentsBase, name);
    tplPath = path.join(__dirname, 'templates', 'agent', 'AGENT.src.md');
  }
  if (fs.existsSync(targetDir)) {
    return { error: `目录已存在: ${targetDir}` };
  }
  if (!fs.existsSync(tplPath)) {
    return { error: `模板不存在: ${tplPath}` };
  }
  try {
    let tpl = fs.readFileSync(tplPath, 'utf-8');
    tpl = tpl.replaceAll('__NAME__', name);
    fs.mkdirSync(targetDir, { recursive: true });
    const outFile = path.join(targetDir, type === 'skill' ? 'SKILL.src.md' : 'AGENT.src.md');
    fs.writeFileSync(outFile, tpl, 'utf-8');
    return { ok: true, file: outFile };
  } catch (e) {
    return { error: `创建失败: ${e.message}` };
  }
}

// ---------------------------------------------------------------- CLI

function usage() {
  return `用法: ship.mjs [选项] [子命令]

子命令（缺省 = 全流程：派生 + 安装 + 验证 + 清理）：
  init       从模板生成技能/agent 源文件骨架
  derive     将含 SKILL.src.md / AGENT.src.md 的源派生到 .generated/<vendor>/
  install    安装到各平台目标目录（含验证与残留清理）
  check      预检全部门禁与派生，失败则非零退出

选项：
  --config <path>   使用指定 vendors.json（默认 scripts/vendors.json）
  --user-home <dir> 把用户级目标目录重定向到 <dir>（默认自动探测：os.homedir() → USERPROFILE/HOME → 常见用户目录根部）
  --project         安装到项目级扫描目录（项目根自动探测：向上找 .git/AGENTS.md/CONTEXT.md，可在 vendors.json 用 projectRoot 覆盖；默认用户级）
  --dry-run         派生与校验但不落盘
  -h, --help        显示本帮助`;
}

const VALUE_OPTS = new Set(['--config', '--user-home', '--type', '--name', '--bucket']);

function parseArgs(argv) {
  const opts = { dryRun: false, project: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--project') opts.project = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('-')) {
      if (!VALUE_OPTS.has(a)) {
        opts.error = `未知选项: ${a}`;
        break;
      }
      if (i + 1 >= argv.length) {
        opts.error = `选项 ${a} 缺少参数值`;
        break;
      }
      const v = argv[++i];
      if (a === '--config') opts.config = v;
      else if (a === '--user-home') opts.userHome = v;
      else if (a === '--type') opts.type = v;
      else if (a === '--name') opts.name = v;
      else opts.bucket = v;
    } else {
      positional.push(a);
    }
  }
  opts.cmd = positional[0] || 'all';
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(usage()); return 0; }
  if (opts.error) { console.error(`错误: ${opts.error}\n\n${usage()}`); return 2; }

  const configPath = opts.config || DEFAULT_CONFIG;
  if (!['init', 'derive', 'install', 'check', 'all'].includes(opts.cmd)) {
    console.error(`错误: 未知子命令 "${opts.cmd}"\n\n${usage()}`);
    return 2;
  }
  let config;
  try {
    config = loadConfig(configPath, opts.userHome);
  } catch (e) {
    console.error(`错误: 无法加载配置 ${configPath}: ${e.message}`);
    return 2;
  }
  if (!opts.userHome) console.log(`[user-home] 自动探测到用户目录: ${config.userHome}`);
  console.log(`[project-root] ${config.projectRoot}`);

  if (opts.cmd === 'init') {
    const r = runInit({ type: opts.type, name: opts.name, bucket: opts.bucket, config });
    if (r.error) { console.error(`错误: ${r.error}`); return 2; }
    console.log(`已创建 ${r.file}`);
    return 0;
  }

  let exit = 0;
  if (opts.cmd === 'derive' || opts.cmd === 'all') {
    const { plan, errors } = runDerive(config, { dryRun: opts.dryRun });
    for (const e of errors) {
      exit = 1;
      console.error(`[FAIL] ${e.code} ${e.vendor} ${e.file}: ${e.detail}`);
    }
    for (const item of plan) console.log(`derive ${item.vendor} ${item.kind} ${item.skill} → ${item.file}`);
    if (plan.length === 0 && errors.length === 0) console.log('（无可派生的源）');
  }

  if (opts.cmd === 'install' || opts.cmd === 'all') {
    if (opts.dryRun) console.log('（dry-run 预览：OK=一致，MISSING=待安装，MISMATCH=内容待更新；不写入任何文件）');
    const { installed, skipped, failures, inlined } = runInstall(config, { dryRun: opts.dryRun, project: opts.project });
    for (const i of inlined || []) console.log(`inline ${i.skill} ← ${i.names.join(', ')}`);
    for (const s of skipped) console.log(`- ${s}`);
    for (const f of failures) {
      exit = 1;
      console.error(`[GATE] ${f.code} ${f.vendor} ${f.file}: ${f.detail} → ${f.action}`);
    }
    // verify 为只读：dry-run 也执行，以输出"将安装哪些(OK)/缺失(MISSING)"的预览
    const results = runVerify(config, installed);
    for (const r of results) {
      console.log(r.status === 'ERROR' ? `ERROR ${r.dest} (${r.detail})` : `${r.status} ${r.dest}`);
      if (r.status === 'ERROR') exit = 1;
    }
    if (results.length === 0) console.log('（无待安装项）');
  }

  if (opts.cmd === 'check') {
    const errors = runCheck(config);
    if (errors.length === 0) {
      console.log('check: 全部通过');
      // 提醒：本仓库内的副本一致性（check-copies）与「已安装副本是否跟上」是两回事。
      console.log('提示: 改过 base/scripts 或技能源码后，须跑 `ship install` 刷新各平台已安装副本——安装副本不会自动更新，过期副本会让源码里修好的防护失效。');
    } else {
      exit = 1;
      for (const e of errors) console.error(`[FAIL] ${e.code} ${e.vendor} ${e.file}: ${e.detail}`);
    }
  }

  return exit;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(`致命错误: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
