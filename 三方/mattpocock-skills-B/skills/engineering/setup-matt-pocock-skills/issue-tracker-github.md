# Issue 跟踪器：GitHub

本仓库的 issue 和规格以 GitHub issue 形式存在。所有操作使用 `gh` CLI。

## 约定

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **读取 issue**：`gh issue view <number> --comments`，用 `jq` 过滤评论并获取标签。
- **列出 issues**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，带合适的 `--label` 和 `--state` 过滤器。
- **评论 issue**：`gh issue comment <number> --body "..."`
- **应用 / 移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：`gh issue close <number> --comment "..."`

从 `git remote -v` 推断仓库——在克隆内运行时 `gh` 会自动这样做。

## Pull request 作为分流表面

**PR 作为请求表面：否。** _（如果本仓库把外部 PR 视为功能请求，设置为 `yes`；`/triage` 读取此标志。）_

设置为 `yes` 时，PR 使用与 issue 相同的标签和状态运行，使用 `gh pr` 对应命令：

- **读取 PR**：`gh pr view <number> --comments` 以及 `gh pr diff <number>` 获取 diff。
- **列出要分流的外部 PR**：`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` 然后只保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的（丢弃 `OWNER`/`MEMBER`/`COLLABORATOR`）。
- **评论 / 标签 / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 在 issue 和 PR 之间共享一个编号空间，所以一个裸 `#42` 可能是两者——用 `gh pr view 42` 解析，回退到 `gh issue view 42`。

## 当技能说"发布到 issue 跟踪器"

创建一个 GitHub issue。

## 当技能说"获取相关工单"

运行 `gh issue view <number> --comments`。

## Wayfinding 操作

由 `/wayfinder` 使用。**地图**是单个 issue，**子** issue 作为工单。

- **地图**：单个标记为 `wayfinder:map` 的 issue，持有 Notes / Decisions-so-far / Fog 正文。`gh issue create --label wayfinder:map`。
- **子工单**：作为 GitHub 子 issue 链接到地图的 issue（在子 issue 端点上用 `gh api`）。在子 issue 不可用时，把子项添加到地图正文中的任务列表，并在子正文顶部放 `Part of #<map>`。标签：`wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。一旦被认领，工单分配给驱动开发。
- **阻塞**：GitHub 的**原生 issue 依赖**——规范的、UI 可见的表示。用 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 添加一条边，其中 `<blocker-db-id>` 是阻塞者的数字**数据库 id**（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`，_不是_ `#number` 或 `node_id`）。GitHub 报告 `issue_dependencies_summary.blocked_by`（仅打开阻塞者——活的门）。在依赖不可用之处，回退到子正文顶部的 `Blocked by: #<n>, #<n>` 行。当每个阻塞者都关闭时，工单未阻塞。
- **前沿查询**：列出地图的打开子项（`gh issue list --state open`，限定在地图的子 issue / 任务列表中），丢弃任何有打开阻塞者（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行中的打开 issue）或有分配者的；地图顺序中第一个获胜。
- **认领**：`gh issue edit <n> --add-assignee @me` —— 会话的第一次写入。
- **解决**：`gh issue comment <n> --body "<answer>"`，然后 `gh issue close <n>`，然后在地图的 Decisions-so-far 中追加一个上下文指针（摘要 + 链接）。
