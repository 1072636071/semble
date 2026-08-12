# SKILL 元数据跨厂商映射规范

> 配套文档：[`../HARNESS-SPEC.md` §10](../HARNESS-SPEC.md)（跨厂商 Hook 标注规约）。
> 适用范围：本仓库 `base/skills/` 下所有 Skill，目标同时服务于 **openCode / CodeBuddy / 华为 CodeArts / Trae** 四家厂商智能 Agent。
> 状态：2026-08 调研结论，作为编写依据。

---

## 0. 为什么需要这份规范

第 10 章解决了 **Hook**（强耦合点）的跨厂商标注问题。但跨厂商还有一个更早、更隐蔽的耦合点：**SKILL.md 的元数据（frontmatter）定义本身四家就不统一**。

如果忽略这点，会出现两种失败：
1. **信息丢失**：在某家能写 `allowed-tools`、在另一家只能写 `name`+`description`，同一份 SKILL.md 无法四家通吃而不丢字段。
2. **加载失败**：CodeArts 强制 `huawei-cloud-*` 命名前缀且 `description` 须 5 行编号列表，直接把本仓库的中文 SKILL.md 丢进去会被质量门禁拒收。

因此本规范规定：**源文件一份（厂商无关内核） + 派生四份（各厂商适配版）**，由脚本生成，而非手写维护四份。

---

## 1. 四家元数据实测对照表

下表为 2026-08 对各家官方/实测文档的核对结果。

| 维度 | openCode | CodeBuddy | 华为 CodeArts | Trae |
| --- | --- | --- | --- | --- |
| 元数据载体 | `SKILL.md` frontmatter (YAML) | `SKILL.md` frontmatter (YAML) | `SKILL.md` frontmatter (YAML) | `SKILL.md` frontmatter (YAML) |
| **必填字段** | `name`、`description` | `name`、`description` | `name`、`description`、`tags` | `name`、`description` |
| **可选字段** | `license`、`compatibility`、`metadata`(字符串映射) | `system_prompt`、`tools`、`mcp_servers`、`allowed-tools`、`context` | 仅 `tags`（必填，无 version/metadata） | 无额外字段 |
| `name` 约束 | 正则 `^[a-z0-9]+(-[a-z0-9]+)*$`，1–64 字符，须与目录名一致 | 任意字符串 | **强制前缀** `huawei-cloud-{product}-{function}` | 任意，简短有辨识度 |
| `description` 格式 | 自由文本，1–1024 | 自由文本 | **强制 5 行编号列表**（范围 / 触发词 / 价值 / 工作流 / 前置条件） | 自由文本 |
| 目录约定（项目级） | `.opencode/skills/`（亦识别 `.claude/skills/`、`.agents/skills/`） | `.codebuddy/skills/` | 自包含目录，须含 `references/`（含 `iam-policies.md` 等） | `.trae/skills/`（亦识别 `.agents/skills/`） |
| 目录约定（用户级） | `~/.config/opencode/skills/` | `~/.codebuddy/skills/` | — | `~/.trae-cn/skills/` |
| 正文/注释语言 | 不限 | 不限 | **SKILL.md 正文、references、scripts 注释须英文** | 不限 |
| 权限/工具声明位置 | 不在 SKILL.md，在 `opencode.json` 的 `permission`/`tools` | `allowed-tools` 写在 frontmatter | 不在 SKILL.md | 不在 SKILL.md |
| 未知字段处理 | **忽略**（向前兼容） | 未明说（建议不写未知字段） | 未明说 | 未明说 |

### 1.1 字段级差异详解

- **`tags`（CodeArts 独有必填）**：openCode / CodeBuddy / Trae 不读取也不拒绝 `tags`，因此把它写进所有派生版无害，但**源文件里应保留 `tags`**，否则 CodeArts 派生版缺必填字段。
- **`allowed-tools`（CodeBuddy 独有）**：其它三家不识别，写进它们的 frontmatter 可能被忽略或报错（取决于各家严格度）。**策略**：只在 CodeBuddy 派生版注入，源文件与另三家派生版不含。
- **`metadata` / `license` / `compatibility`（openCode 独有）**：其它三家忽略。仅在 openCode 派生版注入。
- **`system_prompt` / `tools` / `mcp_servers` / `context`（CodeBuddy 实战字段）**：属于 CodeBuddy 强化字段，源文件若需要，应在 CodeBuddy 派生版单独声明。
- **`name` 前缀冲突**：CodeArts 要求 `huawei-cloud-*`，openCode 要求小写连字符且与目录名一致、Trae/CodeBuddy 无约束。**取交集方案**见 §3。
- **`description` 结构冲突**：CodeArts 要求 5 行编号列表，其余接受自由文本。**取最大公约数**：所有派生版统一用 5 行编号列表（见 §4），其余三家兼容。
- **语言约束**：仅 CodeArts 强制英文正文。当前仓库全中文，要真服务 CodeArts 必须英文化或至少 frontmatter 英文（见 §5）。

