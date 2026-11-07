# AGENTS.md

## 多代理要求

AGENTS.md 和 CODEBUDDY.md 内容必须保持一致。

## 与 TencentDB-Agent-Memory 的关系（子项目 · 同时演进）

**JwikisSkills 是 TencentDB-Agent-Memory（`E:\work\sp\TencentDB-Agent-Memory`）的子项目**：jxx 系列技能（`base/skills/engineering/jxx-*`，含统一工作流三技能 jxx-ticket-board / jxx-implement / jxx-implement-spec）**与 TencentDB-Agent-Memory 一起演进**——该项目（含 jxx-ticket 服务端 MyWeKnora fork 与线上 /tickets 看板）的工作流机制变更必须同步反映到本仓技能；本仓 jxx 技能的机制变更也必须同步该项目的服务端与契约文档（`docs/agents/issue-tracker.md` 等）。改 jxx 系列技能时自检：**对端项目是否需要同步改？**（2026-10-01 三技能统一改造：in-project 布局 + 统一看板 + 统一合并流，见 jxx-ticket-board `references/ADR-009-in-project-and-prd-branch.md`）

**服务器对齐默认纪律（2026-10-30 修订，覆盖全部涉工单技能）**：凡是创建、修订、流转工单的 jxx 技能（to-spec / to-tickets / implement / implement-spec / code-review / triage / wayfinder / to-milestones），新建（PRD+工单）落盘即批量上行并回写 ticket_no/id/version 留痕；普通正文与处理步骤只写本地，认领、阻塞或人工决策、`pending-review`、`done` 与交接五类里程碑同步服务器。同步时以服务器最新 `version` 作 `base_version` 乐观锁双写；**批量 push 的 id 必须从当次 `list` 实测逐条核对**（不得凭表格手抄——2026-10-15 T131–T135 串位事故：四条正文错写进邻居工单，靠乐观锁 409 + 标签过滤对账才发现）；删除走 `archived` 软删两侧一致；服务器不可达时保留本地进度并显式报告待补报，回连 `jxx_ticket_sync` 收口。工具面总入口 = `jxx-ticket-router` 技能；配套 CLI = TencentDB-Agent-Memory 仓 `tools/ticket-uplink.mjs`（幂等按 repo_key+title 判重）。

**步骤打卡与断线续接（2026-10-30 修订，与服务器对齐配套）**：处理工单时把执行步骤列成 `**处理步骤：**` 清单写进工单文件（每步一行 `- [ ]`），**每完成一步就地更新本地 Markdown 打卡**（`- [x]` + 步尾日期，必要时一行执行事实），普通步骤不调用 `ticket-flow`。交接前用 `ticket-flow --dir <功能目录>` 批量收敛并处理全部 `needs_judgement`，不引入后台静默上传；完成交接同步后，会话中断/换会话/换人续接时从打卡现场直接恢复，不重做已完成步骤、不凭记忆重建进度。落地技能：jxx-implement 1.13.0（执行面完整块）、jxx-implement-spec 1.9.0（worker 锚点）、jxx-wayfinder 1.5.0（调查步打卡）、jxx-ticket-board 0.19.0（打卡真源 = 工单 md，卡面只带状态与指针）。

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

**内联源（`x-inline: true`）**：标了的技能不单独安装，正文由 `ship install` 注入引用技能的 `SKILL.md` 末尾固定 marker 块；当前 `jxx-grilling` + `jxx-grill-me` 作为原语包（`vendors.json` 的 `inlineBundles`）内联进 4 个引用技能，路由技能由 `inlineExcludeConsumers` 排除、保持轻量。安装器靠扫描正文里的 `/<源名>` 识别依赖，**这些字样要保留**；注入块开头明确点破它们是依赖标记、指块内 `###` 段，不是调用外部技能。**改内联源正文或注入逻辑后必须重跑 `ship install` 再 `check`**：块内 manifest 记每个源正文 hash + 注入模板 hash，没重跑就报 `E_INLINE_STALE` 并提示复核依赖技能的描述与流程；源无宿主报 `E_INLINE_ORPHAN`，源含本地相对链接 / `<!--en-->` / 是 `SKILL.src.md` 报 `E_INLINE_LOCAL_LINK` / `E_INLINE_UNSUPPORTED`。细则见 `base/skills/安装.md` 的「内联源」节。

