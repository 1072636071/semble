# 灵枢 7 工具面 · 参数契约速查

> 真源 = `server/tools/*.py` 的 `TOOL.inputSchema` 与 `execute()`；本文是导读速查，
> 漂移时以真源为准并回写本文（保鲜口径见 SKILL.md）。所有调用经灵枢门面
> （MCP `lingshu` 的 `mcp__lingshu__*` 或 HTTP `POST /tools/call {tool, arguments}`）。

## memory_list · 统一精确查询（读）

按类型/时间/标签过滤并分页列出；不做语义排序。

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `type` | | `auto`(默认)/`memory`/`conversation`/`scenario`/`skill`/`distill` |
| `query` | | 关键词过滤（精确检索阶梯，非语义装包） |
| `time_start` / `time_end` | | ISO8601（如 `2026-09-01`） |
| `namespace_tag` | | 标签前缀匹配（如 `deploy`） |
| `layer` | | `anchor`/`structural`/`knowledge`/`contextual`/`self` |
| `limit` / `offset` | | 每页默认 20（上限 200）/ 偏移 |
| `node_id` | | **单条深读**（给 id 直接读全文，承接 scenario_read） |
| `skill_name` | | 技能名读全文（需网关通道） |
| `skill_id` + `file_path` | | 读技能内资源 |

返回：`{ok, type, items[], pagination:{limit,offset,returned,has_more}, trace}`。
条目形状（列举路）：`{id, layer, time, tags, summary(≤120), session, channel}`；
**深读路（node_id）**：节点全文 dict（content/frontmatter/tags…）。
⚠ 列举路条目**不含 tags**（timeline 不带）；标签过滤时会逐条深读核对（窗口 ≤500）。

## memory_recall · 统一语义检索（读）

自然语言问题进来，多路融合（词法/分桶/实体/图谱/模糊/条件语义）+ kb 通道。

| 参数 | 说明 |
| --- | --- |
| `query` | 中文自然语言问题或关键词 |
| `types` | 数组，限定记忆类型（缺省自动路由） |
| `limit` / `budget_tokens` | 条数（默认 8）/ 装包预算 |
| `workspace` / `workspace_id` | 工作区身份（带号走 kb 分层召回 project→user→other） |
| `include_kb` | 是否并入知识库通道（默认开） |

返回：`{ok, results:[{id, score, content, channel, memory_type, hit_paths, kb?, bucket?, rrf_score}], total, trace}`。

## memory_manage · 统一管理（写）

`action` 六选一：

| action | 必需参数 | 语义 |
| --- | --- | --- |
| `status` | — | 服务健康 + 记忆统计 + 身份观测（mdcg_whoami） |
| `edit` | `node_id` + 非空 `content` | **整块覆盖**改（内核无原地改：同 node_id 重写；写前自动 mdcg_get 取原文与 layer）。⚠ `anchor` 等不可篡改层抛 `ProtectionError`（需 `override=True`，本面不透传）⇒ 见 SKILL.md 纪律 6「软删 + 重记」 |
| `delete` | `node_id`（建议带 `reason`） | **软删除**进 trash，可 restore；reason 进遗忘史。受保护层节点删端点透传 `override=True`（留快照，可 `restore`） |
| `restore` | `node_id` | 从 trash 撤回 |
| `export` | `format`(json/markdown) + 可选 `filter{layer,tags,time_start,time_end}` | 返回 `{ok, format, count, payload}`（payload 是完整导出文本） |
| `sync` | `direction`(pull/push) + `path` | pull=本地 JSONL 会话文件摄取进库；push=按 filter 导出落盘 |

## memory_graph · 关系查询（读）

| mode | 参数 | 说明 |
| --- | --- | --- |
| `search` | `query` | **按名找起点，先用它拿 id** |
| `neighbors` | `node_id`（+跳数） | 多跳 ≤3（BFS） |
| `asof` | 时刻参数（`time_window` 为**数值 epoch 秒**） | 按时刻回溯当时状态 |

## memory_image · 按文本找图（读）

`query` + 可选 `workspace`/`workspace_id`/`match_count`（默认 5）。workspace 派生项目库，
**查无此库绝不建库**。返回命中图片条目列表。

## memory_project_kb · 项目库 ensure（写·幂等）

`workspace_id` / `workspace`（至少给一个；真建库动作，不知道是哪个项目就宁可报错）。
可选 `name`（覆盖派生链）/`description`/`wiki`(默认 true)/`embedding_model_id`。
返回 `{kb_id, kb_name, created, wiki_enabled}`；幂等（二次 `created:false`）。
库名派生链：`workspace_id 映射 > <git根basename>-<ws段> > WEKNORA_PROJECT_KB > basename`。

## 错误信封

业务失败恒收敛为 `{ok:false, error:<中文可行动信息>, trace}`——原样转述给用户，
不要吞、不要意译成英文。`trace` 可按 `trace_level`（minimal/standard/detailed/debug）要详细留痕。
