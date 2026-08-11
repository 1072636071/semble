# === 确保输出目录存在 ===
$outDir = "E:\work\sp\JwikisSkills\三方\temp"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

# === 定义路径 ===
$originalRoot = "E:\work\sp\JwikisSkills\三方\mattpocock-skills\skills"
$chineseRoot   = "E:\work\sp\JwikisSkills\三方\mattpocock-skills-A\skills"

# === 分析原型结构 ===
$origCategories = @{}
$origSkills = @{}
Get-ChildItem -LiteralPath $originalRoot -Directory | ForEach-Object {
    $catName = $_.Name
    $skills = @{}
    Get-ChildItem -LiteralPath $_.FullName -Directory | ForEach-Object {
        $skillName = $_.Name
        $files = @{}
        Get-ChildItem -LiteralPath $_.FullName -Recurse -File | ForEach-Object {
            $relPath = $_.FullName.Substring(($originalRoot.Length + 1 + $catName.Length + 1 + $skillName.Length + 1))
            $files[$relPath] = $_.Length
        }
        $skills[$skillName] = $files
    }
    $origCategories[$catName] = $skills
    $origSkills[$catName] = $skills.Keys
}

# === 分析中文版结构 ===
$chineseCategories = @{}
$chineseSkills = @{}
Get-ChildItem -LiteralPath $chineseRoot -Directory | ForEach-Object {
    $catName = $_.Name
    $skills = @{}
    Get-ChildItem -LiteralPath $_.FullName -Directory | ForEach-Object {
        $skillNameCN = $_.Name
        $files = @{}
        Get-ChildItem -LiteralPath $_.FullName -Recurse -File | ForEach-Object {
            $relPath = $_.FullName.Substring(($chineseRoot.Length + 1 + $catName.Length + 1 + $skillNameCN.Length + 1))
            $files[$relPath] = $_.Length
        }
        $skills[$skillNameCN] = $files
    }
    $chineseCategories[$catName] = $skills
    $chineseSkills[$catName] = $skills.Keys
}

# 中文版根目录文件
$chineseRootFiles = @()
Get-ChildItem -LiteralPath $chineseRoot -File | ForEach-Object {
    $chineseRootFiles += $_.Name
}

# === 生成报告函数 ===
$lines = [System.Collections.ArrayList]::new()

function Add-Line($str) {
    $script:lines.Add($str) | Out-Null
}

function Add-Lines($strArray) {
    foreach ($s in $strArray) { Add-Line $s }
}

Add-Line "# Matt Pocock Skills 中文版 vs 原型 缺失对比报告"
Add-Line "生成时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line ""

# 统计数量
$origTotalSkills = 0
foreach ($k in $origCategories.Keys) { $origTotalSkills += $origCategories[$k].Count }
$cnTotalSkills = 0
foreach ($k in $chineseCategories.Keys) { $cnTotalSkills += $chineseCategories[$k].Count }

Add-Line "## 1. 概要"
Add-Line ""
Add-Line "| 项目 | 数量 |"
Add-Line "|------|------|"
Add-Line "| 原型总 Skill 数 | $origTotalSkills |"
Add-Line "| 中文版总 Skill 数 | $cnTotalSkills |"
Add-Line "| 原型分类数 | $($origCategories.Count) |"
Add-Line "| 中文版分类数 | $($chineseCategories.Count) |"
Add-Line ""

# === 2. 分类级别对比 ===
Add-Line "## 2. 分类级别对比"
Add-Line ""
$allCatNames = $origCategories.Keys + $chineseCategories.Keys | Sort-Object -Unique
foreach ($cat in $allCatNames) {
    $hasOrig = $origCategories.ContainsKey($cat)
    $hasCN   = $chineseCategories.ContainsKey($cat)
    if ($hasOrig -and -not $hasCN) {
        Add-Line "- [X] 缺失整个分类：``$cat``（原型有 $($origCategories[$cat].Count) 个 Skill，中文版无此分类）"
    } elseif ($hasCN -and -not $hasOrig) {
        Add-Line "- [!] 中文版额外分类：``$cat``（原型无此分类）"
    } else {
        Add-Line "- [OK] 分类 ``$cat``：原型 $($origCategories[$cat].Count) 个 / 中文版 $($chineseCategories[$cat].Count) 个"
    }
}
Add-Line ""

