---
id: character-deepseek-whale-girl
name: DeepSeek 鲸鱼娘表情包
category: character
tags: [deepseek, 鲸鱼娘, 蓝色大肥鱼, 表情包, q版, 二次元, 女仆, canonical]
source: 上游规范 github.com/Neko3000/deepseek-whalechan（character-spec.md / form-profiles.md）；梗鲸百科 https://aigengtu.com/zh/whale-chan
verified: 2026-10-21
quality: 4
---

# DeepSeek 鲸鱼娘表情包

社区二创形象（非官方）。本模板以开源项目 `deepseek-whalechan` 的**角色规范**为准（社区里一致性最好的那份），而不是各博主的自由发挥。

## 两层「原版提示词」

| 层 | 内容 | 用在哪 |
| --- | --- | --- |
| 文本人设 | 社区 meme 指令 `【PERSONA_LOAD】`（类配置文件的标签格式），敲进对话模型即进入鲸鱼娘人格 | 对话模型（DeepSeek 等），不是出图 |
| 出图规范 | 本模板下半部分的永久身份块 + canonical 服饰/画风 + 比例档位 | 任何图像模型 |

文本层要点（供复述，不含出图信息）：自称「本鲸鱼娘 / 本小姐」，傲娇嘴硬心软，主食米饭，尾鳍随心情摆动，绝不许说「胖」，思考过程用中文。它就是从训练数据里「长」出形象的来源。

## 永久身份（缺一个就不像她）

1. 一个人形、永龄恒定的鲸鱼娘，两条胳膊两条腿
2. 宽圆脸、大而有神的眼睛、小鼻子、小嘴、腮红位置固定
3. 深海蓝发块 → 发梢卷曲渐变为青色（有彩色时）
4. 一对侧生鲸鳍耳（paired side whale-fin ears）
5. 一根前弯呆毛（forward-curving ahoge）
6. 一条与身体自然相连的鲸尾
7. 可辨识的脸型结构、发块轮廓、鳍耳位置、呆毛剪影、尾巴构造

比例只改几何，不改年龄——不允许悄悄变成小孩、巨型鲸、鲸身生物、人鱼或半鲸。

## 骨架

[永久身份 7 条], [比例档位], [表情与动作], [服饰（canonical / 自定义）], [画风], [背景与文字位]

## 比例档位（上游实测表）

| 档位 | 头身比 | 视觉定义 |
| --- | --- | --- |
| `standard` 标准 | 4.0 | 最高挑，躯干明确，四肢最长 |
| `compact` 紧凑 | 3.3 | 常规角色比例，四肢略短 |
| `semi-chibi` 半 Q | 2.8 | 默认档，大头 + 紧凑躯干 |
| `chibi` Q 版 | 2.5 | 表情包首选，超大头部、短粗四肢 |
| `super-deformed` SD | 2.1 | 最压缩，巨大头部、极小四肢 |

别名可直接写中文：「Q 版」「半Q版」「超Q版」。`幼年化/儿童` **不是**比例档位，别混。

## 模块词库

| 模块 | 关键词示例 |
| --- | --- |
| 表情情绪 | 傲娇撇头 / 得意叉腰 / 心虚冒汗 / 摸鱼打瞌睡 / 吃白饭满足 / 炸毛 / 无语 |
| 动作道具 | 抱白饭碗、叼饭勺、抱着笔记本、盖被子、喷水抗议 |
| 服饰 canonical | 白蕾丝头饰，深蓝领结配蓝宝石，深蓝袖与胸衣，白蕾丝领与围裙（小型蓝鲸徽章**是图形不是文字**），哑光金镶边/刺绣/纽扣，白蕾丝下摆与袜，深蓝搭扣鞋 |
| 画风 canonical | 近黑深蓝外轮廓 + 更细内线，干净圆润造型，克制的柔和赛璐璐，稀疏油亮高光；冷调深蓝 / 海蓝 / 青蓝 / 白 + 暖白肤色 + 克制哑光金；中等饱和与对比；禁止霓虹、发灰、灰浊、厚涂、强对比 |
| 背景文字 | 默认背景纯色暖象牙米 `#F5EADD`；默认无文字，需要时只排已冻结的原文 |

