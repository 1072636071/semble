# mattpocock-skills

## jxx-to-milestones 彻底删除 2026-11-07

姜先生决定彻底删除，只留 git 历史（不做 `x-install: false` 卸载）。

- 删真源 `base/skills/engineering/jxx-to-milestones/`（11 文件）、本源脚本 `base/scripts/milestones.mjs` 与 `base/scripts/test/milestones.test.mjs`；12 处副本（8 处用户级 + `ai-international-trade` 主仓与 2 个 worktree 的项目级）全部删净，删前逐个校验绝对路径 + `SKILL.md` 的 `name` 自证。
- 活引用全清或收口：`jxx-to-tickets` SKILL.md 删「里程碑交付」整节、README/CHANGELOG 改口径（CHANGELOG 历史条目加退役标注）、`正常的工作流.md` 删该行、`安装.md` 表格与 `skills-catalog/index.html`（表格 + SVG 方框）删该行、`check-copies.mjs` 删 4 处登记（含「另外五个技能」改「四个」）。
- `ai-international-trade` 三处跑 `sync-skills` 刷成 43 个技能、INDEX.md 手工删行；AGENTS/CODEBUDDY 仍逐字节一致。
- 史料不动：`.workbuddy/memory/`、`.temp/` 归档、`base/CHANGELOG.md` 历史条目里的旧提及保留。
- 验证：索引生成器不再列出该技能（本来就不在）；`ship check` / `check-copies`（43 处副本）/ `skill-lint --strict` / 46 条测试全绿。
- 恢复：`git checkout HEAD -- base/skills/engineering/jxx-to-milestones base/scripts/milestones.mjs base/scripts/test/milestones.test.mjs`，再手工恢复引用与 `check-copies.mjs` 登记。

## jxx-ask-matt 未安装技能索引 2026-11-07

需求：用户只保留自己常用的 jxx 技能（省常驻 description），不常用的技能仍要能经 `jxx-ask-matt` 找到并使用。**不要求路由自动触发未装技能**，只在用户用路由时让 agent 找得到。

- **方案 A（索引 + 按需读源）**：新增 `base/scripts/ask-matt-index.mjs`，从源状态自动判定「未安装」（`x-install: false` / `x-inline: true` / 桶不在 `vendors.json` 的 `buckets`），生成 `jxx-ask-matt/references/not-installed-skills.md`：当前 **22 个**技能，每行 name + 何时用（含触发线索）+ 仓内真源相对路径 + 附属资源目录 + 未装原因，约 6.4 KB。
- 路由正文（升 1.3.0）新增「不常用技能：读索引，不去环境里找」节：用户点名或意图命中时，agent 按索引路径 `read` 仓内 `SKILL.md` / `SKILL.src.md` 全文，相对链接/脚本以真源目录为基准；索引写明仓根 `E:\\work\\sp\\JwikisSkills`，跨工作区可定位。不改 DSH、不临时安装。
- **卸载后自动进索引**：以后再卸一个技能，重跑生成器它就进表；`ship check` 加 `E_ASK_MATT_INDEX` 门禁（`runAskMattIndexGate`）挡住过期索引。实测临时把 `jxx-retro` 改成 `x-install: false` → check 退出 1 报 1 条，恢复源 → 通过。
- **为何不做 DSH 插件/2 级技能**：读 DSH 源码实证——`packages/skill/tool-skill/src/index.ts:138` 的 `skill({name})` 按 `ctx.skills.list()` 找且要求 `modelInvocable`，catalog 与 loader 共用注册表；`docs/subsystems/skills.md`、`2026-09-27-progressive-office-skills.md` 均记「隐藏子技能需要独立可见性策略」并被否决。插件 `registerProvider()` 注册的技能照样进 catalog，不省 token；真做需改 DSH 核心 + 全套 e2e。另 49 个 jxx 技能正文共 342 KB、32 个带 scripts/references/本地链接，整包内置进路由会让链接脚本断掉且每次加载多吃 95.7 KB。
- 测试：`base/scripts/test/ask-matt-index.test.mjs` 4 条（三种未装判定、幂等、过期门禁、marker 外手写保留）；文档同步 `安装.md`、AGENTS/CODEBUDDY、路由 CHANGELOG。实测索引随 `ship install` 分发到 5 处安装副本。

## jxx-wizard 停止自动安装 2026-11-07

姜先生决定**卸载而非删除**，真源留仓。

- `base/skills/engineering/jxx-wizard/SKILL.md` frontmatter 加 `x-install: false`（升 1.2.0）；真源 5 文件（含 `scripts/template.sh`）全留。
- 12 处旧副本手工删净：9 处用户级（`.agents`、`.codebuddy`、`.codeartsdoer`、`.qoder-cn`、`.qoderworkcn`、`.qwenworkcn`、`.trae-cn`、`.workbuddy`、`.workbuddy-ai`）+ `ai-international-trade` 主仓与 2 个 worktree 的 `docs/agents/skills/`；对方三处 AGENTS/CODEBUDDY/README 跑 `sync-skills` 刷成 44 个技能、INDEX.md 手工删行。
- `managedPrefixes` 含 `jxx-` 但源仍在仓里，残留清理不认它，故须显式删（与 `dsh-plugin-dev` 同款）。
- 文档同步：`安装.md`、技能目录 HTML（安装列标 `false`）、`jxx-ask-matt` 路由条目（标注不再是独立技能）、AGENTS/CODEBUDDY「不默认安装的技能」节。史料与审计报告里的 `jxx-wizard` 提及不动。
- 按姜先生指示**默认不验证**：未跑 check / lint / copies / 测试；仅做一次只读全盘复查（全盘只剩真源 1 处、对方三处清单 0 命中、AGENTS=CODEBUDDY 一致）。

## dsh-plugin-dev 停止自动安装 2026-11-07

姜先生决定**卸载而非删除**：仓内真源保留，环境里不再出现。

- `base/skills/code/dsh-plugin-dev/SKILL.md` frontmatter 加 `x-install: false`（升 1.2.3）；真源 21 文件与 `references/` / `scripts/` / `assets/` / `evals/` 全部保留。
- 9 处用户级旧副本已手工删净：`.agents`、`.codebuddy`、`.codeartsdoer`、`.qoder-cn`、`.qoderworkcn`、`.qwenworkcn`、`.trae-cn`、`.workbuddy`、`.workbuddy-ai`（删前逐个校验绝对路径 + `SKILL.md` 的 `name` 自证）。
- **`ship install` 不会自动清**：`managedPrefixes` 不含 `dsh-` 前缀，且残留清理以「源中仍存在的技能名」为准，源留着就不算残留。恢复分发 = 把 `x-install` 改回 `true` 再 `ship install`。
- 文档同步：`安装.md`（code 桶改为「默认不安装」）、`docs/guide/skills-catalog/index.html`（安装列标 `false`）、AGENTS/CODEBUDDY（「不默认安装的技能」节 + 删掉旧的「kimi 安装副本」误导句）。史料与 `studio-config-doctor.mjs` 白名单不动。
- 验证：`ship install` 后 0 处回装、0 处残留；check / lint / copies / 35 条 ship 测试全绿。`.ship-installed.json` 仍记着这个名字（历史归属记录，不进技能列表、不触发重装，按纪律不手改）。

