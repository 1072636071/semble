// milestones.test.mjs — milestones.mjs 单元 + 集成测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseDeps,
  blockedByText,
  parseTicket,
  parseGroups,
  formatGroups,
  levelize,
  groupByLevel,
  mergeGroups,
  planGroups,
  topoOrder,
  checkGroups,
  renderMilestones,
  parseMilestones,
  runSetStatus,
  MILESTONE_STATUSES,
  DONE_STATUS,
} from '../milestones.mjs';

let tmp;
let topic;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'milestones-'));
  topic = path.join(tmp, '01-foo');
});
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

// ---------------------------------------------------------------- 基础

test('parseDeps: 解析编号引用，"无"为空且去重排序', () => {
  assert.deepEqual(parseDeps('01, 02'), ['01', '02']);
  assert.deepEqual(parseDeps('02, 01, 02'), ['01', '02']);
  assert.deepEqual(parseDeps('无——可立即开始'), []);
  assert.deepEqual(parseDeps(undefined), []);
});

test('blockedByText: 无阻塞写"无——可立即开始"，有则编号排序', () => {
  assert.equal(blockedByText([]), '无——可立即开始');
  assert.equal(blockedByText(['02', '01']), '01, 02');
});

test('parseTicket: 解析标题/状态/构建内容/依赖', () => {
  const md = [
    '# 接通 API',
    '',
    '**Status:** ready-for-agent',
    '',
    '**Blocked by:** 01, 02',
    '',
    '**构建内容：** 用户可经 HTTP 发起并看到结果',
    '',
    '**验收标准：**',
    '',
    '- [ ] 端到端可用',
    '',
    '## 评论',
    '',
  ].join('\n');
  const t = parseTicket(md, 2);
  assert.equal(t.num, '02');
  assert.equal(t.title, '接通 API');
  assert.equal(t.status, 'ready-for-agent');
  assert.deepEqual(t.deps, ['01', '02']);
  assert.equal(t.build, '用户可经 HTTP 发起并看到结果');
});

test('parseTicket: 兼容 `Status:` 与 `Blocked by:` 无星号写法', () => {
  const md = '# T\n\nStatus: done\n\nBlocked by: 无\n';
  const t = parseTicket(md, 3);
  assert.equal(t.status, 'done');
  assert.deepEqual(t.deps, []);
});

// ---------------------------------------------------------------- 分组

test('parseGroups / formatGroups: 往返一致，支持中英文逗号', () => {
  assert.deepEqual(parseGroups('01,02|03, 04|05'), [['01', '02'], ['03', '04'], ['05']]);
  assert.deepEqual(parseGroups('02, 01, 02'), [['01', '02']]);
  assert.equal(formatGroups([['01', '02'], ['03']]), '01,02|03');
});

test('levelize: 依赖分层，被依赖者在更低的层', () => {
  const tickets = [
    { num: '01', deps: [] },
    { num: '02', deps: ['01'] },
    { num: '03', deps: ['02'] },
    { num: '04', deps: ['01'] },
  ];
  const lv = levelize(tickets);
  assert.equal(lv.get('01'), 0);
  assert.equal(lv.get('02'), 1);
  assert.equal(lv.get('04'), 1);
  assert.equal(lv.get('03'), 2);
});

test('levelize: 循环依赖抛错', () => {
  const tickets = [
    { num: '01', deps: ['02'] },
    { num: '02', deps: ['01'] },
  ];
  assert.throws(() => levelize(tickets), /循环/);
});

test('groupByLevel: 每层一组，组内保持输入顺序', () => {
  const tickets = [
    { num: '01', deps: [] },
    { num: '02', deps: ['01'] },
    { num: '03', deps: ['02'] },
    { num: '04', deps: ['01'] },
  ];
  assert.deepEqual(groupByLevel(tickets), [['01'], ['02', '04'], ['03']]);
});

