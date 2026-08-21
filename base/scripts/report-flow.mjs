#!/usr/bin/env node
// report-flow.mjs — 工单06 剩余"报告渲染/模板实例化/impeccable 提取类"技能的确定性流程 CLI。
// 覆盖确定性规则；判读类（方向推导、主观评审、style guide 措辞、候选取舍）留模型不脚本化。
//
// 子命令：
//   report-html        结构化候选数组(name/issue/verdict/detail) → 自包含 HTML(复用 shared/report-html)，可写临时目录+打开

//   agent-init         组装 agent frontmatter(name/description/tools/身份)，命名正则校验，落盘 <name>.md
//   research-file      {前缀}-{slug}-{版本} 文件名分配 + 模板骨架实例化 + 冲突加序号(复用 nextSeq/instantiateTemplate)
//   impeccable-extract 从文档提取 token 引用展开，机械告警(缺失引用/非法组件子属性/非法顶层组)
//   impeccable-audit   5 维 0-4 计分 → /20 评级带(WCAG 对比度/严重度排序为可判定的机械计分)
//
// 零第三方依赖，仅 Node 内建模块 + base/scripts/shared 相对 import。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderTemplate } from './shared/render-template.mjs';
import { instantiateTemplate } from './shared/render-template.mjs';
import { writeFileSafe } from './shared/fs-utils.mjs';
import { nextSeq } from './shared/next-seq.mjs';
import { renderReportHtml, writeReport, writeTempReport } from './shared/report-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


// ================================================================ report-html
// 结构化候选 → 自包含 HTML。确定性格：字段白名单与渲染结构；判读(content/推荐强度)留模型。

/** 白名单抽取候选字段，保证 renderReportHtml 拿到稳定结构。 */
export function normalizeCards(cards) {
  return (cards || []).map((c) => ({
    name: c && typeof c === 'object' ? String(c.name ?? '') : '',
    issue: c && typeof c === 'object' ? c.issue : undefined,
    verdict: c && typeof c === 'object' ? c.verdict : undefined,
    detail: c && typeof c === 'object' ? c.detail : undefined,
  }));
}

/** 候选数组 → 自包含 HTML 报告（复用 shared/report-html.renderReportHtml）。 */
export function renderCandidatesHtml(cards, title = '架构审查') {
  return renderReportHtml({ title, cards: normalizeCards(cards) });
}

/**
 * report-html 落盘。
 * @param {{cards:Array, title?:string, outDir?:string, filename?:string,
 *          temp?:boolean, prefix?:string, open?:boolean, spawnFn?:Function}} args
 *   temp=true → 写系统临时目录（可在浏览器打开）；否则写 outDir/filename。
 * @returns {string} 落盘路径
 */
export function runReportHtml({ cards, title = '架构审查', outDir, filename = 'report.html', temp = false, prefix = 'architecture-review', open = false, spawnFn, dryRun = false }) {
  const norm = normalizeCards(cards);
  if (dryRun) {
    // 预演：返回"将写"的路径与内容，但不落盘、不拉起浏览器
    return temp ? path.join(os.tmpdir(), `${prefix}-${Date.now()}.html`) : path.join(outDir, filename);
  }
  if (temp) return writeTempReport({ title, cards: norm, prefix, open, spawnFn });
  if (!outDir) throw new Error('report-html 需 --out <dir>（非临时模式）');
  return writeReport({ outDir, filename, title, cards: norm });
}

/** 把 `---\nMETA\n---BODY…` 拆成 { meta(不含界定符), body(界定符之后内容) }。 */
export function splitFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { meta: '', body: content, hasFrontmatter: false };
  return { meta: m[1], body: content.slice(m[0].length), hasFrontmatter: true };
}

// ================================================================ agent-generator
// frontmatter 组装 + 命名正则校验 + 落盘。确定性格：命名格式、字段默认值、范式统一开头；正文写作留模型。

/** 姜姓 agent 命名：`姜<两字>-<官署+职官>`。 */
export const AGENT_NAME_RE = /^姜[\u4e00-\u9fff]{2}-[\u4e00-\u9fff]+$/;

export const DEFAULT_TOOLS = 'list_dir, search_file, search_content, read_file, read_lints, replace_in_file, write_to_file, execute_command, delete_file, lsp, task';

