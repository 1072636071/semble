# Changelog

## 1.1.0 — 2026-10-24

- 阶段 5「看它失败」补充强制变异验证：若通过改代码或 fixture 制造 red，必须先与 pristine copy 做 `diff`，确认变异落地后再信任 red（上游 `f3fc5632f401156837ee3872f14fe33ccf1024ea`）。
- 阶段 6 改为「清理」，删除 post-mortem 段；修复后的 `/jxx-retro` 与缺测试接缝的架构路由由 `/jxx-ask-matt` 承担（上游 `1dab98299c3b81f560026c01b7ebf55ed5d91373`、`c5b98691982c4f0d3a5e40ab09566b3b84721e00`）。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
