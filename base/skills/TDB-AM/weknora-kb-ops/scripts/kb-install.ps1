# WeKnora 知识库接入安装器（全局脚本 · weknora-kb-ops 技能）
#
# 把一个 WeKnora 知识库接入到任意本地工作区：写 AGENTS.md / CODEBUDDY.md 知识库段（两份逐字一致、
# 幂等 upsert）、建 docs/agents/knowledge-base.md 规范骨架、生成体检转发壳 scripts/kb-check.ps1。
# 这是「安装流程」的固化入口；改知识库规则后重跑即可幂等刷新，不必手改 markdown。
#
# 用法：
#   pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "BPM" -Workspace .
#   pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "BPM" -Workspace . -Check   # 装完跑体检
#   pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "BPM" -Workspace . -Force   # 连规范文档一起覆盖
#
# 参数：
#   -Position Top|Append   知识库段插入位置：Top=插到二级标题之前（默认），Append=追加到文末
#   -Anchor <标题片段>      Top 模式下插到含该片段的二级标题之前（不填则用首个二级标题）
#   -ExtraRules <string[]> 追加的项目专属强制约束（如「SQL 交用户执行」）
#
# 纪律：API key 只在 -Check 触发的体检子进程内活，不回显 / 不落盘 / 不进任何产出物。

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Kb,
  [Parameter(Mandatory = $true)][string]$KbName,
  [Parameter(Mandatory = $true)][string]$Workspace,
  [string]$Base = "http://123.206.125.149:8127/api/v1",
  [ValidateSet("Top", "Append")][string]$Position = "Top",
  [string]$Anchor = "",
  [string[]]$ExtraRules = @(),
  [switch]$Force,
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$MARK_BEGIN = "<!-- weknora-kb-ops:begin -->"
$MARK_END = "<!-- weknora-kb-ops:end -->"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
# PowerShell 5.1 读无 BOM 文件按 ANSI(GBK) 解析，中文注释会把语法搞崩（ParserError）。
# 所以 markdown 用无 BOM UTF-8（符合仓库习惯），.ps1 一律带 BOM。
$utf8Bom = New-Object System.Text.UTF8Encoding($true)

function Say([bool]$ok, [string]$msg) { Write-Host ("[{0}] {1}" -f $(if ($ok) { "OK  " } else { "FAIL" }), $msg) }

function ReadText([string]$p) { if (Test-Path -LiteralPath $p) { [System.IO.File]::ReadAllText($p, $utf8NoBom) } else { "" } }
function WriteText([string]$p, [string]$s) {
  $dir = Split-Path -Parent $p
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $enc = if ($p -like "*.ps1") { $script:utf8Bom } else { $script:utf8NoBom }
  [System.IO.File]::WriteAllText($p, $s, $enc)
}

# ---------- 幂等 upsert：标记块替换 / 首次插入 ----------
function Upsert-Block([string]$content, [string]$block, [string]$position, [string]$anchor = "") {
  # 显式循环版：不用下标区间（$a[0..($b-1)] 在 $b=0 时会退化成整个数组，是幂等性事故源）
  $blockLines = @($block -split "`r?`n")
  $lines = @($content -split "`r?`n")
  $new = New-Object System.Collections.Generic.List[string]

  # 定位首个完整的 begin…end 标记块
  $b = -1; $e = -1
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($b -lt 0) { if ($lines[$i] -eq $script:MARK_BEGIN) { $b = $i }; continue }
    if ($lines[$i] -eq $script:MARK_END) { $e = $i; break }
  }

  if ($b -ge 0 -and $e -gt $b) {
    # 已有标记块：块外原样保留，块内整体替换（幂等）
    for ($i = 0; $i -lt $b; $i++) { $new.Add($lines[$i]) }
    foreach ($l in $blockLines) { $new.Add($l) }
    for ($i = $e + 1; $i -lt $lines.Count; $i++) { $new.Add($lines[$i]) }
  } else {
    $idx = -1
    if ($position -eq "Top") {
      for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -notmatch '^##\s') { continue }
        if ($anchor) { if ($lines[$i].Contains($anchor)) { $idx = $i; break } }
        else { $idx = $i; break }
      }
      # -Anchor 指定的标题不存在时回退到首个二级标题，避免静默追加到文末
      if ($anchor -and $idx -lt 0) {
        for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match '^##\s') { $idx = $i; break } }
      }
    }
    if ($idx -ge 0) {
      for ($i = 0; $i -lt $idx; $i++) { $new.Add($lines[$i]) }
      foreach ($l in $blockLines) { $new.Add($l) }
      $new.Add("")
      for ($i = $idx; $i -lt $lines.Count; $i++) { $new.Add($lines[$i]) }
    } else {
      for ($i = 0; $i -lt $lines.Count; $i++) { $new.Add($lines[$i]) }
      $new.Add(""); $new.Add("")
      foreach ($l in $blockLines) { $new.Add($l) }
    }
  }

  while ($new.Count -gt 0 -and $new[$new.Count - 1] -eq "") { $new.RemoveAt($new.Count - 1) }
  return (($new -join "`n") + "`n")
}

