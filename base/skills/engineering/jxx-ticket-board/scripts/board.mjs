#!/usr/bin/env node
// jxx-ticket-board 确定性脚本（零依赖）。命令面 = 文件末尾的 `table`（唯一权威清单，别再在这里抄一份——
// 抄出来的那份必然与 table 漂移，审查 STD-04 就是这么来的）；跑 `board.mjs <未知子命令>` 会列全部可用命令。
// 协议真源是 control/PROTOCOL.md；账本文法 `move <卡id> <from>-><to>` 被 verify 回放使用。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 三态 + 标签正交（D9 / ADR-008 · 工单 75-c01）----------
// 三个物理维度互不正交就一定会腐坏，所以各管一件事：
//   目录  = 生命周期     → control/cards/{open,done,archived}/
//   文件名限定符 = 执行态  → open/<id>.md 待领 · open/<id>.claimed.md 在办 · open/<id>.review.md 待终审
//   labels 行 = triage   → 五标签，表达「下一步该谁动」；blocked 语义由 needs-info 承载（不再是目录）
// 执行态放文件名而不是放 labels / 卡内字段，是为了保住 ADR-004 的防抢地基：领取仍是**一次原子 rename**，
// 两个 worker 抢同一张卡时只有一个能成功；frontmatter 租约字段是 ADR-004 明确否掉的方案（读改写无原子性）。
const HELD = 'held';
const OPEN = 'open';
const LANE_DIRS = [OPEN, 'done', 'archived'];
const TRIAGE_LABELS = ['ready-for-agent', 'ready-for-human', 'needs-info', 'needs-triage', 'wontfix'];
const EXEC_SUFFIX = { inbox: '', claimed: '.claimed', review: '.review' };
// blocked 不再是目录（三态后由 labels 的 needs-info 表达）。token 表里留着它有两个用处：
// 未迁移的旧板仍能扫到 blocked/ 里的卡，以及 `card-move --to blocked` 仍能被人敲（自动转 needs-info 标签）。
const LANES = ['inbox', 'claimed', 'review', 'done', 'archived', 'blocked', HELD];
// 未收口的 token 全集（三态板里 blocked 恒空，见 listCards）；看板 open 列与 verify 的标签/残卡判据共用这一份。
const UNRESOLVED_TOKENS = ['inbox', 'claimed', 'review', 'blocked'];
// 旧五泳道的目录名（migrate 的输入面 + 三态板的「残卡红灯」面），两处必须同源，否则迁板判据与迁移逻辑漂移
const LEGACY_LANES = ['inbox', 'claimed', 'review', 'done', 'blocked'];
// token → 人话：**唯一词汇源**。看板列标题、卡上执行态徽标、终端 `board` 的泳道名全部由它派生——
// 之前「开发中/待终审」「在办」「待领取/处理中/待审核」三套词各写一遍，用户看到的泳道名和徽标名对不上（审查发现项）。
const TOKEN_TEXT = { inbox: '待领取', claimed: '处理中', review: '待审核', done: '已完成', archived: '已归档', blocked: '阻塞', held: '暂缓' };

