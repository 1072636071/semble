---
name: tdai-memory-capture
description: 记忆写入通道（对话上传 / 精华直落 / 技能管理 / 任务通道领取回传）。由用户显式调用，不参与自动触发。
version: 0.4.0
---

## 目的与适用

用户显式说「记住这段 / 把这个存到记忆里」时，agent 按本 skill 指导把内容上传给记忆内核：**原始对话走内核蒸馏管线，整理后的精华按类型分流落库，上传的技能可改可删（全生命周期）**——不再「能生不能养」。

**由用户显式调用，不做自动触发**——不与自动蒸馏、其他 skill 抢触发词。

**本 skill 是薄 wrapper**（ADR-0031）：写/管理动作一律经 `memory-admin` CLI 执行，不内嵌 curl、不手拼 Header、不手解信封。CLI 已封装统一契约（信封归一、409 乐观锁自动重试一次、`--dry-run` 预演）。端点级细节与字段见 `references/capture-endpoints.md`、`references/task-channel.md`（权威文档，CLI 与其逐条对齐）。

读写分工（与 `memory-gateway` 互指，ADR-0022/0023/0031）：

| 动作 | 走哪条通道 |
| --- | --- |
| 查询记忆 / 技能 / 知识 / code-graph / wiki（只读） | **memory-gateway**（统一只读 MCP 门面，23 工具并集） |
| 写入（对话上传 / 精华直落 / 技能增删改） | **memory-admin CLI**（REST，`sk-mem-` user_key 运行时读取） |
| 任务执行（偏差验证 / 演化评估：list→claim→report→adjudicate） | **memory-admin CLI**（`task` 子命令，agent 面 `sk-mcp-` token） |

判定口诀：**「查询 → memory-gateway MCP 工具；写 / 管理 / 任务 → memory-admin CLI」**。

---

## 凭据供给

写入动作需要 `sk-mem-` user_key（只读 `sk-mcp-` token **不能**用于任何写操作）。CLI **运行时读取**，不留客户端、不进日志、不在对话回显：

```bash
memory-admin --help          # 查看全部子命令
```

凭据三级供给（env → 坚果云统一凭据 → panel-admin 遗留权威位），由 CLI 配置层完成；缺失时按 CLI 报错提示运行向导：

```bash
node docs/skills/panel-admin/scripts/setup-credentials.mjs
```

**密钥纪律**：`user_key` 等同密钥——不进文档、不进对话回显、不进仓库、不进日志；CLI 一切输出经 `maskSecret` 全掩码（固定 `********`）。

---

## 双通道与分流（核心决策，CLI 不替你判断）

用户说完「记住这段」后，按两步走：

### 第 1 步：判定走哪条通道

| 内容形态 | 通道 | CLI 命令 |
| --- | --- | --- |
| 用户直接贴一段**原始对话**（或多轮往来原文），想整体存档 | **原始通道** | `memory-admin capture conversation --session-id <sess> --messages-json '<[{role,content,timestamp?}]>'`（或 `--file` 读 JSON 文件） |
| 用户/agent 已经**整理好的精华**（一句话结论、一条经验、一个做法） | **精华通道** | 按类型分流（见第 2 步） |

两步可叠加：先走原始通道存档，再手动补一条精华直落。

### 第 2 步：精华按类型分流（判定标准）

| 判定 | 落点 | CLI 命令 |
| --- | --- | --- |
| **经验 / 做法**：怎么做某件事（流程、技巧、偏好、坑）——可复用的「程序性知识」 | 技能库 | `memory-admin capture skill <name> <content>`（= skill create） |
| **事实 / 结论**：是什么（事实、决定、约束、结论）——原子事实，进 L1 | L1 | `memory-admin capture atomic <type> <content>`（type ∈ episodic|persona|instruction） |

判定口诀：**「教我怎么做的」进技能，「告诉我是什么的」进事实**。同一段内容两种成分都有时拆开分别落。拿不准时问用户一句，不猜。

capture 命令需要身份（`--team-id` / `--agent-id` / `--user-id`，作隔离头），可用 env `TDAI_TEAM_ID` / `TDAI_AGENT_ID` / `TDAI_USER_ID` 预置。

---

## 技能全生命周期（CLI 内建乐观锁纪律）

上传的技能**可改可删**，全部经 `memory-admin skill *`：

