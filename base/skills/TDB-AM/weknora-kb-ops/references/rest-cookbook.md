# REST 补强面菜谱（weknora-kb-ops）

> 官方 MCP 未覆盖的操作走这里。所有脚本 2026-10-04 在 Windows pwsh + `curl.exe` 实测过。
> 凭据腿：`C:\Users\jxc123\Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md`
> （长兴库专用 key 在该文件代码块里，形如 `sk-...`；别的库的 key 看 `项目机密\TencentDB-Agent-Memory\weknora-credentials.md`）。

## 0. 取 key 范式（每个脚本开头都是这段）

```powershell
# 家目录解析：环境变量优先，逐级回退——不写死用户名（同 base/skills/engineering/jxx-git-auth/scripts/resolve-token.mjs 口径）
$home0 = $env:USERPROFILE
if (-not $home0) { $home0 = $env:HOME }
if (-not $home0 -and $env:HOMEDRIVE -and $env:HOMEPATH) { $home0 = "$env:HOMEDRIVE$env:HOMEPATH" }
if (-not $home0) { try { $home0 = [Environment]::GetFolderPath('UserProfile') } catch { } }

$CredPath = Join-Path $home0 "Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md"
$md  = Get-Content -Raw $CredPath
$key = [regex]::Match($md, 'sk-[A-Za-z0-9_\-]+').Value
$kb  = "26ab29e0-e739-4232-b0e9-30088e760cf1"   # 长兴博客资源知识库；换库改这里
$base = "http://123.206.125.149:8127/api/v1"
```

本机实例（2026-10-21 实测存在）：`<家目录>\Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md`（本机家目录由上面的回退链解出，勿写死用户名）。
只读沙箱 ConstrainedLanguage 下 `[Environment]::` 会失败、被 `try/catch` 吞掉——前面三级回退仍有效。

纪律：`$key` 只在进程内活，不 `echo`、不写文件、不进工单评论。

### 0a. 换库先确认 tenant（2026-10-14 实证）

WeKnora 按 **tenant 隔离**知识库：一把 key 只够得到自己 tenant 下的库，**跨 tenant 一律 403**
（`Permission denied to access this knowledge base`）——**不是 404、不是 key 失效**。
上面这段范式只从一个文件取一把 key，对**单 tenant 库**够用；换库前先确认目标库在不在当前 key
可见的 `/knowledge-bases` 列表里：

```powershell
# 当前 key 能看到哪些库（含 tenant_id，一眼看出是不是同一个 tenant）
(curl.exe -s -H "X-API-Key: $key" "$base/knowledge-bases" | ConvertFrom-Json).data |
  Select-Object id, name, tenant_id | Format-Table -AutoSize
```

- 目标库在列表里 → 直接用当前 key。
- 不在 → **403 是 tenant 隔离，不是 key 失效**，换该 tenant 的 key。
  已归档的多 tenant key 见机密仓 `项目机密\TencentDB-Agent-Memory\weknora-credentials.md`（按 §号分空间，
  如 §9 = tenant 10006「大妞niu」的 `tdai-children-10006`）。
- 没有该 tenant 的 key → 新建：JWT 登录（§2 管理员账号）→ `POST /auth/switch-tenant {tenant_id}` →
  `POST /tenants/{id}/api-keys`，body `{"scope_type":"tenant","name":"...","full_access":true}`
  （缺 `scope_type` 返 400）。明文只在创建响应 `data.token`；`data.api_key` 是 enc:v1 信封，别拿去归档。
- key 纪律不变：**只在进程内活，不 `echo`、不写文件、不进工单评论 / commit message**；
  需要打印时只打 key 名称与末 4 位指纹。

`scripts/kb-check.ps1` 已内置这套「按目标库选 key + 区分无权访问/不存在」逻辑，别在手搓脚本里
重新实现一遍。

**顺带对齐一个字段名**：hybrid-search 的 body 字段是 **`query_text`**（不是 `query`），
端点 `POST /knowledge-bases/{kb}/hybrid-search`。

## 1. 全量翻页取条目（后面所有审计的底座）

