---
name: Material Design 3
description: Google Material 3 动态主题，基于色彩角色系统的层级表达
colors:
  primary: "#6750A4"
  on-primary: "#FFFFFF"
  primary-container: "#EADDFF"
  on-primary-container: "#21005D"
  secondary: "#625B71"
  on-secondary: "#FFFFFF"
  tertiary: "#7D5260"
  on-tertiary: "#FFFFFF"
  error: "#B3261E"
  on-error: "#FFFFFF"
  background: "#FEF7FF"
  on-background: "#1D1B20"
  surface: "#FEF7FF"
  on-surface: "#1D1B20"
  surface-variant: "#E7E0EC"
  outline: "#79747E"
typography:
  display:
    fontFamily: "Roboto"
    fontSize: 3.5625rem
    fontWeight: 400
    lineHeight: 1.12
  headline:
    fontFamily: "Roboto"
    fontSize: 2rem
    fontWeight: 400
  body:
    fontFamily: "Roboto"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Roboto"
    fontSize: 0.875rem
    fontWeight: 500
    letterSpacing: 0.1px
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 28px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-filled:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-filled-hover:
    backgroundColor: "#7965AF"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  card-elevated:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
  card-filled:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
---

## Overview

Material Design 3 的核心是**色彩角色系统**：每个颜色成对出现（容器色 + 容器上文字色），由一个种子色动态派生整个调色板。强调圆角与表面层级的组合表达——大胆的圆角（标志性 full 圆角按钮、xl 圆角大卡片）配合三层表面（surface / surface-variant / 容器色）建立视觉层级。

## Best Used For

Android / Material 应用、追求跨平台一致性的产品、需要动态主题（跟随内容或壁纸取色）的应用。

## Not Recommended For

极致拟真的物理界面、需要强品牌个性的营销页。

## Colors

采用 M3 baseline 紫（`#6750A4`）为种子。颜色按角色命名而非情绪——`primary-container` 与 `on-primary-container` 永远成对使用，保证对比度。`tertiary` 是对比强调色，`error` 独立于主色系。

## Typography

单一字体家族 Roboto 贯穿全系统，靠字号与字重建立层级（display 400 / label 500）。M3 的 Type Scale 是离散阶梯，非连续缩放。

## Elevation & Shapes

圆角是 M3 的标志性表达：`full`（胶囊按钮）、`xl`（大卡片）、`md`（标准卡片）。阴影克制——M3 更倾向用表面色差而非阴影表达层级。
