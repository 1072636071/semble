## 它做什么

`triage` 处理你项目跟踪器上的 issue，把每一个移过一个小的**分流角色**状态机——一个类别角色和一个状态角色——留下一个 agent-ready 的简报、一个给报告者的具体问题，或一个带记录理由的关闭 issue。

它只针对**不是你创建的** issue。原始 bug 报告、进来的功能请求、一个未经宣布就到达的外部 pull request——从外部以报告者留下的任何形态落进跟踪器的工作。[to-tickets](https://aihero.dev/skills-to-tickets) 产出的[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)构造上就是 agent-ready 的，在它们上面运行 `triage` 最好也只是浪费工作。规则是扁平的：`/triage` 只针对进来的 issue，不针对你自己创建的。

第二件把它与手工打标签区分开的事：它推荐并等待。它告诉你它的类别和状态判断、附理由，加上它在代码库中发现了什么，在你指示之前什么都不应用。

## 何时使用

你通过输入 `/triage` 然后用通俗语言描述你想要什么来调用它——[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 不会自行触发它。"Show me anything that needs my attention"、"let's look at #42"、"move #42 to ready-for-agent"。

| 你面前有什么 | 去哪里 |
| --- | --- |
| 一个装满别人原始报告的跟踪器 | `/triage` |
| 你自己一个粗略的想法，什么都没写下来 | [grill-with-docs](https://aihero.dev/skills-grill-with-docs) |
| 一场已落定的对话要变成[规格](https://www.aihero.dev/ai-coding-dictionary/spec) | [to-spec](https://aihero.dev/skills-to-spec) |
| 一份规格要拆成 agent-ready 工单 | [to-tickets](https://aihero.dev/skills-to-tickets) |
| 一个需要根因、不是标签的已确认 bug | [diagnosing-bugs](https://aihero.dev/skills-diagnosing-bugs) |

## 前提条件

`triage` 读写你的 issue 跟踪器，所以 [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) 必须已经配置了那个跟踪器和它的标签词汇。下面的角色名字是**规范**的；你跟踪器中的标签字符串可能不同，而映射正是设置提供的。如果你的跟踪器已经恰好使用规范名字，就没有要映射的，也没有要设置的。

跟踪器配置还决定外部 pull request 是否算作一个请求表面，以及谁算外部。那个标志默认关闭，而且不再是设置问题——如果你想让 PR 在范围内，在 `docs/agents/issue-tracker.md` 里翻转它。

## 状态机

每个已分流的条目最终恰好携带一个类别角色和一个状态角色。两个类别：`bug`（有东西坏了）和 `enhancement`（新功能或改进）。五个状态：

| 状态 | 意味着 |
| --- | --- |
| `needs-triage` | 你需要评估它。一个未标记 issue 通常先落在这里。 |
| `needs-info` | 等待报告者。他们回复时返回 `needs-triage`。 |
| `ready-for-agent` | 完全明确，附有 agent 简报。一个[AFK](https://www.aihero.dev/ai-coding-dictionary/afk) agent 可以拿走它。 |
| `ready-for-human` | 同样的简报，加上为什么这不能委托——判断、外部访问、手动测试。 |
| `wontfix` | 关闭，记录理由。 |

那就是整个词汇，"恰好一个状态角色"不变量是让查询保持简单的东西。它也是[技能](https://www.aihero.dev/ai-coding-dictionary/skill)被要求最多的区域：用户要求一个第六状态用于已明确但被另一个 issue 阻塞的工作、用于被未来触发器门控的 `deferred` 工作、以及一个终结的 `implemented` 状态。其中没有一个已发布。见下面的问题。

`wontfix` 分三叉，区别重要，因为其中只有一个写入知识库：

| 你关闭它的原因 | 发生什么 |
| --- | --- |
| 已实现 | 一条评论指向它已经住在哪里。什么都不写入 `.out-of-scope/`——它是一个已构建的功能，不是一个被拒绝的，把它归档进去会毒化去重检查。 |
| 被拒绝的 bug | 礼貌解释，然后关闭。 |
| 被拒绝的 enhancement | `.out-of-scope/` 中的一个文件，从关闭评论链接，然后关闭。 |

`.out-of-scope/` 每个被拒绝的**概念**一个 markdown 文件，而不是每个 issue 一个，作为一份简短的规格设计文档而不是数据库行：什么被拒绝、为什么、以及每个要求过它的 issue。`triage` 在评估任何东西之前读取整个目录，并按概念而不是关键字匹配——"night theme"匹配 `dark-mode.md`。当它命中一个匹配时，它浮出旧的决策并问你是否仍然有同样的感觉，而不是从头重新辩论这个请求。

## 简报之前先验证

在任何[访谈](https://www.aihero.dev/ai-coding-dictionary/grilling)之前，`triage` 检查声明是否站得住脚。对于一个 bug，它按报告者的步骤复现它。对于一个 PR，它 checkout 分支并运行相关测试。然后它报告三件事中的哪件发生了：已确认，带代码路径；无法复现；或细节不足无法尝试，它本身就是存在的最强的 `needs-info` 信号。

它在同一次通过中再对代码库运行两个检查——**冗余**（这已经实现了吗，按领域概念而不是按报告者的措辞搜索？）和**先前拒绝**（`.out-of-scope/` 已经说不吗？）。两者都便宜，而且两者命中时都产生一个 `wontfix`。

所有这一切存在是为了让一个工件变好：**agent 简报**，当一个 issue 移到 `ready-for-agent` 时发布的那个结构化评论。一旦发布，简报就是契约，原始报告只是背景。简报被写成**耐用**而不是精确，因为一个 issue 可以在 `ready-for-agent` 坐几周，而代码在它下面移动。所以它们点名类型、签名和行为契约，绝点名文件路径或行号。一个已确认的复现做出一份比猜测强得多的简报。

## 一个 PR 是一个附带代码的 issue

在跟踪器把外部 pull request 视为一个请求表面的地方，它们穿过同一个机器——相同的类别、相同的状态、相同的转换。状态只是针对 diff 解读：`ready-for-agent` 意味着附有简报、agent 应该对代码采取下一步，`ready-for-human` 意味着它准备好让一个人合并。PR 上的简报描述对现有 diff 还剩下什么要做，而不是如何从零构建这个东西。

发现只浮现*外部* PR，因为一个协作者的进行中分支不是分流工作。那个过滤只针对发现——点名一个 PR，它就会得到分流，无论谁写的。一个粗糙边缘：GitHub 模板的外部 PR 列表命令要求 `gh pr list` 提供一个 `gh` 不暴露的 `authorAssociation` 字段，所以写出来的命令直接失败（[#468](https://github.com/mattpocock/skills/issues/468)）。

## 常见问题

**我运行了 `/to-spec` 和 `/to-tickets`，现在那些工单坐在那里未分流。我该在它们上面运行 `/triage` 吗？**

不该。它们已经是 agent-ready 的——`to-tickets` 在发布时应用 `ready-for-agent` 标签，正是为了让一个 AFK 运行器不用再经过一遍就捡起它们。撞上这个的用户跑了规格流程、看到输出上的 `needs-triage`、发现他们的 AFK 运行器忽略一切。`triage` 是*从外部到达的*工作的入口匝道；规格流程是你*发起的*工作的车道。它们在 `ready-for-agent` 相遇，不在之前。

**现在有了 `to-spec` → `to-tickets` → `implement` 流程，`triage` 还相关吗？**

只有如果你有进来的工作。`triage` 早于那个主干，而且做一份不同的工作：它是别人报告的issue 的车道。如果你跟踪器里的一切都来自你自己的规划，你很少会打开它。如果你维护任何公开的东西，或你的团队向你报 bug，它是前门。主要用途是接受外部贡献者 issue 的开源仓库。

**agent 尝试应用 `ready-for-agent` 而 `gh` 说标签不存在。**

已知开放 bug（[#616](https://github.com/mattpocock/skills/issues/616)）。`setup-matt-pocock-skills` 把标签词汇写进 `docs/agents/triage-labels.md`，但不在你的跟踪器中创建标签。自己用 `gh label create` 或跟踪器的 UI 创建五个状态标签和两个类别标签，一次，它就会停。issue 链接了一个社区修复分支，未被合并。

**五个状态不够——blocked、deferred 或 implemented 怎么办？**

这是这个技能被提交最多的缺口，三种形态。一个完全明确但等待另一个 issue 关闭的 issue（[#139](https://github.com/mattpocock/skills/issues/139)）——报告者的抱怨是那里的 `ready-for-agent` "技术上正确"但有误导性，所以一个 agent 捡起它并撞墙。被触发器门控、有意但尚不可行动的将来工作（[#297](https://github.com/mattpocock/skills/issues/297)）。以及一个用于"已实现、等待验证"的终结状态，没有它一个 AFK 运行器会重新排队已完成的工单。Matt 已同意 blocked 的情况是真实的，对名字（`blocked` 对比 `paused`）还没决定。其中没有一个已发布。人们使用的变通办法是类别旁边一个仓库本地的额外标签，代价是技能不知道它，让规范状态槽位被诚实的东西占据。一个社区衍生走得更远，添加 `needs-slicing`、`tracking` 和努力标签——那有效，但那是他们的，不是技能的。

**这跟 `/diagnosing-bugs` 有什么不同？**

这里的验证步骤被刻意做得很浅——足够回答"这是真的吗，大致住在哪里"，而不是找根因。当一个 bug 在几分钟内不能按报告者的步骤复现时，诚实的走法是 `needs-info`，或如果你现在想追它，用 [diagnosing-bugs](https://aihero.dev/skills-diagnosing-bugs)。两个技能的文字目前都不提对方；一个用户发现了那条缝，它仍然打开。

**我能把它指向我的整个积压让它跑吗？**

你可以问，但注意它读什么。"show what needs attention" 这一遍是一个便宜的列表，用于*选择*——你挑一个，然后它对挑中的那个收集完整[上下文](https://www.aihero.dev/ai-coding-dictionary/context)。一次跨二十个 issue 运行它，一个 agent 会安静地回退到那个便宜的列表作为它的证据基础，那返回 issue 正文但不返回评论。一个用户正好撞上这个：三个 issue 已经带着一条"已修复，建议关闭"的评论，三个都反而得到新的 agent 简报。如果你想要一个批量通过，明确说明评论必须按 issue 读取。

**它和 Linear 或 GitHub Issues 之外的任何东西一起工作吗？**

能——跟踪器是配置，不是一个硬编码的假设，人们对照 Linear（通过 `linear` CLI）、GitLab 和 `.scratch/` 下的纯 markdown 文件运行它。一个常见的拆分是 issue 和规划用 Linear、代码和 PR 用 GitHub：说"issue tracker"的技能映射到 Linear，说"PR"的技能映射到 GitHub。在本地 markdown 跟踪器上有一个开放模板 bug，生成的文件可以携带验收标准两次，一次在顶层，一次在 agent 简报内部（[#200](https://github.com/mattpocock/skills/issues/200)）。

## 正常工作的标志

- 它触碰的每个条目以一个类别角色和一个状态角色结束——从不零个，从不两个冲突状态。
- 它给你一个带推理的推荐并停下，而不是重新打标签就继续。
- bug 被复现了，或 PR 被 checkout 并运行了，在任何东西到达 `ready-for-agent` 之前。
- 它写的简报点名类型和行为，不含文件路径、不含行号。
- 一个六个月前被拒绝的请求回来了，它说出来并引用旧理由，而不是重新分流它。
- 它发布的每条评论以 `> *This was generated by AI during triage.*` 开头。

## 在流程中的位置

`triage` 是一个**入口匝道**，不是主链中的一步。主流程从你有的一个想法运行——访谈、规格、工单、实现、审查——而 `triage` 是*到达的*工作的平行车道。它在同一个地方合并：一个标记为 `ready-for-agent`、带着简报的 issue，[implement](https://aihero.dev/skills-implement) 捡起它，正如它会捡起来自 [to-tickets](https://aihero.dev/skills-to-tickets) 的一张工单。当一个请求在被简报之前需要磨锋利时，`triage` 一起运行 [grilling](https://aihero.dev/skills-grilling) 和 [domain-modeling](https://aihero.dev/skills-domain-modeling)，一次一轮问题，所以决策在做出时落进 `CONTEXT.md` 和 ADR。当你不确定自己在哪条车道时，[ask-matt](https://aihero.dev/skills-ask-matt) 为你路由。
