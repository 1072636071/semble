# DBX 陷阱与失败恢复

数字全部取自工具 description 原文。工具名用原生名（宿主前缀 `mcp__dbx__`）。

## 行数与长值

- `dbx_execute_query` **默认 100 行**；`max_rows` **上限 1000**，更大值被 clamp，不报错——你以为要 5000 行，实际只回 1000。
- **MongoDB shell 命令**永远最多 100 行，`max_rows` 无效。
- **多语句脚本 / 存储过程脚本**被路由到 batch 执行器，每条语句最多 **100 行**，`max_rows` 同样无效。要更多行就拆成单语句查询。
- `cell_char_limit` **默认 200，最大 4000**；`cell_char_offset` **默认 0，最大 1000000**，最小 0。只增 limit 不收窄查询会挤爆上下文。

## 会话与事务

- 会话 **空闲 30 分钟**过期（默认，`DBX_SESSION_IDLE_TTL_SECS` 可调）。过期后残留 `session_id` 会失败——重开一个，别重试旧 ID。
- `dbx_open_session` 默认不预占连接；要用事务工具必须带 `enable_transactions: true`。
- 事务工具（begin / commit / rollback）**仅原生 MySQL 连接可用**。SQL Server、Postgres、Redis 上一律不可用；SQL Server 的 `#tmp` 靠会话保持，不靠事务工具。
- `dbx_commit_transaction` 只在 MySQL 确认 COMMIT 之后才报 committed——看到 committed 才算落盘。

## 批量执行

- `dbx_execute_batch` **首条失败即停**，除非 `continue_on_error: true`。**连接级失败永远停**，`continue_on_error` 兜不住。
- `use_transaction: true` 的三条互斥：不能与 `session_id` 同用、不能与 `continue_on_error` 同用、**MySQL 系 DDL 脚本直接拒绝**（DDL 隐式提交，回滚不了）。
- `use_transaction` 只在多语句脚本生效；单语句脚本忽略该参数，按普通自动提交跑。
- 需要"先建临时表再查"就带 `session_id`，不是 `use_transaction`。

## Redis

- 用 `db` 参数选逻辑库，**不要发 `SELECT`**。
- 枚举 key 用 `SCAN`，**不要 `KEYS`**（阻塞生产实例）。

## Kafka / 消息队列

- `dbx_peek_messages` 最多 **100 条、默认 20**，**不提交 offset**——看到的消息会再被别的消费者看到。
- 输出预算 **256 KiB**：超了带 `outputTruncated`；broker 只读到部分数据带 `incomplete`。两者都为真时结论要打折。
- `start_position` 三值：`latest`（默认）/ `earliest` / `offset`；用 `offset` 时 **`offset` 必填**。
- `dbx_peek_messages` **只支持 Kafka**；RocketMQ / RabbitMQ 只有 `dbx_send_message`。

## Files 写入与删除

- `files_write` 是 base64，解码后**硬顶 4 MiB**，MCP 建议 **≤1 MiB**；更大走 workbench 上传通道。空字符串 = 建空文件。
- `files_delete`、`files_purge`、`schedule_create`、`schedule_run_now`、`schedule_delete` **都是两阶段**：先不带 `confirmToken` 调一次拿预览 + 一次性 token，**60 秒**内**原样参数**再调一次执行。改任何参数都得重新预览。
- `files_purge` 拒绝连接根与 `/`。
- `files_rename` **不支持目录**，目录改名用 workbench 或 `files_sync`。
- `files_sync` 的 `sync:true` 是 **rclone sync 语义（镜像）**：目标有、源没有的文件会被**删除**；目标连接必须 `allow_delete`，`maxDelete` 可兜上限。先 `dryRun:true`。
- `files_sync` **独立 stdio 模式下不可用**（需要 DBX 事件通道），且是异步 job，答案里带 `jobId`。
- `files_scan_digest` 的 cursor **10 分钟**过期，过期只能重扫；`files_cursor_next` 的 n 最大 20，且不重发条件、不重扫。
- `files_scan_digest` 参数边界：`depth` 1–16（默认 8），条目上限 100k，扩展名分组 ≤20，最大/最新文件各 ≤10，样本 ≤5 行，`format:'rows'` 最多 20 行。

## 桌面端依赖

