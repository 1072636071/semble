#!/usr/bin/env node
/**
 * tdai-codegraph-local 编译件安装 CLI（PRD .scratch/04-tdai-skill-suite/ 工单 07）。
 *
 * 用法：node install.mjs
 *   读 ~/.tdai/config/tdai-codegraph.json，把 tarballPath 的 MemoryKnowledge 编译件
 *   安装到 runtimeDir（默认 ~/.tdai/runtime/）：npm install <tarball> --prefix <runtimeDir>
 *   npm 自动从 registry 解析原生依赖（better-sqlite3 / @node-rs/jieba），无需源码仓库在场。
 *   安装后 runtimeDir 下出现 node_modules/ 与 package.json，守护进程执行
 *   runtimeDir/node_modules/memory-knowledge/dist/local-server.js（ADR 0002）。
 *
 * 幂等：重复安装覆盖旧版本；--check 仅校验已安装不重装。
 * 零依赖，Node >= 20（node --test 可测，spawn 可注入）。
 */
import fs from "node:fs";
import path from "node:path";

import { spawnSync } from "node:child_process";
import { describeErrors, isMainModule, defaultConfigPath } from "./helpers.mjs";
import { readConfig, CONFIG_FILENAME } from "./setup.mjs";

/** 安装后守护入口的相对路径（npm install 后包名 memory-knowledge 的 dist/local-server.js）。 */
export const DAEMON_ENTRY_REL = path.join(
  "node_modules",
  "memory-knowledge",
  "dist",
  "local-server.js",
);

/**
 * 构造 npm install 参数（纯函数）。
 * @param {string} tarballPath tarball 绝对路径
 * @param {string} runtimeDir 安装目录
 * @returns {string[]} npm 参数
 */
export function buildNpmArgs(tarballPath, runtimeDir) {
  return ["install", tarballPath, "--prefix", runtimeDir];
}

/**
 * 探测已安装的守护入口路径（纯函数，fs 可注入）。
 * @returns {string|null} 入口绝对路径，不存在返回 null
 */
export function resolveDaemonEntry(runtimeDir, fsMod = fs) {
  const entry = path.join(runtimeDir, DAEMON_ENTRY_REL);
  return fsMod.existsSync(entry) ? entry : null;
}

/** 关键原生依赖（npm install 后须就位，否则守护启动时 better-sqlite38/@node-rs/jieba 加载失败）。 */
const NATIVE_DEPS = ["better-sqlite3", path.join("@node-rs", "jieba")];

/**
 * 校验原生依赖目录就位（fs 可注入）。
 * @returns {{ ok:boolean, missing?:string[], error?:string }}
 */
export function checkNativeModules(runtimeDir, fsMod = fs) {
  const missing = NATIVE_DEPS.filter((dep) => !fsMod.existsSync(path.join(runtimeDir, "node_modules", dep)));
  if (missing.length > 0) {
    return { ok: false, missing, error: `原生依赖缺失: ${missing.join(", ")}（npm install 可能未完成，请重跑 node install.mjs）` };
  }
  return { ok: true };
}

/**
 * 校验 tarball 文件存在（fs 可注入）。
 * @returns {{ ok:boolean, error?:string }}
 */
export function checkTarball(tarballPath, fsMod = fs) {
  if (!tarballPath || !fsMod.existsSync(tarballPath)) {
    return {
      ok: false,
      error: `tarball 不存在: ${tarballPath}（请先打包或运行向导重填路径）`,
    };
  }
  const st = fsMod.statSync(tarballPath);
  if (!st.isFile() || st.size === 0) {
    return { ok: false, error: `tarball 非有效文件: ${tarballPath}` };
  }
  return { ok: true };
}

/**
 * 安装主流程（spawnImpl 可注入以便测试）。
 * @param {{ configPath:string, check?:boolean, spawnImpl?:Function, fsMod?:object }} p
 * @returns {{ ok:boolean, runtimeDir?:string, daemonEntry?:string, error?:string }}
 */
export function runInstall({
  configPath,
  check = false,
  spawnImpl = spawnSync,
  fsMod = fs,
}) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };

  const tarballOk = checkTarball(config.tarballPath, fsMod);
  if (!tarballOk.ok) return tarballOk;

  fsMod.mkdirSync(config.runtimeDir, { recursive: true });

  // --check：已安装且原生依赖就位则跳过
  const existingEntry = resolveDaemonEntry(config.runtimeDir, fsMod);
  if (check && existingEntry) {
    const nativeOk = checkNativeModules(config.runtimeDir, fsMod);
    if (!nativeOk.ok) return { ok: false, error: nativeOk.error };
    return {
      ok: true,
      runtimeDir: config.runtimeDir,
      daemonEntry: existingEntry,
      skipped: true,
    };
  }

  const res = spawnImpl(
    "npm",
    buildNpmArgs(config.tarballPath, config.runtimeDir),
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    return {
      ok: false,
      error: `npm install 失败（exit ${res.status}）: ${(res.stderr || "").trim()}`,
    };
  }

  const daemonEntry = resolveDaemonEntry(config.runtimeDir, fsMod);
  if (!daemonEntry) {
    return {
      ok: false,
      error: `安装后未找到守护入口: ${path.join(config.runtimeDir, DAEMON_ENTRY_REL)}`,
    };
  }
  const nativeOk = checkNativeModules(config.runtimeDir, fsMod);
  if (!nativeOk.ok) {
    return { ok: false, error: nativeOk.error };
  }
  return { ok: true, runtimeDir: config.runtimeDir, daemonEntry };
}

// ---------- CLI 入口 ----------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const check = process.argv.includes("--check");
  const configPath = defaultConfigPath(CONFIG_FILENAME);
  const r = runInstall({ configPath, check });
  if (!r.ok) {
    console.error(r.error || "安装失败");
    process.exitCode = 1;
  } else if (r.skipped) {
    console.log(
      `已安装，跳过（runtime=${r.runtimeDir}，entry=${r.daemonEntry}）`,
    );
  } else {
    console.log(`安装完成：runtime=${r.runtimeDir}，守护入口=${r.daemonEntry}`);
  }
}
