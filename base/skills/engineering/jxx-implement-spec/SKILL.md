---
name: jxx-implement-spec
description: "按 spec 与其关联 ticket（任务图）实现整个 spec：单分支交付一支 PR，用后台子 agent 并发实现 ticket。触发词：实现 spec、implement the spec、按工单实现。"
disable-model-invocation: true
metadata:
  version: 1.0.0
---

你拿到了一份 spec。这份 spec 应当已关联若干 ticket，描述如何实现它。

目标是：在**单条分支**上产出一支实现整个 spec 的 PR。

ticket 不是步骤列表，而是一张带阻塞关系的**任务图**（task graph）。这意味着任何时刻都存在一个"就绪前沿"（frontier）——当前可被认领的 ticket 集合。

与子 agent 的通信应当稀疏。主要通过**上下文指针**（context pointers）交流：指向 spec、ticket、研究笔记、既往 commit。不要复述指针已能获取的信息。

**实现者子 agent**（implementer subagent）应尽可能在后台运行，以获得**最大并发**。

## 步骤

1. 阅读 spec 和 ticket。读到足以理解任务图的程度。

2. （可选）用**探索子 agent**（exploration subagent）做 ticket 要求的探索——相关代码文件或外部文档。确保探索子 agent 能保存文件：把 markdown 笔记存在仓库外的目录里，供后续所有子 agent 共享。这样**实现者子 agent**就能专注实现，而不必分心探索。

3. 创建分支和一支草稿 PR（draft PR）。PR 应标记为"closing"该 spec issue 及各 ticket。

4. 用**实现者子 agent**实现每个 ticket。每个实现者子 agent 在自己的 worktree、自己的分支上工作。

5. 一个**实现者子 agent**完成后，用**合并子 agent**（merger subagent）把其工作合并进 PR 分支。

6. 如果这一步改变了 ticket 的**就绪前沿**，立即启动更多**实现者子 agent**去处理新就绪的 ticket。以此保持最大并发。

7. 全部 ticket 完成后，对 PR 分支运行 `/jxx-code-review`。用一个**实现者子 agent**一次性修复评审提出的全部问题。

8. 把 PR 标记为 ready for review。

9. 清理所有**实现者子 agent**的 worktree。
