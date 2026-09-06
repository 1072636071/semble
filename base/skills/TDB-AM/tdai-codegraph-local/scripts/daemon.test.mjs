/** 工单 07+08 测试：tdai-codegraph-local 守护进程管理（环境变量/PID/起停/健康）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildConfig, writeConfig, CONFIG_FILENAME } from "./setup.mjs";
import { DAEMON_ENTRY_REL } from "./install.mjs";
import {
  buildEnv,

  clearPid,
  errLogFilePath,
  healthDaemon,
  isProcessAlive,
  logFilePath,
  pidFilePath,
  readPid,
  startDaemon,
  statusDaemon,
  stopDaemon,
  writePid,
} from "./daemon.mjs";
import { tmpHome } from "./test-utils.mjs";

const CFG = buildConfig({
  tarballPath: "/t.tgz",
  runtimeDir: "/r",
  daemonPort: 8421,
  fallbackBaseUrl: "http://remote:8421/v3",
  repos: [{ path: "E:\\work\\sp\\JwikisSkills", alias: "JwikisSkills" }],
});

/** 落配置 + 伪造已安装守护入口。 */
function seedInstalled(t, overrides = {}) {
  const home = tmpHome(t);
  const runtimeDir = path.join(home, "runtime");
  const cfg = buildConfig({ ...CFG, runtimeDir, ...overrides });
  const configPath = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  writeConfig(configPath, cfg);
  const entry = path.join(runtimeDir, DAEMON_ENTRY_REL);
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, "FAKE");
  return { home, runtimeDir, configPath, cfg, entry };
}

// ---------- buildEnv ----------

test("环境变量：主仓库为 KNOWLEDGE_LOCAL_WORKSPACE，含端口/防抖/兜底", () => {
  const env = buildEnv(CFG);
  assert.equal(env.KNOWLEDGE_LOCAL_WORKSPACE, "E:\\work\\sp\\JwikisSkills");
  assert.equal(env.KNOWLEDGE_LOCAL_SERVICE_ID, "local");
  assert.equal(env.KNOWLEDGE_LOCAL_TEAM_ID, "local");
  assert.equal(env.PORT, "8421");
  assert.equal(env.KNOWLEDGE_QUERY_REFRESH_DEBOUNCE_MS, "5000");
  assert.equal(env.KNOWLEDGE_FALLBACK_BASE_URL, "http://remote:8421/v3");
  assert.equal(env.KNOWLEDGE_FALLBACK_SERVICE_ID, "local");
});

test("环境变量：无兜底 URL 时不设 FALLBACK_*", () => {
  const cfg = buildConfig({
    tarballPath: "/t",
    runtimeDir: "/r",
    repos: [{ path: "/w" }],
  });
  const env = buildEnv(cfg);
  assert.equal(env.KNOWLEDGE_FALLBACK_BASE_URL, undefined);
  assert.equal(env.KNOWLEDGE_FALLBACK_SERVICE_ID, undefined);
});


// ---------- PID 读写 ----------

test("PID 读写：write 后 read 等价，clear 后 read 为 null", (t) => {
  const home = tmpHome(t);
  assert.equal(readPid(home), null);
  writePid(12345, home);
  assert.equal(readPid(home), 12345);
  clearPid(home);
  assert.equal(readPid(home), null);
});

test("PID 读：非法内容返回 null 不抛错", (t) => {
  const home = tmpHome(t);
  fs.mkdirSync(path.dirname(pidFilePath(home)), { recursive: true });
  fs.writeFileSync(pidFilePath(home), "not-a-number\n");
  assert.equal(readPid(home), null);
});

// ---------- isProcessAlive ----------

test("进程存活：当前进程 PID 存活，不存在的 PID 不存活", () => {
  assert.equal(isProcessAlive(process.pid), true);
  assert.equal(isProcessAlive(999999), false);
});

// ---------- startDaemon ----------

test("start：注入 spawn，写 PID 并返回", (t) => {
  const { home, configPath } = seedInstalled(t);
  const fakeSpawn = (cmd, args, opts) => {
    assert.equal(cmd, process.execPath);
    assert.ok(args[0].includes("local-server.js"));
    assert.equal(opts.detached, true);
    return { pid: 4242, unref() {} };
  };
  const r = startDaemon({ configPath, spawnImpl: fakeSpawn, homeDir: home });
  assert.equal(r.ok, true);
  assert.equal(r.pid, 4242);
  assert.equal(readPid(home), 4242);
});

