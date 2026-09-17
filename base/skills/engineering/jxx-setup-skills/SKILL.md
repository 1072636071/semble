---
name: jxx-setup-skills
description: 为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局，并检测 OCR（open-code-review CLI）是否可用、未安装时询问用户是否安装。首次使用其他工程技能前运行一次。
disable-model-invocation: true
metadata:
  version: 1.4.0
---

# 设置工程技能环境

为仓库搭建工程技能所依赖的配置：

- **Issue tracker** — issue 存放位置（仅**本地 markdown**，存放在仓库 `.scratch/` 下）
- **triage 标签** — 五个标准 triage 角色所使用的标签字符串
- **领域文档** — `CONTEXT.md` 和 ADR 的存放位置，以及读取它们的消费者规则（`jxx-grill-with-docs`、`jxx-domain-modeling` 等技能也会读写它们）
- **OCR（可选）** — 检测 `ocr` CLI 是否可用；未安装时**询问用户**是否安装。装上后 `jxx-code-review` 自动启用委托模式（3 维度审查），没装则降级为 2 维度

这是一个脚本驱动的技能：初始化所需的所有文件内容与合并逻辑均由 `scripts/setup.mjs` 确定性完成。模型负责决定目标仓库、传入布局/标签偏好（若有），并运行脚本把配置**写入**目标仓库；**不需要用户手动复制任何文件**。

## 核心原则：默认一键落盘，读取已有文件自行处理，冲突交给模型决定

1. 运行 `scripts/setup.mjs init --root <目标仓库>`，脚本会先**只读扫描**仓库现状（哪些文件已存在、以哪个为通用规范源、已有内容与将写入内容的漂移），再**写入**配置到目标仓库对应位置。
2. 脚本**读取目标仓库已有文件并自行处理**：
   - 已有 `CLAUDE.md` 或 `AGENTS.md` → 以它作为通用规范源，在其上做「## Agent skills」块 upsert（**仅当块缺失或与将写入内容一致时**写；已有块内容不同则保留并报 `conflict`）并注入「## 多代理要求」块，再同步到 `CODEBUDDY.md`。
   - 都不存在 → 默认创建 `AGENTS.md` 与 `CODEBUDDY.md`（两者内容一致）。
   - 三份 `docs/agents/*.md` 模板**只克隆缺失的**；已存在且与种子内容不同则保留并报 `conflict`。
   - `CODEBUDDY.md` 已存在且与源文件不一致时同样**保留并报 `conflict`**（它可能含独有定制内容）。
   - 操作**幂等**：重复运行不会破坏已有内容，只会补齐缺失的工程块与文件。
3. 脚本把每份文件的动作（`created`/`updated`/`unchanged`/`conflict`）打印出来；存在冲突时**退出码为 3**，并列出冲突文件与处置提示。
4. **不静默覆盖**：凡是已存在且内容不同的文件，脚本一律不落盘、原样保留，由模型**读取该文件后**决定怎么写入。决断路径见「冲突处置」一节。默认**不要**加 `--force`。

**无输入快速通道**：当**用户没有提供任何配置输入**时——包括只说"全部默认"/"用默认"/"直接按默认来"，或者只是触发本技能而未回答任何问题、未表达任何偏好——一律按"全部默认"处理：**跳过询问与确认**，直接用默认参数运行 `init --root <目标仓库>`，一步完成写入，随后按「完成」汇报，**全程不再向用户提问，也不需要用户确认或复制**。

> **唯一例外**：配置落盘不提问，但**步骤 4 的 OCR 未安装时仍需询问**是否安装 —— 安装会改动全局环境（全局 npm 包 / 系统目录），不属于"默认配置落盘"，不得擅自执行。

## 默认配置（"全部默认"）

默认参数对应：

