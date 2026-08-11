# codeArts 技能风格经验文档

> 本文档总结 `codeArts` 目录下 31 个技能的统一风格规范，作为新增、改造、审查技能时的参考。所有规范均已在本仓库落地验证。

## 1. 目录结构规范

每个技能是一个独立目录，目录名即技能名（`jxx-<语义>`）。每个技能目录**必须**包含以下四个核心文件：

```
jxx-<name>/
├── SKILL.md          # 核心技能定义（必需）
├── README.md         # 用户友好的说明文档（必需）
├── CHANGELOG.md      # 变更日志（必需）
├── LICENSE.txt       # MIT 许可证（必需，统一 .txt 扩展名）
└── evals/
    └── evals.json    # 评估用例（可选但推荐）
```

**可选辅助资源**（按需存在，不强制）：

| 资源 | 用途 | 示例 |
|------|------|------|
| `references/` | 参考文档子目录 | `jxx-agent-generator/references/` |
| `scripts/` | 脚本子目录 | `jxx-diagnosing-bugs/scripts/` |
| `assets/` | 资源子目录 | `jxx-design-system/assets/` |
| `agents/` | 子 agent 定义 | `jxx-grill-with-memorial/agents/` |
| `*.md` 辅助文档 | 技能专用机制文档 | `PHASE-BOUNDARIES.md`、`mocking.md`、`tests.md` |

### 反模式

- ❌ 使用 `LICENSE.md`（统一用 `LICENSE.txt`）
- ❌ 缺少 `README.md` 或 `CHANGELOG.md`
- ❌ 目录名与 SKILL.md frontmatter `name` 不一致
- ❌ README.md 标题使用非技能名前缀（如 `spz-`）

## 2. SKILL.md 格式规范

### 2.1 Frontmatter（YAML 头部）

```yaml
---
name: jxx-<name>                    # 与目录名一致
description: <一句话描述 + 触发词>   # 面向人，说明何时调用
disable-model-invocation: true      # 可选，禁止模型自动调用
metadata:
  version: 1.0.0                    # 语义化版本
---
```

**字段约定**：

- `name` — 必须与目录名完全一致，使用 `jxx-` 前缀。
- `description` — 面向人写的说明，包含职责 + 触发词 + 与相邻技能的分工边界。这是 harness 注入 system prompt 的唯一句柄，leading word 必须独一无二。
- `disable-model-invocation` — 用户显式调用的技能设为 `true`；可由模型自主触发的技能省略此字段。
- `metadata.version` — 语义化版本号，初始 `1.0.0`。

### 2.2 正文结构

正文使用**简体中文**，结构化章节按需选用：

```markdown
# <中文标题>

<一句话定位说明>

## 何时使用
- <触发条件>

## 输入
- <输入要求>

## 输出
- <输出约定>

## 前置条件
- <依赖条件>

## 流程
### 1. <步骤>
### 2. <步骤>

## 异常处理
| 场景 | 处理方式 |
|------|---------|

## 反模式
- **<反模式名>** — <说明>

## 相关技能
- `/jxx-<other>` — <关系>
```

**正文写作原则**：

- 正文写给 **agent** 读，要细节、要可执行。
- 中文为主，技术术语保留英文原词（如 `seam`、`grill`、`tracer-bullet`）。
- 长描述用 `>` 引用块，流程用有序列表，对照用表格。
- 命令用反引号包裹（`/jxx-grilling`、`git diff`）。

## 3. README.md 格式规范

README.md 写给**人**读，是技能的"门面"。

```markdown
# jxx-<name>

<1-2 句话简短描述>

## 何时使用

<触发条件说明>

## 相关技能

- `/jxx-<other>` — <关系>
- `[辅助文档.md](辅助文档.md)` — <说明>
```

**约定**：

- 第一行标题**必须**是 `# jxx-<name>`，与目录名一致。
- **禁止**使用旧前缀（如 `spz-`）。
- **禁止** BOM 标记（UTF-8 无 BOM）。
- 描述精炼到 1-2 句话，不重复 SKILL.md 的全文。
- "相关技能"章节引用其他 `jxx-` 技能或本目录辅助文档。

## 4. CHANGELOG.md 格式规范

