# 坑清单（现象 → 根因 → 预防/修法）

来源：001 调查沉淀 10 条（①–⑩）+ 115-01 实操新增 4 条（⑪–⑭，编号接续）。标注（源码）的条目已对照 dsh-agent-studio@0.1.5 源码核实。

## ① 话术与工具面必须一致（115-01 M1，最贵的一课）

- **现象**：提醒段让主代理自建项目知识库（用 `mcp__memory-gateway-weknora__create_knowledge_base`），但 memory-tools 复刻自 lead-tools、其中 0 个 WeKnora 工具——运行期主代理调该工具被 studio guard 拦（apply.js:528-536，执行期按名字实时判：不在工具集并集、非机制工具一律拦）。
- **根因**：提示词段（话术）与工具集（工具面）是两份独立数据，配置端点不做一致性校验；guard 只认工具集。
- **预防/修法**：写段之前先列「这段话让 agent 用哪些工具」，逐个核对工具集并集里有；改话术 = 连带核对工具面。校验脚本（validate）会做段文本×工具集交叉提示，但语义层靠人审。修法 = 工具集补增量（115-01：146 复刻 + 1 增量 = 147）重 POST。

## ② 配置错字/错误 POST 即进 live 运行态

- **现象**：POST 返回 `{ok:true}`，但段名拼错/工具名写错/集引用挂错——下一次装配起就按错误配置投递。
- **根因**：写入端点只做形状校验（applyDefaultNames + findLoadConflict + 插值变量，api.js:297-320），不做「段名是否存在」「工具名是否注册」的语义校验；错字段静默不投（apply.js:472-473）。
- **预防/修法**：POST 前必跑 validate 脚本；POST 后必跑 verify 脚本（GET live 与期望深相等 + 错字扫描）；语义正确性靠新开会话逐面核对（workflows §验证）。

## ③ GET {ok,config} 外壳当 POST 体 = 空壳

- **现象**：把 GET /config 回包整包回 POST，得 400「agents、promptSets、toolSets、bindings 必须一起给全」。
- **根因**：GET 外层是 `{ok:true, config}<…>`（api.js:368），POST 体要求六池纯体（api.js:279-291）。
- **预防/修法**：POST 前取 `.config` 剥壳。rollback 脚本自动剥壳；手写命令时用 `(... | ConvertFrom-Json).config`。

## ④ Windows PowerShell 5.1 字符串 -Body 把中文刷成 ?

- **现象**：PS 5.1 `Invoke-WebRequest -Body $cfgString` 发含中文的配置，POST 成功但段文本里的中文全变 `?`，且 200 返回、回读才炸。
- **根因**：字符串 body 走默认编码（非 UTF-8），多字节字符被替换。
- **预防/修法**：中文内容必须发字节 `[Text.Encoding]::UTF8.GetBytes($cfg)` 且 content-type 带 `; charset=utf-8`（115-01 §3 实测姿势）。**直接用 `studio-config-post.mjs`（Node 发 UTF-8 字节），不要手搓。**

## ⑤ observation 可能采不到目标预设的活会话（115-01 实测差异 2）

- **现象**：GET /observation 的 `sessions` 只有 novel/ptc 会话，没有 wshell-standard/cordis——目标预设「实际投递了什么」拿不到一手数据。
- **根因**：观察按会话采（observe.js:30 上限 50 个、存内存），冷启动/没活会话就只有 `cached`（按预设落盘的上一份快照）兜底。
- **预防/修法**：复刻源降级为**现网 config 内该预设已装载的三套集**（如 lead-* 本身就是上一轮按 observation 复刻沉淀的产物），并用 observation 对其他预设交叉核验段白名单与机制工具（115-01 §6.2 的做法：ptc 实投段与 lead 38 段的差集恰为 4 条 lead 自定义/专属段，对得上）。降级要写进交付说明。

## ⑥ 项目级技能跨仓静默缺失（115-01 实测差异 4）

- **现象**：skillSets 里写了 `kb-router`（项目级技能，`agents/skills/kb-router/`），到不含它的仓库启用该代理时，/skills 目录 71 个里没有它——该技能不注入，**其余技能不受影响**。
- **根因**：技能解析按 cwd 的项目技能目录 + 用户级目录（api.js:64-70）；skillSets 写平台解析不到的名字不报错，只该技能不出现（apply.js:690-703 只处理清单里存在的名字）。
- **预防/修法**：跨仓要用的技能装用户级（`~/.agents/skills/`）或从技能集去掉；写技能集前用 GET /skills 核对名字在不在。

