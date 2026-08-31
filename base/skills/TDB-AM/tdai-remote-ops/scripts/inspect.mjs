#!/usr/bin/env node
/**
 * tdai-remote-ops HTTP 快速巡检 + 系统摘要（PRD .scratch/04-tdai-skill-suite/ 工单 03）。
 *
 * 读 `tdai-ops.json`，对 TDAI 栈各端口做 HTTP 探活 + proxy admin 状态（可选）：
 *   - memory-core / knowledge：GET /health
 *   - panel：GET /api/v1/health（可达即算健康，404 亦可）
 *   - proxy：GET /health（可达即算健康）
 *   - proxy-admin-upstreams：GET /v3/admin/upstreams（Bearer PROXY_ADMIN_API_KEY，仅当密钥可读）
 *   - system-summary：SSH 取内存/磁盘/docker（复用 ssh.mjs）
 * 探针语义：'reach' 把 4xx 也视为端口可达（端口活着即算健康，非业务健康）；'ok200' 仅 200 视为健康。
 * 密钥纪律：admin key 运行时从 server.env 读取（PROXY_ADMIN_API_KEY=...），不回显、不落盘。
 * 零依赖，Node >= 20（node --test 可测，fetch/spawn 可注入）。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describeErrors, isMainModule } from "./helpers.mjs";
import { readOpsConfig, CONFIG_FILENAME } from "./setup-credentials.mjs";
import { runSsh } from "./ssh.mjs";

/** 健康探针种类：'reach' = 2xx-4xx 均可达；'ok200' = 仅 200 视为健康。 */
const KIND_REACH = "reach";
const KIND_OK200 = "ok200";

/**
 * 构建探测计划（纯函数）。adminKey 为空时不含 proxy admin 探针。
 * @param {{ssh:{host:string}, ports:Record<string,number>}} config
 * @param {string|null} adminKey
 * @returns {Array<{name:string,url:string,kind:string,headers?:Record<string,string>}>}
 */
export function buildProbePlan(config, adminKey) {
  const base = (port) => `http://${config.ssh.host}:${port}`;
  const plan = [
    { name: "memory-core", url: `${base(config.ports.core)}/health`, kind: KIND_REACH },
    { name: "knowledge", url: `${base(config.ports.knowledge)}/health`, kind: KIND_REACH },
    { name: "proxy", url: `${base(config.ports.proxy)}/health`, kind: KIND_REACH },
    { name: "panel", url: `${base(config.ports.panel)}/api/v1/health`, kind: KIND_REACH },
  ];
  if (adminKey) {
    plan.push({
      name: "proxy-admin-upstreams",
      url: `${base(config.ports.proxy)}/v3/admin/upstreams`,
      kind: KIND_OK200,
      headers: { Authorization: `Bearer ${adminKey}` },
    });
  }
  return plan;
}

/**
 * 执行探测计划。fetchImpl 可注入（默认全局 fetch）。
 * @returns {Promise<Array<{name:string,ok:boolean,status:number|null,error?:string}>>}
 */
export async function runProbes(plan, fetchImpl = fetch) {
  const results = [];
  for (const p of plan) {
    try {
      const res = await fetchImpl(p.url, { method: "GET", headers: p.headers || {} });
      const ok = p.kind === KIND_OK200 ? res.status === 200 : res.status >= 200 && res.status < 500;
      results.push({ name: p.name, ok, status: res.status });
    } catch {
      results.push({ name: p.name, ok: false, status: null, error: "unreachable" });
    }
  }
  return results;
}

/** 摘要格式化（纯函数）。 */
export function formatSummary(results) {
  const lines = results.map((r) => {
    if (r.status != null) return `${r.ok ? "OK" : "FAIL"} ${r.name} (HTTP ${r.status})`;
    return `${r.ok ? "OK" : "FAIL"} ${r.name} (${r.error || "unknown"})`;
  });
  const okCount = results.filter((r) => r.ok).length;
  return `${lines.join("\n")}\n---\n${okCount}/${results.length} 健康`;
}

/** 从 server.env 读取 PROXY_ADMIN_API_KEY；文件缺失或无该行返回 null（剥离包裹引号）。 */
export function readAdminKey(envPath, fsMod = fs) {
  let text;
  try {
    text = fsMod.readFileSync(envPath, "utf8");
  } catch {
    return null;
  }
  const m = text.match(/^PROXY_ADMIN_API_KEY\s*=\s*(.+)$/m);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

/** 系统摘要 SSH 命令：内存 / 磁盘 / docker 容器状态。 */
export const SYSTEM_SUMMARY_CMD = [
  'echo "== MEM =="; free -m',
  'echo "== DISK =="; df -h /',
  'echo "== DOCKER =="; docker ps --format "table {{.Names}}\\t{{.Status}}"',
].join("; ");

/**
 * 经 SSH 取服务器系统摘要（内存/磁盘/docker）。spawnImpl 可注入以便测试。
 * @returns {{ok:boolean, text:string}}
 */
export function runSystemSummary(config, { spawnImpl } = {}) {
  const r = runSsh(config, SYSTEM_SUMMARY_CMD, { spawnImpl });
  if (r.status !== 0) return { ok: false, text: `system-summary 失败（SSH exit ${r.status}）: ${(r.stderr || "").trim()}` };
  return { ok: true, text: r.stdout.trim() };
}

/** 运行巡检主流程（可注入 config 路径 / fetch / spawn 以便测试）。 */
export async function runInspect({ configPath, fetchImpl = fetch, envPath = null, spawnImpl }) {
  const { ok, config, errors } = readOpsConfig(configPath);
  if (!ok) {
    return { ok: false, error: describeErrors(errors) };
  }
  const env = envPath ?? config.secrets?.envPath;
  const adminKey = env ? readAdminKey(env) : null;
  const plan = buildProbePlan(config, adminKey);
  const results = await runProbes(plan, fetchImpl);
  const system = runSystemSummary(config, { spawnImpl });
  const summary = `${formatSummary(results)}\n\n${system.text}`;
  return { ok: true, summary, results, system };
}

// ---------- CLI 入口 ----------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const configPath = process.argv[2] || path.join(os.homedir(), ".tdai", "config", CONFIG_FILENAME);
  runInspect({ configPath })
    .then((r) => {
      if (!r.ok) {
        console.error(`巡检失败：${r.error}`);
        process.exitCode = 1;
        return;
      }
      console.log(r.summary);
    })
    .catch((err) => {
      console.error(`巡检异常：${err.message}`);
      process.exitCode = 1;
    });
}