/** 命名正则校验。 */
export function validateAgentName(name) {
  return AGENT_NAME_RE.test(String(name ?? ''));
}

/**
 * 组装 agent frontmatter（references/frontmatter.md 规范）。
 * @returns {string} `---` 界定符包裹的 frontmatter 块（不含正文）。
 */
export function buildAgentFrontmatter({ name, description, tools, agentMode = 'agentic', enabled = true, enabledAutoRun = false }) {
  const toolsStr = Array.isArray(tools) && tools.length ? tools.join(', ') : (tools || DEFAULT_TOOLS);
  return [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    `tools: ${toolsStr}`,
    `agentMode: ${agentMode}`,
    `enabled: ${enabled ? 'true' : 'false'}`,
    `enabledAutoRun: ${enabledAutoRun ? 'true' : 'false'}`,
    '---',
  ].join('\n');
}

/**
 * agent-init：校验命名并落盘 <name>.md（含范式统一开头）。
 * @returns {{file:string} | {error:string}}
 */
export function runAgentInit({ name, description, outDir, tools, dryRun = false }) {
  const n = String(name ?? '');
  if (!validateAgentName(n)) {
    return { error: `非法 name: "${n}"（须匹配 ${AGENT_NAME_RE}）` };
  }
  if (!description) return { error: 'description 为空（须含 职责 + 扮演角色 + 触发词）' };
  const file = path.join(outDir, `${n}.md`);
  // 预演时不查已存在、不写盘（只评估校验与目标路径）
  if (fs.existsSync(file)) {
    if (dryRun) return { file };
    return { error: `文件已存在（不覆盖）: ${file}` };
  }
  const role = n.split('-').slice(1).join('-');
  const body = `\n你是超级AI助理${n}，正在扮演${role}\n`;
  const content = `${buildAgentFrontmatter({ name: n, description, tools })}\n${body}`;
  if (!dryRun) writeFileSafe(file, content);
  return { file };
}

// ================================================================ research 严格模式
// {前缀}-{slug}-{版本} 文件名分配 + 模板骨架实例化 + 冲突加序号（复用 instantiateTemplate conflictBump）。

/** 生成严格模式报告文件名：`{前缀}-{slug}.md`；给 version 则 `{前缀}-{slug}-{version}.md`。 */
export function researchFileName(prefix, slug, version) {
  const base = `${prefix}-${slug}`;
  return version !== undefined && version !== null && version !== '' ? `${base}-${version}.md` : `${base}.md`;
}

/** 严格模式通用模板骨架（research 报告各模板的共用前缀+标题）。 */
export const RESEARCH_SKELETON = [
  '# {{title}}',
  '',
  '> 调研主题：{{slug}}（{{prefix}} 模板）',
  '',
  '## 摘要',
  '',
  '## 背景与问题',
  '',
  '## 关键发现',
  '',
  '## 建议',
  '',
  '## 参考来源',
  '',
].join('\n');

/**
 * research-file：分配到 docs/report 文件名，实例化模板写入；冲突自动加序号（不覆盖）。
 * @returns {{file:string}} 实际落盘路径
 */
export function runResearchFile({ prefix, slug, version, outDir, template, vars, dryRun = false }) {
  const filename = researchFileName(prefix, slug, version);
  const outFile = path.join(outDir, filename);
  const tpl = template ?? RESEARCH_SKELETON;
  const rendered = renderTemplate(tpl, { prefix, slug, version: version ?? '', title: `${prefix} ${slug}`, ...vars });
  if (dryRun) return { file: outFile };
  const file = instantiateTemplate({ template: rendered, outFile, conflictBump: version !== undefined && version !== null && version !== '' ? false : true });
  return { file };
}

// ================================================================ impeccable extract
// document/extract 的机械提取：{a.b.c} token 引用展开、非法组件子属性、非法顶层组。判读（对色名、north star）留模型。

/** 成组 token 引用模板：`{path.to.token}`。 */
export const TOKEN_REF_RE = /\{([\w.-]+)\}/g;

/** 组件子 token 允许的 8 属性（document.md schema）。 */
export const COMPONENT_PROPS = new Set(['backgroundColor', 'textColor', 'typography', 'rounded', 'padding', 'size', 'height', 'width']);

