# Agent Harness 工程规范

> 核心原则：**能用代码保证的，绝不写进提示词。**
> 提示词负责"意图与风格"，Harness（代码层）负责"正确性与可靠性"。

本规范适用于本仓库（`base`）中所有 Skill、Agent 定义及相关脚本的设计、编写与审查。

> **行业对标**：本规范的设计哲学（约束/反馈/状态/编排下沉到代码层、瘦 prompt）对齐 2026 年大厂公开实践——OpenAI Agents SDK 的 Guardrails（input/output/tool 三级 + Tripwire fail-fast）、Anthropic 的 Agent Harness 工程与《Building Effective Agents》（workflow 优先于自主 Agent），以及 LangChain 在 TerminalBench 2.0 验证的"仅优化 Harness 即可提升通过率"。本仓库的 `goal-execute`/`triage` 已落地状态机。

> **标注约定**：下文带 `【规划中】` 的条目表示方向已被本规范采纳、但仓库当前尚未实现对应代码机制，编写相关 Skill 时不得假设其已强制执行。

---

## 1. 总则

| 维度 | 反模式（提示词承担） | 规范做法（代码承担） |
|------|--------------------|---------------------|
| 约束 | "禁止做 X" | Guardrails、Schema 校验、权限白名单 |
| 反馈 | "请自我反思" | 自动化测试、Lint、环境返回值 |
| 状态 | "推理下一步该做什么" | 确定性工作流引擎（FSM / DAG） |
| 工具 | 自然语言描述工具用法 | 结构化 API 接口定义 |

**判定准则**：每写一条提示词规则前，先问——这条规则能否用代码强制？若能，必须用代码实现，提示词中不再出现。

---

## 2. 约束层（Constraints）

### 2.1 Guardrails 代码化

- 所有"禁止事项"必须落地为可执行的拦截逻辑，而非 SKILL.md / System Prompt 中的祈使句。
- 拦截点分三级：
  1. **输入过滤器**：对进入模型的用户输入/外部内容做清洗与校验（注入检测、越权请求识别）。
  2. **工具调用沙箱**：工具执行前的参数校验与权限检查（见 2.3）。
  3. **输出验证器**：对模型输出做结构化校验（Schema、敏感信息泄漏扫描）。

### 2.2 Schema 校验

- Skill 的产出物（如 GOAL.md、工单、报告）若有结构要求，必须提供：
  - 机器可读的 Schema（JSON Schema / 模板文件）；
  - 校验脚本（`scripts/` 或 Skill 内 `validate.*`），供 Harness 在产出后自动执行。
- 提示词中只保留一句"产出须通过 `validate` 校验"，不再罗列格式细则。

> 【规划中】当前仓库 `scripts/` 仅有 `link-skills.sh`、`list-skills.sh`，尚无统一的产出物 `validate.*` 校验脚本。本条目为待落地机制，新增 Skill 时如需结构化校验，应同步提供校验脚本并登记到本节。

### 2.3 权限白名单

- 危险操作（写文件、执行命令、网络请求、git 变更）采用**白名单制**：默认拒绝，显式声明允许。
- 白名单声明在 Skill 的元数据（frontmatter 或同目录 `permissions.json`）中，由 Harness 在运行时强制执行，而非靠提示词"请谨慎操作"。
- 例：

```json
{
  "allowed_tools": ["read_file", "search_content"],
  "allowed_paths": ["src/**"],
  "deny_commands": ["rm -rf", "git push --force"]
}
```

> 【规划中】上述 `permissions.json` 白名单机制当前仓库**未实现**，实际的危险操作防护由契约级 `Constraints`/`Pause Conditions` 与 git 生态的 `misc/jxx-setup-pre-commit`（Husky）承担，而非本规范描述的 Harness 运行时白名单。大厂 2026 年主流做法亦为"沙箱 + Hooks + human-in-the-loop"，与 `permissions.json` 思路不同。本条目保留为演进方向，编写 Skill 时不应假设 `permissions.json` 已被强制执行。

---

## 3. 反馈回路（Feedback Loops）

### 3.1 以环境反馈替代自我反思

- 禁止在提示词中写"完成后请自我检查/反思"。一切"检查"必须是 Harness 执行的真实命令：
  - 代码任务：跑测试、Lint、类型检查，将**退出码与输出**回灌给模型。
  - 文档/配置任务：跑 Schema 校验、链接检查。
