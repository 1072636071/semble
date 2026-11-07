#!/usr/bin/env node
// setup.mjs — jxx-setup-skills 的确定性流程 CLI（零第三方依赖，ESM，自包含）
//
// 子命令：
//   init          一键初始化（默认）：detect 现状 + sync-doc 落盘，全部默认参数即"全部默认"
//   detect        只读探索：扫描仓库初始状态，输出 JSON 报告（含与种子的漂移）
//   ocr           只读检测 OCR（open-code-review CLI）是否已安装（未安装退出码 4，由模型询问用户）
//   sync-doc      写入：双文件逐字节一致 + Agent skills 块 upsert + docs/agents/*.md 克隆 + 可选子树双文件
//   sync-skills   维护项目技能清单：扫描项目技能目录 → 重写 AGENTS.md 受管小节 → 同步 CODEBUDDY.md
//   template      输出全部文件内容到 stdout（不落盘），供预览/手动复制
//
// 写入策略（关键）：**已存在且内容不同的文件默认不覆盖**，动作记为 `conflict` 并原样保留，
// 由模型读取文件后决定（手工合并 / `--overwrite <文件>` 精确覆盖 / `--force` 全部覆盖）。
// 只写"缺失"的文件、只追加缺失的工程块。存在冲突时 CLI 退出码为 3。
//
// **受管区域例外**（不静默覆盖原则的唯一例外，且范围可判定）：
//   - `## Agent skills` 块内 `### 项目技能` 小节中 `<!-- jxx-setup-skills:skills:start/end -->`
//     之间的技能表，由脚本独占维护——项目技能增删改后必须自动刷新，故这类差异直接落盘、不报 conflict。
//   - 项目技能目录的 README.md：生成部分随技能清单刷新，手写补充（标记行之后）永远保留。
//
// 本脚本随技能目录分发，不依赖技能目录之外的任何文件（种子模板即技能目录根下的三份 .md）。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- 常量

export const MULTI_AGENT_BLOCK = '## 多代理要求\n\nAGENTS.md 和 CODEBUDDY.md 内容必须保持一致。';

// 三份 docs/agents 模板：种子即技能目录根下的同名文件（自包含，无外部种子目录）
export const DOC_TEMPLATES = [
  { seed: 'issue-tracker-local.md', out: 'issue-tracker.md' },
  { seed: 'triage-labels.md', out: 'triage-labels.md' },
  { seed: 'domain.md', out: 'domain.md' },
];

// 五种标准 triage 角色（确定性顺序）
export const TRIAGE_ROLES = ['needs-triage', 'needs-info', 'ready-for-agent', 'ready-for-human', 'wontfix'];

// ---------------------------------------------------------------- 项目技能目录（常量）
//
// 项目技能 = 目标仓库自己写的技能（区别于安装到用户目录的通用工程技能）。
// 布局：一个技能一个子目录 + `SKILL.md`（frontmatter 写 name + description），
// 可选 references/ scripts/ assets/；清单由脚本扫描目录生成并写进 AGENTS.md 的受管小节。

/** 项目技能目录（相对仓库根），可由 --skills-dir 覆盖。 */
export const DEFAULT_SKILLS_DIR = 'docs/agents/skills';
/** 受管标记：夹住脚本生成的技能表，标记之外的任何字符永不被覆盖。 */
export const SKILLS_MARK_START = '<!-- jxx-setup-skills:skills:start -->';
export const SKILLS_MARK_END = '<!-- jxx-setup-skills:skills:end -->';
/** 受管小节标题（后缀会带上实际目录名，便于人工阅读与推断目录）。 */
export const SKILLS_SECTION_HEADING = '### 项目技能';
/** 技能目录 README 里"手写补充"的分界线：此行之后的内容永远保留。 */
export const README_TAIL_MARK = '<!-- jxx-setup-skills:hand-written -->';
/** 项目技能目录内的说明文件名（生成，同时让空目录能被 git 跟踪）。 */
export const SKILLS_README_NAME = 'README.md';

// ---------------------------------------------------------------- 工具

/** 逐字节比较两份文件是否一致。不存在按不一致处理。 */
export function filesIdentical(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}

