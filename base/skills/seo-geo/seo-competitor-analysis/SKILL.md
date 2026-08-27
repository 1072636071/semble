---
name: seo-competitor-analysis
description: '将竞品的关键词、内容、backlink、AI 引用与流量份额基准化为优势、劣势与行动计划。当用户说"analyze competitors"、"竞品分析"、"竞争对手"、"competitive intelligence"、"competitor SEO"、"why do they outrank me"或"对标分析"时使用。不用于成对 topic 覆盖缺口图——请用 content-gap-analysis。'
x-install: project
metadata:
  version: 1.0.0
  author: seo-geo-skill-suite
  geo-relevance: medium
  tags:
    - seo
    - geo
    - competitor-analysis
    - competitive-intelligence
    - benchmarking
    - competitor-keywords
    - competitor-backlinks
    - market-analysis
---

# Competitor Analysis（竞品分析）

分析竞品的 SEO 与 GEO 策略，揭示可复制的胜利、薄弱点与市场缺口。

## Quick Start

```
Analyze SEO strategy for [competitor URL]
```

```
Compare my site [URL] against [competitor 1], [competitor 2], [competitor 3]
```

## Skill Contract

**Expected output**：一份排好序的竞品 brief，加上 `memory/research/` 的标准 handoff summary。

- **Reads**：竞品 URL/domain、自有站点指标、业务模式、目标受众、行业上下文，以及任何用户或工具提供的数据。
- **Writes**：面向用户的分析与可复用 summary。
- **Promotes**：将持久化的竞品事实、关键词优先级、entity 候选与待定策略决策写入 `memory/hot-cache.md`、`memory/open-loops.md` 与 `memory/research/`。
- **Done when**：3-5 个竞品在一张对比表中按关键词、backlink 与流量份额基准化；每条 strength-to-learn 与 weakness-to-exploit 都引证证据；交付物以 Immediate / Short-term / Long-term 计划收尾。
- **Primary next skill**：当竞品缺口需关键词级研究时，使用 [seo-keyword-research](../seo-keyword-research/SKILL.md)。

### Handoff Summary

> Emit the standard shape from skill-contract.md §Handoff Summary Format.

## Data Sources

可选集成：SEO 工具、analytics、AI monitor。无工具时，向用户索取竞品 URL、自有站点指标与行业上下文。

## Decision Gates

**停下询问** —— 当竞品集无法确立时：

1. 用户未命名竞品，且无法从 `CLAUDE.md`、既往研究或用户 niche 推断 → 请用户命名 2-5 个竞品，或先通过 SERP 分析从目标关键词推断。

**静默继续** —— 不要停：从更长列表中选哪 3-5 个深挖（选最直接竞品，其余备注）；缺自有站点指标（竞品互为基准，自有行标 N/A）；缺可选工具数据（标 Estimated 继续）。

## Instructions

当用户请求竞品分析时：

1. **Identify Competitors** — 若用户未命名，区分直接竞品、间接替代与内容竞品。
2. **Gather Competitor Data** — 采集 URL、domain age、估算流量、domain authority、业务模式、目标受众与主要产品。
3. **Analyze Keyword Rankings** — 记总排名数、top 10/top 3 数、高价值关键词、intent 混合与关键词缺口。
4. **Audit Content Strategy** — 审视内容量、top 表现、发布模式、主题与成功因素。
5. **Analyze Backlink Profile** — 审视 backlink 总量、质量混合、top linking domain、获链模式与可链资产。
6. **Technical SEO Assessment** — 评估 Core Web Vitals、移动友好性、架构、内链、URL 结构与突出强弱项。
7. **GEO / AI Citation Analysis** — 测试哪些查询引用竞品、何种格式被引用、竞品仍留何处空档。
8. **Synthesize Competitive Intelligence** — 交付 Executive Summary、对比表、CITE 对比、可学优势、可 exploit 劣势、关键词机会、内容建议与 Immediate / Short-term / Long-term 计划。

每个指标标注 **Measured**（工具/导出）、**User-provided** 或 **Estimated**（模型推断）；绝不把估计值当测量值呈现；若某必需指标不可得，标 N/A——不要凭空发明。

**Quality bar**：每条优势或劣势绑定一个数字与具名竞品——"HubSpot 在 4,200 个 commercial 关键词上排名 top-3"，而非"内容存在感强"。

> **Reference**：每步紧凑模板见 [references/analysis-templates.md](references/analysis-templates.md)。

## Example

分析 HubSpot 营销关键词统治力的完整样例见 [references/example-report.md](references/example-report.md)。

## Advanced Analysis Types

### Link Intersection

```
Find sites linking to [competitor 1] AND [competitor 2] but not me
```

### SERP Feature Analysis

```
What SERP features do competitors win? (Featured snippets, PAA, etc.)
```

## Tips for Success

分析 3-5 个竞品、纳入间接玩家、强弱并研。

### Save Results

写入路径：`memory/research/competitor-analysis/YYYY-MM-DD-<topic>.md`；将持久化的竞品事实与 entity 候选提升到 `memory/hot-cache.md`。

## Dependencies

- **External tools**：SEO 工具 API、analytics、AI monitor（可选但推荐）
- **User-provided data**：竞品 URL、自有站点指标、行业上下文
- **Project files**：`docs/SEO/01-参考资料/`，用于关键词与市场上下文

## Error Handling

- **竞品集无法确立**：请用户命名 2-5 个竞品，或从目标关键词经 SERP 分析推断
- **自有站点指标不可得**：竞品互为基准，自有行标 N/A
- **缺可选工具数据**：标 Estimated 继续
- **竞品 URL 无效**：提示用户提供有效 URL

## Resource Cleanup

- 应用户请求将结果保存到 `memory/research/competitor-analysis/`；持久化记录，不自动清理
- 将持久化的竞品事实与 entity 候选提升到 `memory/hot-cache.md`

## Logging

- 每步公告 `[Step N/8: Name]`
- 每个指标标注 Measured / User-provided / Estimated
- 报告竞品数与关键发现摘要

## Reference Materials

- [Analysis Templates](references/analysis-templates.md) — 逐步分析模板
- [Battlecard Template](references/battlecard-template.md) — 快查 battlecard 格式
- [Positioning Frameworks](references/positioning-frameworks.md) — 定位与差异化框架
- [Example Report](references/example-report.md) — 完整样例

## Next Best Skill

Primary：[seo-keyword-research](../seo-keyword-research/SKILL.md)。Also：[seo-backlink-analysis](../seo-backlink-analysis/SKILL.md)。

## GEO 增量（D6 双视角）

本技能同时覆盖传统搜索（SEO）与 AI 引擎（GEO）双视角。GEO 增量取自 geo-super 中文化素材（指针引用，不复制内容）：

| 增量点 | 素材指针 |
|--------|----------|
| AI 引擎品牌提及度量 | `seo-audit-template/references/geo/measurement.md` § brand mention + citation rate |
| AI 可见性对比维度 | `seo-audit-template/references/geo/platforms.md` § 各平台品牌出现机制 |
| battlecard AI 维度 | `seo-audit-template/references/geo/audit-checklist.md` § Section D（平台可见性） |
| 竞品 agent readiness 对比 | `seo-audit-template/references/geo/agent-readiness.md` § 四维度 |

详见 `seo-audit-template/references/geo-increment-materials.md` § 05。
