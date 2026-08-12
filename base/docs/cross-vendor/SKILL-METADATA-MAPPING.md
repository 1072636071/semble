# SKILL 元数据跨厂商映射规范

> **配套文档**：[`../HARNESS-SPEC.md`](../HARNESS-SPEC.md) §10（跨厂商 Hook 标注规约）、[`AGENT-MAPPING.md`](./AGENT-MAPPING.md)（Agent 定义跨厂商映射）。
> **适用范围**：任何需将同一套 Skill 同时提供给 **openCode / CodeBuddy / 华为 CodeArts / Trae** 四家厂商 Agent 使用的工程，与具体仓库无关。
> **状态**：2026-08 调研结论，作为编写依据。

---

## 0. 为什么需要这份规范

跨厂商服务 Skill 时，最早、最隐蔽的耦合点不是 Hook，而是 **SKILL.md 的元数据（frontmatter）定义本身四家就不统一**。

如果忽略这点，会出现两种失败：

1. **信息丢失**：在某家能写 `allowed-tools`、在另一家只能写 `name`+`description`，同一份 SKILL.md 无法四家通吃而不丢字段。
2. **加载失败**：CodeArts 强制 `huawei-cloud-*` 命名前缀且 `description` 须 5 行编号列表，直接把中文 SKILL.md 丢进去会被质量门禁拒收。

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

- **`tags`（CodeArts 独有必填）**：其余三家不读取也不拒绝 `tags`，写进所有派生版无害，但**源文件里应保留 `tags`**，否则 CodeArts 派生版缺必填字段。
- **`allowed-tools`（CodeBuddy 独有）**：其它三家不识别，写进它们的 frontmatter 可能被忽略或报错。**策略**：只在 CodeBuddy 派生版注入，源文件与另三家派生版不含。
- **`metadata` / `license` / `compatibility`（openCode 独有）**：其它三家忽略。仅在 openCode 派生版注入。
- **`system_prompt` / `tools` / `mcp_servers` / `context`（CodeBuddy 强化字段）**：源文件若需要，应在 CodeBuddy 派生版单独声明。
- **`name` 前缀冲突**：CodeArts 要求 `huawei-cloud-*`，openCode 要求小写连字符且与目录名一致、Trae/CodeBuddy 无约束。取交集方案见 §3。
- **`description` 结构冲突**：CodeArts 要求 5 行编号列表，其余接受自由文本。**策略**：源文件 `description` 按 `writing-for-agents` 指针规则精剪；5 行编号列表仅由脚本改写给 CodeArts 派生版（见 §4），其余三家直接用源文件精剪版——不为满足单家格式而让四份常驻指针集体膨胀。
- **语言约束**：仅 CodeArts 强制英文正文。要真服务 CodeArts 必须提供英文 frontmatter 与正文（见 §5）。

---

## 2. 总体策略：单源 + 派生

```
skills/<skill>/
├── SKILL.src.md            # 厂商无关源文件（唯一手写维护对象）
├── references/             # 共享参考文档（源文件引用）
├── scripts/                # 共享脚本（.mjs + UTF-8，见 HARNESS-SPEC §9）
└── .generated/             # 派生产物目录（由脚本生成，不手写）
    ├── opencode/SKILL.md
    ├── codebuddy/SKILL.md
    ├── codearts/SKILL.md
    └── trae/SKILL.md
```

- **源文件 `SKILL.src.md`**：只含四家公共子集 + 一个 `x-vendors` 扩展段（描述各厂商专属字段），正文用中文编写（降低维护成本）。
- **生成脚本 `gen-skill-meta.mjs`**（见 §6）：读 `SKILL.src.md`，按 §3–§5 规则产出四份 `SKILL.md` 到 `.generated/<vendor>/`。
- **安装**：各厂商适配版拷贝到对应扫描目录（见 §7）。

> 为什么不手写四份？四份会漂移（改一处忘三处），且违反"用代码强制"原则——生成脚本即代码强制的体现。

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

## 4. `description` 跨厂商结构

`description` 是技能的常驻 context pointer，写作遵循 `writing-for-agents` 的指针规则：**前导词前置、每个触发分支只写一次、删除正文已承载的身份信息**——它的每个词在每一轮都花预算，剪枝标准比正文更严。

- **源文件 `SKILL.src.md`**：`description` 写精剪版自由文本（中文即可），只承载"材料是什么 + 哪些分支应触发"。
- **openCode / CodeBuddy / Trae 派生版**：直接使用源文件精剪版。
- **CodeArts 派生版**：其质量门禁强制 5 行编号列表，由脚本把源 `description` 改写为下式（该膨胀只发生在 CodeArts 一派生版，不污染其余三家）：

