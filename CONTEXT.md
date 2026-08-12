# JwikisSkills 领域词汇表

跨厂商技能工程仓库：以 Skill / Agent 定义为主载体，目标分发至多家厂商 Agent 平台。

## 语言

**单源派生**：
一个技能/Agent 只手写一份厂商无关源文件（`SKILL.src.md` / `AGENT.src.md`），各厂商适配版由脚本生成到 `.generated/<vendor>/`，不手写维护多份。防止四份漂移。
_避免使用_：多份维护、手写四份

**厂商注册表（vendors.json）**：
声明全部目标平台（名称、安装目录、是否有派生规则、项目级/用户级目录）的机器可读配置。新增平台或补调研只改此配置，不改脚本。
_避免使用_：硬编码平台列表

**派生规则**：
针对某厂商的元数据改写逻辑（如 CodeArts 的 `huawei-cloud-*` name 前缀、5 行编号列表 description、英文块提取）。有派生规则的厂商走**单源派生**；未调研的厂商走原样复制 fallback。

**原样复制 fallback**：
厂商注册表中无派生规则的平台，技能目录不加改写直接复制到其安装目录（现状行为）。是**派生规则**缺位时的兼容路径，不是终态。

**桶（bucket）**：
`base/skills/` 下按用途分组的目录（`engineering/`、`productivity/`），是技能的组织单位，不是分发单位。

**双模式（dual-mode）**：
一行命令对技能的两种处理路径——技能目录含 `SKILL.src.md` 时走**单源派生**安装；不含时走**原样复制 fallback**安装。`SKILL.src.md` 的存在与否即派生开关，存量技能随改随迁，无需迁移截止日。Agent 同理（`AGENT.src.md` 为派生开关）。

**x-install**：
技能/Agent frontmatter 中的分发开关字段：`x-install: false` 表示默认不安装，缺省为 `true`。分发属性与技能同文件就近声明（co-location），取代安装清单硬编码。

**managedPrefixes**：
`vendors.json` 中的全局配置项，声明哪些目录名前缀属于 ship 管理范围（默认 `["jxx-", "huawei-cloud-"]`）。残留清理只删除匹配前缀且源中已不存在的目录，其余用户自有技能永不动。

**安装级别**：
用户级（`~/.codebuddy/skills` 等，ship 默认）与项目级（`.codebuddy/skills` 等，`--project` 选项）。`vendors.json` 每平台同时声明两级目录。

**ship**：
仓库级分发动词，对应单一入口脚本 `base/scripts/ship.mjs`。零参数执行全流程（扫描 + 双模式 + 安装 + 验证 + 清理）；子命令 `init` / `derive` / `install` / `check` 提供分步能力。文档与对话中提到"ship 一下"即指运行该命令。

## 关系

- 一份源文件经**派生规则**产出多份厂商适配版
- **厂商注册表**决定每个平台应用哪条**派生规则**或走**原样复制 fallback**
- 一个技能属于一个**桶**

## 标记的歧义

- "安装"曾被用于指代"原样复制到各平台目录"——在引入**单源派生**后，"安装" = 派生（如需）+ 复制 + 验证 + 清理残留的整体流程。
- 平台数量：规范文档写 4 家（openCode/CodeBuddy/CodeArts/Trae），实际分发目标是 7 家（+Qoder/WorkBuddy/QoderWork）——已解决：以**厂商注册表**为准，规范 4 家是"已调研有派生规则"的子集。
