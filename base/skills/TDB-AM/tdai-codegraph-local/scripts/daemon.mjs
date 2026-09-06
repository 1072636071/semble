#!/usr/bin/env node
/**
 * tdai-codegraph-local 守护进程管理 CLI（PRD .scratch/04-tdai-skill-suite/ 工单 07+08）。
 *
 * 用法：node daemon.mjs <start|stop|status|health>
 *   start    启动单守护进程（主仓库 auto-register，ADR 0001）
 *   stop     按 PID 停止守护
 *   status   查 PID 与进程存活
 *   health   HTTP GET /health 探活
 *
 * 守护进程 = node <runtimeDir>/node_modules/memory-knowledge/dist/local-server.js，
 * 以主仓库（repos[0]）为 KNOWLEDGE_LOCAL_WORKSPACE 启动（auto-register），
 * 其余仓库经 repo.mjs 的 add 命令追加。环境变量见 buildEnv。
 * PID/日志落 ~/.tdai/state/（daemon.pid / daemon.log / daemon.err.log）。
 * 零依赖，Node >= 20（node --test 可测，spawn/fetch 可注入）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { describeErrors, isMainModule, defaultConfigPath } from "./helpers.mjs";
import { readConfig, CONFIG_FILENAME } from "./setup.mjs";
import { resolveDaemonEntry } from "./install.mjs";

const STATE_DIR_PARTS = [".tdai", "state"];
const PID_FILE = "daemon.pid";
const LOG_FILE = "daemon.log";
const ERR_LOG_FILE = "daemon.err.log";

/** state 目录绝对路径（~/.tdai/state）。 */
export function stateDir(homeDir = os.homedir()) {
  return path.join(homeDir, ...STATE_DIR_PARTS);
}

/** PID 文件路径。 */
export function pidFilePath(homeDir = os.homedir()) {
  return path.join(stateDir(homeDir), PID_FILE);
}

/** 主日志路径。 */
export function logFilePath(homeDir = os.homedir()) {
  return path.join(stateDir(homeDir), LOG_FILE);
}

/** 错误日志路径。 */
export function errLogFilePath(homeDir = os.homedir()) {
  return path.join(stateDir(homeDir), ERR_LOG_FILE);
}

/**
 * 构建守护进程环境变量（纯函数，ADR 0001）。
 * 主仓库 repos[0] 作为 KNOWLEDGE_LOCAL_WORKSPACE auto-register；
 * 其余仓库经 repo.mjs add 追加（不在此处设环境变量）。
 * @param {object} config tdai-codegraph.json 配置
 * @returns {Record<string,string>} 环境变量
 */
export function buildEnv(config) {
  const env = {
    KNOWLEDGE_LOCAL_WORKSPACE: config.repos[0].path,
    KNOWLEDGE_LOCAL_SERVICE_ID: config.localServiceId,
    KNOWLEDGE_LOCAL_TEAM_ID: config.localTeamId,
    KNOWLEDGE_QUERY_REFRESH_DEBOUNCE_MS: String(config.queryRefreshDebounceMs),
    PORT: String(config.daemonPort),
  };
  if (config.fallbackBaseUrl) {
    env.KNOWLEDGE_FALLBACK_BASE_URL = config.fallbackBaseUrl;
    env.KNOWLEDGE_FALLBACK_SERVICE_ID =
      config.fallbackServiceId || config.localServiceId;
  }
  return env;
}


// ---------- PID 管理 ----------

