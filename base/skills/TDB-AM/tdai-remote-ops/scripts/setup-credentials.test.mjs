/** 工单 02 测试：tdai-remote-ops 配置向导（探测/解析/校验/读写/交互）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CONFIG_FILENAME,
  buildOpsConfig,
  findTdaiSecretsDir,
  parseServerInfo,
  readOpsConfig,
  runWizard,
  validateOpsConfig,
  writeOpsConfig,
} from "./setup-credentials.mjs";
import { tmpHome } from "./test-utils.mjs";

/** 基于真实 配置说明.md 结构的最小夹具。 */
const SERVER_MD = `# TencentDB-Agent-Memory 部署机密配置说明

## 服务器信息

| 项 | 值 |
|---|---|
| 服务器 IP | \`123.206.125.149\` |
| 系统 | OpenCloudOS 9.2（腾讯云 VM，内存 3.5G） |
| 部署目录 | \`/root/tdai-memory/\` |
| SSH 密钥 | \`D:\\work\\space\\xiangs-blog\\.deploy-tmp\\jiang1.pem\`（本目录同名 \`jiang1.pem\` 为同一把） |

## 三件套端口

| 组件 | 容器 | 端口 |
|---|---|---|
| memory-core | \`tdai-memory-core\` | 8420 |
| memory-hub (Panel) | \`tdai-memory-hub\` | 8125 |
| knowledge | \`tdai-memory-hub\` | 8424 |
| memory-proxy | \`tdai-proxy\` | 8096 |
| clickhouse | \`tdai-clickhouse\` | 8123（仅容器网络内，无公网映射） |
`;

const PANEL_CREDS = {
  panel_url: "http://123.206.125.149:8125/api/v1",
  service_id: "default",
  user_key: "sk-mem-abcdef1234567890",
};

/** 在临时 home 下搭出真实 Nutstore 布局：root/项目机密/TencentDB-Agent-Memory/ + root/项目机密/jiang1.pem */
function seedNutstore(home) {
  const root = path.join(home, "Nutstore", "1", "我的坚果云");
  const secrets = path.join(root, "项目机密", "TencentDB-Agent-Memory");
  fs.mkdirSync(secrets, { recursive: true });
  fs.writeFileSync(path.join(secrets, "配置说明.md"), SERVER_MD);
  fs.writeFileSync(path.join(secrets, "panel-admin-credentials.json"), JSON.stringify(PANEL_CREDS));
  fs.writeFileSync(path.join(root, "项目机密", "jiang1.pem"), "-----BEGIN PRIVATE KEY-----");
  return { root, secrets, keyPath: path.join(root, "项目机密", "jiang1.pem") };
}

const msgs = (verdict) => verdict.errors.map((e) => e.message).join(";");

// ---------- parseServerInfo ----------

test("解析：从配置说明.md 提取 host/部署目录/SSH 密钥提示/端口表", () => {
  const info = parseServerInfo(SERVER_MD);
  assert.equal(info.host, "123.206.125.149");
  assert.equal(info.deployDir, "/root/tdai-memory/");
  assert.match(info.sshKeyHint, /jiang1\.pem/);
  assert.deepEqual(info.ports, { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 });
});

test("解析：非表格/缺行时字段为 undefined 而非抛错", () => {
  const info = parseServerInfo("# 空文档\n没有表格");
  assert.equal(info.host, undefined);
  assert.deepEqual(info.ports, {});
});

// ---------- buildOpsConfig / validate ----------

test("构建：secretsDir 存在时生成 secrets 路径映射", () => {
  const cfg = buildOpsConfig({ host: "1.2.3.4", user: "root", keyPath: "/k.pem", deployDir: "/d", ports: { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 }, secretsDir: "/s" });
  assert.equal(cfg.ssh.keyPath, "/k.pem");
  assert.equal(cfg.secrets.envPath, path.join("/s", "server.env"));
  assert.equal(cfg.secrets.cnbSecretsFile, null);
});

test("校验：合法配置通过", () => {
  const cfg = buildOpsConfig({ host: "1.2.3.4", user: "root", keyPath: "/k.pem", deployDir: "/d", ports: { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 } });
  assert.equal(validateOpsConfig(cfg).ok, true);
});

test("校验：缺 ssh.host / 非正整数端口 均结构化报错", () => {
  const v1 = validateOpsConfig({ ssh: {}, deployDir: "/d", ports: { core: 0, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 } });
  assert.equal(v1.ok, false);
  assert.ok(v1.errors.some((e) => e.field === "ssh.host"));
  assert.ok(v1.errors.some((e) => e.field === "ports.core"));
});

// ---------- 读写幂等 ----------

test("读写：write 后 read 等价（幂等）", (t) => {
  const home = tmpHome(t);
  const cfg = buildOpsConfig({ host: "1.2.3.4", user: "root", keyPath: "/k.pem", deployDir: "/d", ports: { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 } });
  const target = path.join(home, CONFIG_FILENAME);
  writeOpsConfig(target, cfg);
  assert.deepEqual(readOpsConfig(target).config, cfg);
});

// ---------- 探测 ----------

