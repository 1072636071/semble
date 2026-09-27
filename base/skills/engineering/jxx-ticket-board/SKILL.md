---
name: jxx-ticket-board
description: 工单公告板工作区——把任意 git 仓库开辟为多 worktree 并行工单协作场。加载本会话即领导者（只分解投卡、记账汇总，不干预开发组），worker 由用户拉起自发领卡，卡片目录即状态机、文件原子 move 防抢，领导者每个行为即时落盘账本，断线可重连自检。当用户想搭建工单公告板/开多个工单工作区/以领导者身份派发任务/恢复领导者会话/看板对账时使用。触发词：公告板, 领卡, 投卡, 工单看板, worktree工作区, 领导者, reconnect。
disable-model-invocation: true
metadata:
  version: 0.7.5
argument-hint: init --repo <git-url> | board | verify | ledger --action <文本>
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
    ├── board.html         用户进度看板（领导者保鲜职责）
    ├── workspace.json     工作区元数据（repoPath 指向权威主工作区）
    ├── CARD-TEMPLATE.md   卡模板
    ├── starter/           角色启动提示词（dev / merger 两份）
    ├── cards/
    │   └── inbox/ claimed/ review/ done/ blocked/
    └── held/              领导者暂缓道：依赖未就绪的卡停这里，worker 不可见

