# Issue tracker: GitHub

此仓库的 issue 和 PRD 存放在 GitHub Issues 中。所有操作使用 `gh` CLI。

## 约定

- **创建 issue**: `gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **读取 issue**: `gh issue view <number> --comments`，通过 `jq` 过滤评论并获取标签。
- **列出 issue**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，配合适当的 `--label` 和 `--state` 过滤器。
- **评论 issue**: `gh issue comment <number> --body "..."`
- **添加/移除标签**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**: `gh issue close <number> --comment "..."`

从 `git remote -v` 推断仓库——`gh` 在 clone 内运行时自动完成。

## Pull request 作为 triage 渠道

**PR 作为请求渠道: 否。** _(如果此仓库将外部 PR 视为功能请求，设为 `yes`；`/jxx-triage` 读取此标志。)_

设为 `yes` 时，PR 使用与 issue 相同的标签和状态，使用 `gh pr` 等价命令：

- **读取 PR**: `gh pr view <number> --comments` 和 `gh pr diff <number>` 获取 diff。
- **列出待 triage 的外部 PR**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，仅保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的记录（排除 `OWNER`/`MEMBER`/`COLLABORATOR`）。
- **评论/标签/关闭**: `gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 issue 和 PR 共享同一编号空间，因此裸 `#42` 可能是任一类型——先用 `gh pr view 42` 尝试，失败则回退到 `gh issue view 42`。

## 当技能说"发布到 issue tracker"时

创建一个 GitHub issue。

## 当技能说"获取相关工单"时

运行 `gh issue view <number> --comments`。

## Wayfinding 操作

由 `/jxx-wayfinder` 使用。**地图**是一个 issue，**子工单**作为其子 issue。

- **地图**: 一个标记为 `wayfinder:map` 的 issue，包含笔记/已做决策/迷雾正文。`gh issue create --label wayfinder:map`。
- **子工单**: 作为 GitHub sub-issue 链接到地图的 issue（通过 `gh api` 调用 sub-issues 端点）。未启用 sub-issues 时，将子工单添加到地图正文的任务列表中，并在子工单正文顶部放置 `Part of #<map>`。标签: `wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。认领后，将工单分配给驱动的开发者。
- **阻塞**: GitHub 的**原生 issue 依赖**——规范的、UI 可见的表示。通过 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 添加边，其中 `<blocker-db-id>` 是阻塞者的数字**数据库 id**（`gh api repos/<owner>/<repo>/issues/<n> --jq .id`，_不是_ `#number` 或 `node_id`）。GitHub 报告 `issue_dependencies_summary.blocked_by`（仅开放阻塞者——实时门控）。依赖不可用时，回退到子工单正文顶部的 `Blocked by: #<n>, #<n>` 行。当所有阻塞者都关闭时，工单解除阻塞。
- **前沿查询**: 列出地图的开放子工单（`gh issue list --state open`，限定为地图的 sub-issues / 任务列表），排除有开放阻塞者（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行中有开放 issue）或有指派人的工单；按地图顺序第一个胜出。
- **认领**: `gh issue edit <n> --add-assignee @me`——会话的首次写入。
- **解决**: `gh issue comment <n> --body "<answer>"`，然后 `gh issue close <n>`，然后将上下文指针（gist + 链接）追加到地图的已做决策中。
