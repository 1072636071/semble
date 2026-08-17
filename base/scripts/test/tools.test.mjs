// 共享工具层测试套件（node:test，零第三方依赖）。
// 测试 seam = 纯函数单元断言 + 临时 fixture 注入（沿用 ship.test.mjs 范式）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import {
  copyDir, sha256, listFilesRel, rmrf, loadJsonConfig, writeFileSafe,
} from '../shared/fs-cli.mjs';
import {
  appendFragment,
} from '../shared/append-fragment.mjs';
import {
  nextSeq, slugify, numFromName,
} from '../shared/next-seq.mjs';
import {
  renderTemplate, instantiateTemplate,
} from '../shared/render-template.mjs';
import {
  renderReportHtml, writeReport, writeTempReport,
} from '../shared/report-html.mjs';
import { openCommand, openSpec } from '../shared/open-in-browser.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

// ---------------------------------------------------------------- fs-cli
test('fs-cli: copyDir 递归复制保结构', () => {
  const src = path.join(tmp, 'copy-src');
  const dst = path.join(tmp, 'copy-dst');
  write(src, 'a.txt', 'aaa');
  write(src, 'sub/b.txt', 'bbb');
  copyDir(src, dst);
  assert.equal(fs.readFileSync(path.join(dst, 'a.txt'), 'utf-8'), 'aaa');
  assert.equal(fs.readFileSync(path.join(dst, 'sub', 'b.txt'), 'utf-8'), 'bbb');
});

test('fs-cli: sha256 对相同内容稳定、对不同内容不同', () => {
  write(tmp, 'hash1.txt', 'hello');
  write(tmp, 'hash2.txt', 'hello');
  write(tmp, 'hash3.txt', 'world');
  assert.equal(sha256(path.join(tmp, 'hash1.txt')), sha256(path.join(tmp, 'hash2.txt')));
  assert.notEqual(sha256(path.join(tmp, 'hash1.txt')), sha256(path.join(tmp, 'hash3.txt')));
});

test('fs-cli: listFilesRel 返回相对路径且含子目录', () => {
  const root = path.join(tmp, 'tree');
  write(root, 'x.md', 'x');
  write(root, 'n/y.txt', 'y');
  const files = listFilesRel(root).sort();
  assert.deepEqual(files, ['n/y.txt', 'x.md']);
});

test('fs-cli: rmrf 可删除目录', () => {
  const dir = path.join(tmp, 'gone');
  write(dir, 'f', '');
  assert.ok(fs.existsSync(dir));
  rmrf(dir);
  assert.ok(!fs.existsSync(dir));
});

test('fs-cli: loadJsonConfig 读取 JSON 配置', () => {
  const cfg = path.join(tmp, 'cfg.json');
  write(tmp, 'cfg.json', '{"a": 1, "b": "x"}');
  assert.deepEqual(loadJsonConfig(cfg), { a: 1, b: 'x' });
});

test('fs-cli: writeFileSafe 自动创建父目录并写回路径', () => {
  const f = path.join(tmp, 'deep', 'nested', 'f.txt');
  const p = writeFileSafe(f, 'hello');
  assert.equal(p, f);
  assert.equal(fs.readFileSync(f, 'utf-8'), 'hello');
});

// ---------------------------------------------------------------- append-fragment
test('append-fragment: 空文件时直接写入无分隔符', () => {
  const f = path.join(tmp, 'af-new.md');
  const r = appendFragment(f, '# 第一块');
  assert.equal(r.existed, false);
  assert.equal(fs.readFileSync(f, 'utf-8').trim(), '# 第一块');
});

test('append-fragment: 已有内容时用默认分隔线追加', () => {
  const f = path.join(tmp, 'af-append.md');
  write(tmp, 'af-append.md', '# 第一块');
  appendFragment(f, '第二块');
  const content = fs.readFileSync(f, 'utf-8');
  assert.match(content, /\n---\n第二块\s*$/);
});

test('append-fragment: 自定义分隔符生效', () => {
  const f = path.join(tmp, 'af-custom.md');
  write(tmp, 'af-custom.md', 'one');
  appendFragment(f, 'two', { separator: '<!-- split -->' });
  assert.match(fs.readFileSync(f, 'utf-8'), /\n<!-- split -->\ntwo\s*$/);
});

