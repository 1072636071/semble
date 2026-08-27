# 脚手架类技能合集

**Status:** done

**Blocked by:** 01

**构建内容：** 为确定性最高的脚手架类技能提供 `.mjs` CLI：setup-matt-pocock（AGENTS.md↔CODEBUDDY.md 逐字节一致同步 + 三份 `docs/agents/*.md` 模板实例化 + 文件选择互斥规则）、grill-with-memorial（NNN 递增编号、slug、目录脚手架、context.md 模板、C1–C5 checklist、归档移动）、scaffold-exercises（计划 → 练习目录/readme 树）、setup-pre-commit（读 lock 判包管理器 → 生成 `.husky/pre-commit`/`.lintstagedrc`/`.prettierrc` + 校验）。均复用共享工具层，`node:test` + fixture 可测。

**验收标准：**

- [ ] 各技能对应 `.mjs` CLI 可跑，在 fixture 上生成确定性文件树/内容
- [ ] setup-matt-pocock 双文件逐字节一致；memorial 编号/归档/checklist 正确；scaffold/pre-commit 脚手架与异常处理符合各 SKILL.md
- [ ] 各技能 SKILL.md 命令引用更新为 `node`；`node:test` 覆盖

## 评论

- [2026-08-27] audit-js 核查：验收标准逐项结论（3/3 满足），验证方式（`base/scripts/scaffold.mjs` 提供 memorial-init/memorial-archive（grill-with-memorial 的 NNN 递增编号/slug/目录脚手架/context.md/C1–C5 checklist/归档）、scaffold-exercises（exercises/XX-section/XX.YY-exercise 目录树）、setup-precommit（lock 检测包管理器 + 生成 .husky/pre-commit/.lintstagedrc/.prettierrc）；setup-matt-pocock 迁移至技能自含 `scripts/setup.mjs`（detect/sync-doc 双文件逐字节一致 + docs/agents 模板实例化）；`scaffold.test.mjs`（135 项全绿）与 `setup.test.mjs`（15 项全绿）覆盖 fixture 确定性产物；四个技能 SKILL.md 命令引用均已更新为 `node`），判定为已完成第一轮开发，待代码审查。

（评论与对话历史追加于此，新内容置于最前。）
