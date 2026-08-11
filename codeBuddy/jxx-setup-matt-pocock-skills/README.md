# jxx-setup-matt-pocock-skills

为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局。首次使用其他工程技能前运行一次。

## 何时使用

- 第一次在仓库运行工程流程（实现、审查、triage、领域建模）之前。
- 现有配置缺失或需要重新初始化时。

## 配置内容

- **Issue tracker** — 本地 markdown（`.scratch/` 下）
- **triage 标签** — 五个标准 triage 角色所使用的标签字符串
- **领域文档** — `CONTEXT.md` 和 ADR 的存放位置与消费者规则

## 流程

1. 探索仓库当前状态（AGENTS.md / CONTEXT.md / docs / .scratch）。
2. 展示发现并逐项确认（A. Issue tracker / B. triage 标签 / C. 领域文档）。
3. 确认并编辑草稿。
4. 写入 `AGENTS.md`（或 `CLAUDE.md`）+ `docs/agents/*.md`。
5. 告知用户哪些工程技能现在会读取这些文件。

## 依赖技能

被配置后读取 `docs/agents/` 的技能：`jxx-to-tickets`、`jxx-triage`、`jxx-to-spec`、`jxx-grill-with-docs`、`jxx-domain-modeling`、`jxx-code-review` 等。
