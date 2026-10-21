# MiniMax 提示词与 Agent 人设方案（2026-10）

> 适用范围：`MiniMax-M3.1-Flash`（2026-10-19 起主推）、`MiniMax-M3`，以及仍在使用中的 M2.x 资产与本地部署权重。
> 定稿日期：2026-10-20。证据基线：MiniMax 官方文档（platform.minimaxi.com / platform.minimax.cn）、GitHub MiniMax-AI/*、技术报告 arXiv:2605.26494、官方博客。
> 写作约定：文中〈think〉〈/think〉〈mm:think〉〈invoke〉〈parameter〉等**全角尖括号是排版保护写法**，真正放进提示词或代码时必须替换成 ASCII 半角。这条约定在本手册尤其重要——见 §9 第一条反模式，字面的思考标记本身就会破坏输出。
> 证据等级：**A** = 官方一手；**B** = 官方原文的第三方镜像 / 合作伙伴（含云平台）文档；**C** = 媒体、模型市场卡片、社区复盘；**D** = SEO 农场。
> 调研证据：`.temp/research/prompt-2026-10/minimax.md`（§0–§2.2 完整）+ `raw/` 内 MiniMax/M2 快照。M2.7–M3.1 部分章节由主线补齐，凡属未逐字核到的均已标注。

---

## 0. 版图：M2 时代已成历史，新代码按 M3.1-Flash 写

| 日期 | 事件 | 证据 |
|---|---|---|
| 2025-06-16 | **MiniMax-M1**：首个开放权重的大规模混合注意力推理模型，1M 上下文，**40K / 80K 两档 thinking budget** | A arXiv:2506.13585；GitHub MiniMax-AI/MiniMax-M1 |
| 2025-10-27 | **M2** 发布并开源（230B 总参 / 10B 激活）。官方博客标题中文《大巧若拙》、英文《Ingenious in Simplicity》 | A minimax.io/news/minimax-m2 |
| 2025-12-22 | M2.1（多语言编程） | A release-notes/models |
| 2026-02 | **M2.5**：SWE-Bench Verified 80.2%；官方称模型自发形成 "spec-writing tendency"；**并行工具调用使端到端耗时 31.3 → 22.8 分钟** | A GitHub MiniMax-AI/MiniMax-M2.5 |
| 2026-03-18 | **M2.7**：自我进化、原生 Agent Teams、**40+ 复杂技能下 97% skill compliance** | A GitHub / news/minimax-m27-en |
| 2026-05-26 | 技术报告《The MiniMax-M2 Series: Mini Activations Unleashing Max Real-World Intelligence》（arXiv:2605.26494，v2 2026-07-30）：229.9B 总参 / 9.8B 激活、192K 窗口、29.2T 预训练 token、62 层、256 专家取 8、**Forge agent-RL 系统** | A |
| 2026-06-01 | **MiniMax-M3**：原生多模态、约 428B 总参 / 23B 激活、自研 MSA 稀疏注意力、**1M 上下文**（arXiv:2606.13392；06-12 开源） | A |
| **2026-10-19** | **M3.1-Flash（当前主推）**：官方定位「一个面向真实工作的日常高效主力模型」，1M 上下文、**思考常开**、`effort` 可调、200+ TPS（P50 170+）、输入 ¥1 / 输出 ¥4 / 缓存读 ¥0.1 每百万 token，**Agentic 综合成本较前代降 70%** | A www.minimax.cn/blog/minimax-m31f |
| 2026-10-19 | **M2.5 / M2.7 停止向新用户开放，2026-11-18 正式下线**；套餐侧原模型名保留为兼容入口并**统一路由至 M3.1 Flash**。M2 / M2.1 / M2.5 / M2.7 / M2-her 均已列入「历史模型（已下线）」 | A docs/faq/models |

> ⚠️ **M3.1 开源权重截至 2026-10-20 未发布**：博客说"will release weights later"，`MiniMax-AI` 下 M3.1 仓库仍 404（C）。本地部署仍只能到 M3 / M2.5。

**结论**：M1/M2 时代的提示词资产**仍必须学**——交错思考的回传纪律、官方默认 system prompt 范式都写在已下线模型的文档里；但新代码一律按 M3.1-Flash / M3 的字段面写。

---

## 1. 官方提示词规则 13 条（A，逐字）

| # | 规则 | 官方原文（逐字） | 出处 |
|---|---|---|---|
| 1 | **协议面决定提示词上限**，Anthropic 兼容是默认推荐路径 | 「Anthropic 兼容（推荐）：支持 thinking 块、interleaved thinking 等高级特性，是默认推荐路径。」 | docs/guides/text-generation |
| 2 | 官方只给**两个杠杆**：推理参数 + 系统提示词 | "we suggest focusing on two key points: Inference Parameters and the System Prompt." | M1 README §3 |
| 3 | 系统提示词**按任务定制**，通用任务就用最短 | "Tailoring your system prompt to the specific task is crucial"；通用场景只写 `You are a helpful assistant.` | M1 README §3.2 |
| 4 | 数学/推理题的格式约束写进 system | `Please reason step by step, and put your final answer within \boxed{}.` | M1 README §3.2-C |
| 5 | Web 出码场景官方给的是一条**具体行为契约**（单代码块 / 可运行 artifact / 生成后自检 / 只输出 HTML / UI 现代美观），而非泛泛人设 | 见 §8 模板 ③ | M1 README §3.2-B |
| 6 | 工具型 agent 的通用 system **只需两条**：每轮检查可用工具 + 严格遵守 policy | "- In each round, you need to carefully examine the tools provided to you to determine if any can be used. - You must adhere to all of the policies. Pay attention to the details in the terms. Solutions for most situations can be found within these policies." | M1 README，TAU-bench methodology |
| 7 | M2.x 官方默认 system prompt 就**一句话**（身份 + 厂商） | `You are a helpful assistant. Your name is MiniMax-M2.7 and is built by MiniMax.`（M2.1 / M2.5 / M2.7 同构） | GitHub 各 README「Inference Parameters」 |
| 8 | 交错思考是**训练期机制**，不是提示词技巧；用户侧唯一职责是**别把上下文弄断** | "We adopt interleaved thinking as a first-class agent modeling principle" | arXiv:2605.26494 §7.1 |
| 9 | 官方 Pro Tip：**上下文即记忆** | "Pro Tip for M2 Users: Because M2 relies on Interleaved Thinking, its context is its memory. For best performance, you must retain the full session history, including the thinking steps." | EN 平台 docs/guides/text-m2-agent-generalization（M2 对齐团队署名） |
| 10 | **按需思考**：简单工具调用可能没有思考块；解析先判空，但**一律完整回传** | 「解析时请先判断字段是否存在，无论本轮是否包含思考内容，都需要完整回传模型返回的消息。」 | docs/guides/text-m3-function-call |
| 11 | 官方 agent 系统提示词的写法 = 分类小节 + **短命令式 bullet**，且要求话术本身简短 | "Be concise but thorough in responses"；"Don't guess - use tools to discover missing information"；"Stay focused - stop when the task is fulfilled" | MiniMax-AI/Mini-Agent `mini_agent/config/system_prompt.md` |
| 12 | **静态内容前置、动态内容后置**（缓存前缀顺序 = 工具定义 → 系统提示词 → 历史对话） | 「在对话的开头部分放置静态的或重复的内容（包括工具定义、系统提示词，历史对话内容），将动态的用户信息放在对话的最后，以最大程度利用 cache」 | docs/api-reference/text-prompt-caching |
| 13 | 角色扮演：**用 system 定义 AI、`user_system` 定义用户**，示例对话给 1–3 条即可 | 「通过 `sample_message_user` 和 `sample_message_ai` 提供 1-3 个示例对话，可以有效引导模型的回复风格。」 | docs/guides/text-chat |

### 1.1 一条需要纠正的流行印象（诚实记录）

**「MiniMax 官方明确说不要写冗长复杂提示词」——这句话在任何官方文档 / 技术报告 / README 中都未找到逐字表述，不可作为官方规则引用。**

最接近的四条官方证据（都是间接的）：

1. M2 发布博客标题《大巧若拙》/《Ingenious in Simplicity》——讲的是**模型设计哲学**（小激活量换大能力），不是提示词写法；
2. 官方默认 system prompt **全部是一句话**，官方 agent（Mini-Agent）系统提示词全文仅约 1KB 的短命令式清单；
3. 官方反复强调**具体、可执行、带验收语义**的指令（规则 5、6、11），而非长人设；
4. 官方明确划出提示词的能力边界（M2.7 博客，A）：

   > "role boundaries, adversarial reasoning, protocol adherence, and behavioral differentiation — these **cannot be achieved through prompting alone** and must be internalized as native capabilities of the model."

→ 手册的正确写法是：「官方实践范式指向简短具体的指令，并把行为边界视为模型原生能力」，**不要写成官方禁令**。

---

## 2. 招牌机制：交错思考（Interleaved Thinking）

这是 MiniMax 与其他三家最不同的地方，也是唯一需要你在 harness 侧配合的机制。

### 2.1 官方形式化定义（A，arXiv:2605.26494 §7.1）

> "we adopt interleaved thinking as a first-class agent modeling principle: the model **alternates between explicit deliberation and tool execution within a single trajectory**, carrying the full reasoning state forward across turns."

生成协议：`tau = (r1, a1, o1, r2, a2, o2, ..., rT, aT, oT)`，其中 `o_t` 是工具输出，每段推理 `r_t` 以完整历史为条件。

官方明确点名两种**被否决**的做法（这正是很多接入方在犯的错）：

1. **front-loaded reasoning**（一次性想完再执行）——"preventing adaptation to intermediate observations"；
2. **stateless per-turn reasoning**（每轮剥掉推理段）——"preventing the model from building on earlier analysis"。

### 2.2 推理状态持久化：唯一的工程职责（A）

> "The key architectural decision enabling interleaved thinking is that **the complete model output from turn t —including all thinking blocks—is appended to the message history and provided as context for turn t+1**."

丢弃后的退化与后果（A，逐字）：`H(drop) = H ⊕ [assistant(a_t)] ⊕ [tool(o_t)]` →

> "forcing the model to re-derive context, constraints, and partial conclusions at every turn, leading to **cumulative state drift and degraded self-correction**."

OpenAI SDK 文档侧的同一要求（A，逐字）：

> "Important reminder: To make Interleaved Thinking take effect and prevent the model's chain of thought from being broken, **the complete response_message — including reasoning_content — must be kept in the Message History and passed back on the next call**. Only this unlocks the model's best performance!"

Anthropic 兼容路径（A，2026-09 版原文）：

> "When the response contains a thinking content block, these content blocks should be **preserved as-is in subsequent turns**, especially in tool-calling conversations."

第三方转述官方称回传可带来高达 **35%** 收益（C，datalearner 转述，原始出处未核到官方一手）。

### 2.3 Plan-Act-Reflect 环（A）

> "(1) **Plan** —the model reviews accumulated state from prior reasoning and observations, then formulates or refines a strategy; (2) **Act** —the model selects and executes a tool call grounded in the plan; (3) **Reflect** —the model evaluates the observation against expectations, updates its world model, and determines whether to revise the plan or proceed."

收益三条：self-correction、sample efficiency（复用假设与中间结论）、debuggability（可读推理轨迹）。

**人设层面的含义**：不要在 system 里写「先规划再执行」的步骤咒语——MiniMax 把 Plan-Act-Reflect 做成了训练期机制；你在 system 里要写的只有**验收语义**（什么叫完成、什么时候停）。

### 2.4 思考标记在四种协议里的样子

| 通道 | 思考内容位置 | 备注 |
|---|---|---|
| M2 README（原始格式） | 模型输出用「尖括号 think 开/闭标签」包裹思考内容 | 用户侧**不要删除**（见 §9 第一条） |
| OpenAI 兼容 + `reasoning_split=true` | 思考被移到 **`reasoning_content`** 字段 | `false` 时 content 保留标签；**M3.1 不支持 `false`**（A） |
| Anthropic 兼容 | `type="thinking"` 的 content block | 必须原样回传（A） |
| OpenAI Responses 协议 | `type:"reasoning"` 的 output item（带 effort 字段） | A |
| 本地 vLLM | 需 `--reasoning-parser minimax_m3`；原始标记为〈mm:think〉 | 官方 local-deploy-m3 排错表：content 里出现原始〈mm:think〉= **Parser 未开**（A） |
| 本地 SGLang | M2 parser 名 `minimax-append-think` | C |

### 2.5 思考长度怎么控

| 代际 | 官方手段 |
|---|---|
| **M1** | 两档 thinking budget：**40K / 80K**（A，摘要） |
| **M2 / M2.x** | 官方 API **不提供**思考长度参数；**靠提示词控制被实测无效**（issue52，C：写"LOW reasoning mode"不生效，思考吃满 `max_tokens` 导致没有答案）。预算含 `max_tokens`，设太小 → `finish_reason=length` 且 `content` 空（A） |
| **M3** | 开关 `enabled` / `adaptive` / `disabled`；**默认值随协议不同**：OpenAI 兼容省略时**默认开**，Anthropic 兼容省略时**默认关**（2026-09 M3 版），Responses 默认 none（A） |
| **M3.1-Flash** | **思考常开、关不掉**；`effort` = low/medium/high/xhigh/max，默认 max；传 disabled → **400**，原文：`model "MiniMax-M3.1-Flash" requires adaptive thinking`（2026-09 版还记录过错误码 2013，逐字留档，A） |

官方给的方向（A）：**"lower the effort level rather than trying to disable thinking"**——别想着关思考，往下降档。

### 2.6 官方完整往返示例的结构（A，docs/guides/text-m3-function-call）

`user 提问` → **第 1 轮**：`text` + `tool_use`（**这一轮没有 thinking block** —— 按需思考）→ 把 `response.content` **整段**作为 assistant 回传 → `tool result` → **第 2 轮**：thinking block + 最终 text。

---

## 3. 人设（System Prompt）怎么写

### 3.1 官方立场

- system role 在所有协议都标准支持（M1 / M2 / M2.x / Mini-Agent 文档，A）。
- 官方默认 system prompt **就是一句话**（§1 规则 7）。
- 官方 agent 的人设范式 = **Mini-Agent 的 `system_prompt.md`**（A），约 4.6KB 渲染后 markdown，结构是：身份句 → 能力分组 → **技能的渐进披露** → Working Guidelines（短命令式 bullet）→ Communication（"Be concise but thorough"）。
- 官方给的能力边界（A）：角色边界、对抗性推理、协议遵守、行为差异化 **"cannot be achieved through prompting alone"**——想靠人设文段实现这些是徒劳。

### 3.2 MiniMax 的服从度实证（为什么它敢用强禁令）

- **97% skill compliance**，在 40+ 个复杂技能、每个 >2k token 的条件下（A，M2.7 博客）。
- AA **IFBench：M2 自报 72**（A 但厂商自报）；**M3 = 82.9%**（B，Artificial Analysis 独立评测，并列全球第 2）。
- 官方 agent（海螺 / M2.5 侧）人设用的是 **`⚠️ CRITICAL MANDATORY RULES` + `RULE 0/1/3/4` + `VIOLATION = CRITICAL FAILURE`** 的强禁令块，并要求编码/设计/研究写作**必须先调 `deep_thinking`**、"IF IN DOUBT → CALL deep_thinking"、Web 项目必须 playwright 自测后部署再复测。
  - ⚠️ 该文本来自**泄漏库**（C，`asgeirtj/system_prompts_leaks`），**不可照抄进产品**，价值在范式。
  - 有意思的对照：**IFBench 高分的 MiniMax，官方自己仍在用禁令+强语气钉行为**，与 Anthropic「给判断不给禁令」路线相反。两家都对，但适用条件不同：MiniMax 的精确指令遵循能力（82.9）使禁令**真的会被执行**；弱模型上同一套禁令会互相冲突（见通用手册 §3 矛盾审计）。

### 3.3 `role_setting` 这条老记忆的核实结果（A/B/C 混合，结论明确）

早期 MiniMax abab 的「人设 API 参数」**名字不是 `role_setting`**：

- 2026 现行官方文档中**不存在** `role_setting` / `bot_setting` 任何参数（A，逐页核对）。
- 老 `chatcompletion_pro` 端点的人设字段实际是 **`bot_setting` + `sample_messages` + `reply_constraints`**（B/C，第三方 llamafactory 2024、explinks 2025、showapi 2026 镜像）。**「role_setting」这个名字在任何快照与搜索中都未出现，属误记。**
- 老 abab6.5 系列现仅存于**阿里云百炼**渠道且只有免费额度，用尽即不可调用，官方建议转替代模型（B）。
- M1 起人设改由**标准 system role** 承载。
- 2026-10 面向对话场景的角色能力是 **M2-her 高级角色设定**（`user_system` / `group` / `sample_message_user` / `sample_message_ai` + 4 条最佳实践，中文文档含"诸葛亮"式示例）——**但英文 FAQ 已把 M2-her 列入已下线，而中文文档页仍在**（**2026-10-20 实测矛盾**，A）。要用先确认端点可用性。

### 3.4 中文人设的官方技巧（A，docs/guides/text-chat）

- `system` 定义 AI 是谁，`user_system` 定义**用户**是谁（这是别家没有的一个字段概念）。
- 示例对话给 **1–3 条**即可引导回复风格，多了没用。
- 官方文档主体是中文，交错思考、prompt cache、M3 本地部署排错都有中文版；不存在「中文提示不如英文」的官方说法。

---

## 4. 参数与 API 层（这里有个流传很广的误解要拆）

### 4.1 官方推荐值：**只有一套，不分场景**

| 代际 | 官方推荐 |
|---|---|
| M1（评测） | temperature **1.0** / top_p **0.95**（A，README，附理由说明） |
| M2.x | temp 1.0 / top_p 0.95 / **top_k 40**（A，README） |
| M3 | temp 1.0 / top_p 0.95（A） |

**重要更正**：MiniMax **没有**「编码 / 推理 / 创意」分场景的官方温度推荐——官方推荐**永远是同一套 1.0 / 0.95**。「分场景调温度」这个习惯的来源是 **abab 时代在阿里云百炼的文档**（QA/摘要 0.01–0.2；营销文案与人设对话 0.7–1；abab6.5s 默认 0.1，6.5t/6.5g 默认 0.9，B），**不适用 M 系列**。

### 4.2 API 参数现状（注意 2026-09 与 2026-10 快照不一致）

- 2026-09 版：`temperature` **[0,2] 默认 1**；`top_p` M3=0.95 / M2.x=0.9（A）。
- **2026-10 实测快照：M3.1 / M3 的 `temperature` 与 `top_p` 传了不生效，服务端固定 1 / 0.95**（A）。
- **被忽略的参数**：Anthropic 兼容层忽略 `top_k`、`stop_sequences`、`mcp_servers`、`context_management`、`container`；OpenAI 兼容层忽略 `presence_penalty`、`frequency_penalty`、`logit_bias`（A）。
- `n` **仅支持 1**；`function_call` **已废弃**，必须用 `tools`（A）。
- `max_tokens`：**思考 token 计入预算**，设太小 → `finish_reason=length` 且 `content` 为空（A）。普通建议 1024–4096，思考模式 **≥2048**（B）。
- 上下文 **1M** 基线（A），按输入长度**分档计费**（priority 1.5x，A）。M3.1 最大输出 524,288 来自第三方卡片转述（C，未见官方一手限额页），谨慎引用。
- 部分渠道把 temperature 限到 0–1，传 >1 报错 → **跨网关必须实测**（A）。

**落地一句话**：MiniMax 上「带 OpenAI 采样习惯」本身就是反模式——**默认什么都不传**，只传 `effort`。

---

## 5. 结构化输出：一条误归属的更正（重要）

### 5.1 社区/横评里流传的「MiniMax 官方明文禁止 thinking 与 json_object 同开」——**归属错了**

主线已逐字复核：这句话的真实出处是**腾讯云 MaaS 平台文档**，而且是**同一句模板文案同时贴在两家指南上**：

> 「| 思考模式与 JSON 模式 | 不建议同时开启 "thinking.type=enabled"和"response_format.type=json_object"。|」

出现位置：

- 腾讯云 **DeepSeek** 调用指南（product/1823/132248，2026-08-24）
- 腾讯云 **MiniMax** 调用指南（intl product/1300/80636，2026-06-11）

所以它的正确定级是 **B（托管平台条款），不是 A（厂商官方）**，也**不是 MiniMax 独有的冲突条款**。→ **走腾讯云 MaaS 调这几家模型时按它说的做；走厂商自己的 API 时按各厂商文档。**

### 5.2 MiniMax 官方关于结构化输出的真实现状（A/C）

- 老的 `chatcompletion_v2` 里 `response_format` 的 `json_schema` **只支持 MiniMax-Text-01**（官方原文："currently only MiniMax-Text-01 supports this parameter"，A）。
- **M 系列官方文档基本不列 `response_format`**（A，逐页核对）。
- 第三方托管卡片实测："Tool calling and JSON object mode work. **Schema-conforming output (json_schema) is not guaranteed**, so validate the response on your side."（C）

**结论与做法**：MiniMax 上**不要指望 strict schema 约束解码**。结构化输出的承载方式是：

1. **优先用 function 参数**（工具入参天然带 schema，MiniMax 工具调用能力强）；
2. 直接要 JSON 时，**在提示里给字段清单 + 一个示例**（官方规则 5 的「具体行为契约」思路）；
3. **业务层永远二次校验**；
4. 要严格 JSON 又要思考时，**先降 `effort` 而不是关思考**（官方口径），或把「出 JSON」这一步拆成一个**非思考的子调用**。

---

## 6. 工具调用

- **协议面**：OpenAI（`tools` / `tool_calls`，`arguments` 是 JSON **字符串**）；Anthropic（`tools` / `input_schema` / `tool_use` / `tool_result`）；Responses（`function_call` item）。
- **本地原始格式**（要手搓 chat template 才用得上）：
  - M2：官方内部模板写明 "When making tool calls, use XML format to invoke tools and pass parameters:"，结构是〈invoke name=…〉+〈parameter name=…〉值〈/parameter〉〈/invoke〉（A）。
  - M1：JSONL 风格（每行一个 JSON 对象的 function call），另有官方提示："If you need to call tools, please respond with 〈tool_calls〉〈/tool_calls〉 XML tags, and provide tool-name and json-object of arguments"（A）。
- **并行调用**：技术报告用 completion-time reward 显式训练并行与交错（A）；M2.5 实测端到端耗时 **31.3 → 22.8 分钟**（A）；官方 README 示例里一轮含两个〈invoke〉并行（A）。
- **多轮回传**：见 §2.2，完整回传是硬要求；`reasoning_content` / thinking block 判空但要全量透传（A）。
- **`tool_choice`**：官方 API 参考快照里枚举**只有 `auto`**；非官方镜像 minimax-ai.chat 的指南称支持 `auto` 与 `none`（C）。**按 `auto` 写，需要强制时别依赖 `required`。**
- **`stop_sequences` 被忽略** → 「靠 stop 收口工具输出」在 MiniMax 身上不成立（A）。
- 社区排错（C）：`arguments` 常带换行缩进 → 先 `strip()` 再 `json.loads`；校验 `tool_call.id` 唯一；模型 ID **大小写敏感**；"model not found" 有时其实是 tools 格式问题。

---

## 7. 官方反对/告诫（原话）

1. > "Do not remove the〈think〉...〈/think〉part, otherwise, the model's performance will be negatively affected."（M2 README，A）
2. Pro Tip：丢掉上下文是性能差距的根因（A，§1 规则 9）。
3. 技术报告否决 front-loaded reasoning 与 stateless-per-turn 两种做法（A）。
4. **"lower the effort level rather than trying to disable thinking"**（A）——别关思考。
5. `temperature` / `top_p` 传了不生效（2026-10 快照，A）→ 反模式是把 OpenAI 采样习惯搬过来。
6. 提示词做不到角色边界 / 对抗推理 / 协议遵守（A，M2.7）→ 别在人设上堆这类要求。
7. Mini-Agent 的两条："**Don't guess** - use tools to discover missing information"、"**Stay focused** - stop when the task is fulfilled"（A）。
8. `function_call` 已废弃（A）。
9. M3.1-Flash 传 `thinking: disabled` → **400**（A）。

---

## 8. 可直接复制的三个模板

> 以下模板里的全角尖括号必须换成 ASCII 半角才能用；但**绝对不要把〈think〉这类标记写进你给模型的提示文本里**——思考标记只应出现在**模型返回**的内容里（§7 第 1 条 + 通用坑表第一条）。

### 模板 A · 通用任务（M3.1-Flash）

```text
【system】一句话，就按官方默认范式写：
你是{身份，一句话}。由{厂商/团队}提供。
  ↑ 依据：A 规则 7（官方默认 system 就是一句话）+ A 规则 3（按任务定制，通用场景最短）

【user】
{任务，动词开头}
验收标准：{什么算完成——只写判据，不写执行步骤}
输出：{格式 + 字段清单 + 一个示例}
  ↑ 依据：A 规则 5「具体行为契约」+ A 规则 11「Be concise but thorough」
    A §2.3：Plan-Act-Reflect 是训练期机制，别再写「先规划再执行」

【参数】
effort = {low | medium | high | max}     ← A：M3.1 关不掉，只能降档
不传 temperature / top_p                  ← A：2026-10 快照不生效
max_tokens >= 2048（思考吃预算，太小会 content 空）   ← A §4.2
```

### 模板 B · 交错思考 Agent（Anthropic 兼容路径 = 官方推荐）

```text
【system】短身份句 + 两条工具政策（照抄官方 TAU 范式）：
你是{领域}助手。
- In each round, carefully examine the tools provided to determine if any can be used.
- You must adhere to all of the policies. Solutions for most situations can be found within these policies.
  ↑ A：M1 README §3.2/TAU-bench 原文；A：规则 1（Anthropic 兼容支持 thinking 块与交错思考，默认推荐路径）

【循环伪码】
resp = create(system, messages, tools)
messages.append(resp)                    # 整条回传：thinking block 一并带上
                                         # ↑ A §2.2 "the complete model output from turn t —including all
                                         #   thinking blocks—is appended to the message history"
                                         #   判空但不裁剪：A 规则 10「解析时请先判断字段是否存在，
                                         #   无论本轮是否包含思考内容，都需要完整回传」
messages.append(tool_result)
```

### 模板 C · 编码 / Web 出码 Agent

```text
【system 结构，对齐 Mini-Agent 官方范式（A）】
# Identity            一句话身份 + 运行环境事实
# Capabilities        能力分组（技能用渐进披露，不要一次性全塞）
# Working Guidelines  短命令式 bullet：
  - Don't guess - use tools to discover missing information
  - Stay focused - stop when the task is fulfilled
# Communication       Be concise but thorough
↑ A：Mini-Agent system_prompt.md（全文仅约 1KB 的短清单，4.6KB 渲染含技能披露）

【Web 出码场景用官方那条行为契约（A，M1 README §3.2-B）】
单个代码块；产出必须可直接运行的 artifact；生成后自检；只输出 HTML；UI 现代美观。
↑ 注意这是「具体验收语义」，不是「你是资深前端专家」这类人设断言

【官方泄漏样本的范式（C，不可照抄）】
编码/设计/研究写作必须先调 deep_thinking；Web 项目必须 playwright 自测 → 部署 → 再复测。
```

---

## 9. MiniMax 敏感度小结（供索引表引用）

- **对「回传纪律」最敏感**：这是五家里把「上下文即记忆」写成**训练期假设**的一家；丢了思考块不是报错，而是**官方描述为 cumulative state drift**（A）。
- **对格式约束执行力最强**（IFBench 82.9 独立榜，B），因此官方敢用强禁令；但**strict json_schema 官方不保证**（A/C）——「执行力强」≠「支持 schema 约束解码」，两件事必须分开。
- **参数面最「不作为」**：2026-10 快照下 temperature/top_p 传了不生效、penalty/logit_bias/stop 全忽略、n 只能 1（A）→ 与 Kimi 同属「只能靠提示词」阵营，但理由不同（Kimi 是显式禁止传，MiniMax 是静默忽略）。
- **人设最省**：官方默认 system 一句话，官方 agent 人设约 1KB 短命令清单（A）。
- **语言**：中文文档齐全、无「英文优先」官方说法；`user_system` 字段可单独定义「用户是谁」，别家人设层没有这个概念。

---

## 10. 引用清单与存疑

**A（官方一手）**：`github.com/MiniMax-AI/MiniMax-M1`（README §3 Inference Parameters / System Prompt / TAU 方法论 / Web 契约）、`MiniMax-AI/MiniMax-M2`、`MiniMax-M2.5`、`MiniMax-AI/Mini-Agent`（`mini_agent/config/system_prompt.md`）、`MiniMax-Text-01`、技术报告 **arXiv:2605.26494**（§7.1 交错思考形式化）、**arXiv:2506.13585**（M1）、**arXiv:2606.13392**（M3）、`platform.minimaxi.com` docs：`guides/text-generation`、`guides/text-m3-function-call`、`guides/text-m2-agent-generalization`、`guides/text-chat`、`api-reference/text-openai-api`、`api-reference/text-anthropic-api`、`api-reference/text-prompt-caching`、`local-deploy-m3` 排错表、`docs/faq/models`（下线公告）、`www.minimax.cn/blog/minimax-m31f`、`minimax.io/news/minimax-m2`、`news/minimax-m27-en`。

**B**：阿里云百炼 abab 分场景温度文档；`self-llm` / unsloth 的 M2.5 vLLM 部署指南（复述官方 temp 1.0 / top_p 0.95 / top_k 40 / **repeat penalty 1.0 或禁用** / min_p 0.01，默认可能 0.05）；vLLM / SGLang 解析器文档；**腾讯云 MaaS DeepSeek 调用指南 `product/1823/132248`（2026-08-24）与 MiniMax 调用指南 `intl product/1300/80636`（2026-06-11）**——即 §5.1 那句「思考与 JSON 不同开」的真实出处；Artificial Analysis IFBench 榜（M3 82.9%）。

**C**：`asgeirtj/system_prompts_leaks`（海螺 / M2.5 强禁令人设，**泄漏内容不可照抄**）；datalearner 转述官方「回传提升可达 35%」；GitHub issue52（提示词控制思考长度无效）；LLMTR 预览卡（M3.1 最大输出 524,288）；minimax-ai.chat 非官方镜像（`tool_choice` 支持 auto/none）；apiuspro（512K 常规建议）；CSDN M3 集成排错；Claude Code 多模型路由 community 实践（longContext → MiniMax）。

**D**：php.cn 的「MiniMax prompt 精简与压缩 / 固定格式输出四步法」——批量生成内容，数值与百分比一律不采信（可取的只有定性方向：`【】`/`→`/`###` 轻量符号、删「请务必」类修饰）。

**存疑与未找到一手依据（已列检索词）**

1. **「官方建议写短提示」逐字表述：未找到**。搜过 `MiniMax official "do not write complex" prompts`、`MiniMax M2 提示词 官方 建议 简短`、M2/M2.5/M3 README、arXiv 两份报告、平台 docs 全文。已按 §1.1 改写为可辩护的表述。
2. **「思考与 json_object 冲突」非 MiniMax 官方条款**：逐字命中在腾讯云两份指南（§5.1）。搜过 `minimax json_object`、`MiniMax response_format 同时开启`。
3. **35% 回传收益**：只见转述，未见官方一手原文与实验设置。
4. **`role_setting` 这个名字**：任何快照与搜索都未出现，官方老字段名是 `bot_setting`（+ `sample_messages` / `reply_constraints`）。
5. **M2-her 状态矛盾**：中文文档页仍在、英文 FAQ 已列入已下线（2026-10-20 实测）。
6. **「官方强锁 320k」上下文阈值**：社区压测口径（C），官方文档只见 1M 基线，未见 320k 限制条款。搜过 `MiniMax M3 context 320k limit official`。
7. **M3.1-Flash 开源权重**：截至 2026-10-20 未发布（`MiniMax-AI` 对应仓库 404，博客称"will release weights later"）。
8. **M2.5「spec-writing tendency」**：保留为前一轮已核条目，主线本轮未逐字复验。
9. **M3.1 最大输出 524,288**：来自第三方卡片（C），未见官方限额页。
