#!/usr/bin/env node
// skill-lint.mjs — 技能质量的机器闸。判据源：docs/agents/skill-charter.md（十条原则 + sk-00）。
//
// 用法：
//   node base/scripts/skill-lint.mjs             摘要 + 最差 30 个，退出码 0
//   node base/scripts/skill-lint.mjs --json      完整机器可读结果输出到 stdout
//   node base/scripts/skill-lint.mjs --strict    有 P0 级发现则退出码 1（CI 用）
//   node base/scripts/skill-lint.mjs --verbose   每个技能逐条列出命中
//   node base/scripts/skill-lint.mjs --root <d>  覆盖扫描根（测试用；见下"根"语义）
//   node base/scripts/skill-lint.mjs --md <f>    额外把全量明细写成 markdown（审计报告底稿）
//   node base/scripts/skill-lint.mjs --out <f>   额外把 JSON 结果写进文件
//   退出码：0 = 正常（--strict 下无 P0）；1 = --strict 下存在 P0；2 = 用法错误
//
// 只读：本脚本对技能目录只做 readdirSync/readFileSync，绝不写 base/skills/**。
// 编码：显式 UTF-8 读写（HARNESS-SPEC §9），路径统一 path.join。
//
// 根（--root）语义：先看 <root>/base/skills 是否存在，存在则用它作技能根；
// 否则把 <root>/skills 或 <root> 本身当技能根，便于测试造临时夹具。
//
// ── frontmatter 解析 ───────────────────────────────────────────────────────
// 复用 base/scripts/ship.mjs 的 YAML 子集实现（parseScalar / splitKV / parseYaml /
// parseFrontmatter 同一套逻辑，此处内联，保证 lint 可独立运行且与分发链判据一致），
// 只取平坦字段（name / description / x-install / x-vendors / metadata.version / version）。
// 该子集解析器对多行 flow 序列（tags: 换行 [ 换行 a, ... ]）会抛错——ship.mjs 用正则兜底，
// 此处降级为 lenientFrontmatter() 并记一条 info（而不是 P0）：那是真发现（frontmatter
// 超出子集能力，分发侧只靠 x-install 正则才没炸），但不是分发阻断错误，判 P0 会误伤合法技能。
// 块标量（| / >）在降级路径按缩进续行拼接，否则 open-code-review / kimi-webbridge /
// samll/* 这类 > 写法的 description 会只剩 ">"，误报成"有描述但没触发词"。
//
// ── 第三方（原样分发）技能判定 ────────────────────────────────────────────
// 任务要求"第三方也要扫，但 JSON 打 thirdParty: true"，且判据必须可复现。
// 四级判据，从强到弱，命中即停（thirdPartyConfidence 标明哪一级）：
//   1) declared  —— AGENTS.md 明文记载的原样分发技能：ego-browser / quarkclouddrive /
//                   impeccable（真源在上游，本仓只回灌；升级核对 git diff 应只剩本机标注）。
//   2) packaging —— 目录里有外部打包工具指纹：_meta.json / _meta-zh.json / _skillhub_meta.json
//                   （上游 marketplace 打包产物；本仓自研技能不产这些文件）。
//   3) bucket    —— bucket === 'storytold'：ArtCraft/Storytold 编译工具族，14 个同构技能全族原样分发。
//   4) heuristic —— 下列五条全满足才算（本仓自研技能至少违反一条）：
//        a. 无 SKILL.src.md（走 ship.mjs 的 srcMode=false 直拷分支，不经派生）
//        b. frontmatter 无 x-vendors（自研技能都带跨厂商派生字段）
//        c. 名称不以 jxx- 开头（本仓自研件统一 jxx- 前缀）
//        d. 正文英文主导（正文 CJK 字符 < 50）
//        e. 无 CHANGELOG.md（自研件都带 CHANGELOG 版本史）
//      实测覆盖：samll/*（7）、find-skills、kimi-webbridge、open-code-review(-delegate)。
// 注意：不做"无 x-vendors 且无 SKILL.src.md 就算第三方"的粗判——那会把全部仓库自研的
// plain SKILL.md 技能（code/*、TDB-AM/*、productivity/lexiang 等）误判成第三方。
// declared / packaging 属硬证据；heuristic 属启发式，报告侧只进附录不进"需要优化"清单。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');

// 遍历时跳过的目录名
const SKIP_DIRS = new Set(['node_modules', '.git', '.generated', '.temp', '.scratch', 'dist', 'build']);

// 打分：100 起扣，P0 −25、P1 −8、P2 −2、info 不扣，下限 0（skill-charter「机器闸」节）
const PENALTY = { P0: 25, P1: 8, P2: 2, info: 0 };
const LEVELS = ['P0', 'P1', 'P2', 'info'];

const RULES = {
  'sk-00': { title: '机器前置：frontmatter 能解析出 name / description', level: 'P0' },
  'sk-00b': { title: '机器前置：技能目录必须有入口文件（SKILL.src.md 或 SKILL.md）', level: 'P0' },
  'sk-01a': { title: '名称与触发清晰（name 与目录一致 / 触发语 / 描述长度 40~1024）', level: 'P1' },
  'sk-01b': { title: '描述里写了边界（宪章原则一的第四要素）', level: 'P2' },
  'sk-01c': { title: '描述不泄漏实现细节（何时调用归描述，怎么实现归正文）', level: 'P2' },
  'sk-02': { title: '职责单一（万能助手嫌疑，启发式）', level: 'info' },
  'sk-03': { title: '渐进式披露（正文长度 vs references/）', level: 'P1' },
  'sk-04': { title: '指令命令式（模糊词密度）', level: 'P1' },
  'sk-05': { title: '输入输出像接口', level: 'P2' },
  'sk-06': { title: '边界与失败处理', level: 'P2' },
  'sk-07': { title: '确定性逻辑归脚本', level: 'info' },
  'sk-08': { title: '可验证（evals / tests）', level: 'P2' },
  'sk-09': { title: '版本化（version / CHANGELOG）', level: 'P2' },
  'sk-10': { title: '安全合规前置', level: 'P1' },
};