## ship 内联源（x-inline）2026-11-07

`jxx-grilling` / `jxx-grill-me` 改为内联源，环境里的技能列表少两项，引用技能自带原语全文。

- **机制**：源 frontmatter 标 `x-inline: true` ⇒ `ship install` 不单独安装、主动清掉旧副本；把源正文（含 `inlineBundles` 配的伴随源、递归依赖）注入引用技能的 `SKILL.md` 末尾固定 marker 块，注入幂等。
- **改动记忆**：块内 manifest 记每个源正文 hash；`ship check` 比对已安装副本，源改了没重跑 install 就报 `E_INLINE_STALE` 并提示「重跑 install 并复核依赖技能的描述与流程」。新增 `E_INLINE_ORPHAN`（源无宿主）/ `E_INLINE_BUNDLE`（bundle 配错）/ `E_INLINE_LOCAL_LINK`（源正文含本地相对链接）/ `E_INLINE_UNSUPPORTED`（源或消费者是 srcMode、源带 `<!--en-->`）。
- **路由例外**：`vendors.json` 的 `inlineExcludeConsumers` 列出 `jxx-ask-matt` / `seo-router` / `kb-router` / `craft-router`，保持轻量指针清单，不注入。`vendors.kimi.json` / `vendors.loomy.json` 同步配置。
- **配套**：`base/scripts/test/ship.test.mjs` 增 4 条回归；`base/skills/安装.md`、`jxx-skill-init/references/frontmatter.md`、AGENTS/CODEBUDDY 补口径。
- **边界（同日实证）**：`ship install` 只清 `vendors.json` 声明的目标，不清「历史用户级目录」与「其它仓库的项目级技能」。实测 `jxx-grilling` / `jxx-grill-me` 曾在 4 个历史用户目录（`.config/codeartsdoer`、`*.config/opencode`、`.qoderworkcn`、`.workbuddy-ai` 共 8 份）与 `E:/work/sp/ai-international-trade` 的 `docs/agents/skills/`（主仓 + 2 个 worktree 共 6 份，已提交进那个仓库、其 AGENTS.md 明写「不需要 ship install」）残留，导致那边开新会话仍能看到这两个技能。已全部清掉并同步对方 AGENTS/CODEBUDDY/INDEX/README；全盘复查只剩本仓真源 2 处。**新会话出现已卸载技能时，先全盘扫目录，别只看当前 skills 根。**
- **验收复盘（同日）**：实测 `~/.agents/skills`（当前会话目录）两个源已从技能列表消失；4 个受影响技能 frontmatter description 与源一致、内联块都在正文末尾且各 1 个。发现两个问题并修：① 引用技能正文仍写「运行 `/jxx-grilling` 技能」——该字样是安装器识别依赖的依据，不能删，故在注入块开头点明它是「依赖标记、指块内 `###` 段，不是调用外部技能」；② 只改 `ship.mjs` 注入逻辑时 manifest 只记源 hash、察觉不到——补 `template=` 指纹（取注入函数源码），改模板没重跑 install 同样触发 `E_INLINE_STALE`。另注意：4 个不在 `vendors.json` 分发目标里的历史目录（`.config/codeartsdoer` / `.config/opencode` / `.qoderworkcn` / `.workbuddy-ai`）各有 7–8 月旧副本，`ship` 从不碰，不影响当前会话，需彻底清就手工删。

## Craft 子技能实测优化（13 份原文 + 路由）2026-10-28

迁库之后的第二批：把 13 份「纸面配方」重做成**本机实测配方**，并补齐技能宪章缺口。`craft-router` 升 **v0.3.0**，13 个子技能升 **v0.2.0**（仍 `x-install: false`，不回装）。

### 变更

- **系统性旧错（全部 13 份都有）**：二进制路径写成 `D:\storytoldExe\FigCraft \figcraft-cli.exe`——**目录名尾随空格是错的**，照抄必 `No such file or directory`。全部改为 `D:\storytoldExe\<Dir>\<app>-cli.exe`（正文 + `x-vendors.description-en` 两处）。
- **注册表条数复测**（方法：解析 `commands --json` 的 JSON 数组长度；`cadcraft`/`designcraft` 的 `commands` 本就是 JSON 文本；`deckcraft`/`soundcraft` 输出 `id — 描述` 文本；`pdfcraft` 用 `tools`）：figcraft 569、vectorcraft **792**（旧文档 569）、gridcraft 341、cadcraft 431、designcraft 521、deckcraft 321、soundcraft 480、filmcraft 701、effectcraft 731、photocraft **918**、lightcraft 371、pdfcraft **171 工具**、wordcraft 633。
- **实测推翻的旧断言**：vectorcraft「常用命令族」整表虚构（`vector.flatten` 等 10 个 id 在 0.14.0 注册表里根本不存在）；designcraft「未知参数静默忽略」实为 `exit 1` 并列出可用参数；wordcraft 旧 `sh` 块用 PowerShell 的 `""text""` 转义、bash 下跑不通；pdfcraft「`run` 也吃 `--automation-*`」实为只有 `mcp` 吃；filmcraft 不传 `"wait":true` 则导出 job 随进程消失（`nowait.mp4` 永不出现）；effectcraft 的 `#1` 在 bash 里被当注释（`props - #1` 静默少参数）；gridcraft `cell.set` 收 `input` 不收 `range`（错键静默写进 A1）。
- **每份补三节**：`## 输入`、`## 输出与校验`（产物落点 + 真实字节数/像素/时长）、`## 失败出口`（症状 / 原因 / 处置表，含 `ERR_*` 或「向用户追问 X」）；`description` 末尾加「不用于：…」边界语；`<!--en-->` 占位句换成真实英文摘要。
- **路由改造（v0.3.0）**：新增「取原文三级」——L0 仓内真源、L1 库内确定性腿（`folder_path` → `knowledge/<id>`，bash 与 pwsh 各给一段实测片段）、L2 语义腿（`hybrid-search`，2026-10-28 实测 **500**：embedding 后端 `www.erp.sdcxslzj.com:11235` 拒连，故降级为可选）；坑清单加「launcher 是 GUI，启动即排队自动更新 13 个应用」「`describe` 只有 4 家」「围栏只属 `mcp`」「别数文本行/别 grep 字面」；新增「写库纪律」（覆写前后核对 id/title、回读比对、key 只打末 4 位）。

