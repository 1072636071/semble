$srcEng = "D:\work\space\jwikis-skills\codeBuddyBase\skills\engineering"
$srcProd = "D:\work\space\jwikis-skills\codeBuddyBase\skills\productivity"

$modifiedSkills = @(
    @{ Name = "jxx-wizard";            Src = $srcEng }
    @{ Name = "jxx-ask-matt";          Src = $srcEng }
    @{ Name = "jxx-diagnosing-bugs";   Src = $srcEng }
    @{ Name = "jxx-prototype";         Src = $srcEng }
    @{ Name = "jxx-code-review";       Src = $srcEng }
    @{ Name = "jxx-codebase-design";   Src = $srcEng }
    @{ Name = "jxx-improve-codebase-architecture"; Src = $srcEng }
    @{ Name = "jxx-grilling";          Src = $srcProd }
    @{ Name = "jxx-to-questionnaire";  Src = $srcProd }
    @{ Name = "jxx-writing-for-agents";Src = $srcProd }
)

$targets = @(
    "C:\Users\jxc1\.codebuddy\skills"
    "C:\Users\jxc1\.agents\skills"
    "C:\Users\jxc1\.codeartsdoer\skills"
    "C:\Users\jxc1\.qoder-cn\skills"
    "C:\Users\jxc1\.trae-cn\skills"
    "C:\Users\jxc1\.workbuddy\skills"
    "C:\Users\jxc1\.qoderworkcn\skills"
)

$allOk = $true
foreach ($dest in $targets) {
    $label = Split-Path $dest -Parent | Split-Path -Leaf
    Write-Host "=== $label ==="
    foreach ($skill in $modifiedSkills) {
        $srcFile = "$($skill.Src)\$($skill.Name)\SKILL.md"
        $dstFile = "$dest\$($skill.Name)\SKILL.md"
        if (Test-Path $dstFile) {
            $srcHash = (Get-FileHash $srcFile -Algorithm SHA256).Hash
            $dstHash = (Get-FileHash $dstFile -Algorithm SHA256).Hash
            if ($srcHash -eq $dstHash) {
                Write-Host "  $($skill.Name) : OK"
            } else {
                Write-Host "  $($skill.Name) : MISMATCH"
                $allOk = $false
            }
        } else {
            Write-Host "  $($skill.Name) : MISSING"
            $allOk = $false
        }
    }
}

Write-Host ""
if ($allOk) { Write-Host "验证通过：所有平台所有技能一致。" }
else        { Write-Host "验证失败：存在 MISMATCH 或 MISSING，请检查。" }