/** 归一化相对路径（反斜杠 → /，去掉前导 ./ 与 /），用于 --overwrite 匹配。 */
export function normRel(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * 提取内容中已有的「## Agent skills」块（含标题行，去掉尾部空行与 \r）；不存在返回 null。
 * 用于判断"已有块是否就是将要写入的块"，从而决定是 unchanged 还是 conflict。
 */
export function extractAgentSkillsBlock(content) {
  if (!content) return null;
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Agent skills');
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').replace(/\n+$/, '');
}

function writeFileSafe(abs, content) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

/**
 * 子树目标文件是否为符号链接（含断链）。lstat 只看链接本身，不跟随到目标。
 * @param {string} abs 目标文件绝对路径
 * @returns {boolean} 是符号链接则 true，普通文件或不存在则 false
 */
export function subtreeTargetIsSymlink(abs) {
  try {
    return fs.lstatSync(abs).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * 校验并归一化子树目录。目录必须已存在，解析后的词法路径与真实路径都不得离开仓库。
 * @param {string} root 仓库根目录
 * @param {string[]} subtrees 仓库内相对目录列表
 * @returns {Array<{dir: string, abs: string}>} 按输入顺序去重后的子树列表
 */
export function resolveSubtrees(root, subtrees = []) {
  if (!subtrees || subtrees.length === 0) return [];
  if (!root) throw new Error('--subtree 需要配合 --root 指定目标仓库');
  const rootAbs = path.resolve(root);
  const rootReal = fs.realpathSync(rootAbs);
  const seen = new Set();
  const resolved = [];
  for (const value of subtrees) {
    const input = String(value || '').trim();
    if (!input) throw new Error('--subtree 不能为空或指向仓库根目录');
    if (path.isAbsolute(input) || path.posix.isAbsolute(input) || path.win32.isAbsolute(input)) {
      throw new Error(`--subtree 只接受仓库内相对目录，收到绝对路径: ${input}`);
    }
    const portable = input.replace(/\\/g, '/');
    if (portable.split('/').includes('..')) throw new Error(`--subtree 不允许 .. 穿越: ${input}`);
    const abs = path.resolve(rootAbs, input);
    const rel = path.relative(rootAbs, abs);
    if (!rel) throw new Error('--subtree 不能指向仓库根目录');
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
      throw new Error(`--subtree 必须位于仓库内: ${input}`);
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      throw new Error(`--subtree 目标目录必须已存在: ${input}`);
    }
    const targetReal = fs.realpathSync(abs);
    const realRel = path.relative(rootReal, targetReal);
    if (!realRel || realRel === '..' || realRel.startsWith(`..${path.sep}`) || path.isAbsolute(realRel)) {
      throw new Error(`--subtree 真实目录必须位于仓库内且不能是仓库根目录: ${input}`);
    }
    const dir = rel.split(path.sep).join('/');
    if (seen.has(dir)) continue;
    seen.add(dir);
    resolved.push({ dir, abs });
  }
  return resolved;
}

/**
 * 子树文件只声明局部职责并链接实际根指令文件，不复制根规则。
 * 根 AGENTS.md 存在或仓库为空时链接 AGENTS.md；只有 CLAUDE.md 时链接 CLAUDE.md。
 * @param {string} root 仓库根目录
 * @param {string} dir 已校验的仓库内相对目录
 * @returns {string} AGENTS.md 与 CODEBUDDY.md 共用的内容
 */
export function buildSubtreeContent(root, dir) {
  const rootAgents = path.join(root, 'AGENTS.md');
  const rootClaude = path.join(root, 'CLAUDE.md');
  const useClaude = !fs.existsSync(rootAgents) && fs.existsSync(rootClaude);
  const rootName = useClaude ? 'CLAUDE.md' : 'AGENTS.md';
  const link = path.relative(path.join(root, dir), useClaude ? rootClaude : rootAgents).split(path.sep).join('/');
  return `本目录仅负责 \`${dir}/\` 内的局部实现与测试；局部约定不得覆盖或复制仓库级规则。\n\n仓库级规则见 [根 ${rootName}](${link})。\n`;
}

/** 按普通文件的冲突保护语义同步一个子树的 AGENTS.md 与 CODEBUDDY.md。 */
function syncSubtreeFiles({ root, subtree, dryRun, canOverwrite, markConflict, actions }) {
  const content = buildSubtreeContent(root, subtree.dir);
  for (const name of ['AGENTS.md', 'CODEBUDDY.md']) {
    const rel = `${subtree.dir}/${name}`;
    const abs = path.join(subtree.abs, name);
    // 目录已校验真实路径；目标文件也要挡符号链接，否则 writeFileSync 会跟随链接写到仓库外。
    if (subtreeTargetIsSymlink(abs)) {
      markConflict(rel, '目标文件是符号链接，可能指向仓库外；已保留原文件，不写入');
      continue;
    }
    if (!fs.existsSync(abs)) {
      actions.push({ file: rel, action: dryRun ? 'skipped' : 'created', detail: '创建子树局部职责说明并链接实际根指令文件' });
      if (!dryRun) writeFileSafe(abs, content);
    } else if (fs.readFileSync(abs, 'utf-8') === content) {
      actions.push({ file: rel, action: 'unchanged', detail: '子树局部职责说明已是最新' });
    } else if (canOverwrite(rel)) {
      actions.push({ file: rel, action: dryRun ? 'skipped' : 'updated', detail: dryRun ? '演练：将按覆盖授权更新子树说明' : '按覆盖授权更新子树说明' });
      if (!dryRun) writeFileSafe(abs, content);
    } else {
      markConflict(rel, '已存在且与子树局部职责说明不同，已保留原文件（未覆盖）');
    }
  }
}

// ---------------------------------------------------------------- 项目技能目录（工具）

/** 归一化项目技能目录（去前导 ./ 与尾部 /）；空值回落默认值。 */
export function normalizeSkillsDir(dir) {
  if (dir === undefined || dir === null || String(dir).trim() === '') return DEFAULT_SKILLS_DIR;
  const s = normRel(String(dir).trim()).replace(/\/+$/, '');
  return s || DEFAULT_SKILLS_DIR;
}

/**
 * 极简 frontmatter 解析：只取顶层 `key: value`（去引号），缩进行视为嵌套而忽略。
 * 只需要 name/description，不引入 YAML 依赖。
 */
export function parseFrontmatter(content) {
  const text = String(content || '').replace(/^\uFEFF/, '');
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^[ \t]/.test(line)) continue; // 空行 / 缩进行（嵌套）→ 跳过
    const kv = /^([A-Za-z0-9_.-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
    out[kv[1]] = v;
  }
  return out;
}

/**
 * 把 SKILL.md 的 description 压成一行「何时加载」短语：取第一个句读（。；!）之前的子句，
 * 超长再截断。确定性、无模型参与，故重复运行结果一致。
 */
export function summarizeDescription(desc, max = 60) {
  const one = String(desc || '').replace(/\s+/g, ' ').trim();
  if (!one) return '（SKILL.md 未写 description）';
  const stop = one.search(/[。；;！!]/);
  let s = stop > 0 ? one.slice(0, stop) : one;
  if (s.length > max) s = `${s.slice(0, max)}…`;
  return s || '（SKILL.md 未写 description）';
}

/**
 * 扫描项目技能目录：只认「顶层子目录 + 其中存在 SKILL.md」（跳过点目录），
 * 技能名取 frontmatter 的 name（缺失则回落目录名），按名字排序保证输出确定。
 * @param {string} root 仓库根绝对路径
 * @param {string} skillsDir 项目技能目录（相对仓库根）
 * @returns {{dir: string, exists: boolean, readme: string|null, skills: Array<{name: string, dir: string, skillMd: string, description: string, summary: string}>}}
 */
export function scanProjectSkills(root, skillsDir = DEFAULT_SKILLS_DIR) {
  const dir = normalizeSkillsDir(skillsDir);
  const abs = path.join(root, dir);
  const result = { dir, exists: fs.existsSync(abs), readme: null, skills: [] };
  if (!result.exists) return result;
  const readmeAbs = path.join(abs, SKILLS_README_NAME);
  result.readme = fs.existsSync(readmeAbs) ? readmeAbs : null;
  let entries = [];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return result; // 读不到目录就当空目录，不让只读扫描失败
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const skillMdAbs = path.join(abs, e.name, 'SKILL.md');
    if (!fs.existsSync(skillMdAbs)) continue; // 只有 references/ scripts/ assets/ 的目录不是技能
    let fm = {};
    try {
      fm = parseFrontmatter(fs.readFileSync(skillMdAbs, 'utf-8'));
    } catch {
      /* 读不了就当没有 frontmatter，退回目录名 */
    }
    const name = (fm.name && fm.name.trim()) || e.name;
    result.skills.push({
      name,
      dir: `${dir}/${e.name}`,
      skillMd: `${dir}/${e.name}/SKILL.md`,
      description: fm.description || '',
      summary: summarizeDescription(fm.description),
    });
  }
  result.skills.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return result;
}

/** 生成技能表（markdown）。无技能时给一行占位说明，而不是空表。按名字排序，输出确定。 */
export function buildSkillsTable(scan) {
  const skills = ((scan && scan.skills) || []).slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (skills.length === 0) {
    return '（暂无项目技能。新增技能：建 `<name>/SKILL.md`，然后重跑 `sync-skills` 刷新本表。）';
  }
  return ['| 技能 | 何时加载 |', '| --- | --- |', ...skills.map((s) => `| \`${s.name}\` | ${s.summary} |`)].join('\n');
}

/** 从任意文本（含本函数自己的产物）中取出受管标记之间的正文。 */
export function extractManagedBody(text) {
  const region = extractManagedRegion(text);
  return region ? region.body : null;
}

/** 构建受管小节全文：标题（带目录）+ 约定说明 + 标记包裹的技能表。 */
export function buildProjectSkillsSection(scan) {
  const dir = (scan && scan.dir) || DEFAULT_SKILLS_DIR;
  return [
    `${SKILLS_SECTION_HEADING}（\`${dir}/\`）`,
    '',
    `本仓项目技能的**唯一存放处**：一个技能一个目录 \`${dir}/<name>/\`，入口 \`${dir}/<name>/SKILL.md\`（frontmatter 写 \`name\` + \`description\`），可选 \`references/\`、\`scripts/\`。`,
    '',
    '**新增、删除或改动任一技能后，必须重跑** `node <jxx-setup-skills 目录>/scripts/setup.mjs sync-skills --root <仓库根>`：它重新扫描该目录并重写下表（标记之间由脚本维护，标记之外的手写内容不会被动），再把 \`AGENTS.md\` 逐字节同步到 \`CODEBUDDY.md\`。',
    '',
    SKILLS_MARK_START,
    buildSkillsTable(scan),
    SKILLS_MARK_END,
  ].join('\n');
}

/** 取出受管区域的位置（行号）与正文；无标记返回 null。 */
export function extractManagedRegion(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === SKILLS_MARK_START);
  if (start === -1) return null;
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === SKILLS_MARK_END) {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  return { start, end, body: lines.slice(start + 1, end).join('\n') };
}

/** 只替换受管标记之间的正文（标记与标记之外的字符一律不动）；无标记返回 null。 */
export function replaceManagedRegion(content, body) {
  const region = extractManagedRegion(content);
  if (!region) return null;
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  return [...lines.slice(0, region.start + 1), ...String(body).split('\n'), ...lines.slice(region.end)].join('\n');
}

/**
 * 找出内容里**别人手写的**技能清单标题（不含本技能自己的受管小节与 `## Agent skills` 块）。
 * 命中时不能静默再插一份清单，否则仓库里会有两份互相打架的技能列表 → 交模型合并。
 *
 * 只认「真清单」：标题本身像清单（清单/列表/一览/表/索引），或其小节正文里有以技能为首列的
 * markdown 表格。像 `### 新增 SKILL`（讲怎么新建技能）这类约定小节不算，避免误报成冲突。
 */