test('mergeGroups: 相邻层贪心合并且不超过 max，依赖闭合保持', () => {
  const groups = [['01'], ['02', '04'], ['03', '05'], ['06'], ['07']];
  assert.deepEqual(mergeGroups(groups, { target: 4, max: 6 }), [
    ['01', '02', '04', '03', '05'],
    ['06', '07'],
  ]);
  assert.deepEqual(mergeGroups(groups, { target: 2, max: 3 }), [
    ['01', '02', '04'],
    ['03', '05'],
    ['06', '07'],
  ]);
});

test('planGroups: 分层 + 合并全流程', () => {
  const tickets = [
    { num: '01', deps: [] },
    { num: '02', deps: ['01'] },
    { num: '03', deps: ['02'] },
  ];
  assert.deepEqual(planGroups(tickets, { target: 4, max: 6 }), [['01', '02', '03']]);
});

test('topoOrder: 集合内拓扑排序，依赖者在前', () => {
  const tickets = [
    { num: '02', deps: ['01'] },
    { num: '01', deps: [] },
    { num: '03', deps: ['02'] },
  ];
  assert.deepEqual(topoOrder(tickets), ['01', '02', '03']);
});

// ---------------------------------------------------------------- 硬约束校验

test('checkGroups: 依赖闭合且覆盖全部工单 → ok；组内依赖仅告警', () => {
  const tickets = [
    { num: '01', deps: [] },
    { num: '02', deps: ['01'] },
    { num: '03', deps: ['02'] },
  ];
  const r = checkGroups(tickets, [['01'], ['02', '03']]);
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
  assert.ok(r.warnings.some((w) => w.includes('W-INTRA-DEP') && w.includes('03') && w.includes('02')));
  assert.deepEqual(r.orders[1], ['02', '03']);
});

test('checkGroups: 依赖落在更晚里程碑 → E-FWD-DEP 错误', () => {
  const tickets = [
    { num: '01', deps: [] },
    { num: '02', deps: ['01'] },
    { num: '03', deps: ['02'] },
  ];
  const r = checkGroups(tickets, [['03'], ['01', '02']]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('E-FWD-DEP') && e.includes('03')));
});

test('checkGroups: 遗漏 / 重复 / 未知 / 空组 / 超限', () => {
  const tickets = [
    { num: '01', deps: [] },
    { num: '02', deps: [] },
  ];
  const r = checkGroups(tickets, [['01', '02'], ['02', '99']], { max: 1 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('E-DUP')));
  assert.ok(r.errors.some((e) => e.includes('E-UNKNOWN') && e.includes('99')));
  assert.ok(r.warnings.some((w) => w.includes('W-SIZE')));
  const r2 = checkGroups(tickets, [['01']], { max: 5 });
  assert.ok(r2.errors.some((e) => e.includes('E-MISSING') && e.includes('02')));
  const r3 = checkGroups(tickets, [[], ['01', '02']]);
  assert.ok(r3.errors.some((e) => e.includes('E-EMPTY')));
});

test('checkGroups: 循环依赖报 E-CYCLE 且不抛异常', () => {
  const tickets = [
    { num: '01', deps: ['02'] },
    { num: '02', deps: ['01'] },
  ];
  const r = checkGroups(tickets, [['01', '02']]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('E-CYCLE')));
  assert.ok(r.orders.length === 1);
});

test('checkGroups: 集合外依赖不构成约束', () => {
  const tickets = [
    { num: '01', deps: ['98'] },
    { num: '02', deps: ['01'] },
  ];
  const r = checkGroups(tickets, [['01'], ['02']]);
  assert.equal(r.ok, true);
});

// ---------------------------------------------------------------- 渲染与回读

