# 提示词与 Agent 人设方案 · 索引与跨厂商敏感度对照（2026-10）

> 为什么分五套：**不同 LLM 对提示词的敏感度不一样**——同一句「用 JSON 输出」、同一段人设、同一个 temperature，在 DeepSeek / GLM / MiniMax / Kimi 上的效果可以相反，甚至在同厂商不同代际之间也相反。本索引把差异压缩成可查的矩阵，五份手册负责给证据与模板。
> 定稿日期：2026-10-20。检索方式：厂商官方文档站 / 官方 GitHub / 模型卡 / arXiv 论文为主源，社区横评与源码级 harness 分析为副源；每条标证据等级。
> 安全约定：本文所有形如〈think〉〈｜begin of sentence｜〉的全角尖括号是**排版保护写法**，绝不能把它们的半角形式写进提示词（见 §5 第一条坑）。

---

## 1. 五套方案

| 方案 | 文件 | 一句话定位 |
|---|---|---|
| 通用底座 | [prompt-playbook-universal-agent-2026.md](file:///E:/work/sp/JwikisSkills/docs/report/prompt-playbook-universal-agent-2026.md) | 不分厂商都成立的写法：人设九块结构、persona 实证否定「专家人设」、规则条数 10 条阈值、矛盾审计、2026「规则变少上下文变好」的硬数据 |
| DeepSeek | [prompt-playbook-deepseek-2026.md](file:///E:/work/sp/JwikisSkills/docs/report/prompt-playbook-deepseek-2026.md) | system 态度三年翻三次车的来龙去脉；**思考模式静默旁路采样参数**；JSON 必须双写；带 tools 必须回传 reasoning_content 否则 400 |
| GLM | [prompt-playbook-glm-2026.md](file:///E:/work/sp/JwikisSkills/docs/report/prompt-playbook-glm-2026.md) | **提示词最讲究「短、显式、机械精确」的一家**；思考开关按代际分三种模式；`tool_stream` 漏传就完全不返回 tool_calls；中文提问漂英文输出 |
| MiniMax | [prompt-playbook-minimax-2026.md](file:///E:/work/sp/JwikisSkills/docs/report/prompt-playbook-minimax-2026.md) | 精确指令遵循最强的一家（IFBench 独立榜 82.9%）+ 官方自己仍在用强禁令块；**交错思考=训练期假设**，丢思考块会 state drift；结构化输出**不靠 strict schema**（官方不保证），靠工具参数承载 |
| Kimi | [prompt-playbook-kimi-2026.md](file:///E:/work/sp/JwikisSkills/docs/report/prompt-playbook-kimi-2026.md) | **采样参数全部锁死，提示词是唯一杠杆**；官方三句人设铁律（角色/流程/边界进 system，参数进 schema）；「K2 不支持 system」传言已被证伪 |

调研证据库（不进 git，供追溯）：`.temp/research/prompt-2026-10/` 与 `.temp/research/ds/`，含 130+ 份官方原文快照、72 条带日期与等级的引用。

---

## 2. 敏感度对照矩阵（六个维度）

### 2.1 你能改什么：参数可改性（差异最大的一维）

| | temperature | top_p | 惩罚系数 | 结论 |
|---|---|---|---|---|
| **DeepSeek** | 默认 1.0，范围 0–2；官方分场景表：代码/数学 **0.0**、数据分析 1.0、对话/翻译 1.3、创意 **1.5**。**思考模式静默忽略 temperature / presence / frequency**（"will not trigger an error but will also have no effect"，A） | flash 仅思考生效且区间 0.95–1.0；v4-pro 思考时忽略（带 tools 固定 0.95） | **整体 deprecated**，传了不生效（A） | 开了思考就忘掉采样，控长度只有 `reasoning_effort` + `max_tokens` |
| **GLM** | 范围 **[0.0, 1.0]** 且**限两位小数**；分代默认值不同：4.5=0.6、4.6+=1.0；官方明文 **temperature 与 top_p 不要同时调**（A） | 默认 0.95，[0.01, 1.0] | — | 想更稳可复现还有 `do_sample=false` 这个别家没有的开关（A） |
| **Kimi** | **固定不可改**：思考 1.0 / 非思考 0.6，传其他值**报错**；官方"建议不要显式传入"；范围 [0,1]（OpenAI 是 [0,2]）；temp≈0 时 `n>1` 报 `invalid_request_error`（A） | **固定 0.95** | — | **杠杆全在 prompt 与工具 schema**；社区口径："把它们当 API 的一部分，永远别碰"（C） |
| **MiniMax** | 官方推荐**只有一套、不分场景**：temp 1.0 / top_p 0.95（A）。**2026-10 快照：M3.1 / M3 传了不生效，服务端固定 1 / 0.95**（A）；官方 **[0,2] 超范围报错**，部分渠道限 0–1（跨网关须实测，A）。**「编码/推理/创意分档温度」是 abab 时代百炼文档的遗产，M 系列无此口径** | M3=0.95 / M2.x=0.9 | `top_k`、`stop_sequences`、`presence_penalty`、`frequency_penalty`、`logit_bias` **被忽略**（A） | 别用 `stop` 收口工具输出；本地部署官方口径 temp 1.0 / top_p 0.95 / top_k 40 / **repeat penalty 1.0 或禁用** / min_p 0.01（A/B） |

> 跨家红线：**照抄 OpenAI 的 1.5 / 2.0 到 Kimi 或 GLM 会直接报错**（A）。迁移第一步是删掉所有显式采样参数，再按各家表逐个加回。

### 2.2 谁听 system prompt：官方态度与产品行为

| | 官方支持度 | 官方产品自己怎么写 system | 人设长度倾向 |
|---|---|---|---|
| DeepSeek | 完全支持（2024-05-17 官方专门优化 system 指令遵循；R1-0528 起思考模型也支持；V4 时代 **Chat 格式还能中途插 system 消息**，A） | **两行**："该助手为DeepSeek-R1，由深度求索公司创造。今天是{current date}。"（A）；现行网页版仅日期+位置+search 工具声明（A） | **越短越像官方**。官方口径"复杂冗长的提示往往效果不佳，应注重清晰而非复杂"（B） |
| GLM | 官方文档支持，并把 system 定为**唯一指定的人设/规则载体**（含"在系统消息中定义期望的 JSON 结构"，A） | **chat.z.ai 与 API 均不注入任何 system prompt**（"GLM serves no system prompt — verified & documented"，A）——人设**完全由调用方负责** | 短、显式、机械精确；泛化指令是负资产（B，Cline 实测 −57% 字符后成功率升） |
| Kimi | 官方全程用 system（模型卡、API 文档、教程一致），并给出「system 只带 tools 不带 content」的动态加载新用法（A） | **数千字分块长文**（K3 官方 agent，反引号伪标签分块，A/C 泄漏样本） | 长 system 派，但官方同时明令"不要把工具能做的重复写进冗长 system prompt"（A） |
| MiniMax | 支持；早期 `role_setting` 类人设 API 见对应手册核实 | 开源权重默认 system 仅一句 "You are a helpful assistant. Your name is MiniMax-M2.5…"（A）；**官方 agent 用 `⚠️ CRITICAL MANDATORY RULES` + RULE 0/1/3/4 + `VIOLATION = CRITICAL FAILURE` 强禁令块**（A/C） | **强语气禁令派**——与 Anthropic「给判断不给禁令」正好相反，值得注意 |

**关键区分（三家都踩过）**：**「官方能力支持 system」≠「官方产品注入 system」**。GLM 是极端例子：文档支持、产品不注入。做跨家对比时把这两件事混述会得出完全错误的结论（A + 矛盾记录见 §7.3）。

### 2.3 思考开关：2026-10 同代并存**至少七种拼写**

`enabled/disabled`、`enable_thinking`、`thinking_mode`、`clear_thinking`、`reasoning_effort`、`output_config.effort`、`chat_template_kwargs.thinking`（A/B）。**这是跨家迁移最容易静默失效的地方。**

| | 写法 | 能不能关 | 档位 |
|---|---|---|---|
| DeepSeek | `extra_body={"thinking":{"type":"enabled/disabled"}}`；Anthropic 格式 `{"reasoning":{"effort":"none/low/high/max"}}`（none=关）；V4 顶层 `reasoning_effort` | 可关 | low / high / **max**（默认 high）；官方用法口径："low for simple tasks, high for daily Agent workflows, max for complex tasks"（A） |
| GLM | `thinking={"type":"enabled"}`（4.5+）；自托管 `chat_template_kwargs.enable_thinking` | **4.7 / 5.3 / 5.3-Flash 强制思考，传 disabled 报错**；4.5/4.6/5/5.1/5.2 由模型自动判断 | `reasoning_effort`（5.2+）：max（默认）/ high / low，**5.3 系只此三档，传其他值报错**（A） |
| Kimi | `thinking={"type":"enabled"/"disabled"}`；本地 `chat_template_kwargs={"thinking": false}` | K2.6 可关；**K3 只能调档不能关** | K3 顶层 `reasoning_effort` low/high/max（默认 max）；**中途换档破坏前缀缓存，官方要求会话开始就定档**（A） |
| MiniMax | `thinking.type = auto / adaptive / disabled`；opencode 侧对 `minimax-m3` 用 `thinking_mode:"disabled"`；M3 另有 `output_config.effort` | **M2.x 关不掉；M3.1-Flash 传 disabled 返 400**；M3 默认关需 adaptive | M3 effort 默认 max（A） |
| 参照（Qwen） | `/think`、`/nothink` 逐轮软开关 | 可 | 官方明说"the model will follow the **most recent** instruction in multi-turn conversations"（A） |

> 附带崩法（跨家一致，A/B）：推理模型的 `max_tokens` 是「思考 + 答案」**总预算** → `content` 空、`reasoning_content` 很长、`finish_reason="length"`、**HTTP 仍 200**。必须三查 `finish_reason` + `content` + `usage`，不能只看返回码。社区点名"给推理模型写死 max_tokens 是反模式"（C）；真实事故：DeepSeek V4-Flash 一次 post-training 让思考链变长，**调用代码一行没改就把写死 `max_tokens=4096` 的老系统打崩**（B）。

### 2.4 工具调用：每家的「静默失效开关」不一样

| 家 | 最容易漏的那一条 | 罚则 |
|---|---|---|
| **GLM** | 流式工具调用要 `stream=True` **且** `tool_stream=True`；阿里云百炼明文"不传 `extra_body={"tool_stream": True}` 则**不返回 tool_calls、工具调用完全不生效**" | 静默不调用（四家里最隐蔽，A+B） |
| **DeepSeek** | 带 `tools` 时**所有**后续请求必须完整回传历史 `reasoning_content`（哪怕那轮没调工具）；官方快捷写法 `messages.append(response.choices[0].message)` | **400 报错**（A） |
| **Kimi** | `choice.message` 必须"**原封不动**"回传（含 reasoning_content）；每个 tool_call 必须有对应 `tool_call_id` 的 tool 消息 | 报错 / 破坏后续工具调用上下文（A） |
| **MiniMax** | `function_call` 已废弃须用 `tools`；`stop_sequences` **被忽略**，Anthropic 兼容层还忽略 `top_k`/`mcp_servers`/`context_management` | 静默不生效（A） |
| **本地部署通用** | 漏 `--enable-auto-tool-choice` + 对应 parser（Kimi `kimi_k2`、DeepSeek V4 `deepseek_v4`）；漏 `add_generation_prompt=True` | "只聊不调"；实测**工具成功率 20% vs 官方 99%+**，根因是引擎参数不是模型（B/C） |

其他跨家事实：

- **并行调用**：Kimi 官方明文支持且"无依赖的工具倾向于并行"，并提醒 `tool_calls` 出现时 `content` 偶尔非空（模型在解释要调哪些工具），**别当错误**（A）；工程共识：**有依赖的调用强行并行比串行更糟**，宿主需自判依赖、限并发、独立超时、处理部分失败（C）。
- **要不要在提示里给工具示例**：Kimi 官方不需要（走 tools description + Formula 四步，A）；社区一致口径是 **description 越具体，误调用/漏调用越少**——"查询天气"远不如"查询某城市的实时天气，当用户询问天气状况时调用"（C）。
- **`arguments` 是字符串不是对象**（全四家）：直接传函数 → `TypeError`；JSON 里常夹换行缩进 → 先 `strip()` 再 `json.loads`；`tool_call.id` 需唯一且回填时逐字符一致（A+C）。
- **`tool_choice` 支持面**：GLM **仅 `auto`**（A）；Kimi k3 支持 auto/none/**required**，K2.6/2.7 不支持 required，且**强制指定单个函数与思考模式互斥（400）**（A）。

### 2.5 结构化输出：支持度按「厂商 × 代际」分级

| 家 | 现状（A 为主） |
|---|---|
| **Kimi** | `json_object` + `json_schema(strict)` 都有，走 **token 级约束解码**，schema 须符合 **MFJS** 方言，官方给 `walle` CLI 自检。稳定性**按模型排序：k2.7-code > k3 > k2.6**；k2.6 已知坑：`$ref` 吐 Markdown 代码块、`oneOf` 被忽略、`partial=true` 输出 schema 外字段 → 官方建议 k2.6 只用简单 schema + 业务二次校验 |
| **GLM** | 支持 `json_object` / `json_schema`（百炼侧 glm-5+ 走严格结构化输出）；社区把它评为"结构化输出/指令遵从首选"（C，观点性） |
| **DeepSeek** | **只有 `json_object` 级**，**不等于 OpenAI 的 strict structured outputs**（LangChain `method="json_schema"` 不支持，B+C）；strict 工具模式要另走 `/beta` 且 schema 须全 `required` + `additionalProperties:false`。**致命细节：设了 json_object 还必须在消息里明说要 JSON，否则无限吐空白符**（A） |
| **MiniMax** | `n` 仅 1；**M 系列官方文档基本不列 `response_format`**，老 `chatcompletion_v2` 的 `json_schema` 只支持 MiniMax-Text-01（A）；第三方托管实测 "Schema-conforming output (json_schema) is **not guaranteed**, so validate the response on your side"（C）→ **要 JSON 就靠工具参数承载 + 业务层二次校验**。<br>⚠️ 更正：社区与横评里流传的「MiniMax 官方明文禁止 thinking 与 json_object 同开」**归属错了**——逐字命中在**腾讯云 MaaS** 的 MiniMax 调用指南（intl product/1300/80636，2026-06-11）**与同一句模板文案的 DeepSeek 调用指南**（product/1823/132248，2026-08-24）里，属 **B 级托管平台条款**，不是厂商规则 |
| 通用 | 各家只支持 JSON Schema **子集**（`pattern` / `format` / 递归 `$ref` / 组合关键字支持度不一），别照搬完整规范（B）；百炼部分模型会**自动降级成普通 JSON 且要求提示里必须含 "JSON" 字样否则报错**（A） |

### 2.6 语言与格式偏好

| 口径 | 结论 | 等级 |
|---|---|---|
| 中文 vs 英文（国产四家） | 中文**不劣于**英文，linux.do 10+ 人一致观感；反差最大的是 Gemini/Grok。**无统一对照实验** | C |
| 极端说法 | "deepseek 中英均衡很多"、"**DeepSeek 不听长 prompt，所以中英文没差别**" | C |
| Kimi 官方 | 明文"**Match the user. Follow their lead on language, depth, and formality**"，并规定中文回复用**全角标点**（，。：；、？！《》——……）→ 官方不主张英文优先 | A |
| GLM 实测坑 | GLM-4.6 "**在中文 Prompt 下偏好输出英文**" → 需在 system 顶部钉死输出语言 | B |
| "英文更强"派 | 只给语料占比推测、无跑分无同题对照 → **营销水文** | D |
| 工程折中（四家都安全） | **英文写结构（Context / Task / Constraints）＋ 中文写内容与输出** | C |
| Token 成本 | 官方换算 1 token ≈ 0.75 英文词 ≈ 1.5 中文字符（GLM 口径）；**DeepSeek 按字节切、中文碎片多** → 跨家比长度必须各自计数 | A+B |
| Markdown / XML / JSON 分工 | 最常被误读的微软+MIT 论文（格式差异约 40% 性能波动、JSON > YAML > 纯文本 > Markdown）**只测了 GPT 系**。正确分工：**组织上下文用 Markdown 或 XML，交付结构化数据用 JSON，且靠 Schema 而非提示词自律** | B+C |
| 谁对标签分块原生友好 | **Kimi**（官方 agent 自己就用反引号伪 XML 分块，A）；**MiniMax**（官方用强语气禁令块，A）；社区对 MiniMax 的 `【】`/`→`/`###` 轻量符号派方向可采纳、省 token 数字不可复核（D） | A/D |
| 单点体感 | DeepSeek 偶尔输出带**中文引号**的 Markdown 代码块导致解析出错，GLM 几乎不会 → 投代码片段选 GLM（**单人样本，待复验**） | D |

### 2.7 长上下文：标称 ≠ 有效，且**失效形态四类不同**

C 级（某团队线上真实压测六款国产模型，2026-07-30，有数值无公开日志，**必须自行复测**）：

| 模型 | 实测稳定上限 | 超限表现 | 建议安全阈值 |
|---|---|---|---|
| DeepSeek-V4-Pro | 315,063 | **约 355k 起「静默丢尾」：内容截断但接口成功、无报错** | ≤310,000 |
| GLM-5.2 | 361,003 | 近 400k 超时、任务中断，**报错明显** | ≤355,000（留 5k buffer） |
| Kimi K3 | 361,670 | 同 GLM，400k 超时红线 | ≤355,000 |
| MiniMax M3 | 359,998 | **官方强锁 320k**，超后质量急剧下降、逻辑断层 | ≤320,000 |
| Qwen3.7-Max / MiMo V2.5 Pro | ~184,000 | 185k **硬拒绝**、错误码，无渐进劣化 | ≤180,000 |

三条可用结论：① 按**实测阈值**而非标称配置；② **DeepSeek 的静默丢尾最危险，必须做末尾完整性校验而不是看返回码**；③ 36 万以上无人稳定承载，只能按章节切片后串行合并。

**lost in the middle 的诚实边界**：原始事实是 U 形曲线（GPT-3.5-Turbo 闭卷 56.1% → 答案固定开头 88.3%；答案埋进 20 篇文档正中时**低于闭卷基线**，B/斯坦福 TACL 2024）；作者自陈只观测到行为、未证明注意力机制解释。**中文模型上的一手实测：没找到**，中文圈全部是英文论文外推（C，口径一致但非实测）。跨家输出侧另有落差：GLM-5.x 最大输出 131072、Kimi 默认 32768、MiniMax M3 524288 → 长文会从「能读进来」变成「**写不出去**」（A）。

---

## 3. 「最小公共子集」：跨四家都成立、可以先写的东西

1. **人设只写姿态与边界，不写能力断言**——「你是世界级专家」被四篇论文一致否定（A，见通用手册 §1）。
2. **规则条数按 10 条封顶做审计**，一条只说一次（A：ManyIFEval 10 条即下降；OpenAI "State each instruction once"）。
3. **上模型前做矛盾审计**——矛盾指令比长指令更致命（A：GPT-5 会烧推理 token 去调和冲突；Anthropic 同观察）。
4. **长数据置顶 → 指令紧随 → 输出契约收尾**（A：Gemini + Anthropic 一致做法；注意 IFScale 显示是**首因偏置**，核心行为约束放最前，尾部只放短格式契约）。
5. **参数优先、措辞让位**：思考预算用 effort 档，不用「think step by step」；长度用 `max_tokens`，不用「写 300 字」（四家官方都警告字数控制不精确：Kimi"指示模型生成特定数量的文字并不具有高精度"、GLM"让模型精确的生成一个特定的字数难以实现"，A）。
6. **格式契约双写**：system 定义 + **末次 user 重申**（社区多人一致，C；OpenAI 官方认可每 3–5 轮重申，A）。
7. **每个模型建一张接入清单**，只写三件事：**思考字段叫什么 / 是否必须回传 / 是否计入预算**。
8. **中途结论外化成显式状态**（清单 / 摘要 / 工单打卡），不要指望模型记住沉在中段的临时结论（B+C）。
9. **提示里禁止出现任何特殊 token 字面量**（见 §5 第一条）。
10. **接入验收第一条：最小 tools 请求必须真拿到 `tool_calls`**，别只看 HTTP 200。

---

## 4. harness × model 交互：公开数据里没有任何外壳跨模型通吃

B 级（源码级分析 + WildClawBench 官方表）：

| 模型 | Claude Code | OpenClaw | Hermes | 最优 |
|---|---|---|---|---|
| GLM 5 | **31.0%** | 42.6% | **46.4%** | — |
| MiMo V2 Pro | 29.9% | 40.2% | — | — |
| MiniMax M2.7 | — | — | — | **Codex** |

> "**同一 harness 对部分模型是放大器，对另一些等于没装**；第一方 Claude Code 对国产开源模型普遍是**负资产**。"（B）

**opencode 是最好的活教材**（B，逐文件源码取证）：`system-prompt/` 下 `kimi.txt` **8.7 KB 完整重写**、`gpt.txt` 2.6 KB、`meta.txt` 7.9 KB、`trinity.txt` 7.7 KB，而 `anthropic.txt` **只有 300 B（append 一条注释密度规则）**——即「**越需要行为矫正的模型，system 越长**」。工具形状也逐模型：只有 `gpt-*`（非 oss、非 gpt-4）拿 `patch`，其余拿 `edit`+`write`。

另一条已验证的交互（B/C）：**Claude Code 的超长 system 会压制 GLM「是否思考」的自动判断**，删宿主 prompt 能触发思考但驱动不了工具，最终靠提示词注入明确告知"需要思考"。

DeepSeek 侧的反向证据（B）：同一 DeepSeek V4 Flash 任务首包 token 为 opencode 8,084 / DSH 7,626 / pi 1,744，**三者都能完成任务** → 长 system 对 DeepSeek 不致命，但会变成每次 prefill 的固定成本。

**选型口径**（B）：接国产四家想「开箱即用就聪明」→ 选有**逐模型 prompt** 的框架；要天花板 → 自己配 compat（DSH 路线：一套模型无关 prompt + `compat` 配置决定 system 放哪个角色、哪个字段限输出、budget 字段名、等级→wire 拼写）。**换外壳后必须重测自己的模型。**

---

## 5. 跨厂商踩坑表（按危害排序）

| # | 坑 | 表现 | 规避 | 等级 |
|---|---|---|---|---|
| 1 | **把特殊 token / 模板标记写进提示** | DeepSeek 对话框输入〈｜begin of sentence｜〉、〈｜sft begin｜〉或裸〈think〉就**吐出毫不相干内容、每次刷新不同**（快速模式复现 100%）；字面串被 tokenizer 还原成**真 token id**，等于把模型送回"训练样本刚开始、用户还没提问"的位置；低资源 token 在嵌入空间行为类似特殊 token。DeepSeek 最典型（中文词表碎片多），**四家通用** | prompt、示例、few-shot 里禁止出现任何〈\|…\|〉、〈think〉字面标记；要讲格式就**描述、不要演示原始 token** | A（多源机制一致）+B |
| 2 | **看返回码判断成功** | 思考吃满预算 → `content` 空但 HTTP 200；DeepSeek-V4-Pro 长输入**静默丢尾** | 三查 `finish_reason`+`content`+`usage`；做末尾完整性校验；不要简单 ×2 重试（持续放大费用与等待），降 effort 或改用 `max_completion_tokens` 类字段 | A+B+C |
| 3 | **GLM 漏传 `tool_stream`** | **完全不返回 tool_calls**，无报错（四家最隐蔽） | 验收第一条：最小 tools 请求必须拿到 tool_calls；把引擎参数写进部署清单 | A+B |
| 4 | **DeepSeek 带 tools 不回传 reasoning_content** | 400 | 整体 append 官方返回的 message | A |
| 5 | **思考模式配采样参数** | DeepSeek 静默失效；MiniMax 2026-10 快照下 temp/top_p **传了不生效**；GLM-5.3/4.7、Kimi-k3、MiniMax-M2.x / M3.1-Flash **根本关不掉**（M3.1 传 disabled 返 400） | 迁移前先测「参数是否被忽略」：同 prompt 同参数跑两次看方差；官方口径是 **"lower the effort level rather than trying to disable thinking"**（A） | A |
| 6 | **`json_schema` 支持度按模型/网关分级** | Kimi k2.6 `$ref` 吐代码块、`oneOf` 忽略；DeepSeek 无 OpenAI 级 strict；百炼部分模型自动降级且要求提示含 "JSON" 字样否则报错 | 强约束优先用 **function 参数**而非 `response_format`；业务层永远二次校验；换供应商先读它的 supported-schemas 子集 | A+B |
| 7 | **system 角色被降级 / 模板把 system 当 user 发** | 有教程断言"GLM-4 不支持 system role 需并入 user"，**与智谱官方文档矛盾**（疑为旧 chatglm3 模板或某网关行为）；system 插到 user 之后被当普通轮次、约束完全不执行 | **抓一次实际 HTTP body 确认角色**；别信二手教程；把「官方能力」与「官方产品默认行为」分开 | A+D（矛盾记录） |
| 8 | **prompt cache 被动态 system 打穿** | system 里写动态时间 → 缓存大面积失效；命中要求前缀（system+固定文档）**≥256 tokens** 且与上次相同 | 日期/会话 id 移到 **user 末次消息**，或用 `prompt_cache_key` / `X-Session-ID`；Kimi 另要求 **effort 档位会话内不变** | B+A |
| 9 | **EOS / 终止符配置不一致** | 开源权重 `config.json` 的 eos_token_id 与 `tokenizer_config.json` 的半角 im_end 打架 → 微调或本地部署后**输出停不下来**；MiniMax 侧 `stop`/`stop_sequences` 被忽略 | 本地先看 tokenizer 配置；不依赖 stop 收口，改由结构化字段与轮次判断 | B |
| 10 | **协议路径/参数支持面靠 OpenAI 文档外推** | `wire_api="responses"` 指向 moonshot base_url 会请求不存在的 `/v1/responses` → 必然 400；MiniMax Anthropic 兼容层忽略 `top_k`/`stop_sequences`/`mcp_servers`/`context_management` | 以厂商自己的「迁移/兼容性」文档为准 | A+C |

---

## 6. 怎么自己验证（社区可复用的横评方法学）

社区整理、方法可直接复用（C）：

> 固定**同一 system、同一工具权限、同一最大轮数**，用**自家 20 个真实任务**，**跑两轮以上**，记录四项：**一次通过率、人工返工分钟、总 token、失败类型**。

补充三条：

- 长上下文评估要把**同一证据随机放在不同位置**、配**不同干扰长度**；并**区分标称与有效上下文**（C，面经含标准答案口径）。
- 「哪家对 system 最严格」**目前没有直接对照实验**，只有 IFBench 类间接证据（见 §7.1）——别信任何「X 家 system 服从率 Y%」的精确数字。
- 换模型后做**规则删除实验**（OpenAI 官方方法："one group at a time, then rerun the same evals"）：这是唯一能把「这条规则还有必要吗」问出答案的动作（A）。

---

## 7. 证据边界（什么不能当结论用）

### 7.1 「谁指令遵循最强」只有间接证据
- **MiniMax 领先**：IFBench 独立评测 MiniMax-M3 = **82.9%**（并列全球第 2，B）；厂商自报 M2.5/M2.1 = 70.0，高于 Claude Opus 4.6 的 53.0（A 但**厂商自报**）。
- **Kimi 偏弱**：国内第三方通用测评中 Kimi-K2.5-Thinking「精确指令遵循」仅 **24.45**（B，**正文未取到，仅检索摘要**）。
- DeepSeek / GLM **缺同口径公开分数**。
- 交叉含义：**Kimi 长文读得准，但精确指令遵循偏弱——「读得长」与「守得住格式」必须分开选型**（A+B）。

### 7.2 榜单列名歧义（已踩）
DataLearner 带 `?benchmark=IFEval` 与 `?benchmark=τ²-Bench` 返回首列数值**完全一致**，实际表头是 HLE / ARC-AGI-2 / FrontierMath / SWE-bench / τ²-Bench，**没有 IFEval 列** → 本轮**未采用其中任何"IFEval 数字"**。

### 7.3 「官方能力」与「官方产品行为」不可混述
GLM 是否支持 system role 存在**矛盾记录**（官方文档支持 vs 教程称需并入 user）。真相是两件事：文档支持 system role（A）；GLM 自家产品与 API **不注入** system（A）。

### 7.4 「关思考后格式更容易崩」缺跨厂商同题实验
官方只给机制事实（参数被忽略 / 强制思考 / **思考档不能靠采样参数救**）。已核到的一手崩法只有两种：reasoning 吃满预算导致 `content` 空（多例）；长宿主 prompt 抑制 GLM 思考判断（1 例动手验证）。

### 7.4b 托管平台条款 ≠ 厂商规则（本轮抓到并更正的一例）
「不建议同时开启 `thinking.type=enabled` 与 `response_format.type=json_object`」这句话在横评阶段被记成 **MiniMax 官方冲突条款**，逐字复核后发现它出自**腾讯云 MaaS 自家指南**，且**同一句模板文案同时贴在 MiniMax 与 DeepSeek 两份调用指南上**（B）。→ 教训：**参数兼容性条款必须先确认文档归属方**（厂商 API 参考 / 兼容层 / 托管网关），走哪家通道就按哪家的文档；把平台条款当厂商规则会误导跨家迁移。同类已知项：「GLM 不支持 system role 需并入 user」也是教程层与官方文档矛盾的记录（§7.3）。

### 7.5 内容农场的精确百分比一律抛弃
反复出现但无可复核原始数据：「system 超 120 字后服从率降 40%」「system 最佳 80–150 字」「省 18–34 token」「带 system 0% / 无 system 23% JSON 错」「GLM-4.7 英文低 0.15 CodeBLEU」「成功率 94.9%」「47% 识别率、83% 截断」。
→ **只采纳与官方文档同向的定性建议**（如 m.php.cn 群三条定性可取：system 只写身份与边界别写任务描述、动词短句优于礼貌修饰、`tool_call_id` 逐字符一致），**数值全部抛弃或自行重测**。

### 7.6 英文社区一手帖不可达（本机限制，已如实记录）
Reddit / Twitter / 小红书专用后端本机不可用（agent-reach CLI 未装、huggingface.co 不可达、curl 直连 000）；Reddit 侧只有二手转述，**r/LocalLLaMA 关于四家开源权重 agent 经验的原帖未能直接核对**；Hacker News 未找到关于这几家 prompt 模板的一手实操长帖。可复核的二手：note.com（2026-07-05）整理的 X / r/LocalLLaMA 趋势 + 自带 100 请求/模型实测——小模型工具调用**原生成功率 0%，加 Tool Call Repair 层后 3 款 0%→100%**；phi4-mini 残余 20% 是 arguments 内容本身错，**故意不修**（错参数被执行比不调用更危险）。**该数据针对本地小模型而非四家旗舰，只可借其「修复层 / 回退层」机制思路。**

### 7.7 泄漏 prompt 的使用边界
Kimi K3（≈36 KB）、MiniMax 海螺/M2.5、Claude Code 等**属泄漏内容，不可照抄进产品**，价值在**结构范式**（分块顺序、"When to Use / When NOT to Use"、`select_tools` 按需加载、`<meta awareness>` 区分主动指令与被动背景、引用格式 `[^N^]`）。可合法照抄的是各家**公开文档骨架**：Kimi `use-kimi-api-to-complete-tool-calls` / `response_format`、DeepSeek `guides/thinking_mode`（思考+工具交错完整可运行样例）、GLM 对话补全（tool_stream 双开关）、MiniMax 官方工具调用指南，以及 DeepSeek 官方提示词库（13 类含自定义人设，A）。
另注：**opencode 的逐模型 system-prompt 文件是第三方开源、非厂商官方**（B），是目前最现成的「给 Kimi/GLM 写 agent prompt 该怎么写」抄本来源。

### 7.8 思考开关拼写是**快照而非契约**
七种拼写同代并存、各家按代切换（§2.3），本矩阵写法是 **2026-10-20 快照 + 待实测**，不可当稳定契约引用。

---

## 8. 一句话选型速查（按任务，不按名次）

| 任务 | 首选考虑 | 依据 |
|---|---|---|
| 严格格式 / 精确指令遵循 | MiniMax（IFBench 82.9 独立榜）→ Kimi strict json_schema（token 级约束）→ GLM | B / A |
| 长文档读取 + 引用 | Kimi（1M、每文件独立 system、Partial Mode 续写、分块递归摘要官方策略） | A |
| 编码 agent（自托管/接第三方框架） | GLM（短显式机械精确指令 + Cline 实证；结构化输出社区首选）；代码块纯净度单点偏好 GLM | B / C / D |
| 性价比 + 双模式自由切换 | DeepSeek（思考可开关、effort 三档、1M 默认、官方 App 人设极简范式） | A |
| 参数不想调、只想写提示词 | Kimi（采样参数锁死，行为完全由 prompt 决定） | A |
| OpenClaw / agent 场景 | 社区榜单口径优先 GLM-5.1 / DeepSeek V4 Pro / Kimi K2.6（转载+榜单，部分口径缺项） | C |

> 最后一条跨家原则：**不要跨代套用任何技巧**。四家都在按代切换思考开关、参数默认值与工具格式，本索引的每一行都带代际标注；换代必重测。