export function findForeignSkillsHeadings(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!/^#{1,4}\s+.*(技能|skills?)/i.test(t)) continue;
    if (/^##\s+agent\s+skills$/i.test(t)) continue; // 本脚本自己的工程块
    if (t.startsWith(SKILLS_SECTION_HEADING)) continue; // 本脚本自己的受管小节
    const body = [];
    for (let j = i + 1; j < lines.length && !/^#{1,6}\s/.test(lines[j].trim()); j++) body.push(lines[j]);
    const headingLooksLikeList = /(清单|列表|一览|对照表|索引|一览表|表$)/.test(t) || /\bskills?\s+list\b/i.test(t);
    const hasSkillTable = body.some((l) => /^\s*\|/.test(l)) && /^\s*\|.*(技能|skill).*\|/im.test(body.join('\n'));
    if (headingLooksLikeList || hasSkillTable) hits.push(t);
  }
  return hits;
}

/** 把受管小节插入到 `## Agent skills` 块尾；无该块则新建一个只含该小节的块。 */
function insertSkillsSection(content, sectionLines) {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Agent skills');
  if (start === -1) {
    const tail = String(content).replace(/\s+$/, '');
    const block = ['## Agent skills', '', ...sectionLines];
    return (tail ? `${tail}\n\n${block.join('\n')}\n` : `${block.join('\n')}\n`);
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  // 去掉块尾多余空行，作为插入点
  let at = end;
  while (at > start + 1 && lines[at - 1].trim() === '') at--;
  const tail = lines.slice(at);
  const joined = [...lines.slice(0, at), '', ...sectionLines, ...tail].join('\n');
  // 块在文件末尾时统一以单个换行收尾；块后面已有空行则交给它们分隔
  return end === lines.length ? `${joined.replace(/\n+$/, '')}\n` : joined;
}

/**
 * upsert 受管「### 项目技能」小节（不触碰其他任何内容）。
 * @returns {{content: string, action: 'unchanged'|'updated'|'inserted'|'conflict', foreign?: string[]}}
 */
export function upsertProjectSkillsSection(content, section) {
  const src = String(content || '');
  const body = extractManagedBody(section);
  if (body === null) throw new Error('buildProjectSkillsSection 未产出受管标记，拒绝写入');
  // 1) 已有受管区域 → 只换标记之间的表格（增删改技能后的常规路径，永远可写）
  const next = replaceManagedRegion(src, body);
  if (next !== null) return { content: next === src ? src : next, action: next === src ? 'unchanged' : 'updated' };
  // 2) 无标记但有手写技能清单 → 不插第二份，报冲突交模型合并（或让它加标记后接管）
  const foreign = findForeignSkillsHeadings(src);
  if (foreign.length > 0) return { content: src, action: 'conflict', foreign };
  // 3) 全新插入
  return { content: insertSkillsSection(src, section.split('\n')), action: 'inserted' };
}

/**
 * 判断两份内容的差异是否**只**落在受管技能小节里（是 → 可直接落盘，不必 `--overwrite`）。
 * 做法：把受管小节整段剔除后再比较，并归一化多余空行。
 */
export function isManagedOnlyDelta(before, after) {
  const strip = (text) => {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inSection = false; // 从受管小节标题起整段丢弃（标题 + 说明段 + 标记 + 表格）
    let inRegion = false; // 标记之间
    for (const l of lines) {
      const t = l.trim();
      if (t === SKILLS_MARK_START) {
        inSection = true;
        inRegion = true;
        continue;
      }
      if (t === SKILLS_MARK_END) {
        inSection = false;
        inRegion = false;
        continue;
      }
      if (inRegion) continue;
      if (inSection && /^#{2,4}\s/.test(t)) inSection = false; // 小节里根本没有标记 → 恢复输出（不是受管小节）
      if (inSection) continue;
      if (t.startsWith(SKILLS_SECTION_HEADING)) {
        inSection = true;
        continue;
      }
      out.push(l);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  };
  return strip(before) === strip(after);
}

/** 从已有受管小节标题里推断项目技能目录（让 sync-skills 不带参数也能跑）。 */
export function inferSkillsDir(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim().startsWith(SKILLS_SECTION_HEADING)) continue;
    const m = /`([^`]+)\/`\s*[)）]?\s*$/.exec(line.trim());
    if (m) return normalizeSkillsDir(m[1]);
  }
  return null;
}

/** 合并生成型文件：生成部分刷新，手写补充（分界标记之后）永远保留。 */
export function mergeGeneratedFile(existing, generated) {
  if (existing === null) return { content: generated, action: 'created' };
  if (existing === generated) return { content: existing, action: 'unchanged' };
  const i = existing.indexOf(README_TAIL_MARK);
  if (i !== -1) {
    const nl = existing.indexOf('\n', i);
    const tail = (nl === -1 ? '' : existing.slice(nl + 1)).replace(/^\n+/, '');
    const merged = `${generated.replace(/\n+$/, '')}\n${tail}`;
    return { content: merged, action: merged === existing ? 'unchanged' : 'updated' };
  }
  return { content: existing, action: 'conflict' };
}

/** 项目技能目录 README 的生成内容（含当前技能表 + 分界标记）。 */
export function buildSkillsReadme(scan) {
  const dir = (scan && scan.dir) || DEFAULT_SKILLS_DIR;
  const skills = ((scan && scan.skills) || []).slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const table = skills.length
    ? ['| 技能 | 何时加载 |', '| --- | --- |', ...skills.map((s) => `| \`${s.name}\` | ${s.summary} |`)].join('\n')
    : '_（暂无项目技能）_';
  return `# 项目技能目录

本目录是**本仓项目技能的唯一存放处**：一个技能一个子目录，目录名即技能名，入口文件是 \`SKILL.md\`。

## 目录约定

\`\`\`
${dir}/
├── README.md        ← 本文件（生成部分由 jxx-setup-skills 维护）
└── <skill-name>/
    ├── SKILL.md      ← 必需。frontmatter 至少写 name + description
    ├── references/   ← 可选。较长的参考资料，按需再拆子文档
    ├── scripts/      ← 可选。零依赖脚本（Node/Python）
    └── assets/       ← 可选。模板、图片等素材
\`\`\`

- \`SKILL.md\` 的 frontmatter \`name\` 必须与目录名一致；\`description\` 写「什么时候加载这个技能」，它会进 \`AGENTS.md\` 的技能清单。
- 技能之间用相对本目录的路径互相引用（如 \`../<skill-name>/references/playbook.md\`），保证整目录可整体拷走。
- 一个子目录里没有 \`SKILL.md\` 就不是技能（如只放 \`references/\` 的辅助目录会被忽略）。

## 当前技能

${table}

## 改动后必须同步清单

新增、删除或改动任一技能后，重跑：

\`\`\`bash
node <jxx-setup-skills 目录>/scripts/setup.mjs sync-skills --root <仓库根>
\`\`\`

它重新扫描本目录，重写 \`AGENTS.md\` 里 \`${SKILLS_SECTION_HEADING}\` 小节中标记之间的表格（下方分界标记之后的手写内容不会被覆盖），并把 \`AGENTS.md\` 逐字节同步到 \`CODEBUDDY.md\`。

${README_TAIL_MARK}
`;
}

/**
 * 构建「## Agent skills」块（确定性）。
 * @param {{layout?: 'single'|'multi', labels?: Record<string,string>, scan?: object|null}} opts
 *   layout=multi 用多上下文行；labels 为「角色名 → 实际标签字符串」覆盖表；
 *   scan 为 scanProjectSkills 的结果（undefined=写入默认空清单，null=整节略去，用于 --no-skills）。
 * 返回文本以 `## Agent skills` 开头、以 `\n` 结尾。
 */
export function buildAgentSkillsBlock({ layout = 'single', labels = {}, scan } = {}) {
  if (layout !== 'single' && layout !== 'multi') throw new Error(`layout 仅支持 single|multi，收到: ${layout}`);
  const overridden = TRIAGE_ROLES.filter((r) => labels[r] && labels[r] !== r);
  const triageLine = overridden.length === 0
    ? '采用五种标准 triage 角色（标签字符串与角色名一致，未覆盖）：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。'
    : `采用五种标准 triage 角色（含覆盖）：${TRIAGE_ROLES.map((r) => (labels[r] && labels[r] !== r ? `\`${r}\`→\`${labels[r]}\`` : `\`${r}\``)).join('、')}。参见 \`docs/agents/triage-labels.md\`。`;
  const domainLine = layout === 'multi'
    ? '多上下文布局：根目录 `CONTEXT-MAP.md` 指向各上下文 `CONTEXT.md`（另有 `src/<context>/docs/adr/`）。参见 `docs/agents/domain.md`。'
    : '单一上下文布局：仓库根目录 `CONTEXT.md` + `docs/adr/`。参见 `docs/agents/domain.md`。';
  // scan === null → --no-skills：整节略去（项目技能另放在别处的仓库）
  const skillsSection = scan === null ? '' : `\n${buildProjectSkillsSection(scan || { dir: DEFAULT_SKILLS_DIR, skills: [] })}\n`;
  return `## Agent skills

### Issue tracker

本仓库的 issue 与 PRD 以本地 markdown 形式存放于仓库 \`.scratch/\` 下，不使用远程 tracker。参见 \`docs/agents/issue-tracker.md\`。

> 注意：\`.scratch/\` 是仓库源码的一部分，**必须提交进 git**（不要写进 \`.gitignore\`），让 issue / PRD 随仓库一起版本化管理、可回溯、可协作。

### triage 标签

${triageLine}

### 领域文档

${domainLine}

### 临时文件

所有临时脚本统一放在仓库 \`.temp/scripts/\` 下；其他临时文件（脚本输出、日志等）也要分类，放在 \`.temp/\` 的子目录下（如 \`.temp/output/\`、\`.temp/logs/\`），保证仓库根目录干净。
${skillsSection}`;
}

