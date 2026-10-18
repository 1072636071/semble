# 长兴资源库标签台账（tag-registry）

> kb `26ab29e0-e739-4232-b0e9-30088e760cf1` · 2026-10-04 建档 · 挂标前先读本表拿 tag_id；
> 批量挂标/改标是 **replace 语义**（`PUT /knowledge/tags`），必须先读旧标取并集（cookbook §4）。

## 命名空间与 tag_id

> **2026-10-18 新增 `type:` 命名空间（跨库通用类型标）**：`type:experience` / `type:material`，
> 定义与全库 tag id 见主技能 SKILL.md「通用类型标（跨库）」节。本台账只登记**长兴库**的 tag id。

### category 领域

| name | tag_id |
|---|---|
| product | `9ad49c61-6118-4271-9eb3-7a5fbb91af70` |
| company | `1747b3a2-6bb7-4469-9fd6-5d759f1e8221` |
| report | `b2f5f333-2c14-47f5-856d-b96d2247102f` |
| industry | `9f43b785-9fb5-4a01-b542-8cd4a3b2aa44` |
| adr | `337d940b-fed3-48a4-8a2d-fc8d3948ef3d` |
| term | `b38f4bf3-98d6-4baa-b608-28396e438583` |
| blog-image | `c58dfd7b-91a7-4d5b-8e97-a248a1489855` |
| process-page | `e0c02473-e866-4482-a3ce-983b76d41877` |

### project 项目标（替代 jxk 的 project_name 路由）

| name | tag_id | 用途 |
|---|---|---|
| domestic-site | `785f71e8-73ce-4ad8-9cb1-4c40cdee58fc` | 国内官网资产/知识 |
| trade-site | `89fa5353-48c1-442b-99bf-577276f595aa` | 外贸站资产/知识 |

### source 来源标（上传腿自动打）

| name | tag_id | 说明 |
|---|---|---|
| 灵枢记忆 | `ead9057e-9427-41d3-97d0-d41956a83c2e` | 灵枢图片腿自动打（存量 203 张图片全挂） |
| 文档上传 | `9e2653e8-b7ac-46e2-9c8d-1453c2bd88cb` | 文档上行腿自动打（存量 126 篇文章全挂） |

### legacy 存量游离标

| name | tag_id | 说明 |
|---|---|---|
| 工厂 | `33e1ab7b-a8d3-4a28-a5db-70a9117c42d2` | 2026-10-04 新建，暂 0 引用 |
| deprecated | `553f4aa4-7981-4aee-9434-ee7ac7ae4e31` | 保留，标记弃用条目 |

### usage 用途标（按需建，不预建）

命名：`usage:<页面或目录>`，如 `usage:process-page/工艺页面`、`usage:blog/dotp-vs-dinp`、`usage:product/dotp`。
建法：`POST /knowledge-bases/{kb}/tags {"name":"usage:..."}`（同名 409 → 先 GET 列表确认）。
用途追踪沿用 jxk `set_usage` 的习惯，但落点是标签而非独立表——查某页面用了哪些图：`GET /knowledge-bases/{kb}/knowledge?tag_ids=<usage-id>`。

> ⚠️ **2026-10-04 实盘点**：长兴库 15 个标签里 usage 标数量为 **0**，且 `company`/`product`/`report`/`industry`/`adr`/`term`/
> `blog-image`/`process-page`/`trade-site`/`domestic-site` 全部 `knowledge_count=0`——203 张图只挂 `灵枢记忆`、
> 126 篇 manual 只挂 `文档上传`。上表 id 是**已建好但从未使用**的空标，别以为挂过标了；
> 「按 usage 标查页面用图」这条核验路径要自己先建标、先挂标才生效。

已建 usage 标：

| name | tag_id | 建标日 · 用途 |
|---|---|---|
| `usage:blog/shandong-pet-recycling-standardization-pilot` | `fbf36e05-a46c-4eb3-b3b5-eab11c06e5aa` | 2026-10-04 外贸站博客（首个 usage 标实例） |

## 挂标范式

```powershell
# 单张/单条：读旧标 → 并集 → 整组替换
$union = @($oldTagIds + $newTagIds) | Select-Object -Unique
$body = @{ updates = @{ $kid = $union }; kb_id = $kb } | ConvertTo-Json -Depth 4
curl.exe -s -X PUT -H "X-API-Key: $key" -H "Content-Type: application/json" -d $body "$base/knowledge/tags"
```

新图上传的默认标组合：`灵枢记忆`（自动）+ `category 领域标` + `project 标` + `usage:<页面>` + **`type:material`（必传）**。

文本条目（manual）上传的默认标组合：`type:experience` 或 `type:material`（**必传，二选一或多选**）+ `category 领域标` + `project 标` + `usage:<页面>`。

> ⚠️ **只挂来源标不算挂标**：`灵枢记忆` / `文档上传` 由上传腿自动打，不构成类型分型。
> 类型标定义、判据、各库 tag id 与同义标登记见主技能 SKILL.md「通用类型标（跨库）」节。
