---
name: "jxx-resolving-merge-conflicts"
description: "解决进行中的 git merge/rebase 冲突。当用户遇到合并冲突时使用。"
---

1. **查看 merge/rebase 的当前状态**。检查 git 历史和冲突文件。

2. **追溯每个冲突的原始来源**。深入理解每项变更的原因和原始意图。阅读 commit message，查看 PR，追溯原始 issue/ticket。

3. **逐 hunk（段）解决冲突。** 尽可能保留双方意图。若不兼容，选择符合合并既定目标的一方，并记录取舍。**不要**凭空创造新行为。始终解决冲突，绝不 `--abort`。

4. 发现项目的**自动化检查**并运行——通常是 typecheck，然后测试，然后格式化。修复合并导致的任何问题。

5. **完成 merge/rebase。** 暂存所有内容并 commit。若正在 rebase，继续 rebase 流程直到所有 commit 都完成。
