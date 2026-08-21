// report-flow.test.mjs — report-flow.mjs 单元 + CLI 集成测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  // report-html
  renderCandidatesHtml,
  normalizeCards,
  runReportHtml,
  // agent-generator
  AGENT_NAME_RE,
  validateAgentName,
  buildAgentFrontmatter,
  runAgentInit,
  // research 严格模式
  researchFileName,
  runResearchFile,
  // impeccable extract
  TOKEN_REF_RE,
  COMPONENT_PROPS,
  FRONTMATTER_GROUPS,
  lookupToken,
  expandTokenRefs,
  invalidComponentProps,
  invalidFrontmatterGroups,
  runImpeccableExtract,
  // impeccable audit
  bandFor,
  rateAudit,
  hexToRgb,
  contrastRatio,
  meetsWcagAA,
  severityRank,
  sortFindings,
  runImpeccableAudit,
} from '../report-flow.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'report-flow-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

// ================================================================ report-html

test('renderCandidatesHtml: 输出自包含 HTML，含各卡片字段', () => {
  const html = renderCandidatesHtml(
    [
      { name: '折叠订单接收管道', issue: '订单模块是浅的', verdict: '强烈', detail: '局部性：bug 集中在一个模块' },
      { name: '仅名字卡片', issue: undefined, verdict: undefined, detail: undefined },
    ],
    '架构审查 — demo',
  );
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /架构审查 — demo/);
  assert.match(html, /折叠订单接收管道/);
  assert.match(html, /订单模块是浅的/);
  assert.match(html, /强烈/);
  assert.match(html, /局部性：bug 集中在一个模块/);
  // 缺字段的卡片不渲染空 issue/verdict/detail 段落，但仍渲染名字
  assert.match(html, /仅名字卡片/);
});

test('normalizeCards: 白名单字段，缺省为空串，非对象项容错', () => {
  assert.deepEqual(
    normalizeCards([{ name: 'a', issue: 'x', extras: 'skip' }, { name: 'b' }, null, 'raw']),
    [
      { name: 'a', issue: 'x', verdict: undefined, detail: undefined },
      { name: 'b', issue: undefined, verdict: undefined, detail: undefined },
      { name: '', issue: undefined, verdict: undefined, detail: undefined },
      { name: '', issue: undefined, verdict: undefined, detail: undefined },
    ],
  );
});

test('runReportHtml: 写入 outDir 指定文件，返回路径', () => {
  const outDir = path.join(tmp, 'rpt-dir');
  const file = runReportHtml({ cards: [{ name: 'X' }], title: 'T', outDir, filename: 'arch.html' });
  assert.equal(file, path.join(outDir, 'arch.html'));
  const html = fs.readFileSync(file, 'utf-8');
  assert.match(html, /T/);
  assert.match(html, /X/);
});

test('runReportHtml: 临时模式可注入 spawnFn（open=true 分支不报错）', () => {
  let spawned = null;
  const file = runReportHtml({
    cards: [{ name: 'X' }], title: 'T', temp: true, open: true, prefix: 'architecture-review',
    spawnFn: (...args) => { spawned = args; return { pid: 1 }; },
  });
  assert.ok(fs.existsSync(file));
  assert.ok(Array.isArray(spawned), 'open=true 应触发 spawnFn');
});

// ================================================================ agent-generator

test('AGENT_NAME_RE / validateAgentName: 姜<两字>-<官署职官> 命名校验', () => {
  assert.equal(validateAgentName('姜清规-刑部律例主事'), true);
  assert.equal(validateAgentName('姜笔记-翰林院编修'), true);
  assert.equal(validateAgentName('姜笔记-翰林院编修'), true);
  assert.equal(validateAgentName('小李'), false, '非姜姓');
  assert.equal(validateAgentName('姜一-职'), false, '姓后非两字');
  assert.equal(validateAgentName('姜十二三-职'), false, '姓后缀非两字');
  assert.equal(validateAgentName('姜two-官署职官'), false, '名字含非中文');
});