// ---------------------------------------------------------------- YAML 子集
// 与 ship.mjs 的 parseScalar / splitKV / parseYaml 同构（见文件头注释）。

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
  throw new Error('无法解析 YAML 键值对: ' + text);
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
    if (lines[idx].indent > indent) throw new Error('意外的缩进: ' + lines[idx].text);
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
      if (line.indent > indent) throw new Error('意外的缩进: ' + line.text);
      if (line.text.startsWith('- ')) break;
      const { key, value, block } = splitKV(line.text);
      idx++;
      let parsed;
      if (block !== null) {
        const blockLines = [];
        const base = line.indent + 2;
        while (idx < lines.length && lines[idx].indent > line.indent) { blockLines.push(lines[idx].raw.slice(Math.min(base, lines[idx].indent))); idx++; }
        parsed = blockLines.join(block === '>' ? ' ' : '\n');
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
      if (line.indent > indent) throw new Error('意外的缩进: ' + line.text);
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
          item[key] = blockLines.join(block === '>' ? ' ' : '\n');
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

// 子集解析器抛错时的降级解析：抓顶层 key，块标量（| / >）按缩进续行拼接。
// 与 ship.mjs 的 getXInstall()/getSkipVendors() 正则兜底同一思路，但更完整（能还原 description）。
function lenientFrontmatter(raw) {
  const meta = {};
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^([A-Za-z_][\w.-]*):[ \t]*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = m[2].trim();
    i++;
    const blockMatch = rest.match(/^([|>])[-+]?$/);
    if (blockMatch || rest === '') {
      const collected = [];
      while (i < lines.length && (/^[ \t]/.test(lines[i]) || lines[i].trim() === '')) {
        collected.push(lines[i].replace(/^[ \t]{1,4}/, ''));
        i++;
      }
      while (collected.length && collected[collected.length - 1].trim() === '') collected.pop();
      const joined = collected.join(blockMatch && blockMatch[1] === '>' ? ' ' : '\n');
      meta[key] = joined.trim();
    } else {
      meta[key] = parseScalar(rest);
    }
  }
  return meta;
}

// 返回 { meta, raw, body, bodyStartLine, descLine, parseError, lenient }
function parseFrontmatterText(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: null, raw: null, body: text, bodyStartLine: 1, descLine: null, parseError: '缺少 --- 包裹的 frontmatter 块', lenient: false };
  const raw = m[1];
  const body = m[2] || '';
  const prefix = text.slice(0, text.length - body.length);
  const bodyStartLine = prefix.split(/\r?\n/).length;
  const descRel = raw.split(/\r?\n/).findIndex((l) => /^description:/.test(l));
  const descLine = descRel >= 0 ? descRel + 2 : null;
  let meta = null;
  let parseError = null;
  let lenient = false;
  try {
    meta = parseYaml(raw);
  } catch (e) {
    meta = lenientFrontmatter(raw);
    parseError = e.message;
    lenient = true;
  }
  return { meta: meta || {}, raw, body, bodyStartLine, descLine, parseError, lenient };
}

// ---------------------------------------------------------------- 目录扫描

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function listSkillDirs(root) {
  const candidates = [path.join(root, 'base', 'skills'), path.join(root, 'skills'), root];
  let skillsBase = null;
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) { skillsBase = c; break; }
  }
  if (!skillsBase) throw new Error('找不到技能根目录: ' + root);

  // vendors.json 的 buckets 才是实际分发桶；不在其中的桶（in-progress / misc / personal ...）
  // 仍要扫，但 JSON 里标 distributed: false，报告侧可以据此区分"在册分发"与"草稿区"。
  const vendorsCfg = readJsonSafe(path.join(__dirname, 'vendors.json'));
  const configuredBuckets = new Set(Array.isArray(vendorsCfg && vendorsCfg.buckets) ? vendorsCfg.buckets : []);

  const skills = [];
  const orphans = [];
  const skipped = [];

  // 布局自适应：--root 可能指向「桶目录」而不是技能根。
  // 若技能根的直接子目录自己就是技能（含入口文件），把它当成单桶布局，
  // 否则按 <bucket>/<skill> 两级布局扫。没有这一步，--root base/skills/productivity
  // 会把每个技能目录误当桶，扫出 0 个技能。
  const isSkillDirAbs = (d) => fs.existsSync(path.join(d, 'SKILL.src.md')) || fs.existsSync(path.join(d, 'SKILL.md'));
  const topEntries = fs.readdirSync(skillsBase, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.'));
  const singleBucket = topEntries.length > 0 && topEntries.every((e) => isSkillDirAbs(path.join(skillsBase, e.name)));

  if (singleBucket) {
    const bucketName = path.basename(skillsBase);
    for (const entry of topEntries) {
      const dirAbs = path.join(skillsBase, entry.name);
      const srcPath = path.join(dirAbs, 'SKILL.src.md');
      const mdPath = path.join(dirAbs, 'SKILL.md');
      const hasSrc = fs.existsSync(srcPath);
      skills.push({
        bucket: bucketName,
        dirName: entry.name,
        dirAbs: dirAbs,
        file: hasSrc ? srcPath : mdPath,
        hasSrc: hasSrc,
        hasMd: fs.existsSync(mdPath),
        distributed: configuredBuckets.size ? configuredBuckets.has(bucketName) : null,
      });
    }
    skills.sort((a, b) => a.dirName.localeCompare(b.dirName));
    return { skillsBase, skills, orphans, skipped, configuredBuckets: Array.from(configuredBuckets) };
  }

  for (const bucketEntry of topEntries) {
    if (!bucketEntry.isDirectory()) continue;
    if (SKIP_DIRS.has(bucketEntry.name) || bucketEntry.name.startsWith('.')) continue;
    const bucketDir = path.join(skillsBase, bucketEntry.name);
    let entries;
    try {
      entries = fs.readdirSync(bucketDir, { withFileTypes: true });
    } catch (e) {
      skipped.push({ path: toPosix(path.relative(root, bucketDir)), reason: '目录不可读: ' + e.message });
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const dirAbs = path.join(bucketDir, entry.name);
      const srcPath = path.join(dirAbs, 'SKILL.src.md');
      const mdPath = path.join(dirAbs, 'SKILL.md');
      const hasSrc = fs.existsSync(srcPath);
      const hasMd = fs.existsSync(mdPath);
      if (!hasSrc && !hasMd) {
        // sk-00b：有 references/ 或 scripts/ 说明它本来就是个技能目录（含可执行资产），
        // 却缺入口文件——任何厂商都加载不了，是 P0 真发现，不是"非技能目录"。
        const childNames = fs.readdirSync(dirAbs);
        const assets = ['references', 'scripts', 'assets', 'evals', 'tests'].filter((d) => childNames.includes(d));
        const record = {
          path: toPosix(path.relative(root, dirAbs)),
          bucket: bucketEntry.name,
          dirName: entry.name,
          files: childNames.sort(),
          assetsDirs: assets,
        };
        skipped.push({ path: record.path, reason: '不是技能目录：既无 SKILL.src.md 也无 SKILL.md' });
        if (assets.length) orphans.push(record);
        continue;
      }
      skills.push({
        bucket: bucketEntry.name,
        dirName: entry.name,
        dirAbs,
        file: hasSrc ? srcPath : mdPath,
        hasSrc,
        hasMd,
        distributed: configuredBuckets.size ? configuredBuckets.has(bucketEntry.name) : null,
      });
    }
  }
  skills.sort((a, b) => (a.bucket + '/' + a.dirName).localeCompare(b.bucket + '/' + b.dirName));
  skipped.sort((a, b) => a.path.localeCompare(b.path));
  orphans.sort((a, b) => a.path.localeCompare(b.path));
  return { skillsBase, skills, orphans, skipped, configuredBuckets: Array.from(configuredBuckets) };
}

