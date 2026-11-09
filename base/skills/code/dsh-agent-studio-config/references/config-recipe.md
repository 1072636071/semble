# 配置配方与坑清单（dsh-agent-studio · 操作层细则）

> 本文是技能 [SKILL.md](../SKILL.md) 的细则层：数据模型、端点契约、两套配方（新建/改名）、坑清单与验证方法论。
> 真源：memorial 054 存档（sub-task/001.md 十条坑、sub-task/002.md 源码事实、artifacts/kb-article-practice.md 坑 A-H、artifacts/OPERATIONS.md 操作手册）。
> **诚实边界**：文中数字（段/工具/技能计数、绑定条数）是 115-01 时点（2026-10-10/11）实测值；每次复刻必须以**当次** /observation 与 config 实测为准。

## 1. 数据模型：四池一绑定

Config 顶层（config.js:149-167）：`{ version, createdPresets, agents[], promptSets[], toolSets[], skillSets[], runtimeContextOff[], bindings }`（version/createdPresets 服务端自管，POST 不带）。

AgentSchema（config.js:62-82）：`id / name / note / model{provider,model,reasoningEffort} / maxRetries / fallbacks[] / background / toolPresentation / promptSets[] / toolSets[] / skillSets[] / children[]`——一个代理 = 三面 + 模型 + 降级链 + 后台模式 + 子代理名册。

- **所有池都是数组不是字典**（settings 合并 = 对象递归合并、数组整体替换）⇒ POST 必须整体给全，只发增量会把其他条目清掉。
- `bindings.presets`：`presetId → agentId`，presetId 唯一；**无工作区维度**（lib/config.js:107-110——cwd 只参与技能发现）。所以「按工作区开关」只能靠「选哪个预设」承载（D9/D10）。
- `background` 三档：always-background（返回 subagentId，≠ jobId）/ foreground / model-decides。
- 池内约束：id 唯一；同一代理装载的段/工具/技能不得重叠（findLoadConflict）；PTC 预设另有必备段白名单。

## 2. 端点契约（读 GET 带壳、写 POST 纯体）

| 端点 | 形态 | 用途 |
| --- | --- | --- |
| GET /api/dsh-agent-studio/config | `{ok, config}` 外壳 | 备份与回读（外壳**不能**直接当 POST 体或面板导入体） |
| POST /api/dsh-agent-studio/config | 纯六池整体 | 写配置，热生效；头 `x-dsh-agent-studio: 1` + 合法 Origin |
| GET /observation | — | 各会话实际投递的段/工具/技能（复刻唯一可靠来源） |
| GET /skills、/presets、/models | — | 技能/预设/模型实时目录 |

围栏：读端点过 origin 校验，写端点另需自定义头（lib/http-guard.js）。落盘位置 = profile `cordis.patch.yml` 的 `agent-studio` 行（settings.yaml 已废弃），重启不丢。

## 3. 命名约定（D14 · id 英文内部键 + name 中文角色名）

与 jxx 系列同构（id 全英文角色词；name 全中文简洁角色名）。**id 是内部键**（children 名册、bindings、studio_delegate 的 agent 参数都引用它），改名零收益、有断链风险——**不改**；**name/note 是面板与人看的**，用中文。

| id（内部键，勿改） | name（面板显示） | 说明 |
| --- | --- | --- |
| memory-agent | **jxx 记忆台** | 记忆接待台（jxx 接待台的记忆增强版），children=[summarizer]（§3 命名示例；live v5 已并入 jxx-lead 并删除，见 §4 现态指针） |
| summarizer | **总结者** | 总结/简报子代理，always-background，对齐调研者/审查者/开发者句式 |
| jxx-lead | jxx 接待台 | 既有主代理（对照） |
| researcher / reviewer / developer | 调研者 / 审查者 / 开发者 | jxx 三角色（对照） |

- **旧称禁用**（D14 之前的写法，新文档/新配置一律不写）：「记忆主代理」「总结/记忆简报子代理」。
- note 用中文一句话说清职责（子代理 note 是主代理派活依据），句式对齐 jxx 系列。
- **改名操作 = v4 式最小 diff**：只动目标代理的 name（和 note 措辞），其余字段逐字不动；POST 后回读 diff 应只有这几处。历史快照（v3 after.json 等）冻结不回改，v4 变更独立留痕。
- 检索口径：找该代理的文档/配置时用 **id**（memory-agent / summarizer）检索，显示与人读用 **name**（jxx 记忆台 / 总结者）。

## 4. 配方一：新建代理（新建主代理 + 子代理，未绑定交付）

> **注（现态指针）**：2026-10-11 起该范例代理已并入 jxx-lead 并删除（live v5），本文保留为「如何新建复刻型代理」的通用配方；**现役记忆能力直接在 jxx-lead / lead-* 集上**（改记忆行为就改 lead-* 集与 jxx-lead），summarizer 是接待台的「总结者」子角色。

**准备三步**（SKILL.md「开工三步」）：备份两份 JSON（原样 + 剥壳纯 config rollback.json）→ /observation 采样核验（确认真采到目标预设活会话，否则显式降级复刻源并交叉核验）→ 读 bindings.presets 全量记录真实条数。

**主代理（以「jxx 记忆台」id=memory-agent 为例）**：

