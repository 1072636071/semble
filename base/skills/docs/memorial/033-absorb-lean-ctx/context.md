# Memorial 033 — 全面吸收并超越 lean-ctx：JwikisSkills 定位

## 状态
已完成

## 诉求

用户原话：
> 我们要全面吸收超越这个，可以抄袭。
> 未来我还想我们的核心部件，或者全部都换成rust 来最大性能

JwikisSkills 负责轻量级技能 + 哲学层（推动 AGI 和 AI 工程化）。

目标：明确定位，保留现有内容，专注通用技能和哲学理念。

## 追问记录

### 2026-09-15T15:11:02.811Z — Grill Round 1

**Q1: JwikisSkills 定位确认**

初步判断：JwikisSkills 只放通用技能、哲学、设计、范式、定式。

### 2026-09-15T15:11:02.811Z — Grill Round 2

**用户回答：**
1. JwikisSkills 当前内容全部保留
2. 放自己研发的通用技能 + 哲学理念（推动 AGI 和 AI 工程化）
3. 复杂代码在其他两个仓库

**最终定位确认：**

JwikisSkills = 轻量级技能 + 哲学层
- 现有内容全部保留
- 新增：哲学理念、设计范式、定式
- 不负责：复杂代码（在其他两个仓库）

## 决策汇总

### 决策 1：JwikisSkills 定位

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

### 决策 2：与其他项目的关系

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

## 待澄清

（无）
