---
name: Skeuomorphism
description: 拟真材质、光照物理触感——模拟真实世界材料与深度的界面
colors:
  primary: "#3A6EA5"
  on-primary: "#FFFFFF"
  metallic-light: "#E8E8EC"
  metallic-dark: "#8E8E93"
  wood: "#8B5E3C"
  leather: "#6B4423"
  background: "#D9D9DE"
  foreground: "#1C1C1E"
  card: "#F2F2F4"
  bezel: "#5A5A5E"
  inset-shadow: "rgba(0,0,0,0.25)"
typography:
  display:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: 2.5rem
    fontWeight: 700
  body:
    fontFamily: "Helvetica Neue, Helvetica, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Helvetica Neue, sans-serif"
    fontSize: 0.875rem
    fontWeight: 600
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
components:
  button-raised:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-raised-hover:
    backgroundColor: "#4A7EB5"
  button-glossy:
    backgroundColor: "{colors.metallic-light}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
  panel-bezel:
    backgroundColor: "{colors.metallic-dark}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: 16px
  knob-dial:
    backgroundColor: "{colors.metallic-light}"
    rounded: "{rounded.pill}"
    size: 48px
---

## Overview

拟物化的核心是**材质与光照**：模拟真实世界的金属、木材、皮革纹理，通过渐变制造凸起/凹陷的立体感。凸起的按钮有高光顶 + 暗影底；凹陷的面板有内阴影。旋钮、拨盘、推子等控件追求可触摸的物理真实。这是 2007-2013 年 iOS 早期的美学。

## Best Used For

智能家居控制面板、专业音频编辑器、游戏界面、复古风格产品、需要"可触摸感"的控制台。

## Not Recommended For

信息密集的后台、扁平现代品牌、追求极简的产品。

## Colors

材质色系：金属（浅银 `#E8E8EC` / 深灰 `#8E8E93`）、木 `#8B5E3C`、皮革 `#6B4423`。控件主色 `#3A6EA5`。靠渐变（线性 light-to-dark）制造凸起。

## Typography

衬线（Georgia）用于标题制造"实体感"，Helvetica 用于控件标签。字重偏粗（600/700）配合阴影增强立体。

## Elevation & Shapes

**阴影是核心表达**——凸起 = 顶光底影的外阴影；凹陷 = inset 内阴影。渐变模拟弧面光照。圆角偏大且圆润，控件多用 pill 全圆角模拟物理旋钮。
