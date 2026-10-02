# Changelog

## 0.14.0 — 默认回合 main（ADR-011 修订 ADR-009 合并流）

**用户指令**：完成工单后默认回合主分支；不能回合时必须汇报不能回合的原因（会话内显式回报 + merge 卡流转段 + 账本）。

- **合入目标一律 `main`**（含 PRD 工单）：`mergeTargetOf()` 不再按 PRD.md 推导 PRD 分支；卡面 `- 合入目标:` 行恒为 `main`（含 merge 卡）。
- **PROTOCOL §3 改写**：复核过 → rebase 到最新 `origin/main` → 确认没影响 → 合 main；新增「不能回合 main ⇒ 降级 + 汇报（硬性）」——冲突不可解交回开发组；门禁红 / 携带未上 main 的兄弟工单提交时，属 PRD 的暂存 PRD 分支（惰性创建），散工单 blocked，两种都必须向用户显式汇报原因并留痕。
- **PROTOCOL §3.1 改为「清暂存 + 状态收口」**：全部工单 done/wontfix 或用户要求时，把暂存分支上未上 main 的工单清入 main（无暂存跳过），PRD.md 置 done。
- **`add-wt` 一律从 `origin/main` 拉**（PRD 工单同此）：PRD 分支不再预建，只在首次暂存降级时创建；`verify` 假交付闸门基准从「合入目标」改回 `origin/main`。
- **配套**：CARD-TEMPLATE / starter-merger / SKILL.md 概述同步；新增 `references/ADR-011-main-first-merge.md`，ADR-009 标注修订状态；旧卡面残留的 PRD 分支值由 `card-read` 标为旧值，不逼迁。
- **selftest 128 项断言全绿**（v0.12.0 合并流断言改写：属 PRD 的卡合入目标也是 main / merge 卡同值 / add-wt 一律从 origin/main 且 PRD 分支不预建）。

## 0.12.0 — 2026-10-01

**三技能统一改造（jxx-ticket-board / jxx-implement / jxx-implement-spec）**：工作树与看板统一落到项目里（in-project），三技能共用同一个看板机制与同一条「开发 → 审查 → 合并」流水线；合并流统一为「工单属 PRD ⇒ 先合 PRD 分支（PRD 收口或用户要求时才合 main）；散工单 ⇒ 确认没影响后直合 main」。设计依据见 `references/ADR-009-in-project-and-prd-branch.md`。

- **in-project 布局（新默认）**：`init` 在带 `.git` + `.scratch/` 的项目根自动判定（或 `--in-project` 显式），`--repo` 可省（自动取 origin remote）；产品仓 `.gitignore` 幂等补 `wt/`、`control/`；看板快照改走 `control/` 内**嵌套 git**——快照绝不进产品仓历史（旧外置布局行为不变，`workspace.json` 新增 `mode` 字段区分）。
- **统一合并流**：投卡自动推导并写卡面 `- 合入目标:` 行（工单目录有 `PRD.md` ⇒ PRD 分支 `ticket/<NN>-<slug>`；散工单 ⇒ `main`），merge 卡自动继承；`add-wt` 不给 `--base` 时按合入目标自动从 PRD 分支拉工单分支（PRD 分支不存在则先从 `origin/main` 建）；`card-read` 派生合入目标行。
- **PROTOCOL §3 改写 + 新增 §3.1「PRD 收口：PRD 分支 → main」**：触发二选一（PRD 全部工单收口 / 用户明确要求），PRD 收口卡 + 整支 PRD 分支 `/jxx-code-review` 后合 main；散工单合并前置「确认没影响」三件套写进 §3。
- **verify 假交付闸门基准修正**：review 卡分支零差异判据从 `origin/main` 改为**合入目标**（PRD 工单相对 main 恒有差异，旧基准会让闸门在 PRD 流里永远失声；PRD 分支不存在回退 `origin/main`）。
- **配套**：`CARD-TEMPLATE` 加 `- 合入目标:` 行；`starter-merger` 加合入目标提醒；`SKILL.md` 概述/命令面同步。旧版投的卡无该行时 `card-read`/`add-wt` 按 PRD 指针现场推导，**不逼迁**；既有外置工作区**无需迁移**。
- **selftest 115 → 128 项断言，0 失败**（新增：in-project 自动判定 / workspace.json mode / .gitignore 补行 / 嵌套 git 快照不污染产品仓 / 合入目标推导·派生·merge 卡继承 / add-wt 基分支自动推导 / 散工单仍从 origin/main）。

## 0.11.2 — 2026-09-30

