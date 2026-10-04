# WeKnora 知识库体检（全局脚本 · weknora-kb-ops 技能）
#
# 对任意 WeKnora 知识库做连通性 + 内容体检：凭据 → 库级能力 → 全量条目 → 去重审计
# → 标签台账 → 混合检索冒烟。以 FAIL / WARN 计数收口，退出码非 0 表示有 FAIL。
#
# 用法：
#   pwsh -File kb-check.ps1 -Kb <kb_id> [-Query "检索词1","检索词2"] [-Json]
#   pwsh -File kb-check.ps1 -Workspace .            # 从工作区 AGENTS.md 自动读 kb_id
#   pwsh -File kb-check.ps1 -All                    # 体检在册档案里的全部库
#
# 纪律：API key 只在本进程内活，不回显 / 不落盘 / 不进任何产出物。

[CmdletBinding()]
param(
  [string[]]$Kb,
  [string]$Workspace,
  [string]$Base = "http://123.206.125.149:8127/api/v1",
  [string[]]$Query = @(),
  [switch]$All,
  [switch]$Json,
  [int]$MaxPages = 50
)

$ErrorActionPreference = "Stop"
# PS 5.1 的 Get-Content -Raw 对无 BOM 文件按 ANSI(GBK) 解析，会把中文后的 ASCII 吞掉，
# 导致 kb_id / sk- 这类正则漏匹配。一律用显式 UTF-8 读。
$utf8 = New-Object System.Text.UTF8Encoding($false)
$script:Fail = 0
$script:Warn = 0
$script:Report = [ordered]@{}

function Say([bool]$ok, [string]$msg) {
  if (-not $Json) { Write-Host ("[{0}]   {1}" -f $(if ($ok) { "OK" } else { "FAIL" }), $msg) }
  if (-not $ok) { $script:Fail++ }
}
function Warn([string]$msg) {
  if (-not $Json) { Write-Host ("[WARN] {0}" -f $msg) }
  $script:Warn++
}
function Note([string]$msg) { if (-not $Json) { Write-Host ("[INFO] {0}" -f $msg) } }
function Head([string]$msg) { if (-not $Json) { Write-Host $msg } }

# ---------- 目标库解析 ----------
$targets = @()
if ($All) {
  # 在册档案里的库（与 SKILL.md「在册知识库」表同步）
  $targets = @(
    @{ id = "26ab29e0-e739-4232-b0e9-30088e760cf1"; name = "长兴博客资源知识库" },
    @{ id = "2d014440-786c-4d6b-84cc-12679f4df1cb"; name = "BPM" }
  )
} elseif ($Kb -and $Kb.Count -gt 0) {
  foreach ($k in $Kb) { $targets += @{ id = $k.Trim(); name = "" } }
} else {
  # -Kb / -All 都没给时读工作区 AGENTS.md（零参即体检本仓）
  if (-not $Workspace) { $Workspace = "." }
  $ws = (Resolve-Path -LiteralPath $Workspace).Path
  $agentFile = Join-Path $ws "AGENTS.md"
  if (-not (Test-Path -LiteralPath $agentFile)) { Write-Error "工作区缺 AGENTS.md：$ws"; exit 2 }
  $md = [System.IO.File]::ReadAllText($agentFile, $utf8)
  $m = [regex]::Match($md, 'kb_id\s*`?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})`?')
  if (-not $m.Success) { Write-Error "AGENTS.md 里读不到 kb_id：$agentFile"; exit 2 }
  $targets += @{ id = $m.Groups[1].Value; name = "" }
  Note ("从 {0} 读到 kb_id={1}" -f $agentFile, $m.Groups[1].Value)
}

