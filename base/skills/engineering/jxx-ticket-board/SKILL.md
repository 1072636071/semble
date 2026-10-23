---
name: jxx-ticket-board
description: 工单公告板：多 worktree 并行协作，本会话即领导者。触发词：工单看板、领卡、auto、合并。
disable-model-invocation: false
metadata:
  version: 0.16.1
argument-hint: init [--in-project] [--repo <git-url>] | board | verify | ledger --action <文本> | merge-check --id <卡id> | auto --tickets <工单文件列表>
---

# 工单公告板（领导者技能）

## 概述

把一个 git 仓库升级为**多工单安全并行**的公告板工作区。**v0.12.0 起默认 in-project 布局——工作树与看板都在项目里**（三技能统一改造：jxx-ticket-board / jxx-implement / jxx-implement-spec 共用同一个看板、同一套 worktree、同一条「开发 → 审查 → 合并」流水线）：

```
<项目仓库>/           in-project（默认）：root 即项目自身（init 自动判定：root 带 .git + .scratch/）
├── wt/<NNN-slug>/   每工单一个 worktree，分支 ticket/<NNN-slug>（产品仓 .gitignore 忽略 wt/）
└── control/         公告板（产品仓 .gitignore 忽略；control/ 内嵌套 git 自保，快照绝不进产品仓历史）
    ├── PROTOCOL.md        协议唯一真源（worker 靠它入职）
    ├── ledger.md          领导者账本（只追加，一行一动作）
    ├── board.html         用户进度看板（四泳道 待领取/处理中/待审核/阻塞；工单视角；领导者保鲜职责）
    ├── prd.html           PRD 看板（PRD 视角：分组/进度/整轨提示词；同一变更命令一并保鲜）
    ├── workspace.json     工作区元数据（repoPath 指向权威主工作区）
    ├── CARD-TEMPLATE.md   卡模板
    ├── starter/           角色启动提示词（dev / merger / reviewer / auto 四份）
    ├── cards/
    │   ├── open/          未收口：`<id>.md` 待领 · `<id>.claimed.md` 在办 · `<id>.review.md` 待终审
    │   ├── done/          已收口（合入并归档）
    │   └── archived/      已归档（wontfix / 让位 / 不再执行）
    └── held/              领导者暂缓道：依赖未就绪的卡停这里，worker 不可见
```

外置布局（旧形态，仍支持）：root 是独立工作区，权威仓在 root/repo（init 自动 clone）或 `--repo-dir` 指定的外部路径；看板由工作区根 git 自保。

**默认回合 main（v0.14.0 修订，ADR-011）**：所有工单（含 PRD 工单）完成审查后**默认直接合入 main**——rebase 到最新 `origin/main`、确认没影响后合入。仅技术受阻才降级：冲突不可解交回开发组；门禁红 / 本分支携带未上 main 的兄弟工单提交时，属 PRD 的暂存进 PRD 分支 `ticket/<NN>-<slug>`（惰性创建，等 §3.1 收口清入 main），散工单 blocked 等人工。**每次未能回合 main 必须向用户显式汇报原因**，并落 merge 卡流转段与账本。工单分支一律从 `origin/main` 拉出（`add-wt` 默认基）。详见 PROTOCOL §3 / §3.1 与 `references/ADR-011-main-first-merge.md`。

> **子模块可见性（0.15.3）**：`add-wt` 建完会**在 worktree 内**探测子模块——缺子模块时打印降级提示 + 补救命令（`git -C <wt> submodule update --init <name>`），**但开卡本身照常成功**。原因：子模块状态是 **worktree 级**（主检出已初始化 ≠ 新 worktree 已初始化），空目录会让 worktree 内带子模块依赖的闸门（如 `check-tool-counts` / `mount-points`）报「真源文件缺失」而现场看起来正常；`rm-wt` 也可能因 submodule 报 fatal（0.15.3 起自动降级为物理删除 + prune）。

**收口 = 四段闭环（v0.15.0）**：合并不是「合完就完」——`复核 → 预演冲突面 → 合入 main → 回收工作空间`，四段缺一不算收口。v0.14.0 只把第四段写成散文，结果实测积下 **105 个 `ticket/*` 分支对 13 个 worktree、11 张 `done` 卡里 6 张仍挂 worktree**；v0.15.0 把第四段变成确定性判据与命令：