**未安装技能索引**：`jxx-ask-matt` 的 `references/not-installed-skills.md` 列出未随 `ship install` 分发的 jxx 技能（`x-install: false` / `x-inline: true` / 未分发桶）及仓内真源路径；用户只保留常用技能时，路由指示 agent 按路径 `read` 仓内全文，不改 DSH、不临时安装。索引由 `node base/scripts/ask-matt-index.mjs` 生成；卸载/新增/改 description 后必须重跑一次，`ship check` 以 `E_ASK_MATT_INDEX` 挡住过期索引。DSH 侧做不到「catalog 隐藏但可显式加载」（`tool-skill` 的 catalog 与 loader 共用注册表且都要求 `modelInvocable`）。细则见 `base/skills/安装.md` 的「未安装技能索引」节。

**卸载边界**：`ship install` 只清 `vendors.json` 声明的用户级/项目级目标，不清历史用户目录，更不清其它仓库自带的 `docs/agents/skills/` 副本（那些副本随对方仓库 git 走，其 AGENTS.md 通常明写「不需要 ship install」）。新会话里仍出现已卸载技能时，先全盘扫目录定位来源，再逐处清并同步对方清单；详细实录见 `base/CHANGELOG.md` 2026-11-07 内联源条目。

### dsh-agent-studio 配置管理（真源在本仓）

dsh-agent-studio（DeepSeek Harness Agent Studio）的配置管理真源在本仓库 `code` 桶：`base/skills/code/dsh-agent-studio-config/`（`SKILL.md` 入口 + `references/` 契约文档 + `scripts/` 零依赖 mjs，清单以其 SKILL.md 的资源索引为准）。改操作手册、改脚本、改坑清单一律改这份仓库副本，改完跑 `node base/scripts/ship.mjs install` 刷新各平台安装副本，再 `check` 过门禁。

`~/.agents/skills/dsh-agent-studio-config/` 是 **kimi 厂商归一化后的派生物，不是真源**：kimi 厂商会把 frontmatter 归一为 `name + description`（`x-install`、`metadata` 等字段被剥掉，见 `ship.mjs` 的 `kimiStyleFrontmatter`），所以它与仓库源必然有 frontmatter 差异，**别据此判断分叉**。判断是否同步要比 `references/` 与 `scripts/` 的文件哈希；真源与安装副本冲突时一律以仓库为准。（`dsh-plugin-dev` 自 2026-11-07 起 `x-install: false`，已不分发，不再有安装副本；口径见「不默认安装的技能」节。）

### 第三方技能：quarkclouddrive（夸克网盘）· 已全局卸载，仅留仓内真源

夸克网盘官方 Skill 以**原样分发**方式入库：真源是 `base/skills/productivity/quarkclouddrive/`（`SKILL.md` + `references/` + `scripts/`）。plain `SKILL.md`（无 `SKILL.src.md`）。

**2026-11-06 起 `x-install: false`**：11 处用户级技能目录的旧副本已手工删净（`.agents`、`.codebuddy`、`.codeartsdoer`、`.config/codeartsdoer`、`.config/opencode`、`.qoder-cn`、`.qoderworkcn`、`.qwenworkcn`、`.trae-cn`、`.workbuddy`、`.workbuddy-ai`）。要用就从此目录直接 `node scripts/quark-drive.cjs ...`，或把整目录拷进目标 skills 目录；恢复分发 = 把该行改回 `true` 再 `ship install`。库内快照在 WeKnora `dfaaf6fc` 的 `quarkclouddrive/`（22 条，索引 `quarkclouddrive-技能索引`）。

