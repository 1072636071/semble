#!/usr/bin/env node
// goal.mjs — `.goals/` 文件流水线 CLI：契约校验（gate）、脚手架（init）、进度（progress-update）、验收证据（evidence）、语义审查记录（review-write）。
// 零第三方依赖，ESM，UTF-8。
//
// 子命令：
//   gate            对 GOAL.md 契约做 V1–V10 否决门正则/规则校验（逐门输出通过/否决+原因）
//   init            在 `.goals/<name>/` 脚手架产出 GOAL.md / PROGRESS.md / _index.md
//   progress-update 更新 PROGRESS.md 台账（轮数自增 + 切片状态 + 循环日志追加）
//   evidence        把验证命令通过/失败写入 EVIDENCE.md 对照表
//   review-write    REVIEW.md 模板化 + D1–D5 状态汇总 + 判定映射（✅/⚠️/❌ → 准奏/附条件/封驳）
//
// 设计原则（与三个 SKILL.md 对齐）：脚本只做"机械可确定"的校验与落盘；
// 语义判读（起草内容、各门各维度的主观判读、目标合理性评估）保留给模型，脚本中
// 相关规则在 JSDoc 里标注【留模型】。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { nextSeq } from './shared/next-seq.mjs';
import { renderTemplate } from './shared/render-template.mjs';
import { writeFileSafe } from './shared/fs-utils.mjs';

// =========================================================================
// 常量与正则（机械规则提炼，见 JSDoc）
// =========================================================================

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// 计划/拆解语言（V7）——出现即判拆解步骤混入契约。
// 【留模型】"阶段/步骤"存在歧义，不能单凭命中强判其是"执行计划"，脚本只做保守命中提示。
const PLAN_RE = /阶段\s*[0-9一二三]|第[一二三]步|步骤\s*[0-9一二三]|里程碑|拆解|执行计划|路线图|任务列表/;
// 步骤/实施表述（V1）——Goal 混入"怎么做"。
const STEPS_RE = /用\s*\S+|先\s*[写建搭做创建定义]|再\s*[写建搭做实现优化定义]|第一步|首先|开始|然后/;
// 过程性描述（V5）——Constraints 写成"怎么做"。
const PROCESS_RE = /先.{0,8}再|最后|步骤|接着|然后|按以下|如下步骤/;
// 交付物形态（V2 一部分）。
const FORM_RE = /代码|文档|工具|应用|脚本|库|组件|服务|系统|命令行|CLI|网站|程序|脚手架|模块/;
// 意图（V2 一部分）——【留模型】意图判读本质主观，脚本只做动词提示。
const INTENT_RE = /实现|提供|支持|解决|获得|完成|生成|检测|扫描|输出|报告|计算|转换|让|帮助|整理|翻译|自动化|构建/;
// 主观词 / 同义反复（V3）。
const SUBJECTIVE_RE = /好看|易用|高级|有质感|专业|友好|正常|顺利|方便|舒服|美观|大气|好用|优秀|先进/;
const TAUTOLOGY_RE = /正常工作|正常运行|能工作|实现该功能|按预期|没问题|符合要求|按要求完成/;
// Budget 必填项（V8）。
const MAX_ROUND_RE = /最大轮数/;
const TIME_LIMIT_RE = /时间上限/;
// 验收绑定（V10）。
const VERIFY_RE = /（验证：/;
const SELF_EVIDENCE_RE = /人工|人眼|AI\s*自评|我觉得|看起来没问题|按构造就通过/;

// 技术栈 / 范围 / 保护性约束三类关键词（V6 类别检查）——【留模型】边界判读主观。
const TECH_RE = /语言|框架|库|标准库|Node|Python|React|Go|TypeScript|版本|依赖|技术栈/;
const SCOPE_RE = /只|仅|不|范围|限定|限制|只读|不修改|不得/;
const PROTECT_RE = /不|禁止|不得|保护|安全|防止|避免|不泄露|只读|不处理|只可/;

// =========================================================================
// GOAL.md 段落解析（机械）
// =========================================================================

/**
 * 把 GOAL.md 文本按 `# 章节` 拆分为 { 章节名: 正文 }。空/无章节返回 {}。
 * 机械规则：以行首 `# ` 开头的行开启新章节，其后非标题行归入当前章节。
 * @param {string} text
 * @returns {Record<string,string>}
 */
