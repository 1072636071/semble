# 案例与真实数字

来源：Max Woolf, *Writing Rust code that's faster than state-of-the-art libraries by asking agents to make the code faster*, 2026-09-21。
<https://minimaxir.com/2026/09/agentic-iteration/>

这些数字用来校准目标倍数与预期，不是承诺。它们来自一台具体的机器与一组具体的基准。

## 核心结论

| 阶段 | 手段 | 累计加速 |
|---|---|---|
| 单轮 `round`（1.2x 硬指标） | 受约束的迭代 | 1.5–2.0× |
| 每换一代前沿模型重跑同一提示 | 模型代际 | 每代再 1.5–2.0×，累积 7.5–32× |
| `encouragement` | 解除「只用常规手段」 | +1.2–1.5× |
| `subagents` | 便宜小模型并行调研 + 复核 | +1.2–1.5× |
| `breakthrough` | 收敛后要求根本性重写 | +1.2–1.5×（新模型上偶见 2–3×） |
| `refactor` | 砍 20% SLoC | 常意外提速，两位数百分比 |
| `competition` | 对手基准 + 2× 目标 | 多数基准达标 |

## 分项目

**UMAP（Rust + PyO3）** —— 从零重写降维算法，不带 `unsafe`。
最终比 `umap-learn`（Python）快 **4–15×**，比同类 Rust crate `umap-rs` 快 **2–4×**，且多数质量指标追平或超过 Python 版。

**GBDT** —— 比 `xgboost` 显著更快，有时质量也更好。`breakthrough` 轮之后作者自述「并不真的理解这个突破」。

**MLP / 图网络 / scikit-learn 典型算法** —— 同一套提示全部有效。

**模板引擎（S_J，暂定名）** —— 对 `minijinja` / `tera` 在多数基准上拿到 2×，但输给编译期的 `askama`；补一条编译期路径后打赢。

**ballin（终端 2D 物理）** —— 反例。`headless_step` 声称 34,500× 加速，实为把物理引擎关掉；后续提示修复并整体提速。

**ASCII 转换** —— 文本输出从毫秒级降到亚毫秒，图像栅格化（含 2× 超采样）1–2 ms，可在一秒内把视频转成高分辨率 ASCII 动画。

**词云（Rust + WASM）** —— 默认设置 100 ms → **10–20 ms**。

## 值得记住的三条判断

1. **目标倍数决定行为**：1.2x 会得到稳健的小改写；一次要 10x，得到的是冒险或冗长（甚至作弊）的重写。达成 1.2x 再抬。
2. **先做快、再做对**：先拿速度，再用已知正确实现把质量修回来，比一开始双目标更容易收敛。
3. **重构会带来意外提速**：Rust 是编译型语言，功能不变的重构本不该更快，但实测部分基准出现两位数百分比提升。所以重构轮之后必须补跑基准，零回退是硬条件。

## 作者提示词与规则文件

- AGENTS.md：<https://gist.github.com/minimaxir/86de3cc8f628079d8337e70924b3411d>
- Ur-Prompt（合成后的单条提示）：<https://gist.github.com/minimaxir/933cd6354d96e1fbb45bea13e0940952>
