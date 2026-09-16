#!/usr/bin/env node
// issue-flow.mjs — jxx-to-spec / jxx-to-tickets 的 .scratch/ 编号流水线 CLI。
// 覆盖确定性规则：全局递增 topic 编号（NN）、topic 内递增工单编号、slug 化、
// 模板实例化（Status / Blocked by / 构建内容 / 验收 checkbox）、阻塞边规范化与依赖拓扑排序。
// 判读性内容（问题陈述、用户故事、验收标准语义、依赖边取舍）留模型，不脚本化。
// 零第三方依赖，仅 Node 内建模块 + 同目录 shared/ 相对 import（各副本自带 scripts/shared/）。
//
// ⚠ 本文件是三份同步副本之一：base/scripts/issue-flow.mjs，以及
//   base/skills/engineering/{jxx-to-spec,jxx-to-tickets}/scripts/issue-flow.mjs。
//   改完任一份都要跑 `node base/scripts/check-copies.mjs --fix` 同步全部副本（不带参数即校验）；
//   base/scripts/test/issue-flow.test.mjs 的 parity 用例与 check-copies 门禁会校验一致性。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { nextSeq, slugify } from './shared/next-seq.mjs';
import { renderTemplate } from './shared/render-template.mjs';
import { writeFileSafe } from './shared/fs-utils.mjs';

export const DEFAULT_STATUS = 'ready-for-agent';
const ROOT_MARKERS = ['.git', '.scratch'];

/**
 * 解析 `.scratch` 根目录——**锚定 cwd，绝不锚定脚本自身位置**。
 *
 * 本脚本会被逐字复制到技能目录（`base/skills/engineering/<skill>/scripts/`）并随 ship
 * 安装到各平台（如 `~/.workbuddy/skills/<skill>/scripts/`）。任何
 * `path.join(__dirname, '..', '..', '.scratch')` 式常量都会因副本深度不同而指错目录，
 * 且错误是**静默**的：`nextSeq` 对不存在的目录返回 `01`，`writeFileSafe` 会
 * `mkdirSync(recursive)` 直接建出新目录树。故此处只认 cwd。
 * @param {{root?: string, cwd?: string}} [opts] root 显式指定时直接采用（相对 cwd 解析）
 * @returns {string} `.scratch` 绝对路径
 * @throws 从 cwd 向上找不到 .git / .scratch 标记时抛错（宁失败，不静默写错目录）
 */
