#!/usr/bin/env node
// resolve-token.mjs — 解析令牌源，输出平台凭据。零依赖。
// 默认输出掩码，明文只在显式 flag 下输出。
//
// 令牌源定位已升级（2026-10-12）：与主仓 resolveSecretDir / 灵枢 resolve_secret_dir
// 同款四级链——env TDAI_SECRET_DIR > ~/.tdai/secret-dir.json 指针 > 默认布局 > 扫描兜底。
// 跨机器不写死用户名（原先只认默认布局，换机器/改同步路径即 exit 2）。
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const REL = ['Secret', 'git-tools.md']; // 机密根下的相对路径
const SECRET_DIR_ENV = 'TDAI_SECRET_DIR';
const SECRET_DIR_CACHE = path.join('.tdai', 'secret-dir.json');
const DEFAULT_LAYOUT = ['Nutstore', '1', '我的坚果云', '项目机密'];

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}
function exists(p) {
  try { return existsSync(p); } catch { return false; }
}

/** 四级解析链定位机密根（与主仓/灵枢同款口径）。 */
function resolveSecretRoot() {
  const fromEnv = String(process.env[SECRET_DIR_ENV] ?? '').trim();
  if (fromEnv) {
    if (isDir(fromEnv)) return fromEnv;
    console.error(`${SECRET_DIR_ENV} 指向的目录不存在：${fromEnv}`);
    process.exit(2);
  }
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const cachePath = path.join(home, SECRET_DIR_CACHE);
  try {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
    const dir = String(cached?.secretDir ?? '').trim();
    if (dir && isDir(dir)) return dir;
  } catch { /* 缓存缺失/损坏 ⇒ 继续 */ }
  const fast = path.join(home, ...DEFAULT_LAYOUT);
  if (isDir(fast)) {
    try {
      mkdirSync(path.dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify({ secretDir: fast, resolvedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
    } catch { /* 缓存只是加速腿 */ }
    return fast;
  }
  // 扫描兜底：深度 3，只收「下面真有 registry.yaml」的根（过滤「坚果云同步冲突」假命中）
  const SKIP = new Set(['node_modules', '.git', '.svn', '$RECYCLE.BIN', 'System Volume Information']);
  let found = '';
  const walk = (dir, depth) => {
    if (found) return;
    let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (found) return;
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      let ok = e.isDirectory(); if (!ok) { try { ok = statSync(full).isDirectory(); } catch { ok = false; } }
      if (!ok) continue;
      const cand = path.join(full, '项目机密');
      if (isDir(cand) && exists(path.join(cand, 'registry.yaml'))) { found = cand; return; }
      if (depth < 3) walk(full, depth + 1);
    }
  };
  walk(home, 1);
  if (found) return found;
  console.error(`未找到坚果云机密根（含 registry.yaml 的「项目机密」目录）。`);
  console.error(`解析序：${SECRET_DIR_ENV} env > ${cachePath} 指针 > 默认布局 > 全目录扫描兜底。`);
  process.exit(2);
}

function resolveSource() {
  const p = path.join(resolveSecretRoot(), ...REL);
  if (!exists(p)) {
    console.error(`令牌源不存在: ${p}`);
    console.error('检查坚果云同步状态，或用 secret-store MCP 的 secret_store_list 查该条目登记路径。');
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