test('append-fragment: noOverwrite 且已存在时报错', () => {
  const f = path.join(tmp, 'af-noow.md');
  write(tmp, 'af-noow.md', 'existing');
  assert.throws(() => appendFragment(f, 'nope', { noOverwrite: true }), /已存在/);
});

// ---------------------------------------------------------------- next-seq
test('next-seq: 取最大编号 +1 并补零为两位', () => {
  const dir = path.join(tmp, 'seq-a');
  write(dir, '01-one/PRD.md', '');
  write(dir, '03-three/PRD.md', '');
  assert.equal(nextSeq(dir), '04');
});

test('next-seq: 空目录从 1 开始（补零）', () => {
  const dir = path.join(tmp, 'seq-empty');
  fs.mkdirSync(dir, { recursive: true });
  assert.equal(nextSeq(dir), '01');
});

test('next-seq: 不匹配编号模式的目录被忽略', () => {
  const dir = path.join(tmp, 'seq-mixed');
  write(dir, '01-a/x', '');
  write(dir, 'notnumbered/x', '');
  assert.equal(nextSeq(dir), '02');
});

test('next-seq: 自定义补零宽度', () => {
  const dir = path.join(tmp, 'seq-pad');
  write(dir, '007-seven/x', '');
  assert.equal(nextSeq(dir), '08');            // 默认补 2 位
  assert.equal(nextSeq(dir, { pad: 3 }), '008');
  assert.equal(nextSeq(dir, { pad: 0 }), 8);
});

test('next-seq: slugify 生成 kebab-case（中文被剥离）', () => {
  assert.equal(slugify('Hello World! 测试'), 'hello-world');
  assert.equal(slugify('  Multi   Space  '), 'multi-space');
  assert.equal(slugify('目标/计划'), '');
});

test('next-seq: numFromName 提取前导编号', () => {
  assert.equal(numFromName('03-three'), 3);
  assert.equal(numFromName('jxx-ab'), null);
});

// ---------------------------------------------------------------- render-template
test('render-template: 替换 {{var}} 占位符', () => {
  const out = renderTemplate('你好 {{name}}，今年 {{year}}', { name: '姜小代', year: 2026 });
  assert.equal(out, '你好 姜小代，今年 2026');
});

test('render-template: 缺失变量留原样', () => {
  assert.equal(renderTemplate('{{a}}/{{b}}', { a: 1 }), '1/{{b}}');
});

test('instantiate-template: 写入新文件', () => {
  const outFile = path.join(tmp, 'inst-new.md');
  instantiateTemplate({ template: '## {{title}}', vars: { title: '标题' }, outFile });
  assert.equal(fs.readFileSync(outFile, 'utf-8'), '## 标题');
});

test('instantiate-template: 冲突时按序号不覆盖（-2/-3）', () => {
  const dir = path.join(tmp, 'inst-conflict');
  write(dir, 'report.md', 'v1');
  const outFile = path.join(dir, 'report.md');
  const first = instantiateTemplate({ template: 'v2', vars: {}, outFile, conflictBump: true });
  assert.match(first, /report-2\.md$/);
  const second = instantiateTemplate({ template: 'v3', vars: {}, outFile, conflictBump: true });
  assert.match(second, /report-3\.md$/);
  assert.equal(fs.readFileSync(outFile, 'utf-8'), 'v1', '原文件不被覆盖');
});

// ---------------------------------------------------------------- report-html
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
  fs.rmSync(p, { force: true }, '清理测试产物');
});

test('report-html: openCommand 跨平台命令选择', () => {
  assert.equal(openCommand('win32'), 'cmd');
  assert.equal(openCommand('darwin'), 'open');
  assert.equal(openCommand('linux'), 'xdg-open');
});

test('report-html: openSpec 提供统一参数构造（单来源）', () => {
  const win = openSpec('win32');
  assert.deepEqual(win.args('f'), ['/c', 'start', '', 'f']);
  const nix = openSpec('darwin');
  assert.deepEqual(nix.args('/a/b'), ['/a/b']);
});