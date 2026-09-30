# Changelog

## 0.10.0 — 2026-09-30

**三态目录 + 标签正交（D9 落地，工单 75-c01 / ADR-008）**——公告板与服务器工单系统改用同一套心智：目录只表达生命周期，执行态与 triage 各归各的载体。**防抢地基不动**：领取仍是一次原子 rename（ADR-004 的核心不变量），执行态落在**文件名后缀**而不是卡内字段——后者正是 ADR-004 明确否掉的「平铺 + frontmatter 租约」方案。

- **三条正交轴**：目录 `open/`（未收口）· `done/`（已收口）· `archived/`（wontfix/让位）；文件名后缀 `<id>.md` 待领 · `.claimed.md` 在办 · `.review.md` 待终审；卡面 `- labels:` 行 = triage 五标签（`ready-for-agent` / `ready-for-human` / `needs-info` / `needs-triage` / `wontfix`，不增不减）。`held/`（领导者暂缓道）原样保留。
- **`blocked` 不再是目录**：`card-move --to blocked` 把卡落回 `open/` 待领位并自动补 `needs-info` 标签；账本与卡内流转行仍记 `->blocked`，`verify` 的闭合判据自动变成「待领位 + 带 needs-info」。等人拍板用 `card-set --field labels --value ready-for-human`。
- **历史账本零改写**：`move <卡id>.md <from>-><to>` 里的 from/to 继续是工作流位 token（`inbox/claimed/review/done/blocked/archived/held`），五泳道时代留下的历史行仍逐条可回放——历史账本是审计面，改一条就等于造假。
- **新增 `migrate` 子命令**：旧五泳道板迁三态，只做「建目录 → 逐张改名 → 补 labels → 记一行账 → 留快照」；`--dry-run` 先出清单，幂等可重跑，**旧目录留空不删**（红线 §7.2），回退 = 把卡 mv 回去。
- **两条新红灯**（改名方案唯一的两个新腐坏面，都机检）：① 同一 id 同时占两位（`x.md` 与 `x.claimed.md`）⇒ MISMATCH；② 三态板在旧泳道目录里扫到 `.md` ⇒ MISMATCH，并直接给出可照做的改名目标（否则照旧协议 `mv` 进去的卡会「写成功却永远看不见」）。
- **`verify` 升为五路对账**：账本 × 卡位 × worktree × 工单状态 × **标签**（新增第 5 路：未收口三位缺 `labels` 行、标签越界、`wontfix` 滞留未收口位、`doc_ref` 写成本地路径都判 MISMATCH）。
- **薄卡增 `- doc_ref:`**（服务器工单 URL，经 `jxx-ticket-router` 生成），与本地 `PRD:` 路径分列；`new-card` 增 `--labels` / `--doc-ref`，投卡时 labels 缺省取自工单 `**Status:**` 行。`card-set` 白名单加 `labels` / `doc_ref`；`card-read` 输出这两个派生行。
- **`board.html` 改渲染三列**（在办 open / 已收口 done / 已归档 archived）+ 每卡**执行态徽标**（待领·在办·待终审）+ **triage 标签色标**（五色）+ `doc_ref` 外链；`prd.html` 的「在办」分组按 open 三位判定。
- **同型坑修复**：`cardFields` 取值正则原为 `^- k:\s*(.+)\s*$`，其中 `\s*` 会吞换行——空的 `- doc_ref:` 会把**下一行**的 `- PRD: …` 抄成自己的值（实测立刻假报「doc_ref 不是 URL」）。字符类一律改 `[^\r\n]`；这是 0.9.3「正文里的 `- PRD:` 被当卡头字段」的同型坑，selftest 加了跨行泄漏回归断言。
- **协议与模板同步**：`PROTOCOL.tmpl.md` §0（三轴表）/ §1.1-1.2（找无后缀待领卡、领取=改名）/ §2（交付=改名 `.review.md`、受阻=`--to blocked`）/ §3（复核对象 `open/<id>.review.md`、打回改名回 `.claimed.md`）/ §4（token 与物理落点对应表 + labels 必填）/ §5（auto 监控看后缀）；`CARD-TEMPLATE.tmpl.md` 增 `labels:` / `doc_ref:` 行与三轴说明；四份 starter 同步改口径（含本技能**没有** `card-block` 子命令这一错位描述的订正）。
- **`references/ADR-008-three-state-lanes-and-orthogonal-labels.md`** 记录决策与被否方案，并修订 ADR-004 决策 1/3（其「原子 move 防抢」不变量原样保留）。
- **`selftest.mjs` 14 → 52 项断言**：三态落点、改名防抢（含抢占反例与「被拒方不动原卡」）、一位双占红灯、历史 `->blocked` 行双向闭合、旧泳道残卡红灯、labels/doc_ref 四类反例、三列渲染、migrate 六项（dry-run / 四种泳道映射 / 不删旧目录 / 记账 / 幂等）。


