// scaffold.test.mjs — scaffold.mjs 单元 + 临时目录 CLI fixture 测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readMemorialStatus,
  findMemorial,
  runMemorialInit,
  runMemorialArchive,
  normalizeExerciseSeq,
  runScaffoldExercises,
  detectPackageManager,
  LINTSTAGED_RC,
  PRETTIER_RC,
  runSetupPrecommit,
} from '../scaffold.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}
function read(root, rel) { return fs.readFileSync(path.join(root, rel), 'utf-8'); }

// 为每个测试独立 root，保证确定性。
// 注：sync-doc / detect / Agent skills 块相关测试已随实现迁移至
// skills/engineering/jxx-setup-skills/tests/setup.test.mjs（技能自包含）。
function fixtureRoot(tag) {
  const root = path.join(tmp, tag);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

// ================================================================ memorial-init

test('memorial-init: 空目录创建 001-slug，目录结构 + context.md + checklist.md', () => {
  const root = fixtureRoot('mem-basic');
  const subject = '我想实现登录改造';
  const r = runMemorialInit({ root, subject });
  assert.equal(r.nnn, '001');
  assert.equal(r.slug, 'untitled', '纯中文剥离后回落 untitled');
  assert.equal(path.basename(r.dir), '001-untitled');
  assert.equal(fs.statSync(path.join(r.dir, 'adr')).isDirectory(), true);
  assert.equal(fs.statSync(path.join(r.dir, 'sub-task')).isDirectory(), true);
  const ctx = read(root, 'docs/memorial/001-untitled/context.md');
  assert.match(ctx, /^# 001-untitled/m);
  assert.match(ctx, /状态：进行中/);
  assert.match(ctx, /^## 诉求/m);
  assert.match(ctx, new RegExp(subject), '诉求段保留用户原话');
  assert.match(ctx, /^## 追问记录/m);
  assert.match(ctx, /^## 决策汇总/m);
  assert.match(ctx, /^## 待澄清/m);
});

test('memorial-init: 递增编号（已有 001/002 → 003）', () => {
  const root = fixtureRoot('mem-inc');
  write(root, 'docs/memorial/001-foo/context.md', '# x\n');
  write(root, 'docs/memorial/002-bar/context.md', '# x\n');
  write(root, 'docs/memorial/not-numbered/context.md', '# x\n'); // 忽略不匹配模式
  const r = runMemorialInit({ root, subject: 'baz scheme' });
  assert.equal(r.nnn, '003');
  assert.equal(path.basename(r.dir), '003-baz-scheme');
});

test('memorial-init: 编号计入 archived/（归档过的编号不复用）', () => {
  const root = fixtureRoot('mem-arc-seq');
  write(root, 'docs/memorial/005-done/context.md', '# done\n');
  fs.mkdirSync(path.join(root, 'docs/memorial/archived/004-old'), { recursive: true });
  const r = runMemorialInit({ root, subject: 'new plan' });
  assert.equal(r.nnn, '006', 'archived 中最大 004 / live 中最大 005 → 全局 006');
});

test('memorial-init: 同 slug 既有编号自动顺延到下一号（绝不覆盖既有目录）', () => {
  const root = fixtureRoot('mem-collide');
  write(root, 'docs/memorial/001-dup/context.md', '# x\n');
  const r = runMemorialInit({ root, subject: 'dup' });
  assert.equal(r.nnn, '002', '001-dup 已存在 → 顺延 002-dup，而非覆盖');
  assert.equal(fs.existsSync(path.join(root, 'docs/memorial/001-dup')), true, '既有目录原样保留');
});

test('memorial-init: checklist.md 实例化 C1–C6 检查项', () => {
  const root = fixtureRoot('mem-check');
  const r = runMemorialInit({ root, subject: 'revise schema' });
  assert.equal(path.basename(r.dir), '001-revise-schema');
  const cl = read(root, 'docs/memorial/001-revise-schema/checklist.md');
  assert.match(cl, /^# Checklist 001-revise-schema/);
  for (const id of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) assert.match(cl, new RegExp(`\\| ${id} `));
  assert.match(cl, /C6[^|]*\|[^|]*证据可复核/, 'C6 = 证据可复核（1.2.0 新增）');
});

test('memorial-init: subject 为空抛错；--dry-run 不落盘', () => {
  assert.throws(() => runMemorialInit({ root: tmp, subject: '  ' }), /不能为空/);
  const root = fixtureRoot('mem-dry');
  const r = runMemorialInit({ root, subject: 'dry run', dryRun: true });
  assert.equal(r.dryRun, true);
  assert.equal(fs.existsSync(path.join(root, 'docs/memorial')), false);
});

test('readMemorialStatus / findMemorial: 状态行解析与引用定位', () => {
  const root = fixtureRoot('mem-utils');
  const md = path.join(root, 'docs/memorial');
  write(root, 'docs/memorial/003-x/context.md', '状态：已完成\n');
  write(root, 'docs/memorial/004-y/context.md', '状态: 进行中\n');
  assert.equal(readMemorialStatus(path.join(md, '003-x/context.md')), '已完成');
  assert.equal(readMemorialStatus(path.join(md, '004-y/context.md')), '进行中');
  assert.equal(readMemorialStatus(path.join(md, 'nope/context.md')), null);
  // 精确目录名 + NNN 前缀两种引用
  assert.equal(path.basename(findMemorial(md, '003-x')), '003-x');
  assert.equal(path.basename(findMemorial(md, '004')), '004-y');
  assert.equal(findMemorial(md, '999'), null);
});

// ================================================================ memorial-archive

function doneMem(root, dirName) {
  write(root, `docs/memorial/${dirName}/context.md`, '# x\n\n状态：已完成\n');
}

test('memorial-archive: 「已完成」memorial 移到 archived/<dir>', () => {
  const root = fixtureRoot('arc-ok');
  doneMem(root, '003-done');
  const r = runMemorialArchive({ root, ref: '003-done' });
  assert.equal(r.status, '已完成');
  assert.equal(path.basename(r.to), '003-done');
  assert.equal(fs.existsSync(path.join(root, 'docs/memorial/archived/003-done/context.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'docs/memorial/003-done')), false, '原目录已移动');
});

test('memorial-archive: 按 NNN 前缀引用也能归档', () => {
  const root = fixtureRoot('arc-prefix');
  doneMem(root, '002-topic');
  const r = runMemorialArchive({ root, ref: '002' });
  assert.equal(path.basename(r.to), '002-topic');
});

test('memorial-archive: 非「已完成」默认拒绝，--force 放行', () => {
  const root = fixtureRoot('arc-guard');
  write(root, 'docs/memorial/001-wip/context.md', '# x\n\n状态：进行中\n');
  assert.throws(() => runMemorialArchive({ root, ref: '001-wip' }), /状态非「已完成」/);
  const r = runMemorialArchive({ root, ref: '001-wip', force: true });
  assert.equal(fs.existsSync(path.join(root, 'docs/memorial/archived/001-wip')), true);
});

test('memorial-archive: 找不到目标 / 归档目标已存在抛错', () => {
  const root = fixtureRoot('arc-err');
  assert.throws(() => runMemorialArchive({ root, ref: '999' }), /未找到 memorial/);
  fs.mkdirSync(path.join(root, 'docs/memorial/archived'), { recursive: true });
  write(root, 'docs/memorial/001-x/context.md', '状态：已完成\n');
  fs.mkdirSync(path.join(root, 'docs/memorial/archived/001-x'), { recursive: true });
  assert.throws(() => runMemorialArchive({ root, ref: '001-x' }), /归档目标已存在/);
});

test('memorial-archive: --dry-run 不移动', () => {
  const root = fixtureRoot('arc-dry');
  doneMem(root, '001-k');
  const r = runMemorialArchive({ root, ref: '001-k', dryRun: true });
  assert.equal(r.dryRun, true);
  assert.equal(fs.existsSync(path.join(root, 'docs/memorial/001-k')), true, '未移动');
  assert.equal(fs.existsSync(path.join(root, 'docs/memorial/archived')), false);
});

// ================================================================ CLI 集成（临时目录跑真实子命令）

test('CLI: memorial-init / memorial-archive 端到端', () => {
  const goal = fixtureRoot('cli-goal');
  // memorial-init
  const initR = runMemorialInit({ root: goal, subject: 'ship scaffolding' });
  assert.equal(path.basename(initR.dir), '001-ship-scaffolding');
  assert.match(read(goal, 'docs/memorial/001-ship-scaffolding/context.md'), /状态：进行中/);
  // 标记已完成
  const ctxPath = path.join(goal, 'docs/memorial/001-ship-scaffolding/context.md');
  const marked = read(goal, 'docs/memorial/001-ship-scaffolding/context.md').replace('状态：进行中', '状态：已完成');
  fs.writeFileSync(ctxPath, marked, 'utf-8');
  // 归档
  const arcR = runMemorialArchive({ root: goal, ref: '001-ship-scaffolding' });
  assert.equal(fs.existsSync(path.join(goal, 'docs/memorial/archived/001-ship-scaffolding/context.md')), true);
  // 归档后编号不复用
  const next = runMemorialInit({ root: goal, subject: 'second plan' });
  assert.equal(next.nnn, '002');
});

// ================================================================ scaffold-exercises
test('scaffold-exercises: 按计划生成章节/练习/变体 readme 骨架', () => {
  const root = fixtureRoot('se');
  const plan = [
    { section: 5, sectionName: 'Memory Skill Building', items: [
      { num: '01', name: 'Introduction to Memory' },
      { num: '02', name: 'Short-term Memory', variants: ['explainer', 'problem', 'solution'] },
      { num: '03', name: 'Long-term Memory' },
    ] },
  ];
  const r = runScaffoldExercises({ root, plan });
  assert.equal(r.created.length, 5); // 3 缺省(explainer) + 1x3 显式
  const base = path.join(root, 'exercises/05-memory-skill-building');
  assert.equal(fs.existsSync(path.join(base, '05.01-introduction-to-memory/explainer/readme.md')), true);
  assert.equal(fs.existsSync(path.join(base, '05.02-short-term-memory/problem/readme.md')), true);
  assert.equal(fs.existsSync(path.join(base, '05.03-long-term-memory/explainer/readme.md')), true);
  // readme 非空且含标题
  assert.match(read(root, 'exercises/05-memory-skill-building/05.01-introduction-to-memory/explainer/readme.md'), /^# Introduction to Memory/);
});

test('scaffold-exercises: 编号规范与 dry-run 不落盘', () => {
  assert.equal(normalizeExerciseSeq(5, '01'), '05.01');
  assert.equal(normalizeExerciseSeq('7'), '07');
  const root = fixtureRoot('se-dry');
  const plan = [{ section: 1, sectionName: 'A B', items: [{ num: '01', name: 'Plan X' }] }];
  const r = runScaffoldExercises({ root, plan, dryRun: true });
  assert.equal(r.created.length, 1);
  assert.equal(fs.existsSync(path.join(root, 'exercises')), false, 'dry-run 不应落盘');
});

// ================================================================ setup-pre-commit
test('setup-precommit: 检测包管理器（pnpm 优先）', () => {
  assert.equal(detectPackageManager(['package-lock.json']), 'npm');
  assert.equal(detectPackageManager(['pnpm-lock.yaml']), 'pnpm');
  assert.equal(detectPackageManager(['yarn.lock']), 'yarn');
  assert.equal(detectPackageManager(['bun.lockb']), 'bun');
  assert.equal(detectPackageManager([]), 'npm');
});

test('setup-precommit: 生成 .husky/pre-commit + .lintstagedrc + .prettierrc', () => {
  const root = fixtureRoot('pc');
  write(root, 'pnpm-lock.yaml', '');
  const r = runSetupPrecommit({ root });
  assert.equal(r.manager, 'pnpm');
  const preCommit = read(root, '.husky/pre-commit');
  assert.match(preCommit, /^npx lint-staged/);
  assert.match(preCommit, /pnpm run typecheck/);
  assert.match(preCommit, /pnpm run test/);
  assert.deepEqual(JSON.parse(read(root, '.lintstagedrc')), LINTSTAGED_RC);
  assert.deepEqual(JSON.parse(read(root, '.prettierrc')), PRETTIER_RC);
});

test('setup-precommit: --skip-scripts 省略 typecheck/test；dry-run 不落盘', () => {
  const root = fixtureRoot('pc-dry');
  const r = runSetupPrecommit({ root, pkgManager: 'npm', scripts: { typecheck: false, test: false } });
  assert.equal(read(root, '.husky/pre-commit').includes('typecheck'), false);
  assert.equal(read(root, '.husky/pre-commit').includes('test'), false);
  const root2 = fixtureRoot('pc-dry2');
  const r2 = runSetupPrecommit({ root: root2, pkgManager: 'npm', dryRun: true });
  assert.equal(fs.existsSync(path.join(root2, '.husky')), false, 'dry-run 不应落盘');
});