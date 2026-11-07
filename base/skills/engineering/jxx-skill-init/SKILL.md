---
name: jxx-skill-init
description: "在本仓库新增一个 SKILL，一次创建即过 check 门禁。当用户说新建技能、新增 SKILL、写个 skill 时触发。只建骨架与规范填充，不做技能评审。"
disable-model-invocation: false
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-skill-init, codebuddy]
    description-en: |-
      1. Scaffold a new skill in this repo with ship init + repo conventions.
      2. Triggered by: new skill, add skill, write a skill.
      3. Ensures one-pass creation passing check gate.
      4. Usage: collect name/bucket → ship init → fill frontmatter → write body → verify check.
      5. Requires: node, base/scripts/ship.mjs.
  codebuddy:
    allowed-tools: [read_file, search_content, write_file]
  opencode:
    license: MIT
  trae: {}
metadata:
  version: 1.2.0
---

# 新增 SKILL

在本仓库中从零创建一个符合全部仓库约定的新技能。目标是：一次创建，`node base/scripts/ship.mjs check` 直接通过。

## 何时使用

- 用户说"新建一个技能""添加一个 SKILL""我要写一个 skill"
- 用户想给某个工作流固化一个可复用的 SKILL.md

## 工作流

### 第 1 步 — 收集最小信息

从用户描述中提取四要素：

| 要素 | 说明 | 例子 |
|------|------|------|
| **技能名** | 小写字母+数字+连字符，`jxx-` 前缀 | `jxx-mcp-design` |
| **桶** | `base/skills/` 下的分组目录 | `engineering`、`productivity` |
| **触发描述** | 什么时候该触发这个技能 | "当用户要设计 MCP Server 时" |
| **核心内容** | 技能正文要讲什么 | 工作流、检查清单、模式库 |

**反问规则**：一次最多问 1-2 个，从最关键的缺口开始。技能名和桶可以用默认值兜底（`jxx-<主题>` + `engineering`）。

### 第 2 步 — 用 ship init 生成骨架

```bash
node base/scripts/ship.mjs init --type skill --name <技能名> --bucket <桶>
```

这会从 `base/scripts/templates/skill/SKILL.src.md` 生成 `SKILL.src.md` 到 `base/skills/<桶>/<技能名>/`。

### 第 3 步 — 填充 frontmatter

打开生成的 `SKILL.src.md`，替换占位符。字段说明见 [references/frontmatter.md](references/frontmatter.md)：

- `name`、`description`：必填；`description` 按四要素写（能力 + 场景 + 触发词 + 边界），模板见 [references/frontmatter.md](references/frontmatter.md) 的「description 四要素模板」
- `x-vendors`：CodeArts 派生需要 `description-en`（5 行编号列表，英文）
- `x-install`：分发控制（`true` / `project` / `false`）
- 调用控制：`disable-model-invocation` / `user-invocable` 只写布尔值；manual-only 不得配 `user-invocable: false`。有 `agents/openai.yaml` 时同步设置 `policy.allow_implicit_invocation`，规则见上述字段文档

### 第 4 步 — 写正文

**中文正文**（`<!--en-->` 标记之后）：
- 第一段：技能定位，一句话说清做什么
- 主体：按工作流/步骤/检查清单组织，用祈使句
- 解释 why，而非堆 MUST
- 引用 references/ 子文件时，说明什么时候去读
- **每条要求都要能被 agent 判成「做了 / 没做」**：写清谁执行、对什么、什么时候、例外是什么，缺一项就是把它推给读者猜。写法判据见 `jxx-writing-for-agents` 技能「歧义」节，不在此复述

**英文正文**（`<!--en-->` 和 `<!--/en-->` 之间）：
- CodeArts 派生需要。如果正文全是中文，必须提供英文块
- 保持与中文正文同步

### 第 5 步 — 创建 evals（可选但推荐）

在技能目录下创建 `evals/evals.json`：

```json
{
  "skill_name": "<技能名>",
  "evals": [
    {
      "id": 1,
      "prompt": "用户的典型任务描述",
      "expected_output": "期望技能引导的结果",
      "files": []
    }
  ]
}
```

### 第 6 步 — 验证

```bash
node base/scripts/skill-contract.mjs
node base/scripts/ship.mjs check
```

必须全部通过。常见失败：
- `E_CODEARTS_DESCRIPTION`：缺少 `x-vendors.codearts.description-en`
- `E_CODEARTS_EN_BODY`：正文含中文且缺少 `<!--en-->` 英文块
- `E_PARSE`：frontmatter YAML 解析失败
- `E_SKILL_CONTRACT`：description 超预算或调用策略不一致；按 `skill-contract` 的具体错误码修复真源

### 第 7 步 — 回读确认

向用户复述："我创建了 `<技能名>` 技能，在 `<桶>` 桶下，触发词是 …，x-install 是 …"。确认无误后提示可以 `node base/scripts/ship.mjs install` 分发。

## 深入

- **frontmatter 字段详解** — 见 [references/frontmatter.md](references/frontmatter.md)：每个字段的用途、取值、派生影响。当填充 frontmatter 时读。
- **目录结构约定** — 见 [references/structure.md](references/structure.md)：技能目录的标准布局。当组织技能文件时读。

## 与相邻技能的分工

- `jxx-skill-init`（本技能）：**从零创建**新技能的骨架与规范填充
- `skill-creator`：技能的**测试、评估、迭代优化**（evals → benchmark → viewer）
