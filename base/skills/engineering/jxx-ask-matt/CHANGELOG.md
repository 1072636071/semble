# Changelog

## 1.3.0 — 2026-11-07

- 新增「不常用技能：读索引，不去环境里找」节与自动生成的 [references/not-installed-skills.md](references/not-installed-skills.md)：用户只保留常用 jxx 技能时，未装的技能（当前 22 个）仍可经路由器找到——索引给出真源路径，agent 按需 `read` 仓内全文，不去 skills 目录找同名技能。
- 索引由 `base/scripts/ask-matt-index.mjs` 从源状态（`x-install: false` / `x-inline: true` / 未分发桶）生成；卸载/新增/改 description 后重跑一次，`ship check` 以 `E_ASK_MATT_INDEX` 挡住过期索引。
- 独立技能节里 4 个已不装进环境的条目（to-questionnaire / wizard / teach / wait-what）补「读索引取真源」口径。

## 1.2.0 — 2026-11-07

- 开头补内联源口径：`jxx-grilling` / `jxx-grill-me` 不再是独立技能，正文在引用技能的内联段；本路由器作为例外不注入。改真源后重跑 `ship install` + `check` 过 `E_INLINE_STALE`。

## 1.1.0 — 2026-10-24

- 开头新增硬规则：陈述技能行为或建议跳过步骤前必须读该技能 `SKILL.md`，路由摘要只用于定位（上游 `954ee7fd7f1911b79bfa82589b4d35ab6c4b13b8`）。
- 多会话构建新增 `/jxx-implement-spec` 整轨选项，要求先读本地技能并使用「投卡、auto 编排、统一合并回收」；主流程新增 `/jxx-pr`（Summary / Evidence / Merge Danger）与第 4 步 `/jxx-retro` 环境复盘（上游 `9781ce15f0762c2caad0cb3a31fc51796179375f`）。未移植 integration branch。
- 上下文卫生明确 retro 在所回顾会话内、clear 前运行；Bug 修复后先在同会话运行 `/jxx-retro`，再把无测试接缝的架构发现交 `/jxx-improve-codebase-architecture`（上游 `c5b98691982c4f0d3a5e40ab09566b3b84721e00`）。
- code-review 路由从旧「双轴」改为本地多维口径（标准 / spec / 可用时规则 + AC）；evals 覆盖读技能再断言、implement-spec / pr / retro 路由。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