export function parseSections(text) {
  const sections = {};
  const lines = text.split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    const m = line.match(/^[ \t]*#[^\S\r\n]*([^#].*)$/);
    if (m) {
      current = m[1].trim();
      sections[current] = sections[current] ?? [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].join('\n').trim();
  return sections;
}

/** 提取 Acceptance 段落的编号条目行（形如 `1. ...` / `2) ...`）。机械规则。 */
export function acceptanceItems(section) {
  return section.split(/\r?\n/).filter((l) => /^\s*\d+[.)]?\s+/.test(l));
}

/** 提取 Constraint 段落的要点行（`- ...` / `* ...`；退化：非空行）。机械规则。 */
function constraintBullets(section) {
  const bullets = section.split(/\r?\n/).filter((l) => /^\s*[-*]\s+/.test(l));
  if (bullets.length) return bullets;
  return section.split(/\r?\n/).filter((l) => l.trim() !== '');
}

/** 返回第一条命中正则的子串，未命中返回 null。 */
function firstMatch(text, re) {
  const m = text.match(re);
  return m ? m[0] : null;
}

// =========================================================================
// 否决门校验（gate）
// =========================================================================

/**
 * 对契约文本执行 V1–V10 否决门，返回逐门结果数组。
 * 每条规则只做"可机械判定的部分"，主观判读保留给模型（见各 JSDoc 标注）。
 * @param {string} goalText
 * @returns {Array<{gate:number,status:'通过'|'否决',reason:string}>}
 */
export function checkGates(goalText) {
  const s = parseSections(goalText);
  const goal = s['Goal'] ?? '';
  const acc = s['Acceptance'] ?? '';
  const cons = s['Constraints'] ?? '';
  const budget = s['Budget'] ?? '';
  const pause = s['Pause Conditions'] ?? '';
  const items = acceptanceItems(acc);
  const consBullets = constraintBullets(cons);
  const results = [];
  const out = (gate, status, reason) => results.push({ gate, status, reason });

  // -- V1 Goal 只说"什么"不含"怎么做" --------------------------------
  if (!goal) out(1, '否决', 'Goal 段落缺失或为空');
  else {
    const hit = firstMatch(goal, STEPS_RE);
    out(1, hit ? '否决' : '通过',
      hit ? `Goal 含实施步骤表述 "${hit}"（Goal 只说"什么"，不含"怎么做"）`
          : 'Goal 未出现步骤/实施表述');
  }

  // -- V2 Goal 含交付物形态 + 意图 ------------------------------------
  if (!goal) out(2, '否决', 'Goal 段落缺失或为空');
  else if (!FORM_RE.test(goal) || !INTENT_RE.test(goal)) {
    const missing = [];
    if (!FORM_RE.test(goal)) missing.push('交付物形态（代码/文档/工具/报告等）');
    if (!INTENT_RE.test(goal)) missing.push('意图【留模型：仅动词提示】');
    out(2, '否决', `Goal 缺少：${missing.join('、')}`);
  } else out(2, '通过', 'Goal 含交付物形态 + 意图');

  // -- V3 每条 Acceptance 可观测/可判定/独立来源 ----------------------
  if (items.length === 0) out(3, '否决', 'Acceptance 段落缺失或无条目');
  else {
    const bad = items.filter((it) => SUBJECTIVE_RE.test(it) || TAUTOLOGY_RE.test(it));
    out(3, bad.length ? '否决' : '通过',
      bad.length ? `含有主观词/同义反复的验收 ${bad.map((x) => acceptanceIndex(x, items)).join('、')}（【留模型：独立证据来源判读】）`
                 : '未发现主观词/同义反复（证据来源判读留模型）');
  }

  // -- V4 Acceptance ≥ 3 条 -------------------------------------------
  out(4, items.length >= 3 ? '通过' : '否决', `Acceptance ${items.length} 条（需 ≥ 3 条）`);

  // -- V5 Constraints 只划边界不写步骤 --------------------------------
  if (consBullets.length === 0) out(5, '否决', 'Constraints 段落缺失或无约束条目');
  else {
    const hit = firstMatch(cons, PROCESS_RE);
    out(5, hit ? '否决' : '通过',
      hit ? `Constraints 含过程描述 "${hit}"（约束划边界，不写步骤）` : 'Constraints 未出现过程步骤描述');
  }

  // -- V6 Constraints ≥ 3 且覆盖技术栈+范围+保护性 --------------------
  {
    const joined = consBullets.join('\n');
    const reasons = [];
    if (consBullets.length < 3) reasons.push(`仅 ${consBullets.length} 条（需 ≥ 3 条）`);
    if (!TECH_RE.test(joined)) reasons.push('未检出技术栈类约束【留模型】');
    if (!SCOPE_RE.test(joined)) reasons.push('未检出示范围类约束【留模型】');
    if (!PROTECT_RE.test(joined)) reasons.push('未检出保护性约束【留模型】');
    out(6, reasons.length ? '否决' : '通过', reasons.length ? reasons.join('；') : '约束 ≥ 3 条且覆盖技术栈/范围/保护性');
  }

  // -- V7 无执行计划/拆解步骤混入契约 ----------------------------------
  {
    const hit = firstMatch(goalText, PLAN_RE);
    out(7, hit ? '否决' : '通过',
      hit ? `检出具计划/拆解开销语言 "${hit}"（【留模型：需人工确认确为拆解而非说明】）`
          : '未检出执行计划/拆解语言');
  }

  // -- V8 Budget 有最大轮数 + 时间上限 ---------------------------------
  {
    const reasons = [];
    if (!MAX_ROUND_RE.test(budget)) reasons.push('缺"最大轮数"');
    if (!TIME_LIMIT_RE.test(budget)) reasons.push('缺"时间上限"');
    if (!budget.trim()) reasons.unshift('Budget 段落缺失或为空');
    out(8, reasons.length ? '否决' : '通过', reasons.length ? `Budget ${reasons.join('、')}` : 'Budget 含最大轮数 + 时间上限');
  }

  // -- V9 Pause Conditions 显式声明 -----------------------------------
  {
    const content = pause.trim();
    out(9, !content ? '否决' : '通过',
      !content ? 'Pause Conditions 缺失或为空（留空 = 未思考，须显式声明"无"或列场景）'
               : 'Pause Conditions 已显式声明');
  }

  // -- V10 每条 Acceptance 绑定可执行验证命令 ---------------------------
  if (items.length === 0) out(10, '否决', 'Acceptance 段落缺失或无条目');
  else {
    const missing = items.filter((it) => !VERIFY_RE.test(it));
    const selfEv = items.filter((it) => VERIFY_RE.test(it) && SELF_EVIDENCE_RE.test(it));
    const bad = [];
    if (missing.length) bad.push(`${missing.map((x) => acceptanceIndex(x, items)).join('、')} 无"（验证：…）"绑定`);
    if (selfEv.length) bad.push(`${selfEv.map((x) => acceptanceIndex(x, items)).join('、')} 绑定物是人工确认/AI 自评`);
    out(10, bad.length ? '否决' : '通过', bad.length ? bad.join('；') : '每条 Acceptance 均已绑定（验证：…）且非人工自评');
  }

  return results;
}

/** 返回条目在第 items 中的序号（匹配去空后 1-based）。 */
function acceptanceIndex(item, items) {
  return items.indexOf(item) + 1;
}

// =========================================================================
// init
// =========================================================================

/** 生成 GOAL.md 的编号验收行。 */
export function buildAcceptanceRows(n) {
  return Array.from({ length: n }, (_, i) => `${i + 1}. <可观测、独立判定的断言 #${i + 1}>（验证：\`<可执行命令 #${i + 1}>\`）`).join('\n');
}

/** 生成 PROGRESS.md 的验收进度表行。 */
function buildProgressAcceptanceRows(n) {
  return Array.from({ length: n }, (_, i) => `| ${i + 1} | <验收 #${i + 1}> | \`<命令 #${i + 1}>\` | 待验证 | - |`).join('\n');
}

/** 生成 PROGRESS.md 的切片状态表行；切片编号由 nextSeq 推导（见 sliceNumbers）。 */
function buildSliceRows(slices, nos) {
  if (!slices.length) return '| - | - | - | - | - |';
  return slices.map((slice, i) => `| ${nos[i]} | ${slice} | - | - | - |`).join('\n');
}

/**
 * 切片编号：扫描 .goals 根目录下 "^<N>-" 前缀条目取最大编号 +1，再顺序展开。
 * 机械规则：复用 shared/next-seq.mjs 的 nextSeq；.goals 下无编号条目则从 1 起。
 * @param {string} goalsRoot
 * @param {number} count
 */
export function sliceNumbers(goalsRoot, count) {
  const seed = nextSeq(goalsRoot, { pad: 0 });
  return Array.from({ length: Math.max(count, 0) }, (_, i) => seed + i);
}

const GOAL_TPL = `# Goal

<一句话：交付物形态 + 意图。不含"怎么做"。>

# Acceptance

{{acceptanceRows}}

# Constraints

- <技术栈边界：语言/框架/依赖>
- <范围边界：只做什么/不做什么>
- <保护性约束：禁止某类不可逆操作>

# Budget

- 最大轮数：{{maxRounds}}
- 时间上限：{{timeLimit}}

# Pause Conditions

- 无
`;

const PROGRESS_TPL = `# 执行进度

- 目标名称：{{name}}
- 当前轮数：{{round}}
- 状态：{{state}}

## 每轮必读（执行任何动作前先读完本块）

- 我在跑目标循环，目标名称：{{name}}
- 当前轮数：{{round}} / 预算上限：{{maxRounds}}
- 当前切片：待拆解
- 本轮结束必须：跑验证命令 → 更新本文件（轮数 + 切片状态 + 循环日志）→ 对照 GOAL.md Acceptance 检查是否全部通过
- 禁止用"我觉得完成了"作为证据——每条验收的通过证据必须来自其绑定验证命令的实际运行输出
- 凭记忆续跑 = 违规：状态以本文件为准，不以对话记忆为准

## 固化日志

| 门   | 自检结果 | 独立检查结果 | 修正说明 |
| ---- | -------- | ------------ | -------- |
| V1   |          |              |          |
| V2   |          |              |          |
| V3   |          |              |          |
| V4   |          |              |          |
| V5   |          |              |          |
| V6   |          |              |          |
| V7   |          |              |          |
| V8   |          |              |          |
| V9   |          |              |          |
| V10  |          |              |          |

## 验收进度

| # | 验收条件 | 验证命令 | 状态 | 证据 |
| - | -------- | -------- | ---- | ---- |
{{acceptanceRows}}

## 切片状态

| # | 切片 | 状态 | 验证结果 | 备注 |
| - | ---- | ---- | -------- | ---- |
{{sliceRows}}

## 循环日志

## 阻塞项

- 无
`;

/** scaffold 一个目标；写 GOAL.md → PROGRESS.md → _index.md（写入序列，冲突即返回错误不落盘）。 */
export function runInit(root, opts) {
  const name = opts.name;
  if (!name) return { error: '用法: goal.mjs init --name <name> [--root <dir>] [--slices a,b,c] [--acceptances N] [--max-rounds N] [--time-limit TX]' };
  if (!NAME_RE.test(name)) return { error: `非法 name: ${name}（须匹配 ^[a-z0-9]+(-[a-z0-9]+)*$）` };

  const goalsRoot = path.join(root, '.goals');
  const goalDir = path.join(goalsRoot, name);
  if (fs.existsSync(goalDir)) return { error: `目标已存在: ${goalDir}` };

  const acceptances = Number(opts.acceptances ?? 3);
  const maxRounds = opts.maxRounds ?? 5;
  const timeLimit = opts.timeLimit ?? '2h';
  const slices = String(opts.slices ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const nos = sliceNumbers(goalsRoot, slices.length);
  const date = today();

  const vars = {
    name,
    round: 0,
    state: '契约中',
    maxRounds,
    timeLimit,
    acceptanceRows: buildAcceptanceRows(acceptances),
  };

  // 写入 1：GOAL.md
  const goalFile = path.join(goalDir, 'GOAL.md');
  writeFileSafe(goalFile, renderTemplate(GOAL_TPL, vars));
  // 写入 2：PROGRESS.md
  const progressFile = path.join(goalDir, 'PROGRESS.md');
  writeFileSafe(progressFile, renderTemplate(PROGRESS_TPL, {
    ...vars,
    acceptanceRows: buildProgressAcceptanceRows(acceptances),
    sliceRows: buildSliceRows(slices, nos),
  }));
  // 写入 3：_index.md（存在则追加行）
  const indexFile = upsertIndex(goalsRoot, name, date);

  return { ok: true, files: [goalFile, progressFile, indexFile], sliceNos: nos };
}

/** 更新/创建 _index.md，记录目标状态=契约中。返回索引文件路径。 */
function upsertIndex(goalsRoot, name, date) {
  const idx = path.join(goalsRoot, '_index.md');
  const row = `| ${name} | 契约中 | ${date} | ${date} |`;
  let content;
  if (fs.existsSync(idx)) {
    content = fs.readFileSync(idx, 'utf-8');
    if (!content.includes(`| ${name} |`)) content = content.replace(/\s*$/, '\n') + row + '\n';
  } else {
    content = `# 目标索引\n\n| 名称      | 状态   | 创建时间   | 最后更新   |\n| --------- | ------ | ---------- | ---------- |\n${row}\n`;
  }
  writeFileSafe(idx, content);
  return idx;
}

// =========================================================================
// progress-update
// =========================================================================

const SLICE_EMOJI = { pass: '✅', fail: '❌', doing: '🔄', clear: '-' };

/**
 * 更新 PROGRESS.md：轮数自增（或 --set-round 指定）、切片状态、循环日志追加、状态→执行中。
 * 修改后内容返回，未落盘（由调用方判断是否写回）。
 * @param {string} text
 * @param {{setRound?:number, slice?:{num:number,status:string,verify?:string}, log?:string}} upd
 */
export function updateProgress(text, upd) {
  const cur = Number(text.match(/^- 当前轮数：(\d+)/m)?.[1] ?? 0);
  const round = upd.setRound ?? cur + 1;
  let out = text;
  // 顶部/每轮必读 轮数 + 状态→执行中
  out = out.replace(/^- 当前轮数：\d+/m, `- 当前轮数：${round}`);
  out = out.replace(/^(- 当前轮数：)\d+(?= \/ 预算上限)/m, `$1${round}`);
  out = out.replace(/^(- 状态：).+$/m, `$1执行中`);
  if (upd.slice) out = replaceSliceRow(out, upd.slice);
  if (upd.log) out = appendLoopLog(out, round, upd.log);
  return out;
}

/** 机械替换"切片状态"表中某编号行的状态/验证结果列；按段剖限作用域，避免误改"验收进度"表。 */
function replaceSliceRow(text, { num, status, verify }) {
  const emoji = SLICE_EMOJI[status] ?? null;
  if (emoji === null) return text;
  const lines = text.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === '## 切片状态');
  return lines.map((l, i) => {
    if (startIdx === -1 || i <= startIdx) return l; // 只处理切片状态段后的行
    if (!/^\|\s*\d/.test(l)) return l;
    const cols = l.split('|');
    if (cols.length >= 5 && cols[1].trim() === String(num)) {
      cols[3] = ` ${emoji} `;
      if (verify != null) cols[4] = ` ${verify} `;
      return cols.join('|');
    }
    return l;
  }).join('\n');
}

/** 在 ## 循环日志 段顶部追加一条 `- **轮 N**：...`。 */
function appendLoopLog(text, round, log) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => l.trim() === '## 循环日志');
  if (idx === -1) return text;
  lines.splice(idx + 1, 0, `- **轮 ${round}**：${log}`);
  return lines.join('\n');
}

