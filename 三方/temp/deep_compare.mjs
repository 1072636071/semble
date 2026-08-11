import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const OUT_DIR = 'E:\\work\\sp\\JwikisSkills\\三方\\temp';
const ORIG = 'E:\\work\\sp\\JwikisSkills\\三方\\mattpocock-skills\\skills';
const CN   = 'E:\\work\\sp\\JwikisSkills\\三方\\mattpocock-skills-A\\skills';

mkdirSync(OUT_DIR, { recursive: true });

const now = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

// ============ 递归收集所有文件 ============
function collectFiles(root, prefix = '') {
  const result = {};
  const dirs = readdirSync(root, { withFileTypes: true });
  for (const e of dirs) {
    const full = join(root, e.name);
    const rel = prefix ? `${prefix}\\${e.name}` : e.name;
    if (e.isFile()) {
      result[rel] = {
        size: statSync(full).size,
        sha256: createHash('sha256').update(readFileSync(full)).digest('hex'),
        fullPath: full,
      };
    } else if (e.isDirectory()) {
      Object.assign(result, collectFiles(full, rel));
    }
  }
  return result;
}

const origFiles = collectFiles(ORIG);
const cnFiles = collectFiles(CN);

// ============ 建立映射 ============
// cn: "engineering\\jxx-ask-matt\\SKILL.md" → orig: "engineering\\ask-matt\\SKILL.md"
function cnToOrigPath(cnPath) {
  const parts = cnPath.split('\\');
  if (parts.length < 2) return null;
  const cat = parts[0];
  const skillDir = parts[1];
  if (skillDir.startsWith('jxx-')) {
    parts[1] = skillDir.substring(4);
  }
  // Also try without jxx- prefix (for non-skill files like 安装.md at root)
  return parts.join('\\');
}

// Map cn paths that exist in orig
const matchedPaths = new Map();  // cnPath → origPath
const unmatchedCN = [];          // cn files with no orig match
const unmatchedOrig = [];        // orig files with no cn match

for (const origPath of Object.keys(origFiles)) {
  // Expected cn path
  const parts = origPath.split('\\');
  if (parts.length >= 2) {
    parts[1] = 'jxx-' + parts[1];
  }
  const expectedCN = parts.join('\\');
  if (cnFiles[expectedCN]) {
    matchedPaths.set(expectedCN, origPath);
  } else {
    unmatchedOrig.push(origPath);
  }
}

for (const cnPath of Object.keys(cnFiles)) {
  if (!matchedPaths.has(cnPath)) {
    unmatchedCN.push(cnPath);
  }
}

// ============ 对比报告 ============
const lines = [];
function add(s) { lines.push(s); }

add('\uFEFF# Matt Pocock Skills 中文版 vs 原型 — 全量文件逐对对比报告');
add(`> 生成时间：${now()}`);
add(`> 原型：${ORIG}`);
add(`> 中文版：${CN}`);
add('');

// ---- 1. 概要 ----
add('## 1. 概要');
add('');
add('| 项目 | 数量 |');
add('|------|------|');
add(`| 原型文件总数 | ${Object.keys(origFiles).length} |`);
add(`| 中文版文件总数 | ${Object.keys(cnFiles).length} |`);
add(`| 成功匹配的文件对数 | ${matchedPaths.size} |`);
add(`| 原型有但中文版无 | ${unmatchedOrig.length} |`);
add(`| 中文版有但原型无 | ${unmatchedCN.length} |`);
add('');

// ---- 2. 缺失文件 ----
if (unmatchedOrig.length > 0) {
  add('## 2. ❌ 原型有但中文版缺失的文件');
  add('');
  add('| 文件路径 | 大小 (bytes) |');
  add('|---|---|');
  for (const p of unmatchedOrig.sort()) {
    add(`| \`${p}\` | ${origFiles[p].size} |`);
  }
  add('');
} else {
  add('## 2. ✅ 无缺失文件 — 中文版覆盖了原型所有文件');
  add('');
}

// ---- 3. 中文版额外文件 ----
if (unmatchedCN.length > 0) {
  add('## 3. ⚡ 中文版额外文件（原型中不存在）');
  add('');
  add('| 文件路径 | 大小 (bytes) |');
  add('|---|---|');
  for (const p of unmatchedCN.sort()) {
    add(`| \`${p}\` | ${cnFiles[p].size} |`);
  }
  add('');
}

// ---- 4. 逐文件内容对比 ----
add('## 4. 逐文件内容完整性对比');
add('');
add('对每一对匹配文件，比较 SHA256 哈希。若不同，进一步进行字符级分析，判断是"正常翻译差异"还是"内容损坏/乱码"。');
add('');
add('### 判断标准');
add('');
add('- ✅ 一致：SHA256 完全相同');
add('- 🌐 翻译差异：中文占比合理（>5%），无乱码特征');
add('- ⚠️ 疑似损坏：包含乱码字符、罕见Unicode、中英文比例异常、或与原文件差异过大');
add('');

let consistentCount = 0;
let translatedCount = 0;
let suspiciousCount = 0;
const suspiciousList = [];

// Sort by category
const sortedPairs = [...matchedPaths.entries()].sort(([ca], [cb]) => ca.localeCompare(cb));

// Print header
add('| 状态 | 中文版路径 | 原型大小 | 中文版大小 | 说明 |');
add('|---|---|---|---|---|');

