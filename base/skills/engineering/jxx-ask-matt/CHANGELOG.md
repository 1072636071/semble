# Changelog

## 1.1.0 — 2026-10-24

- 开头新增硬规则：陈述技能行为或建议跳过步骤前必须读该技能 `SKILL.md`，路由摘要只用于定位（上游 `954ee7fd7f1911b79bfa82589b4d35ab6c4b13b8`）。
- 多会话构建新增 `/jxx-implement-spec` 整轨选项，要求先读本地技能并使用「投卡、auto 编排、统一合并回收」；主流程新增 `/jxx-pr`（Summary / Evidence / Merge Danger）与第 4 步 `/jxx-retro` 环境复盘（上游 `9781ce15f0762c2caad0cb3a31fc51796179375f`）。未移植 integration branch。
- 上下文卫生明确 retro 在所回顾会话内、clear 前运行；Bug 修复后先在同会话运行 `/jxx-retro`，再把无测试接缝的架构发现交 `/jxx-improve-codebase-architecture`（上游 `c5b98691982c4f0d3a5e40ab09566b3b84721e00`）。
- code-review 路由从旧「双轴」改为本地多维口径（标准 / spec / 可用时规则 + AC）；evals 覆盖读技能再断言、implement-spec / pr / retro 路由。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
