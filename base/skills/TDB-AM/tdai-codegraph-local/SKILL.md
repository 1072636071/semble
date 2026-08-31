---
name: tdai-codegraph-local
description: 让本地代码仓库享受 Code_Graph 能力——常驻本地 KS（单守护进程多仓库）+ 用户级 MCP 注册，本地份查询工作区真相（含未提交改动），远端兜底 + remote URL 认亲。安装/起停/健康/仓库增删由用户显式指定。
version: 0.1.0
---

## 目的与适用

本机常驻一个本地精简版 Knowledge Service（`local-server.ts`），为本地代码仓库建立 Code_Graph 索引（`source_type=local`），coding agent 通过 MCP 工具查询工作区真相（含未提交改动）。

- **本地份 + 远端兜底路由**：配 `KNOWLEDGE_FALLBACK_BASE_URL` + remote URL 认亲——本地命中不转发；本地 404 认亲命中由本地作答；否则原样转发远端。
- **单守护进程 + 多仓库**：主仓库 auto-register，其余仓库经 `/code-graph/create(source_type=local)` 追加，一个守护、一个 MCP 覆盖全部目标仓库。
- **常驻服务 + 用户级 MCP 注册**：所有会话共享同一套工具。
- **MemoryKnowledge 编译件分发**：`npm pack` tarball 随技能分发，运行时不依赖源码仓库。

## 凭据与配置

运行向导落地守护配置（MemoryKnowledge 编译件路径、仓库清单、守护端口、远端兜底 URL、MCP 注册）：

```bash
node <skills-dir>/tdai-codegraph-local/scripts/setup.mjs
```

本地工作根 `~/.tdai/`：`runtime/`（编译件 + node_modules）、`config/`（JSON）、`state/`（PID/日志）、`data/`（SQLite）。`.codegraph/` 索引留在各仓库（自动 gitignore）。

## 操作域

| 操作域 | 状态 |
| --- | --- |
| 安装（编译件 tarball → `~/.tdai/runtime`） | 待实现 |
| 守护进程管理（start/stop/status/health） | 待实现 |
| 用户级 MCP 注册 | 待实现 |
| 仓库增删（主仓库 + API 追加） | 待实现 |
| 远端兜底 + remote URL 认亲 | 待实现 |

## 验证成功标准

- 守护健康，MCP `tools/list` 可见 Code_Graph 工具。
- 目标仓库可查询（含未提交改动）。
- 追加资产的查询前刷新/认亲逐资产生效（需实测）。
