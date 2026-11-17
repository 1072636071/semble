---
name: jxx-design-review
description: "用 fresh-context reviewer 对 PRD 或设计文档做五阶段独立复审。当用户说设计复审、spec review、Goldfish、实现前审查，或 to-spec 发布前需要独立检查时触发。不审代码 diff，不替代测试、AC 判定或 jxx-code-review。"
disable-model-invocation: false
user-invocable: true
x-install: true
metadata:
  version: 1.2.0
  license: Apache-2.0
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-design-review, codebuddy]
    description-en: |-
      1. Review PRDs and design documents through five fresh-context stages.
      2. Triggered by: design review, spec review, Goldfish, and pre-implementation review.
      3. Fail closed when fresh-context delegation is unavailable; never substitute same-context review.
      4. Usage: initialize manifest → dispatch isolated reviewers → resolve findings → seal report.
      5. Requires explicit permission and a host tool for fresh-context subagents; no EGM installation required.
  codebuddy:
    allowed-tools: [read_file, search_content, write_file, bash]
  opencode:
    license: Apache-2.0
  trae: {}
---

<!--en-->
# jxx-design-review

Review a PRD or design document before implementation. Do not review a code diff and do not replace tests, acceptance evidence, or `jxx-code-review`.

## Inputs and profiles

Require `TargetFile`, `OutputDir`, and `Profile`: `full`, `feature`, or `readiness`. Use `full` for multi-session or architectural work, `feature` for a feature-only document, and `readiness` for an existing implementation plan. Never silently reduce the profile. Downgrade rule: after a round judged the architecture SOUND (no structural Blocker) and remaining findings are mechanism detail or wording, the profile may be downgraded to `readiness` (stage 5 only) with explicit user approval; pass `--downgrade-from <prior manifest> --approval "<user decision>"` to init, which rejects unapproved downgrades with `ERR_DOWNGRADE_UNAPPROVED`.

## Isolation contract

Check that the current session explicitly permits subagents and exposes a real fresh-context subagent tool. If either is unavailable, initialize the manifest, record `ERR_FRESH_CONTEXT_UNAVAILABLE` with the `fail` command, report `not_run`, and stop. A same-context review is not a Goldfish review and must never be reported as `passed`.

Fresh context means no parent turns, author summary, implementation conclusions, or hidden orchestrator analysis. Supply only the target, explicitly approved context files, the selected persona, and its standard. Record every context file. Do not claim that host instruction files are excluded unless the host has verified that property. An adjudicated ledger (REJ precedents and settled mechanism decisions — decisions plus rationale only, no author summaries or orchestrator analysis) may be supplied as explicitly approved context to prevent re-litigation. Reviewers stay independent: overturning a ledger entry requires new evidence and a citation of the entry.

## Workflow

