# 平台语法对照

同一段提示词换个平台就该改写。先确认三件事：**吃句子还是吃标签 / 权重怎么写 / 负面词吃不吃**。

访问日期 2026-10-21，来源以官方文档优先（链接见每节末尾）。

## 对照表

| 平台 | 输入形态 | 权重 | 负面词 | 一条经验 |
| --- | --- | --- | --- | --- |
| Midjourney v7 / niji | 自然语言短句 + 末尾参数 | `word1 ::2 word2 ::1` | `--no a, b`（等效 `::-0.5` 负权重） | v7 靠 `--sref/--cref` 锚定一致性，不靠堆质量词 |
| Flux（FLUX.2） | 自然语言长句，词序敏感 | 无结构化权重 | **官方明确不支持** | 无负面词时把「不要 X」写成「要 Y」 |
| SDXL / SD 3.5 | 标签/自然语言混合 + 双框 | `(w:1.3)`、`((w))`、`[w]`、`BREAK` | 独立反向框，仍有效但应短 | 唯一「正反向双框 + 权重」齐活的主流族 |
| GPT-image-1 / DALL·E 3 | 自然语言长描述，像导演 brief | 无 | **无 negative 字段** | 指令跟随强、能排字 |
| Gemini 2.5 Flash Image（Nano Banana） | 编辑式指令 + 多图参考 | 无 | 靠指令重述 | 强在改图与文本渲染，带 SynthID 水印 |
| 即梦 Dreamina / Seedream | 中文自然语言整句 | 弱 | 靠正向重述 | 站内「探索/提示词广场」直接抄同平台模板 |
| 通义万相（Wanx V2） | 中文结构化；官方双公式 | 弱 | **有 `negative_prompt` 独立字段** | V2 默认 `prompt_extend` 改写，效果好就别关 |
| 可灵 Kling | 中文自然语言，五问式 | 无 | 靠正向重述 | 景别运镜 + 主体 + 动作 + 场景光线 + 情绪风格 |

## 逐平台要点

### Midjourney