### 验证

- `node base/scripts/skill-lint.mjs --strict --json`：13 子技能 + 路由全部 **P0 0 / P1 0 / P2 1**（只剩 `sk-08` 无 evals，库快照型文档技能按此保留），`score 98`，正文 88–143 行。
- `node base/scripts/ship.mjs install` + `check`：全部通过；10 处技能根复检无 craft 子技能回装，安装副本 `craft-router` 为 v0.3.0。
- 库回灌：13 条 `craft-<app>` + 索引 `craft-技能索引` 全部 `PUT` 成功并回读比对长度（如 `craft-vectorcraft` 2,344B → 7,130B）。
- 配方可复制性：各 app 的 `sh` 代码块从写入后的文件里原样抽出重放，产物字节数与正文一致。

## jxx-to-questionnaire 停止自动安装 2026-10-28

`jxx-to-questionnaire` 不再随 `ship install` 分发到任何平台。

### 变更

- `base/skills/productivity/jxx-to-questionnaire/SKILL.md` 的 frontmatter 加 `x-install: false`（原先无此字段，按缺省安装）。
- 手工删掉 8 处旧副本：`~/.agents`、`~/.codebuddy`、`~/.workbuddy`、`~/.workbuddy-ai`、`~/.codeartsdoer`、`~/.qoder-cn`、`~/.qwenworkcn`、`~/.trae-cn` 的 `skills/jxx-to-questionnaire`。`ship install` 不会自动清（源还在，不算残留）。
- 文档同步：`base/skills/安装.md` 把该行从「默认安装」表移到「默认不安装」表；`docs/guide/skills-catalog/index.html` 的安装列标 `false`；`AGENTS.md`（及 `CODEBUDDY.md`）新增「不默认安装的技能」一节。

### 恢复

删掉那行 `x-install: false`，再 `node base/scripts/ship.mjs install`。


## Craft 子技能转库内分发 2026-10-28

storytold/ArtCraft 的 13 个子技能不再装进任何 agent 技能目录：真源留仓，副本入 WeKnora 库，本地只剩路由。

### 变更

- **停止外装**：13 个 `base/skills/storytold/<app>/SKILL.src.md` 的 frontmatter 由 `x-install: true` 改为 `false`（figcraft / vectorcraft / gridcraft / cadcraft / designcraft / deckcraft / soundcraft / filmcraft / effectcraft / photocraft / lightcraft / pdfcraft / wordcraft）。`ship install` 只重装 `craft-router`，子技能不再落到厂商目录。
- **清残留**：手工删掉 7 处技能根里的 91 个目录（含 `.codeartsdoer` 的 `huawei-cloud-codebuddy-*` 前缀变体）——`ship` 的残留清理以「源中仍存在的技能名」为准，源留则不清，只能手工删（与 `open-code-review` 同款约束）。
- **入库**：13 份原文灌入知识库 `dfaaf6fc` 的 `craft/<app>` 目录，条目 `craft-<app>`，全 `publish` + `type:material`；另加自撰索引 `craft-技能索引` 留库根。
- **路由改造**：`craft-router` 升 v0.2.0 —— 新增「子技能去哪了」节（真源 / 库内副本 / 两条取原文腿）、「自研资产口径」节（改真源 → `ship install` → `check` + `skill-lint` → 回灌库条目）、分流表第三列从相对链接改为库条目名（相对链接在子技能目录消失后必然断）、条目数口径由 17 改为 13 个子技能。

### 理由

这一套是本仓自研（Rust 净室重实现），要持续运行、修改、优化，所以**真源必须留在仓里**，不能像三方技能那样一删了之；
但每次任务都要把 13 份配方全文拉进上下文也没必要。折中：仓内真源 + 库内快照供检索 + 单个路由技能常驻。

### 已知约束

- 库内是快照，不回灌就是过期文档 —— 维护口径写进了路由技能与 `tag-registry-skills.md`。
- `craft-router` 仍标 `disable-model-invocation: true`（沿用原状）：不会被模型自动加载，需要显式点名。子技能撤出后若要「说画画就自动分流」，得把这一行去掉。


## tool-intro 迁为本仓项目技能 2026-10-28

`jxx-tool-intro` 不再是分发型技能：它产出的 `docs/guide/` 工具目录是本仓专用资产，按 7 家厂商铺到全局技能目录没有意义。

### 变更

- **路径**：`base/skills/engineering/jxx-tool-intro` → `docs/agents/skills/tool-intro`（`git mv`，仓库内只此一份）。
- **改名**：技能名 `jxx-tool-intro` → `tool-intro`（去掉 `jxx-` 前缀，与「项目技能」定位一致）；入口 `SKILL.src.md` → `SKILL.md`，frontmatter 只留 `name` / `description` / `disable-model-invocation`，删掉 `x-install` 与 `x-vendors`（这两个字段只服务 ship 的厂商派生）。`assets/` `scripts/` `references/` `tests/` `evals/` 原样随迁。
- **停止分发**：`ship` 只扫 `base/skills/**`，源目录迁走后该技能自动退出派生与安装；跑一次 `node base/scripts/ship.mjs` 即可清掉 `base/scripts/.generated/*/jxx-tool-intro/` 与各平台全局技能目录里的安装副本。
- **引用同步**：`sync-html-template.mjs` 的 `TARGETS` 首项、`copies-parity.test.mjs` 的两处路径、`base/shared/html-template/DESIGN.md` 的命令示例与生成方式说明、`ship.mjs` 残留清理注释、`docs/report/skill-security-audit-2026-10-26.md` 的第 6 条，一并改到新路径/新名。
- **清单接管**：`docs/agents/skills/` 交给 `jxx-setup-skills` 的受管清单（`AGENTS.md` 新增「项目技能（docs/agents/skills/）」小节）；同时把 `AGENTS.md` 原有「本仓库自己例外…应带 `--no-skills`」改写成例外说明——本仓唯一项目技能就是 `tool-intro`，其余技能真源仍在 `base/skills/**`，所以初始化仍带 `--no-skills`、只对项目技能跑 `sync-skills`。
- **工具页重生成**：`node docs/agents/skills/tool-intro/scripts/gen-tool-page.mjs` 重渲染 `docs/guide/**`，页脚由「由 **jxx-tool-intro** 技能生成」改为「由 **tool-intro** 技能生成」，正文内容零漂移。

