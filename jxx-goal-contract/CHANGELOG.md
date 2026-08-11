# Changelog

## 4.3.0 — 2026-07-27

拒绝无命令验收 + 验收四性质 + 全链路同步：

- 否决门新增 V10：每条 Acceptance 必须绑定可执行验证命令 `（验证：...）`，缺少或绑"人工确认"一律否决
- 验收标准设计从"三条性质"扩展为"三条性质 + 一条绑定"（可观测/可判定/独立来源/绑定验证命令）
- 深度下限表 Acceptance 行同步要求绑定验证命令
- 契约深度下限表反模式新增"无命令验收"
- 模糊词翻译表后新增说明：翻译结果写入 Acceptance 时同样遵守绑定要求
- "新建目标"流程第 5 步骤改为按完整模板初始化 PROGRESS.md（含每轮必读块、验证命令列、固化日志）
- 同步 references/goal-contract.md（模板/示例/深度下限/填写要点/PROGRESS.md 初始化模板）、acceptance-patterns.md（第 4 条绑定 + 反模式）、grilling-guide.md（A4 问题 + 会话示例验收加命令绑定）、error-recovery.md（PROGRESS.md 重建描述同步）

## 4.2.0 — 2026-07-19

职责厘清与结构瘦身：

- "继续目标"归属移交：继续中断目标由 jxx-goal-mode 直接路由到 jxx-goal-execute，本技能不再处理；description 触发词同步移除"继续目标"
- 异常处理表下沉至 references/error-recovery.md，正文仅留核心回滚原则
- 执行-检查上下文隔离增加降级路径：宿主无 subagent 能力时降级为换视角复检，并记录到固化日志
- `_index.md` 转义写法统一为反引号格式
- 新增 `.goals/` 是否加入 `.gitignore` 的用户提示
- 删除重复的 LICENSE.md（保留 LICENSE.txt）

## 4.1.0 — 2026-07-16

契约质量系统性加固。新增：

- 默认推进模式增加"自检-修正"内循环：生成草稿 → 自检否决门 → 修正 → 独立检查 → 输出推荐版
- 固化检查清单改为否决门（Veto Gate）：9 道否决门，任一不通过不可写入 GOAL.md
- 契约深度下限：每个字段规定最少条目数（Acceptance ≥ 3、Constraints ≥ 3 等）
- 执行-检查上下文隔离：生成和检查在不同上下文中完成，检查 agent 只接收契约草稿 + 规则
- 同步更新 references/goal-contract.md、grilling-guide.md

## 4.0.0 — 2026-07-12

多目标隔离存储与继续/重复支持。新增：

- 目标存储从项目根目录 `GOAL.md` 迁移到 `.goals/{name}/GOAL.md`
- 多目标按名称隔离，互不干扰
- `_index.md` 目标索引追踪所有目标状态
- `PROGRESS.md` 执行进度文件，支持从断点继续
- `EVIDENCE.md` 交付证据文件
- 继续目标操作（读取进度，从断点恢复）
- 重复目标操作（复制契约，重置进度，重新执行）
- 追加到已有目标操作
- 目标名称规则（kebab-case，唯一）

## 3.0.0 — 2026-07-09

从 jxx-goal-mode v2 拆分而来。新增：

- 默认推进模式（借鉴 qiaomu-goal-meta-skill）
- 发现优先策略（陌生领域先调研再实施）
- 模糊词翻译为验证条件
- Pause Conditions 独立于 Constraints
- 编号选择题替代开放式追问