1. 复刻底稿三面 = 目标预设三面（115-01 实测以现网 jxx-lead 装载集为复刻源，段 38 / 工具 146 / 技能 71——**以当次实测为准**）。
2. 增量：promptSets 末尾追加「记忆提醒段」（职责：别忘了——生态告知、查询一律派子代理、开工先派简报、总结触发双通道、三问法分流、缺 project-kb-id 时**主代理亲自**建库并双指针写 AGENTS.md/CODEBUDDY.md）；toolSets 增量建库工具（115-01 实测 +`mcp__memory-gateway-weknora__create_knowledge_base` → 147——话术承诺建库就必须有这个工具）。
3. `children: ["summarizer"]`。
4. **保持未绑定**（bindings.presets 不出现新代理 id）；既有绑定逐字不动。

**子代理（以「总结者」id=summarizer 为例）**：

- `background: "always-background"`；note 中文一句话（职责：读/检索/总结写入，不建库）。
- toolSets：skill 工具 + todo_write/read 等机制工具 + 灵枢 recall/list/remember + WeKnora 查询/写入（115-01 实测 11 个，**不含**建库工具——三问法角色段明写「不建知识库」）。工具名以当次 observation/连接器实测为准，不凭记忆拼写。
- promptSets：内置三问法（属于谁？多久会变？客观事实还是我的经历？）+ 增量视角（标注本次总结覆盖区间、独立条目带 session 标识与时间戳、默认 KB 目标可配）。
- skillSets：[kb-router, weknora-kb-ops]（115-01 实测值）。**坑**：kb-router 是项目级技能，跨仓启用时平台解析不到——先装用户级或移出技能集（见 §7-C）。

**提交**：六池完整数组（agents/promptSets/toolSets/skillSets/bindings/runtimeContextOff）末尾追加新条目后整体 POST（§2 契约 + §8 字节纪律）→ 回读 after.json → 三方比对。

## 5. 配方二：只改名（v4 式最小 diff）

1. GET 备份两份（原样 + 剥壳 rollback.json）。
2. 在纯 config 上只改目标代理的 name / note（例：memory-agent 的 name → jxx 记忆台）。
3. 六池整体 POST；回读 diff 核对**仅**目标字段变化（bindings、三面、其他代理逐字未动）。
4. 快照冻结纪律：改名前的 after.json 不回改；新回读另存（v4 after），变更独立留痕。

## 6. 十条坑（源：sub-task/001.md，设计期血泪清单）

1. **绑定前必须复刻三面**，段白名单从 /observation 取；wshell-standard 与 cordis 段集不同，要 union——漏一段丢一段功能。
2. PTC 预设另需白名单 `tools:sdk` + `tools:ptc-only`，否则 PTC 反被剥坏。
3. 技能目录不是「段」，是 agent/pre-step 注入的持久消息，段白名单管不到，技能面完全由 skillSets 控制。
4. **每个工具集必须带 `skill` 工具**，否则平台把整条技能目录判为不可用不注入。
5. 白名单是冻结的——预设以后新增的段/工具/技能不会自动进来。
6. Windows .ps1 按系统 ANSI(GBK) 解析，UTF-8 中文直接炸——用 JSON 模板 + 显式 UTF-8 读写（写文件 UTF8Encoding($false) 无 BOM）。
7. 某回合函数快照可能不含 studio_* 工具——**新开会话**是最干净的验证路径。
8. 工具候选有冷启动，面板靠观察缓存兜底（工具面刚挂载时可能暂时看不到）。
9. 官方 subagent 工具与 studio 派活（studio_list_subagents/studio_delegate）**混用无角色隔离**，别混。
10. 导入导出：导出含未保存草稿；撞 id 时确认框开关决定覆盖或报错。

## 7. 实操坑 A-H（源：kb-article-practice.md，115-01 实录）→ 操作化清单

- **A 绑定数与文档不符**：实测 bindings 3 条（wshell-standard/cordis/ptc→jxx-lead），旧文档写 2 条。⇒ 永远现场数 bindings.presets，不引旧计数。
- **B observation 采样面偏移**：观察会话可能不含目标预设活会话。⇒ 采样前先确认覆盖；采不到则显式降级复刻源（如同源代理的装载集）并交叉核验，标注披露，不默认「上次复刻 = 当前真值」。
- **C 项目级技能跨仓静默缺失**：skillSets 写了仅本仓存在的技能（kb-router），别的仓库解析不到——不报错、只静默不注入。⇒ 跨仓启用前装用户级（~/.agents/skills/）或移出技能集；三问法等关键话术硬编码进角色段，不依赖单个技能。
- **D 基线计数要以实测为准**：001 未给计数，实测 lead 基线 = 段 38 / 工具 146 / 技能 71。⇒ 计数只做 sanity check，比对用逐字 deep-equal。
- **E 话术承诺超工具面（审查 M1）**：提醒段让主代理建库但工具集没有建库工具 → guard 拦。⇒ 先画「话术承诺动作 ↔ 工具面真有该工具」对照表，缺一个补工具或改话术。
- **F 错字随 POST 进 live（审查 H1 级教训）**：「灵躯」写进 note → 整体 POST 热生效 → 回读才发现。⇒ POST 前后都用核心产品名术语表 grep（灵枢/WeKnora/接待台/记忆台/总结者 及常见错写）；自审报告说 PASS 不算数。
- **G 回滚双坑**：① GET 的 `{ok,config}` 外壳直接当导入/POST 体 → 面板「没有可导入的项」/写端校验失败 ⇒ 回滚体必须是**剥壳纯 config**；② PS 5.1 `-Body $字符串` 按系统默认编码把中文刷成 `?`（实测 634 个 0x3F，服务端仍 200）⇒ 一律 `[Text.Encoding]::UTF8.GetBytes($cfg)` 发字节 + `charset=utf-8`。
- **H 流程坑（审查链路）**：verdict 解析对带注释尾缀的 VERDICT 行 fail-closed 误判（115-01 实录）⇒ 审查报告 VERDICT 行保持**裸行**，注释另起一行；自动化结论与报告正文冲突时以正文末行机读结论 + 发现项计数为准，人工放行闸保留。

