/** 工单 07 测试：tdai-codegraph-local 用户级 MCP 注册（条目构建/合并/读写）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildConfig, writeConfig, CONFIG_FILENAME } from "./setup.mjs";
import { MCP_ENTRY_REL } from "./mcp.mjs";
import {
  buildMcpServerConfig,
  mergeMcpConfig,
  readMcpConfig,
  registerMcp,
  removeMcpServer,
  resolveMcpEntry,
  showMcp,
  unregisterMcp,
  writeMcpConfig,
} from "./mcp.mjs";
import { tmpHome } from "./test-utils.mjs";

/** 落 tdai-codegraph.json + 可选伪造已安装 MCP 入口 + 可选伪造既有 MCP 配置。 */
function seed(t, { withEntry = true, existingMcp = null } = {}) {
  const home = tmpHome(t);
  const runtimeDir = path.join(home, "runtime");
  const mcpConfigPath = path.join(home, ".codebuddy", "mcp.json");
  const cfg = buildConfig({
    tarballPath: "/t.tgz",
    runtimeDir,
    daemonPort: 8421,
    repos: [{ path: "/w", alias: "w" }],
    mcp: {
      vendor: "codebuddy",
      configPath: mcpConfigPath,
      serverName: "tdai-codegraph",
    },
  });
  const configPath = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  writeConfig(configPath, cfg);
  if (withEntry) {
    const entry = path.join(runtimeDir, MCP_ENTRY_REL);
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, "FAKE");
  }
  if (existingMcp) {
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.writeFileSync(mcpConfigPath, JSON.stringify(existingMcp));
  }
  return { home, runtimeDir, configPath, mcpConfigPath, cfg };
}

// ---------- resolveMcpEntry ----------

test("MCP 入口：存在返回路径，不存在返回 null", (t) => {
  const home = tmpHome(t);
  const runtimeDir = path.join(home, "r");
  assert.equal(resolveMcpEntry(runtimeDir), null);
  const entry = path.join(runtimeDir, MCP_ENTRY_REL);
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, "X");
  assert.equal(resolveMcpEntry(runtimeDir), entry);
});

// ---------- buildMcpServerConfig ----------

test("server 条目：command=node，args=[entry]，env.KNOWLEDGE_API_URL 含 /v3", (t) => {
  const { configPath } = seed(t);
  const { cfg } = seed(t);
  const sc = buildMcpServerConfig(cfg);
  assert.equal(sc.command, process.execPath);
  assert.ok(sc.args[0].includes("mcp", "server.js"));
  assert.match(sc.env.KNOWLEDGE_API_URL, /http:\/\/127\.0\.0\.1:8421\/v3/);
});

// ---------- mergeMcpConfig ----------

test("合并：空配置 → 新建 mcpServers", () => {
  const out = mergeMcpConfig(null, "tdai-codegraph", {
    command: "node",
    args: [],
    env: {},
  });
  assert.deepEqual(out.mcpServers["tdai-codegraph"], {
    command: "node",
    args: [],
    env: {},
  });
});

test("合并：既有其他 server 不破坏，追加新 server", () => {
  const existing = { mcpServers: { other: { command: "x" } } };
  const out = mergeMcpConfig(existing, "tdai-codegraph", { command: "node" });
  assert.equal(out.mcpServers.other.command, "x");
  assert.equal(out.mcpServers["tdai-codegraph"].command, "node");
});

test("合并：同名 server 覆盖（幂等）", () => {
  const existing = { mcpServers: { "tdai-codegraph": { command: "old" } } };
  const out = mergeMcpConfig(existing, "tdai-codegraph", { command: "new" });
  assert.equal(out.mcpServers["tdai-codegraph"].command, "new");
});

// ---------- removeMcpServer ----------

test("移除：存在则删，removed=true", () => {
  const existing = { mcpServers: { "tdai-codegraph": {}, other: {} } };
  const { config, removed } = removeMcpServer(existing, "tdai-codegraph");
  assert.equal(removed, true);
  assert.equal(config.mcpServers["tdai-codegraph"], undefined);
  assert.ok(config.mcpServers.other);
});

