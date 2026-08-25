$ErrorActionPreference = "Stop"

$srcEng = "E:\work\sp\JwikisSkills\base\skills\engineering"
$srcProd = "E:\work\sp\JwikisSkills\base\skills\productivity"

# engineering 默认不安装列表——需要手动安装的技能在此追加
$engExclude = @(
    "jxx-agent-generator"
)

# engineering 非 jxx-* 系列技能（同样默认安装）——新增时在此追加
$engExtra = @(
    "impeccable"
)

# productivity 默认安装列表——新增默认技能时在此追加
$prodSkills = @(
    "jxx-grill-me"
    "jxx-grilling"
    "jxx-handoff"
    "jxx-to-questionnaire"
    "jxx-writing-for-agents"
)

$targets = @(
    "C:\Users\jxc123\.codebuddy\skills"
    "C:\Users\jxc123\.agents\skills"
    "C:\Users\jxc123\.codeartsdoer\skills"
    "C:\Users\jxc123\.qoder-cn\skills"
    "C:\Users\jxc123\.trae-cn\skills"
    "C:\Users\jxc123\.workbuddy\skills"
    "C:\Users\jxc123\.qoderworkcn\skills"
)

$engSkills = Get-ChildItem "$srcEng\jxx-*" -Directory | Where-Object { $engExclude -notcontains $_.Name }
Write-Host "engineering 安装技能数: $($engSkills.Count + $engExtra.Count)  (jxx-* 安装 $($engSkills.Count)，默认不安装 $($engExclude.Count)，非 jxx-* 追加 $($engExtra.Count))"
Write-Host "productivity 默认安装: $($prodSkills.Count)"
Write-Host ""

foreach ($dest in $targets) {
    $label = Split-Path $dest -Parent | Split-Path -Leaf
    if (-not (Test-Path $dest)) {
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
    }
    Write-Host "=== $label ($dest) ==="

    # 1) engineering：复制全部 jxx-* 技能（默认不安装的除外）+ 非 jxx-* 技能（impeccable）
    foreach ($s in $engSkills) {
        Copy-Item -Path $s.FullName -Destination $dest -Recurse -Force
    }
    foreach ($extra in $engExtra) {
        $src = "$srcEng\$extra"
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $dest -Recurse -Force
        } else {
            Write-Host "  WARN: engineering 源缺失 $extra"
        }
    }

    # 2) productivity：复制默认安装列表
    foreach ($skill in $prodSkills) {
        $src = "$srcProd\$skill"
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $dest -Recurse -Force
        } else {
            Write-Host "  WARN: productivity 源缺失 $skill"
        }
    }

    # 3) 清理残留：目标中存在、但两个源目录都不再有、或被列为默认不安装的 jxx-* 技能目录
    #    （同时检查 engineering 与 productivity 源，避免误删源中仍存在的技能）
    Get-ChildItem $dest -Directory -Filter "jxx-*" | ForEach-Object {
        $inEng  = Test-Path "$srcEng\$($_.Name)"
        $inProd = Test-Path "$srcProd\$($_.Name)"
        if ((-not $inEng -and -not $inProd) -or $engExclude -contains $_.Name) {
            Remove-Item $_.FullName -Recurse -Force
            Write-Host "  cleaned: $($_.Name)"
        }
    }

    Write-Host "  done."
}

Write-Host ""
Write-Host "安装完成。"
