# Changelog

## 1.3.0 — 默认回合 main（随 jxx-ticket-board v0.14.0 / ADR-011）

不再预建 PRD 分支：每张工单审查通过后由合并专员默认直合 main（受阻暂存 PRD 分支，且必须向用户汇报不能回合的原因，PROTOCOL §3）；审查者 `--base` = origin/main；worker `add-wt` 一律从 origin/main 拉；PRD 收口改为「清暂存 + 置 PRD done」（PROTOCOL §3.1）。

## 1.1.0 — 2026-10-01

三技能统一改造（jxx-ticket-board v0.12.0 / ADR-009）：从独立的「单分支 ticket/<PRD号>-spec + draft PR」流改为**看板 auto 模式的整轨特化**——in-project 看板就位 → 建 PRD 分支 → 整批投卡（合入目标自动 = PRD 分支）→ auto 编排 worker/审查者/合并专员（工单分支合入 PRD 分支）→ PRD 收口（全部工单 done 或用户要求时整支 PRD 分支 code-review 后合 main）。不再有「双轨」；散工单明确归 /jxx-implement。

## 1.0.0 — 2026-09-28

初始版本，翻译自 mattpocock/skills（in-progress/implement-spec，v1.2.3）。