---

## 2. 总体策略：单源 + 派生

```
base/skills/<bucket>/<skill>/
├── SKILL.src.md            # 厂商无关源文件（唯一手写维护对象）
├── references/             # 共享参考文档（源文件引用）
├── scripts/                # 共享脚本（含 §9 要求的 .mjs）
└── .generated/             # 派生产物目录（由脚本生成，不手写）
    ├── opencode/SKILL.md
    ├── codebuddy/SKILL.md
    ├── codearts/SKILL.md
    └── trae/SKILL.md
```

- **源文件 `SKILL.src.md`**：只含四家公共子集 + 一个 `x-vendors` 扩展段（描述各厂商专属字段），正文用中文编写（降低维护成本）。
- **生成脚本 `scripts/gen-skill-meta.mjs`**（见 §6）：读 `SKILL.src.md`，按 §3–§5 规则产出四份 `SKILL.md` 到 `.generated/<vendor>/`。
- **安装**：各厂商适配版拷贝到对应扫描目录（`.opencode/skills/`、`.codebuddy/skills/`、CodeArts 目录、`.trae/skills/`）。安装动作由脚本或 README 说明，不在本规范强制。

> 为什么不手写四份？四份会漂移（改一处忘三处），且违反 HARNESS-SPEC §9"用代码强制"。生成脚本即"代码强制"的体现。

---

## 3. `name` 跨厂商命名规则

目标：一个 `name` 四家都能加载，且不损失 CodeArts 的语义前缀。

**规则 A（推荐，源文件用通用名）**：
- 源文件 `name`：小写连字符、与目录名一致，如 `git-precommit-guard`。
- 派生时：
  - openCode / CodeBuddy / Trae：直接用 `git-precommit-guard`。
  - CodeArts：映射为 `huawei-cloud-codebuddy-git-precommit-guard`（前缀固定 `huawei-cloud-`，中段填产品域，后段沿用源 `name`）。产品域由源文件 `x-vendors.codearts.product` 指定（默认 `codebuddy`）。
- 目录名：CodeArts 派生目录名须与映射后的 `name` 一致（即 `huawei-cloud-codebuddy-git-precommit-guard/`）。

**规则 B（若技能确实华为云产品专属）**：源 `name` 直接写 `huawei-cloud-{product}-{function}`，则 openCode 也能接受（小写连字符），其余三家兼容，但语义前缀对非华为场景冗余——仅限华为云产品技能用。

> 源文件 `name` 长度须 ≤ 64 且匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`，否则 openCode 拒收。

---

## 4. `description` 跨厂商结构（最大公约数）

所有派生版统一输出 **5 行编号列表**，满足 CodeArts 强制格式，其余三家兼容：

```yaml
description: |-
  1. {功能范围}。
  2. Triggered by: {触发词，中英文}。
  3. {价值主张——解决什么问题}。
  4. Usage: {典型工作流 A → B → C}。
  5. {前置条件——CLI 版本/认证/环境变量}。
