---
name: jxx-handoff
description: 将当前对话压缩成 handoff（交接）文档，供下一个 agent 接续工作。
metadata:
  version: 1.0.0
argument-hint: "下一个会话将用于什么？"
disable-model-invocation: true
---

撰写一份交接文档，总结当前对话内容，使新的 agent 能够继续工作。保存到用户操作系统的临时目录——而非当前工作区。

在文档中包含"建议技能"部分，推荐 agent 应调用的技能。

不要重复已被其他制品（spec、计划、ADR、issue、commit、diff）记录的内容。应改为引用其路径或 URL。

隐去敏感信息，如 API 密钥、密码或个人身份信息。

如果用户传入了参数，将其视为对下一个会话重点的描述，并据此调整文档。
