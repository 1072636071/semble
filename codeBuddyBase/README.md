<p>
  <a href="https://www.aihero.dev/s/skills-newsletter">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/total-typescript/image/upload/v1777382277/skills-repo-dark_2x.png">
      <source media="(prefers-color-scheme: light)" srcset="https://res.cloudinary.com/total-typescript/image/upload/v1777382277/skill-repo-light_2x.png">
      <img alt="Skills" src="https://res.cloudinary.com/total-typescript/image/upload/v1777382277/skill-repo-light_2x.png" width="369">
    </picture>
  </a>
</p>

# 真正工程师的技能

[![skills.sh](https://skills.sh/b/mattpocock/skills)](https://skills.sh/mattpocock/skills)

我每天用来做真正工程的 agent 技能——不是氛围编程。

开发真正的应用很难。GSD、BMAD 和 Spec-Kit 等方法试图通过掌控流程来帮忙。但这样做的同时，它们夺走了你的控制权，并使流程中的 bug 难以解决。

这些技能设计得小巧、易适配、可组合。它们适用于任何模型。基于数十年的工程经验。随意改造它们。让它们成为你自己的。享受吧。

如果你想跟进这些技能的变更以及我创建的任何新技能，可以加入我邮件列表上的约 60,000 名开发者：

[订阅邮件列表](https://www.aihero.dev/s/skills-newsletter)

## 快速开始（30 秒设置）

1. 运行 skills.sh 安装器：

```bash
npx skills@latest add mattpocock/skills
```

2. 选择你想要的技能，以及要安装到哪些编码 agent 上。**确保选择 `/setup-matt-pocock-skills`**。

3. 在你的 agent 中运行 `/setup-matt-pocock-skills`。它会：
   - 询问你想使用哪个 issue 追踪器（GitHub、Linear 或本地文件）
   - 询问你在分诊时给工单打什么标签（`/triage` 使用标签）
   - 询问你想把创建的文档保存在哪里

4. 搞定——你可以开始了。

## 为什么有这些技能

我构建这些技能是为了修复我在 Claude Code、Codex 和其他编码 agent 上看到的常见失败模式。

### #1：Agent 没做我想要的

> "没有人确切知道自己想要什么"
>
> David Thomas & Andrew Hunt，[《程序员修炼之道》](https://www.amazon.co.uk/Pragmatic-Programmer-Anniversary-Journey-Mastery/dp/B0833F1T3V)

**问题**。软件开发中最常见的失败模式是对齐偏差。你以为开发人员知道你想要什么。然后你看到他们构建的东西——你意识到它完全没理解你。

在 AI 时代也是如此。你与 agent 之间存在沟通鸿沟。修复方法是**追问会话**——让 agent 就你要构建的内容提出详细问题。

**修复方法**是使用：

- [`/grill-me`](./skills/productivity/jxx-grill-me/SKILL.md) - 用于非代码场景
- [`/grill-with-docs`](./skills/engineering/jxx-grill-with-docs/SKILL.md) - 与 [`/grill-me`](./skills/productivity/jxx-grill-me/SKILL.md) 相同，但增加了更多功能（见下文）

这些是我最受欢迎的技能。它们帮助你在开始之前与 agent 对齐，并深入思考你要做的变更。每次想做变更时都*使用*它们。

### #2：Agent 太啰嗦了

> 有了统一语言，开发者之间的对话和代码的表达都源自同一个领域模型。
>
> Eric Evans，[《领域驱动设计》](https://www.amazon.co.uk/Domain-Driven-Design-Tackling-Complexity-Software/dp/0321125215)

**问题**：在项目开始时，开发人员和为他们构建软件的人（领域专家）通常说着不同的语言。

我在 agent 上感受到了同样的张力。Agent 通常被丢进一个项目，被要求在过程中自己搞懂术语。所以它们用 20 个词来表达 1 个词就能说清的事。

**修复方法**是共享语言。这是一份帮助 agent 解码项目中使用的术语的文档。

<details>
<summary>
示例
</summary>

这是一个 [`CONTEXT.md`](https://github.com/mattpocock/course-video-manager/blob/076a5a7a182db0fe1e62971dd7a68bcadf010f1c/CONTEXT.md) 的示例，来自我的 `course-video-manager` 仓库。哪个更容易读？

- **之前**："当课程中某个小节里的一节课被'实体化'时（即在文件系统中获得一个位置），出现了问题"
- **之后**："物化级联有问题"

这种简洁性在每次会话中都会产生回报。

</details>

这已内置在 [`/grill-with-docs`](./skills/engineering/jxx-grill-with-docs/SKILL.md) 中。它是一个追问会话，但帮助你与 AI 建立共享语言，并在 ADR 中记录难以解释的决策。

很难解释这有多强大。它可能是这个仓库中最酷的技术。试试看。

> [!提示]
> 共享语言除了减少冗长之外还有很多好处：
>
> - **变量、函数和文件的命名保持一致**，使用共享语言
> - 因此，**代码库对 agent 来说更易导航**
> - Agent 也**在思考上消耗更少的 token**，因为它可以使用更简洁的语言

### #3：代码不工作

> "始终采取小的、深思熟虑的步骤。反馈速率就是你的速度上限。永远不要承担太大的任务。"
>
> David Thomas & Andrew Hunt，[《程序员修炼之道》](https://www.amazon.co.uk/Pragmatic-Programmer-Anniversary-Journey-Mastery/dp/B0833F1T3V)

**问题**：假设你和 agent 在构建什么上已对齐。当 agent *仍然*产出垃圾时怎么办？

是时候看看你的反馈循环了。没有关于代码实际运行情况的反馈，agent 就像盲飞。

**修复方法**：你需要常规的反馈循环：静态类型、浏览器访问和自动化测试。

对于自动化测试，红-绿-重构循环至关重要。即 agent 先写一个失败的测试，然后修复测试。这帮助 agent 获得一致的反馈水平，从而产出更好的代码。

我构建了一个 **[`/tdd`](./skills/engineering/jxx-tdd/SKILL.md) 技能**，可以插入任何项目。它鼓励红-绿-重构，并为 agent 提供大量关于什么是好测试和坏测试的指导。

对于调试，我还构建了一个 **[`/diagnosing-bugs`](./skills/engineering/jxx-diagnosing-bugs/SKILL.md)** 技能，将最佳调试实践包装成简单循环。

### #4：我们构建了一个泥球

> "每天都要投资系统的设计。"
>
> Kent Beck，[《解析极限编程》](https://www.amazon.co.uk/Extreme-Programming-Explained-Embrace-Change/dp/0321278658)

> "最好的模块是深的。它们允许通过简单的接口访问大量功能。"
>
> John Ousterhout，[《软件设计哲学》](https://www.amazon.co.uk/Philosophy-Software-Design-2nd/dp/173210221X)

**问题**：大多数用 agent 构建的应用都复杂且难以变更。因为 agent 可以极大地加速编码，它们也加速了软件熵。代码库以前所未有的速度变得更复杂。

**修复方法**是一种 AI 驱动开发的全新方法：关心代码的设计。

这已内置于这些技能的每一层：

- [`/to-prd`](./skills/engineering/jxx-to-prd/SKILL.md) 在创建 PRD 之前会询问你要涉及哪些模块

关键的是，[`/improve-codebase-architecture`](./skills/engineering/jxx-improve-codebase-architecture/SKILL.md) 帮助你拯救已变成泥球的代码库。我建议每隔几天在代码库上运行一次。

### 总结

软件工程基础比以往任何时候都更重要。这些技能是我将基础浓缩为可重复实践的最佳努力，帮助你交付职业生涯中最好的应用。享受吧。

## 参考

这些技能按一个维度划分——谁能调用它们。**用户调用**技能仅在输入时可达（如 `/grill-me`）；它们的职责是编排。**模型调用**技能可由你调用，*或*在任务匹配时被 agent 自动调用；它们承载可复用的纪律。用户调用技能可调用模型调用技能，但绝不能调用另一个用户调用技能。

### 工程

我日常用于代码工作的技能。

**用户调用**

- **[ask-matt](./skills/engineering/jxx-ask-matt/SKILL.md)** — 询问哪个技能或流程适合你的场景。本仓库中用户调用技能的路由器。
- **[grill-with-docs](./skills/engineering/jxx-grill-with-docs/SKILL.md)** — 追问会话，同时构建项目的领域模型，打磨术语并内联更新 `CONTEXT.md` 和 ADR。
- **[triage](./skills/engineering/jxx-triage/SKILL.md)** — 通过分诊角色的状态机移动 issue。
- **[improve-codebase-architecture](./skills/engineering/jxx-improve-codebase-architecture/SKILL.md)** — 扫描代码库寻找深化机会，以可视化 HTML 报告呈现，然后对你选择的进行追问。
- **[setup-matt-pocock-skills](./skills/engineering/jxx-setup-matt-pocock-skills/SKILL.md)** — 为工程技能配置本仓库（issue 追踪器、分诊标签、领域文档布局）。使用其他工程技能前每个仓库运行一次。
- **[to-issues](./skills/engineering/jxx-to-issues/SKILL.md)** — 将任何计划、规格或 PRD 拆分为可独立抓取的 issue，使用纵向切片。
- **[to-prd](./skills/engineering/jxx-to-prd/SKILL.md)** — 将当前对话转为 PRD 并发布到 issue 追踪器。无访谈——仅综合你已讨论的内容。
- **[goal-mode](./skills/engineering/jxx-goal-mode/SKILL.md)** — 只定目标与验收标准，AI 自主拆解、执行、自检并循环至达标。适合路径不确定、过程繁重的长任务。

**模型调用**

- **[prototype](./skills/engineering/jxx-prototype/SKILL.md)** — 构建一次性原型来回答设计问题——用于状态/逻辑问题的单文件 HTML 交互 demo（浏览器直接打开），或可从一个路由切换的多个截然不同的 UI 变体。
- **[diagnosing-bugs](./skills/engineering/jxx-diagnosing-bugs/SKILL.md)** — 针对困难 bug 和性能回归的纪律化诊断循环：复现 → 最小化 → 假设 → 埋点 → 修复 → 回归测试。
- **[research](./skills/engineering/jxx-research/SKILL.md)** — 针对高可信度一手来源调查问题，并将发现捕获为仓库中带引用的 Markdown 文件，作为后台 agent 运行。
- **[tdd](./skills/engineering/jxx-tdd/SKILL.md)** — 红-绿-重构循环的测试驱动开发。每次构建一个纵向切片的功能或修复 bug。
- **[domain-modeling](./skills/engineering/jxx-domain-modeling/SKILL.md)** — 主动构建和打磨项目的领域模型——用词汇表挑战术语、用边缘场景压力测试，并内联更新 `CONTEXT.md` 和 ADR。
- **[codebase-design](./skills/engineering/jxx-codebase-design/SKILL.md)** — 设计深度模块（deep module）的共享纪律和词汇：大量行为放在小接口背后，放置在干净的接缝（seam）处，可通过该接口测试。
- **[code-review](./skills/engineering/jxx-code-review/SKILL.md)** — 从固定点对 diff 进行双轴审查：**标准**（是否遵循仓库的编码标准，加上 Fowler 坏味道基线？）和 **规格**（是否忠实实现了原始 issue/PRD？），作为并行子 agent 运行，互不污染。
- **[design-system](./skills/engineering/jxx-design-system/SKILL.md)** — 基于 Google DESIGN.md 格式确立项目级 UI 设计系统并维护跨生成一致性。自带 10 种主流风格预设，生成 UI 代码前先确立令牌边界。
- **[wizard](./skills/engineering/jxx-wizard/SKILL.md)** — 生成交互式 bash 向导，引导人完成手动多步流程（控制台点击、创建账号、生成密钥、OAuth），捕获值并写入 `.env` 或 CI 密钥。

### 生产力

通用工作流工具，非代码特定。

**用户调用**

- **[grill-me](./skills/productivity/jxx-grill-me/SKILL.md)** — 对计划或设计进行无情追问，直到决策树的每个分支都被解决。
- **[handoff](./skills/productivity/jxx-handoff/SKILL.md)** — 将当前对话压缩为交接文档，以便另一个 agent 继续工作。
- **[teach](./skills/productivity/jxx-teach/SKILL.md)** — 通过多个会话教授用户新技能或概念，使用当前目录作为有状态的教学工作区。
- **[to-questionnaire](./skills/productivity/jxx-to-questionnaire/SKILL.md)** — 将对话转化为可交付的问卷文档，交给持有答案的人填写，答案与问卷一同返回。
- **[wait-what](./skills/productivity/jxx-wait-what/SKILL.md)** — agent 刚解释的内容没看懂时，让它用简化技术英语和共享词汇重讲。
- **[writing-for-agents](./skills/productivity/jxx-writing-for-agents/SKILL.md)** — 为 agent 编写文档（AGENTS.md、README、技能）的参考：context pointer、两种 load、信息层级、leading word、pruning。

**模型调用**

- **[grilling](./skills/productivity/jxx-grilling/SKILL.md)** — 对计划或设计进行无情追问，直到决策树的每个分支都被解决。`grill-me` 和 `grill-with-docs` 背后的可复用循环。
