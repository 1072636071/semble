// goal.mjs 测试套件（node:test，零第三方依赖）。
// seam = CLI + fixture 注入：--root 指向临时目录，各子命令跑在其中，断言生成的文件树/内容/退出码。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOAL = path.join(__dirname, '..', 'goal.mjs');

const roots = [];
function makeRoot(prefix = 'goal-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}
before(() => {});
after(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

function run(args, options = {}) {
  const argv = [GOAL, ...(options.baseArgs || []), ...args];
  const res = spawnSync(process.execPath, argv, { encoding: 'utf-8' });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr, all: res.stdout + res.stderr };
}

// 一处可全部通过 V1–V10 的契约（goal-contract.md 的 linkcheck 示例）。
const GOOD_GOAL = `# Goal

一个命令行工具 \`linkcheck\`，扫描一个 Markdown 目录下的所有本地链接，报告失效链接（指向不存在文件/锚点）的列表。

# Acceptance

1. 运行 \`linkcheck ./docs\` 能扫描 docs 下所有 .md 文件的本地链接（相对路径 + 锚点）。（验证：\`python -m linkcheck ./docs --verbose\` 输出覆盖 docs 全部 .md 文件）
2. 对一个含 3 个已知失效链接的 fixture 目录，输出恰好包含这 3 条，无遗漏无多余。（验证：\`python -m linkcheck tests/fixtures/broken\`）
3. 退出码：发现失效链接返回 1，全部有效返回 0。（验证：\`python -m linkcheck tests/fixtures/broken; echo $?\` 输出 \`1\`）
4. \`linkcheck --help\` 输出用法说明。（验证：\`python -m linkcheck --help\` 退出码 0）

# Constraints

- 语言：Python 3.11+，仅标准库，不引入第三方依赖。
- 不修改被扫描目录的任何文件（只读）。
- 输出格式为纯文本，一行一条失效链接。

# Budget

- 最大轮数：8
- 时间上限：1.5h

# Pause Conditions

- 需要安装第三方依赖才能完成核心功能时暂停
`;

// 刻意不合格：验收 < 3、带主观/同义反复、一处无验证绑定、缺时间上限、暂停条件留空。
const BAD_GOAL = `# Goal

一个命令行工具 demo，检测链接。

# Acceptance

1. 能正常工作（验证：\`node x.js\`）
2. 看起来没问题，按预期完成

# Constraints

- 语言：Node

# Budget

- 最大轮数：3

# Pause Conditions
`;

// =========================================================================
// gate
// =========================================================================

test('gate：合格契约 V1–V10 全部通过，退出码 0', () => {
  const root = makeRoot();
  write(root, 'GOAL.md', GOOD_GOAL);
  const r = run(['gate', path.join(root, 'GOAL.md')]);
  assert.equal(r.code, 0);
  assert.match(r.all, /全部通过/);
  for (let i = 1; i <= 10; i++) {
    assert.match(r.all, new RegExp(`V${i}\\s+通过`), `V${i} 应通过`);
  }
});

test('gate：不合格契约否决对应门并退出码 1（V4/V8/V10/主观词）', () => {
  const root = makeRoot();
  write(root, 'GOAL.md', BAD_GOAL);
  const r = run(['gate', path.join(root, 'GOAL.md')]);
  assert.equal(r.code, 1);
  assert.match(r.all, /V4\s+否决/);   // < 3 条
  assert.match(r.all, /V8\s+否决/);   // 缺时间上限
  assert.match(r.all, /V10\s+否决/);  // 有无验证绑定的验收
  assert.match(r.all, /不可写入契约/);
});

test('gate：缺少目标文件报错退出码 2', () => {
  const r = run(['gate', path.join(makeRoot(), 'nope.md')]);
  assert.equal(r.code, 2); // 读取文件抛错走 catch → 退出码 2
});

// =========================================================================
// init
// =========================================================================

test('init：脚手架生成 GOAL.md / PROGRESS.md / _index.md', () => {
  const root = makeRoot();
  fs.mkdirSync(path.join(root, '.goals'), { recursive: true });
  const r = run(['init', '--root', root, '--name', 'blog-site', '--slices', 'hugo,deploy']);
  assert.equal(r.code, 0);
  assert.ok(fs.existsSync(path.join(root, '.goals', 'blog-site', 'GOAL.md')));
  assert.ok(fs.existsSync(path.join(root, '.goals', 'blog-site', 'PROGRESS.md')));
  assert.ok(fs.existsSync(path.join(root, '.goals', '_index.md')));

  const p = fs.readFileSync(path.join(root, '.goals', 'blog-site', 'PROGRESS.md'), 'utf-8');
  assert.match(p, /- 当前轮数：0/);
  assert.match(p, /- 状态：契约中/);
  assert.match(p, /\| 1 \| hugo \| - \| - \| - \|/);   // 切片编号从 1 起（.goals 无编号条目）
  assert.match(p, /\| 2 \| deploy \| - \| - \| - \|/);
  const idx = fs.readFileSync(path.join(root, '.goals', '_index.md'), 'utf-8');
  assert.match(idx, /\| blog-site \| 契约中 \|/);
});

test('init：切片编号用 nextSeq——.goals 下已有编号条目则顺延', () => {
  const root = makeRoot();
  write(root, '.goals/01-other/x', ''); // 制造最大编号 1 的条目
  const r = run(['init', '--root', root, '--name', 'linkcheck', '--slices', 'scan,report']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /切片编号: 2, 3/);
  const p = fs.readFileSync(path.join(root, '.goals', 'linkcheck', 'PROGRESS.md'), 'utf-8');
  assert.match(p, /\| 2 \| scan \| - \| - \| - \|/);
  assert.match(p, /\| 3 \| report \| - \| - \| - \|/);
});

test('init：目标重名报错退出码 2', () => {
  const root = makeRoot();
  fs.mkdirSync(path.join(root, '.goals', 'dup'), { recursive: true });
  const r = run(['init', '--root', root, '--name', 'dup']);
  assert.equal(r.code, 2);
  assert.match(r.all, /已存在/);
});

test('init：非法目标名报错退出码 2', () => {
  const root = makeRoot();
  const r = run(['init', '--root', root, '--name', 'Bad Name']);
  assert.equal(r.code, 2);
  assert.match(r.all, /非法 name/);
});

test('init：缺 --name 报用法', () => {
  const r = run(['init', '--root', makeRoot()]);
  assert.equal(r.code, 2);
  assert.match(r.all, /用法/);
});

// =========================================================================
// progress-update
// =========================================================================

test('progress-update：轮数自增 + 切片状态 + 循环日志追加', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'p1', '--slices', 'f1,f2']).code, 0);
  const r = run(['progress-update', '--root', root, '--name', 'p1', '--slice', '1:pass', '--verify', 'tests ok', '--log', '完成切片 1']);
  assert.equal(r.code, 0);
  const p = fs.readFileSync(path.join(root, '.goals', 'p1', 'PROGRESS.md'), 'utf-8');
  assert.match(p, /- 当前轮数：1/);
  assert.match(p, /- 状态：执行中/);
  assert.match(p, /\| 1 \| f1 \| ✅ \| tests ok \| - \|/);
  assert.match(p, /- \*\*轮 1\*\*：完成切片 1/);
});

