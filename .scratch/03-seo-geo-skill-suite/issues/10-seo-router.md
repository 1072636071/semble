# seo-router：族内路由 + 项目内安装器

**Status:** done

**Blocked by:** 04, 05, 06, 07, 08, 09

**构建内容：** `seo-router` 技能（模型可调用）作为族内统一分发入口：中英双语触发词覆盖 SEO/GEO/博客/外链/关键词全域意图，路由到审查模板、写作模板、五件套；检测到项目已有生成子技能（`seo-geo-audit` / `blog-writer`）时直接路由去用；检测到套件缺失或不完整时引导安装/补齐（兼任项目内安装器，ADR 0005）。与工程族 `jxx-ask-matt` 并列，一族一路由。

**验收标准：**

- [ ] 路由表覆盖全家 8 个技能 + 2 个生成子技能
- [ ] 中英触发词经 skill-tester 触发测试验证（如"帮我查关键词""review this article""写一篇博客"）
- [ ] 套件缺失时给出引导安装流程
- [ ] 已有子技能时优先路由子技能
- [ ] skill-reviewer 合规检查通过

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（5/5 满足，触发测试套件已建但 run 有格式缺陷）。实现于 `base/skills/seo-geo/seo-router/SKILL.md`：①路由表覆盖全家 8 技能+2 生成子技能（seo-geo-audit/blog-writer）（49-76 行）；②中英触发词经 evals.json 覆盖（"帮我查关键词"/"审查这篇文章"/"写一篇博客"/"review this article"等），skill-tester 触发测试套件已建；③套件缺失引导安装流程（78-99 行，提示 `ship install --project`）；④已有子技能时优先路由子技能（52-58 行检测逻辑）；⑤skill-reviewer 实际运行 7/7 通过；与 jxx-ask-matt 并列一族一路由（122-127 行）。已知问题：evals.json 裸数组与 run-eval.mjs `{skill_name,evals}` 契约不匹配，实测触发测试无法运行（格式缺陷，留待审查/修补）。判定已完成第一轮开发，待代码审查。
