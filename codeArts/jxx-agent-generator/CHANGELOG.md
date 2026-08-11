# Changelog

## 2.0.0 — 2026-08-11

- **重大改造**：从"姜姓身份 + CodeBuddy frontmatter"迁移到"OpenCode/Crush SKILL.md 风格"。
- frontmatter 简化：去掉 `tools`/`agentMode`/`enabled`/`enabledAutoRun`，改为 `name`/`description` + 可选 `user-invocable`/`disable-model-invocation`。
- 去掉人格化身份设定（"你姓姜，名叫姜X，扮演Y"），改为功能性开场（"X does Y"）。
- 命名从 `姜某-角色名` 改为 kebab-case（如 `code-explorer`、`standard-reviewer`）。
- 产物位置从 `~/.codebuddy/agents/<名字>.md` 改为 `<skills-dir>/<name>/SKILL.md`。
- 9 个范例 agent 全部重写为 OpenCode 风格。
- 新增从 CodeBuddy 风格迁移的规则。

## 1.0.0 — 2026-07-06

初始版本，姜姓 agent 生成器。
