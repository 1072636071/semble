---
name: Apple HIG
description: Apple Human Interface Guidelines——清晰留白、系统色、高级呼吸感与连续圆角
colors:
  primary: "#007AFF"
  on-primary: "#FFFFFF"
  secondary: "#5856D6"
  tertiary: "#FF9500"
  success: "#34C759"
  error: "#FF3B30"
  background: "#F2F2F7"
  foreground: "#000000"
  card: "#FFFFFF"
  muted: "#E5E5EA"
  muted-foreground: "#8E8E93"
  separator: "#C6C6C8"
typography:
  large-title:
    fontFamily: "-apple-system, SF Pro Display, Helvetica Neue, sans-serif"
    fontSize: 2.125rem
    fontWeight: 700
  title:
    fontFamily: "-apple-system, SF Pro Display, sans-serif"
    fontSize: 1.375rem
    fontWeight: 600
  body:
    fontFamily: "-apple-system, SF Pro Text, sans-serif"
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "-apple-system, SF Pro Text, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 400
    color: "{colors.muted-foreground}"
rounded:
  sm: 8px
  md: 12px
  lg: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 20px
components:
  button-plain:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  button-gray:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  card-grouped:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: 16px
  list-row:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    padding: "12px 16px"
---

## Overview

Apple HIG 的核心是**克制与呼吸**：大量留白、系统级中性灰（`#F2F2F7` 分组背景 + 纯白卡片）、系统色仅用于交互点。连续圆角（continuous corner）而非普通圆角，带来更柔和的视觉。层级靠字号阶梯与分组列表的边框分隔表达，而非阴影。

## Best Used For

高端消费品牌站、效率工具（笔记/任务管理）、iOS / macOS 应用、需要高专注度的界面。

## Not Recommended For

游戏、强冲击营销页、需要饱和度与动感的设计。

## Colors

系统色是 Apple 的标识——蓝 `#007AFF` 用于主要交互，其余系统色（success/error/secondary/tertiary）仅在其语义场景出现。中性灰阶极克制：背景、卡片、分隔、次级文字四个层级。

## Typography

SF Pro 系统字体栈，靠字号阶梯（large-title → caption）与字重（700/600/400）建立层级。无需引入外部字体。

## Elevation & Shapes

几乎不用阴影——用纯白卡片浮于 `#F2F2F7` 之上、分隔线 `#C6C6C8` 表达分组。圆角 12px 为标准卡片，8px 为小元素。
