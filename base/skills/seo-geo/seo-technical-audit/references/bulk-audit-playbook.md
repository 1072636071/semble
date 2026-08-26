# Technical SEO — Site-Wide / Bulk Audit Playbook

引用自 [SKILL.md](../SKILL.md)。当用户有 >5 URL 需审计时使用（例如 50 个 Shopify 产品页全部未索引）。

---

## When to use bulk mode

- 用户报告"X of Y pages are not indexed"（比例问题）
- 用户粘贴 sitemap URL 或 URL 的 CSV/列表
- 用户引用 GSC Coverage / Indexing 报告导出
- 带 facet / pagination / variant 模式的电商站

## Inputs accepted

Bulk 模式接受以下**任一**输入：

1. **Sitemap URL** — `https://example.com/sitemap.xml`（或 `sitemap_index.xml`）
2. **GSC Coverage export** — Search Console 导出的 CSV，列为 `URL | Issue | Last crawled`
3. **URL list** — 纯文本，每行一个 URL（用户粘贴）
4. **Crawl data** — Screaming Frog 导出、Sitebulb 导出或 `~~web crawler` MCP 输出

## Workflow

### Step 1 — Inventory + group

将输入解析为 URL 清单。按内容类型、模板（经 URL 路径 / meta 信号 / 每簇采样 3 页探测）与已知问题分组（若来自 GSC：indexed / excluded / crawl error / duplicate / soft 404）。

```
| Group              | Count | Template | Known Issue        |
|--------------------|-------|----------|--------------------|
| /product/[slug]    | 32    | product  | Excluded by noindex |
| /collection/[slug] | 12    | category | Duplicate canonical |
| /blog/[slug]       | 4     | blog     | OK                  |
| /pages/[slug]      | 2     | landing  | OK                  |
```

### Step 2 — Sample deep, summarize shallow

对每组的 **2 个代表 URL**（最近与最早被索引各一）运行单 URL 审计。报告模式级发现。

```
### Group: /product/[slug] — 32 pages
- **Pattern issue**: `<meta name="robots" content="noindex">` injected by theme on all product pages with <5 variants
- **Root cause**: Shopify theme setting "Hide products with low stock"
- **Verified on**: /product/shoes-red, /product/shoes-blue (2/32 sampled)
- **Estimated affected**: 32 pages
- **Fix**: disable the theme option OR add `variant_count > 0` override in theme.liquid L247
- **Priority**: P0
```

### Step 3 — Portfolio-level prioritization

跨组产出单一优先级列表：

```
P0 (fix affects 10+ pages):
1. Remove noindex from low-stock products (32 pages)  — theme.liquid
2. Fix canonical conflict on collection pages (12 pages)  — collection.liquid

P1 (fix affects 3-9 pages):
3. Add self-referential canonical on /blog/* (4 pages)

P2 (single-page):
4. /pages/about has meta description length 170 chars — trim
```

### Step 4 — Deliver

**Handoff Summary** 适配 bulk 模式：

- **Status**: DONE | DONE_WITH_CONCERNS
- **Objective**: "Bulk audit of <inventory_size> URLs across <group_count> groups"
- **Key Findings / Output**: 模式级问题 + 组合优先级列表
- **Evidence**: "Sampled N of M pages (deep audit); inferred group issues from URL structure + meta signals"
- **Open Loops**: 未采样组、访问阻塞、数据时效性注意事项
- **Recommended Next Skill**: `content-refresher`（若内容问题为主）或 `schema-markup-generator`（若 structured data 问题为主）

## Minimum viable bulk input

```
Paste or describe your site's URL patterns:

1. Domain: [example.com]
2. How many total pages roughly? [50 / 500 / 5000]
3. Page types with approximate counts:
   - Products: [~32]
   - Categories: [~12]
   - Blog posts: [~4]
   - Pages: [~2]
4. What issue started the audit? (e.g., "40 of 50 products not indexed")
5. Any template/theme you know the issue is scoped to?
```

随后从 Step 1 继续。

## E-commerce pattern reference

| Symptom | Usual root cause | Check file |
|---------|------------------|-----------|
| Variants not indexed | Canonical pointing to parent | `product.liquid` |
| Facet/filter URLs indexed | Missing `rel="noindex,follow"` on filter links | `collection.liquid` |
| Duplicate pages on `?utm=*` | No canonical to clean URL | `theme.liquid` head |
| Old products return 404 | No 301 redirect after removal | platform redirect map |
| Pagination loop | `rel="prev/next"` wrong or missing self-canonical per page | `collection.liquid` |
| Robots.txt blocks all facets (aggressive) | `Disallow: /*?*` too broad | `/robots.txt` |
