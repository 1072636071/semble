---
name: dbx
description: "DBX 数据库客户端：跑 SQL、看库结构、Redis/Kafka、备份同步。当用户说跑 SQL、看库结构、dbx 时触发。"
metadata:
  version: 1.0.0
---

# DBX 引导

DBX 是数据库桌面客户端，自身就带 MCP server。本技能教你怎么开它的 43 个工具：先定位连接，再探结构，再查数据；写入类操作一律先问用户。

工具在宿主平面注册为 `mcp__dbx__<原生名>`，例如 `mcp__dbx__dbx_list_connections`、`mcp__dbx__dbx_files__files_write`。下文一律用原生名。

## 最小可用路径

1. **定位连接** — `dbx_list_connections`。返回 markdown 表：ID / Name / Group Path / Type / Host / Port / Database / Note。用户报机器地址（如「192.168.0.6」）就按 Host 或 Name 匹配，拿到 `connection_id`。别猜 ID。
2. **探结构** — `dbx_list_databases` → `dbx_list_tables` → `dbx_describe_table`（单表列定义），或 `dbx_get_schema_context`（写 SQL 前的紧凑上下文，最多 20 表）。
3. **查数据** — `dbx_execute_query`，默认 100 行，`max_rows` 最大 1000。
4. **要保会话** — `dbx_open_session` 拿 `session_id`，后续 `dbx_execute_query` / `dbx_execute_batch` 带同一个 `session_id`，结束 `dbx_close_session`。

返回体统一是 MCP content 文本（markdown 或 JSON 字符串），不是结构化对象，按文本读。

## 何时读哪篇

- `references/capability-map.md` — 用户问「能干什么」、或你不确定该调哪个工具时读：43 工具按 8 层工作流分组，标出入口工具。
- `references/workflows.md` — 要照真实链路走时读：连库看结构写 SQL、长值分页、会话保持、批量脚本、文件定时备份、Redis/Kafka 巡检，每条带具体工具名与参数。
- `references/pitfalls.md` — 调参前、或调用报错后读：默认值与上限、两阶段确认、失败恢复。
- `references/ui.md` — 用户要看结果、或要开表/开面板时读：人类界面是 DBX 桌面端本身。

## 安全边界

- **写操作与 DDL 先问用户**：`INSERT` / `UPDATE` / `DELETE` / `ALTER` / `DROP` / `TRUNCATE` 一律先说清影响面、等确认再发。默认只读探查。
- **破坏性文件操作先预览**：`files_delete`、`files_purge`、`files_sync`（`sync:true` 删除目标多余文件）、`schedule_delete` 先拿预览摘要给用户，再带 `confirmToken` 执行。
- **Salesforce 写入**：`dbx_salesforce_prepare_write` 拿摘要 + token，等用户批准再 `dbx_salesforce_apply_write`。Salesforce 无事务，写不可回滚。
- **数据库白名单与写权限由 DBX 桌面端设置控制**，本技能绕不过去；只读连接根本不会列出 `files_delete` / `files_purge`。