test('buildAgentFrontmatter: 组装规范 frontmatter 字段', () => {
  const fm = buildAgentFrontmatter({
    name: '姜清规-刑部律例主事',
    description: '代码审查专责。扮演刑部律例主事。触发词："标准审查"。',
    tools: ['list_dir', 'read_file'],
  });
  assert.match(fm, /^name: 姜清规-刑部律例主事$/m);
  assert.match(fm, /description: 代码审查专责/m);
  assert.match(fm, /^tools: list_dir, read_file$/m);
  assert.match(fm, /^agentMode: agentic$/m);
  assert.match(fm, /^enabled: true$/m);
  assert.match(fm, /^enabledAutoRun: false$/m);
  assert.match(fm, /^---$/m);
});

test('runAgentInit: 落盘 <name>.md，含范式统一开头', () => {
  const outDir = path.join(tmp, 'agent-a');
  const r = runAgentInit({ name: '姜清规-刑部律例主事', description: '审查专责', outDir });
  assert.equal(path.basename(r.file), '姜清规-刑部律例主事.md');
  const md = fs.readFileSync(r.file, 'utf-8');
  assert.match(md, /name: 姜清规-刑部律例主事/);
  assert.match(md, /你是超级AI助理姜清规-刑部律例主事，正在扮演刑部律例主事/);
});

test('runAgentInit: 非法命名拒绝且不落盘', () => {
  const outDir = path.join(tmp, 'agent-b');
  const r = runAgentInit({ name: 'bad name', description: 'x', outDir });
  assert.ok(r.error);
  assert.match(r.error, /非法 name/);
  assert.ok(!fs.existsSync(outDir), '不应创建目录');
});

// ================================================================ research 严格模式

test('researchFileName: {前缀}-{slug}.md，可含版本', () => {
  assert.equal(researchFileName('tech', 'react-state-management'), 'tech-react-state-management.md');
  assert.equal(researchFileName('tech', 'react-state-management', 2), 'tech-react-state-management-2.md');
  assert.equal(researchFileName('progress', 'q2-review', 'v3'), 'progress-q2-review-v3.md');
});

