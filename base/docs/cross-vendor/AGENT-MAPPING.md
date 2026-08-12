# Agent 定义跨厂商映射规范

> **配套文档**：[`../HARNESS-SPEC.md`](../HARNESS-SPEC.md) §10（跨厂商 Hook 标注规约）、[`SKILL-METADATA-MAPPING.md`](./SKILL-METADATA-MAPPING.md)（Skills 元数据跨厂商映射）。
> **适用范围**：任何需将同一套自定义 Agent（子代理）定义同时提供给 **openCode / CodeBuddy / 华为 CodeArts / Trae** 四家厂商使用的工程，与具体仓库无关。
> **状态**：2026-08 调研结论，作为编写依据。

---

## 0. 为什么需要这份规范

Skills 解决"能力封装"，Agent（子代理）解决"角色与上下文隔离"。**Agent 定义四家同样不统一**——字段集、`name` 来源（frontmatter 显式 vs 文件路径）、是否支持绑定 Skill、权限表达方式都不同。

若忽略，会出现：

1. **加载失败**：openCode 的 Agent `name` 由**文件路径**决定、frontmatter 无 `name` 键；CodeBuddy/CodeArts/Trae 则 `name` 是必填 frontmatter 键——同一份文件四家表现不一。
2. **Skill 绑定丢失**：仅 CodeBuddy、CodeArts（界面）、Trae 支持 Agent 绑 Skill；openCode V2 **无 `skills` 字段**，Skill 绑定靠 `permissions` 或会话加载——直接搬会丢能力。
3. **权限语义冲突**：openCode 用 `permissions` 数组（`action/resource/effect`）；CodeBuddy 用 `permissionMode` + `disallowedTools`；CodeArts 用 `tools` 对象 + `permission.skill`；Trae 字段未完全公开。

策略同 Skills：**单源 `AGENT.src.md` + 脚本派生四份适配版**（见 §6）。

---

## 1. 四家 Agent 机制实测对照表

| 维度 | openCode | CodeBuddy | 华为 CodeArts | Trae |
| --- | --- | --- | --- | --- |
| 定义方式 | `agents/*.md`（Markdown frontmatter）或 JSON `agents` 字段 | `.codebuddy/agents/*.md` | `./.codeartsdoer/agents/*.md` | `.trae/agents/*.md` |
| 目录（项目级） | `.opencode/agents/` | `.codebuddy/agents/` | `.codeartsdoer/agents/` | `.trae/agents/` |
| 目录（用户级） | `~/.config/opencode/agents/` | `~/.codebuddy/agents/` | `%USERPROFILE%/.codeartsdoer/agents/` | `~/.trae-cn/agents/`（推断） |
| `name` 来源 | **文件路径即 ID**（无 `name` 键；`team/reviewer.md`→ID `team/reviewer`） | frontmatter `name` 必填，小写连字符唯一 | frontmatter `name` 必填，且**须与文件名一致** | frontmatter `name` 必填 |
| `description` | 可选（子代理强烈推荐） | 必填 | 必填 | 必填 |
| `model` | `provider/model#variant` | 模型 ID / `lite`/`reasoning`/`inherit` | `provider/model-id`（如 `inferhub-provider/GLM-5.1`） | 支持 `model` 字段 |
| `tools` | **无 `tools` 字段**；工具权限走 `permissions` | `tools: 逗号列表`，可 `Defer(X)`/`NoDefer(X)`；`disallowedTools` | `tools` 对象：`{read,write,edit,bash,glob,grep,list,task,webfetch,websearch,question}`，`"*":false` 禁用全部 | `tools` 字段（实战印证） |
| `skills` 绑定 | **无 frontmatter 字段**（V2 禁止）；靠会话/SKILL 目录加载 | `skills: 逗号列表` 启动即加载 | 界面/控制台绑定为主；Markdown 仅 `permission.skill` 控制拒绝 | 支持（生态关联） |
| 权限表达 | `permissions` 数组：`action`/`resource`/`effect`(allow/ask/deny)，通配符 | `permissionMode`：`default`/`acceptEdits`/`bypassPermissions`/`plan`/`ignore` + `disallowedTools` | `tools` 对象 + `permission: skill: '*': deny` | 未完全公开 |
| `mode` | `primary`/`subagent`/`all`（默认 `all`） | 子代理专用（无主/子 frontmatter 区分，靠调用方式） | `subagent`/`primary`/`all` | 未公开 |
| 其他字段 | `steps`/`hidden`/`color`/`disabled`/`request`/`system` | `effort`/`maxTurns`/`background`/`initialPrompt`/`memory`/`mcpServers` | `permission`（控制 skill 拒绝） | `mcp.json` 关联 |
| 嵌套子代理 | 父 `permissions` 控 `subagent` 动作；子默认不可再 spawn | 封顶 5 层；需显式 `tools: Agent` | 未明说 | 未明说 |
| 语言要求 | 不限 | 不限 | 正文建议英文（同 Skills 约束） | 不限 |

