---
name: jxx-setup-matt-pocock-skills
description: 为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局。首次使用其他工程技能前运行一次。
---

# Setup Matt Pocock Skills

为仓库搭建工程技能所依赖的配置：issue tracker（本地 markdown，存放在 `.scratch/` 下）、triage 标签（五个标准角色所用的标签字符串）、领域文档（`CONTEXT.md` 和 ADR 的存放位置及消费者规则）。

这是提示驱动的技能，而非确定性脚本。先探索、展示发现、与用户确认，然后写入。

## 默认配置

若用户说"全部默认"/"用默认"/"直接按默认来"，跳过逐一询问，直接套用：

- Issue tracker — 本地 markdown（`.scratch/` 下）。
- triage 标签 — 每个角色字符串等于其名称。
- 领域文档 — 单一上下文（根目录 `CONTEXT.md` + `docs/adr/`）。
- 写入目标 — 两者都不存在时创建 `AGENTS.md`，不另行询问。

## Guidelines

- 探索仓库以了解初始状态。读取 `AGENTS.md` 和 `CLAUDE.md`（是否存在？是否有 `## Agent skills` 部分？）、`CONTEXT.md` 和 `CONTEXT-MAP.md`、`docs/adr/` 和 `src/*/docs/adr/`、`docs/agents/`、`.scratch/`。不要假设。
- 展示发现并逐一引导用户完成三个决策——展示一个部分，获取回答，再进入下一个。不要一次性抛出三个。假设用户不了解术语，每个部分以简短说明开始。
- 部分 A — Issue tracker：本仓库固定使用本地 markdown（`.scratch/` 下），无需让用户选择远程 tracker。
- 部分 B — triage 标签词汇表：五个标准角色（`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`）。默认每个角色字符串等于其名称。询问用户是否要覆盖任何标签。
- 部分 C — 领域文档：确认布局——单一上下文（根目录 `CONTEXT.md` + `docs/adr/`）或多上下文（根目录 `CONTEXT-MAP.md` 指向各上下文）。
- 确认并编辑：向用户展示草稿（`## Agent skills` 块、`docs/agents/*.md` 内容），让用户在写入前编辑。
- 写入：若 `CLAUDE.md` 存在则编辑它，否则若 `AGENTS.md` 存在则编辑它，若都不存在默认创建 `AGENTS.md`。当 `CLAUDE.md` 已存在时永远不要创建 `AGENTS.md`。若已存在 `## Agent skills` 块，就地更新而非追加重复块。
- 完成：告知用户设置已完成，以及哪些工程技能现在会读取这些文件。提及他们之后可直接编辑 `docs/agents/*.md`。

## Agent skills 块

```markdown
## Agent skills

### Issue tracker

[一行概述 issue 跟踪位置——本仓库为本地 markdown（`.scratch/` 下）]。参见 `docs/agents/issue-tracker.md`。

### triage 标签

[一行概述标签词汇表]。参见 `docs/agents/triage-labels.md`。

### 领域文档

[一行概述布局——"单一上下文"或"多上下文"]。参见 `docs/agents/domain.md`。
```

## References

- [issue-tracker-local.md](./issue-tracker-local.md) — 本地 markdown issue tracker 种子模板。
- [triage-labels.md](./triage-labels.md) — 标签映射种子模板。
- [domain.md](./domain.md) — 领域文档消费者规则 + 布局种子模板。
