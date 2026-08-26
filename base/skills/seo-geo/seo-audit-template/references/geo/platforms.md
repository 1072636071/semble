# 平台专属战术

主要 AI 搜索引擎如何选择和引用来源。平台行为逐月变化。将此视为起点，并在做出强论断前用新鲜 web_search 核实。

截至 2025 年 7 月数据的行业流量份额（Semrush）：

| 平台 | 月访问量 | 占 AI 引荐流量份额 |
|---|---|---|
| ChatGPT | 5.24 B | 85.79% |
| Gemini | 287.5 M | 4.70% |
| Perplexity | 173.6 M | 2.84% |
| Grok | 153.0 M | 2.50% |
| Claude | 136.6 M | 2.23% |
| Copilot | 97.8 M | 1.60% |
| Meta AI | 16.6 M | 0.27% |

ChatGPT 以一个数量级主导。若必须选一个，先优化 ChatGPT。一旦基础（Schema、llms.txt、robots.txt、内容质量）到位，其他引擎基本免费获得。

保持对规模的视角。ChatGPT 已达约 Google 搜索量的 12% 并已超过 Bing，但 Google 仍向网站发送约 190 倍于 ChatGPT 的流量（`ahrefs-2026-studies.md`）。且 96.98% 的 Google 点击仍落入前 10 名结果。GEO 是 SEO 的加法，而非替代：AI 答案引擎是一个快速增长的可见度层，其价值单位是引用，而点击经济仍通过第一页 Google 排名运行。两者都度量，且不要让 AI 搜索炒作把所有预算从经典搜索上拉走。

## ChatGPT (OpenAI)

### 如何获取内容

ChatGPT search 使用 Bing 作为主索引，叠加 OpenAI 自身检索。在 Bing 中排名良好的页面有更高被引用几率。

关键特征：ChatGPT 大量从 Bing 结果拉取，包括在 Google 前 10 名之外排名的页面。约 90% 的 ChatGPT 引用来自在 Google 中排名 21+ 的 URL。在 Google 中挣扎的页面仍可赢得 ChatGPT 引用。

存在独立的发现层。ChatGPT 被引用最多的页面中 28% 在 Google 自然可见度为零（`ahrefs-2026-studies.md`）。它们在 Google 中毫无排名却被反复引用。含义具体：在 Bing Webmaster Tools 中注册，而不仅在 Google Search Console，因为 Bing 喂养的层是它自己的表面。

ChatGPT 实际引用的，按类型（被引用最多的 1,000 个页面）：Wikipedia 29.7%、首页和 landing pages 23.8%、教育页面 19.4%、应用商店 6.6%、评测 5.8%、新闻与媒体 5.2%、语言与语法站点 4.0%、词典与参考 2.2%、博客与文章 1.9%、Q&A 与社区 0.9%、企业页面 0.5%。这些引用中仅约 32.3% 处于你可 pitch 投放进去的格式（教育、评测、新闻、博客）。其余三分之二是"死"引用：Wikipedia、首页、应用商店列表，你通过权威而非内容 pitch 缓慢影响。将内容努力集中在可影响的三分之一，并单独耐心地建设站外存在（Wikipedia 条目、应用商店列表）。

检索把关。ChatGPT 每次查询检索数十个 URL 但仅引用约 50%。在打开任何页面之前，对标题、snippet 和 URL 运行一道关卡（`ahrefs-2026-studies.md`）。与查询措辞匹配的标题、给出答案而非吊胃口的 snippet，以及干净的人类可读 URL 都在该关卡胜出。参见 `content-strategy.md`。

50% 的 ChatGPT 引用链接指向业务或服务网站，对比百科式来源。与 Perplexity 相反的模式。

### 如何优化