test("探测：命中 <root>/项目机密/TencentDB-Agent-Memory", (t) => {
  const home = tmpHome(t);
  const { secrets } = seedNutstore(home);
  assert.equal(findTdaiSecretsDir(home), secrets);
});

// ---------- 向导 ----------

function fakeIo(home, answers) {
  const queue = [...answers];
  const logs = [];
  return {
    io: {
      log: (m) => logs.push(m),
      ask: async () => queue.shift() ?? "",
      homeDir: home,
    },
    logs,
  };
}

test("向导：探测命中 → 自动构建配置落盘 ~/.tdai/config/tdai-ops.json，密钥路径取 root/项目机密/jiang1.pem", async (t) => {
  const home = tmpHome(t);
  const { keyPath } = seedNutstore(home);
  const { io, logs } = fakeIo(home, []);
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  const target = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  assert.equal(r.configPath, target);
  const cfg = JSON.parse(fs.readFileSync(target, "utf8"));
  assert.equal(cfg.ssh.host, "123.206.125.149");
  assert.equal(cfg.ssh.keyPath, keyPath);
  assert.equal(cfg.deployDir, "/root/tdai-memory/");
  assert.deepEqual(cfg.ports, { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 });
  assert.ok(logs.some((l) => l.includes("自动构建")), "应有自动构建日志");
  assert.equal(logs.some((l) => l.includes("sk-mem-abcdef")), false, "user_key 不得明文回显");
});

test("向导：探测命中但缺 keyPath（无 pem）→ 手填密钥路径", async (t) => {
  const home = tmpHome(t);
  const { secrets } = seedNutstore(home);
  fs.rmSync(path.join(home, "Nutstore", "1", "我的坚果云", "项目机密", "jiang1.pem"));
  const manualKey = path.join(home, "keys", "j.pem");
  const { io } = fakeIo(home, [manualKey]);
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  const cfg = JSON.parse(fs.readFileSync(r.configPath, "utf8"));
  assert.equal(cfg.ssh.keyPath, manualKey);
  assert.equal(cfg.ssh.host, "123.206.125.149");
});

test("向导：探测失败（无坚果云目录）→ 手填全字段落盘", async (t) => {
  const home = tmpHome(t);
  const { io } = fakeIo(home, ["9.9.9.9", "root", "/tmp/k.pem", "/opt/tdai", "8420", "8125", "8424", "8096", "8123"]);
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  const cfg = JSON.parse(fs.readFileSync(r.configPath, "utf8"));
  assert.equal(cfg.ssh.host, "9.9.9.9");
  assert.deepEqual(cfg.ports, { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 });
});

test("向导：目标已有合法配置 → 零输入复用，不重建不改写", async (t) => {
  const home = tmpHome(t);
  const target = path.join(home, ".tdai", "config", CONFIG_FILENAME);
  const pre = buildOpsConfig({ host: "9.9.9.9", user: "root", keyPath: "/k.pem", deployDir: "/d", ports: { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 } });
  writeOpsConfig(target, pre);
  const before = fs.readFileSync(target, "utf8");
  const { io, logs } = fakeIo(home, []);
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  assert.equal(r.configPath, target);
  assert.equal(fs.readFileSync(target, "utf8"), before, "不得改写既有配置");
  assert.equal(logs.some((l) => l.includes("复用既有配置")), true);
});

test("向导：secretsRoot 显式覆盖 → 用非坚果云布局位置的机密目录自动构建", async (t) => {
  const home = tmpHome(t);
  const secrets = path.join(home, "项目机密", "TencentDB-Agent-Memory"); // 不在坚果云目录下，探测不到
  fs.mkdirSync(secrets, { recursive: true });
  fs.writeFileSync(path.join(secrets, "配置说明.md"), SERVER_MD);
  const keyPath = path.join(home, "项目机密", "jiang1.pem");
  fs.writeFileSync(keyPath, "KEY");
  const { io } = fakeIo(home, []);
  const r = await runWizard({ ...io, secretsRoot: secrets });
  assert.equal(r.ok, true);
  const cfg = JSON.parse(fs.readFileSync(r.configPath, "utf8"));
  assert.equal(cfg.ssh.host, "123.206.125.149");
  assert.equal(cfg.ssh.keyPath, keyPath);
});

test("向导：自动构建配置不合法（配置说明.md 缺部署目录行）→ 降级手填", async (t) => {
  const home = tmpHome(t);
  const { secrets } = seedNutstore(home);
  const md = SERVER_MD.replace(/\| 部署目录 \|[^\n]*\n/, "");
  fs.writeFileSync(path.join(secrets, "配置说明.md"), md);
  const { io } = fakeIo(home, ["7.7.7.7", "root", "/tmp/k.pem", "/opt/tdai", "8420", "8125", "8424", "8096", "8123"]);
  const r = await runWizard(io);
  assert.equal(r.ok, true);
  const cfg = JSON.parse(fs.readFileSync(r.configPath, "utf8"));
  assert.equal(cfg.ssh.host, "7.7.7.7");
  assert.equal(cfg.deployDir, "/opt/tdai");
});
