import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const BOM = '\uFEFF';
const OUT_DIR = 'E:\\work\\sp\\JwikisSkills\\三方\\temp';
const ORIG = 'E:\\work\\sp\\JwikisSkills\\三方\\mattpocock-skills\\skills';
const CN   = 'E:\\work\\sp\\JwikisSkills\\三方\\mattpocock-skills-A\\skills';

mkdirSync(OUT_DIR, { recursive: true });

// === 递归扫描目录，返回 { skillName: { fileRelPath: size } }
function scanSkills(rootPath) {
  const categories = {};
  const dirs = readdirSync(rootPath, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const catDir of dirs) {
    const catName = catDir.name;
    const skills = {};
    const catPath = join(rootPath, catName);
    const skillDirs = readdirSync(catPath, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const skillDir of skillDirs) {
      const skillName = skillDir.name;
      const files = {};
      const skillPath = join(catPath, skillName);
      scanFiles(skillPath, '', files);
      skills[skillName] = files;
    }
    categories[catName] = skills;
  }
  return categories;
}

function scanFiles(dir, prefix, result) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = prefix ? `${prefix}\\${e.name}` : e.name;
    if (e.isFile()) {
      result[rel] = statSync(full).size;
    } else if (e.isDirectory()) {
      scanFiles(full, rel, result);
    }
  }
}

// 中文版根目录文件
function scanRootFiles(rootPath) {
  return readdirSync(rootPath, { withFileTypes: true })
    .filter(e => e.isFile())
    .map(e => e.name);
}

const origCategories = scanSkills(ORIG);
const cnCategories = scanSkills(CN);
const cnRootFiles = scanRootFiles(CN);

// === 构建报告 ===
const lines = [];

function add(s) { lines.push(s); }

add(BOM + '# Matt Pocock Skills 中文版 vs 原型 缺失对比报告');
add(`生成时间：${new Date().toISOString().replace('T', ' ').substring(0, 19)}`);
add('');

const origTotalSkills = Object.values(origCategories).reduce((s, c) => s + Object.keys(c).length, 0);
const cnTotalSkills = Object.values(cnCategories).reduce((s, c) => s + Object.keys(c).length, 0);

add('## 1. 概要');
add('');
add('| 项目 | 数量 |');
add('|------|------|');
add(`| 原型总 Skill 数 | ${origTotalSkills} |`);
add(`| 中文版总 Skill 数 | ${cnTotalSkills} |`);
add(`| 原型分类数 | ${Object.keys(origCategories).length} |`);
add(`| 中文版分类数 | ${Object.keys(cnCategories).length} |`);
add('');

// === 2. 分类级别对比 ===
add('## 2. 分类级别对比');
add('');
const allCats = [...new Set([...Object.keys(origCategories), ...Object.keys(cnCategories)])].sort();
for (const cat of allCats) {
  const inOrig = origCategories[cat];
  const inCN = cnCategories[cat];
  if (inOrig && !inCN) {
    add(`- ❌ 缺失整个分类：\`${cat}\`（原型 ${Object.keys(inOrig).length} 个 Skill，中文版无此分类）`);
  } else if (inCN && !inOrig) {
    add(`- ⚠️ 中文版额外分类：\`${cat}\`（原型无此分类）`);
  } else {
    add(`- ✅ 分类 \`${cat}\`：原型 ${Object.keys(inOrig).length} 个 / 中文版 ${Object.keys(inCN).length} 个`);
  }
}
add('');

// === 3. Skill 映射关系 ===
add('## 3. Skill 映射关系（中文版 jxx- 前缀 -> 原型名称）');
add('');
add('| 中文版 Skill | 原型 Skill | 分类 |');
add('|---|---|---|');

const mapping = {};
const unmappedOrig = [];
const unmappedCN = [];

for (const cat of Object.keys(origCategories).sort()) {
  for (const origSkill of Object.keys(origCategories[cat]).sort()) {
    const expectedCN = `jxx-${origSkill}`;
    const cnExists = cnCategories[cat] && cnCategories[cat][expectedCN];
    if (cnExists) {
      mapping[expectedCN] = { origName: origSkill, category: cat };
      add(`| \`${expectedCN}\` | \`${origSkill}\` | ${cat} |`);
    } else {
      unmappedOrig.push({ name: origSkill, category: cat });
      add(`| ❌ 缺失 | \`${origSkill}\` | ${cat} |`);
    }
  }
}

// 中文版多出的
for (const cat of Object.keys(cnCategories).sort()) {
  for (const cnSkill of Object.keys(cnCategories[cat]).sort()) {
    if (!mapping[cnSkill]) {
      unmappedCN.push({ name: cnSkill, category: cat });
    }
  }
}
add('');

