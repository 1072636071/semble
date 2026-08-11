## 它做什么

`setup-matt-pocock-skills` 回答关于一个仓库的三个问题——issue 住在哪里、分流标签叫什么、领域文档坐在哪里——并把答案记录为 `docs/agents/` 下的 markdown 文件。

那些文件是仓库之间唯一变化的东西。技能本身处处相同；它们在运行时读取 `docs/agents/issue-tracker.md` 并按它说的做。那就是为什么这套不绑定 GitHub，为什么没有技能文件需要编辑来把它指向别处。用"把技能链接到一个自定义 issue 跟踪器"调用它，对任何你能以编程方式连接的东西都有效，零技能变更。

它是一个提示驱动的技能，不是确定性脚本。它读取你的 `git remote`、你现有的 `CLAUDE.md`、你现有的 `CONTEXT.md`，提出它发现的，在写任何东西之前等你确认。

## 何时使用

你通过输入 `/setup-matt-pocock-skills` 调用它——[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 不会自行触发它。它被刻意标记为不可调用，所以其他技能不能替你触发它。

每个仓库运行一次，在首次使用任何其他工程技能之前。如果 [triage](https://aihero.dev/skills-triage)、[to-spec](https://aihero.dev/skills-to-spec)、[to-tickets](https://aihero.dev/skills-to-tickets) 或 [wayfinder](https://aihero.dev/skills-wayfinder) 开始猜你的 issue 去哪、或应用你的跟踪器没有的标签，它们在这里还没被设置。一个项目进行到一半的仓库是运行它的好地方；技能读取已经在那里的东西，没有早期工作被浪费。

## 前提条件

它写进你运行它的仓库：

| 它写 | 在哪里 |
| --- | --- |
| `issue-tracker.md` | `docs/agents/` |
| `domain.md` | `docs/agents/` |
| `triage-labels.md` | `docs/agents/`，只在 `triage` 技能已安装时 |
| 一个 `## Agent skills` 块 | 已经存在的 `CLAUDE.md` / `AGENTS.md` 中的任何一个 |

全部都是已提交的 markdown。没有用户级或全局模式：配置住在仓库里，所以每个仓库得到它自己的副本。

## 三个决策

它用推荐答案引导每个部分，跳过探索已经落定的。大多数运行是两次确认然后完成。

| 决策 | 它提议什么 | 它实际什么时候问 |
| --- | --- | --- |
| **Issue 跟踪器** | 匹配你的 `git remote` 的那个 | 总是——这是唯一真正的选择 |
| **分流标签** | 保留五个规范名字（`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`） | 只在 `triage` 技能已安装时 |
| **领域文档** | 单上下文：根目录一个 `CONTEXT.md` 加上 `docs/adr/` | 只在它发现 monorepo 信号时，然后它提供多上下文 `CONTEXT-MAP.md` |

跟踪器选项：

| 选项 | issue 住在哪里 | 需要 |
| --- | --- | --- |
| **GitHub** | 仓库的 GitHub Issues | `gh` CLI |
| **GitLab** | 仓库的 GitLab Issues | `glab` CLI |
| **本地 markdown** | 本仓库 `.scratch/<feature>/` 下的文件 | 什么——完全没有远程 |
| **其他** | 你说的任何地方 | 你描述工作流的一段话 |

前三个作为模板随技能发布，开箱即用。本地 markdown 是一流的选项，不是回退：一个没有远程的个人项目被完全支持。一个注意事项值得重复：如果你在用 GitHub，不要用本地 markdown。它们是替代，不是层。

"其他"也不是一个占位。它是 Jira、Linear、Azure DevOps 和 Beads 都有效的原因：你描述工作流，技能把你的散文记录在 `docs/agents/issue-tracker.md`，下游技能遵循散文。社区已经这样做过——一个基于[MCP](https://www.aihero.dev/ai-coding-dictionary/mcp) 的 Jira 变体、一个形状像 `gh` 的 Gitea CLI、一个手工构建的本地仪表盘。

## 常见问题

**我必须用 GitHub 吗？**

不用。GitHub、GitLab 和 `.scratch/` 下的本地 markdown 都作为现成模板发布，任何其他东西都穿过"其他"路径工作。这是记录中被重复最多的问题，大致是这些词：*"硬锁到 github"*、*"我能用 GitLab / Jira 吗"*、*"Azure DevOps 呢"*。每次的答案都是跟踪器是一个设置答案，不是技能属性。

**我需要在更新技能后重新运行它吗？**

在 v1.1 之后被直接问到时，Matt 说需要。技能自己的收尾信息更软——它告诉你只有切换跟踪器或重新开始才需要重新运行。两者都可辩护，而且差距的原因是真实的：种子模板在版本之间变化，所以旧版本写的 `docs/agents/issue-tracker.md` 可以相对于现在读取它的技能过时。如果一个下游技能开始做文档描述不同的东西，重新运行是便宜的修复。

**它写到 `CLAUDE.md`，但我在 Codex 上。**

已知缺口，仍然打开。文件选择规则是"如果 `CLAUDE.md` 存在就编辑它，否则 `AGENTS.md`"——它检查哪个文件存在，不是哪个[harness](https://www.aihero.dev/ai-coding-dictionary/harness) 在运行。一个从 Claude Code 留下 `CLAUDE.md` 的仓库会得到它的 `## Agent skills` 块出现在 Codex 从不读的地方。两个变通在流传：手动把块移到 `AGENTS.md`，或保持 `AGENTS.md` 规范、让 `CLAUDE.md` 是一个指向它的一行指针。如果两个文件都不存在，技能问你要创建哪个而不是挑选，这困惑了预期它直接决定的人。

**它没有创建我的分流标签。**

它不创建。`docs/agents/triage-labels.md` 是一个*映射*——它告诉 `/triage` 你的跟踪器中哪些字符串对应五个规范角色。它不运行 `gh label create`。在一个全新的 GitHub 仓库上标签真的还不存在，这已经被作为 bug 提交不止一次。两个后续：

- 如果你的跟踪器已经用规范名字，映射是一个恒等表，没有要配置的东西。那是预期的常见情况，不是缺失的步骤。
- [wayfinder](https://aihero.dev/skills-wayfinder) 的 `wayfinder:map` 和 `wayfinder:<type>` 标签也不在这里创建，而 `gh issue create --label <missing>` 会直接失败而不是创建标签。在一个 GitHub 仓库上第一次 wayfinder 运行之前手动创建它们。

**我能在这里配置其他技能的行为吗——[访谈](https://www.aihero.dev/ai-coding-dictionary/grilling)节奏、问题格式、语气？**

不能。它配置三样东西：跟踪器、标签、文档布局。有直接要求让它成为每用户偏好的家，而常驻答案是技能保持有主见：*"配置即死亡。"* 偏好属于你的 `CLAUDE.md` 中的纯文本指令，每个技能已经读取它。

**我能把配置放在 `~/.claude` 而不是提交到每个仓库吗？**

今天不行。有一个来自跨多个仓库运行技能的人的开放请求，没有用户级模式存在。每个仓库携带它自己的 `docs/agents/`。

**有一个配置其他技能、然后又配置其他技能配置的技能，不奇怪吗？**

一个长期存在的抱怨说是，用这些词：*"有一个设置其他技能、然后配置其他技能的技能，对我来说感觉不对——那意味着 LLM 在配置它自己的技能。"* 权衡是真实的并被承认：设置步骤的替代是把跟踪器指令复制进每个触及 issue 的技能。输出是可检查的、可编辑的 markdown，那是缓解——你可以读它写的每个文件并手动更改，日常微调正是那样，而不是另一次运行。

## 正常工作的标志

- `docs/agents/issue-tracker.md` 和 `docs/agents/domain.md` 存在，加上已安装 `triage` 时的 `triage-labels.md`。
- 一个 `## Agent skills` 部分出现在你的 harness 实际读取的指令文件中，带一个指向那些文件中每一个的一行摘要。
- 它提议的跟踪器匹配你真正使用的远程，标签字符串匹配你跟踪器中真实存在的标签。
- 之后，`/to-tickets` 不问 issue 住哪里就发布，`/triage` 应用标签而不是发明它们。
- 技能文件本身没有任何东西改变。如果设置编辑了一个 `SKILL.md`，有东西出了错。

## 在流程中的位置

`setup-matt-pocock-skills` 是工程流程的**运行一次设置**，其他一切假定的前提条件，而不是链中的一步。它的邻居是它的读者：[triage](https://aihero.dev/skills-triage)，应用这里写的标签词汇；[to-spec](https://aihero.dev/skills-to-spec) 和 [to-tickets](https://aihero.dev/skills-to-tickets)，发布进这里点名的跟踪器；以及 [wayfinder](https://aihero.dev/skills-wayfinder)，读取同一个跟踪器文件的"Wayfinding operations"部分来知道地图和子[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)如何存储。它记录的领域文档布局是 [domain-modeling](https://aihero.dev/skills-domain-modeling) 之后填充的那个——它在术语或决策实际被解决时惰性创建 `CONTEXT.md` 和 ADR，所以设置后一个空仓库是预期的状态。对于接下来要取用哪个技能，[ask-matt](https://aihero.dev/skills-ask-matt) 路由整套。
