#!/usr/bin/env node
// milestones.mjs — jxx-to-milestones 的里程碑流水线 CLI。
// 覆盖确定性规则：工单解析（编号/标题/状态/依赖）、依赖分层、相邻层贪心合并、
// "独立上线"硬约束校验（依赖闭合/覆盖/去重/空组/循环）、MILESTONES.md 渲染与进度回读。
// 判读性内容（里程碑命名、用户视角交付、回滚方式、验收信号语义）留模型，不脚本化。
// 零第三方依赖，仅 Node 内建模块 + ./shared 相对 import。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSafe } from './shared/fs-utils.mjs';
import { renderTemplate } from './shared/render-template.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MILESTONE_FILE = 'MILESTONES.md';
export const ISSUES_DIRNAME = 'issues';
export const MILESTONE_STATUSES = ['pending', 'in-progress', 'shipped', 'blocked'];
export const DONE_STATUS = 'done';
export const DEFAULT_TARGET = 4;
export const DEFAULT_MAX = 6;

// ---------------------------------------------------------------- 基础工具

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

const TITLE_RE = /^#\s+(.+?)\s*$/m;
const STATUS_RE = /^\*{0,2}Status[:：]\*{0,2}\s*(\S+?)\s*$/m;
const BLOCKED_RE = /^\*{0,2}Blocked by[:：]\*{0,2}\s*(.*?)\s*$/m;
const BUILD_RE = /^\*{0,2}构建内容[:：]\*{0,2}\s*(.*?)\s*$/m;

/**
 * 解析单个工单文件文本。
 * @param {string} content 工单 Markdown 原文
 * @param {string|number} num 由文件名推导的工单编号
 * @returns {{num: string, title: string, status: string, deps: string[], build: string}}
 */
export function parseTicket(content, num) {
  const n = pad2(num);
  const title = (content.match(TITLE_RE) || [])[1] || '';
  const status = (content.match(STATUS_RE) || [])[1] || '';
  const blocked = (content.match(BLOCKED_RE) || [])[1] || '';
  const build = (content.match(BUILD_RE) || [])[1] || '';
  return { num: n, title, status, deps: parseDeps(blocked), build };
}

/**
 * 扫描功能目录下的工单文件。
 * @param {string} dir 功能目录（`<NN>-<slug>`）或其 `issues/` 子目录
 * @returns {{dir: string, issuesDir: string, tickets: object[]}} 工单按编号升序
 */
export function scanTickets(dir) {
  const base = path.basename(path.resolve(dir)) === ISSUES_DIRNAME ? path.dirname(path.resolve(dir)) : path.resolve(dir);
  const issuesDir = path.join(base, ISSUES_DIRNAME);
  const entries = fs.existsSync(issuesDir) ? fs.readdirSync(issuesDir) : [];
  const tickets = entries
    .filter((f) => /^\d+-.*\.md$/.test(f))
    .sort()
    .map((f) => parseTicket(fs.readFileSync(path.join(issuesDir, f), 'utf-8'), parseInt(f, 10)));
  return { dir: base, issuesDir, tickets };
}

// ---------------------------------------------------------------- 分组

/**
 * 解析分组表达式："01,02|03,04|05" → [['01','02'],['03','04'],['05']]。
 * 支持中英文逗号、空白与竖线分隔。
 */
export function parseGroups(spec) {
  if (!spec) return [];
  return String(spec)
    .split('|')
    .map((g) => [...new Set((g.match(/\d+/g) || []).map(pad2))].sort())
    .filter((g) => g.length > 0);
}

/** 分组数组 → 规范表达式字符串（parseGroups 的逆运算）。 */
export function formatGroups(groups) {
  return (groups || []).map((g) => g.join(',')).join('|');
}

/**
 * 依赖分层：level = 0（无集合内依赖）或 1 + max(level(依赖))。
 * 集合外依赖视为外部已完成，不构成约束；自引用忽略；循环依赖抛错。
 * @param {{num: string, deps: string[]}[]} tickets
 * @returns {Map<string, number>} num → 层号
 */
