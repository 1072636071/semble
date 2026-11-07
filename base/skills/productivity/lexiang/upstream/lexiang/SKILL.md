---
name: lexiang
description: 乐享知识库 MCP 的统一入口与路由。当用户提到乐享、lexiang、乐享知识库并要搜索、阅读、创建、编辑、上传或配置时触发。按任务类型分流到分域技能。
---

# 乐享知识库 MCP 使用引导

## 连接方式

- 服务端：`https://mcp.lexiang-app.com/mcp`
- 传输：`streamable-http`
- 鉴权：`Authorization: Bearer <LEXIANG_TOKEN>`（静态 Token，无 OAuth）
- URL 必须带 `company_from` 查询参数（租户标识，与 Token 同租户）
- 配置落点（本机三处均已写入）：
  - DSH：`~/.dsh/profiles/web/cordis.patch.yml` 的 `mcp-lexiang` 行（`@deepseek-ai/dsh-mcp-client`）
  - mcporter：`~/.mcporter/mcporter.json`
  - WorkBuddy：`~/.workbuddy/mcp.json`
- 获取凭证：`https://lexiangla.com/mcp`

## 工具面由 preset 决定（关键）

| preset | 工具数 | 说明 |
|--------|--------|------|
| 不带 / `meta` | 7 | 仅 meta 工具，领域工具需动态发现 |
| `knowledge` / `all` / `full` | 78 | 展开扁平工具（`search_kb_search`、`entry_*`、`block_*`、`file_*`、`smartsheet_*` 等） |

本机挂载用 `preset=knowledge`，官方 `lexiang-*` 技能引用的就是这套扁平工具名。

## 两种调用风格

1. **扁平**（preset=knowledge）：直接调 `mcp__lexiang__<tool>`，如 `mcp__lexiang__search_kb_search`。
2. **动态发现**（meta）：`list_tool_categories` / `search_tools` 找工具名 → `get_tool_schema` 取参数 → `call_tool` 调用。

参数不确定时以 `get_tool_schema(tool_name="xxx")` 返回为准。

## 路由表

| 任务 | 加载技能 | 关键工具 |
|------|----------|----------|
| 搜索 / 浏览 / 读内容 | `lexiang-search` | `search_kb_search`、`entry_describe_ai_parse_content`、`space_list_spaces` |
| 创建 / 写入 / 导入文档 | `lexiang-writer` | `entry_create_entry`、`entry_import_content`、`draft_*` |
| 编辑已有页面 Block | `lexiang-blocks` | `block_fetch_page`、`block_update_page`、`block_*` |
| 上传 / 下载文件 | `lexiang-files` | `file_apply_upload`、`file_commit_upload`、`file_download_file` |
| 会议录制 / iWiki 导入 | `lexiang-connectors` | connector 域工具 |
| 配置 / 401 / 续期 | `lexiang-setup` | `whoami`、配置写入 |

## 核心概念

`Team → Space → Entry` 树。Team=团队，Space=知识库，Entry=条目（page/folder/file/smartsheet），Page 承载 Block 正文树。

## 常见坑

1. **401** → Token 过期，去 `https://lexiangla.com/mcp` 点续期（无需重新配置），**不要重试**。
2. **URL 格式**：`company_from` 只能作查询参数，不能拼成子域名。
3. **链接拼接**：三级域名直接拼；顶级域名末尾加 `?company_from=`。
4. **修改前先读**：`block_fetch_page` → `block_update_page`，最小范围改。
5. **不编造** ID / URL / Block 内容；参数不确定以 `get_tool_schema` 为准。
6. **文件上传三步**：`file_apply_upload` → HTTP PUT → `file_commit_upload`，不能跳过上传。上传前向用户确认目标知识库与文件名；覆盖同名文件前必须显式确认。

## 参考

- 完整工具目录：[references/tools.md](references/tools.md)
- 分域技能：`lexiang-setup`、`lexiang-search`、`lexiang-writer`、`lexiang-blocks`、`lexiang-files`、`lexiang-connectors`