```

- 源文件 `SKILL.src.md` 的 `description` 即按此 5 行格式写（中文即可，CodeArts 派生版再英文化，见 §5）。
- 第 2 行触发词保留中文触发词（CodeArts 允许触发词含中文），便于中文用户唤起。

---

## 5. 语言处理（CodeArts 英文约束）

CodeArts 强制 SKILL.md 正文、references、scripts 注释英文。其余三家不限。

**派生规则**：
- openCode / CodeBuddy / Trae：`SKILL.md` 正文与 `description` 直接用源文件中文（不翻译）。
- CodeArts：
  - `name` / `description` / `tags` 生成英文版（description 5 行编号列表译英，触发词保留中文原词于括号内）。
  - 正文：若源文件为中文，CodeArts 派生版须提供英文正文。两种做法：
    - **(a) 双语源**：源文件 `SKILL.src.md` 写中英文对照，脚本抽取英文段给 CodeArts；或
    - **(b) 翻译派生**：脚本调用翻译（离线词典/LLM）生成英文正文——不推荐自动翻译（质量不可控），建议人工在源文件维护一段 `<!--en-->...<!--/en-->` 英文块，脚本提取。
  - `references/` 下文档：CodeArts 要求英文，同 (b) 处理或源即英文。
  - scripts 注释：统一英文注释（§9 已要求脚本规范，注释英文最稳）。

> 务实建议：新技能直接双语源（中文正文 + 英文 `<!--en-->` 块），老技能按需补英文块。

---

## 6. 生成脚本接口（`scripts/gen-skill-meta.mjs`）

按 §9 要求用 `.mjs`、UTF-8。

**输入**：`SKILL.src.md`（含 frontmatter + `x-vendors` 扩展段）。
**输出**：`.generated/{opencode,codebuddy,codearts,trae}/SKILL.md`（及 CodeArts 所需 `references/` 骨架）。

**`x-vendors` 扩展段（写在源 frontmatter，生成后剔除）**：
```yaml
x-vendors:
  codearts:
    product: codebuddy          # 用于 name 前缀中段
    tags: [codebuddy, git, guard]   # CodeArts 必填 tags
  codebuddy:
    allowed-tools: [read_file, search_content, execute_command]
    system_prompt: "..."
  opencode:
    license: MIT
    compatibility: ["opencode>=1.0"]
  trae: {}
```

**伪代码主干**：
```
1. 读取 SKILL.src.md（utf-8）
2. 解析 frontmatter → {common, x-vendors}
3. 对各 vendor ∈ [opencode, codebuddy, codearts, trae]：
   a. name = mapName(vendor, common.name, x-vendors)
   b. description = common.description（codearts 取英文块）
   c. tags = x-vendors.codearts.tags（仅 codearts 必填；其余也写但无害）
   d. allowed-tools/system_prompt/metadata/license = 仅对应 vendor 注入
   e. 写 .generated/<vendor>/SKILL.md（utf-8，YAML 块 + 正文）
4. codearts 额外生成 references/iam-policies.md 骨架（若缺失）
```

**CLI**：
```
node scripts/gen-skill-meta.mjs <skillDir>      # 生成单技能
node scripts/gen-skill-meta.mjs --all           # 遍历 skills/ 全部生成
```

**校验**：脚本末尾对各派生版做最小校验（name 正则、description 行数、codearts 含 tags），不符合则非零退出（对接 HARNESS-SPEC §2.2 反馈回路）。

---

## 7. 目录落地矩阵（安装到哪）

| 厂商 | 项目级扫描目录 | 派生产物放置 |
| --- | --- | --- |
| openCode | `.opencode/skills/` | `.generated/opencode/` → 拷贝至此 |
| CodeBuddy | `.codebuddy/skills/` | `.generated/codebuddy/` → 拷贝至此 |
| CodeArts | 自包含技能目录（须含 `references/`） | `.generated/codearts/` → 整体拷为技能目录 |
| Trae | `.trae/skills/` | `.generated/trae/` → 拷贝至此 |

> 注意 openCode / Trae 也识别 `.claude/skills/`、`.agents/skills/`，若仓库已用这些目录可复用，但本仓库目标四家不依赖 `.claude`，故以各厂原生目录为准。

---

## 8. 当前仓库落地状态

- 本仓库现有技能（如 `impeccable`、`jxx-setup-pre-commit` 等）目前均为**单份中文 SKILL.md**，未做单源派生。
- 要服务四目标厂商，须：① 把源文件改名 `SKILL.src.md` 并按 §3–§5 补 `x-vendors` 与英文块；② 提供 `scripts/gen-skill-meta.mjs`；③ 生成并安装到四家目录。
- 这是**待改造项**，不应被误读为"已服务四家"。优先级见 HARNESS-SPEC §8（建议置于 P1，与 Hook 适配并列）。

---

## 9. 检查清单（新增/改造技能时）

- [ ] 源文件命名为 `SKILL.src.md`，`name` 满足 openCode 正则且 ≤64
- [ ] `description` 为 5 行编号列表（§4）
- [ ] 含 `x-vendors` 段，至少填 `codearts.product` 与 `codearts.tags`
- [ ] CodeArts 所需的英文 `description`/正文块已提供（§5）
- [ ] 运行 `gen-skill-meta.mjs` 四家均生成成功、校验通过
- [ ] 四家目录安装后各自可被对应 Agent 扫描加载
- [ ] 若含 Hook，同步满足 HARNESS-SPEC §10 标注
