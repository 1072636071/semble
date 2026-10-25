---
id: portrait-studio-beauty
name: 棚拍美妆特写
category: portrait
tags: [美妆, 棚拍, 特写, beauty, 环形光, 商业]
source: 社区通行写法归纳（2026-10）；SDXL 语法见 Stability/社区文档
verified: 2026-10-21
quality: 3
---

# 棚拍美妆特写

卖点全在皮肤与眼睛：环形光、眼神光、湿感细节。距离越近越要写清光。

## 骨架

[人物 + 年龄], [皮肤与妆容], [眼神], [唇与唇纹], [光位与眼神光], [镜头], [后期]

## 模块词库

| 模块 | 关键词示例 |
| --- | --- |
| 人物 | beauty model, 24, symmetrical features, clean brow |
| 皮肤妆容 | dewy skin, visible pores, natural blush, glossy highlight on cheekbone |
| 眼神 | sharp catchlights, defined lashes, iris texture |
| 唇 | glossy lips, soft lip texture, subtle cupid's bow |
| 光位 | ring light, beauty dish above, soft gradient falloff, no harsh shadow |
| 镜头 | 100mm macro, f/4, tight close-up, eyes in focus |
| 后期 | commercial beauty retouch, true skin tone, no plastic |

## 完整示例

商业美妆棚拍特写，24 岁亚洲女性，五官对称，眉毛干净，皮肤带通透水光与可见毛孔，颧骨有自然高光，睫毛根根分明，瞳孔有清晰眼神光，唇部有光泽与唇纹，柔和环形光从正上方打来，光线渐变过渡无硬阴影，100mm 微距镜头 f/4，紧致面部特写，眼睛对焦，真实肤色，精修但不塑料。

## 英文版示例

commercial beauty studio close-up, 24-year-old Asian woman, symmetrical features, clean brows, dewy translucent skin with visible pores, natural highlight on the cheekbone, separated lashes, crisp catchlights in the irises, glossy lips with visible texture, soft ring light from above with smooth gradient falloff and no harsh shadows, 100mm macro lens, f/4, tight facial close-up with eyes in focus, true skin tone, retouched but not plastic

## 负面提示词

plastic skin, airbrushed, dust, blemishes artifacts, blown highlights, harsh shadow, blurry eyes, deformed teeth, watermark

## 调参备注

- 特写时手和牙最容易崩：干脆不给牙齿（闭唇微笑），手出画。
- 想要「广告片」就加笑肌与下颌线阴影；想要「真实感」就留毛孔，删掉 retouch 类词。
- SDXL 用 (visible pores:1.2) 微调；Flux/OpenAI 直接写句子，别用括号权重。

## 来源

- 语法口径：[SDXL 权重与负面词指南](https://promptmake.net/blog/stable-diffusion-xl-prompt-guide-weights-negatives) · [Flux 提示词指南](https://docs.bfl.ml/guides/prompting_guide_flux2)
- 说明：beauty 类通行写法归纳，未绑定具体社区条目。
