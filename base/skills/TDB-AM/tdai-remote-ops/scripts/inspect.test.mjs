/** 工单 03 测试：tdai-remote-ops HTTP 快速巡检（探测计划构建 / 请求执行 / 摘要格式化 / 密钥读取）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildOpsConfig } from "./setup-credentials.mjs";
import { buildProbePlan, formatSummary, readAdminKey, runProbes, runSystemSummary } from "./inspect.mjs";
import { tmpHome } from "./test-utils.mjs";

const CFG = buildOpsConfig({
  host: "123.206.125.149",
  user: "root",
  keyPath: "/k.pem",
  deployDir: "/root/tdai-memory",
  ports: { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 },
});

// ---------- buildProbePlan ----------

test("探测计划：四端口健康 + 无 admin key 时不含 upstreams", () => {
  const plan = buildProbePlan(CFG, null);
  assert.deepEqual(plan.map((p) => p.name), ["memory-core", "knowledge", "proxy", "panel"]);
  assert.equal(plan[0].url, "http://123.206.125.149:8420/health");
  assert.equal(plan[3].url, "http://123.206.125.149:8125/api/v1/health");
  assert.equal(plan.some((p) => p.name === "proxy-admin-upstreams"), false);
});

test("探测计划：有 admin key 时追加 proxy-admin-upstreams（Bearer 鉴权）", () => {
  const plan = buildProbePlan(CFG, "sk-admin-123");
  const admin = plan.find((p) => p.name === "proxy-admin-upstreams");
  assert.ok(admin, "应有 proxy-admin-upstreams");
  assert.equal(admin.url, "http://123.206.125.149:8096/v3/admin/upstreams");
  assert.equal(admin.headers.Authorization, "Bearer sk-admin-123");
});

// ---------- runProbes（注入 fetch） ----------

test("请求执行：reach 探针 2xx/3xx/4xx 均计可达，网络错误计不可达；ok200 探针仅 200 计 OK", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("/api/v1/health")) return { status: 404 };
    if (url.includes("/admin/")) return { status: 200 };
    return { status: 200 };
  };
  const plan = buildProbePlan(CFG, "sk");
  const results = await runProbes(plan, fakeFetch);
  assert.equal(results.filter((r) => r.ok).length, plan.length, "全部可达");
  assert.equal(results.find((r) => r.name === "panel").status, 404);
  assert.equal(results.find((r) => r.name === "proxy-admin-upstreams").status, 200);
});

test("请求执行：网络错误（fetch 抛错）→ ok=false 且带 error 标记", async () => {
  const fakeFetch = async () => { throw new Error("ECONNREFUSED"); };
  const results = await runProbes(buildProbePlan(CFG, null), fakeFetch);
  assert.equal(results.every((r) => !r.ok), true);
  assert.equal(results[0].error, "unreachable");
});

// ---------- formatSummary ----------

test("摘要：逐行 OK/FAIL + 尾部计数", () => {
  const text = formatSummary([
    { name: "memory-core", ok: true, status: 200 },
    { name: "proxy", ok: false, status: null, error: "unreachable" },
  ]);
  assert.match(text, /OK memory-core \(HTTP 200\)/);
  assert.match(text, /FAIL proxy \(unreachable\)/);
  assert.match(text, /1\/2 健康/);
});

// ---------- readAdminKey ----------

test("密钥读取：从 server.env 提取 PROXY_ADMIN_API_KEY，缺失返回 null，剥离包裹引号", (t) => {
  const home = tmpHome(t);
  const env = path.join(home, "server.env");
  fs.writeFileSync(env, "PROXY_FULL_STACK=1\nPROXY_ADMIN_API_KEY=sk-proxy-admin-xyz\nOTHER=1\n");
  assert.equal(readAdminKey(env), "sk-proxy-admin-xyz");
  const quoted = path.join(home, "quoted.env");
  fs.writeFileSync(quoted, 'PROXY_ADMIN_API_KEY="sk-quoted"\n');
  assert.equal(readAdminKey(quoted), "sk-quoted");
  assert.equal(readAdminKey(path.join(home, "nope.env")), null);
});

// ---------- runSystemSummary ----------

test("系统摘要：注入 spawn 成功返回 stdout，非零退出给失败文案", () => {
  const ok = runSystemSummary(CFG, { spawnImpl: () => ({ status: 0, stdout: "== MEM ==\nMemTotal...\n== DOCKER ==\ntdai-proxy Up 2 days", stderr: "" }) });
  assert.equal(ok.ok, true);
  assert.match(ok.text, /== MEM ==/);
  assert.match(ok.text, /tdai-proxy/);
  const fail = runSystemSummary(CFG, { spawnImpl: () => ({ status: 1, stdout: "", stderr: "Connection refused" }) });
  assert.equal(fail.ok, false);
  assert.match(fail.text, /失败/);
});
