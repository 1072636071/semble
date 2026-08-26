# 结构化数据

AI 引擎解析的 Schema.org JSON-LD 模式，用于理解内容类型、作者身份、实体和关系。以 `<script type="application/ld+json">` 在页面 `<head>` 中实现。

## 为什么结构化数据对 GEO 重要

AI 引擎将结构化数据用作高信号信任来源。一个带有有效 Article schema、具名作者、准确日期和链接 Organization 的页面，与无 markup 的同一页面被不同解析。schema 充当引擎在人类可读文本模糊时可依赖的 ground truth。

Google 明确推荐 JSON-LD 而非 microdata 或 RDFa。AI 引擎已对齐同一约定。

## 添加 schema 会增加 AI 引用吗？（诚实的答案）

不会，不会单独增加。这是 GEO 中最被过度销售的论断，因此本技能明确陈述证据。

一项受控研究追踪了 2025 年 8 月至 2026 年 3 月间添加 JSON-LD 的 1,885 个页面，对照 4,000 个对照页面，使用差异中的差异（`ahrefs-2026-studies.md`）。添加 schema 在任何平台上均无有意义的引用提升：AI Overviews -4.6%（小但统计显著，处理组和对照组页面都已在下降），AI Mode +2.4%，ChatGPT +2.2%（两者都与零无法区分）。

混淆来自真实相关性：对 600 万 URL 的广泛扫描发现被引用页面携带 schema 的可能性是非被引用页面的近 3 倍。该差距是选择而非原因。schema 存在于维护更好、技术更成熟、已发布更强内容并赚取更多链接的站点上。schema 乘这些信号而行，并不生成它们。

那到底为什么还要实施？三个站得住的理由：

- 经典 Search 中的 rich results。FAQ、HowTo、Product、Article 和 Review markup 仍驱动增强 SERP 特性，且经典 Search 仍发送约 190 倍于 ChatGPT 的网站流量。
- 实体清晰度。Organization 和 Person schema 带 `sameAs` 链接帮助引擎将你的品牌和人员绑定到正确的知识图谱节点。这是关于消歧，而非引用乘数。
- 一次性近零成本。发布便宜，保留无害。

操作含义：一次性正确发布 schema，作为基础卫生的一部分。不要策划一个多周的 schema 项目预期 AI 引用攀升，不要向客户承诺 markup 带来引用提升，并将节省的预算移到内容质量和站外权威上，证据指向那里。参见 `ahrefs-2026-studies.md` 和 `content-strategy.md`。

下面的模式在你确实添加 markup 时仍是正确的实现。

## Article schema（用于每篇博客、指南、文章）

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Complete Guide to Generative Engine Optimization",
  "description": "How to optimize content for AI search engines including ChatGPT, Perplexity, and Google AI Overviews.",
  "author": {
    "@type": "Person",
    "name": "Jane Smith",
    "url": "https://example.com/authors/jane-smith",
    "jobTitle": "Director of Content Strategy",
    "sameAs": [
      "https://linkedin.com/in/janesmith",
      "https://twitter.com/janesmith",
      "https://github.com/janesmith"
    ]
  },
  "datePublished": "2026-01-15T09:00:00-03:00",
  "dateModified": "2026-05-01T14:30:00-03:00",
  "publisher": {
    "@type": "Organization",
    "name": "Example Inc.",
    "url": "https://example.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png",
      "width": 600,
      "height": 60
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/guides/geo-optimization"
  },
  "image": "https://example.com/images/geo-guide-hero.jpg",
  "keywords": ["GEO", "generative engine optimization", "AI search", "LLM optimization"]
}
```

必填字段：`@context`、`@type`、`headline`、`author`、`datePublished`、`publisher`。AI 引擎将缺失 `author` 或陈旧 `dateModified` 视为负面信号。

## FAQPage schema（用于 FAQ 段落和 Q&A 页面）

该格式几乎一对一映射到 AI 引擎回答问题的方式。高杠杆。添加到产品页面、定价页面、支持页面和带 Q&A 段落的博客文章。

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Generative Engine Optimization?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Generative Engine Optimization (GEO) is the practice of structuring content so AI answer engines such as ChatGPT, Perplexity, Claude, and Google AI Overviews cite it. Unlike SEO, which targets ranked search results, GEO targets the generated answers themselves."
      }
    },
    {
      "@type": "Question",
      "name": "How is GEO different from SEO?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "SEO optimizes for ranked links in traditional search engines through keywords and backlinks. GEO optimizes for citations in AI-generated answers through authority, quotability, factual accuracy, and structured data. The two strategies overlap but the success metrics differ."
      }
    }
  ]
}
```

最佳实践：答案保持在 100 字以内。匹配真实用户输入的问题措辞。每页限制 10 到 15 个问题。

## Organization schema（用于首页和 About 页面）

为你的公司建立规范实体记录。

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Example Inc.",
  "alternateName": "Example",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "description": "Example Inc. helps brands increase visibility in AI search engines through GEO and agent-readiness consulting.",
  "foundingDate": "2020-01-01",
  "founder": {
    "@type": "Person",
    "name": "Founder Name"
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Rua Example, 100",
    "addressLocality": "Rio de Janeiro",
    "addressRegion": "RJ",
    "postalCode": "20000-000",
    "addressCountry": "BR"
  },
  "sameAs": [
    "https://twitter.com/example",
    "https://linkedin.com/company/example",
    "https://github.com/example",
    "https://en.wikipedia.org/wiki/Example_Inc",
    "https://www.crunchbase.com/organization/example"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "support@example.com",
    "availableLanguage": ["English", "Portuguese"]
  }
}
```

`sameAs` 数组对实体链接至关重要。包含每个权威外部画像。

## Product schema（用于产品和 SaaS 页面）

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "GEO Analytics Platform",
  "description": "Track and optimize brand visibility across ChatGPT, Perplexity, Claude, Gemini, and Google AI Overviews.",
  "brand": {
    "@type": "Brand",
    "name": "Example Inc."
  },
  "image": "https://example.com/product/hero.png",
  "offers": {
    "@type": "Offer",
    "price": "99.00",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": "https://example.com/pricing"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "250"
  }
}
```

