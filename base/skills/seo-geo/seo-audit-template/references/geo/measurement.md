# 度量

如何追踪 AI 搜索表现、为 AI 引荐流量配置 GA4，以及选择监控栈。关键指标与追踪它们的工具。

## 关键行业基准（相关时引用）

| 数据点 | 数值 | 来源 / 日期 |
|---|---|---|
| AI 搜索访客转化率 vs. 自然 | 4.4 倍更高 | Semrush AI Search Study 2025 |
| B2B 转化率 vs. 传统搜索 | 6 到 27 倍更高 | Backlinko 2025 Analysis |
| 预计 AI 搜索超越传统的年份 | 2028（若 Google AI Mode 成为默认则更早） | Semrush 2025 |
| AI 引荐访问（2025 年 6 月） | ~1.13 B，同比 +357% | Semrush AI Referral Traffic Research |
| ChatGPT 占 AI 引荐流量份额 | 85.79% | Semrush 2025 年 7 月 |
| ChatGPT 引用来自 Google 21+ 位的 | ~90% | Semrush AI Search Study 2025 |
| Google AI Overviews 出现率 | ~15% 的关键词搜索 | Semrush Sensor |
| 非品牌 AI 查询中的品牌提及 | 26 到 39% | Semrush AI Mentions Study |
| LLM 起源流量增长 Q2 2024 至 Q2 2025 | +800% | Backlinko 2025 |
| Cloudflare 文档用 Markdown 的 token 减少 | 最高 80% | Cloudflare 2026 年 4 月 |
| AI Overview 对 #1 自然结果的点击削减 | 58%（约 10 个月前为 34.5%） | Ahrefs 2026 |
| AI Overview 引用来自 Google 前 10 名 | 38%（一年前为 76%） | Ahrefs 2026 |
| 信息意图查询上的 AI Overviews | 99.9% | Ahrefs 2026 |
| 购物查询上的 AI Overview 触发率 | 3.2% | Ahrefs 2026 |
| ChatGPT 检索的 URL 中被引用的 | ~50% | Ahrefs 2026 |
| ChatGPT 被引用最多页面中 Google 可见度为零的 | 28% | Ahrefs 2026 |
| ChatGPT 被引用最多页面中可影响的 | 32.3% | Ahrefs 2026 |
| "Best X" 列表占被引用页面类型份额 | 43.8% | Ahrefs 2026 |
| 最强可见度相关因子（YouTube 提及，Spearman） | ~0.737 | Ahrefs 2026 |
| 添加 schema 对 AI 引用的影响 | ~0（无有意义提升） | Ahrefs 2026（受控 DiD） |
| AIO vs AI Mode 引用重叠 | 13.7%（86% 语义一致） | Ahrefs 2026 |
| ChatGPT 占 Google 搜索量份额 | ~12% | Ahrefs 2026 |
| Google vs ChatGPT 网站引荐流量 | Google 约多 190 倍 | Ahrefs 2026 |
| Google 点击落入前 10 名结果 | 96.98% | Ahrefs 2026 |

对任何早于截止日期的数字，引用前先 web_search。

## 核心指标

### AI 引用率

AI 答案引擎在你领域内的查询中引用你内容的频率。

- 用 AI 搜索监控工具度量（Profound、Otterly、Peec、Scrunch、Geol、Goodie、Ezeo、Maximus Labs、LLM Radar）。
- 按平台追踪（ChatGPT、Perplexity、Claude、Gemini、Google AI Overviews）。
- 按查询类型追踪（你的前 50 到 200 个相关查询）。
- 按内容类型追踪（你的哪些页面被引用）。

先建立基线。再从那里改进。引用率因行业而异：高权威出版商在其核心主题上看到 60%+ 引用率；新兴品牌通常起始低于 5%。

### 品牌提及

你的品牌名在 AI 响应中出现的频率，含品牌化和非品牌化查询。

- 品牌化查询（"What is [Your Brand]?"）应 100% 提及你。否则你有重大实体问题。
- 非品牌化查询（"Best X for Y"）应按你的市场存在比例提及你。行业基线：26 到 39% 的非品牌化查询包含至少一个品牌提及；新兴品牌常看到 0%。

也追踪情感。带对冲语言（"might be worth considering"）的品牌提及不如明确推荐（"we recommend"）有价值。

### 站外存在（领先指标）

引用率是滞后指标。最强的已度量领先指标位于你自己站点之外，因此将它们作为预测未来可见度的输入来追踪。

