# 姜姓 Agent 风格改造经验文档（姜姓身份 + openCode frontmatter）

本文件记录将 `jxx-agent-generator` 的 9 个姜姓 agent 从 CodeBuddy frontmatter 迁移到 openCode frontmatter 的经验。**改造原则：保留姜姓身份设定（核心特色），只迁移 frontmatter 到 openCode permission/mode schema，并精简正文结构（删 `---`、合并护栏反模式）。** 源码依据：`packages/core/src/v1/config/agent.ts`、`packages/core/src/v1/config/permission.ts`、`.opencode/agent/triage.md`、`.opencode/agent/duplicate-pr.md`。

## 1. 改造原则

| 维度 | 改造前（CodeBuddy） | 改造后（openCode） | 是否保留 |
|------|---------------------|-------------------|---------|
| 姜姓身份 | `# 姜某 · 角色名` + "你姓姜，名叫姜某，扮演**角色名**" | 同左 | **保留**（核心特色） |
| 古风角色名 | 神机阁探事郎 / 刑律司主审官 / ... | 同左 | **保留** |
| 命名 | `姜某-角色名.md` | 同左 | **保留** |
| frontmatter | `tools`/`agentMode`/`enabled`/`enabledAutoRun` | `permission`/`mode` | **迁移** |
| `---` 分隔符 | 各模块间用 `---` | 删除，用 `##` 标题分隔 | **删除** |
| `通用护栏`/`通用反模式` | 带"通用"前缀 | 合并为 `护栏`/`反模式` | **合并** |
| 产物路径 | `~/.codebuddy/agents/<名字>.md` | `~/.opencode/agent/<名字>.md` | **迁移** |

## 2. openCode agent frontmatter 规范

### 2.1 已识别字段（KNOWN_KEYS）

源码 `packages/core/src/v1/config/agent.ts` 第 43-60 行 `KNOWN_KEYS` 集合：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | **从文件路径推导**，frontmatter 中的 `name` 会被覆盖（`configEntryNameFromPath`）。可省略。 |
| `model` | string | 模型 ID。可选。 |
| `variant` | string | 模型变体。可选。 |
| `prompt` | string | 系统提示。可选。markdown 正文会成为 `prompt`，此字段一般不用。 |
| `description` | string | 描述何时使用此 agent。可选但强烈建议。 |
| `temperature` | finite | 采样温度。可选。 |
| `top_p` | finite | nucleus 采样参数。可选。 |
| `mode` | "subagent" \| "primary" \| "all" | 模式。可选。 |
| `hidden` | boolean | 从 `@` 自动补全菜单隐藏（仅对 `mode: subagent` 生效，默认 false）。可选。 |
| `color` | #hex 或主题色名 | 颜色。可选。 |
| `steps` | positive int | 最大迭代步数。可选。 |
| `maxSteps` | positive int | **已废弃**，用 `steps` 代替。 |
| `options` | record | 额外选项。可选。 |
| `permission` | PermissionConfig | 权限规则。可选。**替代 `tools`**。 |
| `disable` | boolean | 禁用此 agent。可选。 |
| `tools` | Record<string, boolean> | **已废弃**，用 `permission` 代替。 |

**额外字段**会被 `normalize` 函数塞进 `options`，不会报错但不被识别。

### 2.2 CodeBuddy 特有字段（需删除）

以下字段在 CodeBuddy 中使用，但 openCode 不识别，会被静默塞入 `options`，应删除：

- `agentMode` — CodeBuddy 的 agent 模式（openCode 用 `mode`）
- `enabled` — CodeBuddy 的启用开关（openCode 用 `disable` 反向控制）
- `enabledAutoRun` — CodeBuddy 的自动运行开关（openCode 无对应概念）

### 2.3 permission 字段规范

源码 `packages/core/src/v1/config/permission.ts`：

**Action**：`"ask"` | `"allow"` | `"deny"`

**已知 permission 键**：

| 键 | 说明 |
|----|------|
| `read` | 读文件 |
| `edit` | 编辑/写入/删除文件（`write`/`edit`/`patch`/`delete` 都归入 `edit`） |
| `glob` | 文件名搜索 |
| `grep` | 内容搜索 |
| `list` | 列目录 |
| `bash` | 执行命令 |
| `task` | 子任务 |
| `lsp` | 语言服务器协议 |
| `webfetch` | 抓取 URL |
| `websearch` | 网络搜索 |
| `skill` | 调用技能 |
| `todowrite` | 写待办 |
| `question` | 向用户提问 |
| `external_directory` | 外部目录 |
| `doom_loop` | doom loop |

额外键通过 `StructWithRest` 允许。

### 2.4 tools → permission 转换

源码 `normalize` 函数（第 62-81 行）的转换逻辑：

```
for [tool, enabled] in tools:
  action = enabled ? "allow" : "deny"
  if tool in ("write", "edit", "patch"):
    permission.edit = action
  else:
    permission[tool] = action
```

