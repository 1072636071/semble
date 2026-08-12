# Agent Harness 工程规范

> **核心原则**：约束、反馈与产出校验能用代码保证的，绝不写进提示词。
> 提示词负责"意图、步骤与风格"，Harness（代码层）负责"正确性与可靠性"。

**适用范围**：所有以 Skill / Agent 定义 / 提示词文档为主载体的 Agent 工程，与具体仓库、厂商无关。

**配套规范**：

- 文档写作层以 mattpocock 的 `writing-for-agents` 技能为准（信息层级、context pointer、剪枝纪律）。本规范约束"什么该下沉到代码层"，该技能约束"文档怎么写"；两者冲突时，以 `writing-for-agents` 为准。
- 跨厂商元数据适配见 [`cross-vendor/SKILL-METADATA-MAPPING.md`](./cross-vendor/SKILL-METADATA-MAPPING.md) 与 [`cross-vendor/AGENT-MAPPING.md`](./cross-vendor/AGENT-MAPPING.md)。

**行业对标**：本规范的设计哲学（约束/反馈下沉到代码层、提示词剪枝瘦身）对齐 2026 年公开实践——OpenAI Agents SDK 的 Guardrails（input/output/tool 三级 + Tripwire fail-fast）、Anthropic 的 Agent Harness 工程与《Building Effective Agents》，以及 LangChain 在 TerminalBench 2.0 验证的"仅优化 Harness 即可提升通过率"。

---

## 1. 总则

| 维度 | 反模式（提示词承担） | 规范做法（代码承担） |
|------|--------------------|---------------------|
| 约束 | "禁止做 X" | Guardrails、Schema 校验、权限白名单 |
| 反馈 | "请自我反思" | 自动化测试、Lint、环境返回值 |
| 工具 | 自然语言描述工具用法 | 结构化 API 接口定义 |

**判定准则**：每写一条约束/反馈/校验类规则前，先问——这条规则能否用代码强制？若能，必须用代码实现，提示词中不再出现。步骤类内容不适用此准则：步骤是文档信息层级的第一层级（见 §4）。

---

## 2. 约束层（Constraints）

### 2.1 Guardrails 代码化

- 所有"禁止事项"必须落地为可执行的拦截逻辑，而非 SKILL.md / System Prompt 中的祈使句。
- 拦截点分三级：
  1. **输入过滤器**：对进入模型的用户输入/外部内容做清洗与校验（注入检测、越权请求识别）。
  2. **工具调用沙箱**：工具执行前的参数校验与权限检查（见 §2.3）。
  3. **输出验证器**：对模型输出做结构化校验（Schema、敏感信息泄漏扫描）。

### 2.2 Schema 校验

- 产出物（目标文档、工单、报告等）若有结构要求，必须提供：
  - 机器可读的 Schema（JSON Schema / 模板文件）；
  - 校验脚本，供 Harness 在产出后自动执行。
- 提示词中只保留一句"产出须通过 `validate` 校验"，不再罗列格式细则。

### 2.3 权限白名单

- 危险操作（写文件、执行命令、网络请求、git 变更）采用**白名单制**：默认拒绝，显式声明允许。
- 白名单由 Harness 在运行时强制执行，而非靠提示词"请谨慎操作"。声明示例：

```json
{
  "allowed_tools": ["read_file", "search_content"],
  "allowed_paths": ["src/**"],
  "deny_commands": ["rm -rf", "git push --force"]
}
```

> 实现形态不限：frontmatter / `permissions.json` 运行时白名单是一种形态；"沙箱 + Hooks + human-in-the-loop"是 2026 年主流等价形态。按所用平台能力选择，但必须有代码级防护，不得退化为提示词祈使句。

---

## 3. 反馈回路（Feedback Loops）

### 3.1 以环境反馈替代自我反思

- 禁止在提示词中写"完成后请自我检查/反思"。一切"检查"必须是 Harness 执行的真实命令：
  - 代码任务：跑测试、Lint、类型检查，将**退出码与输出**回灌给模型。
  - 文档/配置任务：跑 Schema 校验、链接检查。
- 提示词只声明："以 `<命令>` 的返回结果为准，非 0 退出码必须修复。"

### 3.2 测试即规格

- 每个改变行为的 Skill/脚本，验收标准必须体现为可运行的测试用例或断言脚本。
- 没有自动化验收手段的 Skill 不得标记为生产可用。

