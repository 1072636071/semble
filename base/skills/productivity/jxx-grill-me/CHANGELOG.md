# Changelog

## 1.1.0 — 2026-10-24

- 工作方式改为调用 `/jxx-grilling` 执行访谈，不再复制整段循环；对齐上游最新 `grill-me` 的复用原则（上游 `origin/main` = `5beb35b040e3de97e54fa9e386d7e42d15c295c2`）。
- 保留「输入」「输出」「异常处理」，输出明确决策以 markdown 留在聊天中，无状态且不写 `CONTEXT.md`；evals 同步委托语义。

## 1.0.1 — 2026-07-09

- 修正 README 标题为 `jxx-grill-me`，与 skill 名保持一致。
- 许可证文件由 `LICENSE.txt` 重命名为 `LICENSE.md`。
- SKILL.md 补全输入/输出/前置条件/异常处理/错误处理说明。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
