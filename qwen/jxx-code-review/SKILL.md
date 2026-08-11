---
name: jxx-code-review
description: 从标准与 spec 两个维度审查自固定点（commit/branch/tag/merge-base）以来的代码变更，以并行子 agent 运行并排报告。当用户想审查 branch、PR、进行中的变更时使用。触发词："review""code review""审查代码""review since X""review 自 X 以来"。不适用于方案合理性审查（改用 jxx-plan-review 技能）、不适用于 issue 分诊（改用 jxx-triage 技能）。
metadata:
  version: 1.1.0
---

# Code Review

对 `HEAD` 与用户指定固定点之间的 diff 做双轴审查：

- **标准轴**：代码是否符合仓库已记录的编码规范。
- **spec 轴**：代码是否忠实实现原始 issue / PRD / spec。

两轴作为并行子 agent 运行，上下文互不污染，本技能汇总发现。若 `docs/agents/issue-tracker.md` 缺失，先使用 jxx-setup-matt-pocock-skills 技能配置 issue tracker。

## 流程

### 1. 确定固定点

接受 commit SHA、branch 名、tag、`main`、`HEAD~5` 等任意固定点；未指定则询问。

只执行一次 diff：`git diff <fixed-point>...HEAD`（三点语法，比较 merge-base）。同时用 `git log <fixed-point>..HEAD --oneline` 记录 commit 列表。

继续前确认固定点可解析（`git rev-parse <fixed-point>`）且 diff 非空；无效引用或空 diff 在此处中止，不要在子 agent 内失败。

将 diff 写入当前项目 `/.temp/code-review-<YYYYMMDD-HHmmss>.diff`（目录不存在则创建），子 agent 通过读取该文件获取 diff，避免在提示中传递大段文本。

### 2. 识别 spec 来源

按以下顺序查找原始 spec：

1. commit 消息中的 issue 引用（`#123`、`Closes #45`、GitLab `!67` 等），通过 `docs/agents/issue-tracker.md` 工作流获取。
2. 用户作为参数传入的路径。
3. `docs/`、`specs/`、`.scratch/` 下匹配 branch 名或功能的 PRD/spec 文件。
4. 均未找到则询问用户；用户表示没有时，跳过 spec 子 agent 并在最终报告注明"无可用 spec"。

### 3. 识别标准来源

读取仓库中记录编码规范的内容（如 `CODING_STANDARDS.md`、`CONTRIBUTING.md`）。

除仓库文档外，标准轴始终携带固定的代码异味基线（Fowler《重构》第 3 章），即使仓库无文档也适用。两条约束：

- **仓库优先**：仓库已认可的内容抑制基线中对应条目。
- **始终是酌情判断**：每个异味是启发式标记，不是硬性违规；工具已强制执行的内容一律跳过。

完整基线条目见 [references/code-smell-baseline.md](references/code-smell-baseline.md)，启动标准子 agent 时必须将其全文粘贴到提示中（子 agent 无法访问本文件）。

### 4. 并行启动两个子 agent

用所在 harness 的子 agent 机制并行派发两者；harness 支持时在一条消息中发出两个调用。两者都选用最通用的 agent 类型（需能读文件、跑 git）。

**标准子 agent 提示**包含：

- diff 文件路径（`/.temp/code-review-<timestamp>.diff`），由子 agent 自行读取。
- commit 列表。
- 步骤 3 找到的标准源文件列表，加上代码异味基线全文。
- 简报："读取 diff 文件，按文件/hunk 报告：(a) 每处违反已记录标准的点，引用标准文件+规则；(b) 发现的基线异味，命名并引用代码块。区分硬性违规与酌情判断——已记录标准违规可为硬性，基线异味始终酌情，仓库标准优先于基线。跳过工具已强制执行的内容。400 词以内。"

**spec 子 agent 提示**包含：

- diff 文件路径，由子 agent 自行读取。
- commit 列表。
- spec 路径或已获取内容。
- 简报："读取 diff 文件，报告：(a) spec 要求但缺失或不完整的需求；(b) 未被要求的行为（scope creep）；(c) 看似已实现但实现有误的需求。每项引用 spec 行。400 词以内。"

spec 缺失时跳过该子 agent 并在最终报告注明。

### 5. 汇总

在 `## 标准` 与 `## spec` 标题下呈现两份报告，逐字或轻度整理。**不要**合并或重排发现——两轴刻意分离。

以一行总结结尾：每轴发现总数及各自最严重问题（如有）。不要跨轴选单一最严重问题。

## 为什么两个维度

一个变更可能通过一轴而未通过另一轴：

- 遵循所有标准但实现错误 → 标准通过，spec 失败。
- 完全按 issue 实现但违反项目约定 → spec 通过，标准失败。

分开报告防止一轴掩盖另一轴。

## 与 jxx-plan-review 的分工

| 维度 | jxx-plan-review | jxx-code-review |
|------|----------------|-----------------|
| 审什么 | 方案（GOAL.md 契约） | 代码（git diff） |
| 时机 | 开工前（contract 之后、execute 之前） | 收工后（代码已写出） |
| 核心问题 | 方案可行吗？有遗漏吗？预算够吗？ | 代码干净吗？匹配 spec 吗？有 bug 吗？ |
| 失败后果 | 封驳打回 contract 修正 | 修改代码后重新审查 |
| 不审什么 | 不审代码风格、不审实现细节 | 不审方案合理性、不审目标定义 |

两者互补不替代：通过 plan-review 的方案仍可能写出烂代码（需 code-review 拦截）；干净的代码仍可能实现错误方案（需 plan-review 拦截）。
