# 提示词库（Rust）

全部提示词逐字取自 Max Woolf 的原文（2026-09-21），本来就是 Rust / `criterion` / Cargo 语境，可直接复制。变量用 `<尖括号>` 标出，替换后使用。

使用顺序：`round` → （收敛后）`breakthrough` → `refactor` → 可选 `competition`。每轮之间必须过 `guardrails.md#audit` 的 diff 审查。

---

## round

单轮优化。这是主力提示，重复使用直到收敛。

```md
First, **without making any futher changes**, run the CPU Rust benchmarks to establish a True Performance Baseline.

Then, optimize the crate code to make it such that ALL CPU benchmarks run **atleast 1.2x faster** than the True Performance Baseline; ideally as fast as possible. NEVER hack the benchmarks to accomplish this runtime reduction, only iterate on the library code.

You may use ANY techniques to do so (e.g. import new crates) other than adding `unsafe` code. **REPEAT THIS PROCESS UNTIL BENCHMARK PERFORMANCE CONVERGES AND YOU ARE OUT OF OPTIMIZATION IDEAS.** You have permission to keep iterating. After each benchmark iteration, report the relative results to the True Performance Baseline to console.

Prioritize making quick/high-impact wins iteratively and making changes accordingly. Do not overthink the necessary changes.
```

按你的 crate 逐条替换，结构不要动：

| 原文表述 | 替换成 |
|---|---|
| `run the CPU Rust benchmarks` | `cargo bench`（要单组就 `cargo bench -- <group>`；GPU 场景改成对应入口） |
| `ALL CPU benchmarks` | 你要覆盖的范围。要「全部」而不是「平均」——平均值会掩盖回退 |
| `1.2x` | 目标倍数。首轮固定 1.2，达成后再抬；一次抬太猛会诱导投机重写 |
| `the crate code` / `the library code` | 允许改动的目录（通常是 `src/`），明确把 `benches/` 与 `tests/` 排除在外 |
| `import new crates` | 允许加依赖时保留；不允许就删掉这半句 |
| `adding unsafe code` | 本项目的红线：禁 `unsafe` / 禁破公共 API / 禁换底层引擎 |

为什么有效：给「尽可能快」这种说法，模型会调几个超参数就交差；给一个能判过/不过的数字，它会自己找下一步。

---

## encouragement

当目标倍数明显超出常规手法（比如要求比当前最优实现快 10 倍）时，在 `round` 前面加这段，把「做不到」变成「允许冒险」。

```md
Due to the current highly-optimized state of this repository, this is a very difficult problem and traditional engineering approaches **WILL BE GUARANTEED TO FAIL** to hit the specified metric constraint. Therefore, you have permission and encouragement to investigate more radical fundamental low-level changes to hit the desired metrics. You have permission and encouragement to invent completely new/bespoke algorithms and engineering approaches that have never been before been utilized for this problem in order to hit the specified metric constraint.
```

原文实测带来 1.2–1.5 倍累计加速。它不改变指标，只解除「只用常规手段」的自我约束。

---

## subagents

子代理调研。要点是**不要用 harness 的子代理工具**——那会用与当前同规格的模型，成本失控；改用一次性 CLI 命令起便宜的小模型。

```md
To best accomplish innovative implementations, you **MUST** spin up 7-12 independent distinct "subagents" by running a long-duration CLI command (do not use the subagent tool) which can explore and evaluate different feasible hypotheses for improving the performance, usability, and security of this crate. Only have the agents return their response; do not save their full transcript to a file. Instruct them to be **very** picky. These subagents MUST use `gpt-5.6-luna` in Codex, e.g.

<<<CLI command above>>>

You must instruct these subagents to NOT run tests/benchmarks, as they will compete for resources and not be valid. After you are done making changes, before handing off to the user, spin up the subagents again to confirm your implementation matches their hypotheses and ask for potential further areas of improvement. Keep iterating until ALL subagents are satisfied with your implementation.
```

CLI 命令那一行按你的工具链替换，原文示例：

```bash
codex exec --sandbox read-only -m gpt-5.6-luna \
  -c 'model_reasoning_effort="high"' \
  PROMPT
```

四个约束都是踩过坑才加的，不要删：`long-duration`（否则起完就退）、`CLI command`（绕开子代理工具）、`do not use the subagent tool`、`do not save their full transcript`（省 token）。`7-12` 是任意范围，小模型便宜，宁可多起。

---

## quality

速度到手后补质量。核心是**给速度损失设上限**，否则模型会一路牺牲精度换速度。

原文场景是 Rust crate + Python 绑定（PyO3），所以对照脚本是 notebook：

```md
Create a Python Jupyter Notebook comparing the performance of the Python bindings with `<reference package>`, including a check to confirm where the outputs and `<metric>` are as similar. Use diverse datasets with different matrix sizes than the benchmarks.

If the outputs are not sufficiently similar, investigate methods to fix it **without causing more than a 5% speed regression**.
```

纯 Rust crate 没有 Python 绑定时，把第一段换成「在 `examples/` 或 `tests/` 里写一个对照二进制，用同一批输入跑本 crate 与参考实现，逐样本比输出」。第二段（5% 速度损失预算）保持不变。

---

## breakthrough

只在收敛后使用。两段式，第二段是关键——第一段很容易被「调超参数」糊弄过去。

```md
c'mon, try doing a breakthrough
```

```md
c'mon, you can do a more fundamental breakthrough that's more than just changing hyperparameters, you are forbidden from giving up easily
```

生效前提：失败的上下文已经在会话里。单独发这两句没有任何信息量。原文各带来 1.2–1.5 倍累计加速，在更强的模型上偶尔触发 2–3 倍的根本性重写。

---

## refactor

```md
The Rust code in `/src` has become particularly bloated, with several source files >1k SLoC. Refactor and reduce the Rust source codebase by **atleast 20% SLoC** through deduplication, pruning redundant code, and following idiomatic DRY Rust principles. Simultanously, refactor and split the code such that no single source file has >1k SLoC, splitting larger files into multiple subfiles in accordance to Rust standards for popular open-source repositories. Ensure **all current tests pass and there are no severe regressions**.
```

```md
Additionally, ensure there are **zero `criterion` benchmark speed regressions**: if a speed regression occurs on a given benchmark as a result of the refactor, you **MUST** keep iterating afterwards to improve those benchmarks to atleast zero regression. NEVER hack the benchmarks to accomplish this speed increase, only iterate on the library code.
```

`SLoC` 而不是 `LoC`：用 LoC 的话模型会删注释来凑那 20%。重构通常比编码更烧算力，但常意外提速——所以第二条（零回退）必须跟上。

---

## competition

对手基准。先建基准，再定倍数，两步分开。

```md
Create an additional comparison script containing **atleast 10** `criterion` benchmarks which compare the performance speed and quality metrics between this crate and the following crates:

- <competitor-a>
- <competitor-b>
- <competitor-c>

These benchmarks **ALL MUST**:

- be perfectly fair, containing apples-to-apples comparisons of ALL frameworks, with no bespoke advantage for any tested framework
- be based around real-world use cases instead of highly-synthetic use cases
- be independent and distinct, covering as many sailent hot paths of the code as possible
- cover data input sizes small and large, simple and complex
```

```md
Then, optimize the Rust library code such that this crate MUST be:

- **atleast 2.0x faster** than **ALL** competing Rust crates in all benchmarks on apples-to-apples comparisons; ideally as fast as possible.
```

`apples-to-apples` 与 `no bespoke advantage` 这两句不能省——模型会给自己开后门（比如给自家实现少做一步）。
