---
name: jxx-code-review
description: 从两个维度审查自固定点（commit、branch、tag 或 merge-base）以来的变更 — 标准（代码是否遵循仓库编码标准？）和 spec（代码是否匹配原始 issue/PRD 要求？）。两个审查以并行子 agent 运行，并排报告。当用户想审查 branch、PR、进行中的变更，或要求"review since X"/"review 自 X 以来"时使用。
---

# Code Review

从两个维度审查 `HEAD` 与用户指定固定点之间的 diff：标准（代码是否符合仓库编码标准？）和 spec（代码是否忠实实现了原始 issue/PRD/spec？）。两个维度作为并行子 agent 运行，上下文互不污染，然后本技能汇总它们的发现。

Issue 跟踪器应已配置好——若 `docs/agents/issue-tracker.md` 缺失，运行 `jxx-setup-matt-pocock-skills`。

## Guidelines

- 确定固定点。用户指定的任何固定点——commit SHA、branch 名、tag、`main`、`HEAD~5` 等。若未指定则询问。只执行一次 diff 命令：`git diff <fixed-point>...HEAD`（三点语法，比较 merge-base）。同时通过 `git log <fixed-point>..HEAD --oneline` 记录 commit 列表。继续前确认固定点可解析且 diff 非空。
- diff 持久化：将 diff 输出写入 `/.temp/code-review-<YYYYMMDD-HHmmss>.diff`。子 agent 通过读取该文件获取 diff。
- 识别 spec 来源：按顺序查找——commit 消息中的 issue 引用、用户传入的路径、`docs/`/`specs/`/`.scratch/` 下匹配的 PRD/spec 文件、询问用户。若均未找到，spec 子 agent 跳过。
- 识别标准来源：仓库中记录代码编写规范的任何内容（`CODING_STANDARDS.md`、`CONTRIBUTING.md`），加上代码异味基线（见下）。
- 并行启动两个子 agent（标准 + spec），用最通用的 agent 类型（必须能读文件、跑 git）。两者简报均限制 400 词以内。
- 汇总：在 `## 标准` 和 `## spec` 标题下呈现两份报告，逐字或轻度整理。不要合并或重新排序发现。以一行总结结尾：每个维度的发现总数及最严重问题。

## 代码异味基线

标准轴始终携带一组固定的 Fowler 代码异味（《重构》第 3 章），即使仓库无文档也适用。两条规则：仓库优先（仓库记录的标准始终优先）；始终是酌情判断（启发式标记，绝非硬性违规）。跳过工具已强制执行的内容。

每个异味的格式为它是什么 → 如何修复：

- **Mysterious Name** — 名称无法揭示功能或内容。→ 重命名。
- **Duplicated Code** — 相同逻辑结构出现在多个代码块或文件中。→ 提取共享逻辑。
- **Feature Envy** — 方法更多地访问另一个对象的数据。→ 将方法移到它嫉妒的数据所属的对象上。
- **Data Clumps** — 相同几个字段总是一起出现。→ 打包为一个类型。
- **Primitive Obsession** — 用原始类型代替领域概念。→ 给概念自己的小类型。
- **Repeated Switches** — 相同 switch/if 级联反复出现。→ 用多态替换。
- **Shotgun Surgery** — 一个逻辑变更迫使在多个文件中散布编辑。→ 聚合到一个模块。
- **Divergent Change** — 一个文件因多个不相关原因被编辑。→ 拆分。
- **Speculative Generality** — 为不存在的需求添加抽象/参数/hooks。→ 删除。
- **Message Chains** — 长的 `a.b().c().d()` 导航。→ 在第一个对象上用方法隐藏遍历。
- **Middle Man** — 主要只是转发委托。→ 删除，直接调用真实目标。
- **Refused Bequest** — 忽略或覆盖大部分继承内容。→ 放弃继承，使用组合。

## 为什么两个维度

一个变更可能通过一个维度而未通过另一个：代码遵循了每个标准但实现了错误的东西 → 标准通过，spec 失败；代码完全按照 issue 要求做了但违反项目约定 → spec 通过，标准失败。分开报告防止一个维度掩盖另一个。

## 与 jxx-plan-review 的分工

| 维度 | jxx-plan-review | jxx-code-review |
|------|----------------|-----------------|
| 审什么 | 方案（GOAL.md 契约） | 代码（git diff） |
| 时机 | 开工前 | 收工后 |
| 核心问题 | 方案可行吗？有遗漏吗？ | 代码干净吗？匹配 spec 吗？ |
| 失败后果 | 封驳打回 contract | 修改代码后重新审查 |

两者不互相替代。
