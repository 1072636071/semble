# dsh-jxx-driver

jxx 流程的 DSH 编排插件。把 `jxx-ticket-board` 的 auto 模式从「打印提示词给人贴」变成「真的编排」：插件在 DSH 宿主进程内做卡位 watcher + 僵死计时器 + 编排状态机，经 `ctx.subagents` 编程拉起 worker / 三维审查者 / 合并专员，自动推进 **投卡 → 开发 → 审查 → 合并**。

**设计裁决**：本仓 `docs/adr/0110-jxx-driver-plugin.md`（TencentDB-Agent-Memory）。

## 它做什么 / 不做什么

做：卡位轮询、超时判僵死、按就绪前沿 spawn、三维审查收口（`VERDICT: PASS|FAIL` 机读行，缺失判 FAIL）、返工（有上限）、合并专员接续、会话内里程碑汇报。

不做（结构性红线）：不删 `control/`、不调 `rm-wt`、不批量操作、不自动 PRD 收口、不写 `.agents/memory/`。审查判断、合并复核等语义判断全在 LLM 子 agent。

`control/` 卡目录与 `.scratch/` 工单是唯一真相源；插件是薄驱动，宿主重启后按卡位重建。

## 用法

在 DSH 会话里（工作目录 = 带 `.scratch/` 的项目仓）：

- `/jxx start <想法>` 或工具 `jxx_flow(action=start, idea=...)` — 从想法开始（决策 → ADR → PRD → 工单 → 编排）
- `/jxx auto <PRD号>` 或 `jxx_flow(action=auto, prd="94")` — 对既有 PRD 直进编排
- `jxx_flow(action=advance)` — 当前阶段产物落盘后推进（gate 不过会告诉你缺什么）
- `/jxx status` 或 `jxx_flow(action=status)` — 当前阶段 / 卡位 / 受阻项
- `/jxx stop` — 停止编排并中止在飞子会话

## 配置（cordis.patch.yml 的该行 config）

| 字段 | 默认 | 含义 |
|---|---|---|
| `boardScript` | `~/.agents/skills/jxx-ticket-board/scripts/board.mjs` | board.mjs 绝对路径 |
| `parallel` | `3` | 并行 worker 上限 |
| `staleMinutes` | `30` | claimed 卡无存活 worker 的超时阈值 |
| `maxRetries` | `1` | worker 失败/审查不过的返工上限 |
| `autoMerge` | `true` | 三审全过后是否自动 spawn 合并专员 |
| `pollIntervalMs` | `5000` | 卡位轮询间隔 |

## 测试

```bash
npm test    # node --test，含真 board.mjs 的 fixture 看板 E2E
```

## 装载

**开发期（本机 DSH 由源码检出 + tsx 启动）**：往 profile 的 `cordis.patch.yml` 追加：

```yaml
- insert:
    - id: jxx-driver
      name: "E:/work/sp/JwikisSkills/dsh-jxx-driver/src/index.mjs"
```

web profile 有 HMR，patch 变更即时生效（无需重启）。

**发布形态**：`dsh plugin --profile <name> add <本目录绝对路径>`（包已声明 `dsh.bundle.patch`）。