### 1.1 字段级差异详解

- **`name` 来源冲突（最关键）**：openCode **不读 frontmatter `name`**，ID 由路径决定；其余三家 `name` 必填且（CodeArts）须等于文件名。→ 派生规则见 §3。
- **`tools` 语义冲突**：openCode **无 `tools` 字段**（写 `tools` 无效）；CodeBuddy/CodeArts/Trae 有 `tools`。→ 源文件不写 `tools`，由适配层按家注入：openCode 映射为 `permissions` 规则，其余写 `tools`。
- **`skills` 绑定冲突**：openCode 不支持；CodeBuddy/Trae 用 `skills` 字段；CodeArts 走界面。→ 源文件声明 `x-vendors.skills`，仅注入支持的家（§4）。
- **权限模型不互通**：四家权限字段完全不同。→ 源文件用**统一抽象权限描述**，适配层转译（§5）。
- **`mode` 差异**：openCode/CodeArts 有 `mode`；CodeBuddy 子代理靠调用方式；Trae 未公开。→ 源文件 `x-vendors.mode` 仅对 openCode/CodeArts 生效。

---

## 2. 总体策略：单源 + 派生

```
agents/<agent>/
├── AGENT.src.md           # 厂商无关源文件（唯一手写维护对象）
└── .generated/            # 派生产物（脚本生成，不手写）
    ├── opencode/agents/<id>.md
    ├── codebuddy/agents/<name>.md
    ├── codearts/agents/<name>.md
    └── trae/agents/<name>.md
```

与 `SKILL-METADATA-MAPPING.md` §2 完全对称。源文件含 `x-vendors` 扩展段描述各厂商专属字段。

> 为何不手写四份？同 SKILL 理由：漂移 + 违反"代码强制"原则。

---

## 3. `name` 与路径跨厂商映射

| 厂商 | 派生文件名 / ID | 规则 |
| --- | --- | --- |
| openCode | `.opencode/agents/<path>.md`，ID=`<path>` | frontmatter **不写 name**；路径即 ID。子目录结构保留（如 `team/reviewer.md`→ID `team/reviewer`） |
| CodeBuddy | `.codebuddy/agents/<name>.md` | frontmatter `name: <name>`，小写连字符 |
| CodeArts | `.codeartsdoer/agents/<name>.md` | frontmatter `name: <name>` **且文件名须等于 name** |
| Trae | `.trae/agents/<name>.md` | frontmatter `name: <name>` |

**源文件规则**：

- 源 `AGENT.src.md` 所在目录名即通用 `<name>`（小写连字符，如 `code-reviewer`），满足 openCode 路径 ID 与 CodeBuddy/CodeArts/Trae 的 `name` 要求。
- 若需 openCode 子目录分组（如 `team/reviewer`），源目录建为 `agents/team/reviewer/AGENT.src.md`，派生 openCode 时路径保留 `team/reviewer`。

---

## 4. `skills` 绑定跨厂商处理

- 源文件 `x-vendors.skills: [skill-a, skill-b]` 声明该 Agent 应加载的 Skill。
- 派生：
  - **CodeBuddy**：注入 `skills: skill-a, skill-b`（frontmatter）。
  - **Trae**：注入 `skills` 关联（依其生态字段）。
  - **CodeArts**：Markdown 方式**无法直绑**，改为在派生版注释中提示"需在 IDE/控制台为 `name` 关联 skill-a、skill-b"；或源即提供 `permission.skill` 白名单。本规范建议：CodeArts 派生版 `description` 末尾追加"（关联技能：skill-a, skill-b）"作为人工提示。
  - **openCode**：V2 **无 skills 字段**；Skill 通过 SKILL 目录自动发现加载，Agent 无需显式绑定。派生版不写 `skills`，但确保对应 Skill 已按 `SKILL-METADATA-MAPPING.md` 安装到 `.opencode/skills/`。

> 跨厂商 Skill 名须一致（见 SKILL 规范的 `name` 映射），否则 CodeArts/Trae 关联会失效。

---

## 5. 权限抽象与转译

源文件用**统一抽象权限描述**（不绑定任何一家语法）：

