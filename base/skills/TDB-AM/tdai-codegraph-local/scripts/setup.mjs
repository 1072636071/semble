#!/usr/bin/env node
/**
 * tdai-codegraph-local 配置向导（PRD .scratch/04-tdai-skill-suite/ 工单 07）。
 *
 * 收集守护进程配置（MemoryKnowledge 编译件 tarball 路径、仓库清单、守护端口、
 * 远端兜底 URL、MCP 注册），落盘为 `~/.tdai/config/tdai-codegraph.json`（机器可读、
 * 供 install/daemon/repo/mcp 脚本读取）。供给三级优先级：
 *   ① 复用既有：目标已存在且合法 → 零输入复用（幂等），要重填请删除该文件后重跑；
 *   ② 探测：无既有配置时，用默认值 + 探测技能自带 tarball（../assets/*.tgz）+
 *      试点两仓（E:\work\sp\JwikisSkills + E:\work\sp\TencentDB-Agent-Memory）自动构建；
 *   ③ 手填：探测缺失或字段不全时交互手填。
 *
 * 配置契约（tdai-codegraph.json）：
 *   {
 *     "tarballPath": "...",           // MemoryKnowledge 编译件 tarball 绝对路径
 *     "runtimeDir": "~/.tdai/runtime",// 安装目录（npm install 落点）
 *     "daemonPort": 8421,             // 守护进程端口
 *     "localServiceId": "local",      // 本机 service_id
 *     "localTeamId": "local",         // 本机 team_id
 *     "fallbackBaseUrl": "",          // 远端兜底 URL（KNOWLEDGE_FALLBACK_BASE_URL，含 /v3）
 *     "fallbackServiceId": "",        // 转发身份（默认沿用本机 service_id）
 *     "queryRefreshDebounceMs": 5000, // 查询前刷新防抖窗口
 *     "repos": [                      // 仓库清单（首个=主仓库 auto-register，其余 API 追加）
 *       { "path": "...", "alias": "JwikisSkills" }
 *     ],
 *     "mcp": {                        // 用户级 MCP 注册目标
 *       "vendor": "codebuddy",       // harness 厂商
 *       "configPath": "...",         // MCP 配置文件路径
 *       "serverName": "tdai-codegraph" // MCP server 名
 *     }
 *   }
 *
 * 密钥纪律：本配置不含任何密钥明文（远端兜底 URL 是服务地址非密钥；admin key 由
 * tdai-remote-ops/panel-admin 各自管理）。坚果云路径不在此处探测。
 * 零依赖，Node >= 20（node --test 可测）。
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { describeErrors, isMainModule } from "./helpers.mjs";

export const CONFIG_FILENAME = "tdai-codegraph.json";
export const REQUIRED_FIELDS = ["tarballPath", "runtimeDir", "daemonPort"];
const DEFAULT_PORT = 8421;
const DEFAULT_SERVICE_ID = "local";
const DEFAULT_TEAM_ID = "local";
const DEFAULT_DEBOUNCE_MS = 5000;
const DEFAULT_VENDOR = "codebuddy";
const DEFAULT_SERVER_NAME = "tdai-codegraph";

/** 试点两仓（PRD 决策16）：主仓库首个 = JwikisSkills（auto-register），TencentDB-Agent-Memory 经 API 追加。 */
export const PILOT_REPOS = [
  { path: "E:\\work\\sp\\JwikisSkills", alias: "JwikisSkills" },
  {
    path: "E:\\work\\sp\\TencentDB-Agent-Memory",
    alias: "TencentDB-Agent-Memory",
  },
];

/** 用户级 MCP 配置候选路径（按常见 harness 布局，首个为默认）。 */
export function mcpConfigCandidates(homeDir) {
  return [
    {
      vendor: "codebuddy",
      configPath: path.join(homeDir, ".codebuddy", "mcp.json"),
    },
    {
      vendor: "codearts",
      configPath: path.join(homeDir, ".codeartsdoer", "mcp.json"),
    },
    { vendor: "trae", configPath: path.join(homeDir, ".trae-cn", "mcp.json") },
    {
      vendor: "qoder",
      configPath: path.join(homeDir, ".qoder-cn", "mcp.json"),
    },
  ];
}