```powershell
$all = @()
for ($p = 1; $p -le 50; $p++) {
  $resp = curl.exe -s -H "X-API-Key: $key" "$base/knowledge-bases/$kb/knowledge?page=$p&page_size=100" | ConvertFrom-Json
  $items = @($resp.data); if ($items.Count -eq 0) { break }
  $all += $items; if ($items.Count -lt 100) { break }
}
```

返回条目自带：`tags` 数组（id+name）、`type`（file/manual）、`file_name`、`file_hash`、`file_size`、`parse_status`、`description`（VLM 描述）、`profile`（gist/topics）。

### 1a. 响应壳速查（2026-10-21 逐字段实测，别凭记忆拼）

信封形状每个端点都不一样，写解析前先对这张表：

| 端点 | 数据位置 | 备注 |
| --- | --- | --- |
| `GET /knowledge-bases` | `.data` 数组 | |
| `GET /knowledge-bases/{kb}/knowledge` | `.data` 数组 | 分页字段 `page`/`page_size`/`total` 在**顶层**；**不存在** `.data.items` |
| `GET /knowledge-bases/{kb}/tags` | `.data.data` 数组 | 两层信封（`data.total` + `data.data`，条目带 `knowledge_count`） |
| `GET /knowledge-bases/{kb}/knowledge/folders` | `.data.{folders, root_document_count, total_document_count}` | `folders` 是树，子目录在 `children`；`total_count` 含子树、`document_count` 只算直挂 |
| `GET /chunks/{knowledge_id}` | `.data` 数组 | 读取路径是 `/chunks/{id}`（`/knowledge/{id}/chunks` 返 404）；**同样分页，默认 `page_size=10`**，取全须翻页，信封在顶层 |
| `POST /knowledge-bases/{kb}/hybrid-search` | `.data` 数组 | body 字段 `query_text` |

**最贵的坑**：把列表写成 `.data.items` 不报错、只给空集——静默空集比报错难查。四个端点的壳都不同，先打印 `Object.keys` 再写解析。

## 2. 去重审计（图片 hash / 文件名 / 文章标题三维）

```powershell
"TOTAL: $($all.Count)"
$all | Group-Object type | ForEach-Object { "  $($_.Name): $($_.Count)" }
$files = @($all | Where-Object { $_.type -eq "file" })
# 同内容不同名（真重复图）
$files | Where-Object { $_.file_hash } | Group-Object file_hash | Where-Object { $_.Count -gt 1 } |
  ForEach-Object { "DUP hash=$($_.Name.Substring(0,12)) x$($_.Count): $(($_.Group | ForEach-Object { $_.file_name }) -join ' | ')" }
# 同名（引用冲突预警）
$files | Group-Object file_name | Where-Object { $_.Count -gt 1 } | ForEach-Object { "DUP name=$($_.Name) x$($_.Count)" }
# 文章重题
$all | Where-Object { $_.type -ne "file" } | Group-Object title | Where-Object { $_.Count -gt 1 } |
  ForEach-Object { "DUP title=$($_.Name) x$($_.Count)" }
```

长兴库 2026-10-04 实测：329 条（203 file + 126 manual），三维零重复。

### 2a. `file_hash` 是 MD5，不是 SHA256（2026-10-04 实证）

列表/详情接口返回的 `file_hash` 为 **32 位十六进制 = MD5**。拿本地 SHA256（64 位）去比对必然全 miss，
会得到「图片不在库」的**假阴性**（真实事故：外贸站会话首轮 2/2 误判，改 MD5 后 2/2 命中）。

「这张本地图在不在库、库内叫什么」的核验腿：

```python
import hashlib, pathlib, requests
md5 = hashlib.md5(pathlib.Path(local).read_bytes()).hexdigest()
# 列表接口自带 file_hash / title / file_name / tags，翻页建 md5->entry 字典即可
```

- 条目名已中文化，**按本地英文文件名匹配会漏**——只认 MD5。
- 灵枢图片腿「本地算 SHA256」是它自己的门面预检口径，与服务端 `file_hash` 字段不是一回事。

## 3. 标签 CRUD

```powershell
# 列表（分页信封：data.data 才是数组，带 knowledge_count 引用计数）
(curl.exe -s -H "X-API-Key: $key" "$base/knowledge-bases/$kb/tags" | ConvertFrom-Json).data.data

# 建（name 必填；同名返 409，先查后建）
curl.exe -s -X POST -H "X-API-Key: $key" -H "Content-Type: application/json" `
  -d '{\"name\":\"新标签\"}' "$base/knowledge-bases/$kb/tags"

