#!/usr/bin/env node
// resolve-token.mjs — 解析令牌源，输出平台凭据。零依赖。
// 默认输出掩码，明文只在显式 flag 下输出。
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REL = ['Nutstore', '1', '我的坚果云', '项目机密', 'Secret', 'git-tools.md'];

function resolveSource() {
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const p = path.join(home, ...REL);
  if (!existsSync(p)) {
    console.error(`令牌源不存在: ${p}`);
    console.error('检查用户名解析（USERPROFILE / HOME）或坚果云同步状态。');
    process.exit(2);
  }
  return p;
}

// 极简 YAML：只解析 platforms 下的 `- key: value` 序列
function parse(text) {
  const block = text.match(/```ya?ml\s*([\s\S]*?)```/i);
  if (!block) throw new Error('令牌源中未找到 YAML 块');
  /** 去掉 YAML 标量两端的引号——否则 `remote_user: "@token"` 会带着引号参与比较（曾导致 gitee 403）。 */
  const unquote = (v) => v.replace(/^(['"])(.*)\1$/, '$2');
  const items = [];
  let cur = null;
  for (const raw of block[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = line.match(/^\s*-\s*([A-Za-z_]+)\s*:\s*(.*)$/);
    if (item) {
      cur = {};
      items.push(cur);
      cur[item[1]] = unquote(item[2].trim());
      continue;
    }
    const kv = line.match(/^\s+([A-Za-z_]+)\s*:\s*(.*)$/);
    if (kv && cur) cur[kv[1]] = unquote(kv[2].trim());
  }
  return items;
}

function mask(t) {
  if (!t) return '(空)';
  return t.slice(0, 4) + '*'.repeat(Math.max(t.length - 8, 3)) + t.slice(-4);
}

function warnPlaintext() {
  console.error('[warn] 输出含明文令牌。勿落盘、勿写入日志、勿在回复中回显。');
}

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : null;
};

const platforms = parse(readFileSync(resolveSource(), 'utf8'));
const find = (h) => platforms.find((p) => p.host === h);

// 明文模式：--token <host>
const tokenHost = flag('--token');
if (tokenHost) {
  const p = find(tokenHost);
  if (!p) {
    console.error(`未知 host: ${tokenHost}。已有: ${platforms.map((x) => x.host).join(', ')}`);
    process.exit(3);
  }
  warnPlaintext();
  process.stdout.write(p.token + '\n');
  process.exit(0);
}

// 明文模式：--remote <host> <owner/repo>
if (argv.includes('--remote')) {
  const rest = argv.slice(argv.indexOf('--remote') + 1);
  const [host, repo] = rest;
  const p = find(host);
  if (!p || !repo) {
    console.error('用法: --remote <host> <owner/repo>');
    process.exit(3);
  }
  const user = p.remote_user === '@token' ? 'oauth2' : p.remote_user;
  warnPlaintext();
  process.stdout.write(`https://${user}:${p.token}@${p.host}/${repo}.git\n`);
  process.exit(0);
}

// 默认 / --host：掩码输出
const only = flag('--host');
const list = only ? platforms.filter((p) => p.host === only) : platforms;
if (!list.length) {
  console.error(`未知 host: ${only}。已有: ${platforms.map((x) => x.host).join(', ')}`);
  process.exit(3);
}
for (const p of list) {
  console.log(`${p.name}\thost=${p.host}\tremote_user=${p.remote_user}\tauth=${p.auth}\ttoken=${mask(p.token)}`);
}
console.log('\n默认输出为掩码。需要明文用 --token <host> 或 --remote <host> <owner/repo>，输出直接接进命令，别先打印。');