/** 读 PID（fs 可注入）。无文件/内容非法返回 null。 */
export function readPid(homeDir = os.homedir(), fsMod = fs) {
  const f = pidFilePath(homeDir);
  let raw;
  try {
    raw = fsMod.readFileSync(f, "utf8");
  } catch {
    return null;
  }
  const pid = Number.parseInt(raw.trim(), 10);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

/** 写 PID（fs 可注入）。 */
export function writePid(pid, homeDir = os.homedir(), fsMod = fs) {
  const f = pidFilePath(homeDir);
  fsMod.mkdirSync(path.dirname(f), { recursive: true });
  fsMod.writeFileSync(f, String(pid), { mode: 0o600 });
  return f;
}

/** 清 PID 文件（fs 可注入）。 */
export function clearPid(homeDir = os.homedir(), fsMod = fs) {
  const f = pidFilePath(homeDir);
  try {
    fsMod.rmSync(f, { force: true });
  } catch {
    // ignore
  }
}

/**
 * 判断进程是否存活（process.kill(pid, 0) 探测，不实际发信号）。
 * killImpl 可注入以便测试（默认 process.kill）。
 */
export function isProcessAlive(pid, killImpl = (p, s) => process.kill(p, s)) {
  try {
    killImpl(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ---------- 命令实现 ----------

/**
 * 启动守护进程（spawn detached，写 PID）。
 * @param {{ configPath:string, spawnImpl?:Function, fsMod?:object, homeDir?:string }} p
 *   spawnImpl 默认用 child_process.spawn；测试可注入同步 fake 返回 { pid }。
 * @returns {{ ok:boolean, pid?:number, error?:string }}
 */
export function startDaemon({
  configPath,
  spawnImpl = null,
  fsMod = fs,
  homeDir = os.homedir(),
}) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };

  const existingPid = readPid(homeDir, fsMod);
  if (existingPid && isProcessAlive(existingPid)) {
    return {
      ok: false,
      error: `守护已在运行（PID ${existingPid}），先 stop 再 start`,
    };
  }
  if (existingPid) clearPid(homeDir, fsMod);

  const daemonEntry = resolveDaemonEntry(config.runtimeDir, fsMod);
  if (!daemonEntry) {
    return {
      ok: false,
      error: `守护入口未安装: ${path.join(config.runtimeDir, "node_modules", "memory-knowledge", "dist", "local-server.js")}（请先 node install.mjs）`,
    };
  }

  const args = [daemonEntry];
  const env = { ...process.env, ...buildEnv(config) };
  fsMod.mkdirSync(stateDir(homeDir), { recursive: true });
  const out = fsMod.openSync(logFilePath(homeDir), "a");
  const err = fsMod.openSync(errLogFilePath(homeDir), "a");
  const spawnFn = spawnImpl || spawn;
  const child = spawnFn(process.execPath, args, {
    env,
    detached: true,
    stdio: ["ignore", out, err],
  });
  if (!child || !child.pid) {
    return { ok: false, error: "spawn 未返回 pid" };
  }
  writePid(child.pid, homeDir, fsMod);
  child.unref?.();
  return { ok: true, pid: child.pid };
}

/**
 * 停止守护进程（按 PID 发 SIGTERM）。
 * @param {{ configPath?:string, fsMod?:object, homeDir?:string, killImpl?:Function }} p
 * @returns {{ ok:boolean, pid?:number, error?:string }}
 */
export function stopDaemon({
  fsMod = fs,
  homeDir = os.homedir(),
  killImpl = (p, s) => process.kill(p, s),
} = {}) {
  const pid = readPid(homeDir, fsMod);
  if (!pid) return { ok: false, error: "无 PID 文件（守护未启动？）" };
  if (!isProcessAlive(pid, killImpl)) {
    clearPid(homeDir, fsMod);
    return { ok: false, error: `PID ${pid} 已不存在，清理 PID 文件` };
  }
  try {
    killImpl(pid, "SIGTERM");
  } catch (e) {
    return { ok: false, error: `停止失败: ${e.message}` };
  }
  clearPid(homeDir, fsMod);
  return { ok: true, pid };
}

/**
 * 查守护状态（PID + 进程存活）。
 * @returns {{ ok:boolean, pid?:number, alive:boolean, error?:string }}
 */
export function statusDaemon({
  fsMod = fs,
  homeDir = os.homedir(),
  killImpl = (p, s) => process.kill(p, s),
} = {}) {
  const pid = readPid(homeDir, fsMod);
  if (!pid) return { ok: true, alive: false };
  const alive = isProcessAlive(pid, killImpl);
  return { ok: true, pid, alive };
}

/**
 * HTTP /health 探活（fetchImpl 可注入）。
 * @param {{ configPath:string, fetchImpl?:Function, fsMod?:object }} p
 * @returns {Promise<{ ok:boolean, status?:number, body?:string, error?:string }>}
 */
export async function healthDaemon({
  configPath,
  fetchImpl = fetch,
  fsMod = fs,
}) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  const url = `http://127.0.0.1:${config.daemonPort}/health`;
  try {
    const res = await fetchImpl(url, { method: "GET" });
    const body = await res.text();
    return { ok: res.status === 200, status: res.status, body };
  } catch (e) {
    return { ok: false, error: `健康检查失败: ${e.message}` };
  }
}

// ---------- CLI 入口 ----------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const [action] = process.argv.slice(2);
  const configPath = defaultConfigPath(CONFIG_FILENAME);
  if (!action) {
    console.error("用法: node daemon.mjs <start|stop|status|health>");
    process.exitCode = 2;
  } else if (action === "start") {
    const r = startDaemon({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else console.log(`守护已启动（PID ${r.pid}）`);
  } else if (action === "stop") {
    const r = stopDaemon();
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else console.log(`守护已停止（PID ${r.pid}）`);
  } else if (action === "status") {
    const r = statusDaemon();
    if (r.alive) console.log(`运行中（PID ${r.pid}）`);
    else console.log("未运行");
  } else if (action === "health") {
    healthDaemon({ configPath })
      .then((r) => {
        if (!r.ok) {
          console.error(r.error || `HTTP ${r.status}`);
          process.exitCode = 1;
        } else console.log(`健康（HTTP ${r.status}）: ${r.body}`);
      })
      .catch((e) => {
        console.error(e.message);
        process.exitCode = 1;
      });
  } else {
    console.error(`未知动作: ${action}`);
    process.exitCode = 2;
  }
}
