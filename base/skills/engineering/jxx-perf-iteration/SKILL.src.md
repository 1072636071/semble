---
name: jxx-perf-iteration
description: "Rust 专用的性能压榨循环：以 criterion 基准为准，一轮一个可判过/不过的硬指标，逐轮审 diff 防作弊，再用质量闸卡住提速，最后给出可复现的加速倍数。当用户要把某个 Rust crate 或热路径优化到指定倍数（比 umap-learn、xgboost、同类 crate 快 N 倍）、跑 cargo bench 继续压性能、给 Rust 代码做 SIMD/缓存/算法级重写时触发，触发词：Rust 性能优化、cargo bench、criterion、优化到几倍、比 xx 快、benchmaxxing、unsafe 重写。仅适用 Rust 工程；不用于非 Rust 语言项目、没有量化判据的功能开发（用 jxx-implement）、根因未明的排障（用 jxx-diagnosing-bugs）。"
version: 1.0.0
x-install: false
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-perf-iteration, codebuddy, rust, performance]
    description-en: |-
      1. Rust-only benchmark-driven optimization loop: fix a criterion baseline, run guarded single-objective rounds, audit every diff for benchmark cheating, gate on quality, then report a reproducible multiple.
      2. Triggered by: Rust 性能优化 / cargo bench / criterion / 优化到几倍 / 比 xx 快 / benchmaxxing / make this Rust crate N times faster.
      3. Value: turns "make it faster" into a pass/fail metric the agent cannot fudge - with concrete cheat-pattern checks, convergence criteria, and a quality gate instead of vague enthusiasm.
      4. Usage: cargo bench baseline -> criterion matrix -> AGENTS.md guardrails -> 1.2x round prompt -> diff cheat-audit -> quality gate -> convergence -> breakthrough -> refactor -> competition.
      5. Requires: a Cargo project, a machine you can keep quiet during measurement, and permission to commit a benches/ suite if none exists.
  codebuddy:
    allowed-tools: [read_file, search_content, write_file, bash]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# jxx-perf-iteration

Rust-only. Make a crate faster with an agent that cannot fool you: fix a `criterion` baseline, constrain each round to one pass/fail metric, audit every diff for benchmark tampering, gate the result on quality - and only then accept the speedup.

## When

- The target is a Rust crate or workspace, and `cargo bench` runs (or can be set up under `benches/`).
- The user names a target multiple ("beat xgboost by 2x", "get this under 5 ms") or asks to keep squeezing an already optimized hot path.
- Not for: non-Rust projects, feature work without a metric (use `jxx-implement`), root-cause hunting (use `jxx-diagnosing-bugs`).

## Input

1. Crate or workspace path.
2. Benchmark entry point (`benches/` + `cargo bench`); if absent, permission to create and commit one.
3. Reference implementation (`umap-learn`, `xgboost`, a peer crate) and target multiple; default `1.2x` over your own baseline.
4. Red lines: no `unsafe`, no dependency swaps, no public-API breaks, target triple / platform.

Missing any of 1-3 -> return `ERR_MISSING_INPUT` and list what is missing. Never guess a baseline.

## Steps

1. **True baseline.** `cargo bench -- --save-baseline base`, run serially three times, record the median plus CPU, `rustc -V`, and `RUSTFLAGS`.
2. **Benchmark matrix.** `criterion` groups covering small/large and simple/complex inputs; fixed seeds; commit `benches/` before touching library code.
3. **Guardrails.** Write the five bans from `references/guardrails.md` into `AGENTS.md` before the first round.
4. **Rounds.** One prompt, one pass/fail metric, `benches/` frozen: `references/prompts.md#round`.
5. **Cheat audit.** Diff `benches/`, `tests/`, `Cargo.toml`, `Cargo.lock`, profile settings, `#[inline]`, sample sizes: `references/guardrails.md#audit`. Any hit -> revert that round.
6. **Quality gate.** Compare against a known-good implementation, cap the speed loss (default 5%), fix quality before raising the target.
7. **Convergence.** Two consecutive rounds under 3-5% with disproportionate code growth -> stop and record why.
8. **Breakthrough pass** (only after convergence), then **refactor pass**, then an optional **competition pass**.
9. **Hand-off.** Speedup table, round log, cheat-audit verdict, reproduction commands.

