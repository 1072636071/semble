# PRD 07 · DSH harness 工具链问题治理

## 问题陈述

2026-09-29 三份会话回顾（75-b03 / 75-b04 / 76-b01b）揭示了一批 DSH harness 工具链层面的问题。
这些问题不在业务代码内，而在 harness 本身的工具行为中，导致每张卡重复踩坑、token 浪费、
甚至产出不可见损伤。本 PRD 汇总需 harness 侧治理的问题。

## 用户故事

作为开发卡 worker，我希望 harness 工具行为可预期，不需要每张卡重新摸索工具边界。

## 解决方案

逐项治理以下问题：

1. **subagent 后台结论取不回**：`subagent({run_in_background:true})` 只回 id 无读取通道，`job_list` 取不回结论。
2. **pwsh 内联 node 反引号静默丢失**：`pwsh -Command "node -e …"` 中反引号被 PowerShell 当转义符吃掉。
3. **ocr CLI 未装**：`/jxx-code-review` 恒降级为 2 维度。

## 实现决策

- subagent：给 continuable 子代理一个取回通道（或文档化规避方案）
- pwsh：文档化禁令已在 starter/dev.md 加；harness 侧考虑检测/警告
- ocr：安装 `npm i -g @alibaba-group/open-code-review`

## 测试决策

- 每项治理后由实际开发卡验证
