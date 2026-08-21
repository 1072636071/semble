# codeBuddy 技能目录

翻译+轻度魔改版的 mattpocock-skills 技能集合，实际源目录为 `三方/codeBuddy/skills/`。技能按桶文件夹组织：

> **文档语言规范：准确是第一位。** 允许中英文混杂——术语、概念名保留英文原文（如 `context pointer`、`leading word`、`feedback loop`），解释用中文，保证贴切、简短、准确。宁可留英文，不可错译。

| 桶              | 说明                 | 状态   |
| --------------- | -------------------- | ------ |
| `engineering/`  | 日常代码工作         | 推广   |
| `productivity/` | 日常非代码工作流工具 | 推广   |
| `misc/`         | 保留但很少使用       | 不推广 |
| `personal/`     | 绑定个人配置         | 不推广 |
| `in-progress/`  | 尚未准备发布的草稿   | 不推广 |
| `deprecated/`   | 不再使用             | 已废弃 |

> **Hook 标注约定**：含 Hook 的技能在其条目后加 `🪝[厂商…]` 角标，标明该技能依赖的 Agent 厂商 hook 机制（详见 [HARNESS-SPEC.md §10](../HARNESS-SPEC.md)）。目标厂商为 **openCode / CodeBuddy / 华为 CodeArts / Trae**。图例：`🪝[openCode]` = 仅 openCode；`🪝[openCode/CodeBuddy/Trae]` = 已适配多家；`🪝[CodeArts]` = 华为码道插件；`🪝[git]` = 厂商无关 git hook。

> 安装方式：将 `engineering/` 和 `productivity/` 下的技能复制到各平台全局技能目录即可使用。详见 [安装.md](./安装.md)。

---

## 工程技能 (`engineering/`)

日常代码工作所用的技能。

### 用户调用

仅在手动输入时可达（`disable-model-invocation: true`）。

- **[ask-matt](./engineering/jxx-ask-matt/SKILL.md)** — 询问哪个技能或流程适合你的场景。本仓库中用户调用技能的路由器。
- **[grill-with-docs](./engineering/jxx-grill-with-docs/SKILL.md)** — grill 会话，同时构建项目的领域模型，锐化术语并内联更新 `CONTEXT.md` 和 ADR。
- **[triage](./engineering/jxx-triage/SKILL.md)** — 通过 triage 角色的状态机流转 issue。
- **[improve-codebase-architecture](./engineering/jxx-improve-codebase-architecture/SKILL.md)** — 扫描代码库寻找深化机会，以可视化 HTML 报告呈现，然后对你选择的项目进行 grill。
- **[setup-matt-pocock-skills](./engineering/jxx-setup-matt-pocock-skills/SKILL.md)** — 为本仓库配置工程技能（issue 跟踪器、triage 标签、领域文档布局）。每个仓库运行一次。
- **[to-spec](./engineering/jxx-to-spec/SKILL.md)** — 将当前对话转化为规格文档并发布到 issue 跟踪器。
- **[to-tickets](./engineering/jxx-to-tickets/SKILL.md)** — 将任何计划、规格文档或对话拆解为一组追踪弹式（tracer-bullet）工单，每个工单声明其阻塞关系。
- **[wayfinder](./engineering/jxx-wayfinder/SKILL.md)** — 规划大型工作，在 issue tracker 上创建共享调查地图，逐个解决直到路径清晰。
- **[loop-me](./engineering/jxx-loop-me/SKILL.md)** — grill 用户关于工作流 spec 的细节，在工作区内设计可委托的循环模式。

### 模型调用

模型或用户均可可达（丰富的触发措辞使模型能主动调用）。

- **[agent-generator](./engineering/jxx-agent-generator/SKILL.md)** — 按"姜姓身份 + 统一 frontmatter + 既有写作风格"生成或改造 agent 文件。
- **[prototype](./engineering/jxx-prototype/SKILL.md)** — 构建一次性 prototype 来回答设计问题。
- **[diagnosing-bugs](./engineering/jxx-diagnosing-bugs/SKILL.md)** — 针对疑难 bug 和性能 regression 的规范诊断循环。
- **[research](./engineering/jxx-research/SKILL.md)** — 基于高可信度一手资料调查问题，将发现以带引用的 Markdown 文件保存到仓库中。
- **[tdd](./engineering/jxx-tdd/SKILL.md)** — 红-绿-重构循环的测试驱动开发。
- **[domain-modeling](./engineering/jxx-domain-modeling/SKILL.md)** — 主动构建和锐化项目的领域模型。
- **[codebase-design](./engineering/jxx-codebase-design/SKILL.md)** — 设计深层模块（deep module）的共享规范与词汇。
- **[code-review](./engineering/jxx-code-review/SKILL.md)** — 基于固定时间点的 diff 进行双轴 review（标准轴 + spec 轴）。

