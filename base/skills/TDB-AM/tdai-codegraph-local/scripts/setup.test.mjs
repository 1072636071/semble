/** 工单 07 测试：tdai-codegraph-local 配置向导（探测/构建/校验/读写/交互）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CONFIG_FILENAME,
  PILOT_REPOS,
  buildConfig,
  findBundledTarball,
  mcpConfigCandidates,
  readConfig,
  runWizard,
  validateConfig,
  writeConfig,
} from "./setup.mjs";
import { tmpHome } from "./test-utils.mjs";

const msgs = (v) => v.errors.map((e) => e.message).join(";");

/** 在临时 scriptsDir 下搭一个 assets/memory-knowledge-0.1.0.tgz。 */
function seedTarball(home) {
  const scriptsDir = path.join(
    home,
    "skills",
    "tdai-codegraph-local",
    "scripts",
  );
  const assetsDir = path.resolve(scriptsDir, "..", "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  const tarball = path.join(assetsDir, "memory-knowledge-0.1.0.tgz");
  fs.writeFileSync(tarball, "FAKE TARBALL");
  return { scriptsDir, tarball };
}

// ---------- mcpConfigCandidates ----------

test("MCP 候选：返回常见 harness 布局，首个为 codebuddy", () => {
  const list = mcpConfigCandidates("/h");
  assert.equal(list[0].vendor, "codebuddy");
  assert.ok(list.some((c) => c.vendor === "codearts"));
  assert.ok(list.some((c) => c.vendor === "trae"));
});

// ---------- findBundledTarball ----------

test("探测 tarball：assets 下 memory-knowledge-*.tgz 命中", (t) => {
  const home = tmpHome(t);
  const { scriptsDir, tarball } = seedTarball(home);
  assert.equal(findBundledTarball(scriptsDir), tarball);
});

test("探测 tarball：无 assets 目录返回 null", (t) => {
  const home = tmpHome(t);
  const scriptsDir = path.join(home, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  assert.equal(findBundledTarball(scriptsDir), null);
});

// ---------- buildConfig / validate ----------

test("构建：默认值填充（端口/服务/防抖/MCP）", () => {
  const cfg = buildConfig({
    tarballPath: "/t.tgz",
    runtimeDir: "/r",
    repos: [{ path: "/w" }],
  });
  assert.equal(cfg.daemonPort, 8421);
  assert.equal(cfg.localServiceId, "local");
  assert.equal(cfg.queryRefreshDebounceMs, 5000);
  assert.equal(cfg.repos[0].alias, "w");
  assert.equal(cfg.mcp.vendor, "codebuddy");
});

test("校验：合法配置通过", () => {
  const cfg = buildConfig({
    tarballPath: "/t.tgz",
    runtimeDir: "/r",
    repos: PILOT_REPOS,
  });
  assert.equal(validateConfig(cfg).ok, true);
});

test("校验：缺 tarballPath / 非法端口 / 空 repos 均结构化报错", () => {
  const v1 = validateConfig({
    runtimeDir: "/r",
    daemonPort: 8421,
    repos: [{ path: "/w" }],
  });
  assert.equal(v1.ok, false);
  assert.ok(v1.errors.some((e) => e.field === "tarballPath"));
  const v2 = validateConfig({
    tarballPath: "/t",
    runtimeDir: "/r",
    daemonPort: 0,
    repos: [{ path: "/w" }],
  });
  assert.ok(v2.errors.some((e) => e.field === "daemonPort"));
  const v3 = validateConfig({
    tarballPath: "/t",
    runtimeDir: "/r",
    daemonPort: 8421,
    repos: [],
  });
  assert.ok(v3.errors.some((e) => e.field === "repos"));
});

// ---------- 读写幂等 ----------

test("读写：write 后 read 等价（幂等）", (t) => {
  const home = tmpHome(t);
  const cfg = buildConfig({
    tarballPath: "/t.tgz",
    runtimeDir: "/r",
    repos: PILOT_REPOS,
  });
  const target = path.join(home, CONFIG_FILENAME);
  writeConfig(target, cfg);
  assert.deepEqual(readConfig(target).config, cfg);
});

// ---------- 向导 ----------

function fakeIo(home, answers, scriptsDir = null) {
  const queue = [...answers];
  const logs = [];
  return {
    io: {
      log: (m) => logs.push(m),
      ask: async () => queue.shift() ?? "",
      homeDir: home,
      scriptsDir,
    },
    logs,
  };
}

test("向导：探测命中 tarball → 自动构建配置落盘 ~/.tdai/config/tdai-codegraph.json", async (t) => {
  const home = tmpHome(t);
  const { scriptsDir } = seedTarball(home);
  const { io, logs } = fakeIo(home, ["", "", ""], scriptsDir); // 端口/兜底/MCP 全回车默认
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  const target = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  assert.equal(r.configPath, target);
  const cfg = JSON.parse(fs.readFileSync(target, "utf8"));
  assert.equal(cfg.daemonPort, 8421);
  assert.equal(cfg.repos.length, 2);
  assert.equal(cfg.repos[0].path, "E:\\work\\sp\\JwikisSkills");
  assert.ok(logs.some((l) => l.includes("自动构建")));
});

test("向导：无 tarball → 手填 tarballPath 后落盘", async (t) => {
  const home = tmpHome(t);
  const scriptsDir = path.join(home, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  const manualTarball = path.join(home, "manual.tgz");
  const { io } = fakeIo(
    home,
    [manualTarball, "9000", "http://remote:8421/v3", ""],
    scriptsDir,
  );
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  const cfg = JSON.parse(fs.readFileSync(r.configPath, "utf8"));
  assert.equal(cfg.tarballPath, manualTarball);
  assert.equal(cfg.daemonPort, 9000);
  assert.equal(cfg.fallbackBaseUrl, "http://remote:8421/v3");
});

test("向导：目标已有合法配置 → 零输入复用，不重建不改写", async (t) => {
  const home = tmpHome(t);
  const target = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  const pre = buildConfig({
    tarballPath: "/pre.tgz",
    runtimeDir: "/pre",
    daemonPort: 9999,
    repos: [{ path: "/w" }],
  });
  writeConfig(target, pre);
  const before = fs.readFileSync(target, "utf8");
  const { io, logs } = fakeIo(home, []);
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  assert.equal(fs.readFileSync(target, "utf8"), before);
  assert.ok(logs.some((l) => l.includes("复用既有配置")));
});

test("向导：非法端口输入保留默认，不崩溃", async (t) => {
  const home = tmpHome(t);
  const { scriptsDir } = seedTarball(home);
  const { io, logs } = fakeIo(home, ["abc", "", ""], scriptsDir);
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  assert.equal(r.config.daemonPort, 8421);
  assert.ok(logs.some((l) => l.includes("端口非法")));
});
