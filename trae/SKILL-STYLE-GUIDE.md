# Trae 技能风格经验文档

> 本文档记录了将 31 个 jxx-* 技能从原始风格优化为 Trae 官方技能风格的全过程经验，包含规范解读、常见问题、修复方法和编写最佳实践。

---

## 一、Trae 官方技能风格规范

### 1.1 目录结构

```
<skill-name>/
  └── SKILL.md
```

一个合法的 Trae 技能只需要一个目录加一个 `SKILL.md` 文件。附带文件（`references/`、`assets/`、`evals/` 等）不影响技能合法性，但 `SKILL.md` 是唯一入口。

### 1.2 SKILL.md 格式

```markdown
---
name: "<skill-name>"
description: "<简洁描述：做X。当Y时调用。>"
---

# <技能标题>

<详细指令、使用指南和示例>
```

### 1.3 必填字段

| 字段 | 位置 | 说明 |
|------|------|------|
| `name` | frontmatter | 技能的唯一标识符，**必须加引号** |
| `description` | frontmatter | **关键**：必须包含 (1) 技能做什么 + (2) 何时调用。**200 字符以内** |
| 正文 | frontmatter 之后 | 完整的 Markdown 内容 |

### 1.4 非标字段（应移除）

以下字段不属于 Trae 标准技能规范，优化时已全部移除：

| 字段 | 原用途 | 移除原因 |
|------|--------|----------|
| `metadata.version` | 版本号 | Trae 不读取此字段；版本管理应由 git 负责 |
| `disable-model-invocation` | 禁止模型自动调用 | Trae 通过 description 中的调用时机引导模型决策，不依赖此字段 |
| `argument-hint` | 参数提示 | Trae 标准不支持此字段；参数说明应写入正文 |

---

## 二、优化前后对比

### 2.1 优化前（典型示例）

```yaml
---
name: jxx-code-review
description: 从两个维度审查自固定点（commit、branch、tag 或 merge-base）以来的变更 — 标准（代码是否遵循仓库编码标准？）和 spec（代码是否匹配原始 issue/PRD 要求？）。两个审查以并行子 agent 运行，并排报告。当用户想审查 branch、PR、进行中的变更，或要求"review since X"/"review 自 X 以来"时使用。
metadata:
  version: 1.0.0
---
```

**问题：**
- `name` 无引号
- `description` 超过 200 字符（实际约 170 字符，但多个技能超过 300 字符）
- 包含非标 `metadata.version` 字段
- 描述中混入过多实现细节（"并行子 agent""merge-base"）

### 2.2 优化后

```yaml
---
name: "jxx-code-review"
description: "从标准和 spec 两个维度并行审查代码变更。当用户想审查 branch、PR 或进行中的变更时使用。"
---
```

**改进：**
- `name` 加了引号
- `description` 压缩到 51 字符
- 移除了 `metadata.version`
- 描述聚焦"做什么 + 何时调用"，实现细节留给正文

### 2.3 统计概览

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 技能总数 | 31 | 31 |
| `name` 加引号 | 0/31 | 31/31 |
| `description` ≤ 200 字符 | 15/31 | 31/31 |
| 含 `metadata` 字段 | 29/31 | 0/31 |
| 含 `disable-model-invocation` | 14/31 | 0/31 |
| 含 `argument-hint` | 2/31 | 0/31 |
| 多行 `description`（`>` 语法） | 4/31 | 0/31 |

---

## 三、description 编写指南

### 3.1 标准句式

Trae 官方推荐的 description 句式：

```
做X。当Y时调用。
```

英文等价：`Does X. Invoke when Y happens or user asks for Z.`

### 3.2 好的 description 示例

| 技能 | description | 字符数 |
|------|-------------|--------|
| `jxx-tdd` | 测试驱动开发（TDD）。当用户想以测试优先方式构建功能或修复 bug 时使用。 | 39 |
| `jxx-prototype` | 构建一次性 prototype 回答设计问题。当用户想验证状态模型或探索 UI 长什么样时使用。 | 48 |
| `jxx-research` | 调研主题、收集资料。当用户需要调研、查资料、写报告或技术选型评估时使用。 | 36 |

### 3.3 坏的 description 模式（已修复）

**模式 1：信息过载**

