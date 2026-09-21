#!/usr/bin/env node
/**
 * mzg-init.mjs — 为目标目录初始化/刷新/校验 mzg 代码索引（零依赖，Node >= 22）。
 *
 * 流程：探测 CLI → zg --status 判态 → (建/刷索引) → zg --status --check-ready 校验。
 * 退出码：0 = 索引就绪；1 = 失败（CLI 缺失 / root 不存在 / 索引未就绪）。
 *
 * 用法：
 *   node mzg-init.mjs [--root <dir>] [--rebuild] [--install <target>]
 *                     [--embedding <model>] [--dry-run] [--debug]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------- args ----------
const argv = process.argv.slice(2);
function argValue(flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) {
    console.error(`错误：${flag} 需要一个值`);
    process.exit(2);
  }
  return v;
}
const hasFlag = (f) => argv.includes(f);

const ROOT = path.resolve(argValue("--root") ?? process.cwd());
const REBUILD = hasFlag("--rebuild");
const INSTALL_TARGET = argValue("--install");
const EMBEDDING = argValue("--embedding");
const DRY_RUN = hasFlag("--dry-run");
const DEBUG = hasFlag("--debug");

// ---------- helpers ----------
function die(msg, hint) {
  console.error(`[mzg-init] 失败：${msg}`);
  if (hint) console.error(`[mzg-init] 提示：${hint}`);
  process.exit(1);
}

function resolveRoot(raw) {
  // 兼容 Git Bash 形式 /e/work/... → E:\work\...
  const m = raw.match(/^\/([a-zA-Z])\/(.*)$/);
  const win = m ? `${m[1].toUpperCase()}:/${m[2]}` : raw;
  const abs = path.resolve(win);
  if (!fs.existsSync(abs)) die(`root 不存在：${abs}`, "传 Windows 盘符形式路径（如 E:/repo），Git Bash 的 /e/... node 解析不了");
  const st = fs.statSync(abs);
  if (!st.isDirectory()) die(`root 不是目录：${abs}`);
  return abs;
}

function findCli(root) {
  const candidates = [];
  if (process.env.MZG_CLI) candidates.push(process.env.MZG_CLI);
  candidates.push(
    path.join(root, "mzg", "dist", "cli", "index.js"),
    path.join(root, "node_modules", "mzg", "dist", "cli", "index.js"),
    "E:/work/sp/TencentDB-Agent-Memory/mzg/dist/cli/index.js", // 本机 fork 固定位（TDB-AM submodule）
  );
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  return null;
}

function runZg(cli, args, opts = {}) {
  if (DEBUG) console.error(`[mzg-init] run: node ${cli} ${args.join(" ")}`);
  const r = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    timeout: opts.timeout ?? 30 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

// ---------- main ----------
const root = resolveRoot(ROOT);
const cli = findCli(root);
if (!cli) {
  die(
    "找不到 mzg CLI 入口（dist/cli/index.js）",
    "设环境变量 MZG_CLI 指向 CLI js，或在本仓先跑 npm run mzg:bootstrap 构建 fork",
  );
}
console.log(`[mzg-init] CLI : ${cli}`);
console.log(`[mzg-init] root: ${root}`);

// 1) 状态探测
const st = runZg(cli, ["--status", root]);
const out = st.out;
let state;
if (/index is not configured/i.test(out)) state = "missing";
else if (/needs an update/i.test(out)) state = "stale";
else if (/Coverage/i.test(out)) state = "ready";
else die(`status 输出无法判读：\n${out.trim()}`, "加 --debug 查看实际命令；确认 CLI 可用");

console.log(`[mzg-init] 状态: ${state}${state === "missing" ? "（无索引，将初始化）" : state === "stale" ? "（有索引但过期，将增量刷新）" : "（就绪）"}`);

// 2) 按需建/刷索引
let indexed = false;
if (state !== "ready" || REBUILD) {
  const args = ["--index", root, "--mode", "direct"];
  if (REBUILD) args.push("--rebuild");
  if (EMBEDDING) args.push("--embedding", EMBEDDING);
  if (DRY_RUN) {
    console.log(`[mzg-init] [dry-run] 将执行: node ${cli} ${args.join(" ")}`);
  } else {
    console.log(`[mzg-init] 开始建索引（--mode direct，大仓首次可能需要几分钟）...`);
    const t0 = Date.now();
    const r = runZg(cli, args);
    if (r.out.trim()) console.log(r.out.trim());
    if (r.code !== 0) die(`zg --index 退出码 ${r.code}`, "加 --debug 重跑；或先看 status 输出定位嵌入模型/文件扫描问题");
    console.log(`[mzg-init] 索引完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    indexed = true;
  }
} else if (DRY_RUN) {
  console.log("[mzg-init] [dry-run] 索引已就绪，无需操作");
}

// 3) 可选：接入 agent harness
if (INSTALL_TARGET) {
  const args = ["--install", "--target", INSTALL_TARGET, "--yes"];
  if (DRY_RUN) {
    console.log(`[mzg-init] [dry-run] 将执行: node ${cli} ${args.join(" ")}`);
  } else {
    const r = runZg(cli, args);
    if (r.out.trim()) console.log(r.out.trim());
    if (r.code !== 0) die(`zg --install 退出码 ${r.code}`);
    console.log(`[mzg-init] 已写入 ${INSTALL_TARGET} 集成（MCP 配置 + AGENTS.md 指引块）；WorkBuddy 侧需在连接器管理点「信任」并重启会话后生效`);
  }
}

// 4) 就绪校验（权威判据：--check-ready 退出码）
const chk = runZg(cli, ["--status", root, "--check-ready"]);
const coverage = (chk.out.match(/Coverage\s+\S+\s+(\d+%)\s+([\d,]+)\s*\/\s*([\d,]+)/) ?? [])[1];
const ok = chk.code === 0;
console.log(chk.out.trim());
console.log(
  `RESULT: ${JSON.stringify({ ok, state: ok ? "ready" : state, root, cli, coverage: coverage ?? null, indexed, dryRun: DRY_RUN })}`,
);
if (DRY_RUN) {
  console.log("[mzg-init] dry-run 结束（未做任何写入）；最终 ok 以实际执行为准");
  process.exit(0);
}
if (!ok) die("就绪校验未通过（--check-ready 退出非 0）");
console.log("[mzg-init] ✅ 索引就绪，可用 zg <query> / zg --call-graph 检索");
