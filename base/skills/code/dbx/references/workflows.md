# DBX 典型工作流

真实调用序列。工具名用原生名，宿主前缀 `mcp__dbx__`。返回体一律是 content 文本（markdown 或 JSON 字符串）。

## ① 连库 → 看结构 → 写 SQL

场景：用户说「查一下 192.168.0.6 上那张表」。

```text
dbx_list_connections
  → 返回 markdown 表：ID / Name / Group Path / Type / Host / Port / Database / Note
  → 「数据服务器192.168.0.6」= connection_id cf9e0baf-91df-482f-b963-0fbee710a05b, host 192.168.0.6:1433, type sqlserver
  → 「设备管理服务器192.168.4.3」= aef2cf5a-033b-4da8-9429-94dcff0b7041

dbx_list_databases { connection_id: "cf9e0baf-91df-482f-b963-0fbee710a05b" }
  → 38 个库的 markdown 列表（master、U9C、U9C20250707、focus、ry-vue、property、WeightData …）

dbx_list_tables { connection_id: "cf9e0baf-…", database: "master" }
  → "- 表名 (TABLE|VIEW)"

dbx_get_schema_context { connection_id: "cf9e0baf-…", database: "master", tables: ["目标表"] }
  → 紧凑列上下文，直接照它写 SQL（最多 20 表）

dbx_execute_query { connection_id: "cf9e0baf-…", database: "master", sql: "SELECT TOP 50 …" }
```

要点：SQL Server 走 `sqlserver-legacy` 驱动（本机 `~/.dbx/agents/state.json` 的 installed_drivers 只有它），方言按 SQL Server 写。**列名从 `describe_table` / `get_schema_context` 取，不要猜。**

## ② 长值分页读取

场景：某个 varchar / text 字段被截断，要读全。

```text
dbx_execute_query {
  connection_id, database,
  sql: "SELECT id, memo FROM t WHERE id = 42",   // 先窄到目标行 + 目标列
  cell_char_limit: 2000,                          // 默认 200，最大 4000
  cell_char_offset: 0                             // 默认 0，最大 1000000
}
  → 结果里标出截断与下一个 offset

dbx_execute_query { …, cell_char_offset: 2000, cell_char_limit: 2000 }   // 沿 offset 往下滑
```

要点：`cell_char_offset` / `cell_char_limit` 对**每个字符串单元格**同时生效，所以先缩小到单行单列，否则浪费上下文。行数上限另由 `max_rows` 控制（默认 100，最大 1000）。`dbx_execute_batch` 支持同样两个参数，作用于每条语句的结果。

## ③ 会话保持（open_session → USE/SET → execute_query）

场景：`USE 某库`、设 `SET`、临时表要跨调用存在。

```text
dbx_open_session { connection_id: "cf9e0baf-…", database: "U9C" }
  → { session_id }
  （需要显式事务时加 enable_transactions: true，预占一条原生 MySQL 连接）

dbx_execute_query { session_id, sql: "USE U9C" }
dbx_execute_query { session_id, sql: "SET NOCOUNT ON" }
dbx_execute_query { session_id, sql: "SELECT …" }      // 同一连接，状态延续
dbx_execute_batch { session_id, sql: "CREATE TABLE #tmp(…); INSERT …;" }  // 临时表也留在会话里

dbx_close_session { session_id }
```

要点：默认 30 分钟空闲过期（`DBX_SESSION_IDLE_TTL_SECS` 可调）。会话内 DDL/DML 照样受写权限约束。事务工具只在原生 MySQL 连接可用：

```text
dbx_open_session { connection_id, enable_transactions: true } → session_id
dbx_begin_transaction { session_id }
dbx_execute_query { session_id, sql: "UPDATE …" }
dbx_commit_transaction { session_id }   // 或 dbx_rollback_transaction
dbx_close_session { session_id }
```

## ④ 批量脚本（execute_batch）

场景：一次跑多语句建表脚本 / 数据修补脚本。

```text
dbx_execute_batch {
  connection_id, database,
  sql: "…;…;…;",
  continue_on_error: false,       // 默认 false：首条失败即停
  cell_char_limit: 2000           // 可选，作用于每条语句结果
}
  → 每条语句一个结果

// 要整体成功或整体回滚
dbx_execute_batch { connection_id, database, sql, use_transaction: true }
  → 单条合并结果；不能同时带 session_id 或 continue_on_error；
     MySQL 系 DDL 脚本直接拒绝（DDL 隐式提交，回滚不了）
```

要点：语句由方言感知解析器拆分，字符串/注释/存储过程里的分号不会误切。单语句脚本的 `use_transaction` 被忽略。连接级失败永远中断，`continue_on_error` 不兜。

## ⑤ 文件定时备份（两阶段确认）

场景：每天 03:30 把某个目录同步到备份连接。

```text
dbx_list_connections                      → 拿源/目标 connection_id
dbx_files__files_ui_quick_paths { }       → 确认路径存在（limit 硬顶 50）
dbx_files__files_scan_digest { path, depth: 3, glob: "**/*.bak" }   // 摸底

// 1) 预览：不带 confirmToken，只回 preview + 一次性 token，不写任何东西
dbx_files__schedule_create {
  name: "daily-db-backup", kind: "sync",        // sync 镜像 | copy 增量 | bisync 双向
  sourceConnectionId, sourcePath,
  targetConnectionId, targetPath,
  cron: "30 3 * * *",                            // 五段 cron，服务端校验
  enabled: true
}

// 2) 用户批准后，原样重发同样参数 + confirmToken（60s 有效）
dbx_files__schedule_create { …同上…, confirmToken: "<token>" }

dbx_files__schedule_list                   → cron / 源目 / enabled / 上次结果 / 下次触发
dbx_files__schedule_history { id, limit: 50 }  // 历史默认 100，最大 500
dbx_files__schedule_run_now { id }          // 立即跑，同样两阶段；同一任务在跑时拒绝
```

要点：`kind:"sync"` 是镜像——目标多出来的文件会被删，需要目标连接 `allow_delete`，可用 `options.maxDelete` 兜住删除量。审查先跑 `dbx_files__files_sync` 的 `dryRun:true`。任务运行是异步 job，轮询 `schedule_history`。

## ⑥ Redis / Kafka 巡检

```text
// Redis
dbx_list_connections                        → 找 redis 类型连接
dbx_execute_redis_command { connection_id, db: 2, command: "SCAN 0 COUNT 100" }
  → 用 db 参数选库，不要发 SELECT；枚举 key 用 SCAN，不要 KEYS

// Kafka
dbx_peek_messages { connection_id, topic: "orders", count: 20 }
  → JSON：base64 payload + UTF-8 预览 + 元数据 + incomplete + outputTruncated
  → count 1–100，默认 20；不提交 offset；输出预算 256 KiB
dbx_send_message { connection_id, topic, payload_base64, payload_text, key }
```

要点：`dbx_peek_messages` 只支持 Kafka；RocketMQ / RabbitMQ 只能发不能 peek。发送前把 payload 的 base64 与文本预览一起给用户确认。
