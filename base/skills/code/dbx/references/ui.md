# DBX UI 指针

## 这个 MCP 没有自带 UI HTML

DBX 是第三方桌面应用（`C:\Users\jxc123\.dbx\bin\dbx-mcp.exe`，v0.4.127），不是本仓自带的 Web UI 插件。**没有 `ui://` 资源，没有 HTML 文件路径，也没有 `present_files` 可打开的东西。不要臆造 UI 文件路径。**

唯一声明的 MCP resource 是 `dbx://connections`——markdown 连接表。要看连接清单就读它，或直接调 `dbx_list_connections`，两者内容同源。

## 人类界面 = DBX 桌面端本身

用户真正看的界面是 DBX 桌面应用窗口：连接树、SQL 编辑器、结果网格、文件 workbench、定时任务页。agent 能做的是**把结果推给它**，不是自己画界面。

## agent 把结果给人看的两条路

| 工具 | 什么时候用 |
| --- | --- |
| `dbx_execute_and_show` | 用户要在 DBX 里看到完整结果网格（列宽、复制、导出），而不仅是聊天里的一段文本 |
| `dbx_open_table` | 用户要看某张表的数据，或要在桌面端接着改 |

**两者都要求 DBX 桌面端在跑**，否则调用失败。失败时不要重试或换参数猜：改用 `dbx_execute_query` 把结果以文本返回，并告诉用户「桌面端没开，所以只在会话里给文本」。

典型判断：一次性的核对、只读结论 → 文本即可（`dbx_execute_query`）；用户要接手继续操作、要看大结果集 → 推桌面端（`dbx_execute_and_show`）。

## Files workbench 指针（不是 UI 文件，是桌面面板控制）

Files Studio 在桌面端有个 workbench 面板（browse / transfers / audit）。这四个工具操作那个面板，**需要 DBX workbench 开着**：

| 工具 | 作用 |
| --- | --- |
| `files_ui_focus` | 聚焦面板：`browse` / `transfers` / `audit` |
| `files_ui_search` | 把路径填进 workbench 路径框并触发分页列目录，用户能接着操作 |
| `files_ui_select` | 按路径定位并高亮文件表里的某一行 |
| `files_ui_state` | 按 `intentId` 读上次意图的结果；不带则读前端最新快照（面板、计数、选中路径） |

没有前端时这些调用报 `state=pending` 并带提示——**不要重试**，改用 `files_scan_digest` 拿聚合结论，或稍后用 `files_ui_state` 复查那个 intent。

## 无 UI 时的降级表

| 想要 | UI 可用 | UI 不可用 |
| --- | --- | --- |
| 展示查询结果 | `dbx_execute_and_show` | `dbx_execute_query` 文本 + 摘要 |
| 打开表 | `dbx_open_table` | `dbx_execute_query` 取前 N 行 |
| 定位文件 | `files_ui_search` / `files_ui_select` | `files_scan_digest` + `files_cursor_next` |
| 看传输进度 | `files_ui_focus("transfers")` | `files_ui_state` 或 `schedule_history` |
