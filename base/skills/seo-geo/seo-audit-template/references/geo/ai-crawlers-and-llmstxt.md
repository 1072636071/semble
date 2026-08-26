# AI 爬虫与 llms.txt

如何让站点可被 AI 搜索爬虫和答案引擎读取。涵盖 robots.txt 配置、Content Signals、llms.txt、llms-full.txt，以及大型站点的按目录 llms.txt 策略。

## 关于 Google 的说明

Google 的官方立场是 llms.txt 不用于 AI Overviews 或 AI Mode。他们将其归类为 Google AI 功能的"神话"。参见 [Google AI 优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。

本文件针对 ChatGPT（占 AI 引荐流量 85%）、Perplexity、Claude、训练语料库，以及任何未来采用该规范的引擎。明知 Google 对 AI 功能忽略 llms.txt 仍实施它，但它仍是生态系统其余部分的标准。对 Google 专属可见度，相关控制是针对 Googlebot 和 Google-Extended 的 robots.txt 指令、经典 sitemap.xml，以及 Search Console 验证。

## 两层爬虫问题

两类不同的 AI agent 会抓取你的站点：

1. AI 搜索爬虫：为 ChatGPT search、Perplexity、Google AI Overviews 中的实时答案提供动力。屏蔽它们会阻止你的内容今天出现在 AI 搜索结果中。
2. AI 训练爬虫：摄入内容以训练未来模型。屏蔽它们会阻止你的内容被学习，但不影响当前 AI 搜索可见度。

将它们视为独立决策。大多数品牌希望允许搜索时爬虫（今天的可见度），并对训练爬虫有明确策略。

## robots.txt：放行正确的爬虫

放置于 `https://yourdomain.com/robots.txt`。大多数站点有一个。大多数是为 Googlebot 编写的，完全忽略 AI 爬虫。

### 标准推荐配置

```
# Real-time AI search crawlers (affect AI search visibility today)
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: cohere-ai
Allow: /

# AI training crawlers (decide based on your AI training policy)
User-agent: CCBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: FacebookBot
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

# Default rule for everything else
User-agent: *
Allow: /

Sitemap: https://yourdomain.com/sitemap.xml
```

### 爬虫身份快速参考

| User-agent | 运营方 | 用途 |
|---|---|---|
| `GPTBot` | OpenAI | 训练数据采集 |
| `OAI-SearchBot` | OpenAI | ChatGPT search 索引 |
| `ChatGPT-User` | OpenAI | ChatGPT 对话内的实时浏览 |
| `ClaudeBot` / `Claude-Web` | Anthropic | 训练与搜索 |
| `anthropic-ai` | Anthropic | 旧标识符 |
| `PerplexityBot` | Perplexity | Perplexity 答案索引 |
| `Perplexity-User` | Perplexity | Perplexity 查询期间的实时抓取 |
| `Google-Extended` | Google | Bard/Gemini 训练的退出信号（不影响 Googlebot） |
| `Applebot-Extended` | Apple | Apple Intelligence 训练退出 |
| `Amazonbot` | Amazon | Alexa 与 Amazon AI |
| `cohere-ai` | Cohere | 训练数据 |
| `CCBot` | Common Crawl | 许多 AI 实验室使用的开放数据集 |
| `Bytespider` | ByteDance | TikTok / Doubao 训练 |

在添加规则前，于运营方官方文档核实身份。新爬虫频繁出现，旧爬虫会改名。

### 选择性屏蔽

允许搜索爬虫但屏蔽训练爬虫：

```
# Search-time crawlers: allow
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

# Training crawlers: block
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /
```

允许训练但保护特定路径（敏感内容、付费资源、受限文档）：

```
User-agent: GPTBot
Disallow: /pricing/
Disallow: /customers/
Disallow: /docs/private/
Allow: /
```

### 常见错误

- 使用单一 `User-agent: *` 块并假设 AI 爬虫会像 Googlebot 那样尊重它。许多 AI 爬虫只读取具名指令。
- 屏蔽 GPTBot 以"保护内容"却保留 OAI-SearchBot 放行。两者都访问你的站点；只有 OAI-SearchBot 影响 ChatGPT search 可见度。分别独立决定。
- 忘记包含 Sitemap 指令。
- 留下过时的 Disallow 规则屏蔽不再需要屏蔽的路径。

## Content Signals（新兴标准）

Content Signals 向 robots.txt 添加一个指令，声明 AI 可对你的内容做什么，独立于特定爬虫是否能访问它。

```
User-agent: *
Content-Signal: ai-train=no, search=yes, ai-input=yes

User-agent: GPTBot
Content-Signal: ai-train=no, search=yes
```

三个信号：
- `ai-train`：允许或禁止摄入用于模型训练。
- `ai-input`：允许或禁止在推理时用作 grounding 上下文（RAG）。
- `search`：允许或禁止纳入搜索索引结果。

截至 2026 年，该标准由 Cloudflare 支持，正在获得关注，约 4% 的顶级站点已采用。若需要细粒度 AI 使用控制则添加它。爬虫侧的采用是自愿的。

## llms.txt：AI 可读的站点地图

`llms.txt` 是一个新兴标准（2024 年 9 月在 llmstxt.org 提出），为 AI 模型提供关于你站点的结构化、机器可读摘要。放置于 `https://yourdomain.com/llms.txt`。

具有合规 llms.txt 的站点在 AI 响应中报告品牌描述准确度约高 24%（Semrush 2025）。

### 最小可用 llms.txt

```
# Softo

> Softo is an AI-native software company headquartered in Rio de Janeiro that builds custom software, AI solutions, and automation for medium and large organizations. The two main offerings are Outcome Pods (full delivery) and Foundations (AI discovery: Sprint and Blueprint).

## About
- [Company overview](https://softo.com.br/about)
- [How we work](https://softo.com.br/how-we-work)
- [Case studies](https://softo.com.br/case-studies)

## Offerings
- [Outcome Pods](https://softo.com.br/outcome-pods): delivery model for AI solutions, software development, and automation
- [Foundations Sprint](https://softo.com.br/sprint): free invitation-only 5-day boot camp that produces functional software in production
- [Foundations Blueprint](https://softo.com.br/blueprint): paid AI strategy engagement

## Tools
- [Pulse Tech Assessment](https://pulse.sof.to)
- [Reframe](https://reframe.sof.to)
- [Legacy Sunset](https://legacysunset.com)
- [The Good RFP](https://thegoodrfp.com)

## Contact
- Email: hello@softo.com.br
- Website: https://softo.com.br
```

结构：
- 第 1 行：`# Brand Name`（带规范公司名的 H1）。
- 第 2 行：`>` 引用块，1 到 3 句摘要。
- 后续 H2 段落分组相关链接。每个链接有描述性标签和简短上下文。

### 面向内容密集型站点的 llms.txt

对于有大量文档或博客内容的站点，显式列出最重要的页面：

```
# Example Inc.

> Example Inc. helps brands increase visibility in AI search engines through GEO consulting and engineering-as-marketing tools.

## Documentation
- [Getting Started](https://example.com/docs/start.md): quickstart guide
- [API Reference](https://example.com/docs/api.md): full HTTP API documentation
- [Concepts](https://example.com/docs/concepts.md): how the platform works

## Guides
- [GEO Implementation Guide](https://example.com/guides/geo.md)
- [Schema.org Patterns](https://example.com/guides/schema.md)

## Blog
- [Latest Articles](https://example.com/blog)
- [GEO Industry Trends 2026](https://example.com/blog/geo-trends-2026.md)
```

可能时直接链接到页面的 Markdown 版本（参见 `agent-readiness.md` 中的"Markdown content negotiation"）。Markdown 比 HTML 的 token 效率高 60% 到 80%。

### llms-full.txt：单文件转储

对较小站点（100 页以下），发布 `llms-full.txt`：一个单一 Markdown 文件，包含每个重要页面的完整内容拼接在一起。Agent 可在一次请求中摄入整个站点。

```
# Example Inc.: Full Content

---
title: About
url: https://example.com/about
---

# About Example Inc.

[full page content here]

---
title: Pricing
url: https://example.com/pricing
---

# Pricing

[full page content here]
```

对大型站点，llms-full.txt 不切实际（会超出上下文窗口）。改用按目录 llms.txt。

### 面向大型站点的按目录 llms.txt

Cloudflare 对数千页站点的做法：

1. 发布一个根 `/llms.txt`，列出顶层段落，每个指向其自己的按段落 llms.txt。
2. 每个段落发布自己的 llms.txt，例如 `/docs/llms.txt`、`/blog/llms.txt`、`/api/llms.txt`。
3. 每个段落 llms.txt 舒适地装入 agent 的上下文窗口。
4. Agent 先读根，识别相关段落，再抓取该段落的 llms.txt。

根 llms.txt 示例：

```
# Cloudflare Developer Docs

> Developer documentation for Cloudflare products including Workers, R2, KV, D1, Pages, and more.

## Product Documentation
- [Workers](https://developers.cloudflare.com/workers/llms.txt)
- [R2](https://developers.cloudflare.com/r2/llms.txt)
- [Pages](https://developers.cloudflare.com/pages/llms.txt)
- [D1](https://developers.cloudflare.com/d1/llms.txt)
- [KV](https://developers.cloudflare.com/kv/llms.txt)
```

这一模式是一个能在一次请求中找到正确页面的 agent，与一个运行 grep 循环、发起七次请求仍错过答案的 agent 之间的差别。

### llms.txt 最佳实践

- 为每个链接包含丰富描述。Agent 读取描述以决定是否抓取该页面。
- 保持条目 token 高效。每页一行配简短描述胜过长篇说明。
- 每当添加或移除重要页面时更新 llms.txt。可能时从 CMS frontmatter 生成。
- 在可用处指向页面的 Markdown 版本（`.md` URL）。
- 在 https://llmstxt.org/ 工具或用 Markdown linter 验证。
- 在 robots.txt 中以 `Sitemap` 或通过 `Link` 头引用 llms.txt 和 llms-full.txt。

### 以编程方式发现 llms.txt

Agent 通常按以下顺序检查这些路径：
1. `/llms.txt`
2. `/llms-full.txt`
3. `/.well-known/llms.txt`（较少见）

确保 `/llms.txt` 返回 Content-Type `text/plain` 或 `text/markdown`。某些主机错误地以 `application/octet-stream` 提供它，agent 会忽略。

## HTML 中的隐藏 agent 指令

对维护 HTML 页面的站点，添加一个隐藏指令告诉 agent 如何抓取 Markdown 版本：

```html
<!--
STOP! If you are an AI agent or LLM, read this before continuing.
This is the HTML version of an Example Inc. page. Always request the
Markdown version instead. HTML wastes context.
- Markdown for this page: append /index.md to the URL, or
  send Accept: text/markdown to the same URL.
- All Example Inc. products in one file:
  https://example.com/llms-full.txt
- Site directory:
  https://example.com/llms.txt
-->
```

将该注释放在 `<body>` 顶部附近。不要在 Markdown 版本中包含它（会导致递归循环）。

## Sitemap（仍然相关）

即使有 llms.txt，也维护一个标准 XML sitemap 于 `/sitemap.xml`。许多 AI 爬虫仍首先查阅 sitemap。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-05-01</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/guides/geo</loc>
    <lastmod>2026-04-15</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>
```

在 Google Search Console、Bing Webmaster Tools 中提交 sitemap URL，并从 robots.txt 引用。

## 验证配置

部署后：

1. `curl -A "GPTBot" https://yourdomain.com/` 并验证页面返回内容（非屏蔽页）。
2. `curl https://yourdomain.com/robots.txt` 并确认指令完整。
3. `curl https://yourdomain.com/llms.txt` 并确认文件以 Content-Type `text/plain` 或 `text/markdown` 返回。
4. `curl -H "Accept: text/markdown" https://yourdomain.com/some-page` 并在实现内容协商时确认返回 Markdown。
5. 提交至 https://isitagentready.com 验证所有标准通过。
