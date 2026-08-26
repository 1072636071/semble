# 审查模板骨架：生成/升级模式 + 三维审查模型 + 子技能骨架范式

**Status:** ready-for-agent

**Blocked by:** 01

**构建内容：** `seo-audit-template` 技能骨架可用：被调用时追问收集项目参数（项目代号、域名、语言/地区、目标搜索引擎、目标 AI 引擎、品牌口吻、行业主题域、竞品列表），在项目级技能目录生成固定名 `seo-geo-audit` 子技能——frontmatter 带 `x-template: <模板>@<版本>` + 参数快照，骨架遵循 news-review 范式（Quick Start + Skill Contract + 数据源表），内置三维度审查模型（真实性 + SEO/GEO + 样式一致性）。检测到既有子技能时进入升级模式：比对版本 → 用旧参数重新生成 → diff 展示 → 确认后覆盖。模板 frontmatter 声明版本号。references 此工单允许占位（内容在 03 填充）。

**验收标准：**

- [ ] 追问收参 → 生成子技能全流程可走通
- [ ] 生成的子技能含版本戳、参数快照、三维审查结构、`Primary next skill` 互链字段
- [ ] 升级模式：版本比对 + 旧参数重新生成 + diff 确认后覆盖
- [ ] 模板 frontmatter 含版本号
- [ ] skill-reviewer 合规检查通过；skill-tester 触发测试通过（中英触发词）

## 评论
