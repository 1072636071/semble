# AGENTS.md

本文件供 AI 编码 Agent（openCode、CodeBuddy、华为 CodeArts、Trae 等）阅读，说明本仓库的工程技能配置。

## Agent skills

### Issue tracker

本仓库的 issue 与 PRD 以本地 markdown 形式存放于仓库 `.scratch/` 下，不使用远程 tracker。参见 `docs/agents/issue-tracker.md`。

### triage 标签

采用五种标准 triage 角色（标签字符串与角色名一致，未覆盖）：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。

### 领域文档

单一上下文布局：仓库根目录 `CONTEXT.md` + `docs/adr/`。参见 `docs/agents/domain.md`。

### 临时文件

所有临时脚本统一放在仓库 `.temp/scripts/` 下；其他临时文件（脚本输出、日志等）也要分类，放在 `.temp/` 的子目录下（如 `.temp/output/`、`.temp/logs/`），保证仓库根目录干净。
