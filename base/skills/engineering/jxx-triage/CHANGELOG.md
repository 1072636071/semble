# Changelog

## 1.3.0 — 2026-10-27

**AGENT-BRIEF 补「缺的那一项要写死」一节**：Desired behavior 与 AC 落笔前过四问（谁执行 / 对什么做 / 什么时候做 / 例外是什么），答不出的写进 Out of scope 或 Open questions 并标「待确认」。起因：简报是 AFK agent 的唯一契约，含糊项会被它自己编一个默认答案填空且不报错；外部实证里「关键信息缺失」是最高频的指令缺陷。

## 1.2.0 — 2026-10-23

**「应用结果」的服务器对齐改指 ticket-flow 写腿**：项目内有 `tools/ticket-flow.mjs` 且 issue 在 `.scratch/<NN>-<slug>/issues/` 下时，triage 结果（状态 / 标签 / triage 备注）用一条写腿完成「改本地 md + 推服务器」——`--set status=… [--set labels=a,b] --comment "…"`，不再手改本地再 `jxx_ticket_call update`；exit 0 / 2 / 3 三态判读（exit 3 时本地已还原或未变）。新建 issue 仍走 `create`（写腿不 create）；项目无该 CLI 时回退 MCP 双写，离线降级 + 回连 `sync` 口径不变。

## 1.1.0 — 2026-10-15

「应用结果」步骤新增「服务器对齐」：项目已接入服务器工单时，triage 结果（状态/标签/简报评论）在写本地 issue 文件的同一步内双写服务器（乐观锁）；离线降级 + 回连 `sync` 收口。

## 1.0.0 — 2026-07-06

初始版本。