- 提示词只声明："以 `<命令>` 的返回结果为准，非 0 退出码必须修复。"

### 3.2 测试即规格

- 每个改变行为的 Skill/脚本，验收标准必须体现为可运行的测试用例或断言脚本。
- 没有自动化验收手段的 Skill 不得进入 `engineering/`、`productivity/` 推广桶。

### 3.3 失败信号的契约

- 反馈信息必须结构化：明确的成功/失败标记 + 机器可解析的错误位置（文件、行号、规则名）。
- 模糊的口头反馈（"看起来没问题"）不构成反馈回路。

---

## 4. 状态管理（State Management）

### 4.1 确定性工作流

- 多步骤关键路径（如 triage → plan → implement → verify）必须由 FSM 或 DAG 定义，状态与合法迁移显式声明，不依赖模型自由推理"下一步"。
- 状态定义示例（FSM）：

```
states: [draft, planned, in_progress, verifying, done, blocked]
transitions:
  draft -> planned:        requires plan_artifact
  planned -> in_progress:  requires approval
  in_progress -> verifying: requires tests_passed
  verifying -> done:       requires review_passed
  * -> blocked:            on unrecoverable_error
```

- 当前状态持久化在文件中（如 `.goals/<name>/state.json`），支持断点续跑，不依赖模型记忆。

### 4.2 Harness 编排职责

- 循环控制（重试次数、超时、回退）由 Harness 实现，提示词不得包含"最多重试 N 次"之类的流程控制语句。
- 模型只负责**单个状态内**的判断与产出；状态间的流转决策由引擎依据 3.x 的反馈信号做出。

---

## 5. 工具协调（Tool Orchestration）

### 5.1 结构化接口定义

- 每个工具/脚本必须有机器可读的接口定义：名称、参数 Schema、返回值 Schema、错误码。
- SKILL.md 中描述工具时，引用接口定义文件，而非用自然语言复述参数用法。

### 5.2 调用约定

- 工具返回统一信封结构，便于 Harness 统一处理：

```json
{
  "ok": true,
  "data": {},
  "error": { "code": "E_VALIDATION", "message": "...", "retryable": false }
}
```

- 工具组合（串行/并行/条件分支）由 Harness 的工作流定义描述，模型不即兴编排多工具序列。

> 【规划中】统一信封为推荐约定，业界（OpenAI Agents SDK 等）无强制标准，当前仓库工具亦无统一信封实现。新增工具时鼓励遵循此结构，但不作为既成约束。

---

## 6. Agent 编写规范

### 6.1 瘦身 System Prompt

Agent 的 System Prompt / SKILL.md 只保留三类内容：

1. **角色设定**：我是谁，专长边界（与谁分工）。
2. **核心目标**：一句话可判定的任务成功标准。
3. **输出格式**：产出物的位置与格式指针（指向 Schema/模板）。

**必须删除**：一切可通过代码实现的规则——禁止事项清单、流程步骤罗列、工具参数说明、自我反思指令。

### 6.2 审查清单

新增/修改 Agent 或 Skill 时，逐项自查：

- [ ] 提示词中每条规则都已确认"无法用代码强制"吗？
- [ ] 危险操作有白名单声明吗？
- [ ] 验收标准有对应的自动化测试/校验脚本吗？
- [ ] 多步流程有显式状态定义，还是靠模型即兴推理？
- [ ] 工具用法引用了结构化定义，还是自然语言复述？
- [ ] System Prompt 是否只含角色、目标、输出格式？

---

## 7. 角色与职责

### Harness Engineer（护栏工程师）

随着约束、反馈、状态、编排下沉到代码层，核心价值从"提示词技巧"转移为：

- **系统设计**：划分模型自主区与 Harness 确定区的边界；
- **测试工程**：为每个 Skill 构建可执行的验收回路；
- **可靠性保障**：Guardrails、沙箱、重试/回退策略的建设与维护。

评审 Skill 质量时，按此角色的视角发问：*这段提示词是在弥补 Harness 的缺失吗？如果是，应该补 Harness，而不是补提示词。*

---

## 8. 落地优先级

1. **P0**：危险操作防护、可运行验收回路（防错 + 早期反馈；对齐 2026 大厂将 evals/guardrails 列为早期必做）。
2. **P1**：产出物 Schema 校验、测试/Lint 反馈回路接入所有 engineering 桶 Skill（保质）。
3. **P2**：关键多步 Skill（goal-execute、tdd、triage）的 FSM 化（控流程）。
4. **P3**：工具接口定义统一、System Prompt 全面瘦身（提效）。

