---
name: jxx-implement-spec
description: "按 spec/PRD 与其关联 ticket（任务图）整轨实现：建 PRD 分支、统一看板投卡、按 auto 模式编排 worker/审查者/合并专员完成开发-审查-合并；全部工单合入 PRD 分支后，PRD 完成或用户要求时才把 PRD 分支合入 main。触发词：实现 spec、implement the spec、按工单实现、PRD 整轨。"
disable-model-invocation: false
metadata:
  version: 1.2.0
---

你拿到了一份 spec/PRD（`.scratch/<NN>-<slug>/PRD.md` + `issues/*.md`）。目标：把这份 PRD 的**全部工单**经统一流水线（开发 → 审查 → 合并）交付到 **PRD 分支** `ticket/<NN>-<slug>`，并在收口条件满足时把 PRD 分支合入 main。

**统一改造（v1.1.0）**：本技能不再是独立的单分支+PR 流，而是 **jxx-ticket-board 看板 auto 模式在单会话内的整轨特化**——与 `/jxx-implement`（工单级开发面）共用同一个看板、同一套 worktree、同一条合并流（`jxx-ticket-board` 技能 `references/ADR-009-in-project-and-prd-branch.md`）。ticket 不是步骤列表，而是一张带阻塞关系的**任务图**；任何时刻都存在一个「就绪前沿」（Blocked by 全部 done 的工单集合）。

与子 agent 的通信应当稀疏，主要通过**上下文指针**交流（卡 id、PRD/工单文件路径、既往 commit），不要复述指针已能获取的信息。**实现者子 agent 尽可能在后台运行**，以获得最大并发。

## 步骤

0. **看板就位（in-project 统一布局）**：项目根无 `control/workspace.json` 则先
   `node <jxx-ticket-board>/scripts/board.mjs init --root <项目根>`（自动判定 in-project：wt/ 与 control/ 落在项目里，快照走 control/ 嵌套 git，不进产品仓历史）。有则跳过。

0b. **服务器工作区 bootstrap（服务器优先 · v1.2.0 默认）**：`node tools/jxx-bootstrap.mjs --root <项目根>`——线上无该 repo_key 工单时**自动先创建**（种子工单 + 本地投影基准）再继续；已有则幂等退出。PRD 本体也经 `jxx_ticket_call create` 上行（labels 带 `prd:<NN>-<slug>`），之后各工单状态流转双写服务器。口径见 jxx-implement v1.2.0 同名节与 `references/ADR-010-server-first-tickets.md`（jxx-ticket-board 技能内）。

1. **建 PRD 分支**：`git -C <项目根> branch ticket/<NN>-<slug> origin/main`（已存在则跳过）。读 PRD 与全部工单，理解任务图与就绪前沿。

2. **整批投卡**：对每张 `**Status:** ready-for-agent` 的工单投卡——
   `board.mjs new-card --root <项目根> --id <NN>-<MM>-<slug> --level <L1-L4> --model <档位> --ticket-file <工单绝对路径> [--deps <阻塞卡id>]`。
   投卡自动完成三件事：状态闸门（非 ready-for-agent 拒投）、依赖闸门（Blocked by 未归档的卡自动进 held/ 暂缓道）、**合入目标推导**（卡面 `- 合入目标: ticket/<NN>-<slug>` = 本 PRD 分支）。

3. **按 auto 模式编排**（编排者职责即 `control/PROTOCOL.md` §5；worker/审查者/合并专员的启动提示词在 `control/starter/`）：
   - 对每张无阻塞的待领卡（`open/<卡id>.md` 无后缀）spawn **worker 子 agent**（`control/starter/dev.md` 全文 + 指定卡 id）。worker 全程走 `/jxx-implement`：领卡 → `add-wt`（自动从 PRD 分支拉工单分支）→ 开发 → 三段硬出口 → 交付移卡到 review 位。
   - 卡到 `open/<卡id>.review.md` → spawn **3 个审查者**（`control/starter/reviewer.md`，std/spec/rule 三维度并行，`--base` = PRD 分支）。全过 → spawn **合并专员**（`control/starter/merger.md`）；任一审查者有发现项 → 汇总写回卡 → 卡回 claimed 位返工 → 重新 spawn worker。
   - **合并专员按卡的「合入目标」把工单分支合入 PRD 分支**（rebase 基准与 diff 基准都是 PRD 分支——不是 main）→ 双卡移 done/。
   - 前沿推进：依赖卡归档 done 后，held/ 里依赖已齐的卡释放回 open/（`card-move --to inbox`），立即 spawn 新 worker，保持最大并发。
   - 失败处理（协议 §5.5）：worker 失败先重试一次；僵死卡（30 分钟无动静）重 spawn；合并冲突机械自解、非机械 blocked 等人工；编排者自身中断 → `board.mjs verify --root <项目根>` 重建状态续接。

4. **PRD 收口（PRD 分支 → main，触发二选一）**：① 本 PRD 全部工单 `done`/`wontfix`；② 用户明确要求合并。**两者之外不得合 main**。收口执行（可自投 PRD 收口卡 `merge-<NN>-<slug>` 走合并专员，或本会话直接执行）：
   - 对整支 PRD 分支跑 `/jxx-code-review`（`git diff origin/main...ticket/<NN>-<slug>`），发现项投普通开发卡返修后重审；
   - 审查过 → `git -C <项目根> fetch` → rebase PRD 分支到最新 `origin/main` → 合入 main 并 push；
   - 把 `PRD.md` 的 `**Status:**` 置 `done`（随合并提交或在 main 工作区另提）；
   - 回收本 PRD 全部 worktree（`board.mjs rm-wt --ticket <单卡id>`，**一次一卡**，红线见 PROTOCOL §7）；
   - 记账、刷看板（`board.mjs html --root <项目根>`），向用户汇报：合入 commit、各工单去向、遗留事项。

5. **散工单不属于本技能**：无 PRD 的单张工单走 `/jxx-implement`（合入目标自动 = main，审查通过确认没影响后由合并专员直合 main）。
