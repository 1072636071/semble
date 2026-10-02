# Changelog

## 1.4.0 — 收口四段闭环（随 jxx-ticket-board v0.15.0 / ADR-012）

开发-审查-合并流水线补上第四段「回收工作空间」：每张工单的合并改为**四段闭环**（定点复核 → `merge-check` 预演冲突面 → 合入 main → `rm-wt` 回收工作树与已合入分支），并新增编排者的**回收核对**（每卡收口后 `verify`，出现 `MISMATCH 未回收工作树/分支` 即按提示补 `rm-wt`，一次一卡）。冲突按预演输出分诊：机械候选自解后**必须重跑 review**（解完 diff 已变），非机械（binary / modify-delete / rename）交回开发组。PRD 收口由两件事扩为三件事（清暂存 + 置 PRD done + **回收本 PRD 全残留现场**）；暂存清不进 main 时不回收现场。汇报须含「未能回合 main 的卡及原因」。

## 1.3.0 — 默认回合 main（随 jxx-ticket-board v0.14.0 / ADR-011）

不再预建 PRD 分支：每张工单审查通过后由合并专员默认直合 main（受阻暂存 PRD 分支，且必须向用户汇报不能回合的原因，PROTOCOL §3）；审查者 `--base` = origin/main；worker `add-wt` 一律从 origin/main 拉；PRD 收口改为「清暂存 + 置 PRD done」（PROTOCOL §3.1）。

## 1.1.0 — 2026-10-01

三技能统一改造（jxx-ticket-board v0.12.0 / ADR-009）：从独立的「单分支 ticket/<PRD号>-spec + draft PR」流改为**看板 auto 模式的整轨特化**——in-project 看板就位 → 建 PRD 分支 → 整批投卡（合入目标自动 = PRD 分支）→ auto 编排 worker/审查者/合并专员（工单分支合入 PRD 分支）→ PRD 收口（全部工单 done 或用户要求时整支 PRD 分支 code-review 后合 main）。不再有「双轨」；散工单明确归 /jxx-implement。

## 1.0.0 — 2026-09-28

初始版本，翻译自 mattpocock/skills（in-progress/implement-spec，v1.2.3）。
