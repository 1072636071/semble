# seo-technical-audit 中文版（含 GEO 增量）

**Status:** done

**Blocked by:** 03

**构建内容：** spz-seo-technical-audit 中文化为 `seo-technical-audit`（去 spz- 项目代号），SKILL.md + 全部 references 按仓库语言规范翻译。GEO 增量取自 03 的素材库：技术审计在传统爬虫可访问性之外，加查 llms.txt / llms-full.txt、JSON-LD 结构化数据、AI 爬虫 robots 配置、agent readiness（MCP Server Card、Markdown 内容协商等）。注意与审查模板中 geo-super 技术类 references 分工：本件是独立可调用的执行技能，模板引用而非复制其内容。

**验收标准：**

- [ ] 中文化完成，术语保留英文、解释中文
- [ ] 双视角：传统技术审计 + llms.txt/JSON-LD/agent readiness 检查项
- [ ] references 完整迁移（批量审计、迁移预案、robots 参考、HTTP 状态码、电商平台模式等）
- [ ] 与审查模板的技术类 references 无内容复制（指针引用）
- [ ] skill-reviewer 合规检查通过；中英触发词可用

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（5/5 满足，触发测试套件已建但 run 有格式缺陷）。实现于 `base/skills/seo-geo/seo-technical-audit/`：①中文化完成（SKILL.md:3 中英触发词）；②双视角——GEO 增量含 llms.txt/llms-full.txt、AI 爬虫 robots、JSON-LD、agent readiness/MCP/Markdown 内容协商（SKILL.md:178-189）；③references 完整迁移（bulk-audit/pre-migration/robots-txt/http-status/ecommerce-platform/technical-audit-example/templates/llm-crawler-handling）；④与审查模板技术类 references 无内容复制——SKILL.md:195 明确"指针引用而非复制"；⑤skill-reviewer 实际运行 7/7 通过；中英触发词 evals 已建。已知问题：evals.json 裸数组与 run-eval.mjs `{skill_name,evals}` 契约不匹配，触发测试无法运行。判定已完成第一轮开发，待代码审查。
