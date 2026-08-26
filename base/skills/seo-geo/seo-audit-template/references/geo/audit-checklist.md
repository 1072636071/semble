# Audit Checklist

针对任何以 AI 搜索可见性和 agent readiness 为目标的页面或站点的完整 pre-publish、技术、post-publish 审计。当用户要求 GEO 审计时作为工作流使用。

## How to run an audit

1. 确认范围。单页？整站？特定章节？
2. 若用户提供 URL，web_fetch 它。检查渲染后的 HTML。检查响应头。查找 `/robots.txt`、`/llms.txt`、`/sitemap.xml`、`/.well-known/` 路径。
3. 按顺序运行清单各节：内容、结构化数据、技术、AI 可爬取性、agent readiness、测量就绪。
4. 产出一份报告，含三部分：通过的项、带严重度的未通过项、映射到参考文件的优先修复清单。
5. 主动提出用 `templates.md` 生成修复（代码、JSON-LD、robots.txt）。

严重度级别：
- **Blocker**：AI 爬虫无法触达内容。其他都不重要。
- **High**：缺失阻止引用的主要信号。本季度内修复。
- **Medium**：优化机会。改善引用率。
- **Low**：打磨。值得做但不紧急。

## Calibration: Google's "myths" list

在把项标为失败之前，记住 Google 明确说这些对 AI Overviews 或 AI Mode 而言不是必需的。它们对非 Google 引擎仍有帮助，所以在范围为"所有 AI 引擎"的审计中保留它们，并针对仅限 Google 的审计调整严重度。

| 项 | Google AI 功能 | 其他引擎（ChatGPT、Perplexity、Claude） |
|---|---|---|
| llms.txt | 不使用。对仅限 Google 的审计严重度 Low | 使用。严重度 High |
| Content chunking | 不要求 | 被抽取式回答奖励。严重度 Medium |
| AI 专用重写 | 不需要 | 有助于逐字引用。严重度 Low |
| 针对 AI 的结构化数据 | 对 AI 功能不要求（对 rich results 仍有用） | 有助于引用。严重度 Medium |
| 非真实提及 / 链接方案 | 明确适得其反。违反 spam 政策。若检出严重度 High | 同样。适得其反。 |

在确定审计范围时，问用户："这是为了在所有 AI 引擎（ChatGPT、Perplexity、Claude、Google）中的可见性，还是专门为了 Google AI Overviews 和 AI Mode？"严重度权重会随答案实质改变。

对仅限 Google 的审计，优先：Search Console 验证、经典 Search Essentials 合规、E-E-A-T 信号、helpful-content 质量、Core Web Vitals、JavaScript SEO、重复内容削减，以及相关的 Merchant Center 或 Business Profile feeds。

## Section A: Content audit (per page)

### A.1 Authority

- [ ] 作者具名并有链接的 bio 页。
- [ ] 作者资历可见（职位、组织、专长）。
- [ ] 至少引用一个带链接的一手来源。
- [ ] 若出现定量断言，它们有来源和日期。
- [ ] 页面包含至少一条不在竞争对手页面上的原创信息。

失败：High。

### A.2 Quotability

- [ ] H2 以 1 到 3 句的定义或核心答案开头。
- [ ] 每个 H2 下的章节在被抽出时能独立成立。
- [ ] 没有段落超过 5 句而无结构断点。
- [ ] 关键事实以事实陈述，而非埋在口语化文字中。
- [ ] 代词不跨标题边界。

失败：High。

### A.3 Comprehensiveness

- [ ] 话题的所有主要方面都已覆盖。
- [ ] 读者自然会问的后续问题都已回答。
- [ ] 至少包含一项：how-to 章节、对比表、step-by-step 指南。
- [ ] 在相关处显式处理常见误解。
- [ ] 字数与话题相称（指南通常 800 到 3000+）。

失败：Medium。

### A.4 Structure

- [ ] 每页一个 H1，描述性强（而非像"Article"这样通用）。
- [ ] H2 和 H3 层级合理，标签描述性强。
- [ ] 并列项用列表，对比用表格，代码用代码块。
- [ ] 语义 HTML（`<article>`、`<section>`、`<nav>`）而非 div-soup。
- [ ] 每个标题后的第一段包含核心答案。

失败：Medium。

### A.5 Style and tone

- [ ] 无 em dash。
- [ ] 无推销性套话（"revolutionize"、"unleash"、"unlock the power of"）。
- [ ] 无无链接的含糊"experts say"归因。
- [ ] 无 rule-of-three 填充。
- [ ] 无"in conclusion"收尾段。
- [ ] 语言匹配受众（巴西受众用葡萄牙语，默认英文）。

