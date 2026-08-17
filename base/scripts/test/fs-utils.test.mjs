// fs-utils.test.mjs — fs-utils.mjs 单元测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  copyDir, sha256, listFilesRel, rmrf, loadJsonConfig, writeFileSafe,
} from '../shared/fs-utils.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-utils-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

test('fs-utils: copyDir 递归复制保结构', () => {
  const src = path.join(tmp, 'copy-src');
  const dst = path.join(tmp, 'copy-dst');
  write(src, 'a.txt', 'aaa');
  write(src, 'sub/b.txt', 'bbb');
  copyDir(src, dst);
  assert.equal(fs.readFileSync(path.join(dst, 'a.txt'), 'utf-8'), 'aaa');
  assert.equal(fs.readFileSync(path.join(dst, 'sub', 'b.txt'), 'utf-8'), 'bbb');
});

test('fs-utils: sha256 对相同内容稳定、对不同内容不同', () => {
  write(tmp, 'hash1.txt', 'hello');
  write(tmp, 'hash2.txt', 'hello');
  write(tmp, 'hash3.txt', 'world');
  assert.equal(sha256(path.join(tmp, 'hash1.txt')), sha256(path.join(tmp, 'hash2.txt')));
  assert.notEqual(sha256(path.join(tmp, 'hash1.txt')), sha256(path.join(tmp, 'hash3.txt')));
});

test('fs-utils: listFilesRel 返回相对路径且含子目录', () => {
  const root = path.join(tmp, 'tree');
  write(root, 'x.md', 'x');
  write(root, 'n/y.txt', 'y');
  const files = listFilesRel(root).sort();
  assert.deepEqual(files, ['n/y.txt', 'x.md']);
});

test('fs-utils: rmrf 可删除目录', () => {
  const dir = path.join(tmp, 'gone');
  write(dir, 'f', '');
  assert.ok(fs.existsSync(dir));
  rmrf(dir);
  assert.ok(!fs.existsSync(dir));
});

test('fs-utils: loadJsonConfig 读取 JSON 配置', () => {
  write(tmp, 'cfg.json', '{"a": 1, "b": "x"}');
  assert.deepEqual(loadJsonConfig(path.join(tmp, 'cfg.json')), { a: 1, b: 'x' });
});

test('fs-utils: loadJsonConfig 对非法 JSON 抛错', () => {
  write(tmp, 'bad.json', '{not json');
  assert.throws(() => loadJsonConfig(path.join(tmp, 'bad.json')));
});

test('fs-utils: writeFileSafe 自动创建父目录并写回路径', () => {
  const f = path.join(tmp, 'deep', 'nested', 'f.txt');
  const p = writeFileSafe(f, 'hello');
  assert.equal(p, f);
  assert.equal(fs.readFileSync(f, 'utf-8'), 'hello');
});
