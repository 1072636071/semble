// issue-flow.test.mjs — issue-flow.mjs 单元 + CLI 夹具测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  topicNum,
  issueNum,
  toSlug,
  blockedByText,
  parseDeps,
  sortByDeps,
  fillBlockedBy,
  runToSpec,
  runToTickets,
  runResolveBlock,
  DEFAULT_STATUS,
  resolveScratchRoot,
  suspectRootReason,
  resolveDirArg,
} from '../issue-flow.mjs';
import { fileURLToPath } from 'node:url';

/** 仓库根（base/scripts/test/ → 上三级）。 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

let tmp;
let scratch;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-flow-'));
  scratch = path.join(tmp, '.scratch');
  fs.mkdirSync(scratch, { recursive: true });
});
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

// ---------------------------------------------------------------- 编号

test('topicNum: 首次编号 = 01（空 .scratch）', () => {
  assert.equal(topicNum(scratch), '01');
});

test('topicNum: 跨 topic 全局递增（给出更大编号）', () => {
  write(scratch, '01-login/PRD.md', 'x');
  write(scratch, '02-js-ification/PRD.md', 'x');
  assert.equal(topicNum(scratch), '03', '从全局递增，不应回退');
});

test('issueNum: 某 topic 内首批工单从 01 起', () => {
  const issues = path.join(scratch, '03-foo', 'issues');
  fs.mkdirSync(issues, { recursive: true });
  assert.equal(issueNum(issues), '01');
});

test('issueNum: 递增编号跨目录（忽略不匹配模式）', () => {
  const issues = path.join(scratch, '03-foo', 'issues');
  write(issues, '01-a.md', 'x');
  write(issues, '02-b.md', 'x');
  write(issues, 'not-numbered.md', 'x');
  assert.equal(issueNum(issues), '03');
});

// ---------------------------------------------------------------- slug

test('toSlug: 中文回落 untitled，避免拼出 "NN-" 空目录', () => {
  assert.equal(toSlug('登录改造'), 'untitled');
  assert.equal(toSlug('目标/计划'), 'untitled');
  assert.equal(toSlug('Add Schema!'), 'add-schema');
});

// ---------------------------------------------------------------- Blocked by

test('blockedByText: 无阻塞写"无——可立即开始"，有则编号排序', () => {
  assert.equal(blockedByText([]), '无——可立即开始');
  assert.equal(blockedByText(['02', '01']), '01, 02');
});

test('parseDeps: 解析编号引用，"无"为空且去重排序', () => {
  assert.deepEqual(parseDeps('01, 02'), ['01', '02']);
  assert.deepEqual(parseDeps('02, 01, 02'), ['01', '02']);
  assert.deepEqual(parseDeps('无——可立即开始'), []);
});

test('fillBlockedBy: 替换已有 Blocked by 行；无行则插到 Status 后', () => {
  const base = '# T\n\n**Status:** ready-for-agent\n\n**构建内容：** …\n';
  const filled = fillBlockedBy(base, ['01', '03']);
  assert.match(filled, /\*\*Blocked by:\*\* 01, 03$/m);
  assert.match(filled, /^# T/m);
  const noLine = base;
  const added = fillBlockedBy(noLine, ['02']);
  assert.match(added, /\*\*Status:\*\* ready-for-agent\n\*\*Blocked by:\*\* 02/);
});

// ---------------------------------------------------------------- 依赖排序

test('sortByDeps: 拓扑排序，阻塞者在前', () => {
  const issues = [
    { num: '02', deps: ['01'] },
    { num: '01', deps: [] },
    { num: '03', deps: ['02'] },
  ];
  assert.deepEqual(sortByDeps(issues), ['01', '02', '03']);
});

test('sortByDeps: 无依赖者按原序先出', () => {
  const issues = [
    { num: '03', deps: ['01'] },
    { num: '01', deps: [] },
    { num: '02', deps: [] },
  ];
  assert.deepEqual(sortByDeps(issues), ['01', '02', '03']);
});

test('sortByDeps: 循环依赖抛错', () => {
  const issues = [
    { num: '01', deps: ['02'] },
    { num: '02', deps: ['01'] },
  ];
  assert.throws(() => sortByDeps(issues), /依赖|循环/);
});

// ---------------------------------------------------------------- CLI 集成（临时 .scratch fixture）

test('runToSpec: 生成 <NN>-<slug>/PRD.md，含 Status 与 spec 段落骨架', () => {
  const specRoot = path.join(tmp, 'spec-a'); // 独立空 root，编号从 01 确定性
  const r = runToSpec({ root: specRoot, slug: 'add-schema', title: '新增 Schema', dryRun: false });
  assert.equal(r.nn, '01');
  assert.equal(path.basename(r.dir), '01-add-schema');
  assert.equal(path.basename(r.file), 'PRD.md');
  const md = fs.readFileSync(r.file, 'utf-8');
  assert.match(md, /^# 新增 Schema\n\nStatus: ready-for-agent/m);
  for (const section of ['问题陈述', '解决方案', '用户故事', '实现决策', '测试决策', '超出范围', '补充说明']) {
    assert.match(md, new RegExp(`## ${section}`));
  }
});

test('runToSpec: --body 注入替代段落骨架', () => {
  const bodyFile = path.join(tmp, 'body.md');
  fs.writeFileSync(bodyFile, '## 问题陈述\n定制内容', 'utf-8');
  const r = runToSpec({ root: path.join(tmp, 'spec-b'), slug: 'custom', body: fs.readFileSync(bodyFile, 'utf-8'), dryRun: false });
  const md = fs.readFileSync(r.file, 'utf-8');
  assert.match(md, /定制内容/);
  assert.doesNotMatch(md, /## 补充说明/);
});

test('runToTickets: 生成 issues/<NN>-<slug>.md，Blocked by 正确、验收为 checkbox', () => {
  const topic = path.join(scratch, '04-plan');
  const r = runToTickets({
    dir: topic,
    slug: 'wire-api',
    num: '02',
    title: '接通 API',
    deps: '01, 03, 01',
    build: '用户可经 HTTP 发起并看到结果',
    accept: ['端到端可用', '有测试'],
    dryRun: false,
  });
  assert.equal(path.basename(r.file), '02-wire-api.md');
  const md = fs.readFileSync(r.file, 'utf-8');
  assert.match(md, /^# 接通 API\n\n\*\*Status:\*\* ready-for-agent/m);
  assert.match(md, /\*\*Blocked by:\*\* 01, 03/);
  assert.match(md, /\*\*构建内容：\*\* 用户可经 HTTP 发起并看到结果/);
  assert.match(md, /- \[ \] 端到端可用\n- \[ \] 有测试/);
});

test('runToTickets: 无 deps 写"无——可立即开始"，编号自动取下一值', () => {
  const topic = path.join(scratch, '05-nodeps');
  const r = runToTickets({ dir: topic, slug: 'add-schema', dryRun: false });
  assert.equal(path.basename(r.file), '01-add-schema.md', 'issues/ 内首批从 01');
  const md = fs.readFileSync(r.file, 'utf-8');
  assert.match(md, /\*\*Blocked by:\*\* 无——可立即开始/);
});

test('runResolveBlock: 规范化 Blocked by 行并输出拓扑序（阻塞者在前）', () => {
  const topic = path.join(scratch, '06-deps');
  const issues = path.join(topic, 'issues');
  write(issues, '01-base.md', '# base\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无——可立即开始\n');
  write(issues, '02-mid.md', '# mid\n\n**Status:** ready-for-agent\n\n**Blocked by:** 02, 01\n'); // 规范为 01, 02
  write(issues, '03-last.md', '# last\n\n**Status:** ready-for-agent\n\n**Blocked by:** 02\n');
  const r = runResolveBlock({ dir: topic, dryRun: false });
  assert.deepEqual(r.order, ['01', '02', '03']);
  const mid = fs.readFileSync(path.join(issues, '02-mid.md'), 'utf-8');
  assert.match(mid, /\*\*Blocked by:\*\* 01, 02/); // 已规范化
});

test('模块 DEFAULT_STATUS 导出正确', () => {
  assert.equal(DEFAULT_STATUS, 'ready-for-agent');
});

// ---------------------------------------------------------------- .scratch 根解析（回归：副本深度漂移）
// 历史 bug：DEFAULT_SCRATCH 用 __dirname 相对常量，复制进技能 scripts/ 后 `../../` 落到
// base/skills/engineering/，安装到 ~/.workbuddy/skills/<skill>/scripts/ 后落到 ~/.workbuddy/skills/。
// 现场无报错（nextSeq 返回 01、writeFileSafe 自动建树），只在编号与路径上静默出错。

test('resolveScratchRoot: 显式 root 优先，且相对 cwd 解析', () => {
  assert.equal(resolveScratchRoot({ root: '.scratch', cwd: tmp }), path.join(tmp, '.scratch'));
  assert.equal(
    resolveScratchRoot({ root: 'custom/scratch', cwd: tmp }),
    path.join(tmp, 'custom', 'scratch'),
  );
});

test('resolveScratchRoot: 从任意子目录向上命中最近的 .git / .scratch', () => {
  const repo = path.join(tmp, 'repo-x');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const deep = path.join(repo, 'a', 'b', 'c');
  fs.mkdirSync(deep, { recursive: true });
  assert.equal(resolveScratchRoot({ cwd: repo }), path.join(repo, '.scratch'));
  assert.equal(resolveScratchRoot({ cwd: deep }), path.join(repo, '.scratch'), '深层子目录也要回到仓库根');
});

test('resolveScratchRoot: 找不到仓库标记时抛错，不静默返回脚本旁边的目录', () => {
  // 必须落在「整条祖先链都没有 .git / .scratch」的空目录里——tmp 下已有 .scratch 夹具，
  // 直接用它会让本用例提前命中标记而测不到抛错分支。
  const bareRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-flow-bare-'));
  const bare = path.join(bareRoot, 'no-marker');
  fs.mkdirSync(bare, { recursive: true });
  assert.throws(() => resolveScratchRoot({ cwd: bare }), /\.git \/ \.scratch|--root/);
});

test('resolveScratchRoot: 技能脚本目录出发也回到仓库根 .scratch（历史 bug 场景）', () => {
  const skillScripts = path.join(repoRoot, 'base', 'skills', 'engineering', 'jxx-to-spec', 'scripts');
  assert.equal(resolveScratchRoot({ cwd: skillScripts }), path.join(repoRoot, '.scratch'));
  assert.equal(resolveScratchRoot({ cwd: repoRoot }), path.join(repoRoot, '.scratch'));
});

test('suspectRootReason: 命中 home 本身与工具安装目录段，普通目录不命中', () => {
  assert.equal(suspectRootReason(os.homedir()), '就是用户 home 目录本身');
  assert.match(suspectRootReason(path.join(tmp, '.workbuddy', 'skills', 'x')), /工具安装目录/);
  assert.match(suspectRootReason(path.join(tmp, '.codebuddy', 'skills', 'x')), /工具安装目录/);
  assert.equal(suspectRootReason(path.join(tmp, 'repo-x')), null);
});

test('resolveScratchRoot: cwd 在工具安装目录内时抛错，即使祖先有 .git（dotfiles 仓库误判）', () => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-flow-home-'));
  fs.mkdirSync(path.join(fakeHome, '.git'), { recursive: true }); // 模拟 home 下的 dotfiles 仓库
  const scripts = path.join(fakeHome, '.workbuddy', 'skills', 'jxx-to-spec', 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  assert.throws(() => resolveScratchRoot({ cwd: scripts }), /工具安装目录|--root/);
  // 显式 --root 仍是逃生口
  assert.equal(
    resolveScratchRoot({ root: path.join(fakeHome, '.scratch'), cwd: scripts }),
    path.join(fakeHome, '.scratch'),
  );
  fs.rmSync(fakeHome, { recursive: true, force: true });
});

test('resolveDirArg: 绝对路径放行；可疑 cwd 下拒绝相对路径', () => {
  const abs = path.join(tmp, '.scratch', '01-x');
  assert.equal(resolveDirArg(abs, { cwd: tmp }), abs, '绝对路径按原样');
  assert.equal(resolveDirArg('.scratch/01-x', { cwd: tmp }), abs, '普通 cwd 下相对路径按 cwd 解析');
  const skillDir = path.join(tmp, '.workbuddy', 'skills', 'jxx-to-spec', 'scripts');
  assert.throws(() => resolveDirArg('.scratch/01-x', { cwd: skillDir }), /相对路径/);
  assert.equal(resolveDirArg(abs, { cwd: skillDir }), abs, '绝对路径不受可疑 cwd 影响');
});

test('issue-flow.mjs 三份副本字节一致，且不得再用 __dirname 锚定 .scratch', () => {
  const src = path.join(repoRoot, 'base', 'scripts', 'issue-flow.mjs');
  const copies = [
    path.join(repoRoot, 'base', 'skills', 'engineering', 'jxx-to-spec', 'scripts', 'issue-flow.mjs'),
    path.join(repoRoot, 'base', 'skills', 'engineering', 'jxx-to-tickets', 'scripts', 'issue-flow.mjs'),
  ];
  for (const copy of copies) {
    assert.ok(fs.existsSync(copy), `副本缺失: ${copy}`);
    assert.ok(
      fs.readFileSync(src).equals(fs.readFileSync(copy)),
      `副本与本源漂移，跑 node base/scripts/check-copies.mjs --fix 同步: ${copy}`,
    );
  }
  assert.doesNotMatch(
    fs.readFileSync(src, 'utf-8'),
    /DEFAULT_SCRATCH\s*=\s*path\.join\(__dirname/,
    '本源不得再用 __dirname 相对常量锚定 .scratch（副本深度会变）',
  );
});