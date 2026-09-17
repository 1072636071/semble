# 把质量宪章接进 skill 层（执行层接线）

**Status:** ready-for-agent

**Blocked by:** 无——可立即开始

**构建内容：** `docs/agents/quality-charter.md`（质量宪章）目前**只落在规范层**：它定义了「证据优先 / 验收框二选一 / 验证职责分界 / 人工验证清单 / 禁止放宽标准换绿灯」五条纪律，但**没有任何执行机构引用它**，因此对 agent 的实际行为零约束力 —— 一份没人读的文档。本工单把它接进执行层：让 `jxx-implement` 在收尾时真的做分流、让 `jxx-code-review` 真的要求复核者自己跑命令、让 `issue-tracker.md` 的关单条件真的挡住「勾了完事」，并把改动分发到各 harness。改完，宪章从「文档」变成「闸门」。

**为什么现在不做成「只要写文档」**：宪章的权威源纪律是**引用不复制**（与「风格宪章」同）—— 所以 skill 里只出现对 `docs/agents/quality-charter.md` 的**指针**与**该 skill 自身的动作**，不搬运宪章条文。这样将来宪章演进，skill 无需跟着改。

## 改动清单（四步）

### 1. `base/skills/engineering/jxx-implement/SKILL.md`

在「完成步骤（不可跳过）」里新增一步 —— 位置在**① 标记待审查之后、② 代码审查之前**：

> **验收分流**：逐条检查工单的验收标准，每条**二选一**并留痕 ——
> ① **机器可验** ⇒ 在该条下附**可复现证据**（用例名可被 `grep` 到 / 命令 `exit 0` / `文件:行`）；
> ② **机器不可验**（好不好用 / 体验 / 视觉 / 手感 / UI 交互）⇒ 写入 `.scratch/<NN>-<feature>/HUMAN-CHECK.md`，并在具备任务通道的项目里按工单聚合一条任务。
> **不允许「勾了完事」这第三种状态。** 判据与字段见 `docs/agents/quality-charter.md`。

原三步顺延为四步（原 ① 不变，新 ② 为上条，原 ②③ 顺延为 ③④）。

### 2. `base/skills/engineering/jxx-code-review/SKILL.md`

- 在「流程」新增一节 **「3.5 复核者独立取证」**：审查子 agent **必须自己执行**命令/测试来核对证据，**不得仅凭实现者附的证据文本采信**；证据无法复现（用例名 grep 不到 / 命令非 `exit 0`）⇒ 作为发现项报出。
  > **为什么这是必要前提而非优化**：人工不审代码、不阻塞合并（见宪章「信任模型」），`jxx-code-review` 是**系统单点** —— 它采信文本而不取证，则整套证据链失效。
- spec 子 agent 简报追加一句：核对验收框证据的**可复现性**，并检查**人工验证清单是否存在且条目完整**（清单**允许未勾选**，人工不阻塞合并）。
- **堵假绿灯口**：spec 轴**找不到 spec** 时，必须在报告中**显式标记「未审（无可用 spec）」**，**不得静默跳过**（现行 §2 第 4 条是「跳过并报告无可用 spec」）。静默跳过等于「漏需求」检测消失。

### 3. `docs/agents/issue-tracker.md`

「工单状态与生命周期」的 `done` 进入条件，由现状**仅「代码审查通过」**补齐为三条：

1. 代码审查通过；
2. **所有验收框的证据可复现**（用例名可 grep 到 / 命令 `exit 0`）；
3. **人工验证清单存在且条目完整**（每个降级项都有条目）—— **允许未勾选**（人工不阻塞合并，见宪章「信任模型」）。

> 参考：`TencentDB-Agent-Memory` 项目已有更严的双硬闸（验收框全勾 + 正文无「顺延 / 待接线 / 未闭环」残留 + `grep` 逐条核验）。本工单只取与宪章直接相关的第 2、3 条，不做全面对齐。

### 4. 分发与验证

- 跑 `node base/scripts/ship.mjs check` 做门禁预检；
- 跑 `node base/scripts/ship.mjs install`（必要时 `--dry-run` 先预览）分发到各 harness；
- 确认改动**真的落到**安装产物上（不是只改了源）。

## 验收标准

> 本工单自身即宪章示范：以下全部为**机器可验**项，因此**无人工验证项**（不需要 `HUMAN-CHECK.md`）。

- [ ] `base/skills/engineering/jxx-implement/SKILL.md` 出现「二选一」分流步骤，且完成步骤由三步变为四步
- [ ] `base/skills/engineering/jxx-code-review/SKILL.md` 要求复核者**自己执行**命令核对证据（含「不得仅凭实现者提供的证据文本采信」之意）
- [ ] `docs/agents/issue-tracker.md` 的 `done` 进入条件包含「证据可复现」与「人工验证清单存在且条目完整（**允许未勾选**）」两条
- [ ] `jxx-code-review/SKILL.md` 含「**找不到 spec 时必须显式标记「未审」，不得静默跳过**」的要求
- [ ] 上述三个文件均**引用** `docs/agents/quality-charter.md`（各 ≥1 处），且**未复制**宪章正文段落
- [ ] `node base/scripts/ship.mjs check` 退出码为 0
- [ ] 分发后，`~/.workbuddy/skills/jxx-implement/SKILL.md` 与源文件 `md5` **一致**（证明分发真的生效，而非只改源）
- [ ] `HUMAN-CHECK.md` 机制在 skill 文本中被明确「**不得放 `.temp/`**」（该目录被 gitignore、语义是临时，此清单需留存）

## 评论

（评论与对话历史追加于此，新内容置于最前。）

- **来源（2026-09-13）**：源自 `TencentDB-Agent-Memory` memorial 020（该仓库 `docs/memorial/020-ai-agent-maintainability/`），已同步为本仓库 `docs/memorial/003-ai-agent-maintainability/` 作溯源。宪章本体由该轮 grill 产出（11 轮追问、10 条决策、3 份实测工单），本工单是它的**执行层接线**，属用户明确划出的后续范围（当轮只落宪章、不碰 skill）。
