---
name: jxx-to-spec
description: "将当前对话转化为 spec 并发布到 issue tracker。当用户说写 spec、to spec 时触发。不访谈，只综合已有讨论。"
disable-model-invocation: false
metadata:
  version: 1.6.0
---

本技能将当前对话上下文和代码库理解转化为规格文档（你可能称之为 PRD）。不要访谈用户——仅综合你已知的内容。

issue tracker 和 triage 标签词汇表应该已提供给你——如果没有，运行 `/jxx-setup-skills`。

## 流程

1. 探索仓库以了解代码库的当前状态（如果尚未探索）。在整个规格文档中使用项目的领域词汇表，并遵守相关区域的 ADR。

2. 勾画出测试该功能的 seam。优先使用已有 seam 而非新建。使用尽可能高层的 seam。如果需要新 seam，在最高可能的位置提出。代码库中 seam 越少越好——理想数量是一。

与用户确认这些 seam 是否符合预期。

本功能**涉及 UI**（新增或改动界面、交互、用户可感知的输出）时，**写 PRD 前先问一次**：是否需要 agent 代做 UI 验收？默认不需要——agent 不主动开浏览器、不截图取证，UI 体验项进 `.scratch/<NN>-<slug>/HUMAN-CHECK.md` 等真人验；用户要求代验时，PRD 对应 AC 记 `验证:人工 <HUMAN-CHECK 第 n 条>` 并写明「用户授权 agent 代验」。判据见 `jxx-to-tickets` 技能 `references/acceptance-criteria.md` §二之一。

3. 使用下面的模板编写规格文档，然后发布到项目 issue tracker。应用 `ready-for-agent` triage 标签——无需额外 triage。

发布路径：在仓库根目录的 `.scratch/` 下创建功能目录 `<NN>-<feature-slug>/`，将规格文档写入 `.scratch/<NN>-<feature-slug>/PRD.md`。`<NN>` 为从 `01` 起的全局递增顺序号，按创建先后排列（如第一个功能为 `01-login/`）。具体目录与文件约定见 issue tracker 定义（`/jxx-setup-skills`）。

4. 发布前自检（v1.3.0 起，不可跳过）：`node <本技能目录>/scripts/ac-audit.mjs <功能目录> --strict`（脚本随本技能分发，副本与 `jxx-to-tickets` 同源；万一缺失，按 `jxx-to-tickets/references/acceptance-criteria.md` 逐条自查，不得跳过）。

   - 退出码 `0` ⇒ 放行，可发布。
   - 退出码 `2`（`没有工单类文件`）⇒ **仅**在「PRD 全 defer、AC 交给工单层」时放行：发布说明写明落地位置「AC 落地位置：工单层（jxx-to-tickets）」。PRD 已写验收点节却零 AC 行 ⇒ 按硬问题处理，不得当 defer。
   - 退出码 `3` ⇒ 调用错误（路径 / 用法），必须修正后重跑，**不得**当 defer 放行。
   - 退出码 `1`（有硬问题）⇒ **不得发布**；按报告逐条修 AC，或补 `map.md` 的「## AC 覆盖矩阵」后重跑。
   - 边界：文件名是 `PRD.md` 时脚本自动宽松——编号仍硬查，缺验证标注 / 类别不足 / 缺回归负向只报软问题。所以 PRD 层可以只给草案，但**推荐**按模板「## 验收点（AC）」写足；工单层的 AC 不得少于 PRD 层承诺的验收点。

### 服务器上行与本地落盘同属发布动作（默认纪律 · v1.2.0，非可选项）

PRD 本地落盘的**同一步**内必须同步上行服务器工单系统（jxx-ticket）——不存在「先本地、服务器以后再说」：项目已接入服务器工单（repo_key 在 `jxx_tickets` 中出现）时，PRD 上行是发布动作的一部分，未经上行的 PRD 视为发布未完成。工具面与参数契约见项目内 `agents/skills/jxx-ticket-router/SKILL.md`（项目技能，`read` 加载；项目未提供该文件时以 MCP `tools/list` 自披露 schema 为准），`jxx_ticket_push` / `jxx_ticket_call`；配套 CLI 仓可直接 `node tools/ticket-uplink.mjs --root <仓库根>`，幂等按 repo_key+title 判重：

- **新建**：PRD 落盘后立即上行（labels 带 `prd:<NN>-<slug>` 归组），把服务器回写的 ticket_no + id + version 记入 PRD 正文或本地评论留痕；
- **后续修订（v1.4.0 起走写腿）**：项目内有 `tools/ticket-flow.mjs` 时——**状态 / 标签 / 认领**用一条写腿完成「改本地 md + 推服务器」：`node tools/ticket-flow.mjs --root <仓库根> --file <PRD.md> --set status=<本地词表> [--set labels=a,b]`；**打卡 / 评论**附 `--comment "<一句话>"`（写腿不 create、也不改自由正文）；**正文整篇修订**改完 md 后跑只读腿 `node tools/ticket-flow.mjs --root <仓库根> --file <PRD.md>` 收敛（内部 get 最新版，`version_conflict` 自动重拉重试一次）。退出码：0 收敛 / 2 评论撞上「服务器版本已前进」按条目 `server`/`local`/`resolution` 裁决后重跑 / 3 本地已还原或未变。**不要先手改状态或标签再手工 update。**项目没有该 CLI 时回退 MCP 双写：`get` 拿最新 `version` 作 `base_version` → `jxx_ticket_call update`（409 冲突先对账再推，不盲目重试）；
- **批量安全**：批量 push 的 id 必须从当次 `list` 实测逐条核对，不得凭表格手抄——串位会把正文写进邻居工单（2026-10-15 实测事故）；
- **离线降级**：仅当服务器不可达时才允许只写本地，回连后 `jxx_ticket_sync`（给投影根）对账收口。

