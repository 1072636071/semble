---
name: jxx-t2i-prompts
description: 文生图提示词模板库与组稿流程。当用户要文生图提示词、画图提示词、按平台改组稿时触发。触发词：文生图、提示词、AI 绘画、出图。
disable-model-invocation: false
---

<!--en-->
# jxx-t2i-prompts

Turn "write me an image prompt" into "load a template, fill the slots, save what worked".

## Workflow

1. **Pick the platform** — read `references/platforms.md`, take only that platform's syntax row. Never mix weight syntaxes across platforms.
2. **Check the library first** — `node <skill>/scripts/prompt-lib.mjs list`, then `show <id>`. A hit needs category and tags to match, not just a keyword.
3. **No hit → search** — follow the channel recipes in `references/sourcing.md` (site-specific queries, not "just google it"), then screen candidates with its acceptance rules. Keep 1-3.
4. **Assemble** — use the eight-slot skeleton in `references/framework.md`. Every slot filled with concrete words; at most one empty adjective per slot.
5. **Harvest** — when the user approves a result or the same prompt yields 3+ usable images, save it: `new` → fill → `add`. Format and rules: `references/harvest-protocol.md`. Every write to the global library is auto-mirrored into `<project>/.scratch/t2i-prompts/` so the template travels with the repo; `check` reports drift.

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

agent 只写全局库（`~/.agents/t2i-prompts/`，`T2I_PROMPT_HOME` 可改），不改内置库。`add` 会拦缺字段、id 冲突、示例过短。

**改完全局库必须在当前项目留一份**：`add` / `copy` 会自动把它镜像到 `<项目根>/.scratch/t2i-prompts/`（cwd 向上找 `.git` 或 `AGENTS.md` 定根），并重建项目 `index.md`。全局库不在仓库里，换机器、换人、review 都看不见；项目副本随代码提交，能评审能回滚。项目无 `.scratch` 约定就 `--project-home <dir>`；只补镜像用 `mirror`；`check` 会报两边不一致的文件。

## 底线

- 示例必须能整段复制投喂，不留占位符。
- 全局库改完必留项目副本（`add` 自动镜像，`check` 验一致）；只写全局库视为没落地。
- 不写已经没人用的质量词（`masterpiece`、`8k` 一类）——先看平台段确认还吃不吃。
- 每条模板带出处、`verified` 日期、模型 + 版本 + 关键参数；过期语法重写，不照抄。
- 模型排不好文字：海报只要留白，文字后期。

## 内置模板

27 条，按题材分族：**国风 5**（3D 国风 / 唐 / 宋 / 旗袍 / 仙侠）、**写实写真 12**（摄影 / 现代去网红脸 / 街拍 / 日系胶片 / 韩系 Y2K / 婚纱 / 3D 瓷感 / 时尚大片 / 美妆特写 / 商业头像 / 赛博霓虹 / 复古胶片）、**角色 3D 3**（游戏 CG / 写实三视图 / 赛博潮玩 IP）、**插画 4**（厚涂 / 头像 / 治愈系 / niji）、**产品 / 场景 / 海报 3**。

挑模板看 [references/templates/index.md](references/templates/index.md)（按题材一张表），或直接 `prompt-lib.mjs list`。每条都有中文示例 + 英文版示例 + 负面 + 调参备注 + 来源。
