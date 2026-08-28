#!/usr/bin/env node
// setup.mjs — jxx-setup-matt-pocock-skills 的确定性流程 CLI（零第三方依赖，ESM，自包含）
//
// 子命令：
//   detect    步骤 1「探索」：扫描仓库初始状态，输出只读 JSON 报告
//   sync-doc  步骤 4「写入」：双文件逐字节一致 + Agent skills 块 upsert + docs/agents/*.md 克隆
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
 * 覆盖 SKILL.md 探索清单的每一项，并区分「文件存在 / 不存在」两种情况。
 * @param {{root: string}} args
 */
export function runDetect({ root }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const ex = (rel) => fs.existsSync(path.join(root, rel));
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf-8');
  // 通用规范文件互斥优先级：CLAUDE.md > AGENTS.md
  const canonical = ex('CLAUDE.md') ? 'CLAUDE.md' : ex('AGENTS.md') ? 'AGENTS.md' : null;
  const canonicalContent = canonical ? read(canonical) : null;
  const codebuddyExists = ex('CODEBUDDY.md');
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
  };
}

/**
 * 步骤 4「写入」：一致性同步。
 * @param {{root: string, seedsDir?: string, dryRun?: boolean,
 *          block?: {layout?: 'single'|'multi', labels?: Record<string,string>} | null}} args
 *   block 为 null（默认）时纯同步（不动通用规范文件内容）；传对象时 upsert「## Agent skills」块
 *   并按需注入「## 多代理要求」块。
 * @returns {{
 *   canonical: string, createdDefault: boolean, codebuddy: string, identical: boolean,
 *   multiAgent: boolean, templates: string[], blockUpserted: boolean,
 *   actions: Array<{file: string, action: 'created'|'updated'|'unchanged'|'skipped', detail: string}>,
 *   dryRun: boolean
 * }}
 *
 * 文件选择互斥规则（见 SKILL.md 步骤 4）：
 *   - CLAUDE.md 存在 → 以它为通用规范源（优先级最高）；不创建 AGENTS.md。
 *   - 否则 AGENTS.md 存在 → 以它为源。
 *   - 都不存在 → 默认创建 AGENTS.md 与 CODEBUDDY.md，两者内容完全相同且带「多代理要求」块。
 * 之后把源文件逐字节复制到 CODEBUDDY.md 并断言二者一致；并把三份 docs/agents/*.md 模板
 * 从 seedsDir（默认技能目录自身）克隆到 <root>/docs/agents/ 下（逐字节）。
 * 留模型：当 CLAUDE.md 与 AGENTS.md 同时存在时，取更高优先级 CLAUDE.md 为源，
 * 但不自动删除 AGENTS.md，由模型决定如何处理。
 */
export function runSyncDoc({ root, seedsDir = SKILL_ROOT, dryRun = false, block = null }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const actions = [];
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
    if (after === before) {
      actions.push({ file: canonical, action: 'unchanged', detail: 'Agent skills 块与多代理块均已是最新' });
    } else {
      actions.push({
        file: canonical,
        action: dryRun ? 'skipped' : 'updated',
        detail: `${before.includes('## Agent skills') ? '就地替换' : '追加'} Agent skills 块${before.includes('## 多代理要求') ? '' : '，并注入多代理要求块'}`,
      });
      if (!dryRun) fs.writeFileSync(srcAbs, after, 'utf-8');
    }
  } else {
    actions.push({ file: canonical, action: 'unchanged', detail: '已存在，作为同步源（未启用块 upsert）' });
  }

  // 逐字节复制源 → CODEBUDDY.md（记录 created/updated/unchanged）
  const cbAbs = path.join(root, 'CODEBUDDY.md');
  if (!dryRun && !createdDefault) {
    // 内容可能刚被 upsert 修改，重新读源
    const srcNow = fs.readFileSync(srcAbs);
    if (!fs.existsSync(cbAbs)) {
      actions.push({ file: 'CODEBUDDY.md', action: 'created', detail: `由 ${canonical} 逐字节复制` });
    } else if (fs.readFileSync(cbAbs).equals(srcNow)) {
      actions.push({ file: 'CODEBUDDY.md', action: 'unchanged', detail: `与 ${canonical} 已逐字节一致` });
    } else {
      actions.push({ file: 'CODEBUDDY.md', action: 'updated', detail: `与 ${canonical} 不一致，已覆盖为逐字节一致` });
    }
    fs.mkdirSync(path.dirname(cbAbs), { recursive: true });
    fs.copyFileSync(srcAbs, cbAbs);
  } else if (!dryRun) {
    actions.push({ file: 'CODEBUDDY.md', action: 'created', detail: `由 ${canonical} 逐字节复制` });
    fs.mkdirSync(path.dirname(cbAbs), { recursive: true });
    fs.copyFileSync(srcAbs, cbAbs);
  } else {
    actions.push({ file: 'CODEBUDDY.md', action: 'skipped', detail: 'dry-run 演练，不落盘' });
  }

  // 克隆三份 docs/agents/*.md 模板（区分 created/updated/unchanged）
  const templates = [];
  for (const { seed, out } of DOC_TEMPLATES) {
    templates.push(out);
    if (dryRun) {
      actions.push({ file: `docs/agents/${out}`, action: 'skipped', detail: 'dry-run 演练，不落盘' });
      continue;
    }
    const seedAbs = path.join(seedsDir, seed);
    const outAbs = path.join(root, 'docs/agents', out);
    if (!fs.existsSync(outAbs)) {
      actions.push({ file: `docs/agents/${out}`, action: 'created', detail: `由种子 ${seed} 克隆` });
    } else if (filesIdentical(seedAbs, outAbs)) {
      actions.push({ file: `docs/agents/${out}`, action: 'unchanged', detail: '与种子已逐字节一致' });
    } else {
      actions.push({ file: `docs/agents/${out}`, action: 'updated', detail: `与种子 ${seed} 不一致，已覆盖` });
    }
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.copyFileSync(seedAbs, outAbs);
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
  const opts = { cmd: argv[2], root: process.cwd(), seeds: null, layout: null, labels: null, noBlock: false, dryRun: false };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') opts.root = argv[++i];
    else if (a === '--seeds') opts.seeds = argv[++i];
    else if (a === '--layout') opts.layout = argv[++i];
    else if (a === '--labels') opts.labels = argv[++i];
    else if (a === '--no-block') opts.noBlock = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else throw new Error(`未知选项: ${a}`);
  }
  return opts;
}

