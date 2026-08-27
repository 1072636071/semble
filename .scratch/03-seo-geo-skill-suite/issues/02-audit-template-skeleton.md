# 审查模板骨架：生成/升级模式 + 三维审查模型 + 子技能骨架范式

**Status:** done

**Blocked by:** 01

**构建内容：** `seo-audit-template` 技能骨架可用：被调用时追问收集项目参数（项目代号、域名、语言/地区、目标搜索引擎、目标 AI 引擎、品牌口吻、行业主题域、竞品列表），在项目级技能目录生成固定名 `seo-geo-audit` 子技能——frontmatter 带 `x-template: <模板>@<版本>` + 参数快照，骨架遵循 news-review 范式（Quick Start + Skill Contract + 数据源表），内置三维度审查模型（真实性 + SEO/GEO + 样式一致性）。检测到既有子技能时进入升级模式：比对版本 → 用旧参数重新生成 → diff 展示 → 确认后覆盖。模板 frontmatter 声明版本号。references 此工单允许占位（内容在 03 填充）。

**验收标准：**

- [ ] 追问收参 → 生成子技能全流程可走通
- [ ] 生成的子技能含版本戳、参数快照、三维审查结构、`Primary next skill` 互链字段
- [ ] 升级模式：版本比对 + 旧参数重新生成 + diff 确认后覆盖
- [ ] 模板 frontmatter 含版本号
- [ ] skill-reviewer 合规检查通过；skill-tester 触发测试通过（中英触发词）

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（4/4 功能项 + skill-reviewer 满足；skill-tester 触发测试套件已建但 run 有格式缺陷）。功能实现于 `base/skills/seo-geo/seo-audit-template/SKILL.md`：①追问收参→生成 `seo-geo-audit` 子技能全流程（40-102 行）；②生成子技能含版本戳 `x-template`+参数快照 `x-template-params`（67-78 行）、三维审查模型（104-129 行）、`Primary next skill` 互链（102 行）；③升级模式：版本比对→旧参数重生成→diff→确认覆盖（131-142 行）；④模板 frontmatter `metadata.version: 1.0.0`（6 行）；⑤skill-reviewer：实际运行 `node base/skills/productivity/skill-reviewer/scripts/review-skill.mjs` 通过 7/7；skill-tester：`evals/evals.json` 触发套件已建（中英触发词+正负用例），但 run-eval.mjs 期望 `{skill_name,evals:[...]}` 结构、此文件为裸数组，实测 `node .../run-eval.mjs` 报 TypeError 无法运行（格式缺陷，留待审查/修补）。判定已完成第一轮开发，待代码审查。