test("移除：不存在 removed=false，不报错", () => {
  const { config, removed } = removeMcpServer(
    { mcpServers: {} },
    "tdai-codegraph",
  );
  assert.equal(removed, false);
  assert.deepEqual(config.mcpServers, {});
});

// ---------- readMcpConfig / writeMcpConfig ----------

test("读写：write 后 read 等价", (t) => {
  const home = tmpHome(t);
  const f = path.join(home, "mcp.json");
  const cfg = { mcpServers: { x: { command: "node" } } };
  writeMcpConfig(f, cfg);
  assert.deepEqual(readMcpConfig(f), cfg);
});

test("读：不存在返回 null，非法 JSON 返回 null", (t) => {
  const home = tmpHome(t);
  assert.equal(readMcpConfig(path.join(home, "no.json")), null);
  const bad = path.join(home, "bad.json");
  fs.writeFileSync(bad, "{not json");
  assert.equal(readMcpConfig(bad), null);
});

// ---------- registerMcp ----------

test("register：合并写入用户级 MCP 配置，幂等", (t) => {
  const { configPath, mcpConfigPath } = seed(t, {
    existingMcp: { mcpServers: { other: { command: "x" } } },
  });
  const r1 = registerMcp({ configPath });
  assert.equal(r1.ok, true);
  const after1 = JSON.parse(fs.readFileSync(mcpConfigPath, "utf8"));
  assert.ok(after1.mcpServers["tdai-codegraph"]);
  assert.ok(after1.mcpServers.other, "既有 other 不破坏");
  // 二次注册幂等
  const r2 = registerMcp({ configPath });
  assert.equal(r2.ok, true);
  const after2 = JSON.parse(fs.readFileSync(mcpConfigPath, "utf8"));
  assert.deepEqual(
    after2.mcpServers["tdai-codegraph"],
    after1.mcpServers["tdai-codegraph"],
  );
});

test("register：无既有 MCP 配置则新建", (t) => {
  const { configPath, mcpConfigPath } = seed(t);
  const r = registerMcp({ configPath });
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(mcpConfigPath));
});

test("register：config.mcp.configPath 缺失报错", (t) => {
  const home = tmpHome(t);
  const cfg = buildConfig({
    tarballPath: "/t",
    runtimeDir: "/r",
    repos: [{ path: "/w" }],
    mcp: { vendor: "x", configPath: "", serverName: "x" },
  });
  const configPath = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  writeConfig(configPath, cfg);
  const r = registerMcp({ configPath });
  assert.equal(r.ok, false);
  assert.match(r.error, /configPath 未配置/);
});

// ---------- unregisterMcp ----------

test("unregister：移除条目", (t) => {
  const { configPath, mcpConfigPath } = seed(t, {
    existingMcp: {
      mcpServers: { "tdai-codegraph": { command: "node" }, other: {} },
    },
  });
  const r = unregisterMcp({ configPath });
  assert.equal(r.ok, true);
  assert.equal(r.removed, true);
  const after = JSON.parse(fs.readFileSync(mcpConfigPath, "utf8"));
  assert.equal(after.mcpServers["tdai-codegraph"], undefined);
  assert.ok(after.mcpServers.other);
});

// ---------- showMcp ----------

test("show：返回 server 条目不落盘", (t) => {
  const { configPath, mcpConfigPath } = seed(t);
  const r = showMcp({ configPath });
  assert.equal(r.ok, true);
  assert.equal(r.serverName, "tdai-codegraph");
  assert.ok(r.serverConfig.command);
  assert.equal(r.entryInstalled, true, "入口已安装");
  assert.equal(fs.existsSync(mcpConfigPath), false, "不落盘");
});

test("show：入口未安装时 entryInstalled=false", (t) => {
  const { configPath } = seed(t, { withEntry: false });
  const r = showMcp({ configPath });
  assert.equal(r.ok, true);
  assert.equal(r.entryInstalled, false, "入口未安装");
});
