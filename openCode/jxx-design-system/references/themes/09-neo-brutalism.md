---
name: Neo-Brutalism
description: 粗黑硬边、硬偏移阴影、高饱和撞色——大胆实验的粗野主义
colors:
  primary: "#FFDE7D"
  on-primary: "#000000"
  accent-1: "#FF6B6B"
  accent-2: "#4ECDC4"
  accent-3: "#A8E6CF"
  background: "#FFFDF5"
  foreground: "#000000"
  card: "#FFFFFF"
  border: "#000000"
  shadow: "#000000"
typography:
  display:
    fontFamily: "Space Grotesk, Archivo Black, sans-serif"
    fontSize: 3.5rem
    fontWeight: 700
  body:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: 1.0625rem
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "Space Mono, monospace"
    fontSize: 0.875rem
    fontWeight: 700
rounded:
  none: 0px
  sm: 0px
  md: 0px
  lg: 0px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-brutal:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{none}"
    padding: "12px 24px"
  button-brutal-hover:
    backgroundColor: "{colors.accent-1}"
    textColor: "#FFFFFF"
  card-brutal:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{none}"
    padding: 24px
  card-accent:
    backgroundColor: "{colors.accent-2}"
    textColor: "{colors.foreground}"
    rounded: "{none}"
    padding: 24px
---

## Overview

新粗野主义的核心是**硬边与硬阴影**：纯黑 2-4px 实线边框、无模糊的硬偏移阴影（如 `4px 4px 0 #000`）、高饱和撞色块（黄/红/青/绿互撞）。无圆角或极少圆角。字体粗黑（Archivo Black / Space Grotesk 700）。它故意"反精致"，靠粗粝的几何撞击制造视觉冲击——像 90 年代 zine 与瑞士设计的混血。

## Best Used For

创意机构、独立产品、实验项目、个人品牌、需要"反主流"气质的设计。

## Not Recommended For

企业严肃工具、医疗/金融、需长时间阅读、追求精致与中性的产品。

## Colors

高饱和撞色系：主色黄 `#FFDE7D`，撞色红 `#FF6B6B` / 青 `#4ECDC4` / 绿 `#A8E6CF`。背景暖白 `#FFFDF5`，边框与阴影统一纯黑 `#000000`。对比极强。

## Typography

Space Grotesk / Archivo Black——粗黑无衬线，字重 700。标题特大（3.5rem），字距正常或微紧。等宽 Space Mono 用于强调标签。

## Elevation & Shapes

**硬偏移阴影是标识**——`box-shadow: 4px 4px 0 #000`，无模糊无扩散，像剪贴纸片叠放。无圆角（全 0）。交互态常表现为阴影位移（hover 时阴影消失、元素"按下"）。
