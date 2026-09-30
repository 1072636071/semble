# ADR-008：公告板改「三态目录 + 文件名执行态 + triage 标签」三轴正交（D9 落地）

- 状态：已接受（2026-09-30 · 领导者终审批准，账本 10:37:24 订正版；工单 75-c01 落地件，独立复审报告见权威仓 `.scratch/75-jxx-ticket-system/reviews/75-c01-code-review.md`）
- 关联：ADR-004（本单修订其决策 1/3）、ADR-002、ADR-007；PRD 75「解决方案」段 D9 决策、`docs/agents/triage-labels.md`
- 说明：本 ADR 属 **jxx-ticket-board 技能系列**（`references/ADR-00N`），与权威仓 `docs/adr/` 的产品 ADR 编号无关，别混引。

## 背景

PRD 75 要把本地公告板与服务器工单系统统一成同一套心智（D9）：生命周期只有三态 `open → done → archived`，「下一步该谁动」交给五个 triage 标签表达。而现役公告板是五泳道目录（`inbox/claimed/review/done/blocked/` + 领导者 `held/`），把**三件事挤在同一根轴**上：

- `inbox / claimed / review` 其实是**执行态**（谁在做、做到哪一步），却用目录表达；
- `blocked` 其实是 triage 的 `needs-info`，也用目录表达；
- `done` 同时混了「已合入」与「已废弃」。

矛盾点在 ADR-004：**领取必须靠文件系统的原子 rename 防抢**。若照 D9 把 `claimed` 折进 `open/` 后用卡内字段（或 labels）记录「谁领了」，读-改-写没有原子性，两个 worker 可同时"成功"领取同一张卡——这正是 ADR-004 当初**明确否掉**的方案①（平铺 + frontmatter 租约字段）。而工单 c01 的验收 #2 又把标签维度钉死为五标签，其中没有任何一个能表达「已被领走 / 待终审」。

## 决策

1. **三条轴各自有载体，互不越界**：

   | 轴 | 载体 | 取值 |
   |---|---|---|
   | 生命周期 | 目录 | `cards/open/`（未收口）· `cards/done/`（已收口）· `cards/archived/`（wontfix / 让位 / 不再执行） |
   | 执行态 | 文件名后缀 | `<卡id>.md` 待领 · `<卡id>.claimed.md` 在办 · `<卡id>.review.md` 待终审 |
   | triage 下一步 | 卡面 `- labels:` 行 | `ready-for-agent` / `ready-for-human` / `needs-info` / `needs-triage` / `wontfix`（不增不减） |

   `held/` 保持原样（领导者私有暂缓道，worker 不可见不可动，本单不动它以控 diff 面）。
2. **流转 = 改名，仍在 `open/` 内**：领取/交付/返工/受阻都是**同盘原子 rename**（或 `card-move` 代劳），ADR-004 的防抢语义一字不损；`blocked` 不再是目录，`card-move --to blocked` 把卡落回待领位并自动补 `needs-info`。
3. **账本 token 不随目录改名而变**：`move <卡id>.md <from>-><to>` 里的 `<from>/<to>` 继续是**工作流位 token**（`inbox/claimed/review/done/blocked/archived/held`）。于是五泳道时代留下的几百条历史行**无需改写就仍能逐条回放**——历史账本是审计面，改一条就等于造假（2026-09-30 事故的教训之一正是「重建件冒充原始记录」）。`verify` 对 `->blocked` 的闭合判据在迁板后自动变成「卡在 open 待领位 **且** labels 带 needs-info」。
4. **薄卡增 `- doc_ref:`**：服务器工单 URL（手填 `<部署域>/tickets/<工单id>`，路由规则见 PRD 75 前端段 `/tickets/:id`），与本地 `PRD:` 行（权威仓文件路径）分列——本地路径冒充 URL 会被 `verify` 判 MISMATCH。
5. **迁板只改名、不删目录**：`migrate` 建 `open/done/archived` → 逐张 rename + 补 labels → 记一行账 → 留快照。旧泳道目录留空存在（红线 §7.2 禁删），因此额外加一条红灯：**三态板若在旧泳道目录里扫到 `.md`，verify 报 MISMATCH 并给出可直接照做的改名目标**——否则照旧协议 `mv` 进去的卡会「写成功却永远看不见」。
6. **同一 id 占两位（如同时有 `x.md` 与 `x.claimed.md`）判 MISMATCH**，这是改名方案唯一的新腐坏面，必须机检。

## 后果

- 正面：与服务器端心智一致（三态 + 标签）；`ls open/` 一屏看完未收口全貌；board.html 渲染三列 + 标签色标 + 执行态徽标；防抢仍是 OS 兜底；历史账本零改写。
  > **v0.11.0 / v0.11.1 显示层修订**：`board.html` 的**呈现**改为四泳道视图（待领取 · 处理中 · 待审核 · 阻塞），列由执行态 token 派生（三态板读文件名后缀 + `needs-info` 标签，未迁的旧板读目录名），历史面 done/archived 默认折叠。**本 ADR 的三条轴与「领取 = 原子改名」不变量原样不动**——新增的 `- Harness:` / `- LLM:` / `- 开始处理:` / `- 结束处理:` **四行**属**统计面**，`verify` 不按它们判位，因此不构成被否方案①（执行态进卡内字段）的回潮。
- 负面：状态集变更需迁板（本单提供 `migrate`）；agent 必须遵守「先改名成功才动卡内容」的顺序（协议 §1.2 已改写）；文件名不再是纯 `<卡id>.md`，凡以文件名反推 id 的地方一律走 `cardIdOf()`（脚本内已全部收口，第三方消费卡目录的脚本需注意）。
- 被否方案：① 执行态进 labels / frontmatter 字段——无原子性，即 ADR-004 被否的方案①；② 给五标签增设 `claimed`/`in-review`——破 c01 验收 #2 的五标签钉死，且让 triage 轴重新背上执行态（回到一轴三义的起点）；③ 保留五目录只加 labels——与服务器心智不一致（D9 未落地），验收 #1/#3/#6 全不成立。

## 修订 ADR-004

决策 1 的目录集合与决策 3 的 move 目标按本 ADR 更新：**目录 = 生命周期三态，执行态移到文件名后缀**；「领取 = 原子 move 防抢」这条不变量原样保留（这也是本 ADR 选择文件名后缀而非标签承载执行态的唯一理由）。
