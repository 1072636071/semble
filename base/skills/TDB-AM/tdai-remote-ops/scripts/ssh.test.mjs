/** 工单 04 测试：tdai-remote-ops SSH 容器管理（命令构建 / ssh 执行器 / CLI 编排）。node --test 运行。 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildOpsConfig } from "./setup-credentials.mjs";
import { buildRemoteCommand, buildSshArgs, runSsh } from "./ssh.mjs";

const CFG = buildOpsConfig({
  host: "123.206.125.149",
  user: "root",
  keyPath: "/k.pem",
  deployDir: "/root/tdai-memory",
  ports: { core: 8420, panel: 8125, knowledge: 8424, proxy: 8096, clickhouse: 8123 },
});

// ---------- buildSshArgs ----------

test("ssh 参数：含 -i 密钥、BatchMode、StrictHostKeyChecking=no 与 user@host", () => {
  assert.deepEqual(buildSshArgs(CFG), [
    "-i", "/k.pem",
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    "root@123.206.125.149",
  ]);
});

// ---------- buildRemoteCommand ----------

test("远程命令：ps 为 docker ps -a", () => {
  assert.equal(buildRemoteCommand("ps"), "docker ps -a");
});

test("远程命令：全栈 restart/stop/start 覆盖四容器，单容器只操作指定容器", () => {
  assert.equal(buildRemoteCommand("restart"), "docker restart tdai-memory-core tdai-memory-hub tdai-proxy tdai-clickhouse");
  assert.equal(buildRemoteCommand("stop", { container: "tdai-proxy" }), "docker stop tdai-proxy");
  assert.equal(buildRemoteCommand("start", { container: "tdai-clickhouse" }), "docker start tdai-clickhouse");
});

test("远程命令：logs 全栈循环带容器名头、单容器 tail 200", () => {
  const all = buildRemoteCommand("logs");
  assert.match(all, /tdai-memory-core/);
  assert.match(all, /tdai-proxy/);
  assert.equal(buildRemoteCommand("logs", { container: "tdai-memory-core" }), "docker logs --tail 200 tdai-memory-core");
});

test("远程命令：未知动作抛错", () => {
  assert.throws(() => buildRemoteCommand("bogus"), /未知容器动作/);
});

test("远程命令：非法容器名（含注入字符）被拒", () => {
  assert.throws(() => buildRemoteCommand("logs", { container: "x; rm -rf /" }), /非法容器名/);
  assert.throws(() => buildRemoteCommand("stop", { container: "a$(id)" }), /非法容器名/);
  assert.doesNotThrow(() => buildRemoteCommand("start", { container: "tdai-proxy" }));
});

// ---------- runSsh ----------

test("ssh 执行：注入 spawn，命令参数含 ssh 选项 + 远程命令，返回 stdout/status", () => {
  const captured = {};
  const fakeSpawn = (cmd, args, opts) => {
    captured.cmd = cmd;
    captured.args = args;
    captured.opts = opts;
    return { status: 0, stdout: "CONTAINER...\n", stderr: "" };
  };
  const r = runSsh(CFG, "docker ps -a", { spawnImpl: fakeSpawn });
  assert.equal(captured.cmd, "ssh");
  assert.deepEqual(captured.args.slice(0, 7), buildSshArgs(CFG));
  assert.equal(captured.args[7], "docker ps -a");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "CONTAINER...\n");
});

test("ssh 执行：非零退出原样透传 stderr，供调用方判断", () => {
  const fakeSpawn = () => ({ status: 1, stdout: "", stderr: "Permission denied" });
  const r = runSsh(CFG, "docker restart x", { spawnImpl: fakeSpawn });
  assert.equal(r.status, 1);
  assert.equal(r.stderr, "Permission denied");
});
