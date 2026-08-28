# Ahrefs 2026 研究：实证证据基础

一份整合记录，涵盖 2025 年 10 月至 2026 年 5 月间发表的 14 项 Ahrefs 研究，跨 ChatGPT、Google AI Overviews 与 Google AI Mode 共约 10 亿个数据点。当另一份参考文件中的某个论断需要 grounding、当写作者追问"这个论断的证据在哪"、或需要根据数据实际支持的力度校准投入时，使用本文件。

这些是来自单一供应商（Ahrefs Brand Radar）的大样本观察性研究。多数采用相关性而非受控因果方法，schema 研究是例外。将这些数字视为方向性指标，且截至 2026 年年中有效。在任何面向客户的工作中引用具体数字前，请用新鲜来源重新核实，因为平台行为逐月变化。

## 一句话版本：发生了什么变化

三项发现重新排序了打法。第一，schema markup 不会推动 AI 引用，因此停止将其作为引用杠杆来销售。第二，YouTube 出现与站外品牌提及与 AI 可见度的相关性远强于页面内或技术信号，因此最高杠杆的工作在站点之外。第三，"best X"对比列表是被引用最多的单一内容格式，因此赢得并出现在这些列表上比任何 markup 决策都更重要。

## 内容格式与选择

### "Best X" 列表主导引用（26,283 个来源 URL，750 个 prompts）

跨软件、产品和代理商 prompts，近期更新过的"best X"博客列表是 ChatGPT 引用最突出的单一页面类型，占所有页面类型的 43.8%。同一模式在其他主要助手中同样成立，在 Google AI Overviews 中略为更明显。每个平台上被引用最多的 1,000 个页面，跨 150M+ prompts，全部包含对比 listicles。

列表内的位置很重要。位于列表上三分之一的品牌比靠下的品牌更常被推荐，该趋势在控制列表长度后依然成立。在自己列表中将自己排第一的品牌仍会被引用。

新鲜度很重要。79.1% 的被引用列表在 2025 年更新过，26% 在此前两个月内更新过。被引用列表中首次发布后更新过的（57.1%）多于发布一次后搁置的。

宿主质量参差不齐。约 35% 的被引用 best-lists 位于低权威域名上，其中许多看起来纯粹为链接或引用农场而建。这之所以可能，是因为 ChatGPT 依赖 Bing，可疑站点在 Bing 中比在 Google 中更容易排名。

操作含义：在你的品类中发布并维护一个真正有用的对比或"best"页面，按节奏刷新，并争取（高位）出现在可信第三方列表上。将该格式作为主要来源执行，而非薄薄的 affiliate 填充。参见 `content-strategy.md`。

### 内容长度不决定引用（数千个页面）

短内容与长内容都能获得 AI Overview 引用。长度本身不是选择因子。这印证了长期以来的告诫：字数是全面性的代理指标，而非杠杆。以能完整覆盖主题所需的任意长度来覆盖该主题。

### 内容量与可见度几乎不相关（75K 个品牌）

站点上的页面数与 AI 可见度几乎无关（Spearman ~0.194）。发布更多页面不是通向引用的路径。深度与站外权威才是。

## ChatGPT 检索机制

### ChatGPT 引用约一半它检索到的内容（1.4M prompts，GPT-5.2）

ChatGPT 每次查询获取数十个候选 URL，但仅引用其中约 50%（样本中 49.98% 被引用）。在读取任何页面内容之前会运行一层把关：每个检索结果返回一个标题、一个 snippet、一个 URL 和一个 ID，ChatGPT 用该元数据决定哪些页面值得打开。被检索与被引用是不同的事件。

操作含义：标题、snippet 和干净的人类可读 URL 在内容质量被评估之前的把关阶段就起实际作用。撰写与可能的查询措辞相匹配、并直白陈述答案的标题和 meta 描述。参见 `content-strategy.md`。

### ChatGPT 的顶级引用中有三分之二是不可触碰的（被引用最多的 1,000 个页面）

