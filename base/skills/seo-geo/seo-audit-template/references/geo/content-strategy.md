# Content Strategy

为在 ChatGPT、Perplexity、Google AI Overviews、Claude、Gemini 和 Copilot 中赢得 AI 引用和品牌提及的内容创作原则。

## The four content pillars

每一块为生成式引擎优化的内容都应通过全部四根支柱。把它们当作起草框架，而不是事后编辑的清单。

### 1. Authority

AI 引擎不成比例地引用来自具有既定信任信号来源的内容。把权威性构建进内容本身，而不只是周围的站点。

要做：
- 引用带链接的一手来源（同行评审研究、政府数据、官方文档、具名研究）。
- 包含原创研究、第一方数据或独特的数据集。LLM 重度偏好它们在别处找不到的证据。
- 写出作者全名及完整资历。通过 Person schema 中的 `sameAs` 把作者档案链接到 LinkedIn、Twitter/X、GitHub、学术档案。
- 提及具体的具名专家、研究和组织。
- 添加"last reviewed"日期并保持更新。Schema 的 `dateModified` 对引用概率有影响。

不要：
- 在没有链接的情况下作含糊断言（"many businesses report"、"studies show"）。
- 使用匿名作者或通用署名（"By the Team"）。
- 复述别人都在发布的定义。AI 引擎偏好来源，而不是摘要。

关于权威性真正来自何处的一条说明：跨 75,000 个品牌，与 AI 可见性最相关的因素在页面之外，而非页面之上。YouTube 提及的相关性（约 0.737）超过任何传统 SEO 指标，站外品牌提及紧随其后（`ahrefs-2026-studies.md`）。页面上的权威信号在一页面进入候选池后对赢得引用有用，但更大的杠杆是成为一个引擎已经从视频、播客和第三方报道中知道的品牌。内容工作与站外存在感是互补的，而站外那一侧通常是两者中更被忽视的。

示例：

差："AI search traffic is growing fast and many websites are seeing big gains."

好："Backlinko's 2025 analysis shows LLM-originated website traffic grew 800% year over year between Q2 2024 and Q2 2025. Across the 80 client sites we instrumented at Softo, the average lift in AI-referred sessions was 340% over the same window."

### 2. Quotability

AI 引擎抽取自包含的段落。写出在被抽出上下文后仍能作为独立答案发挥作用的段落。

要做：
- 每个章节以一到三句话的定义或核心答案开头。 elaboration 在后。
- 嵌入具体的数字、具名事实和具体例子。
- 为关键术语使用"definition boxes"。一段以"X is..."开头并以一个完整想法结束的短段落。
- 写得让从文章任何位置取出的 200 到 400 token 的 chunk 仍然说得通。

不要：
- 把定义埋在清嗓子之下（"In the world of digital marketing, there are many strategies..."）。
- 使用依赖前文的 coreference（"As mentioned earlier..."、"This approach..."）。
- 写超过 4 到 5 句的段落。AI chunker 偏好较短的段落。

示例：

差："When we think about what makes content actually work in this new world, it's worth stepping back and considering the role of AI search engines and how they've changed everything."

好："Generative Engine Optimization (GEO) is the practice of structuring content so AI answer engines cite it. Unlike SEO, which targets ranked links, GEO targets the answers themselves. ChatGPT, Perplexity, Claude, and Google AI Overviews each surface a small set of trusted sources per query, and the goal of GEO is to be one of them."

### 3. Comprehensiveness

AI 模型偏好完全覆盖一个话题的内容，包括后续问题和边界情况。

要做：
- 把话题覆盖到"没有明显的下一个问题"。如果读者合理地会问"but what about X?"，就回答 X。
- 在同一页面内同时预判初学者和高级读者的路径。
- 显式地处理常见误解。AI 引擎经常需要消歧；具名的误解有帮助。
- 即便在概念性话题上也包含 how-to 或 step-by-step 章节。
- 当话题涉及在选项之间做选择时加一张对比表。

不要：
- 在话题需要更多内容时把文章限制在一个人为的字数上限。
- 在高级页面上跳过枯燥的"what is it"基础。AI 引擎可能需要那点上下文用于 query matching。
- 为了凑长度而填充。短内容和长内容都能赢得 AI Overview 引用；长度本身不是选择因素（`ahrefs-2026-studies.md`）。Comprehensiveness 指的是覆盖话题，而不是凑字数。
- 把发布更多页面当作可见性策略。全站页面数量在 75,000 个品牌中与 AI 可见性几乎不相关。承担分量的是深度和站外权威，而不是体量。