0. Run `pre-review-gate.mjs` before init: deterministic checks for AC cross-references (including qualified `工单 NN AC-M` cross-space refs), ticket references, file:line citation validity, version-marker sync, sidecar staleness, configured stale phrases, and optional SQL probes. With `gate-config.json` → `boundary` also run C8 `deliverable-carried` (every AC evidence file is owned by some phase) and C9 `phase-order` (no AC is gated at a phase that precedes the creation of its evidence); phase gates are read from the target's own gate table unless `boundary.gates` overrides. Resolve or explicitly waive every finding; init only after exit 0. Maintain `gate-config.json` next to the target: after each round's triage, add superseded phrases as `stalePatterns` (regex + rationale citing the TRIAGE id) so the next round catches residue mechanically.
1. Run `design-review.mjs init` to create a new round directory and bind the review to the target SHA-256. Keep prior rounds immutable. `init` refuses a target hash that an earlier round already sealed (`ERR_DUPLICATE_ROUND`); re-reviewing identical bytes yields no new findings, so resume the existing round or override deliberately with `--force-duplicate-round "<reason>"`. Init precondition: all prior-round revisions and cross-artifact sync (tickets, map, AC matrices, sidecars, version headers) are complete and the gate passed — mid-round target edits and unfinished sync are the main cause of wasted rounds. Supply the adjudicated ledger via `--context`.
2. Stop with `not_run` when isolation is unavailable. Use `incomplete` for an execution failure after review has started. If the target changes mid-round (`ERR_STALE_REVIEW` from record/seal), fail the round immediately; do not dispatch more reviewers.
3. Execute the selected stages in order. Every reviewer and synthesizer runs in fresh context. Reviewers return findings; the orchestrator retains all decisions.
4. Read only the persona and standard needed for the current stage from `references/upstream/`. Do not load the whole snapshot into the main context.
5. Record each completed stage with `record`. Preserve the comprehension paraphrase and the finding-to-action traceability matrix.
6. Resolve findings in the main session, and keep the findings machine-readable: write the consolidated report's findings to a ledger (`{findings:[{id,severity,mechanism,state,title,evidence,fix}]}`, `state` in `open`/`fixed`/`rejected`/`accepted`/`backlog`, `mechanism` a stable slug naming the mechanism rather than the sentence that reported it) and seal with `--findings <ledger.json>`. Mechanism closure rule: each FIX cluster must close the whole mechanism — answer the next question an implementer or reviewer would ask about it (formula, boundary conditions, read/write channels, failure modes, bilingual symmetry, write order) and pin it in the same revision; never patch only the cited sentence. Severity discipline: Blocker = unsound architecture or a design decision forced on the implementer's first step; Major = a mechanism gap causing wrong behavior or blocking a ticket; Nit = wording, consistency, formatting, cross-references. Wording and consistency findings are always Nit, never Major; the synthesizer must downgrade inflated severities. Accepted trade-offs require an explicit user decision and rationale. Never auto-accept residual findings because a retry limit was reached.
7. Seal with `passed` when open Blockers and Majors are zero (fixed or explicitly user-accepted); `open_findings` counts unresolved Blockers and Majors only, and must equal the ledger's count (`ERR_FINDINGS_MISMATCH`). Pass `--histories <rounds-dir>` so that a mechanism still open in the immediately preceding ledger blocks the seal with `ERR_MECHANISM_STALLED` unless the user accepts it via `--accept-mechanism <slug> --reason "<why>"` — a mechanism open twice is a reworded sentence, not a closed mechanism. `status --root <root> --rounds <rounds-dir>` gives the read-only overview (per-round state, stalls, duplicate hashes, whether the current target is already bound). Nits go to an implementation backlog (recorded in TRIAGE and tickets) via `seal --backlog-nits N` and do not trigger a new round; a SOUND-architecture round with only Nits left seals passed instead of re-running full stages. Otherwise seal with `changes_required`. Run `verify` before publication or ticket generation; a changed target hash is stale and requires a new round.

## Stage ownership

- Initial Zoom Out: `egm-zoom-out`, `egm-inventive-catalyst`, aggregated by `egm-synthesizer`.
- Comprehension: `egm-comprehension`, without a synthesizer.
- Design Critique: `egm-design`, `egm-structural`, `egm-style`, aggregated by `egm-synthesizer`.
- Intermediate Zoom Out: `egm-zoom-out`, aggregated by `egm-synthesizer`.
- Implementation Readiness: `egm-implementation-readiness`, `egm-codebase-details`, `egm-style`, aggregated by `egm-synthesizer`.

## Outputs and exits

Produce `manifest.json`, stage reports, and `consolidated.md`. Status is `passed`, `changes_required`, `not_run`, or `incomplete`. Use `ERR_MISSING_TARGET`, `ERR_CONTEXT_OUTSIDE_ROOT`, `ERR_FRESH_CONTEXT_UNAVAILABLE`, `ERR_STAGE_FAILED`, `ERR_STALE_REVIEW`, and `ERR_DOWNGRADE_UNAPPROVED` as recognizable failure exits. Modify no source code and create no commits.
<!--/en-->

