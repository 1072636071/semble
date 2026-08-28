#!/usr/bin/env node
// setup.mjs — jxx-setup-matt-pocock-skills 的确定性流程 CLI（零第三方依赖，ESM，自包含）
//
// 子命令：
//   init      一键初始化（默认）：detect 现状 + sync-doc 落盘，全部默认参数即"全部默认"
//   detect    只读探索：扫描仓库初始状态，输出 JSON 报告（含与种子的漂移）
//   sync-doc  写入：双文件逐字节一致 + Agent skills 块 upsert + docs/agents/*.md 克隆
//   template  输出全部文件内容到 stdout（不落盘），供预览/手动复制
//
// 写入策略（关键）：**已存在且内容不同的文件默认不覆盖**，动作记为 `conflict` 并原样保留，
// 由模型读取文件后决定（手工合并 / `--overwrite <文件>` 精确覆盖 / `--force` 全部覆盖）。
// 只写"缺失"的文件、只追加缺失的工程块。存在冲突时 CLI 退出码为 3。
//
// 本脚本随技能目录分发，不依赖技能目录之外的任何文件（种子模板即技能目录根下的三份 .md）。
import fs from 'node:fs';
import path from 'node:path';
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
 * 构建「## Agent skills」块（确定性）。
 * @param {{layout?: 'single'|'multi', labels?: Record<string,string>}} opts
 *   layout=multi 用多上下文行；labels 为「角色名 → 实际标签字符串」覆盖表。
 * 返回文本以 `## Agent skills` 开头、以 `\n` 结尾。
 */
export function buildAgentSkillsBlock({ layout = 'single', labels = {} } = {}) {
  if (layout !== 'single' && layout !== 'multi') throw new Error(`layout 仅支持 single|multi，收到: ${layout}`);
  const overridden = TRIAGE_ROLES.filter((r) => labels[r] && labels[r] !== r);
  const triageLine = overridden.length === 0
    ? '采用五种标准 triage 角色（标签字符串与角色名一致，未覆盖）：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。'
    : `采用五种标准 triage 角色（含覆盖）：${TRIAGE_ROLES.map((r) => (labels[r] && labels[r] !== r ? `\`${r}\`→\`${labels[r]}\`` : `\`${r}\``)).join('、')}。参见 \`docs/agents/triage-labels.md\`。`;
  const domainLine = layout === 'multi'
    ? '多上下文布局：根目录 `CONTEXT-MAP.md` 指向各上下文 `CONTEXT.md`（另有 `src/<context>/docs/adr/`）。参见 `docs/agents/domain.md`。'
    : '单一上下文布局：仓库根目录 `CONTEXT.md` + `docs/adr/`。参见 `docs/agents/domain.md`。';
  return `## Agent skills

### Issue tracker

本仓库的 issue 与 PRD 以本地 markdown 形式存放于仓库 \`.scratch/\` 下，不使用远程 tracker。参见 \`docs/agents/issue-tracker.md\`。

### triage 标签

${triageLine}

### 领域文档

${domainLine}

### 临时文件

所有临时脚本统一放在仓库 \`.temp/scripts/\` 下；其他临时文件（脚本输出、日志等）也要分类，放在 \`.temp/\` 的子目录下（如 \`.temp/output/\`、\`.temp/logs/\`），保证仓库根目录干净。
`;
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
 * 步骤 1「探索」：扫描目标仓库初始状态，输出 JSON 报告（只读，不落盘）。
 * 覆盖 SKILL.md 探索清单的每一项，区分「文件存在 / 不存在」，并报告已有内容与
 * 将要写入内容的**漂移**（drift），供模型判断哪些写入会构成冲突。
 * @param {{root: string, seedsDir?: string, block?: {layout?: 'single'|'multi', labels?: Record<string,string>}}} args
 */
export function runDetect({ root, seedsDir = SKILL_ROOT, block = {} } = {}) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const ex = (rel) => fs.existsSync(path.join(root, rel));
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf-8');
  // 通用规范文件互斥优先级：CLAUDE.md > AGENTS.md
  const canonical = ex('CLAUDE.md') ? 'CLAUDE.md' : ex('AGENTS.md') ? 'AGENTS.md' : null;
  const canonicalContent = canonical ? read(canonical) : null;
  const codebuddyExists = ex('CODEBUDDY.md');
  // 已有「## Agent skills」块与将要写入的块是否一致（null = 无块/无源文件，无从比较）
  const existingBlock = extractAgentSkillsBlock(canonicalContent);
  const generatedBlock = buildAgentSkillsBlock({
    layout: (block && block.layout) || 'single',
    labels: (block && block.labels) || {},
  }).trim();
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
 *          overwrite?: string[], force?: boolean}} args
 * @returns {{detect: object, sync: object}}
 */
export function runInit({ root, seedsDir = SKILL_ROOT, dryRun = false, block = {}, overwrite = [], force = false }) {
  // block 默认 {} → 启用 Agent skills 块 upsert + 多代理要求块注入（与 CLI 行为一致）
  const detect = runDetect({ root, seedsDir, block: block || {} });
  const sync = runSyncDoc({ root, seedsDir, dryRun, block, overwrite, force });
  return { detect, sync };
}

