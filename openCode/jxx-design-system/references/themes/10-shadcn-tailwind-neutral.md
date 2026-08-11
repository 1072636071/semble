---
name: Shadcn Tailwind Neutral
description: 中性实用、可访问、组件化——shadcn/ui 与 Tailwind 的默认基线风格
colors:
  primary: "#18181B"
  on-primary: "#FAFAFA"
  primary-hover: "#27272A"
  secondary: "#F4F4F5"
  on-secondary: "#18181B"
  destructive: "#EF4444"
  on-destructive: "#FAFAFA"
  background: "#FFFFFF"
  foreground: "#09090B"
  card: "#FFFFFF"
  muted: "#F4F4F5"
  muted-foreground: "#71717A"
  border: "#E4E4E7"
  input: "#E4E4E7"
  ring: "#18181B"
  accent: "#F4F4F5"
typography:
  h1:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 2.25rem
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Inter, sans-serif"
    fontSize: 0.875rem
    fontWeight: 500
rounded:
  sm: 0.25rem
  md: 0.5rem
  lg: 0.75rem
  pill: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
components:
  button-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-default-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 24px
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

## Overview

shadcn/ui + Tailwind 的中性基线的核心是**实用与可访问**：Zinc 中性灰阶贯穿全局，主色即近黑 `#18181B`（中性，不绑定品牌色，便于任意项目接入）。严格语义化的令牌命名（default / secondary / outline / ghost / destructive）、0.5rem 标准圆角、Inter 字体、负字距标题。不追求视觉冲击，追求"放之四海皆可"的克制基线。

## Best Used For

后台管理系统、内部工具、通用基线（任何不想让设计抢戏的产品）、需要快速接入 shadcn/ui 组件库的项目。

## Not Recommended For

需要强品牌个性的营销页、追求视觉记忆点的消费品。

## Colors

Zinc 中性灰阶（`#FFFFFF` / `#F4F4F5` / `#E4E4E7` / `#71717A` / `#18181B`）。主色近黑，让品牌色可后期替换 `--primary` 一处即生效。`destructive` 红 `#EF4444` 是唯一语义强调。可访问性优先——所有组合默认满足 WCAG AA。

## Typography

Inter 单字体家族，靠字重（700/500/400）与负字距（-0.02em 标题）建立层级。字号阶梯偏小（15px 正文），信息密度高。

## Elevation & Shapes

阴影克制（shadcn 用极淡的多层 shadow）。圆角 0.5rem 为标准，input/button 用 md，card 用 lg。焦点环 `ring` 与主色一致，确保键盘可访问性。
