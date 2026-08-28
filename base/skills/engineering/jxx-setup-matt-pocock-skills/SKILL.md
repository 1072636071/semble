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

这是一个提示驱动的技能：判读与决策（布局选择、标签覆盖、向用户解释）由模型完成；**文件内容一律由脚本输出，模型不落盘、不读文件确认**。用户拿到脚本输出的文件内容后自行复制/替换到目标仓库。

## 核心原则：脚本输出模板，不落盘、不读确认

无论用户是否提供配置偏好，本技能都不把文件写入目标仓库，也不读取目标仓库文件来"确认"结果。一律：

1. 运行 `scripts/setup.mjs template`，脚本把要生成的**全部文件内容**输出到 stdout（`=== FILE: <路径> ===` 分隔，不落盘）。
2. 模型把脚本输出的每份文件内容**原样展示**给用户，作为可直接复制的模板。
3. 若用户提供了布局/标签覆盖偏好，用 `--layout`/`--labels` 让脚本生成对应定制内容；用户在此基础上替换要修改的部分。
4. 由用户把文件复制到目标仓库对应位置。模型不手工写文件，也不去读取目标仓库文件做一致性确认。

## 默认配置（"全部默认"）

当**用户没有提供任何配置输入**时——包括只说"全部默认"/"用默认"/"直接按默认来"，或者只是触发本技能而未回答任何问题、未表达任何偏好——一律按"全部默认"处理：**跳过步骤 2-3 的逐一询问与确认**，直接用默认参数运行 `template` 输出文件内容供复制，随后按步骤 5 汇报，全程不再向用户提问。

默认参数对应：

- **Issue tracker** — 本地 markdown（`.scratch/` 下）。跳过"PR 作为请求渠道"的追问（本地无 PR）。
- **triage 标签** — 每个角色字符串等于其名称（无覆盖，不传 `--labels`）。
- **领域文档** — 单一上下文（根目录 `CONTEXT.md` + `docs/adr/`，不传 `--layout`）。
- **临时文件** — 所有临时脚本统一放在 `.temp/scripts/` 下；其他临时文件（脚本输出、日志等）分类放在 `.temp/` 的子目录下，保证根目录干净。
- **写入目标** — 同时创建 `AGENTS.md` 与 `CODEBUDDY.md` 两个文件，两者内容一致。

## 流程

### 1. 探索（可选）

如需了解目标仓库现有状态（文件存在/缺失、通用规范文件优先级、是否已有一致性配置），运行只读探测：

```bash
node <本技能目录>/scripts/setup.mjs detect --root <目标仓库根>
```

输出 JSON 报告：

- `canonical` — 通用规范文件（`CLAUDE.md` 优先于 `AGENTS.md`，都不存在为 `null`）
- `files` — `AGENTS.md` / `CLAUDE.md` / `CODEBUDDY.md` / `CONTEXT.md` / `CONTEXT-MAP.md` 是否存在
- `agentSkillsBlock` / `multiAgentBlock` — 通用规范文件是否已含对应块
- `codebuddyConsistent` — `CODEBUDDY.md` 与通用规范文件是否逐字节一致（`null` 表示缺一无法比较）
- `dirs` — `docs/adr/`、`docs/agents/`、`.scratch/` 是否存在
- `priorOutputs` — 已存在的 `docs/agents/*.md`（此技能之前的输出）

### 2. 询问（仅用户未给全默认时）

**无输入快速通道**：若用户未提供任何配置偏好，跳过本步骤与步骤 3，直接用默认参数运行 `template`（见步骤 4）。

否则，总结已有内容和缺失内容。然后**逐一**引导用户完成三个决策——展示一个部分，获取用户回答，再进入下一个。不要一次性抛出三个。

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

**无输入快速通道**：若用户未提供任何配置偏好，跳过本步骤，直接进入步骤 4 运行 `template`。

否则，把用户已答复的偏好汇总为 `--layout` / `--labels` 参数，先运行 `template` 生成对应文件内容，展示给用户预览；用户确认或提出编辑（如覆盖标签名、换布局）后再按更新后的参数重跑 `template`。

### 4. 输出模板（不落盘）

运行脚本输出全部文件内容（**不落盘，不写入目标仓库**；模型不手工生成这些内容）：

```bash
node <本技能目录>/scripts/setup.mjs template [--layout single|multi] [--labels '{"needs-triage":"bug:triage"}']
```

- `--layout` 对应部分 C 的领域文档布局选择（默认 `single`）
- `--labels` 对应部分 B 的标签覆盖（JSON 对象：角色名 → 实际标签字符串；Windows PowerShell 下内层引号需写成 `\"`，如 `'{\"wontfix\":\"no-fix\"}'`）
- 不传任何参数即为"全部默认"。

脚本输出 5 份文件内容（以 `=== FILE: <路径> ===` 分隔）：

1. `AGENTS.md` — 含 `## 多代理要求` 块 + `## Agent skills` 四小节（issue tracker / triage 标签 / 领域文档 / 临时文件）。
2. `CODEBUDDY.md` — 与 `AGENTS.md` 内容**逐字节一致**。
3. `docs/agents/issue-tracker.md`
4. `docs/agents/triage-labels.md`
5. `docs/agents/domain.md`

模型把脚本输出的每一份内容**原样展示**给用户，作为可直接复制的模板。用户复制到目标仓库对应位置即可；若要替换任何内容（如标签名、布局），用户在此模板上修改或让模型按新参数重跑 `template`。

注意：目标仓库若已有 `CLAUDE.md` 或 `AGENTS.md`，文件选择互斥规则成立（`CLAUDE.md` 优先作为通用规范源）——模型应向用户说明以哪个文件为通用规范源，并让用户把对应模板内容复制为源文件、再把内容逐字节复制到 `CODEBUDDY.md` 以保持一致。三份 `docs/agents/*.md` 内容始终不变。

### 5. 完成

告知用户配置模板已生成，哪些文件对应哪些位置，让用户复制到目标仓库后即可供工程技能读取。提及他们之后可以直接编辑 `docs/agents/*.md`；仅在要切换 issue tracker 或从头重新开始时才需要重新运行本技能。说明 `AGENTS.md` 与 `CODEBUDDY.md` 两个文件需内容保持一致（参照 `## 多代理要求` 块），修改工程技能配置时需同时更新两者。

模型**不读取目标仓库文件做确认**；若需向用户说明目标仓库现状，应基于步骤 1 的 `detect` 报告或直接请用户确认，而非事后读文件验证。