- **Issue tracker** — 本地 markdown（`.scratch/` 下）。跳过"PR 作为请求渠道"的追问（本地无 PR）。
- **triage 标签** — 每个角色字符串等于其名称（无覆盖，不传 `--labels`）。
- **领域文档** — 单一上下文（根目录 `CONTEXT.md` + `docs/adr/`，不传 `--layout`）。
- **临时文件** — 所有临时脚本统一放在 `.temp/scripts/` 下；其他临时文件（脚本输出、日志等）分类放在 `.temp/` 的子目录下，保证根目录干净。
- **写入目标** — 通用规范源存在则在其上 upsert 并同步 `CODEBUDDY.md`；不存在则同时创建 `AGENTS.md` 与 `CODEBUDDY.md`，两者内容一致。

## 流程

### 1. 确定目标仓库

明确要初始化的仓库根目录 `<目标仓库>`（绝对路径）。用户通常会指定，或使用当前工作区。把它传给 `init --root <目标仓库>`。

### 2. 运行 init（默认落盘）

**无输入快速通道**：若用户未提供任何配置偏好，直接运行：

```bash
node <本技能目录>/scripts/setup.mjs init --root <目标仓库>
```

脚本先只读扫描仓库现状，再落盘写入全部配置；打印每份文件的动作与一致性结果，最后输出「初始化完成」。

若用户提供了偏好（布局、标签覆盖），把偏好汇总为 `--layout` / `--labels` 参数传给 `init`：

```bash
node <本技能目录>/scripts/setup.mjs init --root <目标仓库> --layout single --labels '{"needs-triage":"bug:triage"}'
```

- `--layout` 对应领域文档布局选择（`single` 单一上下文 / `multi` 多上下文；默认 `single`）。
- `--labels` 对应 triage 标签覆盖（JSON 对象：角色名 → 实际标签字符串；Windows PowerShell 下内层引号需写成 `\"`，如 `'{\"wontfix\":\"no-fix\"}'`）。
- 不传任何参数即为"全部默认"。

**预览（可选）**：如需先查看将产生的内容而不落盘，用 `--dry-run` 演练（只打印动作不写盘，冲突也会如实报出），或 `template` 输出全部文件内容到 stdout。但默认流程应直接 `init` 落盘，无需用户确认。

### 3. 冲突处置（退出码 3）

当输出里出现 `conflict`（退出码 3）时，说明**目标文件已存在且内容与将写入的不同，脚本已原样保留**。此时不要重跑 `--force` 了事，按下面顺序处置：

1. **先读取冲突文件**（以及对应的种子/源文件），弄清差异是什么——仓库里已有的往往是定制过的真实约定（比如本仓库 `docs/agents/*` 与技能种子就不同）。
2. 判断三选一：
   - **保留现状**（仓库约定优先，技能种子只是默认）→ 什么都不做，向用户说明该文件的现有配置继续生效。
   - **手工合并**→ 用编辑工具把需要的新增段落（如新的 `### 临时文件` 小节）合并进现有文件，保留仓库自有内容。合并后重跑 `init` 应变为 `unchanged`。
   - **覆盖**→ 确认该文件确实该被默认内容替换后，重跑并**精确授权**：
     ```bash
     node <本技能目录>/scripts/setup.mjs init --root <目标仓库> --overwrite docs/agents/domain.md
     ```
     `--overwrite` 可重复指定多个文件；仅在用户明确要求"全部按默认重置"时才用 `--force`。
3. 覆盖源文件（`AGENTS.md`/`CLAUDE.md`）里的工程块后，`CODEBUDDY.md` 会随之漂移，脚本会**再次报它的冲突**——这属于预期：读取两者确认后，再 `--overwrite CODEBUDDY.md` 同步。

### 4. 检查 OCR（代码审查工具）

OCR（open-code-review CLI）是 `jxx-code-review` 委托模式的依赖：装上后代码审查自动启用 **3 维度**（标准 + spec + 规则），没装则降级为 **2 维度**（标准 + spec）。

**先检测**（脚本只读、无副作用、不改动环境）：

