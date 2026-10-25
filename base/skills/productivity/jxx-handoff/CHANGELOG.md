# Changelog

## 1.1.0 — 2026-10-24

- 首段补临时目录确定性解析与交付路径：Unix `$TMPDIR` 缺省 `/tmp`，Windows `%TEMP%`（PowerShell 可用 `$env:TEMP`）；不写当前工作区，写完报告文件绝对路径（上游 `4f4e9433bbb7c4957ef33b1ea26686fb7c2a4cf4`）。
- 新增 Windows 临时目录与绝对路径回报的 eval。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
