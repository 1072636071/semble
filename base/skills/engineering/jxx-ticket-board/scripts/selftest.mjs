#!/usr/bin/env node
// board.mjs 冒烟自测：零依赖，在系统临时目录里跑完「init → 投卡 → 领卡 → 开/收 worktree → verify → 快照」全链，
// 并断言破坏性操作的边界。用法：node scripts/selftest.mjs
// 动机（2026-09-30 事故与同轮 retro）：board.mjs 无任何自动化检查，一次错误的字符串替换就把文件写成两倍长；
// 本脚本把「命令还能跑、边界还拦得住、快照真落盘」变成可机检断言。
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'board-selftest-'));
const root = path.join(tmp, 'board');
const repo = path.join(tmp, 'repo');
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
  check('init 建工作区', r.code === 0 && fs.existsSync(path.join(root, 'control', 'PROTOCOL.md')), r.code ? r.out.trim().split('\n')[0] : '');

  r = run(['new-card', '--root', root, '--id', '001-smoke', '--level', 'L1', '--model', 'test', '--force'], tmp);
  check('new-card 投卡（无工单文件走 --force）', r.code === 0 && fs.existsSync(path.join(root, 'control', 'cards', 'inbox', '001-smoke.md')));

  r = run(['card-move', '--root', root, '--id', '001-smoke', '--to', 'claimed', '--actor', 'selftest'], tmp);
  check('card-move 领取', r.code === 0);

  r = run(['add-wt', '--root', root, '--ticket', '001-smoke'], tmp);
  check('add-wt 开工作区', r.code === 0 && fs.existsSync(path.join(root, 'wt', '001-smoke')), r.code ? r.out.trim().split('\n')[0] : '');

  r = run(['verify', '--root', root], tmp);
  check('verify 无出入', r.code === 0, r.out.trim().split('\n').pop());

  // 破坏性操作边界：越界/不存在的目标必须被拒且不动文件
  r = run(['rm-wt', '--root', root, '--ticket', '../control'], tmp);
  check('rm-wt 拒绝路径穿越', r.code === 1 && fs.existsSync(path.join(root, 'control', 'PROTOCOL.md')));
  r = run(['rm-wt', '--root', root, '--ticket', '..'], tmp);
  check('rm-wt 拒绝 ..', r.code === 1);
  r = run(['rm-wt', '--root', root, '--ticket', 'no-such-card'], tmp);
  check('rm-wt 拒绝不存在的卡', r.code === 1);

  // 假字段：正文里写 - PRD: 反引号路径不得被当卡头字段
  const cardFile = path.join(root, 'control', 'cards', 'claimed', '001-smoke.md');
  fs.appendFileSync(cardFile, '\n## 正文\n\n- PRD: `E:\\nowhere\\missing.md`\n');
  r = run(['verify', '--root', root], tmp);
  check('正文里的 - PRD: 不产生假 MISMATCH', r.code === 0, r.out.trim().split('\n').pop());

  // 快照：工作区根 git init 后，变更类命令应自动留档
  git(root, 'init -q');
  fs.writeFileSync(path.join(root, '.gitignore'), 'wt/\n');
  r = run(['ledger', '--root', root, '--action', 'selftest 记账'], tmp);
  let commits = git(root, 'log --oneline').trim().split('\n').filter(Boolean).length;
  check('变更类命令自动快照', r.code === 0 && commits >= 1, `commits=${commits}`);
  const snap = execFileSync('git', ['-C', root, 'show', 'HEAD:control/cards/claimed/001-smoke.md'], { encoding: 'utf8' });
  check('快照可取回卡内容', snap.includes('- 标题: 001-smoke') || snap.includes('# 001-smoke'));

  r = run(['rm-wt', '--root', root, '--ticket', '001-smoke', '--force'], tmp);
  check('rm-wt 正常回收', r.code === 0 && !fs.existsSync(path.join(root, 'wt', '001-smoke')));

  // render：assets 与 live 副本应一致（漂移检测本身可跑）
  r = run(['render', '--root', root], tmp);
  check('render 漂移检测可跑', r.code === 0 && /\[same\]|\[drift\]/.test(r.out));

  r = run(['board', '--root', root], tmp);
  check('board 默认只报 done 计数', r.code === 0 && r.out.includes('== done (0) =='));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter(([, ok]) => !ok);
console.log(`\nselftest: ${results.length - failed.length}/${results.length} 通过`);
if (failed.length) { console.log('失败项：' + failed.map(([n]) => n).join('、')); process.exit(1); }
