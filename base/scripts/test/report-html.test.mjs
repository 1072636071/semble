// report-html.test.mjs — report-html.mjs 单元测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderReportHtml, writeReport, writeTempReport } from '../shared/report-html.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

test('report-html: 渲染自包含 HTML，含标题与卡片', () => {
  const html = renderReportHtml({ title: '架构评审', cards: [{ name: 'impeccable', issue: '无 token 提取', verdict: '建议' }] });
  assert.match(html, /<title>架构评审<\/title>/);
  assert.match(html, /impeccable/);
  assert.match(html, /建议/);
  assert.ok(html.includes('</html>'), '应为完整 HTML 文档');
});

test('report-html: 标题做 HTML 转义（无可注入脚本）', () => {
  const html = renderReportHtml({ title: '<script>x</script>&', cards: [] });
  assert.doesNotMatch(html, /<script>/, '不应把标题原样注入为可执行标签');
  assert.match(html, /&amp;/);
});

test('report-html: writeReport 落盘到指定目录并返回路径', () => {
  const outDir = path.join(tmp, 'report-out');
  const p = writeReport({ outDir, filename: 'r.html', title: 'T', cards: [] });
  assert.ok(fs.existsSync(p));
  assert.equal(path.basename(p), 'r.html');
  assert.match(fs.readFileSync(p, 'utf-8'), /<title>T<\/title>/);
});

test('report-html: writeTempReport 写临时目录、时间戳文件名', () => {
  const p = writeTempReport({ title: 'T', cards: [], prefix: 'ev-demo' });
  assert.ok(fs.existsSync(p), '临时报告应落盘');
  assert.match(path.basename(p), /^ev-demo-\d+\.html$/);
  assert.match(fs.readFileSync(p, 'utf-8'), /<title>T<\/title>/);
  fs.rmSync(p, { force: true }); // 清理测试产物
});

test('report-html: writeTempReport open=true 打开落盘文件（spawnFn 注入）', () => {
  const calls = [];
  const p = writeTempReport({
    title: 'T', cards: [], prefix: 'ev-open',
    open: true,
    spawnFn: (cmd, args) => { calls.push({ cmd, args }); },
  });
  assert.equal(calls.length, 1, '应恰好调用一次打开');
  assert.ok(calls[0].args.includes(p), '应打开刚落盘的报告文件');
  fs.rmSync(p, { force: true }); // 清理测试产物
});
