#!/usr/bin/env node
/**
 * tdai-codegraph-local 仓库增删 CLI（PRD .scratch/04-tdai-skill-suite/ 工单 08）。
 *
 * 用法：
 *   node repo.mjs add <path> [--alias <name>]   追加仓库为本地资产并持久化到 config.repos
 *   node repo.mjs remove <alias|path>            从 config.repos 移除（可选调 API 删资产）
 *   node repo.mjs list                           列出 config.repos
 *
 * add 流程（ADR 0001）：
 *   1) POST http://127.0.0.1:<port>/v3/code-graph/create
 *      body: { team_id, repo_url: <path>, source_type: "local", repo_name: <alias> }
 *      header: x-tdai-service-id: <localServiceId>
 *   2) 追加到 config.repos 并写回（持久化，下次守护重启仍已知）
 *   3) 保证该仓库 .codegraph/ 进 .gitignore（验收项③，非主仓库由本脚本保证）
 *
 * 密钥纪律：本地 KS 内网信任，仅 service_id 自报身份，无 user_key。
 * 零依赖，Node >= 20（node --test 可测，fetch/fs 可注入）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describeErrors, isMainModule, assertSafeName, defaultConfigPath } from "./helpers.mjs";
import {
  readConfig,
  writeConfig,
  CONFIG_FILENAME,
  buildConfig,
} from "./setup.mjs";

const CODEGRAPH_CREATE_PATH = "/v3/code-graph/create";

const GITIGNORE_ENTRY = ".codegraph/";

/**
 * 构造本地资产 create 请求体（纯函数）。
 * @param {object} config 配置
 * @param {string} repoPath 仓库绝对路径
 * @param {string} alias 仓库名
 */
export function buildCreateBody(config, repoPath, alias) {
  return {
    team_id: config.localTeamId,
    repo_url: repoPath,
    source_type: "local",
    repo_name: alias,
  };
}

/**
 * 构造 create 请求参数（纯函数，fetch 友好形态）。
 * @returns {{ url:string, method:string, headers:object, body:string }}
 */