**独立复审 22 项发现的修复轮**——复审实体：权威仓 `.scratch/75-jxx-ticket-system/reviews/75-c01-code-review.md`（L4 独立干净会话，结论钉 SHA `f5d6c9c6`）。本版把该报告 §1–§3 的**全部 19 条可修发现项逐条修掉**，并为 STD-01 / RUL-04 / RUL-05 新增可复跑回归用例；`selftest.mjs` **97 → 115 项断言，0 失败**。另 3 条**流程项**（SPEC-01 / SPEC-02 / RUL-01）由该复审报告实体 + 本次修复轮闭合，无代码改动。

> 与任务书「17 项修复 + 3 项流程项」的编号出入：报告 §1–§3 的可修项实为 **19 条**（std 8 + spec 6 + rule 5，即 22 项发现减去 3 条流程项；RUL-00 是正向复核不计入）。本节按**实测编号**逐条列出。

### 标准维度（std 8 条）

- **STD-01（Medium）· 卡面缺 `## 流转追加段` 时 `card-move` 静默丢弃卡内流转行**：抽 `appendFlowLine()`，**缺段则先补段再追加**（换行风格沿 `eolOf`）；原实现直接 `body.replace(/## 流转追加段…/)`，缺段时原样返回，而命令照旧打印「已记账 + 刷看板」，流转行无声消失。回归用例：造一张缺该段的卡跑 `card-move`，断言卡内流转行 + 账本行两处都在、新段落在卡尾不挤掉原有小节（同一断言在旧 `board.mjs` 上为 ✗）。
- **STD-02 · `renderPrdHtml` 第 4 形参 `todos` 全函数未引用**：删形参与两处实参（`cmdHtml` / `autoHtml`）——`prd.html` 每次保鲜不再多扫一遍整棵 `.scratch`。
- **STD-03 · `prd.html` 的复制按钮仍内联手写同一段逻辑**：改调与另两页同源的 `copyScript('PRD_PROMPTS', '.cp-prd', 'prd', …)`，「三页的复制骨架同源」自此名副其实。
- **STD-04 · 文件头命令清单与真实命令表脱节**：头注释不再抄一份命令清单，改为指向文件末尾的 `table`（唯一权威清单，现 16 个子命令），并写明「抄一份必然漂移」。
- **STD-05 · 兄弟文件 URL→路径形态不一致**：`selftest.mjs` 改用 `fileURLToPath`——手搓的 `URL.pathname` 保留百分号编码，技能目录含空格 / 非 ASCII 时 `path.join` 会拿到 `%20` 路径而失败。
- **STD-06 · `eolOf` 对零换行输入返回 CRLF**：无换行可继承时回退 LF（原实现两侧计数同为 0 时判成 CRLF，空串 / 单行卡插一行就把行尾风格翻转）。断言：零换行卡跑 `--to blocked` 后卡面以 LF 插行、全文无 `\r`。
- **STD-07 · `verify` 的 blocked 现场提示在三态板不可达（死分支）**：三态板里 `blockedIds ⊆ inboxIds`，该分支原先排在 inbox 之后永不命中，提示退化成误导性的「为领导者预开工作区（卡待领取）」。现把 blocked 判定提到 inbox 之前；断言：待领位 + `needs-info` 的卡其 worktree 报「属 blocked 卡保留现场」。
- **STD-08 · `new-card --labels` 对合法子集误报 WARN**：判据由「整串等于五标签之一」改为「逐 token 是否含非法标签」（与 `card-set` / `verify` 第 5 路对齐；PROTOCOL §4 明许「五标签之一或其子集」）。断言：`--labels 'ready-for-agent needs-info'` 无 WARN 且 verify 绿；含非法值仍 WARN（反例）。

### spec 维度（SPEC-03 ~ SPEC-08，6 条）

- **SPEC-03 · `SKILL.md` 自述两个不存在的看板能力**：删「PRD 看板列出尚无 `PRD.md` 的孤儿工单目录」「`human.html` 列出所有孤儿 worktree 与游离分支 + 清理提示词」两句，改写为**真实行为**——`scanPrds` 对无 `PRD.md` 的目录直接跳过；孤儿 worktree 只由 `verify` 报一条 `WARN worktree wt/<id> 无 claimed 卡引用`（`board.mjs` 里没有「游离分支」判据），清理一律走 `rm-wt` 一次一卡。
- **SPEC-04 · `SKILL.md` 同段新旧泳道词自相矛盾**：后半句「执行态徽标（待领 / 在办 / 待终审）」统一为「（`待领取` / `处理中` / `待审核`，与列名同源，即 `TOKEN_TEXT` 单源）」。
- **SPEC-05 · 断言数自报 96、实测 97**：统一为**实测值**——0.11.1 段改「92 → 97」（自报 96 系笔误），本版后为 115。
- **SPEC-06 · CHANGELOG 对 localStorage 键自述前后矛盾**：0.11.0 那条订正为 `showHistory:<root>`，并注明 v0.11.1 起按 root 路径隔离。
- **SPEC-07 · 「LLM 标注全链路」未覆盖 reviewer**：`starter-reviewer.tmpl.md` 与 `PROTOCOL.tmpl.md` §5.3 补同一套约定——审查者不领卡（不动执行态，无需 `card-move --to claimed`），结论写回卡内时在流转行尾部自报 `🛠 <harness 名>/<模型名>`，**且不得**用 `card-set --field Harness/LLM` 覆盖领卡者的读数。
- **SPEC-08 · 升级冲击面未文档化**：`SKILL.md`「看板 / 账本 / 重连自检」补「升级冲击面（必读）」——未迁板的旧板 + 卡面无 `labels` 行 ⇒ 迁板后 `verify` 立即 exit 5 报「缺 labels 行」，这是**有意的催化剂**不是回归；附可照做的五步升级顺序（snapshot → dry-run → migrate → 逐张补标签 → verify 回绿）。

