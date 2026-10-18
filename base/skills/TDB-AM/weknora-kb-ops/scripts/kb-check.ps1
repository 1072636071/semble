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

# 列表接口的分页信封兼容：data 直接是数组 / data.data 才是数组。
function Get-ListData($resp) {
  if ($null -eq $resp) { return @() }
  if ($resp.data -is [array]) { return @($resp.data) }
  if ($resp.data.data -is [array]) { return @($resp.data.data) }
  return @()
}

# ---------- 目标库解析 ----------
$targets = @()
if ($All) {
  # 在册档案里的库（与 SKILL.md「在册知识库」表同步）
  $targets = @(
    @{ id = "26ab29e0-e739-4232-b0e9-30088e760cf1"; name = "长兴博客资源知识库" },
    @{ id = "2d014440-786c-4d6b-84cc-12679f4df1cb"; name = "BPM" },
    @{ id = "af0160f1-fa7e-437e-bf14-3743107d5527"; name = "儿童成长日记" }
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

# ---------- 凭据腿取 key（按目标库选 key）----------
# WeKnora 按 tenant 隔离知识库：一把 key 只够得到自己 tenant 下的库，跨 tenant 一律
# 403（Permission denied），不是 404、也不是 key 失效。所以「取到第一把能连通的钱包
# 就收工」是错的——必须对每个目标 kb_id 挑一把 ① 能连（GET /knowledge-bases 返 200）
# 且 ② 其 /knowledge-bases 列表里含该 kb_id 的 key。多个 target 可各用不同 key
# （-All 模式必然如此）。
#
# 候选文件扫描 + sk- 正则 + UTF-8 显式读取的范式与纪律不变：
# key 不回显 / 不落盘 / 不进任何产出物 / 不进 commit message。
# key 值只在进程内活，任何输出只出现来源文件名与末 4 位指纹。
$cands = @()
$cands += Get-ChildItem -Path "C:\Users\jxc123\Nutstore\1\*\*\Secret\WeKnora-*.md" -ErrorAction SilentlyContinue
$cands += Get-ChildItem -Path "C:\Users\jxc123\Nutstore\1\*\*\TencentDB-Agent-Memory\*weknora*.md" -ErrorAction SilentlyContinue

# 去重后的候选 key（同一文件可能被多个正则重复命中；保序去重）
$keyCands = [ordered]@{}
foreach ($f in $cands) {
  $md = [System.IO.File]::ReadAllText($f.FullName, $utf8)
  foreach ($m in [regex]::Matches($md, 'sk-[A-Za-z0-9_\-]+')) {
    if (-not $keyCands.Contains($m.Value)) {
      $keyCands[$m.Value] = [ordered]@{ file = $f.Name; fp = $m.Value.Substring($m.Value.Length - 4) }
    }
  }
}

# 已验证 key 的缓存：key → @{ ok=<bool>; kbs=<id[]>; file=<name>; fp=<末4位> }
# 同一把 key 只 curl 一次 /knowledge-bases，多个 target 复用，避免 curl 次数爆炸。
$keyCache = [ordered]@{}

function Test-KeyList([string]$k) {
  if ($keyCache.Contains($k)) { return $keyCache[$k] }
  $meta = $keyCands[$k]
  $rec = [ordered]@{ ok = $false; kbs = @(); file = $(if ($meta) { $meta.file } else { "" }); fp = $(if ($meta) { $meta.fp } else { $k.Substring($k.Length - 4) }) }
  try {
    $code = curl.exe -s -o NUL -w "%{http_code}" -H "X-API-Key: $k" "$Base/knowledge-bases"
    if ("$code" -eq "200") {
      $list = Get-ListData (curl.exe -s -H "X-API-Key: $k" "$Base/knowledge-bases" | ConvertFrom-Json)
      $rec.ok = $true
      $rec.kbs = @($list | ForEach-Object { [string]$_.id })
    }
  } catch { }
  $keyCache[$k] = $rec
  return $rec
}

# 按目标库挑 key：能连 + 列表里含该 kb_id
function Select-KeyFor([string]$kbId) {
  foreach ($e in $keyCands.GetEnumerator()) {
    $rec = Test-KeyList $e.Key
    if ($rec.ok -and (@($rec.kbs) -contains $kbId)) {
      return [ordered]@{ key = $e.Key; file = $rec.file; fp = $rec.fp }
    }
  }
  return $null
}

# 是否有任何一把 key 能连上（用于区分「全部失效」与「连上但看不到该库」）
$anyConnected = $false
foreach ($e in $keyCands.GetEnumerator()) {
  if ((Test-KeyList $e.Key).ok) { $anyConnected = $true; break }
}
if (-not $anyConnected) {
  Write-Error "未找到可用 API key（凭据腿缺失或全部失效）"
  exit 1
}
if ($Json) { $script:Report.keyCandidates = @($keyCands.Count) }

# ---------- 逐库体检 ----------
# 每个 target 独立选 key（不同 tenant 的库用不同的 key），缓存保证不重复 curl。
$script:Report.bases = @()

foreach ($t in $targets) {
  $kbId = $t.id
  Head ""
  Head "===== 知识库 $kbId ====="

  $pick = Select-KeyFor $kbId
  if (-not $pick) {
    # 有 key 能连、但没有任何一把 key 的列表里出现该 kb_id。
    # 区分两种成因，别把「无权访问」误报成「不存在」：
    #   a) 某把 key 直连该库返 403 → tenant 隔离（要该库所属 tenant 的 key）
    #   b) 所有 key 直连都返 404 → 该库确实不存在
    $codes = @()
    foreach ($e in $keyCands.GetEnumerator()) {
      if (-not (Test-KeyList $e.Key).ok) { continue }
      $codes += "$(curl.exe -s -o NUL -w '%{http_code}' -H "X-API-Key: $($e.Key)" "$Base/knowledge-bases/$kbId")"
    }
    if ($codes -contains "403") {
      Say $false "无权访问该库（可能 tenant 隔离；需要该库所属 tenant 的 API key）：$kbId"
      Note ("诊断：候选 key 全部连通（共 {0} 把），但没有一把的 /knowledge-bases 列表里含该 kb_id；直连该库返回 403（WeKnora 按 tenant 隔离，跨空间一律 403，不是 key 失效）。" -f $keyCands.Count)
      Note "处置：到机密仓 weknora-credentials.md 取/建该 tenant 的 key（JWT 登录 → POST /auth/switch-tenant {tenant_id} → POST /tenants/{id}/api-keys，body {scope_type:tenant, name:..., full_access:true}），再重跑本脚本。"
    } elseif ($codes -contains "404") {
      Say $false "知识库不存在：$kbId"
    } else {
      Say $false "知识库不可访问：$kbId（候选 key 直连均未返 200/403/404：$($codes -join ',')）"
    }
    continue
  }

  $key = $pick.key
  $keyFile = $pick.file
  Say $true "API key 就绪（来源：$keyFile；指纹 …$($pick.fp)；值不回显）"
  Note "选 key 依据：该 key 的 /knowledge-bases 列表含目标 kb_id（候选共 $($keyCands.Count) 把，逐把核验后选中）"

  # ---- 1. 库级信息 ----
  $bases = @((curl.exe -s -H "X-API-Key: $key" "$Base/knowledge-bases" | ConvertFrom-Json).data)
  $info  = $bases | Where-Object { $_.id -eq $kbId }
  if (-not $info) { Say $false "知识库不在列表中：$kbId"; continue }
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
    keySource = $keyFile
    keyFingerprint = $pick.fp
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
