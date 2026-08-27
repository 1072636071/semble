# LLM Crawler Handling

用 robots.txt 与服务器策略决定哪些 AI 爬虫可访问内容。这是策略与技术 SEO 决策，不仅是爬虫控制任务。

## Crawler Matrix

| Bot | Operator / Use | Typical Rule |
|-----|----------------|--------------|
| OAI-SearchBot | OpenAI search/citation discovery | 期望 ChatGPT search 可见时放行 |
| GPTBot | OpenAI training/crawling | 接受 AI 可见/数据使用时放行；TDM 限制则封禁 |
| ChatGPT-User | OpenAI user-requested browsing/actions | 通常为用户触发访问放行；robots.txt 可能不适用 |
| ClaudeBot / anthropic-ai | Anthropic crawling | 与 GPTBot 同策略 |
| Google-Extended | Google AI training opt-out | 封禁以限制 training，Googlebot 仍可索引 |
| Googlebot | Search indexing | 通常放行 |
| Bingbot | Search indexing / Copilot ecosystem | 通常放行 |
| PerplexityBot | AI answer retrieval | 期望引用可见时放行 |
| Perplexity-User | Perplexity user-triggered fetcher | 仅在日志/IP 文档确认此访问路径被需要时放行 |
| CCBot | Common Crawl | 不期望广泛数据集复用时封禁 |

## Policy Modes

| Mode | Use When | Robots Pattern |
|------|----------|----------------|
| default-open | 目标是 AI 可见与引用发现 | 放行 search、retrieval 与选定 AI bot；仅封敏感路径 |
| default-closed | 已授权、付费、私有或 TDM-reserved 内容 | 默认封禁广泛 AI 爬虫；仅放行已批准的 search/retrieval bot |
| split | Search indexing 是、AI training 否 | 放行 Googlebot/Bingbot/OAI-SearchBot/选定 retrieval bot；封禁 GPTBot、ClaudeBot、CCBot、Google-Extended |

## Search-Only Starter

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
User-agent: Bingbot
Disallow:

Sitemap: https://example.com/sitemap.xml
```

## Technical Checks

| Check | Why |
|-------|-----|
| robots.txt 返回 200 且可解析 | 爬虫策略必须可读 |
| Search bot 仍放行 | 避免意外 SEO 损失 |
| Sitemap 引用当前 canonical URL | 支持发现 |
| Retrieval bot 含 OAI-SearchBot、ChatGPT-User、PerplexityBot、Perplexity-User（按需） | 避免意外引用损失 |
| 发布的 IP 范围与 provider JSON 一致（用 edge 规则时） | 避免伪造与陈旧 allowlist |
| 私有/受限路径用 auth 或 noindex，而非仅 robots.txt | robots.txt 非访问控制 |
| 日志确认 bot 行为 | 上线后验证爬虫策略 |

## Cloudflare Edge-Override Gotcha

Cloudflare 等 edge 工具可覆盖源站 robots.txt、在到达该文件前封禁 user agent、或按 host/path 提供不同规则。在断定已发布 robots.txt 即生效的爬虫策略前，检查 WAF/bot 规则、Workers、Transform Rules、cache variant 与源站原始响应。

## Legal/Compliance Notes

EU AI Act Art 53 与 EU DSM TDM reservation 对 rights-reserved 内容可能相关。robots.txt 可表达意图，但非完整的 training opt-out 或授权机制。对受监管/已授权内容，将爬虫策略与合同、访问控制、rights-reservation 通知（如已采纳的 TDM reservation）以及目标爬虫实际遵守的 `X-Robots-Tag` 指令配合使用。

## Reporting Fields

策略模式、放行 bot、封禁 bot、受影响路径、业务理由、来源/日期、预期 SEO/GEO 效果与重测日期。