// ---------------------------------------------------------------- 第三方判定

const DECLARED_THIRD_PARTY = new Set(['ego-browser', 'quarkclouddrive', 'impeccable']);
const PACKAGING_MARKERS = ['_meta.json', '_meta-zh.json', '_skillhub_meta.json'];
const THIRD_PARTY_BUCKETS = new Set(['storytold']);

function countCJK(text) {
  const m = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  return m ? m.length : 0;
}

function classifyThirdParty(ctx) {
  const { dirName, bucket, meta, hasSrc, body, childNames } = ctx;
  if (DECLARED_THIRD_PARTY.has(dirName)) {
    return { thirdParty: true, confidence: 'declared', reason: 'AGENTS.md 记载的原样分发技能（真源在上游，本仓只回灌）' };
  }
  const markers = PACKAGING_MARKERS.filter((n) => childNames.includes(n));
  if (markers.length) {
    return { thirdParty: true, confidence: 'packaging', reason: '外部打包工具指纹文件: ' + markers.join(', ') };
  }
  if (THIRD_PARTY_BUCKETS.has(bucket)) {
    return { thirdParty: true, confidence: 'bucket', reason: 'ArtCraft/storytold 编译工具族，全族原样分发（bucket=storytold）' };
  }
  const hasXVendors = Boolean(meta && meta['x-vendors']);
  const hasChangelog = childNames.includes('CHANGELOG.md');
  const jxxPrefix = /^jxx-/.test(dirName);
  const englishDominant = countCJK(body) < 50;
  if (!hasSrc && !hasXVendors && !jxxPrefix && englishDominant && !hasChangelog) {
    return {
      thirdParty: true,
      confidence: 'heuristic',
      reason: '无 SKILL.src.md（直拷分支）+ 无 x-vendors + 非 jxx- 前缀 + 正文英文主导 + 无 CHANGELOG.md',
    };
  }
  return { thirdParty: false, confidence: null, reason: null };
}

// ---------------------------------------------------------------- 规则实现

// sk-01a 触发语：中英文各一组。注意块标量（> 写法）已被解析器拼成单行，
// 因此 open-code-review / kimi-webbridge / samll/* 这类英文技能能正确命中
// "Use when" / "when to use" / "Triggered by" / "Use this skill" / "should be used when"。
// 注意「……时使用 / 时调用 / 时触发」是中文描述最常见的触发句式，漏掉会大面积误报。
const TRIGGER_PATTERNS = [
  /触发/, /当用户/, /使用时/, /需要时/, /时使用/, /时调用/, /时触发/, /时读/,
  /when to use/i, /use when/i, /use this skill/i, /when the user/i,
  /when you (need|want)/i, /triggered by/i, /use it when/i, /should be used when/i,
  /trigger\s*:/i,
];

// sk-01b 边界语：description 要说清"它不干什么"（宪章原则一：能力 + 场景 + 触发词 + 边界）
const BOUNDARY_PATTERNS = [
  /不包含/, /不适用/, /不用于/, /不处理/, /不修改/, /不含/, /不做/, /不负责/,
  /不替代/, /不生成/, /不输出/, /不涉及/, /不覆盖/, /不参与/, /边界/, /仅限/,
  /not for/i, /out of scope/i, /does not/i, /doesn't/i, /excludes/i,
];

// sk-01c 描述里泄漏实现细节：description 只回答"何时调用"，不写怎么实现。
// 命中文件路径、CLI 参数、内部字段名（snake_case / camelCase）即提示下沉到正文或 references/。
const DESC_IMPL_PATTERNS = [
  { kind: '文件路径', re: /[\w-]+\/[\w.-]+\.(?:md|mjs|cjs|js|json|ps1|ya?ml)\b/ },
  { kind: 'CLI 参数', re: /(?:^|\s)--[a-z][\w-]+/ },
  { kind: '内部字段名', re: /\b[a-z]+_[a-z_]{2,}\b/ },
  { kind: '内部函数名', re: /\b[a-z]+[A-Z][a-zA-Z]{2,}\b/ },
];