export function resolveScratchRoot({ root, cwd = process.cwd() } = {}) {
  if (root) return path.resolve(cwd, root);
  const start = path.resolve(cwd);
  for (let cur = start; ; ) {
    if (ROOT_MARKERS.some((m) => fs.existsSync(path.join(cur, m)))) {
      return path.join(cur, '.scratch');
    }
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  throw new Error(
    `未在 ${start} 及其父目录中找到 .git / .scratch 标记，无法确定 .scratch 根；请进入仓库目录后重试或显式传 --root <path>`,
  );
}

// ---------------------------------------------------------------- 纯函数

/** 全局递增 topic 编号：.scratch/ 下最大 NN + 1，补零两位（跨 topic/跨目录递增）。 */
export function topicNum(scratchDir) {
  return nextSeq(scratchDir, { pad: 2 });
}

/** topic 内工单递增编号：issues/ 下最大 NN + 1，补零两位（首批从 01）。 */
export function issueNum(issuesDir) {
  return nextSeq(issuesDir, { pad: 2 });
}

/** 中文剥离回落 'untitled' 的 slug 化（复用 shared/next-seq，避免拼出 "NN-" 空路径）。 */
export const toSlug = slugify;

function pad2(n) {
  return String(parseInt(n, 10)).padStart(2, '0');
}

/** 从文本提取去重、补零、升序编号列表（"无——可立即开始" → 空）。 */
export function parseDeps(text) {
  if (!text) return [];
  const nums = String(text).match(/\d+/g);
  if (!nums) return [];
  return [...new Set(nums.map(pad2))].sort();
}

/** 渲染 Blocked by 行值：空依赖写"无——可立即开始"，有则升序编号逗号分隔。 */
export function blockedByText(deps) {
  const list = [...new Set((deps || []).map(pad2))].sort();
  return list.length ? list.join(', ') : '无——可立即开始';
}

const BLOCKED_RE = new RegExp('^(\\*\\*Blocked by:\\*\\*)[^\\n]*$', 'm');
const STATUS_RE = new RegExp('^(\\*\\*Status:\\*\\*[^\\n]*)$', 'm');

/**
 * 规范化/填充工单文件的 Blocked by 文本行。
 * 已有该行则替换其值；无则插到 **Status:** 行之后。
 * @param {string} content 文件原文
 * @param {string[]} deps 依赖编号
 * @returns {string} 保证含一行 `**Blocked by:** <值>` 的内容
 */
export function fillBlockedBy(content, deps) {
  const value = blockedByText(deps);
  const line = `**Blocked by:** ${value}`;
  if (BLOCKED_RE.test(content)) {
    return content.replace(BLOCKED_RE, (_m, head) => `${head} ${value}`);
  }
  return content.replace(STATUS_RE, (_m, s) => `${s}\n${line}`);
}

/**
 * 拓扑/依赖排序：每个工单排在它所有（在集合内的）阻塞者之后，阻塞者在前。
 * 自引用（编号=自身）忽略；非集合内依赖视为外部已完成不构成约束；循环依赖抛错。
 * 无关工单按原输入顺序保持稳定。
 * @param {{num: string|number, deps: (string|number)[]}[]} issues
 * @returns {string[]} 依赖序编号（阻塞者在前）
 */
export function sortByDeps(issues) {
  const set = new Set(issues.map((i) => String(i.num)));
  const byOrig = new Map();
  issues.forEach((it, i) => byOrig.set(String(it.num), i));
  const indeg = new Map(); // num -> Set<it 依赖且非自身的编号>
  const dependents = new Map(); // dep -> 依赖它的编号[]
  const numOf = (it) => String(it.num);
  for (const it of issues) {
    const num = numOf(it);
    const inDeps = [...new Set((it.deps || []).map(String).filter((d) => set.has(d) && d !== num))];
    indeg.set(num, new Set(inDeps));
    for (const d of inDeps) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d).push(num);
    }
  }
  const result = [];
  const placed = new Set();
  let ready = issues.filter((it) => indeg.get(numOf(it)).size === 0).map(numOf);
  while (ready.length) {
    const num = ready.shift();
    if (placed.has(num)) continue;
    placed.add(num);
    result.push(num);
    const newly = [];
    for (const dv of dependents.get(num) || []) {
      indeg.get(dv).delete(num);
      if (indeg.get(dv).size === 0 && !placed.has(dv)) newly.push(dv);
    }
    if (newly.length) {
      ready.push(...newly); // FIFO：按就绪顺序追加，保持稳定拓扑序
    }
  }
  if (placed.size !== issues.length) {
    const stuck = issues.filter((it) => !placed.has(numOf(it))).map(numOf);
    throw new Error(`依赖存在循环且无法拓扑排序，未放置: ${stuck.join(', ')}`);
  }
  return result;
}

// ---------------------------------------------------------------- 模板

const PRD_TEMPLATE = [
  '# {{title}}',
  '',
  'Status: {{status}}',
  '',
  '{{body}}',
].join('\n');

const SPEC_BODY = [
  '## 问题陈述',
  '',
  '## 解决方案',
  '',
  '## 用户故事',
  '',
  '1. 作为 <角色>，我想要 <功能>，以便 <收益>',
  '',
  '## 实现决策',
  '',
  '## 测试决策',
  '',
  '## 超出范围',
  '',
  '## 补充说明',
  '',
].join('\n');

const TICKET_TEMPLATE = [
  '# {{title}}',
  '',
  '**Status:** {{status}}',
  '',
  '**Blocked by:** {{blockedBy}}',
  '',
  '**构建内容：** {{build}}',
  '',
  '**验收标准：**',
  '',
  '{{acceptance}}',
  '',
  '## 评论',
  '',
  '（评论与对话历史追加于此，新内容置于最前。）',
].join('\n');

// ---------------------------------------------------------------- 子命令实现

/**
 * to-spec：创建 `.scratch/<NN>-<slug>/PRD.md`，NN 为全局递增 topic 编号。
 * @param {{root: string, slug: string, title?: string, body?: string, dryRun?: boolean}} args
 *    body 为 PRD 正文；缺省用 spec 段落骨架（判读性内容由模型补全）。
 * @returns {{nn: string, dir: string, file: string}}
 */
