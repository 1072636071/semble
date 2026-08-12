﻿# jxx-domain-modeling

主动构建和锐化项目的领域模型。挑战术语歧义、发明边界场景、在术语结晶时立即写下词汇表和架构决策记录（ADR）。

## 何时使用

当用户想确定领域术语或统一语言（ubiquitous language）、解决术语歧义、记录架构决策（ADR）、梳理上下文边界、演化已有术语定义、或当其他技能需要维护领域模型时使用。

## 核心特性

- **核心循环**：识别 → 质疑 → 压测 → 验证 → 记录，持续在整个会话中维护模型
- **术语演化**：已有术语定义变更时的标注、影响面检查和 ADR 联动
- **退出信号**：识别何时自然收尾建模会话，总结新增/变更内容
- **多上下文支持**：防腐层、共享内核等 DDD 关系模式
- **ADR 生命周期**：创建、弃用与取代的完整流程

## 参考文件

- [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md) — CONTEXT.md 词汇表格式规范（含术语分组、关系模式）
- [ADR-FORMAT.md](./ADR-FORMAT.md) — ADR 格式规范与示例（含弃用流程、多上下文归属）

## 协作技能

- `/jxx-grill-with-docs` — 通过 grill 会话打磨想法，过程中同步驱动领域建模
- `/jxx-grill-with-memorial` — memorial 持久化版 grill，复杂/跨会话方案优先使用
- `/jxx-codebase-design` — 深模块（deep module）设计词汇，与领域模型互补
- `/jxx-improve-codebase-architecture` — 改善代码库架构，依赖领域模型提供术语
