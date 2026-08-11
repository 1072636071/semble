---
name: Fluent Design
description: 微软 Fluent——亚克力材质、Reveal 光照、深度层级与 7px 标志圆角
colors:
  primary: "#0078D4"
  on-primary: "#FFFFFF"
  primary-hover: "#106EBE"
  secondary: "#0099BC"
  tertiary: "#8764B8"
  success: "#107C10"
  error: "#D13438"
  background: "#F3F3F3"
  foreground: "#201F1E"
  card: "#FFFFFF"
  muted: "#FAFAFA"
  muted-foreground: "#605E5C"
  border: "#EDEBE9"
typography:
  h1:
    fontFamily: "Segoe UI, Segoe UI Variable, sans-serif"
    fontSize: 2.5rem
    fontWeight: 600
  body:
    fontFamily: "Segoe UI, sans-serif"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Segoe UI, sans-serif"
    fontSize: 0.75rem
    fontWeight: 400
rounded:
  sm: 4px
  md: 7px
  lg: 14px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-accent:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "5px 12px"
  button-accent-hover:
    backgroundColor: "{colors.primary-hover}"
  button-subtle:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "5px 12px"
  card-acrylic:
    backgroundColor: "rgba(255,255,255,0.7)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 16px
---

## Overview

Fluent Design 的核心是**材质与光照**：Acrylic（亚克力，半透明模糊背景模拟毛玻璃）、Reveal（光照随指针揭示交互边界）、Depth（深度层级）。中性克制的中性灰（Office 系）配合 `#0078D4` Accent 蓝作为唯一交互驱动色。标志性的 7px 圆角与 Segoe UI 字体。

## Best Used For

Windows 应用、企业内部工具、Office 生态扩展、需要中性专业气质的后台。

## Not Recommended For

面向消费者的时尚品牌、强情感营销页。

## Colors

中性灰阶细腻（`#F3F3F3` 背景 / `#FAFAFA` 次表面 / `#EDEBE9` 边框），Accent 蓝 `#0078D4` 是唯一强调色，仅用于主交互。语义色（success/error）克制使用。

## Typography

Segoe UI Variable，字号偏小（body 15px），字重梯度 400/600。专业、信息密度高。

## Elevation & Shapes

7px 圆角是 Fluent 标识。亚克力材质通过半透明白 + backdrop-filter 模糊实现深度。阴影柔和、多层。
