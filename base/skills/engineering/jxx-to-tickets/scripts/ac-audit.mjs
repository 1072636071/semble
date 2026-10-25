#!/usr/bin/env node
/**
 * ac-audit.mjs — 验收点（AC）机械校验。
 *
 * 只查形式，不判内容：编号连续性、验证方式标注、禁词、浏览器操作冒充机器证据、类别覆盖、豁免声明。
 * 内容判断归人和审查 agent。规范正文：jxx-to-tickets/references/acceptance-criteria.md
 *
 * 用法：node ac-audit.mjs <目录|单文件> [--strict] [--json]
 *   --strict  额外要求 map.md 存在可解析的 AC 覆盖矩阵，且「## 覆盖闸」节可解析（§八）
 *   --json    机器可读
 *
 * 退出码：0 = 过；1 = 有硬问题；2 = 没有工单类文件（预期 defer）；3 = 用法错误 / 路径不存在。
 *
 * 特殊处理：
 *   - 文件名 PRD.md：验收点按「草案」对待，覆盖与标注类问题降为软问题；但 PRD 有验收点节却零 AC 行 = 硬问题。
 *   - 「**AC 勾选区：**」之下的 AC 行是开工时的引用打卡（复制自验收标准），不参与编号唯一性与类别统计。
 *   - 跳过 reviews/ 目录与 map.md / MILESTONES.md / HUMAN-CHECK.md——审查报告引用 AC 行不算工单。
 */
import fs from 'node:fs';
import path from 'node:path';

const AC_LINE = /^\s*-\s*\[([ xX])\]\s*AC-(\d+)\s*(?:\[([^\]]+)\])?([\s\S]*)$/;
const VERIFY = /验证\s*[:：]\s*(机器|人工)\s+\S/;
const CHECKLIST_HEAD = /AC\s*勾选区/;
const DECL_HEAD = /AC\s*覆盖声明/;
const BANNED_WORDS = ['正确','正常','合理','良好','完整','友好','稳定','健壮','优化','改进','完善','支持','兼容','等等','若干','适当','尽可能','必要时','按需'];
const BANNED_PATTERNS = [{ re: /等(?=[。，；、)\s]|$)/, label: '等' }, { re: /[及和]\s*其他/, label: '及其他' }];
// 浏览器操作（截图 / 点页面 / 肉眼）不可复现、不可 grep，不构成机器证据（规范 §二 铁律 7）：
// 只查「验证:机器」后面的载荷——「验证:人工」里写截图取证是合法的。
const MACHINE_VERIFY = /验证\s*[:：]\s*机器\s+([^\n]*)/;
const BROWSER_EVIDENCE = ['截图', '抓图', '肉眼', '手动点', '手点', '点页面', '点开页面', '看一眼', '人工点击', '浏览器里看'];
// .jxx-tickets 是服务器工单投影（pull 覆盖写入），不是创作面：审它会误判，且本地补 AC 会被下次 pull 冲掉。
const SKIP_DIRS = new Set(['reviews', '.jxx-tickets', 'node_modules', '.git', '.temp']);
const SKIP_FILES = new Set(['map.md', 'milestones.md', 'human-check.md']);

function collectFiles(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name.toLowerCase())) walk(abs); continue; }
      if (!/\.md$/i.test(e.name)) continue;
      if (SKIP_FILES.has(e.name.toLowerCase())) continue;
      out.push(abs);
    }
  };
  walk(target);
  return out;
}

function isTicket(text) {
  return /^\s*-\s*\[[ xX]\]\s*AC-\d+/m.test(text) || /验收标准/.test(text) || /^\s*\*\*Status:\*\*/m.test(text);
}