# jxx-design-review

在实现前独立复审 PRD 或设计文档。审查对象是**文档是否自洽、完整且可实现**，不是代码 diff；本技能不代替测试、AC 证据或 `/jxx-code-review`。

## 输入与输出

**必填输入**：

- `TargetFile`：仓库内 PRD 或设计文档路径。
- `OutputDir`：本轮报告目录；每轮使用新目录，保留历史。
- `Profile`：`full` / `feature` / `readiness`。多会话、跨模块或架构变更用 `full`；纯功能文档用 `feature`；只审既有实现计划用 `readiness`。不得静默缩小范围。**降档规则**：上轮架构判定 SOUND（无结构级 Blocker）且剩余发现集中于机制细节/措辞时，可经**用户明确批准**降档 `readiness`（仅阶段 5，单轮成本约省六成）；init 传 `--downgrade-from <上轮 manifest> --approval "<用户裁决原话>"`，缺批准脚本拒绝（`ERR_DOWNGRADE_UNAPPROVED`）。

**输出**：`manifest.json`、各阶段报告、`consolidated.md`。状态只取 `passed` / `changes_required` / `not_run` / `incomplete`。

## 独立性硬契约

1. 先检查当前会话是否**明确允许子代理**，且宿主实际提供 fresh-context 子代理工具。按真实工具判断，不按产品名猜。
2. 任一条件不满足时，先初始化 manifest，再用 `fail` 记录 `ERR_FRESH_CONTEXT_UNAVAILABLE`，向用户报告 `not_run` 并停止。**不得在主会话复审、减少 reviewer 后冒充完整复审，也不得判 `passed`。**
3. reviewer 不得接收父对话轮次、作者总结、执行者结论或编排者内部分析。只给目标文档、显式批准的上下文、当前 persona 与对应标准。**已裁决台账例外**：REJ 先例与已钉死的机制裁决（仅决定＋理由，不含作者总结或编排分析）可作为显式批准上下文传入（`--context`），防重复 litigation。reviewer 仍独立判断；推翻台账条目须给新证据并引用该条目。台账文件记入 context_files。
4. fresh-context 只承诺隔离父对话。宿主指令文件是否排除必须单独验证；未验证时在 manifest 记 `host_instruction_isolation: unverified`，不得声称“完全零上下文”。
5. 所有 reviewer 与 synthesizer 都只提交发现；主会话保留采纳、驳回、修订与发布决定，不采用多 agent 投票或相互否决。

## 流程

### 0. 复审前机器门禁（init 前置）

```bash
node <本技能目录>/scripts/pre-review-gate.mjs --root <仓库根> --target <PRD路径> [--tickets <工单目录>] [--map <map.md>] [--extra-root <关联仓根>]... [--config <gate-config.json>] [--sql-probe <SQL文件>] [--out <report.json>]
```

确定性检查，先于任何 LLM 轮：AC 交叉引用（含「工单 NN AC-M」跨空间限定）、工单引用、file:line 引文实证（文件存在且行数够）、版本标记同步（PRD/工单/map/HUMAN-CHECK）、sidecar 陈旧、残句模式扫描、SQL 探针（可选，需测试库）。**exit 0 才允许 init**；发现项先修复或登记豁免理由。

配置了 `gate-config.json` 的 `boundary` 段后另跑两条阶段类检查：

- **C8 `deliverable-carried`**：每条 AC 点名的证据文件必须在文件边界表里被某个阶段拥有；无人拥有即为「产物没载体」。
- **C9 `phase-order`**：AC 在阶段 Pn 验收，而它的证据文件要到更晚阶段才创建，该阶段永远过不了。

阶段闸默认从目标文档自身的阶段闸表读取（`| Pn | `命令` | AC 列表 |`），`boundary.gates` 可覆盖；AC 在该阶段标了「本地部分／服务器部分」即豁免 C9（跨阶段分段验收是设计意图）。未配置 `boundary` 时两条都记 `skip`。

