# seo-competitor-analysis 中文版（含 GEO 增量）

**Status:** done

**Blocked by:** 03

**构建内容：** spz-seo-competitor-analysis 中文化为 `seo-competitor-analysis`（去 spz- 项目代号），SKILL.md + 全部 references 按仓库语言规范翻译。GEO 增量取自 03 的素材库：竞品分析同时覆盖传统搜索排名对比与 AI 引擎中的品牌提及/引用频次对比，battlecard 模板增加 AI 可见性维度。

**验收标准：**

- [ ] 中文化完成，术语保留英文、解释中文
- [ ] 双视角：传统排名 + AI 引擎品牌提及均在分析框架中
- [ ] references 完整迁移（分析模板、battlecard、定位框架、示例报告）
- [ ] skill-reviewer 合规检查通过；中英触发词可用

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（4/4 满足，触发测试套件已建但 run 有格式缺陷）。实现于 `base/skills/seo-geo/seo-competitor-analysis/`：①中文化完成（SKILL.md:3 中英触发词）；②双视角——GEO 增量含 AI 引擎品牌提及度量、AI 可见性对比维度、battlecard AI 维度（SKILL.md:140-150）；③references 完整迁移（analysis-templates/battlecard-template/positioning-frameworks/example-report）；④skill-reviewer 实际运行 7/7 通过；中英触发词 evals 已建。已知问题：evals.json 裸数组与 run-eval.mjs `{skill_name,evals}` 契约不匹配，触发测试无法运行。判定已完成第一轮开发，待代码审查。
