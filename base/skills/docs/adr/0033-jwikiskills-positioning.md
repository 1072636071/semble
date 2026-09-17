# ADR-0033: JwikisSkills 定位确认

- 状态：已接受
- 日期：2026-09-15T15:11:02.811Z
- 关联：memorial 033

## 背景

在全面吸收并超越 lean-ctx 的过程中，需要明确 JwikisSkills 的定位。

## 决策

### 1. JwikisSkills 定位

**定位：** 轻量级技能 + 哲学层（推动 AGI 和 AI 工程化）

**保留内容：**
- 现有全部技能（grill-with-memorial、research、tdd 等）
- 现有分类方式（engineering、productivity 等）

**新增内容：**
- 哲学理念（AGI 推动）
- 设计范式（AI 工程化）
- 定式（最佳实践）

**不负责：**
- 复杂代码实现（在 TencentDB-Agent-Memory 和 win-shell-mcp）
- 工作流引擎
- Handoff Bundle
- 输出确定性保证
- 渐进式压缩

### 2. 与其他项目的关系

```
JwikisSkills（轻量级技能 + 哲学层）
    │
    ├── 提供：通用技能、哲学理念、设计范式、定式
    │
    ▼
TencentDB-Agent-Memory（复杂后端）
    │
    ├── 提供：记忆、知识、任务、多 Agent 编排
    │
    ▼
win-shell-mcp（复杂工具层）
    │
    └── 提供：命令抽象、文件操作、搜索
```

## 后果

**正面：**
- 定位清晰，职责明确
- 保留现有内容，不破坏现有功能
- 专注轻量级技能和哲学层

**负面 / 代价：**
- 不负责复杂代码实现
- 需要与其他两个项目协调

## 替代方案（被否决）

- **JwikisSkills 负责复杂代码**：与轻量级定位冲突，被否决
- **JwikisSkills 新增工作流引擎**：与 TencentDB-Agent-Memory 重复，被否决
