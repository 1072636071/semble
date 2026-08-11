---
name: <设计系统名>
description: <可选：一句话说明设计意图>
colors:
  primary: "#<主色>"
  on-primary: "#<主色上的文字色>"
  secondary: "#<次要色>"
  tertiary: "#<强调色>"
  background: "#<背景>"
  foreground: "#<正文文字>"
  muted: "#<次要表面>"
  muted-foreground: "#<次要文字>"
  border: "#<边框>"
  card: "#<卡片表面>"
typography:
  h1:
    fontFamily: "<标题字体>"
    fontSize: <3rem>
    fontWeight: <700>
  body-md:
    fontFamily: "<正文字体>"
    fontSize: <1rem>
    fontWeight: <400>
    lineHeight: <1.6>
  label-caps:
    fontFamily: "<标签字体>"
    fontSize: <0.75rem>
    fontWeight: <600>
    letterSpacing: <0.05em>
rounded:
  sm: 4px
  md: 8px
  lg: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.tertiary}"
  card-surface:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 24px
---

## Overview

<一段话说明：设计系统的气质、灵感来源、核心原则。>

## Colors

- **Primary (#<...>)**: <用途>
- **Secondary (#<...>)**: <用途>
- **Tertiary (#<...>)**: <用途——通常是唯一的交互驱动色>
- **Background / Foreground**: <底与字>
- **Muted**: <次要表面>

## Typography

- **Display / h1**: <字体 + 用途>
- **Body**: <字体 + 用途>
- **Label**: <字体 + 用途>

## Layout & Spacing

<间距尺度与栅格说明。>

## Elevation & Depth

<阴影层级说明。>

## Shapes

<圆角尺度说明。>

## Components

<组件令牌说明——按钮、卡片、输入等。>

## Do's and Don'ts

- **Do**: <应遵循的>
- **Don't**: <应避免的>
