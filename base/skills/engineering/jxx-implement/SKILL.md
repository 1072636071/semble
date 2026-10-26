---
name: jxx-implement
description: "按工单或 spec 实现功能，走到合并收口。当用户说实现、implement、接这个工单时触发。不写 spec，不拆工单。"
disable-model-invocation: false
metadata:
  version: 1.12.1
---

实现用户在 spec 或工单中描述的工作。

用户传入工单引用时，先按项目 issue tracker 契约读取该工单，并向用户复述工单标题，再开始任何看板、领卡或写盘操作。引用有歧义时先问，不得猜测。

尽可能在预先约定的接缝（seam）处使用 `/jxx-tdd`。

定期运行类型检查和单个测试文件，结束时运行完整测试套件。

## 硬前置（统一布局 · v1.2.0，不可跳过）

三技能统一改造（jxx-ticket-board / jxx-implement / jxx-implement-spec）：**一切开发都在项目里的工单 worktree 中进行，并由统一看板跟踪**。开工前按序落实：

1. **看板存在**：项目根有 `control/workspace.json`；没有则先 `node <jxx-ticket-board>/scripts/board.mjs init --root <项目根>`（in-project 自动判定，wt/ 与 control/ 落在项目里，快照走 control/ 嵌套 git，不进产品仓历史）。
2. **工单有卡**：`control/cards/` 里存在本工单对应的卡（卡 id = `NN-MM-slug`，与工单文件名一致）；没有则由领导者（或本会话代行）投卡：`board.mjs new-card --root <项目根> --id <卡id> --level <L1-L4> --model <档位> --ticket-file <工单文件绝对路径>`（投卡自动写卡面「合入目标」：一律 main——完成审查默认回合主分支，受阻暂存见 PROTOCOL §3）。
3. **领卡**：`board.mjs card-move --root <项目根> --id <卡id> --to claimed --actor <会话标识> --harness <harness 名> --llm <模型名>`（原子改名防抢；抢不到就换卡或回报）。
4. **worktree 内开发**：`wt/<卡id>/` 已存在则直接进入；否则 `board.mjs add-wt --root <项目根> --ticket <卡id>`——**基分支**：一律从 origin/main 拉（含 PRD 工单，v0.14.0 起 PRD 分支不再预建）——所有工单 diff 只含自己的活。**不得**在 main 或他人分支上直接开发。完整规则见 `control/PROTOCOL.md`（§1 领取、§2 开发组规则）。

## 工单真源与工作区 bootstrap（服务器优先 · v1.2.0 默认）

**默认操作服务器上的工单**：服务器（jxx-ticket REST / 线上 /tickets 看板）是工单真源，本地 `.scratch/` md 是创作面与离线投影。**线上工作目录 = 该项目 repo_key 在服务器 `jxx_tickets` 中出现**（repo_key 归一化见 `tools/repo-key.mjs` / 服务端 `internal/repokey`）。开工前先确保线上有本项目工作区：

```bash
node tools/jxx-bootstrap.mjs --root <项目根>        # 缺则创建（种子工单 + 投影基准），已有则幂等退出
```

- 项目已接入 ⇒ `already-bootstrapped`，继续正常流程；
- **新项目（线上无该 repo_key 工单）⇒ 自动先创建**：种子工单（`【bootstrap】<项目名> 工作区开通`）+ 本地投影基准，然后才进行后续操作；
- **状态流转 / 打卡 / 评论：写腿一条命令**（v1.10.0 起默认，2026-10-23）：项目内有 `tools/ticket-flow.mjs` 时，直接
  `node tools/ticket-flow.mjs --root <仓库根> --file <单条工单md> --set status=<本地词表> --comment "<一句话>"`——一条命令内部完成
  「改本地 md + 推服务器」（payload 只含本次真改的字段；`version_conflict` 自动重拉重试一次），**不要再先手改 md 再推**。
  字段白名单 `status | title | labels | assignee`：`--set labels=a,b`、`--set assignee=<人|空>`（空 = 取消认领）。退出码：0 收敛；
  2 = 评论撞上「服务器版本已前进」，按条目自带 `server` / `local` / `resolution` 裁决后重跑；3 = 参数 / 状态映射 / 未匹配 / 传输失败，
  本地 md 已还原或未变（stdout 带 `rolled_back:true` 即已回滚）。**新建仍走 `tools/ticket-uplink.mjs` / `jxx_ticket_call create`——写腿不 create**。