export function levelize(tickets) {
  const byNum = new Map(tickets.map((t) => [String(t.num), t]));
  const memo = new Map();
  const stack = [];
  function level(num) {
    if (memo.has(num)) return memo.get(num);
    if (stack.includes(num)) {
      throw new Error(`依赖存在循环: ${[...stack, num].join(' → ')}`);
    }
    stack.push(num);
    const t = byNum.get(num);
    const inDeps = (t.deps || []).filter((d) => byNum.has(d) && d !== num);
    const lv = inDeps.length ? 1 + Math.max(...inDeps.map(level)) : 0;
    stack.pop();
    memo.set(num, lv);
    return lv;
  }
  for (const t of tickets) level(String(t.num));
  return memo;
}

/** 按依赖层归组：每层一组，组内保持原输入顺序。 */
export function groupByLevel(tickets) {
  const levels = levelize(tickets);
  const groups = [];
  for (const t of tickets) {
    const lv = levels.get(String(t.num));
    if (!groups[lv]) groups[lv] = [];
    groups[lv].push(String(t.num));
  }
  return groups.filter(Boolean);
}

/**
 * 相邻层贪心合并：合并只发生在相邻层之间，因此依赖闭合性天然保持
 * （某工单的依赖恒在更低层 → 要么落在更早的组，要么落在本组更靠前的位置）。
 * @param {string[][]} groups 按层升序的分组
 * @param {{target?: number, max?: number}} opts target 为期望组大小，max 为硬上限
 */
export function mergeGroups(groups, opts = {}) {
  const target = opts.target ?? DEFAULT_TARGET;
  const max = Math.max(opts.max ?? DEFAULT_MAX, 1);
  const out = [];
  let cur = [];
  for (const g of groups) {
    if (cur.length === 0) { cur = [...g]; continue; }
    if (cur.length >= target || cur.length + g.length > max) {
      out.push(cur);
      cur = [...g];
    } else {
      cur = [...cur, ...g];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** 分层 + 合并，产出里程碑分组建议。 */
export function planGroups(tickets, opts = {}) {
  return mergeGroups(groupByLevel(tickets), opts);
}

/**
 * 集合内拓扑排序（依赖者在前），与输入顺序稳定。
 * @param {{num: string, deps: string[]}[]} tickets
 * @returns {string[]} 拓扑序编号
 */
export function topoOrder(tickets) {
  const set = new Set(tickets.map((t) => String(t.num)));
  const indeg = new Map();
  const dependents = new Map();
  for (const t of tickets) {
    const num = String(t.num);
    const deps = [...new Set((t.deps || []).map(String).filter((d) => set.has(d) && d !== num))];
    indeg.set(num, new Set(deps));
    for (const d of deps) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d).push(num);
    }
  }
  const result = [];
  const placed = new Set();
  let ready = tickets.filter((t) => indeg.get(String(t.num)).size === 0).map((t) => String(t.num));
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
    if (newly.length) ready.push(...newly);
  }
  if (placed.size !== tickets.length) {
    const stuck = tickets.map((t) => String(t.num)).filter((n) => !placed.has(n));
    throw new Error(`依赖存在循环且无法拓扑排序: ${stuck.join(', ')}`);
  }
  return result;
}

// ---------------------------------------------------------------- 硬约束校验

/**
 * 校验分组是否满足"每个里程碑可独立上线"的可判定硬约束。
 * @param {{num: string, deps: string[]}[]} tickets
 * @param {string[][]} groups
 * @param {{max?: number}} opts
 * @returns {{ok: boolean, errors: string[], warnings: string[], orders: string[][]}}
 */
