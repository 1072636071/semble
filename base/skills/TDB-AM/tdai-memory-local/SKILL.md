---
name: tdai-memory-local
description: 本地守护记忆面（离线兜底）—— 开工前回忆、多项目 .agents/memory 检索、本地技能目录索引、离线 capture 暂存队列、服务端技能只读镜像。当远端记忆服务不可达、需要离线检索项目记忆、要找本机技能目录里的技能、或要把内容暂存待回连补传时使用。工具：memory_search / skill_search / memory_capture / memory_sync / skill_mirror。
version: 0.1.0
---

## 目的与适用

本地守护记忆面（ADR-0065 三层架构的第三层：**离线兜底**）。远端记忆服务不可达时，它保证「agent 面对重复问题自己找经验解决」这条北极星判据**不因断网失效**。

**本 skill 是薄 wrapper**（MCP 披露原则）：只写「何时用、怎么调」，**不内嵌任何脚本**。
实现本体在 TencentDB-Agent-Memory 仓库 `tools/memory-mcp.mjs`（零依赖 stdio MCP server），
注册/拉起脚本在 `tdai-codegraph-local/scripts/memory-mcp.mjs`——本目录**不复制、不维护第二份**。

**本面只读。** 五个工具里没有一个是写服务端技能或写远端记忆的写入口 ——
`memory_capture` 只是**入本地暂存队列**（或转发 `conversation/add`），`skill_mirror` 只读服务端镜像。
**写技能 / 删技能 / 改技能一律走 `memory-admin` CLI**（`memory-admin skill create|update|patch|delete`），
本面没有、也不打算有这些能力。完整双写回路归口工单 12。

---

## 何时用

| 场景 | 用哪个工具 |
| --- | --- |
| **开工前回忆**——接手项目 / 要动与已有结论相关的代码，先找历史上下文 | `memory_search` |
| 想知道某件事之前做过没有、踩过什么坑（多项目一起找） | `memory_search` |
| 找个技能：本机技能目录里有没有能用的 | `skill_search` |
| **离线**：远端不可达，先把要记的东西存下来别丢 | `memory_capture`（入队） |
| **回连后**：把攒下的队列补传上去 | `memory_sync` |
| 看服务端技能镜像新不新、要不要刷新、导出备份 | `skill_mirror` |

触发顺序（ADR-0065「自觉召回约束」）：
**远端可达 → `memory_recall` / `skill_search`（只读 MCP 面）→ 远端不可达 → 本面（本地守护）→ 本面也不可达 → 直接读 `.agents/memory/` 文件**。

---

## 怎么调

五个工具，参数如下（MCP 工具调用，不是 bash）：

### `memory_search` — 多项目记忆检索

```json
{ "query": "PG 迁移", "limit": 20 }
```

返回**项目 / 文件 / 行号**，子串匹配、大小写不敏感。扫的是各仓库根的 `.agents/memory/`（`MEMORY.md` 索引 + `YYYY-MM-DD.md` 日志 + `<topic>.md` 专题）。

### `skill_search` — 本地技能目录索引

```json
{ "query": "code review", "limit": 20 }
```

`query` **留空列全部**。本地技能目录命中优先；本地缺失时**补服务端镜像条目**（镜像陈旧则先对账一次，再读）。

### `memory_capture` — 暂存（离线可用）

```json
{ "text": "改用 PG 后 FTS 要抽成纯函数", "role": "user" }
```

或完整消息数组（与 `conversation/add` 同形）：

```json
{ "messages": [{ "role": "user", "content": "…", "timestamp": "2026-09-15T09:00:00Z" }],
  "session_id": "sess-1" }
```

`session_id` 缺省按当天生成（`local-YYYY-MM-DD`）。
**远端可达** → 直接 `conversation/add`，回 `{ sent: true }`；**不可达** → 入本地队列，回 `{ queued: true, id }`；
**服务端拒收（HTTP 非 2xx）** → 同样入队，并回传 `error` 字段（区分离线与拒收，不静默吞掉）。

### `memory_sync` — 回连补传

```json
{}
```

按序补传队列，成功一条移除一条，**遇失败即停**并回报剩余条数。需要远端，离线时明确回报不可达。

### `skill_mirror` — 服务端技能只读镜像

```json
{ "action": "status" }
```

`action` ∈ `status`（默认，看镜像新旧）/ `refresh`（强制回源刷新）/ `export`（导出，需 `output` 路径）。

---

## 与其它面的分工

