# Issue 跟踪器：GitLab

本仓库的 issue 和规格以 GitLab issue 形式存在。所有操作使用 [`glab`](https://gitlab.com/gitlab-org/cli) CLI。

## 约定

- **创建 issue**：`glab issue create --title "..." --description "..."`。多行描述使用 heredoc。传 `--description -` 打开编辑器。
- **读取 issue**：`glab issue view <number> --comments`。用 `-F json` 获取机器可读输出。
- **列出 issues**：`glab issue list -F json`，带合适的 `--label` 过滤器。
- **评论 issue**：`glab issue note <number> --message "..."`。GitLab 称评论为"notes"。
- **应用 / 移除标签**：`glab issue update <number> --label "..."` / `--unlabel "..."`。多个标签可以逗号分隔或重复标志。
- **关闭**：`glab issue close <number>`。`glab issue close` 不接受关闭评论，所以先用 `glab issue note <number> --message "..."` 发布解释，然后关闭。
- **Merge request**：GitLab 称 PR 为"merge requests"。使用 `glab mr create`、`glab mr view`、`glab mr note` 等——与 `gh pr ...` 相同的形态，把 `pr` 换成 `mr`、`comment`/`--body` 换成 `note`/`--message`。

从 `git remote -v` 推断仓库——在克隆内运行时 `glab` 会自动这样做。

## Merge request 作为分流表面

**MR 作为请求表面：否。** _（如果本仓库把外部 merge request 视为功能请求，设置为 `yes`；`/triage` 读取此标志。）_

设置为 `yes` 时，MR 使用与 issue 相同的标签和状态运行，使用 `glab mr` 对应命令：

- **读取 MR**：`glab mr view <number> --comments` 以及 `glab mr diff <number>` 获取 diff。
- **列出要分流的外部 MR**：`glab mr list -F json`，然后只保留作者不是项目成员/所有者的 MR（一个贡献者的 MR，而不是维护者的进行中工作）。
- **评论 / 标签 / 关闭**：`glab mr note`、`glab mr update --label`/`--unlabel`、`glab mr close`。

与 GitHub 不同，GitLab 对 issue 和 MR 分别编号，所以一旦你知道维护者指的是哪个表面，`#42` 就是明确的。

## 当技能说"发布到 issue 跟踪器"

创建一个 GitLab issue。

## 当技能说"获取相关工单"

运行 `glab issue view <number> --comments`。

## Wayfinding 操作

由 `/wayfinder` 使用。**地图**是单个 issue，**子** issue 作为工单。

- **地图**：单个标记为 `wayfinder:map` 的 issue，持有 Notes / Decisions-so-far / Fog 正文。`glab issue create --label wayfinder:map`。（在带有原生 epics 的 GitLab 层级上，一个 epic 可能持有地图；一个带标签的 issue 在任何地方都有效。）
- **子工单**：一个在描述顶部携带 `Part of #<map>`、带标签 `wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）的 issue。一旦被认领，工单分配给驱动开发。
- **阻塞**：GitLab 的**原生阻塞链接**——规范的、UI 可见的表示。用 `/blocked_by #<n>` 快速操作添加它，作为 note 发布（`glab issue note <child> --message "/blocked_by #<blocker>"`）。原生阻塞链接是 Premium/Ultimate 功能；在免费层级（或不可用时）回退到描述顶部的 `Blocked by: #<n>, #<n>` 行。当每个阻塞者都关闭时，工单未阻塞。
- **前沿查询**：`glab issue list -F json` 限定在地图的子项中，丢弃任何有打开阻塞者——一个指向打开 issue 的原生 `blocked_by` 链接（`glab api projects/:id/issues/:iid/links`），或 `Blocked by` 行中的打开 issue——或有分配者的；地图顺序中第一个获胜。
- **认领**：`glab issue update <n> --assignee @me` —— 会话的第一次写入。
- **解决**：`glab issue note <n> --message "<answer>"`，然后 `glab issue close <n>`，然后在地图的 Decisions-so-far 中追加一个上下文指针（摘要 + 链接）。
