# ADR-010：服务器优先的工单真源与项目工作区 bootstrap

- 状态：已接受（2026-10-01 · 用户指令：「让 jxx 系列技能默认操作服务器上的工单，如果未来的项目线上没有这个工作目录，就先创建，然后进行操作」）
- 关联：ADR-002（control 外置/嵌套 git）、ADR-009（in-project 布局与 PRD 分支合并流）；本仓 PRD 75（jxx-ticket 服务器工单系统）、PRD 87（repo_key 全链路 + 首批上行）
- 说明：本 ADR 属 **jxx-ticket-board 技能系列**（`references/ADR-00N`），与权威仓 `docs/adr/` 的产品 ADR 编号无关，别混引。

## 背景

统一改造（ADR-009）之后三技能共用同一看板与流水线，但「工单真源在哪」仍不明确：本地 `.scratch/` md 是创作面，服务器 `jxx_tickets` 是可跨机查看的真源，两者靠 PRD 75-b06 的投影/回连对账连接。实际执行中 agent 默认只写本地 md，服务器操作成了被遗忘的可选步骤；且新项目第一次接入时，agent 没有行动引导——不知道线上还没有本项目的工作区。

## 决策

1. **服务器优先**：jxx-implement / jxx-implement-spec / jxx-ticket-board 的默认行为是操作**服务器上的工单**（jxx-ticket REST，即线上 `/tickets` 看板的数据源）；本地 md 保留创作面与离线投影身份。状态流转（pending-review / done / labels / 认领）改本地 md 的同时经 `jxx_ticket_call update` 双写服务器。
2. **线上工作目录 = repo_key 分区**：服务器无需预建任何目录——该项目 `repo_key` 首次出现在 `jxx_tickets` 即工作区诞生。这与「每个项目在服务器上有自己的工单分区/视图」是同一件事（`list?repo_key=` 已支持过滤，线上看板有项目选择器）。
3. **先创建后操作（bootstrap）**：开工硬前置包含 `node tools/jxx-bootstrap.mjs --root <项目根>`（本仓工具；无此工具的项目按同语义手动执行 `list`→无则 `create` 种子工单）——线上无该 repo_key 工单时自动创建种子工单（`【bootstrap】<项目名> 工作区开通`，labels 带 `bootstrap`）并落地本地投影基准，然后才继续正常流程；已有则幂等退出。种子工单同时是「这个项目从何时接入」的审计锚点。
4. **离线降级不破**：服务器不可达时照常直写本地 md（git 保底），回连后 `jxx_ticket_sync` 收口——服务器优先是**默认路径**，不是可用性前提。

## 被否方案

- **双向实时同步**（本地 md 改动即自动推服务器）：需要守护进程与冲突面，超出 PRD 75「松耦合」决策——否；双写由技能提示词驱动、投影回连兜底。
- **新项目先手工在服务器建「项目」实体**：服务器无项目表，repo_key 分区已等价——否；种子工单即创建动作。

## 影响面

- jxx-implement v1.2.0（「工单真源与工作区 bootstrap」节）、jxx-implement-spec v1.2.0（步骤 0b）、jxx-ticket-board PROTOCOL §0（真源口径 + doc_ref 自动带出）。
- 权威仓配套：`tools/jxx-bootstrap.mjs`（bootstrap 命令）、`docs/agents/issue-tracker.md`（服务器优先小节）、`agents/skills/jxx-ticket-router/SKILL.md`（用法指针）。