**CodeBuddy 工具名 → openCode permission 键映射**：

| CodeBuddy | openCode permission |
|-----------|-------------------|
| `list_dir` | `list` |
| `search_file` | `glob` |
| `search_content` | `grep` |
| `read_file` | `read` |
| `read_lints` | `read`（或 `lsp`） |
| `replace_in_file` | `edit` |
| `write_to_file` | `edit` |
| `delete_file` | `edit` |
| `execute_command` | `bash` |
| `web_fetch` | `webfetch` |
| `web_search` | `websearch` |
| `use_skill` | `skill` |
| `lsp` | `lsp` |
| `task` | `task` |
| `preview_url` | 无直接映射，省略 |
| `connect_cloud_service` | 无直接映射，省略 |
| `automation_update` | 无直接映射，省略 |

### 2.5 frontmatter 模板

```yaml
---
description: <职责 + 扮演角色 + 触发词 + 分工边界，一段话>
mode: subagent
permission:
  read: allow
  edit: allow
  glob: allow
  grep: allow
  list: allow
  bash: allow
  lsp: allow
  task: allow
---
```

要点：
- **省略 `name`**：openCode 从文件路径推导，frontmatter 中的值会被覆盖。
- **用 `permission` 代替 `tools`**：`tools` 已废弃。
- **删除 `agentMode`/`enabled`/`enabledAutoRun`**：openCode 不识别。
- **加 `mode: subagent`**：姜姓 agent 都是被主控派发的子 agent。
- **`permission` 按需裁剪**：只留该 agent 实际用到的键，值为 `allow`。探索/审查类去掉 `edit`。需要联网再补 `webfetch`/`websearch`。需要调技能补 `skill`。

## 3. 姜姓 agent 正文风格（保留 + 精简）

### 3.1 源码范例提炼

从 openCode 内置 `triage.md`（43 行）和 `duplicate-pr.md`（26 行）提炼结构原则：

- **简短段落**，少量 `##` 分级
- **指令式语气**（Imperative/Do not）
- **无 emoji**
- **无 `---` 分隔符**
- **自包含**：不依赖外部文档

### 3.2 姜姓 agent 的适配策略

姜姓 agent **保留中文身份设定**（这是核心特色），但采用 openCode 的结构原则：

| 维度 | CodeBuddy 风格 | openCode 风格（改造后） |
|------|---------------|----------------------|
| 身份开场 | `# 姜某 · 角色名` + "你姓姜，名叫姜某，扮演**角色名**——气质" | **保留**（核心特色） |
| 章节分隔 | `---` 分隔各模块 | 删除 `---`，靠 `##` 标题分隔 |
| 章节层级 | `##` + `###` 多层 | 扁平化，尽量只用 `##` |
| 语气 | 命令式但含"你应该" | 指令式，删"你应该" |
| 篇幅 | 80-100 行 | 50-70 行（精简但保留核心内容） |
| emoji | 无 | 无（保持） |
| 工作流集成 | 专门一节 `## 与 memorial 工作流集成` | 压缩为定位段中一句，或保留简短一节 |
| 异常处理 | 表格 | 保留表格（信息密度高） |

### 3.3 正文结构模板

```markdown
# 姜某 · 角色名

你姓姜，名叫姜某，扮演**角色名**——<气质>。你的职责是<动词+对象>，<审查判断型补：回答唯一的问题："...">。

## 定位

<与相邻 agent/skill 的分工边界，2-4 条>

## 工作方法

<核心步骤，指令式，5-7 条>

## 护栏

<禁止事项，3-5 条>

## 反模式

<常见错误，3-5 条>

## 输出规范

<交付物格式，代码块给出模板>

## 异常处理

| 场景 | 处理方式 |
| ---- | -------- |
| ... | ... |
```

要点：
- **删除 `---` 分隔符**。
- **合并 `通用护栏`→`护栏`、`通用反模式`→`反模式`**（去掉"通用"前缀）。
- **`工作流集成` 压缩**：若内容简短，并入定位段；若重要，保留为 `## 工作流集成` 一节但不超过 3 行。
- **保留异常处理表格**：信息密度高，符合 openCode 实用风格。
- **保留姜姓身份开场**：`# 姜某 · 角色名` + "你姓姜，名叫姜某，扮演**角色名**" 不变。

## 4. 改造清单

### 4.1 9 个 agent 文件

| 文件 | 句式 | 核心改动 |
|------|------|---------|
| `姜捕头-神机阁探事郎.md` | B（审查判断） | tools→permission（含 webfetch/websearch/skill），删 `---`，合并护栏反模式 |
| `姜清规-标准审查官.md` | B | tools→permission（只读），删 `---` |
| `姜履约-spec验收官.md` | B | tools→permission（只读），删 `---` |
| `姜前端-天工画院总教头.md` | A（具体事务） | tools→permission（含 edit），删 `---` |
| `姜后端-工部营缮司大匠.md` | A | tools→permission（含 edit），删 `---` |
| `姜质检-将作监校书郎.md` | A | tools→permission（不含 edit），删 `---` |
| `姜设计-将作监画院待诏.md` | A | tools→permission（含 edit），删 `---` |
| `姜审计-御史台监察御史.md` | B | tools→permission（只读），删 `---` |
| `姜简-玉作司琢玉匠.md` | A | tools→permission（含 edit），删 `---` |

