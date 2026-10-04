# 工单公告板协议（PROTOCOL）— 唯一真源

> 你是被用户拉起的 agent。本文件是你全部工作规则的出处，先完整读完再行动。
> 工作区根目录：`{{ROOT}}`　权威仓库：`{{REPO_URL}}`（基准分支 `{{BASE_BRANCH}}`）

## 0. 环境与术语

布局两种形态（init 自动判定）：**in-project（默认，三技能统一布局）** = root 就是项目仓库自身，wt/ 与 control/ 直接落在项目里（产品仓 `.gitignore` 忽略这两者，看板快照走 control/ 内嵌套 git，绝不进产品仓历史）；**外置（旧形态）** = root 是独立工作区，权威仓在 root/repo 或 `--repo-dir` 指定的外部路径，看板由工作区根 git 自保。

```
{{REPO_PATH}}\       权威主工作区（in-project 模式 = {{ROOT}} 自身；外置模式 = 外部路径，worker 不在此干活）
{{ROOT}}\
├── wt\<卡id>\       工单工作区，一人一目录，分支 ticket\<卡id>
└── control\         公告板（in-project = control/ 内嵌套 git 自保；外置 = 工作区根 git 自保，见 §7）
    ├── PROTOCOL.md  本文件
    ├── ledger.md    领导者账本（只追加，一行一动作）
    ├── board.html   用户进度看板（四泳道 = 执行态：待领取 · 处理中 · 待审核 · 阻塞；已完成/已归档默认隐藏，页头开关展开；谁移卡谁刷）
    ├── prd.html / human.html   PRD 看板（未完成/已完成两栏，已完成默认折叠）· 人工待办面板
    ├── CARD-TEMPLATE.md
    ├── starter\     角色启动提示词（dev / merger / reviewer / auto）
    ├── cards\open\        未收口（待领 · 在办 · 待终审）
    ├── cards\done\        已收口（合入并归档）
    ├── cards\archived\    已归档（wontfix / 让位 / 不再执行）
    └── held\              领导者暂缓道（依赖未就绪的卡停这里，worker 不可见、不可移入移出）
```

