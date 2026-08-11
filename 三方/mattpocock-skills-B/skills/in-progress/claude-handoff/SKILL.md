---
name: claude-handoff
description: 把当前对话交接给一个立即接手工作的全新后台 agent。
argument-hint: "下一个会话将被用于什么？"
disable-model-invocation: true
---

写一份当前对话的交接摘要，让一个全新的 agent 能继续这项工作。而不是保存它，启动一个用摘要作为其提示播种的后台 agent：`claude --bg --name "<描述性名称>" "<handoff summary>"`。它在当前工作目录中启动并立即返回；用户用 `claude agents` 管理它。

总是传递 `-n`/`--name` 及一个描述性名称（例如 `--name "Fix login bug"`）——它设置作业列表、会话选择器和终端标题中显示的显示名称。

在摘要中包含一个 "suggested skills"（建议技能）部分，建议 agent 应该调用的技能。

不要重复已捕获在其他工件中（规格、计划、ADR、issue、commit、diff）的内容。改用路径或 URL 引用它们。

脱敏任何敏感信息，如 API 密钥、密码或个人身份信息——摘要会成为 agent 的提示。

如果用户传递了参数，把它们当作下一个会话将聚焦什么的描述，并相应定制摘要。