### 规则维度（RUL-02 ~ RUL-06，5 条）

- **RUL-02 · ADR-008 修订注「三行」与同版四处「四行」互斥**：改为 `- Harness:` / `- LLM:` / `- 开始处理:` / `- 结束处理:` **四行**属统计面，注标题补成「v0.11.0 / v0.11.1」。
- **RUL-03 · PROTOCOL（唯一真源）教的 starter 路径 `init` 从不产出**：§5.2 的 `control/starter/starter-dev.md` 改为 `control/starter/dev.md`，并写明实际产出文件名（`dev` / `merger` / `reviewer` / `auto.md`，无 `starter-` 前缀）；`SKILL.md` 同型引用（「starter-dev + 卡 id」）一并订正。
- **RUL-04 · 命令拼串注入面**：`git()` 由 `execSync('git ' + cmd)` 的 shell 拼串改为 **`execFileSync('git', [...argv])`**（全部 25 处调用点改写）；另加三道白名单闸门——`add-wt --ticket` 补与 `new-card` 同款的卡 id 正则、`rm-wt --ticket` 白名单收窄为 `^[A-Za-z0-9._-]+$`、卡面 `- 分支:` 行经 `safeRef()` 校验（不合规即判为不可信引用跳过，不再递进 git 参数位）。断言：`add-wt --ticket 'zz&echo PWNED>pwned.txt'` 被拒且无落点；卡面 `- 分支: ticket/x&echo PWNED>pwned.txt` 跑 `verify` 不再让诱饵文件落盘（两条在旧 `board.mjs` 上皆 ✗）。
- **RUL-05 · `selftest` 未钉住「重领不抹旧值」**：新增 3 条——重领未带 `--harness/--llm` 时保留卡上原值（并回显「保留卡上原值」）、重领带新值时覆盖旧值、`.review.md` 回流（返工）路径走得通且重盖开始处理并清空结束处理。
- **RUL-06 · 断言标题与「不认文案」原则的回退风险**：四泳道列名断言不再写死中文，改为从 `board.mjs` 的 `TOKEN_TEXT`（唯一词汇源）现取词；页头分道计数断言同样改派生，另加一条「`TOKEN_TEXT` 单源可解析」的前提断言（解析失败时不至于静默绿）。

### 流程项闭合（3 条，无代码改动）

- **SPEC-01（High）·「OCR 三维度 17 项发现全部修复或登记」无清单、无报告实体**：**已闭合**——复审报告实体已落仓 `.scratch/75-jxx-ticket-system/reviews/75-c01-code-review.md`；本版即对其中 19 条可修项的逐条处置与证据。
- **SPEC-02（High）· v0.11.1 改了 v0.10.0 已审查过的代码且无第三方复审**：**已闭合**——该报告即首次第三方复核（结论：功能性通过；两处文档 / 一致性缺口即本版 STD-03、RUL-02）。
- **RUL-01（High）· L4「双重审查」（组内审 + 独立干净会话复审）未走**：**已闭合**——独立干净会话复审实体 + 本修复轮构成补做；制度化待办（L4 卡把「独立复审报告实体坐标」列为硬验收项）已进 75-c01b 终审清单。

### 验证读数

- `node scripts/selftest.mjs` → **115/115 通过**，exit 0（`f5d6c9c6` 基线 97/97）。
- **反证（可复跑）**：把本版 `selftest.mjs` 对上 `59d3a0a6` 的旧 `board.mjs` 跑 → **108/115**，7 条新断言全部变 ✗（STD-01 ×2、STD-06、STD-07、STD-08、RUL-04 ×2），证明这些断言真的在判新行为，不是恒真。
- 技能仓既有测试 `node --test base/scripts/test/*.test.mjs` → **171/172 通过**；唯一失败项 `默认 vendors.json 声明 8 家、4 家有派生规则`（`base/scripts/test/ship.test.mjs:242`）只读**未改动**的 `base/scripts/vendors.json`，与本技能零交集 ⇒ **既有红，非本版引入**（本版 diff 只动 `jxx-ticket-board/` 下 7 个文件）。
## 0.11.1 — 2026-09-30

