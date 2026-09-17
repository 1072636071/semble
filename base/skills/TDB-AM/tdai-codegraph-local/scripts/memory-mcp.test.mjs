/** 工单 09 测试：记忆面 MCP 注册（条目构建 / 多仓库 roots / 合并 / 读写）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildConfig, writeConfig, CONFIG_FILENAME } from "./setup.mjs";
import {
  DEFAULT_SERVER_NAME,
  buildMemoryServerConfig,
  mergeMcpConfig,
  readMcpConfig,
  registerMemoryMcp,
  removeMcpServer,
  resolveMemoryEntry,
  resolveRoots,
  showMemoryMcp,
  unregisterMemoryMcp,
  writeMcpConfig,
} from "./memory-mcp.mjs";
import { tmpHome } from "./test-utils.mjs";

/** 落 tdai-codegraph.json + 伪造记忆面本体 + 可选伪造既有 MCP 配置。 */
function seed(t, { withEntry = true, existingMcp = null, repos } = {}) {
  const home = tmpHome(t);
  const runtimeDir = path.join(home, "runtime");
  const mcpConfigPath = path.join(home, ".codebuddy", "mcp.json");
  const cfg = buildConfig({
    tarballPath: "/t.tgz",
    runtimeDir,
    daemonPort: 8421,
    repos: repos ?? [{ path: "/w", alias: "w" }],
    mcp: {
      vendor: "codebuddy",
      configPath: mcpConfigPath,
      serverName: "tdai-codegraph",
    },
  });
  const configPath = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  writeConfig(configPath, cfg);
  const entry = path.join(home, "tools", "memory-mcp.mjs");
  if (withEntry) {
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, "// fake\n");
  }
  if (existingMcp) {
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.writeFileSync(mcpConfigPath, JSON.stringify(existingMcp, null, 2));
  }
  return { home, configPath, mcpConfigPath, entry };
}

test("注册：条目写入用户级 MCP 配置，指向记忆面本体", (t) => {
  const { home, configPath, mcpConfigPath, entry } = seed(t);
  const r = registerMemoryMcp({ configPath, entryHint: entry, homeDir: home });
  assert.equal(r.ok, true);
  assert.equal(r.serverName, DEFAULT_SERVER_NAME);
  const cfg = readMcpConfig(mcpConfigPath);
  const server = cfg.mcpServers[DEFAULT_SERVER_NAME];
  assert.equal(server.command, process.execPath);
  assert.equal(server.args[0], entry);
});

test("注册：多仓库 ⇒ 每个仓库一个 --root（单守护多仓库）", (t) => {
  const { home, configPath, mcpConfigPath, entry } = seed(t, {
    repos: [
      { path: "/w/a", alias: "a" },
      { path: "/w/b", alias: "b" },
    ],
  });
  registerMemoryMcp({ configPath, entryHint: entry, homeDir: home });
  const args = readMcpConfig(mcpConfigPath).mcpServers[DEFAULT_SERVER_NAME].args;
  const roots = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--root") roots.push(args[i + 1]);
  }
  assert.deepEqual(roots, ["/w/a", "/w/b"]);
});

test("注册：--state 指向 ~/.tdai/memory-mcp，与 code-graph 面不混用", (t) => {
  const { home, configPath, mcpConfigPath, entry } = seed(t);
  registerMemoryMcp({ configPath, entryHint: entry, homeDir: home });
  const args = readMcpConfig(mcpConfigPath).mcpServers[DEFAULT_SERVER_NAME].args;
  const state = args[args.indexOf("--state") + 1];
  assert.equal(state, path.join(home, ".tdai", "memory-mcp"));
});

test("注册：本体缺失 ⇒ 报错退出码语义（ok:false），不写坏配置", (t) => {
  const { home, configPath, mcpConfigPath } = seed(t, { withEntry: false });
  const r = registerMemoryMcp({ configPath, homeDir: home });
  assert.equal(r.ok, false);
  assert.match(r.error, /tools\/memory-mcp\.mjs/);
  assert.equal(fs.existsSync(mcpConfigPath), false, "失败时不应创建配置文件");
});