const arg = (argv, name) => {
  const eq = argv.find(a => a === `--${name}=` || a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const flag = (argv, name) => argv.includes(`--${name}`);
const die = (msg, code = 1) => { console.error(`board: ${msg}`); process.exit(code); };
// 进 git 参数位的「别人写的文本」（卡面 `- 分支:` 行、`- worktree:` 行、CLI --ticket）必须先过白名单：
// 不合规一律判为「这条引用不可信」跳过，绝不原样递下去（审查 RUL-04）。branch/ref 允许的字符集按 git
// check-ref-format 的实际取值收窄；`..` 与首尾 `/` 是 git 明确拒收的形态，顺手挡掉。
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const safeRef = v => {
  const s = String(v ?? '').trim();
  return s && REF_RE.test(s) && !s.includes('..') && !s.endsWith('/') && !s.endsWith('.') ? s : '';
};
// 卡 id / worktree 单段目录名：与 new-card 的 id 闸门同款（RUL-04 ②③）
const CARD_ID_RE = /^(\d+-[a-z0-9-]+|merge-\d+[a-z0-9-]*)$/;
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;
// git 一律走 **argv 形态**（execFileSync，不过 shell）：早先是 `execSync('git ' + cmd)` 的拼串，
// 卡面 `- 分支:` 行 / CLI `--ticket` 值都是**别人写的文本**，拼进 shell 字符串即命令注入面（审查 RUL-04）。
// 现在拼串没法注入，但「参数位塞进 shell 元字符」的错误用法也一并由本函数兜住：
// 下面的 REF_RE / safeRef 是第二道闸——进参数位的自由文本必须先过白名单。
const git = (cwd, ...cmd) => execFileSync('git', cmd.flat().filter(x => x !== undefined && x !== null), { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

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

// ---------- in-project 模式与统一合并流（v0.12.0 · 三技能统一改造）----------
// jxx-ticket-board / jxx-implement / jxx-implement-spec 统一布局：wt/ 与 control/ 直接落在项目仓库根，
// 三技能共用同一个看板、同一套 worktree、同一条「开发 → 审查 → 合并」流水线。
// workspace.json 的 mode 字段是第一判据；旧工作区没有该字段 ⇒ 按 repoPath === root 推导（外置恒不等）。
function wsMode(root, meta) {
  const m = meta || (fs.existsSync(path.join(root, 'control', 'workspace.json'))
    ? JSON.parse(fs.readFileSync(path.join(root, 'control', 'workspace.json'), 'utf8')) : null);
  if (m && m.mode) return m.mode;
  if (m && m.repoPath && path.resolve(m.repoPath) === path.resolve(root)) return 'in-project';
  return 'external';
}
// 合入目标（v0.14.0 · 默认回合 main，ADR-011）：所有工单（含 PRD 工单）完成审查后一律默认直接
// 合入 main；仅技术受阻（冲突不可解走返工 / 门禁红 / 携带未上 main 的兄弟工单提交）才降级——属 PRD 的
// 暂存 PRD 分支 ticket/<NN>-<slug>（合并专员惰性创建），散工单 blocked 等人工；且必须向用户汇报不能
// 回合 main 的原因（PROTOCOL §3）。暂存分支按 PRD 指针现场推导，不上卡面。
function mergeTargetOf(_ticketFile) {
  return 'main';
}

// ---------- 卡位解析（工作流位 token ↔ 物理落点）----------
// 三态板：open/<id>.md ｜ open/<id>.claimed.md ｜ open/<id>.review.md ｜ done/<id>.md ｜ archived/<id>.md
// 未跑 migrate 的旧五泳道板：token 即目录名、无后缀 —— 同一份脚本两种板都要能跑，否则升级瞬间全员工具失效。
function threeState(root) { return fs.existsSync(path.join(root, 'control', 'cards', OPEN)); }
function cardsDir(root, dir) {
  return dir === HELD ? path.join(root, 'control', 'held') : path.join(root, 'control', 'cards', dir);
}
function cardLoc(root, token) {
  if (token === HELD) return { dir: cardsDir(root, HELD), suffix: '' };
  if (threeState(root) && token in EXEC_SUFFIX) return { dir: cardsDir(root, OPEN), suffix: EXEC_SUFFIX[token] };
  return { dir: cardsDir(root, token), suffix: '' };
}
function cardName(root, id, token) { return `${id}${cardLoc(root, token).suffix}.md`; }
function cardFile(root, token, name) { return path.join(cardLoc(root, token).dir, name); }
function listCards(root, token) {
  // 三态板里 blocked 不是位置：若仍去扫 cards/blocked/，同一张卡会「既被当活卡统计、又被残卡红灯判一次」。
  // 迁板后该目录里的卡只由 verify 的残卡红灯报告（给出可照做的改名目标），不参与卡位统计。
  if (token === 'blocked' && threeState(root)) return [];
  const { dir, suffix } = cardLoc(root, token);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && (suffix ? f.endsWith(suffix + '.md') : !/\.(claimed|review)\.md$/.test(f)))
    .sort();
}
// 文件名 → { id, token }：三态板用文件名后缀判执行态（done/archived/held 无后缀）
function parseCardName(name) {
  const base = name.replace(/\.md$/, '');
  const m = base.match(/^(.+)\.(claimed|review)$/);
  return m ? { id: m[1], token: m[2] } : { id: base, token: null };
}
// 卡 id 一律经此函数从文件名取：三态板里 `75-c01-x.claimed.md` 的 id 是 `75-c01-x`，
// 直接 replace(/\.md$/,'') 会把执行态后缀当 id 的一部分（分支名、依赖闸门、worktree 判定全跟着错）。
const cardIdOf = name => parseCardName(name).id;

// ---------- init ----------
function cmdInit(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const base = arg(argv, 'branch') || 'main';
  const repoDirArg = arg(argv, 'repo-dir');
  // in-project（统一布局）：--in-project 显式、--repo-dir 指向 root 自身、或 root 已是带 .scratch/ 的
  // git 仓且未给 --repo-dir —— 三种都按「看板与 worktree 直接建在项目里」处理，项目自身即权威仓。
  const inProject = flag(argv, 'in-project')
    || (repoDirArg !== undefined && path.resolve(repoDirArg) === root)
    || (repoDirArg === undefined && fs.existsSync(path.join(root, '.git')) && fs.existsSync(path.join(root, '.scratch')));
  const repoDir = inProject ? root : path.resolve(repoDirArg || path.join(root, 'repo'));
  let repoUrl = arg(argv, 'repo') || '';
  if (inProject && !repoUrl) {
    try { repoUrl = git(root, 'remote', 'get-url', 'origin'); } catch { repoUrl = ''; }
  }
  if (!inProject && !repoUrl) die('缺少 --repo <git-url>（in-project 模式可省，自动取 origin remote）');
  fs.mkdirSync(root, { recursive: true });

  const actions = [];
  if (inProject) {
    if (!fs.existsSync(path.join(root, '.git'))) die(`--in-project 但 ${root} 不是 git 仓库`);
    actions.push(['kept', `${root} — in-project 模式：项目自身即权威仓，wt/ 与 control/ 落在项目里`]);
  } else if (fs.existsSync(path.join(repoDir, '.git'))) {
    actions.push(['kept', `${repoDir} — 已有权威仓库，未动`]);
  } else if (repoDir === path.join(root, 'repo')) {
    fs.mkdirSync(repoDir, { recursive: true });
    try { git(root, 'clone', repoUrl, 'repo'); } catch (e) {
      die(`clone 失败：${e.stderr?.toString().split('\n')[0] || e.message}（clone 半截目录已保留，修复后重跑会报 kept，可手动删除 repo/ 重试）`);
    }
    actions.push(['created', `repo/ — clone 自 ${repoUrl}`]);
  } else {
    die(`--repo-dir ${repoDir} 不是 git 仓库；指定权威工作区路径，或省略本参数让 init 自建 repo/`);
  }
  try { git(repoDir, 'rev-parse', '--verify', base); }
  catch { die(`${repoDir} 上不存在基准分支 ${base}，用 --branch 指定正确分支`); }
  if (inProject) {
    // 产品仓 .gitignore 幂等补 wt/ 与 control/：worktree 与看板都不进产品仓历史
    const gi = path.join(root, '.gitignore');
    const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    const add = ['wt/', 'control/'].filter(l => !cur.split(/\r?\n/).some(x => x.trim() === l));
    if (add.length) {
      fs.writeFileSync(gi, (cur.trim() ? cur.replace(/\s*$/, '') + '\n' : '') + add.join('\n') + '\n');
      actions.push(['updated', `.gitignore — 补 ${add.join('、')}（worktree 与看板不入产品仓）`]);
    }
  }

  fs.mkdirSync(path.join(root, 'wt'), { recursive: true });
  // 三态目录（D9）：open = 未收口 · done = 已收口 · archived = 废弃/让位；held 仍是领导者暂缓道（control/held/）
  for (const s of LANE_DIRS) fs.mkdirSync(cardsDir(root, s), { recursive: true });
  fs.mkdirSync(cardsDir(root, HELD), { recursive: true });
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
    JSON.stringify({ root, repoUrl, repoPath: repoDir, baseBranch: base, mode: inProject ? 'in-project' : 'external', createdAt: localIso() }, null, 2));

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
  // 取值只能停在行内：`\s*(.+)\s*$` 的 \s 会吞掉换行，于是「- doc_ref: （空）」会把下一行的内容
  // 抄成自己的值（实测把下一行 `- PRD: …` 当成了 doc_ref，verify 立刻假报「doc_ref 不是 URL」）。
  // 这是 0.9.3「正文里的 - PRD: 被当卡头字段」的同型坑，故字符类一律用 [^\r\n]。
  const f = k => clean((b.match(new RegExp('^- ' + k + ':[ \\t]*([^\\r\\n]*?)$', 'm')) || [])[1] || '');
  const prdRaw = f('PRD');
  return { title: f('标题'), level: f('难度'), model: f('模型档位'), by: f('领取者'),
    prd: /\.md$/i.test(prdRaw) ? prdRaw : '', branch: f('分支'), wt: f('worktree'), deps: f('依赖'),
    // labels = triage 维度（与目录/文件名执行态正交）；doc_ref = 服务器工单 URL（薄卡指针，手填 `<部署域>/tickets/<id>`）
    labels: f('labels'), docRef: f('doc_ref'),
    // 合入目标（v0.14.0 起一律 main，默认回合主分支；受阻暂存是协议层降级，不改卡面值）
    mergeTarget: f('合入目标'),
    // 处理计时三字段 = 统计面（谁在哪个 harness 上、用哪个模型办的、什么时候开始/结束），由 card-move 自动盖章。
    // 它们**不参与状态判定**：执行态的唯一真源仍是文件名后缀（ADR-004 的原子 rename 防抢），
    // 字段缺失或写歪只会让看板少显示一行，绝不会把卡的位置判错——这是与 ADR-008 被否方案①的分界。
    harness: f('Harness'), llm: f('LLM'), startAt: f('开始处理'), endAt: f('结束处理') };
}
// labels 行宽松解析：逗号/顿号/空格分隔均可，无脑去空与去重；只认五标签，其余值原样保留供 verify 报警
function parseLabels(line) {
  return [...new Set((line || '').split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean))];
}
// labels 行 upsert：有该行就追加（已含则原样返回），没有就插到 `- 依赖:` / `- 目标:` 前。
// card-move --to blocked 靠它把「受阻」落到标签上（三态后 blocked 不再是目录）。
function addLabel(body, label) {
  const line = (body.match(/^- labels:[^\r\n]*/m) || [])[0];
  if (line !== undefined) {
    // 函数式替换：line 是卡面原文，字符串形式下其中的 `$&`/`$'` 会被展开成整段文本（同 cmdCardSet 的坑）
    return parseLabels(line.replace(/^- labels:\s*/, '')).includes(label)
      ? body
      : body.replace(/^- labels:[^\r\n]*/m, () => `${line.trimEnd()} ${label}`);
  }
  const ins = re => body.replace(re, m => `- labels: ${label}${eolOf(body)}${m}`);
  if (/^- 依赖:/m.test(body)) return ins(/^- 依赖:[^\r\n]*/m);
  if (/^- 目标:/m.test(body)) return ins(/^- 目标:[^\r\n]*/m);
  return body.replace(/^# [^\r\n]*\r?\n/, m => `${m}${eolOf(body)}- labels: ${label}${eolOf(body)}`);
}
// ---------- 卡头字段 upsert（card-move 自动盖处理时间戳用）----------
// 只在卡头字段块（第一个 `## ` 小节之前）里定位，且锚点取「已知字段名」的最后一行：
// 流转段的 `- 2026-09-30 10:21 | inbox->claimed | …` 同样形如 `- x:`（时间在冒号前），泛匹配会把它当字段块尾巴插进去。
const HEADER_KEYS = ['标题', '难度', '模型档位', '领取者', 'Harness', 'LLM', '开始处理', '结束处理', '依赖', '目标', '完成度',
  'labels', 'doc_ref', 'PRD', '分支', 'worktree'];
function setField(body, key, value) {
  // 值里的换行会注入出第二条卡头行——账本侧有 cell() 做同样的净化，卡面没理由不做
  const v = String(value ?? '').replace(/[\r\n]+/g, ' ');
  // 替换与插入**都限定在卡头字段块内**：原先替换路径扫全文，于是「卡头缺这一行 + 小节里有人手写了同名 `- Harness:`」
  // 会让字段被写进小节、卡头永远补不上（审查 High：本文件自己写下的「泛匹配」教训又踩了一遍）。
  const cut = body.search(/^## /m);
  const head = cut < 0 ? body : body.slice(0, cut);
  const rest = cut < 0 ? '' : body.slice(cut);
  const re = new RegExp(`^- ${key}:[^\\r\\n]*(\\r?\\n)`, 'm');
  if (re.test(head)) return head.replace(re, (_, eol) => `- ${key}: ${v}${eol}`) + rest;
  const KEYS = HEADER_KEYS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const anchor = new RegExp(`^- (?:${KEYS}):[^\\r\\n]*(\\r?\\n)`, 'gm');
  let end = -1, eol = '\n', m;
  while ((m = anchor.exec(head))) { end = m.index + m[0].length; eol = m[1]; }
  if (end < 0) { const h1 = /^#[^\r\n]*(\r?\n)/.exec(head); end = h1 ? h1[0].length : 0; if (h1) eol = h1[1]; }
  return head.slice(0, end) + `- ${key}: ${v}` + eol + head.slice(end) + rest;
}
// 取 body 的主导换行符，供所有「往既有文件里插一行」的写回共用（写死 `\n` 会让 CRLF 卡变成混合换行）
// 零换行输入（空串 / 单行且无行尾）两侧计数同为 0，原实现 `0 >= 0` 会返回 CRLF——空文件插一行就变 CRLF（审查 STD-06）。
// 无换行可继承时回退 LF：这是本脚本所有新写文件的默认风格。
const eolOf = s => {
  const t = String(s ?? '');
  if (!t.includes('\n')) return '\n';
  return (t.match(/\r\n/g) || []).length >= (t.match(/[^\r]\n/g) || []).length ? '\r\n' : '\n';
};
// 流转追加段的移卡行：`- 2026-09-30 10:21 | inbox->claimed | 角色 | 原因 [| 🛠harness/模型]`
// v0.11.0 之前的卡没有 开始处理/结束处理 字段，看板靠这里回推出时间，旧版卡升级当天就有读数。
// 分隔符一律用 [ \t] 不用 \s——\s 会吞换行，把下一行的内容配成本行的读数（本文件 152-154 记着的同型坑）。
function flowTimes(body) {
  let inAt = '', outAt = '';
  const re = /^- (\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2})?)?)[ \t]*\|[ \t]*(\w+)->(\w+)[ \t]*\|/gm;
  for (const m of String(body).replace(/\r/g, '').matchAll(re)) {
    if (m[3] === 'claimed') inAt = m[1];
    else if (m[2] === 'claimed') outAt = m[1];
  }
  return { inAt, outAt };
}
// 往「流转追加段」追加一行。**小节不存在时先建段再追加**：原先直接 `body.replace(/## 流转追加段…/)`，
// 缺段时 replace 原样返回，而命令照样打印「已记账 + 刷看板」——卡内流转行静默丢失（审查 STD-01，PROBE1 实证：
// 改名成功、账本有行、卡内无行）。流转行是审计面，老板卡的计时回退读数也靠它，缺段只能补、不能吞。
function appendFlowLine(body, line) {
  if (/^## 流转追加段[ \t]*$/m.test(body)) {
    return body.replace(/(## 流转追加段[\s\S]*?)(\n## |\n?$)/, (m, sec, tail) => `${sec.trimEnd()}\n\n${line}\n${tail}`);
  }
  const eol = eolOf(body);
  return body.replace(/\s*$/, '') + `${eol}${eol}## 流转追加段${eol}${eol}${line}${eol}`;
}
const stampMs = s => {
  if (!s) return null;
  const t = Date.parse(String(s).trim().replace(/^(\d{4}-\d{2}-\d{2})[ ]/, '$1T'));
  return Number.isFinite(t) ? t : null;
};
function durFmt(ms) {
  if (!(ms >= 0)) return '';
  const m = Math.round(ms / 6e4);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d${h % 24}h`;
}
// 一张卡的处理计时读数：字段优先，缺则回退流转段。
// 只认「能解析的时间」：解析不了的（手填的散文、被截断的串）标 badStart/badEnd 交给显示层报无效，
// 绝不能拿原始字符串截 11 个字冒充一个干净时间（审查发现项：`- 开始处理: " onload="alert(9)` 曾显示成 `▶  onload="ale`）。
const UNSET = '（未标注）';
function procOf(fields, body) {
  const ft = flowTimes(body);
  const rawStart = fields.startAt || ft.inAt;
  const rawEnd = fields.endAt || ft.outAt;
  const s = stampMs(rawStart), e = stampMs(rawEnd);
  let end = e === null ? '' : rawEnd;
  // 结束早于开始（重领未清、时钟回拨）或压根没有开始 ⇒ 不显示结束，宁可少一行也不臆造「用时 0m」
  if (end && (s === null || e <= s)) end = '';
  // 卡面写「（未标注）」是给读卡的 agent 看的占位；看板要的是红字告警，不能把它当成一个 harness/模型名
  return {
    harness: fields.harness === UNSET ? '' : fields.harness,
    llm: fields.llm === UNSET ? '' : fields.llm,
    start: s === null ? '' : rawStart, end,
    badStart: s === null && rawStart ? rawStart : '',
    badEnd: e === null && rawEnd ? rawEnd : '',
  };
}
function scanBoard(root) {
  return LANES.map(s => ({ state: s, cards: listCards(root, s).map(c => {
    const body = fs.readFileSync(cardFile(root, s, c), 'utf8');
    const { id } = parseCardName(c);
    const f = cardFields(body);
    return { id, token: s, merge: /^merge-/.test(id), wtExists: fs.existsSync(path.join(root, 'wt', id)),
      ...f, ...procOf(f, body) };
  }) }));
}
// 依赖闸门口径：只认依赖行里写全卡 id 的依赖（如 69-03-gateway-refresh-and-proxy-leg）；
// 该卡已归档 done 才算就绪；简写（"01"）、裸编号（"69-03"）与散文描述不参与判定；
// 依赖行以「无」开头（含"无——软引用/联动说明"这类散文）视为无硬依赖。merge 卡豁免——它在开发卡过审后投出。
function pendingDeps(root, depsLine, selfId) {
  if (!depsLine || /^无/.test(depsLine.trim()) || /^merge-/.test(selfId)) return [];
  const known = new Set();
  for (const s of LANES) for (const c of listCards(root, s)) known.add(cardIdOf(c));
  const doneIds = new Set(listCards(root, 'done').map(cardIdOf));
  return [...new Set((depsLine.match(/\d+-[a-z0-9][a-z0-9-]*/g) || []))]
    .filter(t => t !== selfId && known.has(t) && !doneIds.has(t));
}

// ---------- board ----------
function cmdBoard(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const showAll = flag(argv, 'all');
  if (!threeState(root)) console.log('（看板仍是五泳道布局：跑 board.mjs migrate --root <root> 迁三态。概览照旧可读，命令不受影响。）');
  for (const col of scanBoard(root)) {
    // held（领导者暂缓道）与三态下不再存在的 blocked 道：空则整段不报，免噪声
    if ((col.state === HELD || col.state === 'blocked' || col.state === 'archived') && !col.cards.length) continue;
    console.log(`\n== ${STATE_LABEL[col.state]} (${col.cards.length}) ==`);
    // 收口/归档两道历史无限增长（2026-09-30 时 done 254 张，全量打印一次约 12k token），默认只报计数。
    // 逐卡明细用 --all，或直接看 control/board.html。
    if ((col.state === 'done' || col.state === 'archived') && !showAll) {
      if (col.cards.length) console.log(`  （${col.cards.length} 张，明细见 control/board.html 或加 --all）`);
      continue;
    }
    for (const c of col.cards) {
      const pend = (col.state === 'inbox' || col.state === HELD) ? pendingDeps(root, c.deps, c.id) : [];
      console.log(`  [${c.level || '?'}] ${c.id}.md${c.title ? ` — ${c.title}` : ''}${c.by ? `  [${c.by}]` : ''}${c.labels ? `  {${c.labels}}` : ''}${pend.length ? `  ⛓ 等依赖: ${pend.join(', ')}` : ''}`);
    }
  }
}

// ---------- html ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fileHref = p => /^[A-Za-z]:[\\/]/.test(p) ? 'file:///' + p.replace(/\\/g, '/') : '';
const LV_COLOR = { L1: '#6b7280', L2: '#2563eb', L3: '#d97706', L4: '#dc2626' };
// 终端 `board` 的泳道标题 = TOKEN_TEXT 派生（词汇单源，见 TOKEN_TEXT 上方注释）
const STATE_NOTE = { blocked: '（三态板由 needs-info 标签表达）', held: '（worker 不可领）' };
const STATE_LABEL = Object.fromEntries(LANES.map(t => [t, `${TOKEN_TEXT[t]} ${t}${STATE_NOTE[t] || ''}`]));
// triage 五标签色标（验收 #3）：与难度徽标 LV_COLOR 分属两个维度，渲染在同一张卡上互不覆盖。
const LABEL_COLOR = { 'ready-for-agent': '#34d399', 'ready-for-human': '#f59e0b', 'needs-info': '#fb7185', 'needs-triage': '#a78bfa', 'wontfix': '#6b7280' };
const TOKEN_COLOR = { inbox: '#34d399', claimed: '#60a5fa', review: '#d97706', done: '#6b7280', archived: '#6b7280', blocked: '#fb7185', held: '#f59e0b' };

const shortStamp = s => String(s).replace(/^\d{4}-/, '').replace('T', ' ').slice(0, 11);
// 「显示已完成」是**用户级视图偏好**，不是页面级：工单看板与 PRD 看板共用同一段脚本骨架与同一个键，
// 任一页展开后另一页也跟着展开（各存各的会让「默认隐藏」在两页之间自相矛盾）。
// 键必须按 root 分名：file:// 下浏览器把所有本地页当同一 origin，不分名会让本机所有工作区的看板互相串改。
// 落盘 localStorage 是硬要求：两页每 5s / 10s 靠 meta refresh 整页重载，不落盘的话刚点开就被刷新收回去。
const histKeyOf = root => 'showHistory:' + root;
const histScript = (root, sel, histCols = 0, baseCols = 0) => `
const K=${JSON.stringify(histKeyOf(root))};
const sh=document.getElementById('sh');
if(sh){const cols=document.querySelector('.cols');
const apply=()=>{const on=sh.checked;document.querySelectorAll('${sel}').forEach(el=>{el.style.display=on?'':'none'});
if(cols)cols.style.setProperty('--nc',String(Math.max(${baseCols}+(on?${histCols}:0),3)))};
try{sh.checked=localStorage.getItem(K)==='1'}catch(e){}
sh.addEventListener('change',()=>{apply();try{localStorage.setItem(K,sh.checked?'1':'0')}catch(e){}});apply();}`;
// 三页的「复制提示词」按钮骨架同源（此前是逐字抄的三份，其中 prd.html 那份还漏了监听器、点了没反应）。
// file:// 下 navigator.clipboard 常不可用，textarea + execCommand 的兜底不能省。
const copyScript = (store, sel, dataKey, idle, ok) => `
document.querySelectorAll('${sel}').forEach(b=>b.addEventListener('click',async()=>{
const t=${store}[b.dataset.${dataKey}]||'';
try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}
b.textContent='${ok}';b.classList.add('done');
setTimeout(()=>{b.textContent='${idle}';b.classList.remove('done')},2500);
}));`;

function renderHtml(root, meta, cols, starters) {
  const byToken = Object.fromEntries(cols.map(c => [c.state, c]));
  const cardsOf = t => (byToken[t]?.cards || []).map(c => ({ ...c, token: t }));
  const three = threeState(root);
  // 泳道 = **未收口 token 全集**（UNRESOLVED_TOKENS，与 verify 第 5 路、migrate 残卡红灯同源），列名 = TOKEN_TEXT 单源。
  // 三态板取文件名后缀、旧五泳道板取目录名，两种布局出同一套列；空列也渲染，列结构不随卡片增减抖动。
  // 三态板没有 blocked/ 目录，受阻 = 待领位 + needs-info（ADR-008），于是把带该标签的卡从待领取列**摘进**阻塞列，一卡只落一列。
  // **旧板不按标签改道**：那里的位置真源就是目录，陈旧 needs-info 会把能干活的卡藏进阻塞列（审查发现项）。
  const blockedByLabel = three ? cardsOf('inbox').filter(c => parseLabels(c.labels).includes('needs-info')) : [];
  const blockedIds = new Set(blockedByLabel.map(c => c.id));
  const lanes = [];
  for (const t of UNRESOLVED_TOKENS) {
    let cards = cardsOf(t);
    if (t === 'inbox') cards = cards.filter(c => !blockedIds.has(c.id));
    if (t === 'blocked') cards = [...cards, ...blockedByLabel];
    lanes.push({ token: t, label: TOKEN_TEXT[t], cards });
  }
  // 已完成 / 已归档是历史面，只增不减（2026-09-30 曾积累到 254 张）⇒ 默认不显示，页头开关展开。
  // 展开时也只渲染末尾 HIST_RENDER 张并在列内明写还剩多少：整页 markup 每 5s 重解析一次，全量铺开会卡顿；
  // 计数仍报真实总数，不静默当没这些卡。
  const hist = ['done', 'archived'].map(t => ({ token: t, label: TOKEN_TEXT[t], cards: cardsOf(t) }));
  const heldCards = cardsOf(HELD);
  const shown = heldCards.length ? [...lanes, { token: HELD, label: '暂缓·等依赖', cards: heldCards }] : lanes;
  const active = shown.reduce((n, g) => n + g.cards.length, 0);
  const histTotal = hist.reduce((n, g) => n + g.cards.length, 0);
  const prompts = {};
  const procLine = c => {
    const live = c.token === 'claimed';
    const who = [c.harness, c.llm].filter(Boolean).join(' · ');
    if (!live && !who && !c.start && !c.end && !c.badStart && !c.badEnd) return '';
    const seg = [];
    if (who) seg.push(`🛠 ${esc(who)}`);
    // 只在「处理中」这一条泳道告警：别的泳道缺标注是常态（旧卡、领导者手移的卡），满屏红字等于没有红字
    else if (live) seg.push('<span class="warn" title="领卡时用 card-move --to claimed --harness 名 --llm 模型 自报">🛠 harness/模型未标注</span>');
    if (c.badStart) seg.push(`<span class="warn" title="${esc(c.badStart)}">▶ 开始时间无法解析</span>`);
    else if (c.start) {
      const s = stampMs(c.start);
      seg.push(`▶ ${esc(shortStamp(c.start))}${live ? ` <span class="tip" title="${esc(c.start)}">已办 <b>${durFmt(Date.now() - s)}</b></span>` : ''}`);
    }
    if (c.badEnd) seg.push(`<span class="warn" title="${esc(c.badEnd)}">⏹ 结束时间无法解析</span>`);
    else if (c.end) {
      const s = stampMs(c.start), e = stampMs(c.end);
      seg.push(`⏹ <span class="tip" title="${esc(c.end)}">${esc(shortStamp(c.end))}</span>${e > s ? ` · 用时 ${durFmt(e - s)}` : ''}`);
    }
    return `<div class="proc">${seg.join('　')}</div>`;
  };
  const cardsHtml = c => {
    const prd = c.prd && fileHref(c.prd) ? `<a href="${esc(fileHref(c.prd))}" target="_blank" rel="noopener" title="${esc(c.prd)}">PRD</a>` : '';
    const docref = c.docRef && /^https?:\/\//i.test(c.docRef) ? `<a href="${esc(c.docRef)}" target="_blank" rel="noopener" title="${esc(c.docRef)}">服务器工单 ↗</a>` : '';
    const wtLine = c.wt ? `<div class="wt">📁 ${esc(c.wt)} ${c.wtExists ? '<span class="ok">已预开</span>' : '<span class="no">未创建</span>'}</div>` : '';
    const starter = starters[c.merge ? 'merger' : 'dev'] || '';
    prompts[c.id] = starter + `\n\n---\n本次指定：优先领取卡片 \`${c.id}\`（难度 ${c.level || '?'}）。` +
      (c.wtExists ? `工作区已预开：${c.wt}，领卡 move 成功后直接进入装依赖开工。` : `领卡后按协议 §1 用 add-wt 开辟工作区。`) +
      // 任务提示词自带环境自报要求：看板的「处理中」泳道与卡内流转段全靠这两项，靠协议条文提醒不够（worker 会先粘这段提示词）
      `\n\n**每一步都要自报处理环境**（协议 §4）：领卡跑 \`board.mjs card-move --id ${c.id} --to claimed --actor <你的会话标识> --harness <你所在的 harness 名，如 Qoder / Claude Code / CodeBuddy> --llm <你实际调用的模型名，如 claude-sonnet-4.5>\`；` +
      '交付 / 受阻 / 返工同命令换 `--to` 再报一次。你没自报，看板上这条卡就是红字「harness/模型未标注」，用户无法知道是谁、用什么模型在做。';
    const pend = (c.token === 'inbox' || c.token === HELD) ? pendingDeps(root, c.deps, c.id) : [];
    const depNote = pend.length ? `<div class="dep">⛓ 等依赖未归档: ${esc(pend.join('、'))}</div>` : '';
    const btn = c.token === HELD
      ? '<div class="m">⏸ 暂缓中：依赖归档后由领导者 mv 回 open 释放</div>'
      : '<button class="cp" data-id="' + esc(c.id) + '">📋 复制启动提示词</button>';
    const chips = parseLabels(c.labels).map(l => `<span class="lb" style="background:${(LABEL_COLOR[l] || '#6b7280') + '22'};border-color:${LABEL_COLOR[l] || '#6b7280'};color:${LABEL_COLOR[l] || '#cbd5e1'}">${esc(l)}</span>`).join('');
    return `<div class="card${c.merge ? ' merge' : ''}${c.token === HELD ? ' heldc' : ''}">
<span class="lv" style="background:${LV_COLOR[c.level] || '#6b7280'}">${esc(c.level || '?')}</span><span class="tk" style="border-color:${TOKEN_COLOR[c.token] || '#6b7280'}">${esc(TOKEN_TEXT[c.token] || c.token)}</span>${chips}
<b>${esc(c.id)}</b>${c.merge ? '<span class="tagm">合并</span>' : ''}
<div class="t">${esc(c.title || '')}</div>
${procLine(c)}${wtLine}${depNote}
<div class="m">${c.by ? `👤 ${esc(c.by)}　` : ''}${c.deps && c.deps !== '无' ? `⛓ ${esc(c.deps)}　` : ''}${prd}${docref ? `　${docref}` : ''}${c.branch ? `　⎇ ${esc(c.branch)}` : ''}</div>
${btn}
</div>`;
  };
  // 历史列展开时单次渲染上限：页每 5s 整页重载，254 张全量铺开会把展开这一下变成卡顿。
  // 计数仍报真实总数、列内明写「还有 M 张未渲染」，不静默当这些卡不存在。
  const HIST_RENDER = 60;
  const colHtml = (g, isHist) => {
    const cards = isHist ? g.cards.slice(-HIST_RENDER) : g.cards;
    let inner = cards.map(cardsHtml).join('');
    if (!inner) inner = '<div class="none">（空）</div>';
    const rest = g.cards.length - cards.length;
    if (rest > 0) inner += `<div class="none">仅渲染最近 ${cards.length} / ${g.cards.length} 张，另 ${rest} 张见 board --all 或 control/cards/${g.token}/</div>`;
    const hide = isHist ? ' style="display:none"' : '';
    return `<div class="col${isHist ? ' hist' : ''}"${hide}><h2>${esc(g.label)} (${g.cards.length})</h2>${inner}</div>`;
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
.none{color:#4b5563;font-size:12px;text-align:center;padding:16px 0}
.card{background:#1e2430;border:1px solid #2b3342;border-radius:8px;padding:8px 10px;margin-bottom:8px}
.card.merge{border-color:#7c3aed55}
.lv{color:#fff;border-radius:4px;font-size:11px;padding:1px 6px;margin-right:6px}
.tagm{color:#a78bfa;font-size:11px;margin-left:6px}
.t{margin:2px 0;color:#d1d5db}.m{color:#8b94a3;font-size:12px;word-break:break-all}
.proc{color:#9fb0c8;font-size:12px;margin:2px 0;font-variant-numeric:tabular-nums}
.proc b{color:#e5e7eb}.warn{color:#fb7185}.tip{cursor:help}
.wt{color:#8b94a3;font-size:11px;word-break:break-all;margin:2px 0}
.ok{color:#34d399;font-size:11px}.no{color:#6b7280;font-size:11px}
.dep{color:#f59e0b;font-size:12px;margin:2px 0}
.lb{font-size:11px;border:1px solid;border-radius:999px;padding:0 6px;margin-left:4px}
.tk{font-size:11px;border:1px solid;border-radius:4px;padding:0 5px;margin-right:6px;color:#cbd5e1}
.card.heldc{opacity:.75;border-style:dashed}
.cp{margin-top:6px;background:#2b3342;color:#cbd5e1;border:1px solid #3b4356;border-radius:6px;font-size:12px;padding:3px 8px;cursor:pointer}
.cp:hover{background:#3b4356}.cp.done{background:#064e3b;border-color:#34d399;color:#6ee7b7}
a{color:#60a5fa;text-decoration:none}
.nav{margin-left:4px;font-size:13px;color:#60a5fa;text-decoration:none;border:1px solid #2b3342;padding:4px 10px;border-radius:8px;background:#161a22}
.nav:hover{background:#1e2430}
.tg{font-size:12px;color:#9ca3af;display:inline-flex;align-items:center;gap:5px;cursor:pointer;user-select:none}
.tg input{accent-color:#3b82f6;cursor:pointer}
footer{margin-top:10px;color:#6b7280;font-size:12px}
</style></head><body>
<header><h1>工单公告板</h1><a class="nav" href="prd.html" target="_blank" rel="noopener">PRD 看板 →</a><a class="nav" href="human.html" target="_blank" rel="noopener">人工待办面板 →</a>${histTotal ? `<label class="tg"><input type="checkbox" id="sh">显示${hist.map(g => `${g.label} (${g.cards.length})`).join('与')}</label>` : ''}<span class="info">${esc(root)} · 权威仓 ${esc(meta.repoPath || '')} · 基准 ${esc(meta.baseBranch)} · 在办 ${active}（${lanes.map(g => `${g.label} ${g.cards.length}`).join(' · ')}）${heldCards.length ? ` · 暂缓 ${heldCards.length}` : ''} · 历史 ${histTotal} 张默认隐藏 · 生成于 ${localIso()} · 每 5s 自动刷新</span></header>
<div class="cols" style="--nc:${Math.max(shown.length, 3)}">${shown.map(g => colHtml(g, false)).join('')}${hist.map(g => colHtml(g, true)).join('')}</div>
<footer>协议真源 control/PROTOCOL.md · 领导者账本 control/ledger.md · 四泳道 = 执行态 token（${lanes.map(g => g.label).join(' / ')}；三态板取文件名后缀、旧板取目录名，needs-info 改道阻塞列只在三态板生效），「已完成 / 已归档」属历史面默认折叠 · 卡上计时读数＝🛠 处理者 Harness · 实际模型 ▶ 开始处理（在办时附已办时长）· ⏹ 结束处理（附本轮用时），由 card-move 进出 claimed 位自动盖章、卡面缺行时回退卡内流转段 · 色标 = triage 五标签（labels 行），徽标 = 执行态 token · 复制按钮 = 对应角色 starter 提示词 + 指定卡号 + 环境自报要求，贴给新拉起会话即可开工 · 工单级执行 = /jxx-implement 领卡推进；整份 PRD 一次交付请用 PRD 看板的整轨提示词（/jxx-implement-spec）</footer>
<script>const PROMPTS=${JSON.stringify(prompts).replace(/</g, '\\u003c')};${copyScript('PROMPTS', '.cp', 'id', '📋 复制启动提示词', '✔ 已复制，去粘贴给新会话')}${histScript(root, '.col.hist', hist.length, shown.length)}</script>
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
    + `<script>const PROMPTS=${JSON.stringify(prompts).replace(/</g, '\\u003c')};${copyScript('PROMPTS', '.cp', 'id', '📋 复制决策提示词', '✔ 已复制，去贴给新会话拍板')}</script>`
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
function renderPrdHtml(root, meta, cols) {
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
    ['in-flight', '🔄 在办（已有卡：open/ 三位（待领·在办·待终审）或 held）'],
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
  const rendered = prds.map(p => {
    const groups = Object.fromEntries(ISSUE_GROUP.map(([k]) => [k, []]));
    for (const it of p.issues) {
      const st = (it.status || 'unknown').toLowerCase();
      const card = issueCard.get(it.name) || issueCard.get(`${p.num}-${(it.name.match(/^(\d+)-/) || [])[1]}`);
      let gk = 'other';
      if (card && ['inbox', HELD, 'claimed', 'review', 'blocked'].includes(card.state)) gk = 'in-flight';
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
    prdPrompts[p.code] = '【PRD 级整轨执行 · ' + p.code + ' ' + p.title + '】\n工作区（权威仓）：' + meta.repoPath + '\nPRD：' + p.file + '\n工单任务图：.scratch/' + p.code + '/issues/*.md（各工单 **Status:** 与 **Blocked by:** 已声明阻塞关系）\n\n请用 /jxx-implement-spec 技能整轨推进本 PRD：\n1) 读 PRD 与全部工单，构建任务图，识别就绪前沿（Blocked by 全部 done 的工单）；\n2) 单分支交付：从 ' + (meta.baseBranch || 'main') + ' 建分支 ticket/' + p.code + '-spec，先开 draft PR；\n3) 后台子 agent 并发实现前沿工单，每收口一张即更新该工单 **Status:** 与验收勾选框，前沿推进继续派发；\n4) 全部工单 done 后跑 /jxx-code-review 审整支分支，修复后转 ready；\n5) 完成判据：本 PRD 全部工单 Status=done 且验收全勾。\n注意：若工单看板已有本 PRD 的在办卡（open/ 里的 .claimed/.review 位），先与用户确认走整轨还是分轨，勿双轨并作。\n\n**每一步都要自报处理环境**（协议 §4）：每个子 agent 领卡时跑 `board.mjs card-move --id <卡id> --to claimed --actor <会话标识> --harness <harness 名> --llm <模型名>`；交付 / 受阻 / 返工同命令换 `--to` 再报一次。你没自报，看板上这条卡就是红字「harness/模型未标注」，用户无法知道是谁、用什么模型在做。';
    // 一份 PRD 算「已完成」的两条判据（任一成立）：全部工单收口（done/wontfix），或 PRD 自身 Status 已收口。
    // 零工单不算完成——那是还没拆，属未做的事而不是做完的事。
    const closed = (total > 0 && doneN === total) || /^done$|^wontfix$/i.test(p.status);
    return { closed, html: `<div class="prd${closed ? ' closed' : ''}"><div class="phead"><b class="pcode">${esc(p.code)}</b><a class="ptitle" href="${esc(p.href || '')}" target="_blank" rel="noopener">${esc(p.title)}</a><span class="pst">${esc(prdSt)}</span><span class="pprog">${doneN}/${total} 工单收口 · ${pct}%</span><button class="cp-prd" data-prd="${esc(p.code)}">📋 PRD 级整轨提示词</button></div>${groupHtml}</div>` };
  });
  const openPrds = rendered.filter(r => !r.closed), donePrds = rendered.filter(r => r.closed);
  const listHtml = arr => `<div class="list">${arr.map(r => r.html).join('')}</div>`;
  const sectHtml = (title, arr, isHist) => `<section class="sect${isHist ? ' hist' : ''}"${isHist ? ' style="display:none"' : ''}><h2 class="sh2">${esc(title)} (${arr.length})${isHist ? '<span class="n"> · 判据：全部工单收口（done/wontfix）或 PRD 自身 Status 已收口</span>' : ''}</h2>${arr.length ? listHtml(arr) : '<div class="empty">（无）</div>'}</section>`;
  const totalFrontier = prds.reduce((n, p) => n + p.issues.filter(it => /^ready-for-agent$/i.test(it.status) ).length, 0);
  // 一份 PRD 都没有时整页只剩空态；已完成栏为空就不渲染（不给页头留一个点开无内容的开关）
  let bodyHtml = sectHtml('未完成 PRD', openPrds, false);
  if (!prds.length) bodyHtml = '<div class="empty">权威仓 .scratch/ 下还没有 &lt;NN-slug&gt;/PRD.md + issues/ 结构——先用 jxx-to-spec 出 PRD、jxx-to-tickets 拆工单，再刷新本页。</div>';
  else if (donePrds.length) bodyHtml += sectHtml('已完成 PRD', donePrds, true);
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
.sect{max-width:920px;margin:0 auto}
.sh2{font-size:13px;color:#9ca3af;margin:20px auto 8px;letter-spacing:.04em;text-transform:uppercase}
.sh2 .n{color:#6b7280;font-weight:400;letter-spacing:0;text-transform:none;font-size:12px}
.sect .list{margin:0}
.prd.closed{opacity:.9}.prd.closed .pcode{background:#166534}
.tg{margin-left:12px;font-size:12px;color:#9ca3af;display:inline-flex;align-items:center;gap:5px;cursor:pointer;user-select:none}
.tg input{accent-color:#3b82f6;cursor:pointer}
footer{max-width:920px;margin:18px auto 0;color:#6b7280;font-size:12px}
</style></head><body>
<header><h1>PRD 看板</h1><a class="nav" href="board.html" target="_blank" rel="noopener">工单看板 →</a><a class="nav" href="human.html" target="_blank" rel="noopener">人工待办 →</a>${donePrds.length ? `<label class="tg"><input type="checkbox" id="sh">显示已完成 PRD (${donePrds.length})</label>` : ''}
<div class="info">执行分流：整份 PRD 一次交付 → 点「PRD 级整轨提示词」复制给新会话跑 /jxx-implement-spec · 单工单推进 → 工单看板领卡跑 /jxx-implement · ${prds.length} 份 PRD（未完成 ${openPrds.length} · 已完成 ${donePrds.length}）· 前沿可领 ${totalFrontier} 张工单 · 权威仓 ${esc(meta.repoPath || '')} · 生成于 ${localIso()} · 每 10s 刷新</div></header>
${bodyHtml}
<footer>数据源＝权威仓 .scratch/&lt;NN-slug&gt;/PRD.md + issues/*.md 的 **Status:** 行 · 本页按 PRD 收口态分两栏：未完成（还有工单没收口）/ 已完成（全部工单 done·wontfix，或 PRD 自身 Status 已收口）——已完成默认隐藏，页头开关展开，与工单看板共用同一个视图偏好 · 有卡的工单按卡泳道显示真实协调状态（优先于文档 Status）· PRD 级整轨提示词＝/jxx-implement-spec（单分支整份交付）· 工单级请去工单看板领卡（/jxx-implement）</footer>
<script>const PRD_PROMPTS=${JSON.stringify(prdPrompts).replace(/</g, '\\u003c')};${copyScript('PRD_PROMPTS', '.cp-prd', 'prd', '📋 PRD 级整轨提示词', '✔ 已复制，去贴给新会话跑整轨')}${histScript(root, '.sect.hist')}</script>
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
    fs.writeFileSync(prdOut, renderPrdHtml(root, meta, scanBoard(root)));
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
    fs.writeFileSync(path.join(root, 'control', 'prd.html'), renderPrdHtml(root, meta, scanBoard(root)));
  } catch { /* 看板保鲜失败不影响命令结果 */ }
}

// ---------- ledger ----------
const cell = v => String(v).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
// ↑ 账本是固定列表格，verify 按 `|` 切列取第 4 格回放 move 文法：actor/reason 里混进 `|` 或换行会让列错位，
//   于是那一条历史行**静默不参与对账**（假绿）。三处写账本的地方共用本函数，别各写一遍。
function cmdLedger(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const action = arg(argv, 'action') || die('缺少 --action');
  const target = arg(argv, 'target') || '-';
  const reason = arg(argv, 'reason') || '-';
  const actor = arg(argv, 'actor') || 'leader';
  const file = path.join(root, 'control', 'ledger.md');
  if (!fs.existsSync(file)) die('账本不存在，先跑 init');
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
    try { git(meta.repoPath, '-c', 'credential.helper=store', 'fetch', 'origin', '--quiet'); console.log('INFO 已带凭据 fetch origin，引用新鲜'); }
    catch { console.log('WARN fetch 失败（认证？），以下检查基于可能过期的 origin/main 引用'); }
  } else {
    try { const ageH = (Date.now() - fs.statSync(path.join(meta.repoPath, '.git', 'FETCH_HEAD')).mtimeMs) / 3600e3;
      if (ageH > 6) console.log(`WARN 权威仓上次 fetch 距今 ${ageH.toFixed(1)} 小时——投卡/裁决前先 fetch，否则状态判断可能失鲜`);
    } catch { /* 无 FETCH_HEAD 记录则跳过 */ }
  }
  const problems = [];
  const warns = [];
  if (!threeState(root)) warns.push('WARN 看板仍是五泳道布局（cards/{inbox,claimed,review,done,blocked}/）——跑 `board.mjs migrate --root <root>` 迁三态（先 --dry-run 看清单）');
  // 三态板 migrate 后旧泳道目录按红线 §7.2 留空不删；于是「有人照旧协议 mv 进 claimed/」会变成静默丢卡——
  // 目录还在、文件也写成功了，但 open/ 的扫描永远看不见它。这一条把它变成红灯，且给出可照做的修法。
  if (threeState(root)) for (const s of UNRESOLVED_TOKENS) {
    const d = cardsDir(root, s);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(x => x.endsWith('.md'))) {
      const to = s === 'inbox' || s === 'blocked' ? f : f.replace(/\.md$/, '') + EXEC_SUFFIX[s] + '.md';
      problems.push(`MISMATCH 卡 ${f} 落在旧泳道 ${s}/，三态板不扫该目录（等于丢卡）⇒ mv 到 control/cards/open/${to}${s === 'blocked' ? '，并给卡面 labels 补 needs-info' : ''}`);
    }
  }
  // 收口/归档两道只认裸名 `<id>.md`：带执行态后缀的卡落进去同样「写成功却看不见」，与上面那条是同一失效模式
  if (threeState(root)) for (const s of ['done', 'archived']) {
    const d = cardsDir(root, s);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(x => /\.(claimed|review)\.md$/.test(x)))
      problems.push(`MISMATCH 卡 ${f} 带执行态后缀却在 ${s}/（收口位只认裸名，三态扫描看不见它）⇒ mv 为 control/cards/${s}/${f.replace(/\.(claimed|review)\.md$/, '.md')}`);
  }
  const where = {}; // cardId -> [states]
  for (const s of LANES) for (const c of listCards(root, s)) {
    const id = cardIdOf(c);
    (where[id] ||= []).push(s);
    if (where[id].length > 1) problems.push(`MISMATCH 卡 ${id} 同时存在于 ${where[id].join(' + ')}`);
  }
  // 回放账本中的 move 文法
  const ledgerFile = path.join(root, 'control', 'ledger.md');
  const lastMove = {};
  if (fs.existsSync(ledgerFile)) {
    for (const line of fs.readFileSync(ledgerFile, 'utf8').split('\n')) {
      // 只在**未转义**的 `|` 上切列：cell() 把 actor/reason 里的竖线写成 `\|`，若这里仍按裸 `|` 切，
      // 含竖线的那行会被切成 6+ 格、cells[3] 错位 ⇒ 该历史行静默不参与对账（假绿）。
      const cells = line.split(/(?<!\\)\|/).map(x => x.trim());
      if (cells.length < 6) continue;
      const m = cells[3]?.match(/^move\s+(\S+?)\.md\s+(\w+)->(\w+)$/);
      if (m) lastMove[m[1]] = { from: m[2], to: m[3] };
    }
  }
  // 三态板没有 blocked/ 目录：账本历史里的 `->blocked` 意即「受阻」，实体化 = 卡留在 open/（待领位）+ labels 带 needs-info。
  // 于是旧账本行仍逐条可回放，不必改写历史（历史账本是审计面，改一条就等于造假）。
  const needsInfo = id => {
    const p = cardPath(root, id);
    return !!p && parseLabels(cardFields(fs.readFileSync(p.path, 'utf8')).labels).includes('needs-info');
  };
  for (const [id, mv] of Object.entries(lastMove)) {
    const loc = where[id];
    const expected = threeState(root) && mv.to === 'blocked' ? 'inbox' : mv.to;
    if (!loc) problems.push(`MISMATCH 账本最后记录 ${id} 应在 ${mv.to}，但各泳道目录均未找到该卡`);
    else if (!loc.includes(expected)) problems.push(`MISMATCH 账本记 ${id} 在 ${mv.to}，实况在 ${loc.join('/')}`);
    else if (threeState(root) && mv.to === 'blocked' && !needsInfo(id))
      problems.push(`MISMATCH 受阻卡 ${id} 未带 needs-info 标签（三态后 blocked 由标签表达，跑 card set --field labels --value "needs-info"）`);
  }
  // 第五路对账（标签维度）：labels 是正交于「目录=生命周期 / 文件名后缀=执行态」的第三轴，缺了就等于把
  // triage 信息又塞回目录名，D9 的正交性当场失效。判据只打在未收口三位（done/archived 是历史面，不追溯）。
  for (const s of UNRESOLVED_TOKENS) for (const c of listCards(root, s)) {
    const { id } = parseCardName(c);
    const f = cardFields(fs.readFileSync(cardFile(root, s, c), 'utf8'));
    const ls = parseLabels(f.labels);
    if (!ls.length) { problems.push(`MISMATCH 卡 ${id}（在 ${s} 位）缺 labels 行 ⇒ triage 维度为空，第 5 路对账无从判起`); continue; }
    const bad = ls.filter(l => !TRIAGE_LABELS.includes(l));
    if (bad.length) problems.push(`MISMATCH 卡 ${id} 的 labels 含非 triage 值 "${bad.join(', ')}"（五标签：${TRIAGE_LABELS.join(' / ')}）`);
    if (ls.includes('wontfix')) problems.push(`MISMATCH 卡 ${id} 标 wontfix 却仍在未收口位（${s}）⇒ 按 D9 应移 archived/`);
    if (f.docRef && !f.docRef.includes('{{') && !/^https?:\/\//i.test(f.docRef))
      problems.push(`MISMATCH 卡 ${id} 的 doc_ref 不是 URL（"${f.docRef}"）——服务器工单链接手填 \`<部署域>/tickets/<工单id>\`（PRD 75 前端路由 /tickets/:id）；本地工单路径属 PRD 行，两者别混`);
  }
  // PRD 指针有效性（防迁移/改名漂移）
  for (const s of LANES) for (const c of listCards(root, s)) {
    const cbody = fs.readFileSync(cardFile(root, s, c), 'utf8');
    const { prd, branch } = cardFields(cbody);
    if (prd && !fs.existsSync(prd)) problems.push(`MISMATCH 卡 ${c} 的 PRD 指针不存在: ${prd}`);
    else if (prd && s !== 'done') {
      const st = (fs.readFileSync(prd, 'utf8').match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1];
      if (st && /^(done|wontfix)$/i.test(st)) {
        // merge 卡的工单在开发交付那一刻就被置 done，属常态；它该不该归档只看「待合分支是否已进 main」
        if (/^merge-/.test(c)) {
          const primary = [...new Set([`ticket/${cardIdOf(c).replace(/^merge-/, '')}`, branch].map(safeRef).filter(Boolean))];
          const mentioned = [...new Set([...cbody.matchAll(/ticket\/[A-Za-z0-9._-]+/g)].map(m => m[0]))];
          const probe = (list) => {
            let hit = null, ahead = -1;
            for (const b of list) {
              let n;
              try { n = Number(git(meta.repoPath, 'rev-list', '--count', `origin/main..${b}`)); } catch { continue; }
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
    const cbody = fs.readFileSync(cardFile(root, s, c), 'utf8');
    const { prd, branch } = cardFields(cbody);
    const devId = cardIdOf(c).replace(/^merge-/, '');
    const num = ((devId.match(/^\d+-(\d+)-/) || [])[1] || '').padStart(2, '0');
    let prdRel = '';
    if (prd && fs.existsSync(prd)) { const r = path.relative(meta.repoPath, path.resolve(prd)).replace(/\\/g, '/'); if (r && !r.startsWith('..')) prdRel = r; }
    for (const b of [...new Set([`ticket/${devId}`, branch].map(safeRef).filter(Boolean))]) {
      let rels = [];
      if (prdRel) rels = [prdRel];
      else if (num) {
        const prdnum = (devId.match(/^(\d+)-/) || [])[1] || '';
        try {
          const all = git(meta.repoPath, 'ls-tree', '-r', '--name-only', b, '.scratch').split('\n').filter(f => f.includes('/issues/' + num + '-') && f.endsWith('.md'));
          // 卡 id 的 PRD 号可定位目录时只认该目录，防跨 PRD 同号工单误抓（v0.7.3 事故：70-02 被误判抓中 PRD01 的 02-*.md）
          const pref = prdnum ? new RegExp('^\\.scratch\\/' + prdnum + '(-|\\/)') : null;
          rels = (pref ? all.filter(f => pref.test(f)) : all);
        } catch { continue; }
      }
      if (!rels.length) continue;
      let txt = null;
      for (const rel of rels) { try { const t = git(meta.repoPath, 'show', `${b}:${rel}`); if (/\*\*Status:\*\*\s*done/i.test(t)) { txt = t; break; } txt ??= t; } catch { } }
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
    const cbody = fs.readFileSync(cardFile(root, s, c), 'utf8');
    const devId = cardIdOf(c);
    const prdnum = (devId.match(/^(\d+)-/) || [])[1] || '';
    const tokens = new Set([...cbody.matchAll(/\b\d{2}-[a-z][a-z0-9-]+\b/g)].map(m => m[0]));
    if (!prdnum || !tokens.size) continue;
    const { branch } = cardFields(cbody);
    for (const b of [...new Set([`ticket/${devId}`, branch].map(safeRef).filter(Boolean))]) {
      let tree = '', touched = '';
      try { tree = git(meta.repoPath, 'ls-tree', '-r', '--name-only', b, '.scratch'); } catch { continue; }
      // v0.7.5：只审计本分支实际改动过的工单——依赖引用/正文提及他单号不算本单交付面（60-06 误归因教训）
      try { touched = git(meta.repoPath, 'diff', '--name-only', `origin/main...${b}`, '.scratch'); } catch { touched = ''; }
      const pref = new RegExp('^\\.scratch\\/' + prdnum + '(-[^/]+)?\\/issues\\/');
      const tset = new Set(touched.split('\n'));
      for (const rel of tree.split('\n').filter(f => pref.test(f) && f.endsWith('.md') && tset.has(f) && [...tokens].some(t => f.endsWith('/issues/' + t + '.md')))) {
        let txt; try { txt = git(meta.repoPath, 'show', `${b}:${rel}`); } catch { continue; }
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
  try { mainBSet = new Set([...git(meta.repoPath, 'show', 'origin/main:.scratch/BACKLOG.md').matchAll(/^#{2,3} (\d+)\./gm)].map(m => m[1])); } catch { mainBSet = new Set(); }
  const bAdd = new Map();
  for (const s of ['claimed', 'review']) for (const c of listCards(root, s)) {
    if (/^merge-/.test(c)) continue;
    const cbody = fs.readFileSync(cardFile(root, s, c), 'utf8');
    const devId = cardIdOf(c);
    const { branch } = cardFields(cbody);
    for (const b of [...new Set([`ticket/${devId}`, branch].map(safeRef).filter(Boolean))]) {
      // 2026-09-30 工具欠账修复：三点 diff 的 merge-base 随合入后移，会把「已合入但分支未删」的
      // 分支再计一遍 ⇒ 必然误报撞号。零领先（已全部合入）直接跳过。
      try { if (git(meta.repoPath, 'rev-list', '--count', `origin/main..${b}`) === '0') continue; } catch { continue; }
      let d = ''; try { d = git(meta.repoPath, 'diff', `origin/main...${b}`, '--', '.scratch/BACKLOG.md'); } catch { continue; }
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
    const { deps } = cardFields(fs.readFileSync(cardFile(root, s, c), 'utf8'));
    const pend = pendingDeps(root, deps, cardIdOf(c));
    if (s === 'inbox' && pend.length)
      problems.push(`MISMATCH 依赖未就绪卡 ${c}（在 open/ 待领位）：依赖 ${pend.join(', ')} 未归档 done ⇒ 应由领导者 mv 到 control/held/`);
    if (s === HELD && !pend.length)
      console.log(`INFO held 卡 ${c} 依赖已齐，可 mv 回 open/ 释放待领`);
  }
  // 在飞卡分支差异检测：review 有卡却零差异 = 假交付；claimed 零差异仅 INFO（刚开工正常）
  // 基准 = origin/main（v0.14.0）：所有工单分支一律从 main 拉出、默认回合 main，
  // 零差异判据相对 main 直接有效；旧卡面残留的 PRD 分支合入目标值不再作数。
  for (const s of ['claimed', 'review']) for (const c of listCards(root, s)) {
    const cf = cardFields(fs.readFileSync(cardFile(root, s, c), 'utf8'));
    const b = safeRef(cf.branch); if (!b) continue;
    const diffRef = 'origin/main';
    try {
      if (git(meta.repoPath, 'rev-list', '--count', `${diffRef}..${b}`) === '0') {
        if (s === 'review') problems.push(`MISMATCH 假交付嫌疑 ${c}: 分支 ${b} 与 ${diffRef} 零差异，何来交付`);
        else console.log(`INFO claimed 卡 ${c} 分支尚无提交（刚开工正常）`);
      }
    } catch { /* 分支未建（worker 未 add-wt）跳过 */ }
  }
  // claimed 卡 ↔ worktree
  const repoDir = meta.repoPath;
  let wtList = '';
  try { wtList = git(repoDir, 'worktree', 'list'); } catch { /* 报告缺 worktree 时再提示 */ }
  for (const c of listCards(root, 'claimed')) {
    const id = cardIdOf(c);
    if (/^merge-/.test(id)) continue; // 合并卡无自有 worktree，操作对象是开发卡的 wt
    if (!fs.existsSync(path.join(root, 'wt', id)))
      problems.push(`MISMATCH claimed 卡 ${id} 无对应 wt/${id} 工作目录`);
  }
  const claimedIds = new Set(listCards(root, 'claimed').map(cardIdOf));
  const inboxIds = new Set([...listCards(root, 'inbox'), ...listCards(root, HELD)].map(cardIdOf));
  const reviewIds = new Set(listCards(root, 'review').map(cardIdOf));
  // 受阻现场：旧板在 blocked/；三态板 = 待领位 + needs-info 标签（blocked 不再是目录，worktree 仍要认得出是受阻卡的现场）
  const blockedIds = new Set(listCards(root, 'blocked').map(cardIdOf));
  for (const c of listCards(root, 'inbox')) {
    const f = cardFields(fs.readFileSync(cardFile(root, 'inbox', c), 'utf8'));
    if (parseLabels(f.labels).includes('needs-info')) blockedIds.add(parseCardName(c).id);
  }
  // 卡上 worktree: 行声明的工作目录（决策会话等可自开非规范名目录，按声明认领，避免误报无主）
  const declaredWt = new Map();
  for (const s of LANES) for (const c of listCards(root, s)) {
    const { wt } = cardFields(fs.readFileSync(cardFile(root, s, c), 'utf8'));
    const w = (wt || '').split(/[\s（(]/)[0].replace(/[\\/]+$/, '');
    if (w) declaredWt.set(path.basename(w).toLowerCase(), `${cardIdOf(c)}（在 ${s}/）`);
  }
  const wtRoot = path.join(root, 'wt');
  if (fs.existsSync(wtRoot)) for (const d of fs.readdirSync(wtRoot)) {
    if (!fs.statSync(path.join(wtRoot, d)).isDirectory()) continue;
    if (claimedIds.has(d)) continue;
    // blocked 判定必须排在 inbox 之前：三态板里 blockedIds ⊆ inboxIds（受阻卡就停在待领位），
    // 排在后面这条分支永远不可达，提示会退化成误导性的「为领导者预开工作区（卡待领取）」（审查 STD-07）。
    if (blockedIds.has(d)) { console.log(`INFO wt/${d} 属 blocked 卡保留现场（可续接）`); continue; }
    if (inboxIds.has(d)) { console.log(`INFO wt/${d} 为领导者预开工作区（卡待领取）`); continue; }
    if (reviewIds.has(d)) { console.log(`INFO wt/${d} 交付成果所在，留待合并专员合入后回收`); continue; }
    if (declaredWt.has(d.toLowerCase())) { console.log(`INFO wt/${d} 由卡 ${declaredWt.get(d.toLowerCase())} 的 worktree 行声明（非规范名）`); continue; }
    if (!wtList.includes(path.join(wtRoot, d))) problems.push(`WARN worktree wt/${d} 无 claimed 卡引用`);
  }
  // repo 主工作区脏度（仅提示）
  const dirty = git(repoDir, 'status', '--porcelain').split('\n').filter(Boolean).length;
  if (dirty) console.log(`INFO repo/（${meta.baseBranch}）有 ${dirty} 个未提交变更——领导者的文档操作应已提交`);

  warns.forEach(w => console.log(w));
  if (!problems.length) { console.log('verify: 五路对账一致（账本 × 卡位 × worktree × 工单状态 × 标签），无出入。'); return; }
  problems.forEach(p => console.log(p));
  console.log(`verify: 发现 ${problems.length} 处出入。按实况裁决修账，每条处置记一笔 ledger。`);
  process.exit(5);
}

// ---------- migrate（五泳道 → 三态 + 标签正交，D9 / 工单 75-c01）----------
// 目录改名这种动作绝不能用「删旧目录 + 重写」实现：卡内协调记录是唯一现场，删了就等于第二次 2026-09-30 事故。
// 因此本命令只做四件事：建三态目录 → 逐张 rename（同盘原子）→ 只补 blocked 的 needs-info → 一行账本（有改名才记）。
// 幂等：迁过的卡目标已存在即 skip；没任何东西可改时不往账本追加空转行。
function cmdMigrate(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const dry = flag(argv, 'dry-run');
  if (!LEGACY_LANES.some(s => fs.existsSync(path.join(root, 'control', 'cards', s))))
    { console.log('migrate: 没找到任何旧泳道目录，看板已是三态（或尚未 init）。'); return; }
  // 旧泳道 → 新落点：blocked 不再是目录（语义交给 needs-info 标签），其余四位一一对应。
  // 目标名在这里**显式按三态拼**（不走 cardName/cardLoc）：那两个函数按当前板面布局解析，
  // 而迁板的职责恰恰是「板面还是旧的，却要算出新布局的落点」——用它们会先返回旧路径，等于不迁。
  const LANE_MAP = { inbox: 'inbox', claimed: 'claimed', review: 'review', done: 'done', blocked: 'inbox' };
  const moves = [];
  const seen = new Set();
  for (const s of LEGACY_LANES) {
    const d = path.join(root, 'control', 'cards', s);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(x => x.endsWith('.md')).sort()) {
      const { id } = parseCardName(f);
      if (seen.has(id)) { console.log(`WARN 同名卡 ${id} 在多个旧泳道重复出现（${s}/${f}），本张跳过，请人工裁决`); continue; }
      seen.add(id);
      const body = fs.readFileSync(path.join(d, f), 'utf8');
      const newLane = LANE_MAP[s];
      // 只有 blocked→needs-info 是有据的翻译（PRD 75:72 明文「blocked 由 needs-info 表达」）；
      // 其余旧卡没有 labels 就是没有——凭空给在办卡塞 ready-for-agent 等于伪造 triage（审查发现项），
      // 改成列清单交领导者补，verify 第 5 路的红灯会继续催。
      const labels = (cardFields(body).labels || '').trim() || (s === 'blocked' ? 'needs-info' : '');
      const dir = newLane === 'done' ? cardsDir(root, 'done') : cardsDir(root, OPEN);
      moves.push({ from: path.join(d, f), to: path.join(dir, `${id}${EXEC_SUFFIX[newLane] ?? ''}.md`),
        id, oldLane: s, newLane, labels, body });
    }
  }
  const byLane = {};
  for (const m of moves) byLane[m.oldLane] = (byLane[m.oldLane] || 0) + 1;
  const noLabels = moves.filter(m => !m.labels && UNRESOLVED_TOKENS.includes(m.newLane)).map(m => m.id);
  console.log(`migrate: ${moves.length} 张卡待迁 —— ${Object.entries(byLane).map(([k, v]) => `${k}:${v}`).join(' / ')}`);
  if (noLabels.length) console.log(`migrate: ${noLabels.length} 张未收口卡没有 labels（${noLabels.join(', ')}）——不代拟，迁完由领导者 card-set 补，未补前 verify 第 5 路报红灯`);
  if (dry) { for (const m of moves) console.log(`  [dry] ${m.oldLane}/${m.id}.md → ${path.relative(root, m.to).replace(/\\/g, '/')}${m.labels ? `  labels: ${m.labels}` : '  （无标签，交领导者定）'}`); console.log('migrate --dry-run：未动任何文件。去掉 --dry-run 即执行。'); return; }
  for (const s of LANE_DIRS) fs.mkdirSync(cardsDir(root, s), { recursive: true });
  let moved = 0, same = 0;
  for (const m of moves) {
    if (m.from === m.to) { same++; console.log(`  [same] ${m.id} 落点与原位相同（done 道三态同名，无需动）`); continue; }
    if (fs.existsSync(m.to)) { console.log(`  [skip] ${m.id} 目标已存在 ${path.relative(root, m.to).replace(/\\/g, '/')}`); continue; }
    // 先补 labels 行再 rename：迁完再改会二次动卡，白留一版快照，也多一个失败中途态
    const body = m.labels && !/^- labels:/m.test(m.body) ? addLabel(m.body, m.labels) : m.body;
    if (body !== m.body) fs.writeFileSync(m.from, body);
    fs.renameSync(m.from, m.to);
    moved++;
    console.log(`  [mv] ${m.oldLane}/${m.id}.md → ${path.relative(root, m.to).replace(/\\/g, '/')}${body !== m.body ? `  labels: ${m.labels}` : ''}`);
  }
  if (!moved) { console.log(`migrate: 无需改名（原位 ${same} 张 / 目标已存在 ${moves.length - same} 张），账本不追加空转行。`); return; }
  const line = `| ${localIso()} | ${cell(arg(argv, 'actor') || 'leader')} | ${cell(`migrate 五泳道->三态（改名 ${moved} 张 / 原位未动 ${same} 张：blocked 由 needs-info 标签表达，执行态落文件名后缀 .claimed/.review）`)} | ${cell('control/cards/')} | ${cell('D9 三态 + 标签正交（ADR-008 / 工单 75-c01）；旧泳道目录留空不删（红线 §7.2），回退 = 把卡 mv 回去')} |\n`;
  fs.appendFileSync(path.join(root, 'control', 'ledger.md'), line);
  autoHtml(root);
  snapshot(root, 'migrate');
  console.log(`migrate: ${moved} 张已迁，账本记一行，三页看板已刷，快照已留。archived/ 为空属正常（只有废弃/让位的卡进）。`);
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
  const dest = cardFile(root, destLane, cardName(root, id, destLane));
  if (LANES.some(s => fs.existsSync(cardFile(root, s, cardName(root, id, s))))) die(`卡 ${id} 已存在`);
  const tpl = fs.readFileSync(path.join(root, 'control', 'CARD-TEMPLATE.md'), 'utf8');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // triage 标签：显式 --labels 优先；否则只有在工单 Status 行**本身就是五标签之一**时才继承
  // （工单还有一层执行态 Status：pending-review/done… 那些不是 triage 值，抄过来等于自己造一个越界标签，
  //  再被 verify 第 5 路判红——2026-09-30 审查发现项）。取不到合法值就落 needs-triage 交领导者定。
  const ticketStatus = tf ? ((fs.readFileSync(tf, 'utf8').match(/\*\*Status:\*\*\s*([A-Za-z-]+)/) || [])[1] || '') : '';
  const labelsArg = arg(argv, 'labels') || (TRIAGE_LABELS.includes(ticketStatus) ? ticketStatus : 'needs-triage');
  if (ticketStatus && !TRIAGE_LABELS.includes(ticketStatus))
    console.log(`new-card: 工单 Status「${ticketStatus}」属执行态而非 triage 标签，labels 落 needs-triage（由领导者定标签）`);
  // 判据是「是否含非法标签」，不是「是否等于五标签之一」：PROTOCOL §4 明许「五标签之一**或其一子集**」，
  // 整串等值会把合法子集（如 'ready-for-agent needs-info'）误报，且与 verify 第 5 路的逐 token 判法自相矛盾
  // （PROBE4：WARN 与紧接着的 verify 绿同时出现）。与 cmdCardSet 的写法对齐（审查 STD-08）。
  const badLabels = parseLabels(labelsArg).filter(l => !TRIAGE_LABELS.includes(l));
  if (badLabels.length)
    console.log(`WARN new-card: --labels 里的 "${badLabels.join('", "')}" 不在 triage 五标签（${TRIAGE_LABELS.join(' / ')}）内，卡面照写，verify 会报发现项`);
  const docRefArg = arg(argv, 'doc-ref') || '';
  let body = tpl.replaceAll('{{ID}}', id).replaceAll('{{PRD-ID}}', id.replace(/^merge-/, ''))
    .replaceAll('{{TITLE}}', arg(argv, 'title') || id)
    .replaceAll('{{DEPS}}', depsArg || '无').replaceAll('{{LEVEL}}', level)
    .replaceAll('{{LABELS}}', labelsArg).replaceAll('{{DOC_REF}}', docRefArg)
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
      const p = cardFile(root, s, cardName(root, devId, s));
      if (!fs.existsSync(p)) continue;
      const { prd } = cardFields(fs.readFileSync(p, 'utf8'));
      if (prd && fs.existsSync(prd)) { inherited = prd; console.log(`new-card: PRD 指针继承自 ${s}/${cardName(root, devId, s)}`); break; }
    }
    if (inherited) body = setPrd(body, inherited);
    else console.log(`WARN new-card: 未找到可继承 PRD 的开发卡 ${devId}.md，PRD 行仍是模板占位路径——请手工改成真实工单路径，否则 verify 会报 MISMATCH`);
  }
  // 合入目标（v0.14.0 · 默认回合 main）：所有卡一律 main；merge 卡同值。受阻暂存的 PRD 分支由
  // 合并专员按 PRD 指针现场推导（PROTOCOL §3），不上卡面。
  const mtLine = 'main';
  body = /^- 合入目标:[^\r\n]*$/m.test(body)
    ? body.replace(/^- 合入目标:[^\r\n]*/m, `- 合入目标: ${mtLine}`)
    : body.replace(/^- 目标:[^\r\n]*/m, `- 合入目标: ${mtLine}\n$&`);
  fs.writeFileSync(dest, body);
  autoHtml(root);
  if (parked)
    console.log(`new-card: ${HELD}/${id}.md —— 依赖未归档（${pendDeps.join(', ')}），自动收进 held 暂缓道，worker 不可见；依赖卡归档 done 后由领导者 mv 回 open/ 释放。确要直投 open/ 可重跑加 --keep-inbox`);
  else
    console.log(`new-card: open/${id}.md 已创建（${level} · labels: ${labelsArg}）。填完卡落后记得 ledger 记投卡+定级理由。`);
}

// ---------- card CRUD（瘦卡 v2：确定性字段由脚本推导，卡内只留真增量） ----------
function cardPath(root, id) {
  for (const s of LANES) {
    const p = cardFile(root, s, cardName(root, id, s));
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
      const p = cardFile(root, s, cardName(root, devId, s));
      if (!fs.existsSync(p)) continue;
      const d = cardFields(fs.readFileSync(p, 'utf8')).prd;
      if (d && fs.existsSync(d)) { prd = d; break; }
    }
  }
  return { ...f, wt, branch, prd, mergeTarget: f.mergeTarget || mergeTargetOf(prd) };
}
function cmdCardRead(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const id = arg(argv, 'id') || die('缺少 --id <卡id>');
  const loc = cardPath(root, id);
  if (!loc) die(`卡 ${id} 不存在`);
  const body = fs.readFileSync(loc.path, 'utf8');
  const f = deriveFields(root, id, body);
  console.log(`# ${id}（${loc.state} · ${cardName(root, id, loc.state)}）`);
  console.log(`- 标题: ${f.title || '(未填)'}`);
  console.log(`- 难度: ${f.level || '(未填)'}`);
  console.log(`- 模型档位: ${f.model || '(未填)'}`);
  console.log(`- 依赖: ${f.deps || '(未填)'}`);
  console.log(`- labels: ${f.labels || '(未填)'}`);
  console.log(`- doc_ref: ${f.docRef || '(未填)'}`);
  console.log(`- PRD: ${f.prd || '(未填)'}`);
  console.log(`- 分支: ${f.branch}`);
  console.log(`- worktree: ${f.wt}${fs.existsSync(f.wt) ? ' [已预开]' : ' [未创建]'}`);
  console.log(`- 合入目标: ${f.mergeTarget}${f.mergeTarget === 'main' ? '（默认回合主分支：审查通过、确认没影响后直合；受阻暂存与汇报原因见 PROTOCOL §3）' : '（旧卡面值，v0.14.0 起默认回合 main，受阻才暂存 PRD 分支）'}`);
  // 处理计时读数（统计面，不参与判位）：字段缺省时回退卡内流转段，并标出是推出来的
  const proc = procOf(f, body);
  const mark = (v, k) => v ? `${v}${f[k] ? '' : ' [由流转段推得]'}` : '(未记录)';
  console.log(`- Harness: ${proc.harness || '(未标注)'}`);
  console.log(`- LLM: ${proc.llm || '(未标注)'}`);
  console.log(`- 开始处理: ${mark(proc.start, 'startAt')}`);
  console.log(`- 结束处理: ${mark(proc.end, 'endAt')}`);
  if (loc.state === 'claimed' && stampMs(proc.start) !== null) console.log(`- 已办时长: ${durFmt(Date.now() - stampMs(proc.start))}`);
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
  const allowed = ['标题', '难度', '模型档位', '依赖', '目标', '领取者', 'PRD', 'labels', 'doc_ref',
    'Harness', 'LLM', '开始处理', '结束处理'];
  if (!allowed.includes(field)) die(`--field 只允許: ${allowed.join('/')}`);
  const body = fs.readFileSync(loc.path, 'utf8');
  // 统一走 setField（有则替换、无则插进卡头字段块）：旧卡常缺 处理计时 三行，
  // 早先的「卡内没有该行」直接 die，等于让 leader 手工去卡面补一行才能记账。
  if (!new RegExp(`^- ${field}:`, 'm').test(body)) console.log(`card set: 卡 ${id} 原无 "- ${field}:" 行，已插入卡头字段块。`);
  if (field === 'labels') {
    const bad = parseLabels(value).filter(l => !TRIAGE_LABELS.includes(l));
    if (bad.length) console.log(`WARN card set: labels 里的 "${bad.join('", "')}" 不在 triage 五标签（${TRIAGE_LABELS.join(' / ')}），照写但 verify 会报发现项`);
  }
  // 替换串必须走函数形式：字符串替换里 value 的 `$&`/`$1`/`$'` 会被当作特殊序列展开，
  // 实测 `--value "a$&b"` 会把整行原文插进新值、污染卡面（写进去还看不出来）。setField 两条路径都受此保护。
  fs.writeFileSync(loc.path, setField(body, field, value));
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
    if (pend.length) die(`card move: 卡 ${id} 依赖未归档（${pend.join(', ')}）不可领取——等依赖 done 后由领导者释放回 open/`);
  }
  // 三态板没有 blocked/ 目录：受阻 = 卡留在 open/（待领位）+ labels 带 needs-info（D9：blocked 由标签表达）。
  // 账本与卡内流转行仍记 `->blocked`，让 verify 能回放「这张卡该带 needs-info」而不必改写历史行。
  const toToken = to === 'blocked' && threeState(root) ? 'inbox' : to;
  if (loc.state === toToken && !(to === 'blocked' && threeState(root))) {
    console.log(`card move: ${id} 已在 ${toToken}/，无需移动`); return;
  }
  const dest = cardFile(root, toToken, cardName(root, id, toToken));
  if (dest !== loc.path) {
    if (fs.existsSync(dest)) die(`目标已存在 ${cardFile(root, toToken, cardName(root, id, toToken))}`);
    fs.renameSync(loc.path, dest);
  }
  // 卡内流转追加段自动补一行
  const body0 = fs.readFileSync(dest, 'utf8');
  // 处理计时盖章：进 claimed 位 = 本轮开始（顺带记 harness），离开 claimed 位 = 本轮结束。
  // 只盖章、不参与判位：位置的唯一真源仍是上面那次 rename，字段写歪或被抹掉都不会把卡的状态判错
  // （这正是 ADR-008 被否方案①「用卡内字段承载执行态」与本处的分界）。
  let body = to === 'blocked' && threeState(root) ? addLabel(body0, 'needs-info') : body0;
  const claimedIn = to === 'claimed' && loc.state !== 'claimed';
  const claimedOut = loc.state === 'claimed' && to !== 'claimed';
  const now = localIso();
  let spent = '';
  if (claimedIn) {
    const h = arg(argv, 'harness');
    const m = arg(argv, 'llm');
    // 重领不抹旧值：harness/llm 只在没有新值时保留卡上原值，保证统计口径是「最近一次处理环境」
    body = setField(body, 'Harness', h || cardFields(body).harness || UNSET);
    body = setField(body, 'LLM', m || cardFields(body).llm || UNSET);
    body = setField(body, '开始处理', now);
    body = setField(body, '结束处理', '');
    if (!h || !m) {
      const missing = [!h ? 'Harness' : '', !m ? 'LLM' : ''].filter(Boolean);
      const kept = missing.filter(k => cardFields(body)[k === 'Harness' ? 'harness' : 'llm']);
      const fresh = missing.filter(k => !kept.includes(k));
      const parts = [];
      if (kept.length) parts.push(`${kept.join(' 和 ')} 保留卡上原值`);
      if (fresh.length) parts.push(`${fresh.join(' 和 ')} 落成「（未标注）」`);
      console.log(`card move: 未带 ${missing.map(k => `--${k === 'Harness' ? 'harness' : 'llm'}`).join(' 和 ')}，${parts.join('，')}（看板红字提示）——补：card-set --id ${id} --field ${missing[0]} --value <名>`);
    }
  } else if (claimedOut) {
    body = setField(body, '结束处理', now);
    // 用时按读数算（字段缺省时回退流转段），老板卡也能报出它这一轮干了多久
    const p = procOf(cardFields(body), body);
    const s = stampMs(p.start), e = stampMs(p.end);
    const ms = s === null ? -1 : (e !== null ? e - s : Date.now() - s);
    if (ms >= 0) spent = ` · 本轮处理时长 ${durFmt(ms)}`;
  }
  const line = `- ${now.replace('T', ' ').slice(0, 16)} | ${loc.state}->${to} | ${arg(argv, 'actor') || 'agent'} | ${arg(argv, 'reason') || '(card move)'}`;
  fs.writeFileSync(dest, appendFlowLine(body, line));
  // 自动记账（move 文法，verify 可回放）
  const ledgerLine = `| ${now} | ${cell(arg(argv, 'actor') || 'agent')} | ${cell(`move ${id}.md ${loc.state}->${to}`)} | ${cell(id)} | ${cell(arg(argv, 'reason') || 'card move')} |\n`;
  const ledgerFile = path.join(root, 'control', 'ledger.md');
  if (fs.existsSync(ledgerFile) && !fs.readFileSync(ledgerFile, 'utf8').includes(ledgerLine))
    fs.appendFileSync(ledgerFile, ledgerLine);
  autoHtml(root);
  console.log(`card move: ${id} ${loc.state}->${to} ⇒ ${path.relative(root, dest).replace(/\\/g, '/')}（已记账 + 刷看板${spent}）`);
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
  // 与 new-card 同款 id 闸门（RUL-04 ②）：--ticket 会被拼进分支名与 worktree 路径，未校验等于把
  // 命令面开放给「卡 id 形态的任意文本」——`add-wt --ticket 'a&calc'` 在旧实现里就是一次真注入。
  if (!CARD_ID_RE.test(id)) die(`--ticket "${id}" 不符规范（NNN-slug 或 merge-NNN-slug，kebab-case）`);
  const repoDir = meta.repoPath, wtPath = path.join(root, 'wt', id), branch = `ticket/${id}`;
  let base = safeRef(arg(argv, 'base'));
  if (!base) {
    // v0.14.0（默认回合 main）：未显式给 --base 时一律从 origin/main 拉——所有工单 diff 只含自己的活；
    // PRD 分支不再预建，只在合并受阻时由合并专员惰性创建作暂存道（PROTOCOL §3）。
    base = 'origin/main';
  }
  // 目录被外部删除会留下 stale worktree 注册，导致下面的 -b 回退分支失败；先 prune。
  try { git(repoDir, 'worktree', 'prune'); } catch { /* ignore */ }
  try { git(repoDir, 'rev-parse', '--verify', branch); git(repoDir, 'worktree', 'add', wtPath, branch); }
  catch { git(repoDir, 'worktree', 'add', wtPath, '-b', branch, base); }
  autoHtml(root);
  console.log(`add-wt: wt/${id}（分支 ${branch}，基 ${base}）就绪。进目录后记得装依赖。`);
}
function cmdRmWt(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  const id = arg(argv, 'ticket') || die('缺少 --ticket <NNN-slug>');
  const repoDir = needWs(root).repoPath;
  // 破坏性操作边界（2026-09-30 事故：批量回收失控删掉整个 control/）：本命令只允许删
  // <root>/wt/<单段目录名>，拒绝路径分隔符/通配符/遍历片段，且目标必须真实存在。
  if (!SEGMENT_RE.test(id) || id === '.' || id === '..') die(`--ticket "${id}" 非法：只接受单段目录名（${SEGMENT_RE} ，禁路径分隔符/通配符/shell 元字符）`);
  const wtBase = path.resolve(root, 'wt');
  const target = path.resolve(wtBase, id);
  if (path.dirname(target) !== wtBase) die(`拒绝回收：解析出的路径越出 wt/（${target}）`);
  if (!fs.existsSync(target)) die(`拒绝回收：目录不存在 ${target}`);
  git(repoDir, 'worktree', 'remove', target, ...(flag(argv, 'force') ? ['--force'] : []));
  if (flag(argv, 'delete-branch')) git(repoDir, 'branch', '-D', `ticket/${id}`);
  try { git(repoDir, 'worktree', 'prune'); } catch { /* 无注册可清 */ }
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
    const body = fs.readFileSync(cardFile(root, HELD, h), 'utf8');
    const pend = pendingDeps(root, cardFields(body).deps, hid);
    if (!pend.length) {
      console.log(`📋 held 卡 ${hid} 依赖已就绪，请手动释放: card-move --id ${hid} --to inbox --actor orchestrator --reason "auto: deps ready"（三态板落点 = open/${hid}.md）`);
    }
  }

  // 可领卡
  const inboxCards = listCards(root, 'inbox').map(cardIdOf);
  console.log(`\n可领卡（open/ 待领位）: ${inboxCards.join(', ') || '无'}`);

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
// 外置模式：工作区根做本地 git 仓库（wt/ 忽略），变更类命令每次自动留一版快照。
// in-project 模式（v0.12.0）：root 就是产品仓——绝不能把 control/ commit 进产品仓（污染产品历史），
// 看板自保改用 control/ 内的嵌套 git（产品仓 .gitignore 已忽略 control/，两个仓互不看见）。
function snapshot(root, reason) {
  try {
    if (wsMode(root) === 'in-project') {
      const cdir = path.join(root, 'control');
      if (!fs.existsSync(cdir)) return false;
      if (!fs.existsSync(path.join(cdir, '.git'))) git(cdir, 'init', '-q');
      git(cdir, 'add', '-A');
      if (!git(cdir, 'status', '--porcelain').trim()) return false;
      const msg0 = String(reason || 'manual').replace(/[\r\n]+/g, ' ');
      git(cdir, '-c', 'user.name=board-snapshot', '-c', 'user.email=board@local', 'commit', '-q', '-m', `board snapshot: ${msg0} @ ${localIso()}`);
      return true;
    }
    if (git(root, 'rev-parse', '--is-inside-work-tree') !== 'true') return false;
    const gi = path.join(root, '.gitignore');
    if (!fs.existsSync(gi)) fs.writeFileSync(gi, 'wt/\n');
    const paths = ['control', '.gitignore', 'AGENTS.md', 'CODEBUDDY.md'].filter(f => fs.existsSync(path.join(root, f)));
    if (!paths.length) return false;
    git(root, 'add', '-A', '--', ...paths);
    if (!git(root, 'status', '--porcelain').trim()) return false;
    const msg = String(reason || 'manual').replace(/[\r\n]+/g, ' ');
    git(root, '-c', 'user.name=board-snapshot', '-c', 'user.email=board@local', 'commit', '-q', '-m', `board snapshot: ${msg} @ ${localIso()}`);
    return true;
  } catch { return false; }
}
function cmdSnapshot(argv) {
  const root = path.resolve(arg(argv, 'root') || die('缺少 --root'));
  needWs(root);
  const ok = snapshot(root, 'manual');
  const hint = wsMode(root) === 'in-project' ? `${root}/control` : `${root}`;
  console.log(ok
    ? `snapshot: 已留一版看板快照（git -C "${hint}" log --oneline -1）`
    : `snapshot: 无变更（in-project 模式首跑 init 即建仓；外置模式先 git init 并忽略 wt/，之后每次变更自动快照）`);
}

// ---------- command table ----------
const cmd = process.argv[2];
const argv = process.argv.slice(3);
const table = { init: cmdInit, board: cmdBoard, html: cmdHtml, ledger: cmdLedger, verify: cmdVerify, 'new-card': cmdNewCard, 'add-wt': cmdAddWt, 'rm-wt': cmdRmWt, 'card-read': cmdCardRead, 'card-set': cmdCardSet, 'card-move': cmdCardMove, 'card-rm': cmdCardRm, snapshot: cmdSnapshot, render: cmdRender, migrate: cmdMigrate, auto: cmdAuto };
if (!cmd || !table[cmd]) die(`未知子命令 "${cmd || '(空)'}"。可用：${Object.keys(table).join(' / ')}`);
try { table[cmd](argv); }
catch (e) { die(`${cmd} 失败：${e.stderr?.toString().trim().split('\n')[0] || e.message}`); }
// 变更类命令后自动留一版看板快照（工作区根 git init 过才生效，未 init 时静默跳过）
if (['init', 'new-card', 'card-move', 'card-rm', 'card-set', 'ledger'].includes(cmd)) {
  const snapRoot = arg(argv, 'root');
  if (snapRoot) snapshot(path.resolve(snapRoot), cmd);
}