**LLM 标注全链路 + 审查发现项修复**——用户要求任务提示词里每一步的 agent harness 和实际使用的 LLM 模型都要标注。

- **`--llm` 参数**：`card-move --to claimed` 新增 `--llm <模型名>`，与 `--harness` 并列自报；进 claimed 位时同时盖 `- Harness:` 和 `- LLM:` 两个字段。漏报时命令行明着提示补（不静默留空），看板红字「harness/模型未标注」。`card-set` 白名单加 `LLM`，`card-read` 输出 LLM 行。
- **看板「处理中」泳道**：`🛠 <Harness> · <LLM>` 并列显示（如 `🛠 Qoder · Claude Sonnet 4.5`），未自报时红字告警。复制启动提示词自带环境自报要求（`--harness <名> --llm <模型名>`），贴给新会话即可开工。
- **模板同步**：`CARD-TEMPLATE.tmpl.md` 增 `- LLM:` 行（处理计时四行）；`PROTOCOL.tmpl.md` §1.2/§4 领卡命令与文法同步 `--llm`；`starter-dev.tmpl.md`/`starter-merger.tmpl.md` 自报 harness + LLM。
- **审查发现项修复**（0.11.0 代码审查的合并发现）：
  - `setField()` 替换路径不限于卡头字段块——小节正文里手写一个同名字段行会被误改。现两条路径（替换 + 插入）都限定在第一个 `## ` 之前。
  - `flowTimes()` 正则 `\s*\|` 会跨行泄漏（`\s` 匹配换行），改为 `[ \t]*\|`。
  - `eolOf()` 检测主导换行风格，`addLabel()` 等写回操作保留原 CRLF/LF 风格，不再混用。
  - `TOKEN_TEXT` 成为唯一词汇源，`STATE_LABEL` 由此派生，消除三处各写一遍的中文泳道名。
  - 旧五泳道板不按 `needs-info` 标签改道阻塞列（位置真源 = 目录，标签改道只在三态板生效）。
  - localStorage 键按 root 路径隔离（`showHistory:<root>`），两块板互不干扰。
  - 坏时间戳（无法解析）显示红字告警，绝不截断冒充干净时间（XSS 面）。
  - `prd.html` 的 `histScript` 调用漏传 `root` 参数，导致 localStorage 键名错误。
  - `starter-auto.tmpl.md` 路径修正（`starter-dev.md` → `dev.md`），消除手动改名绕开盖章的教导。
- **`selftest.mjs` 92 → 97 项断言**（载荷自报 96 是笔误，实测 97——行首 `check(` 计数与实跑输出一致；订正见 0.11.2 的 SPEC-05）：LLM 字段盖章与显示、坏时间戳红字告警（含 XSS 注入值）、卡头字段替换边界（小节正文同名字段不被误改）、旧板 needs-info 不改道、localStorage 键按 root 隔离。

## 0.11.0 — 2026-09-30

**看板改「四泳道 + 历史默认隐藏 + 处理计时读数」**——用户侧的诉求：已完成的默认别占屏（工单看板与 PRD 看板都要）、泳道按 待领取/处理中/待审核/阻塞 摆、处理中的卡要看得到是谁（哪个 harness）在办、什么时候开始、什么时候结束。

