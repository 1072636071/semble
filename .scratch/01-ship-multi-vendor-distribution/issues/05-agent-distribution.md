# Agent 分发 + agents 目录缺失跳过

**Status:** ready-for-agent

**Blocked by:** 02

**构建内容：** Agent 首次纳入分发流程：`base/agent/` 下的定义与 Skills 同权走双模式，装到已声明 agents 目录的 4 家平台；agents 目录未声明的 3 家跳过并打印警告；`x-install: false` 对 Agent 同样生效。

**验收标准：**

- [ ] 含 `AGENT.src.md` 的 agent 走派生安装到已声明 agents 目录的 4 家
- [ ] 普通 `.md`（含中文文件名）agent 原样复制安装，行为与现状一致
- [ ] agents 目录未声明的平台被跳过且打印含平台名的警告，命令继续执行
- [ ] `x-install: false` 的 agent 不安装
- [ ] agent 与 skill 的分发在同一命令全流程内完成
- [ ] 本切片配套 `node:test` 用例在临时目录通过

## 评论

（评论与对话历史追加于此，新内容置于最前。）
