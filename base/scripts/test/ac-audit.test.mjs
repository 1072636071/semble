// ac-audit.test.mjs — 验收点机械校验的形式闸回归（node:test，零第三方依赖）。
//
// 覆盖真实失效面：
//   1) 合规工单必须 exit 0（否则生产闸卡死合法写法）
//   2) 缺 [回归] / 缺 [负向] 各自 exit 1（防止「只写正路」混过）
//   3) 伪造豁免（只声明一个无关类别不适用）不得打穿闭包
//   4) 类别标签里的「兼容」不许被禁词误判
//   5) 「AC 勾选区」的引用打卡不得被判成编号重复
//   6) reviews/ 下的审查报告不参与工单审计
//   7) PRD 有验收点节却零 AC 行 = 硬问题
//   8) 退出码 2（无工单类文件）与 3（用法错误）语义分离
//   9) 「逐字节相等」不误判禁词；「等等」「等。」「若干」仍命中
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(repoRoot, 'base', 'scripts', 'ac-audit.mjs');

const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repoRoot, encoding: 'utf-8' });

function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-audit-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return dir;
}

const HEAD = '**Status:** ready-for-agent\n\n**验收标准：**\n\n';
const OK = '- [ ] AC-1 [主路径] 当请求 GET /a 时，返回 200 且 body.id=1 —— 验证:机器 tests/a.test.ts::ok\n';
const ERR = '- [ ] AC-2 [错误路径] 当参数非法时，返回 400 且 body.code=E_X —— 验证:机器 tests/a.test.ts::bad\n';
const REG = '- [ ] AC-3 [回归] 当跑全量测试时，退出码 0 —— 验证:机器 pnpm test\n';
const NEG = '- [ ] AC-4 [负向] 本次 diff 不新增依赖 —— 验证:机器 git diff origin/main -- *lock*\n';

const TICKET = '# 01 导出\n\n' + HEAD + OK + ERR + REG + NEG;
const MATRIX = '# map\n\n## AC 覆盖矩阵\n\n| 用户故事 | 工单 | AC |\n|---|---|---|\n| US-1：用户可导出 | 03 | AC-2 |\n\n';
const GATE_OK = '## 覆盖闸\n\n| 源 | 条目（原文摘录） | 工单 | AC | 判定 |\n|---|---|---|---|---|\n'
  + '| 诉求 | 「导出要能选时间范围」 | 03 | AC-2 | covered |\n'
  + '| 决策 | 「不做增量导出，只做全量」 | — | — | rejected（用户第 4 轮确认） |\n'
  + '| PRD | 用户故事 2：用户可撤销上一次导入 | 04 | AC-1 | gap→已补 |\n';
const GATE_HEAD = '## 覆盖闸\n\n| 源 | 条目 | 工单 | AC | 判定 |\n|---|---|---|---|---|\n';

const withGate = (gate, matrix = MATRIX) => makeDir({ '01-x.md': TICKET, 'map.md': matrix + gate });