> 确定性环节可调用脚本（零依赖）：`node <本技能目录>/scripts/issue-flow.mjs to-spec --slug <name> --root "<仓库绝对路径>/.scratch"`。
>
> **路径一律用绝对路径。** 脚本会在任意 cwd 下被调用，相对路径按 cwd 解析——cwd 一旦不是目标仓库（例如停在技能安装目录），产出就会落到错误位置。
>
> 根目录解析：不给 `--root` 时，脚本从 **cwd 向上**寻找含 `.git` / `.scratch` 的仓库，再取该仓库的 `.scratch`。因此**必须在目标仓库目录内执行**。三种情况脚本直接报错退出，绝不静默写错目录：① 不在任何仓库内；② cwd 落在工具安装目录（`~/.workbuddy`、`~/.codebuddy` 等）内；③ `--dir` 传相对路径且 cwd 位于工具安装目录内。
>
> 落盘前先 `--dry-run` 打印目标路径，确认它在目标仓库内再正式执行。
>
> 维护：`issue-flow.mjs` 有三份同步副本（本源 `base/scripts/issue-flow.mjs`）。改完本源执行 `node base/scripts/check-copies.mjs --fix` 同步全部副本（`check-copies.mjs` 不带参数即校验）。
>
> **改完必须再跑 `node base/scripts/ship.mjs install` 刷新各平台已安装副本**——安装副本不会随仓库改动自动更新，而过期的安装副本会让上述全部防护失效（这正是 1.1.2 修的历史事故）。

<spec-template>

## 问题陈述

用户面临的问题，从用户视角描述。

## 解决方案

问题的解决方案，从用户视角描述。

## 用户故事

一个**长**的、编号的用户故事列表。每个用户故事应采用以下格式：

1. 作为 <角色>，我想要 <功能>，以便 <收益>

<user-story-example>
1. 作为手机银行客户，我想要查看账户余额，以便我能更好地做出消费决策
</user-story-example>

用户故事列表应极其详尽，覆盖功能的所有方面。

**硬要求（v1.3.0）**：每条用户故事必须被至少 1 条验收点覆盖。写完用户故事立即做覆盖自检（逐条用户故事指到 ≥1 个 `AC-<n>`），结果写进 `.scratch/<NN>-<slug>/map.md` 的「## AC 覆盖矩阵」节（节名与列义见规范第一节）。任一用户故事无 AC ⇒ 先补 AC，不得发布。

## 验收点（AC）

按用户故事聚合的验收点草案——每条用户故事至少 1 条 AC。编号 `AC-<n>` 从 1 连续、本 PRD 内唯一；格式、覆盖清单（14 类，见规范 §一）、禁词、验证方式标注**一律照** `jxx-to-tickets` 技能 `references/acceptance-criteria.md` 第一、二节，本处不复述。

- **PRD 层 AC 是承诺下限**：工单层可细分（拆条、补错误路径与边界），但**不得少于** PRD 层承诺的验收点，不得删条、不得降级。
- 每条落成机械可核对的句式：`- [ ] AC-<n> [<类别>] 当 … 时，…，则 … —— 验证:机器 <用例名|命令>`；写不出可观测结果的不算 AC。
- **每条 AC 写前过「缺信息」四问**（执行者 / 对象 / 时机 / 例外），缺一项就在 PRD 里补成结论，不留给读实现的人猜——补不出结论的进 `## 待决` 并标去向，不写成含糊的默认。判据见 `jxx-writing-for-agents` 技能「歧义」节。
- **含 UI 的条目**：默认写成机器可断言形态（组件测试断 DOM / 文案 / 状态、e2e 用例、接口字段）；只有用户明确要求 agent 代验的才记 `验证:人工 <HUMAN-CHECK 第 n 条>` 并标授权（规范 §二之一）。浏览器截图不是机器证据。

## 实现决策

已做出的实现决策列表。可包括：

- 将要构建/修改的模块
- 将要修改的模块接口
- 来自开发者的技术澄清
- 架构决策
- Schema 变更
- API 契约
- 具体交互

不要包含具体文件路径或代码片段。它们可能很快过时。

例外：如果 prototype 产出了一个比文字更精确地编码决策的片段（状态机、reducer、schema、type shape），在相关决策中内联并简要注明它来自 prototype。只保留决策密集部分——不是可运行的演示，只是关键信息。

## 测试决策

已做出的测试决策列表。包括：

- 什么样的是好测试的描述（仅测试外部行为，不测实现细节）
- 哪些模块将被测试
- 测试的先例（即代码库中类似类型的测试）

## 超出范围

此规格文档范围外的事项描述。

## 补充说明

关于功能的任何进一步说明。

</spec-template>
