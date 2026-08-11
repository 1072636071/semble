# 编写 Agent 简报

Agent 简报是当 issue 进入 `ready-for-agent` 状态时发布的结构化评论。它是 AFK agent 工作的权威规范。原始正文和讨论是上下文——agent 简报是契约。

简报声明 **agent 应该做什么**：从零开始构建变更。

## 原则

### 持久性优于精确性

Issue 可能在 `ready-for-agent` 状态停留数天或数周。代码库会在此期间变化。编写简报时要使其在文件被重命名、移动或重构后仍然有用。

- **要**描述接口、类型和行为契约
- **要**命名 agent 应查找或修改的特定类型、函数签名或配置结构
- **不要**引用文件路径——它们会过时
- **不要**引用行号
- **不要**假设当前实现结构会保持不变

### 行为性，非过程性

描述系统**应该做什么**，而非**如何实现**。Agent 会重新探索代码库并做出自己的实现决策。

- **好的：** "`SkillConfig` 类型应接受可选的 `schedule` 字段，类型为 `CronExpression`"
- **差的：** "打开 src/types/skill.ts 在第 42 行添加 schedule 字段"
- **好的：** "当用户不带参数运行 `/jxx-triage` 时，应看到需要关注的 issue 摘要"
- **差的：** "在主处理函数中添加 switch 语句"

### 完整的验收标准

Agent 需要知道何时完成。每个 agent 简报必须有具体、可测试的验收标准。每条标准应可独立验证。

- **好的：** "运行 `/jxx-triage` 返回经过初始分类的 issue"
- **差的：** "triage 应该正常工作"

### 明确的范围边界

声明什么不在范围内。这防止 agent 过度设计或对相邻功能做假设。

## 模板

```markdown
## Agent Brief

**Category:** bug / enhancement
**Summary:** 一行描述需要做什么

**Current behavior:**
描述当前发生的情况。对于 bug，这是异常行为。
对于 enhancement，这是功能所基于的现状。

**Desired behavior:**
描述 agent 工作完成后应该发生什么。
对边界情况和错误条件要具体。

**Key interfaces:**

- `TypeName` — 需要更改什么以及为什么
- `functionName()` 返回类型 — 当前返回什么 vs 应该返回什么
- Config shape — 需要的任何新配置选项

**Acceptance criteria:**

- [ ] 具体、可测试的标准 1
- [ ] 具体、可测试的标准 2
- [ ] 具体、可测试的标准 3

**Out of scope:**

- 不应在此 issue 中更改或处理的内容
- 看似相关但独立的功能
```

## 示例

### 好的 agent 简报（bug）

```markdown
## Agent Brief

**Category:** bug
**Summary:** 技能描述截断在单词中间，产生损坏的输出

**Current behavior:**
当技能描述超过 1024 个字符时，会在恰好 1024 字符处截断，
不考虑单词边界。这导致描述在单词中间结束
（例如 "Use when the user wants to confi"）。

**Desired behavior:**
截断应在 1024 字符前最后一个单词边界处断开，
并追加 "..." 表示截断。

**Key interfaces:**

- `SkillMetadata` 类型的 `description` 字段 — 无需类型更改，
  但填充它的验证/处理逻辑需要尊重单词边界
- 任何读取 SKILL.md frontmatter 并提取 description 的函数

**Acceptance criteria:**

- [ ] 1024 字符以下的描述不变
- [ ] 超过 1024 字符的描述在 1024 字符前最后一个单词边界处截断
- [ ] 截断的描述以 "..." 结尾
- [ ] 包含 "..." 的总长度不超过 1024 字符

**Out of scope:**

- 更改 1024 字符限制本身
- 多行描述支持
```

### 好的 agent 简报（enhancement）

```markdown
## Agent Brief

**Category:** enhancement
**Summary:** 添加 `.out-of-scope/` 目录支持，用于追踪被拒绝的功能请求

**Current behavior:**
当功能请求被拒绝时，issue 以 `wontfix` 标签和评论关闭。
没有决策或推理的持久记录。
未来类似的请求需要维护者回忆或搜索之前的讨论。

**Desired behavior:**
被拒绝的功能请求应记录在 `.out-of-scope/<concept>.md` 文件中，
捕获决策、推理和所有请求该功能的 issue 链接。
在 triage 新 issue 时，应检查这些文件以查找匹配。

**Key interfaces:**

- `.out-of-scope/` 中的 Markdown 文件格式 — 每个文件应有
  `# Concept Name` 标题、`**Decision:**` 行、`**Reason:**` 行，
  以及带 issue 链接的 `**Prior requests:**` 列表
- triage 工作流应尽早读取所有 `.out-of-scope/*.md` 文件，
  并按概念相似性将新 issue 与之匹配

**Acceptance criteria:**

- [ ] 关闭 wontfix 功能时创建/更新 `.out-of-scope/` 中的文件
- [ ] 文件包含决策、推理和已关闭 issue 的链接
- [ ] 如果匹配的 `.out-of-scope/` 文件已存在，新 issue
      追加到其 "Prior requests" 列表而非创建重复
- [ ] triage 时检查现有 `.out-of-scope/` 文件，当新 issue
      匹配先前拒绝时显示

**Out of scope:**

- 自动匹配（人工确认匹配）
- 重新打开先前被拒绝的功能
- Bug 报告（仅 enhancement 拒绝进入 `.out-of-scope/`）
```

### 差的 agent 简报

```markdown
## Agent Brief

**Summary:** 修复 triage bug

**What to do:**
triage 那个东西坏了。看看主文件然后修一下。
大约第 150 行的函数有问题。

**Files to change:**

- src/triage/handler.ts (line 150)
- src/types.ts (line 42)
```

这很差因为：

- 没有类别
- 模糊描述（"triage 那个东西坏了"）
- 引用会过时的文件路径和行号
- 没有验收标准
- 没有范围边界
- 没有描述当前 vs 期望行为
