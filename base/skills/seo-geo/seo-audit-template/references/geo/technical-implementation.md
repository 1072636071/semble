# 技术实现

决定 AI 爬虫是否能抓取、解析并信任你站点的技术先决条件。这些不到位，内容质量无关紧要。

## FAST 框架：可抓取性测试

FAST 框架（Fetchable、Accessible、Structured、Trim）是评估 AI 爬虫就绪度的最快方式。

### F：Fetchable

AI 爬虫能否在不执行 JavaScript 的情况下检索并读取 HTML？

测试：在浏览器中禁用 JavaScript 加载页面（DevTools > Settings > Disable JavaScript）。剩余内容大约就是 AI 爬虫所见。许多 AI 爬虫（GPTBot、ClaudeBot、PerplexityBot）不执行 JavaScript。

常见失败：
- React、Vue、Angular SPA 客户端渲染内容。禁用 JS 显示空白页面。
- 页面加载后通过 `fetch()` 或 `useEffect()` 加载内容。
- 无 JS 永不解析的"Coming soon"占位符。

修复：
- 服务端渲染（SSR）：Next.js 用 `getServerSideProps`、Nuxt 用 `asyncData`、Remix loaders、SvelteKit `load` 函数、Astro SSR。
- 静态站点生成（SSG）：相同框架用 `getStaticProps`/`generate` 模式用于不频繁变化的内容。
- 增量静态再生（ISR）：Next.js `revalidate`、按需再验证用于频繁更新的规模化站点。

对新项目，可能时默认 SSG（最佳性能、最低成本）。当内容用户特定或按请求变化时切换到 SSR。混合情况用 ISR。

### A：Accessible

关键内容在无脚本情况下是否可理解？

检查：
- 所有 `<img>` 标签有描述性 `alt` 文本。装饰性图像用 `alt=""`。
- 所有 `<video>` 和 `<audio>` 在 HTML 中有字幕或转录。
- 标题层级用语义 `<h1>` 到 `<h6>` 标签，而非样式化 div。
- 表单标签用 `<label for="...">` 正确关联。
- 在原生语义不足处正确使用 ARIA 属性。

坏：
```html
<div class="title">What is GEO?</div>
<div class="content">GEO is the practice of...</div>
```

好：
```html
<article>
  <h1>Complete Guide to GEO</h1>
  <header>
    <p>By <a href="/authors/jane-smith" itemprop="author">Jane Smith</a></p>
    <time datetime="2026-05-01">May 1, 2026</time>
  </header>
  <section>
    <h2>What is GEO?</h2>
    <p>Generative Engine Optimization is the practice of...</p>
  </section>
</article>
```

### S：Structured

是否使用 Schema.org、语义 HTML5 标签和清晰层级？

要求：
- `<head>` 中的 Schema.org JSON-LD（参见 `structured-data.md`）。
- 语义 HTML5：`<article>`、`<section>`、`<nav>`、`<header>`、`<footer>`、`<aside>`、`<main>`。
- 正确标题顺序：每页一个 `<h1>`，`<h2>` 用于顶层段落，`<h3>` 用于子段落。
- 并行项用列表，表格数据用表格，代码用代码块。

### T：Trim

是否只发送所需，无臃肿？

检查：
- 页面总重（含图像）低于 1 MB。
- HTML body 压缩后低于 100 KB。
- JavaScript bundle 压缩后低于 200 KB，可能时懒加载。
- 无未使用的追踪脚本。每个为爬虫增加延迟。
- 压缩图像（栅格用 WebP 或 AVIF，矢量用优化 SVG）。

工具：Lighthouse、WebPageTest、PageSpeed Insights。

## 快速 FAST 审计

对任何站点的前 20 个页面运行：

```bash
# Disable JS check: fetch raw HTML and look for content
curl -sL https://example.com/page | grep -i "main keyword from page"

# If grep returns nothing, the content is JS-rendered. Failing F.

# Render with a JS-disabled headless browser
# (Puppeteer with javaScriptEnabled: false)

# Check response size
curl -sL -w "%{size_download}\n" https://example.com/page -o /dev/null
```

