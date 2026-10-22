# DBX 能力地图

43 个工具，8 层工作流。**入口工具**加粗——不确定从哪开始时先调它。

宿主平面名 = `mcp__dbx__<原生名>`。`dbx_files__*` 原生名已带命名空间，完整形如 `mcp__dbx__dbx_files__files_write`。

## 1. 定位连接（4）

| 工具 | 作用 |
| --- | --- |
| **`dbx_list_connections`** | **入口。**列 DBX 里配置的连接：ID、名字、分组路径、类型、地址端口、默认库、备注 |
| `dbx_add_connection` | 新建连接（必填 name / db_type / host；port 0–65535、username、password、database、ssl、driver_profile 选填） |
| `dbx_duplicate_connection` | 连同凭据、隧道、分组整份复制（必填 new_name） |
| `dbx_remove_connection` | 删连接（connection_id 或 connection_name） |

## 2. 探查结构（6）

| 工具 | 作用 |
| --- | --- |
| **`dbx_list_databases`** | 列库。有白名单的连接只返回允许的库；无默认库时先调它 |
| **`dbx_list_tables`** | 列表和视图（返回形如 `- 表名 (TABLE|VIEW)`） |
| **`dbx_describe_table`** | 单表列定义 |
| **`dbx_get_schema_context`** | 写 SQL 前的紧凑表/列上下文；`tables` 指定表，`max_tables` 1–20 |
| `dbx_list_routines` | 存储过程/函数列表，可按 PROCEDURE / FUNCTION 过滤；不支持的库返回空列表 |
| `dbx_get_routine_source` | 取例程源码全文（name + object_type 必填，Oracle 之类重载需 signature） |

## 3. 查询执行（3）

| 工具 | 作用 |
| --- | --- |
| **`dbx_execute_query`** | **默认执行入口。**默认 100 行，`max_rows` 上限 1000；长值用 `cell_char_limit` / `cell_char_offset` 展开 |
| `dbx_execute_batch` | 多语句脚本，逐语句返回；方言感知拆分（字符串、注释、存储过程中的分号安全） |
| `dbx_execute_redis_command` | Redis 命令；用 `db` 参数选库，不用 `SELECT` |

## 4. 会话与事务（5）

| 工具 | 作用 |
| --- | --- |
| **`dbx_open_session`** | **有状态入口。**钉住一条后端连接，返回 `session_id`；USE / SET / 会话变量 / 临时表跨调用保持 |
| `dbx_close_session` | 关会话，释放钉住的连接 |
| `dbx_begin_transaction` | 开始事务（仅原生 MySQL 连接，且会话需可事务） |
| `dbx_commit_transaction` | 提交；MySQL 确认 COMMIT 后才报 committed |
| `dbx_rollback_transaction` | 回滚；写策略被撤销后仍可用于清理 |

## 5. 外部写入（Salesforce，3）

| 工具 | 作用 |
| --- | --- |
| **`dbx_salesforce_current_user`** | **入口。**读身份与权限（是否 Modify All Data）；只读，先调它再准备写 |
| `dbx_salesforce_prepare_write` | 两步之一步：准备**恰好一条**记录的 insert/update/delete，不发请求；返回摘要 + 单次 `confirm_token` |
| `dbx_salesforce_apply_write` | 两步之二：带 token 执行被批准的那一条写 |

## 6. 消息队列（2）

| 工具 | 作用 |
| --- | --- |
| **`dbx_peek_messages`** | **入口。**Kafka 只读预览，最多 100 条、默认 20，不提交 offset；仅支持 Kafka |
| `dbx_send_message` | 发消息到 Kafka / RocketMQ / RabbitMQ（payload_base64 必填；RabbitMQ 用 exchange / routing_key / namespace） |

## 7. 文件与定时备份（Files Studio，18）

浏览与只读：`files_ui_quick_paths`、`files_scan_digest`、`files_cursor_next`、`files_ui_state`。
写入与同步：`files_write`、`files_mkdir`、`files_rename`、`files_sync`。
破坏性（两阶段确认）：`files_delete`、`files_purge`、`schedule_delete`；创建/触发同样两阶段：`schedule_create`、`schedule_run_now`。
定时任务只读：`schedule_list`、`schedule_history`。
UI 指针：`files_ui_focus`、`files_ui_search`、`files_ui_select`。

| 工具 | 作用 |
| --- | --- |
| **`files_scan_digest`** | **入口。**递归扫描只回聚合（数量、扩展名分组、最大/最新、总量、样本、cursorId）；`format:'rows'` 换定位行 |
| `files_cursor_next` | 按 cursorId 翻下一批（n ≤ 20，cursor 10 分钟过期） |
| `files_ui_quick_paths` | 连接的快捷位置（根 + 已 stat 的用户目录，limit 硬顶 50） |
| `files_write` | 写小文件（base64，解码后硬顶 4 MiB） |
| `files_mkdir` | 建目录（mkdir -p）；对象存储写 `.keep` 占位 |
| `files_rename` | 同连接内改名/移动（走 rclone movefile；**不支持目录**） |
| `files_sync` | 两连接间同步/复制；`sync:true` 是镜像（删目标多余文件），`dryRun:true` 只计划 |
| `files_delete` / `files_purge` | 删文件 / 递归删目录树（purge 拒绝连接根与 `/`）；均两阶段 |
| `schedule_list` / `schedule_history` | 定时任务清单 / 运行历史（只读） |
| `schedule_create` / `schedule_run_now` / `schedule_delete` | 建/立即跑/删定时任务，均两阶段 |
| `files_ui_focus` / `files_ui_search` / `files_ui_select` / `files_ui_state` | 桌面 workbench 面板交互，见 `ui.md` |

## 8. 桌面 UI 呈现（2）

| 工具 | 作用 |
| --- | --- |
| **`dbx_execute_and_show`** | 在 DBX 桌面端界面里执行 SQL 并展示结果。**要求桌面端在跑** |
| `dbx_open_table` | 在桌面端打开一张表。**要求桌面端在跑** |

## 初始暴露集

工具按连接与设置动态可见：只读连接不会列出 `files_delete` / `files_purge`；白名单连接只返回允许的库。以 `dbx_list_connections` + 实际工具清单为准，别假设某个工具一定在。
