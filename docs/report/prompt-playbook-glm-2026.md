# 智谱 GLM 提示词与 Agent 人设方案（2026-10）

> 适用范围：`glm-5.3` / `glm-5.3-flash(flashx)` / `glm-5.2` / `glm-4.7` / `glm-4.6` / `glm-4.5(air)`，含自托管开源权重。
> 定稿日期：2026-10-20。证据基线：docs.bigmodel.cn（提示词工程页 2026-10-19 更新）、docs.z.ai、zai-org GitHub README。
> 写作约定：文中〈think〉〈/think〉〈tool_call〉〈arg_key〉等全角尖括号是**排版保护写法**，真正放进提示词/代码时必须替换成 ASCII 半角尖括号。
> 证据等级：**A** = 官方原文；**B** = 权威二手（Cline 官方博文、vLLM/OpenClaw/AWS 文档等）；**C** = 社区实测；**D** = 未证实（内容农场，仅记录）。
> 调研稿：`.temp/research/prompt-2026-10/glm.md`。

---

## 0. 先对齐代际：GLM 的提示词规则**按代际不同**，这是最大的坑

2026-10-20 智谱主推已是 **GLM-5.3 文本系 + GLM-5.3-Flash 原生多模态**；GLM-4.7 是「4.x 编码代」收尾；4.5/4.6 是带技术报告（arXiv 2508.06471）、被引用最多的基座代。

| 代际 | 发布 | 上下文（官方口径） | 与提示词直接相关的行为 | 等级 |
|---|---|---|---|---|
| GLM-4.5 / Air | 2025-07-28 | 128K，输出 96K | 混合推理首现；**Interleaved thinking 起于本代** | A/B |
| GLM-4.6 | 2025-09-30 | 200K，输出 128K | 新增 `tool_stream`；**temperature 默认升到 1.0** | A |
| GLM-4.7 | 2025-12-22 | 200K | 新增 **Preserved / Turn-level Thinking**；**强制思考** | A/B |
| GLM-5 | 2026-02-11 | 202K（平台口径有 1M） | DSA+MTP 架构 | B |
| GLM-5.1 | 2026-04-07 | — | Coding Plan 主推 | B |
| GLM-5.2 | 2026-06-16 | 1M（第三方云口径） | 引入 `reasoning_effort` 全档 | B |
| **GLM-5.3 / 5.3-Flash** | 2026-08-14 / 08-26 | 云口径 1M，API 默认 max_tokens 65536 | **强制思考、关闭即报错**；Flash 为首个开源原生多模态 | A/B |

> 官方文档导航当前的迁移页已是「迁移至 GLM-5.3」，模型介绍列 GLM-5.3 / 5.3-Flash / 5.2（A）。
> ⚠️ 上下文口径分歧要如实标注：docs.z.ai 模型页给 4.5=128K / 4.6=200K / 4.7=200K；「1M」只见于第三方云（腾讯云 TokenHub、OpenClaw、AWS）对 GLM-5.x 的标注，**未在智谱自家模型页坐实**（A/B，存疑见 §7）。

---

## 1. 官方提示词三策略（A 级原文，逐条可用）

官方《提示词工程》页（`https://docs.bigmodel.cn/cn/guide/platform/prompt`）分三条策略，开宗明义："**GLM 越能明确您的需求，提供的回答质量越高**"。

**策略一 · 编写清晰、具体的指令**

- **定义 System Prompt**：官方给 system 的定位是——"设定 AI 助手行为模式的工具，包括角色设定、语言风格、任务模式和针对特定问题的具体行为指导。" 官方示例原文：

```json
{"role":"system","content":"您擅长从文本中提取关键信息，精确、数据驱动……将提取的信息以清晰的JSON格式呈现。"}
```

- **提供具体细节要求**：背景与输出细节都写进 prompt。
- **角色扮演**："让 GLM 扮演角色，可以更准确地模仿该角色的行为和对话方式。"
- **使用分隔符**：用 `"""…"""` 包裹待处理正文（GLM 官方推荐的分隔符是三重双引号，不是 XML 标签）。
- **思维链提示**："要求模型分步骤解答问题，还要求其展示其推理过程的每个步骤"，以减少不准确、便于评估。
- **少样本学习**：给风格样例引导模仿。
- **指定输出长度**：官方明确注记——"**让模型精确的生成一个特定的字数难以实现**"。所以写"不超过 100 个词"这类**软约束**，别写"恰好 200 字"。

