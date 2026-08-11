## 它做什么

`to-tickets` 拿一份计划、一份[规格](https://www.aihero.dev/ai-coding-dictionary/spec)、或你在其中的对话，把它拆成你的 issue 跟踪器上的一组**[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)**。每张工单声明它的**阻塞边**——必须先完成、它才能开始的其他工单。

每张工单是一颗**曳光弹**：一条穿过变更每一层——schema、API、UI、测试——的窄而完整的路径，落地那一刻就可以独立演示。那是让它与拆分工作的明显方式行为不同的约束，后者是一次切一层、在结束时集成。它也把每张工单定大小为适合单个全新的[上下文窗口](https://www.aihero.dev/ai-coding-dictionary/context-window)，因为拿起工单的是一个从没见过你规格的[会话](https://www.aihero.dev/ai-coding-dictionary/session)。

## 何时使用

你通过输入 `/to-tickets` 调用它——[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 不会自行触发它。

| 你在哪里 | 运行什么 |
| --- | --- |
| 你有一份规格 issue，构建跨越几个会话 | `/to-tickets`，或 `/to-tickets #<spec_issue>` |
| 计划只在对话里，从未写下来 | `/to-tickets` 直接读线程——不需要规格 |
| 整个变更适合一个上下文窗口 | [implement](https://aihero.dev/skills-implement)——跳过工单 |
| 什么还没决定 | [grill-with-docs](https://aihero.dev/skills-grill-with-docs)，然后 [to-spec](https://aihero.dev/skills-to-spec) |
| 一张 [wayfinder](https://aihero.dev/skills-wayfinder) 地图已清晰 | 先 [to-spec](https://aihero.dev/skills-to-spec) 折叠地图，然后 `/to-tickets` |

`to-tickets` 产出的工单构造上就是 agent-ready 的。不要对它们运行 [triage](https://aihero.dev/skills-triage)——分流是给从别人那里到达的工作的。

## 前提条件

`to-tickets` 发布进一个跟踪器，所以 [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) 必须已经为本仓库配置了一个，连同分流标签词汇。两种都可以：像 GitHub 或 Linear 这样的真实跟踪器，或 `.scratch/` 下的本地 markdown 文件，开箱即支持。

## 曳光弹，不是层

一个**水平**切片发布变更的一层。在每一层都落地之前没有东西工作，而且每张工单的验收标准不得不伸进另一张工单拥有的工作。一个**垂直**切片——曳光弹——一次发布一条穿过所有层的薄路径，所以它可以单独验证，并拥有它评分的一切。

这是人们最常打破的规则，后果被充分记录。一个团队跑了一个按层切片的 26 张工单堆栈——corpus、producer、aggregator、selector——得到每张关闭工单大约二十次 agent 运行，其中大约四分之三是返工。他们自己的复盘把每个失败类追溯回水平切片而不是实现。

在发布任何东西之前有两件事发生。`to-tickets` 寻找预重构——"让变更变容易，然后做容易的变更"——并把那工作排在最前。然后它把拆解作为编号列表呈现，并就此考问你：粒度对吗、阻塞边是真的吗、有什么该合并或拆分。在你批准之前没有东西到达跟踪器，而那场考问是推回的地方。

## 阻塞边

边是工件的关键。它们根据跟踪器有两种读法：

| 跟踪器 | 边住在哪里 | 你怎么处理它们 |
| --- | --- | --- |
| 本地 markdown | `.scratch/<feature>/issues/<NN>-<slug>.md` 下每张工单一个文件中的文本，阻塞者在前编号 | 从上到下，手工 |
| 真实跟踪器（GitHub、Linear） | 原生阻塞链接，或跟踪器有时的子 issue | 任何阻塞者已完成的工单都在**前沿**上，可以拿取 |

边无论哪种方式都住在工单里。媒介只决定是否有东西能并行对它们行动。`to-tickets` 产出工件；运行它——一次一个会话，或一个舰队——是你的工作，不是技能的工作。

## 宽重构例外

一种形态打破曳光弹规则。一个**宽重构**是一个单一机械变更——重命名一列、重打一个共享符号——其**爆炸半径**扩散到整个代码库，所以一次编辑破坏数千个调用点，没有垂直切片能落地变绿。

`to-tickets` 把它排序为**扩展–收缩**：

- **扩展**——在旧形式旁边添加新形式，所以什么都不破坏。
- **迁移**——按爆炸半径分批把调用点移过去（按包、按目录），每批一张工单，每张被扩展阻塞。CI 保持变绿，因为旧形式仍然存在。
- **收缩**——一旦没有调用者残留，删除旧形式，在一张被每个迁移批阻塞的工单中。

即使分批也无法单独保持变绿的地方，它们共享一个集成分支，都阻塞一个最终的集成-验证工单。变绿只在那个承诺。

## 常见问题

**它为一个三行变更产出十二张工单。**
过度分解是关于这个技能被报告最多的摩擦，而且它在实践者之间一致：[模型](https://www.aihero.dev/ai-coding-dictionary/model) 默认原子单元，失去会让它们有意义的聚合。考问步骤正是为此存在——让它合并，它会合并。更深的答案是工单有一个地板：如果整个变更适合一个上下文窗口，你根本不需要这个技能。直接去 [implement](https://aihero.dev/skills-implement)。

**工单每层一个——所有 schema 在一个、所有 API 在另一个。**
这是垂直切片规则所反对的失败，技能有时仍然产出它。在考问步骤每张工单问一个问题来抓住它：这个完成后我能演示什么？没有答案的工单是水平切片。一些人为此给每张工单加一个"demo path"行，并报告它把模型推向垂直分解。

**在 GitHub 上工单没有被创建为规格 issue 的子 issue。**
已知且未修复。它已被跨十几次运行和几个模型报告，[最完整在 issue #554](https://github.com/mattpocock/skills/issues/554)，在 Codex 上比在 Claude 上更糟。`gh` 从 v2.94 起原生支持这个：`gh issue create --parent <n>`，以及事后的 `gh issue edit <parent> --add-sub-issue <n>`。在跟踪器模板偏好那些之前，运行后自己接线父链接是可靠的做法。

**"Blocked by" 被写进 issue 正文而不是真实的阻塞链接。**
同类问题，[在 issue #513 报告](https://github.com/mattpocock/skills/issues/513)，那里 agent 甚至断言 GitHub 根本没有原生阻塞关系。它有——`gh issue create --blocked-by 12,15`。因为阻塞者先被发布，它们的编号在创建时总是可用。正文文本是被设计为没有原生边的跟踪器的回退，不是默认。

**本地工单去哪了？v1.1 的说明说一个根级 `tickets.md`。**
它们有过，而那是 bug——一个单一共享文件在并行 agent 写入它时也会竞态。本地模式现在在 `.scratch/<feature-slug>/issues/<NN>-<slug>.md` 下每张工单写一个文件，按依赖顺序，匹配本地跟踪器模板已经描述的布局。`NN` 前缀是一个真实的工单 ID，所以 `/implement 03` 有效，而不是重新打一个长标题。

**它读我的规格时一直截断。**
一个非常大的规格可以长到超出跟踪器 issue 能干净返回的，而且没有本地副本可回退——agent 然后烧[工具调用](https://www.aihero.dev/ai-coding-dictionary/tool-call)重新获取块，从不到达结尾。不要在 `/to-spec` 和 `/to-tickets` 之间[清除](https://www.aihero.dev/ai-coding-dictionary/clearing)或[压缩](https://www.aihero.dev/ai-coding-dictionary/compaction)。在同一个上下文窗口运行它们，规格根本不需要被取回。

**验收标准什么也没评分——有些在任何工作完成之前就通过了。**
模板要求标准，没说什么关于它们是否能失败，所以这会发生。三种形态重复出现：一个在基 commit 时已经为真的标准、一个只能由另一张工单拥有的工作满足的标准、以及一个重述请求而不是从工件推导出来的标准。垂直切片防止了大部分——一个交付了以前不存在的行为的切片，构造上在基 commit 时就是红的——但值得手工做这个检查。对每个标准，点名一个会显示它为假的观察，并确认它在实现者开始的 commit 处失败。

**工单发布了。我怎么实际运行它们？**
技能停在工件，没有自动调度模式。调度是手动的：看板、数没有打开阻塞者的工单、开那么多 agent 会话。每张工单一个全新上下文，之间清除。要知道 [implement](https://aihero.dev/skills-implement) 在完成时不可靠地关闭或勾掉工单，在 GitHub 上或在本地 markdown 中，所以工单的状态由你更新。

## 正常工作的标志

- 每张工单有对"这个完成后我能演示什么？"的回答——而答案是一个行为，不是一层。
- 列表在发布之前以编号回到你那里，每张带一个"Blocked by"行。
- 顶部的工单没有阻塞者，可以立即开始。
- 工单正文中的任何东西不是文件路径或行号，除了原型产出的片段。
- 每张工单读起来像全新会话能在你不在场的情况下完成的东西。
- 预重构，如果找到任何，在顺序的最前面，而不是混进特性工单。

## 在流程中的位置

`to-tickets` 是主构建链中的一步：

```txt
grill-with-docs → to-spec → to-tickets → implement → code-review
```

上游是 [to-spec](https://aihero.dev/skills-to-spec)，它递给它一份已落定的规格来切片——把两者保持在一个不间断的上下文窗口中。下游是 [implement](https://aihero.dev/skills-implement)，它在每个全新会话构建一张工单，驱动 [tdd](https://aihero.dev/skills-tdd) 做测试，并用 [code-review](https://aihero.dev/skills-code-review) 收尾。当你不确定哪个技能或流程合适时，[ask-matt](https://aihero.dev/skills-ask-matt) 为你路由。
