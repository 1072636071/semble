---
name: jxx-resolving-merge-conflicts
description: 解决进行中的 merge/rebase 冲突，保留双方意图。触发词：合并冲突、解冲突。
metadata:
  version: 1.1.0
---

1. **查看 merge/rebase 的当前状态**。检查 git 历史和冲突文件。

2. **追溯每个冲突的原始来源**。深入理解每项变更的原因和原始意图。阅读 commit message，查看 PR，追溯原始 issue/ticket。

3. **逐 hunk（段）解决冲突。** 尽可能保留双方意图。若不兼容，选择符合合并既定目标的一方，并记录取舍。**不要**凭空创造新行为。始终解决冲突，绝不 `--abort`。

4. 发现项目的**自动化检查**并运行——通常是 typecheck，然后测试，然后格式化。修复合并导致的任何问题。

5. **完成 merge/rebase。** 暂存所有内容并 commit。若正在 rebase，继续 rebase 流程直到所有 commit 都完成。

## 工单看板流里的两条硬约定（jxx-ticket-board PROTOCOL §3）

被合并专员交回来处理冲突时（典型：`merge-check` 判为 `✗非机械` 的 binary / modify-delete / rename 冲突，或内容冲突需要开发组判断），额外遵守：

- **先分诊再动手**：`board.mjs merge-check --root <root> --id <卡id>` 已在内存里预演过一轮（不落现场），拿它的输出当起点——它逐文件标了 `·机械候选` / `✗非机械`，别从零试错。**注意二进制**：git 对它同样报 `CONFLICT (content)`，真信号是 `warning: Cannot merge binary files`。
- **解完必须重审**：解决冲突会**改变 diff**，严格意义上使原审查失效（ADR-005）——这是本技能与看板流最重要的一条接口。解完重跑 `/jxx-code-review`，通过后再交回合入，别直接推 main。
- **绝不 `--abort`**（同上第 3 条）：看板流里中途 abort 会把工作树退回去，等于丢掉已做的解决工作；宁可停下来问。
