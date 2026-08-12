---
name: Minimalist Modern
description: 电蓝渐变、双字体配对、微交互——简洁现代的企业级视觉系统
colors:
  primary: "#0052FF"
  on-primary: "#FFFFFF"
  primary-secondary: "#4D7CFF"
  background: "#FAFAFA"
  foreground: "#0F172A"
  card: "#FFFFFF"
  muted: "#F1F5F9"
  muted-foreground: "#64748B"
  border: "#E2E8F0"
  ring: "#0052FF"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, Satoshi, sans-serif"
    fontSize: 3rem
    fontWeight: 600
  body:
    fontFamily: "Inter, Geist Sans, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 0.75rem
rounded:
  sm: 8px
  md: 12px
  lg: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  button-gradient:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-secondary}"
  card-elevated:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 24px
---

## Overview

Minimalist Modern 的核心是**呼吸感与层级**：温暖近白背景（`#FAFAFA` 而非纯白减少眼疲劳）+ 纯白卡片浮起。电蓝 `#0052FF` 作为唯一强调，以渐变（`#0052FF → #4D7CFF`）形式克制而高冲击地出现。双字体配对——Plus Jakarta Sans 仅用于大标题制造记忆锚点，Inter 承担全部正文。倒置对比区块（深色 section）打破单调。

## Best Used For

官网首页、企业仪表盘、知识库、协作工具、支付系统、文档站、高级订阅 SaaS。

## Not Recommended For

纯娱乐社交、游戏化界面、高冲击促销落地页、复古品牌。

## Colors

近单色暖中性调 + 双色调蓝渐变。强调色少用但冲击大——它们出现之处即吸睛。倒置 section 用 `#0F172A` 深底配 `dot pattern` 纹理避免死板。

## Typography

双字体系统：Plus Jakarta Sans（有性格的标题字，仅 h1/h2）+ Inter（高可读正文）。等宽 JetBrains Mono 用于标签与技术标注。这是"专业且有设计感"的关键。

## Elevation & Shapes

阴影系统分标准档（sm/md/lg/xl）与强调色档（accent/accent-lg，带蓝色 tint）。圆点纹理 + 径向辉光（accent 3-6% opacity）打破平面感。
