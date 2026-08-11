## 它做什么

`codebase-design` 固定你设计模块时用的词：**模块**、**接口**、**深度**、**接缝**、**适配器**、**杠杆**、**局部性**。它精确定义每一个，禁止松散的替代词（"组件"、"服务"、"API"、"边界"），并陈述从它们推出的少数几条原则。

它是参考，不是流程。没有要运行的循环、没有它产出的工件、没有它问你问题的地方。每一个触及设计的其他技能都借用它的词汇；单独使用时它给你语言然后停下。那是你在调用它之前要了解的事，因为一个没有流程和停止规则的技能，如果你把[会话](https://www.aihero.dev/ai-coding-dictionary/session)指向它说"开始"，它会即兴编一个——见下面的问题。

## 何时使用

输入 `/codebase-design`，或当一个设计任务合适时 agent 自动触发它。

当你已经知道你在重新设计哪个代码、需要思考它的形态时取用它：接缝放哪里、接口能多小、一个提取是否在赚它的养料。它也是你在解决一个词意味着什么的争论时取用的东西。

几个技能紧挨着它。你要哪个取决于实际问题是什么：

| 问题 | 技能 |
|---|---|
| 一个模块的形态——它的接口、它的接缝、它的深度 | `codebase-design` |
| *领域*的*词*——"account"意味着三件事，两个人对"cancellation"意味着不同的东西 | [domain-modeling](https://aihero.dev/skills-domain-modeling) |
| 你还不知道要重新设计*哪个*模块 | [improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture)——寻找候选者的勘察 |
| 你想让设计被争论，而不仅仅是被命名 | [grilling](https://aihero.dev/skills-grilling) |
| 有一个具体的行为要构建，你想要在重构中存活的测试 | [tdd](https://aihero.dev/skills-tdd) |

## 词汇

词汇表就是技能。每个术语都对照其他术语定义，而且每个都带着它替换的词。

| 术语 | 它意味着什么 | 别说 |
|---|---|---|
| **模块** | 任何有接口和实现的东西。刻意地尺度无关——一个函数、一个类、一个包、一个跨越层的切片。 | unit, component, service |
| **接口** | 调用者正确使用它必须知道的一切：类型签名，加上不变量、排序约束、错误模式、所需配置、性能特征。 | API, signature |
| **深度** | 接口处的杠杆——一个调用者或测试每学一个单位的接口能锻炼多少行为。**深**：大量行为在一个小接口后面。**浅**：接口几乎和实现一样复杂。 | — |
| **接缝** | Michael Feathers 的术语：一个你可以改变行为而不在那个地方编辑的位置。它是接口的*位置*，而把它放在哪里是它自己的决策，与什么放在它后面分开。 | boundary |
| **适配器** | 在接缝处满足接口的具体东西。命名一个角色，而不是一种物质——一个内存假件和一个 Postgres repo 都是适配器。 | — |
| **杠杆** | 调用者从深度得到的东西：每学一个单位的接口获得更多能力。 | — |
| **局部性** | 维护者从深度得到的东西：变更、bug 和验证集中在一个地方。修复一次，处处修复。 | — |

深度刻意地*不*定义为实现行数对接口行数的比率，那是 Ousterhout 自己的定义。那个度量奖励填充实现。这里改用深度即杠杆。

## 四条原则

- **深度是接口的属性，不是实现的。** 一个深模块可以从内部由小的可替换部件构建。它们只是不浮出到调用者。一个模块可以有它自己测试使用的内部接缝，和它接口处的一个外部接缝。
- **删除测试。** 想象删除模块。如果复杂性消失了，它是透传。如果它重新出现在 N 个调用者上，它是在赚它的养料。
- **接口就是测试表面。** 调用者和测试穿过同一个接缝。如果你想测试到接口*之外*，模块就是错误的形态。
- **一个适配器意味着一个假设的接缝。两个适配器意味着一个真实的接缝。** 在有东西真正跨它变化之前，不要切一个接缝。单适配器的接缝只是间接层。

两个辅助文件更进一步，技能按需读取它们而不是提前读。[DEEPENING.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/DEEPENING.md) 分类候选者的依赖——进程内、本地可替换、远程但自有、真正外部——因为类别决定深化的模块如何跨它的接缝被测试。[DESIGN-IT-TWICE.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/DESIGN-IT-TWICE.md) 生成并行[子代理](https://www.aihero.dev/ai-coding-dictionary/subagent)为同一个模块产出三个或更多截然不同的接口，然后在深度、局部性和接缝位置比较它们。

## 常见问题

**我怎么在 TypeScript 里实际构建一个深模块？**

这是关于这个技能被问最多的问题，技能不回答它。它定义深模块*是*什么；它完全没说如何阻止一个迷路的导入越过接口。[Issue #458](https://github.com/mattpocock/skills/issues/458) 直白地说："假设我们对接口满意，它隐藏了细节，等等。但我们怎么强制它？我认为没有 lint 或清晰的护栏，人类和 LLM 都会随着时间把它弄乱。"Matt 在那个线程里的答案有三个选项：把它包在类或 IIFE 里并接受类变得巨大；在 monorepo 里做成一个包并接受 monorepo 工具链；或使用像 [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) 这样的 linter 禁止绕过接口的导入。他另外说过 Effect 是最好的机制、dependency-cruiser 是第二好的。仓库的 `in-progress/` 桶里有一个 `setup-ts-deep-modules` 技能，它铺设 `src/packages/<name>/index.ts` 约定，但它是没有文档页的 beta 渠道技能，而且没有随它发布 lint 规则。

**我把一个会话指向它，它烧了 100k [token](https://www.aihero.dev/ai-coding-dictionary/token) 重新设计我从未问过的东西。**

已知，已作为 [issue #449](https://github.com/mattpocock/skills/issues/449) 提交。技能是模型调用的，把自己描述为词汇，但里面没有任何东西硬性阻止 agent 把它当作可运行流程。"在 /codebase-design 中继续并驱动开放决策"——一个 agent 够到它最能找到的行动形状的内容——`DESIGN-IT-TWICE.md` 中的并行子代理——重新探索了先前会话已经绘制过的代码，并在问任何问题之前跑了一大段路。一个驱动技能拥有的护栏（检查点、一次一个问题、不自动前进）这里一个都没有，因为参考没有。变通办法是点名一个驱动技能，让这个坐在它下面：`/grill-with-docs`、`/improve-codebase-architecture` 或 `/tdd` 把 `codebase-design` 当作词汇。issue 是打开的。

**`design-an-interface` 去哪了？有一个 `/interface-design` 技能吗？**

`design-an-interface` 被移除并吸收进这个技能。没有丢失任何东西：它的"设计两次"技巧——生成截然不同设计的并行子代理，来自 Ousterhout——作为 `DESIGN-IT-TWICE.md` 在这里发布。另外，几个人要求一个专门的 `/interface-design` 技能用于深模块/薄接口哲学；那个哲学已经在这里了，而且没有计划单独的技能。如果你来找这两个名字中的任何一个，这就是那页。

**这不是一个文件结构约定——文件夹、barrel 文件、特性切片吗？**

不是，而且技能在反复推回之下坚持那条线。[Issue #95](https://github.com/mattpocock/skills/issues/95) 提议一个正式化的分形树文件结构作为深模块的具体实现；回答是两者是正交的——"深模块是关于接口的设计和通过严格接口访问，无论文件系统看起来什么样。用这种方法拥有浅模块似乎完全可能。"同样的出现在 #458："我想你可能把模块的概念太紧地绑到文件系统上。文件系统当然可以是模块形态的有用提示，但没有必要在构建深模块时使用文件系统。"词汇表故意把**模块**定义为尺度无关。

**`tdd` 真的使用这个词汇吗？**

现在用了。很长一段时间没有。过去住在 `tdd` 内部的内联深模块笔记在 v1.0 被移除，换成这个共享技能，但替换它们的指针从未添加——所以 `tdd` 为自己定义"接缝"，什么都不引用。这个缺口被补上了：指针现在在技能里，当接口形态是开放问题而不是测试时被触达。`tdd` 仍然拥有"接缝"作为你*测试*的边界；这个技能拥有它后面的模块形态。

**设计两次模式在 Claude Code 之外能用吗？**

不干净。`DESIGN-IT-TWICE.md` 说"用 Agent 工具并行生成 3+ 个子代理"，那是 Claude Code 用 Claude Code 的名字称呼它的[工具](https://www.aihero.dev/ai-coding-dictionary/tool)。仓库为其他 [harness](https://www.aihero.dev/ai-coding-dictionary/harness) 发布元数据，包括 Codex，而那些可能在该名字下什么都不暴露——所以并行设计阶段不如技能的元数据所暗示的那么可移植。记录在 [issue #564](https://github.com/mattpocock/skills/issues/564)，开放中。

**我能把我自己的概念加进词汇表吗——connascence、模块机密、[渐进式披露](https://www.aihero.dev/ai-coding-dictionary/progressive-disclosure)？**

人们恰好提议过那些。[Issue #180](https://github.com/mattpocock/skills/issues/180) 添加 Parnas 的模块机密和 Page-Jones 的 connascence 作为*什么*跨接缝泄漏的命名层，带一个有效的 diff 附加；[issue #303](https://github.com/mattpocock/skills/issues/303) 提议在实现内部渐进式披露，这样在公开接口处深的模块在下面不是一个未分化的块。两者都开放未合并。发布的词汇表故意很小，而且它保持小的原因在技能本身中陈述：一致的语言就是全部关键，而一个没人一致使用的术语比没有术语更糟。

## 正常工作的标志

- 设计对话停止产出"组件"、"服务"和"边界"这些词，开始产出"模块"、"接口"和"接缝"。
- 有人能指向一个提议的提取，说出它是否通过删除测试，而不含糊。
- 一个提议的接缝带着一个指名的第二个适配器，而不只是第一个。
- 关于接口的讨论覆盖不变量、排序和错误模式——而不只是类型签名。
- 调用它不启动一个会话。如果 agent 仅凭 `/codebase-design` 就开始读文件、提议重构，它就是把参考误认成了驱动。

## 在流程中的位置

`codebase-design` 是一个**随时可取的独立项**，是工程技能底下的词汇层，而不是任何链中的一步。它最近的邻居是 [domain-modeling](https://aihero.dev/skills-domain-modeling)，是*问题领域*词的并行参考，而不是模块形态的——两者通常一起需要，因为好好命名一个深模块两者都要。[improve-codebase-architecture](https://aihero.dev/skills-improve-codebase-architecture) 是另一个：它勘察代码库寻找深化候选者，并把每一个都用这个词汇表写出，所以它找到模块，而这个技能是你设计它的工作台。当你不确定哪个技能或流程合适时，[ask-matt](https://aihero.dev/skills-ask-matt) 为你路由。
