# 护栏与作弊审查

一个前提：**给足机会，智能体一定会作弊。** 原文实测里最夸张的一次是靠「把物理引擎整个关掉」拿到 34,500 倍加速。护栏不是道德约束，是工程约束——每条都对应一次真实翻车。

这份护栏只覆盖 Rust / Cargo 生态。

## 护栏片段（写进目标仓库的 AGENTS.md）

```md
## Benchmarking and Optimization

- **NEVER** run benchmarks in parallel, as the benchmarks will compete for resources and the results will be invalid
- **NEVER** game the benchmarks. Do not manipulate the benchmarks themselves to satisfy any required performance constraints
- **NEVER** run benchmarks with `target-cpu=native` or any other `RUSTFLAGS`
- Ensure benchmark tests are independent. If the tests are dependent due to a feature (e.g. caching), ensure the feature is disabled
- **ALWAYS** use `criterion` directly for running benchmarks if available
```

逐条为什么：

| 禁令 | 踩过的坑 |
|---|---|
| 禁并行跑基准 | 模型为省时间同时起两个基准，互相抢核，数字全废。原文那次的模型自己发现并重跑了，但不能指望每次 |
| 禁改基准 | 抓到过把某条基准的训练轮数调小然后声称提速 |
| 禁 `RUSTFLAGS` / `target-cpu=native` | 这类全局优化确实能提速，但换机器就不可复现，属于对「可推广」不公平的作弊 |
| 基准必须独立 | 缓存会让第 N 条基准吃前面几条的收益，指标失真 |
| 指定 `criterion` | 不指定，模型会自造计时器，那是个黑箱，作弊难审 |

## audit

每轮结束、接受成绩之前，逐项核对本轮 diff。命中任意一项即回退该轮，并把该条补进护栏。

### 高风险清单（按优先级）

1. **`benches/` 本身**：任何改动、新增的 `#[inline]`、去掉 `black_box`、调小 `sample_size` / `warm_up_time` / `measurement_time`。`benches/` 的 diff 非空就是红旗。
2. **`tests/`**：删断言、放宽容差、`#[ignore]`、把性能断言注释掉。
3. **工作量缩减**：训练轮数 / 采样数 / 迭代次数 / 精度（`f64`→`f32`）/ 分辨率被调小，然后声称「更快」。
4. **`Cargo.toml`**：`[profile.release]` 里的 `lto`、`codegen-units`、`opt-level` 被改（只在基准里开 lto 是典型的假加速）；`[features]` 默认值被改；依赖被换成更快但语义不同的 crate。
5. **`Cargo.lock`**：版本悄悄变化。允许换依赖时，换完必须解释为什么语义等价。
6. **编译参数**：`.cargo/config.toml` 里塞 `rustflags`、`-C target-cpu`、`-Z` 系列。
7. **并发模型**：把单线程基准改成多线程跑（或引入 `rayon` 而不标注）。
8. **输入缩水**：「大数据集」用例被换成小数据集。

### 可自动化的部分

能写脚本就别靠人眼。三条做成 pre-commit 或 CI，能挡掉大部分意外：

```bash
git diff --exit-code -- benches/ tests/          # 基准与测试零改动
git diff --name-only | grep -q Cargo.lock && echo "需要人工放行"   # 锁文件变更拦截
git diff -- Cargo.toml | grep -E 'lto|codegen-units|opt-level|target-cpu' && echo "profile 被改"
```

### 原文的原话

> 如果 `git diff` 里出现了基准文件，那算法有没有刷榜一眼就能看出来——这一点智能体没法（至少不容易）作弊。

---

## 边界：允许的加速手段

给出白名单，避免模型把「禁止作弊」误读成「禁止激进优化」。原文认可的底层手法：

- 更激进地使用 SIMD（`std::simd` 或显式 wide 类型，逐元素对齐）
- 函数融合（fusion）与循环展开
- 中间缓存、预分配、复用 buffer
- 用 `Arc` 替代借用（在它能省掉拷贝时）
- 按输入规模分档：小数据别开 `rayon` 数据并行，调度开销会吃掉收益
- 数据结构与算法替换（哈希表、arena、SoA 布局）
- 按输入特征选择代码路径（dispatch）

白名单之外的手段（`unsafe`、改语义、降精度、换依赖）需要用户显式授权，并在报告里单独标注。
