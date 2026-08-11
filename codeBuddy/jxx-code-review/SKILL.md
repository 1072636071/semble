---
name: jxx-code-review
description: 从两个维度审查自固定点（commit、branch、tag 或 merge-base）以来的变更 — 标准（代码是否遵循仓库编码标准？）和 spec（代码是否匹配原始 issue/PRD 要求？）。两个审查以并行子 agent 运行，并排报告。当用户想审查 branch、PR、进行中的变更，或要求"review since X"/"review 自 X 以来"时使用。
metadata:
  version: 1.0.0
---

从两个维度审查 `HEAD` 与用户指定固定点（fixed point）之间的 diff：

- **标准** — 代码是否符合仓库文档中记录的编码标准？
- **spec** — 代码是否忠实实现了原始 issue / PRD / spec？

两个维度作为**并行子 agent** 运行，上下文互不污染，然后本技能汇总它们的发现。

Issue 跟踪器应已配置好 — 若 `docs/agents/issue-tracker.md` 缺失，运行 `/jxx-setup-matt-pocock-skills`。

## 流程

### 1. 确定固定点

用户指定的任何固定点 — commit SHA、branch 名、tag、`main`、`HEAD~5` 等。若用户未指定，则询问。

只执行一次 diff 命令：`git diff <fixed-point>...HEAD`（三点语法，比较 merge-base）。同时通过 `git log <fixed-point>..HEAD --oneline` 记录 commit 列表。

继续前确认固定点可解析（`git rev-parse <fixed-point>`）且 diff 非空。无效引用或空 diff 应在此处中止 — 而非在两个并行子 agent 内部。

**diff 持久化**：将 diff 输出写入当前项目的 `/.temp/` 目录，文件名格式 `code-review-<YYYYMMDD-HHmmss>.diff`。`/.temp/` 目录若不存在则创建。子 agent 通过读取该文件获取 diff，避免在提示中传递大量 diff 文本。

### 2. 识别 spec 来源

按以下顺序查找原始 spec：

1. commit 消息中的 issue 引用（`#123`、`Closes #45`、GitLab `!67` 等）— 通过 `docs/agents/issue-tracker.md` 中的工作流获取。
2. 用户作为参数传入的路径。
3. `docs/`、`specs/` 或 `.scratch/` 下匹配 branch 名或功能的 PRD/spec 文件。
4. 若均未找到，询问用户 spec 位置。若用户表示没有，**spec** 子 agent 跳过并报告"无可用 spec"。

### 3. 识别标准来源

仓库中记录代码编写规范的任何内容，如 `CODING_STANDARDS.md` 或 `CONTRIBUTING.md`。

除仓库文档外，标准轴始终携带以下**代码异味基线** — 一组固定的 Fowler 代码异味（《重构》第 3 章），即使仓库无文档也适用。两条规则约束它：

- **仓库优先。** 仓库记录的标准始终优先；当仓库认可了基线会标记的内容时，抑制该异味。
- **始终是酌情判断。** 每个异味是启发式标记（"可能的特性嫉妒"），绝非硬性违规 — 与此处的任何标准一样，跳过工具已强制执行的内容。

每个异味的格式为*它是什么* → _如何修复_；与 diff 匹配：

