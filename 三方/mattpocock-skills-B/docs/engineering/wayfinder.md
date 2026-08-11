## 它做什么

`wayfinder` 拿一项对一个 agent[会话](https://www.aihero.dev/ai-coding-dictionary/session)来说太大的努力——一个你能叫出**目的地**的名字、但还看不到**路线**的想法——把它绘制为你的 issue 跟踪器上一张**决策工单**的**共享地图**，然后一次解决一张，直到道路清晰。

它规划，它不做。每张工单持有一个问题，其解决是一个决策，而不是要执行的构建切片，而且当地图上在某人去构建那个东西之前没有任何东西要决定时，地图就完成了。那一条规则就是区分 wayfinder 工单与普通实现[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)的东西，也是 agent 打破最多的规则。当地图清晰时，wayfinder 交接；它不继续进入代码。

## 何时使用

你通过输入 `/wayfinder` 调用它——[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 不会自行触发它。

它是整套中最重、最密集的流程，所以触发很窄：努力必须真正大于一个 agent 会话能容纳的，而且通往目的地的路线必须迷雾重重。拆分是干净的一个：单会话规划用 `/grill-with-docs`，多会话规划用 `/wayfinder`。

| 你面前有什么 | 运行什么 |
| --- | --- |
| 一个范围明确、你能在一口气内落定的功能 | [grill-me](https://aihero.dev/skills-grill-me)，或有一个代码库时的 [grill-with-docs](https://aihero.dev/skills-grill-with-docs) |
| 一个绿地项目，或一个跨越许多会话的构建，路线仍然不清楚 | `/wayfinder` |
| 一个决定已经做完了的线程 | [to-spec](https://aihero.dev/skills-to-spec)——直接跳过地图 |
| 一张已清晰的地图 | [to-spec](https://aihero.dev/skills-to-spec)，然后 [to-tickets](https://aihero.dev/skills-to-tickets) 和 [implement](https://aihero.dev/skills-implement) |
| 一个已经变得太大的现有会话 | 说"hand off to `/wayfinder`"——[handoff](https://aihero.dev/skills-handoff) 桥进一张地图，也桥出 |

绿地不是要求。Wayfinder 被例行用于遗留和半建的代码库，而且可以说在那里更锋利，因为很多迷雾是"这里已经为真的是什么"而不是"我们应该做什么"。

## 前提条件

地图和它的工单住在仓库的 issue 跟踪器上，所以 wayfinder 需要 [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) 铺设的跟踪器接线。那一步写一个"Wayfinding operations"部分，描述地图、它的子工单、阻塞边和前沿查询如何为 GitHub、GitLab 或本地 markdown 表达。Wayfinder 通过你 `CLAUDE.md` / `AGENTS.md` 中的指针解析那份文档，而不是一个固定路径；完全没配置跟踪器时，它回退到本地 markdown 文件。

跟踪器不是装饰。阻塞是让前沿在跟踪器自己的 UI 中*视觉上*渲染的东西，而一个没有原生依赖链接的跟踪器——比如说一个自托管的 Gitea——把 wayfinder 降级为从地图文本推断阻塞者，那有效但需要更紧密的监督。

## 地图、迷雾和前沿

**地图**是一个标记为 `wayfinder:map` 的单个 issue；它的工单是它的子 issue。它是一个**索引，不是仓库**——一个决策恰好存在于一个地方，它的工单，而地图只摘录并链接。一个会话以低分辨率加载地图，按需放大到个别的工单，这正是让地图持续增长而不让每个会话为它的全部历史付费的东西。

四样东西住在它上面：

- **目的地**——到达这张地图尽头是什么样子。命名它是绘图的第一行为，在任何工单存在之前，因为目的地固定了每张工单所度量的范围。
- **Decision so far（已做决策）**——每张已关闭工单一行，每个链接到细节实际居住的地方。
- **Not yet specified（尚未明确）**——**迷雾战争**。你能看出要来的、但还无法锋利表述的决策。迷雾对比工单的检验标准是你能否*现在*精确陈述这个问题，而不是你能否回答它。解决一张工单会清除它前面的迷雾，把现在可明确化的任何东西毕业为新的工单。
- **Out of scope（超出范围）**——被裁定为超出目的地的工作。迷雾只*朝向*目的地聚集，所以超出范围的工作被关闭，从不毕业。

**前沿**是打开的、未阻塞的、未认领的工单——已知的边缘。一个会话通过在做任何工作之前把一张工单分配给自己来认领它，所以被分配者*就是*认领，并发会话跳过它。工单全程用名字引用，绝不用裸的 `#42`；一墙的 issue 编号在叙述中难以阅读。

## 四种决策工单类型

每张工单携带一个 `wayfinder:<type>` 标签，并且要么是**[HITL](https://www.aihero.dev/ai-coding-dictionary/human-in-the-loop)**——与一个能为自己说话的人类一起工作——要么是**[AFK](https://www.aihero.dev/ai-coding-dictionary/afk)**，由 agent 独自驱动。一张 HITL 工单只通过现场交流解决；一个回答自己[访谈](https://www.aihero.dev/ai-coding-dictionary/grilling)问题的 agent 已经打破了它。

| 类型 | 模式 | 何时取用 | 由什么解决 |
| --- | --- | --- | --- |
| `grilling` | HITL | 默认。这个问题可以通过谈透来落定。 | 一个全新会话中的 [grilling](https://aihero.dev/skills-grilling) 加 [domain-modeling](https://aihero.dev/skills-domain-modeling) |
| `prototype` | HITL | "这应该长什么样"或"它应该怎么表现"——一个交谈无法落定的问题。 | [prototype](https://aihero.dev/skills-prototype)，构建的工件从工单作为资产链接 |
| `research` | AFK | 一个工作目录之外的事实阻塞了一个决策。 | 一个[research](https://aihero.dev/skills-research) [子代理](https://www.aihero.dev/ai-coding-dictionary/subagent)，在绘图时发射，在 `research/<name>` 分支上并行烧掉 |
| `task` | 两者 | 没有要决定的，但手工工作阻塞了一个决策——供应访问、注册一个服务、移动数据以便看到它的形态。 | agent 在它能的地方独自完成，否则给人类一份精确的清单 |

`task` 是唯一*做*而不是*决定*的类型，它通过解除一个决策的阻塞来赢得自己的位置——绝不通过交付目的地的一部分。这是实践中出错最多的类型：agent 把它解释为实现步骤，开始在地图内部写产品代码。

研究是*每会话一张工单*规则的唯一例外。

## 常见问题

**这跟 `/grill-with-docs` 有什么不同？我应该先开始哪个？**

会话数，不是项目大小。`/grill-with-docs` 是单会话规划；wayfinder 是多会话规划。如果你能把整个东西装进一个对话，访谈是更便宜更好的工具，而 wayfinder 在那种情况下真正地更慢更密集。社区已经落定的简写：只有当工作不适合单个会话时，wayfinder 才有意义。这是 wayfinder 被问最多的一个问题，而且它一直被问，因为描述没有告诉你自己的任务坐在那条线的哪里——你必须自己判断会话数。

**当它问"目的地"时，它指这个会话的结尾还是所有东西的结尾？**

整张地图——整张地图的目的地，而不只是初始会话。这个问题读起来含糊，因为 wayfinder 定义上就是一个多会话工具，所以一个会话范围的答案从来讲不通。典型的目的地是一份要交接的[规格](https://www.aihero.dev/ai-coding-dictionary/spec)、一个在规划开始前要锁定的决策、一个概念验证、或一个就地做出的变更，如数据迁移。

**地图清晰了。为什么我还需要 `/to-spec` 和 `/to-tickets`——wayfinder 不是已经写了规格、做了工单吗？**

不。Wayfinder 的工单是决策工单，而且到地图关闭时它们也全都关闭了。剩下的是一个充满链接决策的地图，那不是一份构建计划。[to-spec](https://aihero.dev/skills-to-spec) 把那些链接的决策折叠成一份规格——`/to-spec #<map_issue>`——而 [to-tickets](https://aihero.dev/skills-to-tickets) 把它切成曳光弹实现工单。把地图直接循环进 [implement](https://aihero.dev/skills-implement) 跳过那个折叠，丢掉链接的细节。只有当努力结果真正很小时才直接去实现。人们确实运行简化管道并报告它有效；那两个额外步骤给你买一份审查者或同事能读的显式规格工件，你越不单独，它越重要。

**我的 agent 在一个 wayfinder 会话中途开始写生产代码。**

这个技能被报告最多的失败，而且它背后有一个真正的洞。Wayfinder 的"规划，别做"默认可以被地图**Notes** 覆盖——但 Notes 是 agent 写的，所以约束和它的豁免住在同一个文件里，而被约束的一方拥有它。一个用户看着一个 agent 把"这张地图承载执行"写进它自己的 Notes，然后在后面的会话里把它读回来作为它自己的许可，在一个活服务器上构建。没有硬性的技能内停止用于"我指默认。"在那之前：读取任何不是你绘制的图的 Notes，把实现保持在自己的会话里，并把任何看起来像构建一片的 `wayfinder:task` 当作打错类型。

**我绘制了 27 张工单，到第十三张时，其余的都不再有意义了。**

一个真实的、被反复报告的结果，逐字来自一份现场报告。Wayfinder 的默认本能是全面规划，而一张后面的工单靠在前面工单使之失效的假设上的地图，正是技能被指控的那个瀑布陷阱。两件事推回去。把地图的范围限定到一个有界的目的地，而不是整个产品——实践者一致报告，范围限定在一个已定义的 epic 上的地图，比一个蔓延的"implement V1"表现好，而且规划非常巨大的东西本来也不是目标——小步迭代地交付才是。并且**激进地原型化**：路线保持当前的整个原因是，不确定性在实现依赖它之前就被便宜的、具体的工件冲掉。Wayfinder 是"原型最大化"，不是"计划最大化"。

**我能并行处理几张工单吗？**

前沿被构建为向你展示什么可拿取，而阻塞边在那里让并行工作在纸面上安全。实际上一次一张是更安全的默认。同时处理两张访谈工单的用户，在一个会话里被问一个他们刚在另一个会话里回答过的问题，因为会话共享零[上下文](https://www.aihero.dev/ai-coding-dictionary/context)。还有一个关于原型工单的已知缺口：一个 agent 被报告构建三个 UI 变体、自己选了一个、然后关闭工单——选择是你的，技能目前说得不够响亮。如果你确实并行运行，先自己审查依赖图。

**我必须用 GitHub Issues 吗？**

不用——任何 issue 跟踪器都有效。GitHub 是最受支持的路径，因为它的原生子 issue 和阻塞关系正是让前沿不打开地图就可见的东西；GitLab、Linear、Jira 和本地 markdown 都被使用。两个诚实的注意事项。一个没有原生阻塞的跟踪器意味着依赖图从文本推断，需要手动修正。而本地 markdown 把工件放进你的仓库，那不被推荐：把这种材料存放在仓库里倾向于导致意外持久化。开源维护者撞上相反的问题——公开跟踪器被 agent 生成的规划工单填满——而且倾向于选择本地 markdown。

**访谈让人精疲力竭。每个问题三段长。**

这是关于 wayfinder 最锋利的现役抱怨，而且它没被解决。一个用户给出的拆解：啰嗦本身造成决策疲惫，而长度剥离了*为什么*一个问题被问，所以当地图变长时，你失去从决策到决策的链。啰嗦看起来是当前这套[模型](https://www.aihero.dev/ai-coding-dictionary/model)的属性，而不是技能的，而且没有修复落地。流传的实践者缓解：运行更低[推理努力](https://www.aihero.dev/ai-coding-dictionary/effort)，并把你全局 `CLAUDE.md` 中的一句通俗语言指令放进去。无论如何预期在这里花真正的思考——wayfinder 要求你的思考量不是一个缺陷，它大部分就是这个。

**一个我已经关闭的决策结果错了。我编辑旧的工单还是做一张新的？**

没有官方指导，而 agent 的本能没用：它倾向于围绕坏决策设计而不是挑战它，所以你必须手动引导。确实有效的是平实地告诉 wayfinder 什么变了——它更新地图、修正受影响的工单、并在已关闭的上评论。地图中途的范围变更是可恢复的。一张你*设计成*会变的地图是一个范围界定坏味道。

**`decision-mapping` 去哪了？**

它就是这技能，在 v1.1 重命名为 `wayfinder`，以 `/wayfinder` 调用。"决策地图"是行话，也不准确，因为四种工单类型中只有一种真的是单独的决策。重构给技能一个连贯的词汇——目的地、迷雾战争、前沿、地图——而不是一个叠加在顶层上的发明术语。单元保留了"决策"这个词，尽管：一张**决策工单**正是 wayfinder 工单被称呼的方式，正是为了阻止人们把它读作实现工单。

## 正常工作的标志

- 目的地被写下来并在任何工单存在之前达成一致。
- 每张打开的工单读起来是一个问题。任何读作"构建 X"的工单要么打错了类型，要么属于地图的下游。
- 你能看你的跟踪器、不打开地图就看到哪些工单可拿取——那是前沿通过原生阻塞渲染它自己。
- 一个会话解决一张工单、把答案作为解决评论发布、关闭它、并在地图的 *Decisions so far* 上留下一行。然后它停下。
- **Not yet specified** 随时间缩小。一片毕业为工单的迷雾从那个部分消失，而不是同时住在两个地方。
- 当开头的广度优先访谈完全浮不出迷雾时，技能停下并告诉你这项努力小到可以跳过地图。
- 完成地图的会话把你推向一份规格，而不是一个 pull request。

## 在流程中的位置

`wayfinder` 是一个**情境性入口匝道**，不是默认前门。访谈主导的想法 → 发布链仍然是大多数工作开始的地方；wayfinder 是当想法大到单个会话装不下时你爬上去的东西，它在 [to-spec](https://aihero.dev/skills-to-spec) 处合并回那条链，因为一张清晰的地图交接而不是构建。

在底层，它大多是穿着 wayfinder 排程的别的技能：[grilling](https://aihero.dev/skills-grilling) 和 [domain-modeling](https://aihero.dev/skills-domain-modeling) 解决默认工单类型，[prototype](https://aihero.dev/skills-prototype) 解决交谈无法落定的工单，而 [research](https://aihero.dev/skills-research) 作为子代理运行，所以它的阅读从不落进你的会话。[handoff](https://aihero.dev/skills-handoff) 是进出的桥——从一个长过自己的对话进入一张地图，在会话中冒出支线任务时出来。对其他任何东西，[ask-matt](https://aihero.dev/skills-ask-matt) 在整套之上路由。
