# Technical SEO Checker Worked Example and Checklist

引用自 [SKILL.md](../SKILL.md)。用作紧凑输出模型，而非固定数据。

## Worked Example Shape

```markdown
# Technical SEO Audit Report

**Domain**: [domain]
**Audit date**: [date]
**Pages analyzed**: [count]

## Crawlability

### robots.txt
| Check | Status | Evidence | Fix |
|-------|--------|----------|-----|
| File exists | [pass/warn/fail] | [status code] | [fix] |
| Valid syntax | [pass/warn/fail] | [rule] | [fix] |
| Sitemap directive | [pass/warn/fail] | [sitemap URL or missing] | Add `Sitemap: [absolute URL]` |
| Important pages blocked | [pass/warn/fail] | [blocked URL/rule] | [allow or revise rule] |
| Assets accessible | [pass/warn/fail] | [CSS/JS sample] | [fix] |

### XML sitemap
| Check | Status | Evidence | Fix |
|-------|--------|----------|-----|
| Sitemap exists | [pass/warn/fail] | [URL count] | [fix] |
| Only indexable URLs | [pass/warn/fail] | [noindex/canonical/redirect count] | Remove non-indexable URLs |
| lastmod accuracy | [pass/warn/fail] | [sample dates] | Update only when page content changes |
| Declared in robots.txt | [pass/warn/fail] | [yes/no] | Add sitemap directive |

**Crawlability score**: [X]/10

## Performance

| Metric | Mobile | Desktop | Target | Status |
|--------|--------|---------|--------|--------|
| LCP | [value] | [value] | <=2.5s | [status] |
| INP | [value] | [value] | <=200ms | [status] |
| CLS | [value] | [value] | <=0.1 | [status] |
| TTFB | [value] | [value] | <=800ms preferred | [status] |

**Top fixes**:
- [largest LCP/TTFB/render-blocking issue + estimated impact]
- [largest CLS issue + fix]

## Security

| Check | Status | Evidence | Fix |
|-------|--------|----------|-----|
| SSL certificate valid | [pass/warn/fail] | [expiry/source] | [fix] |
| HTTPS enforced | [pass/warn/fail] | [HTTP response behavior] | 301 HTTP to HTTPS |
| Mixed content | [pass/warn/fail] | [affected assets/pages] | Replace with HTTPS URLs |
| HSTS enabled | [pass/warn/fail] | [header value/missing] | Add appropriate HSTS header after HTTPS is stable |

## Structured Data

| Schema type | Pages | Valid | Errors / missing opportunities |
|-------------|-------|-------|--------------------------------|
| Organization | [count] | [yes/no] | [issues] |
| Article / BlogPosting | [count] | [yes/no] | [missing blog pages] |
| Product / Offer | [count] | [yes/no] | [missing commercial pages] |
| FAQPage | [count] | [yes/no] | [visible FAQ pages without schema] |

## Overall Technical Health: [X]/100

| Area | Score |
|------|-------|
| Crawlability | [X]/10 |
| Indexability | [X]/10 |
| Performance | [X]/10 |
| Mobile | [X]/10 |
| Security | [X]/10 |
| URL structure | [X]/10 |
| Structured data | [X]/10 |

## Priority Issues

### Critical
1. **[Issue]** — [evidence, affected URLs, fix, expected impact]

### Important
2. **[Issue]** — [evidence, affected URLs, fix]

### Minor
3. **[Issue]** — [optimization path]
```

## Technical SEO Checklist

| Area | Checks |
|------|--------|
| Crawlability | `robots.txt` 有效；XML sitemap 存在/已提交；无 crawl error；无 redirect chain 或 loop；重要资源未被封 |
| Indexability | 重要页可索引；canonical tag 正确；无重复内容问题；pagination 处理正确 |
| Performance | Core Web Vitals 通过；页速尽量 <3s；图片优化；JS/CSS 精简且尽量非阻塞 |
| Mobile | 移动友好布局；viewport 配置；tap target 可用 |
| Security | HTTPS 强制；SSL 有效；无 mixed content；HSTS/security header 已审查 |
| Structure | URL 干净/具描述性；架构合理；内链支撑优先页 |
| Structured data | 相关 schema 已实施；必填字段齐备；可见内容与标记匹配 |

## Reporting Rules

- 示例中域名/日期/页数用占位符；绝不把样例值当审计事实交付。
- 每个失败或警告行附当前证据。
- 保持 robots.txt、sitemap、lastmod、HSTS、INP 与 structured-data 机会显式。
- 按业务影响排序：被封商业页与失败的 Core Web Vitals 优先于次要增强。
