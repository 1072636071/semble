#!/usr/bin/env node
// ask-matt-index.mjs — 生成 jxx-ask-matt 的「未安装技能索引」。
//
// 目的：用户只保留自己常用的 jxx 技能时，不常用的技能不进 skills 目录（省常驻
// description），但用 jxx-ask-matt 仍能找到：索引给出 name + 一句话 + 触发场景 +
// 仓内真源路径，agent 按需直接 read 真源（含 scripts/ references/ 目录指针）。
//
// 判定「未安装」= 三条之一：
//   1. frontmatter `x-install: false`（默认不安装）
//   2. frontmatter `x-inline: true`（内联源，不单独安装）
//   3. 技能所在桶不在 vendors.json 的 buckets 里（该桶整体不分发）
//
// 用法：
//   node base/scripts/ask-matt-index.mjs            # 生成/刷新索引文件
//   node base/scripts/ask-matt-index.mjs --check    # 只校验新鲜度，过期退出 1
//   node base/scripts/ask-matt-index.mjs --stdout  # 打印渲染结果，不落盘
//
// 产物由固定 marker 包围，重复运行幂等；marker 之外的手写内容不动。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'base', 'skills');
const TARGET = path.join(SKILLS_DIR, 'engineering', 'jxx-ask-matt', 'references', 'not-installed-skills.md');
const CONFIG = path.join(__dirname, 'vendors.json');
const START = '<!-- ask-matt-index:start -->';
const END = '<!-- ask-matt-index:end -->';

/** frontmatter 单行值：剥引号与行尾注释，保留 false/true/project 这类字面值。 */
function fmValue(text, key) {
  const m = text.match(new RegExp(`^${key}\\s*:\\s*(.*)$`, 'm'));
  if (!m) return null;
  let s = m[1].trim();
  const hash = s.indexOf(' #');
  if (hash >= 0) s = s.slice(0, hash).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  return s;
}