- `board.mjs merge-check --id <卡id>` — 合入前**内存三方预演**（`git merge-tree --write-tree`，不动 index/HEAD/工作树），输出 `already-merged` / `merge-clean` / `conflict` / `merge-failed`，并把冲突逐文件分成 **`·机械候选`（content，可逐 hunk 保留双方意图）** 与 **`✗非机械`（binary / modify-delete / rename，收场必然要发明行为 ⇒ 交回开发组）**。机械冲突解决后 diff 已变 ⇒ **必须重跑审查**（ADR-005）。
- `board.mjs rm-wt --ticket <单卡id>` — 回收**工作树 + 分支两件**。分支该不该删由合入实况裁定：`origin/main..ticket/<卡id>` 零领先才自动删；仍有领先默认保留并报明领先数（不静默丢活），`--delete-branch` 强删、`--keep-branch` 保留。一次一卡，红线 §7。**远端分支两条硬出口（v0.15.1）**：`rm-wt` 与 `verify` 都只看本地——远端 `origin/ticket/<卡id>` 残留要人工闭环：删前 `git diff --stat <原hash> <重放后hash>` 实证零丢失（rebase 场景原 hash 不在 main 链，不许凭记忆删），删后 `git ls-remote --heads origin ticket/<卡id>` 空输出才算回收完整（协议 §3 第四段）。
- `board.mjs verify` 新增**回收对账**：已收口（done/archived）的卡若还挂着 `wt/<id>` 或零领先的 `ticket/<id>` 分支 ⇒ `MISMATCH` 点名并给出可照做的 `rm-wt` 命令；领先 main 的分支只报 `INFO`（那是暂存活，盲删等于丢活）。这条闸门是收口闭环的守门人——**看到 `MISMATCH 未回收…` 就是第四段没做完**，不是噪声。详见 PROTOCOL §3（含冲突分诊表）与 `references/ADR-012-close-the-loop.md`。

**服务器优先 + bootstrap（v0.13.0，默认）**：服务器（jxx-ticket REST = 线上 `/tickets` 看板）是工单真源，本地 md 是创作面与离线投影。**线上工作目录 = 该项目 repo_key 在服务器 `jxx_tickets` 中出现**；开工前先 `node tools/jxx-bootstrap.mjs --root <项目根>`——线上无该 repo_key 工单时**自动先创建**（种子工单 + 投影基准）再操作，已有则幂等退出；离线降级照常直写本地 md。**服务器对齐默认纪律（2026-10-15 起）**：卡面记录的工单评论/正文修订与状态流转，先改本地 md 再以服务器最新 `version` 作 `base_version` 双写；**批量 push 的 id 必须从当次 `list` 实测逐条核对**，不得凭表格手抄（2026-10-15 T131–T135 串位事故教训）；工具面总入口 = 项目内 `agents/skills/jxx-ticket-router/SKILL.md`（项目技能，`read` 加载；项目未提供该文件时以 MCP `tools/list` 自披露 schema 为准）。详见 `references/ADR-010-server-first-tickets.md` 与 PROTOCOL §0。

**步骤打卡与断线续接（v0.15.2 起，与服务器对齐纪律配套）**：处理工单时在工单文件列 `**处理步骤：**` 清单（每步一行 `- [ ]`），**每完成一步就地打卡并按服务器对齐纪律同步服务器副本**——线上线下同步更新，打卡即存档；会话中断/换人续接从打卡现场直接恢复，不重做已完成步骤。卡面（`control/cards/`）与工单 md 的打卡区不双写两套——打卡现场以**工单 md**为真源，卡面只带状态与指针。

设计依据见 `references/`（ADR-001~010）。**三条正交轴**（D9，ADR-008）：目录 = 生命周期三态，文件名后缀 = 执行态（领取仍是原子 rename，防抢不靠纪律），卡面 `- labels:` = triage 五标签（受阻 = `needs-info`，不再有 `blocked/` 目录）。旧五泳道板迁三态：`board.mjs migrate --root <root> [--dry-run]`。

## 两种模式

### 手动模式（默认）

用户手动拉起 worker 会话，worker 自发领卡。领导者只投卡、记账、移卡、汇总。

### Auto 模式（v0.9.0 新增）

用户指定一组工单文件，领导者自动完成全流程：

```
投卡 → spawn worker → worker 交付 → spawn 3 审查者（std/spec/rule 三维度并行）→ 全过 → spawn 合并专员 → 四段收口（复核 → merge-check 预演 → 合入 main → rm-wt 回收）→ done
```

**触发方式**：`board.mjs auto --tickets <工单文件1> <工单文件2> ...`

**编排者职责**（协议 §5.2）：
1. 投卡（含状态闸门 + 依赖闸门）
2. spawn worker（`subagent` 或 `spawn_teammate`，自行选择——独立上下文、尽可能并行）
3. 监控（看文件名后缀，不看子目录）：卡到 `open/<id>.review.md` → spawn 3 审查者；卡带 `needs-info` → 先重试一次再保留受阻；`open/<id>.claimed.md` 超时 30 分钟 → 僵死重 spawn
4. 审查全过 → spawn 合并专员；有发现项 → 返工重新 spawn worker
5. 合并四段（复核 → `merge-check` 预演 → 合 main → `rm-wt` 回收）→ 核对回收 → 双卡移 `done/`，记账，刷看板