/**
 * 探测技能自带 tarball（../assets/memory-knowledge-*.tgz）。
 * @param {string} scriptsDir 本脚本所在目录
 * @returns {string|null} tarball 绝对路径，无则 null
 */
export function findBundledTarball(scriptsDir, fsMod = fs) {
  const assetsDir = path.resolve(scriptsDir, "..", "assets");
  let entries;
  try {
    entries = fsMod.readdirSync(assetsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (e.isFile() && /^memory-knowledge.*\.tgz$/.test(e.name)) {
      return path.join(assetsDir, e.name);
    }
  }
  return null;
}

// ---------- 构建 / 校验 / 读写 ----------

/**
 * 构建配置对象（纯函数）。缺省字段填默认值。
 * @param {object} p 输入字段
 * @returns {object} 规范化后的配置
 */
export function buildConfig({
  tarballPath,
  runtimeDir,
  daemonPort = DEFAULT_PORT,
  localServiceId = DEFAULT_SERVICE_ID,
  localTeamId = DEFAULT_TEAM_ID,
  fallbackBaseUrl = "",
  fallbackServiceId = "",
  queryRefreshDebounceMs = DEFAULT_DEBOUNCE_MS,
  repos = [],
  mcp = null,
} = {}) {
  return {
    tarballPath: tarballPath ?? "",
    runtimeDir: runtimeDir ?? "",
    daemonPort,
    localServiceId,
    localTeamId,
    fallbackBaseUrl,
    fallbackServiceId,
    queryRefreshDebounceMs,
    repos: repos.map((r) => ({
      path: r.path,
      alias: r.alias ?? path.basename(r.path),
    })),
    mcp: mcp ?? {
      vendor: DEFAULT_VENDOR,
      configPath: "",
      serverName: DEFAULT_SERVER_NAME,
    },
  };
}

/** 校验配置对象。返回 { ok, errors:[{field,message}] }。 */
export function validateConfig(cfg) {
  const errors = [];
  if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
    return {
      ok: false,
      errors: [{ field: null, message: "配置必须是 JSON 对象" }],
    };
  }
  if (typeof cfg.tarballPath !== "string" || cfg.tarballPath.trim() === "") {
    errors.push({
      field: "tarballPath",
      message: "缺少必填字段 tarballPath（须为非空字符串）",
    });
  }
  if (typeof cfg.runtimeDir !== "string" || cfg.runtimeDir.trim() === "") {
    errors.push({
      field: "runtimeDir",
      message: "缺少必填字段 runtimeDir（须为非空字符串）",
    });
  }
  if (
    !Number.isInteger(cfg.daemonPort) ||
    cfg.daemonPort <= 0 ||
    cfg.daemonPort > 65535
  ) {
    errors.push({
      field: "daemonPort",
      message: "daemonPort 须为 1-65535 的整数",
    });
  }
  if (!Array.isArray(cfg.repos) || cfg.repos.length === 0) {
    errors.push({
      field: "repos",
      message: "repos 须为非空数组（至少主仓库）",
    });
  } else {
    cfg.repos.forEach((r, i) => {
      if (typeof r.path !== "string" || r.path.trim() === "") {
        errors.push({
          field: `repos[${i}].path`,
          message: `repos[${i}].path 须为非空字符串`,
        });
      }
    });
  }
  return { ok: errors.length === 0, errors };
}

/** 读取并校验配置。文件不存在/非法/缺字段均给可行动文案。 */
export function readConfig(filePath, fsMod = fs) {
  let raw;
  try {
    raw = fsMod.readFileSync(filePath, "utf8");
  } catch {
    return {
      ok: false,
      errors: [{ field: null, message: `文件不存在或不可读: ${filePath}` }],
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      errors: [{ field: null, message: `文件不是合法 JSON: ${filePath}` }],
    };
  }
  const verdict = validateConfig(parsed);
  return verdict.ok
    ? { ok: true, config: parsed }
    : { ...verdict, source: filePath };
}

/** 写配置（pretty JSON，POSIX 收紧 0600）。 */
export function writeConfig(filePath, cfg, fsMod = fs) {
  fsMod.mkdirSync(path.dirname(filePath), { recursive: true });
  fsMod.writeFileSync(filePath, JSON.stringify(cfg, null, 2) + "\n", {
    mode: 0o600,
  });
  return filePath;
}

