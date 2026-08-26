---
name: seo-backlink-analysis
description: '为 off-page SEO 分析外部 referring domain、anchor text 分布、toxic link 与竞品链接缺口。当用户说"analyze backlinks"、"外链分析"、"反向链接"、"check link profile"、"find toxic links"、"link building opportunities"、"referring domains"、"who links to me"、"disavow links"、"谁链接到我"或"有垃圾外链"时使用。不用于内链——请用 internal-linking-optimizer。'
x-install: project
metadata:
  version: 1.0.0
  author: seo-geo-skill-suite
  geo-relevance: low
  tags:
    - seo
    - backlinks
    - link-building
    - link-profile
    - toxic-links
    - off-page-seo
    - link-audit
    - referring-domains
    - disavow
---

# Backlink Analyzer（外链分析）

分析 backlink profile 的质量、风险、竞品缺口与 link-building 机会。

## Quick Start

```
Analyze backlink profile for [domain]
```

```
Find link building opportunities by analyzing [competitor domains]
```

## Skill Contract

**Expected output**：一份 backlink 报告或 delta summary，加上 `memory/monitoring/` 的标准 handoff summary。

- **Reads**：目标 domain、backlink/referring-domain 导出、竞品 domain、anchor 数据，以及任何用户或工具提供的指标。
- **Writes**：面向用户的监控交付物与可复用 summary。
- **Promotes**：将重大变化、确认异常、后续动作与待定决策写入 `memory/open-loops.md`。
- **Done when**：referring domain、anchor 混合与 toxic-link 占比均已报告且每个指标带来源标签（或 N/A）；toxic ratio 已计算；至少点名 3 个 link-building 或 disavow 动作。
- **Primary next skill**：当链接缺口需竞品上下文时，使用 [seo-competitor-analysis](../seo-competitor-analysis/SKILL.md)。

### Handoff Summary

> Emit the standard shape from skill-contract.md §Handoff Summary Format.

## Data Sources

所有集成为可选。有工具时，从 link database 拉 backlink profile，从 SEO 工具拉竞品数据。无工具时，向用户索取 backlink CSV、referring domain、竞品 domain 与链接变化。

## Decision Gates

**停下询问用户当：**

- 未提供 backlink 数据且未连接 link database —— 链接数无法测量。提供选项：(1) 粘贴 backlink/referring-domain 导出，(2) 连接工具，(3) 取消。不要仅凭 domain 估计 referring-domain 量。

**静默继续（绝不停）：**

- 多个竞品中深挖哪几个 —— 按重叠分析 top 3，其余备注。
- 缺可选字段（地域、link velocity）—— 标 N/A 继续。

## Instructions

当用户请求 backlink 分析时：

1. **Generate Profile Overview** — 输出关键指标、link velocity、authority 分布与 profile health score，每个指标带来源标签（工具导出 / 用户 / 估计）。
2. **Analyze Link Quality** — top backlink、link type 混合、anchor text 分布与地域。
3. **Identify Toxic Links** — 风险指标、待审链接与 disavow 建议；toxic ratio 以标注数字报告。
4. **Compare Against Competitors** — profile 对比、link intersection 与 top linked 竞品内容。
5. **Find Link Building Opportunities** — intersection 候选、broken link、unlinked mention、resource page、guest post 与 effort-vs-impact 优先级。
6. **Track Link Changes** — 新增与丢失链接、净变化与恢复优先级，每个 delta 对照其基线标注。
7. **Generate Backlink Report** — executive summary、优势、关注、机会、竞品位置、建议动作与 KPI，每个数字带来源标签。

每个指标标注 **Measured**（工具/导出）、**User-provided** 或 **Estimated**（模型推断）；绝不把估计值当测量值呈现；若某必需指标不可得，标 N/A——不要凭空发明。

> **Reference**：七步所用紧凑输出模板见 [references/analysis-templates.md](references/analysis-templates.md)。

### CITE Item Mapping

当在此分析后运行 domain-authority-auditor 时，以下数据直接喂入 CITE 评分：

