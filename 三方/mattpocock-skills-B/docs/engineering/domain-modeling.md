## 它做什么

`domain-modeling` 在你设计时构建并磨锋利项目的**统一语言**——挑战一个与词汇表冲突的术语、在你用了模糊的词时强迫一个精确的词、用一个具体场景压力测试一个关系，直到边界精确。

它是**主动**的纪律，不是被动的。读 `CONTEXT.md` 借用它的词汇是任何技能都能做的一行习惯；这个技能是给你*改变*模型的时候。那正是让它打断的原因。它在术语解决的那一刻把它写入 `CONTEXT.md`，在对话中途，而不是在结束时产出整洁的词汇表——因为批量版本是一个[会话](https://www.aihero.dev/ai-coding-dictionary/session)的摘要，而内联版本是会话的实际输出。

## 何时使用

输入 `/domain-modeling`，或当一个任务合适时 agent 自动触发它。实际上，自动调用是技能最薄弱的部分：当 `grill-with-docs` 或 `wayfinder` 说要加载它时，[模型](https://www.aihero.dev/ai-coding-dictionary/model)经常加载 `grilling` 而跳过这个。如果一场[访谈](https://www.aihero.dev/ai-coding-dictionary/grilling)会话运行了，而结束时 `CONTEXT.md` 未被触碰，那就是发生了什么——在另一个技能旁边按名字调用它。

当*词*是问题时取用它：

| 情况 | 动作 |
| --- | --- |
| 两个人对"cancellation"意味着不同的东西 | `domain-modeling`——挑选规范术语，把另一个列在 `_Avoid_` 下 |
| "Account" 在三个文件里干着三份工作 | `domain-modeling`——把它拆成 Customer 和 User |
| 你刚做了一个难以逆转的架构选择 | `domain-modeling`——它提供一份 ADR，如果该选择越过门槛 |
| 模块的*形态*是问题——接缝放哪里、接口有多深 | [codebase-design](https://aihero.dev/skills-codebase-design) |
| 你想在构建之前审问整个计划 | [grill-with-docs](https://aihero.dev/skills-grill-with-docs)，它在底层驱动这个技能 |
| 你想查一个术语而不是改变它 | 什么也不用。读 `CONTEXT.md`。它是一个文件。 |

## 前提条件

提前没有。技能写入两个地方，并惰性创建两者：

- **`CONTEXT.md`** 在仓库根目录，由第一个已解决的术语创建。在根目录有 `CONTEXT-MAP.md` 的仓库中，术语进入地图指向的按上下文 `CONTEXT.md`。
- **`docs/adr/`**，由第一份越过门槛的 ADR 创建。

开始之前什么都不需要存在，也不推测性地创建任何东西。

## 两个工件，两个门槛

词汇表和 ADR 被持有到不同的标准，而混淆它们正是这个技能大多数麻烦的来源。

| | `CONTEXT.md` | `docs/adr/NNNN-slug.md` |
| --- | --- | --- |
| 持有 | 术语。一个东西**是**什么，一两句话，被拒绝的同义词在 `_Avoid_` 下 | 一个决策，一到三句话：上下文、选择、理由 |
| 书写门槛 | 一个模糊术语变得规范 | **全部三个**：难以逆转、没有上下文就出乎意料、是一个真实权衡的结果 |
| 书写时机 | 内联，术语一落定 | 提供，而不是假定 |
| 从不持有 | 实现细节、一份[规格](https://www.aihero.dev/ai-coding-dictionary/spec)、一个便签本、通用编程概念 | 本次会话做出的每个选择的日记 |

错过 ADR 三个测试中的任何一个，就没有 ADR。一个容易逆转的决策只会被逆转；一个不出乎意料的是谁的问题都不是；一个没有真正替代方案的是记录你做了显而易见的事。

`CONTEXT.md` 规则才是真正要抓住的，因为它是现场会破的那个。**它只是一个词汇表，仅此而已。**不加约束，模型会把"写到 `CONTEXT.md`"当作持久化你给出的每个答案的许可，文件变成一个运行中的规格——这是关于这个技能被报告最多的问题，跨多个模型。

## 交叉引用，以及它在哪停止

让技能生效的动作：当你陈述某物如何工作时，它检查代码并浮出矛盾。*"你的代码取消整个 Orders，但你刚说部分取消是可能的——哪个是对的？"* 语言和代码被使之一致，大声地，在任何一个改变之前。

这个限制值得知道。它交叉引用**代码**和已提交的 `CONTEXT.md`/ADR，仅此而已。它不搜索你的 issue 跟踪器，所以一个几个月前在关闭的 issue 中被争论并刻意解决掉的命名冲突会被作为新的浮出。有一个[开放请求](https://github.com/mattpocock/skills/issues/717)要修复这个；在那之前，变通办法是把指令放在你自己的 `docs/agents/domain.md` 里，技能已经读取它。

## 常见问题

**我的 `CONTEXT.md` 有 500 行。1,000。3,000。我该怎么办？**
大小是症状，不是病——文件吸收了从来不是词汇表材料的实现细节和决策。修复是一个直接指令：`/grill-with-docs make my CONTEXT.md more concise and remove any implementation details from it`。对一个臃肿的文件运行它，大部分都会消失。只有文件真正精简、且仍覆盖一个读者不会想同时持有的两个领域时，才取用 `CONTEXT-MAP.md` 拆分；拆分一个臃肿的文件只会给你几个臃肿的文件。技能在这里的指导还不够强，不足以从一开始防止增长，而追踪那个的 issue 仍然打开。

**为什么是 `CONTEXT.md` 而不是 `GLOSSARY.md`？**
这是整个技能集最常争论的命名问题，没有已解决的答案。反对当前名字的理由很好：如果它"只是一个词汇表，仅此而已"，`GLOSSARY.md` 就说明了那一点，而且——正如一位读者所说——"有了 AI agent，一切都是[上下文](https://www.aihero.dev/ai-coding-dictionary/context)"。支持它的理由是地图：`CONTEXT-MAP.md` 指向几个 `CONTEXT.md` 文件读起来很自然，而 `GLOSSARY-MAP.md` 不会，而且 `context` 是 DDD 对模型一个有界区域的常驻词。至少一个人维护一个本地 fork 纯粹为了重命名文件。你也可以这样做，但集合中每个其他技能都找 `CONTEXT.md`，所以重命名意味着修补所有它们。

**`/ubiquitous-language` 去哪了？**
它被移除了，而且它不是被弃用的。它的工作移进了 `domain-modeling`，它持续维护整个模型，而不是从一次对话中倒出一份词汇表。词汇执行变得更有承重性，而不是更少——它现在运行在访谈、分流和绘图之下，而不是作为一个你记得要做的独立通过。

**我如何为一个没有词汇表的代码库得到一份？**
明确地要，而不是等它累积。`/grill-with-docs help me scaffold my existing repo with a CONTEXT.md` 是记录在案的路线；预期一次长时间的审问——一个用户报告在文件成形之前有 50+ 个问题。偶然使用在一个棕地仓库上构建词汇表太慢了。

**我能保留领域模型并用我自己的 ADR 格式吗？**
今天不干净。词汇表一半和 ADR 一半在一个技能里发布，所以一个已建立的 ADR 约定的团队——不同的模板、不同的位置、不同的命名——得到与它家风格冲突的指令。当前的选项是本地复制技能并编辑它，或者在你仓库自己的 agent 文档中覆盖 ADR 约定。把两者分开是一个[开放请求](https://github.com/mattpocock/skills/issues/557)。

**词汇表真的赚它的养料吗？它是又一个要审查的工件，而且它会过时。**
有时它不赚，而且值得对它在哪里诚实。DDD 越接近实现就越没用——回报在上游，在命名和概念对齐中，不在聚合和层仪式中。同义词控制在命名边界上重要：模块名、表名、状态枚举、issue 标题、CLI 命令。在普通散文中它重要得多地少。还有一个活生生的反对意见：领域术语压缩*已经共享它们的人类之间*的沟通，而 agent 对通俗英语的描述做出同样的反应——在那个解读上，词汇表的价值是让你和你的审查者与 agent 在做什么保持一致，而不是让 agent 更好。在一个一天构建上，跳过它。而一份未审查的、agent 编写的词汇表比没有更糟：它变成自信的声音传说是后续会话当作真理的东西。

**它能替我把模糊的提示变成领域语言吗？**
不能，而且没有计划做一个这样做的技能。你自己不理解的一种领域语言一旦写下来就变成无意义的废话。这个技能在你*有*理解之后强制执行精确性——它不制造你没有的词汇。相关的陷阱是不做建模就用领域词：在错误的概念结构上放正确的名词会产生读起来正确、其实不正确的输出。

## 正常工作的标志

- 它打断你的句子，问你说的两个东西中的哪一个，而不是选一个继续。
- `CONTEXT.md` 在对话**期间**改变，而不是在结束时的一阵爆发。
- 它拒绝为你明天可以撤销的东西写 ADR——并说出三个测试中哪个失败了。
- 新条目用一两句话定义一个东西*是*什么，并在 `_Avoid_` 下点名词你放弃的词。
- 当你的代码和你的句子不一致时，它把你的代码引用回来给你。
- `CONTEXT.md` 变短和变长一样频繁。

## 在流程中的位置

`domain-modeling` 是一个**模型调用的参考**，更多时候运行在*其他*技能的*下面*，而不是单独运行。[grill-with-docs](https://aihero.dev/skills-grill-with-docs) 通过访谈会话驱动它，[wayfinder](https://aihero.dev/skills-wayfinder) 在绘制地图时加载它，[triage](https://aihero.dev/skills-triage) 用它让[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)保持项目自己的语言，[improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture) 在决策结晶时调用它。它最近的兄弟是 [codebase-design](https://aihero.dev/skills-codebase-design)：两者是其他一切底下的词汇层，这个为*领域*，那个为模块的*形态*。当你想要纪律而不承诺通常拉入它的任何技能的步骤时，它也可以直接触达。当你不确定哪个技能合适时，[ask-matt](https://aihero.dev/skills-ask-matt) 为你路由。
