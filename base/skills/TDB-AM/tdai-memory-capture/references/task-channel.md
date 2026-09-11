# tdai-memory-capture · 任务通道（deviation 验证 / 演化评估的领取与回传）

> 从属于 `tdai-memory-capture` skill（工单 06-09 · 方案 03 §六；任务化改写 18-11）。
> 主文件见 `../SKILL.md`。字段与 `MemoryCore/src/core/roles/task/orchestrator.ts`、
> `MemoryAdmin/src/commands.ts`（task 域）逐一核对。

## 语义一句话

ADR-0032 统一任务通道——「服务端发任务 → 本地 agent 领取 → **真实工作区**执行 → 回传 →
拍板」是唯一的服务端派工链路。旧实验联系端点（run/result 两跳及其 agent 面变体）已**整体下线**
（命中一律 410 失效指引），偏差的生命周期全部长在任务实体上：
`created→ready→claimed→running→reported→adjudicated→applied/rejected`。

**两类常见任务**（task_type 自由扩展，不限于此）：

| task_type | 语义 | payload 要点 |
| --- | --- | --- |
| `deviation_verify` | 验证思考者/反馈者标注的偏差（原 deviation 迁移），或信任门降级后的版本复验 | `target`（资产+版本）、`instructions`（验证指示）、`acceptance`（验收标准）；迁移任务带 `source_report_id`（即旧标记编码 `dev-…`） |
| `evolution_eval` | 新 provisional 版本产生时自动派生的演化评估（工单 18-10） | `target` 指向**新版本**、`old_version` 对比基线、routing 验证指示；回传 observations 直接驱动信任门晋级/降级 |

**适用范围**：信任门观测当前**只覆盖技能（skill）**——非 skill 资产的观测会被忽略
（不计数不降级）。任务本身可指向任意资产。

## 何时触发

- 用户报**标记编码**（形如 `dev-01J...`，即 `payload.source_report_id`）：用
  `task list --task-type deviation_verify` 找到对应任务。
- 用户说「看看有什么任务 / 把任务跑一下」：直接 `task list`。
- 技能优化回路的 `evolution_eval` 任务出现（新版 provisional 产生后自动派生）。

## 凭据与身份

执行四步（list/claim/report/adjudicate）全部走 **agent 面**（`/v3/agent/task/*`），
CLI 经统一凭据文件读只读 MCP token（`sk-mcp-`）；**身份（team/agent）由内核从 token
强制注入**——body 带 `team_id` 一律 400（禁止自报）。

观察窗（含时间线全量视图）走控制面 user_key：`memory-admin task get <task-id>`。

## 流程（四步，全部经 memory-admin CLI）

```
① memory-admin task list [--task-type T] [--status ready]   # 挑任务
→ ② memory-admin task claim <task-id>                       # 领取（CAS，并发唯一胜者）
→ ③ 真实工作区执行（对比/验证，逐条留可复核证据）
→ ④ memory-admin task report <task-id> "<result>" --evidence "..." [--observations-json '<…>']
   memory-admin task adjudicate <task-id> apply|reject --reason "..."
```

### ① 列任务（list）

```bash
memory-admin task list --task-type deviation_verify --status ready
memory-admin task list --task-type evolution_eval
```

`data.items[]`：`task_id / task_type / status / target / instructions / acceptance /
claimed_by`。指示与验收标准就在列表项里，先读懂再领。

### ② 领取（claim）

```bash
memory-admin task claim <task-id>
```

只有 `ready` 可领；并发领取唯一胜者，落败 **409 `task_busy`**（他人已抢走，换任务）。
领到后状态 `claimed`。

### ③ 真实工作区执行

按 `payload.instructions` 与 `acceptance` 执行，逐条留**可复核证据**（命令、输出片段、
路径、版本号）。不用沙箱、不编造证据。判定纪律：

