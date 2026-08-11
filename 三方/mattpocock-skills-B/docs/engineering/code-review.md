## 它做什么

`code-review` 沿两条轴线审查 `HEAD` 与你指名的固定点——一个 commit、一个分支、一个标签、`main`、`HEAD~5`——之间的 diff。**标准**问代码是否遵循这个仓库写代码的方式。**规格**问代码是否做了来源 issue 或[规格](https://www.aihero.dev/ai-coding-dictionary/spec)要求的事。每条轴线在自己的[子代理](https://www.aihero.dev/ai-coding-dictionary/subagent)中运行，这样谁都不会看到另一方的推理。

两条轴线从不合并、从不重新排名。报告以*每条轴线*最严重的问题结束，并拒绝跨轴线点名一个唯一的胜者，因为一个变更可以过一条轴线而败另一条：遵循每条约定却实现了错误东西的代码过标准、败规格；完全按[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)要求做却破坏仓库约定的代码则相反。一个混合的裁决会让通过的那条轴线掩盖失败的那条。

## 何时使用

输入 `/code-review`，或当你要求审查一个分支、一个 PR、进行中的工作，或任何"since X"的东西时，agent 自动触发它。

| 你的情况 | 使用 |
| --- | --- |
| 一个 diff 存在，你想知道它是否*构建正确***并且**是*正确的东西* | `code-review` |
| 你想在 diff 中猎捕 bug——空路径、竞态、差一错误 | Claude Code 自己的内置审查，不是这个（见下面的名字冲突） |
| 什么还没写，你想让它测试先行地写 | [tdd](https://aihero.dev/skills-tdd) |
| 整个规格需要构建，包括审查 | [implement](https://aihero.dev/skills-implement)，它自己调用这个技能 |
| 整个代码库漂移了，而不是一个 diff | [improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture) |
| 有东西坏了，你不知道为什么 | [diagnosing-bugs](https://aihero.dev/skills-diagnosing-bugs) |

你必须提供固定点。如果你不提供，技能会要一个而不是猜测；它然后检查 ref 可解析且 diff 非空，之后才触发任何东西，所以一个打错的分支名会当着你的面失败，而不是在两个子代理内部。

## 前提条件

标准轴不需要任何东西。它读取仓库记录的任何东西（`CODING_STANDARDS.md`、`CONTRIBUTING.md` 等），并在仓库什么都没记录时回退到内置基线。

规格轴需要一个存在且可找到的规格。它按此顺序寻找：

1. commit 消息中的 issue 引用（`#123`、`Closes #45`、GitLab 的 `!67`），通过 `docs/agents/issue-tracker.md` 获取。
2. 你作为参数传入的路径。
3. `docs/`、`specs/` 或 `.scratch/` 下匹配分支或特性名的规格文件。
4. 问你。

第 1 步依赖 [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) 写入的 `docs/agents/issue-tracker.md`。没有它，如果你递给它一个路径，这条轴线仍然有效。完全没有规格时，规格子代理被跳过，报告说"无规格可用"，而不是编造需求。

## 两条轴线

| | 标准 | 规格 |
| --- | --- | --- |
| 问题 | 构建正确吗？ | 是正确的东西吗？ |
| 读取 | 仓库记录的规范，加上坏味道基线 | 来源 issue 或规格 |
| 报告 | 记录的违反（可能是硬性的），和坏味道（永远是判断调用） | 缺失或部分实现的需求、范围蔓延、实现有误的需求 |
| 每个发现引用 | 规范文件和规则，或指名的坏味道加上 hunk | 规格的那一行 |

一个不知道你标准的通用审查技能正是这个设计要避免的东西——它标记你代码库中*刻意*的东西，漏掉你代码库*实际依赖*的不变量。所以仓库自己的文档是标准轴上的[首要来源](https://www.aihero.dev/ai-coding-dictionary/primary-source)，而且**仓库总是覆盖**。

**坏味道基线**是它下面的地板：《重构》第 3 章的十二个 Fowler 代码坏味道——神秘命名、重复代码、依恋情结、数据泥团、基本类型偏执、重复的开关、霰弹式修改、发散式变化、过度通用、消息链、中间人、被拒绝的遗赠。每个都是带标签的启发式（"可能的依恋情结"），绝不是硬性违规，而且每个都表述为*它是什么* → *如何修复*，所以一个发现带着一个动作而不是一句抱怨到达。你的 linter 已经强制执行的任何东西都被两条轴线跳过。

## 常见问题

**它和 Claude Code 自己的 `/code-review` 冲突。我该怎么办？**

这是这个技能被报告最多的问题，而且没有修复。Claude Code 自带它自己的 `/code-review`，它做的是不同的事——在 diff 中猎捕 bug，而这个检查规格合规和仓库标准。安装这个库意味着其中一个获胜，而哪个获胜取决于你如何安装的。通过插件市场，一切都在 `mattpocock-skills:` 前缀下起别名，内置的在非限定的名字下变得难以触达；通过普通技能安装，本地文件获胜，这个技能遮蔽内置的。一个干净的答案是完全移除 Claude Code 的内置技能：一个巨大的[上下文](https://www.aihero.dev/ai-coding-dictionary/context)节省，而且冲突不再重要。遮蔽本身可以说是 Claude Code [harness](https://www.aihero.dev/ai-coding-dictionary/harness) 的 bug——技能作者应该可以自由地把技能命名为任何东西——所以另一个答案是把本地副本改名。编辑 frontmatter 或重命名目录会被 `npx skills update` 撤销；用户报告的持久变通是把技能 fork 到一个新名字，把 `code-review` 从托管集合中移除，并记下你 fork 自的 commit，以便手动重新同步。

**它的子代理不断再次调用 `/code-review` 并生成更多 agent。**

已知开放 bug，多人、在多个 harness 中复现。标准和规格提示不禁止委托，所以子代理可以重新发现技能并再次展开——一份报告达到 50 多个 agent。人们在 fork 上应用的修复是附加到两个子代理简报的一行："不要调用 `/code-review` 或生成额外的 agent——直接执行这次审查。"有些人更愿意在 harness 层处理，这样每个技能都继承守卫。两者都还没进发布的技能里。如果你无人值守地运行它，留意 agent 计数。

**我应该在和写代码的同一个[会话](https://www.aihero.dev/ai-coding-dictionary/session)里运行它吗？**

优先一个新会话。正如一位读者所说："同一个上下文审查自己不是审查，是带斜杠命令的确认偏差。"编写会话中的审查 agent 持有塑造代码的每一个假设，那正是独立审查者不会有的上下文。这也是为什么人们要求 [implement](https://aihero.dev/skills-implement) 不带它的内置审查步骤——它会在刚写 diff 的会话内部运行审查。你自己从干净的会话调用 `/code-review` 才是诚实的版本。

**每张工单之后，还是最后一次性？**

两者都有效，技能不替你决定。每张工单保持每个 diff 足够小，让规格轴有一个明确的规格可查，这是 `implement` 使用的模式。批量到分支末尾会捕获工单之间的交互，而逐工单的通过每次都漏掉那些。如果你不确定，按工单审查，并针对分支点运行最后一次通过。

**我能相信这些发现吗？**

不经检查不行。子代理输出是假设，不是证据——一个团队报告了十几个破坏性变更，基于散文的审查都放行了。技能逐字或轻清理地汇总两份报告，而不是对照文件重新验证每个断言，所以一个发现可能引用错误的位置或夸大影响。在行动之前阅读每个发现上的引用。每个发现都必须携带一个——一条标准规则、一个坏味道加它的 hunk、或一行规格——这正是让这可检查的原因。

**为什么我每次运行它都找到新问题？**

因为修复创造新表面，而且因为标准轴线的判断调用那一半在运行之间不是确定性的。一位读者直白地描述了这个循环："`/code-review` 和 `/improve-code-architecture` 每次都总能找到新东西。我实施修复、重新运行这些技能，一次又一次。"没有收敛保证。把一次通过当作一份线索清单，对背后有引用规则的那些采取行动，然后停下——不要循环运行它直到它回来是干净的，因为它不会。

**它审查我未提交的工作吗？**

不会。它 diff `<fixed-point>...HEAD`，三点式，从 merge-base 度量，排除暂存和工作区变更。如果 `implement` 没有做临时 commit，即将被提交的工作对审查不可见。先提交，再审查，然后 amend 或添加 fixup。

## 正常工作的标志

- 它在坏 ref 或空 diff 上拒绝开始，在任何子代理生成之前。
- 报告以 `## Standards` 和 `## Spec` 下的两个独立块到达，而不是一个合并的列表。
- 每个标准发现点名你仓库某个文件中的一条规则或十二个坏味道之一，并引用 hunk；每个规格发现引用规格的一行。
- 结束汇总给出每条轴线最严重的问题，并拒绝挑选整体赢家。
- 没有规格可用时，规格块如实说明，而不是列出它从代码推断的需求。

## 在流程中的位置

`code-review` 是构建链尾部（`grill-with-docs → to-spec → to-tickets → implement → code-review`）的审查步骤，也可以独立站在你指向它的任何分支或 PR 上。

- [implement](https://aihero.dev/skills-implement) 是最近的邻居：它驱动构建，并在提交前调用这个技能作为它自己的收尾审查。
- [to-spec](https://aihero.dev/skills-to-spec) 和 [to-tickets](https://aihero.dev/skills-to-tickets) 产出规格轴要查对的文档；一个含糊的规格让那条轴线含糊。
- [improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture) 是全代码库的对等物——这个技能只从来只看一个 diff。

当你不确定情况想要哪个技能时，[ask-matt](https://aihero.dev/skills-ask-matt) 在整套之间路由。
