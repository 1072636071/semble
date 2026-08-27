---
name: seo-blog-template
description: SEO/GEO 写作模板（skill-as-generator）——追问收集项目内容架构知识（内容集合、frontmatter 契约、分类枚举、渲染约定、缩略图映射、设计令牌），在项目级技能目录生成固定名 blog-writer 子技能，内置样式模板与写作/自检 checklist；检测既有子技能时进入升级模式。触发词："生成写作技能"、"写作模板"、"blog template"、"升级写作技能"、"configure blog writer"。
x-install: project
metadata:
  version: 1.0.0
  author: seo-geo-skill-suite
  tags: [seo, geo, blog, writing, template, generator, skill-as-generator]
  triggers:
    [
      生成写作技能,
      写作模板,
      blog template,
      升级写作技能,
      configure blog writer,
      生成 blog-writer,
    ]
---

# SEO/GEO 写作模板（skill-as-generator）

本技能是**模板**（生成器，ADR 0006）：被调用时追问收集项目内容架构知识，在当前项目的项目级技能目录生成固定名 `blog-writer` 子技能。生成的子技能才是实际写作工具；本模板仅负责生成与升级。

> **仅项目级分发**（ADR 0005）：`x-install: project`。通过 `ship install --project` 装进具体项目后使用。

## Quick Start

- 「生成写作技能」——首次配置：追问项目内容架构 → 生成 `blog-writer` 子技能
- 「升级写作技能」——模板版本更新后：比对版本 → 用旧参数重新生成 → diff 确认 → 覆盖
- 「configure blog writer」——英文触发同样可用

## Skill Contract（模板契约）

- **Expected output**：在当前项目的项目级技能目录（如 `.codebuddy/skills/blog-writer/`）生成固定名子技能 `blog-writer`，含 `SKILL.md` + `references/`
- **Reads**：本模板自身 `references/`（样式模板 + 写作 checklist）；`seo-content-writing`（五件套的中文产物，作为 references 来源）；既有子技能 frontmatter（升级模式时读 `x-template` 版本戳与参数快照）
- **Writes**：当前项目 `.codebuddy/skills/blog-writer/SKILL.md` 及 `references/`
- **Done when**：子技能生成完成，frontmatter 含 `x-template: seo-blog-template@<版本>` + 参数快照 + 架构事实表 + Frontmatter 契约 + 样式模板 + 自检 checklist + `Primary next skill` 互链字段
- **Primary next skill**：`blog-writer`（生成后立即可用）；`seo-geo-audit`（配套审查子技能）

## 生成参数清单（追问项）

被调用时，**逐项追问**收集项目内容架构知识（源自 news-x 抽象——生成物不得比 news-x 手工版"笨"）：

| 参数 | 说明 | 示例 |
|------|------|------|
| 项目代号 | 项目标识符 | `official-domestic-website` |
| 内容集合路径 | 待写内容的 Markdown 集合 glob | `src/content/news/**/*.md` |
| 内容分类枚举 | 分类列表及含义 | `company 企业新闻 / industry 行业动态 / announcement 公司公告` |
| slug 规则 | slug 命名规则与 URL 推导 | `英文 kebab-case，URL /news/{category}/{slug}/` |
| Frontmatter 契约 | 必填/可选字段定义 | `title, date, category, summary 必填；docType/format/attachment 仅 announcement` |
| 详情页渲染约定 | 正文渲染机制 | `prose-body scoped style 自动套用，作者只写语义 Markdown` |
| SEO 约定 | title/description 生成规则 | `title=frontmatter title，description=summary，无独立 seoTitle` |
| 缩略图映射 | 列表缩略图机制 | `thumbs.ts 键 {category}/{slug} → images-blog.json 图键` |
| 图片规范 | 图片路径/格式/alt 要求 | `public/images/，WebP，alt 必填描述性` |
| 设计系统令牌 | 设计令牌表 | `--seed-primary #2e8b57 等` |
| 站点语言 | locale 与单/多语 | `zh-CN 单语` |
| 品牌口吻 | 内容风格基调 | `专业严谨` |

追问完成后，**将参数快照写入生成子技能的 frontmatter**（`x-template-params`），升级时复用。

## 子技能骨架范式（生成的 blog-writer 结构）

生成的 `blog-writer/SKILL.md` 遵循 news-x 范式（架构事实表 + Frontmatter 契约 + 工作流）：

