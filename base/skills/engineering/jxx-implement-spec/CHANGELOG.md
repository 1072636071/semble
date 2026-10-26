# Changelog

## 1.8.2 — 2026-10-26

- 两处硬依赖补降级：看板脚本改 `node <jxx-ticket-board 技能目录>/scripts/board.mjs` 并写明「该技能没装就不要硬跑、改走 `jxx-implement` 单工单流」；`ac-audit.mjs` 改调本技能目录副本（随技能分发），缺 `jxx-to-tickets` 时按恢复口径自查，不跳过。

## 1.8.1 — 2026-10-25

worker 提示词里的验收点闭环版本锚点由 `/jxx-implement` 1.8.0 刷新到 1.12.0（该技能新增「默认不开浏览器验收」第 5 条：AC 证据只能是命令 / 用例名 / `文件:行`，截图与点页面不算机器证据；除非用户明确要求代做 UI 验收，agent 不主动拉浏览器）。仅改版本锚点，worker 下发内容与流程不变。

## 1.8.0 — 2026-10-23

**步骤 0b 双写段改指 ticket-flow 写腿**：各工单的状态流转 / 打卡 / 评论改为一条 `node tools/ticket-flow.mjs --root <项目根> --file <单条工单md> --set status=… --comment "…"`（一条完成「改本地 md + 推服务器」，exit 0 / 2 / 3 三态判读，exit 3 时本地已还原或未变），不再「先改本地 md 再推」；写腿只推本次真改字段，验收点/正文整篇修订仍用只读腿 `--file` 收敛；PRD 本体上行与新建工单仍走 `jxx_ticket_call create`（写腿不 create）。项目无该 CLI 时回退 MCP 双写（先改本地 md → `get` 最新 `version` → `jxx_ticket_call update`），批量 push 的 id 核对纪律不变。

- 步骤 0b 重写：bootstrap / PRD create 保留，双写段换写腿 + 三态退出码 + 兜底回退；编排者随 worker 提示词下发该纪律。
- 步骤 3 worker 段：「每完成一步就地打卡并双写服务器」明确为用写腿命令双写。

## 1.7.1 — 2026-10-23

1b「AC → 工单映射缺口审查」同步覆盖闸：除 §一 覆盖矩阵，还读 `map.md` 的 `## 覆盖闸`（规范 §八）——生产侧新闸把 用户诉求、决策（含明确不做）与 PRD 三源逐条对到 AC，执行侧据此复核，同一判据只在上游权威源维护一份。

## 1.7.0 — 2026-10-21

**整轨以 AC 为收口判据（防少做 / 漏实现贯穿到编排层）**：投卡前、审查时、收口处各加一道 AC 闸门，判定口径一律 pointer 到 `jxx-to-tickets/references/acceptance-criteria.md`（唯一权威源，不复制正文）。要点：

- 步骤 2 之前新增步骤 1b「AC → 工单映射缺口审查」：读 PRD 覆盖矩阵产出缺口清单，有用户故事未被任何工单 AC 覆盖 ⇒ 停止编排、先补工单；`ac-audit --strict` 硬问题 0 且缺口清单清空才投卡。
- 步骤 3 worker 下发要求：工作区含该工单 AC 全集；worker 按 `/jxx-implement` 1.8.0「验收点闭环」闭环；交付卡面「AC 覆盖表」逐条填 `met` / `partial` / `missing`。
- 步骤 3 审查者要求：spec 维度输出逐 AC 判定表，`partial` / `missing` 一律发现项；有 `missing` 时合并专员不得合入。
- 步骤 4 PRD 收口前置：每个工单 `ac-audit` 退出码 0，且覆盖矩阵无空洞（每用户故事至少 1 个 `met` 的 AC），否则不得宣布收口。

## 1.6.0 — 2026-10-15

编排步骤 3 补 worker 纪律锚点：worker 必须遵守 /jxx-implement 1.6.0 的「步骤打卡与断线续接」——列步骤清单进工单文件，每完成一步打卡并双写服务器；编排者中断后以 worker 打卡现场续接。

## 1.4.0 — 收口四段闭环（随 jxx-ticket-board v0.15.0 / ADR-012）

开发-审查-合并流水线补上第四段「回收工作空间」：每张工单的合并改为**四段闭环**（定点复核 → `merge-check` 预演冲突面 → 合入 main → `rm-wt` 回收工作树与已合入分支），并新增编排者的**回收核对**（每卡收口后 `verify`，出现 `MISMATCH 未回收工作树/分支` 即按提示补 `rm-wt`，一次一卡）。冲突按预演输出分诊：机械候选自解后**必须重跑 review**（解完 diff 已变），非机械（binary / modify-delete / rename）交回开发组。PRD 收口由两件事扩为三件事（清暂存 + 置 PRD done + **回收本 PRD 全残留现场**）；暂存清不进 main 时不回收现场。汇报须含「未能回合 main 的卡及原因」。

## 1.3.0 — 默认回合 main（随 jxx-ticket-board v0.14.0 / ADR-011）

不再预建 PRD 分支：每张工单审查通过后由合并专员默认直合 main（受阻暂存 PRD 分支，且必须向用户汇报不能回合的原因，PROTOCOL §3）；审查者 `--base` = origin/main；worker `add-wt` 一律从 origin/main 拉；PRD 收口改为「清暂存 + 置 PRD done」（PROTOCOL §3.1）。

## 1.1.0 — 2026-10-01

三技能统一改造（jxx-ticket-board v0.12.0 / ADR-009）：从独立的「单分支 ticket/<PRD号>-spec + draft PR」流改为**看板 auto 模式的整轨特化**——in-project 看板就位 → 建 PRD 分支 → 整批投卡（合入目标自动 = PRD 分支）→ auto 编排 worker/审查者/合并专员（工单分支合入 PRD 分支）→ PRD 收口（全部工单 done 或用户要求时整支 PRD 分支 code-review 后合 main）。不再有「双轨」；散工单明确归 /jxx-implement。

## 1.0.0 — 2026-09-28

初始版本，翻译自 mattpocock/skills（in-progress/implement-spec，v1.2.3）。