<权威主工作区>/        既有的主 clone（可在 root 之外，如用户日常开发目录）
```

设计依据见 `references/`（ADR-001~007）。

## 角色铁律（加载本技能即领导者）

1. **只分解、投卡、记账、汇总**——不替 worker 写代码、不干预组内开发与审查方式。
2. **每个行为即时落盘账本**：投卡、移卡裁决、合并排序、对账处置、repo/main 上的文档提交……全部动作。断线重连的唯一依据就是账本 + 目录实况。
3. **续接 = 先 verify 后行动**：重连第一步跑 `verify`，账本与卡位不一致时先逐条核实目录实况、修账，再干活。
4. 不移动他人 `claimed/` 的卡（孤儿回收本期协议外，verify 只报告不动手）。
5. 一切成果以 git 分支承载；卡片只做协调指针，**卡里不写成果正文**（薄卡原则）。
6. **看板保鲜（全员责任）**：`control/board.html` 是用户的进度视图——**谁移卡谁刷**：领导者与 worker/合并专员的每次卡片 move 后必须跑 `html`（协议 §1.2）；领导者的变更命令（init/new-card/ledger/add-wt/rm-wt）已内置自动重刷（v0.5.1），空闲常驻可加 `--watch`。v0.6.2 起 `html` 同时生成 `control/human.html`（人工待办面板，见「命令」节），两页互链、随变更命令一并保鲜。

## 命令

脚本零依赖，Node ≥ 18。以下 `<skill>` = 本技能目录，`--root` 为工作区根目录（绝对路径）。

### 初始化工作区

```bash
node <skill>/scripts/board.mjs init --root <工作区绝对路径> --repo <git-url> [--branch main] [--repo-dir <既有权威工作区绝对路径>]
```

给了 `--repo-dir` 就用既有 clone 当权威仓库（worker 的 worktree 从它挂出，`wt/` 仍在 root 下）；省略则默认在 root/repo 新 clone。建 wt/ 与 control/ 全套、渲染 PROTOCOL.md 与启动提示词、建账本。幂等：已存在的文件保留并报 `kept`。

### 投卡（分解任务）

```bash
node <skill>/scripts/board.mjs new-card --root <root> --id 033-foo --level L2 --model "中档及以上" --ticket-file <权威仓>\.scratch\<PRD>\issues\NN-xxx.md [--title x] [--deps 031-bar]
```

**状态闸门（失鲜投卡硬防线）**：开发卡 `new-card` **必须**带 `--ticket-file`（缺了直接拒投，`--force` 才可越），脚本会读该文件 `**Status:**` 行、非 `ready-for-agent` 拒绝。且投卡前领导者必须先在权威仓 `git -c credential.helper=store fetch origin` 后用**最新 HEAD** 的工单文件判断——**禁止**从旧 clone、看板缓存或记忆投卡（v0.5.3 事故教训：三张卡投出时工单已 done）。`verify` 持续兜底：①权威仓 fetch 龄期 >6h 报 WARN（`verify --fetch` 可让脚本自己拉）；②在飞卡对应工单已 done/wontfix → MISMATCH 失鲜卡；③`review/` 卡对应分支与 origin/main 零差异 → MISMATCH 假交付嫌疑；④交付分支上工单 Status=done 但验收勾选框 0/N 已勾 → MISMATCH 假勾选卡（claimed/review 都查，勾一部分只 INFO；防「文档即载荷」单的形态未尽，70-04 打回教训的工具化）。

**依赖闸门（v0.7.1）**：`--deps` 里写全卡 id（如 `69-03-gateway-refresh-and-proxy-leg`）且该卡尚未归档 `done/` ⇒ `new-card` 自动把卡收进 `control/held/`（worker 不可见的暂缓道），不进 inbox 待领列；`verify` 双向兜底——inbox 卡有未就绪依赖 → MISMATCH（应收 held），held 卡依赖已齐 → INFO（提示 `mv` 回 inbox 释放，移卡照旧记 `move <卡id>.md held->inbox` 账）。简写（"01"）、裸编号、以「无」开头的软引用散文不触发；merge 卡与 `--keep-inbox` 豁免。看板把 held 渲染为独立「暂缓·等依赖」列并隐藏领取按钮。

一卡 = 一工单 = 一分支，大工单不拆卡；工单正文写仓库 `.scratch/`，卡只放指针+目标+依赖+**难度**+**定位三件套**（带 `--ticket-file` 时 `PRD:` 行自动写成该工单文件的绝对路径，`分支:`/`worktree:` 两行由卡 id 推确定性路径，任何 agent 拿到卡即可找到工单文件）。开发卡默认 **`/jxx-implement` 推进**（三段硬出口写进 PROTOCOL §2，卡面 `推进:` 行自带）。`--level`（L1 机械改 / L2 有界实现 / L3 需判断 / L4 设计级，判据见 PROTOCOL §1）与 `--model` 必填——**难度是给用户看的**：用户照卡拉起会话、选配 LLM（快模型领 L1/L2，强模型领 L3/L4），worker 不按档位互相挑活。投卡后记账（含定级理由）：

```bash
node <skill>/scripts/board.mjs ledger --root <root> --action "投卡 033-foo" --target "inbox/033-foo.md" --reason "来自 PRD 12；定级 L2：规格清晰无设计决策"
```

### 挂决策单（人工待办——领导者只出卡与工作区，不代决策）

要人拍板的事（范围去留、涉密钥、删数据）**不落开发卡**：工单 `**Status:** ready-for-human` 进权威仓 → 决策卡进 `blocked/`（等人的意思，worker 只领 `inbox/`）→ 预开工作区 → human.html 的「复制决策提示词」由用户自己拉起决策会话。

```bash
# ① 权威仓立单：走隔离 worktree，禁碰共享 main 脏树（见「本机环境坑」/memory 同款）
git -C <权威仓> -c credential.helper=store fetch origin
git -C <权威仓> worktree add --detach .temp/wt-<x> origin/main
#   新工单字段行按 doc-structure 契约：**必须是字段行 `**构建内容：**` / `**验收标准：**`，不是 `## 验收标准` 小节**（写成小节会在 commit 后被 doc:lint 判不合规）
#   在 worktree 内 commit 后、**push 之前**跑 `node tools/doc-structure-check.mjs`，与"移除本单"的基线逐项对齐（不新增 error 也不新增 warning）才推
git -C <权威仓>/.temp/wt-<x> -c credential.helper=store push origin HEAD:main
git -C <权威仓> worktree remove .temp/wt-<x>
git -C <权威仓> merge --ff-only origin/main   # 必做：人工待办面板读的是权威仓磁盘树，不 ff 就上不了板
# ② 出决策卡（闸门是为 ready-for-agent 设的，决策单需 --force）+ 工作空间
node <skill>/scripts/board.mjs new-card --root <root> --id <NN-MM-slug> --level L4 --model "强模型（决策级）" \
  --ticket-file <工单绝对路径> --force --title "<一句话决策题>" --deps "无——等人拍板"
