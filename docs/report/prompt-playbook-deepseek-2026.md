# DeepSeek 提示词与 Agent 人设方案（2026-10）

> 适用范围：`deepseek-flash`（V4.1-Flash-1017）、`deepseek-v4-pro`，以及本地部署的 R1-0528 / V3.1 / V3.2 系开源权重。
> 定稿日期：2026-10-20。证据基线：官方 api-docs 于 2026-10-19 抓取，官方 GitHub / model card 逐字核对。
> 写作约定：文中所有形如〈think〉〈/think〉〈tool_call〉的全角尖括号是**排版保护写法**，真正放进提示词时必须替换成 ASCII 半角尖括号。
> 证据等级：**A** = 官方原文可逐字复述；**B** = 权威二手转述；**C** = 社区实测一致；**D** = 流行说法但一手出处已不可核。本手册把 C/D 明确隔离在「社区口径」小节，不与官方结论混写。
> 完整调研证据与 25+ 份官方抓取件：`.temp/research/prompt-2026-10/deepseek.md`、`.temp/research/ds/`。

---

## 0. 先认清 2026 的 DeepSeek：三条会影响提示词写法的事实

| 事实 | 内容 | 对提示词的后果 |
|---|---|---|
| 模型名换代 | 现役是 `deepseek-flash` / `deepseek-v4-pro`；`deepseek-chat`、`deepseek-reasoner` 已于 **2026-07-24 15:59 UTC 彻底退役**，请求返回 404 | 模板里模型名必须参数化，任何还写 `deepseek-reasoner` 的旧配置直接失效（A） |
| chat / reasoning 的分界消失 | V3.1（2025-08-21）起一个模型双模式，用参数切 thinking/non-thinking，不再靠选模型 | 「推理模型 vs 对话模型两套人设」这种老框架已过时，现在要按**思考开没开**分两套写法 |
| 1M 上下文成默认 | 官方原文："🔹 **1M Standard:** 1M context is now the default across all official DeepSeek services."（V4 Preview 公告，A） | 长前缀缓存策略变成主要优化点，不再需要为省 token 压缩人设 |

思考控制参数（现行，A）：

- OpenAI 兼容格式：`extra_body={"thinking": {"type": "enabled"|"disabled"}}`，强度 `reasoning_effort: "low"|"high"|"max"`；官方建议映射：`minimal/low→low`、`medium/high/xhigh→high`、`max/ultra→max`。
- Anthropic 兼容格式：`{"reasoning": {"effort": "none"|"low"|"high"|"max"}}`，`none` = 关思考。
- Responses API：`output_config.effort`。
- 默认值：**开启思考 + effort=high**。
- 官方给的档位用法口径（V4-Pro GA 公告，A）："low for simple tasks, high for daily Agent workflows, max for complex tasks"。

---

## 1. 人设（System Prompt）在 DeepSeek 上到底该怎么写

### 1.1 演变史：为什么网上说法互相打架

DeepSeek 对 system role 的态度在三年内翻了三次车，这是所有「DeepSeek 要不要写 system prompt」争论的根源。逐条官方原文（全 A）：

| 时间 | 官方原文 | 结论 |
|---|---|---|
| 2023-11（DeepSeek-LLM V1） | "since the system prompt is not compatible with this version of our models, we **DO NOT RECOMMEND** including the system prompt in your input." | 不兼容，禁用 |
| **2024-05-17** | "we have optimized model ability to follow instruction filled in the `system` part. This optimization has significantly elevated the user experience across a variety of tasks, including immersive translation, RAG, and more." | 官方**专门强化** system 指令遵循，system 自此成为一等公民 |
| 2025-01-20（R1） | "**Avoid adding a system prompt; all instructions should be contained within the user prompt.**" | 旧 R1 建议绕过 system |
| **2025-05-28（R1-0528）** | "1. System prompt is supported now. 2. It is not required to add 「〈think〉\n」 at the beginning of the output to force the model into thinking pattern." | 思考模型重新支持 system |
| 2025-08-21（V3.1 chat template） | 模板首槽即 system：`〈begin of sentence〉{system prompt}〈User〉{query}〈Assistant〉` | 思考/非思考两种模式下 system 槽位都存在 |
| 2026 V4 时代 | API Reference 完整文档化 `system` role；Anthropic 格式标 "Fully Supported"；**Chat 格式还支持会话中途插入 system 消息** | system 完全可用，且可动态注入 |