### 3.3 失败信号的契约

- 反馈信息必须结构化：明确的成功/失败标记 + 机器可解析的错误位置（文件、行号、规则名）。
- 模糊的口头反馈（"看起来没问题"）不构成反馈回路。

---

## 4. 步骤与状态（Steps & State）

- **步骤属于文档，不属于代码**：多步骤流程以文档内步骤（in-file steps）表达，遵循 `writing-for-agents`——步骤是信息层级中的第一层级，每步须落到清晰、可检查的完成判据（completion criterion）。不以 FSM/DAG 替代文档中的步骤定义，也不从提示词中删除流程步骤。
- **状态的持久化属于代码**：需断点续跑的流程，其当前状态持久化在文件中（如 `<state-dir>/state.json`），不依赖模型记忆。
- **执行层控制属于代码**：重试次数、超时、回退由 Harness 实现。
- 步骤序列的切分是写作决策（按 sequence / invocation 切分，见 `writing-for-agents`），而非 Harness 编排决策。

---

## 5. 工具协调（Tool Orchestration）

### 5.1 结构化接口定义

- 每个工具/脚本必须有机器可读的接口定义：名称、参数 Schema、返回值 Schema、错误码。
- 文档中描述工具时，引用接口定义文件，而非用自然语言复述参数用法。

### 5.2 调用约定

- 工具返回建议采用统一信封结构，便于 Harness 统一处理：

```json
{
  "ok": true,
  "data": {},
  "error": { "code": "E_VALIDATION", "message": "...", "retryable": false }
}
```

- 工具组合（串行/并行/条件分支）由 Harness 的工作流定义描述，模型不即兴编排多工具序列。

> 统一信封为推荐约定，业界（OpenAI Agents SDK 等）无强制标准，按平台能力裁剪。

---

## 6. 提示词与文档编写规范

### 6.1 瘦身 System Prompt

瘦身不是删除步骤，而是删除**不挣预算的行**。按 `writing-for-agents` 的剪枝纪律执行：

- **删 no-op**：模型默认就会做的指令逐句删除（如"请自我检查/反思"）。
- **删缓存**：环境能查到的内容（`--help` 输出、配置、目录布局、工具参数用法）不留自然语言复述。
- **下沉 reference**：非每个分支都需要的参考材料移到独立文件、以指针触发；步骤（steps）保留在文档主体，是第一层级。
- **禁令代码化**：约束类"禁止事项"按 §2 落地为代码拦截，不以祈使句占据提示词；个别必须保留的禁令须与正向目标成对出现（否定式写法会让被禁行为更可用）。

### 6.2 审查清单

新增/修改 Agent 或 Skill 时，逐项自查：

- [ ] 约束/反馈/校验类规则都已确认"无法用代码强制"吗？
- [ ] 危险操作有白名单声明吗？
- [ ] 验收标准有对应的自动化测试/校验脚本吗？
- [ ] 每个步骤都有清晰、可检查的完成判据吗？
- [ ] 工具用法引用了结构化定义，还是自然语言复述？
- [ ] 是否逐句删掉了 no-op 与环境缓存，reference 已下沉到指针之后？

---

## 7. 角色与职责

### Harness Engineer（护栏工程师）

随着约束、反馈、编排下沉到代码层，核心价值从"提示词技巧"转移为：

- **系统设计**：划分模型自主区与 Harness 确定区的边界；
- **测试工程**：为每个 Skill 构建可执行的验收回路；
- **可靠性保障**：Guardrails、沙箱、重试/回退策略的建设与维护。

评审 Skill 质量时，按此角色的视角发问：*这段提示词是在弥补 Harness 的缺失吗？如果是，应该补 Harness，而不是补提示词。*

---

## 8. 落地优先级

1. **P0**：危险操作防护、可运行验收回路（防错 + 早期反馈；对齐 2026 大厂将 evals/guardrails 列为早期必做）。
2. **P1**：产出物 Schema 校验、测试/Lint 反馈回路接入所有 Skill（保质）。
3. **P2**：关键多步 Skill 的步骤完成判据清晰化与状态持久化（断点续跑）。
4. **P3**：工具接口定义统一、提示词按 §6.1 剪枝（提效）。

---

## 9. 脚本编写规约

