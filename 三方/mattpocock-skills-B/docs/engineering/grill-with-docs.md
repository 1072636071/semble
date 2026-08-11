## 它做什么

`grill-with-docs` 关于一个计划或设计访谈你，直到你和[agent](https://www.aihero.dev/ai-coding-dictionary/agent)对它共享一种理解，并在进行中把词汇和硬决策写进你的仓库。它是 [grill-me](https://aihero.dev/skills-grill-me) 运行的同一个访谈——一轮问题、然后等待、然后下一轮——指向一个代码库。

它是**[有状态的](https://www.aihero.dev/ai-coding-dictionary/stateful)**。每个其他访谈技能把[会话](https://www.aihero.dev/ai-coding-dictionary/session)留在你脑子里；这一个在磁盘上留下文件。一个术语被解决，它在解决的那一刻落进 `CONTEXT.md`，而不是在结束时批量处理。一个决策穿过三个闸门，它作为一份 ADR 落地。那就是全部区别，也是人们对这个技能的大部分麻烦的来源：工件是一个真实仓库里的真实文件，所以它们可以在你预期它们时缺席，而且当不止一个人在写它们时会漂移。

## 何时使用

你通过输入 `/grill-with-docs` 调用它——agent 不会自行触发它。

在变更开始时、在一个仓库里、当计划仍然模糊、事情的词还没落定时取用它。它是单会话工具。你要哪个访谈技能取决于你面前有什么：

| 你拥有什么 | 使用 |
| --- | --- |
| 你根本不在工作目录中工作 | [grill-me](https://aihero.dev/skills-grill-me) |
| 一个仓库，和一个你能在单个会话中解决的变更 | `grill-with-docs` |
| 一项太大、单个会话装不下的努力——绿地构建、大型功能 | [wayfinder](https://aihero.dev/skills-wayfinder) |
| 一个完全没有任何领域文档的仓库，也没有特定功能在考虑中 | `grill-with-docs`，瞄准仓库而不是一个变更 |
| 一个被别人脑子里的知识阻塞的决策 | [to-questionnaire](https://aihero.dev/skills-to-questionnaire) |

wayfinder 的拆分归结为会话数：`/grill-with-docs` 用于单会话规划，`/wayfinder` 用于多会话规划。

## 前提条件

技能写入你的仓库，所以你需要在一个安全的地方写入。已解决的术语去根目录的一个 `CONTEXT.md` 词汇表——或者，如果根目录的 `CONTEXT-MAP.md` 把仓库标记为多上下文，去相关上下文的 `CONTEXT.md`。决策去 `docs/adr/`。两者都惰性创建；在第一个术语或决策结晶之前什么都不存在，所以没有要提前搭建的东西。

它还需要另外两个技能在场，因为它自己的 `SKILL.md` 只有一行，委托给它们：[grilling](https://aihero.dev/skills-grilling) 提供访谈，[domain-modeling](https://aihero.dev/skills-domain-modeling) 提供写作。单独安装 `grill-with-docs` 会得到一个不工作的技能。

## 纸质记录

一场会话有三样东西出来，而且它们不相等。

| 什么被解决 | 它落在哪里 |
| --- | --- |
| 一个术语——项目自己对一个东西的词 | `CONTEXT.md`，内联，在它解决的那一刻 |
| 一个难以逆转、没有上下文就出乎意料、且是真实权衡的决策 | `docs/adr/` 下的一个 ADR |
| 你决定的其他一切 | 对话，没有别处 |

第三行是让人措手不及的那一行。`CONTEXT.md` 是一个词汇表，被刻意保持为一个——没有实现细节、没有[规格](https://www.aihero.dev/ai-coding-dictionary/spec)、没有便签。ADR 被同时门控在所有三个条件上，所以大多数决策不合格，大多数会话产出零个。一场产出一个更锋利的词汇表和零 ADR 的会话按设计工作，但它意味着你同意的大部分只存在于你同意它的[上下文窗口](https://www.aihero.dev/ai-coding-dictionary/context-window)中。把那个对话交给 [to-spec](https://aihero.dev/skills-to-spec) 而不是[清除](https://www.aihero.dev/ai-coding-dictionary/clearing)它。

词汇表才是关键。领域语言是这个技能实际在构建的东西——项目自己的词，约定一次，这样你、agent 和你的同事不用再付钱重新推导它们。值得说的是，不是每个人都同意这给你买来 agent 性能：最锋利的公开反对是，一个术语和它的通俗英语展开从[模型](https://www.aihero.dev/ai-coding-dictionary/model)得到相同结果，而词汇真的压缩的是共享它的*人类*之间的沟通。那个解读仍然让词汇表有价值；它只是移动了价值。

## 它假设一个写作者

有状态的输出假设一个人策展它们。一个双开发者团队在一个仓库里跑了四个月，报告在约 20% 抽样的已合并 PR 上状态漂移，ADR 引用和 README 声明是最高的漂移表面——刻意的、人类策展的文档比 agent 记忆漂移得更糟。修剪过时的文档没有维持住；同样的清扫在几天内再次过时。有效的是彻底删除影子状态，并在 CI 中添加一个确定性的引用和链接 linter。

相关：在一个仓库里跨不相关的变更反复运行技能，倾向于累积混合主题的文档，因为没有什么分离一个会话的输出与另一个的。这两个今天在技能中都没有修复。

## 常见问题

**我该用这个还是 `/wayfinder`？**
范围决定它。任何你能在单个会话中解决的东西用这个；当努力太大、单个装不下时用 [wayfinder](https://aihero.dev/skills-wayfinder)，它先把工作绘制为一张决策[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)地图。Wayfinder 更慢更密集，而且在一个范围明确的特性上取用它是常见错误。它不替代这个技能——它可以为适合单会话的地图部分落入一场访谈会话。

**它运行了，但没有 `CONTEXT.md`、没有 ADR 出现。**
两个已知原因。平淡的那个：什么都没有合格。ADR 需要全部三个闸门，而一场关于没有新词汇的变更的会话真的没有东西可写。真正的 bug：当技能在另一个编排层内部运行时——一个规格驱动开发包装器、一个多 agent 框架、一个把它作为别人管道中的一步调用的规则——文件写入那一半被报告为默默地不发生，而访谈仍然运行。这已提交且未修复。如果你在那个设置里，在你信任会话的输出之前检查工作目录。

**它一次性问了一切，没有推荐，而且从不提 `CONTEXT.md`。**
那是技能没能加载它的两个依赖。因为 `SKILL.md` 是一行委托，一个没有拾取 [grilling](https://aihero.dev/skills-grilling) 和 [domain-modeling](https://aihero.dev/skills-domain-modeling) 的 agent 会猜 grilling 意味着什么，你得到一个未分化的问题倾倒。部分加载是更令人困惑的情况——`grilling` 加载，`domain-modeling` 没有，你得到一个好的访谈但没有纸质记录。它与模型和[努力](https://www.aihero.dev/ai-coding-dictionary/effort)水平相关，而且是关于这个技能被报告最多的问题。如果你怀疑它，直接问 agent 它加载了哪些技能。

**我所有其他决策都去哪了？**
只进对话。这是关于这个技能最实质性的开放抱怨：词汇表不是规格，大多数答案不值得一份 ADR，而且没有账本把每个已解决的答案联系到规格、工单和测试。精确的答案——排序保证、负面需求、数字默认值——在下游被软化进较弱的散文，结果可以看起来完整却漏掉你实际决定的东西。今天可用的缓解是保持会话并直接把它喂给 [to-spec](https://aihero.dev/skills-to-spec)，并对照你自己的答案重读规格，而不是假定它捕获了它们。

**我能把它指向一个完全没有任何文档的现有仓库吗？**
能。这是对没有 ADR、没有领域语言、没有设计原则的代码库的正确技能——调用它说"帮我记录我的仓库"。社区模式把它与 [improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture) 配对用于构建或修复 `CONTEXT.md`。预期要引导它：它会读代码并问你在它发现的东西，而你是说代码库中已经有的哪些词是正确的那个的人。

**会话结束时我该做什么？**
技能的收尾信息往往是开放式的，这是一个已知的粗糙边缘。在主流程中答案是 [to-spec](https://aihero.dev/skills-to-spec)，在同一个对话中。如果变更足够小、可以立即构建，直接去 [implement](https://aihero.dev/skills-implement)。

**为什么它叫那个名字？**
没有人对名字满意。有一个开放建议把它重命名为 `grill-domain-model`，那更诚实地描述行为。什么进展都没有。如果重命名有一天落地，文档页随之移动，URL 改变。

## 正常工作的标志

- `CONTEXT.md` 在会话*期间*改变，一个术语一个术语，而不是在结束时作为一个块出现。
- 词汇表读起来是纯粹的词汇——你项目的词带紧致的定义——而且不包含实现细节或类规格的散文。
- 代码库能回答的问题通过读代码库来回答，而不是问你。
- 你得到很少或零个 ADR，而你得到的那些是你宁愿不必重新辩论的决策。
- 它挑战你用过的词，因为你现有的词汇表定义不同。

## 在流程中的位置

`grill-with-docs` 是主构建链的开头：

```txt
grill-with-docs → to-spec → to-tickets → implement → code-review
```

它发生在任何东西被作为规格写下来之前——它产出 [to-spec](https://aihero.dev/skills-to-spec) 然后不访谈你地综合的共享理解和已落定的词汇。它最近的邻居是 [grill-me](https://aihero.dev/skills-grill-me)，同一个访谈但没有仓库和没有文件，以及 [domain-modeling](https://aihero.dev/skills-domain-modeling)，它驱动的词汇表和 ADR 纪律；两者都坐在 [grilling](https://aihero.dev/skills-grilling) 原语上。在它上游，[wayfinder](https://aihero.dev/skills-wayfinder) 绘制对单个会话太大的努力，并能把地图的部分交还给它。当你不确定哪个技能或流程合适时，[ask-matt](https://aihero.dev/skills-ask-matt) 为你路由。