test('progress-update：--set-round 指定轮数而非自增', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'p2']).code, 0);
  const r = run(['progress-update', '--root', root, '--name', 'p2', '--set-round', '5']);
  assert.equal(r.code, 0);
  const p = fs.readFileSync(path.join(root, '.goals', 'p2', 'PROGRESS.md'), 'utf-8');
  assert.match(p, /- 当前轮数：5/);
});

test('progress-update：缺 PROGRESS.md 报错退出码 2', () => {
  const root = makeRoot();
  fs.mkdirSync(path.join(root, '.goals', 'ghost'), { recursive: true });
  const r = run(['progress-update', '--root', root, '--name', 'ghost']);
  assert.equal(r.code, 2);
  assert.match(r.all, /缺少 .*PROGRESS/);
});

// =========================================================================
// evidence
// =========================================================================

test('evidence：写入 EVIDENCE.md 对照表并映射通过', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'e1', '--acceptances', '3']).code, 0);
  const r = run(['evidence', '--root', root, '--name', 'e1', '--set', '1:pass', '--output', 'all green']);
  assert.equal(r.code, 0);
  const ev = fs.readFileSync(path.join(root, '.goals', 'e1', 'EVIDENCE.md'), 'utf-8');
  assert.match(ev, /\| 1 \| .* \| 通过 \|/);
  assert.match(ev, /all green/);
  assert.match(ev, /\| 2 \| .* \| 未验证 \|/);
});