**三维度审查**（协议 §5.3）：

| 审查者 | 维度 | 内容 |
|--------|------|------|
| reviewer-std | 标准 | 编码标准（命名、格式、import、错误处理） |
| reviewer-spec | spec | 逐条 AC 判 `met` / `partial` / `missing` 并**自己取证**（命令 + 输出摘要 / `文件:行`）；`partial` / `missing` 一律发现项；卡内无 AC 可核对时明报「未审」，不得按通过处理（判据见 `/jxx-code-review` 步骤 0c） |
| reviewer-rule | 规则 | CODING_STANDARDS.md / biome / 项目约束 |

**失败处理**（协议 §5.5）：worker 失败先重试一次；审查失败返工重审；合并冲突按 `merge-check` 分诊——机械候选自解（**解后重审**）、非机械 blocked 交回开发组；合入后未回收由编排者补 `rm-wt`；编排者失败 `verify` 断点续接。

## 角色铁律（加载本技能即领导者）

1. **只分解、投卡、记账、汇总**——不替 worker 写代码、不干预组内开发与审查方式。auto 模式下只调度——实现/审查/合并都是子 agent 的事。
2. **每个行为即时落盘账本**：投卡、移卡裁决、合并排序、对账处置、repo/main 上的文档提交……全部动作。断线重连的唯一依据就是账本 + 目录实况。
3. **续接 = 先 verify 后行动**：重连第一步跑 `verify`，账本与卡位不一致时先逐条核实目录实况、修账，再干活。
4. 不移动他人 `.claimed.md` 位的卡（孤儿回收本期协议外，verify 只报告不动手）。
5. 一切成果以 git 分支承载；卡片只做协调指针，**卡里不写成果正文**（薄卡原则）。
6. **破坏性操作红线（2026-09-30 事故新增，协议 §7）**：回收工作空间只走 `board.mjs rm-wt --root <root> --ticket <单卡id>`，**一次一卡**——**工作树与分支两件同一红线**（分支回收也一次一卡，禁批量删分支）；禁止 `rm -rf` / `Remove-Item -Recurse` / 通配符 / 批量循环；禁止对 `control/` 做任何删除；**不得把「把剩下的孤儿一起清了」这类批量破坏性操作交给子代理**。看板由工作区根 git 自保（变更类命令自动 `snapshot`），大动作前后手动 `snapshot`。
7. **看板保鲜（全员责任）**：`control/board.html`（工单视角）与 `control/prd.html`（PRD 视角）是用户的进度视图——**谁移卡谁刷**：领导者与 worker/合并专员的每次卡片 move 后必须跑 `html`（协议 §1.2）；领导者的变更命令（init/new-card/ledger/add-wt/rm-wt/auto）已内置自动重刷（v0.5.1），空闲常驻可加 `--watch`。v0.6.2 起 `html` 同时生成 `control/human.html`（人工待办面板），v0.8.0 起再生成 `control/prd.html`（PRD 看板），三页互链、随变更命令一并保鲜。v0.11.0 起工单看板按**四泳道**渲染（待领取/处理中/待审核/阻塞），已完成与已归档默认隐藏（页头开关展开）。

## 执行分流（PRD 级 vs 工单级）

面板只做三件事：**发布任务、展示状态、提供提示词**。执行按粒度分流，同一份 PRD 二选一，勿双轨并作：

- **工单级（默认）**：工单看板 `board.html` 领卡推进，worker 全程 `/jxx-implement`（协议 §2 强制），一卡一工单一分支一 worktree。
- **PRD 级（整轨）**：`prd.html` 每份 PRD 一个「📋 PRD 级整轨提示词」按钮，复制给新会话跑 `/jxx-implement-spec`——读 PRD 与全部工单构建任务图、单分支（`ticket/<PRD号>-spec`）交付一支 PR、后台子 agent 按"就绪前沿"并发。适合工单颗粒小、相互耦合、不值得逐卡拉会话的 PRD。
- **Auto 级（全自动）**：`board.mjs auto --tickets <工单文件列表>` 自动完成投卡→开发→审查→合入全流程（协议 §5）。
- **防双轨**：整轨提示词自带检查——若看板已有该 PRD 的在办卡（claimed/review），提示词会要求先与用户确认走哪条轨。分轨转整轨前，先把在办卡裁决归档或撤销。

## 命令

