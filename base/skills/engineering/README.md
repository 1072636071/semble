# 工程技能

日常代码工作所用的技能。

## 用户调用

仅在手动输入时可达（`disable-model-invocation: true`）。

- **[ask-matt](./jxx-ask-matt/SKILL.md)** — 询问哪个技能或流程适合你的场景。本仓库中用户调用技能的路由器。
- **[grill-with-docs](./jxx-grill-with-docs/SKILL.md)** — grill 会话，同时构建项目的领域模型，锐化术语并内联更新 `CONTEXT.md` 和 ADR。
- **[grill-with-memorial](./jxx-grill-with-memorial/SKILL.md)** — memorial 奏报持久化 grill，支持中断续接、调查委派、收尾审核。复杂/跨会话方案优先使用。
- **[triage](./jxx-triage/SKILL.md)** — 通过triage 角色的状态机流转 issue。
- **[improve-codebase-architecture](./jxx-improve-codebase-architecture/SKILL.md)** — 扫描代码库寻找深化机会，以可视化 HTML 报告呈现，然后对你选择的项目进行 grill。
- **[setup-matt-pocock-skills](./jxx-setup-matt-pocock-skills/SKILL.md)** — 为本仓库配置工程技能（issue 跟踪器、triage 标签、领域文档布局）。每个仓库运行一次。
- **[to-spec](./jxx-to-spec/SKILL.md)** — 将当前对话转化为规格文档并发布到 issue 跟踪器。
- **[to-tickets](./jxx-to-tickets/SKILL.md)** — 将任何计划、规格文档或对话拆解为一组追踪弹式工单，每个工单声明其阻塞关系——本地文件中以 `Blocked by:` 文本行表示阻塞边。
- **[wayfinder](./jxx-wayfinder/SKILL.md)** — 规划大型工作——超过单个 agent 会话能承载的范围——在 issue tracker 上创建共享调查地图，逐个解决直到通往目的地的路径清晰。
- **[loop-me](./jxx-loop-me/SKILL.md)** — grill 用户关于工作流 spec 的细节，在工作区内设计可委托的循环模式。用于梳理日常工作中的重复模式并设计工作流 spec。

## 模型调用

模型或用户均可可达（丰富的触发措辞使模型能主动调用）。

- **[prototype](./jxx-prototype/SKILL.md)** — 构建一次性 prototype来回答设计问题：用于状态/逻辑的可运行终端应用，或多个可切换的 UI 变体。
- **[diagnosing-bugs](./jxx-diagnosing-bugs/SKILL.md)** — 针对疑难 bug 和性能 regression的规范诊断循环：复现 → 最小化 → 假设 → 埋点 → 修复 → regression 测试。
- **[research](./jxx-research/SKILL.md)** — 基于高可信度一手资料调查问题，将发现以带引用的 Markdown 文件保存到仓库中，作为后台 agent 运行。
- **[tdd](./jxx-tdd/SKILL.md)** — 红-绿-重构循环的测试驱动开发。逐个纵向切片构建功能或修复 bug。
- **[domain-modeling](./jxx-domain-modeling/SKILL.md)** — 主动构建和锐化项目的领域模型——质疑术语、用场景压力测试、内联更新 `CONTEXT.md` 和 ADR。
- **[codebase-design](./jxx-codebase-design/SKILL.md)** — 设计深层模块（deep module）的共享规范与词汇：小接口、清晰接缝（seam）、可通过接口测试。
- **[code-review](./jxx-code-review/SKILL.md)** — 基于固定时间点的 diff 进行双轴 review：**标准轴**（是否遵循仓库编码规范及 Fowler 坏味道基线？）和 **spec 轴**（是否忠实实现了来源 issue/PRD？），以并行子 agent 运行。

- **[implement](./jxx-implement/SKILL.md)** — 实现技能。
- **[resolving-merge-conflicts](./jxx-resolving-merge-conflicts/SKILL.md)** — 解决合并冲突。
- **[wizard](./jxx-wizard/SKILL.md)** — 生成交互式 bash 向导，引导人完成手动多步流程（控制台点击、创建账号、生成密钥），捕获值并写入 `.env` 或 CI 密钥。