## Output

- `baseline -> result` table with the multiple, `rustc` version, and the machine.
- `rounds`: round, mechanism, multiple, reverted or kept.
- `cheat-audit`: passed, or the exact hit and the revert.

## Rules

- One named mechanism per round (SIMD, fusion, cache, data structure) - say why it is faster.
- Benchmarks run serially with frozen `RUSTFLAGS` and a fixed profile. Never in parallel, never with `target-cpu=native`.
- No `unsafe` unless the user explicitly authorizes it.
- Start the target at `1.2x`, raise only after it is met - an aggressive target invites cheating.
- Subagents research and review; they never run benchmarks.
- Any diff touching `benches/` or a test is high risk and needs a line-by-line justification.

## Failure exits

- `ERR_NO_BASELINE` - no reproducible `criterion` baseline.
- `ERR_BENCH_UNSTABLE` - same code differs by more than 10% between runs; fix noise first.
- `ERR_CHEAT_DETECTED` - benchmark/test tampering or a banned technique; revert and record.
- `ERR_INFEASIBLE_TARGET` - no progress over several rounds; lower the target or change the algorithm, with evidence.
<!--/en-->

# jxx-perf-iteration

**仅适用 Rust 工程。** 让「更快」变成可判过/不过的指标，而不是一句形容词。做法是把优化拆成受约束的单轮迭代：`criterion` 基线 → 一个硬指标 → 每轮审 diff 防作弊 → 质量闸 → 收敛判定。

## 何时用

- 目标是 Rust crate / workspace，`cargo bench` 能跑（或允许在 `benches/` 下新建）。
- 用户给出量化目标：比某库快 N 倍、把某函数压到多少毫秒、继续压已经优化过的热路径。
- 想用便宜的并行子代理探索优化假设，而不想烧旗舰模型的额度。

不适用：非 Rust 语言的项目——本技能的提示词、护栏与基准口径全部绑定 `cargo` / `criterion` / `RUSTFLAGS`，换语言会得到一份似是而非的流程。功能开发走 `jxx-implement`；还不知道哪里慢、要查根因走 `jxx-diagnosing-bugs`。

## 输入

开工前凑齐四项，缺任何一项就返回 `ERR_MISSING_INPUT` 并逐条列出缺什么，不要替用户猜：

| # | 输入 | 缺省 |
|---|---|---|
| 1 | crate / workspace 路径 | 无 |
| 2 | 基准入口（`benches/` + `cargo bench`）；没有则取得「允许新建并提交基准」的授权 | 无 |
| 3 | 参照实现（`umap-learn`、`xgboost`、同类 crate）与目标倍数 | `1.2x`（相对自基线） |
| 4 | 红线：禁 `unsafe`、禁换依赖、禁破公共 API、目标 target triple / 平台 | 默认全禁 |

## 流程

### 1 固化真基线（True Performance Baseline）

先把 `benches/` 提交进版本库，动库代码之前跑基线：

```bash
cargo bench -- --save-baseline base
```

串行执行、机器空闲、连续三次取中位数，记下 CPU 型号、`rustc -V`、`RUSTFLAGS`、profile 设置。没有可复现基线就停——这是 `ERR_NO_BASELINE`，不是「先改着看」。

### 2 铺基准矩阵

用 `criterion` 的 group 按输入规模（小 / 大）× 复杂度（简单 / 复杂）铺用例，优先真实形状而不是合成数据，数据生成器固定随机种子，每个用例独立可复跑。不要手搓计时器——自造计时器是作弊的温床，也难审计。要点见 `references/benchmarking.md`。

### 3 写护栏文件

把五条禁令写进目标仓库的 `AGENTS.md` 再开始第一轮：禁并行跑基准、禁改基准、禁 `target-cpu=native` 与任何 `RUSTFLAGS` 变更、基准之间必须独立、必须直接用 `criterion`。原文与逐条解释见 `references/guardrails.md`。

### 4 跑单轮优化

一轮一个提示、一个硬指标（默认「全部基准比真基线快至少 1.2 倍」），`benches/` 冻结。提示模板见 `references/prompts.md#round`。指标要可判过/不过：给「尽可能快」这种表述，模型会调两个超参数就交差。

