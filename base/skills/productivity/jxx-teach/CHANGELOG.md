# Changelog

## 1.1.0 — 2026-10-24

- 教学工作区补路径锚定：`./lessons/` 等工作区路径均从调用 `/jxx-teach` 时的目录解析，只有 `*-FORMAT.md` 链接从技能目录解析（上游 `ad5400b930b297b0c0cb231ff1ffe42a7da666aa`）。
- 测验规则要求不同题的正确答案位置变化，不得通过格式或顺序泄露答案；保留 `x-install: false`，并新增路径与答案位置 eval。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