- YouTube 提及：在一项 75,000 个品牌的研究中是 AI 可见度的单一最强相关因子，领先于所有传统 SEO 指标（`ahrefs-2026-studies.md`）。追踪你自己频道的产出加上提及你品牌的第三方视频计数。
- 第三方品牌提及：跨 Reddit、Quora、行业出版物、播客和对比列表计数可信提及。这些独立于你的页面喂养引擎。
- 对比列表位置：追踪你的品牌是否出现在你品类的可信"best X"列表上，以及位置多高。位置与被推荐相关。

这些不是虚荣指标。它们是两个季度后推动引用率的工作。schema 推广不在此列表中，因为受控证据表明它不推动 AI 引用（参见"常见度量错误"）。

### AI 引荐流量

源自 AI 引擎的站点会话。

- 通过 GA4 用自定义渠道分组追踪（配置如下）。
- 不同于自然搜索流量。不同意图，不同转化行为。
- AI 引荐访客通常以 4.4 倍于自然搜索访客的比率转化。

### 引用准确度

AI 引擎引用的关于你的事实是否正确？季度核实。

- 运行一个脚本，用品牌化查询查询主要 AI 引擎。
- 将答案与你的权威来源（首页、About 页面、产品页面）交叉核对。
- 不准确很常见，尤其对新兴品牌。通过在高权威上下文中发布正确事实来修复。

### 可见度得分 / Share of voice

大多数监控工具提供的复合指标。聚合跨追踪查询的引用率、品牌提及率和排名位置。适用于高管汇报。

## GA4 配置：追踪 AI 引荐流量

在 GA4 中添加自定义渠道分组以将 AI 流量从通用引荐流量中分离。

1. 进入 GA4 → Admin → Data display → Channel groups。
2. 点击"Create new channel group"。
3. 名称："AI Referral Traffic"。
4. 添加一个名为"AI Referrals"的新渠道。
5. 条件：

```
Source matches regex:
.*(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|bard\.google\.com|you\.com|search\.brave\.com|copilot\.microsoft\.com|grok\.x\.ai|x\.com/grok|meta\.ai|deepseek\.com|kagi\.com|phind\.com|consensus\.app).*
```

6. 将"AI Referral Traffic"渠道移到标准"Referral"渠道之上。
7. 保存并跨获客报告应用。

配置后，你将在 Acquisition > Traffic acquisition 中看到 AI 流量单独列出。将 AI 流量转化率与自然搜索对比，以验证你站点的 4.4 倍基准。

## 监控工具

按主要用例分类。大多数工具重叠。

### AI 搜索引擎监控（引用与可见度追踪）

| 工具 | 优势 | 备注 |
|---|---|---|
| Profound | 多语言品牌可见度 | 适合全球品牌 |
| Geol.ai | 50+ 因子评分，CMS 集成 | 适合想要 CMS 工作流的营销者 |
| OptimizeGEO | 可见度得分、share of voice、情感 | SOC 2 / ISO 27001 合规；企业级 |
| Otterly.AI | 排名追踪 | 轻量级，良好入门点 |
| Peec AI | 品牌提及分析 | 情感分析强 |
| Scrunch AI | 实时监控带幻觉检测 | 快速捕获事实错误 |
| Goodie AI | 多平台（ChatGPT、Gemini、Perplexity） | 专业 GEO 平台 |
| Ezeo | ChatGPT、Claude、Perplexity、Gemini、Grok、Reddit | 更广平台覆盖 |
| Prompt Monitor | Prompt 级分析 | 适合技术团队 |
| Conductor | 企业 AEO + 传统 SEO | 大团队的综合平台 |
| Maximus Labs | 跨 10+ AI 平台的品牌提及与引用 | 可见度分析深度 |
| LLM Radar | 实时追踪 LLM 如何引用你的品牌 | 良好监控层 |
| BrightEdge AI Search | 企业 AI Overviews 与 Copilot 追踪 | 企业定价 |
| seoClarity | GEO 分析模块 | 带 GEO 附加的企业 SEO 平台 |

选择 1 到 2 个。大多数团队与其现有 SEO 平台（Conductor、BrightEdge、seoClarity、Botify）重叠，并添加一个专用 GEO 监控器（Profound、Otterly、Peec）。

### 内容优化

| 工具 | 优势 |
|---|---|
| Clearscope | AI 驱动内容评分 |
| Surfer SEO | SERP 分析加内容优化 |
| MarketMuse | 内容策略 |
| Frase | Agentic 内容创建带 GEO 评分 |
| Athena | AI 引用模式分析 |
| Answer Socrates | GEO 关键词与问题发现 |

