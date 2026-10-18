// setup.test.mjs — setup.mjs 单元 + 临时目录 CLI fixture 测试（node:test，零第三方依赖）。
// 运行：node --test tests/setup.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  MULTI_AGENT_BLOCK,
  DOC_TEMPLATES,
  DEFAULT_AGENTS_CONTENT,
  DEFAULT_SKILLS_DIR,
  SKILLS_MARK_START,
  SKILLS_MARK_END,
  buildAgentSkillsBlock,
  buildTemplateOutput,
  buildProjectSkillsSection,
  extractManagedBody,
  ensureMultiAgentBlock,
  upsertAgentSkillsBlock,
  upsertProjectSkillsSection,
  extractAgentSkillsBlock,
  findForeignSkillsHeadings,
  isManagedOnlyDelta,
  inferSkillsDir,
  normalizeSkillsDir,
  parseFrontmatter,
  summarizeDescription,
  scanProjectSkills,
  runDetect,
  runSyncDoc,
  runSyncSkills,
  runInit,
  filesIdentical,
  findOnPath,
  detectOcr,
} from '../scripts/setup.mjs';

// 临时目录 fixture：name 命名隔离，结束即清
function fixtureRoot(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `setup-mps-${name}-`));
  test.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function read(root, rel) { return fs.readFileSync(path.join(root, rel), 'utf-8'); }
function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}
// 三份 docs/agents 种子文件 fixture（独立种子目录，避免污染技能目录）
function mkSeeds(name) {
  const seeds = fixtureRoot(`${name}-seeds`);
  for (const { seed } of DOC_TEMPLATES) write(seeds, seed, `seed:${seed}\n`);
  return seeds;
}

// ================================================================ sync-doc：写入一致性

test('sync-doc: CLAUDE.md 存在 → 以它为源，CODEBUDDY 逐字节一致，不创建 AGENTS.md', () => {
  const root = fixtureRoot('sync-claude');
  const seeds = mkSeeds('sync-claude');
  write(root, 'CLAUDE.md', `${MULTI_AGENT_BLOCK}\n\n## 项目约定\n\n自定义内容。\n`);
  const r = runSyncDoc({ root, seedsDir: seeds });
  assert.equal(r.canonical, 'CLAUDE.md');
  assert.equal(r.createdDefault, false);
  assert.equal(r.identical, true);
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'CLAUDE.md'));
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.equal(r.multiAgent, true);
});

test('sync-doc: 仅 AGENTS.md 存在 → 以它为源，CODEBUDDY 一致', () => {
  const root = fixtureRoot('sync-agents');
  const seeds = mkSeeds('sync-agents');
  write(root, 'AGENTS.md', `${MULTI_AGENT_BLOCK}\n\n## 项目约定\n\nx\n`);
  const r = runSyncDoc({ root, seedsDir: seeds });
  assert.equal(r.canonical, 'AGENTS.md');
  assert.equal(r.identical, true);
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'));
});

test('sync-doc: 都不存在 → 默认创建 AGENTS.md 与 CODEBUDDY.md，内容相同且带多代理要求块', () => {
  const root = fixtureRoot('sync-default');
  const seeds = mkSeeds('sync-default');
  const r = runSyncDoc({ root, seedsDir: seeds });
  assert.equal(r.createdDefault, true);
  assert.equal(r.canonical, 'AGENTS.md');
  assert.equal(read(root, 'AGENTS.md'), DEFAULT_AGENTS_CONTENT);
  assert.equal(read(root, 'CODEBUDDY.md'), DEFAULT_AGENTS_CONTENT);
  assert.equal(r.multiAgent, true);
  assert.equal(r.identical, true);
});

test('sync-doc: 三份 docs/agents/*.md 模板逐字节克隆', () => {
  const root = fixtureRoot('sync-tpl');
  const seeds = mkSeeds('sync-tpl');
  const r = runSyncDoc({ root, seedsDir: seeds });
  assert.deepEqual(r.templates, DOC_TEMPLATES.map((t) => t.out));
  for (const { seed, out } of DOC_TEMPLATES) {
    assert.ok(
      filesIdentical(path.join(seeds, seed), path.join(root, 'docs/agents', out)),
      `${out} 应与种子 ${seed} 逐字节一致`,
    );
  }
});

