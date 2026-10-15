# AGENTS.md

## 多代理要求

AGENTS.md 和 CODEBUDDY.md 内容必须保持一致。

## 与 TencentDB-Agent-Memory 的关系（子项目 · 同时演进）

**JwikisSkills 是 TencentDB-Agent-Memory（`E:\work\sp\TencentDB-Agent-Memory`）的子项目**：jxx 系列技能（`base/skills/engineering/jxx-*`，含统一工作流三技能 jxx-ticket-board / jxx-implement / jxx-implement-spec）**与 TencentDB-Agent-Memory 一起演进**——该项目（含 jxx-ticket 服务端 MyWeKnora fork 与线上 /tickets 看板）的工作流机制变更必须同步反映到本仓技能；本仓 jxx 技能的机制变更也必须同步该项目的服务端与契约文档（`docs/agents/issue-tracker.md` 等）。改 jxx 系列技能时自检：**对端项目是否需要同步改？**（2026-10-01 三技能统一改造：in-project 布局 + 统一看板 + 统一合并流，见 jxx-ticket-board `references/ADR-009-in-project-and-prd-branch.md`）

**服务器对齐默认纪律（2026-10-15 起，覆盖全部涉工单技能）**：凡是创建、修订、流转工单的 jxx 技能（to-spec / to-tickets / implement / implement-spec / code-review / triage / wayfinder / to-milestones），**本地落盘与服务器上行是同一步**，不是可选项——项目已接入服务器工单（repo_key 在 `jxx_tickets` 中出现）时：新建（PRD+工单）落盘即批量上行并回写 ticket_no/id/version 留痕；正文、评论、状态、标签的每次改动先改本地 md 再以服务器最新 `version` 作 `base_version` 乐观锁双写；**批量 push 的 id 必须从当次 `list` 实测逐条核对**（不得凭表格手抄——2026-10-15 T131–T135 串位事故：四条正文错写进邻居工单，靠乐观锁 409 + 标签过滤对账才发现）；删除走 `archived` 软删两侧一致；仅服务器不可达时允许只写本地（离线降级），回连 `jxx_ticket_sync` 收口。工具面总入口 = `jxx-ticket-router` 技能；配套 CLI = TencentDB-Agent-Memory 仓 `tools/ticket-uplink.mjs`（幂等按 repo_key+title 判重）。

**步骤打卡与断线续接（2026-10-15 起，与服务器对齐配套）**：处理工单时把执行步骤列成 `**处理步骤：**` 清单写进工单文件（每步一行 `- [ ]`），**每完成一步就地打卡**（`- [x]` + 步尾日期，必要时一行执行事实）并按服务器对齐纪律同步服务器副本——线上线下同步更新，打卡即存档。会话中断/换会话/换人续接时从打卡现场直接恢复，不重做已完成步骤、不凭记忆重建进度；续接入口 = 工单打卡区 + 评论时间线 + 服务器副本三方对齐，不一致以服务器为准。落地技能：jxx-implement 1.6.0（执行面完整块）、jxx-implement-spec 1.6.0（worker 锚点）、jxx-wayfinder 1.3.0（调查步打卡）、jxx-ticket-board 0.15.2（打卡真源 = 工单 md，卡面只带状态与指针）。

## Agent skills

### Issue tracker

本仓库的 issue 与 PRD 以本地 markdown 形式存放于仓库 `.scratch/` 下，不使用远程 tracker。参见 `docs/agents/issue-tracker.md`。

> 注意：`.scratch/` 是仓库源码的一部分，**必须提交进 git**（不要写进 `.gitignore`），让 issue / PRD 随仓库一起版本化管理、可回溯、可协作。

### triage 标签

采用五种标准 triage 角色（标签字符串与角色名一致，未覆盖）：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。

### 领域文档

单一上下文布局：仓库根目录 `CONTEXT.md` + `docs/adr/`。参见 `docs/agents/domain.md`。

### 安装脚本（ship）

`base/scripts/ship.mjs` 负责跨厂商分发 Skills/Agent，缺省跑全流程（派生+安装+验证+清理），子命令 `init`/`derive`/`install`/`check`。厂商清单与安装目录全部由 `base/scripts/vendors.json` 配置驱动，脚本零硬编码。其中 QoderWork 的用户级目标为 `~/.qwenworkcn/skills`。脚本用 `detectUserHome()` 自动定位用户目录（`os.homedir()` → `USERPROFILE`/`HOME` → 常见用户根目录），也可用 `--user-home <dir>` 覆盖。常用：`node ship.mjs install`、`--dry-run` 预览、`check` 门禁预检。

### dsh-agent-studio 配置管理（真源在本仓）

dsh-agent-studio（DeepSeek Harness Agent Studio）的配置管理真源在本仓库 `code` 桶：`base/skills/code/dsh-agent-studio-config/`（`SKILL.md` + `references/` 四份契约文档 + `scripts/` 五个零依赖 mjs）。改操作手册、改脚本、改坑清单一律改这份仓库副本，改完跑 `node base/scripts/ship.mjs install` 刷新各平台安装副本，再 `check` 过门禁。

`~/.agents/skills/dsh-agent-studio-config/` 是 **kimi 厂商归一化后的派生物，不是真源**：kimi 厂商会把 frontmatter 归一为 `name + description`（`x-install`、`metadata` 等字段被剥掉，见 `ship.mjs` 的 `kimiStyleFrontmatter`），所以它与仓库源必然有 frontmatter 差异，**别据此判断分叉**。判断是否同步要比 `references/` 与 `scripts/` 的文件哈希；真源与安装副本冲突时一律以仓库为准。`base/skills/code/dsh-plugin-dev/` 同理。

### 临时文件

所有临时脚本统一放在仓库 `.temp/scripts/` 下；其他临时文件（脚本输出、日志等）也要分类，放在 `.temp/` 的子目录下（如 `.temp/output/`、`.temp/logs/`），保证仓库根目录干净。

### 新增 SKILL

使用 `jxx-skill-init` 技能（`base/skills/engineering/jxx-skill-init/`）在本仓库中新建技能。该技能封装了 `ship init` 模板生成 + 仓库约定（桶选择、frontmatter 规范、`x-install`/`x-vendors` 派生字段、evals 目录），确保新技能一次创建即通过 `check` 门禁。

### 目标仓库的项目技能目录（jxx-setup-skills 负责）

`jxx-setup-skills`（1.5.0 起）给**目标仓库**建 `docs/agents/skills/`（一个技能一个子目录 + `SKILL.md`，可选 `--skills-dir` 改路径、`--no-skills` 关闭），并在 `AGENTS.md` 的 `## Agent skills` 块里维护一节**受管**技能清单：表格夹在 `<!-- jxx-setup-skills:skills:start -->` / `<!-- jxx-setup-skills:skills:end -->` 之间，由扫描目录生成。

- 目标仓库**新增、删除或改动**项目技能（含只改 `description`）后跑 `node <jxx-setup-skills>/scripts/setup.mjs sync-skills --root <仓库根>` 刷新清单，并自动把 `AGENTS.md` 逐字节同步到 `CODEBUDDY.md`。
- **本仓库自己例外**：技能真源在 `base/skills/**`（跨厂商分发，不落 `docs/agents/skills/`），所以在本仓跑 `jxx-setup-skills` 初始化时应带 `--no-skills`，不要在 `docs/agents/skills/` 造第二份技能副本。
- 目标仓库若已自己维护手写技能清单，脚本**不插第二份**，而是报冲突；给既有清单加一对 `skills:start`/`skills:end` 标记即由脚本接管。