脚本零依赖，Node ≥ 18。以下 `<skill>` = 本技能目录，`--root` 为工作区根目录（绝对路径）。

### 初始化工作区

```bash
node <skill>/scripts/board.mjs init --root <工作区绝对路径> [--in-project] [--repo <git-url>] [--branch main] [--repo-dir <既有权威工作区绝对路径>]
```

**in-project（默认，推荐）**：root 就是项目仓库（带 `.git` + `.scratch/`）时自动判定，`--repo` 可省（自动取 origin remote）；项目自身即权威仓，wt/ 与 control/ 落在项目根，init 幂等补 `.gitignore`（`wt/`、`control/`），control/ 内建嵌套 git 做看板快照自保。`--in-project` 可显式强制。

**外置**：给了 `--repo-dir` 就用既有 clone 当权威仓库（worker 的 worktree 从它挂出，`wt/` 仍在 root 下）；省略则默认在 root/repo 新 clone（此时 `--repo` 必填）。建 wt/ 与 control/ 全套、渲染 PROTOCOL.md 与启动提示词、建账本。幂等：已存在的文件保留并报 `kept`。

### 自动编排（auto 模式，v0.9.0）

```bash
node <skill>/scripts/board.mjs auto --root <root> --tickets <工单文件1> <工单文件2> ... [--parallel N] [--retry N]
```

读工单文件列表 → 逐张投卡 → spawn worker → 监控 → 触发审查 → 触发合入。`--parallel N` 限制并行 worker 数（默认 3）；`--retry N` 设置失败重试次数（默认 1）。

auto 模式执行流程（详见协议 §5）：
1. 读每张工单文件，验证 `Status: ready-for-agent`
2. `new-card` 投卡（含 `--ticket-file` 状态闸门 + `--deps` 依赖闸门）
3. 对无阻塞的待领卡（`open/<id>.md` 无后缀）spawn worker（`control/starter/dev.md` 全文 + 卡 id——`init` 渲染出的文件名没有 `starter-` 前缀）
4. worker 交付（卡改名 `open/<id>.review.md`）→ spawn 3 审查者（starter-reviewer × 3，维度 std/spec/rule）
5. 3 审全过 → spawn 合并专员（starter-merger + merge 卡 id）
6. 审查有发现项 → 卡改名回 `open/<id>.claimed.md` 返工 → 重新 spawn worker → 重新审查
7. 合并完成（**四段全做完**，含 `rm-wt` 回收）→ 双卡 done/ → 记账 → 刷看板
8. **回收核对**：每卡收口后 `verify` 一次；`MISMATCH 未回收工作树/分支` ⇒ 编排者补 `rm-wt --ticket <单卡id>`（一次一卡）。别假设 merger 做全了。

### 投卡（分解任务）

```bash
node <skill>/scripts/board.mjs new-card --root <root> --id 033-foo --level L2 --model "中档及以上" --ticket-file <权威仓>\.scratch\<PRD>\issues\NN-xxx.md [--title x] [--deps 031-bar]
```

**状态闸门（失鲜投卡硬防线）**：开发卡 `new-card` **必须**带 `--ticket-file`（缺了直接拒投，`--force` 才可越），脚本会读该文件 `**Status:**` 行、非 `ready-for-agent` 拒绝。且投卡前领导者必须先在权威仓 `git -c credential.helper=store fetch origin` 后用**最新 HEAD** 的工单文件判断——**禁止**从旧 clone、看板缓存或记忆投卡（v0.5.3 事故教训：三张卡投出时工单已 done）。`verify` 持续兜底：①权威仓 fetch 龄期 >6h 报 WARN（`verify --fetch` 可让脚本自己拉）；②在飞卡对应工单已 done/wontfix → MISMATCH 失鲜卡；③`review/` 卡对应分支与 origin/main 零差异 → MISMATCH 假交付嫌疑；④交付分支上工单 Status=done 但验收勾选框 0/N 已勾 → MISMATCH 假勾选卡（claimed/review 都查，勾一部分只 INFO；防「文档即载荷」单的形态未尽，70-04 打回教训的工具化）。

**依赖闸门（v0.7.1）**：`--deps` 里写全卡 id（如 `69-03-gateway-refresh-and-proxy-leg`）且该卡尚未归档 `done/` ⇒ `new-card` 自动把卡收进 `control/held/`（worker 不可见的暂缓道），不进 inbox 待领列；`verify` 双向兜底——inbox 卡有未就绪依赖 → MISMATCH（应收 held），held 卡依赖已齐 → INFO（提示 `mv` 回 inbox 释放，移卡照旧记 `move <卡id>.md held->inbox` 账）。简写（"01"）、裸编号、以「无」开头的软引用散文不触发；merge 卡与 `--keep-inbox` 豁免。看板把 held 渲染为独立「暂缓·等依赖」列并隐藏领取按钮。

