# `.goals/` 流水线

**Status:** ready-for-agent

**Blocked by:** 01

**构建内容：** 用一套 `goal.mjs` 覆盖 goal-contract / goal-execute / plan-review 共享的 `.goals/` 文件流水线：goal-contract 的 V1–V10 否决门（纯 regex/规则校验）、GOAL.md/PROGRESS.md/_index.md 初始化与状态机；goal-execute 的 PROGRESS.md 簿记（轮数自增/切片状态/循环日志）与 EVIDENCE.md 验收对照表（= 验证命令退出码映射）；plan-review 的 REVIEW.md 模板化 + D1–D5 状态汇总 + 判定映射（✅/⚠️/❌ → 准奏/附条件/封驳）。少量模型语义（起草、判读维度）留在对话，机械校验与落盘全交脚本（复用共享工具层）。

**验收标准：**

- [ ] `goal.mjs` 子命令（如 `gate|init|progress-update|evidence|review-write`）可跑，逐门输出通过/否决+原因
- [ ] GOAL.md/PROGRESS.md/EVIDENCE.md/REVIEW.md 与 `_index.md` 在 fixture `.goals/` 上生成正确、`node:test` 覆盖
- [ ] 判定映射与阻塞状态机行为正确，规则可确定性校验

## 评论

（评论与对话历史追加于此，新内容置于最前。）