ChatGPT 被引用最多的 1,000 个页面按类型拆分：Wikipedia 29.7%、首页和 landing pages 23.8%、教育页面 19.4%、应用商店 6.6%、评测 5.8%、新闻与媒体 5.2%、语言与语法站点 4.0%、词典与参考 2.2%、博客与文章 1.9%、Q&A 与社区 0.9%、企业页面 0.5%。

这些引用中仅 32.3% 处于营销者可影响的格式中（教育、评测、新闻、博客）。其余是"死"引用：Wikipedia、首页和应用商店列表，你难以通过 pitch 投放自己进去。杠杆集中在那可影响的三分之一，加上你通过权威而非内容缓慢建设的站外存在（Wikipedia 条目、应用商店列表）。

### 存在独立的发现层（被引用最多的 1,000 个页面）

ChatGPT 被引用最多的页面中有 28%（线程摘要中为 28.3%）在 Google 自然可见度上为零。它们在 Google 中毫无排名却被反复引用。ChatGPT 对 Bing 的依赖加上其自身检索，创造了一个经典 Google SEO 无法触及的发现层。在 Bing Webmaster Tools 中注册并优化，而不仅在 Google Search Console 中。

## Google AI Overviews 与 AI Mode

### AI Overviews 与 AI Mode 是两个系统，而非一个（730K 响应对）

AI Mode 响应比 AI Overviews 长约 4 倍。两者在 86% 的情况下（语义相似度）得出相同结论，但引用几乎完全不同的来源，引用重叠仅 13.7%。它们是不同的检索管线，通过不同路径汇聚到相似答案。在其中一个被引用并不意味在另一个也被引用。

操作含义：将 AI Overviews 与 AI Mode 作为独立表面追踪。在一个上的胜利不等于在两者上的胜利。

### AI Overviews 不断变化但几乎不改主意（43K 关键词）

一个 AI Overview 的文本在连续观测间有约 70% 的概率不同，平均约每 2.15 天变化一次。然而跨版本的语义相似度保持在 0.95 左右。措辞、来源和具名实体不断洗牌，而底层答案保持稳定。

操作含义：不要对逐日引用波动恐慌，也不要追逐单次快照的胜利。以周为单位度量存在，而非单次观测。一次出现不是持久的可见度。

### 引用正与排名脱钩（863K SERPs）

AI Overview 引用中仅 38% 来自 Google 前 10 名页面，较一年前的 76% 下降。AI Overviews 越来越多地从第一页之外拉取。经典排名仍有帮助，但它是引用的减弱保证。

### AI Overviews 几乎只出现在信息型查询上（146M SERPs，86 个因子）

99.9% 的 AI Overviews 出现在信息意图查询上。交易型、导航型和本地搜索几乎完全没有它们。购物查询仅在 3.2% 的情况下触发 AI Overview。

操作含义：为 AI Overview 可见度，优先信息型、漏斗顶部内容。交易型和本地页面不是 AIO 的战场，尽管它们对 ChatGPT 和经典 Search 仍然相关。

### AI Overviews 持续吞噬点击（点击率研究）

AI Overviews 将对排名第一的自然结果的点击降低 58%，较约十个月前的 34.5% 上升。随着 AIO 扩展到更多国家和语言，压制正在加剧。即使排名保持，也要为信息型查询上自然点击率下降做规划。

## 品牌信号与权威

### YouTube 是最强的可见度相关因子（75K 个品牌，Spearman）

YouTube 提及与 AI 可见度的相关性在所研究的任何因子中最强（~0.737），击败所有传统 SEO 指标甚至品牌化网络提及。YouTube 提及 impressions 紧随其后（~0.717）。品牌化网络提及相关系数在 0.66 到 0.71 之间。

ChatGPT 与经典权威指标弱相关：品牌化搜索量 0.352、Domain Rating 0.266。AI Mode 更依赖品牌化权威信号，品牌化锚文本 0.628、品牌化搜索量 0.466。三个助手大致呈现相同品牌（输出重叠 0.779）。