## 0.9.3 — 2026-09-30

**事故驱动的一轮硬化**：2026-09-30 07:22，一次被授权的「批量回收 worktree」失控，把整个 `control/`（账本 + 254 张卡 + 三页看板）与多数 worktree 目录删掉；`control/` 当时无版本控制 ⇒ 不可还原。以下四类改动针对该事故链上的每一环。

- **看板版本化（新增 `snapshot` + 变更类命令自动留档）**：`board.mjs snapshot --root <root>` 把 `control/` 提交进**工作区根**的本地 git 仓库（`.gitignore` 忽略 `wt/`）；`autoHtml` 之外，`init`/`new-card`/`card-move`/`card-rm`/`card-set`/`ledger` 执行后自动调用一次（未 `git init` 的工作区静默跳过，行为不变）。任意时点的卡可 `git show <sha>:control/cards/...` 取回。
- **破坏性操作收口**：`rm-wt` 只接受**单段目录名**，解析路径必须落在 `<root>/wt/` 且真实存在，越界即 `die`（`../control`、`..`、通配符全部拒绝）；删除后补 `git worktree prune`。`add-wt` 先 `worktree prune`——修掉「目录被外部删除后残留 stale 注册，导致 `-b` 回退分支失败」的实测故障。
- **假信号修复**：① `cardFields` 剥掉字段值两侧的引号/反引号，且 `prd` 只认 `.md` 结尾的值——正文里写 `- PRD: \`路径\`` 不再被当卡头字段（此前会报「PRD 指针不存在」的假 MISMATCH），模板占位串也不再触发；② `verify` 的 BACKLOG 撞号审计跳过「零领先」分支（三点 diff 的 merge-base 随合入后移，对已合入未清分支必然误报——该欠账 2026-09-29 已登记）。**注**：同时实测过「改两点 diff」的方案，对已重编号的合入分支反而新增误报，故未采用。
- **模板漂移修复（新增 `render`）**：`init` 的 `put()` 只补缺、从不更新已存在文件 ⇒ `control/` 里的模板会永久停在旧版本（本次即为实例：live 卡模板缺 `- PRD:` 行，而 assets 早已有）。`board.mjs render --root <root> [--write]` 逐份比对 assets，默认只报 `[drift]`，`--write` 覆盖并把旧版备份到 `control/.render-backup/`。
- **协议新增 §7「破坏性操作红线与看板自保」**（`assets/PROTOCOL.tmpl.md`）：只走授权通道、一次一卡、`control/` 只读不删、禁止把批量破坏性操作交给子代理、破坏前先留档；§3 合并专员的「回收 worktree/分支」一句同步收口。
- **新增 `scripts/selftest.mjs`（冒烟自测，零依赖）**：在系统临时目录跑完 `init → new-card → card-move → add-wt → verify → 快照 → rm-wt → render → board` 全链 14 项断言，含破坏性边界（路径穿越 / `..` / 不存在的卡必须被拒）与假字段回归（正文里的 \`- PRD:\` 不得触发假 MISMATCH）。`node scripts/selftest.mjs`，退出码即结论。**本轮实测踩点**：没有它时，脚本编辑出过一次「一个 \` 把文件写成两倍长」的隐性损坏，只能靠语法检查侥幸发现。（首版 selftest 自身也踩了两个环境坑：临时仓默认分支不是 \`main\`、没有 \`origin\` 远端，已修。）
- **`board` 的 token 成本**：done 泳道默认只报计数（254 张时全量打印约 12k token/次），`--all` 才展开。

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
