# jxx-goal-execute

目标自主执行循环子技能——基于已固化的 GOAL.md 契约，自主拆解、执行、自检并循环至达标。支持多目标隔离（`.goals/{name}/` 目录），支持从断点继续和重复执行。

## 何时使用

- /jxx-goal-mode 路由分发（契约已固化）
- 用户说"开始执行""继续目标""跑循环""继续 {name}"
- /jxx-goal-contract 完成契约固化后自动委托

## 前提条件

`.goals/{name}/GOAL.md` 必须存在。

## 目标存储

所有目标在 `.goals/{name}/` 目录下独立管理：

```
.goals/{name}/
├── GOAL.md        # 契约
├── PROGRESS.md    # 执行进度（可中断恢复）
└── EVIDENCE.md    # 交付证据
```

## 核心流程

1. **拆解**——纵向切片（vertical slice），每切片可独立验证
2. **执行循环**——选→执行→验证→记录→判停
3. **自检与交付**——逐条验收，独立来源证据

## 相关技能

- jxx-goal-mode（路由器）
- jxx-goal-contract（契约固化）
- jxx-tdd / jxx-implement / jxx-research（执行可委托）