**策略二 · 提供参考资料**："引用外部资料能有效提升模型回答的准确性……有助于减少错误或虚构信息的生成"；超出上下文时用 Retrieval 工具做语义切片。

**策略三 · 将复杂任务分解为简单的子任务**：官方点名的三种拆法——意图理解与实体提取（"以 Json 格式输出，便于后端接口解析、防报错"）、总结上文关键信息、分段归纳长文档并逐步构建摘要。

> 注意：GLM-4.5 发布时 GitHub README 有独立 "Prompting Guide" 一节，**现版 README 已删除**，只保留 "Please use OpenAI-style tool description format for calls" 这类实现提示。所以人设/提示词的官方真源是上面这份「提示词工程」文档（A/B）。

---

## 2. GLM 上的人设（System Prompt）写法

### 2.1 官方给的载体边界

官方把 system message 明确定位为承载 **角色 + 语言风格 + 任务模式 + 行为约束 + 期望输出结构** 的地方；结构化输出文档还要求"**在系统消息中定义期望的 JSON 结构和字段要求**"（A）。**未找到**官方「长指令一律放 system」的量化建议——所以放与不放依据是：动态用户数据不要进 system（会破坏前缀缓存并稀释规则）。

### 2.2 GLM 人设要「短、显式、机械精确」——目前最硬的一条实证

这条来自 **Cline 官方博文**（B 级，GLM 官方推荐的编码框架之一，非内容农场转述），是对 GLM 编码 agent 最有价值的一段：

> "For models like GLM-4.6, the context surrounding coding-agent behavior is largely implicit, and would be redundant to include in a system prompt. At Cline, we found GLM-4.6 performed best when given **shorter, more explicit, and mechanically precise instructions**."

配套复盘（作者 Arafat Katze）给出的具体动作：

- **删掉泛化指令**——`"use tools efficiently"`、`"be helpful"` 这类整段移除；
- 只留**明确的调用规则** + **严格序列**（explore → summarize → implement）+ **机械精确的工具定义**；
- 结果：system prompt 从 56,499 字符缩到 24,111（**−57%**），成功率反而上升；
- 早期坑记录：工具调用失败、"spurious thing tags"（凭空冒出标记）。

结论落到 GLM 人设写法上：**GLM 对「行为背景」是隐式理解的，写进去不仅冗余还会挤占注意力**。人设里只写三样：作业范围（哪个仓库/哪些文件）、动作序列（严格顺序）、输出契约（给什么、不给什么）。

### 2.3 中文语言漂移必须显式钉死

B 级实测（GLM-4.6 与 Claude Sonnet 4.5 / GPT-5 Codex 同题横评）："语言一致性上仍存在问题，**在中文 Prompt 下偏好输出英文**"。

- 修法：在 system **顶部**用强制句钉死输出语言，例如"只用与用户提问相同的语言回答（强制）"。
- 注意：**智谱官方并未声明「中文提示优于英文」**（已检索，未找到官方口径，见 §7.3）；社区「中文更好」多为 D 级农场，「英文更稳」为 C 级论坛观感，两者互相矛盾且都不是官方结论。稳妥做法是：**提示词语言 = 期望回答语言**，并在 system 里显式约束。

### 2.4 思考开关联动的人设调整

官方 GLM-4.5 模型指南给了三档任务分档（A，含官方示例）：

| 档位 | 官方示例 | 人设写法 |
|---|---|---|
| 简单任务（无需思考） | "When was Z.AI founded?"、"Translate 'I love you' into Chinese" | 直给指令，别写"先规划再执行"（浪费轮次） |
| 中等任务（默认/部分思考） | "为何木星卫星多于土星"、"北京到上海 飞机 vs 高铁 对比" | 给输出结构 |
| 困难任务（满额思考） | "MoE 专家如何协作"、"结合本周上证波动判断是否买指数 ETF" | 给评估标准与边界，别给步骤（模型自己会拆） |