一卡 = 一工单 = 一分支，大工单不拆卡；工单正文写仓库 `.scratch/`，卡只放指针+目标+依赖+**难度**+**定位三件套**（带 `--ticket-file` 时 `PRD:` 行自动写成该工单文件的绝对路径，`分支:`/`worktree:` 两行由卡 id 推确定性路径，任何 agent 拿到卡即可找到工单文件）。**合入目标（v0.14.0）**：卡面 `- 合入目标:` 行一律 `main`（含 PRD 工单，默认回合主分支）；merge 卡同值。受阻暂存的 PRD 分支（`ticket/<NN>-<slug>`）由合并专员按 PRD 指针现场推导，不上卡面（PROTOCOL §3）。开发卡默认 **`/jxx-implement` 推进**（三段硬出口写进 PROTOCOL §2，卡面 `推进:` 行自带）。`--level`（L1 机械改 / L2 有界实现 / L3 需判断 / L4 设计级）与 `--model` 是给用户选模型用的，不影响 worker 行为。`--title` 省略时从工单 H1 提取。

合并卡由领导者手工投（`--id merge-033-foo --level L1 --keep-inbox`），卡内写明：待合分支、合并顺序、复核要点；`--deps` 可串多张（`--deps 031-x,032-y`）强制按序合并。**交付载荷是纯文档的卡**（双仓单的本仓侧、纯回写单）：投 merge 卡前领导者必须通读分支版工单验收段全文——勾选框与 Status 一致、同文件数字前后一致、无乱码病句；假勾选闸门（verify ④）只兜形态，内容级矛盾靠这一读（70-04 打回复盘：终审当时只 grep 了 Status 行，未数勾选、未读正文）。

### 看板 / 账本 / 重连自检

```bash
node <skill>/scripts/board.mjs board   --root <root> [--all]   # 终端概览（含难度徽标）；done 默认只报计数（历史无限增长，全量打印约 12k token），--all 展开
node <skill>/scripts/board.mjs html    --root <root> [--watch]  # 生成 control/board.html（工单四泳道）+ control/prd.html（PRD，未完成/已完成两栏）+ control/human.html（人工待办）三页互链；--watch 常驻每 3s 重刷（board 5s / prd 10s / human 10s 自刷新）
node <skill>/scripts/board.mjs verify  --root <root> [--fetch]  # 五路对账：账本 × 卡位 × worktree × 工单状态 × 标签（+ 引用新鲜度 / 失鲜卡 / 假交付 / 假勾选 / 撞号检测），退出码 5=有出入
node <skill>/scripts/board.mjs ledger  --root <root> --action "<动作>" [--target <对象>] [--reason <理由>]
node <skill>/scripts/board.mjs merge-check --root <root> --id <卡id> [--base origin/main] [--branch ticket/<卡id>]   # 合入前内存预演：VERDICT already-merged/merge-clean/conflict/merge-failed + 逐文件冲突分诊（机械候选 / 非机械）；不落现场
node <skill>/scripts/board.mjs rm-wt --root <root> --ticket <单卡id> [--force] [--keep-branch|--delete-branch]   # 回收工作树 + 分支（零领先才算已合入 ⇒ 自动删分支；否则保留并报领先数）
node <skill>/scripts/board.mjs snapshot --root <root>   # 看板快照：把 control/ 提交进工作区根 git（变更类命令已自动调用；未 git init 则静默跳过）
node <skill>/scripts/board.mjs render   --root <root> [--write]  # 把 assets 重新渲染进 control/：修「init 只补缺、模板漂移永不纠正」的坑；旧版备份到 control/.render-backup/
node <skill>/scripts/board.mjs migrate  --root <root> [--dry-run] [--actor x]  # 旧五泳道板迁三态：只改名 + 补 labels + 记一行账 + 留快照；旧目录留空不删（可回退），重跑幂等
```

**升级冲击面（v0.10.0+ 三态 + 标签正交，必读）**：没跑过 `migrate` 的旧五泳道板上，任何**卡面无 `- labels:` 行**的卡都会命中 `verify` 第 5 路 ⇒ 迁板后立刻 `MISMATCH 卡 <id>（在 … 位）缺 labels 行` / `verify: 发现 N 处出入` / **exit 5**。这是**有意的催化剂**（逼补 triage 维度），不是回归——别把它当故障去关闸门。升级顺序：① `board.mjs snapshot --root <root>` 留底；② `migrate --root <root> --dry-run` 看清单（会点名缺标签的卡并明说「不代拟」）；③ 真迁 `migrate --root <root>`；④ 对点名卡逐张 `card-set --field labels --value <五标签之一>`；⑤ `verify --root <root>` 回到绿。迁板只改名、不删旧目录（红线 §7.2），回退 = 把卡 `mv` 回去。

