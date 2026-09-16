# Changelog

## 1.1.1 — 2026-09-16

修 `.scratch` 根解析写错目录：`issue-flow.mjs` 原先用 `path.join(__dirname, '..', '..', '.scratch')` 锚定，复制进技能 `scripts/`（`../../` 落到 `base/skills/engineering/`）并安装到 `~/.workbuddy/skills/<skill>/scripts/`（落到 `~/.workbuddy/skills/`）后失效，且是**静默**失效（编号回落 01、自动建目录树）。现改为 `resolveScratchRoot()`：显式 `--root` 优先，否则从 cwd 向上寻找含 `.git`/`.scratch` 的仓库；找不到直接报错退出。SKILL.md 调用示例补 `--root` 与执行位置说明；三份副本由 `base/scripts/check-copies.mjs --fix` 统一同步、并有 parity 门禁兜底。

## 1.1.0 — 2026-07-09

同步 SRC 8515a08→d574778：`to-prd` 重命名为 `to-spec`，术语从 PRD 更新为规格文档(spec)，模板标签从 `<prd-template>` 更新为 `<spec-template>`。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
