---
name: jxx-setup-matt-pocock-skills
description: 为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局。首次使用其他工程技能前运行一次。
disable-model-invocation: true
metadata:
  version: 1.1.0
---

# 设置 Matt Pocock 的工程技能

为仓库搭建工程技能所依赖的配置：

- **Issue tracker** — issue 存放位置（仅**本地 markdown**，存放在仓库 `.scratch/` 下）
- **triage 标签** — 五个标准 triage 角色所使用的标签字符串
- **领域文档** — `CONTEXT.md` 和 ADR 的存放位置，以及读取它们的消费者规则（`jxx-grill-with-docs`、`jxx-domain-modeling` 等技能也会读写它们）

这是一个提示驱动的技能：判读与决策（布局选择、标签覆盖、向用户解释）由模型完成；确定性环节（探索扫描、文件写入）一律交给本技能自带的 `scripts/setup.mjs` 脚本执行（自包含、零第三方依赖），模型不手工写这些文件。

## 默认配置（"全部默认"）

如果用户说"全部默认"/"用默认"/"直接按默认来"，**跳过步骤 2-3 的逐一询问**，直接套用下方默认配置进入步骤 4 写入：

- **Issue tracker** — 本地 markdown（`.scratch/` 下）。跳过"PR 作为请求渠道"的追问（本地无 PR）。
- **triage 标签** — 每个角色字符串等于其名称（无覆盖）。
- **领域文档** — 单一上下文（根目录 `CONTEXT.md` + `docs/adr/`）。
- **临时文件** — 所有临时脚本统一放在 `.temp/scripts/` 下；其他临时文件（脚本输出、日志等）分类放在 `.temp/` 的子目录下，保证根目录干净。
- **写入目标** — 见步骤 4 的默认规则：同时创建 `AGENTS.md` 与 `CODEBUDDY.md` 两个文件，两者内容一致（见步骤 4 的"多代理要求"）。

## 流程

### 1. 探索

运行探测脚本获取仓库初始状态（**不要手工逐条检查**——固定清单一律跑脚本，只读不落盘）：

```bash
node <本技能目录>/scripts/setup.mjs detect --root <目标仓库根>
```

输出 JSON 报告，逐项覆盖原探索清单：

- `canonical` — 通用规范文件（`CLAUDE.md` 优先于 `AGENTS.md`，都不存在为 `null`）
- `files` — `AGENTS.md` / `CLAUDE.md` / `CODEBUDDY.md` / `CONTEXT.md` / `CONTEXT-MAP.md` 是否存在
- `agentSkillsBlock` / `multiAgentBlock` — 通用规范文件是否已含对应块
- `codebuddyConsistent` — `CODEBUDDY.md` 与通用规范文件是否逐字节一致（`null` 表示缺一无法比较）
- `dirs` — `docs/adr/`、`docs/agents/`、`.scratch/` 是否存在
- `priorOutputs` — 已存在的 `docs/agents/*.md`（此技能之前的输出）

### 2. 展示发现并询问

总结已有内容和缺失内容。然后**逐一**引导用户完成三个决策——展示一个部分，获取用户回答，再进入下一个。不要一次性抛出三个。

假设用户不了解这些术语的含义。每个部分以简短说明开始（它是什么、为什么这些技能需要它、选择不同会有什么变化）。然后展示选项和默认值。

**部分 A — Issue tracker。**

> 说明："issue tracker" 是此仓库 issue 的存放位置。`jxx-to-tickets`、`jxx-triage`、`jxx-to-spec` 等技能会从中读取和写入——它们会在仓库 `.scratch/` 下写入 markdown issue 文件。本仓库固定使用本地 markdown tracker，不需要任何远程 CLI（GitHub、GitLab 等）。

本仓库固定使用**本地 markdown**（`.scratch/` 下）：issue 存放在仓库 `.scratch/<NN>-<feature>/` 下的文件中（`<NN>` 为从 `01` 起的全局递增顺序号；适合个人项目或没有远程的仓库）。无需让用户选择远程 tracker——直接套用此默认并进入部分 B。

**部分 B — triage 标签词汇表。**