- **`board.html` 四泳道**：`待领取` / `处理中` / `待审核` / `阻塞` 四列按**执行态 token** 分列——三态板取文件名后缀 + `needs-info` 标签，未迁的旧五泳道板取目录名，同一份渲染器两种布局出同一套列。这是**显示层**改动，0.10.0 的三条正交轴与「领取 = 原子改名」不变量一字未动（ADR-008 已加显示层修订注）。`held` 仍是附在末尾的独立「暂缓」列（非空才出）；空泳道也渲染占位，列结构不随卡片增减抖动。阻塞列 = 旧板 `blocked/` ∪ 三态板「待领位 + needs-info」，后者从待领取列**摘走**而不是同时出现在两列（一卡一列，否则「复制启动提示词」按钮也就有两个）。
- **已完成/已归档默认不显示**：两列带 `class="col hist" style="display:none"`，页头给一个「显示已完成 (N) 与已归档 (M)」开关。**展开态必须落 localStorage**——页面每 5s `meta refresh` 整页重载，不落盘的话用户刚点开就被刷新收回去（selftest 断言 markup 与 localStorage 两件事，交互本身另在真实浏览器里点过：展开 → 刷新 → 仍展开）。历史卡 0 张时不出开关。页头计数改成按泳道拆分：`在办 9（待领 2 · 处理中 1 · 待审 3 · 阻塞 0 · 暂缓 3）· 历史 13 张默认隐藏`。
- **`prd.html` 同样按收口态分两栏**：`未完成 PRD (N)` 默认可见 / `已完成 PRD (M)` 默认 `display:none` + 页头开关。收口判据取「该 PRD 全部工单 done·wontfix **或** PRD 自身 `**Status:**` 已收口」，**零工单不算完成**（还没拆 ≠ 做完）。实测权威仓 61 份 PRD 中 45 份已收口，默认视图从整页历史缩到 16 块。两页的开关**共用同一个视图偏好键 `showHistory:<root>`**（v0.11.0 最初实现是裸 `showHistory`；v0.11.1 起按 root 路径隔离——`file://` 下浏览器把所有本地页当同一 origin，不分名会让本机所有工作区的看板互相串改。原来 board.html 用 `board.showHistory`，各自为政会出现「这页展开了、那页还藏着」这种自相矛盾的默认态），并把两页那段展开/收起脚本抽成 `histScript()` 一份实现（列宽 `--nc` 联动按参数传入，没有 `.cols` 的页面自动跳过）。
- **修掉一个 v0.8.0 就存在的死按钮**：`prd.html` 每份 PRD 的「📋 PRD 级整轨提示词」一直**没有任何点击处理器**——`PRD_PROMPTS` 被序列化进页面却没人消费，用户点了没反应（该页在 selftest 里此前零覆盖，所以烂了三个版本没人发现）。现接上与 human.html 同款的复制处理器 + 成功回显，并加回归断言「按钮真被监听器消费」。真实浏览器实测：点击后文案变「✔ 已复制，去贴给新会话跑整轨」。
- **处理计时三字段**（卡面新增 `- Harness:` / `- 开始处理:` / `- 结束处理:`）：`card-move` 进 `claimed` 位自动盖开始、离位自动盖结束并在命令回显里报「本轮处理时长 X」；harness 名由领卡会话 `--harness <名>` 自报（协议 §1.2 的领卡命令、dev/merger starter、PROTOCOL §4 文法都同步了）。漏报时卡面落 `（未标注）` 占位，看板把这一行显示成红字 `harness 未标注`（占位串不能被当成一个 harness 名渲染），随时 `card-set --field Harness --value <名>` 补。
  - **这三行是统计面，不是租约**：判位唯一仍由目录 + 文件名后缀决定，`verify` 一个字都不按它们判——这正是 ADR-008 被否方案①（执行态进卡内字段）与本处的分界，PROTOCOL §4 与卡模板注释里都写死了这句话，免得后来人以为防抢改回了读改写。
  - **老板卡当天就有读数**：v0.11.0 之前投的卡没有这三行，看板与 `card-read` 回退取「流转追加段」里最后一条 `->claimed` / `claimed->` 行的时间（`card-read` 标 `[由流转段推得]`）。结束时间早于或等于开始时间的（重领未清、时钟回拨）一律判为「无结束时间」，宁可少显示也不臆造一个「用时 0m」。
- **`setField()` 卡头字段 upsert**（新字段公用）：有则替换、无则插进卡头字段块末尾并保留原换行风格。定位只认「第一个 `## ` 之前 + 已知字段名白名单」——流转段的 `- 2026-09-30 10:21 | inbox->claimed | …` 同样形如 `- x:`（冒号在时间里），泛匹配会把新字段插到小节里去。`card-set` 白名单加这三字段，并统一走 `setField`：**卡面缺行时插进去**，不再 `die` 逼领导者手改卡面（旧板在飞卡普遍缺行，die 等于升级即卡死）。
- **顺手修掉一处既有不一致**：`card-move` 的卡内流转行与账本行原来各调一次 `localIso()`，同一动作两处读数能差 1s。现在共用一个 `now`。
- **模板与协议同步**：`CARD-TEMPLATE.tmpl.md` 增三行（留空 + 注释说明是统计面）；`PROTOCOL.tmpl.md` §0（board.html 一句改四泳道）/ §1.2（领卡命令带 `--harness`）/ §4（三字段的填法、补法、以及「不参与判位」）；`starter-dev.tmpl.md`、`starter-merger.tmpl.md` 各加自报 harness 一行。
- **`selftest.mjs` 70 → 92 项断言**：四泳道列 + 空列占位、hist 列默认 `display:none`、收口卡不再出现在任何可见泳道、needs-info 卡一卡一列、页头分道计数、领取未带 `--harness` 的显式提示、进/出 claimed 的自动盖章、卡面缺行时的插入路径、老板卡回退流转段出读数且不臆造结束时间、旧五泳道板同样渲染四泳道、**prd.html 两栏与收口判据（造 .scratch 夹具实测 16 未完成 / 45 已完成的真实拆分）+ 整轨按钮有监听器**。夹具卡（006-legacy）用完连卡带账本一并收回——留一条「账本说它在 review 但卡没了」的假红灯会污染后面每一条 verify 断言。写断言时踩过一次坑：切「已完成」栏内容按「下一个 h2」收尾会把页脚脚本里的 `PRD_PROMPTS`（含全部 PRD 号）圈进来，造成假红灯——改按 `</section>` 收尾。

