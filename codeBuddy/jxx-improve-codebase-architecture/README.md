# jxx-improve-codebase-architecture

扫描代码库寻找**深化（deepening）机会**——将浅模块变为深模块的重构，以可视化 HTML 报告呈现，再 grill 用户选中的那一个。目标是可测试性和 AI 可导航性。

## 何时使用

- 想改善代码库架构、提升模块深度时。
- 代码库对 agent 不友好、难以导航或测试时。
- 想找候选重构机会但不知道从何下手时。

## 流程

1. **探索** — 阅读 `CONTEXT.md` 领域词汇与相关 ADR，派子 agent 遍历代码库寻找摩擦点。
2. **以 HTML 报告呈现候选者** — 写自包含 HTML 到临时目录，每个候选一张卡片（文件 / 问题 / 方案 / 收益 / 前后图 / 推荐强度），末尾列首要推荐。
3. **grill 循环** — 用户选中候选者后，运行 `/jxx-grilling` 遍历设计树，同步驱动 `/jxx-domain-modeling` 更新领域模型。

## 依赖词汇

- `/jxx-codebase-design` — 深模块词汇（模块、接口、深度、接缝、适配器、杠杆、局部性）
- `/jxx-domain-modeling` — 领域模型（`CONTEXT.md`）
- `/jxx-grilling` — 追问设计决策

## 相关技能

- `/jxx-codebase-design` — 设计选定候选者的工作台
- `/jxx-diagnosing-bugs` — 复盘发现无接缝锁定 bug 时交接
