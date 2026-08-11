# Issue 跟踪器：本地 Markdown

本仓库的 issue 和规格以 `.scratch/` 中的 markdown 文件形式存在。

## 约定

- 每个功能一个目录：`.scratch/<feature-slug>/`
- 规格是 `.scratch/<feature-slug>/spec.md`
- 实现 issue 是 `.scratch/<feature-slug>/issues/<NN>-<slug>.md` 下每张工单一个文件，从 `01` 编号——绝不是一个合并的工单文件
- 分流状态记录为每个 issue 文件顶部附近的 `Status:` 行（角色字符串参见 `triage-labels.md`）
- 评论和对话历史追加到文件底部 `## Comments` 标题下

## 当技能说"发布到 issue 跟踪器"

在 `.scratch/<feature-slug>/` 下创建一个新文件（需要时创建目录）。

## 当技能说"获取相关工单"

读取引用路径处的文件。用户通常会直接传入路径或 issue 编号。

## Wayfinding 操作

由 `/wayfinder` 使用。**地图**是一个文件，每张工单一个**子**文件。

- **地图**：`.scratch/<effort>/map.md` —— Notes / Decisions-so-far / Fog 正文。
- **子工单**：`.scratch/<effort>/issues/NN-<slug>.md`，从 `01` 编号，问题在正文中。一个 `Type:` 行记录工单类型（`research`/`prototype`/`grilling`/`task`）；一个 `Status:` 行记录 `claimed`/`resolved`。
- **阻塞**：顶部附近的 `Blocked by: NN, NN` 行。当它列出的每个文件都 `resolved` 时，工单未阻塞。
- **前沿**：扫描 `.scratch/<effort>/issues/` 寻找打开、未阻塞且未认领的文件；按编号第一个获胜。
- **认领**：在任何工作之前设置 `Status: claimed` 并保存。
- **解决**：在 `## Answer` 标题下追加答案，设置 `Status: resolved`，然后在 `map.md` 的 Decisions-so-far 中追加一个上下文指针（摘要 + 链接）。