```markdown
---
name: blog-writer
description: 为 {项目代号} 撰写 {内容类型}，遵循项目 frontmatter 契约与样式规范。触发词：{中英双语}。
x-template: seo-blog-template@1.0.0
x-template-params:
  project: {项目代号}
  content-glob: {内容集合路径}
  categories: [{分类枚举}]
  slug-rule: {slug 规则}
  frontmatter-schema: {Frontmatter 契约}
  render-convention: {渲染约定}
  seo-convention: {SEO 约定}
  thumbs-mechanism: {缩略图映射}
  image-spec: {图片规范}
  design-tokens: {设计系统令牌}
  locale: {站点语言}
  voice: {品牌口吻}
metadata:
  version: 1.0.0
  generated-from: seo-blog-template@1.0.0
  generated-at: {ISO 日期}
---

# Blog Writer — {项目代号}

## 架构事实（唯一权威，先读后写）
  （由参数快照填充的架构事实表）

## Frontmatter 契约
  （由参数快照填充的字段定义）

## Markdown 正文样式约定（prose-body 已自动处理，勿手写样式）
  （由参数快照填充的渲染约定）

## 工作流
  ### Phase 1 — 收集信息（追问 title/slug/category/summary/date/正文）
  ### Phase 2 — 写作（SEO/GEO 双视角，过 GEO 可引用性 checklist）
  ### Phase 3 — 自检（真实性 + 样式一致性 checklist）

## 样式模板（内置）
  （与审查子技能共用同一基准）

## 自检 Checklist
  ### 真实性自检（归入写作侧，源自 news-review）
  ### 样式一致性自检（与 seo-geo-audit 同源）
  ### GEO 可引用性自检（源自 seo-content-writing）
```

`Primary next skill` 互链：`blog-writer` → `seo-geo-audit`（审查子技能）→ 五件套（`seo-keyword-research` 等）。

## 样式模板（内置，与审查共用基准）

本模板内置样式模板，**与 `seo-audit-template` 的 `style-consistency-checklist.md` 共用同一基准**——写审一致，不打架：

- 设计令牌一致性（CSS 变量，禁止硬编码颜色）
- Markdown 语义（标题层级、列表、表格、引用）
- 图片规范（alt、格式、路径）
- prose-body 渲染约定（作者只写语义 Markdown，不写 CSS/类名/颜色）

> 详细样式 checklist 见 `references/style-template.md`（与 `seo-audit-template/references/style-consistency-checklist.md` 同源）。

## references 来源

| reference | 来源 | 用途 |
|-----------|------|------|
| `style-template.md` | seo-audit-template 同源 | 样式模板（写审共享基准） |
| `writing-checklist.md` | seo-content-writing 中文产物 | 写作 checklist（SEO + GEO 可引用性） |
| `authenticity-self-check.md` | news-review 真实性 checklist 归入写作侧 | 真实性自检 |
| `geo-quotability-checklist.md` | seo-content-writing GEO 增量 | GEO 可引用性 checklist（quotability/E-E-A-T/entity clarity/chunkability） |
| `title-formulas.md` | seo-content-writing 标题公式 | 标题公式与 AI 引用友好变体 |
| `structure-templates.md` | seo-content-writing 结构模板 | 内容结构模板 |

生成子技能时，从 `seo-content-writing`（五件套，工单 07）的 references 复制对应文件，加上本模板的 `style-template.md`。

## 升级模式

检测到项目内已存在 `blog-writer` 子技能时，进入升级模式（与 `seo-audit-template` 同范式）：

1. **读取既有子技能 frontmatter**：取 `x-template: seo-blog-template@<旧版本>` 与 `x-template-params`
2. **比对版本**：若 `<旧版本>` === 当前模板版本，提示"已是最新"并退出
3. **用旧参数重新生成**：以 `x-template-params` 为输入，用当前模板重新生成
4. **diff 展示**：逐文件 diff，突出变更
5. **用户确认后覆盖**：逐 hunk 确认（防手工微调丢失）
6. **更新版本戳**

## 生成流程总结

```
被调用
  ├─ 检测项目内是否已有 blog-writer
  │   ├─ 无 → 首次生成模式：追问收参 → 生成子技能 → 写版本戳与参数快照
  │   └─ 有 → 升级模式：读旧版本与参数 → 比对版本 → 旧参数重新生成 → diff 确认 → 覆盖
  └─ 输出：子技能路径 + 可用触发词 + Primary next skill 提示
```

## Dependencies

- **ADR 0006**：skill-as-generator + 版本戳升级模式
- **ADR 0005**：仅项目级分发
- **`seo-audit-template`**：配套审查模板，共用样式基准
- **`seo-content-writing`**（五件套，工单 07）：references 来源
- **news-x**：项目知识抽象参照（架构事实表、Frontmatter 契约、工作流）
- **news-review**：真实性/风格 checklist 归入写作侧自检
- **`skill-reviewer` / `skill-tester`**：入库门禁