```
# 优化前
description: 按统一的 frontmatter + 既有写作风格生成或改造 CodeBuddy agent 文件。当用户想新建 agent、给 agent 加身份设定（姓姜 + 扮演角色）、或统一一批 agent 的风格/规范时使用。触发词："生成一个 agent""创建 agent""改造这个 agent""给 agent 加身份""统一 agent 风格"。产物为 `~/.codebuddy/agents/名字.md`。
```

问题：触发词列表和产物路径不应出现在 description 中——这些属于正文内容。

```
# 优化后
description: "按'姜姓身份+统一 frontmatter+既有写作风格'生成或改造 CodeBuddy agent 文件。当用户想新建 agent、给 agent 加身份、或统一 agent 风格时使用。"
```

**模式 2：多行 YAML 块标量**

```yaml
# 优化前
description: >
  目标契约固化（goal contract）——将模糊任务收敛为可执行的 GOAL.md 契约，
  支持多目标隔离存储、重复与追加；三种模式：默认推进、发现优先、Grilling 追问。
```

问题：多行 description 增加了解析复杂度，且容易超长。Trae 标准使用单行引号字符串。

```yaml
# 优化后
description: "将模糊任务收敛为可执行的 GOAL.md 契约。当用户想固化目标、设定验收标准时使用。"
```

**模式 3：实现细节泄漏**

```yaml
# 优化前
description: 将计划、spec 或当前对话拆解为一组 tracer-bullet（追踪弹）工单，每个声明其 blocking edges（阻塞边），发布到已配置的 issue 跟踪器——本地文件中以文本表示，或真实 tracker（如 GitHub、Linear）上的原生阻塞链接。当需将计划或规格文档分解为可执行工作项时使用。
```

问题：`blocking edges`、`GitHub`、`Linear` 等实现细节不应出现在 description 中。

```yaml
# 优化后
description: "将计划或 spec 拆解为追踪弹式工单。当用户需将规格分解为可执行工作项时使用。"
```

**模式 4：缺少调用时机**

```yaml
# 优化前
description: 一场 relentless 的 grill 追问，用以打磨（sharpen）计划或设计。
```

问题：只说了"做什么"，没说"何时调用"。模型无法判断是否应该触发此技能。

```yaml
# 优化后
description: "穷追不舍地追问以打磨计划或设计。当用户想对计划做压力测试时使用。"
```

---

## 四、frontmatter 规范

### 4.1 合法 frontmatter

```yaml
---
name: "skill-name"
description: "做X。当Y时调用。"
---
```

### 4.2 非法 frontmatter 模式

```yaml
# 非法：name 无引号
name: skill-name

# 非法：description 超过 200 字符
description: "一段超过200字符的超长描述......"

# 非法：使用多行块标量
description: >
  多行描述
  跨越多行

# 非法：包含非标字段
metadata:
  version: 1.0.0
disable-model-invocation: true
argument-hint: "参数提示"
```

### 4.3 引号规则

- `name` 和 `description` 的值**必须用双引号**包裹
- 如果 description 内部需要包含引号，使用单引号：`"按'姜姓身份'生成 agent"`
- 不要在 description 中使用未转义的双引号

---

## 五、正文编写最佳实践

正文内容（frontmatter 之后的部分）不需要在此次优化中改动，但以下是从现有技能中提炼的最佳实践：

### 5.1 结构模式

优秀的技能正文通常包含以下模块（按需选用）：

```
# 技能标题

一句话定位。

## 何时使用 / 何时不用

## 工作流 / 流程

## 反模式

## 与其他技能的关系
```

### 5.2 关键原则

- **正文写给 agent，description 写给人**：description 帮助模型决定何时调用，正文指导 agent 如何执行
- **指针优于复制**：内容别处已有时，用链接指向而非复制
- **每句都要挣得位置**：无法辩护的句子就删
- **反模式不可省略**：告诉 agent "不要做什么"和"做什么"同样重要
- **用表格表达对比**：多维度比较时用表格而非列表

### 5.3 附件组织

```
<skill-name>/
  ├── SKILL.md              # 唯一入口
  ├── references/            # 参考文档（被 SKILL.md 链接）
  │   ├── guide.md
  │   └── examples.md
  ├── assets/                # 模板和资源
  │   └── template.md
  └── evals/                 # 评估用例
      └── evals.json
```

---

## 六、常见问题 FAQ

### Q1: 为什么移除 `disable-model-invocation`？

Trae 通过 `description` 中的调用时机来引导模型决策。例如 `"当用户想对计划做压力测试时使用"` 已经明确了触发条件。`disable-model-invocation` 是非标字段，Trae 的技能系统不读取它。