**可直接引用的结论**：今天（V4 系）在 DeepSeek 上用 system prompt 是被官方完全支持的，历史禁忌只适用于旧 R1 与 2023 年权重。本地跑 R1-0528 之前的旧 checkpoint 才需要把指令全塞进 user。

### 1.2 官方自己的「人设长什么样」——两行范式

R1-0528 model card 披露了官方 Web/App 实际使用的 system message，只有两行（A）：

> 该助手为DeepSeek-R1，由深度求索公司创造。今天是{current date}。

这是 DeepSeek 官方给出的**人设写法上限示范**：极短、声明式、只带身份与日期，不带形容词、不带能力断言、不带规则清单。（V4 时代 App 的 system 内容未找到一手依据，见 §6。）

结合官方样例的三条 A 级旁证，可以安全地推出 DeepSeek 的人设分层法：

- KV 缓存指南示例：system 放**角色 + 长文档固定前缀**，把**每轮会变的指令**追加到 user 尾部（为吃缓存前缀）。
- JSON 指南示例：格式规则放 system，待处理数据放 user。
- V3.1 工具格式：工具描述也注入 system 槽（`{system prompt}\n\n{tool_description}`）。

> 注意：「高级全局约束放 system、任务指令放 user」这句流传很广的话**没有官方原话**（搜过 api-docs、changelog、wayback）。手册把它定性为「与官方示例结构一致的社区最佳实践」，不要当官方声明引用。

### 1.3 DeepSeek 人设的四条落地规则

1. **system 里只写不随轮次变化的东西**：身份、语言、输出契约、风格边界。每轮变化的指令写进 user 末尾——既符合官方缓存示例，也避免 system 被逐轮重复稀释。
2. **写短**。官方 App 的两行范式 + system 遵循优化只解决「能不能听」，不解决「听多少」；规则条数与遵循率的衰减是所有模型共有的工程事实（见通用手册的 IFScale/ManyIFEval 证据）。
3. **格式契约必须也在 user 里说一遍**。这不是审美问题：JSON 模式下官方明确警告不写指令会「无限吐空白符直到触顶」（A，原文见 §3.2）。
4. **动态提醒走 system 插入**。Chat 格式允许会话中途插 system 消息（A），这是 DeepSeek 上给长程 agent 加「还没交付吗 / 检查清单」这类提醒的合法通道；但**不能**在 Chat 格式历史中段插 tool 结果消息，那要改用 Anthropic 或 Responses 格式。

---

## 2. 日常对话层：DeepSeek 网页/App 里的提问技巧

官方 App 内置《DeepSeek 使用指南》十条（B 级：2025-02 起被掘金/CSDN/360doc 大量逐字转载，官方原文页已不可直链）：明确需求 / 提供上下文 / 指定格式 / 分步骤提问 / 使用角色设定 / 尝试开放式问题 / 调整语气和风格 / 多轮对话逐步完善 等，每条给「不好的提示词 vs 更好的提示词」对照（例："告诉我一些东西" → "请帮我总结一下人工智能的发展历史"）。

落地要点：

- 网页/App **没有独立 system 输入框**（社区共识，C）。要自定义人设，把身份+格式契约写在**第一条消息**里，后续轮次靠上下文带过去；要稳定生效就每 3–5 轮重申一次格式要求。
- 官方提示词库仍在线可直接抄（A）：`https://api-docs.deepseek.com/zh-cn/prompt-library/`，13 类，含**代码改写/解释/生成、内容分类、结构化输出、角色扮演（自定义人设）、角色扮演（情景续写）、散文/诗歌/文案大纲/宣传标语、模型提示词生成（元提示）、中英翻译专家**。人设类有官方模板。
- 数学/竞赛题保留官方原句（A，R1 README）："Please reason step by step, and put your final answer within \boxed{}."（请逐步推理，并将最终答案放在 \boxed{} 中。）这是 DeepSeek 唯一逐字给出的场景化提示词。
- 中文写作去 AI 味（社区高赞，C）：末尾加风格约束「用普通人唠嗑语气，句子长短随意，不要排比，不要『综上所述/值得注意的是/与此同时』，段落长短不一，不强行总结升华」；先出 200 字碎初稿，再让模型按你的语气润色；给禁用词表 + 替代短语。
- 联网/检索任务：2026-10-17 起官方开放自研 Search & Fetch 工具 API（A），过滤 SEO 垃圾，经 Harness/Claude Code/Codex 服务端代跑至 2026-11-01 免费，之后 $0.75/千次。优先用官方 Search/Fetch 而不是自建 RAG 工具。