### 4. Structure

结构良好的内容能被干净解析。AI 引擎依赖 HTML 语义和标题层级来识别可引用单元。

要做：
- 使用清晰的 H1 然后 H2 然后 H3 层级。除非页面确实需要，跳过 H4+。
- 标题应当是描述性的（"How GEO citations differ from SEO rankings"），而不是创意性的（"The Citation Question"）。
- 对并列项用列表，对对比用表格，对代码用代码块。
- 把核心答案或定义紧放在每个子标题之后。
- 实施 Schema.org 标记（见 `structured-data.md`）。

不要：
- 用 div-soup 样式替代语义标签。
- 写一堵没有内部结构的文字墙。
- 把答案藏在段落中段、躲在花哨的 lede 之后。

## The three-layer arbitration model (why the pillars work)

每个前沿模型通过三套重叠的系统评估内容。上面的四根支柱是实用战术；本节解释其下的机制。当写作者问支柱为什么重要，或诊断一篇高质量页面为何没赢得引用时，使用它。

1. **Latent knowledge.** 模型在训练期间学到的东西。背景世界知识、语义关系、推理模式。模型在看到你的内容之前对你的话题已有基线信念。印证模型先验信念的内容有顺风。反驳它们的内容需要不成比例地强的证据。
2. **Active retrieval.** 模型在回答时去 fetch 的东西。Web 搜索结果、knowledge graph、引用。grounding 层。你的内容在同一查询窗口内与其他被检索来源竞争，而不是孤立竞争。
3. **Arbitration.** 决定信任上述哪一层的那一层。Anthropic 公开的 Claude system prompt 包含明确的仲裁规则：当下问题无论模型置信度如何都要求搜索；原始来源胜过聚合器；"像产品推荐这样被重度搜索引擎优化的话题"被持怀疑态度对待。其他前沿模型存在类似机制，尽管多数未公开记录。

四根支柱映射到这些层：

| 支柱 | 主要服务的层 | 为什么重要 |
|---|---|---|
| Authority | Arbitration | 来源质量过滤器决定哪些被检索结果算数。一手来源标记（具名作者、资历、对同行评审工作的引用、第一方数据）把你抬到过滤器中的聚合器层之上。 |
| Quotability | Active retrieval | 可抽取的单元进入检索池。依赖周围上下文的章节在模型看到之前就被丢掉。 |
| Comprehensiveness | Latent knowledge | 把话题覆盖到模型期望的深度印证其先验信念。漏掉明显的后续问题信号浅薄覆盖。 |
| Structure | Active retrieval | 语义 HTML 和标题层级决定检索系统能干净抽取哪些单元。 |

操作含义并不显然：一篇写得漂亮且准确的内容，如果模式匹配到中端 SEO 输出，仍可能在仲裁层失败。下一节直接处理那个过滤器。

## Content types most likely to earn AI citations

某些内容类型在 AI 引用率上大幅胜过其他。来源：Semrush AI 引用研究；由 Backlinko、Animalz、Princeton GEO 论文（arxiv 2311.09735）和 Ahrefs 2026 研究集（`ahrefs-2026-studies.md`）印证。

最强的单点发现：跨 26,283 个来源 URL 和 750 个 top-of-funnel prompt，最近更新的"best X"对比清单是最常被引用的页面类型，占全部引用的 43.8%，并且该模式在每个主要助手上都成立。在清单内的位置与被推荐相关（前三分之一胜过底部），新鲜度也重要（79.1% 被引用的清单在 2025 年更新过）。这并不与下面的一手来源过滤器矛盾，而是把它磨锋利：对比格式作为一手来源执行时胜出，作为浅薄 affiliate 填充执行时失败。还要注意 35% 被引用的 best-list 位于低权威域名上，所以该格式部分奏效是因为 ChatGPT 依赖 Bing，而较弱站点在 Bing 上更容易排名。不要把这读作发布低质量清单的许可；把它读作证据：在你的品类下，一份可信、维护良好的清单是高杠杆的。