### 理由

技能的生产物（`docs/guide/` 工具目录）只在本仓成立，把它当跨厂商技能分发等于往 7 个目录塞一份本仓专用工具。项目技能位置 `docs/agents/skills/` 才是它的正确归属，也顺带消掉一个 `jxx-` 前缀与「本仓自研 jxx 系列」的语义冲突。

## 三方技能外置到知识库（乐享 / IMA）2026-10-28

乐享（lexiang）与 IMA（ima-skill）两个官方技能包不再常驻本地技能目录，原文迁入 WeKnora
「第三方官方skills」知识库 `dfaaf6fc-1e5d-4385-a290-58c847d71bcb`，本地各留一个引导技能。

### 变更

- `base/skills/productivity/lexiang` 降级为**引导程序**（v2.1.0）：删 `references/tools.md`，正文只留卸载说明、连接信息（MCP 端点 / preset / 凭证入口）、两条取原文腿、分域对照表与规矩。原路由技能正文与工具目录存库。
- 官方 6 个分域技能（`lexiang-setup` / `-search` / `-writer` / `-blocks` / `-files` / `-connectors`，29 个文件 ≈190 KB）从全部 agent 技能目录卸载；原文灌入知识库 `dfaaf6fc-1e5d-4385-a290-58c847d71bcb`，30 条 manual（含 1 条自撰索引），目录 `lexiang/<skill>`，全挂 `type:material`。
- 迁移前完整副本：`.temp/backup/lexiang-20261028/`（31 个目录，本机留存，不随仓库分发）。

### IMA（同日第二批）

- 新增仓库源 `base/skills/productivity/ima-skill/`（v2.0.0），内容为**引导程序**：固定边界（Base URL `https://ima.qq.com`、凭证优先级、临时 COS 凭证）+ 两条取原文腿 + 模块决策表 + 规矩。此前 `ima-skill` 在本仓没有真源，只有各厂商技能目录里的安装副本（且 WorkBuddy 侧叫 `ima-skills`，版本还比 `~/.agents` 旧）。
- IMA 官方技能包（入口 + `knowledge-base` + `notes`，10 个文件 ≈126 KB）从 `~/.agents/skills/ima-skill`、`~/.workbuddy/skills/ima-skills`、`~/.workbuddy-ai/skills/ima-skills` 卸载；原文灌入知识库 `ima/ima-skill`、`ima/knowledge-base`、`ima/notes` 三目录，11 条（10 原文 + 1 自撰索引），全挂 `type:material`。
- **脚本也只在库里**：`ima_api.cjs` 与三个子脚本落为库内条目，引导技能要求先取到临时目录再 `node` 跑。
- 迁移前完整副本：`.temp/backup/ima-20261028/`（3 个目录，本机留存，不随仓库分发）。

### 理由

三方技能包体积大、随官方升级频繁变动，且常驻技能目录要付每轮上下文成本。本地只留引导程序，取原文按需进行。

### 已知问题

`hybrid-search` 全库返 `code=1007`（外部 embedding 端点 `www.erp.sdcxslzj.com:11235` 拒连，与本库无关）。引导程序因此写明「确定腿」兜底：按 `folder_path` 列条目后 `GET /knowledge/<id>` 读 `metadata.content`。embedding 恢复后应对 30 条补 `reparse`。


## 技能宪章 + 机器闸 2026-10-26

把「AI Skills 该怎么写」从散落的经验变成唯一权威源 + 可重复的机器信号。

### 新增

- `docs/agents/skill-charter.md`——**技能宪章**，与质量宪章平级。十条原则（名称触发 / 职责单一 / 渐进式披露 / 命令式 / 输入输出接口 / 边界失败 / 模糊归 Skill 确定性归脚本 / 可验证 / 版本化 / 安全前置），每条给判据 + 对照 + 机器闸规则码，附描述模板与自查清单。定位：Skill 是可触发、可执行、可验证、可维护的标准化能力说明，不是提示词。
- `base/scripts/skill-lint.mjs`——按宪章对 `base/skills/**` 做只读扫描的机器闸。规则 `sk-00` / `sk-00b` / `sk-01a` / `sk-01b` / `sk-02`..`sk-10`，分数 100 起扣（P0 −25 / P1 −8 / P2 −2 / info 不扣）。CLI：默认摘要 + 最差 30、`--json`、`--strict`（有 P0 则 exit 1）、`--verbose`、`--root`、`--md`/`--out`。
- `base/scripts/test/skill-lint.test.mjs`——23 项用例（阈值、降级解析、第三方判定、只读性断言）。
- `docs/report/skill-audit-2026-10-26.md`——全量审计报告：99 技能画像、P0 一条、P1 逐条人工判读、仓库级 5 处漂移，附修复状态。

### 修（宪章落地的第一批）

- `jxx-improve-codebase-architecture` / `jxx-mcp-design`：description 补触发语（`sk-01a` P1）。
- `jxx-agnes-video`：「建议 1–2s 一次」改为「每 1–2s 一次」（`sk-04` 模糊词）。
- `lexiang`：上传链路补「上传前确认目标知识库；覆盖同名文件必须显式确认」（`sk-10`）。
- `jxx-prototype`：推送分支补「推之前确认远端与分支名，不允许静默执行」（`sk-10`）。
- `seo-audit-template` / `seo-blog-template` / `seo-router`：`metadata.triggers` 的多行 flow 序列归一为单行——此前 `ship.mjs` 的子集 YAML 解析器会抛错，只靠 `getXInstall` 正则兜底才没炸。
- `jxx-skill-init`：`references/frontmatter.md` 的 description 规范从两要素改成四要素（能力 + 场景 + 触发词 + 边界），`SKILL.md` 第 3 步同步指过去。

### 修（仓库级漂移）

- `CONTEXT.md`：TDB-AM 桶的技能清单按实测重写——旧版列的 `dsh-tdai-routing` / `panel-admin` / `tdai-remote-ops` / `tdai-wiki-local` 四个技能从未落地，在用的 `kb-router` / `lingshu-console` / `weknora-kb-ops` 三个一个都没登记。
- `base/skills/README.md` 与 `安装.md`：桶表补齐 7 个分发桶 + 3 个不分发桶 + `docs/`，加「以 `vendors.json` 的 `buckets` 为准」表头；README 的「状态」列换成「分发」（是/否），消除「并列却不区分发布」的误解源。

### 退役（2026-10-26 决策）

