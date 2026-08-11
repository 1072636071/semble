# spz-git-guardrails-claude-code

设置 Claude Code hooks，在执行前拦截并阻止危险的 git 命令（push、reset --hard、clean、branch -D 等）。

## 何时使用

当用户想要防止破坏性 git 操作、添加 git 安全 hooks、或在 Claude Code 中阻止 git push/reset 时使用。
