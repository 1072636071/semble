# 006-stale-doc-audit

状态：进行中

## 诉求

> 在项目的开发过程中，有些文档就过时了，但是 AI agent 可能还是会去翻阅这些文档。
> 我想弄一个机制，在我有多余的 token 的时候，去审查每个文档，这样可行么？还有没有更好的办法

核心痛点：文档会过时 → agent 读到过时文档 → 基于错误前提行动。用户提出的方案是「闲置 token 时逐文档审查」，希望验证可行性并探索更优机制。

## 追问记录

- [初始化] memorial 006-stale-doc-audit 已创建。事实调查（可自行查证部分）：
  - 本仓 agent 会读的文档面：`AGENTS.md` / `CODEBUDDY.md`（根）、`CONTEXT.md`（领域词汇）、`docs/adr/`、`docs/agents/`、`docs/memorial/`、`base/skills/**/SKILL.md` + `references/`。
  - 仓库已有「状态日期字段」门禁痕迹（TencentDB-Agent-Memory 仓 doc:lint 会校验 ADR 状态/日期），说明「文档元数据 + lint」路线在该生态已有先例。

## 决策汇总

## 待澄清

- Q1（2026-05-31 提出，待答）：审查范围与「过时」的危害模型——保哪些文档、防什么危害？候选：①只保 agent 必读面 ②全仓 markdown ③按被读频率加权。