| 动作 | 走哪条通道 |
| --- | --- |
| 查**远端**记忆 / 技能 / 知识 / wiki / code-graph（只读） | **`memory-gateway`** 只读 MCP 门面 |
| 查**本地**记忆 / 本机技能目录（离线兜底） | **本面 `tdai-memory-local`** |
| 写入（对话上传 / 精华直落 / 技能增删改） | **`memory-admin` CLI**（`sk-mem-` user_key） |
| 任务执行（偏差验证 / 演化评估） | **`memory-admin` CLI**（`task` 子命令） |

判定口诀：**「查远端 → memory-gateway；查本地 / 离线 → tdai-memory-local；写 / 管 → memory-admin CLI」**。

三者不是替代关系：`memory-gateway` 在**线**时给全局视图，本面在**离线**时给本地视图，写面永远是 `memory-admin`。

---

## 凭据与离线降级

复用 `memory-admin` / `memory-gateway` 的**同一份**统一凭据 `mcp-gateway-credentials.json`
（坚果云同步根探测，或用 `--credentials <file>` / `TDAI_MEMORY_MCP_CREDENTIALS` 指定）。

**凭据缺失不是故障。** 此时本面降级为纯本地能力：`memory_search` / `skill_search` / `skill_mirror`（读本地镜像）照常工作，
`memory_capture` 只入队不出队，`memory_sync` 明确回报不可达。那正是本层存在的理由。

状态目录 `~/.tdai/memory-mcp/`（队列 `capture-queue.jsonl`、镜像 `skills-mirror.json`），
与守护进程的 `~/.tdai/state/` 平级、不混用。

---

## 怎么挂（一次性）

脚本在**隔壁** `tdai-codegraph-local/scripts/`，不在本目录：

```bash
export TDAI_MEMORY_MCP_ENTRY=E:/work/sp/TencentDB-Agent-Memory/tools/memory-mcp.mjs

node ../../tdai-codegraph-local/scripts/memory-mcp.mjs show       # 先看将写入什么
node ../../tdai-codegraph-local/scripts/memory-mcp.mjs register   # 注册到用户级 MCP 配置（幂等合并）
node ../../tdai-codegraph-local/scripts/memory-mcp.mjs start      # 需要时前台拉起
```

注册进 MCP 配置的 server 名就是 `tdai-memory-local`。

---

## 与 `tdai-codegraph-local` 的关系

**同一个本地守护进程形态下的两个 MCP 面**，平级、不互相依赖：

| | `tdai-codegraph` 面 | `tdai-memory-local` 面（本面） |
| --- | --- | --- |
| 干什么 | 代码索引 / 语义检索 | 项目记忆 / 技能索引 / 暂存队列 / 技能镜像 |
| 入口 | `scripts/mcp.mjs` | `scripts/memory-mcp.mjs`（注册/拉起），本体 `tools/memory-mcp.mjs` |
| 多仓库 | 读 `tdai-codegraph.json` 的 `config.repos[].path` | **共用同一份清单**（`--root` 同源于此） |
| 状态 | `~/.tdai/state/` | `~/.tdai/memory-mcp/` |

挂载说明见 `../tdai-codegraph-local/references/memory-mcp.md`。

> 注：`tdai-codegraph-local` 目录**没有 SKILL.md**——它是脚本守护目录，不是技能目录。
> 交叉引用落点是它的 `references/memory-mcp.md`（其中「分工：本体不在本目录」一节讲清了三者关系）。

## 域路由表

| 内容 | 参考文件 |
| --- | --- |
| 五件事详解、挂载、凭据、测试 | `../tdai-codegraph-local/references/memory-mcp.md` |
| 记忆规范本体（三件套 / 何时读写） | TencentDB-Agent-Memory `docs/agents/agent-memory.md` |
| 三层架构与离线兜底设计 | TencentDB-Agent-Memory `CONTEXT.md` / ADR-0065 |
| 写入通道（技能增删改） | `tdai-memory-capture` 技能 |

## 验收

- 本体的自动化测试在 TencentDB-Agent-Memory：`npm run test:memory-tools`（117 例，沙盒内，不碰真实 `~/.tdai`）。
- 注册/拉起脚本的测试：`node --test base/skills/TDB-AM/tdai-codegraph-local/scripts/memory-mcp.test.mjs`（12 例）。
- **集成验收（守护自动拉起）未实测**：需在装了 `tdai-codegraph-local` 守护的机器上跑一次
  `node memory-mcp.mjs start`，确认进程起来且 `tools/list` 返回五个工具。
  由仓库所有者（姜老师）在装了守护的机器上执行；本开发环境 `~/.tdai` 不存在、守护未安装。
