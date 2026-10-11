---
name: tdai-memory-local
description: 本地守护记忆面（离线兜底 + 项目记忆统一写入门面）—— 开工前回忆、多项目 .agents/memory 检索、本地技能目录索引、项目记忆落盘与上行 L1、离线 capture 暂存队列、服务端技能只读镜像。当远端记忆服务不可达、需要离线检索项目记忆、要沉淀一条项目经验、要找本机技能目录里的技能、或要把内容暂存待回连补传时使用。工具：memory_search / skill_search / memory_capture / memory_sync / skill_mirror。
version: 0.2.0
---

> 🗄️ **2026-10-02 物理退役（PRD 85 工单 02/08）**：本技能的 MCP 载体已随本地守护形态一并删除——`tools/memory-mcp.mjs`（MCP server 本体）、`tools/lib/memory-register-core.mjs`（注册腿）、`tdai-codegraph-local/scripts/memory-mcp.mjs`（注册/拉起脚本）**均不存在**，`npm run daemon -- register-mcp` 入口也已从本仓 `package.json` 移除。本技能赖以工作的「五个工具 MCP 面」**已无可用实现，勿据此挂载或调用**。
>
> 文档中仍被引用的 `tools/memory-uplink.mjs`（批量上行 CLI）是**现役**工具，不受影响；但它在本文里的语义是「兜底补传」，不是本技能的在线入口。
>
> **现役替代**：记忆读写/召回走**灵枢 `lingshu`**（`server/`）；离线兜底 = **直读 `.agents/memory/` 文件**（`.md` 三件套，见 `docs/agents/agent-memory.md`）；本地守护只剩 **mzg**（代码检索，端口 7999）。详见 `agents/skills/memory-gateway/SKILL.md` 与 AGENTS.md「本地守护」节。

## 目的与适用

本地守护记忆面（ADR-0065 三层架构的第三层：**离线兜底**）。远端记忆服务不可达时，它保证「agent 面对重复问题自己找经验解决」这条北极星判据**不因断网失效**。

**本 skill 是薄 wrapper**（MCP 披露原则）：只写「何时用、怎么调」，**不内嵌任何脚本**。
实现本体在 TencentDB-Agent-Memory 仓库 `tools/memory-mcp.mjs`（零依赖 stdio MCP server），
注册/拉起脚本在 `tdai-codegraph-local/scripts/memory-mcp.mjs`——本目录**不复制、不维护第二份**。

**本面不写服务端技能。** 五个工具里没有技能写入口——`skill_mirror` 只读服务端镜像。
**写技能 / 删技能 / 改技能一律走 `memory-admin` CLI**（`memory-admin skill create|update|patch|delete`），
本面没有、也不打算有这些能力。完整双写回路归口工单 12。

记忆侧自 PRD 57 起是**统一写入门面**（不再是「只入队」）：`memory_capture` 一条 seam 决定落点——
项目本地的经验落 `.agents/memory/` 日志原文，远端可达时**顺带**上行一条 L1（`/v3/atomic/create`），
断网时入队待回连补传。agent 不需要知道落了几处，只有**冲突**才回抛给人/裁决通道。

---

## 何时用

| 场景 | 用哪个工具 |
| --- | --- |
| **开工前回忆**——接手项目 / 要动与已有结论相关的代码，先找历史上下文 | `memory_search` |
| 想知道某件事之前做过没有、踩过什么坑（多项目一起找） | `memory_search` |
| 找个技能：本机技能目录里有没有能用的 | `skill_search` |
| **离线**：远端不可达，先把要记的东西存下来别丢 | `memory_capture`（本地已安全 + 入队待补传） |
| 项目里沉淀一条经验/结论（在线也一样） | `memory_capture`（同一条 seam，落点对 agent 透明） |
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

### `memory_capture` — 统一写入门面（落点对 agent 透明）

```json
{ "text": "改用 PG 后 FTS 要抽成纯函数", "title": "FTS 抽纯函数" }
```

`text` + `title` 落在**当前项目**时即走项目记忆通道：本地 `.agents/memory/YYYY-MM-DD.md` 追加原文
（新建日志会同时补 `MEMORY.md` 索引行），远端可达时顺带上行一条 L1，回执给出两态：
`{ local: "written|appended|exists", remote: "sent|skip|drift|conflict|queued", remoteId }`。
`skip`=内容指纹一致（幂等真源在本地状态文件，服务端 L1 没有内容 hash）；
`drift`=本地改过已上行条目 ⇒ **只报不改**，原文落待办等裁决，绝不覆盖远端；
`conflict`=服务端近似闸 block（业务码 40902 走 HTTP 200）⇒ 冲突候选回抛 + 落本地待办。

对话原文（带 `session_id` 或 `messages`）**不入项目记忆**，仍按原路转发 `conversation/add`；
显式改落点用 `sink` ∈ `auto|file|conversation`。落点判定不接受 agent 猜：只给 `text` 且当前目录不是仓库 ⇒ 走对话通道。

```json
{ "messages": [{ "role": "user", "content": "…", "timestamp": "2026-09-15T09:00:00Z" }],
  "session_id": "sess-1" }
```

