# jxx-grill-with-memorial

通过 grill（穷追不舍的访谈）打磨计划或设计，全过程持久化到 memorial 奏报目录，解决 `jxx-grill-with-docs` 的假设误判（不可回溯）和会话中断（决策丢失）。

**核心约束：文档先行，代码后行。** grill 期间只做追问和文档操作，禁止修改代码。每轮追问即时落盘，防中断。

## 何时使用

当用户想讨论方案、梳理需求、澄清设计、做技术决策时使用。适合需要完整追溯和断点续接的复杂设计讨论。

触发词: memorial, 奏报, grill 方案, 讨论设计, 梳理需求, 分析需求。

## 工作流

1. **初始化** — 创建 `docs/memorial/NNN-slug/` 目录结构，写入 context.md
2. **Grill 循环** — 逐一追问，方案对比范式呈现（优点/缺点/推荐），即时追加记录；可选 ADR 创建和调查委派
3. **收尾** — C1-C5 checklist 全绿后回写全局文档（CONTEXT.md、ADR），标记完成

## 相关技能

- `jxx-grill-with-docs` — 轻量 grill（本技能前身）
- `jxx-research` — 调查委派目标
- `jxx-plan-review` — 可选独立审查
- `jxx-grilling` — 纯追问（最简）