const FUZZY_SOURCE = '你可以|建议|尽量|尝试|或许|可以考虑|最好';
const IO_PATTERN = /输入|输出|Input|Output/i;
const BOUNDARY_BODY_PATTERN = /边界|不适用|失败|错误|拒绝|何时用/;
const DETERMINISTIC_PATTERN = /逐行计算|逐条计算|格式转换|批量重命名|批量转换|逐行处理|编码转换|时间戳换算|批量导出|批量落盘|line[- ]by[- ]line|bulk rename|format conversion|batch convert/i;
const HIGH_RISK_PATTERN = /删除|覆盖|推送|上传|发送|支付|转账|\bgit push\b|(?:^|[^a-z])rm(?:\s|$)/m;
const GUARD_PATTERN = /确认|权限|审计|脱敏|白名单/;
const VERSION_PATTERN = /\bv?\d+\.\d+\.\d+\b/;

function firstMatchLine(lines, matcher, from) {
  const start = from || 1;
  for (let i = start - 1; i < lines.length; i++) {
    matcher.lastIndex = 0;
    if (matcher.test(lines[i])) return i + 1;
  }
  return null;
}

function matchLines(lines, matcher, from) {
  const out = [];
  const start = from || 1;
  for (let i = start - 1; i < lines.length; i++) {
    matcher.lastIndex = 0;
    if (matcher.test(lines[i])) out.push(i + 1);
  }
  return out;
}

function countMatches(text, source) {
  const m = text.match(new RegExp(source, 'g'));
  return m ? m.length : 0;
}

function snippetOf(text, limit) {
  const cap = limit || 110;
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > cap ? t.slice(0, cap) + '…' : t;
}

// 代码块（fenced code）覆盖的行号集合。用于给 sk-10 的命中打 triage 标记：
// 「发送 API 请求」写在目录树里、或「删除检验」是比喻，与「删除用户文件」不是一回事。
// 规则本身仍按宪章扫全文（不擅自缩窄判据），但把「这行在代码块内」交给报告侧 5 秒判读。
function fencedLineMask(lines, fromLine) {
  const mask = new Set();
  let inFence = false;
  for (let i = fromLine - 1; i < lines.length; i++) {
    if (/^\s*(?:>\s*)?(?:\x60{3}|~{3})/.test(lines[i])) {
      inFence = !inFence;
      mask.add(i + 1);
      continue;
    }
    if (inFence) mask.add(i + 1);
  }
  return mask;
}

