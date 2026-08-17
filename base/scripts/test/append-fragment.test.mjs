// append-fragment.test.mjs — append-fragment.mjs 单元测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendFragment } from '../shared/append-fragment.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'af-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

test('append-fragment: 文件不存在时直接写入无分隔符', () => {
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

test('append-fragment: 已存在但内容为空时视同新文件（不加分隔符）', () => {
  const f = path.join(tmp, 'af-empty.md');
  write(tmp, 'af-empty.md', '');
  const r = appendFragment(f, '# 首块');
  assert.equal(r.existed, true);
  assert.equal(fs.readFileSync(f, 'utf-8').trim(), '# 首块');
});

test('append-fragment: 自定义分隔符生效', () => {
  const f = path.join(tmp, 'af-custom.md');
  write(tmp, 'af-custom.md', 'one');
  appendFragment(f, 'two', { separator: '<!-- split -->' });
  assert.match(fs.readFileSync(f, 'utf-8'), /\n<!-- split -->\ntwo\s*$/);
});

test('append-fragment: errorIfExists 且已存在时报错（防覆盖守卫）', () => {
  const f = path.join(tmp, 'af-noow.md');
  write(tmp, 'af-noow.md', 'existing');
  assert.throws(() => appendFragment(f, 'nope', { errorIfExists: true }), /已存在/);
});
