import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASE = 'E:\\work\\sp\\JwikisSkills\\三方\\mattpocock-skills\\skills';
const OUT_DIR = 'E:\\work\\sp\\JwikisSkills\\三方\\temp';
const OUT_FILE = join(OUT_DIR, '原型技能目录清单.md');

mkdirSync(OUT_DIR, { recursive: true });

// Recursively collect directories relative to BASE
function collectDirs(dir, result) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const full = join(dir, e.name);
      const rel = relative(BASE, full);
      result.push(rel);
      collectDirs(full, result);
    }
  }
}

const allDirs = [];
collectDirs(BASE, allDirs);
allDirs.sort();

// Group by top-level category
const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
const lines = [];

lines.push('\uFEFF# 原型技能目录清单');
lines.push(`> 来源：${BASE}`);
lines.push(`> 生成时间：${now}`);
lines.push('');

lines.push('## 全部技能目录（按分类）');
lines.push('');

let prevCat = '';
const catCounts = {};
for (const d of allDirs) {
  const parts = d.split('\\');
  const cat = parts[0];
  if (cat !== prevCat) {
    lines.push(`### ${cat}`);
    prevCat = cat;
    catCounts[cat] = 0;
  }
  if (parts.length === 2) {
    lines.push(`- \`${d}\``);
    catCounts[cat]++;
  } else if (parts.length > 2) {
    lines.push(`  - \`${parts[parts.length - 1]}\`（子目录）`);
  }
}

lines.push('');
lines.push('## 统计');
lines.push('');
lines.push('| 分类 | Skill 数 |');
lines.push('|---|---|');
let total = 0;
for (const [cat, count] of Object.entries(catCounts)) {
  lines.push(`| ${cat} | ${count} |`);
  total += count;
}
lines.push(`| **合计** | **${total}** |`);

const buf = Buffer.from(lines.join('\n'), 'utf-8');
writeFileSync(OUT_FILE, buf);
console.log('Done:', OUT_FILE);
console.log('Lines:', lines.length);

// Also print to console
for (const l of lines) console.log(l);
