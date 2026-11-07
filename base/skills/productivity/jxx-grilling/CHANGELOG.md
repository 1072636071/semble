# Changelog

## 1.3.0 — 2026-11-07

- frontmatter 加 `x-inline: true`：不再单独安装，正文由 `ship install` 内联进引用它的技能（`jxx-grill-me` 一并注入，见 `vendors.json` 的 `inlineBundles`）。
- 改本文件正文后必须重跑 `node base/scripts/ship.mjs install`，再 `check` 过 `E_INLINE_STALE` 门禁；真源仍是本仓这份。

## 1.2.0 — 2026-10-24

- 保留 frontier 轮次机制，问题格式改为一轮内 `Q1` / `Q2` 示例，两题之间用 `---` 分隔（上游 `85f83d3fde1d3a90d5c9a657f6998c79a6c37308`）。
- 新增硬规则：每道题的措辞必须让「是/yes」表示接受推荐答案（上游 `95249b0b49782349740fd9b8c6ce32b4e59e497a`）。
- evals 修正旧「逐个提问」预期，并覆盖 yes=接受推荐与 HR 分隔。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
