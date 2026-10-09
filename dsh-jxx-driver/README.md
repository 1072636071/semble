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
| `/jxx 做一个导出功能` | 模型判为中任务 → 先定决策，再 ADR+PRD+工单+自动编排 |
| `/jxx 重构整个记忆层` | 模型判为大任务 → ADR 必出，PRD 拆分与里程碑规划 |
| `/jxx 94` | **显式编号** → 直接对 PRD 94 自动编排（编号得给准，不猜） |
| 输入意图本身有歧义 | 模型用 ask_user_question 澄清（例如只说「把那块优化一下」却没说清是哪块） |

工具面 `jxx_flow`：`action="go"`（必填 `idea`，可选 `track`: `quick`/`standard`/`deep`/`auto` 强制指定轨道，跳过模型分流）、`status`、`stop`、`advance`。旧写法 `start`/`quick`/`auto` 仍作为别名可用。

**分流判断在模型，不在插件**（ADR-0110 D3）：机械层只提供三条通道的执行。模型判错的代价 = 一轮 steer 返工，不是流程损坏。

## 不推荐既有 PRD（ADR-0118）

插件**不扫 `.scratch/`、不猜意图、不列候选清单**。要编排哪份既有 PRD，编号由用户/模型给出：

- `auto` 轨只接受两种确定性形态：纯编号（`94`，容忍补零 `094`）或功能目录名（`94-jxx-driver-plugin`）。匹配不上就响亮报错。
- **撤除的能力**：扫全量 PRD 清单、slug/标题子串模糊匹配、多候选 `CANDIDATES` 机制、go 分流时的「既有 PRD：…」推荐行。
- 理由：要走既有 PRD 的人会直接给编号；`.scratch/` 会随项目变老累积几十份 PRD，每次 go 都列清单是噪音而非帮助。模糊输入（如「把这些优化做完」）不再有自动捷径——模型要么走 standard 轨道重走一遍，要么问用户，这是已知并接受的代价。

## 接待台角色（ADR-0115 · D1）

执行 jxx 插件命令的会话 = **编排接待台，不是工人**：

- **不做任务**——不写实现代码、不领卡、不替 worker/审查者/合并专员干活；实现一律由插件 spawn 的子 agent 完成。
- **主业是理解用户需求**——拿不准就问，把意图聊清再推进；决策定稿必须经用户确认。
- **编排期只监控**——看 status、收编排器通知、如实转告用户。

角色话术单源 = `orchestrator.mjs` 的 `SESSION_ROLE`，注入四个面：`jxx_flow` 工具描述前导、`go` 分流 steer、各轨道返回 hint、`systemPrompt` context（`test/session-role.test.mjs` 锁两档配置下都在）。

## 部分免确认（`autoConfirm`，默认开 · ADR-0113；ADR-0115 收窄）

插件驱动的编排队列只在 **PRD seam 与工单粒度** 两处**不向用户追问**：由会话模型按推荐拍板并直接落盘，取舍理由写进 PRD 对应小节 / `.scratch/<NN>-<slug>/map.md` 留痕。**决策定稿（decide 段）不再豁免**——接待会话必须把需求与用户聊透、经确认后再落 ADR（ADR-0115 D2；实测「decide 也自动」会让会话把「理解需求」一并自动化掉）。

- **只豁免插件驱动的编排会话**。技能正文里的人工闸门（`jxx-to-spec` 第 2 步「与用户确认 seam」、`jxx-to-tickets` 第 4 步「询问粒度直到用户批准」）**一字未改**——人手跑 `/jxx-to-spec` / `/jxx-to-tickets` 仍然会问你。豁免通过编排段的下发提示词实现（`AUTO_CONFIRM_HINTS`）。
- **免确认 ≠ 免判断**：垂直切片规则、阻塞边推导、seam 取尽可能高层这些实质要求照旧执行，只是不再停下来等你点头。
- 输入意图本身有歧义（如「完成这些优化」同时命中多份 PRD）时**仍会问**——拍错轨道会白干，这属于澄清而非确认。
- 关掉：`config.autoConfirm: false` 即回到全人工闸门措辞。