- **升级**：官方 `bash scripts/install.sh` 会从 `open-api-drive.quark.cn/agent/v1/skill_config` 拉最新 zip 就地覆盖 `SKILL.md` / `references/` / `scripts/`。升级后把新内容回灌仓库真源，再回灌库内快照，不要只留安装副本。
- **授权**：配置落在 `<副本>/<agentId>/config.json`（`agentId` 由 `node scripts/quark-drive.cjs resolve-agent` 决定，本机为 `deepseek`）。登录命令 `node <副本>/scripts/quark-drive.cjs login --token <agent_auth_code>`；`agent_auth_code` 一次性且很快过期，过期就走 `login`（浏览器 OAuth）。
- **登录态**：不进库（`.gitignore` 已排除 `deepseek/`）。删副本前的登录态已备份到本机 `~/.quarkclouddrive/backup/config-deepseek-20261106.json`（另有 `~/.quarkclouddrive/login-deepseek.json`）；临时用时放回 `<副本>/deepseek/config.json` 即可免重新授权。`vendors.json` 的 `preserveOnInstall` 仍声明 `quarkclouddrive: ["deepseek"]`，恢复分发后 `ship install` 不会清登录态。
- **卸载**：按官方两步——先 `bash scripts/uninstall.sh` 撤销授权并清除配置，再删除技能目录。
- **库内大脚本是 base64**：服务端 manual 通道对 minified JS 原样上传会直接断连（ECONNRESET，与体积无关——2,000 B 同样断，base64 下 120,000 rune 正常）。`quark-drive.cjs` 因此存成 `...b64-part01..06` 六段，还原口径与 sha256 写在 part01 头部与索引条目里。

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

### 自研技能：Craft 套件（子技能只留真源，原文入知识库）

storytold/ArtCraft 13 个子技能（`base/skills/storytold/<app>/SKILL.src.md`：figcraft / vectorcraft / gridcraft / cadcraft / designcraft / deckcraft / soundcraft / filmcraft / effectcraft / photocraft / lightcraft / pdfcraft / wordcraft）**不再外装**，frontmatter 标 `x-install: false`，只装路由 `craft-router`。

- **这是自研资产，不是三方技能**：可运行、可修改、可优化。算着「改行为」时一律改仓内真源，再 `node base/scripts/ship.mjs install` + `check` + `node base/scripts/skill-lint.mjs --strict`。
- **原文副本在库**：WeKnora `dfaaf6fc-1e5d-4385-a290-58c847d71bcb` 的 `craft/<app>`，条目 `craft-<app>`，索引 `craft-技能索引`。库内是**快照**，改完真源必须用 `PUT /api/v1/knowledge/manual/<id>` 带 `{title, content, status:"publish"}` 回灌，否则 agent 会照过期配方干活。
- **旧副本必须手工删**（同 `open-code-review`）：残留清理以「源中仍存在的技能名」为准，源留着就不算残留。2026-10-28 已删 7 处技能根共 91 个目录（含 `.codeartsdoer` 的 `huawei-cloud-codebuddy-*` 前缀变体）。
- **恢复分发**：把某个源的 `x-install` 改回 `true`，再 `node base/scripts/ship.mjs install`。
- **2026-10-28 优化批（现状基线）**：13 份原文全部升 `0.2.0`、路由升 `0.3.0`。每份改成**可复制实测配方**（命令本机跑过、给真实产物字节数），并补 `输入` / `输出与校验` / `失败出口` 三节；四道闸现状 = 全部 `P0 0 / P1 0 / P2 1`（只剩 `sk-08` 无 evals，库快照型文档技能按此保留），`score 98`，正文 88–143 行。
- **实测口径（旧文档错的别照抄）**：目录名**没有**尾随空格（`D:\storytoldExe\FigCraft\figcraft-cli.exe`）；`describe` 只有 designcraft / deckcraft / soundcraft / filmcraft 四家有；`--automation-read-root` / `--automation-write-root` **只属 `mcp`**（`run` 传即 `unknown option`）；`commands --json` 不是通用旗标，数条数必须解析 JSON 数组长度（数行会翻倍、grep 字面会虚胖）；`Launcher\artcraft-launcher.exe` 是 GUI，启动即自动更新全部应用，agent 不要跑。

