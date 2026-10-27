# AGENTS.md

## 多代理要求

AGENTS.md 和 CODEBUDDY.md 内容必须保持一致。

## 与 TencentDB-Agent-Memory 的关系（子项目 · 同时演进）

**JwikisSkills 是 TencentDB-Agent-Memory（`E:\work\sp\TencentDB-Agent-Memory`）的子项目**：jxx 系列技能（`base/skills/engineering/jxx-*`，含统一工作流三技能 jxx-ticket-board / jxx-implement / jxx-implement-spec）**与 TencentDB-Agent-Memory 一起演进**——该项目（含 jxx-ticket 服务端 MyWeKnora fork 与线上 /tickets 看板）的工作流机制变更必须同步反映到本仓技能；本仓 jxx 技能的机制变更也必须同步该项目的服务端与契约文档（`docs/agents/issue-tracker.md` 等）。改 jxx 系列技能时自检：**对端项目是否需要同步改？**（2026-10-01 三技能统一改造：in-project 布局 + 统一看板 + 统一合并流，见 jxx-ticket-board `references/ADR-009-in-project-and-prd-branch.md`）

**服务器对齐默认纪律（2026-10-15 起，覆盖全部涉工单技能）**：凡是创建、修订、流转工单的 jxx 技能（to-spec / to-tickets / implement / implement-spec / code-review / triage / wayfinder / to-milestones），**本地落盘与服务器上行是同一步**，不是可选项——项目已接入服务器工单（repo_key 在 `jxx_tickets` 中出现）时：新建（PRD+工单）落盘即批量上行并回写 ticket_no/id/version 留痕；正文、评论、状态、标签的每次改动先改本地 md 再以服务器最新 `version` 作 `base_version` 乐观锁双写；**批量 push 的 id 必须从当次 `list` 实测逐条核对**（不得凭表格手抄——2026-10-15 T131–T135 串位事故：四条正文错写进邻居工单，靠乐观锁 409 + 标签过滤对账才发现）；删除走 `archived` 软删两侧一致；仅服务器不可达时允许只写本地（离线降级），回连 `jxx_ticket_sync` 收口。工具面总入口 = `jxx-ticket-router` 技能；配套 CLI = TencentDB-Agent-Memory 仓 `tools/ticket-uplink.mjs`（幂等按 repo_key+title 判重）。

**步骤打卡与断线续接（2026-10-15 起，与服务器对齐配套）**：处理工单时把执行步骤列成 `**处理步骤：**` 清单写进工单文件（每步一行 `- [ ]`），**每完成一步就地打卡**（`- [x]` + 步尾日期，必要时一行执行事实）并按服务器对齐纪律同步服务器副本——线上线下同步更新，打卡即存档。会话中断/换会话/换人续接时从打卡现场直接恢复，不重做已完成步骤、不凭记忆重建进度；续接入口 = 工单打卡区 + 评论时间线 + 服务器副本三方对齐，不一致以服务器为准。落地技能：jxx-implement 1.8.0（执行面完整块）、jxx-implement-spec 1.7.0（worker 锚点）、jxx-wayfinder 1.3.0（调查步打卡）、jxx-ticket-board 0.16.0（打卡真源 = 工单 md，卡面只带状态与指针）。

**验收点闭包纪律（2026-10-21 起，覆盖全部涉工单技能）**：AC 唯一权威源 = `base/skills/engineering/jxx-to-tickets/references/acceptance-criteria.md`（判据正文只在这份，其他技能只留动作 + pointer）。
三道闸各一条命令：**生产闸** `node base/scripts/ac-audit.mjs <功能目录> --strict`；**执行闸** `node base/scripts/ac-audit.mjs <工单文件>`；**审查闸** `git diff origin/main...HEAD` 逐条 AC 自己取证。
放行条件与退出码语义全在规范里（§四 / §五 / §七 / §八），本文件不复述。

## 技能与文档判据（宪章 · 唯一权威源）

写或改任何 Skill 前按**技能宪章**自检四个词——**可触发、可执行、可验证、可维护**。判据正文只在 `docs/agents/skill-charter.md`（十条原则 + 描述模板 + 自查清单），机器闸 `node base/scripts/skill-lint.mjs --strict`；怎么算做完见 `docs/agents/quality-charter.md`。

## Agent skills

### Issue tracker

本仓库的 issue 与 PRD 以本地 markdown 形式存放于仓库 `.scratch/` 下，不使用远程 tracker。参见 `docs/agents/issue-tracker.md`。

> 注意：`.scratch/` 是仓库源码的一部分，**必须提交进 git**（不要写进 `.gitignore`），让 issue / PRD 随仓库一起版本化管理、可回溯、可协作。

### triage 标签

采用五种标准 triage 角色（标签字符串与角色名一致，未覆盖）：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。

### 领域文档

单一上下文布局：仓库根目录 `CONTEXT.md` + `docs/adr/`。参见 `docs/agents/domain.md`。

### 安装脚本（ship）