## 子 agent 默认提示词（ADR-0115 · D3）

worker / 审查者 / 合并专员的提示词两级供给：

1. `control/starter/<role>.md`（board init 渲染产物、项目真源，可能被定制）——存在即优先用；
2. `src/default-starters/<role>.md`（插件内置固化副本，占位符运行时替换）——缺失时兑底。

内置副本与技能真源 `base/skills/engineering/jxx-ticket-board/assets/starter-*.tmpl.md` **逐字节一致**，由 `test/default-starters.test.mjs` 锁死——改技能模板后必须同步重拷（测试失败信息给拷贝命令）。

## 团队模式（PRD 110 / ADR-0121）

宿主装载了智能体团队服务（`ctx.agentTeams`）时，worker 与合并专员走**持久队友**（首次 `spawnTeammate` 建会话，后续复用走 `sendMessage` 指令下发），不再每轮重开全新子会话；`control/` 卡目录仍是唯一真相信号，团队通道只做指令下发与 SETTLED 回传收割（ADR-0110 不引入第二真相源）。

**角色持久化矩阵**：

| 角色 | 路径 | 持久性 |
|---|---|---|
| worker（dev） | 团队路径 | 持久队友；池大小 = `parallel`，并发卡各占一个队友、各领卡串行；完成任务数超 `reuseLimit` 即停发并换名重建 fresh 后继（名字永不复用；**在飞成员的退役**与重建交接简报属工单 03，未实现） |
| 合并专员（merger） | 团队路径 | 持久队友；池 = 1，同名串行复用 |
| 审查者（reviewer ×3） | 一次性 spawn | 每次全新会话（ADR-0121 D1：审查要求独立无污染视角，不持久化） |

**生命周期**（D4，`test/lifecycle-fallback.test.mjs` 锁定）：

- run 结束（全部工单收口进 ops）**不解散**成员——持久队友留在宿主 roster，同会话下一个 run 复用同一通道按名续接（不新开会话）；
- `stop`（工具面 `action="stop"` 或 `/jxx stop` 命令面，会话释放同路）对**在飞**队友逐个 `interrupt`（中断当前轮次、保留其会话与待办信箱）；一次性路径仍沿用 AbortController 中止（行为不变）。stop 后编排器不再派发，在途派发失败也不回退新开一次性子会话；
- 宿主重启或队友 failed 导致按名解析不到 → 下次派发走「点名不在册 → 换名重建 fresh 后继」分支；失败退避重发与同会话唤醒的韧性语义属工单 03（未实现）。

**回退开关**（D5）：`teamMode: 'off'` 或宿主无 agentTeams 服务（或服务缺方法 / 通道建立失败）→ 全链路自动回退既有一次性路径，行为零变化（机械判据：既有测试文件零改动全绿）。留痕口径：「通道建立失败」有编排 history 留痕（含原因）；`teamMode=off` 与宿主服务缺失是**静默回退**——无服务的宿主不该被日志面打扰，属刻意设计。

**SETTLED 回传协议**：团队模式下 worker / 合并专员完工（或受阻停手）后 `send_message` 回 Lead，回报文本**末行单独一行**写机读行，编排器按行收割收口（卡位扫描兜底，双路去重）：

```
已交付 110-04，审查报告已写卡。
SETTLED: 110-04-lifecycle-fallback-docs
```

**失败后的用户操作**：当前实现下轮次失败/无回传由卡位扫描按 `staleMinutes` 兜底重派；「切换模型后唤醒同一队友」的韧性面（D3）属工单 03，实现前无需也不应期待该行为。