test('evidence：状态只能 pass|fail，非法值报错退出码 2', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'e2']).code, 0);
  const r = run(['evidence', '--root', root, '--name', 'e2', '--set', '1:bogus']);
  assert.equal(r.code, 2);
  assert.match(r.all, /非法状态/);
});

test('evidence：编号超出验收范围报错退出码 2', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'e3', '--acceptances', '2']).code, 0);
  const r = run(['evidence', '--root', root, '--name', 'e3', '--set', '9:pass']);
  assert.equal(r.code, 2);
  assert.match(r.all, /不存在/);
});

// =========================================================================
// review-write
// =========================================================================

test('review-write：全部通过 → 准奏，退出码 0', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'r1']).code, 0);
  const r = run(['review-write', '--root', root, '--name', 'r1']);
  assert.equal(r.code, 0);
  const rev = fs.readFileSync(path.join(root, '.goals', 'r1', 'REVIEW.md'), 'utf-8');
  assert.match(rev, /- 审查结果：准奏/);
  assert.match(rev, /- 综合判定：准奏/);
  assert.match(rev, /- D1 覆盖完整性：✅/);
  assert.match(rev, /- D5 可恢复性：✅/);
});

test('review-write：有建议无封驳 → 附条件准奏，退出码 0', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'r2']).code, 0);
  const r = run(['review-write', '--root', root, '--name', 'r2', '--d3', 'suggest', '--d3-note', '预算可能偏紧']);
  assert.equal(r.code, 0);
  const rev = fs.readFileSync(path.join(root, '.goals', 'r2', 'REVIEW.md'), 'utf-8');
  assert.match(rev, /- 审查结果：附条件准奏/);
  assert.match(rev, /- D3 约束一致性：⚠️ 预算可能偏紧/);
});

test('review-write：有封驳 → 封驳，退出码 1', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'r3']).code, 0);
  const r = run(['review-write', '--root', root, '--name', 'r3', '--d2', 'reject', '--d4', 'suggest']);
  assert.equal(r.code, 1);
  const rev = fs.readFileSync(path.join(root, '.goals', 'r3', 'REVIEW.md'), 'utf-8');
  assert.match(rev, /- 审查结果：封驳/);
  assert.match(rev, /- D2 可行性：❌/);
});

test('review-write：非法维度值报错退出码 2', () => {
  const root = makeRoot();
  assert.equal(run(['init', '--root', root, '--name', 'r4']).code, 0);
  const r = run(['review-write', '--root', root, '--name', 'r4', '--d1', 'maybe']);
  assert.equal(r.code, 2);
  assert.match(r.all, /非法值/);
});

// =========================================================================
// CLI 边界
// =========================================================================

test('未知子命令报错退出码 2', () => {
  const r = run(['frobnicate']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /未知子命令/);
});

test('缺子命令报错退出码 2', () => {
  const r = run([]);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /缺少子命令/);
});

test('--help 输出用法退出码 0', () => {
  const r = run(['--help']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /gate|init|progress-update|evidence|review-write/);
});