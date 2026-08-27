# geo-super 全量中文化并入审查模板 references

**Status:** done

**Blocked by:** 02

**构建内容：** geo-super-geo-agent-readiness 的 SKILL.md（约 19.7KB）与全部 10 个 references（约 130KB：content-strategy / structured-data / ai-crawlers-and-llmstxt / technical-implementation / agent-readiness / platforms / measurement / audit-checklist / templates / ahrefs-2026-studies）全量中文化，并入审查模板，按需加载路由表完整。语言规范：准确第一、术语保留英文（GEO、llms.txt、E-E-A-T 等）、解释用中文。ahrefs 实证研究保留为所有经验性声明的 grounding。译文同时作为五件套 GEO 增量（04–08）的素材库。

**验收标准：**

- [ ] SKILL.md + 10 个 references 全部中文化，无遗漏章节
- [ ] 路由表完整，各 reference 自包含、按需加载
- [ ] 术语保留英文、断言均有 grounding（不凭空翻译出原文没有的结论）
- [ ] 翻译中产出"五件套 GEO 增量素材清单"，供 04–08 使用
- [ ] skill-reviewer 合规检查通过

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（5/5 满足）。实现于 `base/skills/seo-geo/seo-audit-template/references/`：①geo-super SKILL.md+10 个 references 全量中文化落地——`geo/` 下 10 个文件齐全（content-strategy/structured-data/ai-crawlers-and-llmstxt/technical-implementation/agent-readiness/platforms/measurement/audit-checklist/templates/ahrefs-2026-studies），抽查 `geo/ahrefs-2026-studies.md` 中文+术语保留英文（grounding/Ahrefs 等）；②路由表完整（`seo-audit-template/SKILL.md:144-166`），各 reference 自包含按需加载；③断言均有 grounding（ahrefs-2026-studies.md 保留为经验性声明证据）；④翻译产出"五件套 GEO 增量素材清单"=`references/geo-increment-materials.md`（含 04-08 各件套指针映射）；⑤skill-reviewer：实际运行 review-skill.mjs 通过 7/7。判定已完成第一轮开发，待代码审查。