/** 读取 dir/PROGRESS.md（缺失抛错由调用方捕获）。 */
function readRequired(dir, file) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) throw new Error(`缺少 ${file}：${p}`);
  return fs.readFileSync(p, 'utf-8');
}

// =========================================================================
// evidence
// =========================================================================

/** 从 Acceptance 条目提取"（验证：...）"中的命令；无绑定返回 null。 */
export function boundCommand(item) {
  const i = item.indexOf('（验证：');
  if (i === -1) return null;
  let s = item.slice(i + 4);
  const close = s.indexOf('）');
  if (close !== -1) s = s.slice(0, close);
  return s.replace(/[`]/g, '').trim() || null;
}

/**
 * 生成 EVIDENCE.md 对照表内容：验收项 → 验证命令 → 命令输出摘录 → 通过/未通过。
 * 机械映射：status 'pass' → 通过，'fail' → 未通过。
 * @param {Array<{num:number,text:string,command:string|null}>} accepted
 * @param {Record<number,{status:'pass'|'fail',output?:string}>} marks
 */
export function buildEvidence(accepted, marks) {
  const head = ['# 验收对照表', '', '| # | 验收项 | 验证命令 | 命令输出摘录 | 结果 |', '| - | ------ | -------- | ------------ | ---- |'];
  const rows = accepted.map((a) => {
    const m = marks[a.num];
    const result = !m ? '未验证' : m.status === 'pass' ? '通过' : '未通过';
    return `| ${a.num} | ${a.text} | ${a.command ?? '-'} | ${m?.output ?? '-'} | ${result} |`;
  });
  return head.concat(rows).join('\n') + '\n';
}

/** 解析 GOAL.md 获取验收条目（含命令绑定）。 */
export function parseAcceptance(goalText) {
  const s = parseSections(goalText);
  return acceptanceItems(s['Acceptance'] ?? '').map((text, i) => ({
    num: i + 1,
    text: text.trim(),
    command: boundCommand(text),
  }));
}

// =========================================================================
// review-write
// =========================================================================

const D_LABEL = { D1: '覆盖完整性', D2: '可行性', D3: '约束一致性', D4: '审计就绪性', D5: '可恢复性' };
const MARK = { pass: '✅', suggest: '⚠️', reject: '❌' };

/**
 * 综合判定映射（机械规则）：
 *  全部 ✅ → 准奏；有 ⚠️ 无 ❌ → 附条件准奏；有 ❌ → 封驳。
 * @param {Record<string,'pass'|'suggest'|'reject'>} d
 */
export function verdict(d) {
  const vals = Object.values(d);
  if (vals.every((v) => v === 'pass')) return { code: 'approve', label: '准奏', emoji: '✅', blocked: false };
  if (!vals.includes('reject')) return { code: 'conditional', label: '附条件准奏', emoji: '⚠️', blocked: false };
  return { code: 'reject', label: '封驳', emoji: '❌', blocked: true };
}

/** 渲染 REVIEW.md 内容。 */
export function buildReview({ d1 = 'pass', d2 = 'pass', d3 = 'pass', d4 = 'pass', d5 = 'pass', notes = {}, date }) {
  const d = { D1: d1, D2: d2, D3: d3, D4: d4, D5: d5 };
  const v = verdict(d);
  const lines = [
    '# 语义审查记录',
    '',
    `- 审查时间：${date}`,
    `- 审查结果：${v.label}`,
    ...Object.keys(D_LABEL).map((k) => `- ${k} ${D_LABEL[k]}：${MARK[d[k]]}${notes[k] ? ' ' + notes[k] : ''}`),
    `- 综合判定：${v.label}`,
    '',
  ];
  return lines.join('\n');
}

// =========================================================================
// 工具
// =========================================================================

function today() {
  return new Date().toISOString().slice(0, 10);
}

function resolveGoalDir(opts, root) {
  if (opts.goalDir) return path.resolve(opts.goalDir);
  if (opts.name) return path.resolve(root, '.goals', opts.name);
  return null;
}

// =========================================================================
// CLI
// =========================================================================

function usage() {
  return `用法: goal.mjs <子命令> [选项]

子命令：
  gate <goalFile>            对 GOAL.md 契约做 V1–V10 否决门校验，逐门输出通过/否决+原因
  init                       在 .goals/<name>/ 脚手架 GOAL.md / PROGRESS.md / _index.md
  progress-update            更新 PROGRESS.md（轮数自增 + 切片状态 + 循环日志）
  evidence                   把验收通过/失败写入 EVIDENCE.md 对照表
  review-write               写 REVIEW.md + D1–D5 状态汇总 + 判定映射（准奏/附条件/封驳）

init 选项：
  --name <name>      目标名（kebab-case，必填）
  --root <dir>       工作区根（默认当前目录，.goals 位于其下）
  --slices a,b,c     初始切片列表（编号由 nextSeq 推导）
  --acceptances N    验收条目数（默认 3）
  --max-rounds N     Budget 最大轮数（默认 5）
  --time-limit TX    Budget 时间上限（默认 2h）

通用选项：
  --root <dir>       工作区根（.goals 所在顶层目录）
  --goal-dir <dir>   指向 .goals/<name>/（优先于 --root+--name）
  --name <name>      与 --root 组合推导目标目录

progress-update 选项：
  --set-round N      指定轮数（缺省为当前轮数 +1）
  --slice num:st     更新切片状态；st ∈ pass|fail|doing|clear
  --verify <text>    切片验证结果（写入"验证结果"列）
  --log <text>       追加循环日志条（- **轮 N**：text）

evidence 选项：
  --set num:pass|fail  标记某验收通过/未通过（可重复）
  --output <text>      命令输出摘录（最近一次生效）

review-write 选项：
  --d1..--d5 pass|suggest|reject   各维度结果（默认 pass）
  --d1-note..--d5-note <text>      各维度说明

  -h, --help          显示本帮助`;
}

function parseArgs(argv) {
  const opts = { set: [], slice: [] };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--root') opts.root = val();
    else if (a === '--name') opts.name = val();
    else if (a === '--slices') opts.slices = val();
    else if (a === '--acceptances') opts.acceptances = val();
    else if (a === '--max-rounds') opts.maxRounds = val();
    else if (a === '--time-limit') opts.timeLimit = val();
    else if (a === '--goal-dir') opts.goalDir = val();
    else if (a === '--set-round') opts.setRound = Number(val());
    else if (a === '--slice') opts.slice.push(val());
    else if (a === '--verify') opts.verify = val();
    else if (a === '--log') opts.log = val();
    else if (a === '--set') opts.set.push(val());
    else if (a === '--output') opts.output = val();
    else if (a === '--d1') opts.d1 = val();
    else if (a === '--d2') opts.d2 = val();
    else if (a === '--d3') opts.d3 = val();
    else if (a === '--d4') opts.d4 = val();
    else if (a === '--d5') opts.d5 = val();
    else if (a === '--d1-note') opts.n1 = val();
    else if (a === '--d2-note') opts.n2 = val();
    else if (a === '--d3-note') opts.n3 = val();
    else if (a === '--d4-note') opts.n4 = val();
    else if (a === '--d5-note') opts.n5 = val();
    else if (a.startsWith('-')) { opts.error = `未知选项: ${a}`; }
    else positional.push(a);
  }
  opts.positional = positional;
  opts.cmd = positional[0];
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(usage()); return 0; }
  if (opts.error) { console.error(`错误: ${opts.error}\n\n${usage()}`); return 2; }

  const cmd = opts.cmd;
  const known = ['gate', 'init', 'progress-update', 'evidence', 'review-write'];
  if (!cmd) { console.error(`错误: 缺少子命令。可用: ${known.join(' | ')}\n\n${usage()}`); return 2; }
  if (!known.includes(cmd)) { console.error(`错误: 未知子命令 "${cmd}"\n\n${usage()}`); return 2; }

  const root = opts.root ? path.resolve(opts.root) : process.cwd();

  try {
    if (cmd === 'gate') {
      const file = opts.positional[1] || opts.goalFile;
      if (!file) { console.error('错误: gate 需要 <goalFile> 参数'); return 2; }
      const text = fs.readFileSync(path.resolve(file), 'utf-8');
      const res = checkGates(text);
      const rejected = res.filter((r) => r.status === '否决');
      for (const r of res) console.log(`${r.gate >= 10 ? '' : ' '}V${r.gate}  ${r.status}  ${r.reason}`);
      console.log(rejected.length ? `\n${rejected.length}/10 门否决（不可写入契约）` : '\n否决门全部通过（可写入契约）');
      return rejected.length ? 1 : 0;
    }

    if (cmd === 'init') {
      const r = runInit(root, opts);
      if (r.error) { console.error(`错误: ${r.error}`); return 2; }
      for (const f of r.files) console.log(`创建 ${f}`);
      console.log(`切片编号: ${r.sliceNos.length ? r.sliceNos.join(', ') : '（无）'}`);
      return 0;
    }

    if (cmd === 'progress-update') {
      const dir = resolveGoalDir(opts, root);
      if (!dir) { console.error('错误: 需要 --goal-dir 或 --root+--name'); return 2; }
      const progressFile = path.join(dir, 'PROGRESS.md');
      if (!fs.existsSync(progressFile)) { console.error(`错误: 缺少 ${progressFile}`); return 2; }
      let text = fs.readFileSync(progressFile, 'utf-8');

      const slices = opts.slice.map((s) => {
        const [num, status] = s.split(':');
        return { num: Number(num), status, verify: opts.verify };
      });

      // 轮数一次性计算（--set-round 或默认当前+1），后续所有变更共用同一轮数，避免重复自增。
      const round = opts.setRound ?? (Number(text.match(/^- 当前轮数：(\d+)/m)?.[1] ?? 0) + 1);
      for (const sc of slices) text = updateProgress(text, { setRound: round, slice: sc });
      if (opts.log) text = updateProgress(text, { setRound: round, log: opts.log });
      if (!slices.length && !opts.log) text = updateProgress(text, { setRound: round });
      writeFileSafe(progressFile, text);
      console.log(`更新 ${progressFile}`);
      return 0;
    }

    if (cmd === 'evidence') {
      const dir = resolveGoalDir(opts, root);
      if (!dir) { console.error('错误: 需要 --goal-dir 或 --root+--name'); return 2; }
      const goalFile = path.join(dir, 'GOAL.md');
      if (!fs.existsSync(goalFile)) { console.error(`错误: 缺少 ${goalFile}（先运行 goal.mjs init）`); return 2; }
      const accepted = parseAcceptance(fs.readFileSync(goalFile, 'utf-8'));
      if (!opts.set.length) { console.error('错误: evidence 需要至少一个 --set num:pass|fail'); return 2; }

      const marks = {};
      let output = opts.output ?? '-';
      for (const s of opts.set) {
        const [num, status] = s.split(':');
        if (status !== 'pass' && status !== 'fail') { console.error(`错误: 非法状态 "${status}"（仅 pass|fail）`); return 2; }
        marks[Number(num)] = { status, output };
        output = '-' ; // 仅最近一条带 --output
      }
      // 标记 num 需存在于已解析验收范围
      for (const k of Object.keys(marks)) {
        if (!accepted.some((a) => a.num === Number(k))) { console.error(`错误: 验收编号 ${k} 不存在（共 ${accepted.length} 条）`); return 2; }
      }
      const outFile = path.join(dir, 'EVIDENCE.md');
      writeFileSafe(outFile, buildEvidence(accepted, marks));
      console.log(`写入 ${outFile}`);
      return 0;
    }

    if (cmd === 'review-write') {
      const dir = resolveGoalDir(opts, root);
      if (!dir) { console.error('错误: 需要 --goal-dir 或 --root+--name'); return 2; }
      const results = { d1: opts.d1 ?? 'pass', d2: opts.d2 ?? 'pass', d3: opts.d3 ?? 'pass', d4: opts.d4 ?? 'pass', d5: opts.d5 ?? 'pass' };
      for (const [k, v] of Object.entries(results)) {
        if (!['pass', 'suggest', 'reject'].includes(v)) { console.error(`错误: ${k} 非法值 "${v}"（仅 pass|suggest|reject）`); return 2; }
      }
      const notes = {};
      const noteVals = { D1: opts.n1, D2: opts.n2, D3: opts.n3, D4: opts.n4, D5: opts.n5 };
      for (const [k, v] of Object.entries(noteVals)) if (v) notes[k] = v;

      const content = buildReview({ ...results, notes, date: today() });
      const v = verdict({ D1: results.d1, D2: results.d2, D3: results.d3, D4: results.d4, D5: results.d5 });
      const outFile = path.join(dir, 'REVIEW.md');
      writeFileSafe(outFile, content);
      console.log(`写入 ${outFile}`);
      console.log(`综合判定：${v.label}${v.blocked ? '（封驳——打回 goal-contract 修正）' : ''}`);
      return v.blocked ? 1 : 0;
    }
  } catch (e) {
    console.error(`错误: ${e.message}`);
    return 2;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main());
}