#!/usr/bin/env node
/**
 * tdai-daemon — 本地守护统一启动器（tdai-codegraph-local + tdai-memory-local）
 *
 * 用法：node tdai-daemon.mjs <command>
 *
 *   start          启动守护进程（codegraph local-server + memory-mcp 注册）
 *   stop           停止守护进程
 *   restart        重启守护进程
 *   status         查看完整状态（进程 / 健康 / 仓库 / 队列 / 镜像）
 *   health         仅健康检查
 *   config         查看当前配置
 *   config-edit    打开配置编辑器（交互式）
 *   logs           查看守护进程日志
 *   register-mcp   注册 MCP 到 harness 配置
 *   memory-mcp     启动记忆面 MCP server（前台，供 harness spawn）
 *
 * 设计原则：
 *   - 零依赖，只用 Node 内置模块
 *   - 幂等：重复执行安全
 *   - 状态透明：status 一眼看清所有层面
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 路径常量 ----------
const HOME = os.homedir();
const TDAI_DIR = path.join(HOME, ".tdai");
const STATE_DIR = path.join(TDAI_DIR, "state");
const CONFIG_DIR = path.join(TDAI_DIR, "config");
const MEMORY_MCP_DIR = path.join(TDAI_DIR, "memory-mcp");
const CONFIG_FILE = path.join(CONFIG_DIR, "tdai-codegraph.json");
const PID_FILE = path.join(STATE_DIR, "daemon.pid");
const LOG_FILE = path.join(STATE_DIR, "daemon.log");
const ERR_LOG_FILE = path.join(STATE_DIR, "daemon.err.log");

// ---------- 工具函数 ----------
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}
function readPid() {
  try { return parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10); } catch { return null; }
}
function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ---------- 配置管理 ----------
function loadConfig() {
  return readJson(CONFIG_FILE);
}
function saveConfig(cfg) {
  writeJson(CONFIG_FILE, cfg);
}

// ---------- 守护进程入口解析 ----------
function findDaemonEntry() {
  // 优先从 config.runtimeDir 找，其次从源码仓库找
  const cfg = loadConfig();
  if (cfg?.runtimeDir) {
    const entry = path.join(cfg.runtimeDir, "node_modules", "memory-knowledge", "dist", "local-server.mjs");
    if (fs.existsSync(entry)) return entry;
  }
  // 源码仓库直跑（开发模式）
  const devEntry = path.resolve(__dirname, "../../../TencentDB-Agent-Memory/MemoryKnowledge/dist/local-server.mjs");
  if (fs.existsSync(devEntry)) return devEntry;
  return null;
}

function findMemoryMcpEntry() {
  // memory-mcp 本体在 TencentDB-Agent-Memory 仓库
  const entry = path.resolve(__dirname, "../../../TencentDB-Agent-Memory/tools/memory-mcp.mjs");
  if (fs.existsSync(entry)) return entry;
  // 环境变量覆盖
  if (process.env.TDAI_MEMORY_MCP_ENTRY && fs.existsSync(process.env.TDAI_MEMORY_MCP_ENTRY)) {
    return process.env.TDAI_MEMORY_MCP_ENTRY;
  }
  return null;
}

// ---------- 命令实现 ----------
function cmdStart() {
  const cfg = loadConfig();
  if (!cfg) { console.error("✖ 未找到配置，请先运行: node tdai-daemon.mjs config-edit"); return 1; }

  const existingPid = readPid();
  if (existingPid && isAlive(existingPid)) {
    console.log(`守护已在运行（PID ${existingPid}）`);
    return 0;
  }

  const entry = findDaemonEntry();
  if (!entry) { console.error("✖ 守护入口未找到"); return 1; }

  const env = {
    ...process.env,
    KNOWLEDGE_LOCAL_WORKSPACE: cfg.repos[0]?.path,
    KNOWLEDGE_LOCAL_SERVICE_ID: cfg.localServiceId || "local",
    KNOWLEDGE_LOCAL_TEAM_ID: cfg.localTeamId || "local",
    KNOWLEDGE_QUERY_REFRESH_DEBOUNCE_MS: String(cfg.queryRefreshDebounceMs || 5000),
    PORT: String(cfg.daemonPort || 8421),
  };
  if (cfg.fallbackBaseUrl) {
    env.KNOWLEDGE_FALLBACK_BASE_URL = cfg.fallbackBaseUrl;
    env.KNOWLEDGE_FALLBACK_SERVICE_ID = cfg.fallbackServiceId || cfg.localServiceId;
  }

  fs.mkdirSync(STATE_DIR, { recursive: true });
  const out = fs.openSync(LOG_FILE, "a");
  const err = fs.openSync(ERR_LOG_FILE, "a");
  const child = spawn(process.execPath, [entry], { env, detached: true, stdio: ["ignore", out, err] });
  if (!child.pid) { console.error("✖ spawn 失败"); return 1; }
  fs.writeFileSync(PID_FILE, String(child.pid));
  child.unref();
  console.log(`✔ 守护已启动（PID ${child.pid}，端口 ${cfg.daemonPort}）`);
  console.log(`  主仓库: ${cfg.repos[0]?.path}`);
  console.log(`  日志: ${LOG_FILE}`);
  return 0;
}

function cmdStop() {
  const pid = readPid();
  if (!pid) { console.log("守护未运行"); return 0; }
  if (!isAlive(pid)) {
    fs.rmSync(PID_FILE, { force: true });
    console.log("守护进程已不存在，清理 PID 文件");
    return 0;
  }
  try { process.kill(pid, "SIGTERM"); } catch (e) { console.error(`✖ 停止失败: ${e.message}`); return 1; }
  fs.rmSync(PID_FILE, { force: true });
  console.log(`✔ 守护已停止（PID ${pid}）`);
  return 0;
}

async function cmdStatus() {
  const cfg = loadConfig();
  const pid = readPid();
  const alive = isAlive(pid);

  console.log("═══ tdai-daemon 状态 ═══");
  console.log("");

  // 进程状态
  console.log(`【进程】`);
  if (alive) {
    console.log(`  状态: 运行中（PID ${pid}）`);
  } else {
    console.log("  状态: 未运行");
  }
  console.log(`  端口: ${cfg?.daemonPort || 8421}`);
  console.log("");

  // 健康检查
  console.log("【健康】");
  try {
    const res = await fetch(`http://127.0.0.1:${cfg?.daemonPort || 8421}/health`, { signal: AbortSignal.timeout(3000) });
    const body = await res.json();
    console.log(`  HTTP ${res.status}: ${body.status}`);
  } catch (e) {
    console.log(`  不可达: ${e.message}`);
  }
  console.log("");

  // 仓库列表
  console.log("【仓库】");
  if (cfg?.repos) {
    for (const r of cfg.repos) {
      const exists = fs.existsSync(r.path);
      console.log(`  ${exists ? "✓" : "✗"} ${r.alias}: ${r.path}`);
    }
  }
  console.log("");

  // 守护进程的 code-graph 资产
  console.log("【索引资产】");
  try {
    const res = await fetch(`http://127.0.0.1:${cfg?.daemonPort || 8421}/v3/code-graph/list`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tdai-service-id": cfg?.localServiceId || "local" },
      body: JSON.stringify({ team_id: cfg?.localTeamId || "local" }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    for (const item of data?.data?.items || []) {
      const s = item.stats || {};
      console.log(`  ${item.repo_name}: ${s.files || 0} 文件 / ${s.nodes || 0} 节点 / ${s.edges || 0} 边 [${item.status}]`);
    }
  } catch (e) {
    console.log(`  查询失败: ${e.message}`);
  }
  console.log("");

  // 记忆面状态
  console.log("【记忆面】");
  const queueFile = path.join(MEMORY_MCP_DIR, "capture-queue.jsonl");
  const mirrorFile = path.join(MEMORY_MCP_DIR, "skills-mirror.json");
  const markerFile = path.join(MEMORY_MCP_DIR, "skill-write-marker.json");
  try {
    const queueLines = fs.readFileSync(queueFile, "utf8").split("\n").filter(Boolean);
    console.log(`  暂存队列: ${queueLines.length} 条`);
  } catch { console.log("  暂存队列: 0 条"); }
  try {
    const mirror = readJson(mirrorFile);
    console.log(`  技能镜像: ${mirror?.skills?.length || 0} 条（版本 ${mirror?.version || "无"}）`);
  } catch { console.log("  技能镜像: 未初始化"); }
  try {
    const marker = readJson(markerFile);
    console.log(`  写标记: ${marker ? `v${marker.version} @ ${marker.at}` : "无"}`);
  } catch { console.log("  写标记: 无"); }
  console.log("");

  // MCP 注册状态
  console.log("【MCP 注册】");
  const mcpPaths = [
    path.join(HOME, ".codebuddy", "mcp.json"),
    path.join(HOME, ".codeartsdoer", "mcp.json"),
    path.join(HOME, ".dsh", "mcp.json"),
  ];
  for (const p of mcpPaths) {
    if (!fs.existsSync(p)) continue;
    const mcpCfg = readJson(p);
    const hasCodegraph = mcpCfg?.mcpServers?.["tdai-codegraph"];
    const hasMemory = mcpCfg?.mcpServers?.["tdai-memory-local"];
    console.log(`  ${path.basename(path.dirname(p))}: codegraph=${hasCodegraph ? "✓" : "✗"} memory=${hasMemory ? "✓" : "✗"}`);
  }
  console.log("");

  return 0;
}

function cmdConfig() {
  const cfg = loadConfig();
  if (!cfg) { console.error("✖ 未找到配置"); return 1; }
  console.log(JSON.stringify(cfg, null, 2));
  return 0;
}

function cmdConfigEdit() {
  const editor = process.env.EDITOR || "notepad";
  try { execSync(`"${editor}" "${CONFIG_FILE}"`, { stdio: "inherit" }); }
  catch { console.log(`请手动编辑: ${CONFIG_FILE}`); }
  return 0;
}

function cmdLogs(lines = 50) {
  for (const f of [LOG_FILE, ERR_LOG_FILE]) {
    if (!fs.existsSync(f)) continue;
    console.log(`═══ ${path.basename(f)} ═══`);
    const content = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
    const tail = content.slice(-lines);
    for (const line of tail) console.log(line);
    console.log("");
  }
  return 0;
}

// ---------- CLI 入口 ----------
const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "start": process.exitCode = cmdStart(); break;
  case "stop": process.exitCode = cmdStop(); break;
  case "restart": cmdStop(); setTimeout(() => process.exitCode = cmdStart(), 500); break;
  case "status": process.exitCode = await cmdStatus(); break;
  case "health":
    try {
      const cfg = loadConfig();
      const res = await fetch(`http://127.0.0.1:${cfg?.daemonPort || 8421}/health`, { signal: AbortSignal.timeout(3000) });
      console.log(res.ok ? "健康" : `异常 HTTP ${res.status}`);
      process.exitCode = res.ok ? 0 : 1;
    } catch (e) { console.error(`不可达: ${e.message}`); process.exitCode = 1; }
    break;
  case "config": process.exitCode = cmdConfig(); break;
  case "config-edit": process.exitCode = cmdConfigEdit(); break;
  case "logs": process.exitCode = cmdLogs(parseInt(args[0]) || 50); break;
  case "register-mcp": {
    // 注册 codegraph MCP
    const reg = path.join(__dirname, "mcp.mjs");
    if (fs.existsSync(reg)) {
      const child = spawn(process.execPath, [reg, "register"], { stdio: "inherit" });
      child.on("exit", (code) => { if (code !== 0) process.exitCode = code; });
    } else { console.error("✖ mcp.mjs 未找到"); process.exitCode = 1; }
    // 注册 memory MCP
    const memReg = path.join(__dirname, "memory-mcp.mjs");
    const memEntry = findMemoryMcpEntry();
    if (fs.existsSync(memReg) && memEntry) {
      const child2 = spawn(process.execPath, [memReg, "register"], { stdio: "inherit", env: { ...process.env, TDAI_MEMORY_MCP_ENTRY: memEntry } });
      child2.on("exit", (code) => { if (code !== 0) process.exitCode = code; });
    } else { console.error("✖ memory-mcp.mjs 未找到"); }
    break;
  }
  case "memory-mcp": {
    // 前台启动记忆面 MCP server
    const entry = findMemoryMcpEntry();
    if (!entry) { console.error("✖ memory-mcp.mjs 未找到"); process.exitCode = 1; break; }
    const cfg = loadConfig();
    const mcpArgs = [entry, "--root", cfg?.repos?.[0]?.path || process.cwd()];
    for (const r of (cfg?.repos || []).slice(1)) mcpArgs.push("--root", r.path);
    const child = spawn(process.execPath, mcpArgs, { stdio: "inherit" });
    child.on("exit", (code) => process.exitCode = code);
    break;
  }
  default:
    console.log(`用法: node tdai-daemon.mjs <command>
    
命令:
  start          启动守护进程
  stop           停止守护进程
  restart        重启守护进程
  status         查看完整状态
  health         健康检查
  config         查看配置
  config-edit    编辑配置
  logs [N]       查看日志（默认 50 行）
  register-mcp   注册 MCP 到 harness
  memory-mcp     前台启动记忆面 MCP server`);
    process.exitCode = cmd ? 2 : 0;
}