Harness 的"代码强制"最终落到脚本上。编写脚本时遵循：

- **优先使用 JavaScript（`.mjs`）**：能用 JS 完成的脚本（文件扫描、Schema 校验、链接检查、状态读写等）一律用 Node `.mjs` 实现，而非 Shell/Python。理由：跨平台（Windows/Unix）无 shell 解释器差异、单一语言降低维护面、便于 `import` 复用模块。仅在确实无法用 JS 实现（如调用外部 CLI 管道）时才退回 Shell，并尽量用 `.mjs` 的 `child_process` 统一封装。
- **编码必须显式处理 UTF-8**：
  - 读取/写入文本一律以 `utf-8` 为准，禁止依赖操作系统默认编码（Windows 下 PowerShell/cmd 默认常为非 UTF-8，易导致中文乱码）。
  - Node 侧：`fs.readFile(path, 'utf-8')` / `fs.writeFile(path, content, 'utf-8')`；跨进程读取外部命令输出时，显式指定 `{ encoding: 'utf-8' }` 并通过 `chcp 65001`（Windows）或 `env LANG` 保证子进程输出为 UTF-8。
  - 处理含中文/emoji 的路径或内容时，避免使用依赖字节序的旧 API；正则与切片操作按"字符"而非"字节"处理。
  - 脚本若向终端打印日志，输出前确认 stdout 为 UTF-8（CI 环境常见 cp1252，需 `process.stdout.setDefaultEncoding('utf-8')` 或在调用链上层设置）。

---

## 10. 跨厂商 Hook 标注规约

目标厂商 Agent：**openCode、CodeBuddy、华为 CodeArts（码道）、Trae**。Hook 是强厂商耦合点——四家的 hook 机制**互不兼容**（JSON 声明 vs TS 插件、路径与事件名各不同），因此**任何含 Hook 的 Skill 必须显式标注其厂商兼容矩阵与安装载体**，禁止让使用者靠读代码猜测。

### 10.1 四家 Hook 机制对照（2026-08 实测）

| 厂商 | 机制类型 | 配置载体（项目级） | 主要事件 | 阻断能力 |
| --- | --- | --- | --- | --- |
| **openCode** | Claude Code 兼容 JSON | `./opencode.json`（或 `~/.opencode/opencode.json`）内 `hooks` 段 | `PreToolUse` / `PostToolUse` / `Stop` 等 | 是（exit 2） |
| **CodeBuddy** | Claude Code 风格 JSON | `.codebuddy/settings.json`（项目/个人级） | `PreToolUse` / `PostToolUse` / `UserPromptSubmit` / `Stop` / `PermissionRequest` 等 26 事件 | 是 |
| **华为 CodeArts** | **TS/JS 插件模块**（非 JSON） | `./.codeartsdoer/plugin/*.ts`（+ `package.json` 声明依赖），需重启 IDE 生效 | `tool.execute.before/after`、`chat.message`、`permission.ask` 等 21 事件 | 是（最细粒度） |
| **Trae** | JSON `hooks.json` | `.trae/hooks.json`（项目）/ `~/.trae-cn/hooks.json`（全局） | `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop` / `Notification` | 是（`loop_limit`） |

> openCode / CodeBuddy / Trae 三家的 JSON 字段格式并**不完全一致**（Trae 用 `version`+`hooks.<Event>`+`matcher`+`command`；CodeBuddy/openCode 更接近 Claude Code 的 `hooks.<Event>:[{matcher,command}]`）。CodeArts 则是代码化插件，无 JSON 声明。因此**不存在"一份 manifest 通吃四家"**，必须分厂商适配。

### 10.2 标注字段

在含 Hook 的 Skill 的 `SKILL.md` frontmatter 中增加 `hooks` 字段：

```yaml
hooks:
  vendors:                            # 实际支持/验证过的目标厂商
    - opencode
    - codebuddy
    - codearts
    - trae
  manifest:                           # 各厂商安装载体（仅列已适配的）
    opencode:  "./opencode.json  (hooks 段)"
    codebuddy: ".codebuddy/settings.json"
    codearts: "./.codeartsdoer/plugin/<name>.ts"
    trae:      ".trae/hooks.json"
  mechanism: json | codearts-plugin | git   # 主机制类型
  blocks: true | false                # 是否阻断式（preToolUse/tool.execute.before 阻断）还是提醒式
  vendor-neutral: true | false        # 厂商无关（如纯 git hook）则为 true
```