### 不默认安装的技能（`x-install: false`）

- **`jxx-wizard`**（`base/skills/engineering/`）：2026-11-07 姜先生决定默认不安装，frontmatter 已标 `x-install: false`（升 1.2.0）。12 处旧副本已手工删净：9 处用户级 + `ai-international-trade` 主仓与 2 个 worktree 的 `docs/agents/skills/`（对方 AGENTS/CODEBUDDY/INDEX/README 同步刷新）。`managedPrefixes` 含 `jxx-` 但源仍在仓里，残留清理不认，须显式删。真源留仓，要临时用就手工拷或把该行改回 `true` 再 `ship install`。
- **`dsh-plugin-dev`**（`base/skills/code/`）：2026-11-07 姜先生决定默认不安装，frontmatter 已标 `x-install: false`，9 处用户级技能目录的旧副本已手工删净（`.agents`、`.codebuddy`、`.codeartsdoer`、`.qoder-cn`、`.qoderworkcn`、`.qwenworkcn`、`.trae-cn`、`.workbuddy`、`.workbuddy-ai`）。**`managedPrefixes` 不含 `dsh-` 前缀且源仍在仓里，`ship` 不会自动清**，恢复或卸载都须显式处理副本。真源留仓，要临时用就手工拷或把该行改回 `true` 再 `ship install`。
- **`jxx-to-questionnaire`**（`base/skills/productivity/`）：2026-10-28 姜先生决定不再自动安装，frontmatter 已标 `x-install: false`，7 处技能目录的旧副本已手工删净（同 `open-code-review` / Craft 的约束：源留着就清不掉）。真源留仓，要临时用就手工拷或把该行改回 `true` 再 `ship install`。
- **`jxx-perf-iteration`**（`base/skills/engineering/`）：2026-10-28 姜先生决定默认不安装，frontmatter 已标 `x-install: false`，7 处用户级技能目录的旧副本（含 `.codeartsdoer` 的 `huawei-cloud-codebuddy-` 前缀变体）已手工删净。**仅覆盖 Rust / Cargo / criterion 生态**（有意不做语言抽象：非 Rust 项目套这份提示词与护栏会得到似是而非的流程）。真源留仓，要临时用就手工拷或把该行改回 `true` 再 `ship install`。
- **`jxx-prototype`**（`base/skills/engineering/`）：2026-11-06 姜先生决定默认不安装，frontmatter 已标 `x-install: false`，11 处用户级技能目录的旧副本已手工删净（`.agents`、`.codebuddy`、`.codeartsdoer`、`.config/codeartsdoer`、`.config/opencode`、`.qoder-cn`、`.qoderworkcn`、`.qwenworkcn`、`.trae-cn`、`.workbuddy`、`.workbuddy-ai`）。真源留仓，要临时用就手工拷或把该行改回 `true` 再 `ship install`。
- **`lexiang` / `ima-skill` / `quarkclouddrive`**（`base/skills/productivity/`）：2026-11-06 姜先生决定**全局卸载**、仓内保留原文（这三个技能不常用）。三者 frontmatter 均标 `x-install: false`，11 处用户级技能目录的旧副本已手工删净。
  **仓内即完整原文**：`lexiang/upstream/<技能名>/`（7 个分域技能共 29 文件）、`ima-skill/upstream/`（入口 + 两子模块共 10 文件，含 `ima_api.cjs` 可直接跑）、`quarkclouddrive/`（`SKILL.md` + `references/` + `scripts/`，含 645,910 B 的 `quark-drive.cjs`）。
  **库内是检索快照**：WeKnora `dfaaf6fc` 的 `lexiang/`（29 条）、`ima/`（10 条）、`quarkclouddrive/`（22 条，含 base64 六段的 CLI）。改仓内原文后须回灌库内对应条目，否则快照过期。
