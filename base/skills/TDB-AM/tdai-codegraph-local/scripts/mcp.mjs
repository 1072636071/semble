#!/usr/bin/env node
/**
 * tdai-codegraph-local 用户级 MCP 注册 CLI（PRD .scratch/04-tdai-skill-suite/ 工单 07）。
 *
 * 用法：node mcp.mjs register   注册 MCP server 到用户级配置（幂等合并）
 *       node mcp.mjs show       显示将写入的 server 条目（不落盘）
 *       node mcp.mjs unregister 移除 MCP server 条目
 *
 * MCP server = stdio 桥（node <runtime>/node_modules/memory-knowledge/dist/mcp/server.js），
 * KNOWLEDGE_API_URL 指向守护进程的 /v3 基址。注册到用户级配置（PRD 决策18），
 * 所有会话共享同一套 Code_Graph 工具。
 *
 * 配置格式（Claude Code / CodeBuddy / CodeArts / Trae / Qoder 通用形态）：
 *   { "mcpServers": { "<serverName>": { "command":"node", "args":[...], "env":{...} } } }
 * 幂等：重复 register 覆盖同名条目；不破坏其他 server。
 * 零依赖，Node >= 20（node --test 可测，fs 可注入）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describeErrors, isMainModule, defaultConfigPath } from "./helpers.mjs";
import { readConfig, CONFIG_FILENAME } from "./setup.mjs";

const DEFAULT_SERVER_NAME = "tdai-codegraph";

/** MCP 入口相对路径（npm install 后包内 dist/mcp/server.js）。 */
export const MCP_ENTRY_REL = path.join(
  "node_modules",
  "memory-knowledge",
  "dist",
  "mcp",
  "server.js",
);

/**
 * 解析 MCP 入口绝对路径（纯函数，fs 可注入）。
 * @returns {string|null} 入口路径，未安装返回 null
 */
export function resolveMcpEntry(runtimeDir, fsMod = fs) {
  const entry = path.join(runtimeDir, MCP_ENTRY_REL);
  return fsMod.existsSync(entry) ? entry : null;
}

/**
 * 构造 MCP server 配置条目（纯函数）。
 * @param {object} config tdai-codegraph.json 配置
 * @returns {{ command:string, args:string[], env:Record<string,string> }}
 */
export function buildMcpServerConfig(config) {
  const entry = resolveMcpEntry(config.runtimeDir);
  return {
    command: process.execPath,
    args: [entry || path.join(config.runtimeDir, MCP_ENTRY_REL)],
    env: {
      KNOWLEDGE_API_URL: `http://127.0.0.1:${config.daemonPort}/v3`,
    },
  };
}

/**
 * 合并 server 条目到既有 MCP 配置（纯函数，不写盘）。
 * @param {object} existing 既有配置（可为 {} 或 null）
 * @param {string} serverName server 名
 * @param {object} serverConfig server 条目
 * @returns {object} 合并后的配置
 */
export function mergeMcpConfig(existing, serverName, serverConfig) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {};
  const servers = { ...(base.mcpServers || {}) };
  servers[serverName] = serverConfig;
  return { ...base, mcpServers: servers };
}

/**
 * 从既有 MCP 配置移除 server 条目（纯函数）。
 * @returns {{ config:object, removed:boolean }}
 */
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

/** 读 MCP 配置文件（fs 可注入）。不存在返回 null。 */
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

// ---------- 命令实现 ----------

/**
 * register 主流程：读 tdai-codegraph.json → 构造 server 条目 → 合并到用户级 MCP 配置。
 * @param {{ configPath:string, fsMod?:object }} p
 * @returns {{ ok:boolean, mcpConfigPath?:string, serverName?:string, error?:string }}
 */
export function registerMcp({ configPath, fsMod = fs }) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  const mcpPath = config.mcp?.configPath;
  if (!mcpPath)
    return {
      ok: false,
      error: "config.mcp.configPath 未配置（请重跑 setup.mjs）",
    };
  const entry = resolveMcpEntry(config.runtimeDir, fsMod);
  if (!entry) {
    return { ok: false, error: `MCP 入口未安装: ${path.join(config.runtimeDir, MCP_ENTRY_REL)}（请先 node install.mjs）` };
  }
  const serverName = config.mcp?.serverName || DEFAULT_SERVER_NAME;
  const serverConfig = buildMcpServerConfig(config);
  const existing = readMcpConfig(mcpPath, fsMod) || {};
  const merged = mergeMcpConfig(existing, serverName, serverConfig);
  writeMcpConfig(mcpPath, merged, fsMod);
  return { ok: true, mcpConfigPath: mcpPath, serverName };
}

/**
 * unregister 主流程：从用户级 MCP 配置移除 server 条目。
 * @param {{ configPath:string, fsMod?:object }} p
 */
export function unregisterMcp({ configPath, fsMod = fs }) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  const mcpPath = config.mcp?.configPath;
  if (!mcpPath) return { ok: false, error: "config.mcp.configPath 未配置" };
  const serverName = config.mcp?.serverName || DEFAULT_SERVER_NAME;
  const existing = readMcpConfig(mcpPath, fsMod) || {};
  const { config: next, removed } = removeMcpServer(existing, serverName);
  writeMcpConfig(mcpPath, next, fsMod);
  return { ok: true, mcpConfigPath: mcpPath, removed };
}

/**
 * show 主流程：返回将写入的 server 条目（不落盘）。
 */
export function showMcp({ configPath, fsMod = fs }) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  const serverName = config.mcp?.serverName || DEFAULT_SERVER_NAME;
  const entryInstalled = Boolean(resolveMcpEntry(config.runtimeDir, fsMod));
  return {
    ok: true,
    serverName,
    serverConfig: buildMcpServerConfig(config),
    mcpConfigPath: config.mcp?.configPath,
    entryInstalled,
  };
}

// ---------- CLI 入口 ----------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const [action] = process.argv.slice(2);
  const configPath = defaultConfigPath(CONFIG_FILENAME);
  if (action === "register") {
    const r = registerMcp({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else
      console.log(`已注册 MCP server "${r.serverName}" → ${r.mcpConfigPath}`);
  } else if (action === "unregister") {
    const r = unregisterMcp({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else
      console.log(
        `已移除 MCP server（removed=${r.removed}）→ ${r.mcpConfigPath}`,
      );
  } else if (action === "show") {
    const r = showMcp({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else
      console.log(
        JSON.stringify(
          {
            serverName: r.serverName,
            serverConfig: r.serverConfig,
            mcpConfigPath: r.mcpConfigPath,
          },
          null,
          2,
        ),
      );
  } else {
    console.error("用法: node mcp.mjs <register|unregister|show>");
    process.exitCode = 2;
  }
}
