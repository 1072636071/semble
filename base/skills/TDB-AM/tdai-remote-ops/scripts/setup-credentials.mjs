#!/usr/bin/env node
/**
 * tdai-remote-ops 配置向导（PRD .scratch/04-tdai-skill-suite/ 工单 02）。
 *
 * 收集 SSH 连接参数 + 部署目录 + 端口表 + 机密文件路径，落盘为 `tdai-ops.json`
 * （机器可读、供运维脚本读取）。供给三级优先级：
 *   ① 复用既有：目标 `~/.tdai/config/tdai-ops.json` 已存在且合法 → 零输入复用（幂等），
 *      要重填请删除该文件后重跑；
 *   ② 探测：无既有配置时，运行时探测用户主目录下坚果云同步根，定位权威机密目录
 *      <根>/项目机密/TencentDB-Agent-Memory/，读 配置说明.md（服务器/端口）+
 *      panel-admin-credentials.json（Panel 地址），自动构建配置；机密根可经
 *      `--secrets-root <dir>` 或环境变量 `TDAI_SECRETS_ROOT` 显式覆盖（坚果云路径可能变动）；
 *   ③ 手填：探测缺失或字段不全时交互手填（含密钥路径缺失时）。
 *
 * 密钥纪律：tdai-ops.json 只存连接参数与机密文件的**路径**，不存任何密钥明文
 * （SSH 私钥/admin key/user_key 值）。私钥以文件路径引用（如 root/项目机密/jiang1.pem）；
 * 其余密钥值在运行时按需从机密文件读取，绝不落盘/回显。
 * 坚果云路径因用户名而异且可能变动——绝不硬编码，全部探测/可覆盖。
 * 零依赖，Node >= 20（node --test 可测）。
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import os from "node:os";
import { describeErrors, isMainModule } from "./helpers.mjs";

export const CONFIG_FILENAME = "tdai-ops.json";
const SECRETS_DIRPARTS = ["项目机密", "TencentDB-Agent-Memory"];
const SERVER_MD = "配置说明.md";
const PANEL_CREDS = "panel-admin-credentials.json";
const SSH_KEY_NAME = "jiang1.pem";
export const REQUIRED_SSH_FIELDS = ["ssh.host", "ssh.user", "ssh.keyPath", "deployDir"];
export const PORT_FIELDS = ["core", "panel", "knowledge", "proxy", "clickhouse"];
const SCAN_MAX_DEPTH = 3;
const SCAN_SKIP = new Set(["node_modules", ".git", ".svn", "$RECYCLE.BIN", "System Volume Information"]);

// ---------- 探测（纯逻辑，fs 可注入） ----------

/** 探测用户主目录下所有坚果云同步根（目录名含「坚果云」），按路径排序。 */
export function findNutstoreRoots(homeDir, fsMod = fs) {
  const results = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fsMod.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || SCAN_SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      let isDir = entry.isDirectory();
      if (!isDir) {
        const st = fsMod.statSync(full, { throwIfNoEntry: false });
        isDir = Boolean(st && st.isDirectory());
      }
      if (!isDir) continue;
      if (entry.name.includes("坚果云")) {
        results.push(full);
        continue;
      }
      if (depth < SCAN_MAX_DEPTH) walk(full, depth + 1);
    }
  };
  walk(homeDir, 1);
  results.sort();
  return results;
}

/** 定位权威机密目录：<坚果云根>/项目机密/TencentDB-Agent-Memory/（存在即命中）。 */
export function findTdaiSecretsDir(homeDir, fsMod = fs) {
  for (const root of findNutstoreRoots(homeDir, fsMod)) {
    const dir = path.join(root, ...SECRETS_DIRPARTS);
    if (fsMod.existsSync(dir)) return dir;
  }
  return null;
}

// ---------- 解析 配置说明.md ----------

/** 组件名 → 端口键 映射（小写匹配）。 */
const PORT_KEYWORDS = {
  "memory-core": "core",
  "memory-hub (panel)": "panel",
  "memory-hub": "panel",
  "knowledge": "knowledge",
  "memory-proxy": "proxy",
  "clickhouse": "clickhouse",
};

/**
 * 从 配置说明.md 文本解析服务器信息。
 * @returns {{host?:string, deployDir?:string, sshKeyHint?:string, ports:Record<string,number>}}
 */