- **`jxx-mcp-design`**（`base/skills/engineering/`）、**`jxx-agnes-video` / `jxx-agnes-image` / `jxx-t2i-prompts`**（`base/skills/productivity/`）：2026-11-06 姜先生决定默认不安装，frontmatter 已标 `x-install: false`，旧副本已手工删净（11 处用户级技能目录共 29 个目录，含 `.codeartsdoer` 的 `huawei-cloud-codebuddy-` 前缀变体）。真源留仓，要临时用就手工拷或把该行改回 `true` 再 `ship install`。

### 临时文件

所有临时脚本统一放在仓库 `.temp/scripts/` 下；其他临时文件（脚本输出、日志等）也要分类，放在 `.temp/` 的子目录下（如 `.temp/output/`、`.temp/logs/`），保证仓库根目录干净。

### 新增 SKILL

使用 `jxx-skill-init` 技能（`base/skills/engineering/jxx-skill-init/`）在本仓库中新建技能。该技能封装了 `ship init` 模板生成 + 仓库约定（桶选择、frontmatter 规范、`x-install`/`x-vendors` 派生字段、evals 目录），确保新技能一次创建即通过 `check` 门禁。

### 目标仓库的项目技能目录（jxx-setup-skills 负责）

`jxx-setup-skills`（1.5.0 起）给**目标仓库**建 `docs/agents/skills/`（一个技能一个子目录 + `SKILL.md`，可选 `--skills-dir` 改路径、`--no-skills` 关闭），并在 `AGENTS.md` 的 `## Agent skills` 块里维护一节**受管**技能清单：表格夹在 `<!-- jxx-setup-skills:skills:start -->` / `<!-- jxx-setup-skills:skills:end -->` 之间，由扫描目录生成。

- 目标仓库**新增、删除或改动**项目技能（含只改 `description`）后跑 `node <jxx-setup-skills>/scripts/setup.mjs sync-skills --root <仓库根>` 刷新清单，并自动把 `AGENTS.md` 逐字节同步到 `CODEBUDDY.md`。
- **本仓库例外**：本仓唯一项目技能 `tool-intro` 落 `docs/agents/skills/tool-intro/`；其余技能真源仍在 `base/skills/**`（跨厂商分发）。因此在本仓跑 jxx-setup-skills 初始化时**仍带 `--no-skills`**，只对项目技能跑 `sync-skills`，不要在 `docs/agents/skills/` 造第二份 base 技能副本。
- 目标仓库若已自己维护手写技能清单，脚本**不插第二份**，而是报冲突；给既有清单加一对 `skills:start`/`skills:end` 标记即由脚本接管。

### 项目技能（`docs/agents/skills/`）

本仓项目技能的**唯一存放处**：一个技能一个目录 `docs/agents/skills/<name>/`，入口 `docs/agents/skills/<name>/SKILL.md`（frontmatter 写 `name` + `description`），可选 `references/`、`scripts/`。

**新增、删除或改动任一技能后，必须重跑** `node <jxx-setup-skills 目录>/scripts/setup.mjs sync-skills --root <仓库根>`：它重新扫描该目录并重写下表（标记之间由脚本维护，标记之外的手写内容不会被动），再把 `AGENTS.md` 逐字节同步到 `CODEBUDDY.md`。

<!-- jxx-setup-skills:skills:start -->
| 技能 | 何时加载 |
| --- | --- |
| `tool-intro` | 记录并介绍开发工具（GitHub 项目），生成中文工具档案与 HTML 汇总页 |
<!-- jxx-setup-skills:skills:end -->