```bash
memory-admin skill create <name> <content>          # 首次上传；重名 42201 → 先 get-by-name 再改
memory-admin skill get <skill-id> [--include-content] [--agent-id A]   # 读详情（--agent-id 读回自己的 provisional 版本）
memory-admin skill get-by-name <name>
memory-admin skill update <skill-id> <content>       # 整篇替换
memory-admin skill patch <skill-id> <old> <new> [--replace-all]   # 局部替换
memory-admin skill delete <skill-id>                 # 软删归档
memory-admin skill set-marks <skill-id> [--user-no-reflect]       # 整技能豁免反思
memory-admin skill versions <skill-id>               # 列全部历史版本（含 change_summary / 保留窗状态）
memory-admin skill rollback <skill-id> <version> [--force]   # 一步回滚到指定历史版本（乐观锁 409 自动重试一次）
```

- **乐观锁纪律由 CLI 内建**：写操作带 `expected_version`（可 `--expected-version` 显式传，或 `--team-id` 在场时自动读当前版本）；收到 **`40901` SKILL_VERSION_STALE** 时 CLI 自动用 `data.current_version` 重试**一次**，再冲突即停——不要手动循环重试。
- `41001` SKILL_VERSION_EXPIRED 时，先 `get` 读最新版再基于它改。
- 所有 skill 写操作需要 `--user-id --team-id`（归属字段），可用 env 预置。

细节与字段见 `references/capture-endpoints.md` §技能全生命周期。

---

## 任务通道（偏差验证 / 演化评估：list → claim → report → adjudicate）

用户把偏差/优化点的**标记编码**（`dev-…`，即任务 `payload.source_report_id`）报给 agent，
或要跑技能优化产生的 `evolution_eval` 评估任务时，走任务通道四步闭环（旧实验联系四步
已随端点下线移除）：

1. **列任务**：`memory-admin task list [--task-type deviation_verify|evolution_eval] [--status ready]`。指示与验收标准就在列表项里，先读懂再领。
2. **领取**：`memory-admin task claim <task-id>`。只有 `ready` 可领；落败 409 `task_busy` = 他人已抢走。
3. **真实工作区执行**（真实命令、真实环境——不用沙箱、不编造证据），按 `instructions`/`acceptance` 逐条留可复核证据；证据不足不回传，不为闭环硬选一边。
4. **回传 + 拍板**：`memory-admin task report <task-id> "<result>" --evidence "..." [--observations-json '<…>']`，随后 `memory-admin task adjudicate <task-id> apply|reject --reason "..."`（decision 必带；apply 需对目标资产有写权限）。

`--observations-json` 附使用观测直接驱动信任门：成功达阈值自动晋 `trusted`；可归因失败
（`cause:"asset"`）即时降级并自动生成 `deviation_verify` 复验任务。字段与错误码见
`references/task-channel.md`。

---

## 通用约定

- **鉴权头 / 隔离头 / 响应信封**：由 CLI 统一封装，agent 不手拼（`x-tdai-service-id` 必填、写操作带 `x-tdai-user-key`、conversation/atomic 身份走隔离头、信封 `{code,message,data}` 已归一）。
- **技能名唯一性**：`(team_id, agent_id, name)` 唯一，重复创建返回 `42201`——先 `get-by-name` 判断是否应走 `update`。
- **内容上限**：`atomic/create` content ≤ 8192 字符；`conversation/add` 单批 ≤ 100 条消息、单条 ≤ 8192 字符。
- **预演**：任何写命令加 `--dry-run` 先看将发出的请求（密钥掩码），确认后再执行。

## 域路由表

| 内容 | 参考文件 |
| --- | --- |
| 三写入口 + 技能全生命周期端点细节（CLI 的字段/错误码依据） | `references/capture-endpoints.md` |
| 端到端演练清单（双通道 + 两类落点各走通一次） | `references/capture-dryrun.md` |
| 任务通道（四步契约 + observations 信任门字段 + 错误码） | `references/task-channel.md` |
| 任务通道演练清单 | `references/task-dryrun.md` |

## 验收

`references/capture-dryrun.md` 为人工执行清单：原始通道 → `capture conversation`；精华经验类 → `capture skill`；事实类 → `capture atomic`，外加技能 `update`/`patch`/`delete` 与 409 乐观锁恢复各走通一次（CLI 自动重试）。任务通道演练见 `references/task-dryrun.md`（claim→report→adjudicate 全链路 + 信任门晋级/降级核验）。演练命令一律经 `memory-admin`，不再手抄 curl。
