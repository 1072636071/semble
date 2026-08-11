---
name: jxx-handoff
description: 将当前对话压缩成 handoff（交接）文档，供下一个 agent 接续工作。
---

# Handoff

撰写交接文档，总结当前对话，使新 agent 能继续工作。保存到操作系统临时目录，而非当前工作区。

## Guidelines

- 包含"建议技能"部分，推荐下一个 agent 应调用的技能。
- 不要重复已被其他制品（spec、计划、ADR、issue、commit、diff）记录的内容。改为引用其路径或 URL。
- 隐去敏感信息——API 密钥、密码、个人身份信息。
- 若用户传入参数，视为对下一个会话重点的描述，据此调整文档。