失败：Low。

### A.6 Primary-source signaling

Anthropic 公开的 Claude system prompt 明确贬低模式匹配到中端 SEO 输出的内容。该过滤器在按价值评估之前运行。其他前沿模型通过 reranking 应用类似逻辑。看起来像一手来源是过仲裁层所必需的。

- [ ] 作者具名，带链接的 bio 页、资历，以及作者档案上的头像照。
- [ ] 至少包含一项：原创数据、原创方法论或第一手经验。
- [ ] 权威断言用具体引用支撑，而非含糊归因。
- [ ] 不出现 listicle 和"ultimate guide"框架，或每项都有原创实质支撑。
- [ ] 无复制粘贴的 affiliate-roundup 结构（winner / runner-up / budget pick），除非挑选经过第一手测试且测试方法论已发布。
- [ ] 标题和标题不模式匹配到中端 SEO（"10 Best X for Y"、无独特角度的"The Complete Guide to Z"）。
- [ ] 一位记者合理地能把本页作为至少一条断言的一手来源引用，而非作为"共识所说的一个例子"。

失败：High。这是 `content-strategy.md` 中描述的仲裁层来源质量过滤器的操作读法。

### A.7 Off-site presence and discovery

最强的 AI 可见性测量相关因素都在站外（`ahrefs-2026-studies.md`）。停在页面内因素的审计漏掉最大的杠杆，所以检查品牌在自己页面之外的足迹。

- [ ] 该品牌有 YouTube 存在感（自有频道和/或在第三方视频中被提及）。这是 75,000 品牌研究中最强的单一可见性相关因素。
- [ ] 该品牌在核心话题上赢得可信第三方内容（行业出版物、播客、Reddit、Quora）中的提及。
- [ ] 该品牌出现在其品类下可信的"best X"对比清单上，理想情况下在前三分之一。位置与被推荐相关。
- [ ] 该品牌有 Wikipedia 条目，或正在向一个条目所需的可证显著性努力（一个"死"但高价值的引用槽）。
- [ ] 站点在 Bing Webmaster Tools 中注册并验证，因为 ChatGPT 最常引用的页面中有 28% 在 Google 上零可见度，靠的是 Bing 驱动的那一层。
- [ ] 品牌在所有外部档案上一致使用一个规范名（实体消歧）。

失败：High。对新兴品牌，本节通常是约束瓶颈，先于任何页面内修复。

### A.8 Retrieval-gate readiness

ChatGPT 只引用它所检索 URL 的约一半，仅凭 title、snippet 和 URL 决定打开哪些页面（`ahrefs-2026-studies.md`）。这些检查针对那道门。

- [ ] Title tag 直白陈述主题并匹配可能的查询措辞（不聪明或含糊）。
- [ ] Meta description 是回答而非卖关子；它读起来像一段可用的 snippet。
- [ ] URL 干净且人类可读（`/guides/topic-name`，而非不透明查询串）。

失败：Medium。

## Section B: Structured data audit (per page)

校准说明：schema 是卫生，不是 AI 引用杠杆。一项受控研究发现添加 JSON-LD 在任何 AI 平台上都没有产生有意义的引用提升（`ahrefs-2026-studies.md`）。按 schema 实际交付的来评分，即经典 Search 中的 rich results 和实体清晰度。下面的严重度反映了这一点：缺 schema 对 Search 和实体绑定是真缺口，但它不是页面未能赢得 AI 引用的原因。不要让一个 schema 缺口在修复清单中排在内容质量或站外权威之前。

### B.1 Schema presence

- [ ] `<head>` 中存在 JSON-LD。
- [ ] 至少包含一项：Article、FAQPage、Organization、Product、HowTo、Person、SoftwareApplication，恰当应用。
- [ ] 在 Google Rich Results Test 中无错误验证通过。
- [ ] 在 schema.org Validator 中无错误验证通过。

失败：Medium（卫生和 rich-result 资格，而非 AI 引用阻塞）。

### B.2 Article schema (for content pages)

- [ ] `headline` 存在并与 H1 匹配。
- [ ] `author` 是一个 Person 对象，含 `name`、`url`、可选 `sameAs`。
- [ ] `datePublished` 存在且准确。
- [ ] `dateModified` 存在、准确，并在显示时与可见日期匹配。
- [ ] `publisher` 是一个 Organization 对象，含 `name`、`url`、`logo`。
- [ ] `mainEntityOfPage` 设置正确。
- [ ] `image` 存在且 URL 可解析。

失败：Medium。

### B.3 Organization schema (on homepage and About)

