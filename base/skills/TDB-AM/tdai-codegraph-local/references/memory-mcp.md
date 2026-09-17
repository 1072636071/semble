# 记忆面 MCP（ADR-0065 · 工单 09）

> 与 `mcp.mjs`（code-graph 面）**平级**，是同一个本地守护进程形态下的**第二个 MCP 入口**。
> 本文只讲「怎么挂」；记忆规范本身见 TencentDB-Agent-Memory 仓库的 `docs/agents/agent-memory.md`。

## 分工：本体不在本目录

| 位置 | 承担什么 |
|---|---|
| `TencentDB-Agent-Memory/tools/memory-mcp.mjs` | **本体**：零依赖 stdio MCP server，实现五件事（扫描检索 / 技能索引 / 离线队列 / 回连同步 / 服务端技能镜像） |
| 本目录 `scripts/memory-mcp.mjs` | **注册 / 注销 / 拉起**：只把本体写成一条用户级 MCP 配置，不重复维护脚本（MCP 披露原则） |
| `tdai-memory-local` 技能（工单 10） | 薄 wrapper：告诉 agent 何时用、怎么调 |

## 五件事

| 工具 | 能力 | 离线可用 |
|---|---|---|
| `memory_search` | 多项目 `.agents/memory/` 子串检索（返回项目 / 文件 / 行号） | ✅ |
| `skill_search` | 本地技能目录索引；本地缺失时补服务端镜像条目 | ✅ |
| `memory_capture` | 远端可达 → `conversation/add`；不可达 → 入本地暂存队列 | ✅（入队） |
| `memory_sync` | 按序补传队列，成功一条移除一条，遇失败即停 | ❌（需远端） |
| `skill_mirror` | 服务端技能只读镜像，`status` / `refresh` / `export` | ✅（读本地镜像） |

## 怎么挂

```bash
# 1) 指向本体（缺省按仓库内约定路径找，找不到时用它）
export TDAI_MEMORY_MCP_ENTRY=E:/work/sp/TencentDB-Agent-Memory/tools/memory-mcp.mjs

# 2) 先看将写入什么（不落盘）
node memory-mcp.mjs show

# 3) 注册到用户级 MCP 配置（幂等合并，不破坏其他 server）
node memory-mcp.mjs register

# 4) 需要时拉起（一般交给 harness 自行 spawn）
node memory-mcp.mjs start
```

**多仓库**：`--root` 直接取 `tdai-codegraph.json` 的 `config.repos[].path`，
与 code-graph 面共用同一份仓库清单 ⇒ 「单守护多仓库」在记忆面同样成立；读不到配置时回退当前目录。

**状态目录**：`~/.tdai/memory-mcp/`（队列 `capture-queue.jsonl`、镜像 `skills-mirror.json`），
与守护进程的 `~/.tdai/state/` 平级、不混用。

## 凭据

复用 `memory-admin` / `memory-gateway` 的**同一份**统一凭据 `mcp-gateway-credentials.json`
（坚果云同步根探测，或用 `--credentials <file>` / `TDAI_MEMORY_MCP_CREDENTIALS` 指定）。
**凭据缺失不是故障**：记忆面降级为纯本地能力，队列只入不出，`memory_sync` 明确回报不可达。

## 测试

```bash
node --test base/skills/TDB-AM/tdai-codegraph-local/scripts/memory-mcp.test.mjs
```

12 例，全部跑在 `os.tmpdir()` 沙盒，不触碰真实 `~/.tdai/` 与用户级 MCP 配置。
本体的测试在 TencentDB-Agent-Memory 仓库：`npm run test:memory-tools`。