/** 顶层允许的 YAML 组（name/description + schema 五组）。 */
export const FRONTMATTER_GROUPS = new Set(['name', 'description', 'colors', 'typography', 'rounded', 'spacing', 'components']);

function parseFmScalar(v) {
  v = v.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"');
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

/** 极简缩进 YAML 映射解析（report-flow 的 frontmatter 为扁平映射，够用）。 */
function parseFmYaml(text) {
  const lines = String(text).split(/\r?\n/)
    .map((raw) => ({ indent: raw.match(/^ */)[0].length, text: raw.trim() }))
    .filter((l) => l.text !== '' && !l.text.startsWith('#'));
  function parseBlock(start, indent) {
    const out = {};
    let i = start;
    while (i < lines.length && lines[i].indent >= indent) {
      const line = lines[i];
      const m = line.text.match(/^([\w.-]+)\s*:\s*(.*)$/);
      if (!m) { i++; continue; }
      const key = m[1];
      const value = m[2];
      if (value === '') {
        const ni = i + 1 < lines.length ? lines[i + 1].indent : indent;
        if (i + 1 < lines.length && ni > indent && /^[\w.-]+:/.test(lines[i + 1].text)) {
          const [child, next] = parseBlock(i + 1, ni);
          out[key] = child;
          i = next;
        } else { out[key] = null; i++; }
      } else { out[key] = parseFmScalar(value); i++; }
    }
    return [out, i];
  }
  if (!lines.length) return {};
  return parseBlock(0, lines[0].indent)[0];
}

/** 沿点路径在 token 树取值；缺失返回 undefined。 */
export function lookupToken(tokens, ref) {
  const parts = String(ref).split('.');
  let cur = tokens;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, p)) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** 把文本中全部 {a.b.c} 引用按 token 树展开；缺失保留原样。 */
export function expandTokenRefs(text, tokens) {
  const refs = [];
  const expanded = String(text).replace(TOKEN_REF_RE, (m, ref) => {
    const v = lookupToken(tokens, ref);
    refs.push({ ref, resolved: v !== undefined });
    return v !== undefined ? String(v) : m;
  });
  return { text: expanded, refs };
}

/** 标记组件定义里不在 schema 8 属性内的子属性。 */
export function invalidComponentProps(tokens) {
  const comps = tokens && tokens.components;
  if (!comps || typeof comps !== 'object') return [];
  const bad = [];
  for (const [name, def] of Object.entries(comps)) {
    if (def && typeof def === 'object') {
      for (const prop of Object.keys(def)) {
        if (!COMPONENT_PROPS.has(prop)) bad.push({ component: name, prop });
      }
    }
  }
  return bad;
}

/** 标记 frontmatter 顶层不在 schema 内的组（motion/breakpoints/shadows 等）。 */
export function invalidFrontmatterGroups(meta) {
  return Object.keys(meta || {}).filter((k) => !FRONTMATTER_GROUPS.has(k));
}

/**
 * impeccable-extract：读文档，提取 {a.b.c} 展开并机械告警。
 * @param {{content:string}} args
 * @returns {{expanded:string, missingRefs:string[], invalidProps:Array, invalidGroups:string[]}}
 */
export function runImpeccableExtract({ content }) {
  const { meta: fm, body } = splitFrontmatter(content);
  const tokens = fm ? parseFmYaml(fm) : {};
  const { text: expanded, refs } = expandTokenRefs(body, tokens);
  const missingRefs = refs.filter((r) => !r.resolved).map((r) => r.ref);
  return {
    expanded,
    missingRefs,
    invalidProps: invalidComponentProps(tokens),
    invalidGroups: invalidFrontmatterGroups(tokens),
  };
}

// ================================================================ impeccable audit
// 机械可判定的计分：5 维 0-4 累加 → /20 评级带；WCAG 对比度；P0-P3 严重度排序。判读（各维打分理由、报告措辞）留模型。

/** audit.md 评级带。 */
export function bandFor(total) {
  if (total >= 18) return 'Excellent';
  if (total >= 14) return 'Good';
  if (total >= 10) return 'Acceptable';
  if (total >= 6) return 'Poor';
  return 'Critical';
}

