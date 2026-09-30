#!/usr/bin/env node
// jxx-ticket-board 确定性脚本：init / board / html / ledger / verify / new-card / add-wt / rm-wt
// 零依赖。协议真源是 control/PROTOCOL.md；账本文法 `move <卡id> <from>-><to>` 被 verify 回放使用。
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATES = ['inbox', 'claimed', 'review', 'done', 'blocked'];
// held = 领导者暂缓泳道（control/held/，worker 不可见）：依赖未就绪的新卡投进这里，依赖卡归档 done 后释放回 inbox
const HELD = 'held';

const arg = (argv, name) => {
  const eq = argv.find(a => a === `--${name}=` || a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const flag = (argv, name) => argv.includes(`--${name}`);
const die = (msg, code = 1) => { console.error(`board: ${msg}`); process.exit(code); };
const git = (cwd, cmd) => execSync(`git ${cmd}`, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function localIso() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}

function needWs(root) {
  const metaFile = path.join(root, 'control', 'workspace.json');
  if (!fs.existsSync(metaFile)) die(`--root ${root} 下没有 control/workspace.json，先跑 init`);
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  meta.repoPath = meta.repoPath || path.join(root, 'repo');
  return meta;
}

function cardsDir(root, state) {
  return state === HELD
    ? path.join(root, 'control', 'held')
    : path.join(root, 'control', 'cards', state);
}
function listCards(root, state) {
  const d = cardsDir(root, state);
  return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.md')).sort() : [];
}
// All lanes including held, for scanBoard / verify / cardPath / dependency resolution.
const LANES = [...STATES, HELD];

// ---------- init ----------
function cmdInit(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const repoUrl = arg(argv, 'repo') || die('缺少 --repo <git-url>');
  const base = arg(argv, 'branch') || 'main';
  const repoDir = path.resolve(arg(argv, 'repo-dir') || path.join(root, 'repo'));
  fs.mkdirSync(root, { recursive: true });

  const actions = [];
  if (fs.existsSync(path.join(repoDir, '.git'))) {
    actions.push(['kept', `${repoDir} — 已有权威仓库，未动`]);
  } else if (repoDir === path.join(root, 'repo')) {
    fs.mkdirSync(repoDir, { recursive: true });
    try { git(root, `clone "${repoUrl}" repo`); } catch (e) {
      die(`clone 失败：${e.stderr?.toString().split('\n')[0] || e.message}（clone 半截目录已保留，修复后重跑会报 kept，可手动删除 repo/ 重试）`);
    }
    actions.push(['created', `repo/ — clone 自 ${repoUrl}`]);
  } else {
    die(`--repo-dir ${repoDir} 不是 git 仓库；指定权威工作区路径，或省略本参数让 init 自建 repo/`);
  }
  try { git(repoDir, `rev-parse --verify ${base}`) || git(repoDir, `rev-parse ${base}`); }
  catch { die(`${repoDir} 上不存在基准分支 ${base}，用 --branch 指定正确分支`); }

  fs.mkdirSync(path.join(root, 'wt'), { recursive: true });
  for (const s of STATES) fs.mkdirSync(path.join(root, 'control', 'cards', s), { recursive: true });
  fs.mkdirSync(path.join(root, 'control', 'starter'), { recursive: true });

  const render = (file) => fs.readFileSync(path.join(SKILL_DIR, 'assets', file), 'utf8')
    .replaceAll('{{ROOT}}', root).replaceAll('{{REPO_URL}}', repoUrl)
    .replaceAll('{{REPO_PATH}}', repoDir)
    .replaceAll('{{BASE_BRANCH}}', base).replaceAll('{{SKILL_DIR}}', SKILL_DIR.replace(/\\/g, '\\\\'));
  const put = (dest, content) => {
    if (fs.existsSync(dest)) { actions.push(['kept', path.relative(root, dest)]); return; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    actions.push(['created', path.relative(root, dest)]);
  };
  put(path.join(root, 'control', 'PROTOCOL.md'), render('PROTOCOL.tmpl.md'));
  put(path.join(root, 'control', 'CARD-TEMPLATE.md'), render('CARD-TEMPLATE.tmpl.md'));
  put(path.join(root, 'control', 'starter', 'dev.md'), render('starter-dev.tmpl.md'));
  put(path.join(root, 'control', 'starter', 'merger.md'), render('starter-merger.tmpl.md'));
  put(path.join(root, 'control', 'starter', 'reviewer.md'), render('starter-reviewer.tmpl.md'));
  put(path.join(root, 'control', 'starter', 'auto.md'), render('starter-auto.tmpl.md'));
  put(path.join(root, 'control', 'ledger.md'),
    `# 领导者账本（只追加，一行一动作）\n\n| 时间 | 角色 | 动作 | 对象 | 理由 |\n|---|---|---|---|---|\n`);
  put(path.join(root, 'control', 'workspace.json'),
    JSON.stringify({ root, repoUrl, repoPath: repoDir, baseBranch: base, createdAt: localIso() }, null, 2));

  for (const [act, f] of actions) console.log(`  [${act}] ${f}`);
  autoHtml(root);
  console.log('init: 完成。worker 启动提示词在 control/starter/，协议在 control/PROTOCOL.md。');
}

// ---------- card fields ----------
// 字段值一律剥掉两侧的引号/反引号：2026-09-30 复盘——正文里写「- PRD: 反引号路径反引号」会被当卡头字段，
// verify 于是报「PRD 指针不存在」的假 MISMATCH。另：PRD 只认以 .md 结尾的值，模板占位串与散文提及一律不作数。
function cardFields(body) {
  const b = body.replace(/\r/g, '');
  const clean = v => v.replace(/^[\s`"']+/, '').replace(/[\s`"']+$/, '').trim();
  const f = k => clean((b.match(new RegExp('^- ' + k + ':\\s*(.+)\\s*$', 'm')) || [])[1] || '');
  const prdRaw = f('PRD');
  return { title: f('标题'), level: f('难度'), model: f('模型档位'), by: f('领取者'),
    prd: /\.md$/i.test(prdRaw) ? prdRaw : '', branch: f('分支'), wt: f('worktree'), deps: f('依赖') };
}
function scanBoard(root) {
  return LANES.map(s => ({ state: s, cards: listCards(root, s).map(c => {
    const body = fs.readFileSync(path.join(cardsDir(root, s), c), 'utf8');
    const id = c.replace(/\.md$/, '');
    return { id, merge: /^merge-/.test(id), wtExists: fs.existsSync(path.join(root, 'wt', id)), ...cardFields(body) };
  }) }));
}
// 依赖闸门口径：只认依赖行里写全卡 id 的依赖（如 69-03-gateway-refresh-and-proxy-leg）；
// 该卡已归档 done 才算就绪；简写（"01"）、裸编号（"69-03"）与散文描述不参与判定；
// 依赖行以「无」开头（含"无——软引用/联动说明"这类散文）视为无硬依赖。merge 卡豁免——它在开发卡过审后投出。
function pendingDeps(root, depsLine, selfId) {
  if (!depsLine || /^无/.test(depsLine.trim()) || /^merge-/.test(selfId)) return [];
  const known = new Set();
  for (const s of LANES) for (const c of listCards(root, s)) known.add(c.replace(/\.md$/, ''));
  const doneIds = new Set(listCards(root, 'done').map(c => c.replace(/\.md$/, '')));
  return [...new Set((depsLine.match(/\d+-[a-z0-9][a-z0-9-]*/g) || []))]
    .filter(t => t !== selfId && known.has(t) && !doneIds.has(t));
}

// ---------- board ----------
function cmdBoard(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const showAll = flag(argv, 'all');
  for (const col of scanBoard(root)) {
    if (col.state === 'held' && !col.cards.length) continue;
    console.log(`\n== ${col.state === 'held' ? 'held（暂缓·等依赖，worker 不可领）' : col.state} (${col.cards.length}) ==`);
    // done 泳道只报计数：历史无限增长（2026-09-30 时 254 张，全量打印一次约 12k token）。
    // 逐卡明细用 --all，或直接看 control/board.html。
    if (col.state === 'done' && !showAll) {
      if (col.cards.length) console.log(`  （${col.cards.length} 张已归档，明细见 control/board.html 或加 --all）`);
      continue;
    }
    for (const c of col.cards) {
      const pend = (col.state === 'inbox' || col.state === HELD) ? pendingDeps(root, c.deps, c.id) : [];
      console.log(`  [${c.level || '?'}] ${c.id}.md${c.title ? ` — ${c.title}` : ''}${c.by ? `  [${c.by}]` : ''}${pend.length ? `  ⛓ 等依赖: ${pend.join(', ')}` : ''}`);
    }
  }
}

// ---------- html ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fileHref = p => /^[A-Za-z]:[\\/]/.test(p) ? 'file:///' + p.replace(/\\/g, '/') : '';
const LV_COLOR = { L1: '#6b7280', L2: '#2563eb', L3: '#d97706', L4: '#dc2626' };
const STATE_LABEL = { inbox: '待领取 inbox', claimed: '开发中 claimed', review: '待终审 review', done: '已完成 done', blocked: '受阻 blocked', held: '暂缓·等依赖（不可领）' };

function renderHtml(root, meta, cols, starters) {
  const shown = cols.filter(c => c.state !== 'done');
  const total = shown.reduce((n, c) => n + c.cards.length, 0) - (shown.find(c => c.state === HELD)?.cards.length || 0);
  const doneCount = (cols.find(c => c.state === 'done') || { cards: [] }).cards.length;
  const prompts = {};
  const cardsHtml = c => {
    const prd = c.prd && fileHref(c.prd) ? `<a href="${esc(fileHref(c.prd))}" target="_blank" rel="noopener" title="${esc(c.prd)}">PRD</a>` : '';
    const wtLine = c.wt ? `<div class="wt">📁 ${esc(c.wt)} ${c.wtExists ? '<span class="ok">已预开</span>' : '<span class="no">未创建</span>'}</div>` : '';
    const starter = starters[c.merge ? 'merger' : 'dev'] || '';
    prompts[c.id] = starter + `\n\n---\n本次指定：优先领取卡片 \`${c.id}\`（难度 ${c.level || '?'}）。` +
      (c.wtExists ? `工作区已预开：${c.wt}，领卡 move 成功后直接进入装依赖开工。` : `领卡后按协议 §1 用 add-wt 开辟工作区。`);
    const pend = (c.state === 'inbox' || c.state === HELD) ? pendingDeps(root, c.deps, c.id) : [];
    const depNote = pend.length ? `<div class="dep">⛓ 等依赖未归档: ${esc(pend.join('、'))}</div>` : '';
    const btn = c.state === HELD
      ? '<div class="m">⏸ 暂缓中：依赖归档后由领导者 mv 回 inbox 释放</div>'
      : '<button class="cp" data-id="' + esc(c.id) + '">📋 复制启动提示词</button>';
    return `<div class="card${c.merge ? ' merge' : ''}${c.state === HELD ? ' heldc' : ''}">
<span class="lv" style="background:${LV_COLOR[c.level] || '#6b7280'}">${esc(c.level || '?')}</span>
<b>${esc(c.id)}</b>${c.merge ? '<span class="tagm">合并</span>' : ''}
<div class="t">${esc(c.title || '')}</div>
${wtLine}${depNote}
<div class="m">${c.by ? `👤 ${esc(c.by)}　` : ''}${c.deps && c.deps !== '无' ? `⛓ ${esc(c.deps)}　` : ''}${prd}${c.branch ? `　⎇ ${esc(c.branch)}` : ''}</div>
${btn}
</div>`;
  };
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="5"><title>工单公告板 · ${esc(path.basename(root))}</title>
<style>
body{font:14px/1.5 "Segoe UI",system-ui,sans-serif;background:#0f1115;color:#e5e7eb;margin:16px}
header{display:flex;gap:16px;align-items:baseline;margin-bottom:12px;flex-wrap:wrap}
header h1{font-size:18px;margin:0}header .info{color:#9ca3af;font-size:12px}
.cols{display:grid;grid-template-columns:repeat(var(--nc,4),1fr);gap:10px;align-items:start}
.col{background:#161a22;border-radius:10px;padding:10px;min-height:120px}
.col h2{font-size:13px;margin:0 0 8px;color:#9ca3af;text-transform:uppercase}
.card{background:#1e2430;border:1px solid #2b3342;border-radius:8px;padding:8px 10px;margin-bottom:8px}
.card.merge{border-color:#7c3aed55}
.lv{color:#fff;border-radius:4px;font-size:11px;padding:1px 6px;margin-right:6px}
.tagm{color:#a78bfa;font-size:11px;margin-left:6px}
.t{margin:2px 0;color:#d1d5db}.m{color:#8b94a3;font-size:12px;word-break:break-all}
.wt{color:#8b94a3;font-size:11px;word-break:break-all;margin:2px 0}
.ok{color:#34d399;font-size:11px}.no{color:#6b7280;font-size:11px}
.dep{color:#f59e0b;font-size:12px;margin:2px 0}
.card.heldc{opacity:.75;border-style:dashed}
.cp{margin-top:6px;background:#2b3342;color:#cbd5e1;border:1px solid #3b4356;border-radius:6px;font-size:12px;padding:3px 8px;cursor:pointer}
.cp:hover{background:#3b4356}.cp.done{background:#064e3b;border-color:#34d399;color:#6ee7b7}
a{color:#60a5fa;text-decoration:none}
.nav{margin-left:4px;font-size:13px;color:#60a5fa;text-decoration:none;border:1px solid #2b3342;padding:4px 10px;border-radius:8px;background:#161a22}
.nav:hover{background:#1e2430}
footer{margin-top:10px;color:#6b7280;font-size:12px}
</style></head><body>
<header><h1>工单公告板</h1><a class="nav" href="prd.html" target="_blank" rel="noopener">PRD 看板 →</a><a class="nav" href="human.html" target="_blank" rel="noopener">人工待办面板 →</a><span class="info">${esc(root)} · 权威仓 ${esc(meta.repoPath || '')} · 基准 ${esc(meta.baseBranch)} · ${total} 张在办（已完成 ${doneCount}，看板不显示）· 生成于 ${localIso()} · 每 5s 自动刷新</span></header>
<div class="cols" style="--nc:${Math.max(shown.length, 4)}">${shown.map(c => `<div class="col"><h2>${STATE_LABEL[c.state]} (${c.cards.length})</h2>${c.cards.map(x => cardsHtml({ ...x, state: c.state })).join('')}</div>`).join('')}</div>
<footer>协议真源 control/PROTOCOL.md · 领导者账本 control/ledger.md · 复制按钮=对应角色 starter 提示词+指定卡号，贴给新拉起会话即可开工 · 工单级执行=/jxx-implement 领卡推进；整份 PRD 一次交付请用 PRD 看板的整轨提示词（/jxx-implement-spec）</footer>
<script>const PROMPTS=${JSON.stringify(prompts).replace(/</g, '\\u003c')};
document.querySelectorAll('.cp').forEach(b=>b.addEventListener('click',async()=>{
const t=PROMPTS[b.dataset.id]||'';
try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
b.textContent='✔ 已复制，去粘贴给新会话';b.classList.add('done');
setTimeout(()=>{b.textContent='📋 复制启动提示词';b.classList.remove('done')},2500);
}));</script>
</body></html>`;
}

// ---------- 人工待办面板（control/human.html，与 board.html 互链） ----------
function walkMd(dir, out) {
  out = out || [];
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '.git' && e.name !== 'node_modules') walkMd(p, out); }
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}
function parseHumanTodo(md) {
  let b; try { b = fs.readFileSync(md, 'utf8').replace(/\r/g, ''); } catch { return null; }
  const status = (b.match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1] || '';
  if (!/^ready-for-human$/i.test(status)) return null;
  const title = (((b.match(/^ {0,3}#\s+(.+?)\s*$/m) || [])[1] || path.basename(md, '.md')).trim()).replace(/^\d{1,3}\s*[·・.、-]\s*/, '');
  const blocked = ((b.match(/\*\*Blocked by:\*\*\s*(.+)/) || [])[1] || '').trim();
  // 勾选项优先取「验收标准」小节区间，找不到小节则退回全文
  let seg = b;
  const acc = b.match(/^ {0,3}#{1,6}[^\n]*验收[^\n]*\n[\s\S]*?(?=\n {0,3}#{1,6}\s|$)/m);
  if (acc) seg = acc[0];
  const boxes = [...seg.matchAll(/^ *- *\[[ xX]\] *(.+?) *$/gm)];
  const checked = [...seg.matchAll(/^ *- *\[([ xX])\] *(.+?) *$/gm)];
  const open = checked.filter(x => x[1] === ' ').map(x => x[2].trim());
  const done = checked.filter(x => x[1].toLowerCase() === 'x').length;
  // 定位编码：.scratch/<PRD>/issues/<NN>-<slug>.md（或直接在 .scratch 下）
  const rel = md.replace(/\\/g, '/');
  const g = rel.match(/\.scratch\/([^/]+)\/(?:[^/]+\/)?(\d+)-([^/]+)\.md$/i);
  const prdDir = g ? g[1] : ((rel.match(/\.scratch\/([^/]+)\//) || [])[1] || '');
  const prdNum = (prdDir.match(/^(\d+)/) || [])[1] || prdDir;
  const num = g ? g[2] : '';
  const slug = ((g ? g[3] : path.basename(md, '.md')) || '').replace(/-/g, ' ');
  return { code: num ? `${prdNum}·${num}` : (prdNum || path.basename(md, '.md')), prdDir, slug, title,
    blocked: blocked && blocked !== '无' ? blocked : '', file: md, href: fileHref(md),
    done, total: checked.length, open };
}
function scanHumanTodos(repoPath) {
  return walkMd(path.join(repoPath, '.scratch')).map(parseHumanTodo).filter(Boolean)
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
}
const HUMAN_STYLE = 'body{font:14px/1.6 "Segoe UI",system-ui,sans-serif;background:#0f1115;color:#e5e7eb;margin:0;padding:24px 16px}'
  + 'header{max-width:920px;margin:0 auto 18px}h1{font-size:20px;margin:0;display:inline-block}'
  + '.nav{margin-left:12px;font-size:13px;color:#60a5fa;text-decoration:none;border:1px solid #2b3342;padding:4px 10px;border-radius:8px;background:#161a22}'
  + '.nav:hover{background:#1e2430}.info{color:#9ca3af;font-size:12px;margin-top:6px}'
  + '.list{max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:12px}'
  + '.hcard{display:block;background:#161a22;border:1px solid #232b38;border-radius:12px;padding:14px 16px;text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}'
  + '.hcard:hover{border-color:#3b82f6;transform:translateY(-1px)}'
  + '.hcode{display:inline-block;background:#b45309;color:#fff;border-radius:6px;font-size:12px;padding:1px 8px;margin-right:8px}.htitle{font-size:15px;color:#f3f4f6;font-weight:700}'
  + '.prog{float:right;font-size:12px;color:#9ca3af;background:#1e2430;border-radius:999px;padding:2px 10px}'
  + '.hsub{color:#8b94a3;font-size:12px;margin-top:6px;word-break:break-all}.hsub .open{color:#60a5fa}'
  + '.act{margin-top:10px;background:#12151c;border-left:3px solid #d97706;border-radius:0 8px 8px 0;padding:8px 12px}'
  + '.act.human-ok{border-left-color:#34d399}.act-h{font-size:12px;color:#d97706;font-weight:600;margin-bottom:4px}'
  + '.act.human-ok .act-h{color:#34d399}.act ul{margin:0;padding-left:18px}.act li{color:#d1d5db;font-size:13px;margin:2px 0}'
  + '.act .note{color:#9ca3af;font-size:13px}.empty{max-width:920px;margin:0 auto;background:#161a22;border:1px solid #232b38;border-radius:12px;padding:40px;text-align:center;color:#9ca3af}'
  + '.cp{margin-top:10px;background:#2b3342;color:#cbd5e1;border:1px solid #3b4356;border-radius:6px;font-size:12px;padding:4px 10px;cursor:pointer}.cp:hover{background:#3b4356}.cp.done{background:#064e3b;border-color:#34d399;color:#6ee7b7}'
  + 'a.htitle{text-decoration:none}a.htitle:hover{text-decoration:underline}'
  + 'footer{max-width:920px;margin:18px auto 0;color:#6b7280;font-size:12px}';
function renderHumanHtml(root, meta, todos) {
  const prompts = {};
  const cards = todos.map(t => {
    const prog = t.total ? `<span class="prog">${t.done}/${t.total} 已勾</span>` : '';
    let action;
    if (t.open.length) action = `<div class="act"><div class="act-h">需要人工处理</div><ul>${t.open.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>`;
    else if (t.total) action = `<div class="act human-ok"><div class="act-h">需要人工处理</div><div class="note">验收项已全部勾验、开发自检通过 —— 等你最终签收 / 验收。</div></div>`;
    else action = `<div class="act"><div class="act-h">需要人工处理</div><div class="note">本工单无勾选项，请按工单正文人工判定处理。</div></div>`;
    const pend = t.open.length ? t.open.map(o => '- ' + o).join('\n') : (t.total ? '- 验收项已全勾，等你最终签收 / 验收。' : '- 无勾选项，按工单正文人工判定。');
    prompts[t.code] = `【人工待办 · 决策单 ${t.code}】\n工作区（先在此找代码 / 看资料取证）：${meta.repoPath}\n工单：${t.title}\n工单文件：${t.file}\n${t.blocked ? '阻塞/依赖：' + t.blocked + '\n' : ''}待你（人）拍板的事项${t.total ? `（未勾验收 ${t.open.length}/${t.total}）` : ''}：\n${pend}\n请据此推进决策，不要空谈：\n1) 取证：在上面工作区里检索 / 阅读与本决策相关的代码、文档、配置（给出 文件:行 或路径指针作证据），摸清现状与约束；\n2) 用 jxx-grilling 逐条把「选项 / 影响（风险·成本·可逆性） / 推荐」摆清，追问到我可拍板；\n3) 我拍板后：把决策与理由（含取证证据指针）写回工单「## 评论」（新内容置最前）、勾对应验收项、必要时改 **Status:**；\n4) 若决策引出 agent 可执行的活 → 转 ready-for-agent 由领导者另投卡；涉密钥 / 计费 / 删数据等不可逆动作先回显确认再动；\n5) 回写工单文件属文档改动，按「隔离 worktree cherry-pick 到 origin/main」提交，勿污染共享 main。`;
    return `<div class="hcard">
${prog}<b class="hcode">${esc(t.code)}</b><a class="htitle" href="${esc(t.href || '')}" target="_blank" rel="noopener">${esc(t.title)}</a>
<div class="hsub">PRD ${esc(t.prdDir)}${t.slug ? ` · 工单 ${esc(t.slug)}` : ''}${t.blocked ? ` · ⛓ ${esc(t.blocked)}` : ''} · <a class="open" href="${esc(t.href || '')}" target="_blank" rel="noopener">打开完整工单 ↗</a></div>
${action}
<button class="cp" data-id="${esc(t.code)}">📋 复制决策提示词</button>
</div>`;
  }).join('');
  const body = todos.length ? `<div class="list">${cards}</div>`
    : `<div class="empty">🎉 当前没有 ready-for-human 工单，人工这边没有待办。</div>`;
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">`
    + `<meta http-equiv="refresh" content="10"><title>人工待办 · ${esc(path.basename(root))}</title>`
    + `<style>${HUMAN_STYLE}</style></head><body>`
    + `<header><h1>人工待办</h1><a class="nav" href="board.html" target="_blank" rel="noopener">← 工单看板</a><a class="nav" href="prd.html" target="_blank" rel="noopener">PRD 看板 →</a>`
    + `<div class="info">需要你的决策 / 验收 / 操作 · ${todos.length} 项 · 权威仓 ${esc(meta.repoPath || '')} · 生成于 ${localIso()} · 每 10s 刷新</div></header>`
    + `${body}`
    + `<footer>数据源＝权威仓 .scratch 下 **Status:** ready-for-human 的工单 · 标题/「打开完整工单」在新标签页打开 · 「复制决策提示词」把决策单贴给新会话即可推进（提示词默认不显示在界面上）</footer>`
    + `<script>const PROMPTS=${JSON.stringify(prompts).replace(/</g, '\\u003c')};
document.querySelectorAll('.cp').forEach(b=>b.addEventListener('click',async()=>{const t=PROMPTS[b.dataset.id]||'';try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}b.textContent='✔ 已复制，去贴给新会话拍板';b.classList.add('done');setTimeout(()=>{b.textContent='📋 复制决策提示词';b.classList.remove('done')},2500);}));</script>`
    + `</body></html>`;
}

// ---------- PRD 看板（control/prd.html，第三页）----------
// 面板三职责：发布任务 + PRD/工单状态展示 + 提供任务提示词。执行分流：整份 PRD 一次交付 → /jxx-implement-spec（单分支整轨）；
// 单工单推进 → 公告板领卡 /jxx-implement。同一 PRD 二选一，防双轨并作。
function parsePrd(md) {
  let b; try { b = fs.readFileSync(md, 'utf8').replace(/\r/g, ''); } catch { return null; }
  const status = (b.match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1] || '';
  const title = (((b.match(/^ {0,3}#\s+(.+?)\s*$/m) || [])[1] || path.basename(path.dirname(md))).trim());
  const rel = md.replace(/\\/g, '/');
  const g = rel.match(/\.scratch\/([^/]+)\/PRD\.md$/i);
  if (!g) return null;
  return { code: g[1], num: (g[1].match(/^(\d+)/) || [])[1] || g[1], title, status, file: md, href: fileHref(md) };
}
function scanPrds(repoPath) {
  const sc = path.join(repoPath, '.scratch');
  const out = [];
  let ents; try { ents = fs.readdirSync(sc, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (!e.isDirectory()) continue;
    const prdFile = path.join(sc, e.name, 'PRD.md');
    if (!fs.existsSync(prdFile)) continue;
    const prd = parsePrd(prdFile) || { code: e.name, num: (e.name.match(/^(\d+)/) || [])[1] || e.name, title: e.name, status: '', file: prdFile, href: fileHref(prdFile) };
    const issues = [];
    let files; try { files = fs.readdirSync(path.join(sc, e.name, 'issues')).filter(f => f.endsWith('.md')).sort(); } catch { files = []; }
    for (const f of files) {
      const p = path.join(sc, e.name, 'issues', f);
      let b; try { b = fs.readFileSync(p, 'utf8').replace(/\r/g, ''); } catch { continue; }
      const status = (b.match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1] || 'unknown';
      const blocked = ((b.match(/\*\*Blocked by:\*\*\s*(.+)/) || [])[1] || '').trim();
      const title = (((b.match(/^ {0,3}#\s+(.+?)\s*$/m) || [])[1] || path.basename(f, '.md')).trim()).replace(/^\d{1,3}\s*[·・.、-]\s*/, '');
      const total = (b.match(/^ {0,3}[-*] \[[ xX]\]/gm) || []).length;
      const checked = (b.match(/^ {0,3}[-*] \[[xX]\]/gm) || []).length;
      issues.push({ file: p, href: fileHref(p), name: path.basename(f, '.md'), title, status, blocked, total, checked });
    }
    out.push({ ...prd, issues });
  }
  return out.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
}
const PRD_STATUS_LABEL = { draft: '草稿', 'in-progress': '进行中', 'pending-review': '待评审', review: '待评审', done: '已完成', wontfix: '已放弃', 'ready-for-agent': '可执行', 'ready-for-human': '等人工' };
function renderPrdHtml(root, meta, cols, todos) {
  // 卡映射：cardId -> 卡对象（merge 卡不计入工单映射）
  const cardOf = new Map();
  for (const col of cols) for (const c of col.cards) cardOf.set(c.id, { state: col.state, ...c });
  // 工单号 → 卡：卡 id 形如 <PRD号>-<工单号>-<slug>
  const issueCard = new Map();
  for (const [id, c] of cardOf) {
    if (/^merge-/.test(id)) continue;
    const m = id.match(/^(\d+)-(\d+)-/);
    if (m) issueCard.set(`${m[1]}-${m[2]}`, c);
  }
  const prds = scanPrds(meta.repoPath);
  const prdPrompts = {};
  const ISSUE_GROUP = [
    ['ready-for-agent', '▶️ 前沿可领（ready-for-agent，尚无卡）'],
    ['in-flight', '🔄 在办（已有卡：inbox/claimed/review/held）'],
    ['ready-for-human', '⛔ 等人工（ready-for-human）'],
    ['pending-review', '📋 待评审（pending-review/review）'],
    ['done', '✅ 已完成（done）'],
    ['wontfix', '🚫 已放弃（wontfix）'],
    ['other', '❓ 其他状态'],
  ];
  const issueLi = ({ it, card }) => {
    const chk = it.total ? ` <span class="chk">${it.checked}/${it.total}</span>` : '';
    const dep = it.blocked && !/^无/.test(it.blocked) ? ` <span class="dep">⛓ ${esc(it.blocked)}</span>` : '';
    const stateTag = card ? ` <span class="ctag ${card.state}">${esc(card.state)}${card.by ? ' · ' + esc(card.by) : ''}</span>` : '';
    return `<li><a href="${esc(it.href || '')}" target="_blank" rel="noopener">${esc(it.name)}</a> ${esc(it.title)}${chk}${dep}${stateTag}</li>`;
  };
  const blocks = prds.map(p => {
    const groups = Object.fromEntries(ISSUE_GROUP.map(([k]) => [k, []]));
    for (const it of p.issues) {
      const st = (it.status || 'unknown').toLowerCase();
      const card = issueCard.get(it.name) || issueCard.get(`${p.num}-${(it.name.match(/^(\d+)-/) || [])[1]}`);
      let gk = 'other';
      if (card && ['inbox', HELD, 'claimed', 'review'].includes(card.state)) gk = 'in-flight';
      else if (/^ready-for-agent$/i.test(st) && !card) gk = 'ready-for-agent';
      else if (/^ready-for-human$/i.test(st)) gk = 'ready-for-human';
      else if (/^pending-review$|^review$/i.test(st)) gk = 'pending-review';
      else if (/^done$/i.test(st)) gk = 'done';
      else if (/^wontfix$/i.test(st)) gk = 'wontfix';
      groups[gk].push({ it, card });
    }
    const total = p.issues.length;
    const doneN = groups['done'].length + groups['wontfix'].length;
    const frontier = groups['ready-for-agent'].length;
    const pct = total ? Math.round(doneN / total * 100) : 0;
    const groupHtml = ISSUE_GROUP.filter(([k]) => groups[k].length).map(([k, label]) =>
      `<div class="grp"><div class="glbl">${label} (${groups[k].length})</div><ul>${groups[k].map(issueLi).join('')}</ul></div>`).join('');
    const prdSt = PRD_STATUS_LABEL[(p.status || '').toLowerCase()] || (p.status || '未标注');
    prdPrompts[p.code] = '【PRD 级整轨执行 · ' + p.code + ' ' + p.title + '】\n工作区（权威仓）：' + meta.repoPath + '\nPRD：' + p.file + '\n工单任务图：.scratch/' + p.code + '/issues/*.md（各工单 **Status:** 与 **Blocked by:** 已声明阻塞关系）\n\n请用 /jxx-implement-spec 技能整轨推进本 PRD：\n1) 读 PRD 与全部工单，构建任务图，识别就绪前沿（Blocked by 全部 done 的工单）；\n2) 单分支交付：从 ' + (meta.baseBranch || 'main') + ' 建分支 ticket/' + p.code + '-spec，先开 draft PR；\n3) 后台子 agent 并发实现前沿工单，每收口一张即更新该工单 **Status:** 与验收勾选框，前沿推进继续派发；\n4) 全部工单 done 后跑 /jxx-code-review 审整支分支，修复后转 ready；\n5) 完成判据：本 PRD 全部工单 Status=done 且验收全勾。\n注意：若工单看板已有本 PRD 的在办卡（claimed/review），先与用户确认走整轨还是分轨，勿双轨并作。';
    return `<div class="prd"><div class="phead"><b class="pcode">${esc(p.code)}</b><a class="ptitle" href="${esc(p.href || '')}" target="_blank" rel="noopener">${esc(p.title)}</a><span class="pst">${esc(prdSt)}</span><span class="pprog">${doneN}/${total} 工单收口 · ${pct}%</span><button class="cp-prd" data-prd="${esc(p.code)}">📋 PRD 级整轨提示词</button></div>${groupHtml}</div>`;
  }).join('');
  const totalFrontier = prds.reduce((n, p) => n + p.issues.filter(it => /^ready-for-agent$/i.test(it.status) ).length, 0);
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="10"><title>PRD 看板 · ${esc(path.basename(root))}</title>
<style>
body{font:14px/1.6 "Segoe UI",system-ui,sans-serif;background:#0f1115;color:#e5e7eb;margin:0;padding:24px 16px}
header{max-width:920px;margin:0 auto 18px}h1{font-size:20px;margin:0;display:inline-block}
.nav{margin-left:12px;font-size:13px;color:#60a5fa;text-decoration:none;border:1px solid #2b3342;padding:4px 10px;border-radius:8px;background:#161a22}
.nav:hover{background:#1e2430}.info{color:#9ca3af;font-size:12px;margin-top:6px}
.list{max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.prd{background:#161a22;border:1px solid #232b38;border-radius:12px;padding:14px 16px}
.phead{margin-bottom:8px}.pcode{display:inline-block;background:#1d4ed8;color:#fff;border-radius:6px;font-size:12px;padding:1px 8px;margin-right:8px}
.ptitle{color:#f3f4f6;font-weight:700;font-size:15px;text-decoration:none}.ptitle:hover{text-decoration:underline}
.pst{margin-left:8px;font-size:12px;color:#9ca3af;border:1px solid #2b3342;border-radius:999px;padding:1px 8px}
.pprog{float:right;font-size:12px;color:#9ca3af;background:#1e2430;border-radius:999px;padding:2px 10px}
.grp{margin:8px 0 0}.glbl{font-size:12px;color:#8b94a3;margin-bottom:2px}
.grp ul{margin:0;padding-left:18px}.grp li{color:#d1d5db;font-size:13px;margin:2px 0;word-break:break-all}
.grp a{color:#60a5fa;text-decoration:none}.chk{color:#34d399;font-size:12px}.dep{color:#f59e0b;font-size:12px}
.ctag{font-size:11px;border-radius:4px;padding:0 6px;border:1px solid #2b3342;color:#9ca3af}
.ctag.claimed{color:#60a5fa}.ctag.review{color:#d97706}.ctag.held{color:#f59e0b}.ctag.inbox{color:#34d399}.ctag.done{color:#6b7280}
.cp-prd{margin-top:8px;background:#2b3342;color:#cbd5e1;border:1px solid #3b4356;border-radius:6px;font-size:12px;padding:3px 10px;cursor:pointer}
.cp-prd:hover{background:#3b4356}.cp-prd.done{background:#064e3b;border-color:#34d399;color:#6ee7b7}
.empty{max-width:920px;margin:0 auto;background:#161a22;border:1px solid #232b38;border-radius:12px;padding:40px;text-align:center;color:#9ca3af}
footer{max-width:920px;margin:18px auto 0;color:#6b7280;font-size:12px}
</style></head><body>
<header><h1>PRD 看板</h1><a class="nav" href="board.html" target="_blank" rel="noopener">工单看板 →</a><a class="nav" href="human.html" target="_blank" rel="noopener">人工待办 →</a>
<div class="info">执行分流：整份 PRD 一次交付 → 复制下方「PRD 级整轨提示词」给新会话跑 /jxx-implement-spec · 单工单推进 → 工单看板领卡跑 /jxx-implement · ${prds.length} 份 PRD · 前沿可领 ${totalFrontier} 张工单 · 权威仓 ${esc(meta.repoPath || '')} · 生成于 ${localIso()} · 每 10s 刷新</div></header>
${prds.length ? `<div class="list">${blocks}</div>` : `<div class="empty">权威仓 .scratch/ 下还没有 &lt;NN-slug&gt;/PRD.md + issues/ 结构——先用 jxx-to-spec 出 PRD、jxx-to-tickets 拆工单，再刷新本页。</div>`}
<footer>数据源＝权威仓 .scratch/&lt;NN-slug&gt;/PRD.md + issues/*.md 的 **Status:** 行 · 有卡的工单按卡泳道显示真实协调状态（优先于文档 Status）· PRD 级整轨提示词＝/jxx-implement-spec（单分支整份交付）· 工单级请去工单看板领卡（/jxx-implement）</footer>
<script>const PRD_PROMPTS=${JSON.stringify(prdPrompts).replace(/</g, '\\u003c')};</script>
</body></html>`;
}

function cmdHtml(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const meta = needWs(root);
  const out = path.resolve(arg(argv, 'out') || path.join(root, 'control', 'board.html'));
  const humanOut = path.resolve(arg(argv, 'human-out') || path.join(path.dirname(out), 'human.html'));
  const prdOut = path.resolve(arg(argv, 'prd-out') || path.join(path.dirname(out), 'prd.html'));
  const once = () => {
    fs.writeFileSync(out, renderHtml(root, meta, scanBoard(root), startersOf(root)));
    fs.writeFileSync(humanOut, renderHumanHtml(root, meta, scanHumanTodos(meta.repoPath)));
    fs.writeFileSync(prdOut, renderPrdHtml(root, meta, scanBoard(root), scanHumanTodos(meta.repoPath)));
  };
  once();
  console.log(`html: 看板 ${out} + 人工待办 ${humanOut} + PRD 看板 ${prdOut} 已生成（三页互链，链接默认新标签页打开）`);
  if (flag(argv, 'watch')) {
    console.log('html: watch 模式运行中（每 3s 重扫三页，Ctrl+C 退出）。');
    setInterval(() => { try { once(); } catch { /* 文件被占用时跳过本轮 */ } }, 3000);
  }
}

function startersOf(root) {
  const r = f => { const p = path.join(root, 'control', 'starter', f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
  return { dev: r('dev.md'), merger: r('merger.md') };
}
// 变更命令成功后自动保鲜看板（铁律6 的工具化兜底），失败静默不阻塞主命令
function autoHtml(root) {
  try {
    if (!fs.existsSync(path.join(root, 'control', 'workspace.json'))) return;
    const meta = needWs(root);
    fs.writeFileSync(path.join(root, 'control', 'board.html'), renderHtml(root, meta, scanBoard(root), startersOf(root)));
    fs.writeFileSync(path.join(root, 'control', 'human.html'), renderHumanHtml(root, meta, scanHumanTodos(meta.repoPath)));
    fs.writeFileSync(path.join(root, 'control', 'prd.html'), renderPrdHtml(root, meta, scanBoard(root), scanHumanTodos(meta.repoPath)));
  } catch { /* 看板保鲜失败不影响命令结果 */ }
}

// ---------- ledger ----------
function cmdLedger(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const action = arg(argv, 'action') || die('缺少 --action');
  const target = arg(argv, 'target') || '-';
  const reason = arg(argv, 'reason') || '-';
  const actor = arg(argv, 'actor') || 'leader';
  const file = path.join(root, 'control', 'ledger.md');
  if (!fs.existsSync(file)) die('账本不存在，先跑 init');
  const cell = v => String(v).replace(/\|/g, '\\|');
  const line = `| ${localIso()} | ${cell(actor)} | ${cell(action)} | ${cell(target)} | ${cell(reason)} |\n`;
  if (fs.readFileSync(file, 'utf8').includes(line)) { console.log('ledger: 相同行已存在，未重复追加'); return; }
  fs.appendFileSync(file, line);
  autoHtml(root);
  console.log(`ledger: ${line.trim()}`);
}

// ---------- verify ----------
function cmdVerify(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const meta = needWs(root);
  // 权威仓引用新鲜度：--fetch 主动拉（本机 helper 被禁，带 store 兜底）；否则按 FETCH_HEAD 龄期报警
  if (flag(argv, 'fetch')) {
    try { git(meta.repoPath, '-c credential.helper=store fetch origin --quiet'); console.log('INFO 已带凭据 fetch origin，引用新鲜'); }
    catch { console.log('WARN fetch 失败（认证？），以下检查基于可能过期的 origin/main 引用'); }
  } else {
    try { const ageH = (Date.now() - fs.statSync(path.join(meta.repoPath, '.git', 'FETCH_HEAD')).mtimeMs) / 3600e3;
      if (ageH > 6) console.log(`WARN 权威仓上次 fetch 距今 ${ageH.toFixed(1)} 小时——投卡/裁决前先 fetch，否则状态判断可能失鲜`);
    } catch { /* 无 FETCH_HEAD 记录则跳过 */ }
  }
  const problems = [];
  const where = {}; // cardId -> [states]
  for (const s of LANES) for (const c of listCards(root, s)) {
    const id = c.replace(/\.md$/, '');
    (where[id] ||= []).push(s);
    if (where[id].length > 1) problems.push(`MISMATCH 卡 ${id} 同时存在于 ${where[id].join(' + ')}`);
  }
  // 回放账本中的 move 文法
  const ledgerFile = path.join(root, 'control', 'ledger.md');
  const lastMove = {};
  if (fs.existsSync(ledgerFile)) {
    for (const line of fs.readFileSync(ledgerFile, 'utf8').split('\n')) {
      const cells = line.split('|').map(x => x.trim());
      if (cells.length < 6) continue;
      const m = cells[3]?.match(/^move\s+(\S+?)\.md\s+(\w+)->(\w+)$/);
      if (m) lastMove[m[1]] = { from: m[2], to: m[3] };
    }
  }
  for (const [id, mv] of Object.entries(lastMove)) {
    const loc = where[id];
    if (!loc) problems.push(`MISMATCH 账本最后记录 ${id} 应在 ${mv.to}，但各泳道目录均未找到该卡`);
    else if (!loc.includes(mv.to)) problems.push(`MISMATCH 账本记 ${id} 在 ${mv.to}，实况在 ${loc.join('/')}`);
  }
  // PRD 指针有效性（防迁移/改名漂移）
  for (const s of LANES) for (const c of listCards(root, s)) {
    const cbody = fs.readFileSync(path.join(cardsDir(root, s), c), 'utf8');
    const { prd, branch } = cardFields(cbody);
    if (prd && !fs.existsSync(prd)) problems.push(`MISMATCH 卡 ${c} 的 PRD 指针不存在: ${prd}`);
    else if (prd && s !== 'done') {
      const st = (fs.readFileSync(prd, 'utf8').match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1];
      if (st && /^(done|wontfix)$/i.test(st)) {
        // merge 卡的工单在开发交付那一刻就被置 done，属常态；它该不该归档只看「待合分支是否已进 main」
        if (/^merge-/.test(c)) {
          const primary = [...new Set([`ticket/${c.replace(/\.md$/, '').replace(/^merge-/, '')}`, (branch || '').trim()].filter(Boolean))];
          const mentioned = [...new Set([...cbody.matchAll(/ticket\/[A-Za-z0-9._-]+/g)].map(m => m[0]))];
          const probe = (list) => {
            let hit = null, ahead = -1;
            for (const b of list) {
              let n;
              try { n = Number(git(meta.repoPath, `rev-list --count origin/main..${b}`)); } catch { continue; }
              hit = b; ahead = n; if (n > 0) break;
            }
            return { hit, ahead };
          };
          // 主判据（派生分支 / 卡上分支行）能解析就以它为准；解析不了再退到卡正文点名的分支
          let { hit, ahead } = probe(primary);
          if (!hit) ({ hit, ahead } = probe(mentioned.filter(b => !primary.includes(b))));
          if (hit && ahead > 0) { console.log(`INFO merge 卡 ${c}: 工单已 ${st}（交付即 done 属常态），待合分支 ${hit} 领先 origin/main ${ahead} 个提交，留 ${s}/`); continue; }
          if (hit) { problems.push(`MISMATCH 失鲜卡 ${c}（在 ${s}/）: 待合分支 ${hit} 已在 origin/main，应裁决归档`); continue; }
          problems.push(`MISMATCH 失鲜卡 ${c}（在 ${s}/）: 工单已 ${st}，但卡上找不到可解析的待合分支——按工单与分支实态人工裁决`);
          continue;
        }
        problems.push(`MISMATCH 失鲜卡 ${c}（在 ${s}/）: 工单已 ${st}，应裁决归档`);
      }
    }
  }
  // 假勾选闸门：交付分支上的工单 Status=done 但验收勾选框一条未勾 ⇒ 文档载荷形态未尽（70-04 打回教训＊done+0/17 未勾属确定性缺陷）。工单定位：优先卡面 PRD 行；无则按卡 id 的工单号在分支 .scratch 树里扼 issues/<NN>- 文件
  for (const s of ['claimed', 'review']) for (const c of listCards(root, s)) {
    const cbody = fs.readFileSync(path.join(cardsDir(root, s), c), 'utf8');
    const { prd, branch } = cardFields(cbody);
    const devId = c.replace(/\.md$/, '').replace(/^merge-/, '');
    const num = ((devId.match(/^\d+-(\d+)-/) || [])[1] || '').padStart(2, '0');
    let prdRel = '';
    if (prd && fs.existsSync(prd)) { const r = path.relative(meta.repoPath, path.resolve(prd)).replace(/\\/g, '/'); if (r && !r.startsWith('..')) prdRel = r; }
    for (const b of [...new Set([`ticket/${devId}`, (branch || '').trim()].filter(Boolean))]) {
      let rels = [];
      if (prdRel) rels = [prdRel];
      else if (num) {
        const prdnum = (devId.match(/^(\d+)-/) || [])[1] || '';
        try {
          const all = git(meta.repoPath, `ls-tree -r --name-only ${b} .scratch`).split('\n').filter(f => f.includes('/issues/' + num + '-') && f.endsWith('.md'));
          // 卡 id 的 PRD 号可定位目录时只认该目录，防跨 PRD 同号工单误抓（v0.7.3 事故：70-02 被误判抓中 PRD01 的 02-*.md）
          const pref = prdnum ? new RegExp('^\\.scratch\\/' + prdnum + '(-|\\/)') : null;
          rels = (pref ? all.filter(f => pref.test(f)) : all);
        } catch { continue; }
      }
      if (!rels.length) continue;
      let txt = null;
      for (const rel of rels) { try { const t = git(meta.repoPath, `show ${b}:${rel}`); if (/\*\*Status:\*\*\s*done/i.test(t)) { txt = t; break; } txt ??= t; } catch { } }
      if (txt === null) continue;
      const st = (txt.match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1] || '';
      if (!/^done$/i.test(st)) break;
      const total = (txt.match(/^ {0,3}[-*] \[[ xX]\]/gm) || []).length;
      const checked = (txt.match(/^ {0,3}[-*] \[[xX]\]/gm) || []).length;
      if (total > 0 && checked === 0) problems.push(`MISMATCH 假勾选卡 ${c}（在 ${s}/）：分支 ${b} 工单 Status=done 但验收勾选框 0/${total} 已勾`);
      else if (total > 0 && checked < total) console.log(`INFO ${c}：分支 ${b} 工单有 ${total - checked}/${total} 项验收未勾（若系留给 merger 打勾则忽略）`);
      break;
    }
  }
  // 批量关账卡审计（v0.7.4，B1 教训）：批量卡没有本编号工单，上面的单工单闸门结构性逸出；
  // 从卡体提取 NN-slug token，匹配分支树同 PRD 目录下的 issues/NN-slug.md，逐张跑 done+零勾选红灯
  for (const s of ['claimed', 'review']) for (const c of listCards(root, s)) {
    if (/^merge-/.test(c)) continue;
    const cbody = fs.readFileSync(path.join(cardsDir(root, s), c), 'utf8');
    const devId = c.replace(/\.md$/, '');
    const prdnum = (devId.match(/^(\d+)-/) || [])[1] || '';
    const tokens = new Set([...cbody.matchAll(/\b\d{2}-[a-z][a-z0-9-]+\b/g)].map(m => m[0]));
    if (!prdnum || !tokens.size) continue;
    const { branch } = cardFields(cbody);
    for (const b of [...new Set([`ticket/${devId}`, (branch || '').trim()].filter(Boolean))]) {
      let tree = '', touched = '';
      try { tree = git(meta.repoPath, `ls-tree -r --name-only ${b} .scratch`); } catch { continue; }
      // v0.7.5：只审计本分支实际改动过的工单——依赖引用/正文提及他单号不算本单交付面（60-06 误归因教训）
      try { touched = git(meta.repoPath, `diff --name-only origin/main...${b} .scratch`); } catch { touched = ''; }
      const pref = new RegExp('^\\.scratch\\/' + prdnum + '(-[^/]+)?\\/issues\\/');
      const tset = new Set(touched.split('\n'));
      for (const rel of tree.split('\n').filter(f => pref.test(f) && f.endsWith('.md') && tset.has(f) && [...tokens].some(t => f.endsWith('/issues/' + t + '.md')))) {
        let txt; try { txt = git(meta.repoPath, `show ${b}:${rel}`); } catch { continue; }
        if (!/\*\*Status:\*\*\s*done/i.test(txt)) continue;
        const total = (txt.match(/^ {0,3}[-*] \[[ xX]\]/gm) || []).length;
        const checked = (txt.match(/^ {0,3}[-*] \[[xX]\]/gm) || []).length;
        if (total > 0 && checked === 0) problems.push(`MISMATCH 假勾选卡 ${c}（在 ${s}/）：分支 ${b} 工单 ${rel.split('/').pop()} Status=done 但验收框 0/${total} 未勾（批量卡审计）`);
      }
      break;
    }
  }
  // v0.7.6：BACKLOG 撞号闸门——在飞分支给 .scratch/BACKLOG.md 新增的 `### N.` 号，
  // 与 origin/main 现号或彼此互撞即红灯（#53、#75 两波并行登号事故的工具化）
  let mainBSet;
  try { mainBSet = new Set([...git(meta.repoPath, 'show origin/main:.scratch/BACKLOG.md').matchAll(/^#{2,3} (\d+)\./gm)].map(m => m[1])); } catch { mainBSet = new Set(); }
  const bAdd = new Map();
  for (const s of ['claimed', 'review']) for (const c of listCards(root, s)) {
    if (/^merge-/.test(c)) continue;
    const cbody = fs.readFileSync(path.join(cardsDir(root, s), c), 'utf8');
    const devId = c.replace(/\.md$/, '');
    const { branch } = cardFields(cbody);
    for (const b of [...new Set([`ticket/${devId}`, (branch || '').trim()].filter(Boolean))]) {
      // 2026-09-30 工具欠账修复：三点 diff 的 merge-base 随合入后移，会把「已合入但分支未删」的
      // 分支再计一遍 ⇒ 必然误报撞号。零领先（已全部合入）直接跳过。
      try { if (git(meta.repoPath, `rev-list --count origin/main..${b}`) === '0') continue; } catch { continue; }
      let d = ''; try { d = git(meta.repoPath, `diff origin/main...${b} -- .scratch/BACKLOG.md`); } catch { continue; }
      for (const n of new Set([...d.matchAll(/^\+#{2,3} (\d+)\./gm)].map(m => m[1]))) {
        if (!bAdd.has(n)) bAdd.set(n, []);
        bAdd.get(n).push(c);
      }
      break;
    }
  }
  for (const [n, cards] of [...bAdd.entries()].sort((a, b) => a[0] - b[0])) {
    if (mainBSet.has(n)) problems.push(`MISMATCH BACKLOG 撞号：卡 ${cards.join(', ')} 分支新增 #${n} 已存在于 origin/main ⇒ 合入时以 main 现尾顺延重编并改尽交叉引用`);
    else if (cards.length > 1) problems.push(`MISMATCH BACKLOG 撞号：卡 ${cards.join(', ')} 分支同登 #${n} ⇒ 按合入次序逐张顺延重编`);
  }
  // 依赖闸门：inbox 卡的依赖若指向未归档(done)的已知卡 id ⇒ 不该可领，应收 held；held 卡依赖齐 ⇒ 提示释放
  for (const s of ['inbox', HELD]) for (const c of listCards(root, s)) {
    const { deps } = cardFields(fs.readFileSync(path.join(cardsDir(root, s), c), 'utf8'));
    const pend = pendingDeps(root, deps, c.replace(/\.md$/, ''));
    if (s === 'inbox' && pend.length)
      problems.push(`MISMATCH 依赖未就绪卡 ${c}（在 inbox/）：依赖 ${pend.join(', ')} 未归档 done ⇒ 应 mv 到 control/held/`);
    if (s === HELD && !pend.length)
      console.log(`INFO held 卡 ${c} 依赖已齐，可 mv 回 inbox 释放待领`);
  }
  // 在飞卡分支差异检测：review 有卡却零差异 = 假交付；claimed 零差异仅 INFO（刚开工正常）
  for (const s of ['claimed', 'review']) for (const c of listCards(root, s)) {
    const { branch } = cardFields(fs.readFileSync(path.join(cardsDir(root, s), c), 'utf8'));
    const b = (branch || '').trim(); if (!b) continue;
    try {
      if (git(meta.repoPath, `rev-list --count origin/main..${b}`) === '0') {
        if (s === 'review') problems.push(`MISMATCH 假交付嫌疑 ${c}: 分支 ${b} 与 origin/main 零差异，何来交付`);
        else console.log(`INFO claimed 卡 ${c} 分支尚无提交（刚开工正常）`);
      }
    } catch { /* 分支未建（worker 未 add-wt）跳过 */ }
  }
  // claimed 卡 ↔ worktree
  const repoDir = meta.repoPath;
  let wtList = '';
  try { wtList = git(repoDir, 'worktree list'); } catch { /* 报告缺 worktree 时再提示 */ }
  for (const c of listCards(root, 'claimed')) {
    const id = c.replace(/\.md$/, '');
    if (/^merge-/.test(id)) continue; // 合并卡无自有 worktree，操作对象是开发卡的 wt
    if (!fs.existsSync(path.join(root, 'wt', id)))
      problems.push(`MISMATCH claimed 卡 ${id} 无对应 wt/${id} 工作目录`);
  }
  const claimedIds = new Set(listCards(root, 'claimed').map(c => c.replace(/\.md$/, '')));
  const inboxIds = new Set([...listCards(root, 'inbox'), ...listCards(root, HELD)].map(c => c.replace(/\.md$/, '')));
  const reviewIds = new Set(listCards(root, 'review').map(c => c.replace(/\.md$/, '')));
  const blockedIds = new Set(listCards(root, 'blocked').map(c => c.replace(/\.md$/, '')));
  // 卡上 worktree: 行声明的工作目录（决策会话等可自开非规范名目录，按声明认领，避免误报无主）
  const declaredWt = new Map();
  for (const s of LANES) for (const c of listCards(root, s)) {
    const { wt } = cardFields(fs.readFileSync(path.join(cardsDir(root, s), c), 'utf8'));
    const w = (wt || '').split(/[\s（(]/)[0].replace(/[\\/]+$/, '');
    if (w) declaredWt.set(path.basename(w).toLowerCase(), `${c.replace(/\.md$/, '')}（在 ${s}/）`);
  }
  const wtRoot = path.join(root, 'wt');
  if (fs.existsSync(wtRoot)) for (const d of fs.readdirSync(wtRoot)) {
    if (!fs.statSync(path.join(wtRoot, d)).isDirectory()) continue;
    if (claimedIds.has(d)) continue;
    if (inboxIds.has(d)) { console.log(`INFO wt/${d} 为领导者预开工作区（卡待领取）`); continue; }
    if (reviewIds.has(d)) { console.log(`INFO wt/${d} 交付成果所在，留待合并专员合入后回收`); continue; }
    if (blockedIds.has(d)) { console.log(`INFO wt/${d} 属 blocked 卡保留现场（可续接）`); continue; }
    if (declaredWt.has(d.toLowerCase())) { console.log(`INFO wt/${d} 由卡 ${declaredWt.get(d.toLowerCase())} 的 worktree 行声明（非规范名）`); continue; }
    if (!wtList.includes(path.join(wtRoot, d))) problems.push(`WARN worktree wt/${d} 无 claimed 卡引用`);
  }
  // repo 主工作区脏度（仅提示）
  const dirty = git(repoDir, 'status --porcelain').split('\n').filter(Boolean).length;
  if (dirty) console.log(`INFO repo/（${meta.baseBranch}）有 ${dirty} 个未提交变更——领导者的文档操作应已提交`);

  if (!problems.length) { console.log('verify: 账本×卡位×worktree 三方一致，无出入。'); return; }
  problems.forEach(p => console.log(p));
  console.log(`verify: 发现 ${problems.length} 处出入。按实况裁决修账，每条处置记一笔 ledger。`);
  process.exit(5);
}

// ---------- new-card ----------
function cmdNewCard(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const id = arg(argv, 'id') || die('缺少 --id <NNN-slug>');
  if (!/^\d+-[a-z0-9-]+$/.test(id) && !/^merge-\d+[a-z0-9-]*$/.test(id))
    die(`卡 id "${id}" 不符规范（NNN-slug 或 merge-NNN-slug，kebab-case）`);
  const level = arg(argv, 'level') || die('缺少 --level L1|L2|L3|L4（领导者必须定级，定级理由记账）');
  if (!/^L[1-4]$/.test(level)) die(`--level "${level}" 非法，须为 L1-L4`);
  const model = arg(argv, 'model') || die('缺少 --model <模型档位描述，如：中档及以上>');
  const tf = arg(argv, 'ticket-file');
  let depsArg = arg(argv, 'deps');
  if (!/^merge-/.test(id) && !tf && !flag(argv, 'force'))
    die('开发卡必须带 --ticket-file <权威仓工单路径> 过状态闸门（防失鲜投卡）；确无工单文件可加 --force');
  if (tf) {
    if (!fs.existsSync(tf)) die(`--ticket-file 不存在: ${tf}（状态核对必须以权威仓最新 HEAD 的文件为准）`);
    const st = (fs.readFileSync(tf, 'utf8').match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1] || 'unknown';
    if (!/^ready-for-agent$/i.test(st) && !flag(argv, 'force'))
      die(`工单状态为 "${st}"，非 ready-for-agent，拒绝投卡（确认无误可加 --force）`);
    if (!arg(argv, 'deps')) {
      const bb = (fs.readFileSync(tf, 'utf8').match(/Blocked by:\*\*\s*(.+)/) || [])[1];
      if (bb) { depsArg = bb.trim(); console.log(`new-card: 依赖自动取自工单 Blocked by → "${depsArg}"`); }
    }
  }
  const pendDeps = pendingDeps(root, depsArg, id);
  const parked = pendDeps.length > 0 && !flag(argv, 'keep-inbox');
  const destLane = parked ? HELD : 'inbox';
  const dest = path.join(cardsDir(root, destLane), `${id}.md`);
  if (LANES.some(s => fs.existsSync(path.join(cardsDir(root, s), `${id}.md`)))) die(`卡 ${id} 已存在`);
  const tpl = fs.readFileSync(path.join(root, 'control', 'CARD-TEMPLATE.md'), 'utf8');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let body = tpl.replaceAll('{{ID}}', id).replaceAll('{{PRD-ID}}', id.replace(/^merge-/, ''))
    .replaceAll('{{TITLE}}', arg(argv, 'title') || id)
    .replaceAll('{{DEPS}}', depsArg || '无').replaceAll('{{LEVEL}}', level)
    .replaceAll('{{MODEL}}', model);
  // PRD 行 upsert：模板可能没有 "- PRD:" 行（v0.7.3 事故：70 波 merge 卡静默丢 PRD 指针），缺则插到目标行前
  const setPrd = (b, v) => /^- PRD:[^\r\n]*$/m.test(b)
    ? b.replace(/^- PRD:[^\r\n]*/m, `- PRD: ${v}`)
    : b.replace(/^- 目标:[^\r\n]*/m, `- PRD: ${v}\n$&`);
  if (tf) body = setPrd(body, path.resolve(tf));
  else if (/^merge-/.test(id)) {
    // merge 卡通常不带 --ticket-file：从同名去前缀的开发卡继承真实 PRD 指针，免留模板占位假路径
    const devId = id.replace(/^merge-/, '');
    let inherited = '';
    for (const s of LANES) {
      const p = path.join(cardsDir(root, s), `${devId}.md`);
      if (!fs.existsSync(p)) continue;
      const { prd } = cardFields(fs.readFileSync(p, 'utf8'));
      if (prd && fs.existsSync(prd)) { inherited = prd; console.log(`new-card: PRD 指针继承自 ${s}/${devId}.md`); break; }
    }
    if (inherited) body = setPrd(body, inherited);
    else console.log(`WARN new-card: 未找到可继承 PRD 的开发卡 ${devId}.md，PRD 行仍是模板占位路径——请手工改成真实工单路径，否则 verify 会报 MISMATCH`);
  }
  fs.writeFileSync(dest, body);
  autoHtml(root);
  if (parked)
    console.log(`new-card: ${HELD}/${id}.md —— 依赖未归档（${pendDeps.join(', ')}），自动收进 held 暂缓道，worker 不可见；依赖卡归档 done 后 mv 回 inbox 释放。确要直投 inbox 可重跑加 --keep-inbox`);
  else
    console.log(`new-card: inbox/${id}.md 已创建（${level}）。填完卡落后记得 ledger 记投卡+定级理由。`);
}

// ---------- card CRUD（瘦卡 v2：确定性字段由脚本推导，卡内只留真增量） ----------
function cardPath(root, id) {
  for (const s of LANES) {
    const p = path.join(cardsDir(root, s), `${id}.md`);
    if (fs.existsSync(p)) return { state: s, path: p };
  }
  return null;
}
function deriveFields(root, id, body) {
  // 瘦卡 v2：分支/worktree/PRD 是确定性路径，优先从卡内读（兼容旧卡），缺省推导
  const f = cardFields(body || '');
  const wt = f.wt || path.join(root, 'wt', id) + path.sep;
  const branch = f.branch || `ticket/${id}`;
  let prd = f.prd;
  if (!prd && /^merge-/.test(id)) {
    const devId = id.replace(/^merge-/, '');
    for (const s of LANES) {
      const p = path.join(cardsDir(root, s), `${devId}.md`);
      if (!fs.existsSync(p)) continue;
      const d = cardFields(fs.readFileSync(p, 'utf8')).prd;
      if (d && fs.existsSync(d)) { prd = d; break; }
    }
  }
  return { ...f, wt, branch, prd };
}
function cmdCardRead(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const id = arg(argv, 'id') || die('缺少 --id <卡id>');
  const loc = cardPath(root, id);
  if (!loc) die(`卡 ${id} 不存在`);
  const body = fs.readFileSync(loc.path, 'utf8');
  const f = deriveFields(root, id, body);
  console.log(`# ${id}（${loc.state}/）`);
  console.log(`- 标题: ${f.title || '(未填)'}`);
  console.log(`- 难度: ${f.level || '(未填)'}`);
  console.log(`- 模型档位: ${f.model || '(未填)'}`);
  console.log(`- 依赖: ${f.deps || '(未填)'}`);
  console.log(`- PRD: ${f.prd || '(未填)'}`);
  console.log(`- 分支: ${f.branch}`);
  console.log(`- worktree: ${f.wt}${fs.existsSync(f.wt) ? ' [已预开]' : ' [未创建]'}`);
  // 卡内剩余段原样输出（领取/交付/待验/流转）
  const sections = body.split(/^## /m).slice(1);
  for (const s of sections) console.log(`\n## ${s.trim()}`);
}
function cmdCardSet(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const id = arg(argv, 'id') || die('缺少 --id <卡id>');
  const field = arg(argv, 'field') || die('缺少 --field <字段名>');
  const value = arg(argv, 'value') || die('缺少 --value <值>');
  const loc = cardPath(root, id);
  if (!loc) die(`卡 ${id} 不存在`);
  const allowed = ['标题', '难度', '模型档位', '依赖', '目标', '领取者', 'PRD'];
  if (!allowed.includes(field)) die(`--field 只允許: ${allowed.join('/')}`);
  const body = fs.readFileSync(loc.path, 'utf8');
  const re = new RegExp(`^- ${field}: [^\\r\\n]*`, 'm');
  if (!re.test(body)) die(`卡内没有 "- ${field}:" 行，请先用 card read 确认字段名`);
  fs.writeFileSync(loc.path, body.replace(re, `- ${field}: ${value}`));
  autoHtml(root);
  console.log(`card set: ${id} 的「${field}」已更新。`);
}
function cmdCardMove(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const id = arg(argv, 'id') || die('缺少 --id <卡id>');
  const to = arg(argv, 'to') || die('缺少 --to <目标状态>');
  if (!LANES.includes(to)) die(`--to 必须是 ${LANES.join('/')}`);
  if (to === HELD && !flag(argv, 'leader')) die(`card move: held 是领导者泳道，worker 不可移入（--leader 显式声明方可）`);
  const loc = cardPath(root, id);
  if (!loc) die(`卡 ${id} 不存在`);
  if (to === 'claimed') {
    const pend = pendingDeps(root, cardFields(fs.readFileSync(loc.path, 'utf8')).deps, id);
    if (pend.length) die(`card move: 卡 ${id} 依赖未归档（${pend.join(', ')}）不可领取——等依赖 done 后由领导者释放回 inbox`);
  }
  if (loc.state === to) { console.log(`card move: ${id} 已在 ${to}/，无需移动`); return; }
  const dest = path.join(cardsDir(root, to), `${id}.md`);
  if (fs.existsSync(dest)) die(`目标已存在 ${to}/${id}.md`);
  fs.renameSync(loc.path, dest);
  // 卡内流转追加段自动补一行
  const body = fs.readFileSync(dest, 'utf8');
  const line = `- ${localIso().replace('T', ' ').slice(0, 16)} | ${loc.state}->${to} | ${arg(argv, 'actor') || 'agent'} | ${arg(argv, 'reason') || '(card move)'}`;
  const newBody = body.replace(/(## 流转追加段[\s\S]*?)(\n## |\n?$)/, (m, sec, tail) => `${sec.trimEnd()}\n\n${line}\n${tail}`);
  fs.writeFileSync(dest, newBody);
  // 自动记账（move 文法，verify 可回放）
  const ledgerLine = `| ${localIso()} | ${arg(argv, 'actor') || 'agent'} | move ${id}.md ${loc.state}->${to} | ${id} | ${arg(argv, 'reason') || 'card move'} |
`;
  const ledgerFile = path.join(root, 'control', 'ledger.md');
  if (fs.existsSync(ledgerFile) && !fs.readFileSync(ledgerFile, 'utf8').includes(ledgerLine))
    fs.appendFileSync(ledgerFile, ledgerLine);
  autoHtml(root);
  console.log(`card move: ${id} ${loc.state}/ -> ${to}/（已记账 + 刷看板）`);
}
function cmdCardRm(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const id = arg(argv, 'id') || die('缺少 --id <卡id>');
  const loc = cardPath(root, id);
  if (!loc) die(`卡 ${id} 不存在`);
  if (!flag(argv, 'force')) die(`card rm 需 --force 确认（卡内协调记录会丢失，建议优先 mv 到 done/）`);
  fs.unlinkSync(loc.path);
  autoHtml(root);
  console.log(`card rm: ${id} 已从 ${loc.state}/ 删除。`);
}

// ---------- add-wt / rm-wt ----------
function cmdAddWt(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const meta = needWs(root);
  const id = arg(argv, 'ticket') || die('缺少 --ticket <NNN-slug>');
  const base = arg(argv, 'base') || 'origin/main';
  const repoDir = meta.repoPath, wtPath = path.join(root, 'wt', id), branch = `ticket/${id}`;
  // 目录被外部删除会留下 stale worktree 注册，导致下面的 -b 回退分支失败；先 prune。
  try { git(repoDir, 'worktree prune'); } catch { /* ignore */ }
  try { git(repoDir, `rev-parse --verify ${branch}`); git(repoDir, `worktree add "${wtPath}" ${branch}`); }
  catch { git(repoDir, `worktree add "${wtPath}" -b ${branch} ${base}`); }
  autoHtml(root);
  console.log(`add-wt: wt/${id}（分支 ${branch}，基 ${base}）就绪。进目录后记得装依赖。`);
}
function cmdRmWt(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const id = arg(argv, 'ticket') || die('缺少 --ticket <NNN-slug>');
  const repoDir = needWs(root).repoPath;
  // 破坏性操作边界（2026-09-30 事故：批量回收失控删掉整个 control/）：本命令只允许删
  // <root>/wt/<单段目录名>，拒绝路径分隔符/通配符/遍历片段，且目标必须真实存在。
  if (!id || /[\\/*?|"<>]/.test(id) || id === '.' || id === '..') die(`--ticket "${id}" 非法：只接受单段目录名（禁路径分隔符与通配符）`);
  const wtBase = path.resolve(root, 'wt');
  const target = path.resolve(wtBase, id);
  if (path.dirname(target) !== wtBase) die(`拒绝回收：解析出的路径越出 wt/（${target}）`);
  if (!fs.existsSync(target)) die(`拒绝回收：目录不存在 ${target}`);
  git(repoDir, `worktree remove "${target}"${flag(argv, 'force') ? ' --force' : ''}`);
  if (flag(argv, 'delete-branch')) git(repoDir, `branch -D ticket/${id}`);
  try { git(repoDir, 'worktree prune'); } catch { /* 无注册可清 */ }
  autoHtml(root);
  snapshot(root, `rm-wt ${id}`);
  console.log(`rm-wt: wt/${id} 已回收${flag(argv, 'delete-branch') ? '，分支已删' : ''}。`);
}

// ---------- auto（自动编排模式 v0.9.0） ----------
function cmdAuto(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const meta = needWs(root);
  const ticketsIdx = argv.indexOf('--tickets');
  if (ticketsIdx < 0) die('缺少 --tickets <工单文件1> <工单文件2> ...');
  const ticketFiles = [];
  for (let i = ticketsIdx + 1; i < argv.length && !argv[i].startsWith('--'); i++) {
    ticketFiles.push(path.resolve(argv[i]));
  }
  if (!ticketFiles.length) die('--tickets 后至少给一个工单文件');

  const parallel = parseInt(arg(argv, 'parallel') || '3', 10);
  const maxRetry = parseInt(arg(argv, 'retry') || '1', 10);

  // 1. 投卡
  const cardIds = [];
  const errors = [];
  for (const tf of ticketFiles) {
    if (!fs.existsSync(tf)) { errors.push(`工单文件不存在: ${tf}`); continue; }
    const bn = path.basename(tf, '.md');
    const m = bn.match(/^([a-z]?\d+)-(.+)$/);
    if (!m) { errors.push(`工单文件名不合规范（NN-slug）: ${bn}`); continue; }
    // 字母前缀工单（b01/f01/i01 这类，多 PRD 并行时跨 PRD 重号）用所属 PRD 目录号做卡 id 前缀，
    // 否则推导出的 id 过不了 new-card 的 ^\d+- 正则，其 die() 会终止整条 auto 命令。
    const prdNum = (path.basename(path.dirname(path.dirname(tf))).match(/^(\d+)/) || [])[1];
    const id = /^\d/.test(m[1]) || !prdNum ? `${m[1]}-${m[2]}` : `${prdNum}-${bn}`;
    if (!/^\d+-[a-z0-9-]+$/.test(id)) { errors.push(`卡 id 不合规范，跳过投卡: ${id}`); continue; }
    if (cardPath(root, id)) { console.log(`auto: 卡 ${id} 已存在，跳过投卡`); cardIds.push(id); continue; }
    // 状态闸门预检：cmdNewCard 的 die() 会 process.exit，直接终止整条 auto（一批工单里混一张
    // 非 ready-for-agent 就拿不到后续编排指令）。预检后降级为 errors 记录，继续处理其余工单。
    const st = (fs.readFileSync(tf, 'utf8').match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1] || 'unknown';
    if (!/^ready-for-agent$/i.test(st)) { errors.push(`投卡跳过 ${id}: 工单状态 "${st}" 非 ready-for-agent`); continue; }
    try {
      cmdNewCard(['--root', root, '--id', id, '--level', 'L2', '--model', 'auto', '--ticket-file', tf]);
      cardIds.push(id);
    } catch (e) {
      errors.push(`投卡失败 ${id}: ${e.message}`);
    }
  }

  // 2. 读 starter 模板
  const r = f => { const p = path.join(root, 'control', 'starter', f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
  const devStarter = r('dev.md');
  const reviewerStarter = r('reviewer.md');
  const mergerStarter = r('merger.md');
  const autoStarter = r('auto.md');

  if (!autoStarter) die('control/starter/auto.md 不存在——请用 v0.9.0+ 的 init 重新渲染 starter');

  // 3. 输出编排指令
  console.log('=== AUTO 模式编排指令 ===\n');
  console.log(`工作区: ${root}`);
  console.log(`权威仓: ${meta.repoPath}`);
  console.log(`并行上限: ${parallel} · 重试次数: ${maxRetry}`);
  console.log(`投卡: ${cardIds.length} 张${errors.length ? ` · 失败: ${errors.length}` : ''}`);
  for (const e of errors) console.log(`  ⚠ ${e}`);
  console.log('');

  // 释放 held 卡（依赖已就绪的）
  const heldCards = listCards(root, HELD);
  for (const h of heldCards) {
    const hid = h.replace(/\.md$/, '');
    const body = fs.readFileSync(path.join(cardsDir(root, HELD), h), 'utf8');
    const pend = pendingDeps(root, cardFields(body).deps, hid);
    if (!pend.length) {
      console.log(`📋 held 卡 ${hid} 依赖已就绪，请手动释放: card-move --id ${hid} --to inbox --actor orchestrator --reason "auto: deps ready"`);
    }
  }

  // 可领卡
  const inboxCards = listCards(root, 'inbox').map(f => f.replace(/\.md$/, ''));
  console.log(`\n可领卡（inbox）: ${inboxCards.join(', ') || '无'}`);

  // 输出编排提示词
  console.log('\n=== 编排者提示词（复制给编排者会话） ===\n');
  const prompt = autoStarter
    .replaceAll('{{PARALLEL}}', String(parallel))
    .replaceAll('{{MAX_RETRY}}', String(maxRetry))
    .replaceAll('{{CARD_LIST}}', cardIds.join(', '))
    .replaceAll('{{INBOX_CARDS}}', inboxCards.join(', '));
  console.log(prompt);

  // 输出每个 worker 的 spawn 提示词
  console.log('\n=== Worker Spawn 提示词（每卡一份） ===\n');
  for (const id of inboxCards) {
    console.log(`--- Worker: ${id} ---`);
    console.log(devStarter + `\n\n---\n本次指定：优先领取卡片 \`${id}\`。`);
    console.log('');
  }

  // 输出审查者提示词模板
  console.log('\n=== 审查者 Spawn 提示词（每卡 3 份，维度 std/spec/rule） ===\n');
  for (const dim of ['std', 'spec', 'rule']) {
    console.log(`--- Reviewer (${dim}) ---`);
    console.log(reviewerStarter.replaceAll('{{REVIEW_DIMENSION}}', dim).replaceAll('{{CARD_ID}}', '<卡id>').replaceAll('{{BASE_BRANCH}}', meta.baseBranch || 'main'));
    console.log('');
  }

  // 输出合并专员提示词模板
  console.log('\n=== 合并专员 Spawn 提示词 ===\n');
  console.log(mergerStarter);

  autoHtml(root);
}

// ---------- render（模板漂移修复：init 只补缺，不会更新已存在的文件）----------
function cmdRender(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const meta = needWs(root);
  const write = flag(argv, 'write');
  const render = (file) => fs.readFileSync(path.join(SKILL_DIR, 'assets', file), 'utf8')
    .replaceAll('{{ROOT}}', root).replaceAll('{{REPO_URL}}', meta.repoUrl || '')
    .replaceAll('{{REPO_PATH}}', meta.repoPath).replaceAll('{{BASE_BRANCH}}', meta.baseBranch || 'origin/main')
    .replaceAll('{{SKILL_DIR}}', SKILL_DIR.replace(/\\/g, '\\\\'));
  const targets = [
    ['PROTOCOL.tmpl.md', path.join(root, 'control', 'PROTOCOL.md')],
    ['CARD-TEMPLATE.tmpl.md', path.join(root, 'control', 'CARD-TEMPLATE.md')],
    ['starter-dev.tmpl.md', path.join(root, 'control', 'starter', 'dev.md')],
    ['starter-merger.tmpl.md', path.join(root, 'control', 'starter', 'merger.md')],
    ['starter-reviewer.tmpl.md', path.join(root, 'control', 'starter', 'reviewer.md')],
    ['starter-auto.tmpl.md', path.join(root, 'control', 'starter', 'auto.md')],
  ];
  for (const [asset, dest] of targets) {
    const content = render(asset);
    const old = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    const rel = path.relative(root, dest);
    if (old === content) { console.log(`  [same] ${rel}`); continue; }
    if (!write) { console.log(`  [drift] ${rel}（加 --write 覆盖；旧版会备份到 control/.render-backup/）`); continue; }
    if (old !== null) {
      const bakDir = path.join(root, 'control', '.render-backup');
      fs.mkdirSync(bakDir, { recursive: true });
      fs.copyFileSync(dest, path.join(bakDir, path.basename(dest) + '.bak'));
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    console.log(`  [${old === null ? 'created' : 'updated'}] ${rel}`);
  }
}

// ---------- 看板快照（事故防线）----------
// 2026-09-30：control/ 是 git 外协调面，被一条越界删除命令整目录抹掉后无法还原。
// 现改为：工作区根做本地 git 仓库（wt/ 忽略），变更类命令每次自动留一版快照。
function snapshot(root, reason) {
  try {
    if (git(root, 'rev-parse --is-inside-work-tree') !== 'true') return false;
    const gi = path.join(root, '.gitignore');
    if (!fs.existsSync(gi)) fs.writeFileSync(gi, 'wt/\n');
    const paths = ['control', '.gitignore', 'AGENTS.md', 'CODEBUDDY.md'].filter(f => fs.existsSync(path.join(root, f)));
    if (!paths.length) return false;
    git(root, `add -A -- ${paths.map(f => `"${f}"`).join(' ')}`);
    if (!git(root, 'status --porcelain').trim()) return false;
    const msg = String(reason || 'manual').replace(/"/g, '');
    git(root, `-c user.name=board-snapshot -c user.email=board@local commit -q -m "board snapshot: ${msg} @ ${localIso()}"`);
    return true;
  } catch { return false; }
}
function cmdSnapshot(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const ok = snapshot(root, 'manual');
  console.log(ok
    ? `snapshot: 已留一版看板快照（git -C "${root}" log --oneline -1）`
    : `snapshot: 无变更，或 ${root} 尚未 git init（先 git init 并忽略 wt/，之后每次变更自动快照）`);
}

// ---------- command table ----------
const cmd = process.argv[2];
const argv = process.argv.slice(3);
const table = { init: cmdInit, board: cmdBoard, html: cmdHtml, ledger: cmdLedger, verify: cmdVerify, 'new-card': cmdNewCard, 'add-wt': cmdAddWt, 'rm-wt': cmdRmWt, 'card-read': cmdCardRead, 'card-set': cmdCardSet, 'card-move': cmdCardMove, 'card-rm': cmdCardRm, snapshot: cmdSnapshot, render: cmdRender, auto: cmdAuto };
if (!cmd || !table[cmd]) die(`未知子命令 "${cmd || '(空)'}"。可用：${Object.keys(table).join(' / ')}`);
try { table[cmd](argv); }
catch (e) { die(`${cmd} 失败：${e.stderr?.toString().trim().split('\n')[0] || e.message}`); }
// 变更类命令后自动留一版看板快照（工作区根 git init 过才生效，未 init 时静默跳过）
if (['init', 'new-card', 'card-move', 'card-rm', 'card-set', 'ledger'].includes(cmd)) {
  const snapRoot = arg(argv, 'root');
  if (snapRoot) snapshot(path.resolve(snapRoot), cmd);
}