若 F 在某页面失败，在做任何其他 GEO 工作前修复它。schema、llms.txt、内容质量：若爬虫得不到任何东西，这些都到不了 AI 引擎。

## Core Web Vitals

AI 爬虫有隐式超时。慢页面得到部分抓取或完全跳过。目标：

| 指标 | 目标 | 备注 |
|---|---|---|
| LCP（Largest Contentful Paint） | 低于 2.5 秒 | 对爬虫体验最直接的影响 |
| INP（Interaction to Next Paint） | 低于 200ms | 2024 年取代 FID |
| CLS（Cumulative Layout Shift） | 低于 0.1 | 影响内容稳定性 |
| TTFB（Time to First Byte） | 低于 800ms | 对爬虫效率关键 |
| FCP（First Contentful Paint） | 低于 1.8 秒 | 指示 SSR 工作中 |

工具：Google PageSpeed Insights、web.dev/measure、Chrome DevTools Performance 标签、真实用户监控（RUM）。

常见收益：
- 迁移到 CDN（Cloudflare、Fastly、Vercel Edge）。
- 使用 HTTP/2 或 HTTP/3。
- 内联关键 CSS，延迟非关键 CSS。
- 用 `loading="lazy"` 懒加载首屏下图像。
- 用 `<picture>` 配 WebP/AVIF 源。
- 用 `font-display: swap` 预加载关键字体。

## 语义 HTML 参考

使用这些标签。避免 div-soup。

| 标签 | 用于 |
|---|---|
| `<article>` | 自包含内容片段（博客文章、新闻文章、评论） |
| `<section>` | 文章或页面内的主题分组 |
| `<nav>` | 导航菜单 |
| `<header>` | 页面或文章的引导内容 |
| `<footer>` | 页面或文章的页脚 |
| `<aside>` | 切线相关内容（侧栏、相关链接） |
| `<main>` | 页面的主要内容（每页恰好一个） |
| `<figure>` 和 `<figcaption>` | 带说明的图像、图示、代码样例 |
| `<time datetime="2026-05-01">` | 日期和时间 |
| `<address>` | 联系信息 |

## URL 结构

干净 URL 帮助 AI 引擎分类内容。稳定 URL 让引用随时间持久。

好：
```
https://example.com/guides/generative-engine-optimization
https://example.com/blog/geo-vs-seo-comparison
https://example.com/glossary/llms-txt
https://example.com/case-studies/healthcare-saas-2026
```

坏：
```
https://example.com/p?id=12345
https://example.com/blog/2026/05/18/post-title-here
https://example.com/content.php?category=seo&type=guide&id=789
https://example.com/blog/this-is-a-very-long-title-that-was-auto-generated-from-the-h1-and-keeps-going
```

规则：
- 使用小写、连字符 slug。
- 除非内容确实时间绑定，避免日期路径。
- 避免规范 URL 用查询字符串。
- slug 保持在 60 字符以内。
- 接近 H1（但修剪，不要完全重复）。
- 一旦发布，不要更改 URL。必须时用 301 重定向。

## Canonical URL

每个页面必须通过 `<link rel="canonical">` 和 schema 的 `mainEntityOfPage` 声明其 canonical URL。防止跨 www / 非 www、http / https、追踪参数、分页的重复内容问题。

```html
<link rel="canonical" href="https://example.com/guides/geo">
```

对分页列表，将所有页面指向第一页作为 canonical（或若分页保留独特内容则用 `rel="prev"` / `rel="next"`）。

## HTTPS

强制。AI 爬虫强烈降权非 HTTPS 站点。使用 HSTS：

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

稳定后提交到 https://hstspreload.org 的 HSTS 预加载列表。

## Sitemap (XML)

提交到 Google Search Console、Bing Webmaster Tools，并在 robots.txt 中引用。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-05-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

对超过 50,000 URL 的站点，使用指向多个 sitemap 文件的 sitemap 索引。从 CMS 自动生成。准确更新 `lastmod`，因为 AI 爬虫用它决定再抓取优先级。

