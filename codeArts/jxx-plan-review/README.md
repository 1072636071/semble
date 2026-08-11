# jxx-plan-review

语义方案审查（门下省封驳）——在 goal-contract 和 goal-execute 之间独立审阅 GOAL.md 契约，检查方案可行性、覆盖完整性、风险盲区，输出准奏/封驳/附条件准奏。

## 何时使用

当用户想在 goal-contract 固化契约后、goal-execute 启动前对方案进行语义审查时使用。

## 相关技能

- `/jxx-goal-contract` — 上游，契约固化
- `/jxx-goal-execute` — 下游，执行循环
- `/jxx-code-review` — 代码审查（与本技能互补，不重叠）