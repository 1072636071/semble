# Issue 跟踪器：本地 Markdown

此仓库的 issue 和 PRD 以 markdown 文件形式存放在 `.scratch/` 中。

## 约定

- 每个功能一个目录：`.scratch/<NN>-<feature-slug>/`，`<NN>` 为从 `01` 起的全局递增顺序号，按创建先后排列（如 `01-login`、`02-checkout`）
- PRD 是 `.scratch/<NN>-<feature-slug>/PRD.md`
- 实现 issue 是 `.scratch/<NN>-<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 编号
- Triage 状态记录为每个 issue 文件顶部附近的 `Status:` 行（角色字符串见 `triage-labels.md`）
- 评论和对话历史追加到文件底部，在 `## 评论` 标题下
- 工单正文必须有 `**验收标准：**` 节，逐条写成 `- [ ] AC-<n> [<类别>] 当 <前置 / 输入> 时，<动作>，则 <可观测结果> —— 验证:机器 <用例名|命令>`，或 `验证:人工 <HUMAN-CHECK 条目>`；编号工单内唯一、从 1 连续。验收点的覆盖清单、格式铁律、禁词与判定口径见 `jxx-to-tickets` 技能的 `references/acceptance-criteria.md`（唯一权威源，别在此复述）。
- 改代码的工单必须含 `[回归]` 与 `[负向]` 验收点，并保留 `**AC 覆盖声明：**` 行（未产出 AC 的类别写「不适用——<理由>」）。生产侧形式硬闸：`node <jxx-to-tickets 技能目录>/scripts/ac-audit.mjs <功能目录> --strict`。

## 工单状态与生命周期

工单的状态由两个维度描述：

1. **Triage 状态（分类 / 就绪度）** — 见 `triage-labels.md`，写在工单 `Status:` 行，五选一：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。

2. **实现 / 审查状态（执行进度）** — 当工单进入 `ready-for-agent` 并由 agent 接手实现后，经历以下阶段：

   | 状态 | 含义 | 进入条件 |
   | --- | --- | --- |
   | `ready-for-agent` | 已就绪，可交由 agent 实现 | triage 终点，由 `/jxx-triage` 标记 |
   | `pending-review` | **待审查** | **完成第一轮功能开发**后进入——代码已写完并通过本地类型检查 / 单测，但尚未经过代码审查 |
   | `done` | **结束** | **代码审查通过**后进入——实现完整且经 `/jxx-code-review` 验证，且验收点逐条判定无 `partial` / `missing`（审查者自取证，不采信执行者勾选） |

   生命周期流转：

   ```
   ready-for-agent ──认领并开发──▶ pending-review(待审查) ──代码审查通过──▶ done(结束)
        │                                                            ▲
        │                                                            │ 审查驳回修复后回到开发
        └────────────────────────────────────────────────────────────┘
   ```

   - 由 `/jxx-implement` 在完成第一轮功能开发后置 `Status: pending-review`；代码审查通过后置 `Status: done`。
   - `pending-review` 的工单**不能**视为完成，必须等待 `/jxx-code-review` 通过（或用户明确确认无视）方可置 `done`。
   - 阻塞关系 `Blocked by:` 语义不变：工单在其列出的所有被阻塞文件都 `done`（或 `resolved`）后才解除阻塞。
   - **关单判据含验收点闭包**：AC 逐条有证据（用例名 / 命令 + 退出码 / 文件:行），且回归与负向 AC 已核；空实现、桩、硬编码通过的 AC 一律按 `partial` 或 `missing` 拒绝（口径见 `acceptance-criteria.md` 第五节）。
   - **Wayfinder 轻量变体**：`/jxx-wayfinder` 的决策型子工单用 `claimed` / `resolved` 表达同一进度（无独立代码审查环节）；若某子工单是产出代码的实现型工单，则应使用上述 `pending-review` → `done` 完整生命周期，而非直接 `resolved`。

## 当技能说"发布到 issue tracker"时

在 `.scratch/<NN>-<feature-slug>/` 下创建新文件（如需要则创建目录；目录名带从 `01` 起的全局递增顺序号）。

## 当技能说"获取相关工单"时

读取引用路径的文件。用户通常会直接传递路径或 issue 编号。

## Wayfinding 操作

由 `/jxx-wayfinder` 使用。**地图**是一个文件，每个工单有一个**子**文件。

- **地图**：`.scratch/<NN>-<effort>/map.md` — 笔记/已做决策/迷雾正文。
- **子工单**：`.scratch/<NN>-<effort>/issues/NN-<slug>.md`，从 `01` 编号，问题在正文中。`Type:` 行记录工单类型（`research`/`prototype`/`grilling`/`task`）；`Status:` 行记录 `claimed`/`resolved`。
- **阻塞**：顶部附近的 `Blocked by: NN, NN` 行。当其列出的所有文件都 `resolved` 时，工单解除阻塞。
- **前沿**：扫描 `.scratch/<NN>-<effort>/issues/` 中开放、未阻塞、未认领的文件；按编号优先，第一个胜出。
- **认领**：设置 `Status: claimed` 并在任何工作前保存。
- **解决**：在 `## 答案` 标题下追加答案，设置 `Status: resolved`，然后将上下文指针（gist + 链接）追加到 `map.md` 中地图的已做决策中。