**待部署窗实测项**（fixture 仅断言调用面，真宿主观感未实测，不写成结果）：真宿主 `interrupt` 后队友会话保留与下轮续接体验；宿主重启后 roster 冷恢复 + 按名续接全链（含会话恢复后 Lead agent 实例重建时，通道缓存持有的旧 agent 引用与宿主「exact live Lead」校验是否失配——失配则该会话通道需重建）；持久队友上下文占用随复用轮数的增长（`reuseLimit` 是否需要下调）。

## 双编排器互斥与排查（PRD 108 retro P0-2 / P3-7）

同一检出的 `control/` 卡目录与 git 是**共享状态机**——两台 dsh 各挂一个 jxx-driver 同时编排会互踩（PRD 108 实测：并行会话直落 main 绕过审查闸）。防护面：

- **启动互斥**：`start` / `auto` / `quick` 三入口在创建 run 前扫 `control/jxx-driver-runs/*.lock.json`——存在**他方会话**的活跃锁即响亮拒绝（错误消息含对方 run id、阶段与清理指引）；本会话自己的锁放行（重启续接场景）；锁 `updatedAt` 超过 24h 视为宿主崩溃残留，放行 + warn；坏 JSON 锁文件放行（不因残留损坏堵死启动）。
- **锁生命周期**：`persist` 每次落 `<runId>.lock.json`；`halt`（stop / 会话释放 / 插件卸载）与 `failRun` 摘除。锁文件是**机器可读的活跃证据**，不是白名单——发现陈旧锁可人工删除后重试。

**静默死亡排查三步**（`jxx_flow status` 故障或怀疑编排停摆时，按序）：

1. **run 史尾**：`control/jxx-driver-runs/<runId>.json` 的 `history` 尾部——最后事件是什么、`updatedAt` 是否冻结；
2. **卡位**：`control/cards/open|done/` 里对应卡的文件名后缀（`.claimed.md` 滞留 + run 无 spawn 事件 = worker 死了没重派）；
3. **账本**：`control/ledger.md` 尾部——最后一次 card-move 的 actor 与时间。

另：宿主 Team 服务（`spawn_teammate` 面）席位上限（8/8，历史队友 inactive 占位无释放工具）触顶时，`spawn_teammate` 直接报错——**改用 subagent 通道**（`subagent` 工具）交付等价：回报/通知机制相同，交付物照常先落盘。

## 配置（cordis.patch.yml 的该行 config）

| 字段 | 默认 | 含义 |
|---|---|---|
| `boardScript` | `~/.agents/skills/jxx-ticket-board/scripts/board.mjs` | board.mjs 绝对路径 |
| `parallel` | `3` | 并行 worker 上限（团队模式下同时是 worker 队友池大小） |
| `staleMinutes` | `30` | claimed 卡无存活 worker 的超时阈值 |
| `maxRetries` | `1` | worker 失败/审查不过的返工上限 |
| `autoMerge` | `true` | 三审全过后是否自动 spawn 合并专员 |
| `autoConfirm` | `true` | 部分免确认：编排队列不追问 PRD seam / 工单粒度（ADR-0113）；决策定稿仍需用户确认（ADR-0115） |
| `pollIntervalMs` | `5000` | 卡位轮询间隔 |
| `teamMode` | `auto` | 团队模式开关（PRD 110 / ADR-0121）：`auto` = 宿主有 agentTeams 时 worker/合并专员走持久队友；`off` = 全走既有一次性路径 |
| `reuseLimit` | `8` | 队友复用预算：完成任务数超过该值判 retire，停发并换名重建 fresh 后继 |
| `teamProvider` | `spawn` | 团队路径 `spawnTeammate` 的 provider（与一次性路径默认 provider 同名，不引入第二套） |

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

## 经验沉淀（docs/retro/）

每轮编排收尾（ops 段）由接待会话在**产品仓**（TencentDB-Agent-Memory）写 `docs/retro/<日期>-<slug>.md` 回顾——ADR-0121 落地过程（PRD 110 工单 01-04）的顺点/卡点实录见 `docs/retro/2026-10-08-jxx-driver-team-spawn.md`。插件仓 README 只留指针，不复制回顾正文。
