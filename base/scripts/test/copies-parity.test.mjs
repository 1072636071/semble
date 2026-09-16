// copies-parity.test.mjs — 技能脚本副本一致性门禁的测试（node:test，零第三方依赖）。
//
// 覆盖三类回归：
//   1) check-copies 登记表：当前无漂移、无未登记副本；登记表必须覆盖实际存在的同名副本。
//   2) sync-html-template：HTML 资产副本（html-design.css/js）一致。
//   3) 目录锚定守则：生成文件的脚本不得再用固定层级的 __dirname 上跳来定位输出目录。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildRegistry, checkCopies } from '../check-copies.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const run = (args) => spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf-8' });

test('checkCopies: 当前所有登记副本与本源字节一致', () => {
  const { results } = checkCopies({ fix: false });
  const bad = results.filter((r) => r.status !== 'OK');
  assert.deepEqual(bad, [], `副本漂移/缺失，跑 node base/scripts/check-copies.mjs --fix：${JSON.stringify(bad)}`);
  assert.ok(results.length > 40, `登记表过小（${results.length} 处），疑似未覆盖实际副本`);
});

test('checkCopies: 没有未登记的副本（新复制脚本必须登记）', () => {
  const { unregistered } = checkCopies({ fix: false });
  assert.deepEqual(unregistered, [], `出现未登记副本：${unregistered.join(', ')}`);
});

test('checkCopies: 登记表中每个本源存在、每个副本路径都在技能 scripts/ 下', () => {
  for (const { src, dest } of buildRegistry()) {
    assert.ok(fs.existsSync(path.join(repoRoot, src)), `本源缺失: ${src}`);
    assert.match(dest, /^base\/skills\/.+\/scripts\//, `副本落点不合约定: ${dest}`);
  }
});

test('checkCopies --check：CLI 退出码 0', () => {
  const r = run(['base/scripts/check-copies.mjs']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('sync-html-template --check：HTML 资产副本一致', () => {
  const script = path.join(repoRoot, 'base', 'scripts', 'sync-html-template.mjs');
  assert.ok(fs.existsSync(script), '缺少 sync-html-template.mjs');
  const r = run([script, '--check']);
  assert.equal(r.status, 0, `HTML 资产副本漂移，跑 sync-html-template.mjs 同步：${r.stdout}${r.stderr}`);
});

test('生成文件的脚本不得用固定层级 __dirname 上跳定位输出目录（issue-flow / gen-tool-page 回归）', () => {
  const guarded = [
    'base/skills/engineering/jxx-to-spec/scripts/issue-flow.mjs',
    'base/skills/engineering/jxx-to-tickets/scripts/issue-flow.mjs',
    'base/skills/engineering/jxx-tool-intro/scripts/gen-tool-page.mjs',
  ];
  for (const rel of guarded) {
    // 只看代码行：注释里会成段引用这个反模式，不该误判
    const code = fs
      .readFileSync(path.join(repoRoot, rel), 'utf-8')
      .split(/\r?\n/)
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    assert.doesNotMatch(
      code,
      /(resolve|join)\(\s*__dirname\s*,\s*(['"]\.\.['"]\s*,\s*){2,}/,
      `${rel} 用固定层级 __dirname 上跳定位目录——副本深度一变就会指错，改用 cwd 向上找仓库标记`,
    );
  }
});

test('gen-tool-page / issue-flow 必须从 cwd 锚定（含向上探测与失败退出）', () => {
  const genText = fs.readFileSync(
    path.join(repoRoot, 'base/skills/engineering/jxx-tool-intro/scripts/gen-tool-page.mjs'),
    'utf-8',
  );
  assert.match(genText, /process\.cwd\(\)/, 'gen-tool-page 必须以 cwd 为锚');
  assert.match(genText, /findRepoRoot/, 'gen-tool-page 需保留向上探测函数');
  const flowText = fs.readFileSync(path.join(repoRoot, 'base/scripts/issue-flow.mjs'), 'utf-8');
  assert.match(flowText, /resolveScratchRoot/, 'issue-flow 必须保留 resolveScratchRoot');
  assert.doesNotMatch(flowText, /DEFAULT_SCRATCH\s*=\s*path\.join\(__dirname/, 'issue-flow 不得回归 __dirname 锚定');
});