---

## 3. 参数与 API 层（工程侧照抄，别猜）

### 3.1 采样参数

| 参数 | 官方口径 |
|---|---|
| temperature | 默认 **1.0**，范围 0–2（A）。官方任务-温度表（A，《The Temperature Parameter》）：Coding/Math **0.0**；Data Cleaning/Analysis **1.0**；General Conversation **1.3**；Translation **1.3**；Creative Writing/Poetry **1.5** |
| top_p | **与 temperature 二选一**，官方原文："We generally recommend altering this or `top_p` but not both."（A） |
| presence_penalty / frequency_penalty | **已整体 deprecated**："This parameter is no longer supported. It will not take effect if you pass it to the API."（A） |
| max_tokens | 1–384K；不传时默认 非思考 **8K** / 思考 **64K** / effort=max **128K**（A）——这是官方给的思考长度硬闸门 |
| R1 系本地部署 | 官方："Set the temperature within the range of 0.5-0.7 (0.6 is recommended) to prevent endless repetitions or incoherent outputs."（A）评测口径 temp 0.6 / top_p 0.95 / 最大生成 64K，Web/App 温度 0.6（A，R1 与 R1-0528 双次确认） |

**思考模式会静默旁路采样参数**（A，Thinking Mode 指南原文）：

> "Thinking mode does not support the `temperature`, `presence_penalty`, or `frequency_penalty` parameters… setting these parameters will not trigger an error but will also have no effect."

`top_p` 依模型而定：`deepseek-flash` 仅思考模式生效、有效区间 0.95–1.0（低于 0.95 按 0.95），非思考固定 1.0；`deepseek-v4-pro` 思考模式忽略传入值（带 tools 固定 0.95，否则 1.0），非思考模式生效（A）。

后果很实际：**想治复读，别指望惩罚系数**。正解是 R1 系温度收到 0.5–0.7，思考模型用 `reasoning_effort` + `max_tokens` 控制。

### 3.2 结构化输出

JSON 输出的**强制配套动作**（A，API Reference 原文）：

> "**Important:** When using JSON Output, you must also instruct the model to produce JSON yourself via a system or user message. Without this, the model may generate an unending stream of whitespace until the generation reaches the token limit…"

即：设了 `response_format={"type":"json_object"}` 还必须在消息里明说「输出 JSON」，否则表现为「卡住/空白输出」。再加一条（A）："Set max_tokens appropriately to prevent the JSON string from being truncated midway."

### 3.3 工具调用

- 上限 128 个 function/次，支持并行（A）。
- **strict 模式**：`base_url="https://api.deepseek.com/beta"` + 每个 function `"strict": true`，服务端校验 schema；**所有 object 属性必须进 `required` 且 `additionalProperties: false`**；支持 object/string/number/integer/boolean/array/enum/anyOf 与 `$ref`/`$def`；**不支持** minLength/maxLength/minItems/maxItems（A）。
- **最容易踩的一条**（A）：带 `tools` 时，后续**所有**请求必须完整回传历史 `reasoning_content`（即使那一轮没调工具），否则 "the API will return a 400 error"。官方快捷写法 `messages.append(response.choices[0].message)`。不带 `tools` 时无需回传，回传也被忽略——**思考链不进上下文**。
- 由此推出一条人设纪律：不带 tools 的多轮思考对话里，如果某个结论需要下一轮记住，必须要求模型把它**显式写进 content**，不能留在思考里。
- 官方工具描述格式（A，V3.1 model card 逐字）：`## Tools / ### {tool_name} / Description: … / Parameters: {json} / IMPORTANT: ALWAYS adhere to this exact format for tool use: 〈tool calls begin〉…`

