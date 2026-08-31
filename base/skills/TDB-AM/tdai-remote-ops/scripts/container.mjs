#!/usr/bin/env node
/**
 * tdai-remote-ops 容器管理 CLI（PRD .scratch/04-tdai-skill-suite/ 工单 04）。
 *
 * 用法：node container.mjs <ps|logs|restart|stop|start> [container]
 *   缺省 container = 全栈四容器（tdai-memory-core/hub/proxy/clickhouse）。
 * 读 tdai-ops.json 连接远端执行 docker 操作；SSH 私钥路径来自配置，密钥值不入文件。
 * 零依赖，Node >= 20。
 */
import path from "node:path";
import os from "node:os";
import { describeErrors, isMainModule } from "./helpers.mjs";
import { readOpsConfig, CONFIG_FILENAME } from "./setup-credentials.mjs";
import { buildRemoteCommand, runSsh } from "./ssh.mjs";

/** 执行容器动作（spawnImpl 可注入以便测试）。 */
export async function runContainer({ configPath, action, container, spawnImpl }) {
  const { ok, config, errors } = readOpsConfig(configPath);
  if (!ok) return { ok: false, error: describeErrors(errors) };
  let cmd;
  try {
    cmd = buildRemoteCommand(action, { container });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const r = runSsh(config, cmd, { spawnImpl });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const [action, container] = process.argv.slice(2);
  if (!action) {
    console.error("用法: node container.mjs <ps|logs|restart|stop|start> [container]");
    process.exitCode = 2;
  } else {
    const configPath = path.join(os.homedir(), ".tdai", "config", CONFIG_FILENAME);
    runContainer({ configPath, action, container })
      .then((r) => {
        if (!r.ok) {
          console.error(r.stderr || r.error || "容器操作失败");
          process.exitCode = 1;
          return;
        }
        process.stdout.write(r.stdout);
      })
      .catch((err) => {
        console.error(`容器操作异常：${err.message}`);
        process.exitCode = 1;
      });
  }
}
