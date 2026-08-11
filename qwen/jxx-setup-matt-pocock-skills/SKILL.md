---
name: jxx-setup-matt-pocock-skills
description: 为仓库配置工程技能环境——设置 issue tracker（本地 markdown）、triage 标签词汇表与领域文档布局，写入 AGENTS.md/CLAUDE.md 与 docs/agents/。首次使用 jxx-to-tickets、jxx-triage、jxx-to-spec 等工程技能前运行一次。触发词："初始化工程技能""配置 issue tracker""设置 triage 标签"。不适用于已配置过环境的仓库（直接编辑 docs/agents/*.md 即可），也不负责具体工单或 triage 操作本身。
metadata:
  version: 1.1.0
---

# 设置工程技能环境

为仓库搭建工程技能所依赖的配置：

- **Issue tracker**——issue 存放位置（仅**本地 markdown**，存放在仓库 `.scratch/` 下）
- **triage 标签**——五个标准 triage 角色所使用的标签字符串
- **领域文档**——`CONTEXT.md` 和 ADR 的存放位置，以及读取它们的消费者规则（jxx-grill-with-docs、jxx-domain-modeling 等技能也会读写它们）

这是一个提示驱动的技能，而非确定性脚本。先探索、展示发现、与用户确认，然后写入。

## 默认配置（"全部默认"）

如果用户说"全部默认"/"用默认"/"直接按默认来"，**跳过步骤 2-3 的逐一询问**，直接套用下方默认配置进入步骤 4 写入：

- **Issue tracker**——本地 markdown（`.scratch/` 下）。跳过"PR 作为请求渠道"的追问（本地无 PR）。
- **triage 标签**——每个角色字符串等于其名称（无覆盖）。
- **领域文档**——单一上下文（根目录 `CONTEXT.md` + `docs/adr/`）。
- **写入目标**——见步骤 4 的默认规则：两者都不存在时创建 `AGENTS.md`，不另行询问。

## 流程

### 1. 探索

查看当前仓库以了解其初始状态。读取已有的内容，不要假设：

- 仓库根目录的 `AGENTS.md` 和 `CLAUDE.md`——是否存在？其中是否已有 `## Agent skills` 部分？
- 仓库根目录的 `CONTEXT.md` 和 `CONTEXT-MAP.md`
- `docs/adr/` 和任何 `src/*/docs/adr/` 目录
- `docs/agents/`——此技能之前的输出是否已存在？
- `.scratch/`——标志本地 markdown issue tracker 约定已在使用

### 2. 展示发现并询问

总结已有内容和缺失内容。然后**逐一**引导用户完成三个决策——展示一个部分，获取用户回答，再进入下一个。不要一次性抛出三个。

假设用户不了解这些术语的含义。每个部分以简短说明开始（它是什么、为什么这些技能需要它、选择不同会有什么变化）。然后展示选项和默认值。

**部分 A——Issue tracker。**

> 说明："issue tracker" 是此仓库 issue 的存放位置。jxx-to-tickets、jxx-triage、jxx-to-spec 等技能会从中读取和写入——它们会在仓库 `.scratch/` 下写入 markdown issue 文件。本仓库固定使用本地 markdown tracker，不需要任何远程 CLI（GitHub、GitLab 等）。

本仓库固定使用**本地 markdown**（`.scratch/` 下）：issue 存放在仓库 `.scratch/<NN>-<feature>/` 下的文件中（`<NN>` 为从 `01` 起的全局递增顺序号；适合个人项目或没有远程的仓库）。无需让用户选择远程 tracker——直接套用此默认并进入部分 B。

**部分 B——triage 标签词汇表。**

> 说明：当 jxx-triage 技能处理传入的 issue 时，它会将 issue 推过一个状态机——需要评估、等待报告者补充信息、准备好让 AFK agent 接手、准备好让人工处理、或不予处理。为此，它需要应用与*你实际配置的*字符串匹配的标签（或 issue tracker 中的等价物）。如果你的仓库已使用不同的标签名（例如用 `bug:triage` 而非 `needs-triage`），在此映射它们，以便技能应用正确的标签而非创建重复项。

五个标准角色：

- `needs-triage`——维护者需要评估
- `needs-info`——等待报告者补充信息
- `ready-for-agent`——已完全定义，AFK 就绪（agent 无需人工上下文即可接手）
- `ready-for-human`——需要人工实现
- `wontfix`——不会处理

默认：每个角色的字符串等于其名称。询问用户是否要覆盖任何标签。如果 issue tracker 没有现有标签，默认值即可。

**部分 C——领域文档。**

> 说明：某些技能（jxx-improve-codebase-architecture、jxx-diagnosing-bugs、jxx-tdd、jxx-grill-with-docs、jxx-domain-modeling）会读取 `CONTEXT.md` 文件来了解项目的领域语言，读取 `docs/adr/` 来了解过去的架构决策。它们需要知道仓库是单一上下文还是多上下文（例如包含独立前端/后端上下文的 monorepo），以便在正确位置查找。

确认布局：

- **单一上下文**——仓库根目录有一个 `CONTEXT.md` + `docs/adr/`。大多数仓库是这种。
- **多上下文**——根目录有 `CONTEXT-MAP.md` 指向各上下文的 `CONTEXT.md` 文件（通常是 monorepo）。

### 3. 确认并编辑

向用户展示以下草稿：

- 要添加到 `CLAUDE.md` / `AGENTS.md`（参见步骤 4 的选择规则）中的 `## Agent skills` 块
- `docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`、`docs/agents/domain.md` 的内容

让用户在写入前编辑。

### 4. 写入

**选择要编辑的文件：**

- 如果 `CLAUDE.md` 存在，编辑它。
- 否则如果 `AGENTS.md` 存在，编辑它。
- 如果都不存在，**默认创建 `AGENTS.md`**（除非用户明确要求其他）。非交互/默认路径下直接创建，无需询问。

当 `CLAUDE.md` 已存在时，永远不要创建 `AGENTS.md`（反之亦然）——始终编辑已有的那个。

如果所选文件中已存在 `## Agent skills` 块，就地更新其内容，而非追加重复块。不要覆盖用户对周围部分的编辑。

该块：

```markdown
## Agent skills

### Issue tracker

[一行概述 issue 跟踪位置——本仓库为本地 markdown（`.scratch/` 下）]。参见 `docs/agents/issue-tracker.md`。

### triage 标签

[一行概述标签词汇表]。参见 `docs/agents/triage-labels.md`。

### 领域文档

[一行概述布局——"单一上下文"或"多上下文"]。参见 `docs/agents/domain.md`。
```

然后使用本技能 references/ 中的种子模板作为起点写入以下文档文件：

- [references/issue-tracker-local.md](references/issue-tracker-local.md)——本地 markdown issue tracker
- [references/triage-labels.md](references/triage-labels.md)——标签映射
- [references/domain.md](references/domain.md)——领域文档消费者规则 + 布局

### 5. 完成

告知用户设置已完成，以及哪些工程技能现在会读取这些文件。提及他们之后可以直接编辑 `docs/agents/*.md`——仅在要切换 issue tracker 或从头重新开始时才需要重新运行此技能。

## 与其他技能的关系

- 配置完成后，jxx-to-spec、jxx-to-tickets、jxx-triage 等技能依赖本技能产出的 `docs/agents/*.md`。
- 仅调整配置：直接编辑 `docs/agents/*.md`，无需重跑本技能。
