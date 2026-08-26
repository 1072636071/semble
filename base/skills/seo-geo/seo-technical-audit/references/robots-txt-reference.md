# Robots.txt Reference Guide

用 robots.txt 控制爬取，而非索引。阻止索引请用 `noindex` meta 或 `X-Robots-Tag`。

## Directives

| Directive | Use | Notes |
|-----------|-----|-------|
| `User-agent: *` | 所有 bot | 在规则前合并连续的 user-agent 行 |
| `Disallow: /path/` | 封爬路径 | 目录用 `/admin/` 比 `/admin` 更安全 |
| `Allow: /path/` | 覆盖更广的封禁 | Google、Bing 及多数主流爬虫支持 |
| `Sitemap: https://example.com/sitemap.xml` | 声明 XML sitemap | 绝对 URL；允许多行 |
| `Crawl-delay: 10` | 放慢某些爬虫 | Googlebot 忽略；Google 用 Search Console |

## Common User Agents

`Googlebot`、`Bingbot`、`DuckDuckBot`、`OAI-SearchBot`、`GPTBot`、`ChatGPT-User`、`ClaudeBot`、`anthropic-ai`、`PerplexityBot`、`Perplexity-User`、`CCBot`、`Google-Extended`。

## AI Crawler Patterns

封禁 AI training 与广泛数据集爬虫，同时放行 search indexing 与选定 AI retrieval bot：

```txt
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: anthropic-ai
User-agent: CCBot
User-agent: Google-Extended
Disallow: /

User-agent: OAI-SearchBot
Disallow:

User-agent: ChatGPT-User
Disallow:

User-agent: PerplexityBot
User-agent: Perplexity-User
Disallow:

User-agent: Googlebot
Disallow:

User-agent: Bingbot
Disallow:

Sitemap: https://example.com/sitemap.xml
```

仅放行搜索引擎：封 `User-agent: *`，再显式放行 Googlebot、Bingbot、DuckDuckBot 与所需商业爬虫。

## SEO-Critical Configs

| Scenario | Starter rules |
|----------|---------------|
| Parameter crawl waste | `Disallow: /*?` 再 `Allow: /?`（仅首页/搜索需要时） |
| Ecommerce | 封 account/cart/checkout/admin、参数 filter/sort/search；放行 `/products/` |
| WordPress | 封 `/wp-admin/`、放行 `/wp-admin/admin-ajax.php`、放行 upload、按需封 feed/search/trackback |
| Staging | `Disallow: /` 加 noindex/auth；若被索引则经 Search Console 移除 |

## Mistakes and Fixes

| Mistake | Risk | Fix |
|---------|------|-----|
| 封 CSS/JS | Google 无法 render 页面 | 放行资源路径 |
| 相对 sitemap | 可能无法解析 | 用绝对 sitemap URL |
| 冒号前有空格 | 语法无效 | `User-agent: Googlebot` |
| 缺尾斜杠 | 过封相似路径 | 目录用 `/admin/` |
| 用 robots.txt de-index | 被链接仍可被索引 | 用 noindex/meta/header |
| 大小写不匹配 | 路径大小写敏感 | 覆盖真实 URL 变体 |

## File Requirements

返回 200、纯文本 UTF-8、位于 `/robots.txt`、文件名小写、<500KB、在 Search Console 测试。

## Monitoring

月度：可访问性、被封 URL、crawl stats。季度：被封路径、私有段、AI 爬虫变更。迁移后：重测 URL 结构与 sitemap 引用。

## Emergency Fixes

若站被意外封禁，改为 `User-agent: *` 加空 `Disallow:`、加 Sitemap、在 Search Console 测试并请求重爬。若 CSS/JS 被封，加资源 `Allow` 规则并重 render 关键 URL。
