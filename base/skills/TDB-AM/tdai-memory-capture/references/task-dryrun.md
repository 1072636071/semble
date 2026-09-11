# tdai-memory-capture · 任务通道演练清单（人工执行）

> 四步契约与 observations 字段见 `task-channel.md`。**待人工执行**——需要真实内核环境 +
> 一把 `sk-mcp-` token（agent 面，面板签发）+ 一把 admin `sk-mem-` user_key（造数与观察窗）。

## 前置

- 环境变量沿用 `capture-dryrun.md`：`$KS` / `$SID` / `$UK` / `$TEAM` / `$AGENT` / `$USER`；
  另备一把 `sk-mcp-` token（agent 面四步用）。
- CLI 凭据向导：`node docs/skills/panel-admin/scripts/setup-credentials.mjs`
  （统一凭据文件含 `sk-mem-` + `sk-mcp-` 两把，task 四步与观察窗共用）。
- 造演练任务（服务端下发方视角，user_key）：`memory-admin task create`（或
  `POST /v3/task/create`）落一条 `deviation_verify` 任务，payload 三要素齐全：
  `target={asset_id:<skill_id>, asset_type:"skill", version:<N>}`、`instructions`、
  `acceptance`；另造一条指向同技能新版本的 `evolution_eval` 任务（或直接对演练技能
  `skill/patch` 一次，内核自动派生）。

## 清单（按序执行，全部走通才算过）

1. [ ] **list**：`memory-admin task list --task-type deviation_verify --status ready` →
   演练任务出现；`--task-type evolution_eval` 能列出自动派生的评估任务。
2. [ ] **claim**：`memory-admin task claim <task-id>` → 状态 `claimed`；
   并发语义核验：对同一任务二次 claim（他人已领或非 ready）→ **409 `task_busy`**。
3. [ ] **真实执行**：按 `instructions`/`acceptance` 在真实工作区完成验证/对比，
   记录可复核证据（命令、输出、版本号）。
4. [ ] **report + observations**：`memory-admin task report <task-id> "<result>" --evidence "…"
   --observations-json '[{"outcome":"success","version":<N>,"idempotency_key":"dryrun-1"}]'`
   → 200，状态 `reported`；`task get` 时间线含 report 段。
5. [ ] **信任门核验（晋级）**：对同版本累计第二次成功观测（再领一条任务或带新
   `idempotency_key`）后，`skill versions` / `skill get` 确认版本 `trust_state="trusted"`
   （默认阈值 2）。
6. [ ] **信任门核验（降级自动派生）**：对已 trusted 版本回传
   `{"outcome":"failure","cause":"asset"}` → 版本降回 `provisional`，且内核**自动生成**
   一条指向该版本的 `deviation_verify` 复验任务（`task list` 可见）。
7. [ ] **归因纪律核验**：`{"outcome":"failure","cause":"env"}` → 不计数不降级；
   `fallback:true` 的成功观测不计功。
8. [ ] **adjudicate**：`memory-admin task adjudicate <task-id> apply --reason "证据充分"` →
   `adjudicated→applied` 两跳落库，时间线含拍板与终态段；终态再动 → 409
   `task_invalid_transition`。
9. [ ] **权限核验**：非当前领取者 report → 403；对目标资产无写权限的成员 adjudicate
   apply → 403。
10. [ ] **下线端点核验**：对已下线的旧实验联系端点发起 POST → **410** 失效指引（指向任务通道）。
11. [ ] **清理**：`skill/delete` 删除演练技能；演练任务留存（留痕语义，不删）。

## 执行记录

（待人工执行后回填：日期 / 环境 / 每步判定）