`gate-config.json` 放目标同目录（自动加载）：`stalePatterns` 由领导者每轮裁决后增补——被取代的措辞写成 regex＋理由（引 TRIAGE 编号），下轮机器拦截残句；`sidecars`、`versionFiles` 可覆盖默认。

### 1. 初始化本轮复审

```bash
node <本技能目录>/scripts/design-review.mjs init --root <仓库根> --target <PRD路径> --output <本轮目录> --profile full [--context <仓库内资料>]... [--downgrade-from <上轮manifest> --approval "<用户裁决原话>"]
```

脚本写入目标 SHA-256、审查范围、persona 清单与上下文清单。已有 manifest 时拒绝覆盖；文档变更后创建 `r002` 等新轮次，旧报告保留。**同哈希查重**：目标 SHA-256 若已被某个已封存轮次审查过，`init` 直接拒绝（`ERR_DUPLICATE_ROUND`）——同一份字节再派一轮不会有新发现，应续跑原轮；确需重审用 `--force-duplicate-round "<理由>"`，理由与撞车轮次记入 manifest 的 `duplicate_of`／`duplicate_override`。**init 前置**：上一轮全部修订＋跨产物同步（工单/map/AC 矩阵/sidecar/版本头）已完成，且机器门禁 exit 0——废轮主因是轮内改目标与同步未完成即 init。已裁决台账（REJ 先例）经 `--context` 传入。

### 2. 逐阶段执行

按选定 profile 执行下表；`full` 顺序为 1→2→3→4→5，`feature` 为 1→2→3→4，`readiness` 仅 5。阶段内可并行 reviewer，synthesizer 必须等原始发现齐全后运行。

| 阶段 | reviewer / 聚合 | 对应标准 |
|---|---|---|
| Initial Zoom Out | `egm-zoom-out`、`egm-inventive-catalyst` / `egm-synthesizer` | `zoom-out-standard.md` |
| Comprehension | `egm-comprehension`，不经过 synthesizer | 无；保留完整转述 |
| Design Critique | `egm-design`、`egm-structural`、`egm-style` / `egm-synthesizer` | `feature-spec-standard.md` |
| Intermediate Zoom Out | `egm-zoom-out` / `egm-synthesizer` | `zoom-out-standard.md`，并对照首轮变化 |
| Implementation Readiness | `egm-implementation-readiness`、`egm-codebase-details`、`egm-style` / `egm-synthesizer` | `implementation-readiness-standard.md` |

执行到某阶段时，只读取 `references/upstream/agents/` 与 `references/upstream/document-standards/` 中该阶段所需文件；不要在主会话一次加载全部上游资源。

每个 reviewer 返回：文档坐标、发现、严重度（Blocker / Major / Nit）、依据与建议。Comprehension 报告即使无发现也保留两段转述。跨阶段汇总保留“原始发现 → 行动项”的追踪矩阵，不合并掉来源。

### 3. 记录与处置发现

每阶段产物写盘后运行：

```bash
node <本技能目录>/scripts/design-review.mjs record --manifest <manifest路径> --stage <阶段id> --report <阶段报告> --reviewer <persona> [--reviewer <persona>]...
```

主会话逐项决定修复、驳回或提交用户裁决。作者可修订文档；需要接受的取舍必须由用户明确确认并记录理由。**不得以“达到重审次数”为理由自动接受残留发现。**执行中途失败用 `fail --code ERR_STAGE_FAILED` 记为 `incomplete`，保留已有报告。

**发现账本**：把综合报告的发现写成机器可读的 `findings.json`（`{findings:[{id, severity, mechanism, state, title, evidence, fix}]}`；`state` 取 `open`／`fixed`／`rejected`／`accepted`／`backlog`；`mechanism` 是机制的稳定 slug，不是报出它的那句话），封存时用 `--findings <ledger.json>` 传入。`--open-findings` 与账本统计不一致直接失败（`ERR_FINDINGS_MISMATCH`），`backlog_nits` 由 Nit 自动统计，不再手填。