`session_id` 缺省按当天生成（`local-YYYY-MM-DD`）。
**远端不可达 / 服务端拒收（HTTP 非 2xx）** → 入本地队列等 `memory_sync` 补传，回执 `queued: true`；
拒收额外带 `error` 字段（区分离线与拒收，不静默吞掉）。
**门面不建卡**：`/v3/task/*` 控制面要写面 `user_key`，只读 token 建不了；建卡是执行面 CLI 动作：

```bash
node tools/memory-uplink.mjs --root <仓库根> --push-conflicts   # 需 TDAI_USER_KEY
```

### `memory_sync` — 回连补传（恰好一次）

```json
{}
```

按序补传队列，成功一条移除一条，**遇失败即停**并回报剩余条数。需要远端，离线时明确回报不可达。
两条不成文的坑由本层兜住：近似闸 block **不算投递失败**（转待办 + 出队，否则队头永久堵塞）；
超单条正文上限（8192）的条目**按行拆片**补传，与门面/批量 CLI 同一套片键，不截断。

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
| 沉淀**项目记忆**（一条经验/结论，本地原文 + 顺带上行 L1） | **本面 `memory_capture`**（统一写入门面，PRD 57） |
| 写入（对话上传 / 精华直落 / 技能增删改） | **`memory-admin` CLI**（`sk-mem-` user_key） |
| 任务执行（偏差验证 / 演化评估） | **`memory-admin` CLI**（`task` 子命令） |

判定口诀：**「查远端 → memory-gateway；查本地 / 离线 / 沉淀项目记忆 → tdai-memory-local；技能与精华写入 / 管理 → memory-admin CLI」**。

三者不是替代关系：`memory-gateway` 在**线**时给全局视图，本面在**离线**时给本地视图，技能写面永远是 `memory-admin`。

---

## 凭据与离线降级

复用 `memory-admin` / `memory-gateway` 的**同一份**统一凭据 `mcp-gateway-credentials.json`
（坚果云同步根探测，或用 `--credentials <file>` / `TDAI_MEMORY_MCP_CREDENTIALS` 指定）。

**凭据缺失不是故障。** 此时本面降级为纯本地能力：`memory_search` / `skill_search` / `skill_mirror`（读本地镜像）照常工作，
`memory_capture` 本地原文照写、远端那半入队不出队，`memory_sync` 明确回报不可达。那正是本层存在的理由。

状态目录 `~/.tdai/memory-mcp/`：队列 `capture-queue.jsonl`、镜像 `skills-mirror.json`、
上行幂等状态 `file-memory-state.json`（键 = 仓库命名空间 + 逻辑路径 + 锚 + 片号）、
待办冲突 `conflicts-pending.jsonl`（门面回抛、执行面建卡后消费）。
与守护进程的 `~/.tdai/state/` 平级、不混用。批量补历史与首次全量走 CLI：

```bash
node tools/memory-uplink.mjs --root <仓库根> --dry-run     # 先看会发多少，一次网络都不发
node tools/memory-uplink.mjs --root <仓库根> --verify <文本>  # 上行后回读 /v3/recall 确认在召回里
node tools/memory-uplink.mjs --root <仓库根> --distill-brief   # 蒸馏简报（本地条目 + L2 上下文包），零写入
node tools/memory-uplink.mjs --root <仓库根> --distill-submit <投影.json>  # 派生投影落 L1/L2（不改源 md）
```

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

注册腿**本体在仓库**（工单 57-01 起，`tools/memory-mcp.mjs` 自带 `register` 子命令，幂等合并、不改别的 server）：

```bash
node tools/memory-mcp.mjs register --status            # 只读：各家 harness 注没注上
node tools/memory-mcp.mjs register                      # 默认 dry-run，只打将写入什么
node tools/memory-mcp.mjs register --all --force        # 写进探测到的各家配置（内容不同才需 --force）
```

`--target <mcp.json>` 指到探测表之外的路径时同样要 `--force`——防的是「一条命令改坏他人 MCP 配置」。
守护进程入口 `npm run daemon -- register-mcp`（本仓 `package.json` 已于 2026-10-02 退役移除，连同 `tdai-daemon.mjs` 的该分支一道作废）原本就是把上面这条命令转出去（codegraph 腿与记忆腿各自独立，不再互相抹掉）。该入口现已不可达——需要注册请走 `memory-gateway` 等现役面的注册脚本，或按上段 `tools/memory-mcp.mjs register` 文档（⚠️ 该文件亦已随 PRD 85 删除）。

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

- 本体的自动化测试在 TencentDB-Agent-Memory：`npm run test:memory-tools`（298 例，沙盒内，不碰真实 `~/.tdai`）。
- 注册/拉起脚本的测试：`node --test base/skills/TDB-AM/tdai-codegraph-local/scripts/memory-mcp.test.mjs`（12 例）。
- **集成验收（守护自动拉起）未实测**：需在装了 `tdai-codegraph-local` 守护的机器上跑一次
  `node memory-mcp.mjs start`，确认进程起来且 `tools/list` 返回五个工具。
  由仓库所有者（姜老师）在装了守护的机器上执行；本开发环境 `~/.tdai` 不存在、守护未安装。
