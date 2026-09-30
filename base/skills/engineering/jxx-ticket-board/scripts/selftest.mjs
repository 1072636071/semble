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
  check('verify 自报五路（账本×卡位×worktree×工单状态×标签）', /五路/.test(r.out), lastLine(r.out));

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

  // 看板三列 + 标签色标（验收 #3）
  run(['html', '--root', root], tmp);
  const html = fs.readFileSync(path.join(root, 'control', 'board.html'), 'utf8');
  check('board.html 渲染三列 open/done/archived',
    /在办 open/.test(html) && /已收口 done/.test(html) && /已归档 archived/.test(html));
  check('board.html 带 triage 标签色标', /\.lb\{/.test(html) && /needs-info/.test(html));
  check('board.html 带执行态徽标', /待领|在办|待终审/.test(html));
  check('board.html 的 doc_ref 渲染为外链', /https:\/\/example\.invalid\/ticket\/1/.test(html));

  // 快照：工作区根 git init 后，变更类命令应自动留档
  git(root, 'init -q');
  fs.writeFileSync(path.join(root, '.gitignore'), 'wt/\n');
  r = run(['ledger', '--root', root, '--action', 'selftest 记账'], tmp);
  let commits = git(root, 'log --oneline').trim().split('\n').filter(Boolean).length;
  check('变更类命令自动快照', r.code === 0 && commits >= 1, `commits=${commits}`);
  const snap = execFileSync('git', ['-C', root, 'show', 'HEAD:control/cards/open/001-smoke.md'], { encoding: 'utf8' });
  check('快照可取回三态位上的卡', snap.includes('# 001-smoke'));

  r = run(['rm-wt', '--root', root, '--ticket', '001-smoke', '--force'], tmp);
  check('rm-wt 正常回收', r.code === 0 && !fs.existsSync(path.join(root, 'wt', '001-smoke')));

  // render：assets 与 live 副本应一致（漂移检测本身可跑）
  r = run(['render', '--root', root], tmp);
  check('render 漂移检测可跑', r.code === 0 && /\[same\]|\[drift\]/.test(r.out));

  r = run(['board', '--root', root], tmp);
  check('board 默认只报收口/归档计数', r.code === 0 && /已完成 done \(0\)/.test(r.out) && !/已归档 archived \(0\)/.test(r.out), firstLine(r.out));

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
  fs.copyFileSync(cards('open', '001-smoke.md'), oldCards('blocked', '009-old.md'));
  fs.copyFileSync(cards('open', '001-smoke.md'), oldCards('review', '010-oldreview.md'));
  fs.copyFileSync(cards('open', '001-smoke.md'), oldCards('done', '011-olddone.md'));
  fs.copyFileSync(cards('open', '001-smoke.md'), oldCards('inbox', '012-oldnew.md'));

  r = run(['migrate', '--root', old, '--dry-run'], tmp);
  check('migrate --dry-run 不动文件', r.code === 0 && fs.existsSync(oldCards('blocked', '009-old.md')) && !fs.existsSync(oldCards('open')));
  r = run(['migrate', '--root', old, '--actor', 'selftest'], tmp);
  check('migrate 迁 blocked→open+needs-info', fs.existsSync(oldCards('open', '009-old.md'))
    && /- labels: needs-info/.test(fs.readFileSync(oldCards('open', '009-old.md'), 'utf8')));
  check('migrate 迁 review→open.review', fs.existsSync(oldCards('open', '010-oldreview.review.md')));
  check('migrate 迁 done→done（无后缀）', fs.existsSync(oldCards('done', '011-olddone.md')));
  check('migrate 迁 inbox→open 裸名', fs.existsSync(oldCards('open', '012-oldnew.md')));
  check('migrate 不删旧目录（红线 §7.2）', fs.existsSync(oldCards('blocked')) && fs.readdirSync(oldCards('blocked')).length === 0);
  check('migrate 记一笔账本', /migrate 五泳道->三态/.test(fs.readFileSync(path.join(old, 'control', 'ledger.md'), 'utf8')));
  r = run(['migrate', '--root', old, '--actor', 'selftest'], tmp);
  check('migrate 幂等（重跑不重复搬）', r.code === 0 && fs.existsSync(oldCards('open', '009-old.md')) && !/009-old/.test(r.out));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter(([, ok]) => !ok);
console.log(`\nselftest: ${results.length - failed.length}/${results.length} 通过`);
if (failed.length) { console.log('失败项：' + failed.map(([n]) => n).join('、')); process.exit(1); }