- `base/skills/TDB-AM/tdai-codegraph-local` 整目录删除（14 个文件）。理由：有 `references/` + `scripts/` 却无入口文件，任何厂商都加载不了；其记忆面已在此前提交 `d4e91ab9` 削减过一轮。`skill-lint --strict` 因此回到 exit 0。
- `base/skills/engineering/jxx-caveman` 整目录删除。理由：输出风格真正生效的通道是 `docs/agents/agent-personas.md` 的 `caveman-sections` 提示词集，技能只是它的说明书；留着只是重复一份规则。三处引用（`base/skills/README.md`、`engineering/README.md`、`jxx-ask-matt`）同步摘除。`samll/` 桶的英文原版保持不分发，作为仓库存档。

### description 压缩（常驻成本）

description 是每轮都在付的上下文成本，原先把实现细节（文件路径、CLI 参数、内部字段名、能力清单）写进去。本轮压缩 **65 个自研技能**，合计 **7,057 到 4,339 字符（-39%）**，第三方技能一个没动。

压缩原则：描述只答「何时调用」——能力一句 + 场景 + 触发词 + 边界。实现细节下沉正文，正文里本来就有。

最长几个的变化：

| 技能 | 原 | 现 |
|---|---|---|
| `seo-keyword-research` | 332 | 64 |
| `seo-technical-audit` | 327 | 90 |
| `seo-backlink-analysis` | 289 | 59 |
| `jxx-agnes-video` | 293 | 88 |
| `lexiang` | 257 | 76 |
| `jxx-html-craft` | 244 | 79 |

其中 seo 族的重复触发词列表（同一批词在 description、`metadata.triggers`、正文 Quick Start 里各写一遍）压成一处。

机器闸新增 `sk-01c`：description 命中文件路径 / CLI 参数 / 内部字段名（snake_case、camelCase）即记 P2，防止这份成本再长回来。

### 门禁接入

`ship check` 现在顺带跑 `skill-lint --strict`（子进程调用，`E_SKILL_P0`）：任何技能目录缺入口文件、或 frontmatter 解析不出 name/description，`ship check` 直接非零退出。此前这类错误只会在 `ship install` 时静默少装一个技能。

P0 先清零再接门禁——否则 `ship check` 会永久红。

### 安全修复（2026-10-26 审计后）

`docs/report/skill-security-audit-2026-10-26.md` 报 15 条，两条 High 是本仓 `ship.mjs` 的真缺陷，已修并带回归测试：

- **SEC-02 · `x-install: false   # 注释` 失效**：`parseScalar` 把整串当字符串，`v === false` 不成立，静默退回 `user`。`kimi-webbridge` 因此被分发到 7 家平台——它能的却是「用你的真实登录态操作任意网站」。新增 `normalizeXInstallValue()` 先剥行尾注释，主路径与正则兜底共用；已删掉 7 处误装副本。
- **SEC-03 · 残留清理误删用户技能**：清理只看 `managedPrefixes` 前缀，实测把用户的 `jxx-my-own-skill` 删了。新增安装清单 `<skills>/.ship-installed.json` 记录本仓装过的名字，无清单时回退内容指纹；两样都不认的一律保留并打 `keep` 提示。

两条修复各配一条回归测试（`ship.test.mjs`），测试数 219 → 222。
## 选择性同步 2026-10-24（上游 84fdeffd..5beb35b）

已审查区间 126 commits（96 non-merge）；本次按既定方案选择性移植 11 项，不是全量覆盖。

### 移植（11 项）

1. **jxx-diagnosing-bugs 1.1.0**：阶段 5 强制制造 red 后先与 pristine copy 做 diff，证明变异落地；阶段 6 改为「清理」，删除 post-mortem，修复后的 retro 与架构发现路由交由 jxx-ask-matt。
2. **jxx-tdd 1.1.0**：每个候选测试接缝补一行「能抓住什么、漏掉什么」。
3. **jxx-grilling 1.2.0**：保留 frontier 轮次，补 Q1/Q2 同轮示例、题间 HR，以及 yes=接受推荐答案硬规则；evals 同步。
4. **jxx-grill-me 1.1.0**：改为调用 /jxx-grilling，不复制访谈循环；保留本地输入/输出/异常处理与聊天 markdown、无状态不写 CONTEXT 语义。
5. **jxx-handoff 1.1.0**：确定性解析 OS 临时目录，不写当前工作区，写完报告文件绝对路径。
6. **jxx-wizard 1.1.0**：scripts/template.sh 完整同步上游 origin/main，包含 readline、.env quoting、symlink、EOF、opener 与 run_wizard 全文件解析修复；本地路径与链接不变。
7. **jxx-teach 1.1.0**：工作区路径锚定调用目录，*-FORMAT.md 仍从技能目录解析；测验正确答案位置必须变化，保留 x-install:false。
8. **jxx-implement 1.11.0**：任何看板/领卡/写盘前置之前，先按项目 issue tracker 契约读取用户传入的工单引用并复述标题；歧义先问。服务器契约、双写、AC、审查归属与合并流程不变。
9. **jxx-code-review 1.5.0**：§3 改为主动搜索全部编码标准文件，CODING_STANDARDS.md / CONTRIBUTING.md 存在即必须列入；本地多维审查、OCR、AC、服务器写腿与子代理纪律不变。
10. **jxx-ask-matt 1.1.0**：断言或跳过技能步骤前必读 SKILL.md；补本地 implement-spec 整轨、pr、retro 路由与 Bug 修复后 retro/架构交接；code-review 改按本地多维口径描述。
11. **jxx-domain-modeling 1.6.0**：description 覆盖代码库术语、写或编辑 CONTEXT.md、记录或编辑 ADR；删除「其他技能需要维护领域模型」尾部分支，保留正文 CONTEXT 名称，并补直接编辑 ADR 的触发 eval。

### 不移植

- 全局去 em-dash、YAML 与工具措辞排版改动。
- CONTEXT.md → GLOSSARY.md 改名；本地继续使用 CONTEXT.md。
- GitHub/GitLab 专用 setup / to-tickets 改动；本地没有对应文件或流程。
- implement-spec 的 integration branch；本地采用统一看板、auto 编排与统一合并回收，机制不同。
- resolving-merge-conflicts 删除；本地含看板扩展，保留该技能。
- chief-of-staff 实验新技能。
- wayfinder 的 triage / PR 约束；需另做本地服务器状态机适配，本轮不直接移植。

### 已含最新实质内容

- jxx-retro 与 jxx-pr 已含上游最新实质内容，本轮无需改动。

### 基线勘误