**机制闭合规则**：FIX 簇落地必须闭合整个机制——回答「实现者/审查者关于该机制的下一个问题是什么」（公式、边界条件、读写通道、失败模式、双语对称、写入序），当场钉死；**禁止只改被引句子**。TRIAGE 每簇登记闭合检查。点补丁制造下一轮返工（039 实证：buildId 机制 5 轮、export 形状 6 轮才钉死）。

**严重度纪律**：Blocker = 架构不成立或实现者第一步被迫做设计决策；Major = 机制缺口致错误行为或阻塞工单；Nit = 措辞/一致性/格式/交叉引用。**措辞与一致性问题一律 Nit，不得标 Major**；synthesizer 必须复核并降级通胀严重度。

**轮内禁改目标**：record/seal 报 `ERR_STALE_REVIEW` 时立即 `fail` 本轮（incomplete），不得继续派 reviewer；完成修订与跨产物同步后开新轮。

### 4. 封存与发布门禁

```bash
node <本技能目录>/scripts/design-review.mjs seal --manifest <manifest路径> --status passed --open-findings 0 [--backlog-nits N]
node <本技能目录>/scripts/design-review.mjs verify --manifest <manifest路径>
```

- `open_findings` 只计未处置 **Blocker＋Major**。两者清零（已修复，或已由用户明确接受并记录取舍）即可 `passed`；该数值必须与发现账本一致。
- **机制停滞阻断**：传 `--histories <轮次目录>` 后，若某机制在紧邻上一轮账本里仍为 open、本轮仍为 open，`seal` 以 `ERR_MECHANISM_STALLED` 拒绝——连开两轮说明只改了被引用的那句话，机制没闭合。用户明确接受时用 `--accept-mechanism <slug> --reason "<理由>"` 放行，接受记录进 manifest 的 `mechanism_stalls`。
- **全局读数**：`node <本技能目录>/scripts/design-review.mjs status --root <仓库根> --rounds <轮次目录>` 一次列出各轮状态、未封闭数、停滞机制、重复目标哈希，并判定当前目标是被已有轮次绑定（`resume`）还是需要开新轮（`new_round`）。
- **收敛判据：Nit 不触发新轮**。Nit 转实现期 backlog（TRIAGE 登记＋工单承接），用 `--backlog-nits N` 记录数量。架构 SOUND 轮仅余 Nit 时直接 passed，不再开全量轮重审措辞。
- 仍有未处置 Blocker/Major 时用 `changes_required`，不得发布到 `jxx-to-tickets`。
- `verify` 只在 manifest 完整、状态 `passed` 且目标哈希未变时退出 0；哈希变化即 `ERR_STALE_REVIEW`，必须开新轮次。

## 边界与失败出口

- 不修改业务代码、不执行 commit、不替代人工体验验证。
- 缺目标：`ERR_MISSING_TARGET`；上下文越出仓库：`ERR_CONTEXT_OUTSIDE_ROOT`；降档缺用户批准：`ERR_DOWNGRADE_UNAPPROVED`。
- 无 fresh-context：`ERR_FRESH_CONTEXT_UNAVAILABLE` + `not_run`；阶段执行失败：`ERR_STAGE_FAILED` + `incomplete`。
- 文档变更后继续沿用旧结论：`ERR_STALE_REVIEW`，禁止放行。
- 同一目标哈希重复开轮：`ERR_DUPLICATE_ROUND`；账本与计数不符：`ERR_FINDINGS_MISMATCH`；机制连续两轮未闭合：`ERR_MECHANISM_STALLED`。
- `not_run` / `incomplete` 只说明没有完成独立复审，不等于文档有问题，也不等于审查通过。

上游来源与许可证见 `references/upstream/UPSTREAM.md`；上游文件未经修改，jxx 原生流程不依赖安装 EGM。