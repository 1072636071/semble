---
name: jxx-ask-matt
description: 询问哪个技能或流程（flow）适合你的情况——本仓库技能的路由器（router）。
---

# 问 Matt

记不住每个技能？问就是了。一个流程是贯穿多个技能的路径。大多数路径沿一条主流程运行，两条入口汇入其中。其余技能要么独立，要么作为底层词汇层运行。

## 主流程：想法 → 交付

1. `jxx-grill-with-docs` — 通过穷追不舍地追问打磨想法。在工作目录中工作时从这里开始（有状态，保留到 `CONTEXT.md` 和 ADR）。不在工作目录用 `jxx-grill-me`。复杂/需跨会话用 `jxx-grill-with-memorial`。
2. 分支 — 能否在对话中解决？若需可运行答案（状态、业务逻辑、UI），绕行 prototype：用 `jxx-handoff` 导出对话，然后 `jxx-prototype` 用一次性代码回答问题，保留为 `prototype/<name>` 分支。
3. 分支 — 多会话构建？是 → `jxx-to-spec` 转 spec，`jxx-to-tickets` 拆为工单（每个声明阻塞边），每个工单启动 `jxx-implement`，工单之间 `/clear`。否 → 当前上下文直接 `jxx-implement`。无论哪种，`jxx-implement` 内部驱动 `jxx-tdd` 构建每个 issue，结束前运行 `jxx-code-review`，最后 commit。

### 上下文卫生

将步骤 1–3 保持在一个不间断的上下文窗口中——不要在 `jxx-to-tickets` 之前压缩或清除。每个 `jxx-implement` 随后重新开始。限制是智能区域（约 150k token）；若接近，在最近的阶段边界 `/compact`。

## 入口

- Bug 和请求堆积 → `jxx-triage`。将 issue 推过 triage 角色，产出 agent 可用的 issue。仅适用于你未创建的 issue。
- 出了问题 → `jxx-diagnosing-bugs`。针对棘手 bug：先建立紧密反馈循环，再理论分析，用 regression 测试修复。没有好的接缝时交接给 `jxx-improve-codebase-architecture`。
- 庞大而模糊的工作 → `jxx-wayfinder`。在 issue tracker 上用调查工单绘制共享地图，逐一解决——产出决策而非交付物——直到路径清晰。然后汇入主流程的 `jxx-to-spec`。

## 代码库健康

- `jxx-improve-codebase-architecture` — 有空闲时运行，保持代码库对 agent 友好。发现加深模块深度的机会，产生想法带入主流程的 `jxx-grill-with-docs`。`jxx-codebase-design` 是设计选定候选者的工作台。

## 底层词汇

- `jxx-domain-modeling` — 锐化项目的领域语言：挑战模糊术语、解决过载词汇、将难以逆转的决策记录为 ADR。保持 `CONTEXT.md` 为干净的词汇表。
- `jxx-codebase-design` — 深模块词汇（module、interface、depth、seam、adapter、leverage、locality），用于设计模块的形状。

## 阶段边界

`jxx-handoff` 是上下文窗口之间的桥梁，双向可用。进入阶段边界——完成工单、复现 bug、阶段关闭、artifact 落地——是决策点：带多少上下文过去。完整决策树见 [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md)。

## 独立技能

- `jxx-grill-me` — 无状态 grill，不在工作目录中工作时使用。
- `jxx-grilling` — 共享的 grill 原语：按轮推进的 frontier 访谈。
- `jxx-resolving-merge-conflicts` — merge/rebase 冲突时使用。
- `jxx-to-questionnaire` — 将待决策项转化为措辞中立的问卷。
- `jxx-wizard` — 生成交互式 bash 向导引导手动多步流程。
- `jxx-prototype` — 一次性程序回答设计问题。
- `jxx-design-system` — 确立项目级 UI 设计系统，10 种风格预设。
- `jxx-research` — 将阅读工作委托给后台 agent。
- `jxx-loop-me` — grill 用户关于工作流 spec 的细节。
- `jxx-goal-mode` — 只定目标与验收标准，AI 自主拆解执行自检至达标。
- `jxx-writing-for-agents` — 为 agent 写文档的参考。

## 前置条件

`jxx-setup-matt-pocock-skills` — 在第一次工程流程之前运行，配置 issue 跟踪器、triage 标签和文档布局。