### 4.2 SKILL.md

- 保留 `metadata.version`（技能自身版本管理）
- 正文保留姜姓身份描述
- frontmatter 迁移说明保留姜姓身份，只迁移 frontmatter

### 4.3 references/ 下文档

- `frontmatter.md`：更新为 openCode permission schema
- `identity.md`：保留姜姓身份模板，更新写作规范（删 `---`、指令式）
- `examples.md`：保留姜姓范例，更新 frontmatter 示例为 openCode 风格

## 5. 验证方法

### 5.1 frontmatter 合法性

每个 agent 文件的 frontmatter 应：
- 只含 openCode 已识别字段（`description`、`mode`、`permission`、可选 `model`/`color`/`steps` 等）
- 不含 `name`（从路径推导）
- 不含 `tools`（已废弃）
- 不含 `agentMode`/`enabled`/`enabledAutoRun`（CodeBuddy 特有）
- `permission` 的键全是已知键或通配符 `*`
- `permission` 的值全是 `"allow"`/`"deny"`/`"ask"`

### 5.2 正文风格

- **保留姜姓身份开场**：`# 姜某 · 角色名` + "你姓姜，名叫姜某，扮演**角色名**"
- 无 `---` 分隔符
- 无 emoji
- 章节标题用 `##`（尽量不用 `###`）
- 语气指令式

### 5.3 姜姓身份完整性

- 标题为 `# 姜某 · 角色名` 格式
- 开场含"你姓姜，名叫姜某，扮演**角色名**"
- 文件名为 `姜某-角色名.md`
- 引用相邻 agent 用姜姓名（如"姜履约"），非功能名

## 6. 关键源码引用

- `packages/core/src/v1/config/agent.ts:43-60` — `KNOWN_KEYS` 集合
- `packages/core/src/v1/config/agent.ts:62-81` — `normalize` 函数（tools→permission 转换）
- `packages/core/src/v1/config/permission.ts:17-36` — permission 已知键
- `packages/opencode/src/config/agent.ts` — agent 文件加载逻辑（`{agent,agents}/**/*.md`）
- `.opencode/agent/triage.md` — openCode agent 范例（43 行）
- `.opencode/agent/duplicate-pr.md` — openCode agent 范例（26 行）

## 7. 改造后文件清单

`jxx-agent-generator` 技能目录改造后结构：

```
jxx-agent-generator/
├── SKILL.md                          # v2.0.0，姜姓身份 + openCode frontmatter
├── README.md                         # 用户友好说明
├── CHANGELOG.md                      # 记录 2.0.0 改造
├── LICENSE.txt                       # MIT
├── AGENT-STYLE-GUIDE.md              # 本文件
└── references/
    ├── frontmatter.md                # openCode permission schema
    ├── identity.md                   # 姜姓身份模板 + 写作规范
    ├── examples.md                   # 9 个姜姓范例摘要
    └── agent-examples/               # 9 个完整姜姓 agent 文件
        ├── 姜捕头-神机阁探事郎.md
        ├── 姜清规-标准审查官.md
        ├── 姜履约-spec验收官.md
        ├── 姜前端-天工画院总教头.md
        ├── 姜后端-工部营缮司大匠.md
        ├── 姜质检-将作监校书郎.md
        ├── 姜设计-将作监画院待诏.md
        ├── 姜审计-御史台监察御史.md
        └── 姜简-玉作司琢玉匠.md
```

## 8. 关键经验

1. **姜姓身份是核心特色，必须保留**：`# 姜某 · 角色名` + "你姓姜，名叫姜某，扮演**角色名**" 是这套 agent 的灵魂，不能去掉。
2. **只迁移 frontmatter，不动身份**：从 CodeBuddy `tools`/`agentMode`/`enabled` 迁移到 openCode `permission`/`mode`，正文身份设定不变。
3. **tools → permission 是关键转换**：逗号字符串 → YAML map，`write`/`edit`/`patch`/`delete` 归入 `edit`，值为 `allow`。
4. **删 `---` 分隔符**：openCode 风格用 `##` 标题分隔，不用 `---`。
5. **合并 `通用护栏`→`护栏`**：去掉"通用"前缀，精简结构。
6. **保留异常处理表格**：信息密度高，符合 openCode 实用风格。
7. **`permission` 按需裁剪**：只留该 agent 实际用到的键，探索/审查类去掉 `edit`，需要联网补 `webfetch`/`websearch`。
8. **产物路径迁移**：`~/.codebuddy/agents/` → `~/.opencode/agent/`。
