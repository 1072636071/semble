---
name: jxx-resolving-merge-conflicts
description: 解决进行中的 git merge/rebase 冲突时使用。
---

# Resolving Merge Conflicts

读懂双方分支的意图，以保留两者方式解决冲突。

## Guidelines

- 查看 merge/rebase 当前状态。检查 git 历史和冲突文件。
- 追溯每个冲突的原始来源。理解每项变更的原因和原始意图——阅读 commit message、查看 PR、追溯原始 issue/ticket。
- 逐 hunk 解决冲突。尽可能保留双方意图；若不兼容，选择符合合并既定目标的一方并记录取舍。不要凭空创造新行为。始终解决冲突，绝不 `--abort`。
- 发现项目的自动化检查并运行——通常是 typecheck，然后测试，然后格式化。修复合并导致的任何问题。
- 完成 merge/rebase。暂存所有内容并 commit。若正在 rebase，继续直到所有 commit 完成。
