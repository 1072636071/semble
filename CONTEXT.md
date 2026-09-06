# JwikisSkills 领域词汇表

跨厂商技能工程仓库：以 Skill / Agent 定义为主载体，目标分发至多家厂商 Agent 平台。

## 语言

**单源派生**：
一个技能/Agent 只手写一份厂商无关源文件（`SKILL.src.md` / `AGENT.src.md`），各厂商适配版由脚本生成到 `.generated/<vendor>/`，不手写维护多份。防止四份漂移。
_避免使用_：多份维护、手写四份
_状态（2026-08-27）_：**已落地**。`base/scripts/ship.mjs` 实现双模式分发（`derive`/`install`/`check`，配置驱动于 `vendors.json`）：含 `SKILL.src.md`/`AGENT.src.md` 走单源派生、不含走原样复制 fallback；`x-install` 控制安装目标（`false` 仅作派生源不装、`project` 仅项目级装）。

**厂商注册表（vendors.json）**：
声明全部目标平台（名称、安装目录、是否有派生规则、项目级/用户级目录）的机器可读配置。新增平台或补调研只改此配置，不改脚本。
_避免使用_：硬编码平台列表

**派生规则**：
针对某厂商的元数据改写逻辑（如 CodeArts 的 `huawei-cloud-*` name 前缀、5 行编号列表 description、英文块提取）。有派生规则的厂商走**单源派生**；未调研的厂商走原样复制 fallback。

**原样复制 fallback**：
厂商注册表中无派生规则的平台，技能目录不加改写直接复制到其安装目录（现状行为）。是**派生规则**缺位时的兼容路径，不是终态。

**桶（bucket）**：
`base/skills/` 下按用途分组的目录（`engineering/`、`productivity/`、`TDB-AM/`、`seo-geo/` 等），是技能的组织单位，不是分发单位。桶清单与 `managedPrefixes` 见 `vendors.json`。

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

**skill-as-generator**：
模板技能本身不直接干活，被调用时追问收集项目参数（域名、目标引擎、品牌口吻等），在目标项目 `.codebuddy/skills/` 生成**静态子技能**的模式。子技能 frontmatter 带 `x-template: <模板>@<版本>` + 参数快照，支持升级模式（重新生成 + diff 确认）。首例：SEO/GEO 技能族（ADR 0006）。
_避免使用_：运行时读配置文件参数化、脚本渲染生成

**`x-install: project`**：
`x-install` 的新取值（ship 待支持）：该技能**仅项目级安装**，用户级默认不装。首例：SEO/GEO 技能族整族仅项目级分发（ADR 0005）。
_避免使用_：为项目限定技能发明 ship 之外的分发通道

**seo-geo 桶 / `seo-` 前缀家族**：
`base/skills/seo-geo/` 桶承载 SEO/GEO 营销域技能族（审查模板、写作模板、五件套、`seo-router` 路由器），统一 `seo-` 前缀并注册进 `managedPrefixes`。特例：该族**仅项目级分发**（`x-install: project`），首次进场由 `ship --project` 哑拷贝，进场后生命周期由项目内 `seo-router` 兼任（ADR 0005）。

**TDB-AM 桶 / `tdai-` 前缀家族**：
`base/skills/TDB-AM/` 桶承载 TencentDB-Agent-Memory（TDAI）能力抽象技能族：
- `dsh-tdai-routing`：DSH harness ↔ TDAI 路由双向接线（早期命名例外，无 `tdai-` 前缀）
- `panel-admin`：Panel 管理域总入口（wiki/code-graph/llm-upstream/agent-团队/用量，早期命名例外）
- `tdai-remote-ops`：运维远端——SSH 为主 + HTTP 快速巡检；容器/配置/构建部署/数据备份，仅 TDAI 栈
- `tdai-codegraph-local`：本地 Code_Graph——常驻本地 KS + 用户级 MCP，单守护进程多仓库（ADR：单守护多仓库 / 编译件分发）
- `tdai-wiki-local`：本地 Wiki——远端 wiki 生命周期 + 查询（复用守护 MCP 兜底转发，ADR：wiki 兜底转发）

`tdai-` 前缀已注册进 `managedPrefixes`（ship 清理范围），`TDB-AM` 已加入 `buckets`。本地工作根 `~/.tdai/`（runtime/config/state/data）为该族运行时约定。技能族制品随发布仓库 `cnb.cool/hanjiangxue_xiaoxiao/jx-ai` 分发。

**令牌源外置**：
凭据类技能（首例 `jxx-git-auth`）在技能内只声明**仓库外机密文件的路径**，令牌值运行时读取、永不写入仓库任何文件。理由是技能会经 **ship** 分发到全部平台目录——一旦入库即等于向所有安装点扩散密钥。
_避免使用_：把令牌复制到技能目录、内联进 SKILL.md、写进 `references/`

**`jxx-git-auth`**：
`engineering` 桶的凭据加载技能。按 remote host 判定平台（`cnb.cool` / `github.com` / `gitee.com`），cnb 用户名固定为 `cnb`、GitHub 与 Gitee 令牌即身份，再按操作类型选择注入通道（HTTPS remote 内嵌 / `Authorization` 头 / `GH_TOKEN` 环境变量）。只管凭据，不含 git 教学。

## 关系

- 一份源文件经**派生规则**产出多份厂商适配版
- **厂商注册表**决定每个平台应用哪条**派生规则**或走**原样复制 fallback**
- 一个技能属于一个**桶**

## 标记的歧义

- "安装"曾被用于指代"原样复制到各平台目录"——在引入**单源派生**后，"安装" = 派生（如需）+ 复制 + 验证 + 清理残留的整体流程。
- 平台数量：规范文档写 4 家（openCode/CodeBuddy/CodeArts/Trae），实际分发目标是 7 家（+Qoder/WorkBuddy/QoderWork）——已解决：以**厂商注册表**为准，规范 4 家是"已调研有派生规则"的子集。