> **安装清单**：`ship install` 会在每个目标 skills 目录写 `.ship-installed.json`，记录本仓装过的技能名。残留清理以它为准（无清单时回退内容指纹），所以**前缀相同但不是本仓装的技能不会被删**。别手删这个文件——删了之后清理会退化为「只认内容指纹」，更保守但不彻底。

`base/scripts/ship.mjs` 负责跨厂商分发 Skills/Agent，缺省跑全流程（派生+安装+验证+清理），子命令 `init`/`derive`/`install`/`check`。厂商清单与安装目录全部由 `base/scripts/vendors.json` 配置驱动，脚本零硬编码。其中 QoderWork 的用户级目标为 `~/.qwenworkcn/skills`。脚本用 `detectUserHome()` 自动定位用户目录（`os.homedir()` → `USERPROFILE`/`HOME` → 常见用户根目录），也可用 `--user-home <dir>` 覆盖。常用：`node ship.mjs install`、`--dry-run` 预览、`check` 门禁预检。

### dsh-agent-studio 配置管理（真源在本仓）

dsh-agent-studio（DeepSeek Harness Agent Studio）的配置管理真源在本仓库 `code` 桶：`base/skills/code/dsh-agent-studio-config/`（`SKILL.md` 入口 + `references/` 契约文档 + `scripts/` 零依赖 mjs，清单以其 SKILL.md 的资源索引为准）。改操作手册、改脚本、改坑清单一律改这份仓库副本，改完跑 `node base/scripts/ship.mjs install` 刷新各平台安装副本，再 `check` 过门禁。

`~/.agents/skills/dsh-agent-studio-config/` 是 **kimi 厂商归一化后的派生物，不是真源**：kimi 厂商会把 frontmatter 归一为 `name + description`（`x-install`、`metadata` 等字段被剥掉，见 `ship.mjs` 的 `kimiStyleFrontmatter`），所以它与仓库源必然有 frontmatter 差异，**别据此判断分叉**。判断是否同步要比 `references/` 与 `scripts/` 的文件哈希；真源与安装副本冲突时一律以仓库为准。`base/skills/code/dsh-plugin-dev/` 同理。

### 第三方技能：quarkclouddrive（夸克网盘）

夸克网盘官方 Skill 以**原样分发**方式入库：真源是 `base/skills/productivity/quarkclouddrive/`（`SKILL.md` + `references/` + `scripts/`）。它是 plain `SKILL.md`（无 `SKILL.src.md`），走 `ship.mjs` 的 `srcMode=false` 直拷分支，不做厂商派生；`managedPrefixes` 已含 `quarkclouddrive`，所以 `node base/scripts/ship.mjs install` 会把它同步到全部全局技能目录（含 dsh 读取的 `~/.agents/skills`）。

- **升级**：官方 `bash scripts/install.sh` 会从 `open-api-drive.quark.cn/agent/v1/skill_config` 拉最新 zip 就地覆盖 `SKILL.md` / `references/` / `scripts/`。升级后把新内容回灌仓库真源，再跑一次 `ship install`，不要只留安装副本。
- **授权**：配置落在 `<副本>/<agentId>/config.json`（`agentId` 由 `node scripts/quark-drive.cjs resolve-agent` 决定，本机为 `deepseek`）。登录命令 `node <副本>/scripts/quark-drive.cjs login --token <agent_auth_code>`；`agent_auth_code` 一次性且很快过期，过期就走 `login`（浏览器 OAuth）。
- **登录态保护**：`vendors.json` 的 `preserveOnInstall` 声明 `quarkclouddrive: ["deepseek"]`，`ship.mjs` 安装该技能前会把 `deepseek/` 暂存、覆盖完再放回，因此 `ship install` 不再清掉登录态。登录态**不入库**（`.gitignore` 已排除 `deepseek/`），换机器或换用户需重新登录。令牌备份在本机 `~/.quarkclouddrive/login-deepseek.json`：其他副本报未授权时用它覆盖 `<副本>/deepseek/config.json` 即可，免去重新授权。
- **卸载**：按官方两步——先 `bash scripts/uninstall.sh` 撤销授权并清除配置，再删除技能目录。

### 第三方技能：ego-browser（ego lite 浏览器）

ego lite 自带的浏览器技能以**原样分发**方式入库：真源是 `base/skills/productivity/ego-browser/`（`SKILL.md` + `references/` + `scripts/` + `agents/` + `assets/` + `learnings/`）。它是 plain `SKILL.md`（无 `SKILL.src.md`），走 `ship.mjs` 的 `srcMode=false` 直拷分支；`vendors.json` 的 `managedPrefixes` 含 `ego-browser`，所以 `node base/scripts/ship.mjs install` 会把它同步到全部全局技能目录（含 dsh 读取的 `~/.agents/skills`）。

