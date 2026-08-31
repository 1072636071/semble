---
name: tdai-wiki-local
description: 让本地代码仓库享受 Wiki 知识库能力——手动指定仓库文件建成远端 wiki（create/raw 上传/ingest），每仓库一个 wiki 资产；查询经本地守护进程 MCP 兜底转发到远端。复用 panel-admin 凭据。
version: 0.1.0
---

## 目的与适用

把本地代码仓库选定的文档同步到**远端** wiki（Wiki 引擎只在远端），供 coding agent 检索。

- **数据源纯手动**：用户每次指定要入库的仓库文件（上传为 raw → ingest），不做自动收集（README/docs 扫描均不做）。
- **每仓库一个 wiki 资产**：按仓库 basename 命名，知识库边界清晰。
- **查询复用守护进程 MCP 兜底转发**：本地 KS 透传 wiki 工具 + 远端兜底，wiki 资产本地 404 → 原样转发远端作答；agent 一套 MCP 同时拿到 Code_Graph（本地）+ Wiki（远端转发）。
- **单向依赖守护进程**：查询需守护在跑；守护未运行时提示先启动（`tdai-codegraph-local`）。

## 凭据与配置

复用 `tdai-panel-admin.json`（panel_url / service_id / user_key），由 `panel-admin` 的凭据向导维护；本技能不重复配置。

```bash
node <skills-dir>/tdai-wiki-local/scripts/setup.mjs   # 校验/复用 panel-admin 凭据
```

**密钥纪律**：user_key 视为机密，不进文档/对话回显/仓库/日志。

## 操作域

| 操作域 | 状态 |
| --- | --- |
| Wiki 生命周期（create / raw 上传 / ingest / 状态轮询） | 待实现 |
| 查询（search / page/read / graph，经守护兜底转发远端） | 待实现 |
| 仓库 → wiki 资产映射管理 | 待实现 |

## 验证成功标准

- 手动指定文件入库全链路可跑通（每仓库一个 wiki 资产）。
- 查询经守护 MCP 兜底转发远端 wiki 生效（需实测）。
