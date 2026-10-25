# 无模板时怎么搜

库里没有命中，不要凭空编——按渠道找现成的，再按判据筛。访问日期 2026-10-21。

## 三步流程

1. **定渠道**：先官方（语法权威），再社区模板站（完整 prompt + 参数），最后社媒（新玩法、中文模板）。
2. **用配方搜**：下表每条都是可执行 URL 或站内查询串，不是「去搜索引擎找找」。
3. **验证再收**：候选在目标平台跑 2 张，能复现才收（判据见文末）。

## 渠道与查询配方

### 官方文档（先定语法）

| 平台 | 找什么 | 入口 |
| --- | --- | --- |
| Midjourney | 参数表、参考图用法 | [参数速查](https://guidesref.com/cheatsheet) · [Style Reference](https://docs.midjourney.com/hc/en-us/articles/32180011136653-Style-Reference) |
| Flux | 提示词骨架、无负面词写法 | [FLUX.2 指南](https://docs.bfl.ml/guides/prompting_guide_flux2) · [负面词替代](https://docs.us.bfl.ai/guides/prompting_guide_t2i_negative) |
| SDXL / SD 3.5 | 权重、BREAK、反向词 | [语法说明](https://docs.dreamerland.ai/basic-terms/sd-prompt-syntax) |
| OpenAI 图像 | 导演 brief 式写法 | [Image prompting](https://developers.openai.com/api/docs/guides/image-prompting) |
| Gemini / Nano Banana | 编辑式指令、多图参考 | [官方博客](https://developers.googleblog.com/en/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/) |
| 通义万相 | 双公式 + 中文词典 | [官方指南](https://help.aliyun.com/zh/model-studio/text-to-image-prompt) |
| 可灵 | 五段式中文公式 | [官方公式页](https://klingai.com/quickstart/ai-image-prompt-formula) |
| 即梦 | 中文提示资源 | [即梦资源页](https://jimeng.jianying.com/features/resource/ai-art-prompt) |

### 社区模板站（拿完整 prompt + 采样参数）

| 站点 | 怎么用 | 入口 |
| --- | --- | --- |
| Civitai | 站内搜模型 → 模型页 Images 点开每张图看完整 prompt 与参数（最真实的一手数据，只对同 checkpoint 可复现） | `civitai.com/models?query=<风格>` |
| PromptHero | 跨平台（SD/MJ/DALL·E）按模型筛 | `prompthero.com/search?q=<主题>&model=stable-diffusion` |
| Lexica | SD 出图搜索引擎，图上附完整 prompt + CFG + 步数 | `lexica.art/?q=<关键词>` |
| OpenArt | 画廊 + 提示词分析 + checkpoint 标注 | [openart.ai](https://openart.ai/) |
| Midjourney Explore | 官方社区图，看变体学参数（需登录）；SREF 库另找 | [midjourney.com](https://www.midjourney.com/) |

### 中文社媒（模板密度高，质量参差）

- 即梦「探索 / 提示词广场」：站内浏览，抄到的与平台语法天然对齐。
- 小红书：`site:xiaohongshu.com <主题> 提示词`——常整段可抄。
- B 站：`<平台> 提示词 公式`——视频简介/评论区常有文本版。
- 知乎：`AI 生图 提示词 模板`——长文含模块表。
- 汇总参考：[中文渠道汇总](https://cubistai.app/zh/blog/best-prompt-resources)

### X / Reddit / Discord（新玩法先出现）

- `r/StableDiffusion`、`r/midjourney`、`r/AIArt` 每日分享帖。
- 官方 Discord 有实时提示词频道。
- 搜索串：`site:reddit.com/r/midjourney prompt <主题>`。

## 关键词配方

一条查询 = 主题词 + 平台词 + 结构词：

- 主题词：国风美女 / cyberpunk street / product photography
- 平台词：midjourney / flux / sdxl / seedream / 即梦
- 结构词：prompt template / 提示词模板 / prompt formula / 骨架

例：`国风 美女 提示词模板 即梦`、`cinematic portrait prompt template flux`。

## 验收判据（五条，过不了不收）

1. **提示词完整可见**——不是「私藏」截图或半截配文。
2. **附模型 + 版本 + 参数**（CFG、步数、采样器、LoRA）——能复现的前提。
3. **同模型能跑出近似结果**——跨模型别照搬，语法不同；跑不出来就只当骨架参考。
4. **结构可拆解替换**——骨架 + 变量，而不是一次性玄学串。
5. **负面词/限制项与品类匹配**——人像、写实、3D、动漫各有各的负面包。

## 搜不到怎么办

降级自拼：用 framework.md 的骨架 + 目标主题的通用词库，先出一版，跑两三张看偏差，按「高频失效模式」表逐项修。跑通的这一版就是新模板的来源。
