# ADR-009：in-project 布局与 PRD 分支合并流（三技能统一改造）

- 状态：已接受（2026-10-01 · 用户指令：「统一 jxx-ticket-board / jxx-implement / jxx-implement-spec——三个技能都在项目里生成工作树、使用统一的看板机制、统一的自动开发/审查/合并；PRD 先合并到 PRD 分支，等 PRD 开发完成或用户要求合并，才合到主分支；没有 PRD 的散工单，处理完成确认没影响后合并主分支」）
- 关联：ADR-001（worktree 隔离，本单改其落点默认值）、ADR-002（control 外置，本单提供 in-project 例外）、ADR-005（合并即卡，本单给合并卡加「合入目标」维度）、ADR-007（协议单源，§3/§3.1 即本决策的协议落点）
- 说明：本 ADR 属 **jxx-ticket-board 技能系列**（`references/ADR-00N`），与权威仓 `docs/adr/` 的产品 ADR 编号无关，别混引。

## 背景

统一之前三个技能各行其是：

- **jxx-ticket-board** 把公告板建在项目**之外**的独立工作区（ADR-002「控制面出仓」），worker 的 worktree 挂在那个工作区的 `wt/` 下——agent 在项目本体里看不到自己的活，跨会话接力要先解释一遍「工作区在哪」；
- **jxx-implement** 没有 worktree 与看板概念，直接在当前分支上开发，三段硬出口（pending-review → code-review → done+commit）与公告板的卡位流转是**两套平行状态**，靠人肉对齐（ retro 2026-10-01：md 的 `Status:` 被误当实现进度真值）；
- **jxx-implement-spec** 自己另起一条 `ticket/<PRD号>-spec` 单分支 + draft PR 的整轨流，与公告板的「一卡一工单一分支」模型**双轨并存**（SKILL.md 原本就要专门写「防双轨」段来灭火）。

合并目标也没有规则：所有分支默认对 main 交付，于是 PRD 级工作要么整支一次砸 main（大爆炸合并），要么逐工单进 main（半成品 PRD 长期挂在主干上）。

## 决策

1. **统一布局 = in-project 为默认**：`wt/`（每工单一个 worktree，分支 `ticket/<卡id>`）与 `control/`（公告板）直接落在**项目仓库根**。产品仓 `.gitignore` 由 init 幂等补 `wt/`、`control/` 两行；看板快照用 `control/` 内的**嵌套 git** 自保（2026-09-30 事故的防线保留），**绝不**把 `control/` commit 进产品仓历史。外置布局（ADR-002 原形态）继续支持，`workspace.json` 的 `mode` 字段区分两种模式，旧工作区无该字段按 `repoPath === root` 推导。
2. **统一合并流 = 卡面「合入目标」**：投卡时按工单文件位置确定性推导并写进卡面 `- 合入目标:` 行——工单文件所在目录有 `PRD.md` ⇒ `ticket/<NN>-<slug>`（**PRD 分支**）；否则 ⇒ `main`（散工单）。merge 卡自动继承开发卡的合入目标；`card-read` 实时推导兜底。
   - **工单属 PRD**：审查通过后合并专员把工单分支**先合 PRD 分支**（rebase 基准与 diff 基准都是 PRD 分支，不是 main）。`add-wt` 不给 `--base` 时自动从 PRD 分支拉工单分支（PRD 分支不存在则先从 `origin/main` 建），保证每张工单分支的 diff 只含自己的活。
   - **PRD 分支 → main 只有两个触发**：① 该 PRD 全部工单 `done`/`wontfix`（PRD 开发完成）；② 用户明确要求合并。由领导者投 PRD 收口卡（`merge-<NN>-<prd-slug>`），合并专员对整支 PRD 分支跑 `/jxx-code-review` 后 rebase 合入 main，并把 `PRD.md` 的 `**Status:**` 置 `done`。
   - **散工单（无 PRD）**：审查通过后**确认没影响**（diff 面限于工单声明范围、本地门禁/测试绿、无越界夹带）→ 直接合 main。
3. **三技能同一条流水线**：jxx-ticket-board 是看板与编排面（领导者/auto 模式），jxx-implement 是开发面（硬前置 = 在卡的 worktree 里干活，三段硬出口不变），jxx-implement-spec 是 PRD 级整轨面（建 PRD 分支 + 整批投卡 + 按 auto 模式编排 + §3.1 收口）——不再有「双轨」，整轨就是公告板 auto 模式在单个会话内的特化。
4. **verify 假交付闸门的基准同步换**：review 卡分支「零差异」判据从 `origin/main..<分支>` 改为 `<合入目标>..<分支>`——PRD 工单相对 main 必然带着整支 PRD 分支的差异，旧基准会让假交付闸门在 PRD 流里永远失声（PRD 分支不存在时回退 `origin/main`）。

## 被否方案

- **看板随产品仓提交**（control/ 直接进产品 git）：产品历史被协调面污染，且多 agent 并行时产品仓每几分钟多一个 snapshot 提交——否；嵌套 git 让两个仓互不看见。
- **PRD 工单直接合 main、PRD 状态另行跟踪**：半成品 PRD 上主干，回滚粒度退化为逐工单 revert——否；PRD 分支是天然的整批交付与回滚单元。
- **合入目标让 worker 自报**：自由文本必然漂移（`main`/`master`/拼错的 PRD 分支名）——否；从工单文件位置确定性推导，机器闸（selftest）守护。

## 影响面

- `board.mjs` v0.12.0：`init`（in-project 自动判定 + .gitignore 幂等补行 + control/ 嵌套 git）、`snapshot`（按模式分流）、`new-card`（合入目标 upsert + merge 卡继承）、`add-wt`（基分支自动推导 + PRD 分支自动建）、`card-read`（合入目标派生行）、`verify`（假交付基准 = 合入目标）。
- `PROTOCOL.tmpl.md` §0/§1/§3/§3.1/§7、`CARD-TEMPLATE.tmpl.md`（`- 合入目标:` 行）、`starter-merger.tmpl.md`。
- 既有外置工作区**无需迁移**：行为一字不变；要切 in-project 就在项目根跑一次 `init`（幂等，已有文件 `kept`）。
- 旧版投的卡没有 `- 合入目标:` 行：`card-read` 与 `add-wt` 按 PRD 指针现场推导，不逼迁。
- selftest 115 → 128 项断言（in-project 初始化/嵌套 git 快照不污染产品仓/合入目标推导与继承/add-wt 基推导）。
