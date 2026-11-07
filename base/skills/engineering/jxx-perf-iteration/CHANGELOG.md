# Changelog

## 1.0.0 — 2026-10-28

首版，**仅覆盖 Rust / Cargo / criterion 生态**；frontmatter 标 `x-install: false`，默认不安装（真源留仓，需要时手工拷贝或改回 `true` 再 `ship install`）。

- 定型为「criterion 真基线 → 单轮硬指标 → diff 防作弊 → 质量闸 → 收敛判定 → 突破轮 → 重构轮 → 竞争基准」的十步循环。
- 四份 references：`prompts.md`（提示词逐字原文 + Rust 变量替换表）、`guardrails.md`（五条禁令、Rust 专有的作弊模式表、CI 拦截命令）、`benchmarking.md`（criterion 用法、`black_box` 与噪声处理、收敛判据、报告模板）、`case-notes.md`（原文案例与真实数字）。
- 四个失败出口固化：`ERR_NO_BASELINE` / `ERR_BENCH_UNSTABLE` / `ERR_CHEAT_DETECTED` / `ERR_INFEASIBLE_TARGET`。
- 范围决策：不做语言抽象。提示词、护栏、基准口径全部绑定 `cargo` / `criterion` / `RUSTFLAGS`，避免给非 Rust 项目一份似是而非的流程。