function dirHas(dirAbs, name) {
  const p = path.join(dirAbs, name);
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

function lintSkill(skill, root) {
  const relPath = toPosix(path.relative(root, skill.dirAbs));
  const relFile = toPosix(path.relative(root, skill.file));
  const text = fs.readFileSync(skill.file, 'utf-8');
  const lines = text.split(/\r?\n/);
  const fm = parseFrontmatterText(text);
  const meta = fm.meta || {};
  const body = fm.body || '';
  const bodyTrimmed = body.replace(/\r?\n$/, '');
  const bodyLineCount = bodyTrimmed === '' ? 0 : bodyTrimmed.split(/\r?\n/).length;
  const bodyStart = fm.bodyStartLine;

  const childNames = fs.readdirSync(skill.dirAbs);
  const hasReferences = dirHas(skill.dirAbs, 'references');
  const hasScripts = dirHas(skill.dirAbs, 'scripts');
  const hasEvals = dirHas(skill.dirAbs, 'evals');
  const hasTests = dirHas(skill.dirAbs, 'tests');
  const hasChangelog = childNames.indexOf('CHANGELOG.md') >= 0;

  const fenced = fencedLineMask(lines, bodyStart);
  const findings = [];
  function add(code, level, message, file, line, snippet) {
    findings.push({
      code: code,
      level: level,
      message: message,
      file: file,
      line: line || null,
      snippet: snippet ? snippetOf(snippet) : null,
      inCodeBlock: line ? fenced.has(line) : null,
    });
  }

  const desc = typeof meta.description === 'string' ? meta.description.trim() : '';
  const nameVal = typeof meta.name === 'string' ? meta.name.trim() : '';
  const descEvidence = fm.descLine || 2;

  // ---- sk-00 机器前置（P0）
  if (fm.meta === null) {
    add('sk-00', 'P0', 'frontmatter 解析不出 name/description：' + fm.parseError, relFile, null, null);
  } else {
    if (fm.lenient) {
      add('sk-00', 'info', 'frontmatter 超出 ship.mjs 的 YAML 子集解析器能力（' + fm.parseError + '），已降级按正则解析出 name/description；建议改成块标量或单行写法（分发侧目前靠 x-install 正则兜底才没炸）', relFile, null, null);
    }
    if (!nameVal) add('sk-00', 'P0', 'frontmatter 缺 name（或为空）——整条分发链会断', relFile, null, null);
    if (!desc) add('sk-00', 'P0', 'frontmatter 缺 description（或为空/非字符串）——agent 无法判断何时调用', relFile, descEvidence, null);
  }

  // ---- sk-01a 名称与触发清晰
  if (nameVal && nameVal !== skill.dirName) {
    add('sk-01a', 'info', 'name 与目录名不一致（name=' + nameVal + ' / dir=' + skill.dirName + '）：分发按 name 落地，目录名只是本仓组织方式', relFile, 2, null);
  }
  if (desc) {
    if (!TRIGGER_PATTERNS.some((re) => re.test(desc))) {
      add('sk-01a', 'P1', 'description 没有触发语（触发 / 当用户 / 使用时 / Use when / when to use / Triggered by）：agent 判断不出"现在该用它"，主症状是 undertrigger', relFile, descEvidence, desc);
    }
    if (desc.length < 40) {
      add('sk-01a', 'P2', 'description 仅 ' + desc.length + ' 字符（<40）：说不清何时该用', relFile, descEvidence, desc);
    } else if (desc.length > 1024) {
      add('sk-01a', 'P2', 'description 长 ' + desc.length + ' 字符（>1024）：描述常驻上下文，是每轮都在花的成本', relFile, descEvidence, desc);
    }
    // ---- sk-01b 描述里的边界（P2）
    if (!BOUNDARY_PATTERNS.some((re) => re.test(desc))) {
      add('sk-01b', 'P2', 'description 没有边界语（不包含/不用于/不做/不替代/Not for/Out of scope）：读者不知道它不干什么，容易被过度调用', relFile, descEvidence, desc);
    }
    // ---- sk-01c 描述不泄漏实现细节（P2）
    const leaks = DESC_IMPL_PATTERNS.filter((p) => p.re.test(desc)).map((p) => p.kind);
    if (leaks.length > 0) {
      add('sk-01c', 'P2', 'description 泄漏实现细节（' + leaks.join(' / ') + '）：描述只答"何时调用"，路径/参数/字段名应下沉到正文或 references/，否则每轮都在付这份常驻成本', relFile, descEvidence, desc);
    }
    // ---- sk-02 职责单一（info，启发式）
    const connectors = desc.match(/还要|以及|同时|并提供|又/g) || [];
    if (connectors.length >= 2) {
      const uniq = Array.from(new Set(connectors)).join('/');
      add('sk-02', 'info', 'description 用「' + uniq + '」串起 ' + (connectors.length + 1) + ' 段职责（' + connectors.length + ' 个连接词）——万能助手嫌疑，回到"这几件事共用什么判据"重新切分', relFile, descEvidence, desc);
    }
  }

  // ---- sk-03 渐进式披露
  if (bodyLineCount > 500) {
    add('sk-03', 'P1', '正文 ' + bodyLineCount + ' 行（>500）' + (hasReferences ? '，且目录已有 references/ 却仍未下沉' : '，该下沉到 references/') + '——技能一被调用整篇进上下文，长正文挤压执行预算', relFile, bodyStart, null);
  } else if (bodyLineCount > 200 && !hasReferences) {
    add('sk-03', 'info', '正文 ' + bodyLineCount + ' 行（>200）而目录下没有 references/：细节可下沉成指针', relFile, bodyStart, null);
  }

  // ---- sk-04 指令命令式
  const fuzzyCount = countMatches(body, FUZZY_SOURCE);
  if (fuzzyCount >= 5) {
    const fuzzyLines = matchLines(lines, new RegExp(FUZZY_SOURCE), bodyStart);
    add('sk-04', 'P1', '正文模糊词 ' + fuzzyCount + ' 处（你可以/建议/尽量/尝试/或许/可以考虑/最好，阈值 5）：指令留了后路，agent 每次做法会漂移；改祈使句，能用代码强制的直接下沉', relFile, fuzzyLines[0] || null, fuzzyLines.slice(0, 5).map((n) => lines[n - 1]).join(' ／ '));
  }

  // ---- sk-05 输入输出像接口
  if (!IO_PATTERN.test(body)) {
    add('sk-05', 'P2', '正文没有「输入 / 输出 / 输出格式 / Input / Output」任一关键词：接口面缺失，读者不知道要提供什么、拿到什么形状的结果', relFile, bodyStart, null);
  }

  // ---- sk-06 边界与失败处理
  if (!BOUNDARY_BODY_PATTERN.test(body)) {
    add('sk-06', 'P2', '正文没有「边界 / 不适用 / 失败 / 错误 / 拒绝 / 何时用」任一：失败路径没有可识别的出口（应落成追问、拒绝、转人工或 ERR_* 码）', relFile, bodyStart, null);
  }

  // ---- sk-07 确定性逻辑归脚本（info）
  const detLine = firstMatchLine(lines, DETERMINISTIC_PATTERN, bodyStart);
  if (detLine && !hasScripts && !hasReferences) {
    add('sk-07', 'info', '正文出现纯确定性描述（逐行计算/格式转换/批量重命名类）而目录下既无 scripts/ 也无 references/：这段更适合写成脚本，正文只留判断与步骤', relFile, detLine, lines[detLine - 1]);
  }

  // ---- sk-08 可验证
  if (hasEvals) {
    const evalEntries = fs.readdirSync(path.join(skill.dirAbs, 'evals'), { withFileTypes: true });
    if (evalEntries.length === 0) {
      add('sk-08', 'P1', 'evals/ 是空目录：留了评测位却没有任何用例，等于没有可验证性（最小形态见 jxx-skill-init 的 evals 模板：prompt / expected_output / files）', relFile, null, null);
    }
  } else if (!hasTests) {
    add('sk-08', 'P2', '目录下既无 evals/ 也无 tests/：正例/反例/成功标准一条都落不下，改坏没人能发现', relFile, null, null);
  }

  // ---- sk-09 版本化
  // 版本号有四种落法（metadata.version / 顶层 version / CHANGELOG / 正文）。
  // 宪章判据：metadata.version 缺 且 正文与 CHANGELOG 都没有版本号 ⇒ P2。
  // 因此顶层 version 也算"有版本号"，只是缺结构化字段——记 info 提示归一，不判 P2。
  const metaVersion = meta.metadata && typeof meta.metadata === 'object' ? meta.metadata.version : undefined;
  const hasStructuredVersion = metaVersion !== undefined && metaVersion !== null && String(metaVersion).trim() !== '';
  const topVersion = meta.version;
  const topVersionPresent = topVersion !== undefined && topVersion !== null && String(topVersion).trim() !== '';
  const changelogText = hasChangelog ? fs.readFileSync(path.join(skill.dirAbs, 'CHANGELOG.md'), 'utf-8') : '';
  const versionInBody = VERSION_PATTERN.test(body);
  const versionInChangelog = VERSION_PATTERN.test(changelogText);
  if (!hasStructuredVersion) {
    if (topVersionPresent) {
      add('sk-09', 'info', 'frontmatter 缺 metadata.version（版本号在顶层 version: ' + String(topVersion) + '）：分发侧读不到结构化版本，回滚与漂移比对只能靠人眼', relFile, 2, null);
    } else if (versionInBody || versionInChangelog) {
      add('sk-09', 'info', 'frontmatter 缺 metadata.version（版本号只出现在' + (versionInChangelog ? ' CHANGELOG.md' : '正文') + '）：同上，建议补结构化字段', relFile, 2, null);
    } else {
      add('sk-09', 'P2', 'frontmatter 缺 metadata.version，且正文与 CHANGELOG 里也没有版本号：技能无法版本化，回滚与漂移无从判定', relFile, 2, null);
    }
  }
  if (!hasChangelog) {
    add('sk-09', 'info', '缺 CHANGELOG.md：变更原因无处登记（版本号递增即变更原因，不写"优化若干细节"）', relFile, null, null);
  }

  // ---- sk-10 安全合规前置
  const riskLine = firstMatchLine(lines, HIGH_RISK_PATTERN, bodyStart);
  if (riskLine && !GUARD_PATTERN.test(body)) {
    const hint = fenced.has(riskLine) ? '（命中行在代码块内，先判是不是命令行/目录树里的字面词）' : '';
    add('sk-10', 'P1', '正文出现高风险动作（删除/覆盖/推送/上传/发送/支付/转账/git push/rm）而全文无「确认/权限/审计/脱敏/白名单」：没写谁来确认、权限边界与留痕，危险操作等于裸奔' + hint, relFile, riskLine, lines[riskLine - 1]);
  }

  // ---- 计分
  const counts = { P0: 0, P1: 0, P2: 0, info: 0 };
  for (const f of findings) counts[f.level]++;
  let score = 100;
  for (const lv of LEVELS) score -= PENALTY[lv] * counts[lv];
  score = Math.max(0, score);

  const third = classifyThirdParty({ dirName: skill.dirName, bucket: skill.bucket, meta: meta, hasSrc: skill.hasSrc, body: body, childNames: childNames });

  return {
    path: relPath,
    bucket: skill.bucket,
    name: nameVal || skill.dirName,
    skillFile: relFile,
    sourceMode: skill.hasSrc ? 'SKILL.src.md' : 'SKILL.md',
    distributed: skill.distributed,
    inProgress: skill.bucket === 'in-progress',
    thirdParty: third.thirdParty,
    thirdPartyConfidence: third.confidence,
    thirdPartyReason: third.reason,
    score: score,
    counts: counts,
    ruleCodes: Array.from(new Set(findings.map((f) => f.code))).sort(),
    descriptionLength: desc.length,
    bodyLines: bodyLineCount,
    findings: findings.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.code.localeCompare(b.code)),
  };
}