## 8. 验证方法论（115-01 的 33 项自检怎么设计）

- **三方逐字比对**：backup（操作前 GET）/ after（POST 后回读）/ live（只读 GET）对「零改动声明」做 deep-equal——不口头声明。
- **六池整体替换核对**：POST 体 = 完整数组；新增条目纯末尾追加；旧 id 前缀顺序保持；断言「增量恰为新 id 集合、旧条目零改写」。
- **键名与重复键**：递归扫描重复键（0 命中）；全键名对照 schema 词汇表（root 8 / agent 12 / model 3 / promptSet 4 / section 3 / toolSet 4 / skillSet 4 / bindings 1 / binding 2）。
- **机密扫描**：sk-/Bearer/PRIVATE KEY/明文 password/api_key 正则 0 命中。
- **live 独立取证优先**：「热生效真实成立」只认只读 GET 回读，不采信自报。
- **回滚先演练**：对本地监听器抓包，请求体与 rollback.json 逐字节相等且 0x3F=0，再打真端点。
- **JSON 卫生**：严格可解析、UTF-8 无 BOM、LF（本仓 check:eol 同口径）。

## 9. 提交前 checklist（逐项勾，勾完才 POST）

- [ ] 备份两份（原样 + 剥壳 rollback.json），rollback.json 与 backup.config 深相等
- [ ] /observation 采样覆盖确认（坑 B），复刻源有显式标注
- [ ] bindings.presets 全量点数并逐条记录（坑 A）
- [ ] 话术↔工具面对照表画完（坑 E）
- [ ] 术语表 grep 两遍（POST 前 + 回读后，坑 F）
- [ ] 命名口径核对：id 英文未动、name 中文（jxx 记忆台/总结者）、旧称 0 命中（D14）
- [ ] 新代理默认未绑定；既有绑定逐字不动
- [ ] POST 字节纪律（§7-G②），先本地监听器演练（0x3F=0）
- [ ] 三方比对 backup/after/live deep-equal 实证
- [ ] 审查报告 VERDICT 行裸行（坑 H）

## 10. 变更记录（live 配置的改动实录）

> 每条记录写清：改了哪些代理的哪个段、条款正文逐字、验证链、回滚口径。备份 JSON 落在 `.temp/output/`（`.gitignore` 已排除，**不入库**）——所以回滚不能依赖备份文件存在，要按下面 §10 的回滚口径重建。

### 2026-10-27 · 14 个代理的角色规则段追加「歧义」条款

**动因**：把 `jxx-writing-for-agents` 1.3.0 新增的「歧义」判据下发到每个会写「给 agent 读」文档的角色上（技能正文是条件加载，角色段是常驻，两者职责不同：段里只留可执行条款 + pointer，不复制判据正文）。

**改动范围**（只动文本，未动 id / name / note / 三面 / bindings）：

| 代理 id | 段名 | 所在 promptSet id |
|---|---|---|
| jxx-lead | studio:jxx-team | jxx-lead-rules |
| researcher | studio:role-researcher | researcher-rules |
| reviewer | studio:role-reviewer | reviewer-rules |
| developer | studio:role-developer | developer-rules |
| summarizer | studio:role-summarizer | summarizer-rules |
| reviewer-spec | studio:role-reviewer-spec | reviewer-spec-rules |
| doc-reviewer | studio:role-doc-reviewer | doc-reviewer-rules |
| developer-impl | studio:role-developer-impl | developer-impl-rules |
| developer-bugfix | studio:role-developer-bugfix | developer-bugfix-rules |
| developer-refactor | studio:role-developer-refactor | developer-refactor-rules |
| architect | studio:role-architect | architect-rules |
| tester | studio:role-tester | tester-rules |
| integrator | studio:role-integrator | integrator-rules |
| scribe | studio:role-scribe | scribe-rules |

**未动 11 个**：organizer、blog-editor / blog-researcher / blog-writer / blog-reviewer、novel-editor / novel-organizer / novel-writer、reviewer-std / reviewer-rule / security-reviewer。前 8 个产出给人读的稿子或只做会话整理，后 3 个审的是代码 diff（命名、异味、劣化门禁），不写文档——歧义判据落在它们身上没有可执行对象。reviewer-spec 例外：它逐条判 AC 并要指出「生产侧漏项」，所以装了条款。

核对口径：`agents[].orderedSections` 里含 `**歧义**：写给别人` 的代理数 = 14（与上表一致）；用 `node -e` 扫 live 快照点数，不凭记忆。

**条款正文**（逐字，追加在段末，前导一个空行）：

```markdown
**歧义**：写给别人（人或 agent）读的文档、工单、派活 prompt，落笔前过四问——谁执行、对什么做、什么时候做、例外是什么。四项缺哪项就写成「待确认：<缺什么>」，不写成含糊的默认；有冲突处写明「以谁为准」。判据见 `jxx-writing-for-agents` 技能「歧义」节。
```