- 词序即权重，越靠前越重。v5/v6 时代的「8k ultrarealistic masterpiece」堆叠已是旧习惯，v7 不再是好实践。
- 一致性靠参考：`--sref <url>` 风格、`--cref <url>` 角色、`--style raw` 去修饰、`--stylize` 审美强度、`--chaos` 多样性、`--ar 3:4` 画幅。
- 排除用 `--no x,y`，比自然语言写 "without" 有效。
- 多提示词权重：`word1::2 word2::1`；`--no item` 等价 `item::-0.5`。
- 来源：[参数速查](https://guidesref.com/cheatsheet) · [v7 指南](https://promptolis.com/blog/midjourney-v7-prompt-guide-2026) · [Style Reference 官方](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference)

### Flux

- 自然语言长句，官方骨架 **Subject + Action + Style + Context**；长度分档：10–30 词短句 / 30–80 中 / 80+ 长。
- 支持 JSON 结构化提示、HEX 颜色、多参考图编辑。
- **官方不支持 negative prompt**：把「不要人物」写成 `empty, deserted`，「不要文字」写成 `clean surfaces, unmarked`。
- 来源：[FLUX.2 提示词指南](https://docs.bfl.ml/guides/prompting_guide_flux2) · [无负面词怎么写](https://docs.us.bfl.ai/guides/prompting_guide_t2i_negative)

### SDXL / SD 3.5

- `(word)` ≈ 1.1x、`((word))` ≈ 1.21x、`(word:1.3)` 精确权重、`[word]` 降权、`BREAK` 切 75-token 段。
- embedding / LoRA 的触发词要原样带，别翻译。
- 反向提示词短而准 >> 长串堆砌；SD1.5 时代的超长反向串搬到 SDXL 反而伤画质。
- CFG 不是越高越好：高 CFG 过饱和、放大伪影；负向词「没效果」先查 CFG。
- 来源：[语法说明](https://docs.dreamerland.ai/basic-terms/sd-prompt-syntax) · [权重/BREAK FAQ](https://generativelabs.com/insights/prompt-syntax-for-stable-diffusion-faq) · [SDXL 指南](https://promptmake.net/blog/stable-diffusion-xl-prompt-guide-weights-negatives)

### GPT-image-1 / DALL·E 3

- 按「导演 brief」写：说明要什么、什么必须固定、什么可以变。
- 没有 negative 字段；「不要 X」要改写成正向描述。
- 画幅写进提示词或 size 参数；中文也稳。
- 来源：[Image prompting 官方](https://developers.openai.com/api/docs/guides/image-prompting)

### Gemini 2.5 Flash Image（Nano Banana）

- 主语是「改」：原图 + 「把背景换成……，保留人物」；支持多图合成与风格迁移。
- 多图时点名每张图的角色。
- 输出带 SynthID 水印（商业用途需注意）。
- 来源：[官方提示词博客](https://developers.googleblog.com/en/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/)

### 即梦 Dreamina / Seedream

- 整句中文：主体 + 动作 + 环境 + 光线 + 风格。
- 站内「探索」广场的作品可看原文提示词，与平台语法天然对齐——优先从那里取模板。
- 支持多比例、修复/去背/扩图。
- 来源：[即梦提示资源](https://jimeng.jianying.com/features/resource/ai-art-prompt) · [图片生成 4.0 介绍](https://www.volcengine.com/docs/85621/1820192)

### 通义万相

- 官方双公式：基础 = 主体 + 场景 + 风格；进阶 = 主体 + 场景 + 风格 + 镜头语言 + 氛围词 + 细节修饰。
- 有独立 `negative_prompt` 字段；V2 默认开 `prompt_extend` 智能改写。
- 有官方中文词典（景别/视角/镜头/风格/光线），写词优先用词典里的表述。
- 来源：[官方提示词指南](https://help.aliyun.com/zh/model-studio/text-to-image-prompt)

### 可灵 Kling

- 五段式：景别与运镜 + 主体 + 具体动作 + 场景与光线 + 情绪与风格。
- 形容词换可见动作：「优雅地站着」写成「侧身回眸，一手扶栏」。
- 来源：[官方公式页](https://klingai.com/quickstart/ai-image-prompt-formula) · [五段式教程](https://c.m.163.com/news/a/L4DL3ELM0511D0T2.html)

## 换平台的改写步骤

1. 取模板的「完整示例」。
2. 判断目标平台吃句子还是标签（见对照表第一列）。
3. 标签流 → 逗号分隔、去叙述连接词；句子流 → 加连接词写成通顺描述，并按该平台官方骨架重排词序（靠前更重要）。
4. 权重语法只保留目标平台支持的写法，不支持的直接删——删掉比换写法安全。
5. 负面词：无字段的平台转成对应正面描述，或删。
6. 参数（画幅、风格参考、种子、CFG）移到该平台参数位，不留在正文。

## 过期风险清单

- **语法跨模型不通用**：`(word:1.3)`、`BREAK`、`--no` 在 Flux / OpenAI / Gemini 上无效，照搬会静默失效。
- **模型版本是隐形前提**：v6→v7、SD1.5→SDXL、Flux.1→FLUX.2 写法都变过。模板必须标模型 + 版本 + 参数，否则复现失败。
- **质量词在多数新模型上无收益**：`masterpiece, 8k, best quality` 对 Flux / GPT-image / Gemini / MJ v7 基本无用，仅部分旧 SD checkpoint 还有边际收益。
- **负向词是否有效看网络结构**：U-Net 系（SD1.5/SDXL）强响应；Flow-matching/Transformer 系（Flux）弱或忽略，除非管线实现 true CFG。
- **中文能力分化**：OpenAI 与通义万相中英都稳；即梦/可灵原生中文；SD 系原生英文更强（SDXL 上中英是否等价未证实）。