---

## 9. 脚本编写规约

Harness 的"代码强制"最终落到脚本上。编写 `scripts/` 内或 Skill 目录下的脚本时，遵循：

- **优先使用 JavaScript（`.mjs`）**：能用 JS 完成的脚本（文件扫描、Schema 校验、链接检查、状态读写等）一律用 Node `.mjs` 实现，而非 Shell/Python。理由：与仓库既有 `base` 的 `.mjs` 资产一致、跨平台（Windows/Unix）无需 shell 解释器差异、便于直接 `import` 复用现有 JS 模块。仅在确实无法用 JS 实现（如调用外部 CLI 管道）时才退回到 Shell，并尽量用 `.mjs` 的 `child_process` 统一封装。
- **编码必须显式处理 UTF-8**：
  - 读取/写入文本一律以 `utf-8` 为准，禁止依赖操作系统默认编码（Windows 下 PowerShell/cmd 默认常为非 UTF-8，易导致中文乱码）。
  - Node 侧：`fs.readFile(path, 'utf-8')` / `fs.writeFile(path, content, 'utf-8')`；跨进程读取外部命令输出时，显式指定 `{ encoding: 'utf-8' }` 并通过 `chcp 65001`（Windows）或 `env LANG` 保证子进程输出为 UTF-8。
  - 处理含中文/emoji 的路径或内容时，避免使用依赖字节序的旧 API；正则与切片操作按"字符"而非"字节"处理。
  - 脚本若向终端打印日志，输出前确认 stdout 为 UTF-8（CI 环境常见 cp1252，需 `process.stdout.setDefaultEncoding('utf-8')` 或在调用链上层设置）。

---

## 10. 跨厂商 Hook 标注规约

本仓库以 Skill 为主载体，目标服务于**四个目标厂商 Agent**：**openCode、CodeBuddy、华为 CodeArts（码道）、Trae**。Hook 是强厂商耦合点——这四家的 hook 机制**互不兼容**（JSON 声明 vs TS 插件、路径与事件名各不同），因此**任何含 Hook 的 Skill 必须显式标注其厂商兼容矩阵与安装载体**，禁止让使用者靠读代码猜测。

### 10.1 四目标厂商 Hook 机制对照（2026-08 实测）

| 厂商 | 机制类型 | 配置载体（项目级） | 主要事件 | 阻断能力 |
| --- | --- | --- | --- | --- |
| **openCode** | Claude Code 兼容 JSON | `./opencode.json`（或 `~/.opencode/opencode.json`）内 `hooks` 段 | `PreToolUse` / `PostToolUse` / `Stop` 等 | 是（exit 2） |
| **CodeBuddy** | Claude Code 风格 JSON | `.codebuddy/settings.json`（项目/个人级） | `PreToolUse` / `PostToolUse` / `UserPromptSubmit` / `Stop` / `PermissionRequest` 等 26 事件 | 是 |
| **华为 CodeArts** | **TS/JS 插件模块**（非 JSON） | `./.codeartsdoer/plugin/*.ts`（+ `package.json` 声明依赖），需重启 IDE 生效 | `tool.execute.before/after`、`chat.message`、`permission.ask` 等 21 事件 | 是（最细粒度） |
| **Trae** | JSON `hooks.json` | `.trae/hooks.json`（项目）/ `~/.trae-cn/hooks.json`（全局） | `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop` / `Notification` | 是（`loop_limit`） |

> 注意：openCode / CodeBuddy / Trae 三家的 JSON 字段格式并**不完全一致**（Trae 用 `version`+`hooks.<Event>`+`matcher`+`command`；CodeBuddy/openCode 更接近 Claude Code 的 `hooks.<Event>:[{matcher,command}]`）。CodeArts 则是代码化插件，无 JSON 声明。因此**不存在"一份 manifest 通吃四家"**，必须分厂商适配。

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

> `mechanism: codearts-plugin` 表示需以 TS/JS 模块实现（见 10.1），此时 `manifest` 填插件路径而非 JSON。

### 10.3 标注原则