# 改 / 删
curl.exe -s -X PUT    -H "X-API-Key: $key" -H "Content-Type: application/json" `
  -d '{\"name\":\"改名\"}' "$base/knowledge-bases/$kb/tags/<tag_id>"
curl.exe -s -X DELETE -H "X-API-Key: $key" "$base/knowledge-bases/$kb/tags/<tag_id>"
```

## 4. 重复命中 → 合并标签（replace 语义，先读后写！）

```powershell
# ① 读既有条目当前的标签 id（从 §1 的 $all 里捞，或单条 GET）
$kid  = "<既有图片 knowledge_id>"
$old  = @($all | Where-Object { $_.id -eq $kid } | ForEach-Object { $_.tags } | ForEach-Object { $_.id })
# ② 新标签不存在先按 §3 建，拿到 $newTagId
$union = @($old + "<新tag_id>") | Select-Object -Unique
# ③ 整组替换写回
$body = @{ updates = @{ $kid = $union }; kb_id = $kb } | ConvertTo-Json -Depth 4
curl.exe -s -X PUT -H "X-API-Key: $key" -H "Content-Type: application/json" -d $body "$base/knowledge/tags"
```

判红提醒：`updates` 里不给旧标 = 旧标被抹掉（`SetKnowledgeTags` 整组替换）。

## 5. 解析失败排查

```powershell
$all | Where-Object { $_.parse_status -eq "failed" } |
  ForEach-Object { "[$($_.type)] $($_.file_name)$($_.title) id=$($_.id)" }
```

长兴库现存 4 条 failed（均为 2026-09 批次改过标题的 manual）。处置选项：`PUT /knowledge/manual/{id}` 重写触发重解析，或确认内容无误后人面手动重解析。

## 6. 手工知识改内容/标题（status 必填！）

```powershell
$body = @{ title = "新标题"; content = "<完整 markdown>"; status = "publish" } | ConvertTo-Json
curl.exe -s -X PUT -H "X-API-Key: $key" -H "Content-Type: application/json" -d $body "$base/knowledge/manual/<id>"
```

省略 `status` 会被后端默认置 `draft`——保留原状态必须显式传。

## 6b. 创建手工知识（REST 降级腿 · MCP 未挂载时文本上传的唯一路）

> 端点：`POST /knowledge-bases/{kb}/knowledge/manual`（源码 `routes_knowledge.go` + `CreateManualKnowledge`，
> body = `types.ManualKnowledgePayload`：`title` / `content` / `status` / `tag_ids[]` / `channel`）。
> 灵枢 `memory_remember` **不是**文本上传通道——它只收图片，文本会写进灵枢记忆而非知识库。
>
> ⚠️ **常见 404 误区**（2026-10-04 实际踩过）：`/knowledge-bases/{kbId}/manual`、`/knowledge-manual` 都不对——
> `manual` 段必须挂在 **`/knowledge/`** 之下：`/knowledge-bases/{kbId}/knowledge/manual`。
> 记忆口诀：**库 → 知识 → 手工**（knowledge-bases → knowledge → manual）。

```powershell
$body = @{
  title   = "条目标题"
  content = "<markdown 正文>"
  status  = "publish"          # 显式传，防缺省进 draft
  tag_ids = @("<report-or-product-id>", "<trade-site-id>", "<usage-id>")  # id 见 tag-registry
  channel = "web"
} | ConvertTo-Json
[IO.File]::WriteAllText("$pwd\_body.json", $body, (New-Object Text.UTF8Encoding($false)))
curl.exe -s -X POST -H "X-API-Key: $key" -H "Content-Type: application/json" --data-binary "@_body.json" `
  "$base/knowledge-bases/$kb/knowledge/manual"
