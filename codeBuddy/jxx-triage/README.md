# jxx-triage

将 issue 与 external PR 推过 triage 状态机——分类（bug / enhancement）、验证、必要时 grill，并编写 agent 可执行的简报。

## 何时使用

- 项目 issue tracker 上有传入的 issue / 外部 PR 需要处理。
- 用户说"给我看需要注意的事项""看看 #42""将 #42 移到 ready-for-agent"。

## 角色

- **分类**：`bug` / `enhancement`
- **状态**：`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`

## 流程

1. 展示需要注意的事项（未标记 / needs-triage / needs-info 有活动）。
2. triage 特定 issue：收集上下文 → 推荐 → 验证声明 → grill（如需要）→ 应用结果。
3. 支持快速状态覆盖（信任维护者指令直接应用角色）。

## 参考文档

- `AGENT-BRIEF.md` — 如何编写持久的 agent 简报
- `OUT-OF-SCOPE.md` — `.out-of-scope/` 知识库的工作方式

## 依赖

- `/jxx-grilling`、`/jxx-domain-modeling` — 需要充实时的 grill
- `/jxx-setup-matt-pocock-skills` — triage 标签词汇表配置
