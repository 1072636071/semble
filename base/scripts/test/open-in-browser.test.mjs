// open-in-browser.test.mjs — open-in-browser.mjs 单元测试（node:test，零第三方依赖）。
// 副作用函数 openInBrowser 通过 spawnFn 注入断言组合行为，不真实拉起进程。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { openSpec, openInBrowser } from '../shared/open-in-browser.mjs';

test('open-in-browser: openSpec 跨平台命令选择', () => {
  assert.equal(openSpec('win32').cmd, 'cmd');
  assert.equal(openSpec('darwin').cmd, 'open');
  assert.equal(openSpec('linux').cmd, 'xdg-open');
});

test('open-in-browser: openSpec 提供统一参数构造（单来源）', () => {
  const win = openSpec('win32');
  assert.deepEqual(win.args('f'), ['/c', 'start', '', 'f']);
  const nix = openSpec('darwin');
  assert.deepEqual(nix.args('/a/b'), ['/a/b']);
});

test('open-in-browser: openInBrowser 组合 openSpec 并以绝对路径调 spawn（注入验证）', () => {
  const calls = [];
  openInBrowser('r.html', {
    platform: 'win32',
    spawnFn: (cmd, args, opts) => { calls.push({ cmd, args, opts }); },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, 'cmd');
  assert.deepEqual(calls[0].args, ['/c', 'start', '', path.resolve('r.html')]);
  assert.equal(calls[0].opts.stdio, 'ignore');
});
