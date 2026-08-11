# Engineering

我日常用于代码工作的技能。

## 用户调用

只有输入它们时才能到达（Claude Code：`disable-model-invocation: true`；Codex：`agents/openai.yaml` 中的 `policy.allow_implicit_invocation: false`）。

- **[ask-matt](./ask-matt/SKILL.md)** — 询问哪个技能或流程适合你的情况。本仓库用户调用技能的路由器。
- **[grill-with-docs](./grill-with-docs/SKILL.md)** — 同时构建项目领域模型的访谈会话，内联磨锋利术语并更新 `CONTEXT.md` 和 ADR。
- **[triage](./triage/SKILL.md)** — 让 issue 穿过分流角色的状态机。
- **[improve-codebase-architecture](./improve-codebase-architecture/SKILL.md)** — 扫描代码库寻找深化机会，将其呈现为可视化 HTML 报告，然后访谈你选中的任何一个。
- **[setup-matt-pocock-skills](./setup-matt-pocock-skills/SKILL.md)** — 为本仓库配置工程技能（issue 跟踪器、分流标签、领域文档布局）。每个仓库运行一次。
- **[to-spec](./to-spec/SKILL.md)** — 将当前对话转化为规格文档并发布到问题跟踪器。
- **[to-tickets](./to-tickets/SKILL.md)** — 将任何计划、规格或对话拆解为一组曳光弹工单，每个声明其阻塞边——本地文件中以文本表示，真实跟踪器上用原生阻塞链接。
- **[implement](./implement/SKILL.md)** — 构建规格或一组工单描述的工作，在预先约定的接缝处驱动 `/tdd`，并在提交前用 `/code-review` 收尾。
- **[wayfinder](./wayfinder/SKILL.md)** — 将一大块工作——超过一个 agent 会话能承载的——规划为 issue 跟踪器上决策工单的共享地图，一次解决一个，直到通往目的地的道路清晰。

## 模型调用

模型或用户可到达（丰富的触发措辞，让模型可以够到它们）。

- **[prototype](./prototype/SKILL.md)** — 构建一次性原型来回答设计问题：状态/逻辑用单一可共享的 HTML 文件，或几个可切换的 UI 变体。

- **[diagnosing-bugs](./diagnosing-bugs/SKILL.md)** — 针对难缠 bug 和性能回归的纪律化诊断循环：构建一个在此 bug 上变红的反馈循环 → 最小化 → 假设 → 插桩 → 修复 → 回归测试。
- **[research](./research/SKILL.md)** — 针对高信任度的首要来源调查一个问题，并把发现作为带引用的 Markdown 文件捕获到仓库中，作为后台 agent 运行。
- **[tdd](./tdd/SKILL.md)** — 带红绿重构循环的测试驱动开发。一次一个垂直切片地构建功能或修复 bug。
- **[domain-modeling](./domain-modeling/SKILL.md)** — 主动构建并磨锋利项目的领域模型——挑战术语、用场景压力测试、内联更新 `CONTEXT.md` 和 ADR。
- **[codebase-design](./codebase-design/SKILL.md)** — 设计深模块的共享纪律和词汇：小接口、干净的接缝、通过接口可测试。
- **[code-review](./code-review/SKILL.md)** — 自一个固定点以来的 diff 的双轴审查：**标准**（是否遵循仓库的编码标准，加上 Fowler 坏味道基线？）和**规格**（是否忠实实现了来源 issue/规格？），作为并行子 agent 运行。
- **[resolving-merge-conflicts](./resolving-merge-conflicts/SKILL.md)** — 逐个 hunk 处理进行中的 git merge 或 rebase 冲突，根据追溯到的每一边首要来源的意图来解决，然后完成该操作——绝不 `--abort`。
- **[wizard](./wizard/SKILL.md)** — 生成一个交互式 bash 向导，引导人类完成只有他们能执行的步骤：配置基础设施、设置凭据或 CI 机密、浏览陌生的第三方仪表盘，或运行一次性迁移或切换。