test("注册：不破坏既有 MCP 配置里的其他 server（幂等合并）", (t) => {
  const { home, configPath, mcpConfigPath, entry } = seed(t, {
    existingMcp: { mcpServers: { other: { command: "x" } } },
  });
  registerMemoryMcp({ configPath, entryHint: entry, homeDir: home });
  const cfg = readMcpConfig(mcpConfigPath);
  assert.deepEqual(cfg.mcpServers.other, { command: "x" });
  assert.ok(cfg.mcpServers[DEFAULT_SERVER_NAME]);
});

test("注销：移除本面条目、保留其他 server；重复注销 removed=false", (t) => {
  const { home, configPath, mcpConfigPath, entry } = seed(t, {
    existingMcp: { mcpServers: { other: { command: "x" } } },
  });
  registerMemoryMcp({ configPath, entryHint: entry, homeDir: home });
  const first = unregisterMemoryMcp({ configPath, homeDir: home });
  assert.equal(first.removed, true);
  const second = unregisterMemoryMcp({ configPath, homeDir: home });
  assert.equal(second.removed, false);
  const cfg = readMcpConfig(mcpConfigPath);
  assert.equal(cfg.mcpServers[DEFAULT_SERVER_NAME], undefined);
  assert.deepEqual(cfg.mcpServers.other, { command: "x" });
});

test("show：不落盘，且报出本体是否已就位", (t) => {
  const { home, configPath, entry } = seed(t);
  const r = showMemoryMcp({ configPath, entryHint: entry, homeDir: home });
  assert.equal(r.entryInstalled, true);
  assert.deepEqual(r.roots, ["/w"]);
  assert.equal(r.rootsFromConfig, true);
  assert.equal(fs.existsSync(path.join(home, ".codebuddy", "mcp.json")), false);
});

test("roots：配置文件读不到 ⇒ 回退当前目录，不报错", (t) => {
  const home = tmpHome(t);
  const r = resolveRoots(path.join(home, "nope", CONFIG_FILENAME));
  assert.equal(r.fromConfig, false);
  assert.deepEqual(r.roots, [process.cwd()]);
});

test("条目构建：纯函数——offline 时带上 --offline", () => {
  const cfg = buildMemoryServerConfig({
    roots: ["/w"],
    entry: "/e/tools/memory-mcp.mjs",
    stateDir: "/s",
    offline: true,
  });
  assert.deepEqual(cfg.args, ["/e/tools/memory-mcp.mjs", "--state", "/s", "--root", "/w", "--offline"]);
});

test("条目构建：环境变量 TDAI_MEMORY_MCP_ENTRY 优先于传入提示路径", (t) => {
  const home = tmpHome(t);
  const fromEnv = path.join(home, "env-entry.mjs");
  fs.writeFileSync(fromEnv, "// fake\n");
  const hint = path.join(home, "missing.mjs");
  const prev = process.env.TDAI_MEMORY_MCP_ENTRY;
  process.env.TDAI_MEMORY_MCP_ENTRY = fromEnv;
  try {
    assert.equal(resolveMemoryEntry(hint), fromEnv);
  } finally {
    if (prev === undefined) delete process.env.TDAI_MEMORY_MCP_ENTRY;
    else process.env.TDAI_MEMORY_MCP_ENTRY = prev;
  }
});

test("合并与移除：纯函数语义（不写盘）", () => {
  const merged = mergeMcpConfig({ mcpServers: { a: { command: "a" } } }, "b", {
    command: "b",
  });
  assert.deepEqual(Object.keys(merged.mcpServers).sort(), ["a", "b"]);
  const removed = removeMcpServer(merged, "a");
  assert.equal(removed.removed, true);
  assert.deepEqual(Object.keys(removed.config.mcpServers), ["b"]);
});

test("写读往返：pretty JSON 能被读回", (t) => {
  const home = tmpHome(t);
  const file = path.join(home, "mcp.json");
  writeMcpConfig(file, { mcpServers: {} });
  assert.deepEqual(readMcpConfig(file), { mcpServers: {} });
  assert.equal(readMcpConfig(path.join(home, "missing.json")), null);
});