> 说明：当 `jxx-triage` 技能处理传入的 issue 时，它会将 issue 推过一个状态机——需要评估、等待报告者补充信息、准备好让 AFK agent 接手、准备好让人工处理、或不予处理。为此，它需要应用与*你实际配置的*字符串匹配的标签（或 issue tracker 中的等价物）。如果你的仓库已使用不同的标签名（例如用 `bug:triage` 而非 `needs-triage`），在此映射它们，以便技能应用正确的标签而非创建重复项。

五个标准角色：

- `needs-triage` — 维护者需要评估
- `needs-info` — 等待报告者补充信息
- `ready-for-agent` — 已完全定义，AFK 就绪（agent 无需人工上下文即可接手）
- `ready-for-human` — 需要人工实现
- `wontfix` — 不会处理

默认：每个角色的字符串等于其名称。询问用户是否要覆盖任何标签。如果 issue tracker 没有现有标签，默认值即可。

**部分 C — 领域文档。**

> 说明：某些技能（`jxx-improve-codebase-architecture`、`jxx-diagnosing-bugs`、`jxx-tdd`、`jxx-grill-with-docs`、`jxx-domain-modeling`）会读取 `CONTEXT.md` 文件来了解项目的领域语言，读取 `docs/adr/` 来了解过去的架构决策。它们需要知道仓库是单一上下文还是多上下文（例如包含独立前端/后端上下文的 monorepo），以便在正确位置查找。

确认布局：

- **单一上下文** — 仓库根目录有一个 `CONTEXT.md` + `docs/adr/`。大多数仓库是这种。
- **多上下文** — 根目录有 `CONTEXT-MAP.md` 指向各上下文的 `CONTEXT.md` 文件（通常是 monorepo）。

### 3. 确认

用 `--dry-run` 演练步骤 4 的写入命令，把脚本输出的逐文件动作日志（`created`/`updated`/`unchanged`）展示给用户，并附上三份 `docs/agents/` 种子模板（即本技能目录下的 `issue-tracker-local.md`、`triage-labels.md`、`domain.md`）供预览。用户确认或提出编辑后再正式执行；若用户要求改动种子模板内容，先编辑技能目录的种子文件再重跑脚本。

### 4. 写入

运行确定性脚本完成全部写入（**不要手工创建/编辑这些文件**——固定流程一律跑脚本）：

```bash
node <本技能目录>/scripts/setup.mjs sync-doc --root <目标仓库根> [--layout single|multi] [--labels '{"needs-triage":"bug:triage"}'] [--dry-run]
```

- `--layout` 对应部分 C 的领域文档布局选择（默认 `single`）
- `--labels` 对应部分 B 的标签覆盖（JSON 对象：角色名 → 实际标签字符串；Windows PowerShell 下内层引号需写成 `\"`，如 `'{\"wontfix\":\"no-fix\"}'`）
- 建议先 `--dry-run` 演练，确认后再去掉该标志正式执行
- `--no-block`：只做一致性同步，不 upsert `## Agent skills` 块（用于配置块已被人工定制、只需对齐 `CODEBUDDY.md` 的场景）

脚本内化的规则（无需模型手工执行）：

- **文件选择互斥**：`CLAUDE.md` 存在则以它为通用规范源（不创建 `AGENTS.md`）；否则 `AGENTS.md`；都不存在则默认创建 `AGENTS.md`（含 `## 多代理要求` 块 + 全部默认的 `## Agent skills` 块）。
- **块 upsert**：`## Agent skills` 块已存在则就地替换、缺失则追加，周围用户内容不动；`## 多代理要求` 块缺失时自动注入首个 H1 之后。
- **一致性**：`CODEBUDDY.md` 始终与通用规范文件逐字节一致；三份 `docs/agents/*.md` 由种子模板逐字节克隆。
- **结果日志**：逐文件输出 `[created]/[updated]/[unchanged]` 动作及原因（覆盖文件存在与不存在两种情况）；一致性校验失败时退出码非 0。

脚本输出的日志即步骤 5 向用户汇报的依据。

### 5. 完成

告知用户设置已完成，以及哪些工程技能现在会读取这些文件。提及他们之后可以直接编辑 `docs/agents/*.md`——仅在要切换 issue tracker 或从头重新开始时才需要重新运行此技能。说明 `AGENTS.md` 与 `CODEBUDDY.md` 两个文件已一并生成、内容保持一致（参照 `## 多代理要求` 块），修改工程技能配置时需同时更新两者。
