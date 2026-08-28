---
name: jxx-setup-matt-pocock-skills
description: 为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局。首次使用其他工程技能前运行一次。
disable-model-invocation: true
metadata:
  version: 1.2.0
---

# 设置 Matt Pocock 的工程技能

为仓库搭建工程技能所依赖的配置：

- **Issue tracker** — issue 存放位置（仅**本地 markdown**，存放在仓库 `.scratch/` 下）
- **triage 标签** — 五个标准 triage 角色所使用的标签字符串
- **领域文档** — `CONTEXT.md` 和 ADR 的存放位置，以及读取它们的消费者规则（`jxx-grill-with-docs`、`jxx-domain-modeling` 等技能也会读写它们）

这是一个脚本驱动的技能：初始化所需的所有文件内容与合并逻辑均由 `scripts/setup.mjs` 确定性完成。模型负责决定目标仓库、传入布局/标签偏好（若有），并运行脚本把配置**写入**目标仓库；**不需要用户手动复制任何文件**。

## 核心原则：默认一键落盘，读取已有文件自行处理

1. 运行 `scripts/setup.mjs init --root <目标仓库>`，脚本会先**只读扫描**仓库现状（哪些文件已存在、以哪个为通用规范源），再**写入**全部配置到目标仓库对应位置。
2. 脚本**读取目标仓库已有文件并自行处理**：
   - 已有 `CLAUDE.md` 或 `AGENTS.md` → 以它作为通用规范源，在其上做「## Agent skills」块 upsert（就地替换已有块 / 追加缺失块，保留自定义内容）并注入「## 多代理要求」块，再逐字节同步到 `CODEBUDDY.md`。
   - 都不存在 → 默认创建 `AGENTS.md` 与 `CODEBUDDY.md`（两者内容一致）。
   - 三份 `docs/agents/*.md` 模板始终从种子克隆（已一致则跳过）。
   - 操作**幂等**：重复运行不会破坏已有内容，只会补齐缺失的工程块。
3. 脚本把每份文件的动作（`created`/`updated`/`unchanged`）打印出来，模型据此向用户汇报。

**无输入快速通道**：当**用户没有提供任何配置输入**时——包括只说"全部默认"/"用默认"/"直接按默认来"，或者只是触发本技能而未回答任何问题、未表达任何偏好——一律按"全部默认"处理：**跳过询问与确认**，直接用默认参数运行 `init --root <目标仓库>`，一步完成写入，随后按「完成」汇报，**全程不再向用户提问，也不需要用户确认或复制**。

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

**预览（可选）**：如需先查看将产生的内容而不落盘，用 `--dry-run` 演练（只打印动作不写盘），或 `template` 输出全部文件内容到 stdout。但默认流程应直接 `init` 落盘，无需用户确认。

### 3. 完成

告知用户配置已写入目标仓库，列出每份文件的位置与动作（`created`/`updated`/`unchanged`）。提及他们之后可以直接编辑 `docs/agents/*.md`；仅在要切换 issue tracker 或从头重新开始时才需要重新运行本技能。说明 `AGENTS.md` 与 `CODEBUDDY.md` 两个文件需内容保持一致（参照 `## 多代理要求` 块），修改工程技能配置时需同时更新两者，或重新运行本技能自动同步。

## 子命令速查

```bash
node <本技能目录>/scripts/setup.mjs init     --root <目标仓库> [--layout single|multi] [--labels <json>]  # 一键初始化（默认）
node <本技能目录>/scripts/setup.mjs detect   --root <目标仓库>                                             # 只读探索（JSON 报告）
node <本技能目录>/scripts/setup.mjs sync-doc --root <目标仓库> [--layout single|multi] [--labels <json>]  # 仅写入（跳过扫描汇报）
node <本技能目录>/scripts/setup.mjs template [--layout single|multi] [--labels <json>]                    # 输出文件内容到 stdout（不落盘）
```

未传子命令时默认执行 `init`。
