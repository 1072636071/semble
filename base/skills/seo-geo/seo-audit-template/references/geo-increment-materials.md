# 五件套 GEO 增量素材清单

> 供工单 04–08（五件套中文版）使用。素材取自 geo-super 全量中文化（`seo-audit-template/references/geo/`），同一论据不翻译两次。
> 每件套用"指针引用"而非复制内容——五件套各自的 SKILL.md 引用本清单指向的 geo/ reference 章节。

## 素材源（geo-super 中文化产物）

| reference | 内容摘要 |
|-----------|----------|
| `geo-super-overview.md` | GEO 总览：GEO vs SEO vs AEO vs Agent Readiness、Google 政策 vs 工程现实、四优化面 |
| `geo/content-strategy.md` | 内容策略四支柱 + 三层仲裁模型 + 内容类型表 + chunkability + entity clarity + E-E-A-T |
| `geo/audit-checklist.md` | GEO 审计 checklist（Section A-F） |
| `geo/agent-readiness.md` | Agent readiness 四维度 + MCP + OAuth + agentic commerce |
| `geo/ahrefs-2026-studies.md` | ahrefs 2026 实证研究（grounding） |
| `geo/ai-crawlers-and-llmstxt.md` | AI 爬虫 + llms.txt/llms-full.txt |
| `geo/measurement.md` | GEO 度量指标 + 基准 |
| `geo/platforms.md` | AI 引擎平台特性（ChatGPT/Perplexity/Claude/Gemini/AI Overviews） |
| `geo/structured-data.md` | 结构化数据（JSON-LD） |
| `geo/technical-implementation.md` | 技术实现 + FAST 框架 |
| `geo/templates.md` | 模板（内容/技术/平台/agent） |

## 各件套 GEO 增量映射

### 04 seo-keyword-research（关键词研究）

**GEO 增量**：产出物同时覆盖"传统搜索词"与"被 AI 引用的问题句式"，关键词意图分类增加 AI 问答场景维度。

| 增量点 | 素材指针 |
|--------|----------|
| AI 引用问句式 | `geo/content-strategy.md` § FAQ 型内容 + `geo/platforms.md` § 各平台问答格式 |
| AI 问答意图分类 | `geo/content-strategy.md` § 内容类型表 + `geo/measurement.md` § AI 引用率指标 |
| topic cluster for AI | `geo/content-strategy.md` § chunkability + entity clarity |
| AI 引擎关键词差异 | `geo/platforms.md` § ChatGPT/Perplexity/Claude/Gemini 关键词行为 |

### 05 seo-competitor-analysis（竞品分析）

**GEO 增量**：竞品分析同时覆盖传统搜索排名对比与 AI 引擎中的品牌提及/引用频次对比，battlecard 模板增加 AI 可见性维度。

| 增量点 | 素材指针 |
|--------|----------|
| AI 引擎品牌提及度量 | `geo/measurement.md` § brand mention + citation rate |
| AI 可见性对比维度 | `geo/platforms.md` § 各平台品牌出现机制 |
| battlecard AI 维度 | `geo/audit-checklist.md` § Section D（平台可见性） |
| 竞品 agent readiness 对比 | `geo/agent-readiness.md` § 四维度 |

### 06 seo-backlink-analysis（外链分析）

**GEO 增量**：链接质量评估同时覆盖传统权重/相关性与"AI 引用源权威性"（被 LLM 引用语料与高权威源的关联），outreach 模板增加面向 AI 可见性的外联场景。

| 增量点 | 素材指针 |
|--------|----------|
| AI 引用源权威性 | `geo/content-strategy.md` § primary source + E-E-A-T |
| 高权威源与 LLM 引用关联 | `geo/ahrefs-2026-studies.md` § 引用源研究 |
| AI 可见性 outreach | `geo/content-strategy.md` § 内容类型表 + `geo/platforms.md` |
| 链接 vs AI 引用差异 | `geo-super-overview.md` § GEO vs SEO |

### 07 seo-content-writing（内容写作）

**GEO 增量**：内容写作同时过 SEO checklist 与 GEO 可引用性 checklist（quotability、E-E-A-T、实体清晰度、段落级可抽取性），标题公式与结构模板增加 AI 引用友好变体。

| 增量点 | 素材指针 |
|--------|----------|
| GEO 可引用性 checklist | `geo/content-strategy.md` § 四支柱 + chunkability + entity clarity |
| quotability 指标 | `geo/measurement.md` § quotability |
| AI 引用友好标题/结构 | `geo/templates.md` § 内容模板 + `geo/content-strategy.md` § 内容类型表 |
| E-E-A-T for AI | `geo/content-strategy.md` § E-E-A-T 表 |
| 段落级可抽取性 | `geo/content-strategy.md` § chunkability + retrieval gate |

### 08 seo-technical-audit（技术审计）

**GEO 增量**：技术审计在传统爬虫可访问性之外，加查 llms.txt / llms-full.txt、JSON-LD 结构化数据、AI 爬虫 robots 配置、agent readiness（MCP Server Card、Markdown 内容协商等）。

| 增量点 | 素材指针 |
|--------|----------|
| llms.txt / llms-full.txt 检查 | `geo/ai-crawlers-and-llmstxt.md`（全量引用） |
| AI 爬虫 robots 配置 | `geo/ai-crawlers-and-llmstxt.md` § 爬虫表 + robots 策略 |
| JSON-LD for AI | `geo/structured-data.md`（注：ahrefs 研究显示 JSON-LD 对 AI 引用无显著提升，保留服务传统搜索） |
| agent readiness 检查 | `geo/agent-readiness.md`（全量引用） |
| MCP Server Card | `geo/agent-readiness.md` § Discoverability |
| Markdown 内容协商 | `geo/agent-readiness.md` § Content for agents |
| FAST 框架 | `geo/technical-implementation.md` § FAST |
| 技术审计 checklist | `geo/audit-checklist.md` § Section E/F |

## 使用约定

1. 五件套 SKILL.md 的 GEO 增量章节**指针引用**本清单指向的 geo/ reference，不复制内容（D4 单源派生）。
2. 五件套各自的中文化 references 从对应 spz-seo-* 源技能翻译，GEO 增量章节统一指向本清单。
3. 术语保留英文（GEO、llms.txt、E-E-A-T、JSON-LD、MCP 等），解释用中文。
4. 所有经验性声明保留 ahrefs 2026 等 grounding（见 `geo/ahrefs-2026-studies.md`）。