## 0.10.0 — 2026-09-30

**三态目录 + 标签正交（D9 落地，工单 75-c01 / ADR-008）**——公告板与服务器工单系统改用同一套心智：目录只表达生命周期，执行态与 triage 各归各的载体。**防抢地基不动**：领取仍是一次原子 rename（ADR-004 的核心不变量），执行态落在**文件名后缀**而不是卡内字段——后者正是 ADR-004 明确否掉的「平铺 + frontmatter 租约」方案。

- **三条正交轴**：目录 `open/`（未收口）· `done/`（已收口）· `archived/`（wontfix/让位）；文件名后缀 `<id>.md` 待领 · `.claimed.md` 在办 · `.review.md` 待终审；卡面 `- labels:` 行 = triage 五标签（`ready-for-agent` / `ready-for-human` / `needs-info` / `needs-triage` / `wontfix`，不增不减）。`held/`（领导者暂缓道）原样保留。
- **`blocked` 不再是目录**：`card-move --to blocked` 把卡落回 `open/` 待领位并自动补 `needs-info` 标签；账本与卡内流转行仍记 `->blocked`，`verify` 的闭合判据自动变成「待领位 + 带 needs-info」。等人拍板用 `card-set --field labels --value ready-for-human`。
- **历史账本零改写**：`move <卡id>.md <from>-><to>` 里的 from/to 继续是工作流位 token（`inbox/claimed/review/done/blocked/archived/held`），五泳道时代留下的历史行仍逐条可回放——历史账本是审计面，改一条就等于造假。
- **新增 `migrate` 子命令**：旧五泳道板迁三态，只做「建目录 → 逐张改名 → 补 labels → 记一行账 → 留快照」；`--dry-run` 先出清单，幂等可重跑，**旧目录留空不删**（红线 §7.2），回退 = 把卡 mv 回去。
- **两条新红灯**（改名方案唯一的两个新腐坏面，都机检）：① 同一 id 同时占两位（`x.md` 与 `x.claimed.md`）⇒ MISMATCH；② 三态板在旧泳道目录里扫到 `.md` ⇒ MISMATCH，并直接给出可照做的改名目标（否则照旧协议 `mv` 进去的卡会「写成功却永远看不见」）。
- **`verify` 升为五路对账**：账本 × 卡位 × worktree × 工单状态 × **标签**（新增第 5 路：未收口三位缺 `labels` 行、标签越界、`wontfix` 滞留未收口位、`doc_ref` 写成本地路径都判 MISMATCH）。
- **薄卡增 `- doc_ref:`**（服务器工单 URL，手填 `<部署域>/tickets/<工单id>`，路由规则见 PRD 75 前端段 `/tickets/:id`），与本地 `PRD:` 路径分列；`new-card` 增 `--labels` / `--doc-ref`，投卡时 labels 缺省取自工单 `**Status:**` 行。`card-set` 白名单加 `labels` / `doc_ref`；`card-read` 输出这两个派生行。
- **`board.html` 改渲染三列**（在办 open / 已收口 done / 已归档 archived）+ 每卡**执行态徽标**（待领·在办·待终审）+ **triage 标签色标**（五色）+ `doc_ref` 外链；`prd.html` 的「在办」分组按 open 三位判定。
- **同型坑修复**：`cardFields` 取值正则原为 `^- k:\s*(.+)\s*$`，其中 `\s*` 会吞换行——空的 `- doc_ref:` 会把**下一行**的 `- PRD: …` 抄成自己的值（实测立刻假报「doc_ref 不是 URL」）。字符类一律改 `[^\r\n]`；这是 0.9.3「正文里的 `- PRD:` 被当卡头字段」的同型坑，selftest 加了跨行泄漏回归断言。
- **协议与模板同步**：`PROTOCOL.tmpl.md` §0（三轴表）/ §1.1-1.2（找无后缀待领卡、领取=改名）/ §2（交付=改名 `.review.md`、受阻=`--to blocked`）/ §3（复核对象 `open/<id>.review.md`、打回改名回 `.claimed.md`）/ §4（token 与物理落点对应表 + labels 必填）/ §5（auto 监控看后缀）；`CARD-TEMPLATE.tmpl.md` 增 `labels:` / `doc_ref:` 行与三轴说明；四份 starter 同步改口径（含本技能**没有** `card-block` 子命令这一错位描述的订正）。
- **`references/ADR-008-three-state-lanes-and-orthogonal-labels.md`** 记录决策与被否方案，并修订 ADR-004 决策 1/3（其「原子 move 防抢」不变量原样保留）。
- **`selftest.mjs` 14 → 70 项断言**：三态落点、改名防抢（含抢占反例与「被拒方不动原卡」）、一位双占红灯、历史 `->blocked` 行双向闭合、旧泳道残卡红灯、labels/doc_ref 四类反例、三列渲染、migrate 六项（dry-run / 四种泳道映射 / 不删旧目录 / 记账 / 幂等），外加审查轮修掉的六条回归（`$&` 替换串污染、账本竖线断列、收口位带后缀卡红灯、标签代拟拒签、done 同道名误报、blocked 双判）。


