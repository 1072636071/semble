#!/usr/bin/env node
// board.mjs 冒烟自测：零依赖，在系统临时目录里跑完「init → 投卡 → 领卡 → 开/收 worktree → verify → 快照」全链，
// 并断言破坏性操作的边界与三态 + 标签正交（D9 / 工单 75-c01）的确定性行为。
// 用法：node scripts/selftest.mjs
// 动机（2026-09-30 事故与同轮 retro）：board.mjs 无任何自动化检查，一次错误的字符串替换就把文件写成两倍长；
// 本脚本把「命令还能跑、边界还拦得住、快照真落盘、防抢还在」变成可机检断言。
// 每条闸门都配一个反例（故障注入）：只跑绿不跑红的断言等于没断言。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BOARD = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'board.mjs');
const results = [];
const check = (name, ok, detail = '') => { results.push([name, ok, detail]); console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const run = (args, cwd) => {
  try { return { code: 0, out: execFileSync(process.execPath, [BOARD, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }; }
};
const firstLine = s => String(s).trim().split('\n')[0] || '';
const lastLine = s => String(s).trim().split('\n').pop() || '';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'board-selftest-'));
const root = path.join(tmp, 'board');
const repo = path.join(tmp, 'repo');
const cards = (...p) => path.join(root, 'control', 'cards', ...p);
const git = (cwd, cmd) => execFileSync('git', cmd.split(' '), { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

console.log(`selftest 工作目录：${tmp}`);
try {
  fs.mkdirSync(repo, { recursive: true });
  git(repo, 'init -q -b main');   // init 默认按 main 找基准分支
  fs.writeFileSync(path.join(repo, 'README.md'), '# smoke\n');
  git(repo, '-c user.name=t -c user.email=t@t add -A');
  git(repo, '-c user.name=t -c user.email=t@t commit -q -m init');
  // 让临时仓有 origin/main：add-wt 的默认基线是 origin/main（临时仓没有远端会直接失败）
  git(repo, `remote add origin ${repo.replace(/\\/g, '/')}`);
  git(repo, 'fetch -q origin');

  let r = run(['init', '--root', root, '--repo', 'https://example.invalid/x.git', '--repo-dir', repo], tmp);
  check('init 建工作区', r.code === 0 && fs.existsSync(path.join(root, 'control', 'PROTOCOL.md')), firstLine(r.out));
  // 三态目录（验收 #1）：open/done/archived 存在，五泳道目录不得再被创建
  check('init 建三态目录 open/done/archived', ['open', 'done', 'archived'].every(d => fs.existsSync(cards(d))));
  check('init 不再建五泳道目录', ['inbox', 'claimed', 'review', 'blocked'].every(d => !fs.existsSync(cards(d))));

  r = run(['new-card', '--root', root, '--id', '001-smoke', '--level', 'L1', '--model', 'test', '--force'], tmp);
  check('new-card 投卡落 open/ 待领位', r.code === 0 && fs.existsSync(cards('open', '001-smoke.md')), firstLine(r.out));
  const fresh = fs.readFileSync(cards('open', '001-smoke.md'), 'utf8');
  // 投卡即带 triage 标签（无工单可取 ⇒ needs-triage），labels 行为空等于第 5 路对账无据
  check('新卡自动落 labels 行', /^- labels: needs-triage$/m.test(fresh), (fresh.match(/^- labels:.*$/m) || ['(无)'])[0]);
  check('模板占位的 doc_ref 不算 URL 违规', /^- doc_ref: $/m.test(fresh));
  // 跨行泄漏回归（0.9.3「正文 - PRD: 假 MISMATCH」同型坑）：空的 doc_ref 不得把下一行抄成自己的值
  check('空 doc_ref 不吞下一行（跨行泄漏回归）',
    /^- doc_ref: \(未填\)$/m.test(run(['card-read', '--root', root, '--id', '001-smoke'], tmp).out));

  r = run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'claimed', '--actor', 'selftest'], tmp);
  check('领取 = 原子改名到 .claimed（防抢地基仍在）', r.code === 0 && fs.existsSync(cards('open', '001-smoke.claimed.md')) && !fs.existsSync(cards('open', '001-smoke.md')));
  check('领取在 open/ 内完成（不新建 claimed 目录）', !fs.existsSync(cards('claimed')));

  // 防抢反例：目标位已被占时第二次领取必须被拒，且原卡不得消失
  fs.writeFileSync(cards('open', '002-race.claimed.md'), '# 002-race\n\n- 标题: 抢占诱饵\n- labels: ready-for-agent\n\n## 流转追加段\n\n（占位）\n');
  fs.writeFileSync(cards('open', '002-race.md'), '# 002-race\n\n- 标题: 竞态卡\n- labels: ready-for-agent\n\n## 流转追加段\n\n（占位）\n');
  r = run(['card-move', '--root', root, '--id', '002-race', '--to', 'claimed', '--actor', 'loser'], tmp);
  check('抢同一张卡时被拒（目标已存在）', r.code === 1 && /目标已存在/.test(r.out), firstLine(r.out));
  check('被拒一方不动原卡（未丢件）', fs.existsSync(cards('open', '002-race.md')));
  // 同一 id 占两个位 ⇒ verify 必须报「同时存在」，这是 ADR-004 的唯一腐坏面
  r = run(['verify', '--root', root], tmp);
  check('一位双占被 verify 抓出', /同时存在于 inbox \+ claimed/.test(r.out), lastLine(r.out));
  fs.rmSync(cards('open', '002-race.claimed.md'));
  fs.rmSync(cards('open', '002-race.md'));

  r = run(['add-wt', '--root', root, '--ticket', '001-smoke'], tmp);
  check('add-wt 开工作区', r.code === 0 && fs.existsSync(path.join(root, 'wt', '001-smoke')), firstLine(r.out));

  r = run(['card-read', '--root', root, '--id', '001-smoke'], tmp);
  check('card read 出 labels 与 doc_ref 派生行', /^- labels: /m.test(r.out) && /^- doc_ref: /m.test(r.out));
  check('card read 报出执行态文件名', /001-smoke\.claimed\.md/.test(r.out), firstLine(r.out));

  r = run(['verify', '--root', root], tmp);
  check('verify 五路对账一致', r.code === 0, lastLine(r.out));
  // 注：不再断言「日志里出现『五路』字样」——那是 grep 自家文案的自证型断言（徽标删掉照样绿），
  // 第 5 路的有效性由下面的标签反例（越界/wontfix/缺行）与历史行双向闭合两条真判据兜。

  // 受阻：三态后没有 blocked/ 目录，语义 = 留在 open/ 待领位 + needs-info 标签
  r = run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'blocked', '--actor', 'selftest', '--reason', '冒烟受阻'], tmp);
  check('--to blocked 落回待领位并打 needs-info', r.code === 0 && fs.existsSync(cards('open', '001-smoke.md'))
    && /needs-info/.test(fs.readFileSync(cards('open', '001-smoke.md'), 'utf8')));
  check('--to blocked 不建 blocked 目录', !fs.existsSync(cards('blocked')));
  r = run(['verify', '--root', root], tmp);
  check('受阻卡（带标签）verify 仍绿', r.code === 0, lastLine(r.out));

  // 历史账本兼容：五泳道时代留下的 `->blocked` 行必须仍能回放（改历史 = 造假，所以是读侧兼容）
  fs.appendFileSync(path.join(root, 'control', 'ledger.md'),
    '| 2026-01-01T00:00:00+08:00 | legacy | move 001-smoke.md inbox->blocked | 001-smoke | 历史行注入 |\n');
  r = run(['verify', '--root', root], tmp);
  check('历史 ->blocked 行在新结构下闭合', r.code === 0, lastLine(r.out));
  // 反例：把标签抹掉后同一条历史行必须变红（证明这条闸门真的在判，而不是恒真）
  const lb = fs.readFileSync(cards('open', '001-smoke.md'), 'utf8').replace(/^- labels: .*$/m, '- labels: ready-for-agent');
  fs.writeFileSync(cards('open', '001-smoke.md'), lb);
  r = run(['verify', '--root', root], tmp);
  check('受阻卡缺 needs-info 时被历史行揪出（反例）', r.code === 5 && /needs-info/.test(r.out), lastLine(r.out));
  fs.writeFileSync(cards('open', '001-smoke.md'), lb.replace(/^- labels: .*$/m, '- labels: needs-info'));
  r = run(['verify', '--root', root], tmp);
  check('补回标签即闭合（同一判据双向）', r.code === 0, lastLine(r.out));

  // 旧泳道残卡：migrate 后 claimed/ 作为空目录留着（红线 §7.2 不删），照旧协议 mv 进去的卡必须红灯
  fs.mkdirSync(cards('claimed'), { recursive: true });
  fs.copyFileSync(cards('open', '001-smoke.md'), cards('claimed', '003-stray.md'));
  r = run(['verify', '--root', root], tmp);
  check('旧泳道残卡被揪出（不静默丢卡）', r.code === 5 && /落在旧泳道 claimed/.test(r.out), lastLine(r.out));
  check('报错给出可照做的目标路径', /mv 到 control\/cards\/open\/003-stray\.claimed\.md/.test(r.out.replace(/\\/g, '/')));
  fs.rmSync(cards('claimed'), { recursive: true, force: true });
  r = run(['verify', '--root', root], tmp);
  check('清掉残卡后回到绿（判据不粘连）', r.code === 0, lastLine(r.out));

  // 破坏性操作边界：越界/不存在的目标必须被拒且不动文件
  r = run(['rm-wt', '--root', root, '--ticket', '../control'], tmp);
  check('rm-wt 拒绝路径穿越', r.code === 1 && fs.existsSync(path.join(root, 'control', 'PROTOCOL.md')));
  r = run(['rm-wt', '--root', root, '--ticket', '..'], tmp);
  check('rm-wt 拒绝 ..', r.code === 1);
  r = run(['rm-wt', '--root', root, '--ticket', 'no-such-card'], tmp);
  check('rm-wt 拒绝不存在的卡', r.code === 1);

  // 假字段：正文里写 - PRD: 反引号路径不得被当卡头字段
  fs.appendFileSync(cards('open', '001-smoke.md'), '\n## 正文\n\n- PRD: `E:\\nowhere\\missing.md`\n');
  r = run(['verify', '--root', root], tmp);
  check('正文里的 - PRD: 不产生假 MISMATCH', r.code === 0, lastLine(r.out));

  // 标签维度反例：越界值与 wontfix 停在 open 都要红
  r = run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'labels', '--value', 'in-progress'], tmp);
  check('card set labels 越界值被警告', r.code === 0 && /不在 triage 五标签/.test(r.out), firstLine(r.out));
  r = run(['verify', '--root', root], tmp);
  check('越界标签被 verify 报出（反例）', r.code === 5 && /非 triage 值/.test(r.out), lastLine(r.out));
  r = run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'labels', '--value', 'wontfix'], tmp);
  r = run(['verify', '--root', root], tmp);
  check('wontfix 卡在未收口位被报（反例）', r.code === 5 && /wontfix 却仍在未收口位/.test(r.out), lastLine(r.out));
  r = run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'doc_ref', '--value', 'E:\\work\\x.md'], tmp);
  r = run(['verify', '--root', root], tmp);
  check('doc_ref 写本地路径被报（反例）', r.code === 5 && /doc_ref 不是 URL/.test(r.out), lastLine(r.out));
  r = run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'doc_ref', '--value', 'https://example.invalid/ticket/1'], tmp);
  r = run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'labels', '--value', 'needs-info'], tmp);
  r = run(['verify', '--root', root], tmp);
  check('doc_ref 成真 URL 后闭合', r.code === 0, lastLine(r.out));

  // 看板四泳道（待领取/处理中/待审核/阻塞）+ 历史列默认隐藏 + 处理计时读数。
  // 判据只认列容器与卡片级 markup，不认列标题/footer 里的同一批中文
  // （否则徽标与 chip 的代码删掉照样绿，属自证型断言）。segOf 按列切段，用来验「一卡只落一列」。
  const segOf = (h, name) => {
    const i = h.indexOf(`<h2>${name} (`);
    if (i < 0) return '';
    const j = h.indexOf('<h2>', i + 1);
    return j < 0 ? h.slice(i) : h.slice(i, j);
  };
  run(['html', '--root', root], tmp);
  const html = fs.readFileSync(path.join(root, 'control', 'board.html'), 'utf8');
  check('board.html 渲染四泳道（待领取/处理中/待审核/阻塞）',
    ['待领取', '处理中', '待审核', '阻塞'].every(n => new RegExp(`<h2>${n} \\(\\d+\\)</h2>`).test(html)),
    (html.match(/<h2>[^<]*<\/h2>/g) || []).join(' | '));
  check('已完成/已归档列默认不显示（hist 列带 display:none）',
    /<div class="col hist" style="display:none"><h2>已完成 \(\d+\)<\/h2>/.test(html)
    && /<div class="col hist" style="display:none"><h2>已归档 \(\d+\)<\/h2>/.test(html));
  check('泳道空了也占位（四列结构稳定，不随卡片增减变形）', /<div class="none">（空）<\/div>/.test(segOf(html, '处理中')));
  check('needs-info 的待领卡归「阻塞」列，且不在「待领取」列重复出现（一卡一列）',
    !/001-smoke/.test(segOf(html, '待领取')) && /001-smoke/.test(segOf(html, '阻塞')));
  check('board.html 带 triage 标签色标（卡片级 chip）', /<span class="lb"[^>]*>needs-info<\/span>/.test(html));
  check('board.html 带执行态徽标（待领取）', /<span class="tk"[^>]*>待领取<\/span>/.test(html));
  check('board.html 的 doc_ref 渲染为外链', /https:\/\/example\.invalid\/ticket\/1/.test(html));
  // 徽标必须由文件名后缀驱动：领到在办位再渲染，它得跟着从「待领取」变「处理中」
  const rClaim = run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'claimed', '--actor', 'selftest', '--reason', '冒烟：验证徽标随后缀'], tmp);
  const claimedBody = () => fs.readFileSync(cards('open', '001-smoke.claimed.md'), 'utf8');
  check('领取未带 --harness/--llm 时明着提示补（不静默留空）', /未带 --harness/.test(rClaim.out) && /未带 .*--llm/.test(rClaim.out), firstLine(rClaim.out));
  check('领取自动盖 开始处理 + Harness/LLM 占位 + 清空 结束处理',
    /^- 开始处理: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/m.test(claimedBody())
    && /^- Harness: （未标注）$/m.test(claimedBody()) && /^- LLM: （未标注）$/m.test(claimedBody()) && /^- 结束处理: $/m.test(claimedBody()),
    (claimedBody().match(/^- (Harness|LLM|开始处理|结束处理):.*$/gm) || ['(全无)']).join(' / '));
  // 插错位置的字段等于没写：看板与 card-read 都只认卡头行
  check('计时字段插进卡头字段块（不落进小节）',
    claimedBody().indexOf('- 开始处理:') < claimedBody().indexOf('## 领取记录'));
  run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'Harness', '--value', 'Qoder'], tmp);
  run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'LLM', '--value', 'Claude Sonnet 4.5'], tmp);
  run(['html', '--root', root], tmp);
  const html2 = fs.readFileSync(path.join(root, 'control', 'board.html'), 'utf8');
  check('徽标随执行态切换（处理中替代待领取）',
    /<span class="tk"[^>]*>处理中<\/span>/.test(html2) && !/<span class="tk"[^>]*>待领取<\/span>/.test(html2));
  const procSeg = segOf(html2, '处理中');
  check('处理中列显示 🛠 Harness · LLM · ▶ 开始 · 已办时长',
    /🛠 Qoder · Claude Sonnet 4\.5/.test(procSeg) && /▶ \d{2}-\d{2} \d{2}:\d{2}/.test(procSeg) && /已办 <b>/.test(procSeg),
    (procSeg.match(/<div class="proc">[\s\S]*?<\/div>/) || ['(无 proc 行)'])[0].slice(0, 200));
  const rLeave = run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'blocked', '--actor', 'selftest', '--reason', '冒烟：回到待领位'], tmp);
  check('离开 claimed 自动盖 结束处理 并报本轮处理时长',
    /本轮处理时长/.test(rLeave.out)
    && /^- 结束处理: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/m.test(fs.readFileSync(cards('open', '001-smoke.md'), 'utf8')),
    firstLine(rLeave.out));
  // 老板（v0.11.0 之前投的卡）没有计时字段：看板与 card-read 必须能从流转段回推出开始时间，否则升级当天全板空白
  fs.writeFileSync(cards('open', '006-legacy.claimed.md'),
    '# 006-legacy\n\n- 标题: 老板在办卡（无计时字段）\n- labels: ready-for-agent\n\n## 领取记录\n\n（略）\n\n## 流转追加段\n\n- 2026-09-28 09:00 | inbox->claimed | old-runner | 老板留下的在办卡\n');
  run(['html', '--root', root], tmp);
  const html3 = fs.readFileSync(path.join(root, 'control', 'board.html'), 'utf8');
  check('无计时字段的卡回退流转段推得开始时间（并标注是推的）',
    /\[由流转段推得\]/.test(run(['card-read', '--root', root, '--id', '006-legacy'], tmp).out)
    && /▶ 09-28 09:00/.test(segOf(html3, '处理中')));
  check('harness/llm 缺失时看板红字提示，而不是静默空白', /class="warn"[^>]*>🛠 harness\/模型未标注/.test(segOf(html3, '处理中')));
  check('回退读数不臆造结束时间', !/⏹/.test(segOf(html3, '处理中')));
  // 卡面没有这四行时必须**插进去**：旧板上大量在飞卡是 v0.11.0 之前投的，缺行就 die 等于逼 leader 手改卡面
  run(['card-set', '--root', root, '--id', '006-legacy', '--field', 'Harness', '--value', 'Codex'], tmp);
  check('缺行时 card-set 把字段插进卡头字段块（不 die、不落进小节）',
    /^- Harness: Codex$/m.test(fs.readFileSync(cards('open', '006-legacy.claimed.md'), 'utf8'))
    && fs.readFileSync(cards('open', '006-legacy.claimed.md'), 'utf8').indexOf('- Harness:') < fs.readFileSync(cards('open', '006-legacy.claimed.md'), 'utf8').indexOf('## 领取记录'));
  // 卡头字段替换必须只认卡头字段块：小节正文里手写一个同名字段，card-set 不得把它误当卡头行改掉
  const secInject = fs.readFileSync(cards('open', '006-legacy.claimed.md'), 'utf8')
    .replace('## 领取记录', '## 领取记录\n\n- Harness: 正文里手写的旧值\n');
  fs.writeFileSync(cards('open', '006-legacy.claimed.md'), secInject);
  run(['card-set', '--root', root, '--id', '006-legacy', '--field', 'Harness', '--value', 'Cursor'], tmp);
  const afterSet = fs.readFileSync(cards('open', '006-legacy.claimed.md'), 'utf8');
  check('card-set 只改卡头字段块，不碰小节正文里的同名字段行',
    (afterSet.match(/^- Harness: .*$/gm) || []).join(' | ') === '- Harness: Cursor | - Harness: 正文里手写的旧值');
  // 坏时间戳：绝不能拿原始字符串截 11 个字冒充一个干净时间（XSS 面 + 假读数面）
  // 001-smoke 此时在待领位（blocked 回退），先领回 claimed 位再测处理中列的告警渲染
  run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'claimed', '--actor', 'selftest', '--harness', 'selftest-h', '--llm', 'test-model', '--reason', '冒烟：坏时间戳测试'], tmp);
  run(['card-set', '--root', root, '--id', '001-smoke', '--field', '开始处理', '--value', '" onload="alert(9)'], tmp);
  run(['html', '--root', root], tmp);
  const htmlBad = fs.readFileSync(path.join(root, 'control', 'board.html'), 'utf8');
  check('坏开始时间戳显示红字告警，不截断冒充、不静默吞掉',
    /class="warn"[^>]*>▶ 开始时间无法解析/.test(segOf(htmlBad, '处理中')) && !/onload="alert\(9\)/.test(segOf(htmlBad, '处理中')),
    (segOf(htmlBad, '处理中').match(/<div class="proc">[\s\S]*?<\/div>/) || ['(无)'])[0].slice(0, 200));
  run(['card-set', '--root', root, '--id', '001-smoke', '--field', '开始处理', '--value', '2026-09-30T10:00:00+08:00'], tmp);
  run(['card-set', '--root', root, '--id', '001-smoke', '--field', '结束处理', '--value', 'not-a-date'], tmp);
  run(['html', '--root', root], tmp);
  const htmlBad2 = fs.readFileSync(path.join(root, 'control', 'board.html'), 'utf8');
  check('坏结束时间戳同样红字告警', /class="warn"[^>]*>⏹ 结束时间无法解析/.test(segOf(htmlBad2, '处理中')));
  run(['card-set', '--root', root, '--id', '001-smoke', '--field', '结束处理', '--value', '2026-09-30T11:00:00+08:00'], tmp);
  // 坏时间戳测完，把卡退回待领位（后续写入安全段按 open/001-smoke.md 路径读卡）
  run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'blocked', '--actor', 'selftest', '--reason', '冒烟：坏时间戳测完回待领位'], tmp);

  const ledgerBefore = fs.readFileSync(path.join(root, 'control', 'ledger.md'), 'utf8');
  const rLeg = run(['card-move', '--root', root, '--id', '006-legacy', '--to', 'review', '--actor', 'selftest', '--reason', '冒烟：老板卡补盖章'], tmp);
  check('老板卡离开 claimed 时也自动插 结束处理，并按流转段算出用时',
    /本轮处理时长/.test(rLeg.out)
    && /^- 结束处理: \d{4}-\d{2}-\d{2}T/m.test(fs.readFileSync(cards('open', '006-legacy.review.md'), 'utf8')),
    firstLine(rLeg.out));
  // 夹具卡用完即删，账本也得跟着收回：留着「最后记录它在 review，卡却不存在」的行，
  // 后面每一条 verify 断言都会被这条假红灯污染（真实卡绝不能这么删——那是 §7 红线管辖的现场）
  fs.rmSync(cards('open', '006-legacy.review.md'));
  fs.writeFileSync(path.join(root, 'control', 'ledger.md'), ledgerBefore);

  // ---------- 写入安全与收口位（2026-09-30 三维度审查发现项补测）----------
  // 替换串里的 `$&` 曾被当作特殊序列展开，把整行原文插进新值（写进卡面且看不出来）
  run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'labels', '--value', 'needs-triage$&x'], tmp);
  check('card-set 值里的 $& 不展开（替换串污染回归）',
    /^- labels: needs-triage\$\&x$/m.test(fs.readFileSync(cards('open', '001-smoke.md'), 'utf8')));
  r = run(['verify', '--root', root], tmp);
  check('越界标签值仍被第 5 路拦下', r.code === 5 && /非 triage 值/.test(r.out), lastLine(r.out));
  run(['card-set', '--root', root, '--id', '001-smoke', '--field', 'labels', '--value', 'needs-info'], tmp);
  // 账本列净化：actor/reason 带竖线与换行不得改变列数，也不得让该行退出对账
  r = run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'review', '--actor', 'self|test', '--reason', '带|竖线'], tmp);
  const ledRow = fs.readFileSync(path.join(root, 'control', 'ledger.md'), 'utf8').trim().split('\n').pop();
  check('reason 带竖线时账本仍是 5 列', ledRow.split(/(?<!\\)\|/).length === 7, lastLine(r.out));
  r = run(['verify', '--root', root], tmp);
  check('.review 位 + 带竖线账本行：该行仍参与对账（无假绿）', r.code === 0 && /001-smoke/.test(fs.readFileSync(path.join(root, 'control', 'ledger.md'), 'utf8')), lastLine(r.out));
  // 收口与归档两位是真交付路径，必须走得通
  r = run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'done', '--actor', 'selftest', '--reason', '冒烟收口'], tmp);
  check('.review → done 落裸名', r.code === 0 && fs.existsSync(cards('done', '001-smoke.md')) && !fs.existsSync(cards('open', '001-smoke.md')));
  // 已完成默认不显示：卡仍在 DOM 里（历史面可展开），但一条可见泳道都不能有它
  const htmlDone = fs.readFileSync(path.join(root, 'control', 'board.html'), 'utf8');
  check('收口卡进默认隐藏的「已完成」列，四条可见泳道里不再出现',
    /<div class="col hist" style="display:none"><h2>已完成 \(1\)<\/h2>[\s\S]*?001-smoke/.test(htmlDone)
    && !['待领取', '处理中', '待审核', '阻塞'].some(n => /001-smoke/.test(segOf(htmlDone, n))),
    segOf(htmlDone, '已完成').slice(0, 60));
  check('页头出现「显示已完成/已归档」开关，展开态存 localStorage（按 root 隔离，扛得住 5s 整页刷新）',
    /id="sh"/.test(htmlDone) && /localStorage\.getItem\(K\)/.test(htmlDone) && htmlDone.includes(`const K=${JSON.stringify('showHistory:' + root)}`));
  check('页头计数按泳道拆开报（在办 = 待领取+处理中+待审核+阻塞）',
    /在办 \d+（待领取 \d+ · 处理中 \d+ · 待审核 \d+ · 阻塞 \d+）/.test(htmlDone),
    (htmlDone.match(/在办 [^<]*/) || ['(无)'])[0]);
  // 收口即回收工作区（真实流程：merger 合入后 rm-wt）——否则归档卡会留一个无主 worktree，
  // 被 verify 记成一条 WARN 出入，把「归档位不逼标签」这条判据的读数搅浑。
  r = run(['rm-wt', '--root', root, '--ticket', '001-smoke', '--force'], tmp);
  check('rm-wt 正常回收', r.code === 0 && !fs.existsSync(path.join(root, 'wt', '001-smoke')));
  r = run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'archived', '--actor', 'selftest', '--reason', '冒烟归档'], tmp);
  check('done → archived 走得通且 verify 不判红', r.code === 0 && fs.existsSync(cards('archived', '001-smoke.md')));
  r = run(['verify', '--root', root], tmp);
  check('归档位卡不逼标签（第 5 路只管未收口）', r.code === 0, lastLine(r.out));
  // 带后缀的卡掉进 done/archived = 与「旧泳道残卡」同一失效模式，也必须红灯
  fs.writeFileSync(cards('done', '004-suffixtrap.review.md'), '# 004-suffixtrap\n\n- 标题: 后缀陷阱\n- labels: ready-for-agent\n\n## 流转追加段\n\n（占位）\n');
  r = run(['verify', '--root', root], tmp);
  check('收口位里的带后缀卡被红灯揪出', r.code === 5 && /带执行态后缀却在 done/.test(r.out), lastLine(r.out));
  fs.rmSync(cards('done', '004-suffixtrap.review.md'));
  r = run(['verify', '--root', root], tmp);
  check('清掉陷阱卡回到绿', r.code === 0, lastLine(r.out));
  // blocked token 在三态板不参与卡位统计（否则同一张卡既算活卡又被残卡红灯判两次）
  fs.mkdirSync(cards('blocked'), { recursive: true });
  fs.copyFileSync(cards('archived', '001-smoke.md'), cards('blocked', '005-oldblock.md'));
  r = run(['verify', '--root', root], tmp);
  check('三态板里 blocked/ 只报一条残卡红灯（不双判）',
    r.code === 5 && r.out.split('\n').filter(l => /MISMATCH.*005-oldblock/.test(l)).length === 1 && !/同时存在于 005-oldblock/.test(r.out),
    r.out.split('\n').filter(l => /005-oldblock/.test(l)).join(' || '));
  fs.rmSync(cards('blocked'), { recursive: true, force: true });

  // 快照：工作区根 git init 后，变更类命令应自动留档
  git(root, 'init -q');
  fs.writeFileSync(path.join(root, '.gitignore'), 'wt/\n');
  r = run(['ledger', '--root', root, '--action', 'selftest 记账'], tmp);
  let commits = git(root, 'log --oneline').trim().split('\n').filter(Boolean).length;
  check('变更类命令自动快照', r.code === 0 && commits >= 1, `commits=${commits}`);
  const snap = execFileSync('git', ['-C', root, 'show', 'HEAD:control/cards/archived/001-smoke.md'], { encoding: 'utf8' });
  check('快照可取回三态位上的卡（归档位）', snap.includes('# 001-smoke'));

  // render：assets 与 live 副本应一致（漂移检测本身可跑）
  r = run(['render', '--root', root], tmp);
  check('render 漂移检测可跑', r.code === 0 && /\[same\]|\[drift\]/.test(r.out));

  r = run(['board', '--root', root], tmp);
  check('board 默认把收口/归档折叠成计数',
    r.code === 0 && /已完成 done \(0\)/.test(r.out) && /已归档 archived \(1\)/.test(r.out) && !/001-smoke\.md/.test(r.out), firstLine(r.out));
  r = run(['board', '--root', root, '--all'], tmp);
  check('board --all 展开归档明细', /已归档 archived \(1\)/.test(r.out) && /001-smoke\.md/.test(r.out));

  // ---------- prd.html（第三页）：按收口态分两栏 + 整轨提示词按钮 ----------
  // 这一页此前**零覆盖**，而「📋 PRD 级整轨提示词」按钮其实是个死按钮（PRD_PROMPTS 定义了却没有监听器消费）。
  // 夹具直接造在临时权威仓的 .scratch/ 下（scanPrds 的数据源），断言只认 markup 与脚本里的真实消费点，不认文案。
  const sc = path.join(repo, '.scratch');
  const put = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
  put(path.join(sc, '90-demo', 'PRD.md'), '# 90 演示 PRD\n\n**Status:** in-progress\n');
  put(path.join(sc, '90-demo', 'issues', '01-alpha.md'), '# 1 · alpha\n\n**Status:** done\n\n- [x] 验收一\n');
  put(path.join(sc, '90-demo', 'issues', '02-beta.md'), '# 2 · beta\n\n**Status:** ready-for-agent\n\n**Blocked by:** 无\n\n- [ ] 验收一\n');
  put(path.join(sc, '91-shipped', 'PRD.md'), '# 91 已交付 PRD\n\n**Status:** done\n');
  put(path.join(sc, '91-shipped', 'issues', '01-gamma.md'), '# 1 · gamma\n\n**Status:** done\n\n- [x] 验收一\n');
  run(['html', '--root', root], tmp);
  const prdHtml = fs.readFileSync(path.join(root, 'control', 'prd.html'), 'utf8');
  const prdSect = name => {
    const i = prdHtml.indexOf(`<h2 class="sh2">${name}`);
    if (i < 0) return '';
    const j = prdHtml.indexOf('</section>', i); // 必须按 section 收尾切：切到文件尾会把页脚脚本里的 PRD_PROMPTS 也圈进来（假红灯）
    return prdHtml.slice(i, j < 0 ? prdHtml.length : j);
  };
  check('prd.html 分两栏（未完成 PRD / 已完成 PRD）且各带计数',
    /<h2 class="sh2">未完成 PRD \(1\)/.test(prdHtml) && /<h2 class="sh2">已完成 PRD \(1\)/.test(prdHtml),
    (prdHtml.match(/<h2 class="sh2">[^<]*/g) || []).join(' | '));
  check('收口判据成立：全部工单 done 的 PRD 只在「已完成」栏，尚有开放工单的只在「未完成」栏',
    /91-shipped/.test(prdSect('已完成 PRD')) && !/91-shipped/.test(prdSect('未完成 PRD'))
    && /90-demo/.test(prdSect('未完成 PRD')) && !/90-demo/.test(prdSect('已完成 PRD')));
  check('已完成栏默认 display:none + 页头开关与工单看板共用同一 localStorage 键（按 root 隔离）',
    /<section class="sect hist" style="display:none"><h2 class="sh2">已完成 PRD/.test(prdHtml)
    && /id="sh"/.test(prdHtml) && /localStorage\.getItem\(K\)/.test(prdHtml) && prdHtml.includes(`const K=${JSON.stringify('showHistory:' + root)}`));
  check('「PRD 级整轨提示词」按钮真被监听器消费（死按钮回归）',
    /querySelectorAll\('\.cp-prd'\)\.forEach/.test(prdHtml) && /PRD_PROMPTS\[b\.dataset\.prd\]/.test(prdHtml)
    && /90-demo/.test((prdHtml.match(/const PRD_PROMPTS=(\{[\s\S]*?\});/) || [])[1] || ''),
    (prdHtml.match(/PRD_PROMPTS=\{(.{0,60})/) || ['(无 PRD_PROMPTS)'])[1]);
  check('PRD 级整轨提示词自带环境自报要求（H1 修复）',
    /--harness/.test((prdHtml.match(/const PRD_PROMPTS=(\{[\s\S]*?\});/) || [])[1] || '')
    && /--llm/.test((prdHtml.match(/const PRD_PROMPTS=(\{[\s\S]*?\});/) || [])[1] || ''));
  fs.rmSync(path.join(sc, '90-demo'), { recursive: true, force: true });
  fs.rmSync(path.join(sc, '91-shipped'), { recursive: true, force: true });

  // ---------- migrate：另起一块旧五泳道板，验证迁三态的完整性与幂等 ----------
  const old = path.join(tmp, 'old');
  const oldCards = (...p) => path.join(old, 'control', 'cards', ...p);
  fs.mkdirSync(oldCards('inbox'), { recursive: true });
  fs.mkdirSync(oldCards('claimed'), { recursive: true });
  fs.mkdirSync(oldCards('review'), { recursive: true });
  fs.mkdirSync(oldCards('done'), { recursive: true });
  fs.mkdirSync(oldCards('blocked'), { recursive: true });
  fs.mkdirSync(path.join(old, 'control', 'starter'), { recursive: true });
  fs.copyFileSync(path.join(root, 'control', 'workspace.json'), path.join(old, 'control', 'workspace.json'));
  fs.copyFileSync(path.join(root, 'control', 'CARD-TEMPLATE.md'), path.join(old, 'control', 'CARD-TEMPLATE.md'));
  fs.copyFileSync(path.join(root, 'control', 'PROTOCOL.md'), path.join(old, 'control', 'PROTOCOL.md'));
  // 旧板夹具：全部**不带 labels**（除了 014 自带一个），用来验 migrate 只翻译 blocked、不代拟他标签
  const oldCard = (lane, id, extra = '') => fs.writeFileSync(oldCards(lane, `${id}.md`),
    `# ${id}\n\n- 标题: 旧板 ${id}\n- 依赖: 无\n${extra}\n## 流转追加段\n\n（占位）\n`);
  oldCard('blocked', '009-old');
  oldCard('review', '010-oldreview');
  oldCard('done', '011-olddone');
  oldCard('inbox', '012-oldnew');
  oldCard('claimed', '014-oldclaimed', '- labels: ready-for-agent\n');

  // 旧五泳道板（未迁三态）也必须出同一套四泳道：泳道取自 token，与物理布局无关——
  // 否则升级当天旧板用户的看板会先塌成一列再谈迁板。
  run(['html', '--root', old], tmp);
  const htmlOld = fs.readFileSync(path.join(old, 'control', 'board.html'), 'utf8');
  check('旧五泳道板同样渲染四泳道并按目录归位',
    /012-oldnew/.test(segOf(htmlOld, '待领取')) && /014-oldclaimed/.test(segOf(htmlOld, '处理中'))
    && /010-oldreview/.test(segOf(htmlOld, '待审核')) && /009-old/.test(segOf(htmlOld, '阻塞')),
    (htmlOld.match(/<h2>[^<]*<\/h2>/g) || []).join(' | '));
  // 旧板不按 needs-info 标签改道（位置真源 = 目录，标签改道只在三态板生效）：014 带 ready-for-agent 不算数，
  // 造一张带 needs-info 的 inbox 卡，它必须留在「待领取」列，而不是被摘进「阻塞」列
  fs.writeFileSync(oldCards('inbox', '015-oldneedsinfo.md'),
    '# 015-oldneedsinfo\n\n- 标题: 旧板带 needs-info 的待领卡\n- labels: needs-info\n\n## 流转追加段\n\n（占位）\n');
  run(['html', '--root', old], tmp);
  const htmlOld2 = fs.readFileSync(path.join(old, 'control', 'board.html'), 'utf8');
  check('旧板 needs-info 卡留在待领取列（不按标签改道阻塞列）',
    /015-oldneedsinfo/.test(segOf(htmlOld2, '待领取')) && !/015-oldneedsinfo/.test(segOf(htmlOld2, '阻塞')));
  check('旧板的 done 泳道同样默认隐藏（历史列 + 开关）',
    /<div class="col hist" style="display:none"><h2>已完成 \(1\)<\/h2>[\s\S]*?011-olddone/.test(htmlOld)
    && !/011-olddone/.test(segOf(htmlOld, '待领取') + segOf(htmlOld, '阻塞')),
    segOf(htmlOld, '已完成').slice(0, 60));

  r = run(['migrate', '--root', old, '--dry-run'], tmp);
  check('migrate --dry-run 不动文件', r.code === 0 && fs.existsSync(oldCards('blocked', '009-old.md')) && !fs.existsSync(oldCards('open')));
  check('migrate 点名缺标签的卡且声明不代拟', /不代拟/.test(r.out) && /009-old|012-oldnew/.test(r.out), firstLine(r.out));
  r = run(['migrate', '--root', old, '--actor', 'selftest'], tmp);
  check('migrate 迁 blocked→open+needs-info（唯一有据的翻译）', fs.existsSync(oldCards('open', '009-old.md'))
    && /- labels: needs-info/.test(fs.readFileSync(oldCards('open', '009-old.md'), 'utf8')));
  check('migrate 迁 review→open.review', fs.existsSync(oldCards('open', '010-oldreview.review.md')));
  check('migrate 迁 claimed→open.claimed 且原标签不被覆写', fs.existsSync(oldCards('open', '014-oldclaimed.claimed.md'))
    && /- labels: ready-for-agent/.test(fs.readFileSync(oldCards('open', '014-oldclaimed.claimed.md'), 'utf8')));
  check('migrate 迁 done→done（无后缀）', fs.existsSync(oldCards('done', '011-olddone.md')));
  check('migrate 迁 inbox→open 裸名', fs.existsSync(oldCards('open', '012-oldnew.md')));
  check('未收口卡不被代拟标签（凭空造 triage 的回归）',
    !/labels/.test(fs.readFileSync(oldCards('open', '012-oldnew.md'), 'utf8')));
  check('归档卡不被硬塞标签（无 undefined 污染）',
    fs.existsSync(oldCards('done', '011-olddone.md')) && !/labels/.test(fs.readFileSync(oldCards('done', '011-olddone.md'), 'utf8')));
  r = run(['verify', '--root', old], tmp);
  check('代拟被拒后由第 5 路红灯催领导者补', r.code === 5 && /缺 labels 行/.test(r.out), lastLine(r.out));
  for (const [lane, f] of [['open', '012-oldnew.md'], ['open', '010-oldreview.review.md']])
    fs.writeFileSync(oldCards(lane, f), fs.readFileSync(oldCards(lane, f), 'utf8').replace(/^- 依赖:[^\r\n]*/m, '- 依赖: 无\n- labels: needs-triage'));
  check('migrate 不删旧目录（红线 §7.2）', fs.existsSync(oldCards('blocked')) && fs.readdirSync(oldCards('blocked')).length === 0);
  check('migrate 记一笔账本', /migrate 五泳道->三态/.test(fs.readFileSync(path.join(old, 'control', 'ledger.md'), 'utf8')));
  check('账本行分清改名与原位（done 同道名不动）',
    fs.readFileSync(path.join(old, 'control', 'ledger.md'), 'utf8').includes('改名 5 张 / 原位未动 1 张'));
  r = run(['migrate', '--root', old, '--actor', 'selftest'], tmp);
  check('migrate 幂等（重跑不重复搬）', r.code === 0 && fs.existsSync(oldCards('open', '009-old.md')) && !/009-old/.test(r.out));
  check('无东西可改时不往账本追加空转行',
    fs.readFileSync(path.join(old, 'control', 'ledger.md'), 'utf8').split('migrate 五泳道->三态').length === 2);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter(([, ok]) => !ok);
console.log(`\nselftest: ${results.length - failed.length}/${results.length} 通过`);
if (failed.length) { console.log('失败项：' + failed.map(([n]) => n).join('、')); process.exit(1); }
