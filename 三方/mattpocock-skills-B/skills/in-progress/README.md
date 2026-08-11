# In Progress（进行中）

Beta 版。这些技能是有意公开的——试试它们，告诉我哪里坏了。它们被排除在插件和顶层 README 之外，直到毕业到一个稳定的桶；它们没有文档页面，并且可能在没有警告的情况下改变或消失。

插件不会给你这些。直接安装一个：

```bash
npx skills@latest add mattpocock/skills --skill=<name>
```

- **[loop-me](./loop-me/SKILL.md)** — 在多个会话中把你访谈成可实现的工作流规格，使用当前目录作为有状态的工作空间。用户调用。
- **[writing-beats](./writing-beats/SKILL.md)** — 把一篇文章塑造成一组节拍的旅程，选择你自己的冒险风格。挑选一个起始节拍，只写那个节拍，然后转向下一个，直到文章达到自然的结尾。
- **[writing-fragments](./writing-fragments/SKILL.md)** — 访谈会话，挖掘你的碎片——异质的写作金块——并把它们追加到单个文档中，作为未来文章的原始素材。
- **[writing-shape](./writing-shape/SKILL.md)** — 拿一份原始素材的 markdown 文件，一段一段地把它塑造成一篇文章，在每一步论证格式选择。
- **[claude-handoff](./claude-handoff/SKILL.md)** — 把当前对话交接给一个立即接手工作的全新后台 agent，用 `claude --bg` 以交接摘要播种。用户调用。
- **[setup-ts-deep-modules](./setup-ts-deep-modules/SKILL.md)** — 将 dependency-cruiser 接入 TypeScript 仓库，使每个包都是深模块——实现隐藏在子文件夹中，只能通过其入口文件访问，测试通过它们锻炼它。用户调用。