```yaml
x-vendors:
  permissions:
    allow: [read, grep, glob, list]        # 抽象动作
    deny: [bash, edit]                      # 抽象动作
    skill-deny: ["*"]                       # 拒绝所有 skill（如纯规则代理）
```

适配层转译：

- **openCode** → `permissions` 数组：

  ```yaml
  permissions:
    - action: read
      effect: allow
    - action: edit
      effect: deny
  ```

  （`bash` 映射 `action: shell`；`skill-deny: ["*"]` 暂无法在 V2 frontmatter 表达，改为 SKILL 目录隔离）

- **CodeBuddy** → `permissionMode` + `disallowedTools`：

  ```yaml
  permissionMode: default
  disallowedTools: [bash, edit]
  ```

- **CodeArts** → `tools` 对象（仅列 allow 的动作，未列即隐式禁用；或用 `"*": false` 后显式开）：

  ```yaml
  tools: { read: true, grep: true, glob: true, list: true, bash: false, edit: false }
  ```

  若 `skill-deny: ["*"]` → 加 `permission: { skill: { "*": deny } }`

- **Trae** → 依其权限字段（未完全公开），暂以 `tools` 列表 + 备注形式输出。

> 抽象动作集 `{read, edit, write, bash, grep, glob, list, task, webfetch, websearch, question}` 对齐 CodeArts `tools` 对象键，作为跨家最小公约数。

---

## 6. 生成脚本接口（`gen-agent-meta.mjs`）

与 `gen-skill-meta.mjs` 对称（HARNESS-SPEC §9 要求 `.mjs` + UTF-8）。

**输入**：`AGENT.src.md`（frontmatter + `x-vendors`）。
**输出**：`.generated/{opencode,codebuddy,codearts,trae}/agents/<id-or-name>.md`。

**CLI**：

```
node gen-agent-meta.mjs <agentDir>
node gen-agent-meta.mjs --all
```

**主干**：

```
1. 读 AGENT.src.md (utf-8)
2. 解析 → {common, x-vendors}
3. 对各 vendor:
   a. name/path: 按 §3
   b. description: 源正文（codearts 英文块，见 SKILL 规范 §5）
   c. model: 映射各厂家 model 格式
   d. tools: openCode→permissions 数组；其余→tools 字段
   e. skills: 按 §4 注入或注释
   f. permissions: 按 §5 转译
   g. 写 .generated/<vendor>/agents/...
4. 校验：openCode 无 name 键；codearts name==文件名；codebuddy name 小写连字符
```

---

## 7. 目录落地矩阵

| 厂商 | 项目级安装目录 | 派生产物 |
| --- | --- | --- |
| openCode | `.opencode/agents/` | `.generated/opencode/agents/` |
| CodeBuddy | `.codebuddy/agents/` | `.generated/codebuddy/agents/` |
| CodeArts | `.codeartsdoer/agents/` | `.generated/codearts/agents/` |
| Trae | `.trae/agents/` | `.generated/trae/agents/` |

---

## 8. 与 Skills 规范的衔接

- Agent 引用的 Skill 名必须与 `SKILL-METADATA-MAPPING.md` 产出的各厂商 Skill 名一致（§4）。
- 既有的非标准目录结构（如中文目录名、非扫描目录下的 Agent 定义）若需服务四家，应迁移为 `agents/<agent>/AGENT.src.md` 单源结构并按本规范派生。
- Hook（HARNESS-SPEC §10）与 Agent 可组合：Agent 内可声明需某 Hook（如 pre-commit 拦截），此时该 Agent 的 `x-vendors` 须同时参照 HARNESS-SPEC §10 的 Hook 适配。

---

## 9. 检查清单（新增/改造 Agent 时）

- [ ] 源文件 `AGENT.src.md`，目录名/通用 `name` 小写连字符、≤64
- [ ] frontmatter 不含 `name`（openCode 由路径决定），`name` 仅出现在 `x-vendors`
- [ ] 含 `x-vendors.permissions`（抽象 allow/deny）、`x-vendors.skills`（如需绑 Skill）
- [ ] CodeArts 所需英文 `description`/正文块已提供
- [ ] 运行 `gen-agent-meta.mjs` 四家生成成功、校验通过（openCode 无 name 键、codearts name==文件名）
- [ ] 四家 `agents/` 目录安装后各自可被对应 Agent 扫描加载
- [ ] 引用的 Skill 名与各厂商 Skill 派生名一致（§4 / SKILL 规范）
- [ ] 若含 Hook，同步满足 HARNESS-SPEC §10 标注