test('runResearchFile: 写入 docs/report 下，模板实例化 {{title}}', () => {
  const outDir = path.join(tmp, 'research-a');
  const r = runResearchFile({ prefix: 'tech', slug: 'react-state', outDir, template: '# {{title}}\n\n正文\n' });
  assert.equal(path.basename(r.file), 'tech-react-state.md');
  const md = fs.readFileSync(r.file, 'utf-8');
  assert.match(md, /^# tech react-state$/m);
});

test('runResearchFile: 冲突时加序号不覆盖（-2 / -3）', () => {
  const outDir = path.join(tmp, 'research-b');
  const tpl = '# {{title}}';
  const a = runResearchFile({ prefix: 'analysis', slug: 'deep', outDir, template: tpl });
  assert.equal(path.basename(a.file), 'analysis-deep.md');
  const b = runResearchFile({ prefix: 'analysis', slug: 'deep', outDir, template: tpl });
  assert.equal(path.basename(b.file), 'analysis-deep-2.md');
  const c = runResearchFile({ prefix: 'analysis', slug: 'deep', outDir, template: tpl });
  assert.equal(path.basename(c.file), 'analysis-deep-3.md');
  // 原文未被覆盖
  assert.match(fs.readFileSync(a.file, 'utf-8'), /^# analysis deep$/);
});

// ---------------------------------------------------------------- --dry-run 不落盘
test('runReportHtml: dryRun 不落盘（返回路径但文件不存在）', () => {
  const outDir = path.join(tmp, `dr-${Math.random().toString(36).slice(2, 8)}`);
  const file = runReportHtml({ cards: [{ name: 'X' }], title: 'T', outDir, filename: 'arch.html', dryRun: true });
  assert.equal(path.basename(file), 'arch.html');
  assert.equal(fs.existsSync(file), false, 'dry-run 不应落盘');
  assert.equal(fs.existsSync(outDir), false, 'dry-run 不应创建目录');
});

test('runAgentInit: dryRun 不落盘，且不因目标已存在而报错', () => {
  const outDir = path.join(tmp, `ai-${Math.random().toString(36).slice(2, 8)}`);
  const name = '姜清规-刑部律例主事';
  // 预建同名文件：dry-run 应忽略"已存在"冲突（只评估校验）
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${name}.md`), 'existing');
  const r = runAgentInit({ name, description: '审查专责', outDir, dryRun: true });
  assert.equal(r.error, undefined, 'dry-run 不应因已存在而失败');
  assert.equal(fs.readFileSync(path.join(outDir, `${name}.md`), 'utf-8'), 'existing', 'dry-run 不应覆盖已有文件');
});

test('runResearchFile: dryRun 不落盘（返回目标路径）', () => {
  const outDir = path.join(tmp, `rf-${Math.random().toString(36).slice(2, 8)}`);
  const r = runResearchFile({ prefix: 'tech', slug: 'react-state', outDir, template: '# {{title}}', dryRun: true });
  assert.equal(path.basename(r.file), 'tech-react-state.md');
  assert.equal(fs.existsSync(r.file), false, 'dry-run 不应落盘');
});

// ================================================================ impeccable extract

const TOKENS = {
  name: 'Demo',
  colors: { primary: '#6750A4', 'on-primary': '#FFFFFF', secondary: '#625B71' },
  rounded: { md: '12px', full: '9999px' },
  components: {
    'button-primary': { backgroundColor: '{colors.primary}', textColor: '{colors.on-primary}', rounded: '{rounded.full}', padding: '16px 48px' },
    'button-hover': { boxShadow: '0 2px 4px', // 非法 prop
    },
    'button-outlined': { textColor: '{colors.primary}' },
  },
};

test('TOKEN_REF_RE: 匹配 {a.b.c} 引用', () => {
  assert.equal('{colors.primary} {rounded.md}'.replace(TOKEN_REF_RE, '[$1]'), '[colors.primary] [rounded.md]');
});

test('COMPONENT_PROPS / FRONTMATTER_GROUPS: 与 document.md schema 对齐', () => {
  for (const p of ['backgroundColor', 'textColor', 'typography', 'rounded', 'padding', 'size', 'height', 'width']) {
    assert.ok(COMPONENT_PROPS.has(p), `应有 ${p}`);
  }
  for (const g of ['name', 'description', 'colors', 'typography', 'rounded', 'spacing', 'components']) {
    assert.ok(FRONTMATTER_GROUPS.has(g));
  }
});

test('lookupToken: 沿点路径取值，缺失返回 undefined', () => {
  assert.equal(lookupToken(TOKENS, 'colors.primary'), '#6750A4');
  assert.equal(lookupToken(TOKENS, 'rounded.full'), '9999px');
  assert.equal(lookupToken(TOKENS, 'colors.nope'), undefined);
  assert.equal(lookupToken(TOKENS, 'missing.deep'), undefined);
});

test('expandTokenRefs: 机械展开 token 引用，缺失保留原样并标记', () => {
  const src = 'bg={colors.primary} radius={rounded.full} missing={colors.nope}';
  const r = expandTokenRefs(src, TOKENS);
  assert.equal(r.text, 'bg=#6750A4 radius=9999px missing={colors.nope}');
  const resolved = r.refs.filter((x) => x.resolved).map((x) => x.ref);
  const missing = r.refs.filter((x) => !x.resolved).map((x) => x.ref);
  assert.deepEqual(resolved, ['colors.primary', 'rounded.full']);
  assert.deepEqual(missing, ['colors.nope']);
});

test('invalidComponentProps: 只标记 schema 之外（8 props）的组件子属性', () => {
  const bad = invalidComponentProps(TOKENS);
  assert.deepEqual(bad, [{ component: 'button-hover', prop: 'boxShadow' }]);
});

test('invalidFrontmatterGroups: 顶层超出 schema 的组（motion/breakpoints/shadows 等）', () => {
  const meta = { name: 'x', colors: {}, motion: [], breakpoints: {}, shadows: {} };
  assert.deepEqual(invalidFrontmatterGroups(meta).sort(), ['breakpoints', 'motion', 'shadows']);
});

test('runImpeccableExtract: 读文档提取展开 token + 规则告警列表', () => {
  const doc = `---
colors:
  primary: "#6750A4"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    shadow: "0 2px"
motion:
  fast: "1s"
---
surface = {colors.primary} missing = {colors.zzz}`;
  const r = runImpeccableExtract({ content: doc });
  assert.match(r.expanded, /surface = #6750A4/);
  assert.match(r.expanded, /missing = \{colors.zzz\}/);
  assert.deepEqual(r.missingRefs, ['colors.zzz']);
  assert.deepEqual(r.invalidProps, [{ component: 'button-primary', prop: 'shadow' }]);
  assert.deepEqual(r.invalidGroups, ['motion']);
});

// ================================================================ impeccable audit

test('bandFor / rateAudit: 5 维 0-4 累加映射评级带', () => {
  assert.equal(bandFor(20), 'Excellent');
  assert.equal(bandFor(18), 'Excellent');
  assert.equal(bandFor(17), 'Good');
  assert.equal(bandFor(14), 'Good');
  assert.equal(bandFor(13), 'Acceptable');
  assert.equal(bandFor(10), 'Acceptable');
  assert.equal(bandFor(9), 'Poor');
  assert.equal(bandFor(6), 'Poor');
  assert.equal(bandFor(5), 'Critical');
  assert.equal(bandFor(0), 'Critical');
  assert.deepEqual(rateAudit([4, 4, 3, 3, 4]), { total: 18, band: 'Excellent' });
  assert.deepEqual(rateAudit([2, 2, 2, 1, 1]), { total: 8, band: 'Poor' });
});

test('hexToRgb / contrastRatio: WCAG 相对亮度对比度（机械判定）', () => {
  assert.deepEqual(hexToRgb('#6750a4'), { r: 0x67, g: 0x50, b: 0xa4 });
  assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255 });
  assert.equal(hexToRgb('nope'), null);
  const r = contrastRatio('#FFFFFF', '#000000');
  assert.ok(r && r > 20, '黑白对比应极高');
  assert.ok(contrastRatio('#000000', '#000000') === 1);
});

test('meetsWcagAA: 文本对比度 >= 4.5:1', () => {
  assert.equal(meetsWcagAA('#FFFFFF', '#000000'), true);
  assert.equal(meetsWcagAA('#000000', '#000000'), false);
});

test('severityRank / sortFindings: 按 P0→P3 排序，未知兜底', () => {
  assert.equal(severityRank('P0'), 0);
  assert.equal(severityRank('P3'), 3);
  assert.ok(severityRank('P9') >= 99);
  const findings = [
    { severity: 'P2', name: 'touch' },
    { severity: 'P1', name: 'contrast' },
    { severity: 'P0', name: 'blocking' },
    { severity: 'P3', name: 'polish' },
  ];
  assert.deepEqual(sortFindings(findings).map((f) => f.severity), ['P0', 'P1', 'P2', 'P3']);
});

test('runImpeccableAudit: 计分 + 评级带 + 按严重度排序 findings', () => {
  const r = runImpeccableAudit({
    scores: [4, 4, 3, 3, 4],
    findings: [
      { severity: 'P2', name: 'b' },
      { severity: 'P0', name: 'a' },
    ],
  });
  assert.deepEqual(r.rating, { total: 18, band: 'Excellent' });
  assert.deepEqual(r.findings.map((f) => f.name), ['a', 'b']);
});