// ---------------------------------------------------------------- 输出

// 显示宽度：CJK 与全角标点占 2 列。按 str.length 补空格会让含中文的表格错位。
function charWidth(ch) {
  const c = ch.codePointAt(0);
  if (c >= 0x1100 && (
    c <= 0x115f || c === 0x2329 || c === 0x232a
    || (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f)
    || (c >= 0xac00 && c <= 0xd7a3)
    || (c >= 0xf900 && c <= 0xfaff)
    || (c >= 0xfe30 && c <= 0xfe6f)
    || (c >= 0xff00 && c <= 0xff60)
    || (c >= 0xffe0 && c <= 0xffe6)
    || (c >= 0x1f300 && c <= 0x1f64f)
    || (c >= 0x1f900 && c <= 0x1f9ff)
  )) return 2;
  return 1;
}

function displayWidth(s) {
  let w = 0;
  for (const ch of String(s)) w += charWidth(ch);
  return w;
}

function pad(s, width, left) {
  const str = String(s);
  const gap = Math.max(0, width - displayWidth(str));
  const fill = new Array(gap + 1).join(' ');
  return left ? str + fill : fill + str;
}

function tick(s) {
  return String.fromCharCode(96) + s + String.fromCharCode(96);
}

function fmtTable(rows, headers) {
  const body = rows.map((r) => [
    r.path,
    r.inProgress ? r.bucket + '*' : r.bucket,
    r.ruleCodes.length ? r.ruleCodes.join(',') : '—',
    String(r.counts.P0),
    String(r.counts.P1),
    String(r.counts.P2),
    String(r.score),
  ]);
  const all = [headers].concat(body);
  // 列宽按字符数算（含中文宽字符与全角标点仍会错位，属终端渲染限制；
  // 关键是绝不能让某个 null/undefined 单元格把整张表算崩）。
  const cell = (v) => String(v === null || v === undefined ? '' : v);
  const widths = headers.map((_, i) => Math.max.apply(null, all.map((r) => displayWidth(cell(r[i])))));
  const render = (r) => r.map((c, i) => (i === 0 ? pad(cell(c), widths[i], true) : pad(cell(c), widths[i], false))).join('  ');
  return [render(headers), widths.map((w) => new Array(w + 1).join('─')).join('  ')].concat(body.map(render)).join('\n');
}