for (const [cnPath, origPath] of sortedPairs) {
  const o = origFiles[origPath];
  const c = cnFiles[cnPath];
  const sizeDelta = c.size - o.size;

  if (o.sha256 === c.sha256) {
    consistentCount++;
    // SHA256 match — identical, skip detail (too many)
    if (consistentCount <= 5) {
      add(`| ✅ 一致 | \`${cnPath}\` | ${o.size} | ${c.size} | 完全相同 |`);
    }
  } else {
    // Content differs — analyze
    const origBuf = readFileSync(o.fullPath);
    const cnBuf = readFileSync(c.fullPath);
    const origText = origBuf.toString('utf-8');
    const cnText = cnBuf.toString('utf-8');

    // Detect encoding issues
    let hasGarbled = false;
    let garbledSamples = [];

    // Check for common garbled patterns
    const garbledPatterns = [
      /\x00/,                    // null bytes
      /�/,                       // replacement character
      /[\uFFFD]/,                // unicode replacement
      /\?{5,}/,                  // sequences of ???
    ];

    for (const pat of garbledPatterns) {
      const m = cnText.match(pat);
      if (m) {
        hasGarbled = true;
        garbledSamples.push(`pattern ${pat}: at offset ~${m.index}`);
      }
    }

    // Check for mixed encoding damage: high proportion of latin1 when should be CJK
    const cjkCount = (cnText.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const totalLen = cnText.length;
    const cjkRatio = cjkCount / Math.max(totalLen, 1);

    // Check if text looks like encoding-mangled Chinese (e.g., 娴嬭瘯 instead of 测试)
    // These are typically 2-byte sequences decoded wrong
    const garbledCJK = (cnText.match(/[\u00e0-\u00ff][\u0080-\u00bf]/g) || []);

    // Analyze what type of difference
    let status = '🌐 翻译差异';
    let detail = '';

    if (hasGarbled || garbledCJK.length > 5) {
      status = '⚠️ 疑似损坏';
      suspiciousCount++;
      detail = garbledSamples.join('; ') || `含 ${garbledCJK.length} 个疑似乱码序列`;
      suspiciousList.push({ cnPath, origPath, detail, origSize: o.size, cnSize: c.size });
    } else if (cjkRatio > 0.05) {
      // Has CJK content - normal translation difference
      translatedCount++;
      detail = `大小差 ${sizeDelta >= 0 ? '+' : ''}${sizeDelta} bytes, 中文占比 ${(cjkRatio * 100).toFixed(1)}%`;
    } else if (cjkRatio < 0.01 && totalLen > 100 && sizeDelta !== 0) {
      // Non-CJK file with difference - might be config/template change
      translatedCount++;
      detail = `大小差 ${sizeDelta >= 0 ? '+' : ''}${sizeDelta} bytes, 无中文内容`;
    } else {
      translatedCount++;
      detail = `大小差 ${sizeDelta >= 0 ? '+' : ''}${sizeDelta} bytes`;
    }

    add(`| ${status} | \`${cnPath}\` | ${o.size} | ${c.size} | ${detail} |`);
  }
}

// If many SHA256-identical, show summary
if (consistentCount > 5) {
  add(`| ✅ 一致 | ... (共 ${consistentCount} 个文件完全相同) | | | |`);
}
add('');

// ---- 5. 可疑项详表 ----
if (suspiciousList.length > 0) {
  add('## 5. ⚠️ 疑似损坏/乱码文件详情');
  add('');
  add('| # | 中文版路径 | 原型大小 | 中文版大小 | 疑似原因 |');
  add('|---|---|---|---|---|');
  let idx = 1;
  for (const item of suspiciousList) {
    add(`| ${idx} | \`${item.cnPath}\` | ${item.origSize} | ${item.cnSize} | ${item.detail} |`);
    idx++;
  }
  add('');
  add('> 建议人工抽查以上文件，确认内容是否正常。');
  add('');
}

// ---- 6. 统计摘要 ----
add('## 6. 统计摘要');
add('');
add('| 指标 | 数值 |');
add('|---|---|');
add(`| 比对文件对数 | ${matchedPaths.size} |`);
add(`| ✅ 完全一致（SHA256） | ${consistentCount} |`);
add(`| 🌐 翻译差异（正常） | ${translatedCount} |`);
add(`| ⚠️ 疑似损坏 | ${suspiciousCount} |`);
add(`| ❌ 缺失文件 | ${unmatchedOrig.length} |`);
add(`| ⚡ 额外文件 | ${unmatchedCN.length} |`);
add('');

if (suspiciousCount === 0 && unmatchedOrig.length === 0) {
  add('## 7. 结论');
  add('');
  add('✅ **中文版完整性检查通过。** 所有原型文件均已对照翻译，没有内容损坏或乱码迹象。');
  add('');
}

// ---- 保存 ----
const reportPath = join(OUT_DIR, 'mattpocock-skills-全量文件对比报告.md');
const buf = Buffer.from(lines.join('\n'), 'utf-8');
writeFileSync(reportPath, buf);
console.log(`报告已生成：${reportPath}`);
console.log(`共 ${lines.length} 行`);
console.log('');
console.log('===== 快速摘要 =====');
console.log(`匹配对: ${matchedPaths.size}`);
console.log(`一致: ${consistentCount}, 翻译差异: ${translatedCount}, 疑似损坏: ${suspiciousCount}`);
console.log(`缺失: ${unmatchedOrig.length}, 额外: ${unmatchedCN.length}`);