# ---------- 生成知识库段 ----------
$rules = @(
  "**结论当日入库**——本次新确认的表结构、业务口径、踩坑结论、决策记录，当天写入知识库并挂对应领域标。只留在对话或本地文档里 = 任务未完成。",
  "**入库前先查重**——写入前用 ``POST /knowledge-bases/{kb}/hybrid-search``（body 字段名是 ``query_text``，不是 ``query``）查同名 / 同主题；命中既有条目就改那一条（``PUT /knowledge/manual/{id}``，``status`` 必传），不要新建第二份。",
  "**事实冲突必须双向修正**——代码 / 文档 / 库内条目三方打架时禁止只改一边。权威顺序：**用户输入与本次实测 > 知识库 > 记忆**；过时一方立即改到逐字一致，不留「待核对」。",
  "**每条结论必须可回溯**——入库正文写清证据位置（表名+字段 / 脚本路径 / ADR 编号）。查不到出处的结论不进库。"
)
foreach ($r in $ExtraRules) { $rules += $r }

$ruleLines = @()
for ($i = 0; $i -lt $rules.Count; $i++) { $ruleLines += ("{0}. {1}" -f ($i + 1), $rules[$i]) }

$block = @"
$MARK_BEGIN
## 知识库（WeKnora · $KbName）

本项目的可复用结论统一沉淀到团队知识库：**入库前查重、入库后以库为准**。

- 库：``$KbName``，kb_id ``$Kb``
- UI：<$($Base.Replace('/api/v1',''))>/platform/knowledge-bases/$Kb
- REST base：``$Base``（请求头 ``X-API-Key``）
- 凭据腿：坚果云 ``项目机密\Secret\WeKnora-知识库-API密钥.md``——**key 只现取现用，不进仓库 / 文档 / 工单 / 回显**
- 运维技能：``weknora-kb-ops``；完整写入 / 查询 / 标签 / 端点规范见 ``docs/agents/knowledge-base.md``
- 安装与体检（全局脚本，由该技能分发，见 JwikisSkills ``base/skills/TDB-AM/weknora-kb-ops/scripts/``）：
  - 体检：``pwsh -File scripts/kb-check.ps1``（转发壳，自动定位技能目录里的全局脚本）
  - 接入新工作区：``pwsh -File <技能目录>/scripts/kb-install.ps1 -Kb <kb_id> -KbName "<库名>" -Workspace .``

### 强制约束（硬性 · 任务完成前逐条核验）

$($ruleLines -join "`n")
$MARK_END
"@
$block = $block.Trim("`r", "`n")

# ---------- 生成体检转发壳 ----------
$shim = @'
# WeKnora 知识库体检转发壳 —— 由 weknora-kb-ops 技能的 kb-install.ps1 生成，勿手改。
# 本文件不含任何逻辑：运行时定位全局脚本并原样转发参数。
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

$roots = @(
  "$env:USERPROFILE\.agents\skills",
  "$env:USERPROFILE\.codebuddy\skills",
  "$env:USERPROFILE\.codeartsdoer\skills",
  "$env:USERPROFILE\.trae-cn\skills",
  "$env:USERPROFILE\.qoder-cn\skills",
  "$env:USERPROFILE\.qwenworkcn\skills"
)
$target = $null
foreach ($r in $roots) {
  $p = Join-Path $r "weknora-kb-ops\scripts\kb-check.ps1"
  if (Test-Path -LiteralPath $p) { $target = $p; break }
}
if (-not $target) {
  Write-Error "未找到全局 weknora-kb-ops 技能。请先在 JwikisSkills 仓执行：node base/scripts/ship.mjs install"
  exit 2
}

# 未显式指定 -Workspace 时，回落到本转发壳所属的工作区根（scripts/ 的上一级），
# 这样从任意 cwd 调用都体检的是本项目。
$forward = @{}
foreach ($k in $PSBoundParameters.Keys) { $forward[$k] = $PSBoundParameters[$k] }
if (-not $forward.ContainsKey("Workspace")) {
  $forward["Workspace"] = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
}

& $target @forward
exit $LASTEXITCODE
'@

# ---------- 规范文档骨架 ----------
$docPath = Join-Path $Workspace "docs\agents\knowledge-base.md"
$doc = @"
# 知识库：WeKnora · $KbName

本项目的团队知识库。凡本项目产生的**可复用结论**，一律入库；入库前先查重，入库后以库为准。
本文件由 ``weknora-kb-ops`` 技能的 ``kb-install.ps1`` 生成骨架，**可自由补充**；重跑安装器不会覆盖（除非 ``-Force``）。

## 库档案

| 项 | 值 |
| --- | --- |
| kb_id | ``$Kb`` |
| 库名 | ``$KbName`` |
| UI | <$($Base.Replace('/api/v1',''))/platform/knowledge-bases/$Kb> |
| REST base | ``$Base``，请求头 ``X-API-Key: <key>`` |
| 凭据腿 | 坚果云 ``项目机密\Secret\WeKnora-知识库-API密钥.md`` |

**凭据纪律**：``sk-`` 开头的 key 只从凭据腿文件现取现用，不进仓库、不进文档、不进工单、不回显。