test("start：已有存活 PID 拒绝重复启动", (t) => {
  const { home, configPath } = seedInstalled(t);
  writePid(process.pid, home); // 用当前进程 PID 模拟存活守护
  const r = startDaemon({
    configPath,
    spawnImpl: () => {
      throw new Error("不该调 spawn");
    },
    homeDir: home,
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /守护已在运行/);
});

test("start：守护入口未安装报错", (t) => {
  const home = tmpHome(t);
  const runtimeDir = path.join(home, "runtime");
  const cfg = buildConfig({ ...CFG, runtimeDir });
  const configPath = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  writeConfig(configPath, cfg);
  // 不创建 entry
  const r = startDaemon({
    configPath,
    spawnImpl: () => ({ pid: 1 }),
    homeDir: home,
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /守护入口未安装/);
});

// ---------- stopDaemon ----------

test("stop：发 SIGTERM 并清 PID 文件", (t) => {
  const { home } = seedInstalled(t);
  writePid(process.pid, home);
  let signaled = null;
  const fakeKill = (pid, sig) => {
    signaled = { pid, sig };
  };
  const r = stopDaemon({ homeDir: home, killImpl: fakeKill });
  assert.equal(r.ok, true);
  assert.equal(r.pid, process.pid);
  assert.equal(signaled.sig, "SIGTERM");
  assert.equal(readPid(home), null);
});

test("stop：无 PID 文件报错", (t) => {
  const home = tmpHome(t);
  const r = stopDaemon({ homeDir: home });
  assert.equal(r.ok, false);
  assert.match(r.error, /无 PID 文件/);
});

test("stop：PID 已不存在则清理 PID 文件", (t) => {
  const { home } = seedInstalled(t);
  writePid(999999, home);
  const r = stopDaemon({ homeDir: home });
  assert.equal(r.ok, false);
  assert.match(r.error, /已不存在/);
  assert.equal(readPid(home), null);
});

// ---------- statusDaemon ----------

test("status：无 PID 返回 alive=false", (t) => {
  const home = tmpHome(t);
  const r = statusDaemon({ homeDir: home });
  assert.equal(r.alive, false);
});

test("status：有存活 PID 返回 alive=true", (t) => {
  const { home } = seedInstalled(t);
  writePid(process.pid, home);
  const r = statusDaemon({ homeDir: home });
  assert.equal(r.alive, true);
  assert.equal(r.pid, process.pid);
});

// ---------- healthDaemon ----------

test("health：注入 fetch，200 返回 ok", async (t) => {
  const { configPath } = seedInstalled(t);
  const fakeFetch = async (url) => {
    assert.match(url, /http:\/\/127\.0\.0\.1:8421\/health/);
    return { status: 200, text: async () => '{"status":"ok"}' };
  };
  const r = await healthDaemon({ configPath, fetchImpl: fakeFetch });
  assert.equal(r.ok, true);
  assert.equal(r.status, 200);
});

test("health：非 200 返回 not ok", async (t) => {
  const { configPath } = seedInstalled(t);
  const fakeFetch = async () => ({ status: 503, text: async () => "down" });
  const r = await healthDaemon({ configPath, fetchImpl: fakeFetch });
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
});

test("health：fetch 抛错返回错误文案", async (t) => {
  const { configPath } = seedInstalled(t);
  const fakeFetch = async () => {
    throw new Error("ECONNREFUSED");
  };
  const r = await healthDaemon({ configPath, fetchImpl: fakeFetch });
  assert.equal(r.ok, false);
  assert.match(r.error, /ECONNREFUSED/);
});

// ---------- 日志路径 ----------

test("日志路径：state 目录下 daemon.log / daemon.err.log / daemon.pid", (t) => {
  const home = tmpHome(t);
  assert.equal(
    pidFilePath(home),
    path.join(home, ".tdai", "state", "daemon.pid"),
  );
  assert.equal(
    logFilePath(home),
    path.join(home, ".tdai", "state", "daemon.log"),
  );
  assert.equal(
    errLogFilePath(home),
    path.join(home, ".tdai", "state", "daemon.err.log"),
  );
});
