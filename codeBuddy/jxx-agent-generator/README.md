# jxx-agent-generator

按"姜姓身份 + 统一 frontmatter + 既有写作风格"生成或改造 CodeBuddy agent 文件。产物为 `~/.codebuddy/agents/名字.md`。

## 何时使用

- 用户要**新建**一个 agent。
- 用户要**改造**现有 agent（加身份、改定位、调风格）。
- 用户要**统一一批 agent** 的命名、frontmatter、写作规范。

## 工作流

1. 从用户描述反推 agent 定位（职责类型 / 交付物 / 触发词 / 是否改造）。
2. 选句式（具体事务型 A / 审查判断型 B）+ 组装 frontmatter。
3. 按模板写正文（身份开场 → 定位 → 核心方法 → 护栏 → 反模式 → 输出规范 → 工作流集成 → 异常处理）。
4. 写入 `~/.codebuddy/agents/` 并回读校验。

## 参考资源

- `references/frontmatter.md` — frontmatter 字段逐项约定
- `references/identity.md` — 姜姓身份模板 + 写作规范
- `references/examples.md` — 9 个姜姓 agent 范例摘要
- `references/agent-examples/` — 9 个已完成 agent 的完整文件，可直接复用
