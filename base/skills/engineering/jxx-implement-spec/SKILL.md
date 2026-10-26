---
name: jxx-implement-spec
description: "按整份 spec/PRD 批量推进实现。当用户说实现 spec、实现全部工单、整轨跑时触发。单工单不要用这个。"
disable-model-invocation: false
metadata:
  version: 1.8.2
---

你拿到了一份 spec/PRD（`.scratch/<NN>-<slug>/PRD.md` + `issues/*.md`）。目标：把这份 PRD 的**全部工单**经统一流水线（开发 → 审查 → 合并 → **回收**）交付到 **main**——每张工单审查通过后默认直合 main（v0.14.0 起，ADR-011）；技术受阻的暂存 PRD 分支 `ticket/<NN>-<slug>`，收口时清入 main。**收口是四段闭环**（v0.15.0，ADR-012）：复核 → 合入前 `merge-check` 预演冲突面 → 合入 main → `rm-wt` 回收工作空间（工作树 + 已合入分支）；第四段以前没有判据，实测积下大量孤儿分支与挂着的 worktree。

**统一改造（v1.1.0）**：本技能不再是独立的单分支+PR 流，而是 **jxx-ticket-board 看板 auto 模式在单会话内的整轨特化**——与 `/jxx-implement`（工单级开发面）共用同一个看板、同一套 worktree、同一条合并流（`jxx-ticket-board` 技能 `references/ADR-009-in-project-and-prd-branch.md`，合并流默认回合 main 见其 `references/ADR-011-main-first-merge.md`）。ticket 不是步骤列表，而是一张带阻塞关系的**任务图**；任何时刻都存在一个「就绪前沿」（Blocked by 全部 done 的工单集合）。

与子 agent 的通信应当稀疏，主要通过**上下文指针**交流（卡 id、PRD/工单文件路径、既往 commit），不要复述指针已能获取的信息。**实现者子 agent 尽可能在后台运行**，以获得最大并发。

## 步骤

0. **看板就位（in-project 统一布局）**：项目根无 `control/workspace.json` 则先
   `node <jxx-ticket-board 技能目录>/scripts/board.mjs init --root <项目根>`（自动判定 in-project：wt/ 与 control/ 落在项目里，快照走 control/ 嵌套 git，不进产品仓历史）。有则跳过。
   **`jxx-ticket-board` 没装时不要硬跑这条**：那就是没有看板，整轨执行面不成立——先装它，或改走 `jxx-implement` 的单工单流，不要编造 `control/` 目录。

0b. **服务器工作区 bootstrap（服务器优先 · v1.2.0 默认）**：`node tools/jxx-bootstrap.mjs --root <项目根>`——线上无该 repo_key 工单时**自动先创建**（种子工单 + 本地投影基准）再继续；已有则幂等退出。PRD 本体经 `jxx_ticket_call create` 上行（labels 带 `prd:<NN>-<slug>`；**写腿不 create**）。**v1.8.0 起各工单的状态流转 / 打卡 / 评论走写腿一条命令**：`node tools/ticket-flow.mjs --root <项目根> --file <单条工单md> --set status=<本地词表> --comment "<一句话>"`——一条命令完成「改本地 md + 推服务器」（payload 只含本次真改字段，`version_conflict` 自动重拉重试一次）；exit 0 收敛 / exit 2 评论撞上「服务器版本已前进」按条目 `server`/`local`/`resolution` 裁决后重跑 / exit 3 本地已还原或未变（`rolled_back:true` = 已回滚）。**不要再先手改 md 再推**；写腿只推本次真改字段，验收点/正文段落这类整篇修订改完 md 后跑只读腿 `--file` 收敛。**项目没有 `tools/ticket-flow.mjs` 时回退 MCP 双写**：先改本地 md → `get` 拿最新 `version` 作 `base_version` → `jxx_ticket_call update`（409 先对账再推），批量 push 的 id 从当次 `list` 实测逐条核对（串位会把正文写进邻居工单，2026-10-15 实测事故）。编排者把这套纪律随 worker 提示词下发；worker 侧细则见 jxx-implement v1.10.0 同名节，口径见 `references/ADR-010-server-first-tickets.md`（jxx-ticket-board 技能内）。