function usage() {
  return `用法: setup.mjs <子命令> [选项]

子命令：
  detect             步骤 1「探索」：扫描仓库初始状态，输出 JSON 报告（只读）
  template           输出全部默认文件模板内容到 stdout（不落盘），供模型展示给用户复制/替换
  sync-doc           仅在明确要求写盘时使用：双文件逐字节一致 + Agent skills 块 upsert + docs/agents/*.md 模板

选项：
  --root <dir>       目标仓库根目录（默认当前目录）
  --seeds <dir>      docs/agents 模板种子目录（默认本技能目录自身）
  --layout <mode>    template / sync-doc：领域文档布局 single|multi（默认 single）
  --labels <json>    template / sync-doc：triage 标签覆盖表（'{"needs-triage":"bug:triage"}'）
  --no-block         sync-doc：纯同步，不 upsert「## Agent skills」块（CLI 默认 upsert）
  --dry-run          演练：只打印动作，不落盘
`;
}

export function main(argv) {
  const opts = parseArgs(argv);
  if (!opts.cmd || opts.cmd === '-h' || opts.cmd === '--help') {
    console.log(usage());
    return opts.cmd ? 0 : 2;
  }

  try {
    if (opts.cmd === 'detect') {
      console.log(JSON.stringify(runDetect({ root: opts.root }), null, 2));
      return 0;
    }
    if (opts.cmd === 'template') {
      const block = { layout: opts.layout || 'single', labels: opts.labels ? JSON.parse(opts.labels) : {} };
      for (const f of buildTemplateOutput({ seedsDir: opts.seeds || SKILL_ROOT, ...block })) {
        console.log(`=== FILE: ${f.file} ===`);
        console.log(f.content);
        console.log('');
      }
      return 0;
    }
    if (opts.cmd === 'sync-doc') {
      // CLI 默认 upsert Agent skills 块（SKILL.md 步骤 4）；--no-block 退化为纯同步
      const block = opts.noBlock ? null : { layout: opts.layout || 'single', labels: opts.labels ? JSON.parse(opts.labels) : {} };
      const r = runSyncDoc({ root: opts.root, seedsDir: opts.seeds || SKILL_ROOT, dryRun: opts.dryRun, block });
      console.log(`sync-doc: 源=${r.canonical}${r.createdDefault ? '（默认创建）' : ''}${r.dryRun ? ' [dry-run]' : ''}`);
      for (const a of r.actions) console.log(`  [${a.action}] ${a.file} — ${a.detail}`);
      console.log(`  一致性=${r.identical ? 'OK' : 'MISMATCH'}  多代理要求=${r.multiAgent ? '有' : '缺'}  模板=${r.templates.join(', ')}`);
      return r.identical ? 0 : 2;
    }
    console.error(`未知子命令: ${opts.cmd}`);
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
