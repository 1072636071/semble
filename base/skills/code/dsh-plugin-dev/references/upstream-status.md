# 上游状态快照（dsh 官方源核对）

> 本文件由 `scripts/sync-docs.mjs` 自动维护，记录 DeepSeek Harness 官方上游的版本、依赖、内置工具包清单与仓库活动状态。
> 每次修改技能源码后，如内容与上游相关，请运行 `node scripts/sync-docs.mjs` 重新核对。
> **不要手改**「更新时间」「依赖版本」「内置工具包」三节——它们由脚本覆盖。

## 最近一次核对

- 更新时间：`2026-09-01`
- 上游仓库：`deepseek-ai/deepseek-harness`（默认分支 `master`）
- 仓库描述：`DeepSeek Harness: Everything is a Plugin.`
- 上游仓库最近提交（pushed_at）：`2026-08-31T16:03:39Z`

## 核心依赖版本（@deepseek-ai/*）

| 包 | 最新版本 | 用途 |
| -- | -------- | ---- |
| `@deepseek-ai/cordis` | `4.0.2` | 底层元框架（Context / Service） |
| `@deepseek-ai/schemastery` | `3.18.2` | 配置 schema 定义与校验 |
| `@deepseek-ai/dsh-tools` | `0.0.1-rc.1` | 工具注册 API |
| `@deepseek-ai/dsh-settings` | `0.0.1-rc.1` | 运行时设置服务 |
| `@deepseek-ai/dsh-tool-fs` | `0.0.1-rc.1` | 文件系统工具包 |

## 内置工具包清单（@deepseek-ai/dsh-tool-*）

当前上游仓库 `packages/` 下共 `23` 个工具包：

| 包后缀 | 用途 | npm 最新版本 |
| ------ | ---- | ------------ |
| `agent-team` | 多 Agent 团队协作 | `—` |
| `ask-user` | 向用户提问/收集输入 | `0.0.1-rc.1` |
| `bash` | 执行 Bash 命令 | `0.0.1-rc.1` |
| `bash-persistent` | 持久化 Bash 会话 | `0.0.1-rc.1` |
| `cordis` | Cordis 元框架能力工具 | `0.0.1-rc.1` |
| `fs` | 文件系统读写 | `0.0.1-rc.1` |
| `fs-search` | 文件系统搜索 | `0.0.1-rc.1` |
| `goal` | 目标追踪 | `0.0.1-rc.1` |
| `jobs` | 后台任务/作业 | `0.0.1-rc.3` |
| `lsp` | 语言服务器协议（代码语义） | `0.0.1-rc.1` |
| `pwsh` | 执行 PowerShell 命令 | `0.0.1-rc.1` |
| `pwsh-persistent` | 持久化 PowerShell 会话 | `0.1.0-rc.8` |
| `ralph` | 工作流编排引擎 | `0.0.1-rc.1` |
| `session-query` | 会话查询 | `0.0.1-rc.1` |
| `skill` | 技能相关工具 | `0.0.1-rc.1` |
| `str-replace-editor` | 字符串/文本替换编辑器 | `0.0.1-rc.1` |
| `subagent` | 子代理 | `0.0.1-rc.1` |
| `subagent-control` | 子代理控制/管理 | `0.0.1-rc.1` |
| `subagent-report` | 子代理报告 | `0.0.1-rc.1` |
| `terminal` | 终端交互 | `0.0.1-rc.5` |
| `todo` | 待办/任务清单 | `0.0.1-rc.1` |
| `web` | 网页抓取/搜索 | `0.0.1-rc.1` |
| `workflow` | 工作流编排 | `0.0.1-rc.1` |

## 上游核对说明

- **数据源**：GitHub API `api.github.com/repos/deepseek-ai/deepseek-harness`（仓库元数据）+ `git/trees/master?recursive=1`（包结构）；npm registry `registry.npmjs.org/@deepseek-ai/<pkg>`（版本）。
- **工具包判定规则**：路径形如 `packages/<组>/tool-<名>` 的目录视为内置工具包；仅计含 `src/` 的正式实现目录。
- **网络不可达时**：脚本保留上次快照不覆盖，并记录 `syncOk: false`。