/** 一句话摘要：取 description 首句，去掉「当用户…触发」这类触发从句，避免索引过长。 */
function oneLiner(desc) {
  let s = String(desc || '').trim().replace(/^["']|["']$/g, '');
  s = s.split(/。当用户|。Use when|，当用户|；当用户/)[0].replace(/。$/, '').trim();
  if (s.length > 72) s = s.slice(0, 69) + '…';
  return s || '（无描述）';
}

/** 触发场景：从 description 里摘「当用户…触发」/「Use when…」段落，作为路由线索。 */
function triggerHint(desc) {
  const s = String(desc || '');
  const m = s.match(/(?:当用户|Use when)([\s\S]*?)(?:触发|。|$)/);
  if (!m) return '';
  const hint = m[1].replace(/[、,，]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return hint;
}

/** 扫描全部 jxx-* 技能，返回未安装列表（按 name 排序）。 */
export function collectNotInstalled() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf-8'));
  const buckets = new Set(cfg.buckets || []);
  const rows = [];
  for (const bucket of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!bucket.isDirectory()) continue;
    const base = path.join(SKILLS_DIR, bucket.name);
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || !e.name.startsWith('jxx-')) continue;
      const dir = path.join(base, e.name);
      const srcName = fs.existsSync(path.join(dir, 'SKILL.src.md')) ? 'SKILL.src.md' : 'SKILL.md';
      const srcPath = path.join(dir, srcName);
      if (!fs.existsSync(srcPath) || e.name === 'jxx-ask-matt') continue; // 路由自身不进索引
      const text = fs.readFileSync(srcPath, 'utf-8');
      const fm = (text.match(/^---\r?\n([\s\S]*?)\r?\n---/) || ['', ''])[1];
      const xInstall = fmValue(fm, 'x-install');
      const xInline = fmValue(fm, 'x-inline');
      const desc = fmValue(fm, 'description') || '';
      const reasons = [];
      if (xInstall === 'false') reasons.push('x-install: false');
      if (xInline === 'true') reasons.push('x-inline');
      if (!buckets.has(bucket.name)) reasons.push(`桶 ${bucket.name} 未分发`);
      if (reasons.length === 0) continue;
      const aux = fs.readdirSync(dir).filter((x) => !['SKILL.md', 'SKILL.src.md'].includes(x));
      rows.push({
        name: e.name,
        rel: `base/skills/${bucket.name}/${e.name}/${srcName}`,
        one: oneLiner(desc),
        hint: triggerHint(desc),
        reason: reasons.join(' + '),
        aux: aux.filter((x) => ['references', 'scripts', 'assets', 'templates'].includes(x)),
      });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** 渲染索引文件内容（marker 之间的表格 + 使用说明）。 */
export function renderIndex(rows) {
  const lines = [
    START,
    '',
    '# 未安装技能索引（自动生成 · 勿手改）',
    '',
    `生成自 \`base/scripts/ask-matt-index.mjs\`：共 **${rows.length}** 个 jxx 技能未随 \`ship install\` 分发。`,
    '这些技能不进环境里的技能列表；用户点名或意图命中时，按下表「真源」直接读文件，不要去 skills 目录找同名技能。',
    '',
    '| 技能 | 何时用 | 真源 | 额外资源 | 未装原因 |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    const when = r.hint ? `${r.one}；触发：${r.hint}` : r.one;
    const aux = r.aux.length ? `\`${r.aux.join('`/`')}\`` : '—';
    lines.push(`| \`${r.name}\` | ${when.replace(/\|/g, '\\|')} | \`${r.rel}\` | ${aux} | ${r.reason} |`);
  }
  lines.push(
    '',
    '## 读源规则',
    '',
    '1. 「真源」列是相对 **JwikisSkills 仓根**的路径（本机 `E:\\work\\sp\\JwikisSkills`）；在别的工作区用本路由时先定位该仓根，再按相对路径读。',
    '   读 `SKILL.md` / `SKILL.src.md` 全文；相对链接与脚本以该文件所在目录为基准，',
    '   `references/` `scripts/` `assets/` 等随目录一同存在（见「额外资源」列）。',
    '2. `x-inline` 的技能是内联源：正文也可能已注入引用技能的「内联技能原文」段；两处同源于仓内真源，任取其一。',
    '3. 不要修改已安装副本；改这些技能一律改仓内真源。索引过期（卸载/新增/改 description 后）跑',
    '   `node base/scripts/ask-matt-index.mjs` 重新生成，`ship check` 会挡住过期索引。',
    '',
    END,
    '',
  );
  return lines.join('\n');
}

/** 落盘（幂等：marker 之间整块替换，marker 之外不动）。返回是否发生变化。 */
export function syncIndex({ write = true } = {}) {
  const rendered = renderIndex(collectNotInstalled());
  const existing = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf-8') : '';
  const blockRe = new RegExp(`${START}[\\s\\S]*?${END}\\n?`);
  const next = blockRe.test(existing)
    ? existing.replace(blockRe, rendered)
    : (existing ? `${existing.replace(/\s+$/, '')}\n\n` : '') + rendered;
  const changed = next !== existing;
  if (write && changed) {
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.writeFileSync(TARGET, next, 'utf-8');
  }
  return { changed, rendered, target: TARGET };
}

// ---------------------------------------------------------------- CLI
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const stdout = args.includes('--stdout');
  try {
    const { changed, rendered, target } = syncIndex({ write: !checkOnly && !stdout });
    if (stdout) {
      console.log(rendered);
    } else if (checkOnly) {
      console.log(changed ? `索引过期：${target}（跑 node base/scripts/ask-matt-index.mjs 刷新）` : '索引新鲜');
      process.exit(changed ? 1 : 0);
    } else {
      const count = collectNotInstalled().length;
      console.log(`${changed ? '已刷新' : '无变化'}：${target}（${count} 个未安装技能）`);
    }
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exit(2);
  }
}