test('renderMilestones: 生成可解析的骨架，四个占位段齐全', () => {
  const tickets = [
    { num: '01', title: '新增 Schema', status: 'done', deps: [], build: '' },
    { num: '02', title: '接通 API', status: 'ready-for-agent', deps: ['01'], build: '' },
  ];
  const md = renderMilestones({
    title: 'column-rename',
    sourceDir: '01-foo',
    groups: [['01'], ['02']],
    tickets,
    orders: [['01'], ['02']],
  });
  for (const seg of ['# 里程碑计划：column-rename', '## M1', '## M2', '## 进度总览', '## 交付规则']) {
    assert.match(md, new RegExp(seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(md, /\*\*用户视角交付：\*\* （待补/);
  assert.match(md, /\*\*可独立上线判据：\*\* （待补/);
  assert.match(md, /\*\*回滚方式：\*\* （待补/);
  assert.match(md, /- \[ \] （待补：一条可观测、可勾选的验收信号）/);
  const parsed = parseMilestones(md, tickets);
  assert.equal(parsed.milestones.length, 2);
  assert.deepEqual(parsed.milestones[1].nums, ['02']);
});

test('parseMilestones: 门禁就绪度与进度统计', () => {
  const md = [
    '# 里程碑计划：x',
    '',
    '**工单数：** 2 · **里程碑数：** 2 · **状态：** in-progress',
    '',
    '## M1',
    '',
    '**状态：** shipped',
    '',
    '**工单：** 01',
    '',
    '**验收信号：**',
    '',
    '- [x] 完成',
    '',
    '## M2',
    '',
    '**状态：** pending',
    '',
    '**工单：** 02',
    '',
    '**验收信号：**',
    '',
    '- [ ] 待办',
    '',
  ].join('\n');
  const tickets = [
    { num: '01', title: 'a', status: 'done', deps: [], build: '' },
    { num: '02', title: 'b', status: 'ready-for-agent', deps: [], build: '' },
  ];
  const p = parseMilestones(md, tickets);
  assert.equal(p.overall, 'in-progress');
  assert.equal(p.current, 'M2');
  assert.equal(p.milestones[0].status, 'shipped');
  assert.equal(p.milestones[0].ticketsDone, 1);
  assert.equal(p.milestones[0].signalsDone, 1);
  assert.equal(p.milestones[0].gate.ready, true);
  assert.equal(p.milestones[1].gate.ready, false);
});

// ---------------------------------------------------------------- 集成（临时 fixture）

test('runSetStatus: 更新里程碑状态并重算总体', () => {
  const issues = path.join(topic, 'issues');
  write(issues, '01-a.md', '# a\n\n**Status:** done\n\n**Blocked by:** 无——可立即开始\n');
  write(issues, '02-b.md', '# b\n\n**Status:** ready-for-agent\n\n**Blocked by:** 01\n');
  const md = renderMilestones({
    title: 'x',
    sourceDir: topic,
    groups: [['01'], ['02']],
    tickets: [
      { num: '01', title: 'a', status: 'done', deps: [], build: '' },
      { num: '02', title: 'b', status: 'ready-for-agent', deps: ['01'], build: '' },
    ],
  });
  write(topic, 'MILESTONES.md', md);

  const r = runSetStatus({ dir: topic, milestone: 'm1', status: 'shipped', dryRun: false });
  assert.equal(r.milestone, 'M1');
  assert.equal(r.status, 'shipped');
  assert.equal(r.overall, 'in-progress');
  const content = fs.readFileSync(path.join(topic, 'MILESTONES.md'), 'utf-8');
  assert.match(content, /\*\*状态：\*\* shipped/);
  assert.match(content, /工单数：\*\* 2 · \*\*里程碑数：\*\* 2 · \*\*状态：\*\* in-progress/);

  assert.throws(() => runSetStatus({ dir: topic, milestone: 'M1', status: 'invalid' }), /非法里程碑状态/);
  assert.throws(() => runSetStatus({ dir: topic, milestone: 'M9', status: 'shipped' }), /未找到里程碑/);
});

test('常量导出正确', () => {
  assert.ok(MILESTONE_STATUSES.includes('shipped'));
  assert.equal(DONE_STATUS, 'done');
});