卡操作（瘦卡 v2：卡内只留真增量字段，分支/worktree/PRD 等确定性路径由脚本实时推导）：

```bash
node <skill>/scripts/board.mjs card-read --root <root> --id <卡id>          # 读单卡（含推导字段 + 卡内所有段）
node <skill>/scripts/board.mjs card-set  --root <root> --id <卡id> --field <标题|难度|模型档位|依赖|目标|领取者|PRD|labels|doc_ref|Harness|LLM|开始处理|结束处理> --value <值>   # labels 只收 triage 五标签，越界值 WARN + verify 红灯；卡面缺该行时插入卡头字段块（不再 die 逼人手改）
node <skill>/scripts/board.mjs card-move --root <root> --id <卡id> --to <inbox|claimed|review|done|archived|blocked|held> [--actor x] [--harness x] [--llm x] [--reason x]  # 移卡（三态板 = open/ 内改名）+ 自动记账 + 自动刷看板 + 卡内流转段追加；进 claimed 位盖 开始处理（并记 --harness/--llm）、离位盖 结束处理并回报本轮时长；--to blocked 落待领位并补 needs-info
node <skill>/scripts/board.mjs card-rm   --root <root> --id <卡id> --force  # 删卡（慎用，优先 card-move 到 done/）
```

`html` 产物是单文件深色看板：**四泳道 = 执行态**（`待领取` / `处理中` / `待审核` / `阻塞`；三态板由文件名后缀与 `needs-info` 标签推出，未迁的旧五泳道板由目录名推出，同一份渲染器两种布局都出这四列），空泳道也占位（列结构不随卡片增减抖动）；另附独立「暂缓·等依赖」列渲染 `control/held/`（无领取按钮、仅领导者有此语义，非空时出现）。**「已完成 / 已归档」属历史面，默认不渲染出来**（`display:none` + 页头「显示已完成/已归档」开关，展开态写 localStorage——页每 5s 整页刷新，不持久化就永远点不开），页头计数报「在办 N（待领 a · 处理中 b · 待审 c · 阻塞 d）· 历史 M 张默认隐藏」。每卡带**执行态徽标**（`待领取` / `处理中` / `待审核`，与列名同源，即 `TOKEN_TEXT` 单源）与 **triage 标签色标**（五标签各有色：`ready-for-agent` 绿 · `ready-for-human` 橙 · `needs-info` 粉 · `needs-triage` 紫 · `wontfix` 灰）、L1-L4 难度色标、合并卡紫标、领取者、依赖、分支名、**worktree 路径与预开状态**、PRD 可点击 file:// 链接、`doc_ref` 服务器工单外链，以及每卡**「复制启动提示词」按钮**（starter 全文 + 指定卡号 + 工作区状态，用户点一下贴给新会话即可开工）。
**「处理中」卡多一行处理计时读数**：`🛠 <Harness> · <LLM>`（未自报时红字 `harness/模型未标注`）· `▶ 开始处理`（在办时附「已办 X」）· `⏹ 结束处理 · 用时 X`，由 `card-move` 进/出 `claimed` 位自动盖章（`--harness`/`--llm` 由 worker 自报），卡面缺行时回退取「流转追加段」最后一条 claimed 相关行的时间——所以 v0.11.0 之前投的老板卡当天就有读数。这四行是统计面，不参与判位（协议 §4）。投卡后跑一次（或常驻 `--watch`）即有全局进度。页头导航链去 **PRD 看板**与人工待办。

`control/prd.html` 是同一次 `html` 生成的 **PRD 看板**（v0.8.0，PRD 视角），v0.11.0 起**按 PRD 收口态分两栏**：`未完成 PRD (N)` 默认可见、`已完成 PRD (M)` 默认 `display:none`（页头「显示已完成 PRD (M)」开关，与工单看板**共用同一个 localStorage 视图偏好键 `showHistory:<root>`**——按 root 路径隔离，两块板互不干扰；页每 5s/10s 整页刷新，不持久化就永远点不开）。收口判据：该 PRD 全部工单 `done`/`wontfix`，**或** PRD 自身 `**Status:**` 已 done/wontfix；零工单的 PRD 算未完成（还没拆 ≠ 做完）。实测收益：权威仓 61 份 PRD 里 45 份已收口，默认视图从整页历史缩到 16 张卡。

