// gen-tool-page.test.mjs — 生成器的目录锚定回归测试（node:test，零第三方依赖）。
//
// 历史 bug：脚本用 `path.resolve(__dirname, "../../../../../")` 定位仓库根，只在本仓库这一
// 目录深度成立；技能被安装到 `~/.xxx/skills/jxx-tool-intro/scripts/` 后解析成 `C:\Users`，
// 数据源与输出全指错（实测报「工具数据源不存在: C:\Users\docs\guide」）。
// 本测试把技能复制到「任意深层布局」再运行，锁住「锚定 cwd、不锚定脚本位置」。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(SKILL_DIR, 'scripts', 'gen-tool-page.mjs');
const node = process.execPath;

const SAMPLE = {
  slug: 'demo',
  name: 'Demo Tool',
  github: 'https://github.com/example/demo',
  homepage: '',
  description: '示例工具描述',
  summary: '示例摘要',
  license: 'MIT',
  stars: '1.2k',
  language: 'JavaScript',
  rating: 5,
  category: '开发工具',
  tags: ['demo'],
  features: ['特性一'],
  integrations: [],
  install: [{ title: 'npm', lang: 'bash', code: 'npm i -g demo' }],
  usage: [{ title: '运行', lang: 'bash', code: 'demo run' }],
  notes: [],
};

/** 造一个「像项目」的目录：含 .git 与 docs/guide/demo/tool.json。 */
function makeProject(root) {
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const slugDir = path.join(root, 'docs', 'guide', 'demo');
  fs.mkdirSync(slugDir, { recursive: true });
  fs.writeFileSync(path.join(slugDir, 'tool.json'), JSON.stringify(SAMPLE, null, 2), 'utf-8');
  return root;
}

test('任意安装深度下都按 cwd 定位目标仓库（不依赖脚本自身层级）', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtp-'));
  try {
    const project = makeProject(path.join(tmp, 'my-project'));
    // 复制成安装布局：<任意深度>/installed/skills/jxx-tool-intro/scripts/...
    const installed = path.join(tmp, 'installed', 'skills', 'jxx-tool-intro');
    fs.cpSync(SKILL_DIR, installed, { recursive: true });
    const script = path.join(installed, 'scripts', 'gen-tool-page.mjs');

    const r = spawnSync(node, [script], { cwd: project, encoding: 'utf-8' });
    assert.equal(r.status, 0, `退出码应为 0，实际 ${r.status}\n${r.stdout}${r.stderr}`);
    assert.ok(fs.existsSync(path.join(project, 'docs', 'guide', 'index.html')), '汇总页应落在目标项目 docs/guide');
    assert.ok(fs.existsSync(path.join(project, 'docs', 'guide', 'demo', 'index.html')), '详情页应落在 <slug>/ 下');
    assert.ok(!fs.existsSync(path.join(installed, 'docs')), '不得往技能安装目录里写输出');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('非项目目录下失败退出，且不静默新建目录', () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'gtp-bare-'));
  try {
    const r = spawnSync(node, [SCRIPT], { cwd: bare, encoding: 'utf-8' });
    assert.equal(r.status, 1, '找不到数据源应非零退出');
    assert.match(r.stderr, /工具数据源不存在/, '应报出解析到的数据源路径');
    assert.match(r.stderr, /--src/, '应提示可用 --src / --out 覆盖');
    assert.ok(!fs.existsSync(path.join(bare, 'docs')), '失败路径不得留下空目录树');
  } finally {
    fs.rmSync(bare, { recursive: true, force: true });
  }
});

test('--src / --out 可覆盖，与项目根解耦', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gtp-override-'));
  try {
    const project = makeProject(path.join(tmp, 'proj'));
    const outDir = path.join(tmp, 'elsewhere', 'out');
    const r = spawnSync(node, [SCRIPT, '--out', outDir], { cwd: project, encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(path.join(outDir, 'index.html')), '应写到 --out 指定目录');
    assert.ok(!fs.existsSync(path.join(project, 'docs', 'guide', 'index.html')), '--out 生效时不应再写默认目录');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
