# 技能机制

[`writing-for-agents`](SKILL.md) 的技能专用分支：当文档是 skill 时有什么不同。其余是通用参考。

## 调用方式

两种选择，交易两种 load：

- **模型调用（model-invoked）** — 保留 `description`，agent 可自主触发，其他技能也能触达。模型调用始终*包含*用户触达；description 只增加 agent 发现，从不剥夺人的。description 是顶层 context pointer，被迫常驻——用永久 context load 换可发现性。全参考的模型调用技能也是共享参考的家：多技能共用的参考住一处。机制：省略 `disable-model-invocation`，写面向模型的 description，携带触发分支（`SKILL.md` 的指针规则全部适用）。
- **用户调用（user-invoked）** — description 从 agent 触达范围剥离：只能人输入名字触发，其他技能也不行。零 context load，但花 cognitive load——你就是那个必须记住它的索引。机制：`disable-model-invocation: true`，description 变面向人的一行摘要，触发词剥离。

只有 agent 必须自主触达、或其他技能必须触达时才选模型调用；否则用户调用，不付 context load。

两个用户调用技能共用的参考，无法住在任何一个里——都没有 description，无法互相触发。推到技能系统外的普通文件，任何技能可指向。

## 按调用方式拆分

当有独特 leading word 应独立触发（你在提示中真会用的触发词）、或另一技能必须触达时，拆出模型调用技能。新 description 常驻要付 context load——独立触达必须值得。

## Router 技能

用户调用技能多到记不住时，用 **router skill** 治愈：一个用户调用技能列出其他技能和使用场景，人只需记住一个。它只能提示、不能触发——用户调用技能没有 description，除了人无人能触达。
