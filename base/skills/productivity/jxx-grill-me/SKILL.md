---
name: jxx-grill-me
description: "grill 计划或设计，逐轮追问到无遗留问题。当用户说 grill、一起决策时触发。无状态，不落 CONTEXT.md。"
metadata:
  version: 1.1.0
disable-model-invocation: false
---

对用户提供的计划或设计穷追不舍地盘问，直到达成共同理解。逐一走遍设计树的每个分支，逐个解决决策之间的依赖关系。

## 输入

用户的计划或设计（在对话中直接提供，无文件参数要求）。

## 输出

由 `/jxx-grilling` 产出的分轮追问记录与共同确认后的方案。决策以 markdown 块留在聊天中；无状态，不写本地文件或 `CONTEXT.md`。

## 工作方式

调用 `/jxx-grilling` 执行访谈，遵循其前沿轮次、推荐答案、问题格式与事实查找规则。不要在本技能复制或另写访谈循环。

在用户确认已达成共同理解之前，不要执行该计划。

## 异常处理

- 用户未提供计划/设计：先请用户给出待 review 的内容，再调用 `/jxx-grilling`。