- **整篇收敛与批量仍用只读腿**：`node tools/ticket-flow.mjs --root <仓库根> [--file <单条md>] [--dry-run]`——内部匹配（state 精确 →
  repo_key+title 回退）→ 有差异 update（同一写腿的乐观锁重试）→ 刷 state，幂等可重跑。**写腿只推本次真改字段，不替你整篇对齐服务器**；
  改验收点 / 改正文段落这类自由文本修订，改完 md 后跑只读腿 `--file` 收敛。
- **兜底路径**：项目没有 `tools/ticket-flow.mjs`（或该命令不可用）时回退 MCP 双写——先改本地 md → `get` 拿最新 `version` 作
  `base_version` → `jxx_ticket_call update`（409 先对账再推，不盲目重试），工具面见项目内 `agents/skills/jxx-ticket-router/SKILL.md`
  （项目技能、`read` 加载）。服务不可达时照常直写本地 md（离线降级），回连后 `jxx_ticket_sync` 收口。
- **正文与评论同样双写（v1.5.0 起；v1.10.0 起评论走写腿）**：实现过程中往工单追加的评论用同一条写腿命令的 `--comment`
  （可与 `--set status=…` 合并成一次）；修订验收点 / 正文段落写进 md 后跑只读腿 `--file` 收敛。服务器是真源，只改本地等于没记录。
- **批量 push 的 id 必须实测核对**：从当次 `list`/`get` 结果逐条取 id，不得凭表格或记忆手抄——串位会把正文写进邻居工单（2026-10-15 实测事故：T131–T135 四条错位，靠乐观锁 409 + 标签过滤 `list` 对账才发现）。
- 本仓无 `tools/jxx-bootstrap.mjs` 的项目（未接此套工具）：以「`jxx_ticket_call list` 按 repo_key 查询 + 无则 `create` 种子工单」同语义手动执行（口径见 `references/ADR-010-server-first-tickets.md`）。

## 步骤打卡与断线续接（v1.6.0 起默认纪律，不可跳过）

开工时先把本单的执行步骤写成 `**处理步骤：**` 清单追加进工单文件（放在 `**验收标准：**` 之后、`## 评论` 之前），每步一行 `- [ ]`；**每完成一步就地打卡**（`- [ ]` → `- [x]`，步尾注日期，必要时补一行执行事实如 commit 号 / 关键产出指针），并按上方「服务器优先」纪律同步服务器副本——**线上线下同步更新，打卡即存档**。会话中断、换会话或换人续接时，**从工单文件的打卡现场直接恢复**（读到哪步打勾就从哪步继续），不重做已完成步骤、不凭记忆重建进度。

- 步骤清单在动手前列（领卡后第一时间），粒度 = 单会话内可完成的动作级（如「领卡 → add-wt → 写 X → 跑测试 → 机械自检」）；发现新步骤随时补行；
- 打卡与代码提交解耦：打卡更新随下次 commit 顺带入库即可，**不因打卡单独发 commit**，但打卡动作本身不得攒——完成一步打一步；
- 续接入口：新会话先读工单文件的 `**处理步骤：**` 打卡区 + `## 评论` 时间线 + 服务器副本（用 `node tools/ticket-flow.mjs --root <仓库根> --dry-run` **零写入预演**看差异，或兜底用 `jxx_ticket_call get`），三方对齐后再动手；三方不一致时以服务器为准并回写本地。

## 验收点闭环（v1.8.0 硬出口，不可跳过）

步骤打卡记**动作进度**，AC 勾选记**结果闭包**——两套账，缺一不算完成。判定口径见 `jxx-to-tickets` 技能 `references/acceptance-criteria.md` 第二、三节（唯一权威源），本处只留判据：

1. **开工先立 AC 勾选区**：领卡后在工单文件「**处理步骤：**」之下建独立的「**AC 勾选区：**」，逐条列出工单里的 AC 编号（`- [ ] AC-<n>`，编号原样、不改写、不合并、不重编）；行格式与证据写法见第 3 条。
2. **无 AC 就停手**：工单没有任何 `AC-<n>` 行（或只有「实现 X 功能」这类无断言行）⇒ **不写代码**，先按规范补 AC 或退回生产侧（`jxx-to-spec` / `jxx-to-tickets`），补完重来。
3. **做完一条勾一条**：`- [ ] AC-n` → `- [x] AC-n`，**同一行追加证据**，行格式收敛为 `- [x] AC-<n> | 证据：<用例名 / 命令 + 退出码 / 文件:行>`——不复抄类别与验证方式（复抄会与 `ac-audit` 的类别统计打架）。证据必须自己跑出来，不抄他人结论、不写「已验证」。
4. **全勾才交审**：AC 全部 `- [x]` 且逐条带证据，是置 `pending-review` 的前置；留未勾项就交审 ⇒ 交付不完整，直接退回。
5. **默认不开浏览器验收（v1.12.0）**：AC 证据只能是命令 / 用例名 / `文件:行`——截图、点页面、肉眼观察不算机器证据。UI 类 AC 要么做成机器可断言的形态（组件测试断 DOM / 文案 / 状态、e2e 用例、接口响应字段），要么记 `验证:人工` 进 `.scratch/<NN>-<slug>/HUMAN-CHECK.md` 等真人验。**除非用户明确要求你代做 UI 验收**，不主动拉浏览器做验收、不为「看一下效果」开浏览器；被授权时代验记录按 `jxx-to-tickets` 技能 `references/acceptance-criteria.md` §二之一 留授权痕迹（授权原话 / 轮次）与取证内容，结果仍是人工项，不升格为机器证据。