**两处都改**（坑⑮）：`agents[].orderedSections[].text`（真正生效的那份）与 `promptSets[].sections[].text`（同步，防旧路回潮）。只改 promptSets 会 POST 成功、verify 全 PASS、子代理照旧带旧句。

**执行姿势**（可复现，一次性的注入脚本落在 `.temp/scripts/studio-add-ambiguity.mjs`，**不入库**）：

1. `studio-config-get.mjs` 从 live 取快照（带 `{ok,config}` 外壳，POST 时脚本自动剥壳）；
2. 按上表逐代理定位段：`agents[].orderedSections` 与 `promptSets[].sections` 两处都找同名段，`text` 已含 `**歧义**` 就跳过（幂等），否则剥掉尾部空白后追加一个空行 + 条款正文；
3. 写回完整外壳存 proposed.json，**六池全量**不动其它条目；
4. `studio-config-validate.mjs`（error 0）→ `studio-config-doctor.mjs --file`（须报「本地快照与 live 一致」，否则就是坑⑰ 过期快照，回去重取）→ `studio-config-post.mjs` dry-run → `--apply`；
5. `studio-config-verify.mjs proposed.json --backup <本次快照>`：六池 PASS + bindings 与备份逐字一致 + 变化清单只含上表 14 个 agent 与对应 14 个 promptSet；
6. `studio-config-doctor.mjs`（live）error 0 / warn 0；
7. 探针子代理复验（见下）。

**验证**：`studio_delegate` 派一个只读探针（doc-reviewer），要求逐字抄回自己角色规则段。回帖含该条款 = 生效。GET 回读只能证明「写进去了」，不能证明「投递的是这份」——这就是坑⑮ 的取证方式。

**回滚口径**（备份不在了也照样能用）：重新 GET 一份 live 快照，对每个目标段把 `**歧义**` 起、到该段正文末尾为止的那一段删掉——条款文本以本节上面的逐字块为唯一依据，幂等判据是段内是否含 `**歧义**：写给别人`。然后走同一条 POST 链。单代理手工回滚更快：面板里删那段文本、保存、探针复验。

**顺带记录（同一次改动里学到的）**：
- 本次 POST 服务端 warnings 全是「技能正文提到别的技能，但该技能不在这个代理的技能集里」，属既有配置状态，与本次改动无关，逐条判定为「不必须」，未处理。
- live `/skills` 从 99 涨到 117，是因为同批 `ship install` 刷新了用户级技能目录——doctor 的技能解析面计数会随分发变化，不要把它当配置漂移来查。

### 2026-10-27 · jxx-lead 两段角色规则去重（消除与名册段/彼此的真重复）

**动因**：提示词自检端点（工单 02/03 判据）报出两处真重复——`studio:jxx-team` ↔ `studio:available-subagents`（角色枚举与「查名册」boilerplate 讲了两遍）、`studio:jxx-team` ↔ `studio:memory-reminder`（「一条命令看输出」例子逐字重复）。裁决：不合并段落，**去重内容**——名册段（代码生成）是角色清单唯一真源，规则段只留判据。

**改动范围**（只动 text，未动 id / name / note / 三面装载 / bindings）：

| 位置 | 段名 | 改动 |
|---|---|---|
| agents[jxx-lead].orderedSections + promptSets[jxx-lead-rules].sections（两处逐字同步，坑⑮） | studio:jxx-team | ① 「看名册 → 派给 researcher（找资料）/ reviewer（审代码）/ developer（写代码）/ summarizer（记忆与总结）」→「派活先 `studio_list_subagents` 看名册、按各行 description 选人，再 `studio_delegate`——角色清单的唯一真源是名册段，本段不复述角色枚举」；② 「（派 developer）」→「（交给名册里的开发角色）」；③ 删「`studio_list_subagents` 查名册与状态」（B 路线里与名册段逐字重叠） |
| 同上两处 | studio:memory-reminder | ① 豁免例子「（问概念、闲聊、单条命令看输出）」→「（概念问答、闲聊、看一条命令的输出这类）」（消与 jxx-team 例子的逐字重叠）；② 「每次产独立条目，不并发改写同一条。」→「每次写入新建条目，不要回改既有同一条。」（消与 summarizer 名册行 description 的逐字重叠） |

**条款正文**：以上逐字（旧句 → 新句）。幂等判据：段内含「唯一真源是名册段」/「概念问答」即已改过。

**执行链**（六步全过）：studio-config-get 取快照 → 本地注入（4 份拷贝全改）→ validate error 0 → doctor --file（16 个「幽灵技能」为 --file 模式口径差，对照原始备份 --file 同样 16 ⇒ 非本次引入）→ post dry-run → --apply（服务端 warnings 全是既有技能互指，逐条判「不必须」）→ verify：六池 PASS、bindings 与备份逐字一致、变化只含 jxx-lead 与 jxx-lead-rules → doctor(live) 0·0。

**验证**：端点实跑（新判据 lib + 触发 reconcile 后）`duplicates=0`；文本标记 `唯一真源是名册段`/`概念问答` 在、`派给 researcher`/`单条命令看输出` 不在；反向对照——旧文本快照过新 lib 报 2 条。段面复验由 GET 快照完成；新会话装配后的投递复验：下次该预设新开会话时按 workflows §验证 核对。

**回滚口径**：重新 GET live 快照，把上表 5 处「新句→旧句」反向替换（旧句逐字见本条），六池全量 POST 回去。备份 `.temp/output/cfg/backup-live-fresh.json`（不入库，丢了按本节文本重建）。

