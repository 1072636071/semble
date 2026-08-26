---
name: geo-super-geo-agent-readiness
description: Generative Engine Optimization 加 agent readiness。当用户问到 GEO、AEO、LLMO、为 AI 搜索引擎（ChatGPT、Perplexity、Google AI Overviews、Claude、Gemini、Copilot）优化内容、被 LLM 引用、AI 回答中的品牌提及、llms.txt、面向 AI 爬虫的 robots.txt、Schema.org JSON-LD、FAST 框架、agent readiness、MCP server 发现、Web Bot Auth、面向 agent 的 OAuth、API Catalog、agentic commerce（x402、ACP、UCP）、Markdown content negotiation，或审计一个站点/页面以提升 AI 可见性时，使用本技能。当用户说 "AI SEO"、问 "如何在 ChatGPT 中排名"、"如何出现在 Perplexity"、"如何出现在 AI Overviews"，或希望站点"能对 AI agent 说话"时，同样触发。即使请求是隐式的也要触发，例如"审阅这篇文章好让 AI 搜索收录它"或"让我们的文档对 agent 友好"。
---

# Super GEO Agent Readiness

Generative Engine Optimization（GEO）加 agent readiness。一个技能，四个优化面：内容、技术站点、平台策略、agent 层。

## What GEO is

Generative Engine Optimization 是提升一个品牌在 AI 驱动的回答引擎内部的可见性、引用率和推荐频率的实践。SEO 瞄准的是蓝色链接，GEO 瞄准的是回答本身以及 LLM 选择提及的实体。

边界在持续扩张。站点不再仅仅为人类读者和搜索爬虫而优化，也同时为那些代表用户去 fetch、读取、认证、交易、行动的 AI agent 而优化。本技能把两者视为一个连续的问题。

### GEO vs SEO vs AEO vs Agent Readiness

| 优化面          | 目标                                              | 被优化的对象                                                                         | 主要指标                                                |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| SEO             | Google, Bing                                      | 关键词、链接、技术 SEO                                                              | 排名、CTR                                               |
| AEO             | 语音助手、featured snippets                       | 问答格式、结构化数据                                                                | featured snippet 出现次数                               |
| GEO             | ChatGPT, Perplexity, Claude, AI Overviews, Gemini | 权威性、可引用性、事实准确性、实体清晰度                                            | AI 引用率、品牌提及                                     |
| Agent Readiness | 会 fetch 并行动的 AI agent                        | MCP server、OAuth 流程、机器可读 API、Markdown 内容、agentic payments               | 在 agentready.org / isitagentready.com 检查上的通过率   |

### Google 发布的指引：政策文件 vs 工程现实

Google 发布了自己的 [GEO 优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)。它说 AI Overviews 和 AI Mode 是 Google Search 的一部分，经典 SEO 才是策略，并称某些做法是"迷思"：

- llms.txt 文件或其他"特殊"的 AI 标记
- 内容分块（Content chunking）
- 为 AI 重写内容
- 专门为 AI 添加的结构化数据（在经典 Search 中对 rich results 仍然有用）
- 在网上追求非真实的提及

把这读作政策指引，而不是工程现实。Google 发布的文档有 20 年与其算法行为相背离的历史。几个具体信号削弱了这种"迷思"框架：

- Google 的 John Mueller 公开称 markdown 页面是"一个愚蠢的主意"。Google 的 Addy Osmani 公开推荐"Markdown 优于 HTML……创建 llms.txt 作为发现层"。两位 Googler，相反的建议，都公开实名发言。
- Google 的 Lighthouse 工具在评分 agentic browsing 能力时会检查 `llms.txt`，开发者文档也推荐它。
- Anthropic 自愿发布的 Claude system prompt 包含明确的仲裁规则：当下问题无论模型置信度如何都要求搜索，原始来源胜过聚合器，"像产品推荐这样被重度 SEO 化的话题"会被持怀疑态度对待。这些没有出现在 Google 的指南里，但存在于前沿模型的工程现实中。
- 现代检索架构（RAG、passage retrieval、source reranking，自 2020 年起在学术文献中有记录）在抽取出的 chunk 上运作，无论模型是否被告知"思考 chunk"。无法在章节层级被干净抽取的内容永远不会进入检索池。

操作结论与之前不变：按引擎校准。对于 Google AI Overviews 和 AI Mode，处于峰值质量水平的经典 SEO 是基础。对于 ChatGPT（占 AI referral 流量的 85%）、Perplexity、Claude 和训练语料，本技能中的额外优化面适用。修正后的框架更锋利：Google 的 AI 指南告诉你的是在监管面前可以辩护什么、以及 SEO 会议圈会复述什么；工程告诉你的是模型实际奖励什么。两种描述都准确；它们服务于不同目的。参见 `content-strategy.md` 中的三层仲裁模型，它解释了为什么工程现实与政策不同。