| 内容类型 | 为什么赢得引用 | 最佳实践 |
|---|---|---|
| 原创研究 | LLM 需要证据支持断言，而原创数据是独特可引用的 | 自跑研究。发布方法论。提供可下载原始数据 |
| 案例研究 | LLM 用案例研究支撑推荐 | 写出客户名。具体数字。Before/after 格式。引用真实人物 |
| Thought leadership | LLM 想要多元视角，而非共识复述 | 采取具体立场。公开不同意既有共识。用真实姓名和资历署名 |
| 新闻和时事 | LLM 不能依赖预训练数据应对时效性 | 快速报道进展。显著标注日期。链接到一手来源 |
| 品牌内容（关于自有产品） | LLM 信任你准确描述自己的产品 | 写专门的产品页，含清晰功能清单、定价（若公开）、对比表、FAQ |
| 深度指南 | LLM 偏好全面来源而非浅薄来源 | 2000+ 字。穷尽式覆盖话题。相关章节之间内部链接 |
| FAQ 页面 | 该格式直接映射到 LLM 回答问题的方式 | 用 FAQPage schema。每个 H3 一个问题。答案控制在 100 字以内 |
| 对比内容 | "Best X for Y" 查询重度由 LLM 中介 | 并排表格。公平对待替代品。若你售卖其中一项，披露你的偏向 |
| 术语表和定义 | "What is X" 查询浮现字典式内容 | 每页一个定义。50-200 字条目。交叉链接相关术语 |
| HowTo 指南 | Step-by-step 查询直接引用 HowTo 内容 | 用 HowTo schema。编号步骤。包含截图或图示 |

## Content types to avoid or de-emphasize

这些很少赢得引用，并稀释站点其余部分：

- 浅薄定义性内容（300 字以下）只是复述 Wikipedia 上已有的内容。
- 纯推销性、无信息价值的内容（"We are the best at X"）。
- 未刷新的过时内容。AI 引擎下调陈旧的 `dateModified`。
- 无来源的评论文章。
- 用填充物凑数的 listicle（"10 reasons we love AI"）。
- 未经人工编辑的 AI 生成内容。检测工具在改进；即便未被检出，输出也很少通过四根支柱。

## Look like a primary source, not like SEO content

Anthropic 公开的 Claude system prompt 明确指示模型对"像产品推荐这样被重度搜索引擎优化的话题，或任何其他可能排名高但不准确或误导的搜索结果"持怀疑态度。这是在模型按本身价值评估你的内容之前、在仲裁层施加的真实过滤器。模式匹配到中端 SEO 输出的内容无论实际多准确或多扎实都会被打折。

过滤器模式匹配所针对的可见标记：

- 公式化 listicle 标题："10 Best X for Y"、"Ultimate Guide to Z"、"Top N Tools in 2026"
- 复述 Wikipedia 的浅薄定义性内容
- 含"winner / runner-up / budget pick"章节的重 affiliate roundup 结构
- 无原创实质的"ultimate guide"或"complete guide"框架
- 无来源的权威断言："experts say"、"studies show"、"research has proven"
- 跨文章重复的通用 stock-photo 标题图和 CTA 块
- 像"By the Team"这样的作者署名或根本没有署名
- 总结文章而非增添洞见的结论段

修复不是放弃那些格式。清单、对比和 roundup 有合法用途。修复是即便使用那些格式也让内容读起来像一手来源：

- 具名作者，带链接的资历和作者档案上的头像照。
- 来自你自己测量的具体数字，而非通用行业估计。
- 来自你真正交谈过的具名专家的直接引语，而非对二手来源的转述。
- 你发布的数据集，而非对他人数据集的摘要。
- 一节方法论，解释你如何得出结论。
- 清楚标注并辩护的观点，而非对冲到安全之中的措辞。
- 在分析有局限处包含的注意事项和可证伪点。

一个有用的测试：一位记者引用本页时，会把它当作一手来源引用，还是当作"共识所说"的一个例子？若是后者，本页处于聚合器地带，会在仲裁层被过滤。

## The retrieval gate: title, snippet, URL

在引擎读你的页面之前，它先决定是否打开它。ChatGPT 每次查询检索数十个候选 URL 但只引用其中约一半（`ahrefs-2026-studies.md`）。每个候选以一个标题、一个 snippet、一个 URL 和一个 ID 返回，ChatGPT 用这些元数据选择哪些页面值得打开。被检索和被引用是不同的事件，由一道基于元数据而非完整内容的门隔开。

实际后果：