官方《Deep Thinking》页口径（A）：推荐开启——复杂分析、多步推理、技术方案设计、策略决策、学术研究、创作；可关闭——简单事实查询、基础翻译、简单分类、快速问答。

---

## 3. 参数与 API 层（A 级，照抄不猜）

| 参数 | GLM 官方口径 |
|---|---|
| temperature | 取值 **[0.0, 1.0]**、限两位小数（注意：上限是 1.0，不是 2.0）。**分代默认值：GLM-5.3/5.2/5.1/5/4.7/4.6 = 1.0；GLM-4.5 系 = 0.6；GLM-4 系 = 0.75。** 官方语义："较高的值（如 0.8）……适合创意写作；较低的值（如 0.2）……适合事实性问答。" |
| top_p | 取值 [0.01, 1.0]，默认 **0.95**（4.5/4.6/4.7；GLM-4 系默认 0.9） |
| 二者关系 | **官方硬约束（反模式级）**："建议根据应用场景调整 top_p 或 temperature 参数，但**不要同时调整两个参数**。" |
| max_tokens | 默认 65536、最大 131072（glm-4.5+ 文本系）；GLM-4.5 系上限 98304；"GLM-4.7/4.6 最大支持 128K 输出，GLM-4.5 最大 96K，**建议设置不小于 1024**"。换算：1 token ≈ 0.75 英文词 或 1.5 中文字 |
| stream | 默认 false；"对于聊天机器人、实时代码生成等应用，**强烈建议设为 true**" |
| do_sample | 默认 true；"需要可复现、确定性的输出时，设为 **false**"（GLM 的可复现开关，别的家少见） |
| 协议兼容 | 官方 API 兼容 **OpenAI / Anthropic / Response** 三套；Claude Code 走 `https://open.bigmodel.cn/api/anthropic`（国内）或 `https://api.z.ai/api/anthropic`（Coding Plan） |

### 3.1 思考控制（GLM 最复杂的一块，逐字 A 级）

参数：`thinking = {"type": "enabled" | "disabled"}`，默认 `enabled`，仅 GLM-4.5+ 支持。

**各代际行为差异（官方原文逐字，A）**：

> "`enabled` 默认；`GLM-5.3 / 5.3-FLASH / 5.3-FLASHX` 强制需开启（设 disabled 报错）；`GLM-5.2 / 5.1 / 5 / 5-Turbo / 5v-Turbo / 4.6 / 4.6V / 4.5` 为模型自动判断是否思考；`GLM-4.7 / 4.5V` 为强制思考。"

`reasoning_effort`（GLM-5.2+）：`max`（默认/推荐）/ `high` / `low`；**GLM-5.3 系只有这三档，传其它值直接报错**；GLM-5.2 另支持 xhigh/medium/minimal/none（none/minimal = 停思考，low/medium 映射为 high，xhigh 映射为 max）。

**三种 Thinking 模式（GLM-4.7 起，A）**——这是 GLM 区别于其他厂商的机制，必须按官方要求回传：

| 模式 | 引入 | 干什么 | 官方硬性要求（逐字） |
|---|---|---|---|
| **Interleaved thinking** | 4.5 起默认 | 在工具调用**之间**与收到工具结果**之后**思考 | "thinking blocks should be explicitly preserved and returned together with the tool results."（工具消息要**连同思考块一起回传**） |
| **Preserved thinking** | 4.7（编码场景） | 跨轮保留前序 `reasoning_content` | 需 `"clear_thinking": false` 开启；"**All consecutive reasoning_content blocks must exactly match the original sequence… Do not reorder or edit these blocks; otherwise performance may degrade and cache hit rates may be affected.**"；**Coding Plan 端点默认开，标准 API 端点默认关** |
| **Turn-level thinking** | 4.7 | 同一会话内按轮开关 | 轻请求关思考降延迟/成本，复杂任务开思考提精度 |

思考内容位置：流式在 `delta.reasoning_content`，非流式在 `message.reasoning_content`，与 `content` 分离，客户端要分别处理。自托管关思考：`extra_body={"chat_template_kwargs": {"enable_thinking": False}}`（A/B）。

