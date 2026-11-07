// ask-matt-index.mjs 测试套件（node:test，零第三方依赖）。
// 用临时 fixture 仓库验证：源状态判定、索引渲染、幂等、过期门禁。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(__dirname, '..', 'ask-matt-index.mjs');

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-matt-index-'));
  const w = (rel, content) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
  };
  // 复制生成器与配置，让工具在 fixture 根下跑（工具按自身位置推 REPO_ROOT）。
  w('base/scripts/vendors.json', JSON.stringify({ buckets: ['engineering', 'productivity'] }));
  const skill = (bucket, name, fm, body = '# body\n') =>
    w(`base/skills/${bucket}/${name}/SKILL.md`, `---\nname: ${name}\ndescription: "${fm.desc}"\n${fm.extra || ''}---\n\n${body}`);
  skill('engineering', 'jxx-installed', { desc: '常用技能。当用户说常用时触发。' });
  skill('engineering', 'jxx-off', { desc: '不常用技能。当用户说不常用时触发。', extra: 'x-install: false\n' });
  skill('productivity', 'jxx-inline', { desc: '内联原语。当用户说 grill 时触发。', extra: 'x-inline: true\n' });
  skill('in-progress', 'jxx-bucket', { desc: '未分发桶技能。当用户说草稿时触发。' });
  skill('engineering', 'jxx-ask-matt', { desc: '路由器。' }); // 路由自身不进索引
  return { root, w };
}

function runFixture(root, args = []) {
  const tool = path.join(root, 'base', 'scripts', 'ask-matt-index.mjs');
  const res = spawnSync(process.execPath, [tool, ...args], { encoding: 'utf-8' });
  return { code: res.status, out: res.stdout + res.stderr, res };
}

test('生成：三个「未安装」判定都进索引，常用与路由自身不进', () => {
  const { root } = makeRepo();
  try {
    fs.copyFileSync(TOOL, path.join(root, 'base/scripts/ask-matt-index.mjs'));
    const r = runFixture(root, []);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /3 个未安装技能/);
    const target = path.join(root, 'base/skills/engineering/jxx-ask-matt/references/not-installed-skills.md');
    const text = fs.readFileSync(target, 'utf-8');
    assert.match(text, /\| `jxx-off` \|/);
    assert.match(text, /\| `jxx-inline` \|/);
    assert.match(text, /\| `jxx-bucket` \|/);
    assert.doesNotMatch(text, /\| `jxx-installed` \|/);
    assert.doesNotMatch(text, /\| `jxx-ask-matt` \|/);
    // 真源路径 + 触发线索 + 未装原因都在
    assert.match(text, /base\/skills\/engineering\/jxx-off\/SKILL\.md/);
    assert.match(text, /触发：说?不常用/);
    assert.match(text, /x-install: false/);
    assert.match(text, /x-inline/);
    assert.match(text, /桶 in-progress 未分发/);
    // 读源规则在块内（含仓根定位说明，跨工作区可用）
    assert.match(text, /## 读源规则/);
    assert.match(text, /JwikisSkills 仓根/);
    assert.match(text, /相对链接与脚本以该文件所在目录为基准/);
    assert.equal((text.match(/<!-- ask-matt-index:start -->/g) || []).length, 1);
    assert.equal((text.match(/<!-- ask-matt-index:end -->/g) || []).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('幂等：重复生成字节不变；--check 在新鲜时通过', () => {
  const { root } = makeRepo();
  try {
    fs.copyFileSync(TOOL, path.join(root, 'base/scripts/ask-matt-index.mjs'));
    assert.equal(runFixture(root, []).code, 0);
    const target = path.join(root, 'base/skills/engineering/jxx-ask-matt/references/not-installed-skills.md');
    const before = fs.readFileSync(target);
    const again = runFixture(root, []);
    assert.equal(again.code, 0);
    assert.match(again.out, /无变化/);
    assert.ok(before.equals(fs.readFileSync(target)), '重复生成不得改字节');
    const chk = runFixture(root, ['--check']);
    assert.equal(chk.code, 0, chk.out);
    assert.match(chk.out, /索引新鲜/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('过期门禁：卸载一个技能后 --check 非零，刷新后恢复', () => {
  const { root, w } = makeRepo();
  try {
    fs.copyFileSync(TOOL, path.join(root, 'base/scripts/ask-matt-index.mjs'));
    assert.equal(runFixture(root, []).code, 0);
    // 把常用技能改成 x-install: false ⇒ 索引该多一行
    w('base/skills/engineering/jxx-installed/SKILL.md',
      '---\nname: jxx-installed\ndescription: "常用技能。当用户说常用时触发。"\nx-install: false\n---\n\n# body\n');
    const stale = runFixture(root, ['--check']);
    assert.equal(stale.code, 1, '源状态变了必须挡住');
    assert.match(stale.out, /索引过期/);
    assert.equal(runFixture(root, []).code, 0);
    const text = fs.readFileSync(path.join(root, 'base/skills/engineering/jxx-ask-matt/references/not-installed-skills.md'), 'utf-8');
    assert.match(text, /\| `jxx-installed` \|/);
    assert.match(text, /共 \*\*4\*\*/);
    assert.equal(runFixture(root, ['--check']).code, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('marker 之外手写内容不被覆盖', () => {
  const { root } = makeRepo();
  try {
    fs.copyFileSync(TOOL, path.join(root, 'base/scripts/ask-matt-index.mjs'));
    assert.equal(runFixture(root, []).code, 0);
    const target = path.join(root, 'base/skills/engineering/jxx-ask-matt/references/not-installed-skills.md');
    const text = fs.readFileSync(target, 'utf-8');
    fs.writeFileSync(target, '# 人写的前言\n\n' + text + '\n## 人写的附录\n', 'utf-8');
    assert.equal(runFixture(root, []).code, 0);
    const after = fs.readFileSync(target, 'utf-8');
    assert.match(after, /^# 人写的前言/);
    assert.match(after, /## 人写的附录/);
    assert.equal((after.match(/<!-- ask-matt-index:start -->/g) || []).length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
