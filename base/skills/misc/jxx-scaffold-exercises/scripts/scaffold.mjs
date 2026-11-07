#!/usr/bin/env node
// scaffold.mjs — 脚手架类技能的确定性流程 CLI（零第三方依赖，ESM）。
// 子命令：
//   memorial-init     grill-with-memorial 初始化：NNN 递增编号 + slug 目录脚手架 + context.md 模板 + C1–C9 checklist
//   memorial-archive  grill-with-memorial 归档：把已「已完成」的 memorial 目录移动到 archived/
//   scaffold-exercises / setup-precommit 见 usage()
// 注：jxx-setup-skills 的 detect/sync-doc 已迁移至该技能目录的 scripts/setup.mjs（自包含）。
// 判读（内容起草、编号是否该继续、语义审查）一律留模型，本脚本只做确定性机械动作。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFileSafe } from './shared/fs-utils.mjs';
import { nextSeq, slugify } from './shared/next-seq.mjs';
import { renderTemplate } from './shared/render-template.mjs';

// ------------------------------------------------------------------ 常量

// grill-with-memorial：context.md 模板。{{id}} 为 NNN-slug，{{subject}} 为「诉求」用户原话。
// 需求理解区分用户明确表达、上下文推断与真正缺失；待澄清只收未解决 L3。
export const CONTEXT_TEMPLATE = `# {{id}}

状态：进行中

## 诉求

{{subject}}

## 需求理解

| 项目 | 理解 | 来源（用户明确 / 上下文推断） |
|------|------|--------------------------------|
| 核心目标 |  |  |
| 使用场景 |  |  |
| 明确要求 |  |  |
| 约束 |  |  |
| 明确偏好 |  |  |
| 验收标准 |  |  |

- 真正缺失：

## 追问记录

## 决策汇总

| 决策 | 级别（L1/L2/L3） | 来源（自主/用户） | 关键假设与影响 | 易修正方式（L2） | 依据 |
|------|-------------------|--------------------|----------------|-------------------|------|

## 待澄清（仅未解决 L3）
`;

// grill-with-memorial：C1–C9 checklist 模板（阶段 3 收尾检查项，实例化后由模型逐项核对）。
// 覆盖需求、决策分流、提问必要性、方案比较、证据、调查、ADR 与全局回写。
export const CHECKLIST_TEMPLATE = `# Checklist {{id}}

| # | 检查项 | 通过条件 | 状态 |
|---|--------|---------|------|
| C1 | 需求覆盖 | 需求理解六项已填并区分来源；方案完整，每个诉求点有对应决策 | ☐ |
| C2 | 决策分流 | 决策汇总标注 L1/L2/L3 与自主/用户；L1/L2 已自主处理，L2 已记录关键假设、影响与易修正方式；L3 已由用户确认，或具有明确授权的主 agent 代决记录 | ☐ |
| C3 | 待澄清清零 | 无未解决 L3；待澄清不含事实欠账或 L1/L2 细节 | ☐ |
| C4 | 提问必要 | 未重复询问已有信息或已确认决策；每次提问只含当前阻塞的 L3，并给推荐、理由与 2–3 个选项 | ☐ |
| C5 | 方案比较完整 | 未因工作量、实现难度、Token/时间或重构预先否决更优方案；显著扩大范围、显著增加成本或风险，或需要重大重构的候选已记录收益、代价、可逆性与推荐，未授权时交用户决定，已明确授权时记录授权原文与影响后由主 agent 代决 | ☐ |
| C6 | 证据可复核 | 决策汇总与 ADR 的事实性论据均带来源坐标；无来源的标为假设并记录影响 | ☐ |
| C7 | 调查闭环 | 所有 sub-task 状态「已完成」且含结论与来源，context.md 已记录调查结果 | ☐ |
| C8 | ADR 齐全 | 满足三条件的决策均有 ADR | ☐ |
| C9 | 回写分流 | 有全局 CONTEXT/ADR 回写内容时，未授权范围只合并做一次明确范围确认；已授权相同范围记录授权原文与影响后直接回写，不重复询问；无内容时未询问 | ☐ |
`;

// ------------------------------------------------------------------ 工具

