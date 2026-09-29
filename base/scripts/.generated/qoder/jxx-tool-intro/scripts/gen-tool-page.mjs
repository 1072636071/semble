#!/usr/bin/env node
/**
 * gen-tool-page.mjs
 *
 * 读取 docs/guide/<slug>/tool.json，用统一 HTML 设计模板（Jxx Fresh）生成工具档案：
 *   - 每个工具：docs/guide/<slug>/index.html（详情页）
 *   - 汇总页：  docs/guide/index.html（统计 + 搜索 + 分类筛选 + 卡片网格）
 *
 * 样式与交互来自本技能自包含的 assets/html-design.css / .js（单一源
 * base/shared/html-template/，由 base/scripts/sync-html-template.mjs 分发）。
 *
 * 用法：
 *   node gen-tool-page.mjs                 # 全量重渲染
 *   node gen-tool-page.mjs --slug foo      # 仅重渲染 foo（汇总页仍全量刷新）
 *   node gen-tool-page.mjs --out <dir>     # 指定输出目录（默认 <仓库根>/docs/guide）
 *   node gen-tool-page.mjs --src <dir>     # 指定数据源目录
 *   node gen-tool-page.mjs --root <dir>    # 指定目标仓库根
 *
 * 根解析：默认从 **cwd 向上**找含 .git / docs 的项目根，取其 docs/guide；可用
 * --root / --src / --out 或环境变量 SRC_DIR / OUT_DIR 覆盖。**必须在目标项目目录内执行**，
 * 脚本不锚定自身安装位置（技能会被分发到各平台的 skills/<skill>/scripts/ 下）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 只读资源（assets/）锚定脚本自身目录——技能自带，任何安装布局都成立
const SKILL_DIR = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const CWD = process.cwd();

// 目标仓库根的标记：含任一即认为是项目根
const ROOT_MARKERS = [".git", "docs"];

/**
 * 从 start 向上寻找目标仓库根（含 .git 或 docs/ 的最近目录）。
 *
 * **绝不锚定脚本自身位置**：本技能会被安装到 `~/.xxx/skills/jxx-tool-intro/scripts/`，
 * 固定的 `../../../../../` 会解析到 `C:\Users` 这类无关目录（数据源读取与 HTML 输出
 * 都会指错），故一律以 cwd 为锚、向上探测。
 * @param {string} [start] 起始目录，默认 cwd
 * @returns {string} 仓库根；全链无标记时回落 start
 */
function findRepoRoot(start = CWD) {
  const from = path.resolve(start);
  for (let cur = from; ; ) {
    if (ROOT_MARKERS.some((m) => fs.existsSync(path.join(cur, m)))) return cur;
    const up = path.dirname(cur);
    if (up === cur) return from;
    cur = up;
  }
}

const REPO_ROOT = opt("--root") ? path.resolve(CWD, opt("--root")) : findRepoRoot(CWD);

// 数据源（tool.json）与 HTML 输出：默认都在 <仓库根>/docs/guide/
const SRC_DIR = process.env.SRC_DIR
  ? path.resolve(CWD, process.env.SRC_DIR)
  : path.join(REPO_ROOT, "docs", "guide");
const OUT_DIR = process.env.OUT_DIR
  ? path.resolve(CWD, process.env.OUT_DIR)
  : path.join(REPO_ROOT, "docs", "guide");

const onlySlug = opt("--slug");
const SRC = opt("--src") ? path.resolve(CWD, opt("--src")) : SRC_DIR;
const OUT = opt("--out") ? path.resolve(CWD, opt("--out")) : OUT_DIR;

// 分类顺序：汇总页按此顺序分组；tool.json 中未列出或缺失的分类归入「其他」
const CATEGORY_ORDER = [
  "浏览器自动化",
  "AI 智能体与框架",
  "知识与记忆",
  "上下文与 Token 优化",
  "代码审查",
  "AI 平台与推理",
  "文档与数据",
  "开发工具",
  "云与自托管",
];

