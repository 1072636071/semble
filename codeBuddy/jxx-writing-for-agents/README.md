# jxx-writing-for-agents

为 agent 编写文档的参考——AGENTS.md、README、skill、issue 描述。写给 agent 的文档不是写给人看的，它是加载进 context、塑造每次后续输出的文本。

## 何时使用

- 要求编写、评审或改进 agent 要读取的文档时。
- 询问 harness 如何读取指令时。
- 为 skill 写正文 / frontmatter 时。

## 核心概念

- **Context pointer** — 指向已有内容的指针；参与讨论就 inline，否则 pointer。
- **两种 load** — Context load（占窗口）与 Cognitive load（要记住的链接数）。
- **Leading word** — 嵌入 description 的独特触发词，让模型一提及就浮现。
- **Pruning** — 删已写下的内容，每句挣得自己的位置。

## 相关文档

- `SKILL-MECHANICS.md` — skill 专用机制（frontmatter、调用方式、router skill）