- **上游源**：ego lite 应用安装目录下的 `ego-skills/ego-browser/`——本机为 `C:\Program Files\Citro Labs\ego lite\Application\<版本>\ego-skills\ego-browser`（当前 0.6.0.16）。仓库副本与该目录逐字一致；升级 ego 后从新的版本目录回灌仓库，再跑 `ship install`，不要只留安装副本。
- **运行时引导**：技能正文只教一件事——任何浏览器任务前先跑 `ego-browser skill`，按它打印的（与安装版本匹配的）用法指南执行；升级 ego 或输出提示时重跑。
- **learnings 是生长状态**：`learnings/` 随使用增长，仓库里存的只是 ego 出厂 seed。全部 7 处目标目录都由本仓维护，重装会用仓库 seed 覆盖；ego 往哪些目录里写 learnings 属上游行为，若别处有积累需自行备份，因此**不**登记 `preserveOnInstall`（那是给 quarkclouddrive 登录态那种「本仓安装、又要保住运行时状态」的目录用的）。
- **上游安装器占位（已收编 · 2026-10-23）**：ego 曾自己往 `~/.agents/skills` 与 `~/.workbuddy/skills` 装过一份，目录连同 Program Files 的只读 ACL 一起复制下来（普通用户连新建文件都被拒），因此一度用 `vendors.json` 的 `foreignInstalled` 把它标成跳过。本次以管理员删旧副本 + 重跑 `ship install` 收编，`foreignInstalled` 条目已移除——7 处目标现在全部由本仓维护（各 23 文件 = 22 上游 + `local-install.md`）。旧副本备份在 `~/.ego-backup-20261023/`。
- **本仓只有两处扩展，回灌后必须重放**：① `references/local-install.md`——本机 ego 组件落点（`ego-browser` 命令行 junction、安装根与版本目录、用户数据、7 处技能副本及只读 ACL、上游回灌步骤）；② `SKILL.md` 的 description 末尾一句本机标注「本机默认外置浏览器技能」（外加 References 里指向①的一行）。除这两处，其余与上游**逐字一致**——第三方技能不改写、不翻译、不压缩描述。回灌后核对 `git diff` 应只剩这两处 + 上游版本号变化。

### 第三方技能：open-code-review（只留仓库真源，不外装）

官方 `open-code-review` 技能**只在仓库内保留真源**：`base/skills/engineering/open-code-review/SKILL.md` 的 frontmatter 带 `x-install: false`（`ship.mjs` 语义：不装），所以 `ship install` 不再把它铺到任何用户级 / 项目级技能目录。

- **同族技能不受影响**：`open-code-review-delegate` 未标 `x-install`，仍按缺省用户级分发到全部平台目录。
- **旧副本必须手工删**：`managedPrefixes` 不含 `open-code-review`，且残留清理以「源中全部技能名」为准（源里仍有这个技能，就不算残留），`ship install` 不会自动清；2026-10-23 已手工删掉 10 处 `skills/open-code-review`：`~/.agents`、`~/.codeartsdoer`、`~/.codebuddy`、`~/.config/codeartsdoer`、`~/.config/opencode`、`~/.qoder-cn`、`~/.qwenworkcn`、`~/.trae-cn`、`~/.workbuddy`、`~/.workbuddy-ai`。
- **恢复分发**：删掉 `SKILL.md` 里那行 `x-install: false`，再跑 `node base/scripts/ship.mjs install`。

### 临时文件

所有临时脚本统一放在仓库 `.temp/scripts/` 下；其他临时文件（脚本输出、日志等）也要分类，放在 `.temp/` 的子目录下（如 `.temp/output/`、`.temp/logs/`），保证仓库根目录干净。

### 新增 SKILL

使用 `jxx-skill-init` 技能（`base/skills/engineering/jxx-skill-init/`）在本仓库中新建技能。该技能封装了 `ship init` 模板生成 + 仓库约定（桶选择、frontmatter 规范、`x-install`/`x-vendors` 派生字段、evals 目录），确保新技能一次创建即通过 `check` 门禁。

### 目标仓库的项目技能目录（jxx-setup-skills 负责）

`jxx-setup-skills`（1.5.0 起）给**目标仓库**建 `docs/agents/skills/`（一个技能一个子目录 + `SKILL.md`，可选 `--skills-dir` 改路径、`--no-skills` 关闭），并在 `AGENTS.md` 的 `## Agent skills` 块里维护一节**受管**技能清单：表格夹在 `<!-- jxx-setup-skills:skills:start -->` / `<!-- jxx-setup-skills:skills:end -->` 之间，由扫描目录生成。

- 目标仓库**新增、删除或改动**项目技能（含只改 `description`）后跑 `node <jxx-setup-skills>/scripts/setup.mjs sync-skills --root <仓库根>` 刷新清单，并自动把 `AGENTS.md` 逐字节同步到 `CODEBUDDY.md`。
- **本仓库自己例外**：技能真源在 `base/skills/**`（跨厂商分发，不落 `docs/agents/skills/`），所以在本仓跑 `jxx-setup-skills` 初始化时应带 `--no-skills`，不要在 `docs/agents/skills/` 造第二份技能副本。
- 目标仓库若已自己维护手写技能清单，脚本**不插第二份**，而是报冲突；给既有清单加一对 `skills:start`/`skills:end` 标记即由脚本接管。