- **evolution_eval**：① 新旧版本对比（新版达成 `change_summary` 意图且无回归）；
  ② routing 验证——在真实检索环境（recall/检索面）用业务问题检索，确认新版本能被
  正确路由命中；③ 结论明确（通过/失败 + 归因）。
- **deviation_verify**：验证偏差成立（verified）或被证伪（falsified），给可复核证据。
  环境类失败（网络/凭据/上游）**注明 `cause:"env"`，不归咎版本**。
- 证据不足以下结论时**不回传**（保持 claimed，可继续核实），不为闭环硬选一边。

### ④ 回传（report）与拍板（adjudicate）

```bash
# result 一句话结论；evidence 放证据串；observations 驱动信任门（见下节）
memory-admin task report <task-id> "对比通过，路由命中" \
  --evidence "本机 recall 命中 v3；新旧 diff 见工单评论" \
  --observations-json '[{"outcome":"success","version":3,"idempotency_key":"use-1"}]'

# 拍板：decision 必带 apply|reject；apply 需对目标资产有写权限（owner/team-admin/write ACL）
memory-admin task adjudicate <task-id> apply --reason "证据充分，采用新版"
```

report 后状态 `reported`（仅当前领取者可回传，否则 403）；adjudicate 两跳
`reported→adjudicated→applied/rejected`。终态无出边，一条任务只闭环一次。

### observations（信任门回传，工单 18-09/10）

`--observations-json` 传非空 JSON 数组，每项一次真实使用：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `outcome` | 是 | `"success" \| "failure"` |
| `version` | 否（缺省继承任务 `target.version`） | 被观测的版本号 |
| `asset_id` / `asset_type` | 否（缺省继承 target） | 观测资产 |
| `cause` | 仅 failure 有意义 | `"asset"`=可归因（**即时降级**回 provisional 并自动生成 deviation_verify 复验任务）；`"env"`=环境类（不计不降）；缺省 `unknown`（不降级不晋级） |
| `fallback` | 否 | `true` = fallback 路径完成，不记功（成功计数跳过） |
| `idempotency_key` | 否 | 幂等键；缺省 = 任务级（同一任务的一次执行对同一版本只计一次） |

服务端经 TrustGate 累计：成功观测达阈值（默认 2，可配 `trust_promotion_min_successes`）
**自动晋 `trusted`**；可归因失败**即时降级**。信任判定非正确性依赖——观测处理失败只记
日志，不阻断任务状态推进。

## 错误码速查

| HTTP / code | 含义 | 恢复 |
| --- | --- | --- |
| 409 `task_busy` | 任务已被他人领走（非 ready） | 换任务或等释放 |
| 403 `permission_denied` | 非领取者回传；或拍板对目标资产无写权限 | 回传找当前领取者；拍板找 owner / 团队管理员 |
| 409 `task_invalid_transition` | 非法状态迁移（如终态再动、claimed→applied 直达） | 按状态机走：claimed→(running)→reported→adjudicated→applied/rejected |
| 400 `task_payload_invalid` | create 时 payload 缺 target/instructions/acceptance | 补齐三要素（服务端下发方职责） |
| 410 | 命中已下线的旧实验联系端点（run/result） | 改走本文件四步（任务通道） |

## 与相邻机制的关系

- **标记编码**：`dev-…`（`source_report_id`）由思考者反思标注 / agent 上报产生；18-03 迁移后
  生命周期（分析/讨论/裁决/终态）全部在 `deviation_verify` 任务的 append-only 时间线上，
  `task get` 可看全量历史。
- **信任门**（ADR-0034）：检索面只出 `trusted` + 发起方自己的 `provisional`；评估者领取了
  指向该版本的在途任务即可精确读（`isProvisionalViewer`，覆盖 deviation_verify 与
  evolution_eval）。
- **技能修订**：任务批准的修订由领取 agent 经 `memory-admin skill update/patch` 落地
  （乐观锁纪律见 SKILL.md）；落库即产生新 provisional 版本 → 自动派生下一条 evolution_eval
  （闭环自续）。
