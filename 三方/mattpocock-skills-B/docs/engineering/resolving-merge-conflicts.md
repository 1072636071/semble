## 它做什么

`resolving-merge-conflicts` 逐个 hunk 处理进行中的 git merge 或 rebase，然后运行项目自己的检查，并用一个 commit 完成该操作。

它拒绝把冲突当作文本问题。在触碰一个 hunk 之前，它把每一边追溯回它的**[首要来源](https://www.aihero.dev/ai-coding-dictionary/primary-source)**——commit 消息、PR、原始 issue——所以它是在两个*意图*之间选择，而不是在两个文本块之间，并且在它们兼容的地方保留两者。在它们真正不兼容之处，它选匹配合并陈述目标的那一边，并点名权衡。它不发明新行为来掩盖冲突，而且 `--abort` 不是它有的选项：合并总是被带到一个完成的 commit。

## 何时使用

输入 `/resolving-merge-conflicts`，或当一个任务合适时[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 自动触发它。

当 git 已经停在它自己无法解决的冲突上时取用它。它的范围限定在你面前的冲突，而不是它任何一边的任何东西：

| 你的情况 | 技能 |
| --- | --- |
| 合并或 rebase 中途，树里有冲突标记 | 这个 |
| 合并完成，有东西现在因为你看不到的原因行为异常 | [diagnosing-bugs](https://aihero.dev/skills-diagnosing-bugs) |
| 规划如何切片工作让分支碰撞更少 | 都不是——见下面的并行工作问题 |

## 首要来源胜过 `ours` 和 `theirs`

它存在要杀死的失败模式是按标志解决：`--ours`、`--theirs`，或手删哪个块看起来不那么重要，这样标记消失、构建编译。那个解决可以是语法上完美的，仍然悄悄丢掉某人刻意做的变更。

你无法保留一个你没读过的意图。所以工作从历史开始——commits、PRs、[工单](https://www.aihero.dev/ai-coding-dictionary/ticket)——然后才移到 diff。循环里另一个步骤的存在是出于同样的原因：技能找到仓库自己的[自动检查](https://www.aihero.dev/ai-coding-dictionary/automated-check)并在提交之前运行它们，因为合并是 git 里最容易产出满足两个分支、却过不了两者测试的代码的地方。

## 常见问题

**Claude Code 已经靠自己解决冲突解决得相当好了。为什么这需要一个技能？**

增加值是"找到首要来源"和"运行反馈循环"步骤，否则每次都得手动提示。一个无提示的 agent 通常只从 diff 产出一个合理的解决并停在那里。技能的价值是它不允许 agent 跳过的两个步骤——读取每一边存在的原因，以及之后运行检查。那是在一个好的[模型](https://www.aihero.dev/ai-coding-dictionary/model)之上的薄边际，而且它被设计成那样：至少一位读者已经预测，这是一个随着模型改进而变成 no-op 的完整技能。

**我应该让并行 agent 避开相同的文件，以从一开始避免冲突吗？**

大多不用。在并行任务之间把文件分区分开，成本超过收益，因为 agent 对合并冲突足够好，权衡没有看起来那么严酷。值得保留的纪律是先做大重构。一个大的重命名在十个分支从它分叉之后落地，就是保持昂贵的情况。

来自并行 worktrees 用户报告的一个注意事项：当兄弟[会话](https://www.aihero.dev/ai-coding-dictionary/session)各自在自己的树里构建一张工单时，合并回来最好由写变更的会话做，因为它已经是知道意图的那个。最后把每个人的冲突批量到同一个 agent 上，恰好扔掉这个技能第 2 步必须去重建的[上下文](https://www.aihero.dev/ai-coding-dictionary/context)。

**为什么从不 `--abort`？**

中止扔掉解决工作，把你带回同一个冲突，未改变，下次你尝试时。技能是为合并*将要*发生的情况写的。如果你已经决定它不应该发生，那是在调用之前做出的决定，不是循环内的分支。

## 正常工作的标志

- agent 在解决时向你引用 commit 消息、PR 或 issue，而不只是 diff hunk。
- 每个 hunk 最终带着两边的行为，或带着一个点名丢了什么和为什么的显式说明。
- 结果里没有出现两个分支上都不存在的东西。
- 类型检查、测试和格式在 commit*之前*被定位并运行绿了，而不是在你注意到有东西坏了之后。
- 你以树干净、操作完成结束——包括多 commit rebase 中每个剩余的 commit。

## 在流程中的位置

一个随时可取的独立项，不依赖任何其他技能：它在 git 停滞时开始，在树干净并已提交时结束。它唯一真正的邻居是 [diagnosing-bugs](https://aihero.dev/skills-diagnosing-bugs)，它在合并干净解决但合并的代码行为异常的点接手——一个诊断问题，不是冲突问题。它完全脱离主创意-交付流程，所以 [ask-matt](https://aihero.dev/skills-ask-matt) 是运行在它之前和之后的东西的地图。
