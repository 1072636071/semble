# 工单公告板协议（PROTOCOL）— 唯一真源

> 你是被用户拉起的 agent。本文件是你全部工作规则的出处，先完整读完再行动。
> 工作区根目录：`{{ROOT}}`　权威仓库：`{{REPO_URL}}`（基准分支 `{{BASE_BRANCH}}`）

## 0. 环境与术语

```
{{REPO_PATH}}\       权威主工作区（外部路径；领导者管辖，worker 不在此干活）
{{ROOT}}\
├── wt\<卡id>\       工单工作区，一人一目录，分支 ticket\<卡id>
└── control\         公告板（git 外，协调专用）
    ├── PROTOCOL.md  本文件
    ├── ledger.md    领导者账本（只有领导者可写）
    ├── board.html   用户进度看板（领导者保鲜职责）
    ├── CARD-TEMPLATE.md
    ├── starter\     角色启动提示词（dev / merger / reviewer / auto）
    ├── cards\{inbox,claimed,review,done,blocked}\   目录即状态
    └── held\        领导者暂缓道（依赖未就绪的卡停这里，worker 不可见、不可移入移出）
```

- **工单卡**：一个 md 文件 = 一张卡 = 一个 `.scratch\` 工单 = 一个分支，严格 1:1（薄卡：卡只放指针与协调记录，**成果正文一律进 git 分支**）。
- **状态即位置**：卡躺在哪个目录，就处于什么状态。流转 = 移动文件。

## 1. 领取规矩（防抢，不可协商）

0. **难度是给用户的**：卡的「难度/模型档位」供用户拉起会话时选配 LLM，worker 不必自报档位、不得以此互相挑活；领卡顺序只看「依赖」。唯一软规则：若用户启动时明示"你跑的是快速/廉价模型"，遇 L3/L4 卡优先让给他人，回报用户而不是硬着头皮接。定级判据（领导者投卡时按此定级并记账）：
   | 级别 | 判据 | 建议模型 |
   |---|---|---|
   | L1 | 机械改：单文件、卡内指令明确（改文案、补字段、加日志） | 快/便宜模型 |
   | L2 | 有界实现：规格清晰、跨 2-4 文件、无设计决策 | 中档 |
   | L3 | 需判断：跨模块、要选实现方案、要动测试架构 | 强模型 |
   | L4 | 设计级：改公共接口/数据模型/协议本身 | 最强模型 + 双重审查（组内审 + 独立干净会话复审） |
1. 看活只找 `cards\inbox\` 中的卡；**开发卡** id 形如 `NNN-slug`，**合并卡** 形如 `merge-NNN-slug`（只有合并专员领后者）。依赖未就绪的卡由领导者投卡时自动收进 `control\held\`（等依赖卡归档 done 后释放回 inbox），worker 对 held 既不看也不动。
2. 领取 = 先移动文件，后填卡：
   ```bash
   mv "<root>\control\cards\inbox\<卡id>.md" "<root>\control\cards\claimed\<卡id>.md"
   ```
   移动成功 → 卡归你；报"文件不存在" → 已被他人抢走，换下一张。**绝不允许先在卡里写字再移动。**
   **每次移卡之后（领取/交付/blocked/返工皆同）必须刷看板**，用户的浏览器靠这一步保持追踪：
   ```bash
   node {{SKILL_DIR}}/scripts/board.mjs html --root "{{ROOT}}"
   ```
3. 领到后立即在卡的「领取记录」追加：领取者（你的会话标识/角色名）、分支 `ticket/<卡id>`、工作目录 `wt/<卡id>`、UTC+8 时间。
4. 开辟工作区：若 `{{ROOT}}\wt\<卡id>\` 已存在（领导者预开），直接进入装依赖；否则
   ```bash
   node {{SKILL_DIR}}/scripts/board.mjs add-wt --root "{{ROOT}}" --ticket <卡id>
   ```
   然后在 `wt\<卡id>\` 内安装依赖、按卡的 PRD 指针读工单正文开工。

## 2. 开发组规则

- **推进方式（强制）**：领到开发卡后全程用 `/jxx-implement` 技能推进（harness 未装该技能 → 卡记 blocked 回报用户，不得裸写绕过）。其三段完成硬出口——①工单 `Status:` 置 `pending-review` ②`/jxx-code-review` 审全部变更、有发现项即修复重审、通过前不得提交 ③审查通过后工单置 `done` 并 commit 到分支——**全部做完才是本卡可交付的前置条件**。
- 交付 = 移动卡：jxx-implement 三段出口完成后，在卡「交付记录」追加提交范围 + 审查报告指针，并把**需要终审实证的事项逐条写进「终审待验清单」**（验收关键项+自报结论+越界/豁免声明——合并专员将逐项实证，写虚的会被打回），然后
  `mv claimed\<卡id>.md review\<卡id>.md`，**刷看板（§1.2 的 html 命令）**，并回报用户"已交付待终审"。
- 组内其余流程自定（jxx 系列技能照常），但成果必须满足：
  1. 一切成果（代码、工单文档增量、**审查报告**）都在 `ticket/<卡id>` 分支上；审查报告放分支内 `.scratch/<工单>/reviews/`，审查报告即 /jxx-code-review 产物（干净视角执行，针对 `git diff {{BASE_BRANCH}}...ticket/<卡id>`）。
  2. 分支已 commit 整齐（无未提交残留），已 `git push origin ticket/<卡id>`（remote 是成果备份面）。
- 返工：被移回 `claimed\`（终审意见写在卡的「流转追加段」）→ 继续在原 worktree/分支干活，改完再交。
- 干不下去：卡「流转追加段」写原因，`mv claimed review/blocked 视情况 → blocked\<卡id>.md`，**刷看板**，回报用户。
- 禁止：动权威工作区（`{{REPO_PATH}}`）主干、提交到 `{{BASE_BRANCH}}`、移动他人 claimed 的卡、把成果正文只写在卡里。

## 3. 合并专员规则（先审后合）

- 领 `merge-<卡id>` 卡（协议同上，先 move 后填）。同一时刻**只处理一张**合并卡，多张按卡内顺序。
- **第一步是定点复核（干净视角，碰 git 之前）**：读对应开发卡（`review\<卡id>.md`）的「终审待验清单」与「交付记录」，对照工单 PRD 验收标准，用只读 git（`git show <分支>:<路径>`、`git diff origin/main...<分支>`、`git grep`）+ 可派只读子代理，逐项实证 worker 自报是否属实：修复真在？越界夹带？报告实体？清单每项给 闭合✓/未闭合✗+证据。
- **复核过 → 才执行合并**：`git -C "{{REPO_PATH}}" fetch` → 把 `ticket/<卡id>` rebase 到最新 `{{BASE_BRANCH}}` → 合入并 push → 回收 worktree/分支（**回收只用 `board.mjs rm-wt --root <root> --ticket <单卡id>`，一次一卡；禁止批量/递归删除——见 §7**）。
- **复核不过 → 打回**：merge 卡写明发现项后 `mv → blocked\`（或按卡指示回 `review\`），开发卡退回 `claimed\` 附发现项；**禁止带伤合并**。
- 例外：merge 卡若标注「领导者口径裁决未决」（L4 卡或跨单口径冲突），合并专员只做复核不做裁决，复核结论回报后待领导者拍板才可合。
- **冲突红线**：rebase 冲突超出机械可解（需发明新行为才能解）时，不得自行发明——把卡退回 `review\` 并在流转段写明冲突面，交回开发组按 `jxx-resolving-merge-conflicts` 处理。解决即改 diff，diff 变了必须复审。
- 合并成功：merge 卡追加结果（合入 commit、复核结论行、时间），`mv → done\`，**刷看板**；对应开发卡由领导者移 `done\`。

## 4. 卡内文法（verify 对账依赖，勿改）

- 领导者记账的移卡动作：`move <卡id>.md <from>-><to>`（写在 `control\ledger.md`）。
- 卡内记录行统一以 `- ` 开头，字段名前缀固定：`- 标题:`、`- 难度:`、`- 模型档位:`、`- 领取者:`、`- PRD:`、`- 分支:`、`- worktree:`、`- 依赖:`（PRD/分支/worktree 即工单定位三件套，agent 据此找文件）。

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
2. **spawn worker**：对每张无阻塞的 inbox 卡，spawn 一个独立子 agent（`subagent` 或 `spawn_teammate`，agent 自行选择——只要能独立上下文、尽可能并行）。worker 提示词 = `control/starter/starter-dev.md` 全文 + 指定卡 id。
3. **监控**：worker 回报后，检查卡位置——
   - 卡在 `review/` → 触发审查（§5.3）
   - 卡在 `blocked/` → 读卡内原因，**先重试一次**（重新 spawn worker 或提示用户）；重试仍 blocked → 保留 blocked，**继续推进其他不阻塞的卡**
   - 卡在 `claimed/` 超时（默认 30 分钟无动静）→ 视为僵死，重新 spawn worker 接力
4. **spawn 审查者**：卡在 `review/` 时，spawn 3 个独立审查者（§5.3），并行审查。
5. **审查结果处理**：
   - 3 个审查者全部通过 → spawn 合并专员（§5.4）
   - 任一审查者有发现项 → 把发现项汇总写回卡的「流转追加段」，卡移回 `claimed/` 返工，重新 spawn worker
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

### 5.4 合并专员规则（auto 模式）

- auto 模式下合并专员由编排者 spawn，职责与 §3 一致——先审后合、冲突红线、禁止带伤合并。
- 合并专员处理合并冲突时：机械冲突（重命名、import 路径、格式）可自行解决；**需发明新行为的冲突** → 卡移 `blocked/`，等人工处理。
- 合并成功 → merge 卡 + 开发卡移 `done/`，记账，刷看板。

### 5.5 失败处理

- **worker 失败**：先重试一次（重新 spawn）；仍失败 → 卡 `blocked/`，编排者继续推进其他卡。
- **审查失败**：发现项汇总 → 卡 `claimed/` 返工 → 重新 spawn worker → 重新审查。
- **合并冲突**：机械冲突 merger 自解；非机械冲突 → 卡 `blocked/` 等人工。
- **编排者自身失败**：`verify` 重建状态，从断点续接。

## 6. 断线 / 交接

- 你的全部状态都在：卡内流转段 + 分支历史 + worktree + 看板 git 历史（见 §7）。会话死了，新会话领同一张卡（用户指示下手动改「领取者」）即可续接。
- 拿不准现状就少做一步、多问用户一句；协议没覆盖的情况，**停下来问**，不要发明规矩。

## 7. 破坏性操作红线与看板自保（2026-09-30 事故后新增）

**事故**：2026-09-30 07:22，一次被授权的「批量回收 worktree」失控，把整个 `control\`（账本 + 254 张卡 + 三页看板）与多数 worktree 目录一并删掉；当时 `control\` 无版本控制 ⇒ 历史**不可还原**，只能按内存重建 16 张卡，其余约 242 张只剩索引。过程记录见 `control/RECOVERY-*.md`。 **事故取证入口**：harness 会话转录在 `~/.dsh/sessions/<cwd-slug>/<session-id>/session.v4.jsonl.zstd`，是**多帧 zstd**——按 4 字节魔数 `28 B5 2F FD` 切帧逐帧解压，即可回放某个子代理当时真正敲的命令（本轮即以此定位到「绕过 rm-wt、用 `cmd /c rmdir /s /q` 三次重跑」的事实）。

四条红线：

1. **回收只走授权通道**：`node <skill>\scripts\board.mjs rm-wt --root <root> --ticket <单卡id>`，**一次一卡**。该命令只接受单段目录名、只删 `<root>/wt/<单卡id>`，越界即拒。禁止 `rm -rf` / `Remove-Item -Recurse` / 通配符 / 循环批量删除。
2. **`control\` 只读不删**：任何删除、清空、递归覆盖 `control\` 的命令一律禁止；改模板走 `board.mjs render --write`（旧版自动备份到 `control/.render-backup/`）。
3. **禁止把批量破坏性操作交给子代理**：领导者不得授权「把剩下的孤儿一起清了」这类批量动作；子代理只领**单张卡**的明确 id。批量清单留在 `control/human.html`，由人逐条确认后单张执行。
4. **禁止后台/长超时运行破坏性命令**：工具在超时后会把命令**提升为后台任务继续跑**（本仓 harness 的 pwsh 行为），于是「以为它超时了」时删除仍在进行、且无人再看输出。回收一律用 `board.mjs rm-wt`（有界、秒级），不要给它 `timeoutMs` 长值、不要 `run_in_background`；任何删除动作之后**必须先重新查实况**再下结论。
5. **破坏前先留档**：`control\` 由工作区根 git 仓库自保——变更类命令（`ledger` / `card-move` / `card-set` / `new-card` / `card-rm` / `init`）每次自动留一版快照；大动作前后可显式跑 `board.mjs snapshot --root <root>`。`git -C <root> log --oneline` 即看板历史，`git -C <root> show <sha>:control/cards/...` 即任意时点的卡。**新工作区建仓口径**：`git init <root>` + `.gitignore` 写 `wt/`（worktree 属产品仓，不纳入）。