/**
 * 步骤 4「写入」：一致性同步（**冲突保护**：已存在且内容不同的文件默认不覆盖）。
 * @param {{root: string, seedsDir?: string, dryRun?: boolean,
 *          block?: {layout?: 'single'|'multi', labels?: Record<string,string>} | null,
 *          overwrite?: string[], force?: boolean}} args
 *   block 为 null（默认）时纯同步（不动通用规范文件内容）；传对象时 upsert「## Agent skills」块
 *   并按需注入「## 多代理要求」块。
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
export function runSyncDoc({ root, seedsDir = SKILL_ROOT, dryRun = false, block = null, overwrite = [], force = false }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const actions = [];
  const conflicts = [];
  const allowed = new Set((overwrite || []).map(normRel));
  const canOverwrite = (rel) => force || allowed.has(normRel(rel));
  /** 记录冲突：动作记 conflict，原文件保留不动，并给出让模型重跑的提示。 */
  const markConflict = (file, detail) => {
    const hint = `--overwrite ${file}`;
    actions.push({ file, action: 'conflict', detail });
    conflicts.push({ file, detail, hint });
  };
  const hasClaude = fs.existsSync(path.join(root, 'CLAUDE.md'));
  const hasAgents = fs.existsSync(path.join(root, 'AGENTS.md'));

  let canonical = null;
  let content;
  let createdDefault = false;
  if (hasClaude) {
    canonical = 'CLAUDE.md';
  } else if (hasAgents) {
    canonical = 'AGENTS.md';
  } else {
    // 都不存在 → 默认创建（确定性骨架，遵循 block 选项）
    createdDefault = true;
    canonical = 'AGENTS.md';
    content = block ? `${MULTI_AGENT_BLOCK}\n\n${buildAgentSkillsBlock(block)}` : DEFAULT_AGENTS_CONTENT;
  }

  const srcAbs = path.join(root, canonical);
  let blockUpserted = false;
  if (createdDefault) {
    actions.push({ file: canonical, action: dryRun ? 'skipped' : 'created', detail: '通用规范文件不存在，按默认骨架创建' });
    if (!dryRun) writeFileSafe(srcAbs, content);
  } else if (block) {
    const before = fs.readFileSync(srcAbs, 'utf-8');
    const after = upsertAgentSkillsBlock(ensureMultiAgentBlock(before), buildAgentSkillsBlock(block));
    blockUpserted = true;
    const hasBlock = before.includes('## Agent skills');
    if (after === before) {
      actions.push({ file: canonical, action: 'unchanged', detail: 'Agent skills 块与多代理块均已是最新' });
    } else if (hasBlock && !canOverwrite(canonical)) {
      // 已有块且内容不同 → 不静默替换定制内容，交模型读取后决定
      markConflict(canonical, `已有「## Agent skills」块且内容与将写入的不同，已保留原文件（未覆盖）`);
    } else {
      actions.push({
        file: canonical,
        action: dryRun ? 'skipped' : 'updated',
        detail: `${hasBlock ? '就地替换' : '追加'} Agent skills 块${before.includes('## 多代理要求') ? '' : '，并注入多代理要求块'}`,
      });
      if (!dryRun) fs.writeFileSync(srcAbs, after, 'utf-8');
    }
  } else {
    actions.push({ file: canonical, action: 'unchanged', detail: '已存在，作为同步源（未启用块 upsert）' });
  }

  // 逐字节复制源 → CODEBUDDY.md（记录 created/updated/unchanged/conflict/skipped）
  // 注意：冲突判定与 dry-run 演练都要走到，故 dry-run 只影响是否落盘，不影响动作分类。
  const cbAbs = path.join(root, 'CODEBUDDY.md');
  if (createdDefault) {
    actions.push({ file: 'CODEBUDDY.md', action: dryRun ? 'skipped' : 'created', detail: `由 ${canonical} 逐字节复制` });
    if (!dryRun) {
      fs.mkdirSync(path.dirname(cbAbs), { recursive: true });
      fs.copyFileSync(srcAbs, cbAbs);
    }
  } else {
    // 内容可能刚被 upsert 修改，重新读源
    const srcNow = fs.readFileSync(srcAbs);
    if (!fs.existsSync(cbAbs)) {
      actions.push({ file: 'CODEBUDDY.md', action: dryRun ? 'skipped' : 'created', detail: `由 ${canonical} 逐字节复制` });
      if (!dryRun) {
        fs.mkdirSync(path.dirname(cbAbs), { recursive: true });
        fs.copyFileSync(srcAbs, cbAbs);
      }
    } else if (fs.readFileSync(cbAbs).equals(srcNow)) {
      actions.push({ file: 'CODEBUDDY.md', action: 'unchanged', detail: `与 ${canonical} 已逐字节一致` });
    } else if (canOverwrite('CODEBUDDY.md')) {
      actions.push({
        file: 'CODEBUDDY.md',
        action: dryRun ? 'skipped' : 'updated',
        detail: dryRun ? `演练：将覆盖为与 ${canonical} 逐字节一致` : `与 ${canonical} 不一致，按覆盖授权写为逐字节一致`,
      });
      if (!dryRun) {
        fs.mkdirSync(path.dirname(cbAbs), { recursive: true });
        fs.copyFileSync(srcAbs, cbAbs);
      }
    } else {
      // 已存在且不一致 → 可能含 CODEBUDDY.md 独有的定制内容，保留并交模型合并
      markConflict('CODEBUDDY.md', `已存在且与 ${canonical} 内容不一致，已保留原文件（未覆盖）`);
    }
  }

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

  return {
    canonical,
    createdDefault,
    codebuddy: cbAbs,
    identical: filesIdentical(srcAbs, cbAbs),
    multiAgent: fs.existsSync(srcAbs) && fs.readFileSync(srcAbs, 'utf-8').includes('## 多代理要求'),
    templates,
    blockUpserted,
    actions,
    conflicts,
    dryRun,
  };
}