export function parseServerInfo(mdText) {
  let host;
  let deployDir;
  let sshKeyHint;
  const ports = {};
  const stripCell = (s) => s.replace(/`/g, "").trim();
  for (const ln of String(mdText).split(/\r?\n/)) {
    const cells = ln.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const key = cells[0].toLowerCase();
    if (key === "服务器 ip") host = stripCell(cells[1]);
    else if (key === "部署目录") deployDir = stripCell(cells[1]);
    else if (key === "ssh 密钥") sshKeyHint = stripCell(cells[1]).split("（")[0];
    else {
      const portKey = PORT_KEYWORDS[key];
      if (portKey && cells.length >= 3) {
        const m = cells[2].match(/(\d+)/);
        if (m) ports[portKey] = Number.parseInt(m[1], 10);
      }
    }
  }
  return { host, deployDir, sshKeyHint, ports };
}

// ---------- 构建 / 校验 / 读写 ----------

/**
 * 由解析结果构建 tdai-ops.json 对象。机密只存路径不存值。
 * @param {{host?:string, user?:string, keyPath?:string, deployDir?:string,
 *          ports?:Record<string,number>, secretsDir?:string|null,
 *          cnbSecretsFile?:string|null}} p
 */
export function buildOpsConfig({ host, user, keyPath, deployDir, ports = {}, secretsDir = null, cnbSecretsFile = null }) {
  return {
    ssh: {
      host: host ?? "",
      user: user ?? "root",
      keyPath: keyPath ?? "",
    },
    deployDir: deployDir ?? "",
    ports: {
      core: ports.core ?? 8420,
      panel: ports.panel ?? 8125,
      knowledge: ports.knowledge ?? 8424,
      proxy: ports.proxy ?? 8096,
      clickhouse: ports.clickhouse ?? 8123,
    },
    secrets: {
      envPath: secretsDir ? path.join(secretsDir, "server.env") : null,
      adminKeyPath: secretsDir ? path.join(secretsDir, "admin-key.txt") : null,
      gatewayYamlPath: secretsDir ? path.join(secretsDir, "memory-core-gateway.yaml") : null,
      proxyConfigYamlPath: secretsDir ? path.join(secretsDir, "proxy-config.yaml") : null,
      panelCredentialsPath: secretsDir ? path.join(secretsDir, PANEL_CREDS) : null,
      cnbSecretsFile,
    },
  };
}

/** 校验配置对象。返回 { ok, errors:[{field,message}] }。 */
export function validateOpsConfig(cfg) {
  const errors = [];
  if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
    return { ok: false, errors: [{ field: null, message: "配置必须是 JSON 对象" }] };
  }
  const pick = (p) => p.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), cfg);
  for (const field of REQUIRED_SSH_FIELDS) {
    const v = pick(field);
    if (typeof v !== "string" || v.trim() === "") {
      errors.push({ field, message: `缺少必填字段 ${field}（须为非空字符串）` });
    }
  }
  for (const k of PORT_FIELDS) {
    const v = cfg.ports?.[k];
    if (!Number.isInteger(v) || v <= 0) {
      errors.push({ field: `ports.${k}`, message: `ports.${k} 须为正整数` });
    }
  }
  return { ok: errors.length === 0, errors };
}

/** 读取并校验配置。文件不存在/非法/缺字段均给可行动文案。 */
export function readOpsConfig(filePath, fsMod = fs) {
  let raw;
  try {
    raw = fsMod.readFileSync(filePath, "utf8");
  } catch {
    return { ok: false, errors: [{ field: null, message: `文件不存在或不可读: ${filePath}` }] };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, errors: [{ field: null, message: `文件不是合法 JSON: ${filePath}` }] };
  }
  const verdict = validateOpsConfig(parsed);
  return verdict.ok ? { ok: true, config: parsed } : { ...verdict, source: filePath };
}

/** 写配置（pretty JSON，POSIX 收紧 0600）。 */
export function writeOpsConfig(filePath, cfg, fsMod = fs) {
  fsMod.mkdirSync(path.dirname(filePath), { recursive: true });
  fsMod.writeFileSync(filePath, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
  return filePath;
}

// ---------- 向导编排（io 注入以便测试） ----------

/**
 * 向导主流程。io = { log, ask, homeDir, fsMod, secretsRoot }。
 * secretsRoot 显式覆盖机密目录（坚果云路径可能变动；缺省探测）。
 * 三级供给：① 复用既有合法配置（零输入幂等）→ ② 探测坚果云自动构建 → ③ 手填。
 * 返回 { ok, configPath, config }。
 */
export async function runWizard(io) {
  const { log, ask, homeDir = os.homedir(), fsMod = fs, secretsRoot = null } = io;
  const target = path.join(homeDir, ".tdai", "config", CONFIG_FILENAME);

  // ① 复用既有：目标已存在且合法 → 零输入复用（幂等）；重填请删除后重跑。
  const existing = fsMod.existsSync(target) ? readOpsConfig(target, fsMod) : null;
  if (existing?.ok) {
    log(`复用既有配置：${target}（host=${existing.config.ssh.host} key=${existing.config.ssh.keyPath}）`);
    return { ok: true, configPath: target, config: existing.config };
  }
  if (existing && !existing.ok) {
    log(`既有配置不合法（${describeErrors(existing.errors)}）；将重新生成，或删除该文件后重跑。`);
  }

  // ② 探测坚果云（可经 secretsRoot 覆盖）
  const secretsDir = secretsRoot ?? findTdaiSecretsDir(homeDir, fsMod);
  let config;

  if (secretsDir) {
    log(`已定位机密目录：${secretsDir}`);
    const mdPath = path.join(secretsDir, SERVER_MD);
    if (fsMod.existsSync(mdPath)) {
      const info = parseServerInfo(fsMod.readFileSync(mdPath, "utf8"));
      // 机密目录上级 = <根>/项目机密：SSH 私钥在此层（jiang1.pem），cnb 凭据在 <根>/项目机密/Secret/
      const secretsParent = path.dirname(secretsDir);
      const rootKey = path.join(secretsParent, SSH_KEY_NAME);
      let keyPath = fsMod.existsSync(rootKey) ? rootKey : null;
      if (!keyPath && info.sshKeyHint && fsMod.existsSync(info.sshKeyHint)) keyPath = info.sshKeyHint;
      if (!keyPath) {
        keyPath = (await ask(`未找到 SSH 私钥（${rootKey} 不存在），请输入密钥路径：`)).trim();
      }
      config = buildOpsConfig({
        host: info.host,
        user: "root",
        keyPath,
        deployDir: info.deployDir,
        ports: info.ports,
        secretsDir,
        cnbSecretsFile: path.join(secretsParent, "Secret", "我的服务器.md"),
      });
      log("已自动构建配置（配置说明.md + 既有凭据）");
    }
  }

  // ②' 自动构建产物不合法（如 配置说明.md 缺「部署目录」行）→ 降级手填，不中止
  if (config) {
    const autoVerdict = validateOpsConfig(config);
    if (!autoVerdict.ok) {
      log(`自动构建配置不合法（${describeErrors(autoVerdict.errors)}），降级手填。`);
      config = null;
    }
  }

  // ③ 手填
  if (!config) {
    log("未探测到权威机密目录/配置说明.md，进入手填。");
    const host = (await ask("SSH 主机：")).trim();
    const user = (await ask("SSH 用户（回车默认 root）：")).trim() || "root";
    const keyPath = (await ask("SSH 私钥路径：")).trim();
    const deployDir = (await ask("部署目录：")).trim();
    const ports = {};
    for (const k of PORT_FIELDS) {
      ports[k] = Number.parseInt((await ask(`端口 ${k}：`)).trim(), 10);
    }
    config = buildOpsConfig({ host, user, keyPath, deployDir, ports });
  }

  const verdict = validateOpsConfig(config);
  if (!verdict.ok) {
    log(`配置不合法：${describeErrors(verdict.errors)}`);
    return { ok: false, reason: describeErrors(verdict.errors) };
  }

  writeOpsConfig(target, config, fsMod);
  log(`已写入：${target}（含 ssh 密钥路径 ${config.ssh.keyPath}，密钥值不入文件）`);
  return { ok: true, configPath: target, config };
}

// ---------- CLI 入口 ----------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const argIndex = process.argv.indexOf("--secrets-root");
  const secretsRoot = argIndex !== -1
    ? process.argv[argIndex + 1]
    : process.env.TDAI_SECRETS_ROOT || null;
  if (secretsRoot) console.log(`[secrets-root] 覆盖机密目录：${secretsRoot}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  runWizard({ log: (msg) => console.log(msg), ask: (q) => rl.question(q), secretsRoot })
    .then((r) => {
      if (r.ok) console.log(`\n向导完成。配置文件：${r.configPath}`);
      else {
        console.error(`向导未完成：${r.reason}`);
        process.exitCode = 1;
      }
      rl.close();
    })
    .catch((err) => {
      console.error(`向导失败：${err.message}`);
      rl.close();
      process.exitCode = 1;
    });
}
