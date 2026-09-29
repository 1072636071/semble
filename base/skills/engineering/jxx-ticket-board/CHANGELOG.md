# Changelog

## 0.9.2 — 2026-09-29

卡模板 `assets/CARD-TEMPLATE.tmpl.md`（及 init 渲染的 live `control/CARD-TEMPLATE.md`）新增 **`## 外部契约` 节**：双仓交付的卡必须写取证坐标（仓库 + 分支 + SHA + `文件:行`），`/jxx-code-review` 步骤 0b 与合并专员终审按该坐标**只读**取证（`git -C <仓> show <SHA>:<路径>`，禁 checkout 对方分支）；节留空 = 判无外部契约，实现明显消费外部接口而节空着 ⇒ 审查报「契约坐标缺失」。注：PROTOCOL §3 的定点复核清单**尚未**列这一步（欠账登记在 `docs/agents/external-contract-evidence.md`，协议归领导者改）。

- **为什么是 `## 节` 而不是 `- 字段:` 行**：`board.mjs` 的 `cmdCardRead` 只打印 `标题/难度/模型档位/依赖/PRD/分支/worktree` 七个固定字段 + 全部 `## ` 段，卡头其它 `- x:` 行**会被静默丢弃**（`cardFields` 无该键、`card-set` 白名单亦不含），审查者与终审恰恰都走 `card read` —— 与 v0.7.3「PRD 行静默丢失」同型坑（见 `board.mjs` new-card 处注释）。落 `## ` 段则零脚本改动即随 `card read` 出。

## 0.9.1 — 2026-09-28

**auto 投卡两处致命缺陷修复**（PRD 75/76 波次实跑暴露）。

- **卡 id 推导**：字母前缀工单（`b01-*.md` / `f01-*.md` / `c01-*` / `i01-*`，按阶段分组的拆单法）原先推成 `b01-slug`，过不了 `new-card` 的 `^\d+-` 正则；且同一 PRD 体系下多份 PRD 的 `b01` 会互相重号。现按所属 PRD 目录号加前缀（`.scratch/75-x/issues/b01-y.md` → `75-b01-y`），纯数字前缀工单行为不变。
- **状态闸门不再终止编排**：`cmdNewCard` 的 `die()` 走 `process.exit`，一批工单里混一张非 `ready-for-agent`（已 done / wontfix）会直接杀掉 `auto`，后续编排指令与 spawn 提示词全部拿不到。改为在 `auto` 内预检 Status 行，不合闸门记为 `errors` 行并继续处理其余工单。
- 回归：三工单混合投卡（`75-b01-*` + `76-f04-*` + 一张 done 的 `01-*`）→ rc=0、两张 inbox 卡、一条跳过记录；重复运行报「卡已存在」保持幂等。

## 0.9.0 — 2026-09-28

**Auto 模式（自动编排）**——指定一组工单后自动完成投卡→开发→三维度审查→合入全流程，无需人工拉会话。

- **新增 `auto` 子命令**：`board.mjs auto --tickets <工单文件列表> [--parallel N] [--retry N]`——读工单文件 → 逐张投卡（含状态闸门+依赖闸门）→ 输出编排者/worker/审查者/合并专员四角色 spawn 提示词。
- **新增两份 starter 模板**：
  - `starter-reviewer.tmpl.md`——三维度审查者（std/spec/rule），只审不改，并行执行。
  - `starter-auto.tmpl.md`——自动编排者（orchestrator），只调度不写代码。
- **PROTOCOL 增 §5 自动编排规则**：角色职责表、编排者规则（spawn→监控→触发审查→触发合入）、三维度审查规则、合并专员规则（auto 模式）、失败处理（重试→blocked→继续推进不阻塞的卡）。
- **init 渲染 4 份 starter**（dev / merger / reviewer / auto）。
- **SKILL.md 增 Auto 模式说明**：触发方式、编排者职责、三维度审查表、失败处理、Auto 模式动作循环。

## 0.8.0 — 2026-09-28

**PRD 看板（第三页）与执行分流**——面板职责收敛为：发布任务 + PRD/工单状态展示 + 提供任务提示词。

- `html` 升级为三页互链：`board.html`（工单视角）+ **`prd.html`（PRD 视角，新增）** + `human.html`（人工待办）。
- `prd.html`：扫权威仓 `.scratch/<NN-slug>/PRD.md + issues/*.md`，每份 PRD 呈现 Status、工单收口进度、工单按「前沿可领 / 在办 / 等人工 / 待评审 / 已完成 / 已放弃」分组；**有卡的工单按卡泳道显示真实协调状态（优先于工单文档 Status 行）**。
- **执行分流**：PRD 级整轨 = 每份 PRD 一个「📋 PRD 级整轨提示词」按钮，复制 `/jxx-implement-spec` 提示词（单分支 `ticket/<PRD号>-spec` 交付一支 PR，后台子 agent 按就绪前沿并发）；工单级分轨 = 工单看板领卡 `/jxx-implement`。同一 PRD 二选一防双轨（提示词自带在办卡检查）。
- 变更命令（init/new-card/ledger/add-wt/rm-wt/card-*）自动保鲜三页；watch 模式重扫三页。
- 协议、卡格式、状态机、账本文法零改动；`verify` 闸门全部保持（e2e 回归通过）。
