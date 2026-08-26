# seo-audit-template

SEO/GEO 审查模板（skill-as-generator）——追问收集项目参数，在项目级技能目录生成固定名 `seo-geo-audit` 子技能。

## 用法

在目标项目根目录下，通过 `seo-router` 路由或直接调用：

- 「生成审查技能」——首次配置：追问项目参数 → 生成 `seo-geo-audit` 子技能
- 「升级审查技能」——模板版本更新后：比对版本 → diff 确认 → 覆盖

## 生成物

生成的 `seo-geo-audit` 子技能覆盖三维度审查：真实性 + SEO/GEO + 样式一致性。

## 关联

- ADR 0005（仅项目级分发）、ADR 0006（skill-as-generator + 版本戳升级）
- 工单 03 填充 `references/`（geo-super 全量中文化素材）
- 配套写作模板：`seo-blog-template`