每份 PRD 一块——PRD 自身 Status、工单收口进度（done+wontfix / 总数）、工单按组呈现：▶️ 前沿可领（ready-for-agent 且尚无卡）/ 🔄 在办（有卡：open 三位（待领·在办·待终审）或 held，**卡位优先于工单文档 Status**，组内带卡状态标签）/ ⛔ 等人工 / 📋 待评审 / ✅ 已完成 / 🚫 已放弃。每份 PRD 一个**「📋 PRD 级整轨提示词」按钮**（v0.11.0 修好：该按钮自 v0.8.0 起是**死按钮**——`PRD_PROMPTS` 定义了却没有监听器消费，点了没任何反应；现已接上与其他两页同款的复制处理器并加回归断言）：一键复制 `/jxx-implement-spec` 整轨执行提示词（读 PRD 与全部工单建任务图 → 单分支 `ticket/<PRD号>-spec` 开 draft PR → 后台子 agent 按"就绪前沿"并发实现 → 全部收口后 `/jxx-code-review` 审整支分支），贴给新会话即跑。数据源＝`.scratch/<NN-slug>/PRD.md` + `issues/*.md` 的 `**Status:**` 行；**没有** `PRD.md` 的目录不参与渲染（`scanPrds` 直接跳过，本页不列孤儿目录）。

`control/human.html`（v0.6.2，人工待办面板）：扫权威仓 `.scratch/` 下 `**Status:** ready-for-human` 的工单，每张一块卡片（标题 / PRD·工单号 / 未勾验收项 / 「打开完整工单」外链），配一个**「📋 复制决策提示词」按钮**——复制的是决策单（工作区 + 工单 + 待拍板事项 + 取证要求），贴给新会话拉起决策 agent。**本页不扫 worktree 与分支**：孤儿 worktree 只由 `verify` 报一条 `WARN worktree wt/<id> 无 claimed 卡引用`（`board.mjs` 里没有「游离分支」判据），清理一律走 `rm-wt --ticket <单卡id>`，一次一卡（红线 §7）。

### 人工待卡（blocked 卡的等待方提示词）

```bash
node <skill>/scripts/board.mjs card-move --root <root> --id <卡id> --to blocked --actor <会话> --reason "<问题>"   # 三态板：卡落回 open/ 待领位 + 自动补 labels: needs-info
```

> 注：本技能**没有** `card-block` 子命令（命令面见 Resources 段，`board.mjs --help` 会直接报未知子命令）。「等待方」段由受阻会话自己在卡内追加，`board.mjs` 只负责位置、标签与账本。此错位描述在 75-c01 一并订正。

卡面「等待方」段写三件事：worker 勿领、决策提示词入口在 `control/human.html`、工作区路径。**领导者不代取证、不代裁决、卡里不写倾向**——取证是决策会话的第一步（提示词自带工作区与取证要求）。

## 领导者动作循环（标准流程）

0. 上岗即拉起看板服务面：`html --watch` 后台常驻（或每次动作后补跑 `html`），浏览器打开 `control/board.html` 给用户。
1. 读用户诉求 / 仓库 `.scratch/` PRD → 用 `new-card` 分解投卡进 `open/`（待领位 = 无后缀），逐张定级（每投一张记一笔账，含定级理由；`--labels` 缺省取自工单 `**Status:**`）。**不轻信 Status 行**：对"是否真开放/真完成"有疑点时，派只读子代理逐条对码实证（读验收标准→查实物→能跑则跑测试），实证结论记入卡与账本，再决定投/撤。
2. 卡进入 `.review.md` 位时按 v0.6.0 分级：**L1-L3 直接投 merge 卡**（技术定点复核由合并专员按协议 §3 先审后合执行，打回机制兜底）；**L4 卡与跨单口径问题**（范围/判据二选一这类判断）领导者先亲自裁决或派子代理实证，裁决点写进 merge 卡「领导者口径裁决」段。合并顺序与理由记入账本。**交付载荷是纯文档的卡（双仓单的本仓侧、纯回写单）**：投 merge 卡前必须通读分支版工单验收段全文——勾选框与 Status 一致、同文件数字前后一致、无乱码病句；假勾选闸门（verify ④）只兜形态，内容级矛盾靠这一读（70-04 打回复盘：终审当时只 grep 了 Status 行，未数勾选、未读正文）。**终审以卡内 `## AC 覆盖表` 为复核对象**：合并专员按 `/jxx-code-review` 步骤 0c 自己取证、逐条判 `met` / `partial` / `missing`，不采信表内自报判定；出现 `partial` / `missing` 即打回。
3. 合并卡回报 done 后，把对应开发卡 move 到 `done/`，记一笔账。**并核对第四段（回收）真做了**：跑 `verify`，`MISMATCH 未回收工作树/分支 <卡id>` 即 merger 漏了回收 ⇒ 领导者按提示补 `rm-wt --ticket <单卡id>`（一次一卡，红线 §7）。收口是四段闭环，不是「merge 卡 done 就算完」。
3b. **合并卡被合并专员打回时（§3 复核不过）**：领导者复核其发现项后裁决——**确认打回**则 `card-move --to blocked` 收 merge 卡（三态板 = 待领位 + needs-info），卡内写明「返工重交付后放回待领位复审、diff 变了必须复审」，开发卡改名回 `open/<卡id>.claimed.md` 等返工（合并专员已退回）；**不确认**则在卡内写明理由并把卡放回待领位 `open/<卡id>.md`（此时须显式覆盖 §3 的复核结论，别让合并专员再打回一次）。两种情况都记一笔账，理由里写清「哪几条发现项成立、哪几条降级为建议」。
4. 随时可 `board` 汇总向用户汇报；被中断后 `verify` 重建认知。

