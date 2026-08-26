# Technical SEO Checker - Compact Output Templates

用一种报告形态：evidence -> checks -> issues -> fixes -> score。不支持的检查标 `N/A`；引用抓取日期、来源、样本量与代表 URL。

## Shared Conventions

| Item | Rule |
|------|------|
| Status | `✅` pass、`⚠️` 部分风险、`❌` fail |
| Severity | `P0` 阻塞 indexing/收入、`P1` 抑制性能、`P2` 卫生 |
| Score | 每节 `/10`；最终报告汇总至 `/100` |

## Step Map

| Step | Focus | Must Capture |
|------|-------|--------------|
| 1 | Crawlability | robots.txt、sitemap、crawl sample、crawl waste |
| 2 | Indexability | coverage、noindex、canonical、4xx/5xx |
| 3 | Performance | LCP、INP、CLS、TTFB、blocking resource |
| 4 | Mobile | viewport、content parity、tap target、overflow |
| 5 | Security | SSL、HTTPS、mixed content、HSTS、header |
| 6 | URL structure | host/protocol、slug、parameter、redirect |
| 7 | Structured data | 当前 schema、错误、缺失机会 |
| 8 | International | hreflang、return tag、x-default |
| 9 | Summary | scorecard、优先队列、roadmap、监控 |

## Crawlability

**Evidence**: robots.txt=[URL] | sitemap=[URL] | crawl sample=[X URLs/pages]

**robots.txt snapshot**

```txt
[current robots.txt directives or notable lines]
```

| robots.txt check | Status | Evidence | Action |
|------------------|--------|----------|--------|
| File exists and parses | ✅/⚠️/❌ | [notes] | [fix] |
| Sitemap declared | ✅/⚠️/❌ | [notes] | [fix] |
| Important templates not blocked | ✅/⚠️/❌ | [notes] | [fix] |
| CSS/JS/assets not unintentionally blocked | ✅/⚠️/❌ | [notes] | [fix] |

**Recommended robots.txt patch**

```txt
[updated robots.txt snippet if needed]
```

| sitemap check | Status | Evidence | Action |
|---------------|--------|----------|--------|
| Sitemap is discoverable | ✅/⚠️/❌ | [notes] | [fix] |
| XML is valid | ✅/⚠️/❌ | [notes] | [fix] |
| Contains only indexable URLs | ✅/⚠️/❌ | [notes] | [fix] |
| `lastmod` is present and trustworthy | ✅/⚠️/❌ | [notes] | [fix] |

Score: [X]/10. Issues: P0/P1/P2 with affected URL patterns and fixes.

## Indexability

**Evidence**: coverage source=[GSC/crawl/manual] | sample=[X URLs] | crawl date=[date]

| Check | Status | Evidence | Action |
|-------|--------|----------|--------|
| Noindex/X-Robots blocks intentional | ✅/⚠️/❌ | [notes] | [fix] |
| Canonicals are self-consistent | ✅/⚠️/❌ | [notes] | [fix] |
| 4xx/5xx/loops controlled | ✅/⚠️/❌ | [notes] | [fix] |
| Duplicate clusters resolved | ✅/⚠️/❌ | [notes] | [fix] |

Score: [X]/10. Issues: P0/P1/P2 with affected URL patterns and fixes.

## Performance

| Metric | Mobile | Desktop | Target | Status |
|--------|--------|---------|--------|--------|
| LCP | [X]s | [X]s | <2.5s | ✅/⚠️/❌ |
| INP | [X]ms | [X]ms | <200ms | ✅/⚠️/❌ |
| CLS | [X] | [X] | <0.1 | ✅/⚠️/❌ |
| TTFB | [X]ms | [X]ms | <800ms | ✅/⚠️/❌ |

Add resource blockers, high-impact fixes, and score.

## Mobile

**Evidence**: device/sample=[mobile crawler/device] | pages=[X] | date=[date]