- [ ] 在首页存在。
- [ ] `name`、`url`、`logo`、`description` 已填。
- [ ] `sameAs` 数组含至少 3 个权威外部档案（LinkedIn、Twitter、Wikipedia、Crunchbase、GitHub、官方新闻联系方式）。
- [ ] 在适用处 `contactPoint` 存在。

失败：Medium。这一项通过实体清晰度（`sameAs` 把你的品牌绑到正确的 knowledge-graph 节点）挣得其位置，而非引用提升。

### B.4 FAQ schema (where applicable)

- [ ] FAQ schema 存在于 FAQ 页面和含问答章节的内容页面。
- [ ] 每个 Question 有清晰的 `name`（问题）。
- [ ] 每个 Answer 在 100 字以内、事实性、完整。
- [ ] schema 中所有问答也在页面上可见出现。

失败：Medium。

### B.5 Product schema (commerce or SaaS)

- [ ] 存在于每个产品或定价页。
- [ ] `name`、`description`、`brand`、`image` 已填。
- [ ] `offers` 含 `price`、`priceCurrency`、`availability`。
- [ ] `aggregateRating` 仅在你有真实评价时使用。绝不造假。

失败：电商 High，SaaS Medium。

## Section C: Technical audit (per site)

### C.1 FAST framework

- [ ] **F: Fetchable**。在禁用 JavaScript 的情况下加载前 20 个页面返回完整内容。
- [ ] **A: Accessible**。所有图片有描述性 alt 文本。标题遵循 H1 到 H6 正确。
- [ ] **S: Structured**。每个内容页有 Schema.org JSON-LD。全站语义 HTML。
- [ ] **T: Trim**。页面权重低于 1 MB。HTML body 压缩后低于 100 KB。

失败：F 为 Blocker。A、S 为 High。T 为 Medium。

### C.2 Core Web Vitals

- [ ] 移动端 LCP 低于 2.5 秒。
- [ ] INP 低于 200ms。
- [ ] CLS 低于 0.1。
- [ ] TTFB 低于 800ms。
- [ ] 至少 75% 的会话通过 Core Web Vitals（按 Search Console）。

失败：High。

### C.3 HTTPS

- [ ] 全站强制 HTTPS。
- [ ] HSTS 头设置，`max-age` 至少 31536000。
- [ ] 站点在 HSTS preload 列表上（https://hstspreload.org）。
- [ ] 无 mixed content 警告。

失败：缺 HTTPS 为 Blocker。缺 HSTS 为 High。

### C.4 Canonical URLs

- [ ] 每个可索引页有 `<link rel="canonical">`。
- [ ] Canonical 匹配实际的主 URL。
- [ ] Schema `mainEntityOfPage` 匹配 canonical。

失败：Medium。

### C.5 Sitemap

- [ ] 在 `/sitemap.xml` 有 XML sitemap，或大型站点有 sitemap index。
- [ ] 已提交到 Google Search Console 和 Bing Webmaster Tools。
- [ ] 在 robots.txt 中引用。
- [ ] `lastmod` 日期准确并在编辑时更新。

失败：Medium。

### C.6 URL structure

- [ ] 干净、描述性强、小写、连字符化。
- [ ] canonical URL 中无查询参数。
- [ ] 稳定（近期无不必要的 URL 变更）。

失败：Low。

### C.7 Mobile-friendliness

- [ ] 响应式（而非单独的 m. 子域）。
- [ ] viewport meta 标签存在。
- [ ] 点击目标至少 48x48 像素。
- [ ] 正文至少 16px。

失败：Medium。

## Section D: AI crawlability audit (per site)

### D.1 robots.txt

- [ ] 文件存在于 `/robots.txt`。
- [ ] 允许主要 AI 搜索爬虫：GPTBot、OAI-SearchBot、ChatGPT-User、ClaudeBot、anthropic-ai、PerplexityBot、Google-Extended、Applebot-Extended。
- [ ] AI 训练爬虫策略（CCBot、Bytespider 等）反映有意的决策。
- [ ] Sitemap 指令存在。
- [ ] 无意外 Disallow 规则阻塞重要路径。

失败：若 AI 爬虫被意外阻塞则为 Blocker。

### D.2 llms.txt

- [ ] 文件存在于 `/llms.txt`。
- [ ] 返回 Content-Type `text/plain` 或 `text/markdown`。
- [ ] 以 `# Brand Name` 和 `> 1-3 sentence summary` 开头。
- [ ] 列出关键页面并带描述性标签。
- [ ] 在重要页面增删时更新。

失败：High。

### D.3 llms-full.txt or per-directory llms.txt