## ⑦ 每个工具集必带 skill 工具

- **现象**：工具集漏 `skill`，代理一个技能都拿不到。
- **根因**（源码 config.js:442-451）：`skill` 是技能清单下发的开关——它不在 agent 工具面里时，平台 `dsh-tool-skill` 把这次快照当「用不了」，整条技能目录都不注入。
- **预防/修法**：每个工具集都带上 `skill`（写入端点只豁免它的重叠校验、不替你补）。validate 脚本会检查。

## ⑧ PTC 预设额外白名单 tools:sdk / tools:ptc-only

- **现象**：复刻 PTC 预设三面时漏 `tools:sdk`/`tools:ptc-only` 段，PTC 被剥坏。
- **根因**：PTC 模式下这两段是模型唯一的工具知识来源（config.js:433-440；SDK 段正文按当前工具视图生成，apply.js:879-901）；段面是覆盖语义，没列就不投。
- **预防/修法**：复刻 PTC 来源预设时必带这两段（115-01 summarizer-sections 就带了 sdk/ptc-only）。

## ⑨ 绑定前必须复刻三面（001 坑①）

- **现象**：先绑定再慢慢补三面 → 中间态会话三面全空/缺段；漏一段丢一段功能（wshell-standard 与 cordis 段集不同，要 union）。
- **根因**：绑定即接管是覆盖语义，不是叠加语义。
- **预防/修法**：唯一可靠数据源是 GET /observation；复刻完整 → 校验 → 验证 → **最后才绑**（workflows 流程 A→C 顺序）。

## ⑩ 技能目录不是「段」管不到（001 坑③）

- **现象**：想在段白名单里控制技能目录（`<available_skills>`）——没用。
- **根因**（源码 apply.js:654-706）：技能目录是 agent/pre-step 注入的持久消息，段白名单管不到；技能面完全由 skillSets 控制（agent 层同名覆盖翻 `modelInvocable`）。
- **预防/修法**：控技能只走 skillSets；控段只走 promptSets。

## ⑪ 官方 subagent 与插件派活混用无角色隔离（001 坑⑨）

- **现象**：用官方 `subagent` 工具派活，子代理没有角色登记，落到「预设主配置」同面。
- **根因**（源码 delegate.js:1-17）：官方工具参数没有代理 id，studio 认不出「这个子代理属于哪个代理配置」，无法挂专属三面。
- **预防/修法**：派活只走 `studio_list_subagents` + `studio_delegate`（delegate.js:234-391），两把工具要在调用者工具集里。

## ⑫ 白名单是冻结的（001 坑⑤）

- **现象**：预设以后新增的段/工具/技能不会自动进代理的面。
- **根因**：绑定即接管下三面 = 配置时的并集快照，平台不追新。
- **预防/修法**：上游新增能力后按 workflows 流程 B/A 增量复刻并重 POST；这也是「每次大改后重跑 observation」的理由。

## ⑬ 后台 subagentId ≠ jobId（001 坑延伸）

- **现象**：把 `studio_delegate` 返回的后台 `subagentId` 丢给 `job_output`，查不到。
- **根因**（源码 delegate.js:258-290 工具描述原文）：两个 id 空间；后台可续子代理用 `send_message` steer、等结算通知。
- **预防/修法**：后台子代理一律 `send_message`；`run_in_background` 只对 `background:`'model-decides'` 的代理有意义（always-background 无视它、foreground 无视它，delegate.js:337-339）。

## ⑭ 导入导出撞 id（001 坑⑩）

- **现象**：面板「导入」备份后保存，撞 id 时按确认框开关决定覆盖或报错。
- **根因**：导出含未保存草稿；id 是唯一键。
- **预防/修法**：API 回滚（`studio-config-rollback.mjs`）走整体替换没有撞 id 问题；面板导入只作人肉兜底，导入后记得「保存改动」才落盘（115-01 §3）。

## 实操纪律（从上面提炼）

1. 任何 POST 前：validate 过 + bindings 心里有数；任何 POST 后：verify 过。
2. 复刻永远以 observation/现网集为源，不凭记忆抄清单（⑨⑫）。
3. 工具集先想 `skill`（⑦），PTC 先想 sdk/ptc-only（⑧），话术先对工具面（①）。
4. 派活只走 studio_* 两把（⑪），验证只信新会话（坑⑦/②）。
