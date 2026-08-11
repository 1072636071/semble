## 它做什么

`research` 通过阅读拥有答案的来源来回答一个问题，然后在仓库中留下一份带引用的 Markdown 文件。它只从**[首要来源](https://www.aihero.dev/ai-coding-dictionary/primary-source)**工作——官方文档、源代码、规格、第一方 API——并把每个断言追溯回拥有它的来源，所以当 API 自己的文档可达时，它不会重复一篇博客对 API 的叙述。

它不在对话中回答你。输出是一个文件，写在仓库已经保留这类笔记的地方，每个断言上带一个链接。那才是关键：一份你可以反应、可以交给另一个 agent、或可以扔掉的文档，而不是一个在[会话](https://www.aihero.dev/ai-coding-dictionary/session)结束时消失的答案。

## 何时使用

输入 `/research`，或当一个任务变成阅读苦活时[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 自动触发它。

当下一步是从工作目录之外*发现某物*时取用它——第三方 API 如何表现、一份规格实际说什么、一个版本声明是否成立——而且你宁愿不停下自己的线程去做阅读。你需要什么决定哪个技能：

| 你需要什么 | 使用 |
| --- | --- |
| 一个决策在等待的外部事实 | `research` |
| 一个*和你*通过访谈做出的决策 | [grilling](https://aihero.dev/skills-grilling) |
| 一个写进 `CONTEXT.md` 和 ADR 的持久架构决策 | [grill-with-docs](https://aihero.dev/skills-grill-with-docs) |
| 弄清一个方法在你的代码库中是否有效 | [prototype](https://aihero.dev/skills-prototype) |
| 一个对单个会话太大的计划 | [wayfinder](https://aihero.dev/skills-wayfinder) |

`research` 和 `grill-with-docs` 之间的线是**回来东西的保质期**。研究产出短暂寿命的资产——这个库的认证机制截至本周做什么。一份 ADR 记录你保留的决策。如果你生产的是决策而不是事实，你是在[访谈](https://www.aihero.dev/ai-coding-dictionary/grilling)，不是在研究。

## 委托的苦活

定义性的动作是阅读作为**后台 agent** 运行。你继续工作；它走开、把每个断言追到它的首要来源、写一个 Markdown 文件、报告回来。研究是你委托的苦活，不是你外包的思考——你得到一份可以访谈、计划或设计的文档，而决定仍然由你做出。

委托是不设防的，后台 agent 可以生成它自己的进一步后台 agent。这是技能被记录最好的粗糙边缘。

文件落在哪里由仓库决定，不由技能决定：它匹配任何已经存在的笔记约定，如果没有，它选一个明智的地方并告诉你在哪里。它每次运行写一个文件。

## 常见问题

**它生成了第二个研究 agent——这是设计上会发生的吗？**

不是。这是一个开放 bug，[issue #530](https://github.com/mattpocock/skills/issues/530)。技能告诉它的调用者启动一个后台 agent，但不限制 agent 类型，所以它生成的 agent 是一个持有 `Agent` 工具和相同指令的 `general-purpose` 一个——而且再次触发它们。一个报告者测量单个研究任务在三个重叠运行中花费大约 450k [token](https://www.aihero.dev/ai-coding-dictionary/token)，重复的那个晚了半小时、完全在视野之外完成。它在 Claude Code 之外也复现；同样的嵌套在 Codex 中用 GPT-5.6-sol 被确认。没有发布的修复。用户用一行告诉他们已经是[子代理](https://www.aihero.dev/ai-coding-dictionary/subagent)的 agent 自己完成工作来修补他们自己的已安装副本，那有帮助但是指令级的，不是结构性的。调用后留意你的后台任务列表，停掉重复的。

相反方向的失败也存在：如果你自己的全局指令禁止 agent 重新委托工作，后台 agent 会礼貌地拒绝任务，技能安静地什么都不做。

**文件应该住在哪里——我应该提交它吗？**

技能把文件放在仓库已经保留笔记的地方，除此之外没有意见。社区的那个相当落定：ADR 被保留，研究文件不被保留。它最锋利的版本，来自一个关于这个确切问题的 Discord 线程："ADR 是的。其他一切完成后归档或删除。它否则变成工作的杂物，而且如果你已经漂离规格/研究，它会毒化未来的仓库读取。"一份研究文件记录它被写的那天为真的东西，所以一份过时的比没有更糟。总体而言这些工件并不真正属于 git，而且它们没有规范的家——人们用 Obsidian、一个独立的知识仓库或 issue 跟踪器代替。

**什么算"高信任"的首要来源，谁决定？**

[模型](https://www.aihero.dev/ai-coding-dictionary/model)决定。技能点名合格*种类*的来源——官方文档、源代码、规格、第一方 API——而且没有允许列表、没有领域门、没有验证通过。这是技能首次被提出时最大的反对意见，而且它从未被公开回答："指向垃圾的五个研究子代理只会更快地给你五个自信的错误答案。你怎么门控什么算高信任来源？"你实际拥有的缓解是每个断言上的引用。跟随其中两三个。如果它们落在一个东西的摘要上而不是那个东西本身，运行就失败了它的唯一工作。

**后面的会话会重用先前运行发现的东西吗？**

不会。没有什么自动加载过去的研究文件；它是一份坐在仓库里的文档，直到一个人或一个技能指向它。这被早早提出作为对设计最强的挑战——"价值在于 markdown 变成 agent 以后重新阅读的上下文，而不是抓取本身。一个写一次的死文件只是一个花哨的搜索"——而发布的技能没有解决它。实际上，文件通过被刻意喂进下一步来赚它的养料：把它附加到规格、引用进访谈会话、把一张[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)指向它。

**为什么不就让 agent 去读文档？**

你可以，而一个正好那样说的两行提示是这个技能替换的做法。技能比提示买到的两样东西：它在后台运行，所以你的会话保持它的[上下文](https://www.aihero.dev/ai-coding-dictionary/context)干净，而且首要来源约束和带引用的文件输出每次都同样地出来，而不是取决于你碰巧怎么措辞它。对照一个[harness](https://www.aihero.dev/ai-coding-dictionary/harness)自己的深度研究模式，区别是工件和来源纪律，不是搜索。如果一个两行提示在小题上给你你需要的，用两行提示。

**它什么时候停止阅读？**

技能里没有停止标准，这表现为两个看起来相反但相同的缺口：走得太深的 agent，和广泛覆盖一个主题却漏掉唯一重要的那个具体细节的 agent。一位实践者说成"深度研究技能有时有点太深。而让 agent 研究通常会漏掉关键细节。"界定范围靠你。一个窄的、可回答的问题——一个 API、一个行为、一个版本声明——回来得远比"研究 X"好。

**`/wayfinder` 创建了研究工单——我自己解决那些吗？**

不用，它现在替你触发它们。在 v1.1 以来未发布的变更中，绘图会话为每张研究工单生成一个 `/research` 子代理，并行烧掉它们，在一个一次性的 `research/<name>` 分支上捕获发现，并从工单留一个[上下文指针](https://www.aihero.dev/ai-coding-dictionary/context-pointer)。研究工单是 wayfinder 每会话一工单规则的唯一例外，因为它们是[AFK](https://www.aihero.dev/ai-coding-dictionary/afk)——没有东西等你。那些分支有两个已知问题：子代理被看到从从不打算合并的分支打开一个草稿 PR（[issue #576](https://github.com/mattpocock/skills/issues/576)），而且之后删除分支会破坏工单持有的上下文指针。

## 正常工作的标志

- 你自己的会话继续。如果你坐着看它读，委托没有发生。
- 恰好一个后台任务出现。第二个名字几乎相同的，是嵌套 bug。
- 一个新 Markdown 文件出现，在仓库已经用于笔记的文件夹里，agent 告诉你路径。
- 其中每个断言带一个链接，随机跟随两个落在官方文档、规格或实际源文件上——而不是某人对它的叙述。
- 你能只从文件做出你卡住的决策，而不用自己回去找来源。

## 在流程中的位置

一个随时可取的独立项，喂给思考技能而不是坐在构建链里。它的文件是要带*进*流程的东西：[grilling](https://aihero.dev/skills-grilling) 和 [grill-with-docs](https://aihero.dev/skills-grill-with-docs) 在事实已经摆在桌面上时问更锋利的问，[to-spec](https://aihero.dev/skills-to-spec) 可以对着它综合。 [wayfinder](https://aihero.dev/skills-wayfinder) 是唯一直接调用它的技能，用 `/research` 子代理解决它地图上的每张研究工单。对于整张地图，见 [ask-matt](https://aihero.dev/skills-ask-matt)。
