---
name: lexiang
version: 2.1.0
x-install: false
description: "乐享（lexiang）知识库 MCP 的引导程序：操作原文已迁入 WeKnora 知识库 dfaaf6fc。当用户提到乐享、lexiang、乐享知识库并要搜索、阅读、创建、编辑、上传或配置时触发。"
---

# 乐享（lexiang）引导程序

**本技能不含操作细节**：乐享官方技能包（路由 + 6 个分域技能，共 29 个文件）已于 2026-10-28
从所有 agent 技能目录卸载，原文存放在 WeKnora 知识库 `dfaaf6fc-1e5d-4385-a290-58c847d71bcb`
（第三方官方 skills 知识库，目录 `lexiang/`）。要做乐享任务，先按本文取原文，再照原文执行。

## 连接（不变）

- 服务端：`https://mcp.lexiang-app.com/mcp`，传输 `streamable-http`
- 鉴权：`Authorization: Bearer <LEXIANG_TOKEN>`（静态 Token，无 OAuth）；URL 必须带 `company_from` 查询参数
- 凭证入口：`https://lexiangla.com/mcp`（401 时去该页点续期，不要重试）
- 本机配置落点：DSH `~/.dsh/profiles/web/cordis.patch.yml`（`mcp-lexiang` 行）、mcporter `~/.mcporter/mcporter.json`、WorkBuddy `~/.workbuddy/mcp.json`
- 工具面由 preset 决定：本机用 `preset=knowledge`（78 把扁平工具，`mcp__lexiang__<tool>`）；不带 preset 只有 7 把 meta 工具，需 `search_tools` → `get_tool_schema` → `call_tool` 动态发现

## 取原文（三步）

所有请求头带 `X-API-Key`（现取现用：凭据腿 `~\Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md`，
不落盘、不回显、不进产出物）。REST 根 `http://123.206.125.149:8127/api/v1`，库 id `dfaaf6fc-1e5d-4385-a290-58c847d71bcb`，
UI `http://123.206.125.149:8127/platform/knowledge-bases/dfaaf6fc-1e5d-4385-a290-58c847d71bcb`。

1. **查索引**：读条目 `lexiang-技能索引`（库根），确认任务属于哪一域。
2. **取原文**，两条腿：
   - **语义腿**（首选）：`POST /knowledge-bases/<kb>/hybrid-search`，body `{"query_text":"<域> <具体动作>","limit":5}`。字段名是 `query_text`，不是 `query`。
   - **确定腿**（语义腿不可用时）：`GET /knowledge-bases/<kb>/knowledge?folder_path=lexiang/<技能名>&page_size=50` 列该技能全部条目 → `GET /knowledge/<id>` 读 `metadata.content`（原文全文）。不依赖向量服务；语义腿返 `code=1007` 或 `embedding ... connection refused` 时直接换这条腿，不要反复重试。
3. **执行**：取到 `<技能名>` 条目正文（= 原 `SKILL.md`）与 `<技能名>-aux-NN-*` 附属文件，按原文操作。

条目基线（2026-10-28 灌装）：30 条全部 `status=publish`、挂 `type:material`，正文落在 `metadata.content`，
`GET /knowledge/<id>` 恒可读。若语义腿与 `GET /knowledge/search` 都返空集，是分块/向量未就绪，照旧走确定腿。

## 分域对照

| 域 | 条目 | 检索关键词 | 关键工具 |
|---|---|---|---|
| 配置 / 凭证 / 401 | `lexiang-setup` | 乐享 配置 凭证 续期 | `whoami` |
| 搜索 / 浏览 / 读内容 | `lexiang-search` | 乐享 搜索 知识库 读条目 | `search_kb_search`、`entry_describe_ai_parse_content` |
| 创建 / 写入 / 导入文档 | `lexiang-writer` | 乐享 建文档 导入 markdown | `entry_create_entry`、`entry_import_content` |
| 编辑页面 Block | `lexiang-blocks` | 乐享 页面 block 编辑 主题 | `block_fetch_page`、`block_update_page` |
| 上传 / 下载文件 | `lexiang-files` | 乐享 文件 上传 下载 目录同步 | `file_apply_upload`、`file_commit_upload` |
| 会议录制 / iWiki 导入 | `lexiang-connectors` | 乐享 连接器 会议 iwiki | connector 域工具 |

## 规矩

- **先取原文再动手**：本文件只有入口与路由，具体参数、示例、坑全在库里；凭记忆猜参数算违规。
- **参数不确定以 `get_tool_schema(tool_name="xxx")` 为准**；不编造 entry / block / file 的 ID 与 URL。
- **改页面先读**：`block_fetch_page` → 最小范围 `block_update_page`。
- **上传文件三步不可跳**：`file_apply_upload` → HTTP PUT → `file_commit_upload`；上传前向用户确认目标知识库与文件。
- 概要结构与坑的一页速查在条目 `lexiang` 与 `lexiang-aux-01-references__tools`（原路由技能正文与工具目录）。
- 恢复某个分域技能成本地技能：按 `lexiang-技能索引` 的「恢复成本地技能」节重建目录；本机另有迁移前完整副本 `JwikisSkills/.temp/backup/lexiang-20261028/`（不随仓库分发）。