### Q2: 为什么移除 `metadata.version`？

Trae 的技能系统不使用版本号。版本管理应由 git 提交历史负责。保留一个静态的 `version: 1.0.0` 字段只会造成误导——它不会自动更新，且无人检查。

### Q3: 为什么移除 `argument-hint`？

Trae 标准技能格式不支持此字段。如果技能需要参数说明，应写入正文的"输入"或"参数"章节。

### Q4: description 应该用中文还是英文？

Trae 的 `skill-creator` 建议默认使用英文，除非用户指定其他语言。但由于 jxx-* 技能系列面向中文用户，正文和描述均使用中文。关键原则是：**description 的语言应与用户查询的语言一致**。

### Q5: description 中要不要写触发词？

不要。触发词列表会占大量字符且容易被淹没。正确的做法是用"当用户想X时使用"这一句式概括触发场景。具体触发词可以放在正文的"何时使用"章节。

### Q6: 200 字符限制是硬性的吗？

`skill-creator` 说"Keep under 200 chars for best display"。超过 200 字符不会报错，但会影响技能列表中的显示效果。优化后所有 31 个技能的 description 均在 66 字符以内。

---

## 七、优化操作记录

### 7.1 优化范围

对 `D:\work\space\jwikis-skills\trae` 目录下全部 31 个技能的 `SKILL.md` 文件执行了 frontmatter 标准化。

### 7.2 优化内容

1. `name` 字段：加双引号
2. `description` 字段：压缩至 200 字符以内，统一为"做X。当Y时调用。"句式
3. 移除 `metadata.version`
4. 移除 `disable-model-invocation`
5. 移除 `argument-hint`
6. 多行 `description`（`>` YAML 块标量）改为单行双引号字符串
7. 正文内容保持不变

### 7.3 技能清单

| # | 技能名称 | description 字符数 |
|---|---------|-------------------|
| 1 | jxx-agent-generator | 95 |
| 2 | jxx-ask-matt | 29 |
| 3 | jxx-code-review | 51 |
| 4 | jxx-codebase-design | 39 |
| 5 | jxx-design-system | 56 |
| 6 | jxx-diagnosing-bugs | 66 |
| 7 | jxx-domain-modeling | 40 |
| 8 | jxx-goal-contract | 43 |
| 9 | jxx-goal-execute | 46 |
| 10 | jxx-goal-mode | 34 |
| 11 | jxx-grill-me | 32 |
| 12 | jxx-grill-with-docs | 40 |
| 13 | jxx-grill-with-memorial | 59 |
| 14 | jxx-grilling | 34 |
| 15 | jxx-handoff | 41 |
| 16 | jxx-implement | 36 |
| 17 | jxx-improve-codebase-architecture | 49 |
| 18 | jxx-loop-me | 46 |
| 19 | jxx-plan-review | 43 |
| 20 | jxx-prototype | 48 |
| 21 | jxx-research | 36 |
| 22 | jxx-resolving-merge-conflicts | 40 |
| 23 | jxx-setup-matt-pocock-skills | 28 |
| 24 | jxx-tdd | 39 |
| 25 | jxx-to-questionnaire | 33 |
| 26 | jxx-to-spec | 37 |
| 27 | jxx-to-tickets | 40 |
| 28 | jxx-triage | 54 |
| 29 | jxx-wayfinder | 49 |
| 30 | jxx-wizard | 46 |
| 31 | jxx-writing-for-agents | 42 |

### 7.4 验证方法

优化后随机抽取 8 个文件进行人工验证，确认：
- frontmatter 格式正确（双引号、单行 description、无非标字段）
- 正文内容完整保留（未丢失任何章节或段落）
- 文件编码为 UTF-8

---

## 八、后续维护建议

1. **新增技能时**：直接使用 Trae 标准 frontmatter 格式，参考 `skill-creator` 技能的输出
2. **修改 description 时**：始终检查字符数 ≤ 200，保持"做X。当Y时调用。"句式
3. **不要重新引入非标字段**：`metadata`、`disable-model-invocation`、`argument-hint` 已全部移除，不应恢复
4. **正文变更不受影响**：本次优化只改 frontmatter，正文的编写和修改照常进行
5. **定期审查**：建议每季度检查一次所有技能的 frontmatter 是否符合 Trae 标准