## 0.9.3 — 2026-09-30

**事故驱动的一轮硬化**：2026-09-30 07:22，一次被授权的「批量回收 worktree」失控，把整个 `control/`（账本 + 254 张卡 + 三页看板）与多数 worktree 目录删掉；`control/` 当时无版本控制 ⇒ 不可还原。以下四类改动针对该事故链上的每一环。

- **看板版本化（新增 `snapshot` + 变更类命令自动留档）**：`board.mjs snapshot --root <root>` 把 `control/` 提交进**工作区根**的本地 git 仓库（`.gitignore` 忽略 `wt/`）；`autoHtml` 之外，`init`/`new-card`/`card-move`/`card-rm`/`card-set`/`ledger` 执行后自动调用一次（未 `git init` 的工作区静默跳过，行为不变）。任意时点的卡可 `git show <sha>:control/cards/...` 取回。
- **破坏性操作收口**：`rm-wt` 只接受**单段目录名**，解析路径必须落在 `<root>/wt/` 且真实存在，越界即 `die`（`../control`、`..`、通配符全部拒绝）；删除后补 `git worktree prune`。`add-wt` 先 `worktree prune`——修掉「目录被外部删除后残留 stale 注册，导致 `-b` 回退分支失败」的实测故障。
- **假信号修复**：① `cardFields` 剥掉字段值两侧的引号/反引号，且 `prd` 只认 `.md` 结尾的值——正文里写 `- PRD: \`路径\`` 不再被当卡头字段（此前会报「PRD 指针不存在」的假 MISMATCH），模板占位串也不再触发；② `verify` 的 BACKLOG 撞号审计跳过「零领先」分支（三点 diff 的 merge-base 随合入后移，对已合入未清分支必然误报——该欠账 2026-09-29 已登记）。**注**：同时实测过「改两点 diff」的方案，对已重编号的合入分支反而新增误报，故未采用。
- **模板漂移修复（新增 `render`）**：`init` 的 `put()` 只补缺、从不更新已存在文件 ⇒ `control/` 里的模板会永久停在旧版本（本次即为实例：live 卡模板缺 `- PRD:` 行，而 assets 早已有）。`board.mjs render --root <root> [--write]` 逐份比对 assets，默认只报 `[drift]`，`--write` 覆盖并把旧版备份到 `control/.render-backup/`。
- **协议新增 §7「破坏性操作红线与看板自保」**（`assets/PROTOCOL.tmpl.md`）：只走授权通道、一次一卡、`control/` 只读不删、禁止把批量破坏性操作交给子代理、破坏前先留档；§3 合并专员的「回收 worktree/分支」一句同步收口。
- **新增 `scripts/selftest.mjs`（冒烟自测，零依赖）**：在系统临时目录跑完 `init → new-card → card-move → add-wt → verify → 快照 → rm-wt → render → board` 全链 14 项断言，含破坏性边界（路径穿越 / `..` / 不存在的卡必须被拒）与假字段回归（正文里的 \`- PRD:\` 不得触发假 MISMATCH）。`node scripts/selftest.mjs`，退出码即结论。**本轮实测踩点**：没有它时，脚本编辑出过一次「一个 \` 把文件写成两倍长」的隐性损坏，只能靠语法检查侥幸发现。（首版 selftest 自身也踩了两个环境坑：临时仓默认分支不是 \`main\`、没有 \`origin\` 远端，已修。）
- **`board` 的 token 成本**：done 泳道默认只报计数（254 张时全量打印约 12k token/次），`--all` 才展开。

## 0.9.2 — 2026-09-29

卡模板 `assets/CARD-TEMPLATE.tmpl.md`（及 init 渲染的 live `control/CARD-TEMPLATE.md`）新增 **`## 外部契约` 节**：双仓交付的卡必须写取证坐标（仓库 + 分支 + SHA + `文件:行`），`/jxx-code-review` 步骤 0b 与合并专员终审按该坐标**只读**取证（`git -C <仓> show <SHA>:<路径>`，禁 checkout 对方分支）；节留空 = 判无外部契约，实现明显消费外部接口而节空着 ⇒ 审查报「契约坐标缺失」。注：PROTOCOL §3 的定点复核清单**尚未**列这一步（欠账登记在 `docs/agents/external-contract-evidence.md`，协议归领导者改）。

