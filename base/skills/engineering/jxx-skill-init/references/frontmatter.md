# frontmatter 字段详解

`SKILL.src.md` frontmatter 中每个字段的用途、取值、派生影响。

## 必填字段

| 字段 | 说明 | 例子 |
|------|------|------|
| `name` | 技能标识符，与目录名一致 | `jxx-example` |
| `description` | 一句话说明技能范围与触发分支。**四要素缺一不可**：能力 + 场景 + 触发词 + 边界。要"推一点"——包含触发词和相邻场景，防止 undertrigger；边界防止误触发与越界 | `设计 MCP Server 的渐进式发现架构。当用户要设计或重做 MCP、问工具该怎么分层时触发。不写实现代码。` |

### description 四要素模板

判据源：[技能宪章](../../../../docs/agents/skill-charter.md) 原则一。按这个顺序写，四段缺一不可：

```yaml
description: <能力：做什么>。当用户<场景 / 输入类型>时触发，触发词：<词1>、<词2>。不包含<边界：不做什么、交给谁>。
```

- **能力**：一句话说清产物或效果，不写形容词。
- **场景 + 触发词**：写用户会真实说出口的词，中英文都放；`agent` 靠它判断该不该加载。
- **边界**：写「不包含什么、交给哪个技能」。这一句同时防误触发和越界，缺了它 `skill-lint` 会记 `sk-01b`。

## 调用控制

| 字段 | 取值 | 效果 |
|------|------|------|
| `disable-model-invocation` | `true` / 省略 | `true` = 用户调用（零 context load，只能人触发）；省略 = 模型调用（agent 可自主触达） |

## 分发控制

| 字段 | 取值 | 效果 |
|------|------|------|
| `x-install` | `true` / `project` / `false` | `true` = 用户级+项目级都装；`project` = 仅项目级；`false` = 不装（仅作派生源） |

## 派生字段（x-vendors）

| 字段 | 说明 |
|------|------|
| `x-vendors.codearts.product` | 产品标识，通常是 `codebuddy` |
| `x-vendors.codearts.tags` | 标签列表 |
| `x-vendors.codearts.description-en` | 5 行编号列表，英文，供 CodeArts 派生使用 |
| `x-vendors.codebuddy.allowed-tools` | 该技能实际用到的工具列表 |
| `x-vendors.opencode.license` | 通常是 `MIT` |
| `x-vendors.trae` | 空对象 `{}` |

## 完整模板

```yaml
---
name: jxx-example
description: 一句话说明技能范围与触发分支（前导词前置，每个分支一次）。
disable-model-invocation: true
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-example, codebuddy]
    description-en: |-
      1. {功能范围}。
      2. Triggered by: {触发词，中英文}。
      3. {价值主张——解决什么问题}。
      4. Usage: {典型工作流 A → B → C}。
      5. {前置条件——CLI 版本/认证/环境变量}。
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---
```
