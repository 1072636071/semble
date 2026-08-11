# Matt Pocock 技能

由 Claude Code 加载的 agent 技能集合（斜杠命令和行为）。技能按桶组织，由 `/setup-matt-pocock-skills` 生成的按仓库配置消费。

## 语言

**Issue 追踪器**：
托管仓库 issue 的工具——GitHub Issues、Linear、本地 `.scratch/` markdown 约定或类似工具。本地约定下每个功能目录名为 `.scratch/<NN>-<feature-slug>/`（`<NN>` 为从 `01` 起的全局递增顺序号），issue 文件为 `<NN>-<slug>.md`。`to-issues`、`to-prd`、`triage` 和 `qa` 等技能从中读写。
_避免使用_：backlog manager、backlog backend、issue host

**Issue**：
**Issue 追踪器**中的单个跟踪工作单元——bug、任务、PRD 或由 `to-issues` 产出的切片。
_避免使用_：ticket（仅在引用将其称为 ticket 的外部系统时使用）

**分诊角色**：
分诊期间应用于 **Issue** 的规范状态机标签（如 `needs-triage`、`ready-for-afk`）。每个角色通过 `docs/agents/triage-labels.md` 映射到 **Issue 追踪器**中的真实标签字符串。

## 关系

- 一个 **Issue 追踪器**包含多个 **Issue**
- 一个 **Issue** 同一时间携带一个 **分诊角色**

## 标记的歧义

- "backlog" 以前既用来指托管 issue 的*工具*，也指其中的*工作体*——已解决：工具是 **Issue 追踪器**；"backlog" 不再作为领域术语使用。
- "backlog backend" / "backlog manager"——已解决：合并为 **Issue 追踪器**。
