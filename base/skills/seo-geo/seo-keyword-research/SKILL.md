---
name: seo-keyword-research
description: '为 SEO 与 GEO 规划发现、评分并聚类关键词。当用户说"find keywords"、"挖词"、"搜什么词"、"keyword research"、"search volume analysis"、"keyword difficulty"、"topic clusters"、"long-tail keywords"、"what should I write about"、"关键词研究"、"内容选题"、"关键词分析"、"长尾关键词"或"帮我挖词"时使用。按 search volume、keyword difficulty、intent 与 topic cluster 排序。不用于竞品相对的覆盖缺口——请用 seo-competitor-analysis。'
x-install: project
metadata:
  version: 1.0.0
  author: seo-geo-skill-suite
  geo-relevance: medium
  tags:
    - seo
    - geo
    - keyword-research
    - search-volume
    - keyword-difficulty
    - topic-clusters
    - search-intent
    - long-tail-keywords
---

# Keyword Research（关键词研究）

为 SEO 与 GEO 规划发现、评分并聚类关键词。

## Quick Start

```
Research keywords for [topic/product/service]
```

```
What keywords is [competitor URL] ranking for that I should target?
```

## Skill Contract

**Expected output**：一份排好序的 keyword brief，加上 `memory/research/` 的标准 handoff summary。

- **Reads**：topic 或 seed keyword、目标市场/语言、业务目标、站点 DR，以及任何用户或工具提供的指标。
- **Writes**：面向用户的研究交付物与可复用 summary。
- **Promotes**：将持久化的关键词优先级、竞品事实与待定策略决策写入 `memory/hot-cache.md`、`memory/open-loops.md` 与 `memory/research/`。
- **Done when**：每个入围关键词都带 volume + difficulty + intent（或标注 N/A）；关键词已分入 pillar + cluster hub；交付物至少点名 3 个 Quick Win / Growth / GEO 机会。
- **Primary next skill**：当关键词集已准备好进入市场对比时，使用 [seo-competitor-analysis](../seo-competitor-analysis/SKILL.md)。

### Handoff Summary

> Emit the standard shape from skill-contract.md §Handoff Summary Format.

## Data Sources

可选集成：SEO 工具、search console。无工具时，向用户索取 seed keyword、受众、目标及任何已知指标。

## Instructions

当用户请求关键词研究时，运行八个阶段，并按 `[Phase X/8: Name]` 公告每个阶段：

1. **Scope** — 澄清产品、受众、业务目标、DR、地域与语言。
2. **Discover** — 从核心词、问题词、解决方案词、受众词与行业术语播种。
3. **Variations** — 用修饰符与 long-tail 模式扩展。
4. **Classify** — 按 intent 打标（informational、navigational、commercial、transactional）。
5. **Score** — 赋 difficulty（1-100）并计算 `Opportunity = (Volume × Intent Value) / Difficulty`，Intent Value 取 `1 / 1 / 2 / 3`。
6. **GEO-Check** — 标记 AI 回答友好的查询，如问题、定义、对比、列表与 how-to。
7. **Cluster** — 将关键词分入 pillar + cluster topic hub。
8. **Deliver** — 输出 Executive Summary、Quick Wins / Growth / GEO 机会、Topic Clusters、Content Calendar 与 Next Steps。

每个指标标注 **Measured**（工具/导出）、**User-provided** 或 **Estimated**（模型推断）；绝不把估计值当作测量值呈现；若某必需指标不可得，标 N/A——不要凭空发明。

**Quality bar**：每条建议至少包含一个具体数字。把泛泛之谈改写为具体的关键词 + volume + difficulty + 理由。

> **Reference**：完整 8 阶段模板、扩展模式、intent 表、difficulty 分档、opportunity 矩阵、GEO 指标、cluster 模板、可执行 vs 泛泛示例与高级用法见 [references/instructions-detail.md](references/instructions-detail.md)。

## Example

示例产出：150+ 关键词分析、23 个高优先级机会、跨 3 个聚焦领域约 45K/月流量潜力。完整样例见 [references/example-report.md](references/example-report.md)。

### Advanced Usage

Intent mapping、季节性分析、竞品缺口与本地关键词工作流位于 [references/instructions-detail.md](references/instructions-detail.md#advanced-usage)。

## Tips for Success

从 seed 出发、尊重 intent、紧凑聚类、优先 quick win、每季度复盘。完整笔记见 [references/instructions-detail.md](references/instructions-detail.md#tips-for-success)。

### Save Results

写入路径：`memory/research/keyword-research/YYYY-MM-DD-<topic>.md`；将持久化的关键词优先级提升到 `memory/hot-cache.md`。

## Dependencies

- **External tools**：SEO 工具 API 与 search console（可选，连接时使用）
- **User-provided data**：Seed keyword、受众、目标、任何已知指标
- **Project files**：`docs/SEO/01-参考资料/06-SEO关键词统计.md`、`docs/SEO/01-参考资料/08-关键词附录.md`，用于复用已有关键词上下文

## Error Handling

- **未提供 seed keyword**：向用户索取至少一个 seed keyword 或产品/topic 描述
- **工具 API 不可用**：以模型估计继续，所有指标标注 Estimated
- **search volume 数据不可得**：标 N/A，仅用 difficulty 与 intent 评分继续
- **intent 分类有歧义**：标记并向用户确认

## Resource Cleanup

- 应用户请求将结果保存到 `memory/research/keyword-research/`；持久化记录，不自动清理
- 将持久化的关键词优先级提升到 `memory/hot-cache.md`

## Logging

- 每阶段公告 `[Phase X/8: Name]`
- 每个指标标注 Measured / User-provided / Estimated
- 报告关键词数、cluster 数与 top 3 机会

## Reference Materials

- [Instructions Detail](references/instructions-detail.md) — 工作流、评分、cluster 模板、高级用法
- [Keyword Intent Taxonomy](references/keyword-intent-taxonomy.md) — Intent 信号与内容映射
- [Topic Cluster Templates](references/topic-cluster-templates.md) — Pillar 与 cluster 模式
- [Keyword Prioritization Framework](references/keyword-prioritization-framework.md) — 评分与优先级规则
- [Example Report](references/example-report.md) — 完整样例

## Next Best Skill

Primary：[seo-competitor-analysis](../seo-competitor-analysis/SKILL.md)。

## GEO 增量（D6 双视角）

本技能同时覆盖传统搜索（SEO）与 AI 引擎（GEO）双视角。GEO 增量取自 geo-super 中文化素材（指针引用，不复制内容）：

| 增量点 | 素材指针 |
|--------|----------|
| AI 引用问句式 | `seo-audit-template/references/geo/content-strategy.md` § FAQ 型内容 + `seo-audit-template/references/geo/platforms.md` § 各平台问答格式 |
| AI 问答意图分类 | `seo-audit-template/references/geo/content-strategy.md` § 内容类型表 + `seo-audit-template/references/geo/measurement.md` § AI 引用率指标 |
| topic cluster for AI | `seo-audit-template/references/geo/content-strategy.md` § chunkability + entity clarity |
| AI 引擎关键词差异 | `seo-audit-template/references/geo/platforms.md` § ChatGPT/Perplexity/Claude/Gemini 关键词行为 |

详见 `seo-audit-template/references/geo-increment-materials.md` § 04。