```

验收：返回 `data.id` 后，`GET /knowledge-bases/$kb/knowledge?keyword=<标题关键词>` 应能命中（`type=manual`）。

## 7. 单条详情

```powershell
curl.exe -s -H "X-API-Key: $key" "$base/knowledge/<id>"
# 注意：manual 条目的 status 在 data.metadata.status
```

## 8. 存量图片改名（SQL 腿，PUT /knowledge/:id 不收 file_name）

> 2026-10-04 已对长兴库 203 张执行过（UUID→语义名），范式存档如下。安全性依据见 SKILL.md「文件名纪律」。

```powershell
# ① 全量导出 → 起名映射（仓内工具链，可复用）：
#    .temp/scripts/changxing-name-gen.mjs        手工映射 + 兜底规则 → changxing-rename-map.json
#    .temp/scripts/changxing-name-gen-patch.mjs  兜底名精修 + 唯一性终检
#    .temp/scripts/changxing-sql-gen.mjs         映射 → changxing-rename.sql（事务）
# ② 事务 SQL 范式要点（generated by changxing-sql-gen.mjs）：
#    BEGIN; 每行 UPDATE ... SET file_name=<新>, title=CASE WHEN title IN (<旧全名>,<旧去扩展名>) THEN <新> ELSE title END,
#           updated_at=now() WHERE id=<id> AND file_name=<旧名>;   -- 行级防呆
#    后置验证：残留 UUID=0 / 总数不变 / 新名命中=203；COMMIT。
# ③ 执行：scp sql → root@123.206.125.149 → sudo -u postgres psql -d weknora -v ON_ERROR_STOP=1 -f /tmp/x.sql
# ④ 终验（.temp/scripts/changxing-verify.mjs）：按 id 比对 file_hash 全等、UUID 残留 0、双语描述覆盖。
```

## 9. 描述双语化 + title 中文化（REST 腿）

`PUT /knowledge/:id` 收 `title` / `description`（partial 语义）。长兴库口径：description = `中文摘要。\n\n[EN] 原英文全文`，title = 中文短句（句号结尾）。批量脚本 `.temp/scripts/changxing-apply-desc.ps1`（203/203 成功）。

**pwsh 5 坑**：脚本文件必须带 **UTF-8 BOM**（无 BOM 时中文路径/字符串按 GBK 解析直接炸）；写 body 文件用 `[IO.File]::WriteAllText($p, $body, (New-Object Text.UTF8Encoding($false)))` 再 `--data-binary "@file"`，不要命令行内联中文。

**⚠️ 写回时机：必须等 `parse_status=completed` 再 PUT（2026-10-04 实证）**

新上传的图片走 `enable_multimodel` 时，VLM 流水线会在 `finalizing` 阶段**覆盖** `title` 与 `description`：
先 PUT 会被吞（实测 `finalizing` 持续约 168 s，PUT 后 title 回到 `xxx.webp`、description 长度归零），
流水线落定时还会写入一段自己的 134 字自动描述。

正确顺序：`POST knowledge/file` → 轮询 `GET /knowledge/:id` 直到 `parse_status ∈ {completed, failed}`
→ 再 `PUT title/description` → 睡 20–30 s 复查是否仍是你写的值（不要 PUT 完立刻读就收工）。
存量 203 张能保持 203/203 双语描述，正是因为它们都是处理完成后才回写的。

## 11. 新建库与配置对齐（2026-10-11 设备管理库实证）

> 流程口径与源码依据见 SKILL.md「## 新建库（新项目 / 新库接入）」。模板源库 = `b2d1f93b-725a-4ee5-98bb-b77d57e646e2`
> （TencentDB-Agent-Memory-1646ck3g）。三段可跑：11a 取 key → 11b duplicate 建库 + 改名改描述 → 11c 全量 config 对齐 + 回读核验；11d 补来源标。

### 11a. 取 key（同 §0，不回显）

```powershell
$md   = Get-Content -Raw $CredPath   # 同 §0：家目录解析 + $CredPath（不写死用户名）
$key  = [regex]::Match($md, 'sk-[A-Za-z0-9_\-]+').Value
$base = "http://123.206.125.149:8127/api/v1"
$tpl  = "b2d1f93b-725a-4ee5-98bb-b77d57e646e2"   # 模板源库：只复制设置，不复制条目
```

### 11b. duplicate 建库 → PUT 改名 + 改描述

> ⚠️ **本片段经源码核实但本次未实跑**（2026-10-11 设备管理库实际走手搓 `POST /knowledge-bases` + `PUT config`
> 对齐，见 SKILL.md「### 建库实测记录」）；首次真实走 duplicate 建库时，请对照响应体修正本片段。

```powershell
# ① settings-only 复制（HTTP 201；data 信封见 SKILL.md「新建库」§1）
$resp = curl.exe -s -X POST -H "X-API-Key: $key" "$base/knowledge-bases/$tpl/duplicate" | ConvertFrom-Json
$kb   = $resp.data.target_id
"NEW KB: $kb  NAME: $($resp.data.knowledge_base.name)"   # 自动名形如 "<源名> 副本"

