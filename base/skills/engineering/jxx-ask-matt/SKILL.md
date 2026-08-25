---
name: jxx-ask-matt
description: 询问哪个技能或流程（flow）适合你的情况——本仓库技能的路由器（router）。
disable-model-invocation: true
metadata:
  version: 1.0.0
---

# 问 Matt

记不住每个技能？问就是了。

一个**流程**是贯穿多个技能的路径。大多数路径沿一条**主流程**运行，两条**入口**汇入其中。其余技能要么独立，要么作为底层词汇层运行。

## 主流程：想法 → 交付

大多数工作走的路线——你有一个想法，想把它构建出来。

1. **`/jxx-grill-with-docs`** — 通过穷追不舍地追问来打磨想法。当你在**工作目录**中工作时从这里开始：它是有状态的，会将学到的内容保留在 `CONTEXT.md` 和 ADR 中。（不在工作目录中工作？用 `/jxx-grill-me`，见独立技能。两者都运行相同的 `/jxx-grilling` 原语；`grill-with-docs` 是会留下文档记录的版本。）**复杂/需跨会话的方案用 `/jxx-grill-with-memorial`**（持久化奏报、中断续接、调查委派、收尾审核）。
2. **分支 — 能否在对话中解决所有问题？** 如果某个问题需要可运行的答案（状态、业务逻辑、需要看到的 UI），则绕行 prototype（prototype 活在自己的目录里，所以对话上下文不随行）：用 **`/jxx-handoff`** 导出对话（它在阶段边界中扮演自己的角色，见[阶段边界](#阶段边界)），然后 **`/jxx-prototype`** 用一次性代码回答问题——保留为 `prototype/<name>` 分支上的主要来源，随时可复访。
3. **分支 — 这是多会话构建吗？**
   - **是** → **`/jxx-to-spec`**（将线程转为 spec），然后用 **`/jxx-to-tickets`** 将其拆分为追踪弹式工单，每个工单声明其**阻塞边**。在本地跟踪器上是 `.scratch/<NN>-<feature>/issues/` 中以 blockers-first 排序的文件（`<NN>` 为从 `01` 起的全局递增顺序号），你手工推进；每个工单启动 **`/jxx-implement`**，**并在工单之间 `/clear`**——每个工单都是自包含的，上一个工单的上下文可以丢弃。
   - **否** → 就在当前上下文窗口中直接 **`/jxx-implement`**。

   无论哪种方式，**`/jxx-implement`** 内部驱动 **`/jxx-tdd`** 来构建每个 issue——逐次红绿循环——然后结束前运行 **`/jxx-code-review`**，对 diff 进行双轴 review（标准 + spec），最后 commit。当你只想用测试优先的方式构建具体行为而不需要完整 spec 时，单独使用 **`/jxx-tdd`**；当你想对照固定点 review 分支或 PR 时，单独使用 **`/jxx-code-review`**。

### 上下文卫生

将步骤 1–3 保持在**一个不间断的上下文窗口**中——不要在 `/jxx-to-tickets` 之前压缩或清除——这样追问、spec 和工单都建立在相同的思考基础上。每个 `/jxx-implement` 随后重新开始，从工单出发工作。

这里的限制是**[智能区域](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**：模型仍能敏锐推理的窗口（最先进模型上约 150k token）。如果会话在 `/jxx-to-tickets` 之前接近此限制，不要在退化状态下继续——在最近的阶段边界 **`/compact`**（见[阶段边界](#阶段边界)）。

## 入口

一些起始情境，产生工作后汇入主流程。

- **Bug 和请求堆积** → **`/jxx-triage`**。它将 issue 推过 triage 角色，产出 agent 可用的 issue，供 **`/jxx-implement`** 稍后拾取。

  triage 仅适用于**你未创建的** issue——bug 报告、收到的功能请求、任何原始传入的内容。`/jxx-to-tickets` 产出的工单已经是 agent 可用的，所以**不要对它们再做 triage**。

- **出了问题** → **`/jxx-diagnosing-bugs`**。针对棘手的 bug：第一眼看不出来的、间歇性 flake、在两个已知良好状态之间悄然引入的 regression。它坚持先建立**紧密反馈循环（feedback loop）**——一个已经能在此 bug 上变红的命令——然后才进行理论分析，再用 regression 测试修复。当复盘发现没有好的接缝来锁定 bug 时，它会交接给 **`/jxx-improve-codebase-architecture`**。

- **一项庞大而模糊的工作——全新项目或大型功能构建，超出一个会话能承载的范围** → **`/jxx-wayfinder`**。当从这里到目的地的路径尚不可见时，它在 issue tracker 上用调查工单绘制一张**共享地图**，逐一解决——产出**决策，而非交付物**——直到迷雾散去、路径清晰。然后它汇入主流程的 **`/jxx-to-spec`**（或者，如果工作实际上足够小，直接到 **`/jxx-implement`**）。**`/jxx-grill-with-docs`** 锐化你在一个会话中能把握的想法，wayfinder 则用于你无法把握的想法。

wayfinder 完成调查后交出接力棒——它自己不构建。汇入主流程后，地图会交给 `/jxx-to-tickets`：每个里程碑成为依赖链中的一个工单（或在需要时成为 epic），`/jxx-implement` 从这里接管。

## 代码库健康

不是功能开发——是维护。

- **`/jxx-improve-codebase-architecture`** — 有空闲时就运行，保持代码库对 agent 友好。它发现**加深模块深度的机会**；选择一个会**产生一个想法**，你可以带入主流程的 `/jxx-grill-with-docs`。它是找到候选者的调查；**`/jxx-codebase-design`**（下方）是你设计选定候选者的工作台。

## 底层词汇

两个模型调用的参考，运行在其他技能*之下*——各自是其词汇的唯一权威来源。当**词语**而非流程是问题时，直接使用它们；或让上面的技能拉取它们。

- **`/jxx-domain-modeling`** — 锐化项目的*领域*语言：挑战模糊术语、解决过载词汇（"account" 承担三个职责）、将难以逆转的决策记录为 ADR。它是 `/jxx-grill-with-docs` 驱动的主动规范，保持 `CONTEXT.md` 为干净的词汇表。
- **`/jxx-codebase-design`** — 深模块词汇（module、interface、depth、seam、adapter、leverage、locality），用于设计模块的*形状*：大量行为隐藏在干净接缝之后的小接口。`/jxx-tdd` 和 `/jxx-improve-codebase-architecture` 都使用它。

## 阶段边界

**`/jxx-handoff`** 是上下文窗口之间的桥梁，双向可用。进入阶段边界——完成工单、复现 bug、阶段关闭、artifact 落地——是一个决策点：带多少上下文过去。阶段边界之外还有日常上下文卫生。完整决策树——continue、`/clear`、`/jxx-handoff`、子 agent、`/compact`，以及何时各用哪个——见 [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md)。

## 独立技能

完全脱离主流程。

- **`/jxx-grill-me`** — 与 `/jxx-grill-with-docs` 相同的穷追不舍的追问，但适用于**不在工作目录中工作**的情况。无状态：不在本地保存任何东西，不构建 `CONTEXT.md`——将决策以 markdown 块形式留在聊天中。用于锐化任何不在仓库中的计划或设计。
- **`/jxx-grilling`** — 两者之下共享的 grill 原语：按轮推进的 frontier 访谈——每一轮提问当前未解决的极小决策集，每个问题附上推荐答案。`/jxx-grill-with-docs` 和 `/jxx-grill-me` 都是它的有状态包装。
- **`/jxx-resolving-merge-conflicts`** — 当 merge 或 rebase 产生冲突时使用。读懂*双方*分支的意图，以保留两者的方式解决冲突。
- **`/jxx-to-questionnaire`** — 当计划需要的答案你（agent）给不出、而你面对的人也不持有这些答案时使用。将待决策项转化为一份措辞中立的问卷，交给持有答案的人填写——去程答案和返程决策都留在文件里。
- **`/jxx-wizard`** — 当有人必须执行手动多步流程（在 Web 控制台点来点去、创建账号、生成密钥、配置 OAuth）时使用。生成一个逐步引导的交互式 bash 向导——向导处理进度展示、确认门、密文输入，并直接写入 `.env` 或 CI 密钥。
- **`/jxx-prototype`** — 一个小型一次性程序，回答一个设计问题：这个状态模型感觉对吗？这个 UI 应该长什么样？它是主流程步骤 2 中的绕行，但在设计问题难以在纸面上解决时随时可用。prototype 完成后会被**捕获**——工作、`NOTES.md` 和交接上下文落在 `prototype/<name>` 分支上，成为主要来源。

- **`/jxx-research`** — 将阅读工作委托给**后台 agent**：它针对**一手来源**调查问题，然后在仓库中留下一个带引用的 Markdown 文件。它阅读时你继续工作。它产出的文件可以带入主流程的 `/jxx-grill-with-docs`——研究为思考提供素材，但不替代思考。
- **`/jxx-teach`** — 跨多个会话学习一个概念，使用当前目录作为有状态工作区。
- **`/jxx-wait-what`** — 当 agent 刚解释了什么而你不理解时：让它用简化的技术英语重讲。
- **`/jxx-writing-for-agents`** — 为 agent 写文档的参考——无论是 AGENTS.md、README，还是技能。技能专用的分支（frontmatter、模型调用 vs 用户调用、路由技能）在 [SKILL-MECHANICS.md](../../productivity/jxx-writing-for-agents/SKILL-MECHANICS.md) 中。

## 前置条件

**`/jxx-setup-matt-pocock-skills`** — 在第一次工程流程之前运行，配置其他技能所依赖的 issue 跟踪器、triage 标签和文档布局。自定义 issue 跟踪器也可使用。
