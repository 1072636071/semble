---
name: jxx-ticket-board
description: 工单公告板工作区——把任意 git 仓库开辟为多 worktree 并行工单协作场。加载本会话即领导者（只分解投卡、记账汇总，不干预开发组），worker 由用户拉起自发领卡，卡片目录即状态机、文件原子 move 防抢，领导者每个行为即时落盘账本，断线可重连自检。支持 auto 模式——指定一组工单后自动 spawn worker/审查者/合并专员完成全流程。当用户想搭建工单公告板/开多个工单工作区/以领导者身份派发任务/自动完成一组工单/恢复领导者会话/看板对账时使用。触发词：公告板, 领卡, 投卡, 工单看板, worktree工作区, 领导者, auto, 自动编排, reconnect。
disable-model-invocation: false
metadata:
  version: 0.11.1
argument-hint: init --repo <git-url> | board | verify | ledger --action <文本> | auto --tickets <工单文件列表>
---

# 工单公告板（领导者技能）

## 概述

把一个 git 仓库升级为**多工单安全并行**的公告板工作区：

```
<root>/
├── wt/<NNN-slug>/   每工单一个 worktree，分支 ticket/<NNN-slug>
└── control/         公告板（不入 git）
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

<权威主工作区>/        既有的主 clone（可在 root 之外，如用户日常开发目录）
```

设计依据见 `references/`（ADR-001~008）。**三条正交轴**（D9，ADR-008）：目录 = 生命周期三态，文件名后缀 = 执行态（领取仍是原子 rename，防抢不靠纪律），卡面 `- labels:` = triage 五标签（受阻 = `needs-info`，不再有 `blocked/` 目录）。旧五泳道板迁三态：`board.mjs migrate --root <root> [--dry-run]`。

## 两种模式

### 手动模式（默认）

用户手动拉起 worker 会话，worker 自发领卡。领导者只投卡、记账、移卡、汇总。

### Auto 模式（v0.9.0 新增）

用户指定一组工单文件，领导者自动完成全流程：

```
投卡 → spawn worker → worker 交付 → spawn 3 审查者（std/spec/rule 三维度并行）→ 全过 → spawn 合并专员 → 合入 done
```

**触发方式**：`board.mjs auto --tickets <工单文件1> <工单文件2> ...`

**编排者职责**（协议 §5.2）：
1. 投卡（含状态闸门 + 依赖闸门）
2. spawn worker（`subagent` 或 `spawn_teammate`，自行选择——独立上下文、尽可能并行）
3. 监控（看文件名后缀，不看子目录）：卡到 `open/<id>.review.md` → spawn 3 审查者；卡带 `needs-info` → 先重试一次再保留受阻；`open/<id>.claimed.md` 超时 30 分钟 → 僵死重 spawn
4. 审查全过 → spawn 合并专员；有发现项 → 返工重新 spawn worker
5. 合入完成 → 双卡移 `done/`，记账，刷看板

**三维度审查**（协议 §5.3）：

| 审查者 | 维度 | 内容 |
|--------|------|------|
| reviewer-std | 标准 | 编码标准（命名、格式、import、错误处理） |
| reviewer-spec | spec | 工单验收标准逐条对码实证 |
| reviewer-rule | 规则 | CODING_STANDARDS.md / biome / 项目约束 |

**失败处理**（协议 §5.5）：worker 失败先重试一次；审查失败返工重审；合并冲突机械自解、非机械 blocked 等人工；编排者失败 `verify` 断点续接。

## 角色铁律（加载本技能即领导者）