| Backlink Metric                       | CITE Item                                                    | Dimension |
| ------------------------------------- | ------------------------------------------------------------ | --------- |
| Referring domains count               | C01 (Referring Domain Volume)                                | Citation  |
| Authority distribution (DA breakdown) | C02 (Referring Domains Quality)                              | Citation  |
| Link velocity                         | C04 (Link Velocity)                                          | Citation  |
| Geographic distribution               | C10 (Link Source Diversity)                                  | Citation  |
| Dofollow/Nofollow ratio               | T02 (Dofollow Ratio Normality)                               | Trust     |
| Toxic link analysis                   | T01 (Link Profile Naturalness), T03 (Link-Traffic Coherence) | Trust     |
| Competitive link intersection         | T05 (Profile Uniqueness)                                     | Trust     |

## Example

样例产出：link-intersection 表、top 即时机会与估算影响模型。完整结构见 [references/analysis-templates.md](references/analysis-templates.md)。

## Tips for Success

质量优先、定期监控、anchor 与 link type 多样化、谨慎 disavow。

## Link Quality and Strategy Reference

> **Reference**：评分矩阵、toxic-link 标准、基准与 disavow 指引见 [references/link-quality-rubric.md](references/link-quality-rubric.md)。

> **Reference**：outreach 框架、subject line、回复基准、follow-up 序列与模板见 [references/outreach-templates.md](references/outreach-templates.md)。

### Save Results

询问"保存这些结果？"若是，写入 `memory/monitoring/`。若 toxic ratio 超 15%，推荐 domain-authority-auditor。

## Dependencies

- **External tools**：SEO 工具 API（Ahrefs/Moz/Semrush）取 backlink 数据；可选但推荐
- **User-provided data**：Backlink CSV 导出、referring domain 列表、竞品 domain
- **Project files**：`docs/SEO/01-参考资料/`，用于复用既有 link-building 上下文

## Error Handling

- **未提供 backlink 数据且未连接工具**：停下请用户提供数据或连接工具；不估计 referring-domain 量
- **工具 API 限流或失败**：受影响指标标 N/A，用可得数据继续
- **domain 格式无效**：提示用户提供有效 domain
- **竞品集无法确立**：请用户命名 2-5 个竞品

## Resource Cleanup

- 应用户请求将结果保存到 `memory/monitoring/`；持久化记录，不自动清理
- 若 toxic ratio 超 15%，推荐 domain-authority-auditor 后续

## Logging

- 每步公告 `[Step N/7: Name]`
- 每个指标标注 Measured / User-provided / Estimated
- 报告最终 toxic ratio 与动作数

## Reference Materials

- [Link Quality Rubric](references/link-quality-rubric.md) — 质量与毒性 rubric
- [Outreach Templates](references/outreach-templates.md) — Outreach 框架与示例
- [Analysis Templates](references/analysis-templates.md) — 逐步输出模板

## Next Best Skill

Primary：[seo-competitor-analysis](../seo-competitor-analysis/SKILL.md)。Also：[seo-keyword-research](../seo-keyword-research/SKILL.md)。

## GEO 增量（D6 双视角）

本技能同时覆盖传统搜索（SEO）与 AI 引擎（GEO）双视角。GEO 增量取自 geo-super 中文化素材（指针引用，不复制内容）：

| 增量点 | 素材指针 |
|--------|----------|
| AI 引用源权威性 | `seo-audit-template/references/geo/content-strategy.md` § primary source + E-E-A-T |
| 高权威源与 LLM 引用关联 | `seo-audit-template/references/geo/ahrefs-2026-studies.md` § 引用源研究 |
| AI 可见性 outreach | `seo-audit-template/references/geo/content-strategy.md` § 内容类型表 + `seo-audit-template/references/geo/platforms.md` |
| 链接 vs AI 引用差异 | `seo-audit-template/references/geo-super-overview.md` § GEO vs SEO |

详见 `seo-audit-template/references/geo-increment-materials.md` § 06。