**顺带**：本次同时实测确认「配置文本变化触发 reconcile 会顺带换上新 `lib/` 模块」（AGENTS.md 2026-10-27 那节）——改 prompt 与改代码都靠同一次 patch 文本变化生效。

### 2026-11-07 · 清 7 个幽灵技能引用（agent 中心技能集对拍 live /skills）

**动因**：姜先生指出 `dsh-plugin-dev` 技能已失效，要求在 agent 中心移除，并检查其他技能是否还有该新增/该移除的。以 `studio-config-doctor.mjs`（脚本注释即「agent 中心配置体检」）为准取证：live doctor 报 7 条 error，全是「幽灵技能」——配置里引用、但 `GET /skills` 解析面（source=live，90 个）找不到，静默不注入（坑⑥）。`dsh-plugin-dev` 是其中之一，只在 `lead-skills`。7 个在 `~/.agents/skills` 一级目录都不存在；`jxx-to-milestones` 连 JwikisSkills 真源仓都无残留目录，其余 6 个真源仓有旧目录但未 ship 到本机。

**改动范围**（只动 4 个 skillSets 的 `skills` 数组；未动 agents / promptSets / toolSets / bindings / runtimeContextOff；id / name / note 逐字未动）：

| skillSet id | 清理前 → 后 | 去掉的幽灵 |
|---|---|---|
| lead-skills | 45 → 38 | dsh-plugin-dev、ima-skill、jxx-grill-me、jxx-grilling、jxx-prototype、jxx-to-milestones、jxx-wizard |
| architect-skills | 11 → 8 | jxx-grill-me、jxx-grilling、jxx-to-milestones |
| integrator-skills | 7 → 6 | jxx-to-milestones |
| scribe-skills | 8 → 7 | jxx-to-milestones |

**执行链**（六步全过，SKILL.md 标准流）：`studio-config-get.mjs` 重取新备份（坑⑰）→ 六池全量构造 proposed（剥壳、不发 version/createdPresets）→ `validate`（error 0，warning 1 = 53 个引用平台预设段的常规提示）→ `doctor --file`（报「与 live 有 4 处差异」= 本次要改的 4 个集，属预期；`--file` 不联网故幽灵检查跳过）→ `post dry-run` → `--apply`（HTTP 200 ok:true）→ `verify --backup --typo-scan`（六池 PASS + bindings 与备份逐字一致 + 变化清单只含 4 个 skillSet + 错字扫描无误）→ `doctor(live)` error 0 / warn 0。最终独立 GET 复核：`dsh-plugin-dev` 及另 6 个名字在 live config 残留 0 次，lead-skills 38 个全部可解析。

**POST 服务端 warnings**：20 条全是「技能正文提到别的技能、但该技能不在同一集」的交叉引用提示，属既有配置状态、与本次改动无关，逐条判「不必须」，未处理（与 2026-10-27 两条记录的处置一致）。本地复算得 11 个被提及但未同集的名字：`commands` / `craft-router` / `find-skills` / `impeccable` / `jxx-code-review` / `jxx-domain-modeling` / `jxx-grill-with-docs` / `jxx-to-spec` / `jxx-to-tickets` / `jxx-writing-for-agents` / `kb-router`；其中 `craft-router` / `kb-router` / `find-skills` 等本身可解析，只是未挂到引用方的集里。

**核对口径**：幽灵 = `skillSets[].skills`（去重 57 个）与 `GET /skills`（90 个）的 A−B 差集，用 `studio-config-doctor.mjs` 的 findings 作权威判定，不凭记忆。反向「新增」= B−A（40 个未被任何集引用），其中 6 个是用户级技能 `agent-reach` / `archify` / `craft-router` / `dbx` / `dsh-add-mcp` / `mcp-hostinger`，其余 34 个是项目级 / custom 技能（跨仓不一定可用，坑⑥）——**是否补挂由姜先生定，本次未擅自新增**。

**回滚口径**：备份不在也能重建——重新 GET live，把上表 4 个集的 `skills` 数组按「清理前」列补回 7 个名字（幂等判据 = 集内是否含这些名字），六池全量 POST 回去。本次备份 `.temp/output/skill-audit-backup.json`（不入库）。

### 2026-11-09 · U1 会话总结分治改（jxx-lead / summarizer 两份角色段）

**动因**：姜先生授权 agent 全权决策，要求「参考业界主流方案」后自己拍板。旧纪律是 4 个硬触发器命中即派 summarizer 后台全量总结整段区间（含所有子会话），而子代理结算语料会丢、closing message 残缺且未必是最终结论、工具面无 session_end / onFinalize 钩子 ⇒ 「任务结束统一收口」无机器触发点。改造采用分头出料：子代理自报局部要点（回包为唯一交件口径）→ lead 落暂存区（append-only jsonl）→ 任务结束派 summarizer 只读暂存区合并落库。

**改动范围**（只动 4 份 text，未动 id / name / note / 三面装载 / bindings）：

| 代理 id | 段名 | 所在 promptSet id | 两处 |
|---|---|---|---|
| jxx-lead | studio:memory-reminder（952 → 2116 字） | jxx-lead-rules | agents[].orderedSections + promptSets[].sections |
| summarizer | studio:role-summarizer（1194 → 1644 字） | summarizer-rules | 同上 |

未动：studio:role-summarizer-session-digest（3550 字，整理轮 session_digest 契约，属另一条线）、toolSets / skillSets / bindings / runtimeContextOff、cordis.patch.yml 其余行、线上服务、记忆与知识库。

