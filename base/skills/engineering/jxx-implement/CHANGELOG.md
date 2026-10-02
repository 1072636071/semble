# Changelog

## 1.4.0 — 收口四段闭环（随 jxx-ticket-board v0.15.0 / ADR-012）

工单完成后不只在「审查 → 合入 main」收尾——新增「交付之后：收口是四段闭环」节，把开发组需要知道的四件事写实：① **现场不归你管**（合并专员合入后 `rm-wt` 回收工作树与已合入分支，别自己删、也别假设现场永远在）；② **冲突在碰工作树之前就已知**（合并专员先 `merge-check` 内存预演；判为非机械 binary / modify-delete / rename 的会交回你）；③ **解冲突 = 改 diff = 原审查失效**，必须重跑 `/jxx-code-review` 再交（ADR-005）；④ **受阻暂存不回收现场**（活还没上 main）。README 的「相关技能」补齐合并冲突处置入口。
## 1.3.0 — 默认回合 main（随 jxx-ticket-board v0.14.0 / ADR-011）

完成工单后默认回合主分支（含 PRD 工单）：投卡「合入目标」一律 main；`add-wt` 一律从 origin/main 拉（PRD 分支不再预建，降为受阻暂存道）；代码审查 diff 基准 = origin/main；合并归合并专员，技术受阻才暂存 PRD 分支或 blocked，且必须向用户汇报不能回合 main 的原因（PROTOCOL §3/§3.1）。

## 1.1.0 — 2026-10-01

三技能统一改造（jxx-ticket-board v0.12.0 / ADR-009）：新增「硬前置」——一切开发在项目内的工单 worktree（`wt/<卡id>`）中进行并走统一看板卡位流转（看板 init → 投卡 → 领卡 → add-wt，基分支按合入目标自动推导）；「完成步骤」commit 目标明确为工单分支，diff 基准 = 合入目标；新增「交付」步（移卡 review 位）；合并归合并专员按统一合并流（PRD → PRD 分支，散工单 → main）。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
