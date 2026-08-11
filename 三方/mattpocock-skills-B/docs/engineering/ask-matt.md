## 它做什么

`ask-matt` 是本仓库技能的**路由器**。你描述你所处的情况——一个无法开始的创意、一堆涌入的 bug 报告、一场运行了很长时间的[会话](https://www.aihero.dev/ai-coding-dictionary/session)——它会指出适合的技能或技能序列，以及该序列中人类决策所处的位置。

它给出建议并停下。它不会访谈、不会写[规格](https://www.aihero.dev/ai-coding-dictionary/spec)、不会打开文件，也不会触发它刚刚指名的技能；你拿回的是接下来要输入的内容，然后你来输入。它也是一份手写的本仓库技能地图，而不是对你已安装内容的扫描，所以它不会把你路由到你自己的技能或另一位作者的技能上。

## 何时使用

你通过输入 `/ask-matt` 调用它——agent 不会自行触发。

| 你的情况 | 路由器返回什么 |
| --- | --- |
| 一个创意，不知从何开始 | 主线流程的开头，以及构建是否足够小、可以跳过规格 |
| 从其他人那里涌来的 bug 和请求 | [triage](https://aihero.dev/skills-triage) 入口匝道，以及为什么你自己生成的[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)不属于它 |
| 两个看起来可互换的技能 | 它们之间的界线，而且通常是一个具体的测试而不是品味问题。[grill-me](https://aihero.dev/skills-grill-me) 或 [grill-with-docs](https://aihero.dev/skills-grill-with-docs) 取决于你是否在工作目录中；[grill-with-docs](https://aihero.dev/skills-grill-with-docs) 或 [wayfinder](https://aihero.dev/skills-wayfinder) 取决于这项努力是否适合单个会话 |
| 一场长时间的会话和关于[上下文](https://www.aihero.dev/ai-coding-dictionary/context)的决定 | 阶段边界处五个选项的有序决策树 |
| 你已经选好一个技能 | 没用的东西。直接调用那个技能。 |

## 前提条件

路由器说出技能的名字；它不安装它们。它指向的一切都必须已安装，建议才可操作，而且它只知道本仓库中被推广的技能。

依赖跟踪器的路由——triage、`to-spec`、`to-tickets`、`implement`——假定 [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) 已经在本仓库配置了一个 issue 跟踪器。路由器会乐于在这一切发生之前推荐它们。

## 流程，而不是技能

这个技能给你用来思考的词是**流程**：一条穿过*技能*的路径，而不是单个技能。说出你的情况会把你放在一个流程的某一步上，这与"这是匹配你关键词的技能"是不同的答案。存在四种路由，技能本身完整地承载它们：

- **主线流程**，从创意到交付。访谈、规格、工单、实现、审查，内部有两个分支：当一个需要可运行代码才能解决的问题时绕道原型，以及规格-工单拆分——只有当构建跨越多个会话时才值得它的成本。
- **入口匝道**，用于一种产生工作、然后并入主线流程的情况：涌入的 bug 报告、有东西坏了，或一场太迷雾、太庞大、无法在单个会话中容纳的努力。
- **独立项**，脱离所有流程，按它们自己的条件取用——原型、问卷、你正身处其中的合并冲突。
- **底层的词汇层**，另外两个技能在问题出在*词*而不是*流程*时拉入的两个参考。

## 阶段边界

它交给你的另一个想法是**阶段边界**。一个阶段是会话内的一块工作——[访谈](https://www.aihero.dev/ai-coding-dictionary/grilling)、实现、QA——而两者之间的边界是唯一属于"我该拿这个上下文怎么办？"这个问题的位置。阶段中途没有要决定的东西：继续，或把剩余部分拆给[子代理](https://www.aihero.dev/ai-coding-dictionary/subagent)。

| 选项 | 何时采用 |
| --- | --- |
| **继续** | 下一个阶段逐字想要这个阶段，或者你还有[smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)剩余。它是唯一让会话保持为[首要来源](https://www.aihero.dev/ai-coding-dictionary/primary-source)的走法，所以先排除它 |
| **`/clear`** | 身后的一切都是可丢弃的。棋盘上最便宜的走法，如果你错了就是单向的 |
| **[handoff](https://aihero.dev/skills-handoff)** | 有东西要旅行：一个新[harness](https://www.aihero.dev/ai-coding-dictionary/harness)、一个新目录、一个同事、一个阶段中途分叉的附带任务 |
| **子代理** | 任务的范围紧密到可以[离开键盘](https://www.aihero.dev/ai-coding-dictionary/afk)运行 |
| **`/compact`** | 以上都不是。默认项，而且它经常落在这里 |

其中两个经常被弄错，这就是为什么路由器承载的是*顺序*而不是列表。`/handoff` 读起来像是窗口之间的通用桥梁，但它不是：可移植性就是它买到的全部。`/compact` 是树的底部而不是首选，因为它上面的四个问题每个都更便宜或更精确。

## 常见问题

**难道没有一个按正确顺序排列的技能列表吗？**

人们一直在 README 里要一个。这个技能就是那个列表——这就是它存在的意义。一张静态表格会说 `wayfinder → to-spec → to-tickets → implement → code-review`，而且对大多数情况都是错的，因为有趣的部分是分支——有没有代码库、构建是否跨越会话、这个问题能否通过交谈解决。诚实的代价是路由器靠手工维护，落后于仓库。`/grilling` 和 `/resolving-merge-conflicts` 都在路由器点名它们之前很久就发布了。

**它告诉我一半的技能没有安装。**

一个已知 bug，未修复。路由器带你经过的大多数技能设置了 `disable-model-invocation: true`，这意味着 harness 会把它们排除在注入 agent 上下文的技能列表之外。agent 把那个列表当作穷尽的，并报告它们缺失。一份报告提到，一个会话宣布整个规格-工单流程缺失，并改路由到裸的 `/grilling` 和 `/tdd`。插件的二十二个技能中有十三个携带这个标志，所以这是常见情况而不是边缘情况。它们是安装了的。无论如何输入斜杠命令，或检查 `.claude-plugin/plugin.json`——那才是关于存在什么的权威。

**它描述了一个技能的行为，而技能并不那样做。**

也是真的，也没修复。路由器从自己对每个技能的一行摘要来回答，而不是从技能本身。一份详细的报告在单个会话中追踪了三个实例，包括基于"把线程转化为规格"这个说辞而建议跳过 [to-spec](https://aihero.dev/skills-to-spec)——`to-spec/SKILL.md` 从未被打开。在每种情况下，它都只在用户推回之后才验证，而且从不主动。在那里跳过 `to-spec` 代价了一次真实的接缝检查，而且产出的工单低估了工作。当路由器对另一个技能断言某种承重的东西时，要求它先打开那个 `SKILL.md`。同样的道理也适用于地图完全没有覆盖的问题，比如是否使用[计划模式](https://www.aihero.dev/ai-coding-dictionary/agent-mode)：那个答案是[模型](https://www.aihero.dev/ai-coding-dictionary/model)的推断，不是这里写下来的东西。

**为什么是散文而不是编号清单？**

一个合理的抱怨，作为一个开放 issue 提交，主张大部分路由是确定性的，而叙述让它难以扫读。没有什么阻止你要压缩的形式——"只给我序列"就得到序列。散文承载的是条件的一半：分支、哪里期待人类决策、以及在哪里在步骤之间清除或压缩。一张扁平的清单恰好丢掉那些。

**它能路由到我自己的技能，或另一位作者的技能吗？**

不能。三份独立的提案都要求一个读取你本地 `skills/` 目录、从任何已安装的东西中推荐的路由器。`ask-matt` 不是那样的。它是某一套技能的地图，手工维护，对你编写或从别处安装的技能一无所知。

**它告诉我编辑一个 SKILL.md。**

那个建议常常是对的，但很少持久。有人问它如何让 [implement](https://aihero.dev/skills-implement) 关闭工单，被告知向技能添加一行，并立刻发现了问题：`npx skills update` 会覆盖文件，而且插件安装是只读的。把常驻行为放在你自己的 `CLAUDE.md` 或 `AGENTS.md` 里，或写在调用中。提示级适配在更新后仍能存活——把流程指向 Linear 而不是 GitHub，或问哪些打开的工单可以并行运行，都是人们这样做的事。

**它点名了一个我没有的技能，或者漏掉了一个我有的。**

在假定它消失之前先查一下变更日志中的重命名。`writing-great-skills` 变成了 [writing-for-agents](https://aihero.dev/skills-writing-for-agents)（没有别名），`to-prd` 变成了 [to-spec](https://aihero.dev/skills-to-spec)，`pathfinder` 变成了 [wayfinder](https://aihero.dev/skills-wayfinder)。四个技能被直接退休到吸收它们的技能里：`ubiquitous-language`、`design-an-interface`、`qa` 和 `request-refactor-plan`。反过来的情况就是路由器自身的滞后，见上。

## 正常工作的标志

- 它以说出要输入什么结束，并在那里停下，而不是自己开始工作。
- 它给回的路由提到在哪里清除或压缩上下文，以及在哪里期待你审查，而不只是一份技能名列表。
- 在两个技能相近的地方，它说出选哪个以及为什么另一个对你来说是错的。
- 它关于另一个技能行为的任何断言，都会在追踪中显示为它阅读那个技能的 `SKILL.md`。
- 你认出自己在你拿回的东西中的情况，而不是最接近的通用场景。

## 在流程中的位置

`ask-matt` 是一个**独立路由器**，位于整个集合之上。它从不是一个链中的步骤；它指向每一条链，而且它是其他文档页面链接回的那个节点，这样它们谁都不用重画这张图。从这里你最常落到 [grill-with-docs](https://aihero.dev/skills-grill-with-docs)、主线流程的开头，或 [triage](https://aihero.dev/skills-triage)——为*到达的*工作而非你*开始的*工作的入口匝道。

它是它描述的技能之上的[次要来源](https://www.aihero.dev/ai-coding-dictionary/secondary-source)。在路由器与 `SKILL.md` 不一致之处，`SKILL.md` 是对的。