// 当 CLAUDE.md 与 AGENTS.md 都不存在时的默认 AGENTS.md 内容（确定性骨架）。
// 含「多代理要求」块 + 默认布局下的「Agent skills」三节 + 临时文件约定（SKILL.md「全部默认」）。
export const DEFAULT_AGENTS_CONTENT = `${MULTI_AGENT_BLOCK}\n\n${buildAgentSkillsBlock()}`;

/** 确保内容含「## 多代理要求」块：缺失时插入首个 H1 之后（无 H1 则置顶）；已存在则原样返回。 */
export function ensureMultiAgentBlock(content) {
  if (content.includes('## 多代理要求')) return content;
  const m = content.match(/^# [^\n]*\n/);
  if (m) return m[0] + '\n' + MULTI_AGENT_BLOCK + '\n\n' + content.slice(m[0].length).replace(/^\n+/, '');
  return MULTI_AGENT_BLOCK + '\n\n' + content;
}

/**
 * 就地 upsert「## Agent skills」块：已存在则整段替换（保留周围内容与后续 ## 小节），
 * 缺失则追加到文件末尾。block 以 `## Agent skills` 开头。幂等。
 */
export function upsertAgentSkillsBlock(content, block) {
  const blockLines = block.replace(/\n+$/, '').split('\n');
  if (content.trim() === '') return blockLines.join('\n') + '\n';
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Agent skills');
  if (start === -1) {
    const body = content.endsWith('\n') ? content : content + '\n';
    return body + '\n' + blockLines.join('\n') + '\n';
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  // 保留原块与后续 ## 之间的空行分隔
  const trailing = [];
  for (let i = end - 1; i > start; i--) {
    if (lines[i].trim() === '') trailing.unshift(lines[i]);
    else break;
  }
  if (end < lines.length && trailing.length === 0) trailing.push('');
  if (end === lines.length) {
    // 块在文件末尾：丢弃原块的多余空行，仅保留文件原有的结尾换行（split 产生的末尾空元素）
    trailing.length = 0;
    if (lines[lines.length - 1] === '') trailing.push('');
  }
  return [...lines.slice(0, start), ...blockLines, ...trailing, ...lines.slice(end)].join('\n');
}

// ---------------------------------------------------------------- 子命令实现

/**
 * 生成要写入的「## Agent skills」块。
 * 仓库里已有**手写**技能清单且尚未被标记接管时，**不插第二份清单**（否则两份清单互相打架），
 * 整节略去并交给模型合并；一旦有受管标记（或没有手写清单）就正常写入。
 */
export function buildBlockForRepo(block, scan, existingContent) {
  const base = { ...(block || {}), scan: scan === null ? null : scan || undefined };
  if (scan === null || !existingContent) return { text: buildAgentSkillsBlock(base), skipped: false };
  if (extractManagedRegion(existingContent) || findForeignSkillsHeadings(existingContent).length === 0) {
    return { text: buildAgentSkillsBlock(base), skipped: false };
  }
  return { text: buildAgentSkillsBlock({ ...base, scan: null }), skipped: true };
}

/**
 * 步骤 1「探索」：扫描目标仓库初始状态，输出 JSON 报告（只读，不落盘）。
 * 覆盖 SKILL.md 探索清单的每一项，区分「文件存在 / 不存在」，并报告已有内容与
 * 将要写入内容的**漂移**（drift），供模型判断哪些写入会构成冲突。
 * @param {{root: string, seedsDir?: string, block?: {layout?: 'single'|'multi', labels?: Record<string,string>}}} args
 */
export function runDetect({ root, seedsDir = SKILL_ROOT, block = {}, skillsDir, noSkills = false } = {}) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const ex = (rel) => fs.existsSync(path.join(root, rel));
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf-8');
  // 通用规范文件互斥优先级：CLAUDE.md > AGENTS.md
  const canonical = ex('CLAUDE.md') ? 'CLAUDE.md' : ex('AGENTS.md') ? 'AGENTS.md' : null;
  const canonicalContent = canonical ? read(canonical) : null;
  const codebuddyExists = ex('CODEBUDDY.md');
  // 项目技能目录：未显式指定时沿用仓库自己的约定（从受管小节标题推断），再回落默认值
  const scan = noSkills ? null : scanProjectSkills(root, skillsDir || inferSkillsDir(canonicalContent) || DEFAULT_SKILLS_DIR);
  // 已有「## Agent skills」块与将要写入的块是否一致（null = 无块/无源文件，无从比较）
  const existingBlock = extractAgentSkillsBlock(canonicalContent);
  const generatedBlock = buildAgentSkillsBlock({
    layout: (block && block.layout) || 'single',
    labels: (block && block.labels) || {},
    scan: noSkills ? null : scan || undefined,
  }).trim();
  // 受管技能小节状态：present=有标记（受管）/ missing=无标记也无手写清单 / foreign=有手写清单且无标记
  const foreign = canonicalContent ? findForeignSkillsHeadings(canonicalContent) : [];
  const managed = canonicalContent ? extractManagedRegion(canonicalContent) : null;
  const skillsSection = noSkills
    ? 'disabled'
    : managed
      ? 'present'
      : foreign.length
        ? 'foreign'
        : 'missing';
  return {
    root,
    canonical,
    files: {
      'CLAUDE.md': ex('CLAUDE.md'),
      'AGENTS.md': ex('AGENTS.md'),
      'CODEBUDDY.md': codebuddyExists,
      'CONTEXT.md': ex('CONTEXT.md'),
      'CONTEXT-MAP.md': ex('CONTEXT-MAP.md'),
    },
    agentSkillsBlock: canonicalContent ? canonicalContent.includes('## Agent skills') : false,
    // null=无块可比较；true=与将写入的块一致（写入为 unchanged）；false=块内容不同（写入为 conflict）
    agentSkillsBlockMatches: existingBlock === null ? null : existingBlock.trim() === generatedBlock,
    multiAgentBlock: canonicalContent ? canonicalContent.includes('## 多代理要求') : false,
    // null = 无法比较（缺一文件）；true/false = 逐字节一致/不一致
    codebuddyConsistent: canonical && codebuddyExists ? canonicalContent === read('CODEBUDDY.md') : null,
    dirs: {
      'docs/adr': ex('docs/adr'),
      'docs/agents': ex('docs/agents'),
      '.scratch': ex('.scratch'),
    },
    priorOutputs: ex('docs/agents')
      ? fs.readdirSync(path.join(root, 'docs/agents')).filter((f) => f.endsWith('.md')).sort()
      : [],
    // 三份模板的漂移：exists=false → 写入为 created；matchesSeed=false → 写入为 conflict（默认不覆盖）
    docsAgents: DOC_TEMPLATES.map(({ seed, out }) => {
      const file = `docs/agents/${out}`;
      const exists = ex(file);
      return {
        file,
        exists,
        matchesSeed: exists ? filesIdentical(path.join(seedsDir, seed), path.join(root, file)) : null,
      };
    }),
    // 项目技能目录：目录是否存在、扫到哪些技能、受管小节状态与清单是否已同步
    skillsDir: scan ? scan.dir : null,
    skillsDirExists: scan ? scan.exists : null,
    projectSkills: scan ? scan.skills.map((s) => ({ name: s.name, dir: s.dir, skillMd: s.skillMd, summary: s.summary })) : null,
    skillsSection,
    foreignSkillsHeadings: foreign,
    // null=无受管小节无从比较；true=清单与目录一致；false=清单已过期（sync-skills 会刷新）
    skillsTableInSync: managed && scan ? managed.body.trim() === buildSkillsTable(scan).trim() : null,
  };
}

/**
 * 一键初始化（默认入口）：detect 现状 + sync-doc 落盘，一步完成"全部默认"。
 * 读取目标仓库已有文件并自行处理：已有 CLAUDE.md/AGENTS.md 则以其为通用规范源，
 * **缺失的**工程块才追加/替换（已存在且内容不同的块保留并报 conflict），再同步
 * CODEBUDDY.md（已存在且不一致则保留并报 conflict）；都不存在则默认创建 AGENTS.md
 * 与 CODEBUDDY.md；docs/agents/*.md 仅克隆缺失的，已存在且不同者报 conflict。幂等。
 * @param {{root: string, seedsDir?: string, dryRun?: boolean,
 *          block?: {layout?: 'single'|'multi', labels?: Record<string,string>} | null,
 *          overwrite?: string[], force?: boolean,
 *          skillsDir?: string, noSkills?: boolean, subtrees?: string[]}} args
 * @returns {{detect: object, sync: object}}
 */
export function runInit({ root, seedsDir = SKILL_ROOT, dryRun = false, block = {}, overwrite = [], force = false, skillsDir, noSkills = false, subtrees = [] }) {
  // block 默认 {} → 启用 Agent skills 块 upsert + 多代理要求块注入（与 CLI 行为一致）
  const detect = runDetect({ root, seedsDir, block: block || {}, skillsDir, noSkills });
  const sync = runSyncDoc({ root, seedsDir, dryRun, block, overwrite, force, skillsDir, noSkills, subtrees });
  return { detect, sync };
}

// ---------------------------------------------------------------- 共享写入助手（sync-doc / sync-skills 共用）

/**
 * 把通用规范源逐字节同步到 `CODEBUDDY.md`（多代理要求：两份必须一致）。
 * 冲突判定与 dry-run 演练都要走到，故 dry-run 只影响是否落盘，不影响动作分类。
 * `mirror` = true 表示「写入前两份本来一致」：此时镜像语义允许直接跟写（旧 CODEBUDDY 的每个字节都在新的源文件里，不会丢内容）。
 * @returns {{file: string, action: string}} 最后一条 CODEBUDDY.md 动作
 */
export function syncCodebuddyFile({ root, canonical, dryRun = false, canOverwrite = () => false, markConflict, actions = [], mirror = false }) {
  const srcAbs = path.join(root, canonical);
  const cbAbs = path.join(root, 'CODEBUDDY.md');
  const srcNow = fs.existsSync(srcAbs) ? fs.readFileSync(srcAbs) : null; // 源可能刚被 upsert 改过，重新读
  let action;
  if (srcNow === null) {
    // 源还没落盘（dry-run 的默认创建路径）：只登记动作，不做内容比较
    action = { file: 'CODEBUDDY.md', action: 'skipped', detail: `演练：由 ${canonical} 逐字节复制（源未落盘）` };
  } else if (!fs.existsSync(cbAbs)) {
    action = { file: 'CODEBUDDY.md', action: dryRun ? 'skipped' : 'created', detail: `由 ${canonical} 逐字节复制` };
    if (!dryRun) {
      fs.mkdirSync(path.dirname(cbAbs), { recursive: true });
      fs.copyFileSync(srcAbs, cbAbs);
    }
  } else if (fs.readFileSync(cbAbs).equals(srcNow)) {
    action = { file: 'CODEBUDDY.md', action: 'unchanged', detail: `与 ${canonical} 已逐字节一致` };
  } else if (canOverwrite('CODEBUDDY.md') || mirror) {
    action = {
      file: 'CODEBUDDY.md',
      action: dryRun ? 'skipped' : 'updated',
      detail: dryRun
        ? `演练：将覆盖为与 ${canonical} 逐字节一致`
        : `与 ${canonical} 不一致，${mirror && !canOverwrite('CODEBUDDY.md') ? '按「两份必须一致」的镜像语义跟写' : '按覆盖授权'}写为逐字节一致`,
    };
    if (!dryRun) {
      fs.mkdirSync(path.dirname(cbAbs), { recursive: true });
      fs.copyFileSync(srcAbs, cbAbs);
    }
  } else {
    // 已存在且不一致 → 可能含 CODEBUDDY.md 独有的定制内容，保留并交模型合并
    action = { file: 'CODEBUDDY.md', action: 'conflict', detail: `已存在且与 ${canonical} 内容不一致，已保留原文件（未覆盖）` };
  }
  if (action.action === 'conflict') {
    if (markConflict) markConflict('CODEBUDDY.md', action.detail);
    else actions.push(action);
  } else {
    actions.push(action);
  }
  return action;
}

/**
 * 确保项目技能目录与其中的 README 存在且是最新（README 的生成部分随技能清单刷新，
 * 分界标记之后的手写补充永远保留；无分界标记却已存在 = 定制过，按冲突保护交模型处置）。
 * @returns {{dir: string, created: boolean, readmeAction: 'created'|'updated'|'unchanged'|'conflict'|'skipped'}}
 */
export function ensureSkillsDir({ root, scan, dryRun = false, markConflict, actions = [] }) {
  const dirAbs = path.join(root, scan.dir);
  const readmeRel = `${scan.dir}/${SKILLS_README_NAME}`;
  const readmeAbs = path.join(dirAbs, SKILLS_README_NAME);
  const existed = fs.existsSync(dirAbs);
  const existing = fs.existsSync(readmeAbs) ? fs.readFileSync(readmeAbs, 'utf-8') : null;
  const merged = mergeGeneratedFile(existing, buildSkillsReadme(scan));
  if (merged.action === 'conflict') {
    markConflict(readmeRel, `已存在且没有手写补充分界标记（${README_TAIL_MARK}），已保留原文件（未覆盖）`);
    return { dir: scan.dir, created: !existed, readmeAction: 'conflict' };
  }
  if (merged.action === 'created' && !existed) {
    actions.push({ file: `${scan.dir}/`, action: dryRun ? 'skipped' : 'created', detail: '项目技能目录（一个技能一个子目录，内含 SKILL.md）' });
  }
  actions.push({
    file: readmeRel,
    action: dryRun ? 'skipped' : merged.action,
    detail: dryRun
      ? `演练：${merged.action === 'created' ? '创建' : '刷新'}技能目录说明（手写补充保留）`
      : merged.action === 'created'
        ? '创建技能目录说明（含当前技能表与同步命令）'
        : '刷新技能目录说明的生成部分（手写补充保留）',
  });
  if (!dryRun) writeFileSafe(readmeAbs, merged.content);
  return { dir: scan.dir, created: !existed, readmeAction: merged.action };
}

/**
 * 步骤 4「写入」：一致性同步（**冲突保护**：已存在且内容不同的文件默认不覆盖）。
 * @param {{root: string, seedsDir?: string, dryRun?: boolean,
 *          block?: {layout?: 'single'|'multi', labels?: Record<string,string>} | null,
 *          overwrite?: string[], force?: boolean,
 *          skillsDir?: string, noSkills?: boolean, subtrees?: string[]}} args
 *   block 为 null（默认）时纯同步（不动通用规范文件内容）；传对象时 upsert「## Agent skills」块
 *   并按需注入「## 多代理要求」块。
 *   skillsDir 指定项目技能目录（缺省从仓库已有的受管小节标题推断，再回落 `docs/agents/skills`）；
 *   noSkills=true 时既不建目录也不写「### 项目技能」小节（项目技能另有其处的仓库）。
 *   subtrees 为可选的已有仓库内相对目录；每项生成轻量 AGENTS.md / CODEBUDDY.md。
 *   overwrite 为允许覆盖的相对路径白名单（如 `CODEBUDDY.md`、`docs/agents/domain.md`）；
 *   force=true 时覆盖全部冲突。二者默认都为空/假 → 任何冲突文件都保留原样并记 `conflict`。
 * @returns {{
 *   canonical: string, createdDefault: boolean, codebuddy: string, identical: boolean,
 *   multiAgent: boolean, templates: string[], blockUpserted: boolean,
 *   actions: Array<{file: string, action: 'created'|'updated'|'unchanged'|'skipped'|'conflict', detail: string}>,
 *   conflicts: Array<{file: string, detail: string, hint: string}>,
 *   dryRun: boolean
 * }}
 *
 * 文件选择互斥规则（见 SKILL.md 步骤 4）：
 *   - CLAUDE.md 存在 → 以它为通用规范源（优先级最高）；不创建 AGENTS.md。
 *   - 否则 AGENTS.md 存在 → 以它为源。
 *   - 都不存在 → 默认创建 AGENTS.md 与 CODEBUDDY.md，两者内容完全相同且带「多代理要求」块。
 *
 * 写入策略：**只补缺失，不静默覆盖**。
 *   - 缺失的文件 → 创建；已有且内容相同 → unchanged。
 *   - 已有且内容不同 → 默认保留原文件并记 `conflict`（不落盘），由模型读取后决定；
 *     仅当该文件在 overwrite 白名单中或 force=true 时才覆盖。
 * 留模型：当 CLAUDE.md 与 AGENTS.md 同时存在时，取更高优先级 CLAUDE.md 为源，
 * 但不自动删除 AGENTS.md，由模型决定如何处理。
 */
export function runSyncDoc({ root, seedsDir = SKILL_ROOT, dryRun = false, block = null, overwrite = [], force = false, skillsDir, noSkills = false, subtrees = [] }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const subtreeList = resolveSubtrees(root, subtrees);
  const actions = [];
  const conflicts = [];
  const allowed = new Set((overwrite || []).map(normRel));
  const canOverwrite = (rel) => force || allowed.has(normRel(rel));
  /** 记录冲突：动作记 conflict，原文件保留不动，并给出让模型重跑的提示。 */
  const markConflict = (file, detail, hint) => {
    const h = hint || `--overwrite ${file}`;
    actions.push({ file, action: 'conflict', detail });
    conflicts.push({ file, detail, hint: h });
  };
  const hasClaude = fs.existsSync(path.join(root, 'CLAUDE.md'));
  const hasAgents = fs.existsSync(path.join(root, 'AGENTS.md'));

  // 项目技能目录：显式指定 > 仓库受管小节里记录的目录 > 默认值
  const srcForInfer = hasClaude ? path.join(root, 'CLAUDE.md') : hasAgents ? path.join(root, 'AGENTS.md') : null;
  const inferred = srcForInfer ? inferSkillsDir(fs.readFileSync(srcForInfer, 'utf-8')) : null;
  const scan = noSkills ? null : scanProjectSkills(root, skillsDir || inferred || DEFAULT_SKILLS_DIR);

  let canonical = null;
  let content;
  let createdDefault = false;
  let skillsSkipped = false;
  if (hasClaude) {
    canonical = 'CLAUDE.md';
  } else if (hasAgents) {
    canonical = 'AGENTS.md';
  } else {
    // 都不存在 → 默认创建（确定性骨架，遵循 block 选项）
    createdDefault = true;
    canonical = 'AGENTS.md';
    content = block
      ? `${MULTI_AGENT_BLOCK}\n\n${buildBlockForRepo(block, noSkills ? null : scan, null).text}`
      : DEFAULT_AGENTS_CONTENT;
  }

  const srcAbs = path.join(root, canonical);
  // 源写入之前两份是否一致：一致则 CODEBUDDY 只是镜像，可自动跟写（技能清单刷新不该被它挡住）
  const cbWasIdentical = fs.existsSync(srcAbs) && filesIdentical(srcAbs, path.join(root, 'CODEBUDDY.md'));
  let blockUpserted = false;
  let managedRefresh = false; // 本次是否只刷了受管技能清单（决定 CODEBUDDY 能否镜像跟写）
  if (createdDefault) {
    actions.push({ file: canonical, action: dryRun ? 'skipped' : 'created', detail: '通用规范文件不存在，按默认骨架创建' });
    if (!dryRun) writeFileSafe(srcAbs, content);
  } else if (block) {
    const before = fs.readFileSync(srcAbs, 'utf-8');
    const built = buildBlockForRepo(block, noSkills ? null : scan, before);
    skillsSkipped = built.skipped;
    const after = upsertAgentSkillsBlock(ensureMultiAgentBlock(before), built.text);
    blockUpserted = true;
    const hasBlock = before.includes('## Agent skills');
    // 只有「受管技能小节」有差异时可直接落盘：技能增删改后的清单刷新不是"覆盖定制内容"
    const managedOnly = isManagedOnlyDelta(before, after);
    if (after === before) {
      actions.push({ file: canonical, action: 'unchanged', detail: 'Agent skills 块与多代理块均已是最新' });
    } else if (hasBlock && managedOnly) {
      managedRefresh = true;
      actions.push({ file: canonical, action: dryRun ? 'skipped' : 'updated', detail: '仅刷新受管的「项目技能」清单（标记之间），其余内容逐字未动' });
      if (!dryRun) fs.writeFileSync(srcAbs, after, 'utf-8');
    } else if (hasBlock && !canOverwrite(canonical)) {
      // 已有块且内容不同 → 不静默替换定制内容，交模型读取后决定
      const foreign = findForeignSkillsHeadings(before);
      markConflict(
        canonical,
        `已有「## Agent skills」块且内容与将写入的不同，已保留原文件（未覆盖）${foreign.length ? `；且仓库另有手写技能清单（${foreign.join('；')}），不要插第二份，合并或给它加 ${SKILLS_MARK_START} / ${SKILLS_MARK_END} 标记后接管` : ''}`,
      );
    } else {
      actions.push({
        file: canonical,
        action: dryRun ? 'skipped' : 'updated',
        detail: `${hasBlock ? '就地替换' : '追加'} Agent skills 块${before.includes('## 多代理要求') ? '' : '，并注入多代理要求块'}${skillsSkipped ? '（仓库已有手写技能清单，未插第二份，合并后加标记即可接管）' : ''}`,
      });
      if (!dryRun) fs.writeFileSync(srcAbs, after, 'utf-8');
    }
  } else {
    actions.push({ file: canonical, action: 'unchanged', detail: '已存在，作为同步源（未启用块 upsert）' });
  }

  // 逐字节复制源 → CODEBUDDY.md（记录 created/updated/unchanged/conflict/skipped）
  // 注意：冲突判定与 dry-run 演练都要走到，故 dry-run 只影响是否落盘，不影响动作分类。
  // mirror：只在「本次改动仅限受管技能清单」且写入前两份一致时跟写（镜像语义）；
  // 整块替换等其它改动仍照旧报冲突，由模型决定是否 --overwrite（v1.3.0 起的冲突保护）。
  syncCodebuddyFile({ root, canonical, dryRun, canOverwrite, markConflict, actions, mirror: cbWasIdentical && managedRefresh });

  // 克隆三份 docs/agents/*.md 模板（区分 created/updated/unchanged/conflict）
  const templates = [];
  for (const { seed, out } of DOC_TEMPLATES) {
    templates.push(out);
    const rel = `docs/agents/${out}`;
    const seedAbs = path.join(seedsDir, seed);
    const outAbs = path.join(root, 'docs/agents', out);
    if (!fs.existsSync(outAbs)) {
      actions.push({ file: rel, action: dryRun ? 'skipped' : 'created', detail: `由种子 ${seed} 克隆` });
      if (!dryRun) {
        fs.mkdirSync(path.dirname(outAbs), { recursive: true });
        fs.copyFileSync(seedAbs, outAbs);
      }
    } else if (filesIdentical(seedAbs, outAbs)) {
      actions.push({ file: rel, action: 'unchanged', detail: '与种子已逐字节一致' });
    } else if (canOverwrite(rel)) {
      actions.push({
        file: rel,
        action: dryRun ? 'skipped' : 'updated',
        detail: dryRun ? `演练：将用种子 ${seed} 覆盖` : `与种子 ${seed} 不一致，按覆盖授权覆盖`,
      });
      if (!dryRun) {
        fs.mkdirSync(path.dirname(outAbs), { recursive: true });
        fs.copyFileSync(seedAbs, outAbs);
      }
    } else {
      // 已有内容可能与仓库实际约定不同（定制过的 tracker/标签/领域文档），保留并交模型判断
      markConflict(rel, `已存在且与种子 ${seed} 内容不一致，已保留原文件（未覆盖）`);
    }
  }

  // 确保项目技能目录存在（并写好 README），让清单小节能指向一个真实的目录
  let skillsResult = null;
  if (scan) skillsResult = ensureSkillsDir({ root, scan, dryRun, markConflict, actions });

  for (const subtree of subtreeList) syncSubtreeFiles({ root, subtree, dryRun, canOverwrite, markConflict, actions });

  return {
    canonical,
    createdDefault,
    codebuddy: path.join(root, 'CODEBUDDY.md'),
    identical: filesIdentical(srcAbs, path.join(root, 'CODEBUDDY.md')),
    multiAgent: fs.existsSync(srcAbs) && fs.readFileSync(srcAbs, 'utf-8').includes('## 多代理要求'),
    templates,
    blockUpserted,
    skillsDir: scan ? scan.dir : null,
    projectSkills: scan ? scan.skills.map((s) => s.name) : null,
    skillsSkipped,
    skills: skillsResult,
    subtrees: subtreeList.map((s) => s.dir),
    actions,
    conflicts,
    dryRun,
  };
}

/**
 * 维护项目技能清单（技能增删改之后跑的那条命令）：
 * 1. 扫描项目技能目录（未指定时从受管小节标题推断目录，再回落默认 `docs/agents/skills`）；
 * 2. 确保目录与 README 存在且最新；
 * 3. 只重写通用规范文件里受管小节**标记之间**的技能表（其余内容逐字不动，不需要 `--overwrite`）；
 * 4. 把规范文件逐字节同步到 `CODEBUDDY.md`。
 * 仓库已有手写技能清单且未加标记接管时**不插第二份**，报冲突交模型合并。
 * @param {{root: string, skillsDir?: string, dryRun?: boolean, overwrite?: string[], force?: boolean}} args
 */
export function runSyncSkills({ root, skillsDir, dryRun = false, overwrite = [], force = false }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const actions = [];
  const conflicts = [];
  const allowed = new Set((overwrite || []).map(normRel));
  const canOverwrite = (rel) => force || allowed.has(normRel(rel));
  const markConflict = (file, detail) => {
    actions.push({ file, action: 'conflict', detail });
    conflicts.push({ file, detail, hint: `--overwrite ${file}` });
  };
  const canonical = fs.existsSync(path.join(root, 'CLAUDE.md')) ? 'CLAUDE.md' : fs.existsSync(path.join(root, 'AGENTS.md')) ? 'AGENTS.md' : null;
  if (!canonical) {
    return {
      canonical: null,
      skillsDir: normalizeSkillsDir(skillsDir),
      projectSkills: [],
      skills: null,
      identical: false,
      actions,
      conflicts,
      error: '既没有 CLAUDE.md 也没有 AGENTS.md —— 先跑 init 建规范文件，再维护技能清单',
      dryRun,
    };
  }
  const srcAbs = path.join(root, canonical);
  const before = fs.readFileSync(srcAbs, 'utf-8');
  // 写入前两份一致 → CODEBUDDY 是纯镜像，可自动跟写（这正是「两份必须一致」约定的含义）
  const cbWasIdentical = filesIdentical(srcAbs, path.join(root, 'CODEBUDDY.md'));
  const scan = scanProjectSkills(root, skillsDir || inferSkillsDir(before) || DEFAULT_SKILLS_DIR);
  const section = buildProjectSkillsSection(scan);
  const res = upsertProjectSkillsSection(before, section);
  if (res.action === 'conflict') {
    markConflict(
      canonical,
      `已有手写技能清单（${(res.foreign || []).join('；')}）且没有受管标记，不插第二份；请合并后在该清单前后加 ${SKILLS_MARK_START} / ${SKILLS_MARK_END} 再重跑`,
    );
  } else if (res.action === 'unchanged') {
    actions.push({ file: canonical, action: 'unchanged', detail: '项目技能清单已是最新（受管标记之间未变）' });
  } else {
    actions.push({
      file: canonical,
      action: dryRun ? 'skipped' : 'updated',
      detail: `${res.action === 'inserted' ? '新增受管「项目技能」小节' : '刷新受管「项目技能」清单'}（${scan.skills.length} 个技能：${scan.skills.map((s) => s.name).join('、') || '暂无'}），标记之外未动`,
    });
    if (!dryRun) fs.writeFileSync(srcAbs, res.content, 'utf-8');
  }
  const skills = ensureSkillsDir({ root, scan, dryRun, markConflict, actions });
  if (conflicts.length === 0) syncCodebuddyFile({ root, canonical, dryRun, canOverwrite, markConflict, actions, mirror: cbWasIdentical });
  return {
    canonical,
    skillsDir: scan.dir,
    projectSkills: scan.skills.map((s) => s.name),
    skills,
    identical: filesIdentical(srcAbs, path.join(root, 'CODEBUDDY.md')),
    actions,
    conflicts,
    dryRun,
  };
}

/**
 * 生成并打印「全部默认文件模板」的完整内容（不落盘）。
 * 无论用户是否提供偏好，都由本函数产出各文件内容，模型据此展示给用户复制/替换。
 * @param {{root?: string, seedsDir?: string, layout?: 'single'|'multi', labels?: Record<string,string>, skillsDir?: string, noSkills?: boolean, subtrees?: string[]}} args
 *   subtrees 非空时 root 必填，用于校验已存在目录并计算实际根指令文件的相对链接。
 * @returns {Array<{file: string, content: string}>} 5~6 份基础文件加每个子树两份文件
 */
export function buildTemplateOutput({ root, seedsDir = SKILL_ROOT, layout = 'single', labels = {}, skillsDir = DEFAULT_SKILLS_DIR, noSkills = false, scan = null, subtrees = [] } = {}) {
  const subtreeList = resolveSubtrees(root, subtrees);
  const dir = normalizeSkillsDir(skillsDir);
  const scanned = scan || { dir, exists: true, skills: [] };
  const agentsContent = `${MULTI_AGENT_BLOCK}\n\n${buildAgentSkillsBlock({ layout, labels, scan: noSkills ? null : scanned })}`;
  const files = [{ file: 'AGENTS.md', content: agentsContent }];
  files.push({ file: 'CODEBUDDY.md', content: agentsContent });
  for (const { seed, out } of DOC_TEMPLATES) {
    const seedAbs = path.join(seedsDir, seed);
    const content = fs.existsSync(seedAbs) ? fs.readFileSync(seedAbs, 'utf-8') : `# ${out}\n\n(种子缺失: ${seedAbs})\n`;
    files.push({ file: `docs/agents/${out}`, content });
  }
  if (!noSkills) files.push({ file: `${dir}/${SKILLS_README_NAME}`, content: buildSkillsReadme(scanned) });
  for (const subtree of subtreeList) {
    const content = buildSubtreeContent(path.resolve(root), subtree.dir);
    files.push({ file: `${subtree.dir}/AGENTS.md`, content });
    files.push({ file: `${subtree.dir}/CODEBUDDY.md`, content });
  }
  return files;
}

// ---------------------------------------------------------------- OCR 检测

/**
 * 在 PATH 中查找可执行文件（跨平台：Windows 需依次尝试 .exe/.cmd/.bat）。
 * @param {string} name 可执行文件名（不含扩展名）
 * @returns {string|null} 命中则返回绝对路径，否则 null
 */
export function findOnPath(name) {
  const isWin = process.platform === 'win32';
  const candidates = isWin ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`, name] : [name];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const c of candidates) {
      try {
        const p = path.join(dir, c);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      } catch {
        /* PATH 条目可能不可读或含非法字符，逐个跳过即可 */
      }
    }
  }
  return null;
}

/**
 * 检测 OCR（open-code-review CLI）在当前环境是否可用。
 * 只读、无副作用；未安装时 installed=false，由模型据此询问用户是否安装。
 * @returns {{installed: boolean, path: string|null, version: string|null, error: string|null}}
 */
export function detectOcr() {
  const p = findOnPath('ocr');
  if (!p) return { installed: false, path: null, version: null, error: null };
  try {
    // Windows 下 PATH 命中的常是 npm 包装的 .cmd/.bat，直接 spawn 会 EINVAL，须经 cmd.exe /c
    const ext = path.extname(p).toLowerCase();
    const viaShell = process.platform === 'win32' && (ext === '.cmd' || ext === '.bat');
    const r = viaShell
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/c', p, '--version'], { encoding: 'utf8', timeout: 20000, windowsHide: true })
      : spawnSync(p, ['--version'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
    const version = out ? out.split('\n')[0].trim() : null;
    if (r.error) {
      return { installed: true, path: p, version: null, error: String(r.error.message || r.error) };
    }
    return { installed: true, path: p, version, error: null };
  } catch (err) {
    return { installed: true, path: p, version: null, error: String(err && err.message ? err.message : err) };
  }
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const opts = {
    cmd: argv[2],
    root: process.cwd(),
    seeds: null,
    layout: null,
    labels: null,
    skillsDir: null,
    noSkills: false,
    subtrees: [],
    noBlock: false,
    dryRun: false,
    overwrite: [],
    force: false,
  };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') opts.root = argv[++i];
    else if (a === '--seeds') opts.seeds = argv[++i];
    else if (a === '--layout') opts.layout = argv[++i];
    else if (a === '--labels') opts.labels = argv[++i];
    else if (a === '--skills-dir') opts.skillsDir = argv[++i];
    else if (a === '--no-skills') opts.noSkills = true;
    else if (a === '--subtree') opts.subtrees.push(argv[++i]);
    else if (a === '--no-block') opts.noBlock = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--overwrite') opts.overwrite.push(argv[++i]);
    else if (a === '--force') opts.force = true;
    else throw new Error(`未知选项: ${a}`);
  }
  return opts;
}

function usage() {
  return `用法: setup.mjs <子命令> [选项]

子命令：
  init               一键初始化（默认入口）：读取仓库已有文件并自行处理，落盘完成全部配置
  detect             只读探索：扫描仓库初始状态，输出 JSON 报告
  ocr                只读检测 OCR（open-code-review CLI）是否已安装，输出 JSON（未安装退出码 4）
  sync-doc           写入：双文件逐字节一致 + Agent skills 块 upsert + docs/agents/*.md 模板
  sync-skills        维护项目技能清单：扫技能目录 → 重写受管小节 → 同步 CODEBUDDY.md（技能增删改后跑）
  template           输出全部默认文件模板内容到 stdout（不落盘），仅供预览/手动复制

选项：
  --root <dir>       目标仓库根目录（默认当前目录）
  --seeds <dir>      docs/agents 模板种子目录（默认本技能目录自身）
  --layout <mode>    init / sync-doc / template：领域文档布局 single|multi（默认 single）
  --labels <json>    init / sync-doc / template：triage 标签覆盖表（'{"needs-triage":"bug:triage"}'）
  --skills-dir <rel> 项目技能目录（默认 docs/agents/skills；不给时沿用仓库受管小节里记录的目录）
  --no-skills        init / sync-doc / template：不建技能目录、也不写「### 项目技能」小节
  --subtree <rel>    init / sync-doc / template：为已存在的仓库内子目录生成轻量双文件（可重复）
  --no-block         init / sync-doc：纯同步，不 upsert「## Agent skills」块（CLI 默认 upsert）
  --dry-run          演练：只打印动作，不落盘
  --overwrite <file> init / sync-doc：仅覆盖该冲突文件（可重复，路径相对仓库根）
  --force            init / sync-doc / sync-skills：覆盖全部冲突文件（默认一律保留并报 conflict）

退出码：0 完成且无冲突；3 存在冲突且已保留原文件（需模型读取后决定）；2 一致性 MISMATCH；1 参数/运行错误；4 OCR 未安装
`;
}

/** 打印冲突清单与处置提示（供模型据此决定手工合并或精确覆盖）。 */
function printConflicts(conflicts) {
  if (!conflicts || conflicts.length === 0) return;
  console.log(`  冲突=${conflicts.length}（已保留原文件，未覆盖）：`);
  for (const c of conflicts) console.log(`    - ${c.file} — ${c.detail}`);
  console.log('  请读取上述文件后决定：手工合并，或重跑加 --overwrite <文件>（可重复）精确覆盖，或 --force 覆盖全部。');
}

export function main(argv) {
  const opts = parseArgs(argv);
  if (opts.cmd === '-h' || opts.cmd === '--help') {
    console.log(usage());
    return 0;
  }
  // 未传子命令 → 默认 init（一键初始化）
  const cmd = opts.cmd || 'init';

  try {
    if (cmd === 'ocr') {
      const info = detectOcr();
      console.log(JSON.stringify(info, null, 2));
      if (!info.installed) {
        console.log('\nOCR 未安装 —— 请询问用户是否安装（安装步骤见 SKILL.md「检查并安装 OCR」节）。');
      }
      return info.installed ? 0 : 4; // 4 = 未安装，等模型询问后处置
    }
    if (cmd === 'detect') {
      console.log(JSON.stringify(runDetect({ root: opts.root }), null, 2));
      return 0;
    }
    if (cmd === 'template') {
      const block = { layout: opts.layout || 'single', labels: opts.labels ? JSON.parse(opts.labels) : {} };
      const scan = opts.noSkills ? null : scanProjectSkills(opts.root, opts.skillsDir || DEFAULT_SKILLS_DIR);
      for (const f of buildTemplateOutput({ root: opts.root, seedsDir: opts.seeds || SKILL_ROOT, skillsDir: opts.skillsDir || DEFAULT_SKILLS_DIR, noSkills: opts.noSkills, scan, subtrees: opts.subtrees, ...block })) {
        console.log(`=== FILE: ${f.file} ===`);
        console.log(f.content);
        console.log('');
      }
      return 0;
    }
    if (cmd === 'sync-skills') {
      const r = runSyncSkills({
        root: opts.root,
        skillsDir: opts.skillsDir,
        dryRun: opts.dryRun,
        overwrite: opts.overwrite,
        force: opts.force,
      });
      if (r.error) {
        console.error(`sync-skills: ${r.error}`);
        return 1;
      }
      console.log(`sync-skills: 源=${r.canonical}  技能目录=${r.skillsDir}  技能=${r.projectSkills.length ? r.projectSkills.join('、') : '暂无'}${r.dryRun ? ' [dry-run]' : ''}`);
      for (const a of r.actions) console.log(`  [${a.action}] ${a.file} — ${a.detail}`);
      console.log(`  一致性=${r.identical ? 'OK' : 'MISMATCH'}  冲突=${r.conflicts.length}`);
      printConflicts(r.conflicts);
      if (!r.dryRun && r.conflicts.length === 0) console.log('sync-skills: 技能清单已与目录一致（AGENTS.md 与 CODEBUDDY.md 逐字节一致）。');
      if (r.conflicts.length > 0) return 3;
      return r.identical ? 0 : 2;
    }
    if (cmd === 'init' || cmd === 'sync-doc') {
      // CLI 默认 upsert Agent skills 块；--no-block 退化为纯同步
      const block = opts.noBlock ? null : { layout: opts.layout || 'single', labels: opts.labels ? JSON.parse(opts.labels) : {} };
      const r = runSyncDoc({
        root: opts.root,
        seedsDir: opts.seeds || SKILL_ROOT,
        dryRun: opts.dryRun,
        block,
        overwrite: opts.overwrite,
        force: opts.force,
        skillsDir: opts.skillsDir,
        noSkills: opts.noSkills,
        subtrees: opts.subtrees,
      });
      if (cmd === 'init') {
        const d = runDetect({ root: opts.root, seedsDir: opts.seeds || SKILL_ROOT, block: block || {}, skillsDir: opts.skillsDir, noSkills: opts.noSkills });
        console.log(`init: 目标仓库=${opts.root}  源=${r.canonical}${r.createdDefault ? '（默认创建）' : ''}${r.dryRun ? ' [dry-run]' : ''}`);
        console.log(`  初始状态: CLAUDE=${d.files['CLAUDE.md']} AGENTS=${d.files['AGENTS.md']} CODEBUDDY=${d.files['CODEBUDDY.md']} 一致性=${d.codebuddyConsistent}`);
        if (d.skillsDir) console.log(`  项目技能: 目录=${d.skillsDir}(${d.skillsDirExists ? '已存在' : '将创建'}) 清单=${d.skillsSection}${d.projectSkills && d.projectSkills.length ? ` 已有=${d.projectSkills.map((s) => s.name).join('、')}` : ''}`);
      } else {
        console.log(`sync-doc: 源=${r.canonical}${r.createdDefault ? '（默认创建）' : ''}${r.dryRun ? ' [dry-run]' : ''}`);
      }
      for (const a of r.actions) console.log(`  [${a.action}] ${a.file} — ${a.detail}`);
      console.log(`  一致性=${r.identical ? 'OK' : 'MISMATCH'}  多代理要求=${r.multiAgent ? '有' : '缺'}  模板=${r.templates.join(', ')}  技能目录=${r.skillsDir || '（未启用）'}  冲突=${r.conflicts.length}`);
      printConflicts(r.conflicts);
      if (cmd === 'init' && !r.dryRun && r.conflicts.length === 0) console.log('init: 初始化完成，配置已写入目标仓库。');
      // 有冲突 → 3（等模型处置）；否则按一致性给 0/2
      if (r.conflicts.length > 0) return 3;
      return r.identical ? 0 : 2;
    }
    console.error(`未知子命令: ${cmd}`);
    console.error(usage());
    return 2;
  } catch (err) {
    console.error(`错误: ${err.message}`);
    return 1;
  }
}

// 直接运行（node setup.mjs ...）时才执行 main；被测试 import 时不触发
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exit(main(process.argv));
}