### 3.4 接口面（选格式有提示词后果）

ChatCompletions / Anthropic 兼容 `/anthropic`（模型名映射：`claude-opus*`→`deepseek-v4-pro`，其余 `claude*`→`deepseek-flash`，A）/ Responses API（2026-08-13 原生，为 Codex 适配）/ FIM `/completions`（**仅非思考模式**）/ Chat Prefix Completion（beta，`{"prefix": true}` 强制 assistant 以 `"```python\n"` 或 `"{"` 开头输出，A）。

---

## 4. 官方反对的反模式（逐字，全 A 级，逐条给修法）

| # | 反模式 | 官方原文/依据 | 修法 |
|---|---|---|---|
| 1 | JSON 模式不写明输出要求 | "may generate an unending stream of whitespace" | system 或 user 里明说「只输出 JSON」 |
| 2 | 同时调 temperature 和 top_p | "recommend altering this or top_p but not both" | 只动一个 |
| 3 | 传 presence/frequency penalty | "no longer supported… will not take effect" | 删掉，复读靠温度/effort |
| 4 | 思考模式配采样参数 | "will not trigger an error but will also have no effect" | 思考模式别调采样，用 effort |
| 5 | 带 tools 不回传 reasoning_content | "the API will return a 400 error" | 整体 append 官方返回的 message |
| 6 | 思考模式配非标工具组件 | "思考模式未充分适配 Cline、RooCode 等使用非标准工具调用的组件，我们建议用户在使用此类组件时继续使用非思考模式。"（V3.2 官方新闻，A） | 这类 harness 关掉思考 |
| 7 | 拿 V3.2-Speciale 上生产 agent | changelog：no tool calls（A） | 仅评测/研究用 |
| 8 | 硬编码 `deepseek-chat`/`reasoner` | 2026-07-24 退役（A） | 模型名参数化 |
| 9 | 用 Pro 做视觉 | 支持矩阵 Vision：Pro = Not supported（A） | 视觉任务用 `deepseek-flash` |
| 10 | 旧 R1 本地推理放 system | "Avoid adding a system prompt"（A，仅 <0528） | 指令全放 user |

---

## 5. 可直接复制的三个模板

### 模板 A · 通用任务（flash / v4-pro，简单任务用非思考）

```text
【system】—— 逐轮保持不变（吃前缀缓存），短、声明式
你是{身份，一句话}。始终用{中文|英文}回答。输出遵守：{格式契约}。{风格边界，1–2 条}
  ↑ 依据：A（system role 完全支持；官方 App 两行人示范式；格式契约须明示；缓存要求前缀稳定）

【user】
## Task
{动词开头的具体任务，避免「帮忙看看」这类模糊动词}
## Context
{会变动的背景材料/数据}
## Output Format
{格式 + 长度 + 条目数，例：5 条 bullet，每条不超过 30 字}
## Constraints
{禁区、字数、术语要求、必须引用的标准}
  ↑ 依据：B（官方 App 使用指南十条：明确需求/提供上下文/指定格式/分步骤）、
    B（清晰标记分隔各部分，together.ai 指南）、A（数据放 user、规则放 system 的官方样例结构）

【参数】
thinking: disabled（简单任务）
temperature: 代码 0.0 / 数据分析 1.0 / 对话 1.3 / 翻译 1.3 / 创意 1.5   ← A 官方表
top_p: 不动（与 temperature 二选一）                                  ← A
max_tokens: 显式设置，防截断                                           ← A
```

### 模板 B · Agent / 工具调用（V4 思考模式 + tools）

```python
model = cfg.model_name          # 勿写死；deepseek-chat/reasoner 已 404（A）
extra_body = {"thinking": {"type": "enabled"}}                 # A
reasoning_effort = "high"        # 日常 agent；简单 low；复杂 max  ← A 官方公告原句

tools = [{
  "type": "function",
  "function": {
    "name": "...",
    "strict": True,                                            # A：须走 base_url /beta
    "parameters": {
      "type": "object",
      "properties": {...},
      "required": [全部字段],                                   # A：strict 要求全 required
      "additionalProperties": False                            # A：strict 要求显式关闭
    }
  }
}]

# 循环纪律（全是 A 级）
# 1) 每个 assistant 回复整体回传，保留 reasoning_content 与 tool_calls：
#    messages.append(response.choices[0].message)
# 2) 带 tools 时历史里所有 reasoning_content 必须原样带上（哪怕那轮没调工具）→ 否则 400
# 3) 中途要注入系统提醒：Chat 格式可插 system 消息；
#    要在历史中段插第三方 tool 结果 → 改走 Anthropic / Responses 格式
# 4) 需要强制格式的子任务：assistant 前缀补全
#    {"role":"assistant","content":"{\n","prefix":True} + base_url=/beta
# 5) 联网优先用官方 Search/Fetch 工具 API（2026-10-17 开放）
```

### 模板 C · 推理任务（V4 thinking API，或本地 R1-0528+/V3.2）

```text
API 场景：
  thinking: enabled
  不要设 temperature / top_p / penalties（思考模式旁路，A）
  控思考长度只用 reasoning_effort + max_tokens（默认 64K，max 128K，A）

user 提示写法：
  {任务}——不堆角色、不塞 few-shot、不写「一步一步思考」（模型自会思考；B/C）
  数学竞赛类保留官方句：请逐步推理，并将最终答案放在 \boxed{} 中。   ← A
  各部分用 ## 或 XML 标签分隔（指令 / 材料 / 格式要求）              ← B

本地旧 R1（< 0528）：
  temp=0.6, top_p=0.95；不放 system；强制输出以「〈think〉\n」开头      ← A
本地 0528+ / V3.1+：
  system 槽可用，只放身份+日期级的短约束；不必强制〈think〉开头        ← A

多轮注意（A）：
  不带 tools 时思考链不回拼上下文 ⇒ 需要下一轮记住的结论必须显式写进 content
```

---

## 6. 社区口径与查无实据（禁止当官方结论引用）

- **C**：「V3 聪明且听话，R1 聪明但没那么听话」——非思考模型给清晰操作规范，思考模型少干预（不需要角色设定、CoT 提示、结构化套话、示例）。与 together.ai 指南方向一致，属社区共识。
- **B→C**：few-shot 取舍。together.ai《Prompting DeepSeek R1 guidelines》原文（经中文全文转载）："**无少样本提示**：不要在提示中提供示例，因为这会持续降低模型性能……如果你确实想提供示例，请确保它们与你的提示指令非常一致"。但官方 `json_mode` 样例本身就带 EXAMPLE，说明 few-shot 不是禁区，只是**推理模型不宜堆例子**。
- **D**：「英文 prompt 优先」「keep prompts simple and clear」——曾在早期 DeepSeek-LLM/Coder 卡片流传，已核查 GitHub 现行与 2023-11/2024-01 历史提交、hf-mirror 三张早期卡、api-docs 全 sitemap、wayback CDX，**均无该章节**（`.temp/research/prompt-2026-10/deepseek.md` §8.1 记录了搜索词）。官方可确认的相关事实是 V3.1-Terminus 修复了「中英混排与异常字符」，即**语言一致性是官方修复目标**（A），据此建议：提示词语言与要求回答的语言保持一致。
- **D**：「DeepSeek 的 system prompt 80 字以内越短越有效」「user 指令优先级高于 system」「API temperature=1.0 实际映射 0.3」——查无官方依据，且 php.cn 与部分博客互相矛盾。
- **C**：本地 vLLM 跑 V4 长工具链（8 次以上调用）出现工具标记泄漏、重复调用、自报次数错误，判为 **vLLM 对 V4 内部工具标记的解析 bug**，官方 API 无此现象——长链 agent 请用官方 API/Harness。
- **待核**：V4 时代官方 App 的 system message 实际内容与长度未找到一手（只搜到 C/D 级泄露文本）。

---

## 7. 引用清单

| 来源 | URL | 日期 | 等级 |
|---|---|---|---|
| 官方 Change Log | https://api-docs.deepseek.com/updates | 抓取 2026-10-19 | A |
| Thinking Mode 指南（英/中） | https://api-docs.deepseek.com/guides/thinking_mode | 2026-10-19 | A |
| Chat Completion API Reference | https://api-docs.deepseek.com/api/create-chat-completion | 2026-10-19 | A |
| The Temperature Parameter | https://api-docs.deepseek.com/quick_start/parameter_settings | 2026-04 快照 | A |
| Tool Calls 指南 | https://api-docs.deepseek.com/guides/tool_calls | 2026-10-19 | A |
| JSON Output 指南 | https://api-docs.deepseek.com/guides/json_mode | 2026-10-19 | A |
| Context Caching | https://api-docs.deepseek.com/guides/kv_cache | 2026-10-19 | A |
| Anthropic 兼容 API | https://api-docs.deepseek.com/guides/anthropic_api | 2026-10-19 | A |
| Chat Prefix Completion | https://api-docs.deepseek.com/guides/chat_prefix_completion | 2026-10-19 | A |
| Models & Pricing | https://api-docs.deepseek.com/quick_start/pricing | 2026-10-19 | A |
| V4 Preview 公告 | https://api-docs.deepseek.com/news/news260424 | 2026-04-24 | A |
| V4-Pro GA 公告（effort 三档） | https://api-docs.deepseek.com/news/news260813 | 2026-08-13 | A |
| V4.1-Flash 公告 | https://api-docs.deepseek.com/news/news260910 | 2026-09-10 | A |
| V4.1-Flash-1017 + Search API | https://api-docs.deepseek.com/news/news261017 | 2026-10-17 | A |
| 官方提示词库（13 类，含自定义人设） | https://api-docs.deepseek.com/zh-cn/prompt-library/ | 2026-10-19 | A |
| DeepSeek-R1 README | https://github.com/deepseek-ai/DeepSeek-R1 | 2026-10-19 | A |
| DeepSeek-LLM README（旧 system 声明） | https://github.com/deepseek-ai/DeepSeek-LLM | 2026-10-19 | A |
| DeepSeek-R1-0528 model card | https://hf-mirror.com/deepseek-ai/DeepSeek-R1-0528/raw/main/README.md | 2025-05-28 | A |
| DeepSeek-V3.1 model card（chat template） | https://hf-mirror.com/deepseek-ai/DeepSeek-V3.1/raw/main/README.md | 2025-08-21 | A |
| 官方 App《使用指南》十条（转载存档） | https://juejin.cn/post/7468218848228114458 | 2025-02 | B |
| together.ai R1 提示指南（中译） | https://m.oschina.net/news/336234/prompting-deepseek-r1-guideline | 2025-02/03 | B |
| 阿里云 PAI 托管文档（转述 R1 建议） | https://help.aliyun.com/zh/pai/use-cases/one-click-deploy-deepseek | 2026-08 | B |
| V3/R1 人设策略（「V3 听话、R1 少干预」） | https://m.blog.csdn.net/a1026950076/article/details/145728568 | 2025-03 | C |
| V4 本地长工具链 DSML 崩坏 | https://m.toutiao.com/article/7696441396277838399/ | 2026-09 | C |
| php.cn 系列（system 80 字内等） | https://m.php.cn/faq/ | 2026 | D（不作依据） |

### 存疑与未找到（已如实检索）

1. 「英文 prompt 优先 / keep prompts simple and clear」无现行官方一手出处（搜过 GitHub 历史 README、hf-mirror 卡片、api-docs sitemap、wayback CDX）。
2. 「全局约束放 system、任务放 user」无官方原话，仅官方样例结构旁证。
3. V4 时代官方 App 的 system message 内容与长度未找到一手。
4. R1 初期（2025-01~05）英文整页 API 文档无 wayback 存档，最接近的一手是 R1 README 的 "Avoid adding a system prompt"。
5. 「think longer」类自然语言触发语无官方指导；官方调节手段只有 effort 档与 max_tokens。
6. DeepSeek-V4 技术报告 PDF 所在域本机不可达，未核对。