function buildMarkdown(result) {
  const out = [];
  out.push('# 技能审计原始发现（skill-lint 机器闸）');
  out.push('');
  out.push('> 自动生成，勿手改。复现：' + tick('node base/scripts/skill-lint.mjs --md .temp/output/skill-audit-raw.md --out .temp/output/skill-lint-<date>.json'));
  out.push('> 判据源：' + tick('docs/agents/skill-charter.md') + '（十条原则 + sk-00）。分数语义：100 起扣，P0 −25 / P1 −8 / P2 −2 / info 不扣，下限 0。分数不是 KPI，是排序工具。');
  out.push('');
  out.push('- 生成时间：' + result.generatedAt);
  out.push('- 扫描根：' + tick(result.root) + '；技能根 ' + tick(toPosix(path.relative(result.root, result.skillsBase) || '.')));
  out.push('- 技能数：' + result.totals.skills + '（第三方 ' + result.totals.thirdParty + ' / in-progress ' + result.totals.inProgress + ' / 跳过非技能目录 ' + result.skipped.length + '）');
  out.push('- **主表合计（不含 in-progress）：P0 ' + result.totalsMain.P0 + ' 条 / P1 ' + result.totalsMain.P1 + ' 条 / P2 ' + result.totalsMain.P2 + ' 条**；info ' + result.totalsMain.info + ' 条（不扣分）');
  out.push('- in-progress 合计：P0 ' + result.totalsInProgress.P0 + ' 条 / P1 ' + result.totalsInProgress.P1 + ' 条 / P2 ' + result.totalsInProgress.P2 + ' 条；info ' + result.totalsInProgress.info + ' 条');
  out.push('');
  out.push('## 规则码索引');
  out.push('');
  out.push('| 规则码 | 判据 | 默认级别 |');
  out.push('|---|---|---|');
  Object.keys(RULES).forEach((code) => out.push('| ' + tick(code) + ' | ' + RULES[code].title + ' | ' + RULES[code].level + ' |'));
  out.push('');

  const byRule = {};
  for (const s of result.skills) {
    for (const f of s.findings) {
      if (!byRule[f.code]) byRule[f.code] = { P0: 0, P1: 0, P2: 0, info: 0, skills: [] };
      byRule[f.code][f.level]++;
      if (byRule[f.code].skills.indexOf(s.path) < 0) byRule[f.code].skills.push(s.path);
    }
  }
  out.push('## 规则命中分布');
  out.push('');
  out.push('| 规则码 | P0 | P1 | P2 | info | 命中技能数 |');
  out.push('|---|---|---|---|---|---|');
  Object.keys(RULES).forEach((code) => {
    const r = byRule[code] || { P0: 0, P1: 0, P2: 0, info: 0, skills: [] };
    out.push('| ' + tick(code) + ' | ' + r.P0 + ' | ' + r.P1 + ' | ' + r.P2 + ' | ' + r.info + ' | ' + r.skills.length + ' |');
  });
  out.push('');

  if (result.orphans.length) {
    out.push('## P0 · 缺入口文件的技能目录（sk-00b）');
    out.push('');
    out.push('目录里有 references/ 或 scripts/（说明它本来就是个技能），却没有 SKILL.src.md / SKILL.md——任何厂商都加载不了。');
    out.push('');
    for (const o of result.orphans) {
      out.push('- ' + tick(o.path) + '（bucket ' + o.bucket + '）：资产目录 ' + o.assetsDirs.join(', ') + '；目录内容 ' + o.files.join(', '));
    }
    out.push('');
  }
  if (result.skipped.length) {
    out.push('## 跳过的非技能目录');
    out.push('');
    for (const s of result.skipped) out.push('- ' + tick(s.path) + ' — ' + s.reason);
    out.push('');
  }

  out.push('## 逐技能明细（按 score 升序）');
  out.push('');
  for (const s of result.skills) {
    const flags = [];
    if (s.thirdParty) flags.push('第三方 · 判据 ' + s.thirdPartyConfidence);
    if (s.inProgress) flags.push('in-progress');
    if (s.distributed === false) flags.push('不在 vendors.json 的 buckets 清单');
    out.push('### ' + tick(s.path) + ' — score ' + s.score + (flags.length ? '（' + flags.join(' · ') + '）' : ''));
    out.push('');
    out.push('- bucket ' + tick(s.bucket) + '；源文件 ' + tick(s.skillFile) + '（' + s.sourceMode + '）；正文 ' + s.bodyLines + ' 行；description ' + s.descriptionLength + ' 字符');
    out.push('- 计数：P0 ' + s.counts.P0 + ' / P1 ' + s.counts.P1 + ' / P2 ' + s.counts.P2 + ' / info ' + s.counts.info + '；命中规则：' + (s.ruleCodes.length ? s.ruleCodes.join(', ') : '无'));
    if (s.thirdParty) out.push('- 第三方判据：' + s.thirdPartyReason);
    if (s.findings.length === 0) {
      out.push('- 无命中（满分）。');
    } else {
      for (const f of s.findings) {
        const loc = f.file + (f.line ? ':' + f.line : '');
        out.push('- **' + f.level + '** ' + tick(f.code) + ' — ' + f.message + ' ｜ 证据 ' + tick(loc) + (f.snippet ? '「' + f.snippet + '」' : ''));
      }
    }
    out.push('');
  }
  return out.join('\n');
}

function summarize(result) {
  const rows = result.skills.slice().sort((a, b) => a.score - b.score || a.path.localeCompare(b.path));
  const top = rows.slice(0, 30);
  const lines = [];
  lines.push('skill-lint · 判据源 docs/agents/skill-charter.md（十条原则 + sk-00）');
  lines.push('根：' + result.root + '　技能根：' + toPosix(path.relative(result.root, result.skillsBase) || '.'));
  lines.push('分数：100 起扣，P0 −25 / P1 −8 / P2 −2 / info 不扣，下限 0。bucket 后带 * = in-progress（不进主表统计）');
  lines.push('');
  lines.push('最差 ' + top.length + ' 个（按 score 升序）：');
  lines.push(fmtTable(top, ['技能路径', 'bucket', '命中规则码', 'P0', 'P1', 'P2', 'score']));
  lines.push('');
  if (top.length < rows.length) lines.push('（其余 ' + (rows.length - top.length) + ' 个技能见 --verbose / --json）');
  lines.push('共 ' + result.totals.skills + ' 个技能 / P0 ' + result.totalsMain.P0 + ' 条 / P1 ' + result.totalsMain.P1 + ' 条 / P2 ' + result.totalsMain.P2 + ' 条');
  lines.push('（主表不含 in-progress：另有 ' + result.totals.inProgress + ' 个 in-progress 技能，其 P0 ' + result.totalsInProgress.P0 + ' 条 / P1 ' + result.totalsInProgress.P1 + ' 条 / P2 ' + result.totalsInProgress.P2 + ' 条；第三方 ' + result.totals.thirdParty + ' 个标 thirdParty=true；跳过非技能目录 ' + result.skipped.length + ' 个；info ' + result.totalsMain.info + ' 条不扣分）');
  if (result.orphans.length) {
    lines.push('');
    lines.push('⚠ P0 · 缺入口文件的技能目录（sk-00b）：' + result.orphans.map((o) => o.path).join(', '));
  }
  return lines.join('\n');
}