# ② 改名 + 改描述（name 必填；不带 config = 本次不动配置，保留从模板复制来的整份设置）
$body = @{ name = "设备管理"; description = "<库定位：客观 / 共享 / 相对静态>" } | ConvertTo-Json
[IO.File]::WriteAllText("$pwd\_kbput.json", $body, (New-Object Text.UTF8Encoding($false)))
curl.exe -s -X PUT -H "X-API-Key: $key" -H "Content-Type: application/json" --data-binary "@_kbput.json" "$base/knowledge-bases/$kb"
```

### 11c. 配置对齐（从模板 GET 现取全量 config，再整段 PUT）

```powershell
# ① 现取模板全量 config：chunking / image_processing 是 value 语义，漏传即清零 → 六个字段一个都别省
$t = (curl.exe -s -H "X-API-Key: $key" "$base/knowledge-bases/$tpl" | ConvertFrom-Json).data
$cfg = @{
  chunking_config         = $t.chunking_config
  image_processing_config = $t.image_processing_config
  wiki_config             = $t.wiki_config
  indexing_strategy       = $t.indexing_strategy
  auto_tag_config         = $t.auto_tag_config
  profile_config          = $t.profile_config
}
$body = @{ name = "设备管理"; description = "<与 11b 一致>"; config = $cfg } | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText("$pwd\_kbcfg.json", $body, (New-Object Text.UTF8Encoding($false)))
curl.exe -s -X PUT -H "X-API-Key: $key" -H "Content-Type: application/json" --data-binary "@_kbcfg.json" "$base/knowledge-bases/$kb"

# ② 回读核验：三项绑定对齐 + 三份配置逐字段比对（应与模板逐字一致）
$n = (curl.exe -s -H "X-API-Key: $key" "$base/knowledge-bases/$kb" | ConvertFrom-Json).data
$n | Select-Object name,embedding_model_id,summary_model_id | Format-List
$n.chunking_config   | ConvertTo-Json -Depth 6
$n.indexing_strategy | ConvertTo-Json -Depth 6
$n.wiki_config       | ConvertTo-Json -Depth 6
```

判红点两条：`indexing_strategy` 传了但 vector / keyword / wiki / graph 全关 → 400
`at least one indexing strategy must be enabled`；`chunking_config` 忘了带 → `chunk_size` 直接归 0
（PUT 是整段覆盖，不做字段级合并）。另：`extract_config` / `question_generation_config` **PUT 写不进去**
（不在 `types.KnowledgeBaseConfig` 里），与模板的差异行为等价，别硬塞。

### 11d. 补来源标（不补则体检报 FAIL「标签 0 个」）

```powershell
$tags = @(
  @{ name = "文档上传"; color = "#9aa0a6"; sort_order = 900 },
  @{ name = "灵枢记忆"; color = "#9aa0a6"; sort_order = 900 }
)
foreach ($t in $tags) {
  [IO.File]::WriteAllText("$pwd\_tag.json", ($t | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
  curl.exe -s -X POST -H "X-API-Key: $key" -H "Content-Type: application/json" --data-binary "@_tag.json" "$base/knowledge-bases/$kb/tags"
}
# 回读核验（分页信封：data.data 才是数组）
(curl.exe -s -H "X-API-Key: $key" "$base/knowledge-bases/$kb/tags" | ConvertFrom-Json).data.data |
  Select-Object id,name,color,sort_order,knowledge_count
```

幂等：标签名同库内唯一，重复 POST 同名返 409（`标签名称已存在`）——重跑前先按 §3 查一遍，别盲发。
建完账落到 `references/tag-registry-<slug>.md`（设备管理库见 [tag-registry-shebei.md](tag-registry-shebei.md)）。

