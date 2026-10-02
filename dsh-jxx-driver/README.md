# dsh-jxx-driver

jxx 流程的 DSH 编排插件。把 `jxx-ticket-board` 的 auto 模式从「打印提示词给人贴」变成「真的编排」：插件在 DSH 宿主进程内做卡位 watcher + 僵死计时器 + 编排状态机，经 `ctx.subagents` 编程拉起 worker / 三维审查者 / 合并专员，自动推进 **投卡 → 开发 → 审查 → 合并**。

**设计裁决**：本仓 `docs/adr/0110-jxx-driver-plugin.md`（TencentDB-Agent-Memory）。

## 它做什么 / 不做什么

做：卡位轮询、超时判僵死、按就绪前沿 spawn、三维审查收口（`VERDICT: PASS|FAIL` 机读行，缺失判 FAIL）、返工（有上限）、合并专员接续、会话内里程碑汇报。

不做（结构性红线）：不删 `control/`、不调 `rm-wt`、不批量操作、不自动 PRD 收口、不写 `.agents/memory/`。审查判断、合并复核等语义判断全在 LLM 子 agent。

`control/` 卡目录与 `.scratch/` 工单是唯一真相源；插件是薄驱动，宿主重启后按卡位重建。

## 用法

**统一入口 `/jxx <任意输入>`**——一个口子吃所有输入，插件把分流材料 steer 给会话模型，模型调查后定轨道：

| 你说 | 发生什么 |
|---|---|
| `/jxx 侧栏数字不对` | 模型判为小任务 → 散工单快车道（无 ADR/PRD，直接开发→三维审查→合并 main） |
| `/jxx 做一个导出功能` | 模型判为中任务 → 先 grill 决策，再 ADR+PRD+工单+自动编排 |
| `/jxx 重构整个记忆层` | 模型判为大任务 → ADR 必出，PRD 拆分与里程碑规划 |
| `/jxx 94` 或 `/jxx 完成四面板` | 命中既有 PRD → 直接对该 PRD 自动编排 |
| 调查后仍拿不准 | 模型用 ask_user_question 问你选「自动决策 / 手动决策」 |

工具面 `jxx_flow`：`action="go"`（必填 `idea`，可选 `track`: `quick`/`standard`/`deep`/`auto` 强制指定轨道，跳过模型分流）、`status`、`stop`、`advance`。旧写法 `start`/`quick`/`auto` 仍作为别名可用。

**分流判断在模型，不在插件**（ADR-0110 D3）：机械层只提供 PRD 匹配与三条通道的执行。模型判错的代价 = 一轮 steer 返工，不是流程损坏。

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
