# 乐享 MCP 工具目录

## 两种表面

| preset | 工具数 | 用法 |
|--------|--------|------|
| 不带 / `meta` | 7 | 动态发现：`list_tool_categories` → `search_tools` → `get_tool_schema` → `call_tool` |
| `knowledge` / `all` / `full` | 78 | 扁平直接调 `mcp__lexiang__<tool>` |

## 扁平工具（preset=knowledge，78 个）

### 元工具（7）
`call_tool`、`get_tool_schema`、`lexiang_fetch`、`lexiang_search`、`list_tool_categories`、`search_tools`、`whoami`

### 知识条目 entry（11）
`entry_create_entry`、`entry_describe_entry`、`entry_describe_ai_parse_content`、`entry_import_content`、`entry_list_children`、`entry_list_latest_entries`、`entry_list_parents`、`entry_list_recently_entries`、`entry_move_entry`、`entry_rename_entry`、`entry_set_entry_validity`

### Block（12）
`block_apply_block_attachment_upload`、`block_convert_content_to_blocks`、`block_create_block_descendant`、`block_delete_block`、`block_delete_block_children`、`block_describe_block`、`block_fetch_page`、`block_list_block_children`、`block_move_blocks`、`block_update_block`、`block_update_blocks`、`block_update_page`

### 智能表格 smartsheet（18）
`smartsheet_create`、`smartsheet_create_field`、`smartsheet_create_records`、`smartsheet_create_view`、`smartsheet_delete_field`、`smartsheet_delete_records`、`smartsheet_delete_view`、`smartsheet_describe_record`、`smartsheet_fetch`、`smartsheet_list`、`smartsheet_list_fields`、`smartsheet_list_records`、`smartsheet_list_smartsheets`、`smartsheet_list_views`、`smartsheet_update_field`、`smartsheet_update_records`、`smartsheet_update_schema`、`smartsheet_update_view`

### 文件 file（7）
`file_apply_upload`、`file_commit_upload`、`file_create_hyperlink`、`file_describe_file`、`file_download_file`、`file_list_revisions`、`file_revert_file`

### 知识库 space（4）
`space_describe_personal_space`、`space_describe_space`、`space_list_recently_spaces`、`space_list_spaces`

### 团队 team（3）
`team_describe_team`、`team_list_frequent_teams`、`team_list_teams`

### 搜索 search（2）
`search_kb_search`、`search_kb_embedding_search`

### 草稿 draft（4）
`draft_save_markdown_draft`、`draft_describe_markdown_draft`、`draft_publish_markdown_draft`、`draft_delete_markdown_draft`

### 评论 comment（2）
`comment_list_comments`、`comment_describe_comment`

### 标签 tag（2）
`knowledge_tag_list_entry_tags`、`knowledge_tag_set_entry_tags`

### 自定义属性 udf（3）
`knowledge_user_defined_field_list_entry_fields`、`knowledge_user_defined_field_list_field_values`、`knowledge_user_defined_field_update_field_value`

### 翻译 translation（3）
`translation_apply_file_translation`、`translation_describe_capability`、`translation_describe_file_translation`

## 分类目录（list_tool_categories 返回）

| 分类 | 工具数 | 说明 |
|------|--------|------|
| ai.ppt | 0 | PPT 服务 |
| connector.iwiki | 0 | iWiki |
| connector.meeting | 0 | 腾讯会议 |
| contact | 1 | `whoami` |
| knowledge.block | 21 | 在线文档 |
| knowledge.comment | 2 | 评论 |
| knowledge.draft | 4 | Markdown 草稿 |
| knowledge.entry | 11 | 知识库工作台 |
| knowledge.faq | 0 | 知识问答对 |
| knowledge.file | 7 | 文件导入 |
| knowledge.search | 2 | 搜索 |
| knowledge.smartsheet | 14 | 智能表格 |
| knowledge.space | 4 | 知识库 |
| knowledge.tag | 2 | 标签 |
| knowledge.translation | 3 | 翻译 |
| knowledge.udf | 3 | 自定义属性 |
| teamspace.team | 3 | 团队 |
| yunzhi | 0 | 云知 |

## 动态发现流程（meta 表面）

1. `list_tool_categories` → 看分类与工具数
2. `search_tools(query, category)` → 找工具名
3. `get_tool_schema(tool_name)` → 取参数
4. `call_tool(tool_name, arguments)` → 调用
