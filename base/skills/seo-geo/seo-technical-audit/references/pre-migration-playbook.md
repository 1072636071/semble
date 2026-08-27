# Technical SEO — Pre-Migration Playbook

引用自 [SKILL.md](../SKILL.md)。当用户计划迁移（平台、域名、URL 结构或框架变更）并需要在变更发布前进行审计 + 风险评估时使用。

---

## When to use

- WordPress → Headless（Next.js、Astro、Remix、Gatsby 等）
- Shopify → custom / BigCommerce / Magento
- 子域合并（blog.example.com → example.com/blog）
- 域名变更（oldbrand.com → newbrand.com）
- URL 结构重写（/category/product → /product）
- HTTP → HTTPS（现已少见，旧站仍适用）
- 重写 URL 的 CMS 升级（如重大主题重构）

## The 6 pre-migration stages

### Stage 1 — Freeze current state (baseline snapshot)

捕获至 `memory/audits/pre-migration-YYYY-MM-DD.md`：

1. **URL inventory**
   - 经 `~~web crawler` MCP 或 Screaming Frog / Sitebulb 导出全量抓取
   - 每个可索引 URL 的 canonical 列表，含响应码、canonical tag、redirect chain
   - 可索引总数

2. **Ranking baseline**
   - Top 100 排名关键词（来自 `~~SEO tool` 或 `~~search console`）
   - 每条：URL、位置、volume、CTR、近 90 天点击
   - 存为 CSV: `memory/monitoring/pre-migration-ranks.csv`

3. **Traffic baseline**
   - 按自然会话 Top 50 URL（来自 `~~analytics` 或 `~~search console`）
   - 每 URL 近 30 + 90 天会话数
   - 流量占比 >1% 的页标记为需 VIP redirect 审查

4. **Backlink baseline**
   - 按引用域权威 Top 100 外链（来自 `~~SEO tool`）
   - Top 50 被链 URL（本站）
   - 任何有 10+ 外链的 URL 标为 HIGH-VALUE——迁移后需精确 301

5. **Schema & entity snapshot**
   - 每页模板的当前 structured data（从 head 提取的 JSON-LD）
   - 实体表示（Organization、Person、Product、Article 等）

### Stage 2 — Risk map

| Change | Risk | Impact if mishandled |
|--------|------|---------------------|
| URL 结构变更 | HIGH | 2-12 周内流量损失 20-40% |
| 模板重写（meta、header） | HIGH | 关键词定位丢失 |
| 域名变更 | CRITICAL | 无 redirect 则 PageRank 完全重置 |
| Schema 变更 | MEDIUM | rich result 损失 |
| JS-rendered content | MEDIUM | 非 SSR 则部分 deindex |
| robots.txt / noindex 变更 | CRITICAL | 意外 deindex |
| 内链重构 | MEDIUM | topic cluster 弱化 |

对每项变更给出 **GO / NOGO** 建议。

### Stage 3 — Redirect map

```csv
old_url,new_url,reason,priority
/category/blue-shoes,/shop/blue-shoes,url structure,P0
/product/abc-123,/product/blue-shoe,slug change,P0
/blog/2020/seo-tips,/blog/seo-tips,year removed,P1
```

规则：
- Stage 1 清单中每个 URL 必须有映射或 410 / 404 的文档化决策
- 无 chain（`A → B → C` 应变为 `A → C` 与 `B → C`）
- 无 loop（绝无 `A → B → A`）
- HIGH-VALUE URL（Stage 1 标记）人工验证

存至 `memory/audits/redirect-map-YYYY-MM-DD.csv`。

### Stage 4 — Staging QA

1. **Robots / indexing**: staging 是否设 `noindex`？上线时是否会翻转为 `index`？生产 robots.txt 草稿中是否有意外 `Disallow: /`？
2. **Template parity**: 新模板对每页类型是否产出等价的 `<title>`、`<meta description>`、`<h1>`、canonical、schema？
3. **Internal linking**: 抓 staging；验证 topic cluster 完整；检查新模板引入的 orphan 页。
4. **Core Web Vitals**: 在 staging 跑 PSI / Lighthouse / WebPageTest。每模板的 LCP、INP、CLS。与 Stage 1 baseline 对比。
5. **Schema validation**: 用 Schema.org validator 与 Google Rich Results Test 验证每页类型模板的 JSON-LD。
6. **Pagination / facets**: 若有 collection 页，验证 pagination canonical / facet canonical 行为与 baseline 一致或更优。

### Stage 5 — Cutover day checklist

1. 在动 DNS / robots 前部署 redirect（如可能）
2. 将 `robots.txt` 更新为生产
3. 向 Search Console 与 Bing Webmaster 提交新 `sitemap.xml`
4. 解除爬取封锁（移除任何 staging noindex）
5. 监控：tail access logs 查 5xx 与旧 URL 上的 40xx 尖峰
6. 首日回滚触发：旧 URL 404 率超旧 URL 流量 5% 则立即审查 redirect map

### Stage 6 — Post-migration diff (T+1, T+7, T+30)

- **T+1**: 全量抓取。标记任何应 redirect 却返回非 2xx 的 URL。
- **T+7**: 按 URL 对比流量与 baseline。标记跌幅 >30% 的 URL。
- **T+30**: 对比 Top 100 关键词排名与 baseline。标记跌出 Top 10 / Top 20 的 URL。

Deliverables:

- `memory/audits/post-migration-T+1-YYYY-MM-DD.md`
- `memory/audits/post-migration-T+7-YYYY-MM-DD.md`
- `memory/audits/post-migration-T+30-YYYY-MM-DD.md`

## Handoff

- **Status**: DONE | DONE_WITH_CONCERNS | BLOCKED
- **Objective**: "Pre-migration audit for <change_description>"
- **Key Findings / Output**: baseline snapshot 引用 + risk map + redirect map + QA checklist
- **Evidence**: 抓取计数、排名 CSV 路径、redirect CSV 路径、Core Web Vitals 前后对比（staging 就绪时）
- **Open Loops**: HIGH-VALUE URL 待 redirect 确认、模板 X/Y 的 schema 未验证、回滚触发阈值尚未与工程对齐
- **Recommended Next Skill**: 模板重写暴露内容质量缺口则 `content-refresher`；新模板需撰写 schema 则 `schema-markup-generator`；否则 `rank-tracker` 做发布后监控

## Red-flag patterns (STOP — 修复前不发布)

- 任何 redirect chain >1 跳
- 月自然会话 >100 的 URL 缺 301
- 生产草稿中 `robots.txt` 任处有 `Disallow: /`
- 新 URL 的 canonical 指回旧 URL
- 关键落地页的 JS-only 内容无 SSR fallback
- 新模板缺 `<h1>` 或有多个 `<h1>`
- Schema 类型变更未做 rich-result 资格检查