### 5 审 diff（防作弊闸）

每轮结束逐项核对：`benches/`、`tests/`、`Cargo.toml`（依赖与 `[profile.release]` 的 `lto` / `codegen-units` / `opt-level`）、`Cargo.lock`、criterion 的 sample size 与 warm-up、新增的 `#[inline]`、工作量（训练轮数 / 采样数）是否被调小。命中任意一项即回退该轮，并把这条写进护栏。作弊模式表见 `references/guardrails.md#audit`。

### 6 上质量闸

拿已知正确的实现做对照（数值误差、输出一致性、业务指标），并给速度损失设上限（默认 5%）。顺序是「先做快、再做对」——先拿到速度，再在质量闸上把质量修回来，而不是一开始就双目标死磕。

### 7 判收敛

连续两轮提升不足 3–5%（统计上可能只是噪声）、而代码净增明显不成比例时停手，记录停的理由。判据见 `references/benchmarking.md#convergence`。

### 8 突破轮（仅在收敛后）

两段式：先一句 `c'mon, try doing a breakthrough`；若只改了超参数，再追加「只调超参不算突破」。前提是失败上下文已经在会话里，否则这句话没有信息量。模板见 `references/prompts.md#breakthrough`。

### 9 重构轮（可选，但常有惊喜）

砍 20% SLoC、单文件不超过 1k 行、零性能回退。重构后经常意外提速，务必补跑基准确认没有回退。模板见 `references/prompts.md#refactor`。

### 10 竞争基准（可选）

对着 2–3 个成熟 crate 建同口径基准，定「全部快 2 倍」。加码前先确认口径公平（同输入、同预热、同并发）。模板见 `references/prompts.md#competition`。

## 输出

交付物固定三块，缺一块视为未完成：

1. **对比表**：`baseline → result`，含倍数、`rustc` 版本、机器、复现命令。
2. **轮次日志**：轮次 / 改了什么机制 / 倍数 / 保留或回退。
3. **作弊审查结论**：通过，或命中项与回退记录。

## 规则

- 每轮只动一个可命名的机制（SIMD、函数融合、循环展开、中间缓存、数据结构替换），并能说清「为什么更快」；说不清的一律回退。
- 基准串行跑、`RUSTFLAGS` 冻结、profile 固定、同机同负载；并行跑出来的数字直接作废。
- 默认禁 `unsafe`；用户显式授权才开，且要在报告里标注。
- 目标倍数从 `1.2x` 起步，达成后再抬。一次抬太猛会诱导模型用冒险或冗长的重写硬凑。
- 子代理只做调研与评审，不跑基准——它们抢资源，数字会失真。
- 任何碰到 `benches/` 或 `tests/` 的 diff 都是高风险改动，逐行说明理由，说不清就回退。

## 边界与失败出口

| 出口 | 触发条件 | 处理 |
|---|---|---|
| `ERR_NO_BASELINE` | 建不出可复现的 criterion 基线 | 先补基准环境，不动业务代码 |
| `ERR_BENCH_UNSTABLE` | 同代码两次差异 >10% | 固定 CPU / 关超线程 / 加预热，噪声解决前不许下结论 |
| `ERR_CHEAT_DETECTED` | 基准或测试被改、禁招命中 | 回退该轮，写进护栏，报告里如实标注 |
| `ERR_INFEASIBLE_TARGET` | 多轮无进展 | 降目标或换算法路线，附证据，不硬撑 |

不做的事：非 Rust 项目的性能优化；替上游 crate 维护 PR；在安全敏感代码上为提速开 `unsafe`；把「没有基准的主观感觉」当成性能问题。

## 深入

- 全部提示词原文与变量说明 → `references/prompts.md`
- 五条禁令、作弊模式表、diff 审查清单 → `references/guardrails.md`
- criterion 用法、公平基准、收敛判据、报告模板 → `references/benchmarking.md`
- 原始案例与真实数字（UMAP、GBDT、模板引擎、ASCII、词云）→ `references/case-notes.md`

## 版本

1.0.0 — 首版，仅覆盖 Rust。源自 Max Woolf《Writing Rust code that's faster than state-of-the-art libraries by asking agents to make the code faster》(2026-09-21)。
