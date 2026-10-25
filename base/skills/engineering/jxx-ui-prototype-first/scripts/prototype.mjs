#!/usr/bin/env node
/**
 * jxx-ui-prototype-first 脚手架：new / freeze / list
 *
 * 用法：
 *   node scripts/prototype.mjs new <slug> [--root <仓库根>]
 *   node scripts/prototype.mjs freeze <slug> [--note "这版改了什么"] [--root <仓库根>]
 *   node scripts/prototype.mjs list [--root <仓库根>]
 *
 * 根目录自动探测：<root>/docs/prototypes 存在则用它，否则用 <root>/prototypes。
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const slug = argv[1] && !argv[1].startsWith('--') ? argv[1] : undefined;

function detectRoot() {
  const explicit = flag('root');
  if (explicit) return path.resolve(explicit);
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, 'docs', 'prototypes'))) return dir;
    if (fs.existsSync(path.join(dir, 'prototypes'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

function libDir(root) {
  const a = path.join(root, 'docs', 'prototypes');
  const b = path.join(root, 'prototypes');
  if (fs.existsSync(a)) return a;
  if (fs.existsSync(b)) return b;
  return a;
}

function die(msg) {
  console.error('prototype: ' + msg);
  process.exit(1);
}

const root = detectRoot();
const lib = libDir(root);

if (cmd === 'new') {
  if (!slug) die('缺少 <slug>');
  const dir = path.join(lib, slug);
  if (fs.existsSync(dir)) die('已存在：' + path.relative(root, dir));
  fs.mkdirSync(path.join(dir, 'draft'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'manifest.md'),
    '# ' + slug + ' · 原型台账\n\n**范围**：（这一版要改的页面/区块）\n**需求来源**：（决策记录 / 工单 / 会议链接）\n\n' +
      '## 版本记录\n\n| 版本 | 日期 | 状态 | 改了什么 | 落地 |\n| --- | --- | --- | --- | --- |\n| draft | ' +
      new Date().toISOString().slice(0, 10) + ' | draft | 初版 | — |\n\n' +
      '状态：draft 进行中 · confirmed 已确认待实现 · shipped 已上线（补 commit / 工单号）。\n\n## 组件清单\n\n| 组件 id | 位置 | 说明 |\n| --- | --- | --- |\n',
    'utf8',
  );
  console.log('new: ' + path.relative(root, dir) + '（把 HTML 放 draft/，组件用 <!-- component:<id> --> 标记）');
} else if (cmd === 'freeze') {
  if (!slug) die('缺少 <slug>');
  const dir = path.join(lib, slug);
  const draft = path.join(dir, 'draft');
  if (!fs.existsSync(draft)) die('没有 draft/ 可升格：' + path.relative(root, draft));
  const versions = fs
    .readdirSync(dir)
    .filter((n) => /^v\d+$/.test(n))
    .map((n) => Number(n.slice(1)));
  const next = (versions.length ? Math.max(...versions) : 0) + 1;
  const dest = path.join(dir, 'v' + next);
  fs.renameSync(draft, dest);
  fs.mkdirSync(draft, { recursive: true });
  const manifest = path.join(dir, 'manifest.md');
  if (fs.existsSync(manifest)) {
    let text = fs.readFileSync(manifest, 'utf8');
    const row =
      '| v' + next + ' | ' + new Date().toISOString().slice(0, 10) + ' | confirmed | ' + (flag('note') || '（这版改了什么）') + ' | 待实施 |\n';
    const lines = text.split('\n');
    let last = -1;
    for (let i = 0; i < lines.length; i += 1) if (/^\|\s*v\d+\s*\|/.test(lines[i])) last = i;
    if (last >= 0) lines.splice(last + 1, 0, row.trimEnd());
    else lines.push(row.trimEnd());
    text = lines.join('\n');
    fs.writeFileSync(manifest, text, 'utf8');
  }
  console.log('freeze: draft/ → v' + next + '（v' + next + ' 已冻结，只增不改；draft/ 已重建为空）');
} else if (cmd === 'list') {
  if (!fs.existsSync(lib)) die('找不到原型库：' + lib);
  const rows = fs
    .readdirSync(lib, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const dir = path.join(lib, e.name);
      const versions = fs
        .readdirSync(dir)
        .filter((n) => /^v\d+$/.test(n))
        .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
        .join(', ');
      const draft = fs.existsSync(path.join(dir, 'draft')) ? '有' : '无';
      return e.name + '\t版本: ' + (versions || '（无）') + '\tdraft: ' + draft;
    });
  console.log('原型库：' + path.relative(root, lib));
  rows.forEach((r) => console.log('  ' + r));
} else {
  die('用法：new <slug> | freeze <slug> [--note "..."] | list [--root <仓库根>]');
}