- **[implement](./engineering/jxx-implement/SKILL.md)** — 实现技能。
- **[impeccable](./engineering/jxx-impeccable/SKILL.md)** 🪝[待改造] — 设计、重塑、打磨前端界面，提供工艺级视觉与 UX。其 `hook*.mjs` runner 思路（一个内核 + 多 manifest）可复用，但当前 manifest 矩阵为 Claude Code 系四家，**未对齐 openCode/CodeBuddy/CodeArts/Trae**，待改造。
- **[resolving-merge-conflicts](./engineering/jxx-resolving-merge-conflicts/SKILL.md)** — 解决合并冲突。
- **[grill-with-memorial](./engineering/jxx-grill-with-memorial/SKILL.md)** — 通过 grill 打磨计划或设计，全过程持久化到 memorial 奏报目录。支持中断续接、调查委派、收尾审核。
- **[wizard](./engineering/jxx-wizard/SKILL.md)** — 生成交互式 bash 向导，引导人完成手动多步流程，捕获值并写入 `.env` 或 CI 密钥。

---

## 生产力 (`productivity/`)

通用工作流工具，非代码专用。

### 用户调用

- **[grill-me](./productivity/jxx-grill-me/SKILL.md)** — 对你的计划或设计进行 relentless grill，直到决策树的每个分支都得到解决。
- **[handoff](./productivity/jxx-handoff/SKILL.md)** — 将当前对话压缩为交接文档，使另一个 agent 可以继续工作。
- **[teach](./productivity/jxx-teach/SKILL.md)** — 跨多个会话教授用户新技能或概念。
- **[to-questionnaire](./productivity/jxx-to-questionnaire/SKILL.md)** — 将对话转化为可交付的问卷文档，交给持有答案的人填写。
- **[wait-what](./productivity/jxx-wait-what/SKILL.md)** — 没看懂 agent 的解释时，让它用简化技术英语重讲。
- **[writing-for-agents](./productivity/jxx-writing-for-agents/SKILL.md)** — 为 agent 编写文档（AGENTS.md、README、技能）的参考。核心概念：context pointer、context/cognitive load、leading word、pruning；要求准确第一，中英混杂，简短贴切。

### 模型调用

- **[grilling](./productivity/jxx-grilling/SKILL.md)** — 对用户的计划或设计进行 relentless grill，直到决策树的每个分支都得到解决。
- **[skill-creator](./productivity/skill-creator/SKILL.md)** — 创建或更新高质量技能的指南，扩展 Agent 能力（专门知识、工作流或工具集成）。
- **[skill-reviewer](./productivity/skill-reviewer/SKILL.md)** — 基于华为规范与业界最佳实践的 skill 合规检查，验证结构/命名/内容/格式并输出改进建议。
- **[skill-tester](./productivity/skill-tester/SKILL.md)** — 用指定 JSON 测试套件对项目级技能做自动化评估与触发测试。

---

## 杂项 (`misc/`)

保留但很少使用的工具——未在插件中推广。

- **[migrate-to-shoehorn](./misc/jxx-migrate-to-shoehorn/SKILL.md)** — 将测试文件从 `as` 类型断言迁移到 @total-typescript/shoehorn。
- **[scaffold-exercises](./misc/jxx-scaffold-exercises/SKILL.md)** — 创建练习目录结构。
- **[setup-pre-commit](./misc/jxx-setup-pre-commit/SKILL.md)** 🪝[git] — 设置 Husky pre-commit hooks（厂商无关 git 生态，不依赖任何 agent 厂商 hook 机制）。

---

## 个人 (`personal/`)

绑定个人配置的技能，未在插件中推广。

- **[edit-article](./personal/jxx-edit-article/SKILL.md)** — 编辑和改进文章。
- **[obsidian-vault](./personal/jxx-obsidian-vault/SKILL.md)** — 在 Obsidian 知识库中搜索、创建和管理笔记。

---

## 开发中 (`in-progress/`)

仍在开发中的技能，尚未准备好发布。

- **[claude-handoff](./in-progress/jxx-claude-handoff/SKILL.md)** — 将当前对话交接给一个新的后台 agent。
- **[writing-beats](./in-progress/jxx-writing-beats/SKILL.md)** — 以节拍旅程的方式塑造文章。
- **[writing-fragments](./in-progress/jxx-writing-fragments/SKILL.md)** — grill 会话，挖掘你的写作片段。
- **[writing-shape](./in-progress/jxx-writing-shape/SKILL.md)** — 取一份原始材料的 Markdown 文件，逐段塑造为文章。

---

## 已废弃 (`deprecated/`)

不再使用的技能。此桶当前为空——退役的技能会被删除，移除它的变更记录会指明取代它的是什么。
