---
name: Glassmorphism
description: 毛玻璃模糊、半透明层叠、柔和渐变——轻盈通透的现代视觉
colors:
  primary: "#6C5CE7"
  on-primary: "#FFFFFF"
  secondary: "#00CEC9"
  tertiary: "#FD79A8"
  gradient-start: "#A29BFE"
  gradient-end: "#74B9FF"
  background: "#F8F9FD"
  foreground: "#2D3436"
  glass: "rgba(255,255,255,0.65)"
  glass-border: "rgba(255,255,255,0.4)"
  muted-foreground: "#636E72"
typography:
  display:
    fontFamily: "Poppins, sans-serif"
    fontSize: 2.75rem
    fontWeight: 600
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: 0.8125rem
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  sm: 12px
  md: 20px
  lg: 28px
  pill: 9999px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-glass:
    backgroundColor: "rgba(255,255,255,0.5)"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-solid:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  card-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-glass-hover:
    backgroundColor: "rgba(255,255,255,0.8)"
---

## Overview

毛玻璃美学的核心是**半透明层叠与模糊**：背景铺设柔和的多色渐变（紫 `#A29BFE` → 蓝 `#74B9FF`），前景元素是半透明白（65% 不透明）+ `backdrop-filter: blur()` 的玻璃层。层与层之间透出背景渐变，制造通透的纵深感。1px 半透明白边框模拟玻璃边缘高光。

## Best Used For

现代营销站、个人作品集、轻量应用、创意工具落地页、需要"轻盈未来感"的产品。

## Not Recommended For

信息密集后台、长时间阅读、需高对比的严肃工具（毛玻璃降低可读性）。

## Colors

背景是柔和的多色渐变（非纯色），强调色紫 `#6C5CE7`。玻璃层用半透明白，文字用深灰 `#2D3436` 保证对比。注意：毛玻璃上文字须足够深以满足 WCAG。

## Typography

Poppins 圆润标题 + Inter 正文。圆角偏大（20/28px）配合 pill 按钮，强化柔和。

## Elevation & Shapes

没有传统阴影——靠半透明 + 模糊 + 1px 高光边框表达层级。圆角大而圆润。层叠时下层渐变透出，是这种美学的灵魂。
