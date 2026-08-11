---
name: Cyberpunk
description: 高对比霓虹、故障美学、终端字体——高冲击力的赛博朋克视觉
colors:
  primary: "#00FFFF"
  on-primary: "#0A0A0F"
  secondary: "#FF00FF"
  tertiary: "#FFFF00"
  danger: "#FF003C"
  background: "#0A0A0F"
  foreground: "#E0E0E0"
  card: "#12121A"
  muted: "#1A1A24"
  muted-foreground: "#7A7A8C"
  border: "#2A2A3A"
  neon-cyan: "#00FFFF"
  neon-magenta: "#FF00FF"
typography:
  display:
    fontFamily: "Orbitron, Audiowide, sans-serif"
    fontSize: 3rem
    fontWeight: 700
    letterSpacing: "0.05em"
  body:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.5
  terminal:
    fontFamily: "Share Tech Mono, monospace"
    fontSize: 0.875rem
rounded:
  none: 0px
  sm: 2px
  md: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-neon:
    backgroundColor: "transparent"
    textColor: "{colors.neon-cyan}"
    rounded: "{none}"
    padding: "10px 20px"
  button-neon-hover:
    backgroundColor: "{colors.neon-cyan}"
    textColor: "{colors.background}"
  card-terminal:
    backgroundColor: "{colors.card}"
    textColor: "{colors.neon-cyan}"
    rounded: "{sm}"
    padding: 16px
  card-glitch:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{sm}"
    padding: 16px
---

## Overview

赛博朋克美学的核心是**高对比霓虹与故障**：纯黑背景（`#0A0A0F`）上，青 `#00FFFF` / 品红 `#FF00FF` / 黄 `#FFFF00` 三色霓虹高饱和撞击。等宽与科技字体（Orbitron / Share Tech Mono）强化终端质感。硬边（无圆角或 2px）、故障动画（glitch）、扫描线与发光描边是标识。

## Best Used For

高冲击营销站、游戏社区、加密/Web3 营销、音乐流媒体、沉浸式叙事。

## Not Recommended For

企业后台、医疗、面向大众的严肃工具、需长时间阅读的内容。

## Colors

黑底霓虹的三色撞击。强调色饱和度拉满，靠 `text-shadow` 发光与边框辉光表达。`danger` 用霓虹红 `#FF003C`。

## Typography

科技字体双轨：Orbitron 用于标题（带宽字距），等宽字体（JetBrains Mono / Share Tech Mono）承担正文与终端文本，强化"机器"气质。

## Elevation & Shapes

发光（neon glow）替代阴影——`box-shadow` 用强调色扩散。硬边、无圆角或极小圆角（2px）。故障效果用 `clip-path` 与多层位移实现。