相关性不是因果，研究明确如此声明。改进这些指标不会机械地提升可见度。但因子排序是对投入方向的强力引导：视频和赢得的品牌提及优先于反向链接计数和页面量。

操作含义：YouTube 存在（你自己的频道加上其他频道上的提及）和稳定的站外品牌提及流，比大多数页面内战术的杠杆更高。对 B2B 服务公司而言，这意味着创始人和团队视频、播客露面，以及在第三方内容中被点名。

## Schema markup

### 添加 schema 未推动 AI 引用（1,885 个处理页面，4,000 个对照）

这是本组中唯一的因果研究，采用匹配差异中的差异设计。在 2025 年 8 月至 2026 年 3 月间添加 JSON-LD schema 的页面，在任何平台上都未见有意义的引用提升：AI Overviews -4.6%（小但统计显著，处理组和对照组页面都已在下降），AI Mode +2.4%，ChatGPT +2.2%（两者都与零无法区分）。

对 600 万 URL 的朴素观察曾显示被引用页面携带 schema 的可能性是非被引用页面的近 3 倍。受控研究表明该差距是选择而非原因：schema 存在于维护更好、已发布更强内容并赚取更多链接的站点上。schema 乘浪而行，并不制造浪。

操作含义：为 schema 实际做的事保留它，即经典 Search 中的 rich results 和实体清晰度。停止将其呈现为 AI 引用杠杆，停止将 schema 推广优先于内容和站外权威工作，且不要承诺 markup 带来引用提升。参见 `structured-data.md`。

## 市场规模与点击经济

### ChatGPT 查询量大、引荐流量小（搜索量研究）

ChatGPT 已达到约 Google 搜索量的 12%，并已超过 Bing。但 Google 仍向网站发送约 190 倍于 ChatGPT 的流量。AI 搜索是真实且增长的发现表面，但它尚未成为大多数站点的主要流量来源。

### 点击仍集中在前 10 名（点击分布研究）

96.98% 的 Google 点击发生在前 10 名结果中。对仍从经典搜索流动的流量而言，第一页排名仍是决定性的。

操作含义：GEO 是 SEO 的加法，而非替代。点击经济仍通过第一页排名运行，而 AI 答案引擎是一个新兴的可见度层，其价值单位是引用而非点击。两者都度量。

### AI Overview 普及率因国家而异（108M 查询）

AI Overview 在 Google 结果中的存在跨国家差异显著。对非美国市场，包括巴西，在假设美国级普及率之前，先核实目标地区的当前 AIO 渗透率。葡萄牙语结果中的覆盖和行为可能滞后或不同于英语。

## 来源列表

1. AI Overviews vs AI Mode comparison: https://ahrefs.com/blog/ai-overviews-vs-ai-mode/
2. AI brand visibility correlations: https://ahrefs.com/blog/ai-brand-visibility-correlations/
3. Best-lists research: https://ahrefs.com/blog/best-lists-research/
4. AI Overview change frequency: https://ahrefs.com/blog/ai-overview-change/
5. AI Overview triggers: https://ahrefs.com/blog/ai-overview-triggers/
6. ChatGPT's most-cited pages: https://ahrefs.com/blog/chatgpts-most-cited-pages/
7. Schema and AI citations: https://ahrefs.com/blog/schema-ai-citations/
8. Why ChatGPT cites pages: https://ahrefs.com/blog/why-chatgpt-cites-pages/
9. AI Overview citations from top 10: https://ahrefs.com/blog/ai-overview-citations-top-10/
10. ChatGPT vs Google search volume: https://ahrefs.com/blog/chatgpt-has-12-percent-of-googles-search-volume/
11. AI Overviews reduce clicks update: https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/
12. Short vs long content in AI Overviews: https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews/
13. AI Overviews international: https://ahrefs.com/blog/ai-overviews-international/
14. Almost all clicks in the top 10: https://ahrefs.com/blog/almost-all-clicks-happen-in-the-top-10-results/
