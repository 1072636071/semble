# Changelog

## 4.1.0 — 2026-07-19

合规与去重修复：

- frontmatter 增加 `disable-model-invocation: true`（用户调用），description 精简为人类向单行摘要（符合 .agents/invocation.md 约定）
- 目标存储结构去重：删除重复的 `.goals/` 目录树定义，指向 jxx-goal-contract 为唯一权威
- 小任务判断增加量化锚点（单文件改动 + 无需验证命令 + 无跨文件同步，三条全中才算小任务）
- evals 新增 EM007 边界用例（看似小任务实则多步）

## 4.0.0 — 2026-07-12

多目标管理与继续/重复支持。新增：

- 路由逻辑增加"继续 {name}""重复 {name}""列出目标"分支
- 目标存储从项目根目录 GOAL.md 迁移到 .goals/{name}/ 目录
- 多目标按名称隔离，互不干扰
- \_index.md 目标索引追踪
- 断点恢复路由（执行中/已暂停 → jxx-goal-execute）
- 重复目标路由（已完成/已失败 → jxx-goal-contract 重复模式）
- 追加到已有目标路由

## 3.0.0 — 2026-07-09

重大重构：拆分为路由器 + 子技能架构。

- jxx-goal-mode 精简为路由器，负责判断任务类型并分发
- 契约固化逻辑拆入 jxx-goal-contract（新增默认推进/发现优先/Grilling 三模式）
- 执行循环逻辑拆入 jxx-goal-execute（独立负责拆解→执行→验证→交付）
- 借鉴 qiaomu-goal-meta-skill：默认先推进、编号选择题、模糊词翻译、Pause Conditions
- references 文件移入 jxx-goal-contract

## 2.0.0 — 2026-07-09

优化版本：新增 Grilling 指南、进度追踪、错误恢复、工件持久化。

## 1.0.0 — 2026-07-09

初始版本。
