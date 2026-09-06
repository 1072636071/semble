/** 工单 07 测试：tdai-codegraph-local 编译件安装（命令构建/校验/流程编排）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildConfig, writeConfig, CONFIG_FILENAME } from "./setup.mjs";
import {
  DAEMON_ENTRY_REL,
  buildNpmArgs,
  checkNativeModules,
  checkTarball,
  resolveDaemonEntry,
  runInstall,
} from "./install.mjs";
import { tmpHome } from "./test-utils.mjs";

/** 落一份真实配置 + tarball 文件。 */
function seedConfig(t, overrides = {}) {
  const home = tmpHome(t);
  const tarball = path.join(home, "memory-knowledge-0.1.0.tgz");
  fs.writeFileSync(tarball, "FAKE TARBALL");
  const runtimeDir = path.join(home, "runtime");
  const cfg = buildConfig({
    tarballPath: tarball,
    runtimeDir,
    repos: [{ path: "/w" }],
    ...overrides,
  });
  const configPath = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  writeConfig(configPath, cfg);
  return { home, tarball, runtimeDir, configPath, cfg };
}

/** 在 runtimeDir 下伪造已安装的守护入口 + 原生依赖目录。 */
function seedInstalledEntry(runtimeDir) {
  const entry = path.join(runtimeDir, DAEMON_ENTRY_REL);
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, "FAKE ENTRY");
  // 伪造原生依赖目录
  fs.mkdirSync(path.join(runtimeDir, "node_modules", "better-sqlite3"), { recursive: true });
  fs.mkdirSync(path.join(runtimeDir, "node_modules", "@node-rs", "jieba"), { recursive: true });
  return entry;
}

// ---------- buildNpmArgs ----------

test("npm 参数：install <tarball> --prefix <runtime>", () => {
  assert.deepEqual(buildNpmArgs("/t.tgz", "/r"), [
    "install",
    "/t.tgz",
    "--prefix",
    "/r",
  ]);
});

// ---------- resolveDaemonEntry ----------

test("守护入口：存在返回绝对路径，不存在返回 null", (t) => {
  const home = tmpHome(t);
  const runtimeDir = path.join(home, "runtime");
  assert.equal(resolveDaemonEntry(runtimeDir), null);
  const entry = seedInstalledEntry(runtimeDir);
  assert.equal(resolveDaemonEntry(runtimeDir), entry);
});

// ---------- checkTarball ----------

test("tarball 校验：存在且非空文件通过", (t) => {
  const home = tmpHome(t);
  const tarball = path.join(home, "t.tgz");
  fs.writeFileSync(tarball, "X");
  assert.equal(checkTarball(tarball).ok, true);
});

test("tarball 校验：不存在/空文件/目录 均报错", (t) => {
  const home = tmpHome(t);
  assert.equal(checkTarball(path.join(home, "no.tgz")).ok, false);
  const empty = path.join(home, "empty.tgz");
  fs.writeFileSync(empty, "");
  assert.equal(checkTarball(empty).ok, false);
  const dir = path.join(home, "dir.tgz");
  fs.mkdirSync(dir);
  assert.equal(checkTarball(dir).ok, false);
});

// ---------- checkNativeModules ----------

test("原生依赖：两个目录就位则通过", (t) => {
  const home = tmpHome(t);
  const runtimeDir = path.join(home, "r");
  fs.mkdirSync(path.join(runtimeDir, "node_modules", "better-sqlite3"), { recursive: true });
  fs.mkdirSync(path.join(runtimeDir, "node_modules", "@node-rs", "jieba"), { recursive: true });
  assert.equal(checkNativeModules(runtimeDir).ok, true);
});

test("原生依赖：缺失则报错并列出缺失项", (t) => {
  const home = tmpHome(t);
  const runtimeDir = path.join(home, "r");
  fs.mkdirSync(path.join(runtimeDir, "node_modules"), { recursive: true });
  const r = checkNativeModules(runtimeDir);
  assert.equal(r.ok, false);
  assert.ok(r.missing.length >= 2);
  assert.match(r.error, /better-sqlite3/);
});

// ---------- runInstall ----------

test("安装：注入 spawn，npm 成功后返回守护入口", (t) => {
  const { configPath, runtimeDir, tarball } = seedConfig(t);
  const fakeSpawn = (cmd, args) => {
    assert.equal(cmd, "npm");
    assert.deepEqual(args, ["install", tarball, "--prefix", runtimeDir]);
    seedInstalledEntry(runtimeDir);
    return { status: 0, stdout: "", stderr: "" };
  };
  const r = runInstall({ configPath, spawnImpl: fakeSpawn });
  assert.equal(r.ok, true);
  assert.equal(r.runtimeDir, runtimeDir);
  assert.ok(r.daemonEntry);
});

test("安装：npm 失败原样透传 stderr", (t) => {
  const { configPath } = seedConfig(t);
  const fakeSpawn = () => ({ status: 1, stdout: "", stderr: "ENOENT" });
  const r = runInstall({ configPath, spawnImpl: fakeSpawn });
  assert.equal(r.ok, false);
  assert.match(r.error, /npm install 失败/);
});

test("安装：tarball 不存在直接报错，不调 npm", (t) => {
  const { configPath, tarball } = seedConfig(t);
  fs.rmSync(tarball);
  let called = false;
  const r = runInstall({
    configPath,
    spawnImpl: () => {
      called = true;
      return { status: 0 };
    },
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /tarball 不存在/);
  assert.equal(called, false);
});

test("安装：--check 已安装且原生依赖就位则跳过不调 npm", (t) => {
  const { configPath, runtimeDir } = seedConfig(t);
  seedInstalledEntry(runtimeDir);
  let called = false;
  const r = runInstall({
    configPath,
    check: true,
    spawnImpl: () => {
      called = true;
      return { status: 0 };
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.equal(called, false);
});

test("安装：--check 已安装但原生依赖缺失则报错", (t) => {
  const { configPath, runtimeDir } = seedConfig(t);
  // 只种守护入口，不种原生依赖目录
  const entry = path.join(runtimeDir, DAEMON_ENTRY_REL);
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, "FAKE ENTRY");
  let called = false;
  const r = runInstall({
    configPath,
    check: true,
    spawnImpl: () => {
      called = true;
      return { status: 0 };
    },
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /better-sqlite3|jieba/);
  assert.equal(called, false);
});

test("安装：npm 成功但入口缺失报错（包结构异常）", (t) => {
  const { configPath } = seedConfig(t);
  const fakeSpawn = () => ({ status: 0, stdout: "", stderr: "" });
  const r = runInstall({ configPath, spawnImpl: fakeSpawn });
  assert.equal(r.ok, false);
  assert.match(r.error, /未找到守护入口/);
});

test("安装：npm 成功 + 入口就位但原生模块缺失报错", (t) => {
  const { configPath, runtimeDir } = seedConfig(t);
  const fakeSpawn = () => {
    // 只建守护入口，不建原生依赖目录
    const entry = path.join(runtimeDir, DAEMON_ENTRY_REL);
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, "FAKE");
    return { status: 0, stdout: "", stderr: "" };
  };
  const r = runInstall({ configPath, spawnImpl: fakeSpawn });
  assert.equal(r.ok, false);
  assert.match(r.error, /原生依赖缺失/);
});