- 把 title tag 写得匹配可能的查询措辞并直白陈述主题。含糊或聪明的标题在门前会输。
- 写一段回答而非卖关子的 meta description。snippet 是决策的一部分。
- 使用干净、人类可读的 URL（`/guides/geo-content-strategy`，而非 `/p?id=8842`）。不透明的 URL 在门前承载更少信号。
- 第一屏仍须交付，因为过了门的页面随后按内容被评判。但一个强页面配上弱标题和 snippet 可能永远不会被打开。

这位于四根支柱的上游。支柱在页面打开后赢得引用；门决定页面是否被打开。

## Chunkability rules

抽取逐字段落的 LLM（Perplexity、ChatGPT、Claude）按 chunk 读内容。为 chunk 独立性优化以最大化在这些引擎上的引用概率。

Google 的立场：对 AI Overviews 或 AI Mode 而言 chunking 不是必需的。其系统理解全页上下文。下面的建议是给 AI 生态其余部分的，此外它也改善所有人的可读性。

- 一段或一节被抽出上下文后仍应说得通。
- 避免跨标题回指的代词（"this approach" 引用三个章节之上的定义）。
- 在每个相关章节中重复关键实体名（"Generative Engine Optimization" 而非"it"）。
- 避免前向引用（"as we will see below"）。包含"below"的 chunk 可能不是模型检索到的那个 chunk。

净建议：无论如何都为 chunk 独立性而写。成本近乎为零，收益覆盖大多数非 Google 引擎，可读性提升是真实的。

## Entity clarity

AI 引擎内部构建实体图。帮它们把你的品牌、产品和人对到正确的节点。

- 在所有地方为你的公司使用同一规范名（不要交替使用"Acme"、"Acme Inc."、"Acme Corporation"等变体）。
- 在首页添加 Organization schema，用 `sameAs` 链接到 Wikipedia、Crunchbase、LinkedIn Company、X/Twitter、GitHub Organization。
- 对人（作者、创始人、专家），添加 Person schema，用 `sameAs` 链到他们的 LinkedIn、学术档案、官方网站。
- 对产品，在所有面上使用 Product schema 并保持 name、brand 和 SKU 一致。
- 在上下文相关时按名提及竞争对手和相关实体。这帮助引擎把你的品牌放进正确的簇。

## E-E-A-T applied to GEO

Google 的 E-E-A-T 框架（Experience、Expertise、Authoritativeness、Trustworthiness）是对 AI 引擎奖励什么的最接近的正式表述。

| 元素 | 它信号什么 | 如何在内容中展现 |
|---|---|---|
| Experience | 对你所描述之物的第一手使用 | "We deployed this in production for 18 months"、来自真实工作的截图、现场拍摄的照片、具名客户 |
| Expertise | 主题资历 | 带资历的作者档案、"Reviewed by [credentialed person]"行、对你自己研究的引用、专业隶属 |
| Authoritativeness | 来自同行的认可 | 媒体报道、speaker bio、他人对你工作的引用、Wikipedia 条目、行业奖项、具名合作 |
| Trustworthiness | 透明、准确、安全、可问责 | HTTPS、清晰联系信息、标注日期的内容、可见追加的更正、隐私政策、作者照片、真实姓名 |

对 YMYL 话题（Your Money or Your Life：健康、金融、法律、安全），E-E-A-T 被执行得更严。在 Article schema 中添加 `reviewedBy`，链接到审阅者档案，并包含可验证的资历。

## Pre-publish content checklist

发布前核对：

- [ ] 该页面提供至少一条不在前三位 SERP 结果上的信息。
- [ ] 可验证的事实有一手来源链接。
- [ ] 标题遵循 H1 然后 H2 然后 H3 层级，标签描述性强。
- [ ] 每个 H2 下的第一段能独立作为答案成立。
- [ ] 至少包含一项：原创数据、案例研究、具名专家引语。
- [ ] 作者具名，带链接档案和资历。
- [ ] `datePublished` 和 `dateModified` 在可见内容和 schema 中都准确。
- [ ] 所有依赖易变数据且超过 12 个月的断言都已核实。
- [ ] Schema.org JSON-LD 存在（至少 Article，若适用加 FAQ）。
- [ ] 抽取任意 300 字 chunk 时页面读起来连贯。
- [ ] 无 em dash。无推销性语言。无"rule of three"填充。
- [ ] 指向同站相关页面的内部链接，锚文本描述性强。