function parseExemptions(lines) {
  const classes = new Set();
  let inDecl = false;
  for (const line of lines) {
    if (DECL_HEAD.test(line)) { inDecl = true; continue; }
    if (!inDecl) continue;
    if (/^\s*$/.test(line)) continue; // 声明块里允许空行（标题与条目之间常有一行）
    if (/^#{1,6}\s/.test(line)) { inDecl = false; continue; }
    const m = line.match(/[-*]\s*([^：:\n]{1,20}?)\s*[：:]\s*不适用/);
    if (m) { classes.add(m[1].trim()); continue; }
    inDecl = false; // 非列表行即声明块结束
  }
  return classes;
}

function auditTicket(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const issues = [];
  const acs = [];
  const isPrd = /^prd\.md$/i.test(path.basename(file));
  const strictLevel = isPrd ? 'soft' : 'hard';

  let inChecklist = false;
  lines.forEach((line, i) => {
    if (CHECKLIST_HEAD.test(line)) { inChecklist = true; return; }
    if (inChecklist && (/^#{1,6}\s/.test(line) || (/^\*\*[^*\n]{2,20}[：:]\*\*/.test(line) && !CHECKLIST_HEAD.test(line)))) inChecklist = false;
    const m = line.match(AC_LINE);
    if (!m) return;
    acs.push({ line: i + 1, no: Number(m[2]), checked: m[1].toLowerCase() === 'x', category: (m[3] || '').trim(), body: m[4] || '', inChecklist });
  });

  const real = acs.filter((a) => !a.inChecklist);

  if (!acs.length) {
    const hasSection = /验收点|验收标准/.test(text);
    if (isPrd) {
      issues.push({ level: hasSection ? 'hard' : 'soft', msg: hasSection ? 'PRD 有验收点节却没有任何 AC 行——按模板补草案，或写明「AC 落地：工单层」' : 'PRD 未写验收点（可接受：AC 由 jxx-to-tickets 落地，但需在发布说明写明）' });
    } else if (isTicket(text)) {
      issues.push({ level: 'hard', msg: '缺验收点：文件内没有任何 "- [ ] AC-<n>" 行' });
    }
    return { file, acs, issues, isPrd };
  }

  const seen = new Map();
  for (const ac of real) {
    if (seen.has(ac.no)) issues.push({ level: 'hard', line: ac.line, msg: 'AC 编号重复：AC-' + ac.no + '（首次在第 ' + seen.get(ac.no) + ' 行）' });
    else seen.set(ac.no, ac.line);
  }
  const maxNo = real.length ? Math.max(...real.map((a) => a.no)) : 0;
  for (let n = 1; n <= maxNo; n += 1) {
    if (!seen.has(n)) issues.push({ level: 'hard', msg: 'AC 编号不连续：缺 AC-' + n });
  }

  for (const ac of acs) {
    if (ac.inChecklist) {
      if (!ac.checked) issues.push({ level: 'soft', line: ac.line, msg: 'AC-' + ac.no + ' 勾选区仍未勾选（- [x] 才算完成）' });
      if (ac.body.trim().length < 6) issues.push({ level: 'soft', line: ac.line, msg: 'AC-' + ac.no + ' 勾选区缺证据（同一行追写 用例名 / 命令 + 退出码 / 文件:行）' });
      continue;
    }
    if (!ac.category) issues.push({ level: 'soft', line: ac.line, msg: 'AC-' + ac.no + ' 缺类别标签（[主路径] / [错误路径] / [回归] 等）' });
    if (!VERIFY.test(ac.body)) issues.push({ level: ac.inChecklist ? 'soft' : strictLevel, line: ac.line, msg: 'AC-' + ac.no + ' 缺验证方式或载荷（须写 验证:机器 <用例名|命令> 或 验证:人工 <HUMAN-CHECK 条目>）' });
    const mv = ac.body.match(MACHINE_VERIFY);
    if (mv) {
      const bad = BROWSER_EVIDENCE.filter((w) => mv[1].includes(w));
      if (bad.length) issues.push({ level: 'soft', line: ac.line, msg: 'AC-' + ac.no + ' 把浏览器操作当机器证据（' + bad.join(' / ') + '）——截图 / 点页面 / 肉眼不可复现，改写成组件测试断言 DOM / 文案 / 状态、e2e 用例或接口响应字段' });
    }
    const hit = new Set(BANNED_WORDS.filter((w) => ac.body.includes(w)));
    for (const p of BANNED_PATTERNS) if (p.re.test(ac.body)) hit.add(p.label);
    if (hit.size) issues.push({ level: 'soft', line: ac.line, msg: 'AC-' + ac.no + ' 命中禁词（' + [...hit].join(' / ') + '）——模糊措辞无法机械核对' });
  }

  const exempt = parseExemptions(lines);
  const categories = new Set(real.map((a) => a.category).filter(Boolean));
  const covered = (name) => [...categories].some((c) => c.includes(name)) || [...exempt].some((c) => c.includes(name));
  const totalCovered = categories.size + exempt.size;
  if (totalCovered < 3) {
    issues.push({ level: strictLevel, msg: '类别覆盖不足：AC ' + categories.size + ' 类 + 豁免 ' + exempt.size + ' 类（至少 3 类）' });
  }
  for (const must of ['回归', '负向']) {
    if (!covered(must)) issues.push({ level: strictLevel, msg: '缺 [' + must + ']：改代码的工单必须同时有 [回归]（既有行为保持原样）与 [负向]（不得出现的行为）；确无此项则写进 AC 覆盖声明「' + must + '：不适用——<理由>」' });
  }

  return { file, acs, real, issues, isPrd, categories, exempt };
}

function hasMatrix(dir) {
  const mapFile = path.join(dir, 'map.md');
  if (!fs.existsSync(mapFile)) return false;
  const text = fs.readFileSync(mapFile, 'utf8');
  if (!/AC 覆盖矩阵/.test(text)) return false;
  return /^\s*\|.*\|\s*(AC-\d+|无)/m.test(text) || /AC-\d+/.test(text);
}

// —— 覆盖闸（§八）：map.md 的「## 覆盖闸」节，三源逐条对到工单 AC ——
const COVERAGE_HEADING = /^#{1,6}\s*覆盖闸\s*$/;
const SECTION_HEADING = /^#{1,6}\s/;
const COVERAGE_COLUMNS = [
  { name: '源', test: (c) => c === '源' },
  { name: '条目', test: (c) => /^条目/.test(c) },
  { name: '工单', test: (c) => c === '工单' },
  { name: 'AC', test: (c) => /^ac$/i.test(c) },
  { name: '判定', test: (c) => c === '判定' },
];

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function isDivider(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function isBlankCell(value) {
  const v = (value || '').trim();
  return v === '' || v === '—' || v === '-';
}

// 判定按前缀判合法，允许带附注；容错 `gap -> 已补`。返回 null = 不合法，'gap' = 裸缺口。
function classifyVerdict(cell) {
  const norm = (cell || '').replace(/\s+/g, '').replace(/->/g, '→');
  if (!norm) return 'empty';
  const at = (prefix) => {
    if (!norm.startsWith(prefix)) return false;
    const next = norm.slice(prefix.length, prefix.length + 1);
    return next === '' || /[（(—\-:：]/.test(next);
  };
  if (norm.startsWith('gap')) {
    if (at('gap→已补')) return 'gap→已补';
    return 'gap';
  }
  if (at('covered')) return 'covered';
  if (at('rejected')) return 'rejected';
  if (at('defer')) return 'defer';
  return null;
}

function auditCoverageGate(mapFile) {
  const issues = [];
  const lines = fs.readFileSync(mapFile, 'utf8').split(/\r?\n/);
  const head = lines.findIndex((line) => COVERAGE_HEADING.test(line));
  if (head < 0) {
    issues.push({ level: 'hard', msg: '缺覆盖闸：map.md 应有「## 覆盖闸」节，把用户诉求 / 决策 / PRD 逐条对到工单 AC，判定四选一' });
    return issues;
  }
  let end = lines.length;
  for (let i = head + 1; i < lines.length; i += 1) {
    if (SECTION_HEADING.test(lines[i])) { end = i; break; }
  }
  const tableRows = [];
  for (let i = head + 1; i < end; i += 1) {
    if (/^\s*\|/.test(lines[i])) tableRows.push({ no: i + 1, cells: splitRow(lines[i]) });
  }
  if (!tableRows.length) {
    issues.push({ level: 'hard', line: head + 1, msg: '覆盖闸节里解析不出表格：应有表头 源 / 条目（原文摘录）/ 工单 / AC / 判定' });
    return issues;
  }
  const cols = {};
  const missingCols = [];
  for (const col of COVERAGE_COLUMNS) {
    const idx = tableRows[0].cells.findIndex((c) => col.test(c));
    if (idx < 0) missingCols.push(col.name);
    else cols[col.name] = idx;
  }
  if (missingCols.length) {
    issues.push({ level: 'hard', line: tableRows[0].no, msg: '覆盖闸表头缺列：' + missingCols.join(' / ') + '（五列：源 / 条目 / 工单 / AC / 判定）' });
    return issues;
  }
  const dataRows = tableRows.slice(1).filter((r) => !isDivider(r.cells));
  for (const row of dataRows) {
    const cell = (name) => (row.cells[cols[name]] || '').trim();
    const raw = cell('判定');
    const kind = classifyVerdict(raw);
    if (kind === 'empty') {
      issues.push({ level: 'hard', line: row.no, msg: '覆盖闸第 ' + row.no + ' 行判定为空——每行必须给判定（covered / gap→已补 / rejected / defer）' });
      continue;
    }
    if (kind === 'gap') {
      issues.push({ level: 'hard', line: row.no, msg: '覆盖闸第 ' + row.no + ' 行是未处置的 gap——补工单或补 AC 后改判 gap→已补；不做由用户给 rejected，延后写 defer 去向' });
      continue;
    }
    if (!kind) {
      issues.push({ level: 'hard', line: row.no, msg: '覆盖闸第 ' + row.no + ' 行判定「' + raw + '」不合法——只有 covered / gap→已补 / rejected / defer 四种，没有第五种' });
      continue;
    }
    if (kind === 'covered' || kind === 'gap→已补') {
      const missing = ['工单', 'AC'].filter((name) => isBlankCell(cell(name)));
      if (missing.length) {
        issues.push({ level: 'hard', line: row.no, msg: '覆盖闸第 ' + row.no + ' 行判定 ' + kind + ' 但 ' + missing.join(' / ') + ' 列为空——必须给工单编号 + AC 编号（仅相关不算覆盖）' });
      }
      continue;
    }
    if (!/[（(][^）)]+[）)]/.test(raw)) {
      issues.push({
        level: 'soft',
        line: row.no,
        msg: kind === 'rejected'
          ? '覆盖闸第 ' + row.no + ' 行判定 rejected 缺附注——必须写用户确认原话 + 轮次（rejected 只能由用户给）'
          : '覆盖闸第 ' + row.no + ' 行判定 defer 缺附注——必须写去向文件 / 里程碑编号（无去向按 gap 计）',
      });
    }
  }
  return issues;
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0].startsWith('-')) {
    console.error('用法：node ac-audit.mjs <目录|单文件> [--strict] [--json]');
    process.exit(3);
  }
  const target = path.resolve(argv[0]);
  if (!fs.existsSync(target)) {
    console.error('找不到：' + target);
    process.exit(3);
  }
  const strict = argv.includes('--strict');
  const asJson = argv.includes('--json');
  const files = collectFiles(target).filter((f) => isTicket(fs.readFileSync(f, 'utf8')));
  if (!files.length) {
    console.error('没有工单类文件（含 AC 行 / 验收标准段 / Status 行）：' + target);
    process.exit(2);
  }
  const results = files.map(auditTicket);
  if (strict) {
    const dir = fs.statSync(target).isDirectory() ? target : path.dirname(target);
    const mapFile = path.join(dir, 'map.md');
    if (!hasMatrix(dir)) {
      results.push({ file: mapFile, acs: [], real: [], issues: [{ level: 'hard', msg: '缺 AC 覆盖矩阵：map.md 应有「## AC 覆盖矩阵」节，且行内出现 AC 编号（用户故事 ↔ 工单 ↔ AC）' }] });
    }
    if (fs.existsSync(mapFile)) {
      const gate = auditCoverageGate(mapFile);
      if (gate.length) results.push({ file: mapFile, acs: [], real: [], issues: gate });
    }
  }
  const hard = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'hard').length, 0);
  const soft = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'soft').length, 0);
  if (asJson) {
    console.log(JSON.stringify({ target, files: results.map((r) => ({ file: path.relative(process.cwd(), r.file), acs: (r.real || r.acs).length, issues: r.issues })), hard, soft }, null, 2));
  } else {
    for (const r of results) {
      const rel = path.relative(process.cwd(), r.file);
      const mark = r.issues.some((i) => i.level === 'hard') ? '✗' : r.issues.length ? '!' : '✓';
      console.log(mark + ' ' + rel + '  AC×' + ((r.real || r.acs).length));
      for (const i of r.issues) {
        const loc = i.line ? ':' + i.line : '';
        console.log('   ' + (i.level === 'hard' ? '✗' : '·') + ' ' + rel + loc + ' ' + i.msg);
      }
    }
    console.log('');
    console.log('合计：' + files.length + ' 个工单，硬问题 ' + hard + '，软问题 ' + soft);
  }
  process.exit(hard > 0 ? 1 : 0);
}

main();