### 品牌提及监控（比 AI 更广）

| 工具 | 优势 |
|---|---|
| Brand24 | 社交 + 网络品牌监控 |
| Mention | 实时媒体追踪 |
| Brandwatch | 消费者智能 |
| Talkwalker | 社交聆听 |

这些早于 AI 搜索，但捕获跨第三方来源（Reddit、Quora、新闻）的提及，喂养 AI 引擎。

### Google 专属表面（用于 AI Overviews 与 AI Mode）

根据 [Google AI 优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)，这些是 Google 明确推荐用于其 AI 功能可见度的表面。当 Google AI 功能在范围内时，将它们视为度量栈的一部分。

| 表面 | 用途 |
|---|---|
| Google Search Console | 验证站点。监控 impressions 和 clicks，含 AI Overview 增强结果。诊断索引问题。 |
| Google Merchant Center | 提交产品 feed。AI Overviews 和 Search 购物体验中产品引用所需。 |
| Google Business Profile | 认领本地商家列表。AI Overviews 中本地引用所需。 |
| Business Agent | Google Search 中的对话式品牌存在。Business Profile 上的可选附加产品层。 |

这些是免费、官方、Google 专属的。它们不度量 ChatGPT、Perplexity、Claude 或 Gemini 的非 Search 行为。将它们与上述 AI 搜索监控工具配对以获完整覆盖。结构化数据验证见下一节下的 Google Rich Results Test。

### 结构化数据验证

- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema Markup Validator: https://validator.schema.org
- Merkle Schema Markup Generator: https://www.merkle.com/tools/schema-markup-generator（用于生成）

### Agent 就绪扫描器

- isitagentready.com（Cloudflare）
- Ora Deep Scan（agentready.org 官方扫描器）
- Cloudflare URL Scanner 带 `agentReadiness: true` 选项

## 监控工作流

每周：
1. 从 GA4 拉取 AI 引荐流量。周环比比较。
2. 从所选监控工具检查引用率。
3. 在 ChatGPT、Perplexity、Google AI Overviews 上手动抽查 3 到 5 个顶级品牌化查询。关注准确度与情感。

每月：
1. 对前 20 个品牌化查询做完整引用准确度审计。
2. 审查哪些内容获得了最多引用。识别模式。
3. 更新 llms.txt 和任何已刷新页面的 `dateModified`。
4. 对前 10 个页面重新运行 isitagentready.com。

每季度：
1. 用新数据、扩展段落、更新日期刷新前 20 个被引用页面。
2. 全站点审计 Schema.org markup。
3. 重新检查 Core Web Vitals。
4. 审查竞争对手引用模式。他们在哪里被引用而你不在？

每年：
1. 重新评估监控栈。工具快速整合。
2. 刷新常青内容。超过 18 个月的页面通常需要重大更新以维持引用率。
3. 战略审查：你应拥有哪些查询？应加倍投入哪些内容类型？应投资哪些渠道（Reddit、YouTube、播客、行业出版物）以提升第三方引用？

## 为高管度量什么

CEO 和 CMO 需要一小套将 AI 搜索表现转化为业务成果的数字。

精简清单：

1. AI 引荐流量（会话/月）和转化率。
2. 前 20 个战略查询上的 AI 引用率。
3. 非品牌化品类查询中的品牌提及率。
4. 可归因于 AI 引荐会话的 pipeline 或收入。
5. 上述每项的同比增长。

避免让高管淹没在工具特定得分中。将一切回连到流量、转化、pipeline 和收入。4.4 倍转化乘数是最有用的高管面向基准：它在不要求熟悉 GEO 术语的情况下证明投入合理。

## 常见度量错误

- 仅追踪通用引荐流量而不将 AI 引擎拆分为自己的渠道。隐藏了真实故事。
- 在技术基础到位前设置监控。你将度量来自本应早就修复的问题的改进。
- 追踪引用率而不含情感。负面提及是问题，不是胜利。
- 选择太多工具。重叠数据拖慢决策。选一个引用追踪器、一个内容工具、一个品牌提及工具。
- 在孤岛中按平台报告数字。跨平台模式比任何单一引擎的行为更重要。
- 忽略第三方引用表面。大多数提升来自 Reddit、Quora、行业博客、播客上的提及。单独追踪这些。
- 将 schema 推广视为引用 KPI。一项受控研究发现添加 JSON-LD 在任何平台上均无有意义的 AI 引用提升（`ahrefs-2026-studies.md`）。以经典 Search 中的 rich-result 资格度量 schema，而非以 AI 引用。