```bash
node <本技能目录>/scripts/setup.mjs ocr
```

输出 JSON：`installed` / `path` / `version`。

- **`installed: true`** → 向用户说明 OCR 可用（报出版本），代码审查将走委托模式 3 维度。**无需任何 LLM 配置** —— 委托模式下 OCR 端不调用 LLM。
- **`installed: false`（退出码 4）** → **必须询问用户是否安装，不要擅自安装**：
  - **同意** → 按下方「安装步骤」执行，装完重跑 `setup.mjs ocr` 验证。
  - **拒绝** → 说明影响：代码审查降级为内置 2 维度，缺少「规则」维度；之后随时可补装，重跑本技能即可。

#### 安装步骤（内置）

推荐 —— 走 npm（跨平台，支持自动更新）：

```bash
npm install -g @alibaba-group/open-code-review
```

其他方式（按需选用）：

```bash
# macOS / Linux — Homebrew
brew install open-code-review

# macOS — MacPorts
sudo port install open-code-review

# 安装脚本（Shell，含 sha256 校验）
curl -fsSL https://open-codereview.ai/install.sh | sh

# Windows — PowerShell
irm https://open-codereview.ai/install.ps1 | iex
```

不带 Node.js 的环境可直接取 GitHub Release 静态二进制：<https://github.com/alibaba/open-code-review/releases>（Windows 取 `opencodereview-windows-amd64.exe`）。

**Windows 注意**：`npm install -g` 要用**当前 PATH 上 `ocr` 实际会解析到的那个 npm**。系统并存多个 Node（如 nvm4w 与 WorkBuddy 托管版）时，用托管版 npm 全局装会让 `ocr` 不更新 —— 先 `npm config get prefix` 确认，必要时用目标 npm 的绝对路径重装。

**验证**：

```bash
ocr version     # 应输出版本，如 open-code-review v1.12.4
```

**无需配置 LLM**：委托模式由宿主 Agent 用自身 LLM 审查，OCR 端不调用任何 LLM，因此不需要 `ocr config set` 或任何 LLM 环境变量。

### 5. 完成

告知用户配置已写入目标仓库，列出每份文件的位置与动作（`created`/`updated`/`unchanged`）。提及他们之后可以直接编辑 `docs/agents/*.md`；仅在要切换 issue tracker 或从头重新开始时才需要重新运行本技能。说明 `AGENTS.md` 与 `CODEBUDDY.md` 两个文件需内容保持一致（参照 `## 多代理要求` 块），修改工程技能配置时需同时更新两者，或重新运行本技能自动同步。

## 子命令速查

```bash
node <本技能目录>/scripts/setup.mjs init     --root <目标仓库> [--layout single|multi] [--labels <json>] [--overwrite <file>] [--force]  # 一键初始化（默认）
node <本技能目录>/scripts/setup.mjs detect   --root <目标仓库>                                             # 只读探索（JSON 报告，含漂移）
node <本技能目录>/scripts/setup.mjs sync-doc --root <目标仓库> [--layout single|multi] [--labels <json>] [--overwrite <file>] [--force]  # 仅写入（跳过扫描汇报）
node <本技能目录>/scripts/setup.mjs template [--layout single|multi] [--labels <json>]                    # 输出文件内容到 stdout（不落盘）
node <本技能目录>/scripts/setup.mjs ocr                                                                   # 只读检测 OCR 是否安装（JSON；未安装退出码 4）
```

- `--overwrite <file>` 可重复，路径相对仓库根（如 `docs/agents/domain.md`、`CODEBUDDY.md`）；`--force` 覆盖全部冲突。默认两者都不给 → 冲突文件一律保留。
- 退出码：`0` 完成无冲突；`3` 存在冲突且已保留原文件（需模型读取后处置）；`2` 一致性 MISMATCH；`1` 参数/运行错误；`4` OCR 未安装（需询问用户是否安装）。

未传子命令时默认执行 `init`。