export function runToSpec({ root, slug, title, body, dryRun }) {
  const nn = topicNum(root);
  const s = toSlug(slug);
  const dir = path.join(root, `${nn}-${s}`);
  const file = path.join(dir, 'PRD.md');
  const bodyContent = body ?? SPEC_BODY;
  const content = renderTemplate(PRD_TEMPLATE, { title: title || s, status: DEFAULT_STATUS, body: bodyContent });
  if (!dryRun) writeFileSafe(file, content + '\n');
  return { nn, dir, file };
}

/**
 * to-tickets：创建 `<topicDir>/issues/<NN>-<slug>.md`，NN 为 topic 内递增工单编号。
 * @param {{dir: string, slug: string, num?: string|number, deps?: string, title?: string,
 *          build?: string, accept?: string[], dryRun?: boolean}} args
 *    num 缺省自动取下一值（首批 01）；deps 为"01, 02"式依赖引用；accept 为验收项列表（cb 化）。
 * @returns {{nn: string, file: string}}
 */
export function runToTickets({ dir, slug, num, deps, title, build, accept, dryRun }) {
  const issuesDir = path.join(dir, 'issues');
  const nn = num !== undefined && num !== null && num !== '' ? pad2(num) : issueNum(issuesDir);
  const s = toSlug(slug);
  const file = path.join(issuesDir, `${nn}-${s}.md`);
  const blockedBy = blockedByText(parseDeps(deps || ''));
  const acceptLines = accept && accept.length
    ? accept.map((a) => `- [ ] ${a}`).join('\n')
    : '- [ ] 验收标准 1\n- [ ] 验收标准 2';
  const content = renderTemplate(TICKET_TEMPLATE, {
    title: title || s,
    status: DEFAULT_STATUS,
    blockedBy,
    build: build ?? '（待模型补全）',
    acceptance: acceptLines,
  });
  if (!dryRun) writeFileSafe(file, content + '\n');
  return { nn, file };
}

/**
 * resolve-block：读取 topic 下各 issue 声明的 Blocked by，规范化为规范格式写入，
 * 并按依赖输出拓扑序（阻塞者在前）。
 * @param {{dir: string, dryRun?: boolean}} args dir 为功能目录 `<NN>-<slug>`
 * @returns {{order: string[], files: string[]}}
 */
export function runResolveBlock({ dir, dryRun }) {
  const issuesDir = path.join(dir, 'issues');
  const entries = fs.existsSync(issuesDir) ? fs.readdirSync(issuesDir) : [];
  const issueFiles = entries.filter((f) => /^\d+-.*\.md$/.test(f)).sort();
  const issues = [];
  const touched = [];
  for (const f of issueFiles) {
    const abs = path.join(issuesDir, f);
    const content = fs.readFileSync(abs, 'utf-8');
    const num = pad2(parseInt(f, 10));
    const m = content.match(/\*\*Blocked by:\*\*\s*(.*)/);
    const deps = parseDeps(m ? m[1] : '');
    issues.push({ num, deps });
    const updated = fillBlockedBy(content, deps);
    if (updated !== content) {
      if (!dryRun) writeFileSafe(abs, updated);
      touched.push(abs);
    }
  }
  return { order: sortByDeps(issues), files: touched };
}

// ---------------------------------------------------------------- CLI

function usage() {
  return `用法: issue-flow.mjs <子命令> [选项]

子命令：
  next-topic        打印 .scratch/ 下下一个全局递增 topic 编号（NN，跨 topic 递增）
  to-spec           创建 <NN>-<slug>/PRD.md（to-spec；NN=全局递增，段落骨架可注入 --body）
  next-issue <dir>  打印某功能目录 issues/ 内下一个工单编号（首批 01）
  to-tickets        创建 <dir>/issues/<NN>-<slug>.md（to-tickets；NN=topic 内递增）
  resolve-block     规范化 <dir>/issues/ 各工单 Blocked by 行并输出依赖拓扑序（阻塞者在前）

选项：
  --root <path>     .scratch 根（默认：从 cwd 向上找含 .git/.scratch 的仓库，取其 .scratch）
  --dir <path>      功能目录 <NN>-<slug>（to-tickets / resolve-block）
  --slug <name>     slug（中文回落 untitled）
  --title <text>    标题
  --num <NN>        工单编号（缺省自动，首批 01）
  --deps <list>     依赖引用，如 "01, 02"（"无"则不阻塞）
  --build <text>    构建内容（从用户视角）
  --accept <text>   验收标准项（可重复）
  --body <file>     to-spec 正文文件（缺省用 spec 段落骨架）
  --dry-run         计算与打印但不落盘
  -h, --help        显示本帮助`;
}