- 在 Bing Webmaster Tools 中注册站点。提交 sitemap。验证索引。
- 构建 Bing 偏好的域名权威信号：来自 .edu、.gov、新闻站点、行业出版物的反向链接。
- 赢得对比和 listicle 查询。ChatGPT 大量引用"best X for Y"文章。
- 在 robots.txt 中允许 `OAI-SearchBot`、`ChatGPT-User` 和 `GPTBot`。
- 当购物集成开放时向 OpenAI 提交产品 feed（当前处于"register interest"模式）。
- 对 SaaS 或 e-commerce，用结构化数据优化对比和定价页面。

### 常见模式

- ChatGPT 常引用品牌自有和第三方内容的混合。第三方内容是大多数提升的来源。在 Reddit、行业博客、对比站点、播客上建立提及。
- 非品牌化查询中的品牌提及常见（26-39% 的非品牌化查询包含至少一个品牌提及）。这些提及的情感很重要。

## Perplexity AI

### 如何获取内容

与 Google 前 10 名强对齐。约 91% 域名重叠和 82% URL 重叠于 Google 第一页。若你在 Google 排名，你有高被 Perplexity 引用概率。

Perplexity 比其他引擎对来源更透明；引用列表与生成的答案并排显眼展示。

### 如何优化

- 在 Google 排名良好。单一最大杠杆。
- 强 schema markup 增加引用可能性（Perplexity 是重度 schema 消费者）。
- 在 robots.txt 中允许 `PerplexityBot` 和 `Perplexity-User`。
- 撰写直接回答问题的内容。Perplexity 常逐字引用来源段落。
- 带清晰段落的全面内容。Perplexity 倾向每个答案引用多个来源；成为若干之一比成为唯一更容易。

### 常见模式

- Perplexity 偏好具有强主题权威的内容（同一域名上的大量相关页面）。
- 多来源引用是常态。目标是进入一个查询的前 5 个来源，而不仅是前 1。

## Google AI Overviews

### 如何获取内容

出现在 Google Search 内传统结果之上的 AI 生成摘要。约 15% 的所有关键词搜索现在触发 AI Overview。

意图是最强触发器。99.9% 的 AI Overviews 出现在信息意图查询上（`ahrefs-2026-studies.md`）。交易型、导航型和本地搜索几乎无 AIO，购物查询仅在 3.2% 的情况下触发。对 AIO 可见度，战场是信息型、漏斗顶部内容，而非产品或定价页面。

与 Google 前 10 名 86% 域名重叠。但引用正与排名脱钩：AI Overview 引用中仅 38% 现来自前 10 名页面，较一年前的 76% 下降。Overview 从 Google 索引加检索生成，检索日益越过第一页，因此强排名仍有帮助但是减弱的保证。

稳定含义下的波动。一个 AI Overview 的文本在连续观测间有约 70% 概率不同，约每 2.15 天变化，但跨版本语义相似度保持约 0.95。来源和实体不断洗牌而答案保持。不要追逐单次快照引用或对逐日波动恐慌；以周为单位度量存在。

点击压制正在加剧。AI Overviews 将对排名第一的自然结果的点击降低 58%，较约十个月前的 34.5% 上升。即使排名保持也要预期信息型查询上自然点击率下降，并将 AIO 可见度权重转向引用和品牌存在而非点击量。