if (unmappedCN.length > 0) {
  add('### ⚠️ 中文版多出的 Skill（原型中不存在对应项）');
  add('');
  for (const u of unmappedCN) {
    add(`- \`${u.name}\`（分类：${u.category}）`);
  }
  add('');
}

// === 4. Skill 级别文件对比 ===
add('## 4. Skill 级别文件缺失详情');
add('');

for (const cat of Object.keys(origCategories).sort()) {
  add(`### 分类：${cat}`);
  add('');
  let catHasContent = false;
  const cnCatSkills = cnCategories[cat] || {};

  for (const origSkill of Object.keys(origCategories[cat]).sort()) {
    const origFiles = origCategories[cat][origSkill];
    const expectedCN = `jxx-${origSkill}`;
    const cnFiles = cnCatSkills[expectedCN] || {};

    if (Object.keys(cnFiles).length === 0) {
      // 整 Skill 缺失
      add(`#### ❌ ${origSkill} — 整 Skill 缺失（原型未翻译）`);
      add('');
      add(`原型文件数：${Object.keys(origFiles).length}`);
      const sortedFiles = Object.keys(origFiles).sort();
      for (const f of sortedFiles) {
        add(`  - \`${f}\` (${origFiles[f]} bytes)`);
      }
      add('');
      catHasContent = true;
    } else {
      // 对比文件
      const missingFiles = [];
      const extraFiles = [];
      const sizeDiffs = [];

      for (const origFile of Object.keys(origFiles).sort()) {
        if (!(origFile in cnFiles)) {
          missingFiles.push(origFile);
        }
      }

      for (const cnFile of Object.keys(cnFiles).sort()) {
        if (!(cnFile in origFiles)) {
          extraFiles.push(cnFile);
        } else if (cnFiles[cnFile] !== origFiles[cnFile]) {
          sizeDiffs.push(`${cnFile} (原型 ${origFiles[cnFile]} -> 中文版 ${cnFiles[cnFile]} bytes)`);
        }
      }

      if (missingFiles.length > 0 || extraFiles.length > 0) {
        add(`#### ${origSkill} ↔ ${expectedCN}`);
        add('');

        if (missingFiles.length > 0) {
          add('原型有但中文版缺失的文件：');
          for (const f of missingFiles) {
            add(`- ❌ \`${f}\` (${origFiles[f]} bytes)`);
          }
          add('');
          catHasContent = true;
        }

        if (extraFiles.length > 0) {
          add('中文版额外多出的文件：');
          for (const f of extraFiles) {
            add(`- ⚡ \`${f}\` (${cnFiles[f]} bytes)`);
          }
          add('');
        }

        if (sizeDiffs.length > 0) {
          add('文件大小不一致：');
          for (const d of sizeDiffs) {
            add(`- 🔶 ${d}`);
          }
          add('');
        }
      }
    }
  }

  if (!catHasContent) {
    add('✅ 此分类所有 Skill 文件完全一致（不含中文版额外文件如 CHANGELOG/README/LICENSE/evals 等）');
    add('');
  }
}

// === 5. 中文版根目录额外文件 ===
add('## 5. 中文版根目录额外文件');
add('');
if (cnRootFiles.length > 0) {
  for (const f of cnRootFiles) {
    add(`- 📄 \`${f}\``);
  }
} else {
  add('无');
}
add('');

// === 6. 统计摘要 ===
let totalMissingSkills = 0;
let totalMissingFiles = 0;

for (const cat of Object.keys(origCategories).sort()) {
  for (const origSkill of Object.keys(origCategories[cat]).sort()) {
    const expectedCN = `jxx-${origSkill}`;
    const cnExists = cnCategories[cat] && cnCategories[cat][expectedCN];
    if (!cnExists) {
      totalMissingSkills++;
      totalMissingFiles += Object.keys(origCategories[cat][origSkill]).length;
    } else {
      for (const origFile of Object.keys(origCategories[cat][origSkill])) {
        if (!cnCategories[cat][expectedCN][origFile]) {
          totalMissingFiles++;
        }
      }
    }
  }
}

const missingCatCount = Object.keys(origCategories).filter(c => !cnCategories[c]).length;

add('## 6. 统计摘要');
add('');
add('| 指标 | 数值 |');
add('|---|---|');
add(`| 完全缺失的 Skill 数 | ${totalMissingSkills} |`);
add(`| 共缺失文件数（含整 Skill 内文件） | ${totalMissingFiles} |`);
add(`| 完全缺失的分类数 | ${missingCatCount} |`);
add(`| 已翻译的 Skill 数 | ${origTotalSkills - totalMissingSkills} / ${origTotalSkills} |`);

// 保存
const reportPath = join(OUT_DIR, 'mattpocock-skills-缺失对比报告.md');
const buf = Buffer.from(lines.join('\n'), 'utf-8');
writeFileSync(reportPath, buf);
console.log(`报告已生成：${reportPath}`);
console.log(`${lines.length} 行总计`);