export function checkGroups(tickets, groups, opts = {}) {
  const max = opts.max ?? DEFAULT_MAX;
  const errors = [];
  const warnings = [];
  const byNum = new Map(tickets.map((t) => [String(t.num), t]));
  const index = new Map(); // num → 里程碑序号（1 起）

  try {
    levelize(tickets);
  } catch (e) {
    errors.push(`E-CYCLE 循环依赖：${e.message}`);
  }

  groups.forEach((g, i) => {
    if (g.length === 0) errors.push(`E-EMPTY 里程碑 M${i + 1} 为空`);
    for (const num of g) {
      if (index.has(num)) {
        errors.push(`E-DUP 工单 ${num} 同时出现在 M${index.get(num)} 与 M${i + 1}`);
      } else {
        index.set(num, i + 1);
      }
      if (!byNum.has(num)) errors.push(`E-UNKNOWN 里程碑 M${i + 1} 引用了不存在的工单 ${num}`);
    }
    if (g.length > max) {
      warnings.push(`W-SIZE 里程碑 M${i + 1} 含 ${g.length} 个工单（超过建议上限 ${max}），建议拆分或确认粒度`);
    }
  });

  for (const t of tickets) {
    const num = String(t.num);
    if (!index.has(num)) errors.push(`E-MISSING 工单 ${num} 未归入任何里程碑`);
  }

  for (const t of tickets) {
    const num = String(t.num);
    for (const d of t.deps || []) {
      if (!byNum.has(d)) continue; // 集合外依赖：外部已完成，不构成约束
      const di = index.get(d);
      const ni = index.get(num);
      if (di === undefined || ni === undefined) continue;
      if (di > ni) {
        errors.push(`E-FWD-DEP 工单 ${num}（M${ni}）依赖 ${d}（M${di}）——依赖落在更晚的里程碑，该里程碑无法独立上线`);
      } else if (di === ni) {
        warnings.push(`W-INTRA-DEP 工单 ${num} 依赖同里程碑的 ${d}——组内必须串行：先 ${d} 后 ${num}`);
      }
    }
  }

  let orders = [];
  try {
    orders = groups.map((g) => {
      const subset = g.map((n) => byNum.get(n)).filter(Boolean);
      return subset.length ? topoOrder(subset) : [];
    });
  } catch {
    orders = groups.map((g) => g.slice()); // 循环依赖：无法拓扑排序，回退原序
  }

  return { ok: errors.length === 0, errors, warnings, orders };
}

// ---------------------------------------------------------------- 渲染

const MILESTONE_TEMPLATE = [
  '## {{id}}',
  '',
  '**状态：** {{status}}',
  '',
  '**工单：** {{nums}}',
  '',
  '**组内顺序：** {{order}}',
  '',
  '**用户视角交付：** {{delivery}}',
  '',
  '**可独立上线判据：** {{shippable}}',
  '',
  '**回滚方式：** {{rollback}}',
  '',
  '**验收信号：**',
  '',
  '{{signals}}',
  '',
].join('\n');

const PLACEHOLDER_DELIVERY = '（待补：此里程碑上线后用户能看到的端到端变化；若外部行为不变，写明"外部行为不变"）';
const PLACEHOLDER_SHIPPABLE = '（待补：为什么这批工单合起来是一个可发布整体——无半成品、无未完成的迁移、CI 绿）';
const PLACEHOLDER_ROLLBACK = '（待补：功能开关 / 迁移可逆 / 仅新增无破坏 / 直接 revert）';
const PLACEHOLDER_SIGNAL = '- [ ] （待补：一条可观测、可勾选的验收信号）';

const FOOTER = [
  '## 交付规则',
  '',
  '1. 里程碑之间**严格串行**：上一里程碑 `shipped` 后才开工下一里程碑。',
  '2. 里程碑内按"组内顺序"推进工单，逐工单 `/jxx-implement`，工单之间清理上下文。',
  '3. 里程碑末尾跑**上线门禁**：全员工单 `done` + 验收信号全勾选 + CI 绿 + 回滚方式已验证。',
  '4. 门禁通过后把该里程碑置 `shipped` 并提交，再进入下一里程碑。',
  '5. 中断后从本文件各里程碑的 `**状态：**` 行续接，不重做已完成里程碑。',
  '',
  '## 评论',
  '',
  '（交付过程中的阻塞、决策、偏差记录于此，新内容置于最前。）',
  '',
].join('\n');

/**
 * 渲染 MILESTONES.md 全文。
 * @param {{title?: string, sourceDir?: string, groups: string[][], tickets: object[], orders?: string[][]}} args
 * @returns {string} Markdown 全文
 */