- `dbx_execute_and_show`、`dbx_open_table` **要求 DBX 桌面端在跑**，否则失败。失败不是 SQL 写错了——先确认桌面端，再改用 `dbx_execute_query` 把结果以文本返回。
- `files_ui_focus` / `files_ui_search` / `files_ui_select` 没有前端时报 `state=pending` 并带提示；别重试，改用 `files_scan_digest`，或 `files_ui_state` 复查那个 intent。
- `files_ui_quick_paths` 的 limit **硬顶 50**。

## Salesforce

- `dbx_salesforce_prepare_write` 一次**只处理一条记录**；`insert` / `update` 的 `fields` 非空，`update` / `delete` 必须给 `id`，`fields` 里**绝不能带 `Id`**。
- token **单次使用、5 分钟过期**、绑定那一条语句；改了写内容就要重新 prepare。
- Salesforce 无事务，apply 之后不能回滚。先 `dbx_salesforce_current_user` 看清是谁的身份在写、有没有 Modify All Data。
- 纯读不需要两步流程，直接 `dbx_execute_query` 发 SOQL。

## 参数契约易错点

- 连接既可以给 `connection_id` 也可以给 `connection_name`（`dbx_remove_connection` 用 `connection_name` / `connection_id` 任一）。**优先用 ID**，名字可能重名。
- `dbx_get_schema_context` 的 `max_tables` 是 **1–20**，超范围是参数错，不是静默截断。
- `schedule_history` 的 `limit` 默认 **100、最大 500**。
- `schedule_create` 的 `cron` 是 **五段**表达式，服务端校验；目标是只读连接会被拒。
- `schedule_run_now` 是 **single-flight**：同一任务已有在跑的运行会被拒绝，等它结束。
- `dbx_add_connection` 的 `port` 0–65535，`username` / `password` 默认空串。
- `dbx_list_routines` 在不支持的库返回**空列表**，不是错误——换库重试没意义。
- `files_scan_digest` 的 `glob`：`*` 不跨目录段，`**` 跨段，`?` 匹配单字符。

## 失败恢复

| 现象 | 下一步 |
| --- | --- |
| 查不到连接 / 名字对不上 | 重跑 `dbx_list_connections`，按 Host 或 Name 匹配取 ID，别猜 |
| 库列表为空或只有少数库 | 该连接有数据库白名单，由 DBX 桌面端 MCP 设置控制；告诉用户去桌面端放开，不要绕 |
| 表列表拿不准 schema | 先 `dbx_list_databases` 定库，再 `dbx_list_tables` 带 `database` / `schema` |
| 列名报错 | 用 `dbx_describe_table` 或 `dbx_get_schema_context` 取真实列名，别猜 |
| 行数比预期少 | 撞到 1000 上限 / batch 的 100 行 / MongoDB 的 100 行；拆查询或分页 |
| 长值仍被截断 | 加 `cell_char_offset` 沿下一个 offset 继续，单值最多 4000 字符一屏 |
| 会话报已失效 | 30 分钟空闲过期，重开 `dbx_open_session` |
| 事务工具报不可用 | 该连接不是原生 MySQL，或会话没带 `enable_transactions: true` |
| batch 中途停了 | 默认首条失败即停；需要跑完加 `continue_on_error: true` |
| `use_transaction` 被拒 | 同时带了 `session_id` / `continue_on_error`，或脚本是 MySQL DDL |
| `state=pending`（files_ui_*） | 桌面 workbench 没开；改用 `files_scan_digest` |
| `execute_and_show` / `open_table` 失败 | 桌面端没跑；改用 `dbx_execute_query` 文本返回 |
| token 失效 | 两阶段 token 60 秒、单次；重新预览拿新 token |
| cursor 过期 | 10 分钟；重跑 `files_scan_digest` |

## 安全边界（硬性）

- 写操作与 DDL（`INSERT` / `UPDATE` / `DELETE` / `ALTER` / `DROP` / `TRUNCATE`、以及 `dbx_add_connection` / `dbx_remove_connection` / `dbx_duplicate_connection`）**先向用户说明影响面并等确认**。
- 破坏性 files 操作（`files_delete`、`files_purge`、`files_sync` 的 `sync:true`、`schedule_delete`）**先预览再确认**，把预览摘要原文给用户。
- `dbx_send_message` 发送前把 payload 预览给用户确认。
- **数据库白名单与写权限由 DBX 桌面端设置控制**，不是本技能能绕过的：只读连接不会列出 `files_delete` / `files_purge`，白名单外的库根本不出现。权限不足就如实报告，不要找替代路径。