function summarizeVerbose(result) {
  const out = [];
  for (const s of result.skills.slice().sort((a, b) => a.score - b.score || a.path.localeCompare(b.path))) {
    const flags = [s.bucket];
    if (s.thirdParty) flags.push('第三方:' + s.thirdPartyConfidence);
    if (s.inProgress) flags.push('in-progress');
    out.push('');
    out.push('■ ' + s.path + '　score ' + s.score + '　[' + flags.join(' · ') + ']');
    if (s.findings.length === 0) { out.push('  （无命中）'); continue; }
    for (const f of s.findings) {
      out.push('  ' + pad(f.level, 4, true) + ' ' + pad(f.code, 6, true) + ' ' + f.message);
      out.push('             证据 ' + f.file + (f.line ? ':' + f.line : '') + (f.snippet ? ' 「' + f.snippet + '」' : ''));
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- CLI

const USAGE = [
  '用法：node base/scripts/skill-lint.mjs [--json] [--strict] [--verbose] [--root <dir>] [--md <file>] [--out <file>]',
  '  --json     完整机器可读结果输出到 stdout',
  '  --strict   有 P0 级发现则退出码 1（CI 用）',
  '  --verbose  每个技能逐条列出命中',
  '  --root <d> 覆盖扫描根（测试用；先用 <d>/base/skills，没有则 <d>/skills 或 <d> 本身）',
  '  --md <f>   额外把全量明细写成 markdown',
  '  --out <f>  额外把 JSON 写进文件',
].join('\n');

function parseArgs(argv) {
  const opts = { json: false, strict: false, verbose: false, root: DEFAULT_ROOT, md: null, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--verbose') opts.verbose = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--root' || a === '--md' || a === '--out') {
      const v = argv[i + 1];
      if (!v) throw new Error(a + ' 需要一个路径参数');
      i++;
      if (a === '--root') opts.root = path.resolve(v);
      else if (a === '--md') opts.md = path.resolve(v);
      else opts.out = path.resolve(v);
    } else {
      throw new Error('未知参数: ' + a);
    }
  }
  return opts;
}

function run(opts) {
  const scan = listSkillDirs(opts.root);
  const skills = scan.skills.map((s) => lintSkill(s, opts.root));
  const totalsMain = { P0: 0, P1: 0, P2: 0, info: 0 };
  const totalsInProgress = { P0: 0, P1: 0, P2: 0, info: 0 };
  for (const s of skills) {
    const bucket = s.inProgress ? totalsInProgress : totalsMain;
    for (const lv of LEVELS) bucket[lv] += s.counts[lv];
  }
  const orphans = scan.orphans.map((o) => ({
    code: 'sk-00b',
    level: 'P0',
    path: o.path,
    bucket: o.bucket,
    files: o.files,
    assetsDirs: o.assetsDirs,
    message: '技能目录缺入口文件：有 ' + o.assetsDirs.join('/') + ' 却没有 SKILL.src.md / SKILL.md，任何厂商都加载不了',
  }));
  const orphanP0 = orphans.length;
  const result = {
    tool: 'skill-lint',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    root: opts.root,
    skillsBase: scan.skillsBase,
    scoring: { start: 100, penalty: PENALTY, floor: 0 },
    rules: Object.keys(RULES).map((code) => ({ code: code, title: RULES[code].title, level: RULES[code].level })),
    totals: {
      skills: skills.length,
      thirdParty: skills.filter((s) => s.thirdParty).length,
      inProgress: skills.filter((s) => s.inProgress).length,
      P0: skills.reduce((n, s) => n + s.counts.P0, 0) + orphanP0,
      P1: skills.reduce((n, s) => n + s.counts.P1, 0),
      P2: skills.reduce((n, s) => n + s.counts.P2, 0),
      info: skills.reduce((n, s) => n + s.counts.info, 0),
    },
    totalsMain: { P0: totalsMain.P0 + orphanP0, P1: totalsMain.P1, P2: totalsMain.P2, info: totalsMain.info },
    totalsInProgress: totalsInProgress,
    orphans: orphans,
    skipped: scan.skipped,
    skills: skills.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path)),
  };

  if (opts.md) {
    fs.mkdirSync(path.dirname(opts.md), { recursive: true });
    fs.writeFileSync(opts.md, buildMarkdown(result) + '\n', 'utf-8');
  }
  if (opts.out) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  }
  return result;
}

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    process.stdout.write('[skill-lint] ' + e.message + '\n' + USAGE + '\n');
    return 2;
  }
  if (opts.help) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  let result;
  try {
    result = run(opts);
  } catch (e) {
    process.stdout.write('[skill-lint] ' + e.message + '\n');
    return 2;
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(summarize(result) + '\n');
    if (opts.verbose) {
      process.stdout.write('\n── 逐技能命中明细 ──\n');
      process.stdout.write(summarizeVerbose(result) + '\n');
    }
  }
  if (opts.strict && result.totals.P0 > 0) {
    if (!opts.json) process.stderr.write('\n[skill-lint] --strict：存在 P0 级发现（' + result.totals.P0 + ' 条），退出码 1\n');
    return 1;
  }
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  process.exitCode = main(process.argv.slice(2));
}

export {
  lintSkill, listSkillDirs, parseFrontmatterText, parseYaml, lenientFrontmatter,
  toPosix, classifyThirdParty, run, main, buildMarkdown, summarize, RULES, PENALTY,
};
