## 它做什么

`tdd` 测试先行地构建一个功能或修复一个 bug：一个失败的测试，然后刚好足够的代码通过它，然后下一个行为。它携带让那个循环产出值得保留的测试的标准——好测试是什么、测试去哪、mock 是干什么的、以及悄悄毁掉一个套件的三个反模式。

它在你尚未同意的接缝上不写任何测试。在任何测试存在之前，它点名它打算测试的公开边界并停下来等你的确认，因为测试努力是有限的，而这是你把它花在关键路径而不是每个边缘用例上的地方。另一件要知道的事是 `tdd` 是一个**参考**，不是一个驱动。它持有循环的规则，而别的东西（你，或 [implement](https://aihero.dev/skills-implement)）运行应用它们的[会话](https://www.aihero.dev/ai-coding-dictionary/session)。

## 何时使用

输入 `/tdd`，或当一个任务合适时[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 自动触发它——测试先行地构建功能或修复 bug，或当你说"red-green-refactor"时。

当有一个具体的行为要构建、有输入和可观察的输出、而且你想要在重构中存活的测试时取用它。

| 你的情况 | 去哪里 |
| --- | --- |
| 一个输入输出已定义的行为——业务逻辑、请求/响应契约、转换、验证 | `tdd` |
| 行为还没被固定下来 | [to-spec](https://aihero.dev/skills-to-spec)，它在任何代码被写之前也约定测试接缝 |
| 问题真的是接口的形态，而不是测试 | [codebase-design](https://aihero.dev/skills-codebase-design) |
| 你有一份[规格](https://www.aihero.dev/ai-coding-dictionary/spec)或[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)，想要整个构建为你运行 | [implement](https://aihero.dev/skills-implement)，它每张工单驱动 `tdd` |
| 配置、接线、胶水、类型注解、直接的 CRUD 委托 | 这里没有什么合适——见下面的开放缺口 |

最后一行是一个真实的洞，不是风格偏好。技能决定接缝*去哪*；里面没有任何东西决定一个变更*是否*值得这个循环。在一个没有独立事实来源可断言的东西上运行它，你会得到一个重述实现的测试——技能自己警告的同义反复反模式，从另一个方向到达。它是 [issue #746](https://github.com/mattpocock/skills/issues/746)，它打开着。在它关闭之前，那个判断是你的或你 `CLAUDE.md` 的。

## 前提条件

[codebase-design](https://aihero.dev/skills-codebase-design) 需要被安装。`tdd` 过去携带它自己的深模块和接口设计笔记；在 v1.0 那些被删除，换成共享技能，`tdd` 现在靠它提供接口设计词汇。没有其他——技能是[无状态的](https://www.aihero.dev/ai-coding-dictionary/stateless)，不写它自己的文件。

## 循环，以及它运行的接缝

三个词携带这个技能。

**红绿。** 写失败的测试，然后只写足以通过它的代码。不要预判下一个之后的测试。没有重构阶段：它在 2026 年 6 月被删除，因为 agent 实际上从不执行它，而且因为审查和实现作为独立会话工作更好。重构属于 [code-review](https://aihero.dev/skills-code-review)。

**垂直切片。** 一个接缝、一个测试、一个最小实现，然后重复——第一个循环是一颗**曳光弹**，端到端证明一条单一路径。反面是水平切片：先全部测试，再全部代码。批量测试验证*想象中的*行为，它们检查东西的形态而不是用户做什么，而且它们在理解实现之前就让你承诺一个测试结构。

**预先约定的接缝。** 接缝是你观察行为而不伸手进去的公开边界。规则是绝对的：在未确认的接缝上不测试。在完整链中，接缝更早在 [to-spec](https://aihero.dev/skills-to-spec) 期间被约定——"`/tdd` 被告知只在预先约定的测试接缝工作，`/code-review` 检查只有已约定的测试接缝被使用。"单独调用时，`tdd` 直接问你。

它被写来防止的三个反模式：

| 反模式 | 特征 |
| --- | --- |
| 实现耦合 | 当你重命名一个内部函数、但行为没变时测试会断。mock 内部协作者、断言调用次数、用数据库查询验证而不是接口。 |
| 同义反复 | 期望值用代码计算它的方式计算，所以测试构造上就通过。期望值必须来自别处——一个已知良好的字面量、一个演练过的例子、规格。 |
| 水平切片 | 在任何实现之前一批测试落地。 |

Mock 只用于系统边界——外部 API、时间、随机性、有时文件系统或数据库。不用于你自己的模块。

## 常见问题

**它为什么不重构？描述说"red-green-refactor"。**

因为重构步骤被移除了而描述没有。移除是刻意的：agent 实际上从不做它，而且保持实现和审查在独立会话中效果更好。结果是否仍按书算作 TDD，不如循环是否产出更好的代码重要。触发短语和正文之间的不匹配已作为 [issue #589](https://github.com/mattpocock/skills/issues/589) 提交，仍然打开，所以"red-green-refactor"继续作为触发技能的一个短语有效。你得到的是红 → 绿，重构在 [code-review](https://aihero.dev/skills-code-review) 里。

**它让我选一个测试接缝而我完全不知道该选哪个。**

这是关于这个技能被报告最多的摩擦（[issue #607](https://github.com/mattpocock/skills/issues/607)）。提示只按名字列出候选接缝，没有任何关于每个捕获或漏掉什么的信息，所以你在标签之间选择。还没有发布修复。实际的变通是在回答之前让 agent 说权衡——组件级接缝漏掉什么而集成接缝捕获，以及它慢多少。这也是为什么链在 `to-spec` 里提前约定接缝，在那里你看到整个功能而不只是一个提示。

**它在测试之前写了实现，尽管技能说红先。**

它会发生。一个用户就此追问[模型](https://www.aihero.dev/ai-coding-dictionary/model)，得到一个异常诚实的回答："我知道技能说'一次一个测试，看它为正确的原因失败'——我读了。我只是默认了我的正常习惯。"技能被写成与这个共存。没有指令让 agent 100% 的时间服从，而更用力地强迫会为一点点收益限制 agent 的创造力——即使不被严格遵循，循环也值得运行，因为结果整体仍然更好。如果严格遵循对某个特定切片很重要，看住运行，而不是信任技能强制执行它。

**它应该先写浏览器或端到端测试吗？**

通常不应该，而技能不会阻止它。一个用户报告 agent 先写了一个 Playwright 测试，然后烧了一段长循环重新运行它，并为一个还不存在的功能得出结论是*测试*坏了。在你的 `CLAUDE.md` 里配置这个。浏览器测试慢到红绿反馈循环停止自付；在你的仓库 `CLAUDE.md` 中声明它们在行为工作之后写。

**`/tdd` 替代 `/implement`，或课程的 `/do-work` 吗？**

不。`/tdd` 记录方法论；`/implement` 是一个非常简单的 工作→反馈→提交 循环，是 `/do-work` 的直接替代。课程的单一 `/do-work` 步骤现在被拆到 `/implement`、`/tdd` 和 `/code-review` 上。如果你在问针对一张工单运行哪个，答案几乎总是 `/implement`。

**深模块和接口设计指导去哪了？**

在 v1.0 进入 [codebase-design](https://aihero.dev/skills-codebase-design)，泛化后让几个技能共享一个词汇。`refactoring.md` 同时离开；重构现在是 [code-review](https://aihero.dev/skills-code-review) 的工作，而那个技能携带 Fowler 坏味道基线。

**它知道我其他的工单吗？**

不知道。针对一张工单运行时，它会愉快地提议属于兄弟工单的工作，因为它对 issue 图的其余部分没有视野（[issue #129](https://github.com/mattpocock/skills/issues/129)）。Matt 的立场是那不是 `tdd` 的工作。把规格和工单一起传有帮助；一开始就把工单右尺寸化帮助更大。

## 正常工作的标志

- 它停下来、点名它打算测试的接缝、等待，在任何测试文件存在之前。
- 一个测试出现、变红、得到刚好足够的代码通过、只有然后下一个测试出现——不是一批测试跟一批代码。
- 测试名读作能力（"user can checkout with valid cart"），而不是内部（"checkout calls paymentService.process"）。
- 断言中的期望值是你可追溯到规格的字面量，而不是用代码计算它们的方式重新计算的值。
- 重命名一个内部函数不破坏套件中的任何东西。
- Mock 只出现在外部边界——支付 API、时钟——而且绝不围绕你自己的模块。

## 在流程中的位置

`tdd` 是主链构建步骤内部的引擎，而不是它自己的一步：

```txt
grill-with-docs → to-spec → to-tickets → implement → code-review
```

[to-spec](https://aihero.dev/skills-to-spec) 提前约定测试接缝，[implement](https://aihero.dev/skills-implement) 每张工单驱动 `tdd`，[code-review](https://aihero.dev/skills-code-review) 之后检查只有已约定的接缝被使用——并拥有 `tdd` 不再做的重构。它的另一个邻居是 [codebase-design](https://aihero.dev/skills-codebase-design)，`tdd` 所说的接缝和深模块词汇的共享来源。你也可以单独取用它，每当有一个具体的行为要构建、没有完整规格在局中。当你不确定哪个技能适合你的情况时，[ask-matt](https://aihero.dev/skills-ask-matt) 为你路由。