// ---------- 向导编排（io 注入以便测试） ----------

/**
 * 向导主流程。io = { log, ask, homeDir, fsMod, scriptsDir }。
 * 三级供给：① 复用既有合法配置（零输入幂等）→ ② 探测自动构建 → ③ 手填。
 * 返回 { ok, configPath, config }。
 */
export async function runWizard(io) {
  const {
    log,
    ask,
    homeDir = os.homedir(),
    fsMod = fs,
    scriptsDir = null,
  } = io;
  const target = path.join(homeDir, ".tdai", "config", CONFIG_FILENAME);

  // ① 复用既有：目标已存在且合法 → 零输入复用（幂等）；重填请删除后重跑。
  const existing = fsMod.existsSync(target) ? readConfig(target, fsMod) : null;
  if (existing?.ok) {
    log(
      `复用既有配置：${target}（port=${existing.config.daemonPort} repos=${existing.config.repos.length}）`,
    );
    return { ok: true, configPath: target, config: existing.config };
  }
  if (existing && !existing.ok) {
    log(
      `既有配置不合法（${describeErrors(existing.errors)}）；将重新生成，或删除该文件后重跑。`,
    );
  }

  // ② 探测：默认值 + 技能自带 tarball + 试点两仓 + 首个 MCP 候选
  const tarball = scriptsDir ? findBundledTarball(scriptsDir, fsMod) : null;
  const runtimeDir = path.join(homeDir, ".tdai", "runtime");
  const mcpCandidates = mcpConfigCandidates(homeDir);
  const defaultMcp = mcpCandidates[0];
  let config = buildConfig({
    tarballPath: tarball ?? "",
    runtimeDir,
    repos: PILOT_REPOS,
    mcp: defaultMcp,
  });

  if (tarball) {
    log(`已探测技能自带 tarball：${tarball}`);
    log(
      `已自动构建配置（runtime=${runtimeDir}，试点两仓=${PILOT_REPOS.length}，MCP=${defaultMcp.vendor}）`,
    );
  } else {
    log("未探测到技能自带 tarball（../assets/*.tgz），需手填 tarballPath。");
  }

  // ②' 自动构建产物不合法（如 tarball 缺失）→ 降级手填缺失字段，不中止
  const autoVerdict = validateConfig(config);
  if (!autoVerdict.ok) {
    if (!config.tarballPath) {
      config.tarballPath = (
        await ask("MemoryKnowledge 编译件 tarball 路径：")
      ).trim();
    }
  }

  // ③ 可选覆盖：用户可改端口/兜底/MCP（回车保留默认）
  const portInput = (
    await ask(`守护端口（回车默认 ${config.daemonPort}）：`)
  ).trim();
  if (portInput) {
    const p = Number.parseInt(portInput, 10);
    if (Number.isInteger(p) && p > 0 && p <= 65535) config.daemonPort = p;
    else log(`端口非法（${portInput}），保留默认 ${config.daemonPort}`);
  }
  const fallback = (
    await ask("远端兜底 URL（KNOWLEDGE_FALLBACK_BASE_URL，回车留空=不兜底）：")
  ).trim();
  if (fallback) config.fallbackBaseUrl = fallback;
  const mcpChoice = (
    await ask(
      `MCP 注册厂商（回车默认 ${config.mcp.vendor}，可选 ${mcpCandidates.map((c) => c.vendor).join("/")}）：`,
    )
  ).trim();
  if (mcpChoice) {
    const hit = mcpCandidates.find((c) => c.vendor === mcpChoice);
    if (hit) config.mcp = hit;
    else log(`未知厂商 ${mcpChoice}，保留默认 ${config.mcp.vendor}`);
  }

  const verdict = validateConfig(config);
  if (!verdict.ok) {
    log(`配置不合法：${describeErrors(verdict.errors)}`);
    return { ok: false, reason: describeErrors(verdict.errors) };
  }

  writeConfig(target, config, fsMod);
  log(
    `已写入：${target}（tarball=${config.tarballPath}，repos=${config.repos.length}）`,
  );
  return { ok: true, configPath: target, config };
}

// ---------- CLI 入口 ----------

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  runWizard({
    log: (msg) => console.log(msg),
    ask: (q) => rl.question(q),
    scriptsDir,
  })
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