1. **只分解、投卡、记账、汇总**——不替 worker 写代码、不干预组内开发与审查方式。auto 模式下只调度——实现/审查/合并都是子 agent 的事。
2. **每个行为即时落盘账本**：投卡、移卡裁决、合并排序、对账处置、repo/main 上的文档提交……全部动作。断线重连的唯一依据就是账本 + 目录实况。
3. **续接 = 先 verify 后行动**：重连第一步跑 `verify`，账本与卡位不一致时先逐条核实目录实况、修账，再干活。
4. 不移动他人 `.claimed.md` 位的卡（孤儿回收本期协议外，verify 只报告不动手）。
5. 一切成果以 git 分支承载；卡片只做协调指针，**卡里不写成果正文**（薄卡原则）。
6. **破坏性操作红线（2026-09-30 事故新增，协议 §7）**：回收 worktree 只走 `board.mjs rm-wt --root <root> --ticket <单卡id>`，**一次一卡**；禁止 `rm -rf` / `Remove-Item -Recurse` / 通配符 / 批量循环；禁止对 `control/` 做任何删除；**不得把「把剩下的孤儿一起清了」这类批量破坏性操作交给子代理**。看板由工作区根 git 自保（变更类命令自动 `snapshot`），大动作前后手动 `snapshot`。
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
node <skill>/scripts/board.mjs init --root <工作区绝对路径> --repo <git-url> [--branch main] [--repo-dir <既有权威工作区绝对路径>]
```

给了 `--repo-dir` 就用既有 clone 当权威仓库（worker 的 worktree 从它挂出，`wt/` 仍在 root 下）；省略则默认在 root/repo 新 clone。建 wt/ 与 control/ 全套、渲染 PROTOCOL.md 与启动提示词、建账本。幂等：已存在的文件保留并报 `kept`。

### 自动编排（auto 模式，v0.9.0）

```bash
node <skill>/scripts/board.mjs auto --root <root> --tickets <工单文件1> <工单文件2> ... [--parallel N] [--retry N]
```

读工单文件列表 → 逐张投卡 → spawn worker → 监控 → 触发审查 → 触发合入。`--parallel N` 限制并行 worker 数（默认 3）；`--retry N` 设置失败重试次数（默认 1）。

auto 模式执行流程（详见协议 §5）：
1. 读每张工单文件，验证 `Status: ready-for-agent`
2. `new-card` 投卡（含 `--ticket-file` 状态闸门 + `--deps` 依赖闸门）
3. 对无阻塞的待领卡（`open/<id>.md` 无后缀）spawn worker（starter-dev + 卡 id）
4. worker 交付（卡改名 `open/<id>.review.md`）→ spawn 3 审查者（starter-reviewer × 3，维度 std/spec/rule）
5. 3 审全过 → spawn 合并专员（starter-merger + merge 卡 id）
6. 审查有发现项 → 卡改名回 `open/<id>.claimed.md` 返工 → 重新 spawn worker → 重新审查
7. 合并完成 → 双卡 done/ → 记账 → 刷看板

### 投卡（分解任务）

```bash
node <skill>/scripts/board.mjs new-card --root <root> --id 033-foo --level L2 --model "中档及以上" --ticket-file <权威仓>\.scratch\<PRD>\issues\NN-xxx.md [--title x] [--deps 031-bar]
```

**状态闸门（失鲜投卡硬防线）**：开发卡 `new-card` **必须**带 `--ticket-file`（缺了直接拒投，`--force` 才可越），脚本会读该文件 `**Status:**` 行、非 `ready-for-agent` 拒绝。且投卡前领导者必须先在权威仓 `git -c credential.helper=store fetch origin` 后用**最新 HEAD** 的工单文件判断——**禁止**从旧 clone、看板缓存或记忆投卡（v0.5.3 事故教训：三张卡投出时工单已 done）。`verify` 持续兜底：①权威仓 fetch 龄期 >6h 报 WARN（`verify --fetch` 可让脚本自己拉）；②在飞卡对应工单已 done/wontfix → MISMATCH 失鲜卡；③`review/` 卡对应分支与 origin/main 零差异 → MISMATCH 假交付嫌疑；④交付分支上工单 Status=done 但验收勾选框 0/N 已勾 → MISMATCH 假勾选卡（claimed/review 都查，勾一部分只 INFO；防「文档即载荷」单的形态未尽，70-04 打回教训的工具化）。

**依赖闸门（v0.7.1）**：`--deps` 里写全卡 id（如 `69-03-gateway-refresh-and-proxy-leg`）且该卡尚未归档 `done/` ⇒ `new-card` 自动把卡收进 `control/held/`（worker 不可见的暂缓道），不进 inbox 待领列；`verify` 双向兜底——inbox 卡有未就绪依赖 → MISMATCH（应收 held），held 卡依赖已齐 → INFO（提示 `mv` 回 inbox 释放，移卡照旧记 `move <卡id>.md held->inbox` 账）。简写（"01"）、裸编号、以「无」开头的软引用散文不触发；merge 卡与 `--keep-inbox` 豁免。看板把 held 渲染为独立「暂缓·等依赖」列并隐藏领取按钮。

一卡 = 一工单 = 一分支，大工单不拆卡；工单正文写仓库 `.scratch/`，卡只放指针+目标+依赖+**难度**+**定位三件套**（带 `--ticket-file` 时 `PRD:` 行自动写成该工单文件的绝对路径，`分支:`/`worktree:` 两行由卡 id 推确定性路径，任何 agent 拿到卡即可找到工单文件）。开发卡默认 **`/jxx-implement` 推进**（三段硬出口写进 PROTOCOL §2，卡面 `推进:` 行自带）。`--level`（L1 机械改 / L2 有界实现 / L3 需判断 / L4 设计级）与 `--model` 是给用户选模型用的，不影响 worker 行为。`--title` 省略时从工单 H1 提取。

合并卡由领导者手工投（`--id merge-033-foo --level L1 --keep-inbox`），卡内写明：待合分支、合并顺序、复核要点；`--deps` 可串多张（`--deps 031-x,032-y`）强制按序合并。**交付载荷是纯文档的卡**（双仓单的本仓侧、纯回写单）：投 merge 卡前领导者必须通读分支版工单验收段全文——勾选框与 Status 一致、同文件数字前后一致、无乱码病句；假勾选闸门（verify ④）只兜形态，内容级矛盾靠这一读（70-04 打回复盘：终审当时只 grep 了 Status 行，未数勾选、未读正文）。

### 看板 / 账本 / 重连自检

```bash
node <skill>/scripts/board.mjs board   --root <root> [--all]   # 终端概览（含难度徽标）；done 默认只报计数（历史无限增长，全量打印约 12k token），--all 展开
node <skill>/scripts/board.mjs html    --root <root> [--watch]  # 生成 control/board.html（工单四泳道）+ control/prd.html（PRD，未完成/已完成两栏）+ control/human.html（人工待办）三页互链；--watch 常驻每 3s 重刷（board 5s / prd 10s / human 10s 自刷新）
node <skill>/scripts/board.mjs verify  --root <root> [--fetch]  # 五路对账：账本 × 卡位 × worktree × 工单状态 × 标签（+ 引用新鲜度 / 失鲜卡 / 假交付 / 假勾选 / 撞号检测），退出码 5=有出入
node <skill>/scripts/board.mjs ledger  --root <root> --action "<动作>" [--target <对象>] [--reason <理由>]
node <skill>/scripts/board.mjs snapshot --root <root>   # 看板快照：把 control/ 提交进工作区根 git（变更类命令已自动调用；未 git init 则静默跳过）
node <skill>/scripts/board.mjs render   --root <root> [--write]  # 把 assets 重新渲染进 control/：修「init 只补缺、模板漂移永不纠正」的坑；旧版备份到 control/.render-backup/
node <skill>/scripts/board.mjs migrate  --root <root> [--dry-run] [--actor x]  # 旧五泳道板迁三态：只改名 + 补 labels + 记一行账 + 留快照；旧目录留空不删（可回退），重跑幂等
```

卡操作（瘦卡 v2：卡内只留真增量字段，分支/worktree/PRD 等确定性路径由脚本实时推导）：

```bash
node <skill>/scripts/board.mjs card-read --root <root> --id <卡id>          # 读单卡（含推导字段 + 卡内所有段）
node <skill>/scripts/board.mjs card-set  --root <root> --id <卡id> --field <标题|难度|模型档位|依赖|目标|领取者|PRD|labels|doc_ref|Harness|LLM|开始处理|结束处理> --value <值>   # labels 只收 triage 五标签，越界值 WARN + verify 红灯；卡面缺该行时插入卡头字段块（不再 die 逼人手改）
node <skill>/scripts/board.mjs card-move --root <root> --id <卡id> --to <inbox|claimed|review|done|archived|blocked|held> [--actor x] [--harness x] [--llm x] [--reason x]  # 移卡（三态板 = open/ 内改名）+ 自动记账 + 自动刷看板 + 卡内流转段追加；进 claimed 位盖 开始处理（并记 --harness/--llm）、离位盖 结束处理并回报本轮时长；--to blocked 落待领位并补 needs-info
node <skill>/scripts/board.mjs card-rm   --root <root> --id <卡id> --force  # 删卡（慎用，优先 card-move 到 done/）
```

`html` 产物是单文件深色看板：**四泳道 = 执行态**（`待领取` / `处理中` / `待审核` / `阻塞`；三态板由文件名后缀与 `needs-info` 标签推出，未迁的旧五泳道板由目录名推出，同一份渲染器两种布局都出这四列），空泳道也占位（列结构不随卡片增减抖动）；另附独立「暂缓·等依赖」列渲染 `control/held/`（无领取按钮、仅领导者有此语义，非空时出现）。**「已完成 / 已归档」属历史面，默认不渲染出来**（`display:none` + 页头「显示已完成/已归档」开关，展开态写 localStorage——页每 5s 整页刷新，不持久化就永远点不开），页头计数报「在办 N（待领 a · 处理中 b · 待审 c · 阻塞 d）· 历史 M 张默认隐藏」。每卡带**执行态徽标**（待领 / 在办 / 待终审）与 **triage 标签色标**（五标签各有色：`ready-for-agent` 绿 · `ready-for-human` 橙 · `needs-info` 粉 · `needs-triage` 紫 · `wontfix` 灰）、L1-L4 难度色标、合并卡紫标、领取者、依赖、分支名、**worktree 路径与预开状态**、PRD 可点击 file:// 链接、`doc_ref` 服务器工单外链，以及每卡**「复制启动提示词」按钮**（starter 全文 + 指定卡号 + 工作区状态，用户点一下贴给新会话即可开工）。
**「处理中」卡多一行处理计时读数**：`🛠 <Harness> · <LLM>`（未自报时红字 `harness/模型未标注`）· `▶ 开始处理`（在办时附「已办 X」）· `⏹ 结束处理 · 用时 X`，由 `card-move` 进/出 `claimed` 位自动盖章（`--harness`/`--llm` 由 worker 自报），卡面缺行时回退取「流转追加段」最后一条 claimed 相关行的时间——所以 v0.11.0 之前投的老板卡当天就有读数。这四行是统计面，不参与判位（协议 §4）。投卡后跑一次（或常驻 `--watch`）即有全局进度。页头导航链去 **PRD 看板**与人工待办。

`control/prd.html` 是同一次 `html` 生成的 **PRD 看板**（v0.8.0，PRD 视角），v0.11.0 起**按 PRD 收口态分两栏**：`未完成 PRD (N)` 默认可见、`已完成 PRD (M)` 默认 `display:none`（页头「显示已完成 PRD (M)」开关，与工单看板**共用同一个 localStorage 视图偏好键 `showHistory:<root>`**——按 root 路径隔离，两块板互不干扰；页每 5s/10s 整页刷新，不持久化就永远点不开）。收口判据：该 PRD 全部工单 `done`/`wontfix`，**或** PRD 自身 `**Status:**` 已 done/wontfix；零工单的 PRD 算未完成（还没拆 ≠ 做完）。实测收益：权威仓 61 份 PRD 里 45 份已收口，默认视图从整页历史缩到 16 张卡。

每份 PRD 一块——PRD 自身 Status、工单收口进度（done+wontfix / 总数）、工单按组呈现：▶️ 前沿可领（ready-for-agent 且尚无卡）/ 🔄 在办（有卡：open 三位（待领·在办·待终审）或 held，**卡位优先于工单文档 Status**，组内带卡状态标签）/ ⛔ 等人工 / 📋 待评审 / ✅ 已完成 / 🚫 已放弃。每份 PRD 一个**「📋 PRD 级整轨提示词」按钮**（v0.11.0 修好：该按钮自 v0.8.0 起是**死按钮**——`PRD_PROMPTS` 定义了却没有监听器消费，点了没任何反应；现已接上与其他两页同款的复制处理器并加回归断言）：一键复制 `/jxx-implement-spec` 整轨执行提示词（读 PRD 与全部工单建任务图 → 单分支 `ticket/<PRD号>-spec` 开 draft PR → 后台子 agent 按"就绪前沿"并发实现 → 全部收口后 `/jxx-code-review` 审整支分支），贴给新会话即跑。PRD 看板同时列出 `.scratch/` 下**尚无 PRD.md 的孤儿工单目录**（⚠️ 提示先补 PRD 或确认独立单）。

`control/human.html`（v0.6.2，人工待办面板）：汇总所有卡片中「等待方」含 human 的卡——每张卡一段「决策提示词」，用户复制贴给新会话即拉起决策 agent 处理该卡点。决策 agent 的产出是：把卡移出 blocked（`card-move`）、在卡内追加决策记录、刷看板。面板同时列出**所有孤儿 worktree**（wt/ 下无对应在办卡）与**游离分支**（`ticket/*` 有分支但无卡），各配「复制清理提示词」按钮。

### 人工待卡（blocked 卡的等待方提示词）

```bash
node <skill>/scripts/board.mjs card-move --root <root> --id <卡id> --to blocked --actor <会话> --reason "<问题>"   # 三态板：卡落回 open/ 待领位 + 自动补 labels: needs-info
```

> 注：本技能**没有** `card-block` 子命令（命令面见 Resources 段，`board.mjs --help` 会直接报未知子命令）。「等待方」段由受阻会话自己在卡内追加，`board.mjs` 只负责位置、标签与账本。此错位描述在 75-c01 一并订正。

卡面「等待方」段写三件事：worker 勿领、决策提示词入口在 `control/human.html`、工作区路径。**领导者不代取证、不代裁决、卡里不写倾向**——取证是决策会话的第一步（提示词自带工作区与取证要求）。

## 领导者动作循环（标准流程）

0. 上岗即拉起看板服务面：`html --watch` 后台常驻（或每次动作后补跑 `html`），浏览器打开 `control/board.html` 给用户。
1. 读用户诉求 / 仓库 `.scratch/` PRD → 用 `new-card` 分解投卡进 `open/`（待领位 = 无后缀），逐张定级（每投一张记一笔账，含定级理由；`--labels` 缺省取自工单 `**Status:**`）。**不轻信 Status 行**：对"是否真开放/真完成"有疑点时，派只读子代理逐条对码实证（读验收标准→查实物→能跑则跑测试），实证结论记入卡与账本，再决定投/撤。
2. 卡进入 `.review.md` 位时按 v0.6.0 分级：**L1-L3 直接投 merge 卡**（技术定点复核由合并专员按协议 §3 先审后合执行，打回机制兜底）；**L4 卡与跨单口径问题**（范围/判据二选一这类判断）领导者先亲自裁决或派子代理实证，裁决点写进 merge 卡「领导者口径裁决」段。合并顺序与理由记入账本。**交付载荷是纯文档的卡（双仓单的本仓侧、纯回写单）**：投 merge 卡前必须通读分支版工单验收段全文——勾选框与 Status 一致、同文件数字前后一致、无乱码病句；假勾选闸门（verify ④）只兜形态，内容级矛盾靠这一读（70-04 打回复盘：终审当时只 grep 了 Status 行，未数勾选、未读正文）。
3. 合并卡回报 done 后，把对应开发卡 move 到 `done/`，记一笔账。
3b. **合并卡被合并专员打回时（§3 复核不过）**：领导者复核其发现项后裁决——**确认打回**则 `card-move --to blocked` 收 merge 卡（三态板 = 待领位 + needs-info），卡内写明「返工重交付后放回待领位复审、diff 变了必须复审」，开发卡改名回 `open/<卡id>.claimed.md` 等返工（合并专员已退回）；**不确认**则在卡内写明理由并把卡放回待领位 `open/<卡id>.md`（此时须显式覆盖 §3 的复核结论，别让合并专员再打回一次）。两种情况都记一笔账，理由里写清「哪几条发现项成立、哪几条降级为建议」。
4. 随时可 `board` 汇总向用户汇报；被中断后 `verify` 重建认知。

### Auto 模式动作循环（v0.9.0）

0. 用户指定工单文件列表 → `auto --tickets <文件列表>` 启动。
1. 编排者投卡（同标准流程 1）。
2. 编排者 spawn worker（starter-dev + 卡 id），监控进度。
3. worker 交付 → spawn 3 审查者（starter-reviewer × 3：std/spec/rule）。
4. 3 审全过 → spawn 合并专员（starter-merger + merge 卡 id）。
5. 审查有发现项 → 汇总写回卡 → 卡 claimed/ 返工 → 重新 spawn worker。
6. 合并完成 → 双卡 done/ → 记账 → 刷看板 → 汇报用户。
7. 全程失败处理：worker 失败先重试；blocked 卡保留并继续推进其他卡；僵死卡（30 分钟无动静）重 spawn。

## 账本格式（协议级，勿改）

`control/ledger.md` 表尾追加，一行一动作：

```
| 2026-09-21T14:05:33+08:00 | leader | move 033-foo.md review->done | wt/033-foo | 合并完成 |
```

移卡动作必须写成 `move <卡id>.md <from>-><to>`——**`.md` 后缀不可省**，`verify` 的回放正则按 `<卡id>.md` 整格精确匹配，缺后缀的账行不参与回放（v0.6.10 事故：leader 手写不带后缀的行被 verify 判 MISMATCH）。

## Resources

- `scripts/selftest.mjs` — 冒烟自测（`node scripts/selftest.mjs`，96 项断言，零依赖；改 `board.mjs` 后必跑，含防抢、历史回放、migrate、四泳道渲染与历史列默认隐藏、处理计时盖章与流转段回退、坏时间戳红字告警、卡头字段替换边界、prd.html 两栏与整轨按钮，以及四类标签反例）。
- `scripts/board.mjs` — init / board / html / ledger / verify / new-card / add-wt / rm-wt / card-read / card-set / card-move / card-rm / snapshot / render / migrate / auto 子命令。
- `assets/` — PROTOCOL、卡模板、starter 提示词（dev / merger / reviewer / auto 四份，init 时渲染进 control/）。
- `references/` — ADR-001~008：worktree 隔离、control 外置、领导者-领取制、目录状态机、合并即卡、薄卡粒度、协议单源、三态目录 + 标签正交。改协议前先读它们。