- 旧「同步 2026-08-11」标题中的上游 1.4.0 为误记，已改为 1.2.3+2 commits；SHA 范围 d574778f..84fdeffd 不变。
- 证据：上游 84fdeffd 的 package.json 记录 version 1.2.3；git describe --tags --always 84fdeffd 返回 v1.2.3-2-g84fdeff。

## 确定性生成器产出合规工单 2026-10-21

### 修复（`issue-flow.mjs` 生成即违规）

- **`to-tickets` 缺省验收段**：`- [ ] 验收标准 1 / 2` → 与 `jxx-to-tickets` 的 `<local-issue-file-template>` 逐字一致的 4 条示例行（主路径 / 错误路径 / 回归 / 负向，带 `AC-<n>` 编号、`[类别]`、`验证:机器 <用例名|命令>` 载荷）；工单模板补 `**AC 覆盖声明：**` 与 `**处理步骤：**` 两行（验收标准之后、`## 评论` 之前）。旧模板生成的工单跑 `ac-audit` 直接「缺验收点」退出码 1。
- **`to-spec` PRD 骨架**：用户故事之后补 `## 验收点（AC）` 节（含 4 条 AC 草案行——有验收点节却零 AC 行会被判硬问题）；`Status:` 行改为粗体 `**Status:** ready-for-agent`，符合 issue-tracker 约定并让 `ac-audit` 认出这是工单类文件。
- **自检提示**：两个生成子命令完成后打印 `下一步自检：node <脚本目录>/scripts/ac-audit.mjs <功能目录> --strict`（`SCRIPT_DIR` 只用于定位同目录 `ac-audit.mjs`，不参与输出路径推断）。
- **同步与验证**：`check-copies --fix` 下发两份技能副本（复检 42 处一致、0 漂移）；`base/scripts/test/issue-flow.test.mjs` 随模板更新断言并补缺省 AC / 覆盖声明 / 处理步骤断言；`node --test base/scripts/test/issue-flow.test.mjs base/scripts/test/copies-parity.test.mjs` 32/32 通过；`.temp/output/issue-flow-test/` 冒烟生成物跑 `ac-audit` 退出码 0。

## 共享安装目录的校验噪音修复 2026-10-17

### 修复（install 每次误报 45 项 MISMATCH）

- **根因**：`vendors.json` 中 opencode 与 kimi 的 `user.skills` 同指 `~/.agents/skills`（该指向由 commit `71e87261` 引入，原 kimi 路径为 `D:\aiData\kimiData\...`）。两家 `derive` 规则不同——kimi 会把 frontmatter 归一化为 `name + description`，opencode 保留完整 frontmatter。install 按 vendors 遍历顺序执行，kimi 排第 8 位后写覆盖，最终磁盘是 kimi 归一化版。
- **现象**：`runVerify` 让每家 vendor 各按自己的派生基准校验同一份磁盘文件，opencode 的基准永远对不上，于是每次 `ship install` 都稳定输出 45 项 MISMATCH。这是**覆盖噪音，不是真实失配**——长期下来会让「MISMATCH」失去信号价值（狼来了）。
- **修法**：`runVerify` 增加共享目标识别——同一 `dest` 被多家写入时，只保留**最后写入者**的基准参与校验，先写者的条目跳过（其结果已被覆盖，无校验意义）。`installed` 项补记 `vendor` / `skillsTarget` 以支撑该判定。真实失配仍会被捕获（最后写入者基准与磁盘不符即报 MISMATCH）。
- **附带修正**：`ship.test.mjs` 中「vendors 声明 4 家有派生规则」的断言与实际（5 家）脱节，改为 5。
- **回归测试**：新增 2 条用例——① 共目录场景只报一条校验结果且为 OK、不出现 MISMATCH；② 磁盘被污染时仍报 MISMATCH（确保不因跳过逻辑漏报）。
- **效果**：`ship install` 从「45 MISMATCH + 335 OK」变为「335 OK、0 问题行」。

## 目录锚定与副本一致性治理 2026-09-16

### 修复（「生成文件的技能」写错目录）

- **`jxx-to-spec` / `jxx-to-tickets` 的 `issue-flow.mjs`**：原先用 `path.join(__dirname, '..','..','.scratch')` 锚定 `.scratch` 根，复制进技能 `scripts/` 与安装到各平台后指错目录且**静默**（编号回落 `01`、`writeFileSafe` 自动建目录树）。改为 `resolveScratchRoot()`：显式 `--root` 优先，否则从 **cwd 向上**找含 `.git`/`.scratch` 的仓库，找不到直接报错退出（退出码 1）。
- **`jxx-tool-intro` 的 `gen-tool-page.mjs`**：原先用 `path.resolve(__dirname, "../../../../../")` 定位仓库根，安装布局下解析成 `C:\Users`（实测报「工具数据源不存在: C:\Users\docs\guide」）。改为从 cwd 向上找含 `.git`/`docs` 的项目根，保留 `--root` / `--src` / `--out` 与 `SRC_DIR` / `OUT_DIR` 覆盖；失败时打印解析到的根与纠正办法。SKILL.src.md 同步改写（`<本技能目录>` 路径 + 去掉「auto-detected from repo root」的假承诺）。
- **`jxx-research`**：严格模式落盘指引补「`--out` 相对 cwd 解析，必须在目标仓库根执行或写绝对路径」。
- 清 `base/scripts/{milestones,report-flow}.mjs` 中未使用的 `__dirname` / `fileURLToPath` 死代码。

### 新增（门禁与护栏）

- **`base/scripts/check-copies.mjs`**：统一的脚本副本一致性门禁。登记 **47 处**副本（`shared/{fs-utils,next-seq,render-template,open-in-browser,report-html}`、`report-flow`、`scaffold`、`milestones`、`issue-flow`），`--check` 校验字节一致（含行尾）、`--fix` 唯一下发通道、并报出**未登记副本**防止私自分叉。
- **`base/scripts/test/copies-parity.test.mjs`**：副本一致 + 无未登记副本 + HTML 资产（`sync-html-template --check`）+ 「不得用固定层级 `__dirname` 上跳定位输出目录」的守则断言。
- **`base/skills/engineering/jxx-tool-intro/tests/gen-tool-page.test.mjs`**：把技能复制到任意深层布局再运行，锁住「锚定 cwd、不锚定脚本位置」，并断言失败路径不静默建目录。
- `base/scripts/shared/README.md` 补「副本分发」纪律（只改本源 → `--fix` 下发；`__dirname` 只用于自带只读资源）。

### 顺带发现（未改，另行处理）

- `base/scripts/ship.mjs` 有在途 WIP（含整文件 CRLF 化），本轮未改动；`check-copies.mjs` 建议后续接进 `ship check`。