Google"迷思"清单中有一项已被受控证据确认，本技能也如实说明以保持诚实：专门为 AI 添加的 schema。一项针对 1,885 个页面的 difference-in-differences 研究发现，添加 JSON-LD 在任何平台上都没有产生有意义的 AI 引用提升（`ahrefs-2026-studies.md`）。在 schema 这一项上，Google 的框架成立，所以保留 schema 用于 rich results 和实体清晰度，而不是当作 AI 引用杠杆。llms.txt 和 chunking 这两项仍有争议，因为上面的工程信号（Lighthouse、检索架构、对立的 Googler）仍然与"迷思"标签相抵触。逐项校准，而不是把整份清单当成全对或全错。

Google 确实单独 endorse 了 agent-readiness 层，指向 [web.dev 的 agent-friendly 站点 UX 指南](https://web.dev/articles/ai-agent-site-ux) 和 Universal Commerce Protocol。

## When to use this skill

当用户想要以下任一情形时使用。

内容工作：写或重写一个页面让 AI 引擎引用它。优化一个定义、FAQ、对比或 thought-leadership 文章以提升可引用性。应用 E-E-A-T。诊断一个页面为什么对 AI 搜索不可见。

技术工作：实施 Schema.org JSON-LD。为 AI 爬虫配置 robots.txt。构建 llms.txt 或 llms-full.txt。应用 FAST 框架。审计 Core Web Vitals 或 SSR 覆盖率以提升 AI 爬虫可读性。

Agent 工作：让站点可被 agent 读取。设置 Markdown content negotiation。发布 MCP Server Card。暴露 API Catalog。接好 OAuth discovery。添加 Web Bot Auth。接受 agentic payments。

策略工作：优先排序快赢项、建路线图、选测量栈、为 AI referrals 设置 GA4 追踪、挑合适的监控工具、比较平台行为。

如果请求含糊，在加载参考文件之前先问一个聚焦问题。最有用的消歧问句是："你是在优化内容、技术站点，还是让站点能被 AI agent 使用？"

## How to use this skill

阅读路由表，然后只加载与请求匹配的参考文件。不要批量加载。每个参考文件都是自包含的。

| 参考文件                                 | 加载时机                                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/content-strategy.md`         | 写作、重写、审计内容；关于权威性、可引用性、E-E-A-T、可能获得引用的内容类型的问题                                                                                              |
| `references/structured-data.md`          | 实施 Schema.org JSON-LD；选择正确的 schema 类型；关于 Article、FAQ、Organization、Product、HowTo、Speakable、Person 的问题                                                     |
| `references/ai-crawlers-and-llmstxt.md`  | 为 AI 爬虫配置 robots.txt；构建 llms.txt / llms-full.txt；Content Signals；大型站点的 per-directory llms.txt 策略                                                              |
| `references/technical-implementation.md` | 页面速度、语义 HTML、SSR/SSG/ISR、URL 结构、FAST 框架、Core Web Vitals、图片 alt 文本、sitemap                                                                                  |
| `references/agent-readiness.md`          | MCP Server Card、Markdown content negotiation、/index.md fallback、Web Bot Auth、OAuth Authorization Server Metadata、API Catalog、x402、ACP、UCP、agent skills index             |
| `references/platforms.md`                | 针对 ChatGPT、Perplexity、Google AI Overviews、Google AI Mode、Claude、Gemini、Copilot 的平台策略；引用模式；AI referral 流量份额                                                                            |
| `references/measurement.md`              | GA4 设置、AI referral 追踪、KPI、监控工具、行业基准                                                                                                                            |
| `references/audit-checklist.md`          | 完整的 pre-publish、技术、post-publish 审计；AI 搜索就绪评分                                                                                                                    |
| `references/templates.md`                | 可直接粘贴的 robots.txt、llms.txt、JSON-LD、FAQ schema、MCP Server Card、OAuth metadata、x402 响应                                                                              |
| `references/ahrefs-2026-studies.md`      | 为任何经验性声明提供 grounding；schema、listicle、YouTube、ChatGPT 检索、AI Overview 行为背后的证据；按数据支持的程度校准投入                                                |

对于完整审计，先加载 `audit-checklist.md`。它在需要细节处链接到其他参考文件。

## Core principles (apply on every output)

四根内容支柱。Authority（权威性）、Quotability（可引用性）、Comprehensiveness（全面性）、Structure（结构性）。完整论述在 `content-strategy.md`。简短版本：引用真实来源、把答案放在前面、深入覆盖话题、使用语义结构。

四个 agent-readiness 维度（Cloudflare 的框架）。Discoverability（可发现性）、Content accessibility（内容可访问性）、Bot access control（bot 访问控制）、Capabilities（能力）。细节在 `agent-readiness.md`。简短版本：告诉 agent 去哪里看、给它们可解析的内容、声明 bot 能做什么、暴露它们可调用的工具和 API。

用于可爬取性的 FAST 框架。Fetchable（可抓取）、Accessible（可访问）、Structured（结构化）、Trim（精简）。一个未通过 FAST 的页面无论内容质量如何都不会被稳定引用。细节在 `technical-implementation.md`。

## Quick wins (recommend in this order)

当用户问"从哪里开始"时，按此顺序推荐。每一步都是高杠杆且低成本上线的。

第 1 步：评估。在禁用 JavaScript 的情况下加载用户的前 20 个页面。剩下的内容大约就是 AI 爬虫看到的样子。用 `measurement.md` 中至少一个工具基准化当前 AI 引用率。在 isitagentready.com 上给首页打分。

第 2 步：快赢。更新 robots.txt 以允许 GPTBot、OAI-SearchBot、ChatGPT-User、ClaudeBot、anthropic-ai、PerplexityBot、Google-Extended、Applebot-Extended 和 CCBot。在站点根目录发布 llms.txt。在 Bing Webmaster Tools 中注册，而不只是 Google Search Console：ChatGPT 最常引用的页面中有 28% 在 Google 上零可见度，所以 Bing 驱动的发现层本身就是一块独立的面（`ahrefs-2026-studies.md`）。给前五个内容页面加 FAQ schema，其余加 Article schema。让 Core Web Vitals 通过。

关于 schema 的一条校准说明，因为它是 GEO 中被过度推销的战术。一项针对 1,885 个添加了 JSON-LD 的页面的受控研究发现，AI 引用在任何平台上都没有有意义地提升（`ahrefs-2026-studies.md`）。schema 在经典 Search 的 rich results 和实体清晰度上才有其价值，而不是作为 AI 引用杠杆。一次性低成本上线它，然后把预算转到内容和站外权威上。不要安排一个多周的 schema 上线计划并期待引用增长。

第 3 步：更高杠杆的动作（证据所指方向）。最强的可见性相关因素在页面之外，而非页面之上。YouTube 提及与 AI 可见性的相关性超过任何传统 SEO 指标，站外品牌提及紧随其后（`ahrefs-2026-studies.md`）。建立视频存在感，并在第三方内容中赢得提及（播客、行业出版物、可信的对比清单）。在该品类下发布并维护一个真正有用的"best X"或对比页面，因为该格式是单一最常被引用的内容类型，并争取在可信的第三方清单上获得靠前的位置。全站页面数量与可见性几乎不相关，所以不要追求体量。

第 4 步：结构性。全站实施 Article、Organization 和（若是电商）Product 的 Schema.org 标记，用于 rich results 和实体图。为所有内容路径确保 SSR 或 SSG。对于大型文档站点，按顶层目录拆分 llms.txt 并添加 /index.md Markdown content negotiation。对于面向 agent 的产品，发布 MCP Server Card 和 OAuth discovery 文档。

## When acting as auditor

典型审计流程：

1. 与用户确认 URL 或内容范围。
2. 加载 `audit-checklist.md`。
3. 按顺序运行检查：内容、结构化数据、可爬取性、llms.txt、agent readiness、测量。
4. 产出一份报告，含三部分：通过的项、未通过的项（带严重度）、映射到相关参考文件的优先修复清单。
5. 对每个修复项，主动提出用 `templates.md` 生成实现（代码、JSON-LD 块、robots.txt、llms.txt 等）。

当用户给出单个 URL 并要求审计时，先 web_fetch 该 URL。检查渲染后的 HTML。检查响应头。查找 /robots.txt、/llms.txt、/sitemap.xml 和 `.well-known/` 路径。使用来自 fetch 的真实证据，而非假设。

## When acting as content writer or optimizer

工作流：

1. 识别目标查询或买家旅程阶段（认知、考虑、决策）。
2. 从 `content-strategy.md`（"最可能获得 AI 引用的内容类型"）中选择内容类型。
3. 在起草期间就应用四根支柱，而不是作为事后编辑的一道工序。
4. 在发布前添加 Schema.org JSON-LD（见 `structured-data.md`）。
5. 用 `audit-checklist.md` 中的发布清单做核对。

对于 B2B 服务企业（本技能目标用户最常见的情况），优先：原创研究、案例研究、署名作者的 thought leadership、对比内容、深度 how-to 指南。跳过浅薄的定义性内容，除非配上原创洞见。

## When acting as technical implementer

工作流：

1. 先用 FAST 框架诊断。如果页面未通过 Fetchable，在那修好之前其他都不重要。
2. 用 `templates.md` 取可直接粘贴的配置。
3. 用 Google Rich Results Test 验证 JSON-LD。用 llmstxt.org 上的规范验证 llms.txt。
4. 对于 SPA（React、Vue、Angular），强制讨论 SSR/SSG。客户端渲染的内容对 GPTBot、ClaudeBot 和 PerplexityBot 不可见。
5. 对于大型文档站点，遵循 `agent-readiness.md` 中 Cloudflare 的模式：per-directory llms.txt、/index.md content negotiation、隐藏的 agent 指令。

## Output conventions

这些适用于本技能产出的所有产物。

不使用 em dash。用逗号、冒号、括号或断句替代。该 dash 字符是 AI 生成文案的强信号，会被检测工具模式匹配。

移除 AI 写作的痕迹：夸大的象征意义、推销性语言（"revolutionize"、"unleash"、"unlock"）、浅薄的 -ing 分析、含糊的归因（"experts say"、"studies show" 而无链接）、rule of three 填充、负向排比（"not just X, but Y"）、过多的连接词（每段都出现"furthermore"、"additionally"、"moreover"）、谄媚式开头。

匹配用户的语言。默认英文。当用户用葡萄牙语写作或输出面向巴西受众时使用巴西葡萄牙语。

在产出代码、配置或 schema 时，以 `templates.md` 中的模板为真相来源。把名称和 URL 适配到用户的域名。不要凭空发明字段。

引用真实、当前的数据。行业统计变化很快。对任何早于 `measurement.md` 中数据的基准，在引用前先 web_search。

当用户分享 URL 时，fetch 它。不要推断其内容。

## Skill Contract

- **Expected output**: 审计报告（含通过/失败项和优先修复列表）、优化后的内容、技术配置（JSON-LD/robots.txt/llms.txt/MCP Server Card 等）
- **Reads**: 用户提供的 URL（web_fetch）、项目文件（.astro 组件、翻译文件、SEO 文档）、references/ 下的参考文件
- **Writes**: 审计报告输出到对话中；代码/配置文件直接修改项目文件；如用户要求保存报告则写入 `docs/SEO/03-执行记录/每日执行/YYYY-MM/`
- **Done when**: 用户请求的优化表面（内容/技术/平台/Agent层）已全部覆盖，输出结果或报告
- **Primary next skill**: `spz-seo-content-writing`（内容重写）、`spz-seo-technical-audit`（技术SEO深度审计）

## Dependencies

- **Project**: 山东长兴塑料助剂公司官网 Astro 项目（Astro 6.x SSG）
- **Reference files**: `references/` 目录下 10 个参考文档（按需加载，不全量读取）
- **External tools**: Google Rich Results Test（JSON-LD 验证）、llmstxt.org（llms.txt 规范验证）、isitagentready.com（Agent 就绪评分）
- **SEO docs**: `docs/SEO/01-参考资料/`、`docs/SEO/02-执行计划/`
- **GEO files**: `public/llms.txt`、`public/llms-full.txt`、`public/robots.txt`

## Error Handling

- **URL fetch fails**: 提示用户检查 URL 是否可访问，建议手动提供页面内容
- **Reference file missing**: 跳过该参考文档相关的检查，在报告中标注「参考文档 {filename} 不可用，相关检查已跳过」
- **JSON-LD validation fails**: 报告验证错误详情，建议使用 Google Rich Results Test 在线验证
- **Project file not found**: 提示用户确认项目路径和文件结构
- **Ambiguous request**: 在加载参考文件前先问一个聚焦问题，避免全量加载

## Logging

- 每个审计步骤输出进度信息（如「正在检查结构化数据…」「正在验证 llms.txt…」）
- 审计结果按通过/失败实时输出
- 最终报告包含各维度的检查计数

## Resource Cleanup

- 审计结果直接输出到对话中，不创建临时文件
- 生成的代码/配置直接修改项目文件，由用户决定是否保留
- 如果用户要求保存报告，写入 `docs/SEO/03-执行记录/每日执行/YYYY-MM/GEO审查-YYYY-MM-DD.md`

## Caveats and limits

GEO 不是产品、品牌或营销基本功的替代。一个弱产品无论优化质量如何都不会赢得 AI 引用。AI 引擎不成比例地偏好已有第三方存在感的品牌（earned media、Reddit、Quora、Wikipedia）。对于新兴品牌，在积累足够多的独立提及之前，预期会出现对冲式措辞（"might be worth considering"）。修复之道是持续的权威建设，而不是更多页面。

AI 引擎行为逐月变化。`platforms.md` 中针对平台的指引是时效性材料。在对某个具体引擎如何排名或引用作出重大断言之前，先用一次新的 web_search 确认当前行为。

本技能不承诺排名、引用、流量或收入。它捕捉的是当前已知最佳实践，需要用户去应用、上线、测量并迭代。
