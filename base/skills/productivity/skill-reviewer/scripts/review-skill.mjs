// review-skill.mjs — 将 skill-reviewer 规则集中机械可判定的子项形式化为可扫描 CLI（零第三方依赖）。
// 规则来源: references/skill-coding-rules.md。仅脚本化确定性规则；判别/语义类规则（G.NAM.02/.04、G.EXP.02..06、G.PRA.02）保留给模型。
// 用法: node review-skill.mjs <skill-dir> [--json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ==== 共享工具 ====

/** 在 skillRoot 下查找 skill.md（大小写不敏感），返回 { exact, present }。exact 为真实文件名。 */
function findSkillMd(root) {
  let entries = [];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return { exact: null, present: false };
  }
  if (entries.includes('SKILL.md')) return { exact: 'SKILL.md', present: true };
  const lower = entries.find((e) => e.toLowerCase() === 'skill.md');
  return lower ? { exact: lower, present: true } : { exact: null, present: false };
}

/** 从 frontmatter 提取顶层标量 name/description。返回 { meta, error? }。 */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { error: 'No YAML frontmatter found' };
  let end = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i].trim() === '---') { end = i; break; }
  if (end === -1) return { error: 'Invalid frontmatter format' };
  const fm = lines.slice(1, end);
  const meta = {};
  let blockKey = null;
  let blockLines = [];
  for (const raw of fm) {
    const isIndented = /^[\t ]+/.test(raw);
    if (blockKey) {
      if (isIndented) { blockLines.push(raw.trim()); continue; }
      meta[blockKey] = blockLines.join(' ');
      blockKey = null;
    }
    if (isIndented) continue; // 嵌套 map 子行，仅保留顶层标量键
    const m = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();
    if (/^[|>]-?$/.test(val)) { blockKey = key; blockLines = []; continue; }
    meta[key] = val.replace(/^['"]|['"]$/g, '');
  }
  if (blockKey !== null) meta[blockKey] = blockLines.join(' ');
  return { meta };
}

/** 读取 skillRoot 的 SKILL.md 并解析 name/description。返回 { found, name, description, fmError? }。 */
function readSkillMeta(root) {
  const found = findSkillMd(root);
  if (!found.present) return { found, name: '', description: '', fmError: 'SKILL.md not found' };
  const content = fs.readFileSync(path.join(root, found.exact), 'utf8');
  const { meta, error } = parseFrontmatter(content);
  if (error) return { found, name: '', description: '', fmError: error };
  return { found, name: meta.name ?? '', description: meta.description ?? '', fmError: null };
}

const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/;

// ==== 命名类规则 ====

/** (G.NAM.01) 烤串命名法：仅小写字母/数字/连字符，首尾非 '-'，无 '--'，≤64。 */
export function checkKebabCase(name) {
  const code = 'G.NAM.01';
  if (typeof name !== 'string') return { code, passed: false, detail: 'name must be a string' };
  const n = name.trim();
  if (!n) return { code, passed: false, detail: 'name is empty' };
  if (!/^[a-z0-9-]+$/.test(n)) {
    return { code, passed: false, detail: `name '${n}' should be kebab-case (lowercase letters, digits, and hyphens only)` };
  }
  if (n.startsWith('-') || n.endsWith('-') || n.includes('--')) {
    return { code, passed: false, detail: `name '${n}' cannot start/end with hyphen or contain consecutive hyphens` };
  }
  if (n.length > 64) return { code, passed: false, detail: `name too long (${n.length} chars, max 64)` };
  return { code, passed: true, detail: `name '${n}' uses valid kebab-case` };
}

/** 默认语义噪音词模式（可配置正则数组）：-agent-、-tool、-assistant、mcp。 */
export const DEFAULT_NOISE_PATTERNS = [
  /-agent-/,
  /-tool\b/,
  /-assistant\b/,
  /\bmcp\b/i,
];

/** (G.NAM.03) 避免语义噪音词：name 含噪音词则失败。 */
export function checkNoiseWords(name, patterns = DEFAULT_NOISE_PATTERNS) {
  const code = 'G.NAM.03';
  if (typeof name !== 'string' || !name.trim()) return { code, passed: false, detail: 'name is empty' };
  const n = name.trim();
  const matched = [];
  for (const p of patterns) {
    const r = p.global ? new RegExp(p.source, p.flags.replace('g', '')) : p;
    if (r.test(n)) matched.push(p.source);
  }
  if (matched.length) {
    return { code, passed: false, detail: `name '${n}' contains semantic noise word(s): ${matched.join(', ')}` };
  }
  return { code, passed: true, detail: 'name contains no semantic noise words' };
}

// ==== 目录结构规则 ====

/** (G.FMT.01) 目录名 == SKILL.md frontmatter 的 name。 */
export function checkDirMatchesName(skillRoot) {
  const code = 'G.FMT.01';
  const { name, fmError } = readSkillMeta(skillRoot);
  const dirName = path.basename(path.resolve(skillRoot));
  if (fmError) return { code, passed: false, detail: `cannot determine skill name: ${fmError}` };
  if (name !== dirName) {
    return { code, passed: false, detail: `directory '${dirName}' does not match SKILL.md name '${name}'` };
  }
  return { code, passed: true, detail: `directory name matches skill name '${dirName}'` };
}

const SCRIPT_EXTENSIONS = new Set(['.py', '.sh', '.mjs', '.js', '.cjs', '.ps1', '.rb', '.pl', '.ts']);

/** (G.FMT.02) 脚本应存放于 scripts/ 下；直接散落在 skill 根目录的脚本视为失败。 */
export function checkScriptsInDir(skillRoot) {
  const code = 'G.FMT.02';
  let entries;
  try {
    entries = fs.readdirSync(skillRoot, { withFileTypes: true });
  } catch {
    return { code, passed: false, detail: 'cannot read skill directory' };
  }
  const scattered = entries
    .filter((e) => e.isFile())
    .filter((e) => SCRIPT_EXTENSIONS.has(path.extname(e.name).toLowerCase()));
  if (scattered.length) {
    const names = scattered.map((e) => e.name).sort().join(', ');
    return { code, passed: false, detail: `script(s) found directly in skill root, expected under scripts/: ${names}` };
  }
  return { code, passed: true, detail: 'no scripts scattered in skill root' };
}

// ==== 文件格式规则 ====

/** (G.FMT.05) name 与目录名为英文（不含 CJK）；SKILL.md 文件名必须严格为 'SKILL.md'。 */
export function checkEnglishNaming(skillRoot) {
  const code = 'G.FMT.05';
  const { name, found } = readSkillMeta(skillRoot);
  const dirName = path.basename(path.resolve(skillRoot));
  if (!found.present) return { code, passed: false, detail: 'SKILL.md not found' };
  if (found.exact !== 'SKILL.md') {
    return { code, passed: false, detail: `SKILL.md must be named exactly 'SKILL.md', found '${found.exact}'` };
  }
  if (CJK_RE.test(name)) {
    return { code, passed: false, detail: `SKILL.md name '${name}' contains non-English (CJK) characters` };
  }
  if (CJK_RE.test(dirName)) {
    return { code, passed: false, detail: `directory '${dirName}' contains non-English (CJK) characters` };
  }
  return { code, passed: true, detail: 'name and directory are English; SKILL.md named exactly' };
}

// ==== 内容要求规则 ====

/** (G.EXP.01) description 非空且 ≤1024 字符（信息量启发式：非空且有内容即可）。 */
export function checkDescription(skillRoot) {
  const code = 'G.EXP.01';
  const { description, fmError } = readSkillMeta(skillRoot);
  if (fmError) return { code, passed: false, detail: `cannot read description: ${fmError}` };
  if (typeof description !== 'string' || !description.trim()) return { code, passed: false, detail: 'description is empty' };
  if (description.length > 1024) {
    return { code, passed: false, detail: `description too long (${description.length} chars, max 1024)` };
  }
  return { code, passed: true, detail: `description present (${description.length} chars)` };
}

// ==== 最佳实践规则 ====

/** (G.PRA.01) 必须存在 SKILL.md、CHANGELOG.md、LICENSE.md（或 LICENSE.*）、README.md。 */
export function checkRequiredDocs(skillRoot) {
  const code = 'G.PRA.01';
  let entries;
  try {
    entries = fs.readdirSync(skillRoot);
  } catch {
    return { code, passed: false, detail: 'cannot read skill directory' };
  }
  const missing = [];
  const found = findSkillMd(skillRoot);
  if (!found.present) missing.push('SKILL.md');
  if (!entries.includes('CHANGELOG.md')) missing.push('CHANGELOG.md');
  if (!entries.some((e) => e.toLowerCase().startsWith('license.'))) missing.push('LICENSE.md (or LICENSE.*)');
  if (!entries.includes('README.md')) missing.push('README.md');
  if (missing.length) return { code, passed: false, detail: `missing required docs: ${missing.join(', ')}` };
  return { code, passed: true, detail: 'all required docs present (SKILL.md, CHANGELOG.md, LICENSE, README.md)' };
}

// ==== 顶层 API ====

/** 对 skillRoot 运行全部机械可判定规则，返回 { root, results: [{code, passed, detail}] }。 */
export function reviewSkill(skillRoot) {
  const root = path.resolve(skillRoot);
  const { name } = readSkillMeta(root);
  return {
    root,
    results: [
      checkKebabCase(name),
      checkNoiseWords(name),
      checkDirMatchesName(root),
      checkScriptsInDir(root),
      checkEnglishNaming(root),
      checkDescription(root),
      checkRequiredDocs(root),
    ],
  };
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const dir = args.filter((a) => a !== '--json')[0];
  if (!dir) {
    console.error('Usage: node review-skill.mjs <skill-dir> [--json]');
    process.exit(1);
  }
  const report = reviewSkill(dir);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of report.results) {
      console.log(`${r.passed ? '[PASS]' : '[FAIL]'} ${r.code} ${r.detail}`);
    }
    const passed = report.results.filter((r) => r.passed).length;
    console.log(`${passed}/${report.results.length} checks passed`);
  }
  const anyFail = report.results.some((r) => !r.passed);
  process.exit(anyFail ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();