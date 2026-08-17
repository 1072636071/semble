# 编号/报告/模板类技能合集

**Status:** ready-for-agent

**Blocked by:** 01

**构建内容：** 为编号、报告渲染、模板实例化类技能提供 `.mjs` CLI：to-spec / to-tickets（`.scratch/`/issues 的 `<NN>` 全局递增、slug、阻塞边 `Blocked by:` 文本行、依赖排序）、agent-generator（frontmatter 组装、命名正则校验、落盘/改名单）、research 严谨模式（`{前缀}-{slug}-{版本}` 文件名分配 + 模板骨架实例化 + 冲突加序号）、improve-codebase-architecture（结构化候选 → 自包含 HTML 报告 + 临时目录 + 跨平台打开）、design-system（预设主题实例化 + primary 兜底）、impeccable 的 document token 提取与 audit 计分。复用共享工具层（next-seq / render-template / report-html）。

**验收标准：**

- [ ] 各技能对应 `.mjs` CLI 可跑，编号/序号/文件名冲突逻辑在 fixture 上正确
- [ ] HTML 报告（improve-codebase-architecture）与模板实例化输出符合要求，可跨平台打开
- [ ] impeccable 的 document token 提取与 audit 计分脚本化（此为本技能最大空白），`node:test` 覆盖
- [ ] 各技能 SKILL.md 命令引用更新为 `node`

## 评论

（评论与对话历史追加于此，新内容置于最前。）