**条款正文**（逐字见 `.temp/output/u1-new-lead-text.txt` 与 `u1-new-summ-text.txt`，本仓 `.temp/output/` 不入库，故逐字要点在此）：
- lead 段：① 子代理自报 ≤5 行「本子会话要点」（goal / 关键步骤 / 失败与返工 / 最终结论 / 被否方案），回包是唯一交件口径，不要求子代理写文件；② lead 用 write/edit 把要点追加进 `.temp/output/session-summary-staging/<lead-session-id>/<session-id>.jsonl`，一会话一文件、追加不改写；子代理零落盘/回帖丢失/被 interrupt 时写 `status:missing` 行，收口保留缺口不臆造；③ 「任务结束」机器判定 = update_goal(action=complete) 之后 / 姜先生明说结束收工 / 看板全 done 无 in_progress / compress 过一轮（compress 时先写告警不丢）；命中才派 summarizer 收口。④ 旧三触发器（卡 done / 审查裁定 / 话题切换）降级为「lead 写一行自己的局部要点」，不再触发全量总结。⑤ 落库带 no_atomize:true + session 标签 + type:experience；收口后暂存归档不硬删。
- summarizer 段：任务二改为「会话总结收口（只读暂存区）」——触发字样 + 暂存目录 + 覆盖区间；只读 jsonl、合并同区间重复要点、缺哪条标缺口；写入新建条目不回改；不负责归档暂存文件。新增任务三指针：带「整理归档会话/总结会话」字样时按 studio:role-summarizer-session-digest 段的 session_digest 契约执行，与任务二互斥，两种字样同时出现以「整理归档会话」为准。

**两处都改**（坑⑮）：agents[].orderedSections[].text（真正生效那份）与 promptSets[].sections[].text（同步防旧路回潮）；改前实测两份逐字相等（lead 952/952、summ 1194/1194）。

**执行链**（六步全过，均为本会话实证）：studio-config-get 取 live 快照（`.temp/output/studio-config-backup-20261109.json`，179364 字节）→ 六池全量构造 proposed（剥壳，不发 version/createdPresets，213704 字节）→ validate（error 0，warning 1 = 53 个引用平台预设段的常规提示）→ doctor --file（15 条幽灵技能为 --file 模式口径差，用同一备份跑 --file 对照同为 15 条逐条一致 ⇒ 既有状态非本次引入）→ post dry-run → **--apply（HTTP 200 `{"ok":true}`，20 条 warnings 全是既有技能互指，逐条判「不必须」）** → verify --backup --typo-scan（六池全 PASS、bindings 3 条与备份逐字一致、变化清单恰好 `agents: jxx-lead/summarizer` + `promptSets: jxx-lead-rules/summarizer-rules`、错字扫描无误）→ doctor(live) **error 0 / warn 0** → 独立 GET 复核：lead 两份 2417/2417 逐字相等、summ 两份 1735/1735 逐字相等，旧句「**会话总结**（硬触发器…」/「**任务二 · 会话总结**」零残留，新特征 `append`/`finalize`/`只读暂存区`/任务三指针全在，`studio:role-summarizer-session-digest` 段仍在，bindings 未动。坑⑮ 探针子代理 `ea1a6cc9` 回包**逐字抄回的正是新文**（含「任务二 · 会话总结收口（只读暂存区）」「任务三 · 全量读会话总结」「不自己扫 jsonl 目录」），零旧句残留 ⇒ 实投复验通过（GET 回读只证明写进去了，探针证明投递的是这份）。

**配套**（已交付并由 lead 独立复跑，不在本次 POST 内）：`.temp/scripts/session-summary-staging.mjs`（append / append-missing / read / list-missing / finalize / --help / --selftest），16444 字节、ESM、LF、UTF-8 无 BOM、纯 `node:` 内置，`.gitignore:119` 忽略 `.temp/` 未入库；dev-staging 产出 → lead 独立取证：`node --check` EXIT=0、`--help` EXIT=0、**主代理独立复跑 `--selftest` RESULT PASS 13/13**（时间戳 09:31 与子代理自报 09:29 不同，是真复跑）、机械闸 CR=0/LF=431/无 require/无三方 import。裁定通过，task-1 completed。lead 段据此改为「调脚本 append / append-missing / read / finalize」并指定暂存目录真源 = `.temp/output/session-summary-staging/`（仓内相对路径）。

**回滚口径**（备份不在了也照样能用）：重新 GET live，把上述 4 份 text 反向替换回旧文（旧文逐字见 2026-11-09 交接文档 §四 U1 与本文档 2026-10-27 记录所引原段），六池全量 POST 回去；幂等判据 = 段内含「会话总结 · 分头出料、收口落库」/「任务二 · 会话总结收口（只读暂存区）」即已改过。本次备份 `.temp/output/studio-config-backup-20261109.json`（不入库，丢了按本条重建）。


**决策依据 · 业界主流方案（检索日期 2026-11-09，出处 URL 见下）**

结论：**档 1 与主流同向，档 2 是反模式、档 3 属超范围重构**。主流三层证据：

