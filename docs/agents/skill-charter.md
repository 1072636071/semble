# 技能宪章（Skill Charter）

**状态**：生效（2026-10-26 立）
**适用**：本仓库 `base/skills/**` 全部技能，以及任何目标仓库里手写的 `SKILL.md`。

> **唯一权威源。** 各 skill / prompt / 规范**引用**本文件，**不复制内容**——与[质量宪章](quality-charter.md)同一纪律：单文件权威维护，避免多处漂移。
> 判据正文只在这里；技能正文自检时给动作 + 指针，不复述规则。

---

## 定性：Skill 不是提示词

Skill 是**面向 Agent 的标准化能力说明**，不是一段提示词。判断一个 Skill 好不好，看四个词：

| 词 | 含义 | 失效时的症状 |
|---|---|---|
| **可触发** | Agent 自己判断得出「现在该用它」 | 该用时没用（undertrigger），或处处误触发 |
| **可执行** | 读到就能照做，步骤有完成判据 | 读完还是不知道怎么下手，或每次做法都不一样 |
| **可验证** | 结果能被断言或被人核对 | 勾完了但要求没做到，且没人能发现 |
| **可维护** | 能版本化、能回滚、改一处不塌一片 | 三个月后没人敢改，改完全网漂移 |

Skill 描述同时服务两个读者：**人**读 `description` 决定何时调用；**Agent** 读正文执行。写作手法（信息层级、指针、剪枝）以 `jxx-writing-for-agents` 为准，本宪章只定**判据**。

---

## 十条原则

每条给三样：**判据**（怎么算合格）、**对照**（好/差）、**机器闸**（能否程序断言，对应 `skill-lint.mjs` 规则码）。

### 一 · 名称与触发要清晰 — `sk-01`

`name` 与 `description` 必须一眼判断**什么时候用**。好描述 = 能力 + 场景 + 触发词/输入类型 + 边界。

- **好**：`用于从 PDF 中提取文本和表格、填充表单、合并文件。当用户上传 PDF、提到表单或文档提取时触发。`
- **差**：`帮助处理 PDF。`

判据：`name` 与目录名一致且非空；`description` 含触发语（「触发 / 当用户 / Use when」类）并给出具体触发词。自研技能的 `description` 以 JS `.length` 计不得超过 500；第三方原文超过 500 只告警，不改写、不阻断。过短或触发词不清由启发式评分提示。

**描述只答「何时调用」，不写实现**：文件路径、CLI 参数、内部字段名一律下沉到正文或 `references/`。description 是每轮都在付的常驻成本，实现细节放在那里等于给每个会话加税（`sk-01c`）。

### 二 · 职责单一，不做「万能助手」 — `sk-02`

一个 Skill 只解决一类问题。既要代码审查、又要写文档、又要部署，行为必然漂移；复杂流程拆成多个 Skill 组合，用 router 技能串联。

判据（启发式，只提示不判死）：`description` 用「还要 / 以及 / 同时 / 并提供 / 又」串起三个以上互不相干动作时，回到「这三件事共用什么判据」重新切分。

### 三 · 渐进式披露，控制上下文成本 — `sk-03`

分三层加载，别把所有规则、文档、脚本塞进主描述：

| 层 | 载体 | 何时进上下文 |
|---|---|---|
| L1 | `name` + `description` | 常驻（技能列表） |
| L2 | `SKILL.md` 正文 | 技能被调用时 |
| L3 | `references/`、`scripts/`、`assets/` | 执行到那一步时按指针加载 |

判据：正文超过 500 行 ⇒ 该下沉到 `references/`（已有 `references/` 仍超长更要报）；正文超过 200 行而目录下没有 `references/` ⇒ 提示。

### 四 · 指令要命令式、可执行 — `sk-04`

正文用祈使句，写**做什么**，不写「你可以 / 建议 / 尽量 / 尝试」这类留后路的表达。

- **不推荐**：`你可以尝试用 JSON 输出。`
- **推荐**：`输出必须严格遵循 JSON 格式。`

判据：模糊词在正文中出现 ≥5 次 ⇒ P1。注意与 HARNESS-SPEC 的分工——**能用代码强制的约束不要写成祈使句**（禁令代码化）。