1. **读任务图**：读 PRD 与全部工单，理解任务图与就绪前沿。（PRD 分支 `ticket/<NN>-<slug>` 自 v0.14.0 起**不再预建**——只在工单合并受阻时由合并专员惰性创建作暂存道，PROTOCOL §3。）

1b. **AC → 工单映射缺口审查（v1.7.0 起，投卡之前，不可跳过）**：读 PRD 与 `.scratch/<NN>-<slug>/map.md` 的「## AC 覆盖矩阵」与「## 覆盖闸」（节名与列义见 `jxx-to-tickets` 技能 `references/acceptance-criteria.md` §一 / §八；该技能没装则按 `map.md` 既有节名沿用，缺节就照 §一 的「用户故事 → 工单 → AC」三列自建。覆盖闸另查 用户诉求、决策 两源），逐条用户故事核对「用户故事 → 工单 → AC」链路，产出**缺口清单**（用户故事编号 / 缺什么 / 该补哪张工单）。任一用户故事未被任何工单的 `AC-<n>` 覆盖 ⇒ **停止编排**，先补工单（退回 `jxx-to-tickets` 或就地补 AC），再跑 `node <jxx-to-tickets 技能目录>/scripts/ac-audit.mjs <功能目录> --strict` 至硬问题 0、缺口清单清空，才进步骤 2。

2. **整批投卡**：对每张 `**Status:** ready-for-agent` 的工单投卡——
   `board.mjs new-card --root <项目根> --id <NN>-<MM>-<slug> --level <L1-L4> --model <档位> --ticket-file <工单绝对路径> [--deps <阻塞卡id>]`。
   投卡自动完成三件事：状态闸门（非 ready-for-agent 拒投）、依赖闸门（Blocked by 未归档的卡自动进 held/ 暂缓道）、**合入目标**（卡面 `- 合入目标: main`——v0.14.0 起默认回合主分支）。

3. **按 auto 模式编排**（编排者职责即 `control/PROTOCOL.md` §5；worker/审查者/合并专员的启动提示词在 `control/starter/`）：
   - 对每张无阻塞的待领卡（`open/<卡id>.md` 无后缀）spawn **worker 子 agent**（`control/starter/dev.md` 全文 + 指定卡 id）。worker 全程走 `/jxx-implement`：领卡 → `add-wt`（一律从 origin/main 拉工单分支）→ 开发 → 三段硬出口 → 交付移卡到 review 位。**worker 必须遵守 `/jxx-implement` 的「步骤打卡与断线续接」纪律**（v1.6.0）：动手前列 `**处理步骤：**` 清单进工单文件，每完成一步就地打卡并用写腿命令双写服务器——编排者自身中断后，worker 现场（打卡区 + 卡面）就是续接依据，不重做已完成步骤。**下发工作区必须含该工单 AC 全集**（工单文件 `AC-<n>` 行一条不缺，缺则先补再 spawn）。worker 按 `/jxx-implement` 1.12.0「验收点闭环」执行（开工抄 AC 进「**AC 勾选区：**」→ 逐条勾选附证据 → 全勾才置 `pending-review`），交付时卡面「AC 覆盖表」逐条填 `met` / `partial` / `missing`，禁止留空或写「全部完成」。
   - 卡到 `open/<卡id>.review.md` → spawn **3 个审查者**（`control/starter/reviewer.md`，std/spec/rule 三维度并行，`--base` = origin/main）。全过 → spawn **合并专员**（`control/starter/merger.md`）；任一审查者有发现项 → 汇总写回卡 → 卡回 claimed 位返工 → 重新 spawn worker。**审查者的 spec 维度必须输出逐 AC 判定表**（AC 编号 / 判定 `met`|`partial`|`missing` / 自己取的证据），`partial` 与 `missing` 一律计发现项（规范第五节）；存在 `missing` 时卡不得进合并专员，先返工重审。
   - **合并专员默认把工单分支回合 main**（rebase/diff 基准 = origin/main；受阻暂存 PRD 分支或 blocked，且必须向用户汇报不能回合的原因——PROTOCOL §3）。合入是**四段闭环**：① 定点复核 ② **`board.mjs merge-check --root <项目根> --id <卡id>` 预演冲突面**（内存三方合并、不落现场）③ 合入 main ④ **`board.mjs rm-wt --root <项目根> --ticket <卡id>` 回收工作空间（工作树 + 已合入分支）** → 双卡移 done/。
     - **冲突分诊**（merge-check 的输出直接决定去向）：`·机械候选`（内容类）逐 hunk 保留双方意图自解（`jxx-resolving-merge-conflicts`，绝不 `--abort`），**解完 diff 已变 ⇒ 必须重跑 `/jxx-code-review` 再合**；`✗非机械`（binary / modify-delete / rename）不许合并专员拍板 ⇒ 交回开发组。
     - **别假设 merger 做全了第四段**：每卡收口后跑 `board.mjs verify --root <项目根>`，出现 `MISMATCH 未回收工作树/分支 <卡id>` 就按提示补 `rm-wt`（**一次一卡**，红线 §7）——这是本技能唯一该碰 worktree 的动作。
   - 前沿推进：依赖卡归档 done 后，held/ 里依赖已齐的卡释放回 open/（`card-move --to inbox`），立即 spawn 新 worker，保持最大并发。
   - 失败处理（协议 §5.5）：worker 失败先重试一次；僵死卡（30 分钟无动静）重 spawn；合并冲突按 merge-check 分诊——机械候选自解（解后重审）、非机械 blocked 交回开发组；合入后未回收由本会话补 `rm-wt`；编排者自身中断 → `board.mjs verify --root <项目根>` 重建状态续接。

