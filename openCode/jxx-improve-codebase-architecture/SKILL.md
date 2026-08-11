---
name: jxx-improve-codebase-architecture
description: 扫描代码库（codebase）寻找深化（deepening）机会，以可视化 HTML 报告呈现，再 grill 你选中的那一个。
---

# 改善代码库架构

发现架构摩擦并提出深化机会——将浅模块变为深模块的重构。目标是可测试性和 AI 可导航性。

此命令以项目的领域模型为依据，建立在共享设计词汇之上：运行 `jxx-codebase-design` 获取架构词汇（模块、接口、深度、接缝、适配器、杠杆、局部性）及其原则。`CONTEXT.md` 中的领域语言为好的接缝命名；`docs/adr/` 中的 ADR 记录此命令不应重新争论的决策。

## Guidelines

- 探索：先阅读项目的领域词汇表（`CONTEXT.md`）和所涉及区域的 ADR。然后派发一个子 agent 遍历代码库，有机地探索并注意体验到的摩擦：理解一个概念是否需要来回跳转？模块在哪里是浅的？纯函数是否仅为可测试性被提取但真正 bug 隐藏在调用中？紧耦合的模块在哪里跨接缝泄漏？哪些部分未测试或难以通过当前接口测试？对怀疑是浅的任何东西应用删除检验——删除它会集中复杂性还是只是移动它。
- 以 HTML 报告呈现候选者：将自包含的 HTML 文件写入操作系统临时目录（`<tmpdir>/architecture-review-<timestamp>.html`），为用户打开。报告使用 Tailwind via CDN 布局，Mermaid via CDN 图表。每个候选者渲染一张卡片：文件、问题、方案、收益（用局部性和杠杆效应解释）、前后图、推荐强度（强烈/值得探索/试探性）。报告末尾有首要推荐部分。用 `CONTEXT.md` 词汇表达领域，用 `jxx-codebase-design` 词汇表达架构。ADR 冲突时仅当摩擦足够真实值得重新审视 ADR 时才提出，在卡片中清楚标记。先不要提出接口，文件写入后问用户想探索哪一个。
- grill 循环：用户选择候选者后，运行 `jxx-grilling` 遍历设计树——约束、依赖、深化模块的形状、接缝后面是什么、哪些测试存活。附带操作在决策成型时内联发生——运行 `jxx-domain-modeling` 保持领域模型最新：用不在 `CONTEXT.md` 中的概念命名深化模块时添加术语；锐化模糊术语时立即更新；用户以支撑性理由拒绝候选者时提供 ADR；想探索替代接口时运行 `jxx-codebase-design` 的设计两次并行子 agent 模式。

## References

- [HTML-REPORT.md](HTML-REPORT.md) — 完整 HTML 脚手架、图表模式和样式指导。
- `jxx-codebase-design` — 架构词汇与原则。
- `jxx-grilling` — grill 循环。
- `jxx-domain-modeling` — 领域模型维护。
