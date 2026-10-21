# 文生图提示词技能 · 一手调研笔记

> 访问日期：2026-10-21。来源优先官方文档，社区榜单次之。不确定处标「未证实」。

## 1) 平台提示词语法差异（对照表）

一句话基准：**权重靠前原则**——多数模型对提示词**前半段**更敏感（MJ、FLUX 均明确）；FLUX/OpenAI/Gemini 走自然语言，SD 系走标签+权重语法。

| 平台 | 吃什么样的句子 | 关键语法 | 负面词 | 官方指南 |
|---|---|---|---|---|
| Midjourney v7 / niji | 自然语言短句 + 末尾参数；词序靠前权重高；v7 重 --sref/--cref 锚定一致性，而非堆 "8k masterpiece" | `--ar` `--style raw` `--chaos` `--stylize` `--sref` `--cref` `--no`；多提示词权重 `word1 ::2 word2 ::1`；`--no` 等价 `item::-0.5` | `--no x,y`（等效负权重） | [MJ 参数表(社区整理)](https://guidesref.com/cheatsheet) · [v7 指南(社区)](https://promptolis.com/blog/midjourney-v7-prompt-guide-2026) · [Style Ref 官方](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference) |
| Flux (Black Forest Labs, FLUX.2 pro/max) | 自然语言长句；**词序敏感**：主体→动作→风格→环境；无负面词 | 无结构化标签语法；支持 JSON 结构化提示、HEX 颜色、多参考图编辑 | **不支持 negative prompt**（官方明确） | [FLUX.2 Prompting Guide](https://docs.bfl.ml/guides/prompting_guide_flux2) · [Working Without Negative Prompts](https://docs.us.bfl.ai/guides/prompting_guide_t2i_negative) |
| Stable Diffusion XL / 3.5 | 标签/自然语言混合；显式权重语法；正向+反向双框 | `(word)`≈1.1x、`((word))`≈1.21x、`(word:1.3)` 精确权重、`[word]` 减权重、**`BREAK`** 切 75-token 段、embedding/LoRA trigger | 反向提示词框独立；SDXL 仍需但应短 | [SD Prompt syntax(社区)](https://docs.dreamerland.ai/basic-terms/sd-prompt-syntax) · [括号/BREAK/权重 FAQ](https://generativelabs.com/insights/prompt-syntax-for-stable-diffusion-faq) · [SDXL 指南](https://promptmake.net/blog/stable-diffusion-xl-prompt-guide-weights-negatives) |
| OpenAI GPT-image-1 / DALL·E 3 | 纯自然语言长描述；"像导演 brief"；指令跟随强、不读负面词；支持多语言、中文稳定；画幅写进 prompt 或 size 参数 | 无参数式语法；moderation 参数（low 也可能拒） | **无 negative 字段**；靠正向重述排除 | [Image prompting(官方,需登录)](https://developers.openai.com/api/docs/guides/image-prompting) · [API 镜像说明(社区)](https://byapi.apifox.cn/427817652e0) |
| Google Gemini 2.5 Flash Image (Nano Banana) | 编辑式指令 + 多图参考；对话式迭代；文本渲染强；含 SynthID 水印 | 文生图 / 图+文编辑 / 多图合成与风格迁移；"把图中的 X 改成 Y" | 未证实独立负面字段（靠指令） | [How to prompt Gemini 2.5 Flash Image(官方博客)](https://developers.googleblog.com/en/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/) · [Gemini 图像生成概览(社区)](https://www.aaiai.org/?p=2116) |
| 即梦 Dreamina / Seedream 4 | 中文自然语言；"探索"区看他人提示词与成图；有提示词相关资源/广场 | 无显式参数语法；支持多比例、修复/去背/扩图 | 未证实独立负向框（靠正向重述） | [即梦 AI 艺术提示指南](https://jimeng.jianying.com/features/resource/ai-art-prompt) · [图片生成 4.0 产品介绍(火山)](https://www.volcengine.com/docs/85621/1820192) |
| 通义万相（Wanx 文生图 V2） | 中英均可；**结构化模板**；V2 默认 `prompt_extend` 智能改写（推荐开） | `prompt` 正向 + `negative_prompt` 反向；公式=主体+场景+风格 / 进阶=主体+场景+风格+镜头+氛围+细节 | `negative_prompt` 独立字段（官方） | [文生图 Prompt 指南(官方)](https://help.aliyun.com/zh/model-studio/text-to-image-prompt) · [英文版](https://help.aliyun.com/en/model-studio/text-to-image-prompt) |
| 可灵 Kling（图像生成） | 中文自然语言；"像给摄影师下指令"，强迫答五问：拍谁/在哪/干嘛/镜头/光线 | 无参数语法；5 段式：景别运镜+主体+动作+场景光线+情绪风格 | 未证实独立负向框（靠正向重述） | [可灵 5 段式公式(社区)](https://c.m.163.com/news/a/L4DL3ELM0511D0T2.html) · [Kling 公式页(JS,官)](https://klingai.com/quickstart/ai-image-prompt-formula) |

## 2) 提示词结构骨架 / 公式（4–6 种）

- **万能通用骨架**（社区高赞）：**主体 + 风格 + 场景 + 构图 + 光线 + 质感 + 限制项**；可拆模块：主体/状态/风格/场景/构图/光线材质/限制。来源：[AIHub 实战](https://www.aihubproxy.com/youxiuaishengtutishicishizhan5)
- **Midjourney 2026 词序骨架**：**Subject → Style → Setting → Lighting → Camera/Technical → Parameters**（靠前权重高）；v7 必带 `--style raw`（写实），`--sref/--cref` 保一致性。来源：[Promptolis v7 指南](https://promptolis.com/blog/midjourney-v7-prompt-guide-2026)
- **FLUX 官方骨架**：**Subject + Action + Style + Context**；优先级 主体→关键动作→关键风格→必要环境→次要细节；短 10–30 / 中 30–80 / 长 80+ 词。来源：[FLUX.2 Guide](https://docs.bfl.ml/guides/prompting_guide_flux2)
- **通义万相官方双公式**：基础=**主体 + 场景 + 风格**；进阶=**主体(描述) + 场景(描述) + 风格 + 镜头语言 + 氛围词 + 细节修饰**（配词典：景别/视角/镜头/风格/光线）。来源：[阿里云官方](https://help.aliyun.com/zh/model-studio/text-to-image-prompt)
- **可灵 5 段式**（中文平台范本）：**[景别与运镜] + [主体] + [具体动作] + [场景与光线] + [情绪与风格]**；形容词要换成可见动作。来源：[可灵教程](https://c.m.163.com/news/a/L4DL3ELM0511D0T2.html)
- **导演 brief 法**（OpenAI/DALL·E 适用）：把提示词当"摄影师+插画师+艺术指导联合 brief"，说明什么重要、什么可变、什么必须固定。来源：[AI Photo Generator 指南](https://www.aiphotogenerator.net/blog/2026/06/ai-art-prompt)

**分品类骨架与高频词库：**

- 人像摄影：骨架=主体(年龄/种族/发型/妆容)+服装+场景+镜头(半身特写/景深)+光线(自然光/逆光/伦勃朗)+质感(皮肤纹理/锐利边缘)。高频：`commercial photography, cinematic lighting, half-body close-up, sharp edges, shallow depth of field, soft natural light`。来源：[万相词典](https://help.aliyun.com/zh/model-studio/text-to-image-prompt)
- 3D/游戏角色 CG：骨架=角色设定(种族/装备/姿势)+材质(次表面散射/PBR)+渲染器(UE5/Blender/Cycles)+风格(工作室风/手办)。高频：`3D render, octane render, unreal engine 5, PBR, subsurface scattering, volumetric lighting, miniature figurine`。注：FLUX/SD 系吃标签；OpenAI 用自然语言描述同样要素。来源：未证实统一官方，归纳自 [AIHub 动漫/CG 拆解](https://www.aihubproxy.com/youxiuaishengtutishicishizhan5)
- 产品商业：骨架=**卖点先于美感**；主提示=产品居中+材质+棚拍光；限制词=不要人物/不要文字/不改包装。高频：`product photography, centered, studio lighting, white background, glass bottle, softbox`。来源：[AIHub 电商风](https://www.aihubproxy.com/youxiuaishengtutishicishizhan5)
- 插画/动漫：骨架=**角色设定 > "anime style"**；设定(发色/服饰/性格)+画风(赛璐璐/厚涂)+构图。高频：`anime, cel shading, manga, illustration, vibrant colors, clean lineart`；SD 系配 LoRA trigger。来源：[AIHub 二次元](https://www.aihubproxy.com/youxiuaishengtutishicishizhan5)
- 场景氛围：骨架=地点+时间+天气+光影+情绪+镜头。高频：`cinematic, atmospheric, volumetric fog, golden hour, moody, wide shot, rim light`；避免只写 "cinematic"，要具体化。来源：[AIHub 电影感](https://www.aihubproxy.com/youxiuaishengtutishizhan5) · [AI Photo Generator](https://www.aiphotogenerator.net/blog/2026/06/ai-art-prompt)

## 3) 高质量模板发现渠道清单（可操作搜索配方）

- **Civitai**（模型页 examples + 提示词）：搜模型 → 看 "Images" 标签下每张图的完整 prompt/参数。站点内搜索：`civitai.com/models?query=<风格>`；按 checkpoint 看专属提示词。来源：[Civitai](https://civitai.com/)
- **PromptHero**（跨平台 SD/MJ/DALL·E）：站内搜 `prompthero.com/search?q=<主题>&model=stable-diffusion`；看热门与创作者主页。来源：[PromptHero](https://prompthero.com/)
- **Lexica.art**（SD 图+提示搜索引擎）：图搜图找相似 prompt；`lexica.art/?q=<关键词>` 看完整 prompt + CFG/步数。来源：[Lexica](https://lexica.art/)
- **OpenArt.ai**（画廊+提示分析+模型信息）：探索流按风格刷；每张图附 prompt 与 checkpoint。来源：[OpenArt](https://openart.ai/)
- **Midjourney 社区 showcase**：官网 `midjourney.com` Explore 看变体学参数；或第三方 `guidesref.com` 的 SREF 库。来源：[MJ Explore(需登录)](https://www.midjourney.com/) · [GuideSref](https://guidesref.com/)
- **中文模板**：即梦"探索/提示词广场"站内浏览；小红书搜 `site:xiaohongshu.com <主题> 提示词`；B站搜 `"<平台> 提示词 公式"`；知乎搜 `"AI 生图 提示词 模板"`。来源：[即梦资源](https://jimeng.jianying.com/features/resource/ai-art-prompt) · [中文渠道汇总](https://cubistai.app/zh/blog/best-prompt-resources)
- **Reddit/Discord**：`r/StableDiffusion`、`r/midjourney`、`r/AIArt` 每日提示词分享；官方 SD/MJ Discord 有实时提示词频道。来源：[渠道汇总](https://cubistai.app/zh/blog/best-prompt-resources)

**可复现性判据（一个模板值不值得收）：**
1. 提示词**完整可见**（非"私藏"截图）；2. 附**模型/版本/参数**（CFG、步数、采样器、LoRA）便于复现；3. 能在**同模型**跑出近似结果（跨模型别照搬，语法不同）；4. 结构**可拆解替换**（骨架+变量），而非一次性玄学串；5. 负面词/限制项与风格匹配（人像/写实/3D/动漫各不同）。来源：归纳自 [CubistAI 资源指南](https://cubistai.app/zh/blog/best-prompt-resources) 与 [text2img 负面指南](https://www.text2img.pro/?p=16496)

## 4) 负面提示词 / 质量控制惯例

- **是否还有用（2026 现状）**：经典 U-Net 扩散（SD1.5/SDXL 及 Civitai 微调）**强响应**负向词；Flow-matching/Transformer 模型（Flux 及部分蒸馏）**弱或忽略**负向词，除非管线实现 "true CFG"（ComfyUI 已支持）。来源：[text2img 2026 负面指南](https://www.text2img.pro/?p=16496)
- **Flux 官方立场**：**不支持 negative prompt**，建议"把不要的换成正向相反描述"（"no people"→"empty/deserted"；"no text"→"clean surfaces/unmarked"）。来源：[BFL 官方](https://docs.us.bfl.ai/guides/prompting_guide_t2i_negative)
- **OpenAI / DALL·E 3**：**无 negative 字段**，靠自然语言重述（"a clean table, no clutter"）。来源：[OpenAI 镜像说明](https://byapi.apifox.cn/427817652e0)
- **MJ**：用 `--no`（等效负权重 `::-0.5`），比写 "without" 更有效。来源：[GuideSref](https://guidesref.com/cheatsheet)
- **CFG / 质量词**：SDXL 比 SD1.5 更懂自然语言，**"masterpiece, 8k, ultra-detailed" 墙式堆砌已过时**；负向词应更短、更精准；CFG 不是越高越好（高 CFG=过饱和+伪影，且放大负向影响；若负向"无效"先查 CFG）。来源：[SDXL 指南](https://promptmake.net/blog/stable-diffusion-xl-prompt-guide-weights-negatives) · [text2img](https://www.text2img.pro/?p=16496)
- **常见负面词包（按品类，SD 系适用）**：
  - 人像/写实：`deformed, extra fingers, mutated hands, bad anatomy, blurry, lowres, jpeg artifacts, watermark, text, ugly, asymmetric eyes`。来源：[SDXL 指南](https://promptmake.net/blog/stable-diffusion-xl-prompt-guide-weights-negatives)
  - 3D/CG：`flat shading, low poly, noisy render, broken geometry, floating, bad normals, pixelated`（未证实统一官方，归纳自社区渲染负向惯例）
  - 动漫：`bad hands, extra digits, missing limbs, low quality, messy lineart, off-model, watermark`。来源：[text2img 动漫](https://www.text2img.pro/?p=14568)
  - 通用精简：`text, watermark, signature, low quality, blurry`（多数场景够用，别堆长串）。来源：[text2img 2026](https://www.text2img.pro/?p=16496)

### 与「提示词会过时」相关的注意事项

- **MJ v7 已废弃旧习惯**：网上大量 v5/v6 指南仍在教"8k ultrarealistic masterpiece"堆标签、依赖 `--no` 救场、一次性 prompt——Promptolis 明确称这些**已非当前最佳实践**；v7 改走 `--sref/--cref` 锚定一致性 + `--style raw` 写实。来源：[Promptolis](https://promptolis.com/blog/midjourney-v7-prompt-guide-2026)
- **SD1.5 提示词包在 SDXL 上失效**：SDXL 双编码器更懂自然语言，SD1.5 式长负向串 + `(masterpiece:1.4)` 全网堆砌反而伤画质。来源：[PromptMake](https://promptmake.net/blog/stable-diffusion-xl-prompt-guide-weights-negatives)
- **"masterpiece/8k/best quality" 类质量词在 2026 多模型已不需要**（尤其 Flux、GPT-image-1、Gemini、MJ v7），堆砌可能拖累；仅 SD 系旧 checkpoint 仍有边际收益。
- **语法跨模型不通用**：FLUX/OpenAI/Gemini 不读 `(word:1.3)`、`BREAK`、`--no` 这类 SD/MJ 语法；在错平台照搬会无效。
- **模型版本号是提示词的隐形前提**：同一平台 v6→v7、SD1.5→SDXL、Flux.1→FLUX.2 提示词写法会变；存模板务必标注模型+版本+参数，否则复现失败。
- **"中文提示词"能力随平台分化**：OpenAI/DALL·E 中文稳定、通义万相中英均可；即梦/可灵原生中文；但 SD 系原生英文权重更高，中文需靠翻译或 CLIP 兼容性（未证实在 SDXL 上中英等价）。