/** 读取 context.md 中的「状态」值；无状态行返回 null。 */
export function readMemorialStatus(ctxPath) {
  if (!fs.existsSync(ctxPath)) return null;
  const m = fs.readFileSync(ctxPath, 'utf-8').match(/^\s*状态[：:]\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

/** 在 memorial 顶层扫描匹配 ref（NNN 或 NNN-slug）的目录；找不到返回 null。 */
export function findMemorial(memorialRoot, ref) {
  if (!fs.existsSync(memorialRoot)) return null;
  const refDir = ref.replace(/[\\/]$/, '');
  // 精确目录名匹配优先
  const exact = path.join(memorialRoot, refDir);
  if (fs.existsSync(exact) && fs.statSync(exact).isDirectory()) return exact;
  // 否则按前缀 NNN 匹配（取第一个 NNN-*）
  for (const entry of fs.readdirSync(memorialRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const m = entry.name.match(/^(\d+)-/);
    if (m && ref === m[1]) return path.join(memorialRoot, entry.name);
  }
  return null;
}

/**
 * 计算下一个 memorial NNN：同时扫描 live 目录与 archived/ 目录取全局最大 +1，补零三位。
 * 保证全局编号单调递增（归档过的编号也被计入，避免复用）。
 */
export function nextMemorialSeq(memorialRoot) {
  const archivedRoot = path.join(memorialRoot, 'archived');
  const live = nextSeq(memorialRoot, { pad: 3 });
  const archived = nextSeq(archivedRoot, { pad: 3 });
  const next = Math.max(parseInt(live, 10), parseInt(archived, 10));
  return String(next).padStart(3, '0');
}

// ------------------------------------------------------------------ memorial-init

/**
 * grill-with-memorial 初始化。
 * @param {{root: string, subject: string, dryRun?: boolean}} args
 * @returns {{dir: string, nnn: string, slug: string, dirName: string, context: string, checklist: string, files: string[]}}
 *
 * 流程（SKILL.md 阶段 1）：
 *   1. NNN = 全局递增最大 +1（补零三位，含 archived/ 计数）；slug 从诉求提取 kebab-case（中文剥离，纯中文回落 untitled）。
 *   2. 创建 docs/memorial/NNN-slug/{context.md,adr/,sub-task/} 完整目录结构。
 *   3. context.md：状态「进行中」，诉求段保留用户原话，按模板初始化需求理解、追问、决策与待澄清。
 *   4. 额外实例化 checklist.md（C1–C9 待核项，供收尾阶段核对）。
 * 留模型：「这个编号是否该继续」的数字本身由脚本给，是否沿用由模型判断；slug 为纯中文时回落
 *   untitled，如需更贴切名称由模型在创建前自行决定。
 */
export function runMemorialInit({ root, subject, dryRun = false }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  if (!subject || !subject.trim()) throw new Error('subject 不能为空');
  const memorialRoot = path.join(root, 'docs/memorial');
  const nnn = nextMemorialSeq(memorialRoot);
  const slug = slugify(subject);
  const dirName = `${nnn}-${slug}`;
  const dir = path.join(memorialRoot, dirName);
  if (fs.existsSync(dir)) throw new Error(`目录已存在: ${dir}`);
  if (dryRun) {
    return { dir, nnn, slug, dirName, context: path.join(dir, 'context.md'), checklist: path.join(dir, 'checklist.md'), files: [], dryRun: true };
  }
  fs.mkdirSync(path.join(dir, 'adr'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sub-task'), { recursive: true });
  const ctx = renderTemplate(CONTEXT_TEMPLATE, { id: dirName, subject });
  const context = writeFileSafe(path.join(dir, 'context.md'), ctx);
  const checklist = writeFileSafe(path.join(dir, 'checklist.md'), renderTemplate(CHECKLIST_TEMPLATE, { id: dirName }));
  return { dir, nnn, slug, dirName, context, checklist, files: [context, checklist], dryRun };
}

// ------------------------------------------------------------------ memorial-archive

/**
 * grill-with-memorial 归档。
 * @param {{root: string, ref: string, force?: boolean, dryRun?: boolean}} args
 * @returns {{from: string, to: string, status: string|null}}
 *
 * 流程（SKILL.md 阶段 3「归档」）：把 docs/memorial/NNN-slug/ 移动到 docs/memorial/archived/NNN-slug/。
 * 守卫：context.md 状态须为「已完成」，否则抛错；--force 可跳过此判断。
 * 留模型：是否达到「已完成」由模型在 grill 收尾时把关，脚本只做状态行的机械判定。
 */
export function runMemorialArchive({ root, ref, force = false, dryRun = false }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const memorialRoot = path.join(root, 'docs/memorial');
  const from = findMemorial(memorialRoot, ref);
  if (!from) throw new Error(`未找到 memorial: ${ref}`);
  const status = readMemorialStatus(path.join(from, 'context.md'));
  if (status !== '已完成' && !force) {
    throw new Error(`memorial ${path.basename(from)} 状态非「已完成」（实际: ${status}），无法归档；用 --force 强制`);
  }
  const to = path.join(memorialRoot, 'archived', path.basename(from));
  if (dryRun) return { from, to, status, dryRun: true };
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) throw new Error(`归档目标已存在: ${to}`);
  fs.renameSync(from, to);
  return { from, to, status, dryRun: false };
}

// ================================================================ scaffold-exercises
// jxx-scaffold-exercises：按计划创建 `exercises/XX-section/XX.YY-exercise/{explainer,problem,solution}/readme.md` 骨架。
// 命名规则：章节 `XX-section-name`，练习 `XX.YY-exercise-name`；缺省变体 explainer/。判读（计划→细节、内容）留模型。

/** 把 `05.02` 之类编号规范为 `05.02`（最多两位小节）。 */
export function normalizeExerciseSeq(section, exercise) {
  const s = String(section).padStart(2, '0');
  if (exercise == null || exercise === '') return s;
  return `${s}.${String(exercise).padStart(2, '0')}`;
}

/**
 * 按计划创建练习目录骨架。
 * @param {{root:string, plan:Array<{section:number, sectionName:string,
 *          items:Array<{num:string, name:string, variants?:Array<string>}>}>, dryRun?:boolean}} args
 * @returns {{created:Array<string>}}
 */
export function runScaffoldExercises({ root, plan, dryRun = false }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const created = [];
  for (const sec of plan) {
    const secDir = path.join(root, 'exercises', `${normalizeExerciseSeq(sec.section, '')}-${slugify(sec.sectionName)}`);
    for (const item of sec.items) {
      const exDir = path.join(secDir, `${normalizeExerciseSeq(sec.section, item.num)}-${slugify(item.name)}`);
      const variants = item.variants && item.variants.length ? item.variants : ['explainer'];
      for (const v of variants) {
        const vDir = path.join(exDir, v);
        if (dryRun) { created.push(vDir); continue; }
        const readme = path.join(vDir, 'readme.md');
        writeFileSafe(readme, `# ${item.name}\n\nDescription here\n`);
        created.push(vDir);
      }
    }
  }
  return { created };
}

// ================================================================ setup-pre-commit
// jxx-setup-pre-commit：检测包管理器 + 生成 .husky/pre-commit/.lintstagedrc/.prettierrc。
// lint-staged 与 prettier 配置为确定性模板；typecheck/test 脚本省略由模型判断。

/** 由 lock 文件检测包管理器：package-lock→npm、pnpm-lock→pnpm、yarn.lock→yarn、bun.lockb→bun；无 lock 或未知→npm。 */
export function detectPackageManager(lockFiles) {
  if (Array.isArray(lockFiles) && lockFiles.includes('pnpm-lock.yaml')) return 'pnpm';
  if (Array.isArray(lockFiles) && lockFiles.includes('yarn.lock')) return 'yarn';
  if (Array.isArray(lockFiles) && lockFiles.includes('bun.lockb')) return 'bun';
  return 'npm'; // 含 package-lock.json 或缺省
}

/** 生成 lint-staged 配置 JSON（确定性）。 */
export const LINTSTAGED_RC = { '*': 'prettier --ignore-unknown --write' };

/** 生成 prettier 配置 JSON（确定性，SKILL.md 默认值）。 */
export const PRETTIER_RC = {
  useTabs: false, tabWidth: 2, printWidth: 80,
  singleQuote: false, trailingComma: 'es5', semi: true, arrowParens: 'always',
};

/**
 * 写入 pre-commit 相关文件。
 * @param {{root:string, pkgManager?:string, scripts?:{typecheck?:boolean, test?:boolean}, dryRun?:boolean}} args
 * @returns {{manager:string, files:Array<string>}} 生成的文件相对路径
 */
export function runSetupPrecommit({ root, pkgManager, scripts = {}, dryRun = false }) {
  if (!path.isAbsolute(root)) root = path.resolve(root);
  const locks = fs.existsSync(root) ? fs.readdirSync(root).filter((n) => /(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb)$/.test(n)) : [];
  const manager = pkgManager || detectPackageManager(locks);
  const run = manager === 'npm' ? 'npm run' : `${manager} run`;
  const lines = ['npx lint-staged'];
  if (scripts.typecheck !== false) lines.push(`${run} typecheck`);
  if (scripts.test !== false) lines.push(`${run} test`);
  const files = [];
  const preCommit = path.join(root, '.husky', 'pre-commit');
  const lintstaged = path.join(root, '.lintstagedrc');
  const prettierrc = path.join(root, '.prettierrc');
  if (dryRun) return { manager, files: [preCommit, lintstaged, prettierrc] };
  writeFileSafe(preCommit, `${lines.join('\n')}\n`);
  writeFileSafe(lintstaged, `${JSON.stringify(LINTSTAGED_RC, null, 2)}\n`);
  writeFileSafe(prettierrc, `${JSON.stringify(PRETTIER_RC, null, 2)}\n`);
  return { manager, files: [preCommit, lintstaged, prettierrc] };
}

// ------------------------------------------------------------------ CLI

function usage() {
  return `用法: scaffold.mjs <子命令> [选项]

子命令：
  memorial-init      grill-with-memorial 初始化（NNN + slug 目录 + context.md + C1–C9 checklist）
  memorial-archive   grill-with-memorial 归档（将「已完成」memorial 移到 archived/）
  scaffold-exercises jxx-scaffold-exercises 练习目录骨架（exercises/XX-section/XX.YY-exercise/...）
  setup-precommit    jxx-setup-pre-commit：检测包管理器 + 生成 .husky/pre-commit/.lintstagedrc/.prettierrc

选项：
  --root <dir>       目标仓库根目录（默认当前目录）
  --subject <text>   memorial-init：诉求原话
  --ref <NNN|NNN-slug>  memorial-archive：要归档的 memorial 引用
  --force            memorial-archive：跳过「已完成」状态守卫
  --plan <json>      scaffold-exercises：计划（{section,sectionName,items:[{num,name,variants}]}[]）
  --manager <pkg>    setup-precommit：指定包管理器（npm|pnpm|yarn|bun；缺省按 lock 检测）
  --skip-scripts     setup-precommit：不写 typecheck/test 行（仓库无对应脚本时）
  --dry-run          演练，不落盘
  -h, --help         显示本帮助`;
}

const VALUE_OPTS = new Set(['--root', '--subject', '--ref', '--plan', '--manager']);

function parseArgs(argv) {
  const opts = { root: process.cwd(), dryRun: false, force: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') { opts.force = true; continue; }
    if (a === '--skip-scripts') { opts.skipScripts = true; continue; }
    if (a === '--dry-run') { opts.dryRun = true; continue; }
    if (a === '-h' || a === '--help') { opts.help = true; continue; }
    if (a.startsWith('-')) {
      if (!VALUE_OPTS.has(a)) { opts.error = `未知选项: ${a}`; break; }
      if (i + 1 >= argv.length) { opts.error = `选项 ${a} 缺少参数值`; break; }
      const v = argv[++i];
      if (a === '--root') opts.root = v;
      else if (a === '--subject') opts.subject = v;
      else if (a === '--ref') opts.ref = v;
      else if (a === '--plan') opts.plan = v;
      else opts.manager = v;
    } else {
      positional.push(a);
    }
  }
  opts.cmd = positional[0] || null;
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(usage()); return 0; }
  if (opts.error) { console.error(`错误: ${opts.error}\n\n${usage()}`); return 2; }
  if (!opts.cmd) { console.error(`错误: 缺省子命令\n\n${usage()}`); return 2; }

  try {
    if (opts.cmd === 'memorial-init') {
      const r = runMemorialInit({ root: opts.root, subject: opts.subject, dryRun: opts.dryRun });
      console.log(`memorial-init: ${path.basename(r.dir)} 已${r.dryRun ? '演练（不落盘）' : '创建'}`);
      return 0;
    }
    if (opts.cmd === 'memorial-archive') {
      if (!opts.ref) { console.error(`错误: memorial-archive 需要 --ref\n\n${usage()}`); return 2; }
      const r = runMemorialArchive({ root: opts.root, ref: opts.ref, force: opts.force, dryRun: opts.dryRun });
      console.log(`memorial-archive: ${path.basename(r.from)} → ${path.relative(opts.root, r.to)}${r.dryRun ? '（演练）' : ''}`);
      return 0;
    }
    if (opts.cmd === 'scaffold-exercises') {
      if (!opts.plan) { console.error(`错误: scaffold-exercises 需要 --plan <json>\n\n${usage()}`); return 2; }
      const r = runScaffoldExercises({ root: opts.root, plan: JSON.parse(opts.plan), dryRun: opts.dryRun });
      console.log(`scaffold-exercises: 生成 ${r.created.length} 个变体目录${opts.dryRun ? '（演练）' : ''}`);
      return 0;
    }
    if (opts.cmd === 'setup-precommit') {
      const r = runSetupPrecommit({ root: opts.root, pkgManager: opts.manager, scripts: { typecheck: !opts.skipScripts, test: !opts.skipScripts }, dryRun: opts.dryRun });
      console.log(`setup-precommit: 包管理器=${r.manager}，写入 ${r.files.length} 个文件${opts.dryRun ? '（演练）' : ''}`);
      return 0;
    }
  } catch (e) {
    console.error(`错误: ${e.message}`);
    return 2;
  }
  console.error(`错误: 未知子命令 "${opts.cmd}"\n\n${usage()}`);
  return 2;
}

// main 触发守卫：直接运行时才执行；被测试 import 时不触发（pathToFileURL 范式）。
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}