# DESIGN.md 格式规范摘要

DESIGN.md 是 Google Labs 提出的设计系统描述格式，用双层架构让人与 AI 代理共读：YAML frontmatter 提供精确令牌值，Markdown body 解释设计理念。本文件是规范摘要，供生成与校验 DESIGN.md 时参考。完整规范见 https://stitch.withgoogle.com/docs/design-md/specification 。

## Token Schema（顶层 YAML keys）

```yaml
version: "alpha"          # 可选
name: <string>            # 设计系统名
description: <string>     # 可选
colors:
  <token-name>: <Color>
typography:
  <token-name>: <Typography>
rounded:
  <scale-level>: <Dimension>
spacing:
  <scale-level>: <Dimension | number>
components:
  <component-name>:
    <token-name>: <string | token reference>
```

## Token 类型

| 类型 | 格式 | 示例 |
|------|------|------|
| Color | 任意 CSS 颜色（hex / `rgb()` / `oklch()` / 命名色） | `"#1A1C1E"`, `"oklch(62% 0.18 250)"` |
| Dimension | 数字 + 单位（`px` / `em` / `rem`） | `48px`, `-0.02em` |
| Token Reference | `{path.to.token}` | `{colors.primary}` |
| Typography | 对象：`fontFamily` / `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` | 见各预设 |

## Component Tokens

组件映射名称到一组属性，支持变体（hover / active 等）：

```yaml
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.tertiary-container}"
```

**有效组件属性**：`backgroundColor`、`textColor`、`typography`、`rounded`、`padding`、`size`、`height`、`width`。

## Markdown Body 的 Section 顺序

这些 section 可省略，但出现的必须按以下顺序排列：

| # | Section | 别名 | 用途 |
|---|---------|------|------|
| 1 | Overview | Brand & Style | 品牌与风格概览 |
| 2 | Colors | — | 配色系统 |
| 3 | Typography | — | 字体排版 |
| 4 | Layout | Layout & Spacing | 布局与间距 |
| 5 | Elevation & Depth | Elevation | 阴影与深度 |
| 6 | Shapes | — | 形状（圆角等） |
| 7 | Components | — | 组件定义 |
| 8 | Do's and Don'ts | — | 设计规范与禁忌 |

## 9 条 Lint 规则

| 规则 | 级别 | 检查内容 |
|------|------|----------|
| `broken-ref` | error | 无法解析的令牌引用（如 `{colors.primary}` 指向不存在的令牌） |
| `missing-primary` | warning | 定义了颜色但没有 `primary`——代理会自动生成一个 |
| `contrast-ratio` | warning | 组件 `backgroundColor`/`textColor` 对低于 WCAG AA（4.5:1） |
| `orphaned-tokens` | warning | 定义了但从未被任何组件引用的颜色令牌 |
| `token-summary` | info | 各 section 中令牌数量摘要 |
| `missing-sections` | info | 其他令牌存在时，可选 section（spacing/rounded）缺失 |
| `missing-typography` | warning | 定义了颜色但没有字体令牌——代理用默认字体 |
| `section-order` | warning | section 未按规范顺序排列 |
| `unknown-key` | warning | 顶层 YAML key 疑似已知 schema key 的拼写错误（如 `colours:` → `colors:`） |

## 未知内容处理

| 场景 | 行为 |
|------|------|
| 未知的 section 标题 | 保留，不报错 |
| 未知的颜色令牌名 | 若值有效则接受 |
| 未知的字体令牌名 | 接受为有效字体 |
| 未知的组件属性 | 接受但警告 |
| 重复的 section 标题 | **错误，拒绝文件** |
