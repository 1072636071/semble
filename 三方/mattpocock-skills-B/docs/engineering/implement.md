## 它做什么

`implement` 构建已经被决定的工作。你把它指向一张[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)、一份[规格](https://www.aihero.dev/ai-coding-dictionary/spec)、或你刚在对话中同意的计划，它写代码、在接缝处驱动 [tdd](https://aihero.dev/skills-tdd)、边做边类型检查、在结束时运行 [code-review](https://aihero.dev/skills-code-review)、并提交到当前分支。

它从不重新打开计划。没有访谈、没有澄清轮、没有不同方法的提议。在上游落定的任何东西就是输入，而技能的全部工作就是把它变成一个 commit。那正是把它与对一个全新的[agent](https://www.aihero.dev/ai-coding-dictionary/agent)输入"构建这个"分开的东西——后者会在构建时愉快地重新设计工作。

## 何时使用

你通过输入 `/implement` 调用它——agent 不会自行触发它。它带着 `disable-model-invocation: true` 发布，所以其他技能也不能调用它。无论 [ask-matt](https://aihero.dev/skills-ask-matt) 或 [to-tickets](https://aihero.dev/skills-to-tickets) 在哪儿说"然后每张工单 `/implement`"，那都是给你的指令，不是 agent 会主动做的事。

工作目前住在哪里决定这是否是正确的技能：

| 工作…… | 使用 |
| --- | --- |
| 跟踪器上的一张工单 | `/implement #42`，一个[会话](https://www.aihero.dev/ai-coding-dictionary/session)一张工单，工单之间[清除](https://www.aihero.dev/ai-coding-dictionary/clearing)上下文 |
| 一份规格、尚未拆分、构建跨越会话 | 先 [to-tickets](https://aihero.dev/skills-to-tickets)，然后每张工单 `/implement` |
| 一份规格、构建很小 | 直接针对规格 `/implement` |
| 只在你刚有的对话里，而且仍然很小 | 就在那里 `/implement`，在同一个窗口里 |
| 任何地方都还没写下来 | [grill-with-docs](https://aihero.dev/skills-grill-with-docs)，或没有代码库时的 [grill-me](https://aihero.dev/skills-grill-me) |
| 一个你要测试先行的具体行为，没有规格 | 直接 [tdd](https://aihero.dev/skills-tdd) |
| 已构建，你想检查它 | 直接 [code-review](https://aihero.dev/skills-code-review) |

同会话的情况值得点名，因为技能自己的第一行没覆盖它。`SKILL.md` 说"规格或工单"，这轻轻推着[模型](https://www.aihero.dev/ai-coding-dictionary/model)去找一个不存在的文件。如果计划只在线程里，在你调用时说一声。

## 前提条件

`implement` 提交到你当前所在的分支。它不创建一个，也不问。开始之前检查你在想要工作的分支上。

如果工单来自 [to-tickets](https://aihero.dev/skills-to-tickets)，它们所在的跟踪器由 [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) 配置。`code-review` 读取相同的配置，在收尾时找到来源规格。

## 一次运行做什么

一次运行是五个节拍，按顺序：

1. 读工单或规格，弄出接缝。
2. 在预先约定的接缝处驱动 [tdd](https://aihero.dev/skills-tdd)，一次一个红绿切片。
3. 频繁类型检查，边做边运行单个测试文件。
4. 在结束时运行一次完整测试套件。
5. 运行 [code-review](https://aihero.dev/skills-code-review)，然后提交到当前分支。

一次运行覆盖一张工单。[to-tickets](https://aihero.dev/skills-to-tickets) 产出的工单是曳光弹垂直切片，大小适合单个全新的[上下文窗口](https://www.aihero.dev/ai-coding-dictionary/context-window)，所以预期的节奏是：清除上下文、实现一张工单、提交、再清除。每张工单自包含，那正是让前一张工单的上下文可丢弃的东西。

## 预先约定的接缝

技能运行的想是**接缝**：你在它观察行为、不伸手进去的公开边界。测试住在接缝处。在任何代码被写之前约定的接缝上工作，是让测试持久的东西，因为下面的实现可以被重写而测试不动。

"预先约定"这个词在做真实的工作，它也是技能最弱的关节。`implement` 内部没有任何东西约定接缝。`tdd` 是问的那个技能，它拒绝在未确认的接缝上写测试。所以实际上约定发生在上游的规格中，或运行的第一轮交流中。如果它哪儿都没发生，前提条件从不触发，运行悄悄变成"就写代码"。在规格中点名接缝是阻止那个的东西。

## 常见问题

**它结束了，但我的工单仍然打开，验收标准仍然未勾选。**

正确，而且预期如此。`implement` 没有完成步骤。它在 commit 处结束，从不触碰工作项，在 GitHub Issues 和本地 markdown 跟踪器上都已确认，所以它不是跟踪器集成问题。它也不对 `code-review` 产出的发现采取行动，也不勾选来源 issue 上的 `- [ ]` 框。自己关闭工单并对账标准。这在依赖链上咬得最狠，因为 `to-tickets` 把前沿定义为阻塞者全部关闭的工单。如果什么都不会被关闭，什么都不会变得明显可拿取。

**我能一次指向所有工单，或并行运行几个吗？**

不能。一次调用，一张工单。跨工单队列的批量调度和[子代理](https://www.aihero.dev/ai-coding-dictionary/subagent)展开都被反复要求，两者都不存在。在同一个 checkout 里并排运行几个 `/implement` 会话比不支持更糟：一份现场报告描述了一个会话中的 `git commit --amend` 落在另一个会话的 commit 上、一个 stash 从 `refs/stash` 消失、commit 落在错误的分支上，全在一天下午跨三个 issue。会话共享一个工作目录、一个索引和一个 HEAD。Git worktrees 是社区变通，注意 `refs/stash` 也跨 worktrees 共享，所以单独 worktrees 不修复 stash 情况。如果你今天想要并行，你在自己组装它。

**它能打开一个 pull request 而不是提交吗？**

没内置。它直接提交到当前分支，几个人觉得太急切：代码在它们有机会验证它工作之前就落地了。没有配置标志，没有 PR 模式。人们在调用中覆盖它（"提交到分支并打开一个 PR"）或编辑他们本地的技能副本。

**`code-review` 说它看不到我的变更。**

`code-review` 审查 `git diff <fixed-point>...HEAD`，它排除暂存和工作区变更。`implement` 在提交之前运行它，所以除非已经存在一个临时 commit，那个 diff 里没有东西可审查。多人报告了这个，两边都没修复。先提交，然后对照你分支自的点审查。

另外，有些人刻意根本不想要运行内的审查，因为审查它刚写的代码的 agent 偏向它自己的方案。在一个全新会话里对一个固定点运行 [code-review](https://aihero.dev/skills-code-review) 是合法的替代，也是那个技能在两个独立子代理中运行它的两条轴线的同一个原因。

**一张工单烧了 150k token。我用错了吗？**

可能是工单太大，而不是技能被误用。一次运行做代码库探索、每个接缝一个红绿循环、一个完整套件和一个审查，所以一张非平凡的工单超过 100k [token](https://www.aihero.dev/ai-coding-dictionary/token) 是正常的，而不是出了问题的迹象。杠杆在上游：在 [to-tickets](https://aihero.dev/skills-to-tickets) 中把工单右尺寸化，让每张适合一个全新窗口。如果一张工单持续爆掉，拆分它，而不是提高[努力](https://www.aihero.dev/ai-coding-dictionary/effort)水平。

**全新会话中的 `/implement #2` 做了完全不相关的东西。**

`#2` 对着 agent 能看到的任何编号列表解析，在一个全新会话中那可能是一个 todo 文件、一个清单、或另一个工作列表，而不是配置的跟踪器。解析是自信的而不是 fail-closed，所以错误在它开始之前不明显。传递完整的引用、issue URL 或 `owner/repo#2`，并让它开始之前确认标题回来。

## 正常工作的标志

- 会话以读工单或规格并重述它将构建什么开始，而不是问你要构建什么。
- 你能在追踪中看到一个实际的 `/tdd` 调用，而不只是出现在 diff 里的测试。
- 类型检查和单个测试文件在运行期间反复运行，完整套件在接近结束时运行一次。
- 运行在你当前分支上达到一个 commit，而不用你提示它继续。
- diff 是一张工单的变更量：穿过每一层的一个垂直切片，而不是几张工单扫在一起。

## 在流程中的位置

`implement` 是主链的构建步骤，倒数第二个：

```txt
grill-with-docs → to-spec → to-tickets → implement → code-review
```

它的邻居是 [to-tickets](https://aihero.dev/skills-to-tickets)，它产出它消费的工单并声明决定它们顺序的阻塞边；[tdd](https://aihero.dev/skills-tdd)，它在每个接缝处内部驱动；以及 [code-review](https://aihero.dev/skills-code-review)，它在提交之前运行。它坐在规划技能的下游并信任它们。它不重新验证交给它的东西的形态，所以一张结构不良的地图或一张水平分层的工单会被按原样构建。

那个信任就是为什么 [wayfinder](https://aihero.dev/skills-wayfinder) 在 [to-spec](https://aihero.dev/skills-to-spec) 并入链条，而不是把它的地图直接循环进 `implement`。只有当初结果真的很小，才从地图直接去 `implement`。

当你不确定你在哪个流程中时，[ask-matt](https://aihero.dev/skills-ask-matt) 是整套的路由器。