- **工单卡**：一个 md 文件 = 一张卡 = 一个 `.scratch\` 工单 = 一个分支，严格 1:1（薄卡：卡只放指针与协调记录，**成果正文一律进 git 分支**）。
- **工单真源（服务器优先，ADR-010）**：服务器（jxx-ticket REST = 线上 /tickets 看板）是工单真源，本地 md 是创作面与离线投影。开工前先 `node tools/jxx-bootstrap.mjs --root <项目根>`——线上无该 repo_key 工单时**自动先创建**（种子工单 + 投影基准）再操作；已有则幂等退出。状态流转双写服务器（`jxx_ticket_call update`）；离线时照常直写本地 md，回连 `jxx_ticket_sync` 收口。
- **三条正交轴（D9，别再往目录里塞第二件事）**：

  | 轴 | 载体 | 取值 |
  |---|---|---|
  | 生命周期 | 目录 | `open/` 未收口 · `done/` 已收口 · `archived/` 废弃让位 |
  | 执行态 | 文件名后缀 | `<卡id>.md` 待领 · `<卡id>.claimed.md` 在办 · `<卡id>.review.md` 待终审 |
  | triage 下一步 | 卡面 `- labels:` 行 | `ready-for-agent` / `ready-for-human` / `needs-info` / `needs-triage` / `wontfix` |

- **受阻不是目录**：三态后没有 `blocked\`。受阻 = 卡留在 `open\` 待领位 **+** `labels:` 带 `needs-info`（`board.mjs card-move --to blocked` 自动这么落）。需要人拍板的 = `labels: ready-for-human`。
- **状态即位置，但「谁领的」仍靠原子改名**：领取/交付/返工都是**改名**（rename），文件系统排他性兜底防抢——执行态放文件名而不是放标签，正是为了保住这条（详见 `references/ADR-004`、`ADR-008`）。流转 = 移动/改名文件。
- 旧五泳道板迁三态走 `board.mjs migrate --root <root> [--dry-run]`（只改名 + 补 labels + 记一笔账，**不删旧目录**，可回退）。

## 1. 领取规矩（防抢，不可协商）

0. **难度是给用户的**：卡的「难度/模型档位」供用户拉起会话时选配 LLM，worker 不必自报档位、不得以此互相挑活；领卡顺序只看「依赖」。唯一软规则：若用户启动时明示"你跑的是快速/廉价模型"，遇 L3/L4 卡优先让给他人，回报用户而不是硬着头皮接。定级判据（领导者投卡时按此定级并记账）：
   | 级别 | 判据 | 建议模型 |
   |---|---|---|
   | L1 | 机械改：单文件、卡内指令明确（改文案、补字段、加日志） | 快/便宜模型 |
   | L2 | 有界实现：规格清晰、跨 2-4 文件、无设计决策 | 中档 |
   | L3 | 需判断：跨模块、要选实现方案、要动测试架构 | 强模型 |
   | L4 | 设计级：改公共接口/数据模型/协议本身 | 最强模型 + 双重审查（组内审 + 独立干净会话复审） |
1. 看活只找 `cards\open\` 里**没有后缀**的卡（`<卡id>.md` = 待领；`.claimed.md` / `.review.md` 别碰）；**开发卡** id 形如 `NNN-slug`，**合并卡** 形如 `merge-NNN-slug`（只有合并专员领后者）。依赖未就绪的卡由领导者投卡时自动收进 `control\held\`（等依赖卡归档 done 后释放回 open），worker 对 held 既不看也不动。
2. 领取 = 先改名，后填卡（**改名是原子的，抢卡只有一个能成功**）：
   ```bash
   mv "<root>\control\cards\open\<卡id>.md" "<root>\control\cards\open\<卡id>.claimed.md"
   ```
   改名成功 → 卡归你；报"文件不存在"或目标已存在 → 已被他人抢走，换下一张。**绝不允许先在卡里写字再改名。**
   更稳的姿势是让脚本代劳（它同时记账 + 刷看板 + 盖处理开始时间戳；`--harness`/`--llm` 自报你所在的 harness 与 LLM 模型，见 §4）：
   ```bash
   node {{SKILL_DIR}}/scripts/board.mjs card-move --root "{{ROOT}}" --id <卡id> --to claimed --actor <你的会话标识> --harness <harness 名> --llm <模型名>
   ```
   **每次移卡之后（领取/交付/blocked/返工皆同）必须刷看板**，用户的浏览器靠这一步保持追踪：
   ```bash
   node {{SKILL_DIR}}/scripts/board.mjs html --root "{{ROOT}}"
   ```
3. 领到后立即在卡的「领取记录」追加：领取者（你的会话标识/角色名）、分支 `ticket/<卡id>`、工作目录 `wt/<卡id>`、UTC+8 时间。
4. 开辟工作区：若 `{{ROOT}}\wt\<卡id>\` 已存在（领导者预开），直接进入装依赖；否则
   ```bash
   node {{SKILL_DIR}}/scripts/board.mjs add-wt --root "{{ROOT}}" --ticket <卡id>
   ```
   **基分支（默认回合 main，v0.14.0）**：未显式给 `--base` 时一律从 `origin/main` 拉——所有工单（含 PRD 工单）diff 只含自己的活；PRD 分支不再预建，只在合并受阻时由合并专员惰性创建作暂存道（§3）。
   然后在 `wt\<卡id>\` 内安装依赖、按卡的 PRD 指针读工单正文开工。

## 2. 开发组规则

- **推进方式（强制）**：领到开发卡后全程用 `/jxx-implement` 技能推进（harness 未装该技能 → 卡记 blocked 回报用户，不得裸写绕过）。其三段完成硬出口——①工单 `Status:` 置 `pending-review` ②`/jxx-code-review` 审全部变更、有发现项即修复重审、通过前不得提交 ③审查通过后工单置 `done` 并 commit 到分支——**全部做完才是本卡可交付的前置条件**。
- 交付 = 移动卡：jxx-implement 三段出口完成后，在卡「交付记录」追加提交范围 + 审查报告指针，并把**需要终审实证的事项逐条写进「终审待验清单」**（验收关键项+自报结论+越界/豁免声明——合并专员将逐项实证，写虚的会被打回），然后
  `mv open\<卡id>.claimed.md open\<卡id>.review.md`（或 `card-move --to review`），**刷看板（§1.2 的 html 命令）**，并回报用户"已交付待终审"。
- 组内其余流程自定（jxx 系列技能照常），但成果必须满足：
  1. 一切成果（代码、工单文档增量、**审查报告**）都在 `ticket/<卡id>` 分支上；审查报告放分支内 `.scratch/<工单>/reviews/`，审查报告即 /jxx-code-review 产物（干净视角执行，针对 `git diff {{BASE_BRANCH}}...ticket/<卡id>`）。
  2. 分支已 commit 整齐（无未提交残留），已 `git push origin ticket/<卡id>`（remote 是成果备份面）。
- 返工：卡被改回 `open\<卡id>.claimed.md`（终审意见写在卡的「流转追加段」）→ 继续在原 worktree/分支干活，改完再交。
- **交付后现场不归你管**：合并专员复核、预演、合入后按 §3 第四段回收 `wt/<卡id>` 与已合入的 `ticket/<卡id>` 分支。**别自己删**（可能还在返工路径上），也别假设现场会永远在——交付即意味着你这一轮的原 worktree 随时可能被回收。
- 干不下去：卡「流转追加段」写原因，然后 `card-move --to blocked`——三态下这一步**不新建目录**：卡回到 `open\<卡id>.md` 待领位并被自动打上 `needs-info` 标签，**刷看板**，回报用户。等人拍板用 `card-set --field labels --value ready-for-human`。
- 禁止：动权威工作区（`{{REPO_PATH}}`）主干、提交到 `{{BASE_BRANCH}}`、移动他人 `.claimed` 的卡、把成果正文只写在卡里。

## 3. 合并专员规则（先审后合 · 默认回合 main · 收口即回收）

> **本节的四段是一次不可拆的收口动作**：定点复核 → 预演并处置冲突 → 合入 main → **回收工作空间**。
> 前三段做完就算完、第四段落下，是 2026-10 实测到的真实故障形态：某项目积下 **105 个 `ticket/*`
> 分支对 13 个 worktree、11 张 `done` 卡里 6 张仍挂着 worktree**——缺的不是纪律，是判据（收口位
> 此前一条闸门都没有）。第四段现在有确定性判据兜底（`verify` 回收对账），别指望下一个人记得。

- 领 `merge-<卡id>` 卡（协议同上，先 move 后填）。同一时刻**只处理一张**合并卡，多张按卡内顺序。
- **合入目标：一律默认 `main`（v0.14.0 起，PRD 工单同此）**。工单完成审查后默认直接回合主分支。

**第一段 · 定点复核（干净视角，碰 git 之前）**：读对应开发卡（`open\<卡id>.review.md`）的「终审待验清单」与「交付记录」，对照工单 PRD 验收标准，用只读 git（`git show <分支>:<路径>`、`git diff origin/main...<分支>`、`git grep`）+ 可派只读子代理，逐项实证 worker 自报是否属实：修复真在？越界夹带？报告实体？清单每项给 闭合✓/未闭合✗+证据。**diff 基准 = `origin/main`**（所有工单分支都从 main 拉出）。复查不过 ⇒ 见本节末「复核不过」。

**第二段 · 预演（先看冲突面，再碰工作树）**：

```bash
node <skill>/scripts/board.mjs merge-check --root <root> --id <卡id>
```

`merge-check` 用 `git merge-tree --write-tree` 在**内存里**做三方合并——不改 index、不动 HEAD、不建 commit，预演多少次都不会污染任何工作区（这正是重点：在真工作树上试错 rebase，会留下半途现场，且严格意义上使原审查失效，见 ADR-005）。输出四个 VERDICT 之一：

| VERDICT | 含义 | 动作 |
|---|---|---|
| `already-merged` | 零领先 `origin/main` | 无需再合 ⇒ 该裁决归档 + 回收（别合一个空 diff） |
| `merge-clean` | 预演无冲突 | 进第三段，rebase 预期干净 |
| `conflict` | 有冲突，已逐文件列名 | 按下方**冲突分诊**处置 |
| `merge-failed` | 退出非零但未列冲突文件 | 异常：人工看 `git merge-tree` 原始输出再说 |

**冲突分诊（`conflict` 时，按 `merge-check` 的标记分两路）**：

- **`·机械候选`（内容类冲突，`[content]`）** ⇒ rebase 后逐 hunk 解决，**保留双方意图**、绝不发明新行为，按 `jxx-resolving-merge-conflicts` 五步走（追溯来源 → 逐 hunk → 跑自动化检查 → 完成 rebase，**绝不 `--abort`**）。**解决完 diff 就变了 ⇒ 原审查失效，必须重跑 `/jxx-code-review` 再合**（ADR-005 记的正是这条）。
- **`✗非机械`（binary / modify-delete / rename 类）** ⇒ **不许合并专员自行拍板**：这几类没有可逐 hunk 保留的「双方意图」（二进制读不出 hunk；modify-delete 要决定删还是留；rename 要决定名字），收场必然要发明行为。把开发卡改名回 `open\<卡id>.review.md`，在流转段写清冲突面，交回开发组按 `jxx-resolving-merge-conflicts` 处理。
  注意二进制的报法：git 对它同样报 `CONFLICT (content)`，真正的信号是 `warning: Cannot merge binary files`——`merge-check` 已替你分辨，**别只看括号里的类型**。

**第三段 · 合入**：`git -C "{{REPO_PATH}}" fetch` → 把 `ticket/<卡id>` rebase 到最新 `origin/main` → **确认没影响**（diff 面限于工单声明范围、本地门禁/测试绿、无越界夹带）→ 合入 **main** 并 push。

**第四段 · 回收工作空间（收口的定义里就有这一段）**：

```bash
node <skill>/scripts/board.mjs rm-wt --root <root> --ticket <单卡id>
```

**回收 = 工作树 + 分支两件**。分支该不该删由**合入实况**裁定，不靠人判断：`rm-wt` 自动数 `origin/main..ticket/<卡id>`——零领先（已全部合入）才删分支；仍有领先 ⇒ **默认保留并报明领先数**（未合入的活不能删），此时要么合入后重跑 `rm-wt`，要么确认已暂存/已放弃后用 `--delete-branch` 强删；要留着复查用 `--keep-branch`。一次一卡，禁止批量/递归删除（见 §7）。

**回收第四件 = 远端分支，两条硬出口（2026-10-04 实测新增，v0.15.1）**：`rm-wt` 只删本地分支；`rebase` 重放后原提交 hash 与 main 不再同链，「零领先」判据对**远端分支**永远看不出来——工单 104 系列实测残留两条 `origin/ticket/<卡id>`。故：

1. **删远端分支前必须零丢失实证，不许凭记忆删**：先 `git merge-base --is-ancestor <重放后hash> origin/main`（未重放的原始 hash 可直接 is-ancestor）；若原 hash 已不在 main 链上（rebase 场景），用 `git diff --stat <原hash> <重放后hash>` 确认差异文件**全部不属于本工单声明面**（那些是 main 上并行推进的兄弟提交，不是丢活）。两条实证任一不过 ⇒ 停手回报，不删。
2. **删后必须 `ls-remote` 复核零残留**：`git push origin --delete ticket/<卡id>` 后跑 `git ls-remote --heads origin ticket/<卡id>`，**空输出才算闭合**；有残留再删再查。`verify` 目前只对账本地两件（工作树 + 本地分支），远端残留它看不见——这条靠本纪律人工闭环；回收不完整 = 第四段没做完。

- **不能回合 main ⇒ 降级 + 汇报（硬性，缺汇报 = 流程未完成）**。技术受阻时按下表降级，且**必须当场向用户显式汇报不能回合的原因**（冲突面 / 哪个门禁红 / 卡在哪张依赖），同时在 merge 卡「流转追加段」与领导者账本各留一行：
  - **冲突判为非机械（见第二段分诊）**：不得自行发明——交回开发组（解决即改 diff，diff 变了必须复审）。
  - **rebase 干净但门禁/测试红，或本分支携带未上 main 的兄弟工单提交**（diff 越出本工单声明面，典型 = 同 PRD 依赖序未到）：
    - 工单**属 PRD** ⇒ **暂存降级**：把 `ticket/<卡id>` 合入 PRD 分支 `ticket/<NN>-<slug>`（**不存在则先从 `origin/main` 建**）暂存，等 §3.1 收口清入 main。工单 `Status: done` 照置（实现与审查已完成），但卡面与汇报必须注明「暂存于 PRD 分支，未上 main」。**暂存属于「没能回 main」**：开发卡的现场**不回收**（那分支上的活还没上 main），只回收已进 main 的部分。
    - **散工单** ⇒ 无暂存道：`card-move --to blocked`（自动带 `needs-info`），等人工拍板。
- **复核不过 → 打回**：merge 卡写明发现项后 `card-move --to blocked`（或按卡指示把开发卡改名回 `open\<卡id>.claimed.md` 附发现项）；**禁止带伤合并**；打回时不动现场（开发组要接着在原 worktree 干）。
- 例外：merge 卡若标注「领导者口径裁决未决」（L4 卡或跨单口径冲突），合并专员只做复核不做裁决，复核结论回报后待领导者拍板才可合。
- **合并成功（四段全做完才算）**：merge 卡追加结果（合入 commit、合入目标、复核结论行、回收结果、时间；**未能上 main 的写清原因与去向**），`mv → done\`，**刷看板**；对应开发卡由领导者移 `done\`。合入之后跑一次 `verify`：第四段若漏了，回收对账会直接点名（`MISMATCH 未回收工作树 wt/<id>` / `MISMATCH 未回收分支 ticket/<id>`）——**看到这两条就是第四段没做完**，照提示的 `rm-wt` 命令补齐即可，别把红灯当噪声。

### 3.1 PRD 收口：清暂存 + 状态收口 + 回收现场

- **触发二选一**：① 该 PRD 全部工单 `done`/`wontfix`（无论已直合 main 还是暂存 PRD 分支）；② 用户明确要求合并。两者之外**不得**把 PRD 分支合进 main。
- **收口 = 三件事**：a) 把 PRD 暂存分支（`ticket/<NN>-<slug>`，**存在才有**）上尚未上 main 的工单清入 main；b) 把 `PRD.md` 的 `**Status:**` 置 `done`；c) **回收本 PRD 全部残留 worktree 与已合入分支**。
- **PRD 收口卡**：领导者投 `merge-<NN>-<prd-slug>`（`--level L1 --keep-inbox`，PRD.md 状态非 ready-for-agent 时投卡加 `--force`），卡内写明：待清分支 = PRD 分支 `ticket/<NN>-<prd-slug>`、合入目标 = `main`、哪些工单此前因受阻暂存。
- **合并专员执行**：暂存分支存在 → 先 `merge-check --id <NN>-<prd-slug>` 看冲突面（整支分支更容易与 main 分叉，预演比逐单更有必要）→ 对整支 PRD 分支跑 `/jxx-code-review`（`git diff origin/main...ticket/<NN>-<prd-slug>`）→ 审查过 → rebase 到最新 `origin/main` → 合入 main 并 push；**无暂存（全部工单已直合 main）→ 跳过清入**。随后把 `PRD.md` 的 `**Status:**` 置 `done`（随合并提交或在 main 工作区另提）。
- **回收本 PRD 全部残留现场**：逐张 `rm-wt --ticket <单卡id>`（**一次一卡**，红线 §7），把该 PRD 各工单的 worktree 与已合入分支一并清掉——**这是收口的最后一步，不做等于没收口**。收完跑 `verify`：`MISMATCH 未回收工作树/分支` 应为零。
- 审查有发现项 → 投普通开发卡返修（返修后按 §3 重新直合 main，或再次暂存），修好重走收口。
- 暂存清不进 main（rebase 冲突 / 门禁红）时，同样按 §3 的汇报硬性要求向用户说明原因，卡留 `blocked` 等人工；**此时不回收现场**（活还没上 main）。

## 4. 卡内文法（verify 对账依赖，勿改）

- 记账的移卡动作：`move <卡id>.md <from>-><to>`（写在 `control\ledger.md`）。`<from>/<to>` 是**工作流位 token**：`inbox`（待领）· `claimed`（在办）· `review`（待终审）· `done` · `archived` · `blocked` · `held`。
  token 与物理路径的对应见 §0 三条轴表；**迁三态不改历史账本行**——`verify` 按 token 回放，`->blocked` 在三态板判「卡在 open 待领位 + labels 带 needs-info」为闭合（历史账本是审计面，改一条就等于造假）。
- 迁板动作：`migrate 五泳道->三态（N 张卡…）`，由 `board.mjs migrate` 自动记一行。
- 卡内记录行统一以 `- ` 开头，字段名前缀固定：`- 标题:`、`- 难度:`、`- 模型档位:`、`- 领取者:`、`- PRD:`、`- 分支:`、`- worktree:`、`- 依赖:`、`- labels:`、`- doc_ref:`（PRD/分支/worktree 即工单定位三件套，agent 据此找文件；labels 为 triage 五标签、doc_ref 为服务器工单 URL）。
- **处理计时四行**（看板「处理中」泳道的读数，`card-move` 自动盖章，一般不用手填）：`- Harness:` 处理者所处的 harness 名 · `- LLM:` 实际使用的 LLM 模型名 · `- 开始处理:` 进 claimed 位的时刻 · `- 结束处理:` 离开 claimed 位的时刻。
  领卡时**自报** harness 与 LLM：`card-move --to claimed --actor <会话标识> --harness <harness 名> --llm <模型名>`（例：Qoder / Claude Code / CodeBuddy / Cursor；模型名例：Claude Sonnet 4.5 / GPT-5 / DeepSeek-V3.2）；漏了就先在卡上留 `（未标注）`、看板红字提示，随时 `card-set --field Harness --value <名>` / `card-set --field LLM --value <名>` 补。
  **这四行是统计面，不是租约**：卡的位置唯一由目录 + 文件名后缀决定（§0 三条轴），字段写歪、留空、被人抹掉都不会改变卡的状态，`verify` 也不按它们判任何东西。
  旧卡（v0.11.0 之前投的）没有这四行也能出读数：看板回退取「流转追加段」里最后一条 `->claimed` / `claimed->` 行的时间，并在 `card-read` 里标 `[由流转段推得]`。
- `- labels:` **未收口三位（待领/在办/待终审）必填**——空标签等于 triage 维度失联，`verify` 第 5 路对账直接报 MISMATCH。取值只能是五标签之一或其一子集；`wontfix` 的卡不该留在未收口位（应 `archived\`）。

## 5. 自动编排模式（auto）

> 本节仅在 auto 模式下生效。auto 模式 = 领导者自动 spawn 子 agent 完成全流程，无需人工拉会话。

### 5.1 角色与职责

| 角色 | 职责 | 启动方式 |
|------|------|---------|
| **编排者（orchestrator）** | 投卡 → spawn worker → 监控进度 → 触发审查 → 触发合入 | 用户 `/jxx-ticket-board auto` 启动 |
| **开发 worker** | 领卡 → 实现 → 自审 → 交付 | 编排者 spawn |
| **审查者（reviewer）** | 三维度独立审查代码 | 编排者 spawn（3 个并行实例） |
| **合并专员（merger）** | 处理合并 + 冲突解决 | 编排者 spawn |

### 5.2 编排者规则

1. **投卡**：读用户指定的工单文件列表，逐张 `new-card` 投卡（含 `--ticket-file` 状态闸门）。
2. **spawn worker**：对每张无阻塞的待领卡（`open/<卡id>.md` 无后缀），spawn 一个独立子 agent（`subagent` 或 `spawn_teammate`，agent 自行选择——只要能独立上下文、尽可能并行）。worker 提示词 = `control/starter/dev.md` 全文 + 指定卡 id（`init` 实际产出的文件名就是 `dev.md` / `merger.md` / `reviewer.md` / `auto.md`，没有 `starter-` 前缀——写错即 ENOENT）。
3. **监控**：worker 回报后，检查卡位（看文件名后缀，不看目录）——
   - `open/<卡id>.review.md` → 触发审查（§5.3）
   - `open/<卡id>.md` 且 labels 带 `needs-info` → 读卡内原因，**先重试一次**（重新 spawn worker 或提示用户）；重试仍受阻 → 保留 needs-info，**继续推进其他不阻塞的卡**
   - `open/<卡id>.claimed.md` 超时（默认 30 分钟无动静）→ 视为僵死，重新 spawn worker 接力
4. **spawn 审查者**：卡在 `.review` 位时，spawn 3 个独立审查者（§5.3），并行审查。
5. **审查结果处理**：
   - 3 个审查者全部通过 → spawn 合并专员（§5.4）
   - 任一审查者有发现项 → 把发现项汇总写回卡的「流转追加段」，卡改名回 `open/<卡id>.claimed.md` 返工，重新 spawn worker
6. **spawn 合并专员**：合并专员领 merge 卡，执行合并 + 冲突解决。
7. **合入完成**：merge 卡移 `done/`，开发卡移 `done/`，记账，刷看板。

### 5.3 审查者规则（三维度并行）

三个审查者各自独立 spawn，**并行执行**，各审一个维度：

| 审查者 | 维度 | 审查内容 |
|--------|------|---------|
| **reviewer-std** | 标准 | 是否遵循仓库编码标准（命名、格式、import 形态、文件位置、错误处理模式） |
| **reviewer-spec** | spec | 是否匹配工单验收标准（每条验收标准逐条对码实证、功能完整性、边界情况） |
| **reviewer-rule** | 规则 | 是否违反文件级规则（CODING_STANDARDS.md / biome 规则 / 项目特定约束） |

- 每个审查者：读卡 + 读工单 PRD → `git diff {{BASE_BRANCH}}...ticket/<卡id>` 看全部变更 → 按各自维度审查 → 输出结构化报告（通过/不通过 + 发现项列表）。
- 审查者**不修改代码**——只审不改，发现项写给编排者汇总。
- 审查者用只读 git（`git show` / `git diff` / `git grep`），不 checkout 分支。
- **处理环境同样自报**（§4 的四行是卡面统计面，由**领卡者**盖；审查者不占卡位，所以只用流转行尾部一处）：把结论写回卡内时带上 `- <时间> | reviewer-<维度> | 通过/不通过（发现项 N） | 🛠 <harness 名>/<模型名>`。**不要**用 `card-set --field Harness/LLM` 去改卡头四行——那是领卡者的读数，覆盖它等于抹掉「谁在办」。

### 5.4 合并专员规则（auto 模式）

- auto 模式下合并专员由编排者 spawn，职责与 §3 一致——四段全走：先审后合、**预演冲突面**、**合入后回收工作空间**、禁止带伤合并。
- 合并专员处理合并冲突时：**先 `merge-check --id <卡id>` 拿冲突面**，再按 §3 第二段的分诊走——`·机械候选`（内容类）逐 hunk 保留双方意图自解，**解完 diff 已变 ⇒ 必须重跑审查**；`✗非机械`（binary / modify-delete / rename）**不许自解** → `card-move --to blocked`（= 卡回 open 待领位 + needs-info 标签），等人工处理。
- 合并成功 → **四段全做完**（含 `rm-wt` 回收工作树与已合入分支）→ merge 卡 + 开发卡移 `done/`，记账，刷看板。

### 5.5 失败处理

- **worker 失败**：先重试一次（重新 spawn）；仍失败 → `card-move --to blocked`（needs-info 标签），编排者继续推进其他卡。
- **审查失败**：发现项汇总 → 卡改名回 `open/<卡id>.claimed.md` 返工 → 重新 spawn worker → 重新审查。
- **合并冲突**：机械候选 merger 自解（解后重审）；非机械 → `--to blocked` 等人工。
- **合入后未回收**：编排者不要假设 merger 做全了——每张卡收口后跑一次 `verify`；出现 `MISMATCH 未回收工作树/分支 <卡id>` ⇒ 由编排者按提示的 `rm-wt --ticket <单卡id>` 补齐（**一次一卡**），再继续推进。这是 auto 模式下唯一允许编排者碰 worktree 的动作，且只走 `rm-wt`（红线 §7：不得交给子代理做批量回收）。
- **编排者自身失败**：`verify` 重建状态，从断点续接。

## 6. 断线 / 交接

- 你的全部状态都在：卡内流转段 + 分支历史 + worktree + 看板 git 历史（见 §7）。会话死了，新会话领同一张卡（用户指示下手动改「领取者」）即可续接。
- 拿不准现状就少做一步、多问用户一句；协议没覆盖的情况，**停下来问**，不要发明规矩。

## 7. 破坏性操作红线与看板自保（2026-09-30 事故后新增）

**事故**：2026-09-30 07:22，一次被授权的「批量回收 worktree」失控，把整个 `control\`（账本 + 254 张卡 + 三页看板）与多数 worktree 目录一并删掉；当时 `control\` 无版本控制 ⇒ 历史**不可还原**，只能按内存重建 16 张卡，其余约 242 张只剩索引。过程记录见 `control/RECOVERY-*.md`。 **事故取证入口**：harness 会话转录在 `~/.dsh/sessions/<cwd-slug>/<session-id>/session.v4.jsonl.zstd`，是**多帧 zstd**——按 4 字节魔数 `28 B5 2F FD` 切帧逐帧解压，即可回放某个子代理当时真正敲的命令（本轮即以此定位到「绕过 rm-wt、用 `cmd /c rmdir /s /q` 三次重跑」的事实）。

四条红线：

1. **回收只走授权通道**：`node <skill>\scripts\board.mjs rm-wt --root <root> --ticket <单卡id>`，**一次一卡**（工作树与分支两件同此红线——分支回收同样不得批量）。该命令只接受单段目录名、只删 `<root>/wt/<单卡id>`，越界即拒。禁止 `rm -rf` / `Remove-Item -Recurse` / 通配符 / 循环批量删除。
2. **`control\` 只读不删**：任何删除、清空、递归覆盖 `control\` 的命令一律禁止；改模板走 `board.mjs render --write`（旧版自动备份到 `control/.render-backup/`）。
3. **禁止把批量破坏性操作交给子代理**：领导者不得授权「把剩下的孤儿一起清了」这类批量动作；子代理只领**单张卡**的明确 id。批量清单留在 `control/human.html`，由人逐条确认后单张执行。
4. **禁止后台/长超时运行破坏性命令**：工具在超时后会把命令**提升为后台任务继续跑**（本仓 harness 的 pwsh 行为），于是「以为它超时了」时删除仍在进行、且无人再看输出。回收一律用 `board.mjs rm-wt`（有界、秒级），不要给它 `timeoutMs` 长值、不要 `run_in_background`；任何删除动作之后**必须先重新查实况**再下结论。
5. **破坏前先留档**：`control\` 由 git 自保——**in-project 模式**用 `control/` 内的**嵌套 git**（产品仓 `.gitignore` 已忽略 `control/`，快照绝不进产品仓历史；`git -C <root>/control log --oneline` 即看板历史）；**外置模式**用工作区根 git（`git -C <root> log --oneline`）。变更类命令（`ledger` / `card-move` / `card-set` / `new-card` / `card-rm` / `init`）每次自动留一版快照；大动作前后可显式跑 `board.mjs snapshot --root <root>`。**新外置工作区建仓口径**：`git init <root>` + `.gitignore` 写 `wt/`；in-project 由 init 自动补 `wt/`、`control/` 进产品仓 `.gitignore`。