### 3.2 工具调用

- 官方 API 层 = **OpenAI JSON-schema 风格**（name / description / parameters）。响应字段：`tool_calls[].function.name`、`.function.arguments`（**JSON 字符串**）、`id`（A）。
- **`tool_choice` 默认且仅支持 `auto`**（A）——别按 OpenAI 习惯传 `required` 或具名函数来强制调用，这是 GLM 与 OpenAI 语义不一致的地方。
- 流式工具调用：`tool_stream=true`（GLM-4.6+），需自行拼接 `delta.tool_calls[*].function.arguments`（A）。
- 官方函数设计三原则（A，逐条照抄）："**单一职责**：每个函数只做一件事；**清晰命名**：函数名和参数名要有意义；**完整描述**：提供详细的函数和参数描述"。参数设计要求给 `description` / `enum` / `default` / `examples`，并示范"支持中英文，如：北京、Beijing"。
- 稳健性补充（B/C，Novita 实操手册）：schema 用**短而唯一**的参数名；**避免嵌套 `anyOf`**，防参数混淆与解析失败。

**关于 XML 工具标记的澄清**（重要，避免误传）：网上流传的 GLM 基座格式〈tool_calls〉/〈arg_key〉/〈arg_value〉确实存在，但它是 **token 层格式**，由 vLLM `--tool-call-parser glm45/glm47`、SGLang 解析器在推理时编码/解析（B）。**现版官方文档没有把它作为面向用户的推荐格式**，README 明确要求 "use OpenAI-style tool description format"（A）。逐字符的 token 串本机未能一手核对（huggingface.co 不可达、raw 对 parser 文件 502/404、ModelScope 正文未取到），故 **XML 具体写法记 D 级、不做定论**；写应用一律走 §3.2 的 JSON 工具面，只有自托管手搓 chat template 时才需要回查 `tokenizer_config.json` / `chat_template.jinja`。

### 3.3 官方检索/联网面（A）

Z.AI 三件套：**Web Search API**（`search-prime`，返回标题/URL/摘要/站点等 LLM 友好结构，支持 `search_domain_filter`、`search_recency_filter`、`count`）、**Web Search in Chat**（检索结果并入回答并给引用）、**Search Agent**；文档含 MCP Server 入口。面向编码/视觉 agent 的官方推荐 MCP：`zai-mcp-server`（视觉理解/截图分析）、`web-search-prime`、`web-reader`。

---

## 4. GLM 反模式清单（官方原话级）

| # | 反模式 | 依据 | 修法 |
|---|---|---|---|
| 1 | 同时调 temperature 和 top_p | A："不要同时调整两个参数" | 二选一 |
| 2 | 要求"恰好 N 字" | A："让模型精确的生成一个特定的字数难以实现" | 改「不超过 N」软约束 |
| 3 | 给 GLM-5.3/4.7 传 `thinking:{type:"disabled"}` | A：强制思考代际，设 disabled **报错** | 用 reasoning_effort 分档，别关 |
| 4 | 工具循环里丢/重排/编辑 `reasoning_content` | A（Preserved）："Do not reorder or edit these blocks; otherwise performance may degrade and cache hit rates may be affected." | 原序原样回传 |
| 5 | Interleaved 模式下只回传 tool 结果不回传思考块 | A | 思考块随工具结果一起回传 |
| 6 | 按 OpenAI 习惯传 `tool_choice:"required"` | A：官方仅支持 `auto` | 用描述与提示引导，别强制 |
| 7 | 依赖 `response_format` JSON 模式做复杂输出 | A 告诫："在某些复杂场景下**可能影响回答的自然性**" | 复杂场景退回提示词约束 + 后处理校验 |
| 8 | 人设里塞"be helpful / use tools efficiently"泛化指令 | B（Cline） | 删掉，换严格序列 + 机械精确工具定义 |
| 9 | 拿 max_tokens < 1024 跑 agent | A："建议设置不小于 1024" | 编码/agent 显式给 ≥1024 |
| 10 | GLM-4.5V/4.6V 与 4.1V 混用模板 | A（GLM-V README）："use **different conversation templates — please distinguish carefully**" | 按模型选模板 |
| 11 | 巨石 prompt / 指令矛盾（"简洁"与"详尽"并存）/ 把动态用户数据写进 system / 盲目堆 few-shot / 纯否定式指令 | C（社区通用，非 GLM 专属） | 见通用手册 §反模式 |

