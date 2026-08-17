// next-seq.test.mjs — next-seq.mjs 单元测试（node:test，零第三方依赖）。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nextSeq, slugify, numFromName } from '../shared/next-seq.mjs';

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seq-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
}

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

test('next-seq: slugify 生成 kebab-case（中文被剥离，全空回落 untitled）', () => {
  assert.equal(slugify('Hello World! 测试'), 'hello-world');
  assert.equal(slugify('  Multi   Space  '), 'multi-space');
  assert.equal(slugify('目标/计划'), 'untitled', '纯中文剥离后应有非空回落，避免拼出 "NN-" 空 slug');
});

test('next-seq: numFromName 提取前导编号（须带连字符）', () => {
  assert.equal(numFromName('03-three'), 3);
  assert.equal(numFromName('jxx-ab'), null);
  assert.equal(numFromName('007seven'), null, '纯数字无连字符不属 NN- 前缀模式');
});
