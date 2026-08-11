---
name: jxx-grill-me
description: 对计划或设计发起一场穷追不舍的追问会话，快速打磨方案。当用户不在工作目录中、不想留下文档记录、只想在聊天中把想法问清楚时使用。触发词："grill me""追问我""帮我打磨这个想法""压力测试一下"。不适用于需要产出 ADR/词汇表的场景（改用 jxx-grill-with-docs）、需要跨会话持久化与调查委派的场景（改用 jxx-grill-with-memorial）、需要梳理工作流 spec 的场景（改用 jxx-loop-me）。本技能是 jxx-grilling 的无状态薄封装。
metadata:
  version: 1.1.0
---

启动一个使用 jxx-grilling 技能的追问会话，全程在聊天中进行，不写入任何本地文件。

## 输入

- 用户在对话中直接提供的计划或设计（无文件参数要求）。

## 输出

- 由 jxx-grilling 会话产出：逐条追问记录与共同确认后的方案，全部留在聊天上下文中。

## 前置条件

- 依赖 jxx-grilling 技能可被宿主触发；若不可用，提示用户确认已安装。
- 用户需提供待 review 的计划或设计；未提供时先请用户给出内容再启动。

## 异常处理

- jxx-grilling 不可触发：提示用户确认该技能已安装。
- 用户未提供计划/设计：先请用户给出待 review 的内容。

## 与其他 grill 类技能的边界

- 在工作目录中且希望留下 CONTEXT.md / ADR → 使用 jxx-grill-with-docs 技能。
- 复杂方案需跨会话续接、调查委派、收尾审核 → 使用 jxx-grill-with-memorial 技能。
- 目标是梳理可委托的工作流 spec → 使用 jxx-loop-me 技能。
- 只需了解 grill 方法论本身 → 使用 jxx-grilling 技能。
