---
id: portrait-neon-cyber-night
name: 赛博霓虹夜拍
category: portrait
tags: [赛博, 霓虹, 夜景, 雨夜, 机能, cyberpunk]
source: 社区通行写法归纳（2026-10）；色温与光源写法对齐 MJ/Flux 指南
verified: 2026-10-21
quality: 3
---

# 赛博霓虹夜拍

双色光源定成败：冷暖对撞 + 湿地面反射 + 单一焦点。人像别写成场景。

## 骨架

[人物 + 造型], [姿态], [环境], [双色光], [雨与反射], [镜头], [色彩后期]

## 模块词库

| 模块 | 关键词示例 |
| --- | --- |
| 人物造型 | cyberpunk streetwear, techwear jacket, wet hair, chrome earring |
| 姿态 | leaning against damp wall, glancing over shoulder, hands in pockets |
| 环境 | narrow alley, neon signage, steam vents, night city |
| 双色光 | magenta key from signage, cyan rim from opposite side |
| 雨与反射 | light rain, wet asphalt reflections, lens droplets |
| 镜头 | 35mm, f/1.8, half-body, slight low angle |
| 后期 | teal-magenta grade, crushed blacks, bloom on highlights |

## 完整示例

赛博霓虹夜拍人像，25 岁女性，机能风外套，头发微湿，戴铬色耳饰，斜倚潮湿墙面侧头回望，狭窄小巷，霓虹招牌与蒸汽口，品红色主光来自右侧招牌，青蓝色轮廓光从左侧打来，细雨，湿地面反光，35mm f/1.8 半身低机位，青品色调，暗部压黑，高光带轻微泛光。

## 英文版示例

cyberpunk neon night portrait, 25-year-old woman in techwear jacket, damp hair, chrome earring, leaning against a wet wall glancing over her shoulder, narrow alley with neon signage and steam vents, magenta key light from signage on the right, cyan rim light from the left, light rain, reflective wet asphalt, 35mm, f/1.8, half-body, slight low angle, teal-magenta grade, crushed blacks, subtle bloom on highlights

## 负面提示词

daylight, flat lighting, oversaturated rainbow, plastic skin, cluttered signage text, distorted hands, watermark

## 调参备注

- 只给一个主光 + 一个轮廓光；第三个光源会让脸变平、失去赛博感。
- 霓虹招牌会让模型画乱码文字 → 写 `blurred signage, no readable text` 或负面封 text。
- 雨丝太多会糊脸：写 `light rain`，别写 downpour。

## 来源

- 口径参考：[FLUX.2 指南](https://docs.bfl.ml/guides/prompting_guide_flux2) · [Midjourney 参数](https://guidesref.com/cheatsheet)
- 说明：霓虹夜景人像通行写法归纳，未绑定具体社区条目。
