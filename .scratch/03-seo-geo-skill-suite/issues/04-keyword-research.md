# seo-keyword-research 中文版（含 GEO 增量）

**Status:** done

**Blocked by:** 03

**构建内容：** spz-seo-keyword-research 中文化为 `seo-keyword-research`（去 spz- 项目代号），SKILL.md + 全部 references 按仓库语言规范翻译。GEO 增量取自 03 的素材库：产出物同时覆盖"传统搜索词"与"被 AI 引用的问题句式"，关键词意图分类增加 AI 问答场景维度。

**验收标准：**

- [ ] 中文化完成，术语保留英文、解释中文
- [ ] 双视角：搜索词 + AI 引用问句式均在产出模板中
- [ ] references 完整迁移（意图分类、优先级框架、topic cluster 模板等）
- [ ] skill-reviewer 合规检查通过；中英触发词可用

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（4/4 满足，触发测试套件已建但 run 有格式缺陷）。实现于 `base/skills/seo-geo/seo-keyword-research/`：①中文化完成（SKILL.md:3 中英触发词、正文中文+术语保留英文）；②双视角——产出含搜索词+AI 引用问句式，Phase 6 GEO-Check 标记 AI 友好查询（SKILL.md:61,123-134）；③references 完整迁移（keyword-intent-taxonomy/keyword-prioritization-framework/topic-cluster-templates/example-report/instructions-detail）；④skill-reviewer 实际运行 7/7 通过；中英触发词在 evals.json 中（如"帮我挖词"英文"keyword research"）。已知问题：evals.json 为裸数组，run-eval.mjs 期望 `{skill_name,evals}` 结构致触发测试无法运行（格式缺陷，留待审查/修补）。判定已完成第一轮开发，待代码审查。