### 五 · 输入输出要像接口一样明确 — `sk-05`

写清四件事：用户需要提供什么、哪些字段/参数必填、输出结构是什么、是否要求固定格式（表格/JSON/Markdown/代码块）。

判据：正文中「输入 / 输出 / 输出格式」缺位 ⇒ P2；输出有结构要求却没给可校验的形态（schema/模板/示例）⇒ 一并报。

### 六 · 边界和失败处理必须写出来 — `sk-06`

必须说明：能做什么、不能做什么、失败怎么办。缺关键信息如何追问；不支持的文件类型如何拒绝；高风险操作是否需用户确认；超范围是否转人工。

判据：正文中「边界 / 不适用 / 失败 / 错误 / 拒绝」缺位 ⇒ P2。失败要落成**可识别的出口**（如 `ERR_MISSING_INPUT`），不是「报错就提示用户」。

### 七 · 模糊逻辑归 Skill，确定性逻辑归脚本 — `sk-07`

判断、决策、理解、规划留在 Skill 正文；计算、格式转换、API 调用、数据清洗放进 `scripts/` 或工具。这是 [HARNESS-SPEC](../base/docs/HARNESS-SPEC.md) 核心原则在技能层的落地：**提示词负责意图与步骤，代码负责正确性与可靠性**。

判据：正文出现逐行计算、格式转换、批量重命名等纯确定性描述，而目录下既无 `scripts/` 也无 `references/` ⇒ 提示「这段应该是一个脚本」。

### 八 · 可验证、可测试 — `sk-08`

好的 Skill 支持评测：**正例**（哪些输入该触发）、**反例**（哪些输入不该触发）、**成功标准**（输出格式、准确率、完成步骤）、**回归测试**（改动后不破坏原有行为）。

判据：目录下既无 `evals/` 也无 `tests/` ⇒ P2；`evals/` 空目录 ⇒ P1。评测数据的最小形态见 `jxx-skill-init` 的 evals 模板（`prompt` / `expected_output` / `files`）。

### 九 · 版本化与可维护 — `sk-09`

Skill 当代码管：标注 `version` / `author` / `license`，进 Git，记录变更原因，支持回滚。

判据：`frontmatter` 缺 `metadata.version`（且正文与 CHANGELOG 都没有版本号）⇒ P2；无 `CHANGELOG.md` ⇒ 提示。版本号递增即变更原因登记，不写「优化若干细节」。

### 十 · 安全与合规要前置 — `sk-10`

涉及数据访问、文件修改、外发通知、财务操作时，正文须明确：权限范围、审计日志、数据脱敏、人工确认机制。

判据：正文出现高风险动词（删除 / 覆盖 / 推送 / 上传 / 发送 / 支付 / 转账 / `git push` / `rm`）而全文无「确认 / 权限 / 审计 / 脱敏 / 白名单」⇒ P1。危险操作的**真实防护**仍按 HARNESS-SPEC §2.3 落成白名单，正文写的是「谁来确认」，不是「请小心」。

### 零 · 机器前置 — `sk-00`

`SKILL.src.md` / `SKILL.md` 解析不出 `name` / `description` ⇒ **P0**。这是 `skill-lint` 挡住分发链的错误级别；`skill-contract` 另管下文的硬契约，二者不能互相替代。

---

## 描述模板

```yaml
---
name: report-formatter
description: 将原始周报素材整理为标准化 Markdown 周报。当用户上传笔记、会议记录或零散工作事项，并要求生成周报时触发。不包含数据核对、绩效打分或邮件发送。
version: 1.0.0
---

角色：你是一名项目周报整理助手。
输入：本周事项、任务状态、优先级、风险点。
流程：去重 → 归类 → 提炼重点 → 生成行动项 → 输出标准化格式。
输出格式：必须包含摘要、进展、风险、下周计划、行动项。
边界：不编造未提供的数据；信息不足时先追问。
失败处理：若缺少时间范围或事项列表，返回 ERR_MISSING_INPUT。
```