## 完成步骤（不可跳过）

以下三步是实现的硬出口——不执行视为未完成（三步同样是 `**处理步骤：**` 清单的组成部分，完成即打卡）：

**审查归属（v1.9.0）：审查属于派活方，不属于执行者。** 一份 diff 只审一次，审的人是会话链上有决策权的那层：

| 谁在跑本技能 | 审查怎么办 |
|---|---|
| 主会话自己执行（你就是派活方，没有上级） | 自己跑 `/jxx-code-review`，通过后自己置 `done` |
| 被派为子代理执行（有派活方 / 编排者） | **跳过审查步**：交付移卡到待终审位，由派活方跑 `/jxx-code-review`（或派 reviewer）后裁定；执行者不跑、不声称「自审通过」、不自造审查报告 |

- [ ] **标记待审查**：第一轮功能开发完成（代码写完、本地类型检查与单测通过）后，将工单 `Status:` 置为 `pending-review`（待审查），在提交前保存。
  **AC 前置（v1.8.0）**：AC 勾选区全部 `- [x]` 且逐条带证据；未全勾不得置 `pending-review`。
- [ ] **代码审查**（**被派子代理跳过本步**，见上方「审查归属」）：调用 `/jxx-code-review` 审查所有变更（diff 基准 = origin/main——所有工单分支都从 main 拉出）。审查通过前不得提交；审查有发现项时按下方流程修复后重新审查。
  **AC 前置（v1.8.0）**：审查按 AC 逐条判定 `met` / `partial` / `missing`（规范第五节）；判定表缺项或仍有未勾 AC 的审查不算通过。
- [ ] **标记结束并提交**：代码审查通过（或无发现项、用户明确确认无视）后，将工单 `Status:` 置为 `done`（结束），再将工作 commit 到**工单分支** `ticket/<卡id>`（worktree 内）。**置 `done` 的裁定权 = 派活方**（主会话自干时即执行者自己；审查未通过时执行者不得自行置 `done`；审查者的步骤 6 只复核与报告，不代置）。commit message 遵循 conventional commits 格式，body 说明变更原因。
  **AC 前置（v1.8.0）**：`node <本技能目录>/scripts/ac-audit.mjs <工单文件>` 退出码 0；非 0 先按报告修 AC，再置 `done`。脚本随本技能分发（副本与 `jxx-to-tickets` 同源）；万一缺失，按 `jxx-to-tickets/references/acceptance-criteria.md` 自查后再置 `done`，不要跳过这一步。

### 防劣化门禁（独立执行，不采信他人结论）

改代码的工单必须**自己跑遍**规范第四节的 5 条门禁——审查者的结论不能当自己的证据（对方也可能漏跑）。判据正文见 `references/acceptance-criteria.md` §四（唯一权威源），本处只留名称与命令：**既有全量测试全绿** · **公共符号 diff** · **断言放宽扫描** · **依赖与配置** · **行为基线**。逐条留证据（命令 + 退出码 + 摘要），填进 AC 勾选区对应 `[回归]` / `[负向]` 行的证据位。

```bash
# $B = origin/main；全部命令在工单 worktree 内跑
B=origin/main
git diff --stat $B...HEAD                        # 1 先看改动面，再跑项目全量测试命令（如 pnpm test）
git diff $B...HEAD -- '*.ts' '*.tsx' '*.d.ts'    # 2 公共符号：逐看 export / interface 的删除与签名变更
git diff $B...HEAD                               # 3 断言放宽：只看新增行（^+）里的 skip / only / as any / timeout
git diff $B...HEAD -- '*lock*' '*package.json'   # 4 依赖与配置清单
# 5 基线：改动前把工单点明命令的输出存 .temp/output/<卡id>-before.txt，改动后同命令重跑再 diff
```

