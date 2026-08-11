# jxx-goal-mode

目标模式路由器——以结果为导向的自主执行循环入口。判断任务类型并分发到子技能：jxx-goal-contract（契约固化）或 jxx-goal-execute（自主执行循环）。支持多目标管理（`.goals/` 目录）。

## 何时使用

- 用户说"目标模式""goal mode""我只定目标""按目标来做""自主循环"
- 用户表达"你来做，我只看结果""晚上布置早上检查"
- 用户说"继续 {name}""重复 {name}""列出目标"
- 长任务路径不确定、过程繁重，用户只想在开始和结束介入

## 目标存储

目标存储结构（`.goals/{name}/` 目录、`_index.md` 索引）的定义见 jxx-goal-contract，本技能只读取。

## 子技能

| 子技能            | 职责                                        |
| ----------------- | ------------------------------------------- |
| jxx-goal-contract | 契约固化：新建/重复/追加，生成 GOAL.md      |
| jxx-goal-execute  | 自主执行循环：拆解→执行→验证→交付（含断点恢复） |

## 相关技能

- jxx-to-spec（目标需先成规格文档时）
- jxx-to-tickets（拆解纪律参考）
- jxx-tdd / jxx-implement / jxx-research（执行可委托）
- jxx-loop-me（工作流本身需 spec 化时）
