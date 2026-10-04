# REST 补强面菜谱（weknora-kb-ops）

> 官方 MCP 未覆盖的操作走这里。所有脚本 2026-10-04 在 Windows pwsh + `curl.exe` 实测过。
> 凭据腿：`C:\Users\jxc123\Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md`
> （长兴库专用 key 在该文件代码块里，形如 `sk-...`；别的库的 key 看 `项目机密\TencentDB-Agent-Memory\weknora-credentials.md`）。

## 0. 取 key 范式（每个脚本开头都是这段）

```powershell
$md  = Get-Content -Raw "C:\Users\jxc123\Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md"
$key = [regex]::Match($md, 'sk-[A-Za-z0-9_\-]+').Value
$kb  = "26ab29e0-e739-4232-b0e9-30088e760cf1"   # 长兴博客资源知识库；换库改这里
$base = "http://123.206.125.149:8127/api/v1"
```

纪律：`$key` 只在进程内活，不 `echo`、不写文件、不进工单评论。

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
