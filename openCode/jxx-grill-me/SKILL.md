---
name: jxx-grill-me
description: 一场 relentless 的 grill 追问，用以打磨（sharpen）计划或设计。当用户不在工作目录中工作、想锐化任何不在仓库中的计划或设计时使用；无状态，不在本地保存任何东西，决策以 markdown 块留在聊天中。
---

# Grill Me

无状态的 grill 追问：不在工作目录中工作时打磨计划或设计。决策留在聊天中，不写文件。

## Guidelines

- 启动 `jxx-grilling` 会话，由其驱动逐轮追问；本技能是其无状态薄封装。
- 用户在对话中直接提供计划或设计，无文件参数。
- 不在本地保存任何东西，不构建 `CONTEXT.md`——与 `jxx-grill-with-docs` 的有状态版本互补。
- 若用户未提供计划/设计，先请用户给出待 review 的内容，再启动会话。
- 若 `jxx-grilling` 不可触发，提示用户确认该 skill 已安装。

## References

- `jxx-grilling` — 共享的 grill 原语，本技能是其无状态包装。
- `jxx-grill-with-docs` — 有状态版本，在工作目录中工作时使用。
