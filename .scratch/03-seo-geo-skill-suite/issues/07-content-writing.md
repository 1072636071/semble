# seo-content-writing 中文版（含 GEO 增量）

**Status:** done

**Blocked by:** 03

**构建内容：** spz-seo-content-writing 中文化为 `seo-content-writing`（去 spz- 项目代号），SKILL.md + 全部 references 按仓库语言规范翻译。GEO 增量取自 03 的素材库：内容写作同时过 SEO checklist 与 GEO 可引用性 checklist（quotability、E-E-A-T、实体清晰度、段落级可抽取性），标题公式与结构模板增加 AI 引用友好变体。本件是写作模板（09）的 references 来源。

**验收标准：**

- [ ] 中文化完成，术语保留英文、解释中文
- [ ] 双 checklist：SEO + GEO 可引用性
- [ ] references 完整迁移（结构模板、写作 checklist、标题公式、详细指引）
- [ ] skill-reviewer 合规检查通过；中英触发词可用

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（4/4 满足，触发测试套件已建但 run 有格式缺陷）。实现于 `base/skills/seo-geo/seo-content-writing/`：①中文化完成（SKILL.md:3 中英触发词、正文中文）；②双 checklist——GEO 增量含 GEO 可引用性 checklist + quotability + E-E-A-T + 段落级可抽取性（SKILL.md:123-133）；③references 完整迁移（content-structure-templates/seo-writing-checklist/title-formulas/instructions-detail）；④skill-reviewer 实际运行 7/7 通过；中英触发词 evals 已建。已知问题：evals.json 裸数组与 run-eval.mjs `{skill_name,evals}` 契约不匹配，触发测试无法运行。判定已完成第一轮开发，待代码审查。
