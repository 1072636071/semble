# TRAE 技能（Skill）编写规范

本规范基于 [TRAE 官方技能文档](https://docs.trae.cn/ide_skills) 与 [Skill 编写最佳实践](https://docs.trae.cn/ide_best-practice-for-how-to-write-a-good-skill) 凝练而成，作为本目录下所有技能（`jxx-*`、`impeccable` 等）的统一编写与评审依据。

> 本文档为目录级约定，优先级高于各技能内部的历史写法。新增技能或修改既有技能时，必须满足本规范。

---

## 1. 技能是什么

一个 Skill 是一份**清晰、严谨、可执行的指令文档**，用于明确告诉模型：

- **When** —— 在什么条件下触发
- **How** —— 按照哪些步骤执行
- **What** —— 产出什么结果

技能不是写给人看的说明文档，也不是一次性的 Prompt；它是可长期复用、输入输出明确的能力模块，强调稳定、确定、易于工程化维护。

### 常见认知误区

| 误区 | 纠正 |
|------|------|
| Skill 等同于一段 Prompt | Skill 是可复用的能力模块，非临时对话提示 |
| Skill 是写给人看的文档 | Skill 是下达给模型的指令，不是原理解释 |
| Skill 越复杂越强大 | 职责单一、边界清晰的 Skill 更易被正确触发 |

---

## 2. 目录结构

每个技能必须包含一个 `SKILL.md`，可选附带脚本、模板、参考文档等资源：

```
skill-name/
├── SKILL.md               # （必须）智能体的核心指令
├── README.md              # （推荐）面向人的简介
├── CHANGELOG.md           # （可选）版本变更记录
├── LICENSE.txt             # （可选）许可证
├── examples/              # （可选）输入/输出示例
│   ├── input.md
│   └── output.md
├── templates/             # （可选）可复用模板
│   └── component.tsx
├── references/             # （可选）参考文档（按需加载）
│   └── style-guide.md
├── scripts/                # （可选）可执行脚本
│   └── detect.mjs
└── assets/                # （可选）素材资源
    └── icon.svg
```

### 技能所在目录

- **项目技能**：项目路径下 `.trae/skills/` 目录
- **全局技能**：
  - macOS/Linux：`~/.trae-cn/skills`
  - Windows：`%userprofile%/.trae-cn/skills`

---

## 3. SKILL.md 文件格式

### 3.1 Frontmatter（YAML 头部）

```markdown
---
name: skill-name
description: 用于描述技能能力及触发场景的简短说明（第三人称，从模型视角）
metadata:
  version: 1.0.0
---
```

**必填字段**：

| 字段 | 约束 |
|------|------|
| `name` | 简洁唯一标识符；小写字母 + 数字 + 连字符（`-`）；推荐动名词形式（如 `running-tests`）；长度 ≤ 64 字符；**必须与父目录名一致** |
| `description` | 第三人称，从模型视角描述；包含核心功能与触发时机关键词；长度 ≤ 1024 字符；**这是技能被发现的唯一入口** |

**可选字段**：

| 字段 | 用途 |
|------|------|
| `metadata.version` | 语义化版本号 |

**禁止字段**（本目录统一移除）：

- `disable-model-invocation` —— 非 TRAE 标准字段，不参与本目录规范
- `license`、`compatibility` —— 暂不使用

### 3.2 name 字段规范

| 规则 | ✅ 好的例子 | ❌ 坏的例子 |
|------|------------|------------|
| 简洁唯一 | `code-review` | `test-helper`（语义模糊） |
| 小写+连字符 | `database-migration` | `deployService`（命名不规范） |
| 动名词优先 | `running-tests` | `data-skill-v2`（含版本信息） |
| 无前后连字符 | `fast-search` | `-search`、`search-` |
| 无连续连字符 | `my-skill` | `fast--search` |

### 3.3 description 字段规范

从**模型视角**用**第三人称**描述，同时覆盖"做什么"与"何时触发"：

- ✅ 好的例子："用于从两个维度审查自固定点以来的代码变更——标准与 spec。当用户想审查 branch、PR、进行中的变更，或要求'审查自 X 以来'时触发。"
- ❌ 坏的例子 1："我可以帮你审查代码"（第一人称）
- ❌ 坏的例子 2："帮助进行代码审查"（缺乏触发时机）
- ❌ 坏的例子 3："jxx-code-review 技能"（只是名字复述）

---

## 4. 正文结构

`SKILL.md` 主体内容推荐采用以下结构（章节可按需增减，但顺序保持一致）：

```markdown
# 技能名称

一段简短的能力概述（1-3 句，说明这个技能做什么）。

## 使用场景

**何时使用：**
- 触发条件 1
- 触发条件 2

**何时不用：**
- 排除条件 1
- 排除条件 2

## 指令

清晰的分步说明，告诉智能体具体怎么做。

### 步骤 1：xxx
...

### 步骤 2：xxx
...

## 输入 / 输出（可选）

Input:
- xxx: string  # 参数说明

Output:
- xxx: object  # 输出说明

## 失败策略（可选）

- 场景 A 失败：处理方式
- 场景 B 失败：处理方式

## 示例（可选）

输入/输出示例，展示预期效果。

## 参考

- [references/xxx.md](references/xxx.md) —— 进阶用法
```

> 已有内容的技能，按上述结构重新组织章节标题，但**保留其核心指令内容**，不强行塞入不适用的章节。

---

## 5. 五个核心标准

这是高命中率、高稳定性 Skill 的基础，可作为设计与评审检查清单。

### 5.1 边界明确

模型最容易犯的错误不是"不知道怎么做"，而是"不知道什么时候该做"。必须给出**正向条件**与**负向条件**：

✅ 边界清晰：

```
何时使用：
- 用户意图是触发 CI/CD 流水线执行单元测试
- PR 状态为"待合并"，需要执行自动检查

何时不用：
- 用户只是查看测试报告或 CI/CD 状态
- PR 仅修改文档或注释
```

❌ 边界不清晰：

```
何时使用：用户想让流水线跑一下测试
何时不用：用户只是在看 PR
```

### 5.2 输入输出结构化

推荐用类似函数签名的方式明确 Input 和 Output：

```yaml
Input:
- prId: string       # PR 编号
- branch: string     # 分支名称
- runTests: boolean  # 是否执行单元测试

Output:
- success: boolean           # 是否成功执行
- testReport?: object[]      # 测试报告（可选）
- errorMessage?: string      # 错误信息（失败时返回）
```

### 5.3 步骤明确、可执行

步骤必须是**指令式、具体动作**，不是概括性描述：

✅ 指令式步骤：

```
1. 校验 PR：检查 prId 和 branch 是否有效
2. 切换分支：checkout 到指定分支
3. 运行测试：根据 runTests 执行单元测试
4. 收集结果：汇总测试报告
5. 回写状态：将测试状态更新到 PR
```

❌ 描述性语言："检查 PR，运行测试，然后更新状态。"

### 5.4 失败策略完备

必须明确"失败路径"，避免模型自由发挥：

```yaml
失败处理：
- 校验失败：返回具体错误信息，提示修正字段
- 测试执行失败：自动重试一次，仍失败则报告"单元测试未通过，请检查日志"
- 服务不可用：重试最多 3 次，仍失败则记录日志并通知
```

### 5.5 职责绝对单一

每个 Skill 只做一件事，对应一个核心动作动词。避免把多个功能捆绑：

✅ 单一职责：
- `running-unit-tests`：只负责执行单元测试
- `updating-pr-status`：只负责更新 PR 状态
- `sending-notification`：只负责发送通知

❌ 功能捆绑：一个 Skill 同时完成"运行测试 + 更新 PR + 发送通知 + 执行 lint"。

---

## 6. 渐进式披露（Progressive Disclosure）

`SKILL.md` 应作为技能的**入口和导航**，而非包罗万象的大文件。技能加载分三层：

| 层级 | 内容 | 加载时机 | 预算 |
|------|------|----------|------|
| 1. 元数据 | `name` + `description` | 始终在上下文 | ~100 词 |
| 2. SKILL.md 正文 | 主体指令 | 技能触发时加载 | < 500 行 |
| 3. 捆绑资源 | scripts / references / assets | 按需读取 | 无上限 |

### 最佳实践

- **保持 SKILL.md 简洁**：主体内容控制在 500 行以内，只包含必要信息
- **避免深度嵌套**：所有引用文件**直接由 SKILL.md 链接**，保持一层引用深度，避免链式引用（A → B → C）
- **为长文件添加目录**：超过 100 行的参考文件，在文件顶部添加 Table of Contents
- **拆分变体**：支持多框架/多变体的技能，把变体细节移入 `references/`，正文只保留核心流程与选择指引

### 示例

```markdown
# SKILL.md

## 基础用法
描述核心触发与执行流程：
- 检查 PR 状态
- 执行单元测试
- 更新 PR 测试状态

## 高级功能
详细说明参见 [ci-advanced-features.md](references/ci-advanced-features.md)：
- 并行执行多分支测试
- 条件触发不同类型的测试

## API 参考
所有方法与参数说明参见 [ci-api-reference.md](references/ci-api-reference.md)。
```

---

## 7. 工作流与反馈闭环

对于多步骤、中间结果影响最终质量的复杂任务，必须显式定义工作流与检查清单，建立"验证 → 修正 → 再验证"的反馈闭环。

### 分析类任务工作流示例

```text
## 技术方案评估工作流

执行前复制以下清单，每步完成后显式标记状态。

- Step 1：明确业务目标与技术约束（性能、成本、时限）
- Step 2：列出所有可行的技术方案
- Step 3：从复杂度、可维护性、风险角度逐一评估
- Step 4：对比分析关键差异点
  （反馈闭环）若关键信息不足，返回 Step 2 或 Step 3 补充
- Step 5：给出结论性建议，说明取舍理由
  （反馈闭环）若结论无法支撑目标约束，重新审视 Step 1 前提
```

### 代码类任务工作流示例

代码类任务往往伴随不可逆操作，采用"计划 → 验证 → 执行"模式：

```text
## 依赖版本升级工作流

- Step 1（Plan）：识别需升级的依赖及当前版本；阅读 Release Notes 与 Breaking Changes
- Step 2（Plan）：更新依赖配置文件；标注可能受影响的模块
- Step 3（Validate）：执行依赖冲突检查与静态构建
  （反馈闭环）若校验失败，必须回退到 Step 2 调整配置
- Step 4（Execute）：安装新版本依赖；运行完整测试集
- Step 5（Validate）：检查核心功能是否受影响；对比升级前后构建结果
  （反馈闭环）若出现回归问题，回滚升级并记录风险点
```

---

## 8. 可执行脚本的加固原则

当 Skill 依赖可执行脚本时，脚本健壮性优先于代码巧妙性。Skill 本身不阅读代码逻辑，只感知输入输出；脚本行为不可预测时，模型只能猜测。

### 8.1 显式处理错误

不要把异常直接抛给模型。覆盖常见错误场景，将技术异常转化为可理解、可决策的输出：

```text
ERROR: Config file not found: ./deploy.yaml
HINT: Please check whether the file path is correct or run init-config.sh to generate a default config.
```

### 8.2 输出自解释的日志与验证结果

脚本输出本身就是模型的上下文，既说明发生了什么，也说明为什么以及下一步可以怎么做：

```text
CHECK FAILED: Node.js version mismatch
- Required: >= 18.0.0
- Detected: 16.14.0

VALID OPTIONS:
1. Upgrade Node.js to a supported version
2. Switch to a compatible build image
```

### 8.3 避免魔法数字

任何影响行为的数值都应可解释、可调整：

```text
TIMEOUT_SECONDS = 30  # Wait up to 30s because service startup usually completes within 10–20s
```

---

## 9. 构建与迭代流程

遵循"评测驱动、失败优先"原则：

1. **建立"无 Skill"基线** —— 先不用 Skill 让模型执行目标任务，记录不稳定、歧义、走偏的场景
2. **以失败优先定义评测用例** —— 针对已识别问题设计 3-5 个可复现用例，明确"通过/失败"判定标准
3. **编写最小化 Skill** —— 只写刚好能通过当前评测的最小规则集合，明确失败条件与最短成功路径
4. **迭代** —— 在真实任务中发现新的失败点，扩充评测用例，再扩充 Skill

---

## 10. 本目录特有约定

以下为本目录（`E:\work\sp\JwikisSkills\trae\`）的额外约定：

### 10.1 命名

- 保留 `jxx-` 前缀作为项目标识，符合 TRAE 小写+连字符规范
- `impeccable` 等无前缀技能保持原名
- 新增技能不强制加 `jxx-` 前缀，但建议保持项目内命名一致

### 10.2 description 语言

- 统一使用**中文**，与用户主语言一致
- 采用**第三人称、从模型视角**描述
- 句式约定："用于……。当……时触发。" 或 "用于……，适用于……场景。"

### 10.3 frontmatter

- 仅保留 `name`、`description`、`metadata.version` 三个字段
- 移除 `disable-model-invocation` 等非标准字段

### 10.4 正文语言

- 主体指令使用中文
- 代码示例、命令、文件名保持原文
- 引用文件路径使用相对路径

### 10.5 引用文件目录

- 参考文档统一放 `references/`（与 TRAE 官方一致）
- 模板放 `templates/`，脚本放 `scripts/`，素材放 `assets/`
- 既有技能的历史目录名（如直接放在根目录的 `.md` 文件）保持不变，避免破坏引用

---

## 11. 评审检查清单

修改或新增技能时，对照以下清单逐项检查：

- [ ] `name` 与父目录名一致，小写+连字符，≤ 64 字符
- [ ] `description` 第三人称、中文、含触发关键词，≤ 1024 字符
- [ ] frontmatter 仅含 `name`、`description`、`metadata.version`
- [ ] 正文含"使用场景"（含正向与负向条件）
- [ ] 步骤是指令式、可执行的具体动作
- [ ] SKILL.md 主体 ≤ 500 行
- [ ] 引用文件一层深度，直接由 SKILL.md 链接
- [ ] 超过 100 行的参考文件含目录
- [ ] 脚本（若有）显式处理错误、输出自解释
- [ ] 职责单一，对应一个核心动作动词

---

## 参考资料

- [TRAE 技能官方文档](https://docs.trae.cn/ide_skills)
- [如何写好一个 Skill：从创建到迭代的最佳实践](https://docs.trae.cn/ide_best-practice-for-how-to-write-a-good-skill)
- [研发场景十大热门 Skill 推荐](https://docs.trae.cn/ide_top-10-recommended-skills-for-development-scenarios)
- [TRAE 官方文档索引](https://docs.trae.cn/llms.txt)
