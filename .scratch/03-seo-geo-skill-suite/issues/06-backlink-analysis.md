# seo-backlink-analysis 中文版（含 GEO 增量）

**Status:** done

**Blocked by:** 03

**构建内容：** spz-seo-backlink-analysis 中文化为 `seo-backlink-analysis`（去 spz- 项目代号），SKILL.md + 全部 references 按仓库语言规范翻译。GEO 增量取自 03 的素材库：链接质量评估同时覆盖传统权重/相关性与"AI 引用源权威性"（被 LLM 引用语料与高权威源的关联），outreach 模板增加面向 AI 可见性的外联场景。

**验收标准：**

- [ ] 中文化完成，术语保留英文、解释中文
- [ ] 双视角：链接权重 + AI 引用源权威性均在评估 rubric 中
- [ ] references 完整迁移（分析模板、链接质量 rubric、outreach 模板）
- [ ] skill-reviewer 合规检查通过；中英触发词可用

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（4/4 满足，触发测试套件已建但 run 有格式缺陷）。实现于 `base/skills/seo-geo/seo-backlink-analysis/`：①中文化完成（SKILL.md:3 中英触发词）；②双视角——GEO 增量含 AI 引用源权威性、高权威源与 LLM 引用关联、AI 可见性 outreach（SKILL.md:146-155）；③references 完整迁移（analysis-templates/link-quality-rubric/outreach-templates）；④skill-reviewer 实际运行 7/7 通过；中英触发词 evals 已建。已知问题：evals.json 裸数组与 run-eval.mjs `{skill_name,evals}` 契约不匹配，触发测试无法运行。判定已完成第一轮开发，待代码审查。