## ship 跨厂商分发 2026-08-27（01-ship-multi-vendor-distribution，工单 01-06）

### 重大变更

- **单一入口 `ship.mjs`**：`base/scripts/ship.mjs` 提供 `init` / `derive` / `install` / `check` 子命令，零参数触发全流程（扫描 → 双模式派生/复制 → 安装 → SHA256 验证 → 残留清理）。
- **`vendors.json` 配置驱动**：7 家平台（OpenCode/CodeBuddy/CodeArts/Trae/Qoder/WorkBuddy/QoderWork），4 家有派生规则、3 家走原样复制 fallback；`managedPrefixes` 限定残留清理范围。
- **双模式迁移**：技能含 `SKILL.src.md` 走单源派生（CodeArts 前缀+5 行英文 description、openCode 无 name 键、CodeBuddy/Trae 透传注入），不含走原样复制；Agent 同理（`AGENT.src.md` 为派生开关）。
- **CodeArts 硬门禁**：`x-vendors.codearts.description-en` 或 `<!--en-->` 英文块缺失时 `check` 非零退出、跳过该厂安装但不阻塞其余厂商。
- **`x-install` 就近声明**：`true`/缺省 = 用户级+项目级都装；`false` = 不装且不派生；`project` = 仅项目级装。5 个 productivity 排除项技能（jxx-teach/jxx-wait-what/skill-creator/skill-reviewer/skill-tester）已补 `x-install: false`。
- **PS 脚本退役**：`base/skills/install.ps1` / `verify.ps1` 删除，能力收敛进 `install` / `check`。
- **文档同步**：`base/skills/安装.md` 重写为 ship 用法并消除硬编码路径；cross-vendor 两份 mapping 与 HARNESS-SPEC 标注 `ship.mjs` 为既定实现；CONTEXT.md「单源派生」状态更新为已落地。
- **测试**：`base/scripts/test/ship.test.mjs` 24 用例覆盖 init/install/derive/check/agent 全流程（`--config` + `--user-home` + `--dry-run` seam，零第三方依赖）。

### 待办

- 工单 02/03 修复项已回写并补齐（`x-install: false` 清单、derive 层跳过）；工单 06 文档同步完成。
- 后续 effort 02-js-ification、03-seo-geo-skill-suite 见下方记录。

## jxx-setup-skills 脚本化 2026-08-27

- **脚本自包含迁移**：setup-skills（原名 jxx-setup-matt-pocock-skills）的 `detect`/`sync-doc` 从共享 `base/scripts/scaffold.mjs` 迁入技能目录 `scripts/setup.mjs`（测试迁至 `tests/setup.test.mjs`，种子模板即技能目录三份 `.md`），技能可整体拷贝分发；`scaffold.mjs` 保留 memorial/exercises/precommit 子命令。
- **`detect` 子命令**：步骤 1「探索」脚本化，输出只读 JSON 报告（canonical 选择、五文件存在性、块检测、CODEBUDDY 一致性、目录与既有产物清单），逐项区分「文件存在/不存在」。
- **`sync-doc` 增强**：`## Agent skills` 块 upsert（就地替换/追加、保留周围内容）、`## 多代理要求` 块自动注入、`--layout`/`--labels` 参数化、逐文件执行结果日志（`created`/`updated`/`unchanged`/`skipped`）；CLI 默认启用块 upsert，`--no-block` 退化为纯同步。块内容单源收敛到 `buildAgentSkillsBlock()`。
- **技能 SKILL.md 改写**（v1.1.0）：步骤 1/3/4 全部改为跑脚本，不再由模型手工写文件；步骤 3 简化为 `--dry-run` 演练确认。
- **测试**：`tests/setup.test.mjs` 15/15 通过（块构建/注入/upsert 幂等、actions 日志、detect 三场景、CLI e2e）；`scaffold.test.mjs` 剩余 18/18 通过。

## seo-geo 基础设施 2026-08-26（工单 01：03-seo-geo-skill-suite）

### 重大变更

- **桶改名**：`base/skills/SEO2GEO/`（空桶）→ `base/skills/seo-geo/`，对齐小写桶名风格。
- **`vendors.json`**：`buckets` 增加 `seo-geo`；`managedPrefixes` 增加 `seo-`（残留清理覆盖该族）。
- **`ship` 支持 `x-install: project` 新取值**（ADR 0005）：标记该值的技能在用户级安装（`ship install`）中跳过，仅在项目级安装（`ship install --project`）中出现。原有 `x-install: true / false` 语义不变。
- **行为测试**：`ship.test.mjs` 新增 3 个用例——`x-install: project` 不进用户级、进项目级、`seo-` 前缀残留清理。

### 关联

- ADR 0005（仅项目级分发 + router 兼任安装器）、ADR 0006（skill-as-generator + 版本戳升级）已回写为 `docs/adr/0005`、`docs/adr/0006`。
- 后续工单 02–10 将在 `seo-geo/` 桶下落地 8 个技能（审查模板、写作模板、五件套、seo-router）。

## seo-geo 技能族落地 2026-08-26（工单 02–10：03-seo-geo-skill-suite）

### 新增技能（8 个，均在 `base/skills/seo-geo/` 桶下，`x-install: project`）

- **`seo-audit-template`**（工单 02+03）— SEO/GEO 审查模板（skill-as-generator）：追问收参 → 生成 `seo-geo-audit` 子技能 → 版本戳升级。内置三维审查模型（真实性 + SEO/GEO + 样式一致性）。references 含 geo-super 全量中文化（SKILL.md + 10 references 约 166KB）+ 三个通用 checklist + 五件套 GEO 增量素材清单。
- **`seo-blog-template`**（工单 09）— SEO/GEO 写作模板（skill-as-generator）：追问收参 → 生成 `blog-writer` 子技能 → 版本戳升级。news-x 项目知识抽象为生成参数；`seo-content-writing` 中文产物作为 references；样式模板与审查子技能共用同一基准（写审一致）。
- **`seo-keyword-research`**（工单 04）— 关键词研究中文版（含 GEO 增量：搜索词 + AI 引用问句式）。
- **`seo-competitor-analysis`**（工单 05）— 竞品分析中文版（含 GEO 增量：传统排名 + AI 引擎品牌提及）。
- **`seo-backlink-analysis`**（工单 06）— 外链分析中文版（含 GEO 增量：链接权重 + AI 引用源权威性）。
- **`seo-content-writing`**（工单 07）— 内容写作中文版（含 GEO 增量：SEO + GEO 可引用性双 checklist）。
- **`seo-technical-audit`**（工单 08）— 技术审计中文版（含 GEO 增量：llms.txt/JSON-LD/agent readiness）。
- **`seo-router`**（工单 10）— 族内路由器 + 项目内安装器：中英双语触发词覆盖全域意图，路由到 8 个技能 + 2 个生成子技能；套件缺失时引导安装。