## 面向 AI 引擎的图像优化

AI 引擎越来越多地在多模态答案中引用图像（Google AI Overviews、ChatGPT vision search、Perplexity images 标签）。

对每个图像：
- 描述性文件名：`geo-citation-rates-by-platform.png`，而非 `IMG_4823.png`。
- 描述性 `alt` 文本："Bar chart showing AI citation rates across ChatGPT, Perplexity, Claude, and Gemini, with ChatGPT leading at 47%"。非"chart"。
- 上下文重要时用 `<figcaption>` 加说明。
- 优化格式：WebP 或 AVIF。需要时提供 JPEG 回退。
- 合理尺寸。不要向 800 像素槽提供 4000 像素宽图像。
- 为重要页面上的 hero 图像添加 `ImageObject` schema。

## 内部链接

AI 引擎抓取链接图以发现内容并推断主题权威。

规则：
- 从基石内容（你的支柱页面）链接到支持内容。
- 使用描述性锚文本。非"click here"。非"this article"。目的地所关于的确切短语。
- 维持平缓架构：大多数页面在首页 3 次点击内。
- 构建主题集群：一个 hub 页面环绕细节页面，全部互链。
- 避免孤立页面（无入站内部链接）。爬虫可能错过它们。

锚文本示例：

坏："Read more about GEO [here]."

好："Read our complete guide to [generative engine optimization](https://example.com/guides/geo) for the full framework."

## 移动友好性

移动优先索引也适用于 AI 爬虫。许多模拟移动 user agent 或抓取移动渲染。

验证：
- 单一响应式站点（首选）。非 m.example.com。
- 存在 viewport meta 标签：`<meta name="viewport" content="width=device-width, initial-scale=1">`。
- 点击目标至少 48 x 48 像素。
- body 文本字体至少 16px。
- 标准移动宽度上无水平滚动。

## 高级：实体解析

AI 引擎构建实体图。帮助它们将你的品牌、产品和人员放到正确节点。

- 一致命名：到处使用相同品牌名。避免混用"Acme"、"Acme Inc."、"Acme Corp"。
- Schema `sameAs`：将 Organization 和 Person 实体链接到 Wikipedia、Crunchbase、LinkedIn、Twitter、GitHub。
- 在 Article schema 中用 `mentions` 标记文章中讨论的实体。
- 避免名称冲突。若你的产品名匹配现有实体（常见词、另一公司产品），用 schema 中前缀或替代名消歧。

## 高级：RAG 适配

由检索增强生成驱动的 LLM 分块并嵌入内容。为检索优化：

- 模块化内容。每个 H2 下的每个段落应独立成立。
- 在每个段落前置答案。标题后的第一段常是被检索的。
- 使用语义 HTML 以便分块器识别边界。
- 避免隐藏文本和 JavaScript 渲染内容（被许多嵌入器排除）。
- 提供页面的 Markdown 版本（参见 `agent-readiness.md`）。

## 验证清单

在宣布站点技术上 GEO 就绪前：

- [ ] 所有禁用 JS 抓取的页面返回预期内容。
- [ ] Core Web Vitals 在至少 75% 的移动会话上通过（按 Search Console）。
- [ ] 全站点启用 HTTPS 带 HSTS。
- [ ] 每个可索引页面声明 canonical URL。
- [ ] XML sitemap 提交到 Google Search Console。
- [ ] robots.txt 允许 AI 搜索爬虫（参见 `ai-crawlers-and-llmstxt.md`）。
- [ ] llms.txt 发布在站点根（参见 `ai-crawlers-and-llmstxt.md`）。
- [ ] 每个重要页面上的 Schema.org JSON-LD（参见 `structured-data.md`）。
- [ ] 全站点语义 HTML（无 div-soup）。
- [ ] 内部链接形成清晰主题集群。
- [ ] 全站点图像 alt 文本描述性。
- [ ] 站点通过 isitagentready.com 核心检查（参见 `agent-readiness.md`）。