## 完整示例

Q版二次元表情包，DeepSeek 鲸鱼娘：宽圆脸，大眼，小鼻子小嘴，腮红，深海蓝发块发梢渐变为青色卷曲，一对侧生鲸鳍耳，一根前弯呆毛，一条自然相连的鲸尾，两条胳膊两条腿。约 2.5 头身 Q 版比例。穿深蓝白女仆装：白蕾丝头饰、深蓝领结配蓝宝石、深蓝袖与胸衣、白蕾丝领与围裙（围裙上有小型蓝鲸图形徽章）、哑光金镶边、白蕾丝下摆与袜、深蓝搭扣鞋。近黑深蓝外轮廓配细内线，柔和赛璐璐上色，稀疏高光，冷静的深蓝海蓝青蓝配色。双手抱一碗白饭，撇头嘟嘴，一脸傲娇。纯色暖象牙米背景 #F5EADD，单人居中，贴纸构图，无文字无水印无签名。

## 英文版示例

chibi anime sticker, DeepSeek Whale-chan, one consistent ageless humanoid character: broad round face, large expressive eyes, tiny nose, small mouth, rosy cheeks, deep-ocean-blue hair mass fading to cyan curled ends, paired side whale-fin ears, one forward-curving ahoge, one coherent naturally attached whale tail, two correct arms and two correct legs. Chibi proportion about 2.5 heads tall, oversized head, short thick rounded limbs. Canonical costume: navy-and-white ornate maid outfit with white frilled headpiece, navy neck bow with blue gem, dark-navy sleeves and bodice, white frilled collar and apron bearing a small blue whale emblem rendered as a graphic not text, muted-gold piping and buttons, white frilled hem and socks, dark-blue strap shoes. Canonical style: bold near-black navy outer contours with finer interior lines, clean rounded shapes, restrained soft cel shading, sparse glossy highlights, cool navy/ocean-blue/cyan palette with warm pale skin and restrained muted-gold accents. Hugging a bowl of plain rice, head turned away, pouting tsundere expression. Solid warm ivory-beige background #F5EADD, single character centered, sticker composition, no text, no watermark, no signature.

## 负面提示词

realistic, 3d render, missing whale tail, human ears without fins, missing ahoge, wrong proportions, child-like age shift, mermaid, whale-bodied creature, neon colors, muddy gray, painterly, text gibberish, watermark, signature

## 调参备注

- **别写「DeepSeek logo」**：模型会画官方鲸鱼标而不是人形。
- 表情包固定用 `chibi`（2.5 头身）；写「可爱」不写比例，会出成幼女立绘或标准比例。
- 围裙上的蓝鲸徽章必须写「图形，不是文字」，否则模型会尝试写字然后糊掉。
- 背景写死 `#F5EADD`（上游默认），比「白色背景」更像官方素材。
- 一组表情包的做法：永久身份段与画风段固定，只改「表情情绪 + 动作道具」两格。
- 版权：形象源头为画师上善无形 OC「溟月」（CC BY-NC-SA 4.0，须署名、非商用），女仆装设计 ZipZipPipe（禁商用）；上游 repo 代码 MIT、资产 CC BY-NC-SA 4.0。

## 来源

- 上游规范：[Neko3000/deepseek-whalechan](https://github.com/Neko3000/deepseek-whalechan)（`skills/whalechan-image-character/references/character-spec.md`、`form-profiles.md`）
- 文本人设：[dsh-whale-musume-persona](https://github.com/Kaalia0912/dsh-whale-musume-persona)（社区 meme 指令 `【PERSONA_LOAD】` 的扩展版）
- 设定百科：[梗鲸百科 · DeepSeek娘](https://aigengtu.com/zh/whale-chan)
- 出图记录：2026-10-21 agnes-image-2.5-flash 2K/1:1 跑两张——自拟版 `dd48c3a2…`、上游 canonical 版 `efa2d659…`，产物在 `.temp/output/whale-girl/`。命中率待人工比对。
