# 编号/报告/模板类技能合集

**Status:** done

**Blocked by:** 01

**构建内容：** 为编号、报告渲染、模板实例化类技能提供 `.mjs` CLI：to-spec / to-tickets（`.scratch/`/issues 的 `<NN>` 全局递增、slug、阻塞边 `Blocked by:` 文本行、依赖排序）、agent-generator（frontmatter 组装、命名正则校验、落盘/改名单）、research 严谨模式（`{前缀}-{slug}-{版本}` 文件名分配 + 模板骨架实例化 + 冲突加序号）、improve-codebase-architecture（结构化候选 → 自包含 HTML 报告 + 临时目录 + 跨平台打开）、design-system（预设主题实例化 + primary 兜底）、impeccable 的 document token 提取与 audit 计分。复用共享工具层（next-seq / render-template / report-html）。

**验收标准：**

- [ ] 各技能对应 `.mjs` CLI 可跑，编号/序号/文件名冲突逻辑在 fixture 上正确
- [ ] HTML 报告（improve-codebase-architecture）与模板实例化输出符合要求，可跨平台打开
- [ ] impeccable 的 document token 提取与 audit 计分脚本化（此为本技能最大空白），`node:test` 覆盖
- [ ] 各技能 SKILL.md 命令引用更新为 `node`

## 评论

- [2026-08-27] audit-js 核查：验收标准逐项结论（4/4 满足），验证方式（`base/scripts/issue-flow.mjs` 覆盖 to-spec/to-tickets/resolve-block 的 `.scratch/` 全局递增编号/slug/Blocked by 规范化/依赖拓扑排序；`base/scripts/report-flow.mjs` 覆盖 report-html（improve-codebase-architecture 自包含 HTML 可跨平台打开）、agent-init（agent-generator frontmatter 命名正则校验落盘）、research-file（`{前缀}-{slug}-{版本}` 冲突加序号）、impeccable-extract/impeccable-audit（document token 提取 + 5 维 0-4 计分 /20 评级 + WCAG 对比度 + P0-P3 严重度排序）；`issue-flow.test.mjs`/`report-flow.test.mjs` 覆盖各函数且 `node --test` 全绿（135 项含）；各技能 SKILL.md 命令引用均已更新为 `node base/scripts/*.mjs`），判定为已完成第一轮开发，待代码审查。

（评论与对话历史追加于此，新内容置于最前。）
