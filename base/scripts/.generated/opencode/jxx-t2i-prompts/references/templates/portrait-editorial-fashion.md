---
id: portrait-editorial-fashion
name: 时尚大片 editorial
category: portrait
tags: [时尚, editorial, 杂志, 大片, midjourney, 高定]
source: 社区通行写法归纳（2026-10）；语法对照 BFL/OpenAI/MJ 官方文档
verified: 2026-10-21
quality: 3
---

# 时尚大片 editorial

杂志感不是靠「时尚」两个字，是靠**光 + 姿态 + 服装结构 + 摄影技术**四件套。

## 骨架

[场景与坐标（哪个年代的杂志）], [人物与气场], [服装结构], [姿态与视线], [光位], [镜头与技术], [色彩与后期]

## 模块词库

| 模块 | 关键词示例 |
| --- | --- |
| 场景坐标 | Vogue editorial, high-fashion magazine cover, Paris studio |
| 人物气场 | editorial model, striking bone structure, androgynous elegance, commanding gaze |
| 服装结构 | sculptural couture gown, oversized tailored blazer, liquid satin drape, structured shoulders |
| 姿态视线 | arms crossed, chin lifted, direct gaze into lens, mid-motion turn |
| 光位 | hard directional key light, deep falloff, rim light on shoulder, single softbox |
| 镜头技术 | shot on Hasselblad medium format, 80mm, f/8, full body, studio seamless backdrop |
| 色彩后期 | muted warm skin tones, desaturated cool shadows, high-end retouch, no glow |

## 完整示例

杂志封面级时尚大片，30 岁亚洲女性模特，骨相锋利，气场强势，身穿结构感极强的白色高定礼服，肩部硬挺，下巴微抬，目光直视镜头，双臂交叠，硬质方向主光从左上方打来，右肩有一道勾边光，深色无缝背景，中画幅相机 80mm 拍摄，f/8，全身构图，肤色暖而克制，暗部偏冷，高端精修质感，无柔光滤镜。

## 英文版示例

high-fashion editorial magazine cover, 30-year-old Asian female model, striking bone structure, commanding presence, sculptural white couture gown with structured shoulders, chin lifted, direct gaze into the lens, arms crossed, hard directional key light from upper left with deep falloff and a rim light tracing the shoulder, dark seamless studio backdrop, shot on Hasselblad medium format, 80mm, f/8, full body framing, muted warm skin tones with desaturated cool shadows, high-end retouch, no glow

## 负面提示词

plastic skin, airbrushed, soft focus glow, over-smoothed, symmetric stiff pose, cluttered background, text, watermark

## 调参备注

- MJ：`--style raw` + `--ar 3:4`；一致性用 `--sref` 锁风格、`--cref` 锁脸。别堆 8k/masterpiece，v7 无效。
- SDXL：负面必须短；「soft focus」进反向框比正向写 hard light 更有效。
- 出「网红感」而不是「大片感」→ 检查光位格是否只有一个光源，多光源会摊平脸。

## 来源

- 语法口径：[Midjourney Style Reference](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference) · [v7 提示词指南](https://promptolis.com/blog/midjourney-v7-prompt-guide-2026)
- 说明：文案为社区通行 editorial 写法归纳；示例未绑定具体社区条目，采用时按上面判据自行验 2 张。