# === 3. Skill 映射关系 ===
Add-Line "## 3. Skill 映射关系（中文版 jxx- 前缀 -> 原型名称）"
Add-Line ""
Add-Line "| 中文版 Skill | 原型 Skill | 分类 |"
Add-Line "|---|---|---|"

$mapping = @{}
$unmappedOrig = [System.Collections.ArrayList]::new()
$unmappedCN = [System.Collections.ArrayList]::new()

foreach ($cat in $origCategories.Keys) {
    foreach ($origSkill in ($origCategories[$cat].Keys | Sort-Object)) {
        $found = $false
        if ($chineseCategories.ContainsKey($cat)) {
            $expectedCN = "jxx-$origSkill"
            if ($chineseCategories[$cat].ContainsKey($expectedCN)) {
                $mapping[$expectedCN] = @{ origName = $origSkill; category = $cat }
                Add-Line "| ``$expectedCN`` | ``$origSkill`` | $cat |"
                $found = $true
            }
        }
        if (-not $found) {
            $unmappedOrig.Add(@{ name = $origSkill; category = $cat }) | Out-Null
            Add-Line "| [X] 缺失 | ``$origSkill`` | $cat |"
        }
    }
}

# 中文版多出的
foreach ($cat in $chineseCategories.Keys) {
    foreach ($cnSkill in $chineseCategories[$cat].Keys) {
        if (-not $mapping.ContainsKey($cnSkill)) {
            $unmappedCN.Add(@{ name = $cnSkill; category = $cat }) | Out-Null
        }
    }
}
Add-Line ""

if ($unmappedCN.Count -gt 0) {
    Add-Line "### [!] 中文版多出的 Skill（原型中不存在对应项）"
    Add-Line ""
    foreach ($u in $unmappedCN) {
        Add-Line "- ``$($u.name)``（分类：$($u.category)）"
    }
    Add-Line ""
}

# === 4. Skill 级别文件对比 ===
Add-Line "## 4. Skill 级别文件缺失详情"
Add-Line ""