- **为什么是 `## 节` 而不是 `- 字段:` 行**：`board.mjs` 的 `cmdCardRead` 只打印 `标题/难度/模型档位/依赖/PRD/分支/worktree` 七个固定字段 + 全部 `## ` 段，卡头其它 `- x:` 行**会被静默丢弃**（`cardFields` 无该键、`card-set` 白名单亦不含），审查者与终审恰恰都走 `card read` —— 与 v0.7.3「PRD 行静默丢失」同型坑（见 `board.mjs` new-card 处注释）。落 `## ` 段则零脚本改动即随 `card read` 出。

## 0.9.1 — 2026-09-28

**auto 投卡两处致命缺陷修复**（PRD 75/76 波次实跑暴露）。

- **卡 id 推导**：字母前缀工单（`b01-*.md` / `f01-*.md` / `c01-*` / `i01-*`，按阶段分组的拆单法）原先推成 `b01-slug`，过不了 `new-card` 的 `^\d+-` 正则；且同一 PRD 体系下多份 PRD 的 `b01` 会互相重号。现按所属 PRD 目录号加前缀（`.scratch/75-x/issues/b01-y.md` → `75-b01-y`），纯数字前缀工单行为不变。
- **状态闸门不再终止编排**：`cmdNewCard` 的 `die()` 走 `process.exit`，一批工单里混一张非 `ready-for-agent`（已 done / wontfix）会直接杀掉 `auto`，后续编排指令与 spawn 提示词全部拿不到。改为在 `auto` 内预检 Status 行，不合闸门记为 `errors` 行并继续处理其余工单。
- 回归：三工单混合投卡（`75-b01-*` + `76-f04-*` + 一张 done 的 `01-*`）→ rc=0、两张 inbox 卡、一条跳过记录；重复运行报「卡已存在」保持幂等。

## 0.9.0 — 2026-09-28

**Auto 模式（自动编排）**——指定一组工单后自动完成投卡→开发→三维度审查→合入全流程，无需人工拉会话。

- **新增 `auto` 子命令**：`board.mjs auto --tickets <工单文件列表> [--parallel N] [--retry N]`——读工单文件 → 逐张投卡（含状态闸门+依赖闸门）→ 输出编排者/worker/审查者/合并专员四角色 spawn 提示词。
- **新增两份 starter 模板**：
  - `starter-reviewer.tmpl.md`——三维度审查者（std/spec/rule），只审不改，并行执行。
  - `starter-auto.tmpl.md`——自动编排者（orchestrator），只调度不写代码。
- **PROTOCOL 增 §5 自动编排规则**：角色职责表、编排者规则（spawn→监控→触发审查→触发合入）、三维度审查规则、合并专员规则（auto 模式）、失败处理（重试→blocked→继续推进不阻塞的卡）。
- **init 渲染 4 份 starter**（dev / merger / reviewer / auto）。
- **SKILL.md 增 Auto 模式说明**：触发方式、编排者职责、三维度审查表、失败处理、Auto 模式动作循环。

## 0.8.0 — 2026-09-28

**PRD 看板（第三页）与执行分流**——面板职责收敛为：发布任务 + PRD/工单状态展示 + 提供任务提示词。

- `html` 升级为三页互链：`board.html`（工单视角）+ **`prd.html`（PRD 视角，新增）** + `human.html`（人工待办）。
- `prd.html`：扫权威仓 `.scratch/<NN-slug>/PRD.md + issues/*.md`，每份 PRD 呈现 Status、工单收口进度、工单按「前沿可领 / 在办 / 等人工 / 待评审 / 已完成 / 已放弃」分组；**有卡的工单按卡泳道显示真实协调状态（优先于工单文档 Status 行）**。
- **执行分流**：PRD 级整轨 = 每份 PRD 一个「📋 PRD 级整轨提示词」按钮，复制 `/jxx-implement-spec` 提示词（单分支 `ticket/<PRD号>-spec` 交付一支 PR，后台子 agent 按就绪前沿并发）；工单级分轨 = 工单看板领卡 `/jxx-implement`。同一 PRD 二选一防双轨（提示词自带在办卡检查）。
- 变更命令（init/new-card/ledger/add-wt/rm-wt/card-*）自动保鲜三页；watch 模式重扫三页。
- 协议、卡格式、状态机、账本文法零改动；`verify` 闸门全部保持（e2e 回归通过）。