- **Mysterious Name（神秘命名）** — 函数、变量或类型的名称无法揭示其功能或内容。→ 重命名；若找不到贴切的名字，说明设计意图模糊。
- **Duplicated Code（重复代码）** — 相同的逻辑结构出现在本次变更中的多个代码块或文件中。→ 提取共享逻辑，从两处调用。
- **Feature Envy（特性嫉妒）** — 方法更多地访问另一个对象的数据而非自身数据。→ 将方法移到它嫉妒的数据所属的对象上。
- **Data Clumps（数据泥团）** — 相同的几个字段或参数总是一起出现（一个等待诞生的类型）。→ 将它们打包为一个类型，传递该类型。
- **Primitive Obsession（原始类型偏执）** — 用原始类型或字符串代替值得拥有独立类型的领域概念。→ 给概念自己的小类型。
- **Repeated Switches（重复 switch）** — 相同的 `switch`/`if` 级联在同一类型上于本次变更范围内反复出现。→ 用多态替换，或让两处调用点共享一个 map。
- **Shotgun Surgery（散弹式修改）** — 一个逻辑变更迫使在 diff 中的多个文件中散布编辑。→ 将一起变更的内容聚合到一个模块中。
- **Divergent Change（发散式变更）** — 一个文件或模块因多个不相关的原因被编辑。→ 拆分，使每个模块只因一个原因变更。
- **Speculative Generality（投机性泛化）** — 为 spec 中不存在的需求添加的抽象、参数或 hooks。→ 删除；内联回去直到有真实需求出现。
- **Message Chains（消息链）** — 长的 `a.b().c().d()` 导航，调用者不应依赖。→ 在第一个对象上用一个方法隐藏遍历。
- **Middle Man（中间人）** — 主要只是转发委托的类或函数。→ 删除它，直接调用真实目标。
- **Refused Bequest（被拒绝的遗赠）** — 忽略或覆盖大部分继承内容的子类或实现者。→ 放弃继承，使用组合。

### 4. 并行启动两个子 agent

用你所在 harness 的子 agent 机制并行派发两者——harness 支持时，在一条消息中发出两个调用。两者都选用最通用的 agent 类型：每个子 agent 都必须能读文件、跑 `git`，只能搜索的 agent 太窄。

**标准子 agent 提示** — 包含：

- diff 文件路径（`/.temp/code-review-<timestamp>.diff`），子 agent 自行读取。
- commit 列表。
- 步骤 3 中找到的标准源文件列表，**加上步骤 3 的异味基线全文粘贴** — 子 agent 没有其他途径访问它。
- 简报："读取 diff 文件，按文件/hunk（代码块，在相关处）报告：(a) diff 中违反已记录标准的每一处：引用标准（文件 + 规则）；(b) 发现的任何基线异味：命名并引用代码块。区分硬性违规和酌情判断 — 已记录标准违规可以是硬性的，但基线异味始终是酌情判断，仓库已记录标准优先于基线。跳过工具已强制执行的内容。400 words / 400 词以内。"

**spec 子 agent 提示** — 包含：

- diff 文件路径（`/.temp/code-review-<timestamp>.diff`），子 agent 自行读取。
- commit 列表。
- spec 的路径或已获取的内容。
- 简报："读取 diff 文件，报告：(a) spec 要求但缺失或不完整的需求；(b) diff 中未被要求的行为（scope creep / 范围蔓延）；(c) 看似已实现但实现看起来有误的需求。为每个发现引用 spec 行。400 words / 400 词以内。"

若 spec 缺失，跳过 spec 子 agent 并在最终报告中注明。

### 5. 汇总

在 `## 标准` 和 `## spec` 标题下呈现两份报告，逐字或轻度整理。**不要**合并或重新排序发现 — 两个维度刻意分离（见*为什么两个维度*）。

以一行总结结尾：每个维度的发现总数，以及每个维度内最严重的问题（如有）。不要跨轴选出一个最严重问题 — 那正是分离所防止的重新排序。

## 为什么两个维度

一个变更可能通过一个维度而未通过另一个：

- 代码遵循了每个标准但实现了错误的东西 → **标准通过，spec 失败。**
- 代码完全按照 issue 要求做了但违反了项目约定 → **spec 通过，标准失败。**

分开报告防止一个维度掩盖另一个。

## 与 jxx-plan-review 的分工

两个审查在管线中互补，不重叠：

| 维度 | jxx-plan-review | jxx-code-review |
|------|----------------|-----------------|
| 审什么 | 方案（GOAL.md 契约） | 代码（git diff） |
| 时机 | 开工前（contract 之后、execute 之前） | 收工后（代码已写出） |
| 核心问题 | 方案可行吗？有遗漏吗？预算够吗？ | 代码干净吗？匹配 spec 吗？有 bug 吗？ |
| 失败后果 | 封驳打回 contract 修正 | 修改代码后重新审查 |
| 不审什么 | 不审代码风格、不审实现细节 | 不审方案合理性、不审目标定义 |

两者不互相替代。一个方案可能通过 plan-review 但写出烂代码（需 code-review 拦截），一段干净代码可能实现错误方案（需 plan-review 拦截）。