| Check | Status | Evidence | Action |
|-------|--------|----------|--------|
| Viewport configured | ✅/⚠️/❌ | [notes] | [fix] |
| Text and tap targets usable | ✅/⚠️/❌ | [notes] | [fix] |
| No horizontal overflow | ✅/⚠️/❌ | [examples] | [fix] |
| Mobile content/meta/schema parity | ✅/⚠️/❌ | [notes] | [fix] |

Score: [X]/10. Issues: P0/P1/P2 with affected templates and fixes.

## Security

| Check | Status | Evidence | Action |
|-------|--------|----------|--------|
| SSL certificate valid | ✅/⚠️/❌ | [expiry/notes] | [fix] |
| HTTPS forced site-wide | ✅/⚠️/❌ | [redirect notes] | [fix] |
| Mixed content resolved | ✅/⚠️/❌ | [count/examples] | [fix] |
| HSTS configured appropriately | ✅/⚠️/❌ | [header/max-age/preload notes] | [fix] |
| Security headers reasonable | ✅/⚠️/❌ | [missing headers] | [fix] |

Score: [X]/10. Issues: P0/P1/P2 with affected hosts and fixes.

## URL Structure

**Evidence**: crawl sample=[X URLs] | redirect sample=[X] | date=[date]

| Check | Status | Evidence | Action |
|-------|--------|----------|--------|
| Canonical host/protocol consistent | ✅/⚠️/❌ | [notes] | [fix] |
| Slugs stable and readable | ✅/⚠️/❌ | [patterns] | [fix] |
| Parameters controlled | ✅/⚠️/❌ | [examples] | [fix] |
| Redirect chains/loops avoided | ✅/⚠️/❌ | [examples] | [fix] |

Score: [X]/10. Issues: P0/P1/P2 with affected patterns and fixes.

## Structured Data

**Evidence**: validator=[tool/manual] | pages=[X] | date=[date]

| Check | Status | Evidence | Action |
|-------|--------|----------|--------|
| Current schema valid | ✅/⚠️/❌ | [types/errors] | [fix] |
| Rich-result warnings triaged | ✅/⚠️/❌ | [warnings] | [fix] |
| Visible-content alignment holds | ✅/⚠️/❌ | [examples] | [fix] |
| Missing opportunities mapped | ✅/⚠️/❌ | Article/FAQ/Product/Organization/Breadcrumb | [fix] |

Score: [X]/10. Issues: P0/P1/P2 with affected templates and fixes.

## International SEO

**Evidence**: locale sample=[X URLs] | date=[date]

| Check | Status | Evidence | Action |
|-------|--------|----------|--------|
| Hreflang present where needed | ✅/⚠️/❌/N/A | [notes] | [fix] |
| Return tags and self-references valid | ✅/⚠️/❌/N/A | [examples] | [fix] |
| Language/region codes valid | ✅/⚠️/❌/N/A | [codes] | [fix] |
| `x-default` configured when useful | ✅/⚠️/❌/N/A | [notes] | [fix] |

Score: [X]/10 or N/A. Issues: P0/P1/P2 with affected locale groups and fixes.

## Technical Audit Summary

| Area | Score | Top Blocker | First Fix |
|------|:-----:|-------------|-----------|
| Crawlability | [X]/10 | [issue] | [fix] |
| Indexability | [X]/10 | [issue] | [fix] |
| Performance | [X]/10 | [issue] | [fix] |
| Mobile | [X]/10 | [issue] | [fix] |
| Security | [X]/10 | [issue] | [fix] |
| URL structure | [X]/10 | [issue] | [fix] |
| Structured data | [X]/10 | [issue] | [fix] |
| International | [X]/10 or N/A | [issue] | [fix] |

以 P0/P1/P2 队列、quick win、30 天 roadmap 与监控触发器收尾（覆盖 Core Web Vitals、crawl error、index coverage、structured data 与 security header）。
