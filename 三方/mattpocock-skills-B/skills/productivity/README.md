# Productivity

通用工作流工具，不特定于代码。

## 用户调用

只有输入它们时才能到达（Claude Code：`disable-model-invocation: true`；Codex：`agents/openai.yaml` 中的 `policy.allow_implicit_invocation: false`）。

- **[grill-me](./grill-me/SKILL.md)** — 关于一个计划或设计被毫不留情地访谈，直到设计树的每个分支都被解决。
- **[handoff](./handoff/SKILL.md)** — 把当前对话压缩成一份交接文档，这样另一个 agent 可以继续这项工作。
- **[teach](./teach/SKILL.md)** — 在多个会话中教用户一个新技能或概念，使用当前目录作为有状态的教学工作空间。
- **[to-questionnaire](./to-questionnaire/SKILL.md)** — 把你无法独自回答的决策转化为一份 Markdown 问卷，交给唯一能回答的人——异步填写，或在一个会议上一起填写。
- **[wait-what](./wait-what/SKILL.md)** — 一条消息没落地的那一刻就触发它。agent 用你缺失的上下文、以通俗英语、使用你的 `CONTEXT.md` 词汇重新表达。

## 模型调用

模型或用户可到达（丰富的触发措辞，让模型可以够到它们）。

- **[grilling](./grilling/SKILL.md)** — 关于一个计划、决策或想法毫不留情地访谈用户，直到设计树的每个分支都被解决。
- **[writing-for-agents](./writing-for-agents/SKILL.md)** — 为 agent 编写文档：技能、AGENTS.md/CLAUDE.md，以及任何 agent 通过指针到达的文档。
