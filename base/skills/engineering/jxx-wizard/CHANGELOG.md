# Changelog

## 1.2.0 — 2026-11-07

- frontmatter 加 `x-install: false`，`ship install` 不再分发到任何用户级/项目级技能目录；真源留仓，要临时用就手工拷或改回 `true` 再 `ship install`。
- 12 处旧副本已手工删净：9 处用户级（`.agents`、`.codebuddy`、`.codeartsdoer`、`.qoder-cn`、`.qoderworkcn`、`.qwenworkcn`、`.trae-cn`、`.workbuddy`、`.workbuddy-ai`）+ `E:/work/sp/ai-international-trade` 主仓与 2 个 worktree 的 `docs/agents/skills/`。
- `managedPrefixes` 含 `jxx-` 前缀但源仍在仓里，残留清理不认它，故须显式删；对方三处清单也同步刷新。

## 1.1.0 — 2026-10-24

- 将 `scripts/template.sh` 完整同步为上游 `origin/main:skills/engineering/wizard/template.sh`，包含 readline、`.env` quoting、symlink、EOF、opener 与 `run_wizard` 全文件解析修复（上游 `868c4cf20cb7e08bc805c388ff1f305dbedd261a`、`49dd158d1076134a641b33efb035946536778336`）。
- 本地路径与 SKILL.md 链接保持不变，脚本英文内容不翻译、不改写。

## 1.0.0 — 2026-07-06

初始版本。