正文骨架按「角色 / 输入 / 流程 / 输出格式 / 边界 / 失败处理」六段写；每段一句判据，不展开成散文。本仓库技能的 frontmatter 另有 `x-install` / `x-vendors` 派生字段，见 `jxx-skill-init` 的 `references/frontmatter.md`。

---

## 机器闸

### 硬契约：skill-contract

`base/scripts/skill-contract.mjs` 判断可枚举的兼容性约束，不用分数折算：

- 自研技能 `description.length > 500` 是硬错误；第三方技能只产生 warning，单独存在 warning 时退出码仍为 0。
- `disable-model-invocation` 与 `user-invocable` 出现时必须是布尔值。
- `disable-model-invocation: true` 定义为 manual-only；manual-only 不得同时声明 `user-invocable: false`。
- 技能含 `agents/openai.yaml` 时，manual-only 要求 `policy.allow_implicit_invocation: false`，非 manual-only 要求 `true`；该 policy 省略时按 `true` 计。

```bash
node base/scripts/skill-contract.mjs                    # 文本报告；硬错误 exit 1
node base/scripts/skill-contract.mjs --json --root .    # JSON；参数用法错误 exit 2
```

`ship check` 运行同一门禁，任一硬错误以 `E_SKILL_CONTRACT` 阻断。修复自研源或调用策略；不得为消除第三方 warning 而改第三方描述。

### 启发式评分：skill-lint

原则一至十中适合静态提示的部分，由 `base/scripts/skill-lint.mjs` 扫描：

```bash
node base/scripts/skill-lint.mjs            # 摘要 + 最差 30 个，退出码 0
node base/scripts/skill-lint.mjs --strict   # 有 P0 则以非零退出（CI 用）
node base/scripts/skill-lint.mjs --json     # 机器可读全量结果
```

**分数语义**：100 起扣，P0 −25、P1 −8、P2 −2、info 不扣，下限 0。除既有 P0 外，P1/P2/info 是质量排序信号，不改写为硬契约。分数不是 KPI——先修 P0/P1，别为了 +2 分改第三方技能。

**lint 不能替代人的判断**。它查的是「有没有写」，查不出「写得对不对」：触发词是否真能命中、边界是否真覆盖了失败路径、脚本分工是否合理，仍须读者判断。

---

## 与相邻规范的关系

| 规范 | 管什么 | 与本宪章的交界 |
|---|---|---|
| [HARNESS-SPEC](../base/docs/HARNESS-SPEC.md) | 什么该下沉到代码层 | 原则七的落地形态（护栏/校验/脚本）；原则十的真实防护 |
| `jxx-writing-for-agents` | 文档怎么写（层级、指针、剪枝） | 原则一、三的写作手法 |
| [质量宪章](quality-charter.md) | 怎么算做完（证据优先、验收框二选一） | 原则八在工单层的镜像 |
| `jxx-to-tickets` `references/acceptance-criteria.md` | 验收点怎么写 | AC 的唯一权威源，本宪章只引用 |
| `jxx-skill-init` | 新建技能的操作流程 | 本宪章是它的判据源 |

---

## 自查清单（新增 / 修改 Skill 时）

- [ ] `name` 与目录名一致；自研 `description.length` ≤500，含触发词与边界，且没有路径/参数/字段名这类实现细节
- [ ] 这个技能只解决一类问题；多余职责已拆成兄弟技能
- [ ] 正文 ≤500 行；超出的规则/脚本/素材已下沉 `references/`、`scripts/`
- [ ] 正文用祈使句；能被代码强制的约束已下沉，没写成祈使句
- [ ] 输入、必填项、输出结构写死到可校验
- [ ] 边界与失败出口（追问 / 拒绝 / 转人工 / `ERR_*`）已写明
- [ ] 确定性计算已进 `scripts/`，正文只留判断与规划
- [ ] 正例、反例、成功标准至少各一条（`evals/` 或 `tests/`）
- [ ] `metadata.version` 与 `CHANGELOG.md` 同步递增，写了变更原因
- [ ] 高风险动作写明确认主体与权限范围；防护落成代码
- [ ] `node base/scripts/skill-contract.mjs` 无硬错误，`node base/scripts/skill-lint.mjs` 无 P0，`node base/scripts/ship.mjs check` 通过