// 分类 → 徽章配色（按分类序号循环取用，保证相邻分类不同色）
const CAT_TONES = ["brand", "sky", "lilac", "gold", "coral", "muted"];
const catTone = (c) => {
  const i = CATEGORY_ORDER.indexOf(c);
  return CAT_TONES[(i < 0 ? String(c).length : i) % CAT_TONES.length];
};

const slugify = (s) =>
  String(s || "")
    .trim()
    .replace(/[^\w一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const stars = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

const numStars = (s) => {
  const m = String(s || "").match(/([\d.]+)\s*([kKmM]?)/);
  if (!m) return 0;
  let v = parseFloat(m[1]);
  if (/k/i.test(m[2])) v *= 1e3;
  if (/m/i.test(m[2])) v *= 1e6;
  return v;
};

/* ---------- 设计模板（技能内自包含） ---------- */
function readAsset(file) {
  const p = path.join(SKILL_DIR, "assets", file);
  if (!fs.existsSync(p)) {
    console.error("缺少设计模板文件:", p, "\n请先运行：node base/scripts/sync-html-template.mjs");
    process.exit(1);
  }
  return fs.readFileSync(p, "utf8").trim();
}
const CSS = readAsset("html-design.css");
const JS = readAsset("html-design.js");

const page = ({ title, body }) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<style>
${CSS}
</style>
</head>
<body>
${body}
<button class="to-top" type="button" aria-label="返回顶部">↑</button>
<script>
${JS}
</script>
</body>
</html>`;

const siteHeader = (sub) => `<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="site-header__brand" href="./index.html"><span class="site-header__dot"></span>工具目录</a>
    <span class="site-header__sub">${esc(sub)}</span>
  </div>
</header>`;

/* ---------- 组件 ---------- */
function codeBlocks(items = []) {
  if (!items.length) return '<p style="color:var(--muted);margin:0">—</p>';
  return items
    .map(
      (it) => `
<div class="codeblk">
  <div class="codeblk__bar">${esc(it.title || it.lang || "示例")}${
        it.lang ? `<span class="codeblk__lang">${esc(it.lang)}</span>` : ""
      }</div>
  <pre><code>${esc(it.code || it)}</code></pre>
</div>`
    )
    .join("");
}

function section(title, inner) {
  return `<section class="section" style="margin-top:18px">
  <h2 class="sec-title">${esc(title)}</h2>
  ${inner}
</section>`;
}

function relatedCards(tools, t) {
  const peers = tools.filter((x) => x.slug !== t.slug && x.category === t.category).slice(0, 3);
  if (!peers.length) return "";
  return section("同类工具", `<div class="grid">${peers.map((p) => cardHTML(p)).join("")}</div>`);
}

/* ---------- 详情页 ---------- */
function detailHTML(t, tools = []) {
  const integ = (t.integrations || [])
    .map(([n, d]) => `<tr><th scope="row">${esc(n)}</th><td>${esc(d)}</td></tr>`)
    .join("");
  const feat = (t.features || []).map((f) => `<li>${esc(f)}</li>`).join("");
  const notes = (t.notes || []).map((n) => `<li>${esc(n)}</li>`).join("");
  const cat = t.category || "其他";
  const tone = catTone(cat);
  const rating = t.rating || 5;

  const links = [
    t.github &&
      `<a class="pill" href="${esc(t.github)}" target="_blank" rel="noopener">GitHub ↗</a>`,
    t.homepage &&
      `<a class="pill" href="${esc(t.homepage)}" target="_blank" rel="noopener">官网 ↗</a>`,
  ]
    .filter(Boolean)
    .join("");

  const tags = (t.tags || []).map((x) => `<span class="badge badge--muted">#${esc(x)}</span>`).join("");

  const body = `${siteHeader(t.name)}

<main class="wrap">
  <nav class="crumbs"><a href="./index.html">工具目录</a> <span>/</span> <span>${esc(cat)}</span> <span>/</span> <span>${esc(
    t.name
  )}</span></nav>

  <section class="hero">
    <span class="hero__eyebrow">🗂 ${esc(cat)}</span>
    <h1>${esc(t.name)}</h1>
    <p class="hero__lead">${esc(t.description || t.summary || "")}</p>
    <div class="badges hero__meta">
      <span class="badge badge--${tone}">📁 ${esc(cat)}</span>
      <span class="badge badge--gold">⭐ ${esc(t.stars || "—")}</span>
      <span class="badge badge--muted">${esc(t.license || "License —")}</span>
      <span class="badge badge--muted">${esc(t.language || "—")}</span>
      ${tags}
    </div>
    <div class="rating rating--lg" style="margin-top:14px">${stars(
      rating
    )}<span class="rating__num">${esc(rating)} / 5 推荐度</span></div>
    ${links ? `<div class="row" style="margin-top:16px">${links}</div>` : ""}
  </section>

  ${section("简介", `<p>${esc(t.summary || t.description || "")}</p>`)}

  ${feat ? section("核心特性", `<ul class="list">${feat}</ul>`) : ""}

  ${
    integ
      ? section(
          "集成方式",
          `<div class="table-wrap"><table class="tbl"><tbody>${integ}</tbody></table></div>`
        )
      : ""
  }

  ${section("安装", codeBlocks(t.install))}

  ${section("使用", codeBlocks(t.usage))}

  ${notes ? section("备注", `<ul class="list">${notes}</ul>`) : ""}

  ${relatedCards(tools, t)}

  <div class="row" style="margin:26px 0 0"><a class="pill" href="./index.html">← 返回工具目录</a></div>
</main>

<footer class="site-footer">
  <div class="wrap">由 <strong>jxx-tool-intro</strong> 技能生成 · 设计模板 Jxx Fresh · 数据源 <code>${esc(
    t.slug
  )}/tool.json</code></div>
</footer>`;

  return page({ title: `${t.name} — 工具介绍`, body });
}

/* ---------- 汇总页 ---------- */
function cardHTML(t) {
  const cat = t.category || "其他";
  const tone = catTone(cat);
  const text = [t.name, t.summary, t.description, cat, t.language, ...(t.tags || [])]
    .filter(Boolean)
    .join(" ");
  return `<a class="card rise" href="${esc(t.slug)}/index.html" data-filter-item data-filter-cat="${esc(
    cat
  )}" data-filter-text="${esc(text)}">
      <h3 class="card__title">${esc(t.name)}</h3>
      <div class="rating">${stars(t.rating || 5)}<span class="rating__num">${esc(t.rating || 5)} 星</span></div>
      <p class="card__desc">${esc(t.summary || t.description || "")}</p>
      <div class="card__meta">
        <span class="badge badge--${tone}">📁 ${esc(cat)}</span>
        <span class="badge badge--gold">⭐ ${esc(t.stars || "—")}</span>
        <span class="badge badge--muted">${esc(t.language || "—")}</span>
      </div>
      <span class="card__cta">查看详情 →</span>
    </a>`;
}

function summaryHTML(tools) {
  const groups = new Map();
  for (const c of CATEGORY_ORDER) groups.set(c, []);
  groups.set("其他", []);
  for (const t of tools) {
    const c = t.category && CATEGORY_ORDER.includes(t.category) ? t.category : "其他";
    groups.get(c).push(t);
  }
  const order = [...CATEGORY_ORDER, "其他"].filter((c) => groups.get(c).length);

  const chips = [
    `<button class="pill is-active" type="button" data-filter-chip="" aria-pressed="true">全部 <span class="pill__count">${tools.length}</span></button>`,
    ...order.map(
      (c) =>
        `<button class="pill" type="button" data-filter-chip="${esc(
          c
        )}" aria-pressed="false">${esc(c)} <span class="pill__count">${
          groups.get(c).length
        }</span></button>`
    ),
  ].join("");

  const sections = order
    .map(
      (c) => `<section class="group" id="cat-${slugify(c)}" data-filter-group>
    <div class="group__head">
      <h2 class="group__title">${esc(c)}</h2>
      <span class="group__count">${groups.get(c).length} 个工具</span>
    </div>
    <div class="grid">${groups.get(c).map(cardHTML).join("")}</div>
  </section>`
    )
    .join("");

  const recommended = tools.filter((t) => (t.rating || 0) >= 5).length;
  const totalStars = tools.reduce((s, t) => s + numStars(t.stars), 0);
  const starText = totalStars >= 1000 ? `${(totalStars / 1000).toFixed(1)}k` : String(totalStars);

  const body = `${siteHeader("★ 为强烈推荐的工具档案")}

<main class="wrap">
  <section class="hero">
    <span class="hero__eyebrow">🗄 JwikisSkills · 工具档案</span>
    <h1>工具目录</h1>
    <p class="hero__lead">沉淀常用开发工具的中文档案，每份都含定位、核心特性、安装与使用。数据来自各工具的 <code>tool.json</code>，页面由脚本全量重渲染。</p>
    <div class="badges hero__meta">
      <span class="badge badge--brand">薄荷青 · Jxx Fresh</span>
      <span class="badge badge--muted">零外部依赖</span>
      <span class="badge badge--muted">支持深浅色</span>
    </div>
  </section>

  <div class="stats">
    <div class="stat"><div class="stat__num">${tools.length}</div><div class="stat__label">工具总数</div></div>
    <div class="stat"><div class="stat__num">${order.length}</div><div class="stat__label">分类</div></div>
    <div class="stat"><div class="stat__num">${recommended}</div><div class="stat__label">五星推荐</div></div>
    <div class="stat"><div class="stat__num">${starText}</div><div class="stat__label">累计 Star</div></div>
  </div>

  <div class="row" style="margin-bottom:24px">
    <div class="pills">${chips}</div>
    <span class="spacer"></span>
    <div class="search">
      <span class="search__icon">🔍</span>
      <input type="search" placeholder="搜索工具名、简介、语言…" data-filter-input aria-label="搜索工具">
    </div>
  </div>

  ${sections}

  <div class="empty" data-filter-empty hidden>
    <div class="empty__title">没有匹配的工具</div>
    <div>换个关键词，或点「全部」重置筛选。</div>
  </div>
</main>

<footer class="site-footer">
  <div class="wrap">由 <strong>jxx-tool-intro</strong> 技能生成 · 共 ${tools.length} 个工具 · 设计模板 Jxx Fresh</div>
</footer>`;

  return page({ title: "工具目录 — 汇总", body });
}

/* ---------- 主流程 ---------- */
function main() {
  if (!fs.existsSync(SRC)) {
    console.error("工具数据源不存在:", SRC);
    console.error(`（当前解析的仓库根: ${REPO_ROOT}，cwd: ${CWD}）`);
    console.error("请在含 docs/guide 的项目根目录下运行，或用 --src <dir> 指定数据源、--out <dir> 指定输出。");
    process.exit(1);
  }
  const entries = fs
    .readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(SRC, d.name, "tool.json"))
    .filter((p) => fs.existsSync(p))
    .map((p) => JSON.parse(fs.readFileSync(p, "utf8")));

  if (!entries.length) {
    console.error("未找到任何 tool.json");
    process.exit(1);
  }

  // 排序：评级降序 → stars 降序 → 名称
  entries.sort(
    (a, b) =>
      (b.rating || 0) - (a.rating || 0) ||
      numStars(b.stars) - numStars(a.stars) ||
      a.name.localeCompare(b.name)
  );

  fs.mkdirSync(OUT, { recursive: true });
  const targets = onlySlug ? entries.filter((t) => t.slug === onlySlug) : entries;
  if (onlySlug && !targets.length) {
    console.error("未找到 slug:", onlySlug);
    process.exit(1);
  }
  for (const t of targets) {
    const dir = path.join(OUT, t.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), detailHTML(t, entries), "utf8");
  }
  console.log(`生成详情页: ${targets.length} 个 → ${OUT}`);
  fs.writeFileSync(path.join(OUT, "index.html"), summaryHTML(entries), "utf8");
  console.log(`生成汇总页: ${path.join(OUT, "index.html")}（共 ${entries.length} 个工具）`);
}

main();