### Auto 模式动作循环（v0.9.0）

0. 用户指定工单文件列表 → `auto --tickets <文件列表>` 启动。
1. 编排者投卡（同标准流程 1）。
2. 编排者 spawn worker（starter-dev + 卡 id），监控进度。
3. worker 交付 → spawn 3 审查者（starter-reviewer × 3：std/spec/rule）。
4. 3 审全过 → spawn 合并专员（starter-merger + merge 卡 id）。
5. 审查有发现项 → 汇总写回卡 → 卡 claimed/ 返工 → 重新 spawn worker。
6. 合并完成（**四段全做完**，含 `rm-wt` 回收）→ 双卡 done/ → 记账 → 刷看板。
7. **回收核对**：每卡收口后 `verify` 一次；`MISMATCH 未回收工作树/分支` ⇒ 编排者补 `rm-wt --ticket <单卡id>`（一次一卡）。别假设 merger 做全了。
8. 全程失败处理：worker 失败先重试；blocked 卡保留并继续推进其他卡；僵死卡（30 分钟无动静）重 spawn。

## 账本格式（协议级，勿改）

`control/ledger.md` 表尾追加，一行一动作：

```
| 2026-09-21T14:05:33+08:00 | leader | move 033-foo.md review->done | wt/033-foo | 合并完成 |
```

移卡动作必须写成 `move <卡id>.md <from>-><to>`——**`.md` 后缀不可省**，`verify` 的回放正则按 `<卡id>.md` 整格精确匹配，缺后缀的账行不参与回放（v0.6.10 事故：leader 手写不带后缀的行被 verify 判 MISMATCH）。

## Resources

- `scripts/selftest.mjs` — 冒烟自测（`node scripts/selftest.mjs`，152 项断言，零依赖；改 `board.mjs` 后必跑，含防抢、历史回放、migrate、四泳道渲染与历史列默认隐藏、处理计时盖章与流转段回退、重领不抹旧值、卡面缺「流转追加段」补段、零换行卡回退 LF、受阻现场提示可达、坏时间戳红字告警、卡头字段替换边界、CLI/卡面文本的 shell 注入闸门、prd.html 两栏与整轨按钮、四类标签反例，v0.12.0 的 in-project 初始化/嵌套 git 快照不污染产品仓，v0.14.0 的默认回合 main（合入目标恒 main、add-wt 一律从 origin/main、PRD 分支不再预建），以及 v0.15.0 的收口闭环——回收对账反例（未回收工作树 / 已合入分支 / **卡面带 `- 分支:` 时规范名候选不被绕开**）、领先基准不误判为孤儿、`rm-wt` 分支回收三态（零领先自动删 / 领先保留报数 / `--keep-branch`）、**非 main 基准（master）下闸门仍生效**、`merge-check` 四 VERDICT 与机械·非机械分诊（**modify/delete、rename/rename、带空格二进制**三条解析回归 + **无法判定时 fail-closed 不默认机械候选**）、合并卡 id 自动落开发卡分支、不可信 `--branch` 被拒且不回落、解析不了的 `--base` 被拒、预演不落现场）。
- `scripts/board.mjs` — init / board / html / ledger / verify / new-card / add-wt / rm-wt / merge-check / card-read / card-set / card-move / card-rm / snapshot / render / migrate / auto 子命令。
- `assets/` — PROTOCOL、卡模板、starter 提示词（dev / merger / reviewer / auto 四份，init 时渲染进 control/）。
- `references/` — ADR-001~012：worktree 隔离、control 外置、领导者-领取制、目录状态机、合并即卡、薄卡粒度、协议单源、三态目录 + 标签正交、in-project 布局与 PRD 分支合并流、服务器优先工单真源与工作区 bootstrap、完成工单默认回合 main、收口四段闭环（合并预演 / 冲突分诊 / 回收）。改协议前先读它们。