**内容农场红线（D 级，勿据此决策）**：「GLM-4.7 用中文 system prompt 更佳 / 英文低 0.15 CodeBLEU」「额外 system 提示反而干扰原生逻辑」「流式把 token 拆成 c/const」「CodeBLEU 0.87、成功率 94.9%、47% 识别率、83% 截断」——均无官方一手佐证，部分与官方口径直接矛盾。

---

## 5. 可直接复制的三个模板

### 5.1 通用任务（中文）

```text
【system】
你是一名{角色：行业+年限}。语言风格：{正式/口语}。
只用与用户提问相同的语言回答（强制）。        ← 钉死 §2.3 中文漂移
{期望输出结构，例：以清晰的 JSON 呈现，字段为 …}  ← A：官方要求 JSON 结构写在系统消息

【user】
任务：{动词开头的具体指令}
背景/细节：{要点}                              ← 策略一「提供具体细节要求」
参考资料："""{粘贴正文}"""                      ← 策略二 + A 官方分隔符 """
输出要求：{格式}，长度不超过{软约束，勿写"恰好N字"}  ← A §4-2

【API】
temperature=1.0(4.6+/5.x) 或 0.6(4.5系)；或只调 top_p=0.95 —— 二选一   ← A §3
thinking={"type":"enabled"}（复杂）；4.6 及以下可 disabled，5.3/4.7 不可关 ← A §3.1
stream=True（聊天/代码官方强烈建议）                                  ← A §3
```

### 5.2 GLM Agent 工具调用

```python
client.chat.completions.create(
  model="glm-5.2",                    # 或 glm-4.7；GLM-4.5+ 均支持工具调用
  messages=[
    {"role": "system", "content":
      "你是{领域}助手。按 探索→归纳→实现→验证 的顺序行动；"
      "只在需要外部信息时调用工具。只用中文回答。"},   # ← B §2.2 短+显式+序列
    {"role": "user", "content": "{请求}"}
  ],
  tools=[{                            # ← A §3.2 单一职责/清晰命名/完整描述
    "type": "function", "function": {
      "name": "get_weather", "description": "获取指定城市当前天气",
      "parameters": {"type": "object", "properties": {
        "city": {"type": "string", "description": "城市名，支持中英文，如：北京、Beijing"},
        "unit": {"type": "string", "enum": ["celsius", "fahrenheit"], "default": "celsius"}
      }, "required": ["city"]}}}],
  tool_choice="auto",                 # ← A：官方仅支持 auto
  stream=True, tool_stream=True,      # ← A：4.6+，需拼接 delta.tool_calls[*].function.arguments
  extra_body={"thinking": {"type": "enabled", "clear_thinking": False}}  # ← A：开 Preserved thinking
)
# 工具循环硬纪律（A）：把 reasoning_content 原样、按原序、随工具结果一起回传；绝不重排/编辑。
```

### 5.3 编码 Agent 系统提示（对齐 Cline B 级 + 官方 README A 级）

```text
【system —— 短、显式、机械精确；删掉一切"be helpful/use tools efficiently"式泛化句】
你是资深{语言}工程师，在 {codebase} 内作业。规则：
1) 严格序列：explore(读文件) → summarize(要点) → implement(改代码) → verify(跑测试)。
2) 只改指定文件，其余文件不得改动。
3) 输出：只给可直接运行的代码，不写前言与解释（除非被要求）。
4) 工具调用一律 OpenAI JSON schema；参数名短而唯一，不使用嵌套 anyOf。   ← A README + B Novita

【API】model=glm-5.2/glm-4.7；stream=True；Preserved thinking=on
      （标准端点默认 off、Coding Plan 端点默认 on）；max_tokens≥1024。
【语言】若出现"中文问、英文答"漂移，在 system 顶部用强制句钉死。          ← B §2.3
```

