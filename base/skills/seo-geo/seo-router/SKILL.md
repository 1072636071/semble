---
name: seo-router
description: SEO/GEO 技能族族内路由器——用自然语言路由到审查模板、写作模板、五件套或已生成的子技能（seo-geo-audit/blog-writer）；检测套件缺失时引导安装。触发词："SEO""GEO""帮我查关键词""审查这篇文章""写一篇博客""外链分析""竞品分析""技术审计""keyword research""review this article""write a blog""backlink analysis""competitor analysis""technical audit""AI 可见性""llms.txt"。与工程族 jxx-ask-matt 并列，一族一路由。
x-install: project
metadata:
  version: 1.0.0
  author: seo-geo-skill-suite
  tags: [seo, geo, router, dispatcher, installer]
  triggers:
    [
      SEO,
      GEO,
      帮我查关键词,
      审查这篇文章,
      写一篇博客,
      外链分析,
      竞品分析,
      技术审计,
      keyword research,
      review this article,
      write a blog,
      backlink analysis,
      competitor analysis,
      technical audit,
      AI 可见性,
      llms.txt,
      内容写作,
      seo help,
    ]
---

# SEO/GEO 技能族路由器

本技能是 `seo-geo` 桶的族内统一分发入口（ADR 0005）：用自然语言路由到族内 8 个技能 + 2 个生成子技能，并兼任项目内安装器。与工程族 `jxx-ask-matt`（用户调用）并列——一族一路由。

> **仅项目级分发**（ADR 0005）：`x-install: project`。通过 `ship install --project` 装进具体项目后使用。

## Quick Start

- 「帮我查关键词」→ 路由到 `seo-keyword-research`
- 「审查这篇文章」→ 优先路由到已生成的 `seo-geo-audit` 子技能；未生成则路由到 `seo-audit-template`
- 「写一篇博客」→ 优先路由到已生成的 `blog-writer` 子技能；未生成则路由到 `seo-blog-template`
- 「外链分析」→ 路由到 `seo-backlink-analysis`
- 「竞品分析」→ 路由到 `seo-competitor-analysis`
- 「技术审计」→ 路由到 `seo-technical-audit`
- 「内容写作」→ 路由到 `seo-content-writing`
- 「SEO help」「GEO 怎么做」→ 路由总览，列出全家技能供选择

## 路由表

### 生成子技能（优先路由）

| 触发意图 | 已生成子技能 | 未生成时路由到 |
|----------|-------------|---------------|
| 审查内容/资讯质量/SEO 审查/GEO 审查 | `seo-geo-audit` | `seo-audit-template`（生成） |
| 写博客/写资讯/新增内容 | `blog-writer` | `seo-blog-template`（生成） |

**检测逻辑**：扫描当前项目的项目级技能目录（如 `.codebuddy/skills/`、`.codeartsdoer/skills/` 等），若存在 `seo-geo-audit/` 或 `blog-writer/`，直接路由去用；否则路由到对应模板生成。

### 五件套（独立可调用）

| 触发意图 | 路由目标 |
|----------|----------|
| 关键词研究/挖词/内容选题/keyword research | `seo-keyword-research` |
| 竞品分析/竞品对比/competitor analysis | `seo-competitor-analysis` |
| 外链分析/链接建设/backlink analysis | `seo-backlink-analysis` |
| 内容写作/SEO 写作/content writing | `seo-content-writing` |
| 技术审计/技术 SEO/llms.txt/agent readiness/technical audit | `seo-technical-audit` |

### 模板（生成器）

| 触发意图 | 路由目标 |
|----------|----------|
| 生成审查技能/配置审查/configure audit | `seo-audit-template` |
| 生成写作技能/配置写作/configure blog | `seo-blog-template` |
| 升级审查技能/升级写作技能 | 对应模板的升级模式 |

## 套件缺失引导（兼任项目内安装器）

检测到当前项目缺少 seo-geo 族技能时，引导安装（ADR 0005：进场后由 `seo-router` 兼任安装器）：

### 检测逻辑

扫描当前项目的项目级技能目录，检查是否存在：
- `seo-router/`（本技能自身）
- `seo-audit-template/`、`seo-blog-template/`（模板）
- `seo-keyword-research/`、`seo-competitor-analysis/`、`seo-backlink-analysis/`、`seo-content-writing/`、`seo-technical-audit/`（五件套）

### 引导流程

1. **检测缺失**：列出缺失的技能
2. **提示安装命令**：
   ```
   在技能仓库根目录执行：
   node <技能仓库>/base/scripts/ship.mjs install --project
   ```
   或手动复制 `seo-geo/` 桶下缺失的技能到当前项目项目级技能目录。
3. **安装后确认**：重新检测，确认套件完整
4. **路由到用户原始意图**：安装完成后，按路由表路由

### 子技能缺失引导

检测到模板已安装但子技能未生成时：
- 用户意图是审查 → 引导调用 `seo-audit-template` 生成 `seo-geo-audit`
- 用户意图是写作 → 引导调用 `seo-blog-template` 生成 `blog-writer`

## 路由决策流程

```
用户自然语言意图
  ├─ 解析意图（SEO/GEO/博客/外链/关键词/竞品/技术审计/审查/写作）
  ├─ 检测套件完整性
  │   ├─ 缺失 → 引导安装 → 安装后重新路由
  │   └─ 完整 → 继续
  ├─ 意图是审查/写作2.   │   ├─ 检测已生成子技能（seo-geo-audit / blog-writer）
  │   │   ├─ 已生成 → 路由到子技能
  │   │   └─ 未生成 → 路由到模板（生成）
  │   └─ 意图是五件套 → 路由到对应件套
  └─ 意图不明确 → 列出全家技能供选择
```

## 与 jxx-ask-matt 的关系

- `jxx-ask-matt`：工程族路由器，路由到 `jxx-*` 工程技能（用户调用）
- `seo-router`：营销族路由器，路由到 `seo-*` 营销技能（模型可调用）

两族物理分离（engineering 桶 vs seo-geo 桶），一路由一族，互不干扰。

## Skill Contract

- **Expected output**：路由到族内正确技能，或引导安装/生成
- **Reads**：当前项目项目级技能目录（检测套件与子技能）
- **Writes**：无（纯路由；安装引导时提示命令，不自动执行）
- **Done when**：用户意图被路由到正确技能，或安装/生成引导完成
- **Primary next skill**：路由目标技能

## Dependencies

- **ADR 0005**：仅项目级分发 + router 兼任安装器
- **族内 8 个技能**：`seo-audit-template`、`seo-blog-template`、`seo-keyword-research`、`seo-competitor-analysis`、`seo-backlink-analysis`、`seo-content-writing`、`seo-technical-audit`
- **生成子技能**：`seo-geo-audit`、`blog-writer`（由模板生成）
- **`ship`**：安装引导时提示 `ship install --project` 命令