test('合规工单：主路径 + 错误路径 + 回归 + 负向 → exit 0', () => {
  const dir = makeDir({ '01-x.md': '# x\n\n' + HEAD + OK + ERR + REG + NEG });
  const r = run([dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('缺 [负向] → exit 1，且报缺负向', () => {
  const dir = makeDir({ '01-x.md': '# x\n\n' + HEAD + OK + ERR + REG });
  const r = run([dir]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /缺 \[负向\]/);
});

test('缺 [回归] → exit 1', () => {
  const dir = makeDir({ '01-x.md': '# x\n\n' + HEAD + OK + ERR + NEG });
  const r = run([dir]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /缺 \[回归\]/);
});

test('伪造豁免（只声明主路径不适用）打不穿闭包 → exit 1', () => {
  const dir = makeDir({ '01-x.md': '# x\n\n' + HEAD + OK + ERR + '\n**AC 覆盖声明：**\n\n- 主路径：不适用——没有界面\n' });
  const r = run([dir]);
  assert.equal(r.status, 1, '一行无关豁免不得免掉回归/负向');
});

test('逐类豁免有效：回归/负向都声明不适用且理由给足 → exit 0', () => {
  const dir = makeDir({
    '01-x.md': '# x\n\n' + HEAD + OK + ERR + '\n**AC 覆盖声明：**\n\n- 回归：不适用——本次只新增独立文件，无既有行为\n- 负向：不适用——同上\n- 边界值：不适用——无数量参数\n',
  });
  const r = run([dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('类别标签里的「兼容」不触发禁词', () => {
  const dir = makeDir({
    '01-x.md': '# x\n\n' + HEAD
      + '- [ ] AC-1 [兼容与迁移] 当旧客户端调用 POST /a 时，仍返回 200 且 body.v=1 —— 验证:机器 tests/legacy.test.ts::old\n'
      + ERR + REG + NEG,
  });
  const r = run([dir, '--json']);
  const out = JSON.parse(r.stdout);
  const banned = JSON.stringify(out).match(/命中禁词/g) || [];
  assert.equal(banned.length, 0, '类别标签不应参与禁词扫描');
  assert.equal(r.status, 0, r.stdout);
});

test('AC 勾选区引用打卡不算编号重复', () => {
  const dir = makeDir({
    '01-x.md': '# x\n\n' + HEAD + OK + ERR + REG + NEG
      + '\n**处理步骤：**\n\n- [x] 领卡\n\n**AC 勾选区：**\n\n- [x] AC-1 | tests/a.test.ts::ok exit 0\n- [x] AC-2 | tests/a.test.ts::bad exit 0\n\n## 评论\n',
  });
  const r = run([dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /编号重复/);
});

test('reviews/ 下的审查报告不参与工单审计', () => {
  const dir = makeDir({
    '01-x.md': '# x\n\n' + HEAD + OK + ERR + REG + NEG,
    'reviews/01-x.review.md': '# 审查报告\n\n- [ ] AC-1 待核对\n',
  });
  const r = run([dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('.jxx-tickets 投影目录不参与审计（pull 会覆盖，不是创作面）', () => {
  const dir = makeDir({
    '01-x.md': '# x\n\n' + HEAD + OK + ERR + REG + NEG,
    '.jxx-tickets/T192-01-something.md': '# 投影\n\n**Status:** open\n\n**验收标准：**\n\n- [ ] 老格式随意写\n',
  });
  const r = run([dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('PRD 有验收点节却零 AC 行 → exit 1', () => {
  const dir = makeDir({ 'PRD.md': '# PRD\n\n**Status:** ready-for-agent\n\n## 验收点（AC）\n\n（待补）\n' });
  const r = run([dir]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /验收点节/);
});

test('无参数 → exit 3（用法错误，与 defer 的 2 区分）', () => {
  const r = run([]);
  assert.equal(r.status, 3);
});

test('没有工单类文件 → exit 2', () => {
  const dir = makeDir({ 'notes.md': '# 笔记\n\n随便写点。\n' });
  const r = run([dir]);
  assert.equal(r.status, 2);
});

test('--strict：覆盖矩阵 + 覆盖闸节齐备 → exit 0', () => {
  const dir = withGate(GATE_OK);
  const r = run([dir, '--strict']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('--strict：map.md 缺 ## 覆盖闸 节 → exit 1', () => {
  const dir = makeDir({ '01-x.md': TICKET, 'map.md': MATRIX });
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /缺覆盖闸/);
});

test('--strict：判定值不在四种之内 → exit 1', () => {
  const dir = withGate(GATE_HEAD + '| 诉求 | 「导出要能选时间范围」 | 03 | AC-2 | done |\n');
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /不合法/);
});

test('--strict：裸 gap（未处置缺口）→ exit 1', () => {
  const dir = withGate(GATE_HEAD + '| PRD | 用户故事 3：批量导入 | — | — | gap |\n');
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /未处置的 gap/);
});

test('--strict：covered 行缺工单 → exit 1', () => {
  const dir = withGate(GATE_HEAD + '| 诉求 | 「导出要能选时间范围」 | — | AC-2 | covered |\n');
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /工单 列为空/);
});

test('--strict：gap -> 已补 容错合法 → exit 0', () => {
  const dir = withGate(GATE_HEAD + '| PRD | 用户故事 2：用户可撤销上一次导入 | 04 | AC-1 | gap -> 已补 |\n');
  const r = run([dir, '--strict']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('--strict：rejected 无附注 → 软问题（exit 0）', () => {
  const dir = withGate(GATE_HEAD + '| 决策 | 「不做增量导出」 | — | — | rejected |\n');
  const r = run([dir, '--strict']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /缺附注/);
});

test('--strict：没有工单类文件仍 exit 2，且不查覆盖闸', () => {
  const dir = makeDir({ 'notes.md': '# 笔记\n\n随便写点。\n' });
  const r = run([dir, '--strict']);
  assert.equal(r.status, 2);
  assert.doesNotMatch(r.stdout, /覆盖闸/);
});

// —— AC 引用核对（--strict 档）——
// 覆盖 map.md 引用不存在的工单 / AC、PRD AC 断号、PRD AC 范围缩写、缺 PRD AC 对照表。

const PRD = '# PRD\n\n**Status:** ready-for-agent\n\n## 验收点（AC）\n\n'
  + '- [ ] AC-1 [主路径] 当导出时，返回 200 —— 验证:机器 tests/a.test.ts::ok\n'
  + '- [ ] AC-2 [错误路径] 当参数非法时，返回 400 —— 验证:机器 tests/a.test.ts::bad\n'
  + '- [ ] AC-3 [回归] 当跑全量时，退出码 0 —— 验证:机器 pnpm test\n';

const ISSUE01 = '# 01 导出\n\n' + HEAD + OK + ERR + REG + NEG; // AC-1..AC-4

// map.md 带「## 覆盖闸」节 + 「## PRD AC 对照」表
const MAP_FULL = '# map\n\n## AC 覆盖矩阵\n\n| 用户故事 | 工单 | AC 编号 |\n|---|---|---|\n'
  + '| US-1 用户可导出 | 01 | AC-1 |\n\n'
  + '## PRD AC 对照\n\n| PRD AC | 实施工单与 AC |\n|---|---|\n'
  + '| AC-1 | 01: AC-1 |\n'
  + '| AC-2 | 01: AC-2 |\n'
  + '| AC-3 | 01: AC-3 |\n\n'
  + '## 覆盖闸\n\n| 源 | 条目（原文摘录） | 工单 | AC | 判定 |\n|---|---|---|---|---|\n'
  + '| 诉求 | 「导出要能选时间范围」 | 01 | AC-1 | covered |\n';

const withIssues = (map, extra = {}) => makeDir({
  'issues/01-export.md': ISSUE01,
  'PRD.md': PRD,
  'map.md': map,
  ...extra,
});

test('--strict AC 引用核对：合法矩阵 + PRD AC 逐条对照 → exit 0', () => {
  const dir = withIssues(MAP_FULL);
  const r = run([dir, '--strict']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('--strict AC 引用核对：覆盖闸引用不存在的工单号 → exit 1', () => {
  const dir = withIssues(MAP_FULL.replace(
    '| 诉求 | 「导出要能选时间范围」 | 01 | AC-1 | covered |',
    '| 诉求 | 「导出要能选时间范围」 | 09 | AC-1 | covered |',
  ));
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /工单 9 在 issues\/ 下不存在/);
});

test('--strict AC 引用核对：覆盖闸引用工单里不存在的 AC → exit 1', () => {
  const dir = withIssues(MAP_FULL.replace(
    '| 诉求 | 「导出要能选时间范围」 | 01 | AC-1 | covered |',
    '| 诉求 | 「导出要能选时间范围」 | 01 | AC-9 | covered |',
  ));
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /引用的 AC-9 在工单 1/);
});

test('--strict AC 引用核对：工单侧范围引用越界（AC-1—AC-9）→ exit 1', () => {
  const dir = withIssues(MAP_FULL.replace(
    '| 诉求 | 「导出要能选时间范围」 | 01 | AC-1 | covered |',
    '| 诉求 | 「导出要能选时间范围」 | 01 | AC-1—AC-9 | covered |',
  ));
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /引用的 AC-9 在工单 1/);
});

test('--strict AC 引用核对：PRD AC 断号（PRD 有 AC-3 但对照表漏指）→ exit 1', () => {
  const dir = withIssues(MAP_FULL.replace('| AC-3 | 01: AC-3 |\n', ''));
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /漏指 PRD AC-3/);
});

test('--strict AC 引用核对：PRD AC 列用范围缩写 → exit 1', () => {
  const dir = withIssues(MAP_FULL.replace(
    '| AC-1 | 01: AC-1 |\n| AC-2 | 01: AC-2 |\n| AC-3 | 01: AC-3 |\n',
    '| AC-1—AC-3 | 01: AC-1 / AC-2 / AC-3 |\n',
  ));
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /范围缩写/);
});

test('--strict AC 引用核对：PRD AC 对照表重复指同一条 PRD AC → exit 1', () => {
  const dir = withIssues(MAP_FULL.replace(
    '| AC-3 | 01: AC-3 |\n',
    '| AC-3 | 01: AC-3 |\n| AC-3 | 01: AC-4 |\n',
  ));
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /重复出现/);
});

test('--strict AC 引用核对：PRD AC 对照表指向不存在的工单 AC → exit 1', () => {
  const dir = withIssues(MAP_FULL.replace('| AC-2 | 01: AC-2 |', '| AC-2 | 01: AC-7 |'));
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /引用的 AC-7 在工单 1/);
});

test('--strict AC 引用核对：有覆盖闸节但缺 PRD AC 对照表 → exit 1', () => {
  const dir = withIssues(
    '# map\n\n## AC 覆盖矩阵\n\n| 用户故事 | 工单 | AC 编号 |\n|---|---|---|\n'
    + '| US-1 用户可导出 | 01 | AC-1 |\n\n'
    + '## 覆盖闸\n\n| 源 | 条目（原文摘录） | 工单 | AC | 判定 |\n|---|---|---|---|---|\n'
    + '| 诉求 | 「导出要能选时间范围」 | 01 | AC-1 | covered |\n',
  );
  const r = run([dir, '--strict']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /缺「PRD AC 对照」表/);
});

test('「逐字节相等」不误判禁词（等 前紧邻「相」不算模糊措辞）', () => {
  const dir = makeDir({
    '01-x.md': '# x\n\n' + HEAD
      + '- [ ] AC-1 [主路径] 产物逐字节相等 —— 验证:机器 node tools/check-eol.mjs\n'
      + ERR + REG + NEG,
  });
  const r = run([dir, '--json']);
  assert.doesNotMatch(r.stdout, /命中禁词/, '「逐字节相等」不该被判模糊措辞：' + r.stdout);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('「等等」「等。」「若干」仍被判命中禁词', () => {
  const dir = makeDir({
    '01-a.md': '# a\n\n' + HEAD
      + '- [ ] AC-1 [主路径] 返回 A、B 等等 —— 验证:机器 node tools/check-eol.mjs\n'
      + ERR + REG + NEG,
    '02-b.md': '# b\n\n' + HEAD
      + '- [ ] AC-1 [主路径] 返回 A、B 等。 —— 验证:机器 node tools/check-eol.mjs\n'
      + ERR + REG + NEG,
    '03-c.md': '# c\n\n' + HEAD
      + '- [ ] AC-1 [主路径] 返回若干条记录 —— 验证:机器 node tools/check-eol.mjs\n'
      + ERR + REG + NEG,
  });
  const r = run([dir]);
  assert.match(r.stdout, /命中禁词（等等/, r.stdout);
  assert.match(r.stdout, /命中禁词（等）/, r.stdout);
  assert.match(r.stdout, /命中禁词（若干）/, r.stdout);
});

test('--strict AC 引用核对：老目录（map.md 无覆盖闸节）不因引用核对判红', () => {
  // 143 / 145 等老目录：map.md 没有「## 覆盖闸」节，不触发 AC 引用核对
  const dir = makeDir({
    'issues/01-export.md': ISSUE01,
    'PRD.md': PRD,
    'map.md': '# map\n\n## AC 覆盖矩阵\n\n| 用户故事 | 工单 | AC 编号 |\n|---|---|---|\n| US-1 用户可导出 | 01 | AC-1 |\n',
  });
  const r = run([dir, '--strict']);
  // 老目录本来就因缺覆盖闸判红，但报错必须是「缺覆盖闸」而不是「引用核对」
  assert.equal(r.status, 1);
  assert.match(r.stdout, /缺覆盖闸/);
  assert.doesNotMatch(r.stdout, /AC 引用核对|漏指|范围缩写/);
});