---

## 6. GLM 敏感度小结（供索引表引用）

- **system 遵守度**：官方把 system 定为唯一指定的人设/规则载体（A），但**GLM 官方产品与 API 本身不注入 system prompt**——横评侧证据显示人设完全靠调用方提供（A，见索引手册）。
- **最适提示风格**：短、显式、机械精确；泛化行为指令是负资产（B）。
- **最脆弱的点**：工具循环里 `reasoning_content` 的处理顺序——Preserved thinking 一旦重排/编辑，官方原文警告「性能下降 + 缓存命中率受损」（A）。
- **语言**：中文提示下易漂向英文输出，必须显式钉死（B）。
- **强制思考代际**：GLM-4.7 与 5.3 系关不掉思考，一切「靠关思考省 token」的优化对这两代无效（A）。

---

## 7. 引用清单与存疑

**A 级（官方原文）**

| 来源 | URL |
|---|---|
| 提示词工程（三策略，2026-10-19 更新） | https://docs.bigmodel.cn/cn/guide/platform/prompt |
| 核心参数（thinking 分代行为、温度只调一个） | https://docs.bigmodel.cn/cn/guide/start/concept-param |
| 对话补全 API（温度/top_p 分代默认值、max_tokens） | https://docs.bigmodel.cn/api-reference/模型-api/对话补全 |
| 迁移至 GLM-4.6 | https://docs.bigmodel.cn/cn/guide/start/migrate-to-glm-4.6 |
| 工具调用 function-calling | https://docs.bigmodel.cn/cn/guide/capabilities/function-calling |
| 结构化输出 struct-output | https://docs.bigmodel.cn/cn/guide/capabilities/struct-output |
| Thinking Mode（Interleaved/Preserved/Turn-level 逐字） | https://docs.z.ai/guides/capabilities/thinking-mode |
| Deep Thinking（开关建议清单） | https://docs.z.ai/guides/capabilities/thinking |
| GLM-4.5 模型页（思考三档任务分档） | https://docs.z.ai/guides/llm/glm-4.5 |
| GLM-4.6 模型页 | https://docs.z.ai/guides/llm/glm-4.6 |
| Web Search / MCP | https://docs.z.ai/guides/tools/web-search |
| zai-org/GLM-4.5 README | https://github.com/zai-org/GLM-4.5 |
| zai-org/GLM-V README（模板区分警告） | https://github.com/zai-org/GLM-V |
| 技术报告 | arXiv 2508.06471（GLM-4.5） |

**B 级**：Cline 官方博文 GLM-4.6（https://cline.ghost.io/cline-our-commitment-to-open-source-zai-glm-4-6/）；OpenClaw Z.AI provider 文档（https://docs.openclaw.ai/zh-CN/providers/zai）；AWS Bedrock model-card GLM-5 / GLM-4.7；vLLM tool calling parser 文档（https://docs.vllm.ai/en/latest/features/tool_calling/）；阿里云百炼 GLM 文档；Novita GLM-4.5 Function Calling 手册；人人都是产品经理 GLM-4.6 中文输出英文实测（https://www.woshipm.com/ai/6276579.html）。

**C 级**：知乎 GLM-4.6 接入 Claude Code 实操（https://zhuanlan.zhihu.com/p/1956839795801167476）、B 站思考默认值踩坑视频。

**存疑（已如实检索）**

1. XML 工具标记的官方一手出处：未面向用户发布，具体 token 串本机不可核（huggingface 不可达 / raw 502 / ModelScope 未取正文）→ 记 **D 级**，不做定论。
2. 智谱官方**没有**发布可照抄的「vibe coding 系统提示词全文」，官方只提供框架接入 + MCP；人设层最硬依据是 Cline 的 B 级调优经验。
3. 「中文提示优于英文」**无官方口径**，社区 C/D 与农场 D 说法互相矛盾。
4. GLM-5.x 的「1M 上下文」仅第三方云标注，未在智谱自家模型页坐实。
5. 农场量化数字（CodeBLEU 0.87、94.9% 成功率等）一律不采信。
