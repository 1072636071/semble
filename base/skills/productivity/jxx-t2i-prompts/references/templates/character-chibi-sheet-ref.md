---
id: character-chibi-sheet-ref
name: Q 版人设图（参考图锁角色）
category: character
tags: [q版, 人设图, character sheet, 参考图, 一致性, img2img]
source: 实操归纳（2026-10-21，agnes-image-2.5-flash 图生图跑通）；比例与版式口径参考 Neko3000/deepseek-whalechan
verified: 2026-10-21
quality: 3
---

# Q 版人设图（参考图锁角色）

手里有一张既有角色图（哪怕是带水印的截图），要产出可复用的 Q 版设定稿时用这条。**身份由参考图给，比例与版式由文字给**，两件事分开写。

## 两步法

1. **清图**：图生图只做减法——「去水印/logo/签名/多余文字，其余一律不动，不要重绘角色」。一次只改一件事，清完再进第二步。
2. **转 Q 版**：以清理后的图为参考，只改比例、版式、背景；身份特征逐条点明「保持不变」。

一步到位的写法（直接要求「去水印并转 Q 版」）会让模型顺手重绘角色，身份就漂了。

## 骨架

[身份锁定：参考图 + 保留清单], [比例档], [版式], [画风], [背景], [禁止项]

## 模块词库

| 模块 | 关键词示例 |
| --- | --- |
| 身份锁定 | 以参考图中的角色为准；保留发色与发型、耳部特征、尾/翼等非人特征、服装款式与配色；不要换人换装 |
| 比例档 | Q 版约 2.5 头身；超大头部、紧凑躯干、短粗圆润四肢；比例只改几何，不改年龄感 |
| 版式 | 两视图并排（正面全身 + 四分之三侧身），人物大小一致；或三视图（正/侧/背） |
| 画风 | 与其参考图一致；干净线稿，柔和赛璐璐，稀疏高光 |
| 背景 | 浅暖象牙米 #F5EADD 或纯白；无环境、无地面阴影堆叠 |
| 禁止项 | 不要文字、标注、水印、签名、多余角色、写实照片风 |

## 完整示例

以参考图中的角色为准，生成 Q 版人设图：同一角色，保留发色与发型、鲸鳍耳、呆毛、鲸尾、服装款式与配色，不要换人换装。Q 版比例约 2.5 头身，超大头部、紧凑躯干、短粗圆润四肢，比例只改几何不改变角色年龄感。浅暖象牙米纯色背景，两视图并排——左侧正面全身站姿，右侧四分之三侧身，人物大小一致，姿态自然放松。画风与参考图一致，干净线稿、柔和赛璐璐、稀疏高光。不要文字、不要标注、不要水印、不要签名、不要多余角色。

## 英文版示例

using the reference image as the identity authority, produce a chibi character sheet: same character, keep the hair color and hairstyle, fin ears, ahoge, tail, costume design and palette unchanged, do not redesign or re-outfit. About 2.5 heads tall, oversized head, compact torso, short thick rounded limbs; proportion changes geometry only, never apparent age. Solid warm ivory-beige background #F5EADD, two views side by side: front full-body standing on the left, three-quarter turn on the right, consistent scale, relaxed natural pose. Match the reference's rendering style: clean lineart, soft cel shading, sparse highlights. No text, no callouts, no watermark, no signature, no extra characters.

## 负面提示词

redesigned character, different outfit, different hair color, adult proportions, realistic photo, extra characters, callout text, watermark, signature, busy background

## 非人特征的解剖先验（必读）

模型对「尾巴」有**鱼鳞先验**：写 whale tail 不写材质，就会长出菱形鳞片、网格纹或甲片。鲸尾是哺乳动物的光滑皮肤，必须显式否掉：

- 正向：`smooth whale tail, smooth skin, no scale texture, rounded fin edges`
- 中文：`尾巴表面光滑、无鳞片、无鱼鳞纹理、无网格或菱形纹`
- 负向：`scaly tail, fish scales, reptile scales, scale texture, armor plates`

同类先验还有：鳍耳被画成翅膀、呆毛被画成天线、女仆裙被画成泳装。凡是「像鱼又不是鱼」「像翅膀又不是翅膀」的部位，都要在正向和负向各写一遍。

## 调参备注

- 参考图分辨率低（<600px）也能跑，但细节会**被模型补全成它自己的理解**——先接受这点，再对比原图确认身份有没有漂。
- 两视图常只出一个人：要么跑两三次挑，要么分开出「正面」「侧身」各一张再拼。
- 想要「设定稿」感就加纯色背景 + 人物大小一致；加地面投影和场景立刻变成插画。
- 2 头身比上游档位表最低档（super-deformed 2.1）更极端：要写「头部高度约等于全身一半」，只说「2 头身」模型常给到 2.5。
- 用户明确「不要动原图」时，跳过清图步骤，直接把原图当身份参考做重绘（Q 版本来就是重画，水印不会跟过去）；这样原图一个像素都不改。
- 不同厂商支持度：图生图（Gemini/Nano Banana 系、agnes-image）最稳；纯文生图平台没有参考图能力，只能靠文字描述身份。

## 来源

- 实操：2026-10-21 agnes-image-2.5-flash，先 `img2img` 去水印（2K/9:16），再 `img2img` 转 Q 版两视图（2K/3:4）。
- 比例档与版式口径：[Neko3000/deepseek-whalechan](https://github.com/Neko3000/deepseek-whalechan) 的 `form-profiles.md`