## 强制约束

见 ``AGENTS.md``「知识库（WeKnora · $KbName）」节（由安装器生成，两份规则文件逐字一致）。

## 写入通道

| 内容 | 通道 | 关键点 |
| --- | --- | --- |
| Markdown 文本 / 结论 | ``POST /knowledge-bases/{kb}/knowledge/manual`` | body：``title`` / ``content`` / ``status`` / ``tag_ids`` / ``channel`` |
| 图片 | 灵枢 ``memory_remember`` 或官方 MCP ``create_knowledge_from_file`` | 图片必须开 ``enable_multimodel`` |
| 改已有文本条目 | ``PUT /knowledge/manual/{id}`` | **``status`` 不可省略**，缺省被后端置 ``draft`` |
| 改标题 / 描述 | ``PUT /knowledge/{id}`` | 不收 ``file_name`` |
| 标签 | ``GET/POST /knowledge-bases/{kb}/tags``、``PUT/DELETE /knowledge-bases/{kb}/tags/{tag_id}`` | 同名建标返 409，先查后建 |
| 批量改标 | ``PUT /knowledge/tags`` | **replace 语义**：先读旧标取并集再整组写回 |
| 删除 | ``delete_knowledge`` | 高危，先备份 + 确认 |

> ⚠️ **不要用灵枢 ``memory_remember`` 传文本**——它只收图片，文本会写进灵枢记忆而不是知识库。

## REST 端点速查（含实测踩过的坑）

| 用途 | 方法与路径 |
| --- | --- |
| 列库 | ``GET /knowledge-bases`` |
| 列条目 | ``GET /knowledge-bases/{kb}/knowledge?page=N&page_size=100`` |
| 单条详情 | ``GET /knowledge/{id}`` |
| 混合检索 | ``POST /knowledge-bases/{kb}/hybrid-search`` |
| 建手工知识 | ``POST /knowledge-bases/{kb}/knowledge/manual`` |
| 改手工知识 | ``PUT /knowledge/manual/{id}`` |
| 上传文件 | ``POST /knowledge-bases/{kb}/knowledge/file`` |

- 混合检索 body 字段是 **``query_text``**；传 ``query`` → ``400 query_text is required``；用 ``/search/hybrid`` → ``404``。
- 手工知识的 ``manual`` 段必须挂在 ``/knowledge/`` 之下。记忆口诀：**库 → 知识 → 手工**。
- 返回的 ``file_hash`` 是 **MD5**（32 位）不是 SHA256。
- ``PUT /knowledge/:id`` **不收 ``file_name``**；文件类条目 PUT 前须等 ``parse_status=completed``。

完整菜谱见技能目录 ``references/rest-cookbook.md``。

## 标签台账

跑一次体检拿实时台账：

``````powershell
pwsh -File scripts/kb-check.ps1 -Workspace .
``````

## 体检

``````powershell
pwsh -File scripts/kb-check.ps1                      # 从本仓 AGENTS.md 自动读 kb_id
pwsh -File scripts/kb-check.ps1 -Query "检索词"        # 体检 + 检索冒烟
pwsh -File scripts/kb-check.ps1 -Json                # 机器可读输出
``````
"@
$doc = $doc.Trim("`r", "`n")

# ---------- 执行 ----------
$ws = (Resolve-Path -LiteralPath $Workspace).Path
Write-Host "工作区：$ws"

foreach ($f in @("AGENTS.md", "CODEBUDDY.md")) {
  $p = Join-Path $ws $f
  if (-not (Test-Path -LiteralPath $p)) {
    Say $false "缺 $f，跳过（该仓规则要求两份并存）"
    continue
  }
  $before = ReadText $p
  WriteText $p (Upsert-Block $before $block $Position $Anchor)
  Say $true "$f 知识库段已 upsert（$(if ($before -match [regex]::Escape($MARK_BEGIN)) { '替换既有标记块' } else { '首次插入' })）"
}

# 两份规则文件必须逐字一致
$a = ReadText (Join-Path $ws "AGENTS.md")
$b = ReadText (Join-Path $ws "CODEBUDDY.md")
if ($a -ceq $b) { Say $true "AGENTS.md 与 CODEBUDDY.md 逐字一致" } else { Say $false "AGENTS.md 与 CODEBUDDY.md 不一致（若原本就不同，本脚本只保证知识库段一致）" }

if (Test-Path -LiteralPath $docPath) {
  if ($Force) { WriteText $docPath $doc; Say $true "docs/agents/knowledge-base.md 已覆盖（-Force）" }
  else { Say $true "docs/agents/knowledge-base.md 已存在，跳过（-Force 可覆盖）" }
} else {
  WriteText $docPath $doc
  Say $true "docs/agents/knowledge-base.md 已生成骨架"
}

$shimPath = Join-Path $ws "scripts\kb-check.ps1"
WriteText $shimPath $shim
Say $true "scripts/kb-check.ps1 转发壳已生成"

if ($Check) {
  Write-Host ""
  Write-Host "----- 体检 -----"
  & $shimPath -Kb $Kb
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "安装完成。"
exit 0
