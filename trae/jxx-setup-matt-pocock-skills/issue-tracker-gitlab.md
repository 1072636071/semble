# Issue tracker: GitLab

此仓库的 issue 和 PRD 存放在 GitLab Issues 中。所有操作使用 [`glab`](https://gitlab.com/gitlab-org/cli) CLI。

## 约定

- **创建 issue**: `glab issue create --title "..." --description "..."`。多行描述使用 heredoc。传入 `--description -` 打开编辑器。
- **读取 issue**: `glab issue view <number> --comments`。使用 `-F json` 获取机器可读输出。
- **列出 issue**: `glab issue list -F json`，配合适当的 `--label` 过滤器。
- **评论 issue**: `glab issue note <number> --message "..."`。GitLab 将评论称为"notes"。
- **添加/移除标签**: `glab issue update <number> --label "..."` / `--unlabel "..."`。多个标签可用逗号分隔或重复标志。
- **关闭**: `glab issue close <number>`。`glab issue close` 不接受关闭评论，因此先用 `glab issue note <number> --message "..."` 发布说明，然后关闭。
- **Merge request**: GitLab 将 PR 称为"merge request"。使用 `glab mr create`、`glab mr view`、`glab mr note` 等——与 `gh pr ...` 形状相同，用 `mr` 替代 `pr`，用 `note`/`--message` 替代 `comment`/`--body`。

从 `git remote -v` 推断仓库——`glab` 在 clone 内运行时自动完成。

## Merge request 作为 triage 渠道

**MR 作为请求渠道: 否。** _(如果此仓库将外部 MR 视为功能请求，设为 `yes`；`/jxx-triage` 读取此标志。)_

设为 `yes` 时，MR 使用与 issue 相同的标签和状态，使用 `glab mr` 等价命令：

- **读取 MR**: `glab mr view <number> --comments` 和 `glab mr diff <number>` 获取 diff。
- **列出待 triage 的外部 MR**: `glab mr list -F json`，仅保留作者不是项目成员/所有者的 MR（贡献者的 MR，而非维护者进行中的工作）。
- **评论/标签/关闭**: `glab mr note`、`glab mr update --label`/`--unlabel`、`glab mr close`。

与 GitHub 不同，GitLab 的 issue 和 MR 编号是分开的，因此 `#42` 在确定所指表面后是明确的。

## 当技能说"发布到 issue tracker"时

创建一个 GitLab issue。

## 当技能说"获取相关工单"时

运行 `glab issue view <number> --comments`。

## Wayfinding 操作

由 `/jxx-wayfinder` 使用。**地图**是一个 issue，**子工单**作为其子 issue。

- **地图**: 一个标记为 `wayfinder:map` 的 issue，包含笔记/已做决策/迷雾正文。`glab issue create --label wayfinder:map`。（在有原生 epic 的 GitLab 版本上，epic 可代替地图；标记 issue 在所有版本都可用。）
- **子工单**: 在描述顶部携带 `Part of #<map>` 并带有标签 `wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）的 issue。认领后，将工单分配给驱动的开发者。
- **阻塞**: GitLab 的**原生阻塞链接**——规范的、UI 可见的表示。通过 `/blocked_by #<n>` 快速操作添加，作为 note 发布（`glab issue note <child> --message "/blocked_by #<blocker>"`）。原生阻塞链接是 Premium/Ultimate 功能；在免费版（或不可用时）回退到描述顶部的 `Blocked by: #<n>, #<n>` 行。当所有阻塞者都关闭时，工单解除阻塞。
- **前沿查询**: `glab issue list -F json` 限定为地图的子工单，排除有开放阻塞者——原生 `blocked_by` 链接到开放 issue（`glab api projects/:id/issues/:iid/links`），或 `Blocked by` 行中有开放 issue——或有指派人的工单；按地图顺序第一个胜出。
- **认领**: `glab issue update <n> --assignee @me`——会话的首次写入。
- **解决**: `glab issue note <n> --message "<answer>"`，然后 `glab issue close <n>`，然后将上下文指针（gist + 链接）追加到地图的已做决策中。