Google 官方立场：AI Overviews 是 Google Search 的一部分，非独立引擎。优化即 SEO。参见 [Google AI 优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。Google 明确将 llms.txt、内容分块、AI 专属重写和 AI 专属结构化数据称为其 AI 功能的"神话"。

AI Overviews 中最常被引用的域名：Quora #1、Reddit #2，YouTube 和 Facebook 出现在 68% 或更多的 Overview 增强结果中。

### 如何优化

- 峰值质量下的经典 SEO。AI Overviews 与排名紧密耦合。
- 通过 Google 的"Search Essentials"：已索引、snippet 资格、无 spam 策略违规。
- 强 E-E-A-T。Google 明确将 E-E-A-T 应用于 AI Overview 资格。
- 有用、非商品化、以人为本的内容。第一手经验和原创观点胜过重述的常识。
- FAQ schema 高杠杆。AI Overviews 常直接从 FAQ 结构化数据引用。
- 减少重复内容。强 canonical URL。
- 在 robots.txt 中允许 `Google-Extended`（控制纳入 Gemini 训练和 grounding，与 Googlebot 不同）。
- 在 Google Search Console 中验证站点。通过标准 Performance 报告监控 AI Overview impressions 和 clicks。
- 对产品，通过 Google Merchant Center 提交 feed。
- 对本地商家，认领并维护 Google Business Profile。考虑 Business Agent 以在 Search 中获得对话式品牌存在。
- 出现在排名良好的第三方内容中（Quora、Reddit 答案、Wikipedia 提及、行业出版物）。

### Google 说你应忽略什么

其指南直接引用：你不需要 llms.txt、内容分块、AI 专属重写、AI 专属结构化数据，或追求非真实提及。为其他引擎（ChatGPT、Perplexity、Claude）实施这些，并预期从 Google 获得零直接收益。

### 常见模式

- AI Overviews 先摘要再链接。同时优化引用（你的 snippet 被引用）和点击率（你在引用列表中的链接）很重要。
- 在 AI Overviews 中被引用的页面看到原始 snippet 上点击率下降但引用可见度上升。净效应取决于意图。

## Google AI Mode

### 如何获取内容

Google 内的专用 AI 搜索体验（不同于 AI Overviews）。使用比经典 Search 更独立的检索管线。

与 Google 前 10 名 54% 域名重叠和 35% URL 重叠。约 7 个不排在前 10 名的独特域名出现在侧栏。

AI Mode 和 AI Overviews 是两个系统，而非一个的短长版本。AI Mode 响应比 AI Overviews 长约 4 倍，两者在 86% 的情况下得出相同结论但仅共享 13.7% 引用（`ahrefs-2026-studies.md`）。在其中一个被引用不意味在另一个也被引用。将它们作为独立表面追踪，且不要假设 AIO 胜利延续到 AI Mode。AI Mode 也比 ChatGPT 更依赖品牌化权威信号（品牌化锚文本、品牌化搜索量）。

Google 官方指南：AI Mode 仍是 Google Search。同样的"神话"列表适用。无需特殊 AI markup。检索比 AI Overviews 更激进但优化表面相同。

### 如何优化

- 与 AI Overviews 相同的基础：峰值质量下的经典 SEO、E-E-A-T、有用且原创的内容、全面覆盖。
- Search Console 验证和监控。
- 强第三方引用画像（Reddit、YouTube、行业论坛）有帮助，因为 AI Mode 更深入长尾。
- Schema.org 用于经典 Search 中的 rich results。按 Google 所说，AI Mode 本身不需要，但结构化数据倾向与 AI Mode 奖励的相同内容质量信号相关。

度量时将 AI Mode 与 AI Overviews 分开。在 Search Console 报告中随其出现单独追踪。

## Claude (Anthropic)

### 如何获取内容

Claude 内建网络搜索。使用对外部来源的实时抓取。引用透明度高。

模式类似 Perplexity。在 Google 或 Bing 排名的页面更可能被选择。Schema 和 llms.txt 帮助检索。

### 如何优化

- 在 robots.txt 中允许 `ClaudeBot`、`anthropic-ai`、`Claude-Web`。
- Markdown 内容协商（`Accept: text/markdown`）。Claude Code 已请求此；消费级 Claude 产品预期跟进。
- 根目录的 llms.txt。
- 高质量、结构良好的内容（Claude 被训练偏好清晰和准确）。

### 常见模式

- Claude 比其他引擎更谨慎地引用低权威来源。强权威信号很重要。
- Anthropic 尚未提供 Webmaster Tools 等价物。标准 SEO 和 GEO 基础是主要杠杆。

## Gemini (Google)

### 如何获取内容

Gemini 与 Google Search 集成。当启用 web grounding 时行为与 AI Overviews 显著重叠。与 Google AI Overviews 相同的官方指南适用：峰值质量下的经典 SEO，无特殊 AI markup。

### 如何优化

- 与 Google AI Overviews 相同。经典 SEO、E-E-A-T、有用内容。
- FAQ markup 用于 rich results（附带帮助）。
- 在 robots.txt 中允许 `Google-Extended`。这是 Gemini 训练和 grounding 的相关控制（Googlebot 仍独立）。
- Search Console 验证。

## Copilot (Microsoft)

### 如何获取内容

Bing 驱动。模式镜像 ChatGPT，因为两者都依赖 Bing 索引。

### 如何优化

- Bing Webmaster Tools 注册。Sitemap。验证。
- 向 Microsoft Merchant Center 提交产品 feed 用于产品结果。
- 与 ChatGPT 相同的内容原则。

## Grok (xAI)

### 如何获取内容

DeepSearch 结合实时网络抓取与 X（Twitter）内容。大量使用社交信号。

### 如何优化

- 活跃的 X 存在，在你的主题上有权威声音。
- X 对话中的品牌提及。
- 标准 GEO 基础。

关于 Grok 检索架构的公开信息有限。标准 schema 和 llms.txt 有帮助。

## 通用模式（跨所有平台适用）

无论平台如何这些都成立：

- 全面内容胜过薄内容。AI 引擎跨来源综合；薄内容被跳过。
- 原创研究是跨所有引擎最高杠杆的引用磁铁。
- 第三方内容中的品牌提及（Reddit、Quora、新闻、对比站点、播客）独立于你自己的页面驱动引用。
- E-E-A-T 信号（具名作者、资质、日期、透明来源）是通用信任机制。
- 对比内容赢得不成比例的引用。
- "Best X" 对比列表是跨助手的单一最被引用内容格式（一项大型研究中占被引用页面类型 43.8%），在可信第三方列表上的高位放置与被推荐相关（`ahrefs-2026-studies.md`）。
- YouTube 存在是已度量的最强 AI 可见度相关因子，领先于所有传统 SEO 指标。视频足迹（自有频道加其他上的提及）加站外品牌提及比页面内战术更能推动可见度。
- LLM 常从同一可信域名引用不同页面。域名重叠高，URL 重叠低。在域名层面而非页面层面优化。
- 商业和交易型查询触发的响应约比信息型的长两倍。更多引用槽可用。

## 何时使用哪个平台的优势

若用户带宽有限，按以下分配投入：

- **B2C 消费内容**：先 ChatGPT（85% 流量），再 Gemini 和 AI Overviews。
- **B2B 研究与对比**：Perplexity 和 ChatGPT。Reddit 和行业对比站点用于引用表面。
- **技术 / 开发者内容**：Claude（Anthropic 的受众）、Perplexity、Stack Overflow 作为引用磁铁。
- **E-commerce / 产品**：Google AI Overviews 和 ChatGPT 购物（当它开放时）。产品 feed 到 Google 和 Microsoft。
- **新闻 / 时事**：所有平台引用新鲜内容。发布速度和频率最重要。

## 什么不会改变平台行为

对任何承诺按平台特定提升的优化建议保持怀疑。平台检索算法不透明且频繁变化。一些反复出现的神话：

- "品牌提及在平台 Y 上获取成本为 X。"获取成本因行业、地域、内容类型和权威而异。
- "Reddit 帖子总在 Google AI Overviews 中被引用。"Reddit 常出现，但页面级选择不可预测。
- "长内容总胜过短内容。"长度是全面性的代理。一个完整回答的 500 字页面可击败一个填充的 3000 字页面。

将平台专属指南视为方向性的。按平台度量引用率（参见 `measurement.md`）并根据你数据所示迭代。