> `mechanism: codearts-plugin` 表示需以 TS/JS 模块实现（见 §10.1），此时 `manifest` 填插件路径而非 JSON。

### 10.3 标注原则

- **强绑定单一厂商的 Skill 必须明标**：`vendors` 只列该家，`vendor-neutral: false`，并在 SKILL.md 头部用 `> ⚠️` 注明"仅验证 X，其余厂商待适配"，不得默认声称全兼容。
- **跨四厂商的 Skill 必须列出已验证矩阵**：`vendors` 全列四家，`mechanism` 注明混合类型（如 `json + codearts-plugin`），并逐家说明差异——尤其 CodeArts 是插件代码而非 JSON、且需重启 IDE；Trae 的 `matcher`/`loop_limit` 语义。
- **厂商无关 Skill 标 `git` + `vendor-neutral: true`**：如基于 Husky 的 pre-commit 类技能属 git 生态，不依赖任何 agent 厂商 hook 机制，四家均可间接受益，标注为通用。
- **索引同步标记**：若维护技能索引（如 `skills/README.md`），每个含 Hook 的技能后用 `🪝[厂商…]` 角标，角标取值限 `openCode` / `CodeBuddy` / `CodeArts` / `Trae` / `git`（可并列，如 `🪝[openCode/CodeBuddy/Trae]`），便于跨厂商使用者快速筛选。

### 10.4 与 Skills / Agent 元数据映射的衔接

Hook 之外，四家的 **SKILL.md 元数据**与 **Agent（子代理）定义**同样不统一（字段集、`name` 来源、权限模型各异），不能用一份文件直接服务四家。两处衔接：

- Skills：策略为**一份厂商无关 `SKILL.src.md` + 脚本派生四份适配版**；`description` 源文件按 `writing-for-agents` 指针规则精剪，CodeArts 强制的 5 行编号列表仅注入其派生版。详见 [`cross-vendor/SKILL-METADATA-MAPPING.md`](./cross-vendor/SKILL-METADATA-MAPPING.md)。
- Agents：策略同 Skills——**一份 `AGENT.src.md` + 脚本派生四份**，统一抽象权限描述由适配层转译为各家语法；Agent 引用的 Skill 名须与各厂商 Skill 派生名一致。详见 [`cross-vendor/AGENT-MAPPING.md`](./cross-vendor/AGENT-MAPPING.md)。

### 10.5 跨厂商 Hook 设计建议

- **内核一份 JS、适配各自薄层**：Hook 的核心判定逻辑（如"是否危险 git 命令""是否敏感词"）写成**一个厂商无关的 `.mjs` 纯函数模块**（输入事件载荷、输出判定/修改），再由四家的适配层调用——
  - openCode / CodeBuddy / Trae：适配层把该 `.mjs` 注册进各自 `hooks.json`/`settings.json` 的 `command`（Shell 调 `node hook-core.mjs`），格式差异由适配层吸收；
  - CodeArts：适配层把同一逻辑以 TS 插件 `tool.execute.before` 事件导出（`import` 共用 `.mjs` 或重写为 TS），并附 `package.json` 依赖声明。
- **绝对禁止**为四家各写一套互不共享的逻辑副本；新增判定规则只改内核 `.mjs`，适配层保持稳定。
- 脚本一律 `.mjs`、UTF-8（见 §9）。CodeArts 插件若用 TS，编译产物或源 `.mjs` 应与内核同源。
- 不同厂商阻断语义差异（openCode/CodeBuddy exit 2 阻断；Trae `loop_limit`；CodeArts 返回修改对象）须在 SKILL.md 的 Constraints 段逐家写明，不能假设一致。

### 10.6 标注示例

| 技能形态 | mechanism | vendors | vendor-neutral | 说明 |
| --- | --- | --- | --- | --- |
| 基于 Husky 的 pre-commit 检查 | `git` | 通用（四家均间接可用） | 是 | git 生态、厂商无关 |
| 多厂商自定义 hook（一 runner + 多 manifest） | `json`（或 `json + codearts-plugin`） | 按已适配的厂商逐项列出 | 否 | manifest 矩阵须显式覆盖目标厂商，未适配的不得列入 `vendors` |
