# 目录对比脚本 - 原型 vs 中文版
# 原型: E:\work\sp\JwikisSkills\三方\mattpocock-skills\skills
# 中文版: E:\work\sp\JwikisSkills\三方\mattpocock-skills-A\skills

$protoRoot = "E:\work\sp\JwikisSkills\三方\mattpocock-skills\skills"
$cnRoot = "E:\work\sp\JwikisSkills\三方\mattpocock-skills-A\skills"
$outputFile = "E:\work\sp\JwikisSkills\三方\temp\comparison-report.md"

# 收集所有原型文件
$protoFiles = Get-ChildItem -Path $protoRoot -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($protoRoot.Length + 1)
    [PSCustomObject]@{
        RelativePath = $relativePath
        FullPath     = $_.FullName
        Size         = $_.Length
    }
}

# 收集所有中文版文件
$cnFiles = Get-ChildItem -Path $cnRoot -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($cnRoot.Length + 1)
    [PSCustomObject]@{
        RelativePath = $relativePath
        FullPath     = $_.FullName
        Size         = $_.Length
    }
}

# 将原型路径映射到中文版路径（处理重命名：x -> jxx-x）
function Convert-ProtoToCnPath($protoPath) {
    $segments = $protoPath.Split('\')
    if ($segments.Length -ge 2) {
        $lastSegment = $segments[-1]
        $parentDir = $segments[-2]
        if (-not $parentDir.StartsWith("jxx-")) {
            $segments[-2] = "jxx-$parentDir"
        }
        # 检查是否需要重命名SKILL所在目录
        if ($segments.Length -ge 2 -and $segments[-2] -eq 'writing-great-skills') {
            $segments[-2] = 'jxx-writing-great-skills'
        }
        if ($segments.Length -ge 2 -and $segments[-2] -eq 'grilling') {
            $segments[-2] = 'jxx-grilling'
        }
        if ($segments.Length -ge 2 -and $segments[-2] -eq 'teach') {
            $segments[-2] = 'jxx-teach'
        }
        if ($segments.Length -ge 2 -and $segments[-2] -eq 'handoff') {
            $segments[-2] = 'jxx-handoff'
        }
        if ($segments.Length -ge 2 -and $seg