# jxx-t2i-prompts

文生图提示词模板库 + 组稿流程。目标：不每次现编，取模板、填槽位、搜不到的按配方找，跑通的好模板写回库。

## 何时使用

要写文生图提示词（Midjourney / Flux / SDXL / GPT-image / 即梦 / Seedream / 通义万相 / Nano Banana），或用户说「存下这个提示词」「以后都按这个来」。

## 组成

- `references/platforms.md` — 各平台吃句子还是吃标签、权重与负面词语法。
- `references/framework.md` — 八模块骨架、各类别变体、高频失效模式。
- `references/templates/` — 7 个内置模板（国风 3D / 写实人像 / 游戏角色 / 产品 / 场景 / 二次元 / 海报）。
- `references/sourcing.md` — 无模板时的渠道 + 查询配方 + 验收判据。
- `references/harvest-protocol.md` — 好模板的收录条件与写法。
- `scripts/prompt-lib.mjs` — 零依赖库管理：list / search / show / new / copy / add / check / init。

## 产物

一段可直接复制投喂的提示词；以及用户库里新增的 `~/.agents/t2i-prompts/<id>.md` 模板条目 + 重建的 `index.md`。