foreach ($cat in ($origCategories.Keys | Sort-Object)) {
    Add-Line "### 分类：$cat"
    Add-Line ""
    
    $catHasContent = $false
    
    if ($chineseCategories.ContainsKey($cat)) {
        $cnCatSkills = $chineseCategories[$cat]
    } else {
        $cnCatSkills = @{}
    }
    
    foreach ($origSkill in ($origCategories[$cat].Keys | Sort-Object)) {
        $origFiles = $origCategories[$cat][$origSkill]
        $expectedCN = "jxx-$origSkill"
        
        $cnFiles = @{}
        if ($cnCatSkills.ContainsKey($expectedCN)) { $cnFiles = $cnCatSkills[$expectedCN] }
        
        if ($cnFiles.Count -eq 0) {
            # 整 Skill 缺失
            Add-Line "#### [X] $origSkill -- 整 Skill 缺失（原型未翻译）"
            Add-Line ""
            Add-Line "原型文件数：$($origFiles.Count)"
            foreach ($f in ($origFiles.Keys | Sort-Object)) {
                Add-Line "  - $f ($($origFiles[$f]) bytes)"
            }
            Add-Line ""
            $catHasContent = $true
        } else {
            # 对比文件
            $missingFiles = @()
            $extraFiles = @()
            $sizeDiffs = @()
            
            foreach ($origFile in ($origFiles.Keys | Sort-Object)) {
                if (-not $cnFiles.ContainsKey($origFile)) {
                    $missingFiles += $origFile
                }
            }
            
            foreach ($cnFile in ($cnFiles.Keys | Sort-Object)) {
                if (-not $origFiles.ContainsKey($cnFile)) {
                    $extraFiles += $cnFile
                }
                if ($origFiles.ContainsKey($cnFile) -and $cnFiles[$cnFile] -ne $origFiles[$cnFile]) {
                    $sizeDiffs += "$cnFile (原型 $($origFiles[$cnFile]) -> 中文版 $($cnFiles[$cnFile]) bytes)"
                }
            }
            
            if ($missingFiles.Count -gt 0 -or $extraFiles.Count -gt 0) {
                Add-Line "#### $origSkill <-> $expectedCN"
                Add-Line ""
                
                if ($missingFiles.Count -gt 0) {
                    Add-Line "原型有但中文版缺失的文件："
                    foreach ($f in $missingFiles) {
                        Add-Line "- [X] $f ($($origFiles[$f]) bytes)"
                    }
                    Add-Line ""
                    $catHasContent = $true
                }
                
                if ($extraFiles.Count -gt 0) {
                    Add-Line "中文版额外多出的文件："
                    foreach ($f in $extraFiles) {
                        Add-Line "- [+] $f ($($cnFiles[$f]) bytes)"
                    }
                    Add-Line ""
                }
                
                if ($sizeDiffs.Count -gt 0) {
                    Add-Line "文件大小不一致："
                    foreach ($d in $sizeDiffs) {
                        Add-Line "- [~] $d"
                    }
                    Add-Line ""
                }
            }
        }
    }
    
    if (-not $catHasContent) {
        Add-Line "[OK] 此分类所有 Skill 文件完全一致（不含中文版额外文件如 CHANGELOG/README/LICENSE/evals 等）"
        Add-Line ""
    }
}

# === 5. 中文版根目录额外文件 ===
Add-Line "## 5. 中文版根目录额外文件"
Add-Line ""
if ($chineseRootFiles.Count -gt 0) {
    foreach ($f in $chineseRootFiles) {
        Add-Line "- $f"
    }
} else {
    Add-Line "无"
}
Add-Line ""

# === 6. 统计摘要 ===
$totalMissingSkills = 0
$totalMissingFiles = 0
foreach ($cat in ($origCategories.Keys | Sort-Object)) {
    foreach ($origSkill in ($origCategories[$cat].Keys | Sort-Object)) {
        $expectedCN = "jxx-$origSkill"
        $cnExists = $chineseCategories.ContainsKey($cat) -and $chineseCategories[$cat].ContainsKey($expectedCN)
        if (-not $cnExists) {
            $totalMissingSkills++
            $totalMissingFiles += $origCategories[$cat][$origSkill].Count
        } else {
            foreach ($origFile in $origCategories[$cat][$origSkill].Keys) {
                if (-not $chineseCategories[$cat][$expectedCN].ContainsKey($origFile)) {
                    $totalMissingFiles++
                }
            }
        }
    }
}

$missingCatCount = ($origCategories.Keys | Where-Object { -not $chineseCategories.ContainsKey($_) }).Count

Add-Line "## 6. 统计摘要"
Add-Line ""
Add-Line "| 指标 | 数值 |"
Add-Line "|---|---|"
Add-Line "| 完全缺失的 Skill 数 | $totalMissingSkills |"
Add-Line "| 共缺失文件数（含整 Skill 内文件） | $totalMissingFiles |"
Add-Line "| 完全缺失的分类数 | $missingCatCount |"
Add-Line "| 已翻译的 Skill 数 | $($origTotalSkills - $totalMissingSkills) / $origTotalSkills |"

# === 保存报告 ===
$reportPath = "$outDir\mattpocock-skills-缺失对比报告.md"
$lines -join [Environment]::NewLine | Out-File -FilePath $reportPath -Encoding UTF8
Write-Output "报告已生成：$reportPath"

# 输出预览前30行
$lines[0..([Math]::Min($lines.Count-1, 29))] -join [Environment]::NewLine
Write-Output "...($($lines.Count) 行总计)"
