---
name: jxx-implement
description: 基于 spec 或一组 ticket 实现（implement）用户描述的工作。统一开发面：必须在项目内的工单 worktree（wt/<卡id>）里开发、走统一看板（jxx-ticket-board）的卡位流转，三段硬出口不变。
disable-model-invocation: false
metadata:
  version: 1.3.0
---

实现用户在 spec 或工单中描述的工作。

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
- 之后的状态流转（pending-review / done / labels）在改本地 md 的同时用 `jxx_ticket_call update` 双写服务器（`jxx-ticket-router` 技能）；服务不可达时照常直写本地 md（离线降级），回连后 `jxx_ticket_sync` 收口。
- 本仓无 `tools/jxx-bootstrap.mjs` 的项目（未接此套工具）：以「`jxx_ticket_call list` 按 repo_key 查询 + 无则 `create` 种子工单」同语义手动执行（口径见 `references/ADR-010-server-first-tickets.md`）。

## 完成步骤（不可跳过）

以下三步是实现的硬出口——不执行视为未完成：

- [ ] **标记待审查**：第一轮功能开发完成（代码写完、本地类型检查与单测通过）后，将工单 `Status:` 置为 `pending-review`（待审查），在提交前保存。
- [ ] **代码审查**：调用 `/jxx-code-review` 审查所有变更（diff 基准 = origin/main——所有工单分支都从 main 拉出）。审查通过前不得提交；审查有发现项时按下方流程修复后重新审查。
- [ ] **标记结束并提交**：代码审查通过（或无发现项、用户明确确认无视）后，将工单 `Status:` 置为 `done`（结束），再将工作 commit 到**工单分支** `ticket/<卡id>`（worktree 内）。commit message 遵循 conventional commits 格式，body 说明变更原因。

### 交付（硬出口之后）

- [ ] **交付移卡**：commit 整齐、`git push origin ticket/<卡id>` 后，在卡的「交付记录」追加提交范围 + 审查报告指针、「终审待验清单」逐条写实，然后 `board.mjs card-move --root <项目根> --id <卡id> --to review`（卡到待终审位），刷看板（`board.mjs html --root <项目根>`），回报「已交付待终审」。**合并不是本技能的事**——合并专员默认把工单分支回合 main（PROTOCOL §3，含 PRD 工单，v0.14.0 起）；技术受阻才暂存 PRD 分支或 blocked，且必须向用户汇报不能回合的原因。

工单状态流转：`ready-for-agent` → `pending-review`（功能开发完）→ `done`（审查通过）。完整生命周期见 `docs/agents/issue-tracker.md` 的「工单状态与生命周期」节。

### 审查发现问题时的处理流程

当 `/jxx-code-review` 返回的报告中存在发现项时，按以下步骤执行：

1. **禁止提交**：审查有发现项，不得执行提交步骤。
2. **输出审查报告**：将 `/jxx-code-review` 的输出原样呈现给用户，不做格式转换或摘要。
3. **用户决策**：在报告末尾追加选项：

```
请选择处理方式：
A. 修复审查发现的问题后重新审查
B. 无视问题，直接提交（需用户明确确认）
```

4. **选项 A — 修复**：逐项修复审查报告中的发现项，修复后重新执行 `/jxx-code-review`，重复此流程直到审查无发现项或用户选择 B。
5. **选项 B — 无视提交**：用户明确确认后，跳过审查要求直接提交。commit message 中注明"代码审查未通过，用户确认无视"。