test('sync-doc: --dry-run 不落盘', () => {
  const root = fixtureRoot('sync-dry');
  const seeds = mkSeeds('sync-dry');
  const r = runSyncDoc({ root, seedsDir: seeds, dryRun: true });
  assert.equal(r.dryRun, true);
  assert.equal(fs.existsSync(path.join(root, 'CODEBUDDY.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'docs/agents/issue-tracker.md')), false);
  assert.ok(r.actions.every((a) => a.action === 'skipped' || a.action === 'created'), 'dry-run 下动作应标记 skipped/created');
});

// ================================================================ Agent skills 块构建与 upsert

test('buildAgentSkillsBlock: 默认（single，无覆盖）与 DEFAULT_AGENTS_CONTENT 单源一致', () => {
  assert.equal(DEFAULT_AGENTS_CONTENT, `${MULTI_AGENT_BLOCK}\n\n${buildAgentSkillsBlock()}`);
  const block = buildAgentSkillsBlock();
  assert.match(block, /^## Agent skills\n/);
  assert.match(block, /单一上下文布局/);
  assert.match(block, /标签字符串与角色名一致，未覆盖/);
  assert.match(block, /\.scratch\/` 是仓库源码的一部分，\*\*必须提交进 git\*\*/, 'Issue tracker 段需说明 .scratch 要提交 git 管理');
  assert.ok(block.endsWith('\n'));
});

test('buildAgentSkillsBlock: labels 覆盖与 multi 布局渲染', () => {
  const block = buildAgentSkillsBlock({ layout: 'multi', labels: { 'needs-triage': 'bug:triage' } });
  assert.match(block, /含覆盖/);
  assert.match(block, /`needs-triage`→`bug:triage`/);
  assert.match(block, /`needs-info`(?!→)/); // 未覆盖角色原样列出
  assert.match(block, /多上下文布局：根目录 `CONTEXT-MAP\.md`/);
  assert.throws(() => buildAgentSkillsBlock({ layout: 'weird' }), /layout 仅支持/);
});

test('ensureMultiAgentBlock: 缺失时插入首个 H1 之后；已存在则不动', () => {
  const withH1 = ensureMultiAgentBlock('# 我的项目\n\n正文\n');
  assert.match(withH1, /^# 我的项目\n\n## 多代理要求\n\nAGENTS\.md 和 CODEBUDDY\.md 内容必须保持一致。\n\n正文\n$/);
  const noH1 = ensureMultiAgentBlock('正文\n');
  assert.ok(noH1.startsWith(MULTI_AGENT_BLOCK));
  const existing = `x\n${MULTI_AGENT_BLOCK}\ny\n`;
  assert.equal(ensureMultiAgentBlock(existing), existing);
});

test('upsertAgentSkillsBlock: 缺失追加 / 已存在整段替换且保留周围与后续小节', () => {
  const block = buildAgentSkillsBlock({ scan: null }); // scan=null=不含受管「项目技能」小节（本用例只考结构）
  // 缺失 → 追加
  const appended = upsertAgentSkillsBlock('# P\n\n前面内容\n', block);
  assert.match(appended, /^# P\n\n前面内容\n\n## Agent skills\n/);
  // 已存在 → 替换，周围内容与后续 ## 小节保留
  const doc = `# P\n\n## Agent skills\n\n旧内容\n\n## 其他小节\n\n保留我\n`;
  const replaced = upsertAgentSkillsBlock(doc, block);
  assert.ok(!replaced.includes('旧内容'), '旧块内容被替换');
  assert.match(replaced, /### 临时文件\n\n所有临时脚本/);
  assert.match(replaced, /\n\n## 其他小节\n\n保留我\n$/);
  // 块在文件末尾：不产生多余尾部空行、保留结尾换行
  const atEnd = upsertAgentSkillsBlock(`# P\n\n## Agent skills\n\n旧内容\n`, block);
  assert.ok(atEnd.endsWith('保证仓库根目录干净。\n'));
  // 空内容 → 直接给块
  assert.equal(upsertAgentSkillsBlock('', block), block);
});

test('sync-doc + block: 已存在文件就地 upsert，actions 日志区分 created/updated/unchanged', () => {
  const root = fixtureRoot('sync-upsert');
  const seeds = mkSeeds('sync-upsert');
  write(root, 'AGENTS.md', '# 项目\n\n自定义前言\n\n## 自定义小节\n\n别动我\n');
  const r = runSyncDoc({ root, seedsDir: seeds, block: {} });
  assert.equal(r.blockUpserted, true);
  const content = read(root, 'AGENTS.md');
  assert.match(content, /## 多代理要求/, '缺失的多代理块被注入');
  assert.match(content, /## Agent skills\n\n### Issue tracker/, '块被追加');
  assert.match(content, /## 自定义小节\n\n别动我\n\n## Agent skills/, '周围内容原样保留，块追加在末尾');
  assert.equal(r.identical, true);
  const byFile = Object.fromEntries(r.actions.map((a) => [a.file, a.action]));
  assert.equal(byFile['AGENTS.md'], 'updated');
  assert.equal(byFile['CODEBUDDY.md'], 'created');
  assert.equal(byFile['docs/agents/issue-tracker.md'], 'created');
  // 再跑一次：全部 unchanged（幂等）
  const r2 = runSyncDoc({ root, seedsDir: seeds, block: {} });
  const byFile2 = Object.fromEntries(r2.actions.map((a) => [a.file, a.action]));
  assert.equal(byFile2['AGENTS.md'], 'unchanged');
  assert.equal(byFile2['CODEBUDDY.md'], 'unchanged');
  assert.equal(byFile2['docs/agents/issue-tracker.md'], 'unchanged');
});

test('sync-doc + block: 默认创建路径遵循 layout/labels 选项', () => {
  const root = fixtureRoot('sync-block-default');
  const seeds = mkSeeds('sync-block-default');
  const r = runSyncDoc({ root, seedsDir: seeds, block: { layout: 'multi', labels: { wontfix: 'no-fix' } } });
  assert.equal(r.createdDefault, true);
  const content = read(root, 'AGENTS.md');
  assert.match(content, /多上下文布局/);
  assert.match(content, /`wontfix`→`no-fix`/);
});

// ================================================================ 冲突保护：已存在且内容不同 → 默认不覆盖

test('extractAgentSkillsBlock: 提取已有块（去尾部空行）；无块返回 null', () => {
  assert.equal(extractAgentSkillsBlock(null), null);
  assert.equal(extractAgentSkillsBlock('# P\n\n无块\n'), null);
  const block = buildAgentSkillsBlock();
  assert.equal(extractAgentSkillsBlock(`# P\n\n${block}\n## 其他\n\nx\n`), block.replace(/\n+$/, ''));
  // 与将写入的块逐字相同（含 CRLF 归一）→ 视为一致
  assert.equal(extractAgentSkillsBlock(`# P\r\n\r\n${block}`), extractAgentSkillsBlock(`# P\n\n${block}`));
});

test('sync-doc: 已有 docs/agents/*.md 且内容不同 → 默认保留并报 conflict，缺失的照常创建', () => {
  const root = fixtureRoot('conflict-tpl');
  const seeds = mkSeeds('conflict-tpl');
  write(root, 'docs/agents/domain.md', '# 定制领域文档\n');
  const r = runSyncDoc({ root, seedsDir: seeds, block: {} });
  const byFile = Object.fromEntries(r.actions.map((a) => [a.file, a.action]));
  assert.equal(byFile['docs/agents/domain.md'], 'conflict');
  assert.equal(read(root, 'docs/agents/domain.md'), '# 定制领域文档\n', '原文件原样保留，未被种子覆盖');
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].file, 'docs/agents/domain.md');
  assert.equal(r.conflicts[0].hint, '--overwrite docs/agents/domain.md');
  assert.equal(byFile['docs/agents/issue-tracker.md'], 'created', '缺失的仍创建');
  // 授权精确覆盖后：仅该文件被覆盖
  const r2 = runSyncDoc({ root, seedsDir: seeds, block: {}, overwrite: ['docs/agents/domain.md'] });
  assert.equal(Object.fromEntries(r2.actions.map((a) => [a.file, a.action]))['docs/agents/domain.md'], 'updated');
  assert.equal(read(root, 'docs/agents/domain.md'), 'seed:domain.md\n');
  assert.equal(r2.conflicts.length, 0);
});

test('sync-doc: CODEBUDDY.md 已存在且不一致 → 默认保留并报 conflict；授权后才同步', () => {
  const root = fixtureRoot('conflict-cb');
  const seeds = mkSeeds('conflict-cb');
  write(root, 'AGENTS.md', `${MULTI_AGENT_BLOCK}\n\n${buildAgentSkillsBlock()}`);
  write(root, 'CODEBUDDY.md', '## CODEBUDDY.md 的独有约定\n');
  const r = runSyncDoc({ root, seedsDir: seeds, block: {} });
  assert.equal(Object.fromEntries(r.actions.map((a) => [a.file, a.action]))['CODEBUDDY.md'], 'conflict');
  assert.equal(read(root, 'CODEBUDDY.md'), '## CODEBUDDY.md 的独有约定\n', '独有内容未被冲掉');
  assert.equal(r.identical, false);
  const r2 = runSyncDoc({ root, seedsDir: seeds, block: {}, overwrite: ['CODEBUDDY.md'] });
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'));
  assert.equal(r2.identical, true);
  assert.equal(r2.conflicts.length, 0);
});

test('sync-doc + block: 已有 Agent skills 块内容不同 → 默认保留并报 conflict；授权后才替换', () => {
  const root = fixtureRoot('conflict-block');
  const seeds = mkSeeds('conflict-block');
  write(root, 'AGENTS.md', '# P\n\n## Agent skills\n\n定制的 tracker 约定\n\n## 其他\n\n别动我\n');
  const r = runSyncDoc({ root, seedsDir: seeds, block: {} });
  assert.equal(Object.fromEntries(r.actions.map((a) => [a.file, a.action]))['AGENTS.md'], 'conflict');
  assert.match(read(root, 'AGENTS.md'), /定制的 tracker 约定/, '定制块未被静默替换');
  const r2 = runSyncDoc({ root, seedsDir: seeds, block: {}, overwrite: ['AGENTS.md'] });
  assert.equal(Object.fromEntries(r2.actions.map((a) => [a.file, a.action]))['AGENTS.md'], 'updated');
  assert.match(read(root, 'AGENTS.md'), /### Issue tracker/);
  assert.match(read(root, 'AGENTS.md'), /别动我/, '块外内容仍保留');
  // 源被改写后，首轮由旧内容复制出来的 CODEBUDDY.md 变成漂移 → 继续报冲突（不静默覆盖）
  assert.deepEqual(r2.conflicts.map((c) => c.file), ['CODEBUDDY.md']);
  const r3 = runSyncDoc({ root, seedsDir: seeds, block: {}, overwrite: ['AGENTS.md', 'CODEBUDDY.md'] });
  assert.equal(r3.conflicts.length, 0);
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'));
});

test('sync-doc: force=true 覆盖全部冲突；dry-run 也如实报出冲突', () => {
  const root = fixtureRoot('conflict-force');
  const seeds = mkSeeds('conflict-force');
  write(root, 'AGENTS.md', `${MULTI_AGENT_BLOCK}\n\n${buildAgentSkillsBlock()}`);
  write(root, 'CODEBUDDY.md', 'CODEBUDDY 独有\n');
  write(root, 'docs/agents/domain.md', '定制\n');
  const dry = runSyncDoc({ root, seedsDir: seeds, block: {}, dryRun: true });
  assert.ok(dry.actions.some((a) => a.action === 'conflict' && a.file === 'docs/agents/domain.md'), 'dry-run 报出模板冲突');
  assert.ok(dry.actions.some((a) => a.action === 'conflict' && a.file === 'CODEBUDDY.md'), 'dry-run 报出 CODEBUDDY 冲突');
  assert.equal(read(root, 'CODEBUDDY.md'), 'CODEBUDDY 独有\n');
  const r = runSyncDoc({ root, seedsDir: seeds, block: {}, force: true });
  assert.equal(r.conflicts.length, 0);
  assert.equal(read(root, 'docs/agents/domain.md'), 'seed:domain.md\n');
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'));
});

test('init: 冲突汇总进 conflicts，未授权时原文件一律保留', () => {
  const root = fixtureRoot('conflict-init');
  const seeds = mkSeeds('conflict-init');
  write(root, 'AGENTS.md', '# P\n\n## Agent skills\n\n定制块\n');
  write(root, 'docs/agents/triage-labels.md', '定制标签\n');
  const r = runInit({ root, seedsDir: seeds });
  assert.deepEqual(r.sync.conflicts.map((c) => c.file).sort(), ['AGENTS.md', 'docs/agents/triage-labels.md']);
  assert.match(read(root, 'AGENTS.md'), /定制块/);
  assert.equal(read(root, 'docs/agents/triage-labels.md'), '定制标签\n');
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'), '源未被改写，CODEBUDDY 按其复制');
  // 全部授权后一次收敛
  const r2 = runInit({ root, seedsDir: seeds, force: true });
  assert.equal(r2.sync.conflicts.length, 0);
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'));
  // 再跑一次：幂等，全部 unchanged
  const r3 = runInit({ root, seedsDir: seeds });
  assert.equal(r3.sync.conflicts.length, 0);
  assert.ok(r3.sync.actions.every((a) => a.action === 'unchanged'));
});

// ================================================================ init（一键初始化：detect + 落盘）

test('init: 空仓库 → detect 现状 + 全部默认落盘，5 份文件生成', () => {
  const root = fixtureRoot('init-empty');
  const seeds = mkSeeds('init-empty');
  const r = runInit({ root, seedsDir: seeds });
  assert.equal(r.detect.canonical, null);
  assert.equal(r.sync.createdDefault, true);
  assert.equal(read(root, 'AGENTS.md'), DEFAULT_AGENTS_CONTENT);
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'));
  assert.ok(fs.existsSync(path.join(root, 'docs/agents/issue-tracker.md')));
});

test('init: 已有 AGENTS.md → 读取并保留自定义内容，追加工程块，同步 CODEBUDDY', () => {
  const root = fixtureRoot('init-existing');
  const seeds = mkSeeds('init-existing');
  write(root, 'AGENTS.md', '# 项目\n\n自定义前言\n\n## 自定义小节\n\n别动我\n');
  const r = runInit({ root, seedsDir: seeds });
  assert.equal(r.detect.canonical, 'AGENTS.md');
  assert.equal(r.sync.createdDefault, false);
  const content = read(root, 'AGENTS.md');
  assert.match(content, /## 自定义小节\n\n别动我\n\n## Agent skills/, '自定义内容原样保留，工程块追加末尾');
  assert.match(content, /## 多代理要求/, '缺失的多代理块被注入');
  assert.equal(r.sync.identical, true);
  assert.equal(read(root, 'CODEBUDDY.md'), content, 'CODEBUDDY 与 AGENTS 逐字节一致');
});

test('init: layout/labels 定制写入', () => {
  const root = fixtureRoot('init-opts');
  const seeds = mkSeeds('init-opts');
  const r = runInit({ root, seedsDir: seeds, block: { layout: 'multi', labels: { wontfix: 'no-fix' } } });
  const content = read(root, 'AGENTS.md');
  assert.match(content, /多上下文布局/);
  assert.match(content, /`wontfix`→`no-fix`/);
  assert.equal(r.sync.createdDefault, true);
});

test('init: --dry-run 不落盘', () => {
  const root = fixtureRoot('init-dry');
  const seeds = mkSeeds('init-dry');
  const r = runInit({ root, seedsDir: seeds, dryRun: true });
  assert.equal(r.sync.dryRun, true);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'docs/agents')), false);
});

// ================================================================ template（步骤 4：输出文件内容，不落盘）

test('buildTemplateOutput: 默认输出 6 份文件（含项目技能目录 README），CODEBUDDY 与 AGENTS 逐字节一致', () => {
  const seeds = mkSeeds('tpl');
  const out = buildTemplateOutput({ seedsDir: seeds });
  assert.deepEqual(out.map((f) => f.file), [
    'AGENTS.md',
    'CODEBUDDY.md',
    'docs/agents/issue-tracker.md',
    'docs/agents/triage-labels.md',
    'docs/agents/domain.md',
    'docs/agents/skills/README.md',
  ]);
  assert.equal(out[1].content, out[0].content, 'CODEBUDDY.md 与 AGENTS.md 逐字节一致');
  assert.equal(out[0].content, DEFAULT_AGENTS_CONTENT, '默认 AGENTS.md 等于 DEFAULT_AGENTS_CONTENT');
  assert.equal(out[2].content, 'seed:issue-tracker-local.md\n', 'docs/agents 来自种子模板');
  assert.match(out[5].content, /# 项目技能目录/);
  assert.match(out[5].content, /sync-skills/);
});

test('buildTemplateOutput: --no-skills（技能另放它处的仓库）不产出技能目录 README', () => {
  const out = buildTemplateOutput({ seedsDir: mkSeeds('tpl-noskills'), noSkills: true });
  assert.equal(out.length, 5);
  assert.ok(!out[0].content.includes('### 项目技能'), '整节略去，不留半截清单');
});

test('buildTemplateOutput: layout/labels 定制渲染进 AGENTS.md，不落盘', () => {
  const seeds = mkSeeds('tpl-opts');
  const out = buildTemplateOutput({ seedsDir: seeds, layout: 'multi', labels: { 'needs-triage': 'bug:triage' } });
  assert.match(out[0].content, /多上下文布局/);
  assert.match(out[0].content, /`needs-triage`→`bug:triage`/);
  // 未落盘：临时种子目录下不产生目标文件
  assert.equal(fs.existsSync(path.join(seeds, 'AGENTS.md')), false);
});

// ================================================================ detect（步骤 1 探索）

test('detect: 空仓库 — 文件/目录全部不存在，canonical 为 null', () => {
  const root = fixtureRoot('detect-empty');
  const r = runDetect({ root });
  assert.equal(r.canonical, null);
  assert.deepEqual(r.files, { 'CLAUDE.md': false, 'AGENTS.md': false, 'CODEBUDDY.md': false, 'CONTEXT.md': false, 'CONTEXT-MAP.md': false });
  assert.equal(r.codebuddyConsistent, null);
  assert.deepEqual(r.priorOutputs, []);
});

test('detect: 已有配置 — canonical 优先级、块检测、一致性比较', () => {
  const root = fixtureRoot('detect-full');
  write(root, 'CLAUDE.md', `# C\n\n${MULTI_AGENT_BLOCK}\n\n## Agent skills\n\nx\n`);
  write(root, 'AGENTS.md', 'should-not-win\n');
  write(root, 'CODEBUDDY.md', read(root, 'CLAUDE.md'));
  write(root, 'CONTEXT.md', '# ctx\n');
  write(root, 'docs/agents/issue-tracker.md', '# x\n');
  write(root, 'docs/adr/0001-x.md', '# x\n');
  fs.mkdirSync(path.join(root, '.scratch'), { recursive: true });
  const r = runDetect({ root });
  assert.equal(r.canonical, 'CLAUDE.md');
  assert.equal(r.agentSkillsBlock, true);
  assert.equal(r.multiAgentBlock, true);
  assert.equal(r.codebuddyConsistent, true);
  assert.deepEqual(r.priorOutputs, ['issue-tracker.md']);
  assert.deepEqual(r.dirs, { 'docs/adr': true, 'docs/agents': true, '.scratch': true });
});

test('detect: CODEBUDDY.md 存在但不一致时报告 false', () => {
  const root = fixtureRoot('detect-drift');
  write(root, 'AGENTS.md', 'a\n');
  write(root, 'CODEBUDDY.md', 'b\n');
  const r = runDetect({ root });
  assert.equal(r.canonical, 'AGENTS.md');
  assert.equal(r.codebuddyConsistent, false);
});

test('detect: 报告漂移 — agentSkillsBlockMatches 与 docsAgents(exists/matchesSeed)', () => {
  const root = fixtureRoot('detect-drift2');
  const seeds = mkSeeds('detect-drift2');
  write(root, 'AGENTS.md', `# P\n\n${buildAgentSkillsBlock()}`);
  write(root, 'docs/agents/domain.md', '定制\n');
  const r = runDetect({ root, seedsDir: seeds });
  assert.equal(r.agentSkillsBlockMatches, true, '已有块与将写入的块一致');
  assert.deepEqual(
    r.docsAgents.find((d) => d.file === 'docs/agents/domain.md'),
    { file: 'docs/agents/domain.md', exists: true, matchesSeed: false },
    '已存在且与种子不同 → 写入会冲突',
  );
  assert.deepEqual(
    r.docsAgents.find((d) => d.file === 'docs/agents/issue-tracker.md'),
    { file: 'docs/agents/issue-tracker.md', exists: false, matchesSeed: null },
    '不存在 → 写入为 created',
  );
  // 定制过的块 → 与将写入的块不同
  write(root, 'AGENTS.md', '# P\n\n## Agent skills\n\n定制\n');
  assert.equal(runDetect({ root, seedsDir: seeds }).agentSkillsBlockMatches, false);
});

// ================================================================ CLI e2e

const SETUP_MJS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'setup.mjs');

test('e2e: CLI detect 输出合法 JSON；sync-doc 默认种子目录为技能目录自身', () => {
  const root = fixtureRoot('cli');
  const detectOut = execFileSync(process.execPath, [SETUP_MJS, 'detect', '--root', root], { encoding: 'utf-8' });
  const d = JSON.parse(detectOut);
  assert.equal(d.canonical, null);
  // 不传 --seeds：种子取自技能目录根的三份真实模板
  execFileSync(process.execPath, [SETUP_MJS, 'sync-doc', '--root', root], { encoding: 'utf-8' });
  assert.equal(read(root, 'docs/agents/issue-tracker.md').startsWith('# Issue 跟踪器'), true);
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'));
});

test('e2e: CLI 有冲突时退出码 3、原文件保留并提示 --overwrite；--force 后退出码 0', () => {
  const root = fixtureRoot('cli-conflict');
  write(root, 'docs/agents/domain.md', '# 定制领域文档\n');
  let code = 0;
  let out = '';
  try {
    out = execFileSync(process.execPath, [SETUP_MJS, 'init', '--root', root], { encoding: 'utf-8' });
  } catch (e) {
    code = e.status;
    out = e.stdout;
  }
  assert.equal(code, 3, '存在未处置冲突时退出码为 3');
  assert.match(out, /\[conflict\] docs\/agents\/domain\.md/);
  assert.match(out, /--overwrite <文件>/);
  assert.equal(read(root, 'docs/agents/domain.md'), '# 定制领域文档\n', '原文件未被覆盖');
  const out2 = execFileSync(process.execPath, [SETUP_MJS, 'init', '--root', root, '--force'], { encoding: 'utf-8' });
  assert.match(out2, /\[updated\] docs\/agents\/domain\.md/);
  assert.match(out2, /初始化完成/);
});

test('e2e: CLI template 输出 6 份文件内容到 stdout 且不落盘', () => {
  const root = fixtureRoot('cli-tpl');
  const out = execFileSync(process.execPath, [SETUP_MJS, 'template', '--root', root], { encoding: 'utf-8' });
  assert.match(out, /=== FILE: AGENTS\.md ===/);
  assert.match(out, /=== FILE: CODEBUDDY\.md ===/);
  assert.match(out, /=== FILE: docs\/agents\/issue-tracker\.md ===/);
  assert.match(out, /=== FILE: docs\/agents\/triage-labels\.md ===/);
  assert.match(out, /=== FILE: docs\/agents\/domain\.md ===/);
  assert.match(out, /=== FILE: docs\/agents\/skills\/README\.md ===/);
  assert.match(out, /## 多代理要求/);
  // 不落盘：目标仓库根不产生任何文件
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'CODEBUDDY.md')), false);
  assert.equal(fs.existsSync(path.join(root, 'docs/agents')), false);
});

// ---------------------------------------------------------------- OCR 检测

test('findOnPath: 命中 PATH 上真实存在的可执行文件（node）', () => {
  const p = findOnPath('node');
  assert.ok(p, 'node 应在 PATH 上');
  assert.equal(fs.existsSync(p), true);
  assert.equal(fs.statSync(p).isFile(), true);
});

test('findOnPath: 不存在的名字返回 null', () => {
  assert.equal(findOnPath('definitely-not-a-real-binary-xyz-12345'), null);
});

test('detectOcr: 返回结构合规（只读，不假设本机是否安装了 OCR）', () => {
  const r = detectOcr();
  assert.equal(typeof r.installed, 'boolean');
  if (r.installed) {
    assert.ok(r.path, 'installed=true 时应给出路径');
    if (r.version !== null) assert.equal(typeof r.version, 'string');
  } else {
    assert.equal(r.path, null);
    assert.equal(r.version, null);
  }
  assert.ok('error' in r, '应始终带 error 字段');
});

test('e2e: CLI ocr 子命令输出含 installed 字段的 JSON', () => {
  const out = execFileSync(process.execPath, [SETUP_MJS, 'ocr'], { encoding: 'utf-8' });
  assert.match(out, /"installed":\s*(true|false)/);
  assert.match(out, /"path":/);
});

// ================================================================ 项目技能目录（docs/agents/skills）

/** 造一个项目技能：<dir>/<name>/SKILL.md（frontmatter name + description） */
function mkSkill(root, dir, name, description) {
  write(root, `${dir}/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
}

test('parseFrontmatter: 取顶层 name/description，去引号，忽略缩进嵌套', () => {
  const fm = parseFrontmatter('---\nname: demo\ndescription: "带引号的描述"\nmetadata:\n  version: 1.0\n---\n\n# 正文\n');
  assert.equal(fm.name, 'demo');
  assert.equal(fm.description, '带引号的描述');
  assert.deepEqual(parseFrontmatter('# 没有 frontmatter\n'), {});
});

test('summarizeDescription: 取首个句读前的子句并限长；缺失时给占位说明', () => {
  assert.equal(summarizeDescription('本项目命令参考——dev/build/lint。当要跑命令时加载。'), '本项目命令参考——dev/build/lint');
  assert.ok(summarizeDescription('x'.repeat(100)).endsWith('…'));
  assert.match(summarizeDescription(''), /未写 description/);
});

test('scanProjectSkills: 只认「顶层子目录 + 有 SKILL.md」，名字取 frontmatter 并排序', () => {
  const root = fixtureRoot('scan-skills');
  mkSkill(root, DEFAULT_SKILLS_DIR, 'commands', '跑命令时加载。');
  mkSkill(root, DEFAULT_SKILLS_DIR, 'blog-review', '审博客时加载。');
  write(root, `${DEFAULT_SKILLS_DIR}/_shared/references/x.md`, '不是技能\n'); // 没有 SKILL.md → 忽略
  write(root, `${DEFAULT_SKILLS_DIR}/blog-review/references/y.md`, '子目录 → 忽略\n');
  const scan = scanProjectSkills(root);
  assert.equal(scan.dir, DEFAULT_SKILLS_DIR);
  assert.equal(scan.exists, true);
  assert.deepEqual(scan.skills.map((s) => s.name), ['blog-review', 'commands']);
  assert.equal(scan.skills[0].skillMd, 'docs/agents/skills/blog-review/SKILL.md');
  assert.equal(scan.skills[0].summary, '审博客时加载');
});

test('normalizeSkillsDir / inferSkillsDir: 自定义目录与从受管小节标题回推', () => {
  assert.equal(normalizeSkillsDir('./.agent/skills/'), '.agent/skills');
  assert.equal(normalizeSkillsDir(''), DEFAULT_SKILLS_DIR);
  const scan = { dir: '.agent/skills', skills: [] };
  const section = buildProjectSkillsSection(scan);
  assert.equal(inferSkillsDir(section), '.agent/skills', 'sync-skills 不带参数也能认出仓库自己的目录');
});

test('buildProjectSkillsSection: 表格按名字排序夹在标记之间；空目录给占位行', () => {
  const empty = buildProjectSkillsSection({ dir: DEFAULT_SKILLS_DIR, skills: [] });
  assert.match(empty, /暂无项目技能/);
  assert.ok(empty.indexOf(SKILLS_MARK_START) < empty.indexOf(SKILLS_MARK_END));
  const section = buildProjectSkillsSection({
    dir: DEFAULT_SKILLS_DIR,
    skills: [{ name: 'b', summary: 'B 技能' }, { name: 'a', summary: 'A 技能' }],
  });
  assert.match(extractManagedBody(section), /\| `a` \| A 技能 \|\n\| `b` \| B 技能 \|/);
});

test('upsertProjectSkillsSection: 只改标记之间；标记外的手写内容逐字保留', () => {
  const doc = ['# P', '', '## Agent skills', '', '### 临时文件', '', '约定正文。', '', '## 其他小节', '', '别动我。', ''].join('\n');
  const ins = upsertProjectSkillsSection(doc, buildProjectSkillsSection({ dir: DEFAULT_SKILLS_DIR, skills: [] }));
  assert.equal(ins.action, 'inserted');
  assert.match(ins.content, /### 临时文件\n\n约定正文。/, '小节插在工程块内');
  assert.match(ins.content, /## 其他小节\n\n别动我。/, '后续小节保留');
  // 再刷一次：表体变了，标记外一字不动
  const more = upsertProjectSkillsSection(ins.content, buildProjectSkillsSection({ dir: DEFAULT_SKILLS_DIR, skills: [{ name: 'a', summary: 'A 技能' }] }));
  assert.equal(more.action, 'updated');
  assert.match(more.content, /\| `a` \| A 技能 \|/);
  assert.match(more.content, /别动我。/);
  // 幂等
  assert.equal(upsertProjectSkillsSection(more.content, buildProjectSkillsSection({ dir: DEFAULT_SKILLS_DIR, skills: [{ name: 'a', summary: 'A 技能' }] })).action, 'unchanged');
});

test('findForeignSkillsHeadings: 识别手写技能清单；不误报 ## Agent skills、受管小节与「怎么新建技能」小节', () => {
  assert.deepEqual(findForeignSkillsHeadings('# P\n\n## Agent skills\n\nx\n'), []);
  assert.deepEqual(findForeignSkillsHeadings(buildProjectSkillsSection({ dir: DEFAULT_SKILLS_DIR, skills: [] })), []);
  assert.equal(findForeignSkillsHeadings('## 技能（固定流程都在这里）\n\n| 技能 | 什么时候加载 |\n| --- | --- |\n| `a` | A |\n').length, 1);
  assert.equal(
    findForeignSkillsHeadings('## 技能清单\n\n| 技能 | 何时加载 |\n| --- | --- |\n| `a` | A |\n').length,
    1,
    '带技能表格的小节也算清单',
  );
  assert.deepEqual(findForeignSkillsHeadings('### 新增 SKILL\n\n用 jxx-skill-init 新建技能。\n'), [], '约定小节不算清单');
  assert.deepEqual(findForeignSkillsHeadings('### 项目技能目录\n\n目录约定与同步命令。\n'), []);
});

test('isManagedOnlyDelta: 差异只落在受管小节 → 真；改了别的段 → 假', () => {
  const scan = { dir: DEFAULT_SKILLS_DIR, skills: [{ name: 'a', summary: 'A 技能' }] };
  const withSection = buildAgentSkillsBlock({ scan });
  const noSection = withSection.slice(0, withSection.indexOf('\n### 项目技能') + 1);
  assert.equal(isManagedOnlyDelta(noSection, withSection), true, '新增受管小节算受管内差异');
  assert.equal(isManagedOnlyDelta(`${noSection}\n## 其他\n\n改过了\n`, withSection), false);
});

test('init: 创建项目技能目录 + README，并在 AGENTS.md 写入受管清单小节', () => {
  const root = fixtureRoot('init-skills');
  const seeds = mkSeeds('init-skills');
  mkSkill(root, DEFAULT_SKILLS_DIR, 'commands', '跑命令时加载。');
  const r = runInit({ root, seedsDir: seeds });
  const content = read(root, 'AGENTS.md');
  assert.match(content, /### 项目技能（`docs\/agents\/skills\/`）/);
  assert.match(content, /\| `commands` \| 跑命令时加载 \|/);
  assert.match(content, /jxx-setup-skills:skills:start/);
  assert.match(read(root, 'docs/agents/skills/README.md'), /# 项目技能目录/);
  assert.equal(read(root, 'CODEBUDDY.md'), content, '两份规范文件逐字节一致');
  assert.equal(r.sync.projectSkills[0], 'commands');
  // runInit 先 detect 后写入，故这里对写入后的现状再 detect 一次
  const after = runDetect({ root });
  assert.equal(after.skillsSection, 'present');
  assert.equal(after.skillsTableInSync, true);
});

test('init: --skills-dir 自定义目录；--no-skills 完全不碰技能目录', () => {
  const root = fixtureRoot('init-skills-dir');
  const seeds = mkSeeds('init-skills-dir');
  mkSkill(root, '.agent/skills', 'demo', '演示技能。');
  const r = runInit({ root, seedsDir: seeds, skillsDir: '.agent/skills' });
  assert.match(read(root, 'AGENTS.md'), /### 项目技能（`.agent\/skills\/`）/);
  assert.ok(fs.existsSync(path.join(root, '.agent/skills/README.md')));
  const root2 = fixtureRoot('init-no-skills');
  const r2 = runInit({ root: root2, seedsDir: seeds, noSkills: true });
  assert.ok(!read(root2, 'AGENTS.md').includes('### 项目技能'));
  assert.equal(fs.existsSync(path.join(root2, DEFAULT_SKILLS_DIR)), false);
  assert.equal(r2.sync.skillsDir, null);
});

test('init: v1.4 仓库（工程块里还没有项目技能小节）→ 只补受管小节，不报冲突', () => {
  const root = fixtureRoot('init-upgrade');
  const seeds = mkSeeds('init-upgrade');
  const block = buildAgentSkillsBlock({ scan: null });
  write(root, 'AGENTS.md', `${MULTI_AGENT_BLOCK}\n\n${block}`);
  write(root, 'CODEBUDDY.md', read(root, 'AGENTS.md'));
  mkSkill(root, DEFAULT_SKILLS_DIR, 'commands', '跑命令时加载。');
  const r = runInit({ root, seedsDir: seeds });
  assert.equal(r.sync.conflicts.length, 0, '只补受管小节不算冲突');
  const action = Object.fromEntries(r.sync.actions.map((a) => [a.file, a.action]))['AGENTS.md'];
  assert.equal(action, 'updated');
  assert.match(read(root, 'AGENTS.md'), /### 项目技能（`docs\/agents\/skills\/`）/);
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'), '镜像跟写，两份仍一致');
});

test('sync-skills: 增/删技能后一条命令刷新清单与 README，并保持两份规范文件一致', () => {
  const root = fixtureRoot('sync-skills');
  const seeds = mkSeeds('sync-skills');
  runInit({ root, seedsDir: seeds });
  mkSkill(root, DEFAULT_SKILLS_DIR, 'commands', '跑命令时加载。');
  const r1 = runSyncSkills({ root });
  assert.deepEqual(r1.projectSkills, ['commands']);
  assert.equal(r1.conflicts.length, 0);
  assert.match(read(root, 'AGENTS.md'), /\| `commands` \| 跑命令时加载 \|/);
  assert.match(read(root, 'docs/agents/skills/README.md'), /\| `commands` \|/);
  assert.equal(read(root, 'CODEBUDDY.md'), read(root, 'AGENTS.md'));
  // 幂等
  assert.equal(runSyncSkills({ root }).actions.find((a) => a.file === 'AGENTS.md').action, 'unchanged');
  // 删除技能后清单同步移除
  fs.rmSync(path.join(root, DEFAULT_SKILLS_DIR, 'commands'), { recursive: true, force: true });
  assert.deepEqual(runSyncSkills({ root }).projectSkills, []);
  assert.ok(!read(root, 'AGENTS.md').includes('| `commands` |'));
  assert.ok(!read(root, 'docs/agents/skills/README.md').includes('| `commands` |'));
});

test('sync-skills: README 的手写补充（分界标记之后）刷新时保留', () => {
  const root = fixtureRoot('sync-skills-readme');
  const seeds = mkSeeds('sync-skills-readme');
  runInit({ root, seedsDir: seeds });
  write(root, 'docs/agents/skills/README.md', `${read(root, 'docs/agents/skills/README.md')}\n## 我自己的约定\n\n不许乱动。\n`);
  mkSkill(root, DEFAULT_SKILLS_DIR, 'a', 'A 技能。');
  runSyncSkills({ root });
  const readme = read(root, 'docs/agents/skills/README.md');
  assert.match(readme, /## 我自己的约定\n\n不许乱动。/, '手写补充保留');
  assert.match(readme, /\| `a` \| A 技能 \|/, '生成部分已刷新');
});

test('sync-skills: 已有手写技能清单且未接管 → 报冲突且不插第二份；加标记后接管', () => {
  const root = fixtureRoot('sync-skills-foreign');
  const seeds = mkSeeds('sync-skills-foreign');
  write(root, 'AGENTS.md', '# P\n\n## 技能（固定流程都在这里）\n\n| 技能 | 什么时候加载 |\n| --- | --- |\n| `commands` | 跑命令 |\n');
  write(root, 'CODEBUDDY.md', read(root, 'AGENTS.md'));
  mkSkill(root, DEFAULT_SKILLS_DIR, 'commands', '跑命令时加载。');
  const r = runSyncSkills({ root });
  assert.deepEqual(r.conflicts.map((c) => c.file), ['AGENTS.md']);
  assert.ok(!read(root, 'AGENTS.md').includes('jxx-setup-skills:skills:start'), '不插第二份清单');
  // 模型把既有清单纳入受管：加标记后重跑即接管
  const adopted = read(root, 'AGENTS.md')
    .replace('| --- | --- |', `| --- | --- |\n${SKILLS_MARK_START}`)
    .replace('| `commands` | 跑命令 |', `| \`commands\` | 跑命令 |\n${SKILLS_MARK_END}`);
  write(root, 'AGENTS.md', adopted);
  write(root, 'CODEBUDDY.md', adopted);
  const r2 = runSyncSkills({ root });
  assert.equal(r2.conflicts.length, 0);
  assert.match(read(root, 'AGENTS.md'), /\| `commands` \| 跑命令时加载 \|/, '既有清单已被接管刷新');
});

test('sync-skills: 既无 CLAUDE.md 也无 AGENTS.md → 明确报错要求先 init', () => {
  const r = runSyncSkills({ root: fixtureRoot('sync-skills-empty') });
  assert.match(r.error, /先跑 init/);
  assert.equal(r.canonical, null);
});

test('e2e: CLI sync-skills 输出清单摘要，幂等退出码 0', () => {
  const root = fixtureRoot('cli-sync-skills');
  execFileSync(process.execPath, [SETUP_MJS, 'init', '--root', root], { encoding: 'utf-8' });
  mkSkill(root, DEFAULT_SKILLS_DIR, 'commands', '跑命令时加载。');
  const out = execFileSync(process.execPath, [SETUP_MJS, 'sync-skills', '--root', root], { encoding: 'utf-8' });
  assert.match(out, /\[updated\] AGENTS\.md/);
  assert.match(out, /技能清单已与目录一致/);
  assert.match(execFileSync(process.execPath, [SETUP_MJS, 'sync-skills', '--root', root], { encoding: 'utf-8' }), /\[unchanged\] AGENTS\.md/);
});