export function buildCreateRequest(config, repoPath, alias) {
  return {
    url: `http://127.0.0.1:${config.daemonPort}${CODEGRAPH_CREATE_PATH}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tdai-service-id": config.localServiceId,
    },
    body: JSON.stringify(buildCreateBody(config, repoPath, alias)),
  };
}


// ---------- .gitignore 维护（验收项③） ----------

/**
 * 保证 .codegraph/ 进仓库 .gitignore（纯函数，fs 可注入）。
 * 主仓库由 local-server.ts 启动时自动加；非主仓库由本脚本保证。
 * @param {string} repoPath 仓库根
 * @returns {{ ok:boolean, added:boolean, error?:string }} added=true 表示新追加了一行
 */
export function ensureCodegraphIgnored(repoPath, fsMod = fs) {
  const gitignorePath = path.join(repoPath, ".gitignore");
  let content = "";
  try {
    content = fsMod.readFileSync(gitignorePath, "utf8");
  } catch {
    // 文件不存在，下面创建
  }
  const lines = content.split(/\r?\n/);
  if (lines.some((l) => l.trim() === GITIGNORE_ENTRY)) {
    return { ok: true, added: false };
  }
  const next =
    (content ? content.replace(/\r?\n$/, "") + "\n" : "") +
    GITIGNORE_ENTRY +
    "\n";
  fsMod.writeFileSync(gitignorePath, next);
  return { ok: true, added: true };
}

// ---------- config.repos 持久化 ----------

/** 在 config.repos 追加仓库并写回（fs 可注入）。已存在（path 或 alias 重复）则跳过。 */
export function addRepoToConfig(configPath, repoPath, alias, fsMod = fs) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  const exists = config.repos.some(
    (r) => r.path === repoPath || r.alias === alias,
  );
  if (exists) return { ok: true, skipped: true, config };
  config.repos.push({ path: repoPath, alias });
  writeConfig(configPath, config, fsMod);
  return { ok: true, skipped: false, config };
}

/** 从 config.repos 移除并写回（按 path 或 alias 匹配）。 */
export function removeRepoFromConfig(configPath, key, fsMod = fs) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  const before = config.repos.length;
  config.repos = config.repos.filter((r) => r.path !== key && r.alias !== key);
  if (config.repos.length === before)
    return { ok: false, error: `未找到仓库: ${key}` };
  if (config.repos.length === 0)
    return { ok: false, error: "至少保留主仓库，拒绝移除最后一个" };
  writeConfig(configPath, config, fsMod);
  return { ok: true, config };
}

// ---------- 命令实现 ----------

/**
 * add 主流程：调 API create → 追加 config → 保证 gitignore。
 * @param {{ configPath:string, repoPath:string, alias?:string, fetchImpl?:Function, fsMod?:object }} p
 * @returns {Promise<{ ok:boolean, codeGraphId?:string, gitignoreAdded?:boolean, error?:string }>}
 */
export async function addRepo({
  configPath,
  repoPath,
  alias,
  fetchImpl = fetch,
  fsMod = fs,
}) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  const name = alias || path.basename(repoPath);
  try {
    assertSafeName(name, "仓库名");
  } catch (e) {
    return { ok: false, error: e.message };
  }

  const req = buildCreateRequest(config, repoPath, name);
  let res;
  try {
    res = await fetchImpl(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
  } catch (e) {
    return {
      ok: false,
      error: `守护不可达: ${e.message}（请先 node daemon.mjs start）`,
    };
  }
  if (res.status !== 200 && res.status !== 201) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `create 失败（HTTP ${res.status}）: ${text}` };
  }
  const data = await res.json().catch(() => ({}));
  const codeGraphId = data?.data?.code_graph_id;

  const cfgResult = addRepoToConfig(configPath, repoPath, name, fsMod);
  if (!cfgResult.ok) return cfgResult;

  const gi = ensureCodegraphIgnored(repoPath, fsMod);
  return {
    ok: true,
    codeGraphId,
    gitignoreAdded: gi.added,
    skipped: cfgResult.skipped,
  };
}

/**
 * remove 主流程：从 config.repos 移除。
 * 设计选择：不调守护 API delete——本地资产索引（.codegraph/）随仓库目录走，
 * 删 config 后守护下次重启不再注册该仓库；如需即时清守护内资产，用户可显式
 * 调 panel-admin 的 code-graph/delete 或重启守护。
 * @param {{ configPath:string, key:string, fsMod?:object }} p
 * @returns {{ ok:boolean, error?:string }}
 */
export function removeRepo({ configPath, key, fsMod = fs }) {
  return removeRepoFromConfig(configPath, key, fsMod);
}

/**
 * list 主流程：返回 config.repos。
 * @returns {{ ok:boolean, repos?:Array, error?:string }}
 */
export function listRepos({ configPath, fsMod = fs }) {
  const { ok, config, errors } = readConfig(configPath, fsMod);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  return { ok: true, repos: config.repos };
}

// ---------- CLI 入口 ----------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const [action, ...rest] = process.argv.slice(2);
  const configPath = defaultConfigPath(CONFIG_FILENAME);
  if (action === "add") {
    const repoPath = rest[0];
    const aliasIdx = rest.indexOf("--alias");
    const alias = aliasIdx !== -1 ? rest[aliasIdx + 1] : undefined;
    if (!repoPath) {
      console.error("用法: node repo.mjs add <path> [--alias <name>]");
      process.exitCode = 2;
    } else
      addRepo({ configPath, repoPath, alias })
        .then((r) => {
          if (!r.ok) {
            console.error(r.error);
            process.exitCode = 1;
          } else
            console.log(
              `已追加仓库（code_graph_id=${r.codeGraphId || "?"}${r.gitignoreAdded ? "，已加 .gitignore" : ""}）`,
            );
        })
        .catch((e) => {
          console.error(e.message);
          process.exitCode = 1;
        });
  } else if (action === "remove") {
    const [key] = rest;
    if (!key) {
      console.error("用法: node repo.mjs remove <alias|path>");
      process.exitCode = 2;
    } else {
      const r = removeRepo({ configPath, key });
      if (!r.ok) {
        console.error(r.error);
        process.exitCode = 1;
      } else console.log("已移除仓库");
    }
  } else if (action === "list") {
    const r = listRepos({ configPath });
    if (!r.ok) {
      console.error(r.error);
      process.exitCode = 1;
    } else {
      r.repos.forEach((repo, i) => {
        const tag = i === 0 ? "（主仓库 auto-register）" : "";
        console.log(`${repo.alias}\t${repo.path}${tag}`);
      });
    }
  } else {
    console.error("用法: node repo.mjs <add|remove|list> [args]");
    process.exitCode = 2;
  }
}