- [ ] 对 100 页以下的站点：`/llms-full.txt` 存在并含完整内容。
- [ ] 对 200 页以上的站点：每个主要章节有 per-directory `llms.txt`。
- [ ] 根 `llms.txt` 在适用处指向章节级 llms.txt 文件。

失败：Medium。

### D.4 Content Signals (optional but emerging)

- [ ] 若存在明确的 AI 训练 / 搜索 / 推理策略，robots.txt 中的 `Content-Signal` 指令与之匹配。

失败：Low（新兴标准）。

## Section E: Agent readiness audit (per site)

### E.1 Tier 1 (every site)

- [ ] 含 AI 策略的 robots.txt（在 D.1 覆盖）。
- [ ] Sitemap（在 C.5 覆盖）。
- [ ] llms.txt（在 D.2 覆盖）。
- [ ] Schema.org JSON-LD（在 B 覆盖）。
- [ ] HTTPS with HSTS（在 C.3 覆盖）。

### E.2 Tier 2 (content publishers)

- [ ] Markdown content negotiation：`Accept: text/markdown` 返回 Markdown。
- [ ] `/index.md` fallback 至少在前 20 个页面上工作。
- [ ] HTML 中存在隐藏的 agent 指令注释。
- [ ] HTTP Link 头暴露关键资源（sitemap、llms.txt、api-catalog）。

失败：每项 Medium。

### E.3 Tier 3 (products that expose tools or APIs)

- [ ] MCP Server Card 在 `/.well-known/mcp/server-card.json`。
- [ ] MCP server 在声明的端点可达。
- [ ] OpenAPI spec 在稳定 URL。
- [ ] 若存在多个 API，API Catalog 在 `/.well-known/api-catalog`。

失败：若产品是 MCP 候选则 MCP 为 High。OpenAPI 为 Medium。

### E.4 Tier 4 (identity, access, commerce)

仅在相关时应用：

- [ ] OAuth Authorization Server Metadata 在 `/.well-known/oauth-authorization-server`。
- [ ] OAuth Protected Resource 在 `/.well-known/oauth-protected-resource`。
- [ ] 支持 PKCE。
- [ ] Web Bot Auth 公钥在 `/.well-known/http-message-signatures-directory`（若运行自有 agent）。
- [ ] 若产品接受 agentic payments，则 x402、ACP 或 UCP。

失败：每项 Medium。仅在相关时。

### E.5 Scanner verification

- [ ] 站点通过 https://isitagentready.com 的检查。
- [ ] 站点通过 https://ora.run 上 agentready.org 的 Deep Scan。
- [ ] 评分作为未来审计的基线记录。

失败：Medium。

## Section F: Measurement readiness audit

### F.1 Analytics

- [ ] GA4 已安装并激活。
- [ ] AI Referral Traffic 自定义渠道组已配置（正则来自 `measurement.md`）。
- [ ] 已定义捕获业务成果的 goal 或转化。

失败：High。

### F.2 Search Console

- [ ] Google Search Console 已设置并验证。
- [ ] Bing Webmaster Tools 已设置并验证。
- [ ] 两者中都已提交 sitemap。

失败：Medium。

### F.3 AI monitoring

- [ ] 至少一个 AI 搜索监控工具激活（Profound、Otterly、Peec 等）。
- [ ] 正在追踪前 20 到 200 个战略性查询。
- [ ] 已记录基线引用率、品牌提及率和可见性评分。

失败：Medium。对极小站点可选。

### F.4 Reporting cadence

- [ ] 每周流量和引用审查。
- [ ] 每月内容表现审查。
- [ ] 每季度内容刷新和审计重跑。

失败：Low。

## Report template

交付审计时，使用此结构：

```
# GEO Audit: [Site or Page Name]
Date: [date]
Scope: [URL or scope description]

## Executive summary
[2 to 4 sentences. Lead with the most impactful failure or the most actionable win.]

## Passes
[Bulleted list of what is working.]

## Failures

### Blockers
[Items that prevent AI crawler access.]

### High priority
[Items that significantly hurt citation likelihood.]

### Medium priority
[Optimization opportunities.]

### Low priority
[Polish.]

## Prioritized fix list
1. [Specific fix]. Reference file: [filename]. Estimated effort: [low/medium/high].
2. ...

## Quick wins (ship this week)
[3 to 5 items that can be shipped in days, not weeks.]

## Next steps
[Recommended ordering and ownership.]
```

交付审计后，主动提出："Would you like me to generate the implementation for any of these (code, schema, configuration)?" 用 `templates.md` 产出可直接粘贴的产物。