```yaml
description: |-
  1. {功能范围}。
  2. Triggered by: {触发词，中英文}。
  3. {价值主张——解决什么问题}。
  4. Usage: {典型工作流 A → B → C}。
  5. {前置条件——CLI 版本/认证/环境变量}。
```

- CodeArts 版第 2 行触发词保留中文触发词（CodeArts 允许触发词含中文），便于中文用户唤起。

---

## 5. 语言处理（CodeArts 英文约束）

CodeArts 强制 SKILL.md 正文、references、scripts 注释英文。其余三家不限。

**派生规则**：

- openCode / CodeBuddy / Trae：`SKILL.md` 正文与 `description` 直接用源文件中文（不翻译）。
- CodeArts：
  - `name` / `description` / `tags` 生成英文版（description 5 行编号列表译英，触发词保留中文原词于括号内）。
  - 正文：若源文件为中文，CodeArts 派生版须提供英文正文。两种做法：
    - **(a) 双语源**：源文件 `SKILL.src.md` 写中英文对照，脚本抽取英文段给 CodeArts；或
    - **(b) 人工英文块**：在源文件维护一段 `<!--en-->...<!--/en-->` 英文块，脚本提取。不推荐脚本自动翻译（质量不可控）。
  - `references/` 下文档：CodeArts 要求英文，同 (b) 处理或源即英文。
  - scripts 注释：统一英文注释最稳。

> 务实建议：新技能直接双语源（中文正文 + 英文 `<!--en-->` 块），老技能按需补英文块。

---

## 6. 生成脚本接口（`gen-skill-meta.mjs`）

按 HARNESS-SPEC §9 要求用 `.mjs`、UTF-8。

**输入**：`SKILL.src.md`（含 frontmatter + `x-vendors` 扩展段）。
**输出**：`.generated/{opencode,codebuddy,codearts,trae}/SKILL.md`（及 CodeArts 所需 `references/` 骨架）。

**`x-vendors` 扩展段（写在源 frontmatter，生成后剔除）**：

```yaml
x-vendors:
  codearts:
    product: codebuddy                # 用于 name 前缀中段
    tags: [codebuddy, git, guard]     # CodeArts 必填 tags
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
   b. description = common.description（codearts 改写为 5 行编号列表并取英文块）
   c. tags = x-vendors.codearts.tags（仅 codearts 必填；其余也写但无害）
   d. allowed-tools/system_prompt/metadata/license = 仅对应 vendor 注入
   e. 写 .generated/<vendor>/SKILL.md（utf-8，YAML 块 + 正文）
4. codearts 额外生成 references/iam-policies.md 骨架（若缺失）
```

**CLI**：

```
node gen-skill-meta.mjs <skillDir>      # 生成单技能
node gen-skill-meta.mjs --all           # 遍历全部技能生成
```

**校验**：脚本末尾对各派生版做最小校验（name 正则、codearts description 为 5 行编号列表、codearts 含 tags），不符合则非零退出（对接 HARNESS-SPEC §2.2 反馈回路）。

---

## 7. 目录落地矩阵（安装到哪）

| 厂商 | 项目级扫描目录 | 派生产物放置 |
| --- | --- | --- |
| openCode | `.opencode/skills/` | `.generated/opencode/` → 拷贝至此 |
| CodeBuddy | `.codebuddy/skills/` | `.generated/codebuddy/` → 拷贝至此 |
| CodeArts | 自包含技能目录（须含 `references/`） | `.generated/codearts/` → 整体拷为技能目录 |
| Trae | `.trae/skills/` | `.generated/trae/` → 拷贝至此 |

> openCode / Trae 也识别 `.claude/skills/`、`.agents/skills/`，若目标仓库已用这些目录可复用；但以各厂原生目录为默认基准。

---

## 8. 检查清单（新增/改造技能时）

- [ ] 源文件命名为 `SKILL.src.md`，`name` 满足 openCode 正则且 ≤64
- [ ] 源文件 `description` 已按指针规则精剪；CodeArts 派生版为 5 行编号列表（§4）
- [ ] 含 `x-vendors` 段，至少填 `codearts.product` 与 `codearts.tags`
- [ ] CodeArts 所需的英文 `description`/正文块已提供（§5）
- [ ] 运行 `gen-skill-meta.mjs` 四家均生成成功、校验通过
- [ ] 四家目录安装后各自可被对应 Agent 扫描加载
- [ ] 若含 Hook，同步满足 HARNESS-SPEC §10 标注
