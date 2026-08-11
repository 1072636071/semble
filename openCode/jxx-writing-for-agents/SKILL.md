---
name: jxx-writing-for-agents
description: 为 agent 编写文档的参考——AGENTS.md、README、skill、issue 描述。当用户要求编写、评审或改进 agent 要读取的文档时加载；当用户询问 harness 如何读取指令时也会触发。
---

# 为 agent 写作

写给 agent 的文档不是写给人看的。它是加载进 context、塑造每次后续输出的文本。

## Context pointer

指向已有内容的指针：链接、文件路径、文档中的一节。写到一半发现内容别处已有——别复制。判断它是否参与当前讨论：参与则 inline 包含；不参与则 pointer 指向。指针只给坐标，不携带信息。

## 两种 load

每个 pointer、每段文字都有成本：

- Context load — 文本占用的上下文窗口。窗口有限，超了输出就退化。inline 文本永久消耗。
- Cognitive load — 要记住的链接数量。agent 会可靠跟随指针——只要它知道指针存在。指针本身也占窗口。

Cognitive load 在 system prompt 就已付了：harness 指令、常驻文件、工具描述。写文档时把这些当作"既定条件"来设计。

## 信息层级

文档被组装进 harness 的大结构，与周围一切竞争注意力：

- system prompt — 总是加载。harness 的领地。
- 常驻指令文件 — 总是加载。`CLAUDE.md`/`AGENTS.md`/`GEMINI.md`。内容永远占 context load——保持一句陈述 + 指针。
- 技能 — 条件加载。正文只在调用时加载，常驻成本只有 description 一行。
- 用户消息 — 总是加载。当前任务，优先级最高。

结构不变：每个文档要么总是加载，要么条件加载。

## Leading word

嵌入文本中的词，让你一提及它就浮现。模型自主运行时它看到的唯一文本是 description——大多数 harness 会把技能列表连同 description 注入 system prompt。把 leading word 嵌进 description。独一无二的词成为句柄，模型主动触达；通用词则淹没在其他指针里。

## Pruning

删你已经写下的内容。草稿读完，每句都要挣得自己的位置：

- 指针比 inline 便宜——指向而非复制，除非内容参与讨论。
- description 是说明器的指针——更窄、更便宜。
- 之后总能补内容，但无法收回模型已读过的文本。

两个视角决定一句话去留：

- 谁在读 — agent 读说明器（要细节），人读描述（要知道何时调用）。
- 它要存多久 — 持久的上下文值得占空间；临时的要么删，要么移到可消亡处。

## 写作检查清单

- 每个 pointer 都有 leading word——独一无二，非通用词。
- description 写给人，正文写给 agent。
- 没有复制别处的段落——inline 或 pointer，没有第三选项。
- 常驻文件只有一句话 + 一个指针。
- 每句都挣得位置——无法辩护就删。

## References

- [SKILL-MECHANICS.md](SKILL-MECHANICS.md) — 技能专用机制（frontmatter、调用方式、router skill）。
