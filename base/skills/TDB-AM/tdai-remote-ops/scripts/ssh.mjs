#!/usr/bin/env node
/**
 * tdai-remote-ops SSH 执行器与容器命令构建（PRD .scratch/04-tdai-skill-suite/ 工单 04）。
 *
 * 基于 tdai-ops.json 用本机系统 OpenSSH（ssh.exe）执行远端命令。SSH 私钥以文件路径
 * 引用（-i），BatchMode=yes 免交互。命令构建为纯函数（可测），执行经 spawn 注入（可 mock）。
 * 零依赖，Node >= 20（node --test 可测）。
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** TDAI 栈容器清单（配置说明.md 三件套端口表）。 */
export const TDAI_CONTAINERS = ["tdai-memory-core", "tdai-memory-hub", "tdai-proxy", "tdai-clickhouse"];

/** 构建 ssh.exe 参数（纯函数）。 */
export function buildSshArgs(config) {
  return [
    "-i", config.ssh.keyPath,
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    `${config.ssh.user}@${config.ssh.host}`,
  ];
}

/** 容器名白名单（防注入：仅允许 docker 合法名）。 */
const CONTAINER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/**
 * 构建远端容器命令（纯函数）。
 * @param {"ps"|"logs"|"restart"|"stop"|"start"} action
 * @param {{container?:string}} opts 单容器；缺省 = 全栈四容器
 * @returns {string}
 */
export function buildRemoteCommand(action, { container } = {}) {
  if (container !== undefined && !CONTAINER_NAME_RE.test(container)) {
    throw new Error(`非法容器名: ${container}（仅允许字母数字与 ._-）`);
  }
  const all = TDAI_CONTAINERS.join(" ");
  switch (action) {
    case "ps":
      return "docker ps -a";
    case "logs":
      if (container) return `docker logs --tail 200 ${container}`;
      return TDAI_CONTAINERS.map((c) => `echo "=== ${c} ==="; docker logs --tail 50 ${c}`).join("; ");
    case "restart":
      return `docker restart ${container || all}`;
    case "stop":
      return `docker stop ${container || all}`;
    case "start":
      return `docker start ${container || all}`;
    default:
      throw new Error(`未知容器动作: ${action}`);
  }
}

/**
 * 执行 SSH（spawn 可注入以便测试）。
 * @returns {{status:number|null, stdout:string, stderr:string}}
 */
export function runSsh(config, remoteCommand, { spawnImpl = spawnSync, args = null } = {}) {
  const sshArgs = args ?? [...buildSshArgs(config), remoteCommand];
  // 不用 shell:true——ssh.exe 直接收参数组，避免 cmd.exe 对复合命令（含 ; 与引号）的拆解破坏
  const res = spawnImpl("ssh", sshArgs, { encoding: "utf8" });
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}
