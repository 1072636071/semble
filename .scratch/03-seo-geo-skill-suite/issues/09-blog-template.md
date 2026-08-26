# 写作模板 seo-blog-template：news-x 抽象 + 样式模板

**Status:** ready-for-agent

**Blocked by:** 02, 07

**构建内容：** `seo-blog-template` 技能：复用 02 建立的生成/升级范式（追问收参 → 生成固定名 `blog-writer` 子技能 → 版本戳升级）。内容来源：news-x 的项目知识（内容集合架构事实、frontmatter 契约、分类枚举、渲染约定、缩略图映射）抽象为生成参数与追问项；spz-seo-content-writing 的中文产物（07）作为 references；news-review 的真实性/风格 checklist 归入写作侧自检。**样式模板内置，与审查子技能的样式一致性检查共用同一基准**（写审一致）。子技能以 `Primary next skill` 与审查子技能、五件套互链。

**验收标准：**

- [ ] 生成 `blog-writer` 子技能全流程走通（含版本戳、参数快照、升级模式）
- [ ] 追问项能收集到 news-x 级项目知识（架构事实、分类枚举、渲染约定、图片映射）
- [ ] 样式模板与审查侧样式 checklist 同源
- [ ] 中英触发词；skill-reviewer 合规检查通过；skill-tester 触发测试通过

## 评论
