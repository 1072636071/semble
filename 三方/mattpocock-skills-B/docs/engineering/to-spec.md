## 它做什么

`to-spec` 把你刚有的对话转化为一份[规格](https://www.aihero.dev/ai-coding-dictionary/spec)，并作为单个 issue 发布到你的 issue 跟踪器。

它不访谈你。到你取用它时，决策已经完成，所以它综合已知的东西——从线程、从代码库、从你的 `CONTEXT.md` 和 ADR——而不是打开新一轮问题。规格是已经做出的决策的记录，不是做新决策的地方。

## 何时使用

你通过输入 `/to-spec` 调用它——[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 不会自行触发它。

当构建对一个 agent[会话](https://www.aihero.dev/ai-coding-dictionary/session)太大、必须存活于被拆到几个会话时取用它。那就是全部触发：

| 你在哪里 | 运行什么 |
| --- | --- |
| 你还没决定任何东西 | 先 [grill-with-docs](https://aihero.dev/skills-grill-with-docs) |
| 已决定，工作适合一个[上下文窗口](https://www.aihero.dev/ai-coding-dictionary/context-window) | [implement](https://aihero.dev/skills-implement)——跳过规格 |
| 已决定，工作跨越几个会话 | `/to-spec`，然后 [to-tickets](https://aihero.dev/skills-to-tickets) |
| 一张 [wayfinder](https://aihero.dev/skills-wayfinder) 地图已清晰 | `/to-spec #<map_issue>` |

## 前提条件

`to-spec` 把规格作为 issue 发布，所以 [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) 必须已经为本仓库配置了跟踪器和分流标签词汇。两种都可以：像 GitHub 这样的真实跟踪器，或 `.scratch/` 下的本地 markdown 文件，开箱即支持。

## 规格是决策记录

规格存在是因为上下文窗口会结束。你在[访谈](https://www.aihero.dev/ai-coding-dictionary/grilling)时落定的每样东西——解决方案的形态、你争论过的选择、你刻意拒绝的——都在一个即将被清除的对话中。规格就是存活过那个的东西。

所以它不验证任何东西，也不决定任何东西。它捕获已决定的东西，用你项目自己的词汇，让一个全新会话能在不重新解释的情况下拿起工作。规格断言的任何你从未实际说过的东西都是缺陷。

## 散文之前的接缝

在写一个词之前，`to-spec` 勾画功能将被测试的**接缝**，并和你核对它们。它偏好已经存在的接缝而不是新建，并取它能取的最高接缝——跨一次变更的理想数量是一个。

那些已约定的接缝然后旅行。[tdd](https://aihero.dev/skills-tdd) 只在预先约定的接缝工作，[code-review](https://aihero.dev/skills-code-review) 对照规格审查 diff，所以一个没人同意的接缝会作为审查发现出现。绑定是间接的——它穿过这份文档运行——那正是为什么接缝对话值得在这里认真对待，而不是把它推迟到实现。

## 常见问题

**`/to-prd` 去哪了？**
它就是这技能，在 v1.1 重命名。"Spec" 现在是唯一的贯穿线术语，旧的 `to-prd` slug 死了——在新名字下重新安装。替换旧词汇的那对是*spec* 和*tickets*：规格是目的地和固定它的决策，[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)是到达那里的执行步骤。如果你转向，删除未完成的工单，保留规格。

**为什么规格得到 `ready-for-agent` 标签？我不想要 agent 基于它实现。**
标签意味着"不需要进一步分流"——文档完整到 agent 可以从它工作。它是一个输入指定，不是工作订单。但如果你运行轮询 `ready-for-agent` 的[AFK](https://www.aihero.dev/ai-coding-dictionary/afk) agent，那个区别对它们不可见，它们会愉快地尝试在一次运行中构建整个规格，而不是拿起工单切片。这是关于这个技能被报告最多的粗糙边缘。在它改变之前，在你的 AFK agent 提示中显式排除父规格，或在 `/to-tickets` 运行后剥离标签。

**为什么不直接从访谈去 `/to-tickets` 跳过规格？**
通常你应该——规格只在多会话工作上赚它的步骤。它支付的地方是工单是一次性的而规格不是：每张工单为单个全新上下文窗口定大小并被删除或关闭，而规格保持为它们背后的推理所在的唯一地方。在一个单会话变更上那买不到你任何东西，而且你付了一个额外综合步骤，[模型](https://www.aihero.dev/ai-coding-dictionary/model) 可以在那里漂移。去 访谈 → `/implement`。

**我刚完成一张 wayfinder 地图。我喂什么给它？**
主地图 issue——`/to-spec #<map_issue>`，而不是个别的决策工单。[wayfinder](https://aihero.dev/skills-wayfinder) 产出决策而不是交付物，散布在地图上；`to-spec` 是把它们折叠成一份可构建文档的步骤。把地图直接循环进 `/implement` 会扔掉那个折叠。

**规格是给我审查的，还是只给 agent 的？**
主要是给 agent 的，而且它读起来那样——完整、密集、参考繁重。值得你眼睛的部分是接缝和超出范围部分，因为那是两个错误决策最容易捕获、最晚发现最昂贵的地方。通读整个东西是人们的真实抱怨，而且没有摘要模式：诚实的答案是你对规格吃惊的话，访谈太浅了，不是规格太长。

**工单一开始，我保持规格冻结，还是让 agent 重写它？**
没有什么保持它同步，所以实际上它是你那个时刻所知的快照，在实现第一次教你某物的那一刻就过时。工作发布后把它当作一次性的。被设计为存活过它的工件是你的 `CONTEXT.md` 和你的 ADR——如果实现期间学到的东西值得持久，它属于那里，不属于一份编辑过的规格。

**我的工作是重构或模块边界，不是功能。模板合适吗？**
不太合适，这是一个已知限制。模板大力依赖用户故事，那是架构工作的错误形态——你最终在真正关于接口和不变量的决策周围写没人要的故事。改依赖实现决策和测试决策部分，并让持久的架构调用通过 [grill-with-docs](https://aihero.dev/skills-grill-with-docs) 作为 ADR 落地，而不是试图让规格携带它们。

**它会检查跟踪器寻找相关工作，或引用它尊重的 ADR 吗？**
两个都不会。它读取并尊重覆盖它触碰区域的 ADR，但它不链接它们，而且它在起草前不搜索跟踪器寻找重叠的 issue——所以一份规格可以悄悄重复某人已经提交的工作。如果区域很忙，你自己先搜索跟踪器。

**`/to-tickets` 读不了我的规格——它一直截断。**
非常大的规格可以长到超出跟踪器 issue 能干净返回的，而且没有本地副本可回退。修复是上下文卫生：不要在 `/to-spec` 和 `/to-tickets` 之间[清除](https://www.aihero.dev/ai-coding-dictionary/clearing)或[压缩](https://www.aihero.dev/ai-coding-dictionary/compaction)。在同一个窗口运行它们，规格根本不需要被重新获取。

## 正常工作的标志

- 它开始写而不是问你新一轮问题。
- 它在写之前把接缝摆给你，并提议它能逃脱的尽可能少的接缝。
- 它用你项目的名词回来，而不是通用的产品管理套话。
- 其中每个决策都是你记得做出的。没有东西被发明来填一个部分。
- 超出范围部分有真实的东西——你拒绝的东西通常是页面上最有用的行。

## 在流程中的位置

`to-spec` 是主构建链中的一步，而且只在它的多会话分支上：

```txt
grill-with-docs → to-spec → to-tickets → implement → code-review
```

它上游的邻居是 [grill-with-docs](https://aihero.dev/skills-grill-with-docs)，它做这个技能只记录的决策，以及 [wayfinder](https://aihero.dev/skills-wayfinder)，它已完成的地图就在这并入链条。下游，[to-tickets](https://aihero.dev/skills-to-tickets) 把规格切成曳光弹工单给 [implement](https://aihero.dev/skills-implement) 构建。当你不确定哪个技能或流程合适时，[ask-matt](https://aihero.dev/skills-ask-matt) 为你路由。