1. **分层/归并摘要是主流，且「压缩有损」被反复点名**：Claude Code 的 auto-compact 按 token 阈值触发（不是定时器也不是会话结束），把早期历史压成结构化摘要，明确「保决定/状态/意图，丢逐字原文、推理链、被否方案、完整工具输出」——[claudecode.ac.cn/docs/en/context-window](https://claudecode.ac.cn/docs/en/context-window)、[gigarag.com auto-compact](https://gigarag.com/blog/context-left-until-auto-compact)；官方口径给的缓解正是「把关键状态在过程中写到外部记忆层，别等压缩回捞」。LangGraph 的 summarize_conversation 节点把 `summary` 作为独立 state 键增量扩展（用旧 summary 作上下文再吃新消息），[LangGraph memory 概念](https://github.com/langchain-ai/langgraph/blob/a7e59c9e54e0537012581aafa155342820c3e11a/docs/docs/concepts/memory.md)；Claude Code 文档还实证「子代理在独立上下文里做研究，只回摘要和少量元数据，不把大读取灌进主上下文」——与档 1 的「子代理自报 ≤5 行要点、主侧汇总」逐字同构。

2. **记忆分层：episodic（原始/无损）→ semantic（派生/可改）是主流**：Zep/Graphiti 三层 = episode subgraph（原始消息全量无损真源）→ semantic entity subgraph → community subgraph，且 bi-temporal 追踪 provenance 与有效期，过时事实被 deprecate 而非硬删（[S&P/451 Research 2026-04-10 报告](https://www.getzep.com/research/sp-global-market-intelligence-zep-coverage/)）。A-MEM 的 Zettelkasten 原子笔记 + 链接 + memory evolution（新记忆触发旧笔记属性更新）明确会「改写历史条目」，其自身风险清单点名「没有版本历史时难 debug 且不安全」（[DAIR.AI Academy A-MEM](https://academy.dair.ai/papers/agentic-memory-for-llm-agents)、[A-Mem 论文笔记](https://github.com/lhl/agentic-memory/blob/HEAD/references/xu-a-mem.md)）。Letta 的 Core Memory blocks 是**原地可编辑**、recursive summarization 自动压历史（[Letta ADE](https://www.letta.com/blog/introducing-the-agent-development-environment)）；mem0 明确「update or merge entries, not just append」（[mem0 用户记忆指南](https://mem0.ai/library/agent-memory/build-an-ai-agent-that-remembers-your-users)）；CrewAI 的 Memory 由 LLM 在 save 时推断 scope/importance、composite scoring 召回（[CrewAI memory docs](https://docs.crewai.com/edge/en/concepts/memory)）。

   **对本仓的裁决**：本会话硬约束「增量独立条目、不并发改写、不回改既有同一条」与 mem0/A-MEM/Letta 的原地 upsert **不同源**，但**不冲突**——本仓的「暂存 jsonl（无损 episode 层，append-only）+ 收口后写独立条目（semantic 层，不回改）」正好落在 Zep 的 episode→semantic 分层上，只是把「更新」实现成「追加新条目 + 旧条目自然过时」，用可审计性换掉原地改写。这是**有意识的取舍，照抄主流反而会破坏本仓归档链路的已写跳过判据**（简报 mem_1794213023328_40e443）。

3. **触发时机：主流用 token 阈值或显式会话原语，没有 session_end 钩子就别造**：Claude Code = token 剩余量阈值 + 手动 /compact 在自然断点触发；OpenAI Agents SDK 用 `session` 对象（SQLiteSession 等）在 **run 边界**自动读写，runner 循环直到 final answer 才结束（[OpenAI Running agents](https://platform.openai.com/docs/guides/agents/running-agents)、[Agents SDK Sessions](https://openai.github.io/openai-agents-python/sessions/)）；LangGraph 明确「hot path 更新 vs 独立进程更新」两种，整理型工作放独立进程。本仓工具面只有 get_goal/update_goal、无 session_end（L3282-3283 实证）⇒ 档 1 把「任务结束」定义为 goal complete / 用户明说结束 / 看板全 done / compress 四类**可机器判定**条件，比硬造一个不存在的钩子更贴近主流；同时保留 compress 兜底（对齐 Claude Code 阈值触发）。

4. **暂存载体与落盘责任**：CrewAI 在 task 边界「after each task 自动抽取离散事实入库、before each task 召回注入」；Claude Code 子代理只回摘要不回大读取；整理轮本仓已有「产物回最终消息、编排侧落盘摄取」契约（`session-digest-round` SKILL L103-106、简报 L15-16）。⇒ **落盘责任在编排侧，不在子代理**——这正是档 1 让 lead 调 append、不让子代理写文件的原因；档 2「只靠回帖、要点丢了就没了」被这些实践一致否定。

5. **失败兜底**：Zep 的 episode 层「complete, lossless source of truth」+ bi-temporal deprecate、OpenAI Sessions 的 `session_input_callback`/`SessionSettings(limit=N)` 都是「不丢真源、按需取用」；本仓对应 = append-only jsonl + `status:missing` 缺口登记 + finalize 移动归档不硬删 + 收口失败保留暂存下轮补收口。**不照搬**：A-MEM 的无版本 memory evolution、mem0 的静默 merge/upsert、依赖子代理可靠落盘——三者都与本仓「可审计 / 子代理零落盘老坑 / 不回改既有条目」冲突。

**档位 × 业界对齐度**：档 2（最小改）= 反模式（依赖易失的回帖，无任何持久 episode 层）；档 1（中改，**采纳**）= 对齐 Claude Code 子代理摘要 + Zep episode→semantic 分层 + LangGraph 增量 summary 节点 + 本仓既有回包摄取契约，收益（不丢子代理要点、收口有机器触发点、可审计）大于代价（新增一个脚本 + 两份提示词），可逆（备份 + 回滚口径具备，POST 可反向替换）；档 3（重构）= 与现有整理轮台账同源但动 core 与判据，超出「改总结纪律」范围，风险最高，本次不做——**不因重构成本预先否决，只因范围与可逆性不占优而不选**。

**检索缺口（不编造）**：本轮未取到 AutoGen 会话摘要、`session_end`/`onFinalize` 显式生命周期钩子在多 agent 框架中的权威出处；上述 5 问结论由已列 8 个出处交叉支撑，未查到的一律不补。调研子代理 `d208c299` 若回包带补充出处，由 lead 并入本节，不改既有结论。
**调研回包校正（子代理 `d208c299` 2026-11-09 回帖，只读、零写入）**：结论不推翻，档 1 维持；三处口径收紧 ——
- **权威出处升级**：一手资料优先用 Claude Code 官方文档 [code.claude.com/docs/en/hooks.md](https://code.claude.com/docs/en/hooks.md)（有 `SessionEnd` / `SubagentStop` / `PreCompact` / `PostCompact` / `Stop` / `TaskCompleted`，明确 hooks 给 deterministic control）、[context-window.md](https://code.claude.com/docs/en/context-window.md)、[model-config.md](https://code.claude.com/docs/en/model-config.md)；Anthropic 工程博客 [multi-agent-research-system](https://www.anthropic.com/engineering/multi-agent-research-system)（「Subagent output to a filesystem to minimize the game of telephone」+ LeadResearcher 综合）、[effective-context-engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)；Zep 论文 [arxiv 2501.13956v1](https://arxiv.org/html/2501.13956v1)、MemGPT [2310.08560](https://ar5iv.labs.arxiv.org/html/2310.08560)、Mem0 论文 [2504.19413](https://ar5iv.labs.arxiv.org/html/2504.19413) 与 Platform v3 [migration v2→v3](https://docs.mem0.ai/migration/platform-v2-to-v3)、A-MEM [2502.12110v10](https://arxiv.org/html/2502.12110v10)、Generative Agents [2304.03442](https://ar5iv.labs.arxiv.org/html/2304.03442)；LangMem [summarization guide](https://langchain-ai.github.io/langmem/guides/summarization/)（阈值触发 + running_summary 覆盖前一份 + 必须 checkpointer）、CrewAI [checkpointing.md](https://docs.crewai.com/en/concepts/checkpointing.md)（默认 `task_completed` 事件驱动写 checkpoint）、OpenAI [Sessions](https://openai.github.io/openai-agents-python/sessions/) / [Lifecycle](https://openai.github.io/openai-agents-python/ref/lifecycle/)（`on_agent_end` 在 final output 时触发）。
- **「增量独立条目」不是全业界唯一主流**：主流按记忆层分开 —— append/ADD-only 层有 MemGPT recall storage + FIFO evict 的 recursive summary、Letta archival memory `archival_memory_insert`（agent-immutable）、Generative Agents memory stream、Mem0 **Platform v3**（官方改 single-pass ADD-only，「memories accumulate instead of being overwritten」）；原地合并/演化层有 Mem0 论文/v2 的 `ADD/UPDATE/DELETE/NOOP`、Letta memory blocks rewrite、A-MEM replace、Zep `t_invalid` 失效旧边、LangMem running_summary 覆盖。**两处 Mem0 官方正文冲突（论文 vs Platform v3），不代裁、不引作唯一依据**。⇒ 本仓「暂存 jsonl append-only + 收口写独立条目不回改」精确落在 **raw/episode 层**，与主流之一同向；把它套到 core/semantic 层则不是主流，本仓因归档链路已写跳过判据而有意不套——**这是取舍，不是「业界都这样」**。
- **落盘责任与触发口径再确认**：Claude host / CrewAI runtime / OpenAI SDK 都由框架侧写盘；Anthropic 允许子代理写 external artifact 但必须回轻量引用。⇒ 档 1 让 **lead 调 append**、不让子代理写文件，与之一致（本会话据此把 lead 段从「用 write/edit 追加」改成「调脚本 append / append-missing / read / finalize」）。触发上「token 阈值 / cron 只解决上下文压力与补收，不判定任务完成」；本仓无 `session_end`/`onFinalize`，故用现有 `update_goal` 可判完成状态 + 看板全 done + 用户明说结束 + compress 兜底，**不发明钩子**。
- **不该照搬（调研补充）**：① 依赖宿主内部 transcript 格式（Claude 官方警告 entry format 会变，脚本别直接 parse）；② 依赖子代理可靠自写或 closing message；③ 要求原地改写长期记忆（与本仓 AGENTS.md 冲突，以本仓为准）；④ 把 token 阈值/cron 当任务结束；⑤ 收口后硬删 scratch（Zep 用 `t_invalid` 逻辑失效、Mem0 v3 不 delete）；⑥ 把「全量总结整个区间」当持久化多代理记忆。
- **仍待确认（不写成默认）**：proposed 的「任务结束」close 标记由谁写、重复触发的幂等键、存档重放判据——本轮未定义，留待下一轮按实证补；调研未读 proposed 实现，不对其代码正确性下结论，冲突时以 proposed 本地校验与 live 回读为准。
- **没查到（不编造）**：AutoGen 0.2 官方 `MessageSummaryTransformer` 一手正文；Claude Code `/compact` 是否换 session id 与 summary 精确注入协议；Generative Agents 正文「append-only」原句；blackboard 作为当前主流框架默认载体的权威一手来源；业界统一 staging 归档/幂等键规范。