export function renderMilestones({ title, sourceDir, groups, tickets, orders }) {
  const byNum = new Map((tickets || []).map((t) => [String(t.num), t]));
  const groupOrders = orders || groups.map((g) => g.slice());
  const lines = [];
  lines.push(`# 里程碑计划：${title || '（待补标题）'}`);
  lines.push('');
  if (sourceDir) {
    lines.push(`**源目录：** \`${sourceDir}\``);
    lines.push('');
  }
  lines.push(`**工单数：** ${(tickets || []).length} · **里程碑数：** ${groups.length} · **状态：** pending`);
  lines.push('');
  lines.push('> 每个里程碑结束时代码库必须处于**可发布状态**：CI 绿、无半成品、可回滚。里程碑之间严格串行；里程碑内无依赖的工单可并行。');
  lines.push('> 推进：逐工单 `/jxx-implement` → 里程碑上线门禁 → 勾选验收 → 置 `shipped` → 进入下一里程碑。');
  lines.push('');
  lines.push('## 进度总览');
  lines.push('');
  lines.push('| 里程碑 | 工单 |');
  lines.push('|--------|------|');
  groups.forEach((g, i) => {
    lines.push(`| M${i + 1} | ${g.join(', ')} |`);
  });
  lines.push('');

  groups.forEach((g, i) => {
    const id = `M${i + 1}`;
    const order = groupOrders[i] || g;
    const intra = order.some((n) => (g || []).some((m) => m !== n && (byNum.get(n)?.deps || []).includes(m)));
    const orderText = intra ? `${order.join(' → ')}（有依赖，按序串行）` : '无依赖，可并行';
    lines.push(
      renderTemplate(MILESTONE_TEMPLATE, {
        id,
        status: 'pending',
        nums: g.join(', '),
        order: orderText,
        delivery: PLACEHOLDER_DELIVERY,
        shippable: PLACEHOLDER_SHIPPABLE,
        rollback: PLACEHOLDER_ROLLBACK,
        signals: PLACEHOLDER_SIGNAL,
      }),
    );
  });

  lines.push(FOOTER);
  return lines.join('\n');
}

// ---------------------------------------------------------------- 回读

const MS_STATUS_RE = /^\*\*状态：\*\*\s*(\S+?)\s*$/m;
const MS_NUMS_RE = /^\*\*工单：\*\*\s*(.*?)\s*$/m;

/** 把 Markdown 文本切成 `## ` 标题分节（含标题行）。 */
function splitSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let cur = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      cur = { header: line, body: [] };
      sections.push(cur);
    } else if (cur) {
      cur.body.push(line);
    }
  }
  return sections.map((s) => ({ header: s.header, body: s.body.join('\n') }));
}

/**
 * 解析 MILESTONES.md 文本，结合工单文件状态输出进度与上线门禁就绪度。
 * @param {string} content MILESTONES.md 全文
 * @param {{num: string, title: string, status: string}[]} tickets 已扫描的工单
 * @returns {{overall: string, current: string|null, milestones: object[]}}
 */
