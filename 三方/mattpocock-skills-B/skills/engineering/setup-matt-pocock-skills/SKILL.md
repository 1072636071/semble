---
name: setup-matt-pocock-skills
description: 为本仓库配置工程技能——设置其 issue 跟踪器、分流标签词汇和领域文档布局。在首次使用其他工程技能之前运行一次。
disable-model-invocation: true
---

# 设置 Matt Pocock 的技能

搭建工程技能假定的按仓库配置：

- **Issue 跟踪器** —— issue 存放在哪里（默认 GitHub；本地 markdown 也开箱即支持）
- **分流标签** —— 用于五个规范分流角色的字符串
- **领域文档** —— `CONTEXT.md` 和 ADR 放在哪里，以及读取它们的消费者规则

这是一个提示驱动的技能，不是确定性脚本。探索、呈现你发现的、与用户确认，然后写入。

## 流程

### 1. 探索

查看当前仓库以了解它的起始状态。阅读任何存在的东西；不要假设：

- `git remote -v` 和 `.git/config` —— 这是一个 GitHub 仓库吗？是哪一个？
- 仓库根目录的 `AGENTS.md` 和 `CLAUDE.md` —— 两者中任何一个存在吗？两者中是否已经有 `## Agent skills` 部分？
- 仓库根目录的 `CONTEXT.md` 和 `CONTEXT-MAP.md`
- `docs/adr/` 和任何 `src/*/docs/adr/` 目录
- `docs/agents/` —— 这个技能的先前输出是否已存在？
- `.scratch/` —— 表明本地 markdown issue 跟踪器约定已经在使用
- 是否安装了 `triage` 技能？（紧挨着这个技能的一个 `triage` 技能文件夹，或你可用技能中的 `triage`。）这决定第 B 节是否运行。
- Monorepo 信号 —— 一个 `pnpm-workspace.yaml`、`package.json` 中的 `workspaces` 字段，或一个有自己 `src/` 的已填充 `packages/*`。只在真正的大型多包仓库中出现；它们的缺席意味着单上下文，这几乎是每个仓库。

### 2. 呈现发现并询问

总结存在什么和缺失什么。然后按顺序处理各节——一节、一个回答，然后下一节。

用推荐答案引出每节，这样用户能用一个词接受它。只在选择真正分叉时给一行解释；在探索已经解决它时跳过整节（`triage` 未安装时跳过第 B 节，没有 monorepo 时跳过第 C 节）。

**第 A 节 —— Issue 跟踪器。**

> 解释：这个仓库的"issue 跟踪器"是 issue 存放的地方。`to-tickets`、`triage` 和 `to-spec` 等技能读取它并写入它——它们需要知道是调用 `gh issue create`、在 `.scratch/` 下写 markdown 文件，还是遵循你描述的其他工作流。选择你实际上为这个仓库跟踪工作的地方。

默认姿态：这些技能是为 GitHub 设计的。如果 `git remote` 指向 GitHub，提议那个。如果 `git remote` 指向 GitLab（`gitlab.com` 或自托管主机），提议 GitLab。否则（或如果用户偏好），提供：

- **GitHub** —— issue 存放在仓库的 GitHub Issues 中（使用 `gh` CLI）
- **GitLab** —— issue 存放在仓库的 GitLab Issues 中（使用 [`glab`](https://gitlab.com/gitlab-org/cli) CLI）
- **本地 markdown** —— issue 作为文件存放在本仓库的 `.scratch/<feature>/` 下（适合个人项目或没有远程的仓库）
- **其他**（Jira、Linear 等）—— 请用户用一段话描述工作流；技能会把它记录为自由格式的散文

把选择记录在 `docs/agents/issue-tracker.md` 中。GitHub 和 GitLab 模板带有一个"PRs as a request surface"标志，默认**关闭**——保持关闭并不要提出它；一个想要外部 PR 进入分流队列的用户可以在文件中翻转该标志。

**第 B 节 —— 分流标签词汇。** 如果 `triage` 技能未安装（探索告诉你的），完全跳过本节——一个未安装的技能不需要标签。

如果已安装，恰好问一个问题：

> 你想保留默认的分流标签吗？（推荐：**是**）

默认是五个规范角色，每个标签字符串等于它的名字：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。选**是**就按原样写它们。只有当用户说不——通常是因为他们的跟踪器已经使用了其他名字（例如 `needs-triage` 用 `bug:triage`）——才收集覆盖项，这样 `triage` 应用现有标签而不是创建重复项。

**第 C 节 —— 领域文档。** 默认为**单上下文**——仓库根目录下一个 `CONTEXT.md` + `docs/adr/`。这适合几乎每个仓库；不问就写。

只有当探索发现 monorepo 信号时，才提供**多上下文**——一个指向按上下文 `CONTEXT.md` 文件的根 `CONTEXT-MAP.md`。然后确认他们想要哪种布局。

### 3. 确认并编辑

向用户展示草稿：

- 要添加到正在编辑的 `CLAUDE.md` / `AGENTS.md` 中的 `## Agent skills` 块（选择规则见第 4 步）
- `docs/agents/issue-tracker.md`、`docs/agents/domain.md` 和 `docs/agents/triage-labels.md` 的内容（最后者只在 `triage` 已安装时）

让他们在写入前编辑。

### 4. 写入

**选择要编辑的文件：**

- 如果 `CLAUDE.md` 存在，编辑它。
- 否则如果 `AGENTS.md` 存在，编辑它。
- 如果两者都不存在，问用户要创建哪一个——不要替他们选择。

当 `CLAUDE.md` 已存在时永远不要创建 `AGENTS.md`（反之亦然）——总是编辑已经在那里的那个。

如果所选文件中已存在 `## Agent skills` 块，就地更新其内容，而不是追加一个重复的。不要覆盖用户对周围部分的编辑。

该块：

```markdown
## Agent skills

### Issue tracker

[issue 在哪里跟踪的一行摘要]。参见 `docs/agents/issue-tracker.md`。

### Triage labels

[标签词汇的一行摘要]。参见 `docs/agents/triage-labels.md`。

### Domain docs

[布局的一行摘要 —— "single-context" 或 "multi-context"]。参见 `docs/agents/domain.md`。
```

只有当 `triage` 已安装且第 B 节运行时，才包含 `### Triage labels` 子块，并写 `docs/agents/triage-labels.md`。当它未安装时，两者都省略。

然后使用此技能文件夹中的种子模板作为起点编写文档文件：

- [issue-tracker-github.md](./issue-tracker-github.md) — GitHub issue 跟踪器
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md) — GitLab issue 跟踪器
- [issue-tracker-local.md](./issue-tracker-local.md) — 本地 markdown issue 跟踪器
- [triage-labels.md](./triage-labels.md) — 标签映射（只在 `triage` 已安装时）
- [domain.md](./domain.md) — 领域文档消费者规则 + 布局

对于"其他" issue 跟踪器，用用户的描述从零编写 `docs/agents/issue-tracker.md`。

### 5. 完成

告诉用户设置已完成，以及哪些工程技能现在会从这些文件中读取。提及他们以后可以直接编辑 `docs/agents/*.md`——只有当他们想切换 issue 跟踪器或从头重新开始时才需要重新运行此技能。