任一为 no ⇒ 不交审。确属需求变更（例如确需改公共签名）⇒ 先回工单补 AC 与覆盖声明、PRD 侧确认，再继续——**不得**靠删用例或改断言让门禁变绿。

### 交付（硬出口之后）

- [ ] **交付移卡**：commit 整齐、`git push origin ticket/<卡id>` 后，在卡的「交付记录」追加提交范围（审查报告指针由做审查的一方审完后填），并按卡内「## AC 覆盖表」逐条写实（编号 | 类别 | 期望结果 | 自报判定 | 证据坐标），然后 `board.mjs card-move --root <项目根> --id <卡id> --to review`（卡到待终审位），刷看板（`board.mjs html --root <项目根>`），回报「已交付待终审」。**合并不是本技能的事**——合并专员把工单分支回合 main（PROTOCOL §3，含 PRD 工单，v0.14.0 起）；技术受阻才暂存 PRD 分支或 blocked，且必须向用户汇报不能回合的原因。

### 交付之后：收口是四段闭环（v0.15.0 起，PROTOCOL §3）

合并不是「合完就完」。收口 = `复核 → 合入前预演（merge-check）→ 合入 main → 回收工作空间（rm-wt）`，**四段缺一不算收口**，且最后一段以前没有判据（实测积下 105 个孤儿分支 / 6 张 done 卡仍挂 worktree）。你作为开发组要知道的三件事：

- **现场不归你管**：合并专员合入后 `rm-wt` 回收 `wt/<卡id>` 与已合入的 `ticket/<卡id>` 分支（含远端残留——`rm-wt`/`verify` 都只看本地，远端 `origin/ticket/<卡id>` 需按协议 §3 第四段「删前零丢失实证 + 删后 `ls-remote` 复核零残留」两条硬出口人工闭环）。别自己删（可能还在返工路径上），也别假设现场永远在。
- **冲突在碰工作树之前就已知**：合并专员先跑 `board.mjs merge-check --root <项目根> --id <卡id>`（内存三方预演，不落现场）。判为 `✗非机械`（binary / modify-delete / rename）的冲突**会交回你**——那几类没有可逐 hunk 保留的双方意图，合并专员不许自行发明行为。你按 `/jxx-resolving-merge-conflicts` 处理（追溯来源 → 逐 hunk → 跑检查 → 完成，**绝不 `--abort`**）。
- **解冲突 = 改 diff = 原审查失效**：你解决冲突后必须重跑 `/jxx-code-review` 再交（ADR-005）。合并专员不替你重审。
- **受阻暂存不回收**：你这一单若因门禁红 / 依赖序未到被暂存进 PRD 分支，现场会保留（活还没上 main）——这是正常的，不是漏回收。

工单状态流转：`ready-for-agent` → `pending-review`（功能开发完）→ `done`（审查通过）。完整生命周期见 `docs/agents/issue-tracker.md` 的「工单状态与生命周期」节。

### 审查发现问题时的处理流程

本节面向**做审查的一方**（主会话或 reviewer）。被派执行者不跑审查；派活方回传的发现项按「返工」处理（卡改回 `.claimed`，改完重交）。

当 `/jxx-code-review` 返回的报告中存在发现项时，按以下步骤执行：

1. **禁止提交**：审查有发现项，不得执行提交步骤。
2. **输出审查报告**：将 `/jxx-code-review` 的输出原样呈现给用户，不做格式转换或摘要。
3. **用户决策**：在报告末尾追加选项：

```
请选择处理方式：
A. 修复审查发现的问题后重新审查
B. 无视问题，直接提交（需用户明确确认；`partial` / `missing` 的 AC 与假实现除外）
```

4. **选项 A — 修复**：逐项修复审查报告中的发现项，修复后重新执行 `/jxx-code-review`，重复此流程直到审查无发现项或用户选择 B。
5. **选项 B — 无视提交**：用户明确确认后，跳过审查要求直接提交。commit message 中注明"代码审查未通过，用户确认无视"。**例外（不可绕过）**：判为 `partial` / `missing` 的 AC，以及**假实现**（桩 / 硬编码 / `TODO` / 空实现）必须先修好并重审——这两类不是「取舍」，是功能没交付，用户确认也不能放行。
6. **AC 返工必须回到勾选区**：审查报告判为 `partial` / `missing` 的 AC，逐条回到工单「**AC 勾选区：**」返工——先把该行取消勾选（`- [x]` → `- [ ]`），改完再勾，并**重写证据**（用例名 / 命令 + 退出码 / `文件:行`）。只改代码不补证据 ⇒ 返工未完成，不得再交审。判定口径见规范第二、五节。