### 中文化素材

- geo-super 全量中文化（SKILL.md 20KB + 10 references 146KB ≈ 166KB），术语保留英文（GEO/llms.txt/E-E-A-T/JSON-LD/MCP 等），ahrefs 2026 实证研究保留为 grounding。
- 五件套 GEO 增量统一指针引用 `seo-audit-template/references/geo-increment-materials.md`（单源派生，同一论据不翻译两次）。

### 质量门禁

- 8 个技能均通过 `skill-reviewer` 7/7 合规检查。
- `evals/evals.json` 触发测试套件已创建（真实触发测试需 opencode CLI，试点时跑）。

### 待办

- 工单 11（试点）：需在 `official-domestic-website` 项目端到端验证，试点指引见 `.scratch/03-seo-geo-skill-suite/issues/11-pilot-guide.md`。

## 同步 2026-08-11（上游 1.0.1 → 1.2.3+2 commits，`d574778f..84fdeffd`）

### 重大变更

- **`jxx-writing-great-skills` 移除**，由 **`jxx-writing-for-agents`** 取代（`SKILL.md` + `SKILL-MECHANICS.md`）：为 agent 写文档的通用参考——context pointer、两种 load、信息层级、leading word、pruning；技能专用机制（调用方式、路由技能）在 SKILL-MECHANICS.md。

### 新增技能

- **`jxx-wizard`**（engineering）— 生成引导人完成手动多步流程的交互式 bash 向导（含 `template.sh`）。
- **`jxx-wait-what`**（productivity，用户调用）— 让 agent 用简化技术英语重讲刚才的解释。
- **`jxx-to-questionnaire`**（productivity，用户调用）— 将未决决策转化为可交付的问卷文档。

### 技能更新

- **`jxx-diagnosing-bugs`** — 新增"脱敏（Redact）"章节（安全审计修复）：展示命令/输出/产物前必须脱敏，循环基于环境变量构建；`hitl-loop.template.sh` 增加 capture 回显警告。
- **`jxx-grilling`** — 重写为按轮推进的 frontier 访谈：一轮问完当前未解决的极小决策集，编号问题 + 推荐答案；事实查找派后台 agent。
- **`jxx-ask-matt`** — 新增 `PHASE-BOUNDARIES.md` 阶段边界决策树（continue → `/clear` → handoff → 子 agent → `/compact`）；智能区域阈值更新为 ~150k；独立技能列表扩充。
- **`jxx-prototype`** — logic 分支从终端应用改为单文件 HTML 交互 demo（状态面板 + 自由按钮 + 可选场景运行器）；完成后的处置从"删除或吸收"改为"捕获到 `prototype/<name>` 分支"。
- **`jxx-code-review` / `jxx-codebase-design` / `jxx-improve-codebase-architecture`** — 子 agent 派发措辞 harness 中立化（不再绑定特定 harness 的工具名与 agent 类型）。

## 1.0.1

### 补丁变更

- [`d20ee26`](https://github.com/mattpocock/skills/commit/d20ee2684e2a9442698ac3c1e0f2c5b68c4cf296) 感谢 [@mattpocock](https://github.com/mattpocock)！- 让 **`teach`** 技能优先复用。课程现在由 `./assets/` 中可复用的**组件**构建——样式表、测验小部件、模拟器、图表助手。复用是默认行为：agent 在编写课程前先读取 `./assets/`，基于已有内容构建，并将新的可复用部分提取为组件，而非内联编写。

## 1.0.0

### 重大变更

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 新增 **`ask-matt`** 技能——用户调用的路由器，将你引导到适合当前场景的技能或流程。

  **破坏性变更：** `ask-matt` 路由到本仓库中其他用户可调用的技能，因此需要它们已安装。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 新增共享设计技能，并将现有技能重新接入。

  - 新增 **`codebase-design`** 技能——深度模块词汇（模块、接口、深度、接缝、适配器）以及将大量行为放在小接口背后的原则。之前位于 `improve-codebase-architecture/LANGUAGE.md` 的语言现在移到这里，并泛化以供多个技能复用。
  - 新增 **`domain-modeling`** 技能——主动构建和打磨项目的领域模型，用词汇表压力测试术语，并保持 `CONTEXT.md` 和 ADR 更新。
  - `improve-codebase-architecture` 现在从 `/codebase-design` 获取架构词汇，从 `/domain-modeling` 获取领域模型。
  - `tdd` 现在依赖 `/codebase-design` 提供接口设计指导——其内联的 `deep-modules.md` / `interface-design.md` 笔记已移除，改用共享技能。
  - `grill-with-docs` 现在通过 `/domain-modeling` 内联构建领域模型。

  **破坏性变更：** 这些技能现在依赖新的 `codebase-design` / `domain-modeling` 技能，必须一并安装。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 移除 **`caveman`** 和 **`zoom-out`** 技能。

  - `caveman` 是我测试中的另一个技能的重复版本，从未打算公开发布。
  - `zoom-out` 在实践中未被使用，因此已从仓库中移除。

  **破坏性变更：** 两个技能已被移除。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 将 **`diagnose`** 技能重命名为 **`diagnosing-bugs`**。

  **破坏性变更：** 以 `/diagnosing-bugs` 调用——旧的 `/diagnose` 名称不再存在。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 用 **`writing-great-skills`** 替换 **`write-a-skill`**。

  - 移除了 `write-a-skill`。
  - 新增 `writing-great-skills`（及其 `GLOSSARY.md`）——编写和编辑优秀技能的参考：让技能可预测的词汇和原则，将空操作追踪到句子级别。
  - 将 `grilling` 作为模型调用技能公开——`grill-me` 和 `grill-with-docs` 背后的可复用访谈循环。

  **破坏性变更：** `write-a-skill` 已移除；请改用 `writing-great-skills`。

### 次要变更

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 新增 **`resolving-merge-conflicts`** 技能——用于解决进行中的 git 合并或变基冲突的循环。独立运行，不依赖其他技能。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 将技能分类法从 **命令/技能** 重命名为 **用户调用/模型调用**，并新增 `docs/invocation.md` 定义划分：用户调用技能仅在输入时可达，用于编排；模型调用技能在任务匹配时也可被自动调用。用户调用技能可调用模型调用技能，但绝不能调用另一个用户调用技能。

### 补丁变更

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 收紧 **`review`** 技能：快速失败引用检查、单一来源规则、空操作裁剪。