/**
 * 生成并打印「全部默认文件模板」的完整内容（不落盘）。
 * 无论用户是否提供偏好，都由本函数产出各文件内容，模型据此展示给用户复制/替换。
 * @param {{seedsDir?: string, layout?: 'single'|'multi', labels?: Record<string,string>}} args
 * @returns {Array<{file: string, content: string}>} 5 份文件的 (file, content) 列表
 */
export function buildTemplateOutput({ seedsDir = SKILL_ROOT, layout = 'single', labels = {} } = {}) {
  const agentsContent = `${MULTI_AGENT_BLOCK}\n\n${buildAgentSkillsBlock({ layout, labels })}`;
  const files = [{ file: 'AGENTS.md', content: agentsContent }];
  files.push({ file: 'CODEBUDDY.md', content: agentsContent });
  for (const { seed, out } of DOC_TEMPLATES) {
    const seedAbs = path.join(seedsDir, seed);
    const content = fs.existsSync(seedAbs) ? fs.readFileSync(seedAbs, 'utf-8') : `# ${out}\n\n(种子缺失: ${seedAbs})\n`;
    files.push({ file: `docs/agents/${out}`, content });
  }
  return files;
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const opts = {
    cmd: argv[2],
    root: process.cwd(),
    seeds: null,
    layout: null,
    labels: null,
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
  sync-doc           写入：双文件逐字节一致 + Agent skills 块 upsert + docs/agents/*.md 模板
  template           输出全部默认文件模板内容到 stdout（不落盘），仅供预览/手动复制

选项：
  --root <dir>       目标仓库根目录（默认当前目录）
  --seeds <dir>      docs/agents 模板种子目录（默认本技能目录自身）
  --layout <mode>    init / sync-doc / template：领域文档布局 single|multi（默认 single）
  --labels <json>    init / sync-doc / template：triage 标签覆盖表（'{"needs-triage":"bug:triage"}'）
  --no-block         init / sync-doc：纯同步，不 upsert「## Agent skills」块（CLI 默认 upsert）
  --dry-run          演练：只打印动作，不落盘
  --overwrite <file> init / sync-doc：仅覆盖该冲突文件（可重复，路径相对仓库根）
  --force            init / sync-doc：覆盖全部冲突文件（默认一律保留并报 conflict）

退出码：0 完成且无冲突；3 存在冲突且已保留原文件（需模型读取后决定）；2 一致性 MISMATCH；1 参数/运行错误
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
    if (cmd === 'detect') {
      console.log(JSON.stringify(runDetect({ root: opts.root }), null, 2));
      return 0;
    }
    if (cmd === 'template') {
      const block = { layout: opts.layout || 'single', labels: opts.labels ? JSON.parse(opts.labels) : {} };
      for (const f of buildTemplateOutput({ seedsDir: opts.seeds || SKILL_ROOT, ...block })) {
        console.log(`=== FILE: ${f.file} ===`);
        console.log(f.content);
        console.log('');
      }
      return 0;
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
      });
      if (cmd === 'init') {
        const d = runDetect({ root: opts.root, seedsDir: opts.seeds || SKILL_ROOT, block: block || {} });
        console.log(`init: 目标仓库=${opts.root}  源=${r.canonical}${r.createdDefault ? '（默认创建）' : ''}${r.dryRun ? ' [dry-run]' : ''}`);
        console.log(`  初始状态: CLAUDE=${d.files['CLAUDE.md']} AGENTS=${d.files['AGENTS.md']} CODEBUDDY=${d.files['CODEBUDDY.md']} 一致性=${d.codebuddyConsistent}`);
      } else {
        console.log(`sync-doc: 源=${r.canonical}${r.createdDefault ? '（默认创建）' : ''}${r.dryRun ? ' [dry-run]' : ''}`);
      }
      for (const a of r.actions) console.log(`  [${a.action}] ${a.file} — ${a.detail}`);
      console.log(`  一致性=${r.identical ? 'OK' : 'MISMATCH'}  多代理要求=${r.multiAgent ? '有' : '缺'}  模板=${r.templates.join(', ')}  冲突=${r.conflicts.length}`);
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