对 SaaS，还添加 `SoftwareApplication` schema 作为第二个 JSON-LD 块。AI 购物查询大量依赖 Product + Offer + AggregateRating。

## HowTo schema（用于分步教程）

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Configure robots.txt for AI Crawlers",
  "description": "Step-by-step guide to allowing GPTBot, ClaudeBot, and PerplexityBot.",
  "totalTime": "PT10M",
  "supply": [
    {
      "@type": "HowToSupply",
      "name": "Access to your site's root directory"
    }
  ],
  "step": [
    {
      "@type": "HowToStep",
      "name": "Locate robots.txt",
      "text": "Find or create /robots.txt at the root of your site."
    },
    {
      "@type": "HowToStep",
      "name": "Allow AI crawlers",
      "text": "Add User-agent entries for GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, and Google-Extended with Allow: / directives."
    },
    {
      "@type": "HowToStep",
      "name": "Verify",
      "text": "Fetch /robots.txt and confirm the directives are present and properly formatted."
    }
  ]
}
```

对"how to"查询使用 HowTo。该 schema 直接映射到 AI 分步答案。

## Person schema（用于作者页面和团队页面）

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Fabio Seixas",
  "url": "https://softo.com.br/team/fabio-seixas",
  "image": "https://softo.com.br/team/fabio-seixas.jpg",
  "jobTitle": "Founder and CEO",
  "worksFor": {
    "@type": "Organization",
    "name": "Softo",
    "url": "https://softo.com.br"
  },
  "sameAs": [
    "https://linkedin.com/in/fabioseixas",
    "https://medium.com/@fabioseixas",
    "https://twitter.com/fabioseixas"
  ],
  "alumniOf": "Pontifícia Universidade Católica do Rio de Janeiro",
  "knowsAbout": ["AI", "agentic systems", "software development", "GEO"]
}
```

在每个作者简介上使用 Person。通过 URL 从 Article 的 `author` 字段链接。

## SoftwareApplication schema（用于应用和 SaaS 产品页面）

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Pulse Tech Assessment",
  "operatingSystem": "Web",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "120"
  },
  "url": "https://pulse.sof.to",
  "description": "Diagnostic tool that measures AI dev maturity of an engineering organization."
}
```

## SpeakableSpecification（用于语音 agent）

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".summary", ".key-points"]
  }
}
```

当内容有设计为由语音助手朗读的部分时使用。用 CSS 选择器标记可朗读段落。

## Review 和 AggregateRating

当你有合法评测时添加到 Product、Organization 或 LocalBusiness。不要捏造评分。AI 引擎和 Google 的 spam 团队检测虚假评测 markup。

```json
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.8",
  "bestRating": "5",
  "worstRating": "1",
  "reviewCount": "250"
}
```

## 实施规则

1. 在 `<head>` 中的 `<script type="application/ld+json">` 内使用 JSON-LD。新实现不要使用 microdata 或 RDFa。
2. 每个 Article 必须有 `author`、`datePublished`、`dateModified`、`publisher`。缺失字段损害引用率。
3. 保持 `dateModified` 准确。编辑页面时，同时更新可见日期和 schema。陈旧 `dateModified` 降低新鲜度信号。
4. 在 Person 和 Organization 上积极使用 `sameAs`。每个链接是一个实体消歧提示。
5. 逻辑嵌套 schema：Article 引用 Author（Person），其为 Publisher（Organization）工作。
6. 对 Article 内的 Q&A 段落，在同一页面上将 FAQPage 作为独立 JSON-LD 块嵌入。
7. 部署前验证。使用 Google Rich Results Test（https://search.google.com/test/rich-results）和 Schema Markup Validator（https://validator.schema.org）。
8. 每页每种实体类型一个规范 schema。不要为同一文章复制 Article schema。

## 何时添加 schema（优先级顺序）

1. 每篇博客、指南、新闻上的 Article schema。最高杠杆。
2. 首页和 About 页面上的 Organization schema。建立实体。
3. 带 Q&A 段落的前 10 个内容页面上的 FAQPage schema。直接映射到 AI 答案。
4. 每个产品或定价页面上的 Product schema（commerce 或 SaaS）。
5. 每个作者简介页面上的 Person schema。
6. 分步教程上的 HowTo。
7. 应用和 SaaS 产品页面上的 SoftwareApplication。
8. 当语音表面相关时使用 SpeakableSpecification（罕见）。

## 常见错误

- 数据不匹配：schema 说 `datePublished: 2024-01-15` 而页面可见地显示"Updated March 2026"。引擎标记此并可能折扣该页面。
- 作者作为纯字符串而非带 URL 和 `sameAs` 的 Person 对象。
- Organization schema 无 `sameAs`。实体链接的最大单一遗漏。
- FAQ schema 答案未出现在可见页面内容中。Google 和 AI 引擎都对此惩罚。
- 硬编码虚假评分或评测计数。AI 引擎常与外部评测来源交叉核对。
- 在未通过 FAST 框架的页面上实施 schema。schema 无法拯救 AI 爬虫无法抓取的页面。
