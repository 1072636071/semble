// render-template.test.mjs — render-template.mjs 单元测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderTemplate, instantiateTemplate } from '../shared/render-template.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

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
