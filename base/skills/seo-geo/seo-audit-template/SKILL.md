---
name: seo-audit-template
description: SEO/GEO 审查模板（skill-as-generator）——追问收集项目参数，在项目级技能目录生成固定名 seo-geo-audit 子技能，覆盖真实性 + SEO/GEO + 样式一致性三维度审查；检测既有子技能时进入升级模式（版本比对 → 旧参数重新生成 → diff 确认 → 覆盖）。触发词："生成审查技能"、"审查模板"、"seo audit template"、"升级审查技能"、"configure audit skill"。
x-install: project
metadata:
  version: 1.0.0
  author: seo-geo-skill-suite
  tags: [seo, geo, audit, template, generator, skill-as-generator]
  triggers:
    [
      生成审查技能,
      审查模板,
      seo audit template,
      升级审查技能,
      configure audit skill,
      生成 seo-geo-audit,
    ]
---

# SEO/GEO 审查模板（skill-as-generator）

本技能是**模板**（生成器，ADR 0006）：被调用时追问收集项目参数，在当前项目的项目级技能目录生成固定名 `seo-geo-audit` 子技能。生成的子技能才是实际审查工具；本模板仅负责生成与升级。

> **仅项目级分发**（ADR 0005）：`x-install: project`，不装进用户级目录。通过 `ship install --project` 装进具体项目后使用。

## Quick Start

- 「生成审查技能」——首次配置：追问项目参数 → 生成 `seo-geo-audit` 子技能
- 「升级审查技能」——模板版本更新后：比对版本 → 用旧参数重新生成 → diff 确认 → 覆盖
- 「configure audit skill」——英文触发同样可用

## Skill Contract（模板契约）

- **Expected output**：在当前项目的项目级技能目录（如 `.codebuddy/skills/seo-geo-audit/`）生成固定名子技能 `seo-geo-audit`，含 `SKILL.md` + `references/`
- **Reads**：本模板自身 `references/`（geo-super 全量中文化素材，工单 03 填充）；既有子技能的 frontmatter（升级模式时读 `x-template` 版本戳与参数快照）
- **Writes**：当前项目 `.codebuddy/skills/seo-geo-audit/SKILL.md` 及 `references/`（固定名，不带项目代号前缀）
- **Done when**：子技能生成完成，frontmatter 含 `x-template: seo-audit-template@<版本>` + 参数快照 + 三维审查结构 + `Primary next skill` 互链字段
- **Primary next skill**：`seo-geo-audit`（生成后立即可用）；`seo-blog-template`（配套写作模板）

## 生成参数清单（追问项）

被调用时，**逐项追问**收集以下参数（未提供则追问，已提供则确认后跳过）：

| 参数 | 说明 | 示例 |
|------|------|------|
| 项目代号 | 项目在仓库中的标识符（slug） | `official-domestic-website` |
| 域名 | 站点主域名 | `example.com` |
| 语言/地区 | 内容语言与目标地区 | `zh-CN` / `en-US` / `zh-CN, en-US` |
| 目标搜索引擎 | 传统搜索目标 | `Baidu, Google, Bing` |
| 目标 AI 引擎 | GEO 目标 | `ChatGPT, Perplexity, 豆包, DeepSeek` |
| 品牌口吻 | 内容风格基调 | `专业严谨` / `亲和易懂` / `技术深度` |
| 行业主题域 | 业务领域关键词域 | `化工助剂, 塑料添加剂, DOTP` |
| 竞品列表 | 主要竞品域名或品牌 | `competitor-a.com, competitor-b.com` |
| 内容集合路径 | 待审查内容的 Markdown 集合 glob | `src/content/news/**/*.md` |
| 数据源路径表 | 真实性审查需交叉校验的数据文件 | `src/content/products.json` 等 |

追问完成后，**将参数快照写入生成子技能的 frontmatter**（`x-template-params`），升级时复用。

## 子技能骨架范式（生成的 seo-geo-audit 结构）

生成的 `seo-geo-audit/SKILL.md` 遵循 news-review 范式：

```markdown
---
name: seo-geo-audit
description: 审查 {项目代号} 内容质量，覆盖真实性 + SEO/GEO + 样式一致性三维度。触发词：{中英双语}。
x-template: seo-audit-template@1.0.0
x-template-params:
  project: {项目代号}
  domain: {域名}
  lang: {语言/地区}
  search-engines: [{目标搜索引擎}]
  ai-engines: [{目标AI引擎}]
  voice: {品牌口吻}
  topic-domain: {行业主题域}
  competitors: [{竞品列表}]
  content-glob: {内容集合路径}
  data-sources: [{数据源路径表}]
metadata:
  version: 1.0.0
  generated-from: seo-audit-template@1.0.0
  generated-at: {ISO 日期}
---

# SEO/GEO 审查 — {项目代号}

## Quick Start
## Skill Contract
  - Expected output / Reads / Writes / Done when / Primary next skill
## Data Sources（真实路径表，由参数快照填充）
## Instructions
  ### Step 0：确认审查范围
  ### Step 1：读取内容数据
  ### Step 2：真实性审查（references/authenticity-checklist.md）
  ### Step 3：SEO/GEO 审查（references/seo-geo-checklist.md）
  ### Step 4：样式一致性审查（references/style-consistency-checklist.md）
  ### Step 5：计算评分
  ### Step 6：输出结构化报告
## Dependencies / Error Handling / Decision Gates
```