4. **PRD 收口（触发二选一）**：① 本 PRD 全部工单 `done`/`wontfix`；② 用户明确要求。**两者之外不得把 PRD 分支合进 main**。收口 = 清暂存 + 状态收口 + **回收现场**（PROTOCOL §3.1；可自投 PRD 收口卡 `merge-<NN>-<slug>` 走合并专员，或本会话直接执行）：
   - 暂存分支 `ticket/<NN>-<slug>` 存在 → 先 `board.mjs merge-check --root <项目根> --id <NN>-<slug>` 看冲突面（整支分支更易与 main 分叉，预演比逐单更有必要），再对整支 PRD 分支跑 `/jxx-code-review`（`git diff origin/main...ticket/<NN>-<slug>`），发现项投普通开发卡返修后重审；冲突分诊同步骤 3；
   - 审查过 → `git -C <项目根> fetch` → rebase PRD 分支到最新 `origin/main` → 合入 main 并 push；无暂存（全部工单已直合 main）→ 跳过清入；
   - 把 `PRD.md` 的 `**Status:**` 置 `done`（随合并提交或在 main 工作区另提）；暂存清不进 main 时按 §3 硬性要求向用户汇报原因，**且不回收现场**（活还没上 main）；
   - **回收本 PRD 全部残留现场**：逐张 `board.mjs rm-wt --ticket <单卡id>`（**一次一卡**，红线见 PROTOCOL §7），清掉各工单的 worktree 与已合入分支——这是收口的最后一步，不做等于没收口；收完 `verify` 应以「零条未回收」告终；
   - **收口前置（v1.7.0）**：对每个工单文件跑 `node <本技能目录>/scripts/ac-audit.mjs <工单文件>`，退出码必须全为 0（脚本随本技能分发，副本与 `jxx-to-tickets` 同源；万一缺失，按 `jxx-to-tickets/references/acceptance-criteria.md` 自查，不得跳过）；且 PRD 覆盖矩阵无空洞（每条用户故事至少 1 个判 `met` 的 AC）。任一不满足 ⇒ 不得宣布收口。
   - 记账、刷看板（`board.mjs html --root <项目根>`），向用户汇报：合入 commit、各工单去向、**未能回合 main 的卡及原因**、遗留事项。

5. **散工单不属于本技能**：无 PRD 的单张工单走 `/jxx-implement`（合入目标自动 = main，审查通过确认没影响后由合并专员直合 main）。