/** 5 维 0-4 计分 → { total, band }（audit report 的 /20 健康总分）。 */
export function rateAudit(scores) {
  const total = (scores || []).reduce((a, b) => a + Number(b || 0), 0);
  return { total, band: bandFor(total) };
}

/** 十六进制颜色 → {r,g,b}；非法返回 null。 */
export function hexToRgb(hex) {
  let h = String(hex ?? '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relLum(ch) {
  const s = ch / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 相对亮度对比率（fg/bg 为 hex）。非法输入返回 null。 */
export function contrastRatio(fg, bg) {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return null;
  const la = 0.2126 * relLum(a.r) + 0.7152 * relLum(a.g) + 0.0722 * relLum(a.b);
  const lb = 0.2126 * relLum(b.r) + 0.7152 * relLum(b.g) + 0.0722 * relLum(b.b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** 文本对比度是否达到 WCAG AA（>=4.5:1）。 */
export function meetsWcagAA(fg, bg) {
  const r = contrastRatio(fg, bg);
  return r !== null && r >= 4.5;
}

const SEVERITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

/** P0-P3 严重度秩；未知兜底末尾。 */
export function severityRank(s) {
  return Object.prototype.hasOwnProperty.call(SEVERITY_ORDER, s) ? SEVERITY_ORDER[s] : 99;
}

/** findings 按严重度升序（P0 最紧急在前），保持稳定。 */
export function sortFindings(findings) {
  return [...(findings || [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

/**
 * impeccable-audit：计分评级 + 严重度排序。
 * @param {{scores:number[], findings?:Array}} args
 * @returns {{rating:{total:number, band:string}, findings:Array}}
 */
export function runImpeccableAudit({ scores, findings }) {
  return { rating: rateAudit(scores), findings: sortFindings(findings) };
}

// ================================================================ CLI

function usage() {
  return `用法: report-flow.mjs <子命令> [选项]

子命令：
  report-html          结构化候选数组 → 自包含 HTML（可写临时目录+打开）
  agent-init           组装 frontmatter + 命名校验 → <name>.md
  research-file        {前缀}-{slug}-{版本} 文件名分配 + 模板实例化 + 冲突加序号
  impeccable-extract   提取 {a.b.c} token 展开 + 机械告警
  impeccable-audit     5 维 0-4 计分 → /20 评级带 + 严重度排序

选项：
  --cards <json>       report-html：候选数组 JSON（[{name,issue,verdict,detail}]）
  --title <text>       标题
  --out <dir>          输出目录
  --filename <name>    输出文件名（默认 report.html）
  --temp               report-html 写系统临时目录（自动打开）
  --open               写入后打开
  --name <name>        agent-init：姜姓 agent 名（姜<两字>-<官署职官>）
  --description <text> agent-init：description 一句话
  --tools <list>       agent-init：逗号分隔 tools（缺省用默认集）
  --prefix <prefix>    research-file：模板前缀 tech/progress/analysis/general
  --slug <slug>        research-file：主题 slug
  --version <ver>      research-file：版本号（缺省由冲突加序号）
  --file <path>        impeccable-extract：读文档文件
  --scores <list>      impeccable-audit：5 维 0-4 逗号分隔（如 4,4,3,3,4）
  --json <path>        impeccable-audit：findings JSON（[{severity,name,…}]）
  --dry-run            计算与打印但不落盘
  -h, --help           显示本帮助`;
}

function parseArgs(argv) {
  const opts = { temp: false, open: false, dryRun: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--dry-run': opts.dryRun = true; break;
      case '--temp': opts.temp = true; break;
      case '--open': opts.open = true; break;
      case '--cards': opts.cards = argv[++i]; break;
      case '--title': opts.title = argv[++i]; break;
      case '--out': opts.out = argv[++i]; break;
      case '--outDir': opts.outDir = argv[++i]; break;
      case '--filename': opts.filename = argv[++i]; break;
      case '--name': opts.name = argv[++i]; break;
      case '--description': opts.description = argv[++i]; break;
      case '--tools': opts.tools = argv[++i]; break;
      case '--prefix': opts.prefix = argv[++i]; break;
      case '--slug': opts.slug = argv[++i]; break;
      case '--version': opts.version = argv[++i]; break;
      case '--file': opts.file = argv[++i]; break;
      case '--scores': opts.scores = argv[++i]; break;
      case '--json': opts.json = argv[++i]; break;
      case '-h': case '--help': opts.help = true; break;
      default:
        if (a.startsWith('-')) opts.error = `未知选项: ${a}`;
        else positional.push(a);
    }
  }
  opts.cmd = positional[0] || '';
  return opts;
}

function logErr(msg) { console.error(`错误: ${msg}`); }

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmds = new Set(['report-html', 'agent-init', 'research-file', 'impeccable-extract', 'impeccable-audit']);
  if (opts.help) { console.log(usage()); return 0; }
  if (opts.error) { logErr(opts.error + `\n\n${usage()}`); return 2; }
  if (!cmds.has(opts.cmd)) { logErr(`未知子命令 "${opts.cmd}"\n\n${usage()}`); return 2; }

  const outDir = opts.out || opts.outDir;
  const dry = opts.dryRun ? ' [dry-run]' : '';

  try {
    if (opts.cmd === 'report-html') {
      const cards = opts.cards ? JSON.parse(opts.cards) : (await readStdinJson()) || [];
      const file = runReportHtml({ cards, title: opts.title || '架构审查', temp: opts.temp, outDir, filename: opts.filename || 'report.html', prefix: 'architecture-review', open: opts.open, dryRun: opts.dryRun });
      console.log(opts.temp ? `报告已写入临时目录: ${file}${dry}` : `报告已写入: ${file}${dry}`);
      return 0;
    }


    if (opts.cmd === 'agent-init') {
      if (!outDir) { logErr('agent-init 需 --out <dir>'); return 2; }
      const r = runAgentInit({ name: opts.name, description: opts.description, outDir, tools: opts.tools, dryRun: opts.dryRun });
      if (r.error) { logErr(r.error); return 2; }
      console.log(`已创建 ${r.file}${dry}`);
      return 0;
    }

    if (opts.cmd === 'research-file') {
      if (!opts.prefix || !opts.slug) { logErr('research-file 需 --prefix <前缀> --slug <slug>'); return 2; }
      if (!outDir) { logErr('research-file 需 --out <dir>（docs/report）'); return 2; }
      const r = runResearchFile({ prefix: opts.prefix, slug: opts.slug, version: opts.version, outDir, dryRun: opts.dryRun });
      console.log(`报告已生成: ${r.file}${dry}`);
      return 0;
    }

    if (opts.cmd === 'impeccable-extract') {
      if (!opts.file) { logErr('impeccable-extract 需 --file <path>'); return 2; }
      const content = fs.readFileSync(path.resolve(opts.file), 'utf-8');
      const r = runImpeccableExtract({ content });
      console.log(r.expanded);
      console.log(`\n[extract]`);
      console.log(`缺失引用: ${r.missingRefs.length ? r.missingRefs.join(', ') : '（无）'}`);
      console.log(`非法组件子属性: ${r.invalidProps.length ? r.invalidProps.map((p) => `${p.component}.${p.prop}`).join(', ') : '（无）'}`);
      console.log(`非法顶层组: ${r.invalidGroups.length ? r.invalidGroups.join(', ') : '（无）'}`);
      return 0;
    }

    if (opts.cmd === 'impeccable-audit') {
      if (!opts.scores) { logErr('impeccable-audit 需 --scores <5 维 0-4,逗号分隔>'); return 2; }
      const scores = String(opts.scores).split(',').map((s) => parseInt(s, 10));
      let findings = [];
      if (opts.json) findings = JSON.parse(fs.readFileSync(path.resolve(opts.json), 'utf-8'));
      const r = runImpeccableAudit({ scores, findings });
      console.log(`Audit Health Score: ${r.rating.total}/20 (${r.rating.band})`);
      if (r.findings.length) {
        console.log('Findings（P0 优先）:');
        for (const f of r.findings) console.log(`  [${f.severity}] ${f.name}`);
      }
      return 0;
    }
  } catch (e) {
    logErr(e.message);
    return 1;
  }
  return 0;
}

/** 读 stdin 全部内容（report-html 从管道读候选 JSON 用）。 */
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

async function readStdinJson() {
  if (process.stdin.isTTY) return null;
  const raw = await readStdin();
  try { return raw.trim() ? JSON.parse(raw) : null; } catch { return null; }
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().then((code) => process.exit(code));
}
