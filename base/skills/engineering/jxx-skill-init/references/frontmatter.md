# frontmatter 字段详解

`SKILL.src.md` frontmatter 中每个字段的用途、取值、派生影响。

## 必填字段

| 字段 | 说明 | 例子 |
|------|------|------|
| `name` | 技能标识符，与目录名一致 | `jxx-example` |
| `description` | 一句话说明技能范围与触发分支。要"推一点"——包含触发词和相邻场景，防止 undertrigger | `设计 MCP Server 的渐进式发现架构。触发词：MCP 设计、工具堆砌。` |

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
