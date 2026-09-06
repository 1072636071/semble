/** 工单 08 测试：tdai-codegraph-local 仓库增删（API 请求/gitignore/config 持久化）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildConfig, writeConfig, CONFIG_FILENAME } from "./setup.mjs";
import {
  addRepo,
  addRepoToConfig,
  buildCreateBody,
  buildCreateRequest,

  ensureCodegraphIgnored,
  listRepos,
  removeRepo,
  removeRepoFromConfig,
} from "./repo.mjs";
import { tmpHome } from "./test-utils.mjs";

const CFG = buildConfig({
  tarballPath: "/t.tgz",
  runtimeDir: "/r",
  daemonPort: 8421,
  repos: [{ path: "E:\\work\\sp\\JwikisSkills", alias: "JwikisSkills" }],
});

/** 落配置，可选追加仓库。 */
function seedConfig(t, repos = CFG.repos) {
  const home = tmpHome(t);
  const cfg = buildConfig({ ...CFG, repos });
  const configPath = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  writeConfig(configPath, cfg);
  return { home, configPath, cfg };
}

/** fake fetch 返回指定 status + body。 */
function fakeFetch(status, body) {
  return async () => ({
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => (typeof body === "string" ? {} : body),
  });
}

// ---------- buildCreateBody / buildCreateRequest ----------

test("create 请求体：含 team_id/repo_url/source_type=local/repo_name", () => {
  const body = buildCreateBody(CFG, "/work/myrepo", "myrepo");
  assert.equal(body.team_id, "local");
  assert.equal(body.repo_url, "/work/myrepo");
  assert.equal(body.source_type, "local");
  assert.equal(body.repo_name, "myrepo");
});

test("create 请求：URL 含 /v3/code-graph/create，header 含 service-id", () => {
  const req = buildCreateRequest(CFG, "/work/myrepo", "myrepo");
  assert.match(req.url, /http:\/\/127\.0\.0\.1:8421\/v3\/code-graph\/create/);
  assert.equal(req.headers["x-tdai-service-id"], "local");
  assert.equal(req.method, "POST");
  assert.ok(req.body.includes('"source_type":"local"'));
});


// ---------- ensureCodegraphIgnored ----------

test("gitignore：无 .gitignore 则创建并追加 .codegraph/", (t) => {
  const home = tmpHome(t);
  const r = ensureCodegraphIgnored(home);
  assert.equal(r.ok, true);
  assert.equal(r.added, true);
  assert.match(
    fs.readFileSync(path.join(home, ".gitignore"), "utf8"),
    /\.codegraph\//,
  );
});

test("gitignore：已有 .codegraph/ 不重复追加", (t) => {
  const home = tmpHome(t);
  fs.writeFileSync(path.join(home, ".gitignore"), ".codegraph/\n");
  const r = ensureCodegraphIgnored(home);
  assert.equal(r.added, false);
  assert.equal(
    fs.readFileSync(path.join(home, ".gitignore"), "utf8"),
    ".codegraph/\n",
  );
});

test("gitignore：有 .gitignore 但无 .codegraph/ 则追加", (t) => {
  const home = tmpHome(t);
  fs.writeFileSync(path.join(home, ".gitignore"), "node_modules/\n");
  const r = ensureCodegraphIgnored(home);
  assert.equal(r.added, true);
  const content = fs.readFileSync(path.join(home, ".gitignore"), "utf8");
  assert.match(content, /node_modules\//);
  assert.match(content, /\.codegraph\//);
});

// ---------- addRepoToConfig / removeRepoFromConfig ----------

test("config 追加：新仓库写入 repos", (t) => {
  const { configPath } = seedConfig(t);
  const r = addRepoToConfig(configPath, "/work/newrepo", "newrepo");
  assert.equal(r.ok, true);
  assert.equal(r.skipped, false);
  assert.equal(r.config.repos.length, 2);
  assert.equal(r.config.repos[1].alias, "newrepo");
});

test("config 追加：path 或 alias 重复则跳过", (t) => {
  const { configPath } = seedConfig(t);
  const r = addRepoToConfig(
    configPath,
    "E:\\work\\sp\\JwikisSkills",
    "JwikisSkills",
  );
  assert.equal(r.skipped, true);
  assert.equal(r.config.repos.length, 1);
});

test("config 移除：按 alias 匹配并写回", (t) => {
  const { configPath } = seedConfig(t, [
    { path: "/a", alias: "alpha" },
    { path: "/b", alias: "beta" },
  ]);
  const r = removeRepoFromConfig(configPath, "alpha");
  assert.equal(r.ok, true);
  assert.equal(r.config.repos.length, 1);
  assert.equal(r.config.repos[0].alias, "beta");
});

test("config 移除：未找到报错", (t) => {
  const { configPath } = seedConfig(t);
  const r = removeRepoFromConfig(configPath, "nope");
  assert.equal(r.ok, false);
  assert.match(r.error, /未找到/);
});

test("config 移除：拒绝移除最后一个仓库", (t) => {
  const { configPath } = seedConfig(t);
  const r = removeRepoFromConfig(configPath, "JwikisSkills");
  assert.equal(r.ok, false);
  assert.match(r.error, /至少保留主仓库/);
});

// ---------- addRepo ----------

test("add：API 成功 → 追加 config + 保证 gitignore", async (t) => {
  const { home, configPath } = seedConfig(t);
  const newRepo = path.join(home, "newrepo");
  fs.mkdirSync(newRepo, { recursive: true });
  const fetchImpl = fakeFetch(201, {
    code: 0,
    data: { code_graph_id: "cg-new12345" },
  });
  const r = await addRepo({
    configPath,
    repoPath: newRepo,
    alias: "newrepo",
    fetchImpl,
  });
  assert.equal(r.ok, true);
  assert.equal(r.codeGraphId, "cg-new12345");
  assert.equal(r.gitignoreAdded, true);
});

test("add：API 404 守护不可达 → 报错指引先 start", async (t) => {
  const { home, configPath } = seedConfig(t);
  const fetchImpl = async () => {
    throw new Error("ECONNREFUSED");
  };
  const r = await addRepo({
    configPath,
    repoPath: "/x",
    alias: "x",
    fetchImpl,
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /守护不可达/);
});

test("add：API 返回非 2xx → 透传错误文案", async (t) => {
  const { configPath } = seedConfig(t);
  const fetchImpl = fakeFetch(400, {
    code: 400,
    message: "unsupported source_type",
  });
  const r = await addRepo({
    configPath,
    repoPath: "/x",
    alias: "x",
    fetchImpl,
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /HTTP 400/);
});

test("add：非法 alias（含 shell 元字符）被拒", async (t) => {
  const { configPath } = seedConfig(t);
  const r = await addRepo({
    configPath,
    repoPath: "/x",
    alias: "x; rm -rf /",
    fetchImpl: fakeFetch(201, {}),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /非法仓库名/);
});

// ---------- removeRepo ----------

test("remove：从 config 移除", async (t) => {
  const { configPath } = seedConfig(t, [
    { path: "/a", alias: "alpha" },
    { path: "/b", alias: "beta" },
  ]);
  const r = removeRepo({ configPath, key: "alpha" });
  assert.equal(r.ok, true);
});

// ---------- listRepos ----------

test("list：返回 config.repos", (t) => {
  const { configPath } = seedConfig(t, [{ path: "/a", alias: "alpha" }]);
  const r = listRepos({ configPath });
  assert.equal(r.ok, true);
  assert.equal(r.repos.length, 1);
  assert.equal(r.repos[0].alias, "alpha");
});
