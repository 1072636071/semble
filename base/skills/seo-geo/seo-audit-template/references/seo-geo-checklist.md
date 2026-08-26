# SEO/GEO Checklist — 搜索引擎与 AI 可见性审查清单（通用模板）

> 适用范围：由 `seo-audit-template` 生成的 `seo-geo-audit` 子技能。
> **双视角**（D6）：同时覆盖传统搜索（`{目标搜索引擎}`：百度/Google/Bing）与 AI 引擎（`{目标AI引擎}`：ChatGPT/Perplexity/豆包/DeepSeek 等）。GEO 维度取自 geo-super 全量中文化素材（见 `geo/` 子目录）。

## 目录

1. [SEO 元数据](#1-seo-元数据)
2. [关键词布局](#2-关键词布局)
3. [内容结构与标题层级](#3-内容结构与标题层级)
4. [内部链接策略](#4-内部链接策略)
5. [结构化数据 (JSON-LD)](#5-结构化数据-json-ld)
6. [E-E-A-T SEO 信号](#6-e-e-a-t-seo-信号)
7. [GEO / AI 可见性](#7-geo--ai-可见性)
8. [技术 SEO + AI 爬虫](#8-技术-seo--ai-爬虫)
9. [评分标准](#9-评分标准)

---

## 1. SEO 元数据

| # | 检查项 | 严重等级 | 说明 |
|---|--------|----------|------|
| S1 | title 已设置 | Critical | frontmatter `title` 非空 |
| S2 | title 长度 | High | 中文 ≤约 30 字，英文 ≤约 60 字符 |
| S3 | title 含主关键词 | High | 主目标关键词自然出现在标题中 |
| S4 | title 含品牌 | Medium | 含品牌识别词 |
| S5 | description 已设置 | Critical | meta description 非空 |
| S6 | description 长度 | High | 中文 80–120 字，英文 120–160 字符 |
| S7 | description 含主关键词 | High | 主关键词出现在描述中 |
| S8 | description 具召唤价值 | Medium | 清晰概括，引导点击 |

## 2. 关键词布局

| # | 检查项 | 严重等级 | 说明 |
|---|--------|----------|------|
| K1 | 主关键词在 H1(title) 中 | High | 标题自然包含主关键词 |
| K2 | 主关键词在前 100 字 | High | 开头段落包含主关键词 |
| K3 | 至少 2 个 H2 含次关键词 | High | 副标题自然包含次级关键词 |
| K4 | 关键词密度 1–2% | Medium | 主关键词频率适中，无堆砌 |
| K5 | 语义变体词使用 | Medium | 使用同义词与相关术语 |
| K6 | 关键词与站内一致性 | Medium | 与站内内容素材的选题/术语保持一致 |

### 关键词密度计算

```
密度 ≈ (关键词出现次数 / 文章总字数) × 100%
目标范围: 1% - 2%
```

## 3. 内容结构与标题层级

| # | 检查项 | 严重等级 | 说明 |
|---|--------|----------|------|
| H1 | 仅一个 H1 | Critical | frontmatter `title` 是唯一的 H1 |
| H2 | 至少 2 个 H2 | High | 用 `##` 划分段落 |
| H3 | H3 在 H2 下使用 | Medium | 不跳过层级 |
| H4 | 标题包含关键词 | High | H2/H3 自然包含目标关键词 |
| H5 | 标题具有描述性 | Medium | 标题能概括段落内容 |
| H6 | 表格/列表增强可读性 | Medium | 数据用表格，要点用列表 |

## 4. 内部链接策略

| # | 检查项 | 严重等级 | 说明 |
|---|--------|----------|------|
| I1 | 至少 2–4 个内部链接 | High | 正文含指向站内其他页面的链接 |
| I2 | 链接到相关产品/服务页 | High | 至少 1 个链接指向核心转化页 |
| I3 | 链接到其他内容 | Medium | 至少 1 个链接指向相关内容 |
| I4 | 锚文本具描述性 | High | 使用关键词丰富的锚文本，非"点击这里" |
| I5 | 链接分布均匀 | Medium | 链接分布在文章前/中/后段 |

## 5. 结构化数据 (JSON-LD)

| # | 检查项 | 严重等级 | 说明 |
|---|--------|----------|------|
| J1 | Schema 存在 | Critical | 详情页注入 JSON-LD（Article/NewsArticle/Product/FAQPage 等） |
| J2 | headline 使用 title | High | 使用 frontmatter `title` |
| J3 | description 使用 summary | High | 使用 frontmatter `summary`/`description` |
| J4 | datePublished 正确 | High | 与 `date` 一致 |
| J5 | url 正确 | Medium | 指向规范 URL |
| J6 | author/publisher 正确 | Medium | 品牌信息正确 |

> **GEO 提示**：JSON-LD 对 AI 引擎的引用提升经 ahrefs 2026 实证研究验证为**无显著效果**（见 `geo/ahrefs-2026-studies.md`）。保留 JSON-LD 服务于传统搜索 rich results 与实体清晰度，不作为 AI 引用杠杆。

## 6. E-E-A-T SEO 信号

| # | 检查项 | 严重等级 | 说明 |
|---|--------|----------|------|
| E1 | 品牌全称出现 | High | 品牌全称至少出现一次 |
| E2 | 资质认证提及 | Medium | 行业相关资质 |
| E3 | 核心数据提及 | Medium | 标志性产能/规模数据 |
| E4 | 发布日期可见 | Medium | 详情页显示 `date` |

## 7. GEO / AI 可见性

> 本节是 GEO 增量，取自 geo-super 全量中文化素材。详细论据见 `geo/` 子目录各 reference。

| # | 检查项 | 严重等级 | 说明 |
|---|--------|----------|------|
| G1 | 内容可被 AI 引用（quotability） | High | 含清晰定义、数据表格、对比等可引用内容 |
| G2 | FAQ 型内容清晰 | Medium | 对常见问题有明确、简洁的答案段落 |
| G3 | 列表/表格结构 | Medium | 用有序/无序列表与表格呈现要点与对比 |
| G4 | 内容深度足够 | Medium | 中文 ≥800 字，信息完整 |
| G5 | 答案型内容清晰 | Medium | 关键问题有直截了当的回答 |
| G6 | 实体清晰度（entity clarity） | High | 人/地/物/概念实体明确，便于 LLM 识别 |
| G7 | 段落级可抽取性（chunkability） | High | 内容可在 section 级别干净抽取，进入检索池 |
| G8 | primary source 优先 | High | 原创/第一手资料优于聚合/转载 |
| G9 | E-E-A-T for AI | High | 经验/专业/权威/可信信号齐全 |

> 详细 GEO 内容策略见 `geo/content-strategy.md`（四支柱 + 三层仲裁模型）；AI 引擎平台特性见 `geo/platforms.md`；度量指标见 `geo/measurement.md`。

## 8. 技术 SEO + AI 爬虫

| # | 检查项 | 严重等级 | 说明 |
|---|--------|----------|------|
| T1 | canonical URL 正确 | High | 详情页 canonical 指向规范 URL |
| T2 | Open Graph 标签完整 | Medium | og:title/description/type/image |
| T3 | 站点地图包含 | Medium | sitemap 收录 |
| T4 | 图片 alt 文本 | High | 正文图片有描述性 alt |
| T5 | 无死链 | Medium | 内部链接均有效 |
| T6 | llms.txt / llms-full.txt | Medium | 若存在，内容协商正确（见 `geo/ai-crawlers-and-llmstxt.md`） |
| T7 | AI 爬虫 robots 配置 | Medium | 允许主流 AI 爬虫或明确策略（见 `geo/ai-crawlers-and-llmstxt.md`） |
| T8 | agent readiness | Low | MCP Server Card / Markdown 内容协商等（见 `geo/agent-readiness.md`） |

> 多语言站点须额外检查 hreflang 标签。`{语言/地区}` 为单语时跳过。

## 9. 评分标准

| 等级 | 分值 | 说明 |
|------|------|------|
| A（优秀） | 90–100 | 所有 Critical/High 项通过，Medium 项通过率 ≥80% |
| B（良好） | 75–89 | 所有 Critical 项通过，High 项通过率 ≥80% |
| C（合格） | 60–74 | 所有 Critical 项通过，High 项通过率 ≥60% |
| D（不合格） | <60 | 存在 Critical 项未通过 |

### 加权计算

- Critical: ×3
- High: ×2
- Medium: ×1
- Low: ×0.5

总分 = Σ(通过项 × 权重) / Σ(总项 × 权重) × 100