遵循 [Keep a Changelog](https://keepachangelog.com/) 风格：

```markdown
# Changelog

## 1.0.1 — 2026-07-09

- <变更说明>

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
```

**约定**：

- 日期格式 `YYYY-MM-DD`，用全角破折号 `—` 分隔版本与日期。
- 初始版本统一标注来源（"翻译自 mattpocock/skills" 或 "初始版本，<自定义说明>"）。
- 新版本在顶部，旧版本在底部。

## 5. LICENSE 规范

- 统一使用 `LICENSE.txt`（非 `LICENSE.md`）。
- 统一使用 MIT 许可证，`Copyright (c) 2026`。
- 所有技能目录**必须**包含 LICENSE.txt。

## 6. evals/evals.json 规范

```json
[
  {
    "name": "<skill-name>-basic",
    "prompt": "<测试提示>",
    "expected_behavior": "<期望行为说明>"
  }
]
```

**约定**：

- `name` 以技能名开头，后缀描述用例类型（`-basic`、`-edge-case` 等）。
- `prompt` 使用中文，模拟真实用户输入。
- `expected_behavior` 描述期望的技能行为，不涉及实现细节。

## 7. 命名规范

| 对象 | 规范 | 示例 |
|------|------|------|
| 技能目录名 | `jxx-<kebab-case>` | `jxx-ask-matt` |
| SKILL.md `name` | 与目录名一致 | `jxx-ask-matt` |
| README.md 标题 | `# jxx-<name>` | `# jxx-ask-matt` |
| 技能引用 | `/jxx-<name>` | `/jxx-grilling` |
| 辅助文档 | `UPPER-CASE.md` 或 `lower-case.md` | `PHASE-BOUNDARIES.md`、`mocking.md` |

**禁止**：

- ❌ 混用前缀（`spz-`、`jxx-` 并存）
- ❌ 技能名使用下划线或驼峰（统一 kebab-case）

## 8. 文档语言规范

- **所有面向人的文档**（README.md、CHANGELOG.md、SKILL.md 正文）使用**简体中文**。
- **技术术语保留英文原词**：`seam`、`grill`、`tracer-bullet`、`frontmatter`、`context pointer`、`leading word` 等。
- **代码/命令/路径**用反引号包裹，保持英文原样。
- **LICENSE.txt** 保持英文原文（MIT 许可证标准文本）。

## 9. 本次优化修复清单

以下是对 `codeArts` 目录执行的优化操作，可作为后续审查的检查清单：

### 9.1 标题前缀修复（7 个技能）

将 README.md 标题从 `spz-` 修复为 `jxx-`：

- `jxx-diagnosing-bugs/README.md`
- `jxx-grilling/README.md`
- `jxx-handoff/README.md`
- `jxx-implement/README.md`
- `jxx-prototype/README.md`
- `jxx-resolving-merge-conflicts/README.md`
- `jxx-tdd/README.md`（同时修复 `spz-prototype` → `/jxx-prototype`）

### 9.2 补全 README.md（8 个技能）

为以下技能新建 README.md：

- `jxx-agent-generator`
- `jxx-improve-codebase-architecture`
- `jxx-plan-review`
- `jxx-setup-matt-pocock-skills`
- `jxx-to-questionnaire`
- `jxx-triage`
- `jxx-wizard`
- `jxx-writing-for-agents`

### 9.3 补全 CHANGELOG.md（8 个技能）

为以下技能新建 CHANGELOG.md：

- `jxx-agent-generator`
- `jxx-improve-codebase-architecture`
- `jxx-plan-review`
- `jxx-setup-matt-pocock-skills`
- `jxx-to-questionnaire`
- `jxx-triage`
- `jxx-wizard`
- `jxx-writing-for-agents`

### 9.4 统一 LICENSE 文件

- 将 `jxx-grill-me/LICENSE.md` 重命名为 `LICENSE.txt`
- 将 `jxx-research/LICENSE.md` 重命名为 `LICENSE.txt`
- 为 8 个缺少 LICENSE 的技能新建 `LICENSE.txt`

### 9.5 清理 BOM 标记（7 个技能）

移除以下 README.md 的 UTF-8 BOM 标记：

- `jxx-ask-matt`
- `jxx-code-review`
- `jxx-codebase-design`
- `jxx-diagnosing-bugs`
- `jxx-domain-modeling`
- `jxx-grill-with-docs`
- `jxx-implement`

## 10. 审查检查清单

新增或修改技能时，逐项检查：

- [ ] 目录名以 `jxx-` 开头，kebab-case
- [ ] SKILL.md 存在，frontmatter `name` 与目录名一致
- [ ] SKILL.md `description` 含触发词 + 职责 + 分工边界
- [ ] SKILL.md `metadata.version` 存在
- [ ] README.md 存在，第一行是 `# jxx-<name>`
- [ ] README.md 无 BOM 标记
- [ ] README.md 含"何时使用"章节
- [ ] CHANGELOG.md 存在，遵循 Keep a Changelog 格式
- [ ] LICENSE.txt 存在，MIT 许可证
- [ ] 无 `LICENSE.md` 残留
- [ ] 无 `spz-` 前缀残留
- [ ] 所有面向人文档使用简体中文
- [ ] 技术术语保留英文原词
- [ ] evals/evals.json（推荐存在）