---
name: seo-content-writing
description: '编写 SEO 优化的文章、博客帖子、落地页与产品描述，覆盖关键词、标题层级、snippet 与证据边界。Use when the user asks to "write SEO content", "SEO文章写作", "内容优化", "帮我写文章", "create blog post", "SEO copywriting", or "write me a blog post". 不用于 AI 引用/GEO 就绪度评分——用 geo-content-optimizer；不用于更新衰减的存量内容——用 content-refresher。'
x-install: project
metadata:
  version: 1.0.0
  author: seo-geo-skill-suite
  geo-relevance: medium
  tags:
    - seo
    - content-writing
    - blog-writing
    - seo-copywriting
    - content-creation
    - article-writing
    - landing-page
---

# SEO Content Writer

创建符合搜索意图、自然融入关键词、且对读者可用的 SEO 内容。

## Quick Start

```
Write an SEO-optimized article about [topic] targeting the keyword [keyword]
```

```
Here's my content brief: [brief]. Write SEO-optimized content following this outline.
```

## Skill Contract

**Expected output**: 一份可用的草稿，加上给 `memory/content/` 的标准 handoff 摘要。

- **Reads**: 内容简报、目标关键词、实体输入与质量约束。
- **Writes**: 面向用户的内容交付物与可复用摘要。
- **Promotes**: 已确认的角度、消息选择、缺失证据与发布阻塞项提升至 `memory/hot-cache.md` 与 `memory/open-loops.md`；将持久决策提议为 pending-decision 项。
- **Done when**: 草稿以自然放置的主关键词满足目标意图；H1/H2 结构、meta description 与至少一个 snippet 可命中区块齐备；每个需要来源的声明要么已引用要么已标注。
- **Primary next skill**: [seo-technical-audit](../seo-technical-audit/SKILL.md) 当需要检查页面级技术问题时。

### Handoff Summary

> Emit the standard shape from skill-contract.md §Handoff Summary Format.

## Data Sources

连接时使用 SEO 工具与 search console；否则向用户索取关键词、意图与竞品。

## Instructions

当用户请求 SEO 内容时，运行以下九步：

1. **Gather Requirements** — 确认主关键词与次关键词、字数、内容类型、受众、意图、语气、CTA 与竞品。
2. **Load CORE-EEAT Constraints** — 应用配套 reference 中列出的 16 项高权重条目。
3. **Research and Plan** — 分析 SERP、映射关键词、选择内容角度。
4. **Create Optimized Title** — 保持简洁、关键词前置、与意图对齐。
5. **Write Meta Description** — 包含关键词、价值主张与 CTA。
6. **Structure Content and Write** — 采用清晰的 H1 > intro > H2/H3 > FAQ > conclusion 流程。
7. **Apply On-Page Best Practices** — 管理关键词放置、可读性、snippet 与辅助视觉素材。
8. **Add Internal / External Links** — 加入相关的内链与权威外链。
9. **Run Final SEO + CORE-EEAT Review** — 给草稿打分、自动修复小问题、暴露仍需用户决策的事项。

任何需要来源的事实声明、统计或引文必须被引用或显式标注 `[needs source]`；绝不编造数字、研究、日期或署名来填补空白。

**Quality bar**: 交接前确认草稿通过——(1) 意图匹配：持有目标查询的读者在首屏即可获得答案；(2) 关键词放置自然（无堆砌），出现在 title、H1、前 100 词与某个 H2；(3) 结构可扫读（H2/H3、列表、一个 snippet-ready 区块）；(4) 零捏造事实——每个需来源的声明已引用或标 `[needs source]`。任一项不通过则修复或在 handoff 中报告，绝不静默交付。

> **Reference**: 见 [references/instructions-detail.md](references/instructions-detail.md) 获取紧凑工作流、写作前 checklist、问题分类规则与自检格式。

## Example

样例产物：关键词前置的 H1、优化后的 meta description、清晰的 H2 结构、FAQ 区块，以及自检后的一段 Changes Made。见 [references/seo-writing-checklist.md](references/seo-writing-checklist.md) 获取 copy-start checklist 与文章模板。

## Content Type Templates

How-to 指南、对比文、listicle、pillar page、评测与 FAQ 页的快速起步模式见 [references/content-structure-templates.md](references/content-structure-templates.md)。

## Tips for Success

匹配意图、前置价值、用证据支撑声明、先为人写再为 SERP 优化。

### Save Results

用户确认后保存至 `memory/content/YYYY-MM-DD-<topic>.md`。

## Dependencies

- **External tools**: 连接时使用 SEO 工具与 search console（可选）
- **User-provided data**: 关键词、意图、竞品、内容简报
- **Project files**: `src/data/blog/posts/*.ts`（逐文件博客数据）、`src/i18n/en.ts` / `zh.ts` 用于既有内容上下文
- **Reference files**: `references/instructions-detail.md` 提供 CORE-EEAT 约束与工作流细节

## Error Handling

- **Missing target keywords**: 停下并请用户在写作前至少提供一个主关键词
- **Conflicting intent signals**: 标注冲突并请用户澄清主要意图
- **Source verification fails**: 将声明标为 `[needs source]`，绝不捏造引用
- **Tool data unavailable**: 以用户提供的信息继续，标注估算指标

## Resource Cleanup

- 内容按用户请求保存至 `memory/content/`；持久记录，不自动清理
- 草稿迭代默认覆盖

## Logging

- 以 `[Step N/9: Name]` 公告每个写作步骤
- 报告关键词放置状态与来源引用数
- 在 handoff 摘要中标注任何 `[needs source]` 项

## Reference Materials

- [Instructions Detail](references/instructions-detail.md) — 工作流、CORE-EEAT 约束、问题处理、自检
- [SEO Writing Checklist](references/seo-writing-checklist.md) — on-page checklist、snippet 模式与 copy-start 模板
- [Title Formulas](references/title-formulas.md) — 标题公式与 CTR 模式
- [Content Structure Templates](references/content-structure-templates.md) — 紧凑内容蓝图

## Next Best Skill

- **Primary**: [seo-technical-audit](../seo-technical-audit/SKILL.md) — 发布前检查页面级技术问题。

## GEO 增量（D6 双视角）

本技能同时覆盖传统搜索（SEO）与 AI 引擎（GEO）双视角。GEO 增量取自 geo-super 中文化素材（指针引用，不复制内容）：

| 增量点 | 素材指针 |
|--------|----------|
| GEO 可引用性 checklist | `geo/content-strategy.md` § 四支柱 + chunkability + entity clarity |
| quotability 指标 | `geo/measurement.md` § quotability |
| AI 引用友好标题/结构 | `geo/templates.md` § 内容模板 + `geo/content-strategy.md` § 内容类型表 |
| E-E-A-T for AI | `geo/content-strategy.md` § E-E-A-T 表 |
| 段落级可抽取性 | `geo/content-strategy.md` § chunkability + retrieval gate |

详见 `seo-audit-template/references/geo-increment-materials.md` § 07。

本技能的中文产物作为 `seo-blog-template`（写作模板）的 references 来源。