- **强绑定单一厂商的 Skill 必须明标**：`vendors` 只列该家，`vendor-neutral: false`，并在 SKILL.md 头部用 `> ⚠️` 注明"仅验证 X，其余厂商待适配"，不得默认声称全兼容。
- **跨四厂商的 Skill 必须列出已验证矩阵**：`vendors` 全列四家，`mechanism` 注明混合类型（如 `json + codearts-plugin`），并逐家说明差异——尤其 CodeArts 是插件代码而非 JSON、且需重启 IDE；Trae 的 `matcher`/`loop_limit` 语义。
- **厂商无关 Skill 标 `git` + `vendor-neutral: true`**：如 `misc/jxx-setup-pre-commit`（Husky）属 git 生态，不依赖任何 agent 厂商 hook 机制，四家均可间接受益，标注为通用。
- **README 索引同步标记**：`skills/README.md` 中每个含 Hook 的技能后用 `🪝[厂商…]` 角标，角标取值限 `openCode` / `CodeBuddy` / `CodeArts` / `Trae` / `git`（可并列，如 `🪝[openCode/CodeBuddy/Trae]`），便于跨厂商使用者快速筛选。

### 10.3.1 Skills 元数据同样需跨厂商适配

Hook 之外，四家的 **SKILL.md 元数据（frontmatter）定义也不同**（字段集、`name` 命名、`description` 结构、语言要求均不统一），不能用一份 SKILL.md 直接服务四家。详细规则、单源派生策略与生成脚本接口见专题文档：**[`docs/cross-vendor/SKILL-METADATA-MAPPING.md`](./docs/cross-vendor/SKILL-METADATA-MAPPING.md)**。要点：

- 四家字段集不同：CodeArts 必填 `tags` 且 `name` 强制 `huawei-cloud-*` 前缀、`description` 强制 5 行编号列表、正文须英文；CodeBuddy 有 `allowed-tools`/`system_prompt` 等强化字段；openCode 有 `metadata`/`license`；Trae 仅 `name`+`description`。
- 策略：**一份厂商无关 `SKILL.src.md` + 脚本派生四份适配版**（工具见 §9 的 `.mjs` 要求），而非手写维护四份。
- `description` 取最大公约数（统一 5 行编号列表），`name` 按映射规则满足各家，`tags`/`allowed-tools`/`metadata` 等仅注入对应厂商派生版。

### 10.4 跨厂商 Hook 设计建议（四家适配策略）

- **内核一份 JS、适配各自薄层**：Hook 的核心判定逻辑（如"是否危险 git 命令""是否敏感词"）写成**一个厂商无关的 `.mjs` 纯函数模块**（输入事件载荷、输出判定/修改），再由四家的适配层调用——
  - openCode / CodeBuddy / Trae：适配层是把该 `.mjs` 注册进各自 `hooks.json`/`settings.json` 的 `command`（Shell 调 `node hook-core.mjs`），格式差异由适配层吸收；
  - CodeArts：适配层是把同一逻辑以 TS 插件 `tool.execute.before` 事件导出（`import` 共用 `.mjs` 或重写为 TS），并附 `package.json` 依赖声明。
- **绝对禁止**为四家各写一套互不共享的逻辑副本；新增判定规则只改内核 `.mjs`，适配层保持稳定。
- 脚本一律 `.mjs`、UTF-8（见 §9）。CodeArts 插件若用 TS，编译产物或源 `.mjs` 应与内核同源。
- 不同厂商阻断语义差异（openCode/CodeBuddy exit 2 阻断；Trae `loop_limit`；CodeArts 返回修改对象）须在 SKILL.md 的 Constraints 段逐家写明，不能假设一致。

### 10.5 当前仓库含 Hook 技能清单（标注基准）

| 技能 | mechanism | vendors（目标厂商） | vendor-neutral | 备注 |
| --- | --- | --- | --- | --- |
| `misc/jxx-setup-pre-commit` | git | 通用（四家均间接可用） | 是 | Husky pre-commit，git 生态、厂商无关 |
| `engineering/impeccable` | 原 custom-js（Claude Code 系四家） | 原 CC/Codex/Cursor/Copilot（**与四目标厂商不符**） | 否 | 其 `hook*.mjs` 思路（一个 runner + 多 manifest）可复用，但 manifest 矩阵须改为 openCode/CodeBuddy/CodeArts/Trae |

> 新增含 Hook 技能时，须同步更新本节清单与 `skills/README.md` 索引角标。现有 `impeccable` 的厂商矩阵（Claude Code 系四家）与四目标厂商不一致，属于待改造项，不应被误读为"已服务四目标厂商"。
