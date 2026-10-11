# 端到端工作流

约定：`$origin` = studio 地址（默认 `http://127.0.0.1:3080`）；`$skill` = 本技能 scripts 目录；产物文件统一放当前工单的 artifacts 目录。所有脚本零依赖（node ≥18 自带 fetch），危险动作（POST/rollback）默认 dry-run、加 `--apply` 才真写。

四个流程共用标准操作流骨架：**备份 → 复刻 → 构造 → 校验 → POST → 验证**（SKILL.md）。下面按场景给增量步骤。

## 流程 A：新建一个未绑定代理并复刻三面

场景：要一个新角色代理（如 115-01 的 memory-agent/summarizer），三面从某个现有代理/预设复刻 + 增量。**默认不绑定**——不绑定 = 完全不干预，对现有会话零影响，验证无忧后再走流程 C 绑定。

1. **备份**：
   ```bash
   node $skill/studio-config-get.mjs --origin $origin --out backup.json        # {ok,config} 外壳
   node $skill/studio-config-get.mjs --origin $origin --observation --out observation-baseline.json
   ```
   验证点：backup.json 可解析、外层 {ok,config}；observation-baseline.json 的 sessions/cached 里找目标预设。
2. **复刻三面**：优先从 observation 的目标预设会话取段/工具/技能清单；采不到 → 降级用现网 config 里该代理已装载的三套集 + observation 交叉核验（pitfalls ⑤），把降级口径写进交付说明。
3. **构造六池**：在 backup 的 .config 上增改：
   - `agents` 追加新代理：`children` 填子代理 id（先在 agents 池里建好子代理）；`note` 写清职责（模型靠它选人）；`background` 按需（后台可续用 `always-background`）。
   - `promptSets`/`toolSets`/`skillSets` 追加三套集：段有序（集顺序 = 投递顺序）；**每个工具集必带 `skill`（坑⑦）**；PTC 来源必带 `tools:sdk`/`tools:ptc-only`（坑⑧）；话术里点名的工具逐个进工具集（坑①）；技能名先对 GET /skills（坑⑥）。
   - `bindings` **原样保留**；`runtimeContextOff` 原样保留（不需要就原样带空/原值）。
4. **校验**：`node $skill/studio-config-validate.mjs proposed.json` → 退出码 0、error 空、warning 逐条人审。
5. **POST**：`node $skill/studio-config-post.mjs proposed.json --origin $origin`（先看 dry-run 头四个键统计）→ 确认后 `--apply` → 返回 `200 {"ok":true,"warnings":[…]}`，warnings 人审。
6. **验证**：`node $skill/studio-config-verify.mjs proposed.json --origin $origin --backup backup.json` → live≈proposed、bindings 与备份逐字未动、diff 只含新增条目。再按 §验证 新开会话核对。

## 流程 B：给代理加/改一个提示词段

场景：给现有代理（如 jxx-lead 的 lead-sections）加一段自定义提醒、或改某段文本。

1. 备份（同 A.1）。
2. 在备份 .config 里找到该代理 `promptSets` 指向的提示词集（按 id），增/改 `sections`：自定义段 = `{name, enabled:true, text:"…"}`（`name` 用 `studio:xxx` 风格自定义名）；引用平台段 = 只给 `name` 不给 `text`。
3. **一致性核对**（坑①）：新段话术点名的每个工具，确认在该代理 toolSets 并集里；不在 → 连带增补工具集。
4. 校验（插值变量：段文本 `{{var}}` 只能用白名单 `provider/model/cwd` + 已注册插件变量，写错=请求直接抛错）→ POST（--apply）→ 验证（同 A.6）。
5. 生效：下一次装配起新文本投递；提示词面改动**不用**新开代理，但验证仍走新会话（坑⑦/②）。

## 流程 C：绑定 / 解绑预设

**前提：三面已复刻完整并验证（流程 A/B 完成）——绑定即接管，先绑后补 = 中间态三面空（坑⑨）。**

绑定（推荐面板操作，也可 API 改 bindings）：
1. 面板 `$origin` → 绑定条 → 目标预设「绑定的主代理」选新代理 → 保存改动（提示「下一次装配起生效」）。
   API 等价：把 `{presetId, agentId}` 追加进 `bindings.presets`（presetId 保持唯一），六池全量 POST。
2. POST（--apply）后 verify：bindings 数组 = 备份 + 恰好一条新绑定。

解绑/回退：
- **首选面板**：绑定条改回「未绑定」或原代理 → 保存。代理配置可留在池里（未绑定 = 不干预）。
- API：`bindings.presets` 去掉该条（或改 agentId），六池全量 POST，verify 对拍。
- **整份配置回滚**：见流程 D。

## 流程 D：回滚

场景：POST 后发现配置坏了，或要恢复到操作前。

1. 找到操作前的备份（`{ok,config}` 外壳）。
2. 预演：`node $skill/studio-config-rollback.mjs backup.json --origin $origin` —— 剥壳校验（四件套齐全）+ 打印头统计，不发送。
3. 真回滚：加 `--apply`。返回 `200 {"ok":true}`。
4. 验证：`node $skill/studio-config-verify.mjs <重新构造的期望文件> --origin $origin --backup backup.json`；最简验证 = 再跑一次 get 存 after-rollback.json，与备份 `.config` 深相等。
5. 回退后新开会话即恢复；已存在会话下次装配也回到回滚配置。

## 配完如何新开会话验证（每个流程的第 6 步展开）

在目标预设下**新开**一个会话（001 坑⑦：新开会话是最干净的验证路径），逐条核对：

1. **花名册**：主代理 `studio_list_subagents` 能列出 `children`（行格式 `id — name：note（模型 provider/model · 后台 mode）`）；`studio_delegate` 按 id 派得出活、子代理三面按配置生效。
2. **提示词面**：主代理/子代理首轮上下文出现新增/修改的段；复刻的段不缺（漏段 = 复刻不全，回流程 A.2）。
3. **工具面**：子代理/主代理实际可调工具 = 工具集并集；话术让用的工具都在（不在 = 坑①，guard 会拦「工具 … 被排除：… 不在该子代理装载的工具集里」）；机制工具 `run_code`/`structured_output` 恒可用。
4. **技能面**：`<available_skills>` 目录只含技能集并集；项目级技能在目标仓可见（坑⑥）。
5. **绑定零影响**：另开未改绑定的预设会话（如 wshell-standard/cordis/ptc），确认与改前一致。
6. **后台行为**：`always-background` 子代理派活立即返回 `subagentId`（用 `send_message` steer，别丢给 job_output，坑⑬）；`foreground` 等结果。
7. 排障兜底：设 `DSH_AGENT_STUDIO_TRACE=<文件>` 装配期逐行落盘（第一诊断位）；host 日志 `[agent-studio]` 前缀；GET /observation 核对实际投递。