mv <root>/control/cards/inbox/<卡id>.md <root>/control/cards/blocked/
node <skill>/scripts/board.mjs add-wt --root <root> --ticket <卡id>
node <skill>/scripts/board.mjs ledger --root <root> --action "决策卡 <卡id> 上板（blocked/）+ 预开工作区" --reason "<为何转人工 + 实证依据>"
```

卡面「等待方」段写三件事：worker 勿领、决策提示词入口在 `control/human.html`、工作区路径。**领导者不代取证、不代裁决、卡里不写倾向**——取证是决策会话的第一步（提示词自带工作区与取证要求）。

### 看板 / 账本 / 重连自检

```bash
node <skill>/scripts/board.mjs board   --root <root>   # 终端概览（含难度徽标）
node <skill>/scripts/board.mjs html    --root <root> [--watch]  # 生成 control/board.html + control/human.html 给用户看（两页互链、链接默认新标签页打开）；--watch 常驻每 3s 重刷（board 5s / human 10s 自刷新）
node <skill>/scripts/board.mjs verify  --root <root> [--fetch]  # 账本×卡位×worktree 对账 + 引用新鲜度 + 失鲜卡/假交付检测，退出码 5=有出入
node <skill>/scripts/board.mjs ledger  --root <root> --action "<动作>" [--target <对象>] [--reason <理由>]
```

卡操作（瘦卡 v2：卡内只留真增量字段，分支/worktree/PRD 等确定性路径由脚本实时推导）：

```bash
node <skill>/scripts/board.mjs card-read --root <root> --id <卡id>          # 读单卡（含推导字段 + 卡内所有段）
node <skill>/scripts/board.mjs card-set  --root <root> --id <卡id> --field <标题|难度|模型档位|依赖|目标|领取者|PRD> --value <值>
node <skill>/scripts/board.mjs card-move --root <root> --id <卡id> --to <inbox|claimed|review|done|blocked> [--actor x] [--reason x]  # 移卡 + 自动记账 + 自动刷看板 + 卡内流转段追加
node <skill>/scripts/board.mjs card-rm   --root <root> --id <卡id> --force  # 删卡（慎用，优先 card-move 到 done/）
```

`html` 产物是单文件深色看板：状态泳道（`inbox/claimed/review/blocked` + 独立「暂缓·等依赖」列渲染 `control/held/`（无领取按钮，仅领导者可见此语义）；**done 不在看板显示**，仅页头计数「已完成 N，看板不显示」——归档卡随 `done/` 目录与账本留存）、L1-L4 难度色标、合并卡紫标、领取者、依赖、分支名、**worktree 路径与预开状态**、PRD 可点击 file:// 链接，以及每卡**「复制启动提示词」按钮**（starter 全文 + 指定卡号 + 工作区状态，用户点一下贴给新会话即可开工）。投卡后跑一次（或常驻 `--watch`）即有全局进度。

`control/human.html` 是同一次 `html` 生成的**人工待办面板**（只给用户看）：扫权威仓 `.scratch/` 下 `**Status:** ready-for-human` 的工单，逐张呈现编号 / 标题 / 验收勾进度 / **需要人工处理什么**（取自工单未勾验收项；全勾则提示待签收、无勾选项则提示按正文判定），点标题或「打开完整工单」在新标签页打开工单。每卡一个**「复制决策提示词」按钮**：一键复制该单的**决策单提示词**（含**工作区＝权威仓路径 → 先检索代码/看资料取证**、工单路径 + 待决项 + 用 jxx-grilling 逐条摆「选项/影响/推荐」追问到可拍板、结论写回工单评论/改 Status、回写走隔离 worktree、不可逆动作先回显）贴给新会话即可推进决策；提示词**默认不显示在界面上**（只藏在页面脚本的 PROMPTS 里，点击才复制）。与 `board.html` 顶部互链（各一个返回按钮）。

`verify` 报告后，领导者按实况裁决：补记漏账、纠正错账，每条处置都再记一笔账。

### worktree 助手（一般由 worker 自己跑；领导者预开或善后时用）

```bash
node <skill>/scripts/board.mjs add-wt --root <root> --ticket <NNN-slug> [--base main]
node <skill>/scripts/board.mjs rm-wt  --root <root> --ticket <NNN-slug> [--delete-branch]
```

### 拉起 worker / 合并专员

把 `control/starter/dev.md` 或 `starter/merger.md` 整段贴给新会话即可，协议触达全靠那一份 PROTOCOL.md（ADR-007）。**拉起时按 inbox 卡的「难度/模型档位」给会话选 LLM**：L1/L2 用快而便宜的模型，L3/L4 用强模型；L4 会话多派一个干净上下文审查会话。

## 领导者动作循环（标准流程）

0. 上岗即拉起看板服务面：`html --watch` 后台常驻（或每次动作后补跑 `html`），浏览器打开 `control/board.html` 给用户。
1. 读用户诉求 / 仓库 `.scratch/` PRD → 用 `new-card` 分解投卡进 `inbox/`，逐张定级（每投一张记一笔账，含定级理由）。**不轻信 Status 行**：对"是否真开放/真完成"有疑点时，派只读子代理逐条对码实证（读验收标准→查实物→能跑则跑测试），实证结论记入卡与账本，再决定投/撤。
2. 卡进入 `review/` 时按 v0.6.0 分级：**L1-L3 直接投 merge 卡**（技术定点复核由合并专员按协议 §3 先审后合执行，打回机制兜底）；**L4 卡与跨单口径问题**（范围/判据二选一这类判断）领导者先亲自裁决或派子代理实证，裁决点写进 merge 卡「领导者口径裁决」段。合并顺序与理由记入账本。**交付载荷是纯文档的卡（双仓单的本仓侧、纯回写单）**：投 merge 卡前必须通读分支版工单验收段全文——勾选框与 Status 一致、同文件数字前后一致、无乱码病句；假勾选闸门（verify ④）只兜形态，内容级矛盾靠这一读（70-04 打回复盘：终审当时只 grep 了 Status 行，未数勾选、未读正文）。
3. 合并卡回报 done 后，把对应开发卡 move 到 `done/`，记一笔账。
3b. **合并卡被合并专员打回时（§3 复核不过）**：领导者复核其发现项后裁决——**确认打回**则把 merge 卡移 `blocked/`，卡内写明「返工重交付后放回 `inbox/` 复审、diff 变了必须复审」，开发卡停在 `claimed/` 等返工（合并专员已退回）；**不确认**则在卡内写明理由并把卡片放回 `inbox/`（此时须显式覆盖 §3 的复核结论，别让合并专员再打回一次）。两种情况都记一笔账，理由里写清「哪几条发现项成立、哪几条降级为建议」。
4. 随时可 `board` 汇总向用户汇报；被中断后 `verify` 重建认知。

## 账本格式（协议级，勿改）

`control/ledger.md` 表尾追加，一行一动作：

```
| 2026-09-21T14:05:33+08:00 | leader | move 033-foo.md review->done | wt/033-foo | 合并完成 |
```

移卡动作必须写成 `move <卡id>.md <from>-><to>`——**`.md` 后缀不可省**，`verify` 的回放正则按 `<卡id>.md` 整格精确匹配，缺后缀的账行不参与回放（v0.6.10 事故：leader 手写不带后缀的行被 verify 判 MISMATCH）。

## Resources

- `scripts/board.mjs` — init / board / html / ledger / verify / new-card / add-wt / rm-wt / card-read / card-set / card-move / card-rm 子命令。
- `assets/` — PROTOCOL、卡模板、starter 提示词（init 时渲染进 control/）。
- `references/` — ADR-001~007：worktree 隔离、control 外置、领导者-领取制、目录状态机、合并即卡、薄卡粒度、协议单源。改协议前先读它们。
