// validate-skill.mjs — 校验技能结构（迁移自 quick_validate.py，零第三方依赖）。
// 校验：目录命名、SKILL.md 大小写精确存在、frontmatter 必需字段/允许键/长度、name 与目录名匹配。
// 用法：node validate-skill.mjs <skill-directory>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const NAME_RE = /^[a-z0-9-]+$/;
const ALLOWED_PROPERTIES = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'compatibility']);

/** 校验技能名遵循 kebab-case。返回 [是否合法, 错误信息或 null]。 */
export function checkNameConvention(name) {
  if (typeof name !== 'string') return [false, `Name must be a string, got ${typeof name}`];
  name = name.trim();
  if (!name) return [false, 'Name cannot be empty'];
  if (!NAME_RE.test(name)) return [false, `Name '${name}' should be kebab-case (lowercase letters, digits, and hyphens only)`];
  if (name.startsWith('-') || name.endsWith('-') || name.includes('--')) {
    return [false, `Name '${name}' cannot start/end with hyphen or contain consecutive hyphens`];
  }
  if (name.length > 64) return [false, `Name is too long (${name.length} characters). Maximum is 64 characters.`];
  return [true, null];
}

/** 大小写精确存在：OS 认为存在 + 父目录里 exact 匹配。 */
export function exactCaseExists(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) return false;
  const parent = path.dirname(abs);
  if (parent === abs) return true;
  const actual = fs.readdirSync(parent);
  return actual.includes(path.basename(abs));
}

/**
 * 提取并解析 frontmatter 顶部键。返回 { map, error? }。
 * map 为顶层标量键的 map（block scalar / 嵌套 map 子行归并到所属键）。
 */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { error: 'No YAML frontmatter found' };
  let end = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') { end = i; break; }
  if (end === -1) return { error: 'Invalid frontmatter format' };

  const fm = lines.slice(1, end);
  if (fm.length === 0) return { map: {} };
  if (fm[0].trim().startsWith('- ')) return { notDict: true };

  const map = {};
  let currentKey = null;
  let block = false;
  for (const raw of fm) {
    const line = raw.trim();
    if (line === '') continue;
    if (currentKey && (raw.startsWith('  ') || raw.startsWith('\t') || raw.endsWith(':') && block) && (block)) {
      // 缩进子行：block scalar 续行归并到当前键；首行为指示符（>|）时只设初值不拼内容
      const indicator = /^[|>]-?$/.test(map[currentKey] ?? '');
      map[currentKey] = map[currentKey] === undefined ? line
        : (Array.isArray(map[currentKey]) ? map[currentKey]
          : (indicator ? line : map[currentKey] + ' ' + line));
      continue;
    }
    const m = raw.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (!m) { map.__meta_raw = true; continue; }
    currentKey = m[1];
    const value = m[2].trim();
    if (value === '' || /^[|>]-?$/.test(value)) {
      map[currentKey] = value; // block scalar 指示符（> | >- |-）或空值：进入续行模式
      block = true;
    } else {
      map[currentKey] = value.replace(/^['"]|['"]$/g, '');
      block = false;
    }
  }
  return { map };
}

/** 校验技能目录可打包结构。返回 [是否合法, 消息]。 */
export function validateSkill(skillPath) {
  const skillPathResolved = path.resolve(skillPath);
  const [nameOk, nameErr] = checkNameConvention(path.basename(skillPathResolved));
  if (!nameOk) return [false, `Invalid skill folder name: ${nameErr}`];

  const skillMd = path.join(skillPathResolved, 'SKILL.md');
  if (!exactCaseExists(skillMd)) return [false, 'SKILL.md not found'];

  const content = fs.readFileSync(skillMd, 'utf-8');
  if (!content.startsWith('---')) return [false, 'No YAML frontmatter found'];

  const { map, error, notDict } = parseFrontmatter(content);
  if (error) return [false, error];
  if (notDict) return [false, 'Implicit list of entries is not allowed, must be a YAML dictionary'];

  const unexpected = Object.keys(map).filter((k) => !ALLOWED_PROPERTIES.has(k));
  if (unexpected.length > 0) {
    return [false, `Unexpected key(s) in SKILL.md frontmatter: ${unexpected.sort().join(', ')}. Allowed properties are: ${[...ALLOWED_PROPERTIES].sort().join(', ')}`];
  }
  if (!('name' in map)) return [false, "Missing 'name' in frontmatter"];
  if (!('description' in map)) return [false, "Missing 'description' in frontmatter"];

  const name = map.name;
  const [name2Ok, name2Err] = checkNameConvention(name);
  if (!name2Ok) return [false, name2Err];
  if (name !== path.basename(skillPathResolved)) return [false, `Skill name ${name} is mismatched with folder name ${path.basename(skillPathResolved)}`];

  const description = map.description ?? '';
  if (typeof description !== 'string') return [false, `Description must be a string, got ${typeof description}`];
  if (map.name !== undefined && description.length > 1024) {
    return [false, `Description is too long (${description.length} characters). Maximum is 1024 characters.`];
  }

  if (map.compatibility !== undefined && map.compatibility !== '') {
    const comp = map.compatibility;
    if (typeof comp !== 'string') return [false, `Compatibility must be a string, got ${typeof comp}`];
    if (comp.length > 500) return [false, `Compatibility is too long (${comp.length} characters). Maximum is 500 characters.`];
  }

  return [true, 'Skill is valid!'];
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: node validate-skill.mjs <skill_directory>');
    process.exit(1);
  }
  const [valid, message] = validateSkill(dir);
  console.log(message);
  process.exit(valid ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();