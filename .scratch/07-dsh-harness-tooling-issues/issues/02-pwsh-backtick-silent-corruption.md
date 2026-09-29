# pwsh 内联 node 反引号静默丢失检测

**Status:** ready-for-agent

**Blocked by:** 无——可立即开始

**构建内容：** 检测或警告 `pwsh -Command "node -e …"` 中反引号被 PowerShell 当转义符吃掉的问题。

**验收标准：**

- [ ] harness 侧：pwsh 工具检测到命令含反引号时给出警告
- [ ] 或：文档明确禁令已在 starter/dev.md 固化（已完成 2026-09-29）

## 评论

- [2026-09-29] 创建：75-b04 会话实证 `pwsh -Command` 内联 `node -e` 含 `join('\u0060')` 时，反引号被吃掉，7 处注释损伤全不可见（node --check 和测试全过）。
