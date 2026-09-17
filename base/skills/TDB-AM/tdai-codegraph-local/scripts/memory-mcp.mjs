#!/usr/bin/env node
/**
 * tdai-codegraph-local 记忆面 MCP 注册 CLI（ADR-0065 · 工单 09）。
 *
 * 与 `mcp.mjs`（code-graph 面）平级：同一个本地守护进程形态下的**第二个 MCP 入口**。
 * 本体实现在 TencentDB-Agent-Memory 仓库的 `tools/memory-mcp.mjs`（零依赖 stdio MCP server），
 * 本文件只做三件事——**注册 / 注销 / 拉起**，不重复维护脚本本体（MCP 披露原则）。
 *
 * 用法：
 *   node memory-mcp.mjs register     注册 `tdai-memory-local` 到用户级 MCP 配置（幂等合并）
 *   node memory-mcp.mjs show         显示将写入的 server 条目（不落盘）
 *   node memory-mcp.mjs unregister   移除 server 条目
 *   node memory-mcp.mjs start        前台启动本体（供守护进程拉起；正常由 harness 自行 spawn）
 *
 * **多仓库**：`--root` 取 `tdai-codegraph.json` 的 `config.repos[].path`（与 code-graph 面
 * 共用同一份仓库清单），缺省回退当前目录。这样「单守护多仓库」在记忆面同样成立。
 *
 * 零依赖，Node >= 20（node --test 可测，fs 可注入）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { describeErrors, isMainModule, defaultConfigPath } from "./helpers.mjs";
import { readConfig, CONFIG_FILENAME } from "./setup.mjs";

/** MCP server 名（与 `mcp.mjs` 的 `tdai-codegraph` 并列，不冲突）。 */
export const DEFAULT_SERVER_NAME = "tdai-memory-local";

/** 本体脚本的环境变量覆盖位（缺省回退到仓库内约定路径）。 */
export const ENTRY_ENV = "TDAI_MEMORY_MCP_ENTRY";

/** 状态目录环境变量覆盖位。 */
export const STATE_ENV = "TDAI_MEMORY_MCP_STATE";

/** 记忆面状态目录（与守护 `~/.tdai/state/` 平级，不混用）。 */
export const STATE_DIR_PARTS = [".tdai", "memory-mcp"];

/**
 * 解析本体入口绝对路径：环境变量 > `<entryHint>` > 失败返回 null。
 * 纯函数（fs 可注入）。
 */
export function resolveMemoryEntry(entryHint, fsMod = fs) {
  const candidates = [process.env[ENTRY_ENV], entryHint].filter(Boolean);
  for (const c of candidates) {
    const abs = path.resolve(c);
    if (fsMod.existsSync(abs)) return abs;
  }
  return null;
}

/** 状态目录绝对路径（home 可注入，测试用沙盒）。 */
export function memoryStateDir(homeDir = os.homedir()) {
  return process.env[STATE_ENV] || path.join(homeDir, ...STATE_DIR_PARTS);
}

/**
 * 构造 MCP server 配置条目（纯函数）。
 * @param {{ roots: string[], entry: string, stateDir: string, offline?: boolean }} p
 */
export function buildMemoryServerConfig({ roots, entry, stateDir, offline = false }) {
  const args = [entry, "--state", stateDir];
  for (const r of roots) args.push("--root", r);
  if (offline) args.push("--offline");
  return { command: process.execPath, args };
}

/** 合并 server 条目到既有 MCP 配置（纯函数，不写盘）。 */
export function mergeMcpConfig(existing, serverName, serverConfig) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {};
  const servers = { ...(base.mcpServers || {}) };
  servers[serverName] = serverConfig;
  return { ...base, mcpServers: servers };
}

/** 从既有 MCP 配置移除 server 条目（纯函数）。 */
export function removeMcpServer(existing, serverName) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : { mcpServers: {} };
  const servers = { ...(base.mcpServers || {}) };
  const removed = Boolean(servers[serverName]);
  delete servers[serverName];
  return { config: { ...base, mcpServers: servers }, removed };
}

