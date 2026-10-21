---
name: jxx-t2i-prompts
description: 文生图提示词模板库与组稿流程：取模板、按平台改组稿、库里没有就按渠道搜、把跑通的好模板沉淀进用户库。触发词：文生图、提示词、提示词模板、AI 绘画、画图提示词、出图、Midjourney 提示词、Flux、SDXL、即梦、Seedream、通义万相、Nano Banana、图生图。
disable-model-invocation: false
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-t2i-prompts, codebuddy, prompts, image-generation]
    description-en: |-
      1. Text-to-image prompt engineering: reuse, adapt, search and store prompt templates.
      2. Triggered by: text-to-image, prompt template, AI art prompt, Midjourney/Flux/SDXL/Seedream/即梦 prompt, 提示词, 文生图.
      3. Avoids ad-hoc prompt writing by pairing a category-indexed template library with per-platform syntax rules.
      4. Usage: pick platform syntax → load template → fill slots → search channels when missing → save verified template to the user library.
      5. Prerequisite: Node.js 18+ to run scripts/prompt-lib.mjs; library lives at ~/.agents/t2i-prompts (override with T2I_PROMPT_HOME).
  codebuddy:
    allowed-tools: [read_file, search_content, run_command]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# jxx-t2i-prompts

Turn "write me an image prompt" into "load a template, fill the slots, save what worked".

## Workflow

1. **Pick the platform** — read `references/platforms.md`, take only that platform's syntax row. Never mix weight syntaxes across platforms.
2. **Check the library first** — `node <skill>/scripts/prompt-lib.mjs list`, then `show <id>`. A hit needs category and tags to match, not just a keyword.
3. **No hit → search** — follow the channel recipes in `references/sourcing.md` (site-specific queries, not "just google it"), then screen candidates with its acceptance rules. Keep 1-3.
4. **Assemble** — use the eight-slot skeleton in `references/framework.md`. Every slot filled with concrete words; at most one empty adjective per slot.
5. **Harvest** — when the user approves a result or the same prompt yields 3+ usable images, save it: `new` → fill → `add`. Format and rules: `references/harvest-protocol.md`.

## Hard rules

- Filled example must be copy-pasteable, no placeholders left.
- Negative prompts only where the platform honors them.
- Never edit the built-in library; agents write to the user library.
- Every template carries provenance and a `verified` date; stale platform syntax gets rewritten, not copied.

## Library

- Built-in: `references/templates/` (ships with the skill).
- User: `~/.agents/t2i-prompts/` (`T2I_PROMPT_HOME` overrides).
- Commands: `list`, `search`, `show <id>`, `new <id>`, `copy <id> <new-id>`, `add <file>`, `check`, `init` — all on `scripts/prompt-lib.mjs`, zero dependencies.
<!--/en-->

# jxx-t2i-prompts

把「每次现编一段提示词」变成：取模板 → 填槽 → 无模板按渠道搜 → 把跑通的结果写回库。

## 工作流

### 第 1 步 — 定平台

读 [references/platforms.md](references/platforms.md)，只取目标平台那一段。规矩平台（Midjourney / SDXL）吃标签与参数，自然语言平台（GPT-image / 即梦 / Nano Banana）吃整句。**权重语法不跨平台混用**——这是废稿第一大来源。

完成判据：能说出该平台「吃句子还是吃标签」、负面词吃不吃的两句话。

### 第 2 步 — 先查库

```bash
node <skill>/scripts/prompt-lib.mjs list
node <skill>/scripts/prompt-lib.mjs show portrait-guofeng-3d
```

命中判据：category 对上，且 tags 至少两个对上。只有一个关键词撞上的不算命中。

### 第 3 步 — 没命中就搜

按 [references/sourcing.md](references/sourcing.md) 的渠道配方搜（每条给站点 + 站内查询串，不是「去谷歌搜一下」），按其中验收判据筛。

完成判据：留下 1-3 条候选，每条能说出出处和它为什么可信；筛不出就回第 2 步降级自拼。

### 第 4 步 — 组装与投喂

用 [references/framework.md](references/framework.md) 的八模块骨架（产品/场景/海报/二次元各有变体表）。每格填具体词，「美丽」「高级」这类空词每格最多一个。负面词只在平台吃负面词时写。

完成判据：整段提示词能直接复制到目标平台，没有占位符，没有跨平台语法。

### 第 5 步 — 沉淀

满足 [references/harvest-protocol.md](references/harvest-protocol.md) 的收录条件之一就写库：

```bash
node <skill>/scripts/prompt-lib.mjs new portrait-xxx "名字"
# 或基于内置模板 fork 一个变体：copy portrait-guofeng-3d portrait-guofeng-tang "唐风版"
# 填完
node <skill>/scripts/prompt-lib.mjs add ~/.agents/t2i-prompts/portrait-xxx.md
```

agent 只写用户库（`~/.agents/t2i-prompts/`，`T2I_PROMPT_HOME` 可改），不改内置库。`add` 会拦缺字段、id 冲突、示例过短。

## 底线

- 示例必须能整段复制投喂，不留占位符。
- 不写已经没人用的质量词（`masterpiece`、`8k` 一类）——先看平台段确认还吃不吃。
- 每条模板带出处、`verified` 日期、模型 + 版本 + 关键参数；过期语法重写，不照抄。
- 模型排不好文字：海报只要留白，文字后期。

## 内置模板

| id | 用途 |
| --- | --- |
| `portrait-guofeng-3d` | 3D 写实国风美女 |
| `portrait-photoreal` | 写实人像摄影 |
| `character-game-cg` | 游戏角色 CG / 三视图 |
| `product-commercial` | 产品商业广告 |
| `scene-cinematic` | 电影感场景 / 氛围图 |
| `illustration-anime` | 二次元插画 / 日系厚涂 |
| `poster-visual` | 海报 / 主视觉 |
