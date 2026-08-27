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
  buildAgentSkillsBlock,
  ensureMultiAgentBlock,
  upsertAgentSkillsBlock,
  runDetect,
  runSyncDoc,
  filesIdentical,
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
  const block = buildAgentSkillsBlock();
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