/** 读 MCP 配置（fs 可注入）。不存在或非法返回 null。 */
export function readMcpConfig(filePath, fsMod = fs) {
  let raw;
  try {
    raw = fsMod.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 写 MCP 配置（pretty JSON，fs 可注入）。 */
export function writeMcpConfig(filePath, cfg, fsMod = fs) {
  fsMod.mkdirSync(path.dirname(filePath), { recursive: true });
  fsMod.writeFileSync(filePath, JSON.stringify(cfg, null, 2) + "\n");
  return filePath;
}

/** 从 tdai-codegraph.json 取仓库清单；读不到则回退当前目录。 */
export function resolveRoots(configPath, fsMod = fs) {
  const { ok, config } = readConfig(configPath, fsMod);
  if (!ok) return { roots: [process.cwd()], fromConfig: false };
  const roots = (config.repos ?? []).map((r) => r.path).filter(Boolean);
  return roots.length > 0
    ? { roots, fromConfig: true }
    : { roots: [process.cwd()], fromConfig: false };
}

/**
 * register 主流程。
 * @param {{ configPath: string, entryHint?: string, homeDir?: string, fsMod?: object }} p
 */
export function registerMemoryMcp({ configPath, entryHint, homeDir = os.homedir(), fsMod = fs }) {
  const entry = resolveMemoryEntry(entryHint, fsMod);
  if (!entry) {
    return {
      ok: false,
      error: `未找到记忆面本体 tools/memory-mcp.mjs（用环境变量 ${ENTRY_ENV} 指向它）`,
    };
  }
  const { roots } = resolveRoots(configPath, fsMod);
  const { config: cfg } = readConfig(configPath, fsMod);
  const mcpPath = cfg?.mcp?.configPath;
  if (!mcpPath) {
    return { ok: false, error: "config.mcp.configPath 未配置（请重跑 setup.mjs）" };
  }
  const serverName = DEFAULT_SERVER_NAME;
  const serverConfig = buildMemoryServerConfig({
    roots,
    entry,
    stateDir: memoryStateDir(homeDir),
  });
  const existing = readMcpConfig(mcpPath, fsMod) || {};
  writeMcpConfig(mcpPath, mergeMcpConfig(existing, serverName, serverConfig), fsMod);
  return { ok: true, mcpConfigPath: mcpPath, serverName, roots };
}

/** unregister 主流程。 */
export function unregisterMemoryMcp({ configPath, homeDir = os.homedir(), fsMod = fs }) {
  const { config: cfg, errors } = readConfig(configPath, fsMod);
  if (!cfg) return { ok: false, error: describeErrors(errors) };
  const mcpPath = cfg?.mcp?.configPath;
  if (!mcpPath) return { ok: false, error: "config.mcp.configPath 未配置" };
  const existing = readMcpConfig(mcpPath, fsMod) || {};
  const { config: next, removed } = removeMcpServer(existing, DEFAULT_SERVER_NAME);
  writeMcpConfig(mcpPath, next, fsMod);
  return { ok: true, mcpConfigPath: mcpPath, removed };
}

/** show 主流程（不落盘）。 */
export function showMemoryMcp({ configPath, entryHint, homeDir = os.homedir(), fsMod = fs }) {
  const entry = resolveMemoryEntry(entryHint, fsMod);
  const { roots, fromConfig } = resolveRoots(configPath, fsMod);
  const { config: cfg } = readConfig(configPath, fsMod);
  return {
    ok: true,
    serverName: DEFAULT_SERVER_NAME,
    entryInstalled: Boolean(entry),
    roots,
    rootsFromConfig: fromConfig,
    serverConfig: entry
      ? buildMemoryServerConfig({ roots, entry, stateDir: memoryStateDir(homeDir) })
      : null,
    mcpConfigPath: cfg?.mcp?.configPath ?? null,
  };
}

/** 前台拉起本体（供守护进程拉起；stdio 直通）。 */
export function startMemoryMcp({ configPath, entryHint, homeDir = os.homedir(), fsMod = fs, spawnImpl = spawn }) {
  const entry = resolveMemoryEntry(entryHint, fsMod);
  if (!entry) return { ok: false, error: "未找到记忆面本体 tools/memory-mcp.mjs" };
  const { roots } = resolveRoots(configPath, fsMod);
  const args = [entry, "--state", memoryStateDir(homeDir)];
  for (const r of roots) args.push("--root", r);
  const child = spawnImpl(process.execPath, args, { stdio: "inherit" });
  return { ok: true, pid: child?.pid };
}

// ---------- CLI 入口 ----------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const [action] = process.argv.slice(2);
  const configPath = defaultConfigPath(CONFIG_FILENAME);
  if (action === "register") {
    const r = registerMemoryMcp({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else
      console.log(
        `已注册 MCP server "${r.serverName}"（${r.roots.length} 个仓库）→ ${r.mcpConfigPath}`,
      );
  } else if (action === "unregister") {
    const r = unregisterMemoryMcp({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else console.log(`已移除 MCP server（removed=${r.removed}）→ ${r.mcpConfigPath}`);
  } else if (action === "show") {
    const r = showMemoryMcp({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else console.log(JSON.stringify(r, null, 2));
  } else if (action === "start") {
    const r = startMemoryMcp({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    }
  } else {
    console.error("用法: node memory-mcp.mjs <register|unregister|show|start>");
    process.exitCode = 2;
  }
}