# ---------- 凭据腿取 key ----------
$cands = @()
$cands += Get-ChildItem -Path "C:\Users\jxc123\Nutstore\1\*\*\Secret\WeKnora-*.md" -ErrorAction SilentlyContinue
$cands += Get-ChildItem -Path "C:\Users\jxc123\Nutstore\1\*\*\TencentDB-Agent-Memory\*weknora*.md" -ErrorAction SilentlyContinue
$key = $null; $keyFile = ""
foreach ($f in $cands) {
  $md = [System.IO.File]::ReadAllText($f.FullName, $utf8)
  foreach ($m in [regex]::Matches($md, 'sk-[A-Za-z0-9_\-]+')) {
    $k = $m.Value
    if ((curl.exe -s -o NUL -w "%{http_code}" -H "X-API-Key: $k" "$Base/knowledge-bases") -eq "200") {
      $key = $k; $keyFile = $f.Name; break
    }
  }
  if ($key) { break }
}
if (-not $key) { Write-Error "未找到可用 API key（凭据腿缺失或全部失效）"; exit 1 }
Say $true "API key 就绪（来源：$keyFile；值不回显）"
$script:Report.keySource = $keyFile

$script:Report.bases = @()

foreach ($t in $targets) {
  $kbId = $t.id
  Head ""
  Head "===== 知识库 $kbId ====="

  # ---- 1. 库级信息 ----
  $bases = @((curl.exe -s -H "X-API-Key: $key" "$Base/knowledge-bases" | ConvertFrom-Json).data)
  $info  = $bases | Where-Object { $_.id -eq $kbId }
  if (-not $info) { Say $false "知识库不存在：$kbId"; continue }
  Head ("[OK]   知识库：{0}  id={1}" -f $info.name, $kbId)
  Head ("       条目数={0}  库更新于={1}" -f $info.knowledge_count, $info.updated_at)
  Head ("       能力：keyword={0} vector={1} wiki={2} graph={3}" -f $info.capabilities.keyword, $info.capabilities.vector, $info.capabilities.wiki, $info.capabilities.graph)
  Head ("       向量库：{0} / {1}   VLM={2}" -f $info.vector_store_name, $info.vector_store_status, $info.vlm_config.enabled)
  Say ($info.vector_store_status -eq "available") "向量库可用"

  # ---- 2. 全量条目 ----
  $entries = @()
  for ($p = 1; $p -le $MaxPages; $p++) {
    $resp = curl.exe -s -H "X-API-Key: $key" "$Base/knowledge-bases/$kbId/knowledge?page=$p&page_size=100" | ConvertFrom-Json
    $items = if ($resp.data -is [array]) { @($resp.data) } else { @($resp.data.data) }
    if ($items.Count -eq 0) { break }
    $entries += $items
    if ($items.Count -lt 100) { break }
  }
  Say ($entries.Count -eq [int]$info.knowledge_count) ("拉取 {0} 条，与库自报 {1} 条一致" -f $entries.Count, $info.knowledge_count)
  $entries | Group-Object type | ForEach-Object { Head ("       type={0}: {1}" -f $_.Name, $_.Count) }
  Note ("parse_status：" + (($entries | Group-Object parse_status | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join " "))

  $notDone = @($entries | Where-Object { $_.parse_status -ne "completed" })
  $failed  = @($entries | Where-Object { $_.parse_status -eq "failed" })
  if ($failed.Count -gt 0) {
    Warn ("{0} 条 parse_status=failed（真问题，需重解析或改内容）" -f $failed.Count)
    $failed | ForEach-Object { Head ("       FAILED: [{0}] {1} id={2}" -f $_.type, $(if ($_.file_name) { $_.file_name } else { $_.title }), $_.id) }
  } elseif ($notDone.Count -gt 0) {
    Warn ("{0} 条未 completed（内容通常仍可检索，仅状态未落定；只有 failed 才是真问题）" -f $notDone.Count)
  }

  # ---- 3. 条目清单 ----
  Head "--- 条目清单 ---"
  $entries | Sort-Object type, title | ForEach-Object {
    $name = if ($_.file_name) { $_.file_name } else { $_.title }
    $tg = @($_.tags | ForEach-Object { $_.name }) -join ","
    Head ("  [{0}/{1}] {2}  |{3}|" -f $_.type, $_.parse_status, $name, $tg)
  }

  # ---- 4. 去重审计 ----
  $dupHash = @($entries | Where-Object { $_.file_hash } | Group-Object file_hash | Where-Object { $_.Count -gt 1 })
  $dupName = @($entries | Where-Object { $_.file_name } | Group-Object file_name | Where-Object { $_.Count -gt 1 })
  $dupTtl  = @($entries | Where-Object { $_.title }   | Group-Object title   | Where-Object { $_.Count -gt 1 })
  Say ($dupHash.Count -eq 0) ("去重：hash 重复 {0} 组" -f $dupHash.Count)
  Say ($dupName.Count -eq 0) ("去重：文件名重复 {0} 组" -f $dupName.Count)
  Say ($dupTtl.Count  -eq 0) ("去重：标题重复 {0} 组" -f $dupTtl.Count)
  $dupHash | ForEach-Object { Head ("       DUP hash={0} x{1}" -f $_.Name.Substring(0, [Math]::Min(12, $_.Name.Length)), $_.Count) }
  $dupTtl  | ForEach-Object { Head ("       DUP title={0} x{1}" -f $_.Name, $_.Count) }

  # ---- 5. 标签台账 ----
  $tagResp = curl.exe -s -H "X-API-Key: $key" "$Base/knowledge-bases/$kbId/tags" | ConvertFrom-Json
  $tags = if ($tagResp.data -is [array]) { @($tagResp.data) } else { @($tagResp.data.data) }
  Say ($tags.Count -gt 0) ("标签 {0} 个" -f $tags.Count)
  $tags | Sort-Object -Property knowledge_count -Descending | ForEach-Object {
    Head ("       {0}  (id={1}, 引用 {2})" -f $_.name, $_.id, $_.knowledge_count)
  }

  # ---- 6. 混合检索冒烟 ----
  # 端点 POST /knowledge-bases/{kb}/hybrid-search，body 字段是 query_text（不是 query）。
  $hitCount = 0
  if ($Query.Count -gt 0) {
    $bodyFile = Join-Path $env:TEMP "wk-hybrid-$PID.json"
    foreach ($q in $Query) {
      [IO.File]::WriteAllText($bodyFile, (@{ query_text = $q; match_count = 5 } | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
      $raw = curl.exe -s -X POST -H "X-API-Key: $key" -H "Content-Type: application/json" --data-binary "@$bodyFile" "$Base/knowledge-bases/$kbId/hybrid-search"
      $hits = @()
      try { $rj = $raw | ConvertFrom-Json; $hits = if ($rj.data -is [array]) { @($rj.data) } else { @($rj.data.data) } } catch { }
      $hitCount += $hits.Count
      Say ($hits.Count -gt 0) ("检索「{0}」命中 {1} 条" -f $q, $hits.Count)
      $hits | Select-Object -First 5 | ForEach-Object { Head ("       score={0:N4}  {1}" -f $_.score, $_.knowledge_title) }
    }
    Remove-Item $bodyFile -ErrorAction SilentlyContinue
  } else {
    Note "未传 -Query，跳过检索冒烟"
  }

  $script:Report.bases += [ordered]@{
    id = $kbId
    name = $info.name
    knowledgeCount = $entries.Count
    selfReportedCount = [int]$info.knowledge_count
    parseStatus = @($entries | Group-Object parse_status | ForEach-Object { [ordered]@{ status = $_.Name; count = $_.Count } })
    failedCount = $failed.Count
    dupHash = $dupHash.Count
    dupName = $dupName.Count
    dupTitle = $dupTtl.Count
    tagCount = $tags.Count
    tags = @($tags | Sort-Object -Property knowledge_count -Descending | ForEach-Object { [ordered]@{ name = $_.name; id = $_.id; count = $_.knowledge_count } })
    searchHits = $hitCount
  }
}

$script:Report.fail = $script:Fail
$script:Report.warn = $script:Warn

if ($Json) {
  Write-Output ($script:Report | ConvertTo-Json -Depth 6)
} else {
  Write-Host ""
  Write-Host ("=== 体检结束：FAIL={0} WARN={1} ===" -f $script:Fail, $script:Warn)
}
exit $(if ($script:Fail -gt 0) { 1 } else { 0 })