`Primary next skill` 互链：`seo-geo-audit` → `blog-writer`（写作模板生成的子技能）→ 五件套（`seo-keyword-research` 等）。

## 三维审查模型（骨架）

### 维度一：真实性

- 数据准确性：与项目数据源交叉校验
- E-E-A-T：品牌权威性、资质、可验证数据引用
- 引用与来源：外部数据/法规引用准确
- 信息一致性：跨数据源一致

> 详细 checklist 见 `references/authenticity-checklist.md`（工单 03 填充，源自 geo-super 中文化素材）。

### 维度二：SEO/GEO

- **SEO**（传统搜索）：title/description 长度与关键词、关键词布局、内容结构、内部链接、结构化数据（JSON-LD）
- **GEO**（AI 引擎可见性）：清晰定义、数据表格、问答型内容、实体清晰度、段落级可抽取性、llms.txt / agent readiness

> 详细 checklist 见 `references/seo-geo-checklist.md`（工单 03 填充，含 geo-super 全量中文化的 10 个 references 路由表）。

### 维度三：样式一致性

- 设计令牌一致性（CSS 变量，禁止硬编码颜色）
- Markdown 语义（标题层级、列表、表格、引用）
- 图片规范（alt、格式、路径）
- 组件样式（与设计系统一致）

> 详细 checklist 见 `references/style-consistency-checklist.md`（工单 03 填充）。**与写作模板（`seo-blog-template`）共用同一样式基准**——写审一致，不打架。

## 升级模式

检测到项目内已存在 `seo-geo-audit` 子技能时，进入升级模式：

1. **读取既有子技能 frontmatter**：取 `x-template: seo-audit-template@<旧版本>` 与 `x-template-params`（参数快照）
2. **比对版本**：若 `<旧版本>` === 当前模板版本，提示"已是最新，无需升级"并退出
3. **用旧参数重新生成**：以 `x-template-params` 为输入，用当前模板重新生成新版本子技能内容
4. **diff 展示**：逐文件 diff 既有子技能 vs 新生成内容，突出变更
5. **用户确认后覆盖**：逐 hunk 确认（避免手工微调被无声吞掉）；用户拒绝的 hunk 保留旧内容
6. **更新版本戳**：覆盖后 frontmatter 的 `x-template` 版本号更新为当前模板版本

> **风险兜底**（ADR 0006）：升级覆盖依赖 diff 确认，防手工微调丢失。用户可随时拒绝覆盖。

## references 路由表

本模板的 `references/` 目录已由工单 03 填充 geo-super 全量中文化素材：

| reference | 来源 | 用途 |
|-----------|------|------|
| `authenticity-checklist.md` | news-review 泛化 | 真实性审查 checklist（通用模板） |
| `seo-geo-checklist.md` | news-review + geo-super 中文化 | SEO/GEO 双视角 checklist |
| `style-consistency-checklist.md` | news-review 泛化 | 样式一致性 checklist（与写作模板共用基准） |
| `geo-super-overview.md` | geo-super SKILL.md 中文化 | GEO 总览（GEO vs SEO vs AEO vs Agent Readiness） |
| `geo-increment-materials.md` | 本工单产出 | 五件套 GEO 增量素材清单（供 04–08 指针引用） |
| `geo/content-strategy.md` | geo-super | 内容策略四支柱 + 三层仲裁模型 |
| `geo/structured-data.md` | geo-super | 结构化数据（JSON-LD） |
| `geo/ai-crawlers-and-llmstxt.md` | geo-super | AI 爬虫与 llms.txt |
| `geo/technical-implementation.md` | geo-super | 技术实现 + FAST 框架 |
| `geo/agent-readiness.md` | geo-super | Agent readiness（MCP/OAuth/agentic commerce） |
| `geo/platforms.md` | geo-super | AI 引擎平台特性 |
| `geo/measurement.md` | geo-super | GEO 度量指标 + 基准 |
| `geo/audit-checklist.md` | geo-super | GEO 审计 checklist（Section A-F） |
| `geo/templates.md` | geo-super | 模板（内容/技术/平台/agent） |
| `geo/ahrefs-2026-studies.md` | geo-super | ahrefs 2026 实证研究（grounding） |

生成子技能时，按需复制对应 references（不全量复制，子技能内部用路由表按需加载）。各 reference 自包含，按需加载。

## 生成流程总结

```
被调用
  ├─ 检测项目内是否已有 seo-geo-audit
  │   ├─ 无 → 首次生成模式：追问收参 → 生成子技能 → 写版本戳与参数快照
  │   └─ 有 → 升级模式：读旧版本与参数 → 比对版本 → 旧参数重新生成 → diff 确认 → 覆盖
  └─ 输出：子技能路径 + 可用触发词 + Primary next skill 提示
```

## Dependencies

- **ADR 0006**：skill-as-generator + 版本戳升级模式
- **ADR 0005**：仅项目级分发
- **工单 03**：references 内容填充（geo-super 全量中文化）
- **`seo-blog-template`**：配套写作模板，共用样式基准
- **`skill-reviewer` / `skill-tester`**：入库门禁
