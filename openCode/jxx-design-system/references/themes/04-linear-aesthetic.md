---
name: Linear Aesthetic
description: 精密细线、微光呼吸、暗色玻璃——开发者工具与 SaaS 的高级暗色调
colors:
  primary: "#5E6AD2"
  on-primary: "#FFFFFF"
  primary-hover: "#7170E0"
  accent: "#26D0CE"
  background: "#08090A"
  foreground: "#F7F8F8"
  card: "#0F1011"
  surface-elevated: "#151618"
  muted: "#1C1E20"
  muted-foreground: "#8A8F98"
  border: "#1F2023"
  border-subtle: "#161719"
typography:
  display:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 2.5rem
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.55
  mono:
    fontFamily: "Berkeley Mono, JetBrains Mono, monospace"
    fontSize: 0.8125rem
rounded:
  sm: 6px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  card-glass:
    backgroundColor: "rgba(255,255,255,0.03)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 16px
---

## Overview

Linear 美学的核心是**精密与微光**：1px 细边框定义边界、暗色玻璃面板（`rgba(255,255,255,0.03)` + backdrop-filter）、克制的紫色强调（`#5E6AD2`）配合微光渐变与呼吸动效。信息密度高但呼吸感强——靠紧密字距（-0.02em）与紧凑行高建立"精密工具"气质。

## Best Used For

开发者工具、AI 平台、项目管理、高科技 SaaS、加密交易界面。

## Not Recommended For

面向大众的消费品、儿童产品、明亮活泼的设计。

## Colors

几乎纯黑背景（`#08090A`）+ 三层灰阶表面。强调色紫色 `#5E6AD2` 是唯一交互驱动。文字色 `#F7F8F8` 非纯白，减少刺眼。

## Typography

Inter 为主，紧凑字距 -0.02em 是"精密感"的关键。等宽字体用于代码与标签，强化工具属性。

## Elevation & Shapes

微光（subtle glow）替代阴影——强调色在卡片边缘的 1px 内发光。圆角克制（6/8/12），避免过于柔和。