const VALUE_OPTS = new Set(['--root', '--dir', '--slug', '--title', '--num', '--deps', '--build', '--accept', '--body']);

function parseArgs(argv) {
  const opts = { dryRun: false, accept: [] };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { opts.dryRun = true; continue; }
    if (a === '-h' || a === '--help') { opts.help = true; continue; }
    if (a.startsWith('-')) {
      if (!VALUE_OPTS.has(a)) { opts.error = `未知选项: ${a}`; break; }
      if (i + 1 >= argv.length) { opts.error = `选项 ${a} 缺少参数值`; break; }
      const v = argv[++i];
      if (a === '--root') opts.root = v;
      else if (a === '--dir') opts.dir = v;
      else if (a === '--slug') opts.slug = v;
      else if (a === '--title') opts.title = v;
      else if (a === '--num') opts.num = v;
      else if (a === '--deps') opts.deps = v;
      else if (a === '--build') opts.build = v;
      else if (a === '--accept') opts.accept.push(v);
      else opts.body = v;
    } else {
      positional.push(a);
    }
  }
  opts.cmd = positional[0] || '';
  if (positional[1]) opts.dirArg = positional[1];
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmds = new Set(['next-topic', 'to-spec', 'next-issue', 'to-tickets', 'resolve-block']);
  if (opts.help) { console.log(usage()); return 0; }
  if (opts.error) { console.error(`错误: ${opts.error}\n\n${usage()}`); return 2; }
  if (!cmds.has(opts.cmd)) {
    console.error(`错误: 未知子命令 "${opts.cmd}"（缺省需显式）\n\n${usage()}`);
    return 2;
  }
  const dry = opts.dryRun ? ' [dry-run]' : '';
  try {
    const root = resolveScratchRoot({ root: opts.root });
    if (opts.cmd === 'next-topic') {
      console.log(`下一个 topic 编号: ${topicNum(root)}${dry}（根: ${root}）`);
      return 0;
    }
    if (opts.cmd === 'next-issue') {
      const dir = opts.dir || opts.dirArg;
      if (!dir) { console.error('错误: next-issue 需 --dir <功能目录/issues 路径>'); return 2; }
      const issuesDir = /issues$/.test(dir) ? dir : path.join(dir, 'issues');
      console.log(`下一个工单编号: ${issueNum(issuesDir)}${dry}`);
      return 0;
    }
    if (opts.cmd === 'to-spec') {
      if (!opts.slug) { console.error('错误: to-spec 需 --slug <name>'); return 2; }
      const body = opts.body ? fs.readFileSync(path.resolve(opts.body), 'utf-8') : undefined;
      const r = runToSpec({ root, slug: opts.slug, title: opts.title, body, dryRun: opts.dryRun });
      console.log(`${dry ? '将创建' : '已创建'} ${r.file}`);
      return 0;
    }
    if (opts.cmd === 'to-tickets') {
      if (!opts.dir || !opts.slug) { console.error('错误: to-tickets 需 --dir <功能目录> --slug <name>'); return 2; }
      const r = runToTickets({
        dir: path.resolve(opts.dir), slug: opts.slug, num: opts.num, deps: opts.deps,
        title: opts.title, build: opts.build, accept: opts.accept, dryRun: opts.dryRun,
      });
      console.log(`${dry ? '将创建' : '已创建'} ${r.file}`);
      return 0;
    }
    if (opts.cmd === 'resolve-block') {
      if (!opts.dir) { console.error('错误: resolve-block 需 --dir <功能目录>'); return 2; }
      const r = runResolveBlock({ dir: path.resolve(opts.dir), dryRun: opts.dryRun });
      console.log(`依赖序（阻塞者在前）: ${r.order.join(', ')}`);
      for (const f of r.files) console.log(`${dry ? '将规范化' : '规范化'} ${f}`);
      return 0;
    }
  } catch (e) {
    console.error(`错误: ${e.message}`);
    return 1;
  }
  return 0;
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().then((code) => process.exit(code));
}