---
name: jxx-claude-handoff
description: 将当前对话交接（handoff）给一个新的后台 agent，使其立即接手工作。
argument-hint: "下一个会话将用于什么？"
disable-model-invocation: true
metadata:
  version: 1.0.0
---

编写当前对话的交接摘要，使新 agent 能继续工作。不要保存摘要，而是启动一个以摘要作为初始提示的后台 agent：`claude --bg --name "<描述性名称>" "<交接摘要>"`。它会在当前工作目录启动并立即返回；用户通过 `claude agents` 管理它。

始终传入 `-n`/`--name` 及描述性名称（如 `--name "Fix login bug"`）——它设置在作业列表、会话选择器和终端标题中显示的名称。

在摘要中包含"建议技能"部分，指出 agent 应调用的技能。

不要重复已在其他工件（PRD、计划、ADR、issue、commit、diff）中捕获的内容，而是通过路径或 URL 引用它们。

隐去敏感信息，如 API 密钥、密码或个人身份信息——摘要会成为 agent 的提示。

如果用户传入了参数，将其视为对下一个会话聚焦内容的描述，并据此调整摘要。