export function parseMilestones(content, tickets) {
  const byNum = new Map((tickets || []).map((t) => [String(t.num), t]));
  const milestones = [];
  for (const sec of splitSections(content)) {
    const m = sec.header.match(/^##\s+(M\d+)(?:\s*[—-]\s*(.*))?\s*$/);
    if (!m) continue;
    const numsLine = (sec.body.match(MS_NUMS_RE) || [])[1] || '';
    const nums = numsLine ? (parseGroups(numsLine)[0] || []) : [];
    const body = sec.body;
    const signalsTotal = (body.match(/^- \[[ xX]\]/gm) || []).length;
    const signalsDone = (body.match(/^- \[[xX]\]/gm) || []).length;
    const msTickets = nums.map((n) => byNum.get(n)).filter(Boolean);
    const ticketsDone = msTickets.filter((t) => t.status === DONE_STATUS).length;
    const status = (body.match(MS_STATUS_RE) || [])[1] || 'pending';
    milestones.push({
      id: m[1],
      name: (m[2] || '').trim(),
      status,
      nums,
      tickets: msTickets.map((t) => ({ num: t.num, title: t.title, status: t.status })),
      ticketsTotal: nums.length,
      ticketsDone,
      signalsTotal,
      signalsDone,
      gate: {
        ticketsReady: nums.length > 0 && ticketsDone === nums.length,
        signalsReady: signalsTotal > 0 && signalsDone === signalsTotal,
        ready: nums.length > 0 && ticketsDone === nums.length && signalsTotal > 0 && signalsDone === signalsTotal,
      },
    });
  }
  const statuses = milestones.map((ms) => ms.status);
  let overall = 'pending';
  if (milestones.length && statuses.every((s) => s === 'shipped')) overall = 'shipped';
  else if (statuses.some((s) => s === 'in-progress' || s === 'shipped')) overall = 'in-progress';
  const current = (milestones.find((ms) => ms.status !== 'shipped') || {}).id || null;
  return { overall, current, milestones };
}

/**
 * 回读 <dir>/MILESTONES.md，输出进度与上线门禁就绪度。
 * @param {{dir: string}} args
 * @returns {{file: string, exists: boolean, overall: string, current: string|null, milestones: object[]}}
 */
export function runStatus({ dir }) {
  const { dir: base, tickets } = scanTickets(dir);
  const file = path.join(base, MILESTONE_FILE);
  if (!fs.existsSync(file)) {
    return { file, exists: false, overall: 'pending', current: null, milestones: [] };
  }
  return { file, exists: true, ...parseMilestones(fs.readFileSync(file, 'utf-8'), tickets) };
}

/**
 * 更新某里程碑的状态，并重算文件头部总体状态。
 * @param {{dir: string, milestone: string, status: string, dryRun?: boolean}} args
 * @returns {{file: string, milestone: string, status: string, overall: string}}
 */
export function runSetStatus({ dir, milestone, status, dryRun }) {
  if (!MILESTONE_STATUSES.includes(status)) {
    throw new Error(`非法里程碑状态 "${status}"，可选：${MILESTONE_STATUSES.join(', ')}`);
  }
  const { dir: base } = scanTickets(dir);
  const file = path.join(base, MILESTONE_FILE);
  if (!fs.existsSync(file)) throw new Error(`里程碑文件不存在: ${file}（先运行 render）`);
  const content = fs.readFileSync(file, 'utf-8');
  const id = String(milestone).toUpperCase();
  const firstSection = content.search(/^##\s/m);
  const preamble = firstSection === -1 ? content : content.slice(0, firstSection);
  const rest = firstSection === -1 ? '' : content.slice(firstSection);
  const sections = splitSections(rest);
  let hit = false;
  const rebuilt = [];
  for (const sec of sections) {
    if (sec.header.match(new RegExp(`^##\\s+${id}(\\s|$)`))) {
      hit = true;
      const body = MS_STATUS_RE.test(sec.body)
        ? sec.body.replace(MS_STATUS_RE, `**状态：** ${status}`)
        : `${sec.body.replace(/\s+$/, '')}\n\n**状态：** ${status}\n`;
      rebuilt.push(`${sec.header}\n${body}`);
    } else {
      rebuilt.push(`${sec.header}\n${sec.body}`);
    }
  }
  if (!hit) throw new Error(`未找到里程碑 ${id}`);
  const bodyOut = rebuilt.join('\n');
  const { tickets } = scanTickets(base);
  const after = parseMilestones(preamble + bodyOut, tickets);
  const preambleOut = preamble.replace(/^\*\*工单数：\*\*[^\n]*$/m, (line) =>
    line.replace(/状态：\*\* \S+/, `状态：** ${after.overall}`));
  const out = preambleOut + bodyOut;
  if (!dryRun) writeFileSafe(file, out);
  return { file, milestone: id, status, overall: after.overall };
}

// ---------------------------------------------------------------- 子命令实现

/** plan：产出里程碑分组建议 + 硬约束校验结果。 */
export function runPlan({ dir, groups, target, max, dryRun }) {
  const { tickets } = scanTickets(dir);
  const gs = groups && groups.length ? groups : planGroups(tickets, { target, max });
  const check = checkGroups(tickets, gs, { max });
  return { groups: gs, groupsText: formatGroups(gs), check, tickets, dryRun };
}

/** render：渲染并落盘 MILESTONES.md。 */
export function runRender({ dir, title, groups, target, max, dryRun }) {
  const { dir: base, tickets } = scanTickets(dir);
  const plan = runPlan({ dir: base, groups, target, max, dryRun });
  const content = renderMilestones({
    title,
    sourceDir: base,
    groups: plan.groups,
    tickets,
    orders: plan.check.orders,
  });
  const file = path.join(base, MILESTONE_FILE);
  if (!dryRun) writeFileSafe(file, content);
  return { file, groups: plan.groups, groupsText: plan.groupsText, check: plan.check };
}

/** check：校验分组（缺省回读已存在的 MILESTONES.md）。 */
export function runCheck({ dir, groups, target, max }) {
  const { dir: base, tickets } = scanTickets(dir);
  let gs = groups;
  if (!gs || !gs.length) {
    const status = runStatus({ dir: base });
    gs = status.milestones.map((ms) => ms.nums);
  }
  if (!gs || !gs.length) {
    const plan = planGroups(tickets, { target, max });
    gs = plan;
  }
  return { dir: base, groups: gs, groupsText: formatGroups(gs), check: checkGroups(tickets, gs, { max }) };
}

// ---------------------------------------------------------------- CLI

function usage() {
  return `用法: milestones.mjs <子命令> [选项]

子命令：
  scan <dir>        读取 <dir>/issues/*.md，输出工单清单（编号/标题/状态/依赖）
  plan <dir>        按依赖层归组为里程碑建议（分层 + 相邻层贪心合并）
  check <dir>       校验分组是否满足"独立上线"硬约束（--groups 指定，缺省回读 MILESTONES.md）
  render <dir>      生成/覆盖 <dir>/MILESTONES.md（--groups 指定，缺省用 plan 结果）
  status <dir>      输出里程碑进度与上线门禁就绪度
  set-status <dir>  更新某里程碑状态（--milestone M1 --status shipped）

选项：
  --dir <path>      功能目录 <NN>-<slug>（或其 issues/ 子目录）
  --groups <spec>   手工分组，如 "01,02|03,04|05"
  --target <n>      合并后的期望里程碑大小（默认 ${DEFAULT_TARGET}）
  --max <n>         里程碑硬上限，超过仅告警（默认 ${DEFAULT_MAX}）
  --title <text>    MILESTONES.md 标题
  --milestone <M*>  set-status 目标里程碑（如 M2）
  --status <value>  set-status 目标状态（${MILESTONE_STATUSES.join(' / ')}）
  --json            以 JSON 输出
  --dry-run         计算与打印但不落盘
  -h, --help        显示本帮助`;
}

const VALUE_OPTS = new Set(['--dir', '--groups', '--target', '--max', '--title', '--milestone', '--status']);

function parseArgs(argv) {
  const opts = { json: false, dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { opts.dryRun = true; continue; }
    if (a === '--json') { opts.json = true; continue; }
    if (a === '-h' || a === '--help') { opts.help = true; continue; }
    if (a.startsWith('-')) {
      if (!VALUE_OPTS.has(a)) { opts.error = `未知选项: ${a}`; break; }
      if (i + 1 >= argv.length) { opts.error = `选项 ${a} 缺少参数值`; break; }
      const v = argv[++i];
      if (a === '--dir') opts.dir = v;
      else if (a === '--groups') opts.groups = v;
      else if (a === '--target') opts.target = parseInt(v, 10);
      else if (a === '--max') opts.max = parseInt(v, 10);
      else if (a === '--title') opts.title = v;
      else if (a === '--milestone') opts.milestone = v;
      else opts.status = v;
    } else {
      positional.push(a);
    }
  }
  opts.cmd = positional[0] || '';
  if (positional[1]) opts.dirArg = positional[1];
  return opts;
}

function printGroups(groups) {
  groups.forEach((g, i) => {
    console.log(`M${i + 1}: ${g.join(', ')}`);
  });
}

function printCheck(check) {
  for (const e of check.errors) console.error(`  ERROR  ${e}`);
  for (const w of check.warnings) console.error(`  WARN   ${w}`);
  if (!check.errors.length && !check.warnings.length) console.error('  无问题：全部硬约束通过');
}

function printStatus(st) {
  if (!st.exists) {
    console.log(`尚无 ${MILESTONE_FILE}（${st.file}）—— 先运行 render`);
    return;
  }
  console.log(`总体状态: ${st.overall} · 当前里程碑: ${st.current || '（全部 shipped）'}`);
  for (const ms of st.milestones) {
    const gate = ms.gate.ready ? '门禁就绪' : '门禁未过';
    console.log(
      `  ${ms.id} [${ms.status}] 工单 ${ms.ticketsDone}/${ms.ticketsTotal} · 验收 ${ms.signalsDone}/${ms.signalsTotal} · ${gate}`,
    );
    for (const t of ms.tickets) {
      if (t.status !== DONE_STATUS) console.log(`      - ${t.num} ${t.title || ''} [${t.status || '无状态'}]`);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmds = new Set(['scan', 'plan', 'check', 'render', 'status', 'set-status']);
  if (opts.help) { console.log(usage()); return 0; }
  if (opts.error) { console.error(`错误: ${opts.error}\n\n${usage()}`); return 2; }
  if (!cmds.has(opts.cmd)) {
    console.error(`错误: 未知子命令 "${opts.cmd}"（需显式指定）\n\n${usage()}`);
    return 2;
  }
  const dir = opts.dir || opts.dirArg;
  if (!dir && opts.cmd !== 'help') { console.error(`错误: ${opts.cmd} 需 --dir <功能目录>\n\n${usage()}`); return 2; }
  const dry = opts.dryRun ? ' [dry-run]' : '';
  try {
    if (opts.cmd === 'scan') {
      const { tickets } = scanTickets(dir);
      if (opts.json) { console.log(JSON.stringify(tickets, null, 2)); return 0; }
      console.log(`工单 ${tickets.length} 个${dry}`);
      for (const t of tickets) {
        console.log(`  ${t.num}  ${t.title || '（无标题）'}  [${t.status || '无状态'}]  阻塞于 ${blockedByText(t.deps)}`);
      }
      return 0;
    }
    if (opts.cmd === 'plan') {
      const r = runPlan({ dir, groups: parseGroups(opts.groups), target: opts.target, max: opts.max, dryRun: opts.dryRun });
      if (opts.json) { console.log(JSON.stringify(r, null, 2)); return 0; }
      console.log(`里程碑建议（${r.groups.length} 个）${dry}`);
      printGroups(r.groups);
      console.log(`分组表达式: ${r.groupsText}`);
      printCheck(r.check);
      return r.check.ok ? 0 : 1;
    }
    if (opts.cmd === 'check') {
      const r = runCheck({ dir, groups: parseGroups(opts.groups), target: opts.target, max: opts.max });
      if (opts.json) { console.log(JSON.stringify(r, null, 2)); return 0; }
      console.log(`校验分组: ${r.groupsText}${dry}`);
      printCheck(r.check);
      return r.check.ok ? 0 : 1;
    }
    if (opts.cmd === 'render') {
      const r = runRender({
        dir, title: opts.title, groups: parseGroups(opts.groups),
        target: opts.target, max: opts.max, dryRun: opts.dryRun,
      });
      if (opts.json) { console.log(JSON.stringify({ ...r, file: r.file }, null, 2)); return 0; }
      console.log(`${dry ? '将创建' : '已创建'} ${r.file}`);
      printGroups(r.groups);
      printCheck(r.check);
      return r.check.ok ? 0 : 1;
    }
    if (opts.cmd === 'status') {
      const st = runStatus({ dir });
      if (opts.json) { console.log(JSON.stringify(st, null, 2)); return 0; }
      printStatus(st);
      return 0;
    }
    if (opts.cmd === 'set-status') {
      if (!opts.milestone || !opts.status) {
        console.error('错误: set-status 需 --milestone <M*> --status <value>');
        return 2;
      }
      const r = runSetStatus({ dir, milestone: opts.milestone, status: opts.status, dryRun: opts.dryRun });
      console.log(`${dry ? '将更新' : '已更新'} ${r.file}: ${r.milestone} → ${r.status}（总体 ${r.overall}）`);
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
