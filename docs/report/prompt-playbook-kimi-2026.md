# Kimi（月之暗面）提示词与 Agent 人设方案（2026-10）

> 适用范围：`kimi-k3`、`kimi-k2.7-code(-highspeed)`、`kimi-k2.6`，含自部署开源权重。
> 定稿日期：2026-10-20。证据基线：platform.kimi.com 官方文档（2026-10-16 前后更新，逐页取 `.md` 原文）、MoonshotAI GitHub、moonshotai 模型卡（hf-mirror 逐字核对）、Kimi 帮助中心。
> 写作约定：〈system-reminder〉〈think〉等全角尖括号是排版保护写法，实际使用时替换为 ASCII 半角。
> 证据等级：**A** = 官方一手；**A⁻** = 官方文档历史快照（Wayback）；**B** = 权威二手；**C** = 社区复现；**D** = 未证实/泄露文本。
> 调研稿：`.temp/research/prompt-2026-10/kimi.md`，30+ 份官方原文快照在同目录 `raw/`。

---

## 0. 一句话抓住 Kimi 的特性：**采样参数锁死，提示词是唯一杠杆**

现行代系 Kimi 的 `temperature` / `top_p` **全部不可修改**（A，官方模型参数参考逐字）：

> "表中「固定」表示该参数不可修改：传入其他值会报错。"

| 模型 | temperature | top_p | 上下文 | 推理配置 |
|---|---|---|---|---|
| `kimi-k3` | 固定 **1.0** | 固定 **0.95** | **1M** | 顶层 `reasoning_effort`：low/high/max（默认 max）；`max_completion_tokens` 默认 131072，可至 1048576 |
| `kimi-k2.7-code(-highspeed)` | 固定 1.0 | 固定 0.95 | 256K | thinking 常开，Preserved Thinking 始终开启 |
| `kimi-k2.6` | 思考 1.0 / 非思考 **0.6** | 固定 0.95 | 256K | `thinking.type` = enabled/disabled；`thinking.keep:"all"` 可选 |

官方还直接劝退："建议调用以上模型时**不要显式传入 `temperature`**"。

后果：**别人家用参数调行为，Kimi 只能靠提示词调行为**。所以 Kimi 这套方案的权重全压在 prompt 层与工具层，唯一可用的行为闸门是 `reasoning_effort`（思考强度）和工具 schema 的设计质量。

另一条硬约束（A）："当 `temperature` 接近 0 时，`n` 只能为 1，否则返回 `invalid_request_error`"——历史上 K2 开源时代是 0.6，那时才存在低温采样玩法，现已不适用。

---

## 1. 版图与时间线（先别用错模型名）

- **kimi-k3**（2026-07-17 发布、07-27 开源权重）：旗舰，2.8T 参数 MoE，官方逐字："Kimi K3 是 Kimi 迄今能力最强的旗舰模型……拥有 100 万 token 上下文窗口……全球首个开源的 3 万亿级别模型"。**仅思考模型，思考关不掉**（A："目前关不了（思考），K3 始终开启思考模式"），原生视觉。
- **kimi-k2.7-code / -highspeed**：编程专用、仅思考（"始终开启思考、不可禁用"），256K；highspeed "输出速度约 180 Tokens/s，短上下文场景可达 260 Token/s"（A）。
- **kimi-k2.6**：通用混合思考（可开关），256K，视觉 + 视频输入（A）。
- **已下线**（A，模型列表页）：`kimi-k2` 全系 2026-05-25；`kimi-k2.5` 与 `moonshot-v1` 全系 2026-08-31；`kimi-latest` 2026-01-28。
- **instruct/thinking 分离史**：K2 代是两个独立模型 ID（`kimi-k2-0905-preview` = Instruct、`kimi-k2-thinking` = 思考）；K2.5/K2.6 起合并成同一模型 + `thinking`/`enable_thinking` 开关；**K3 只剩思考一档**、用 `reasoning_effort` 分强度。
- 端点（A，FAQ）：国内 `https://api.moonshot.cn/v1`，国际 `https://api.moonshot.ai/v1`，"**两个平台的账户和 key 完全独立，不能混用**"；兼容 OpenAI Chat Completions / Responses 与 Anthropic Messages（`/anthropic`）。
- 传闻 K3.1（三档推理、1M）2026-10 登场：**截至 10-20 平台模型列表仍是 k3 / k2.7-code / k2.6，未落地**（B/C，存疑）。

---

## 2. 人设（System Prompt）：先辟谣，再给官方口径

### 2.1 证伪一条流传说法

**「K2 不支持 system / 官方建议把 system 并入 user」——未找到任何一手依据，属误传。** Kimi 官方从未在模型卡、API 文档或教程里说过这话，反而全程在用 system：

- K2 开源模型卡（A，moonshotai/Kimi-K2-Instruct）示例即 `{"role": "system", "content": "You are Kimi, an AI assistant created by Moonshot AI."}`，并写："**If no special instructions are required, the system prompt above is a good default.**"
- K2 Thinking 卡（A，2025-11）同样带 system 示例。
- K2 代 API 文档（A⁻，Wayback 2026-03-31）全部示例首条即 `role:"system"`。
- 现行 API 参考（A）："role 支持 system、user、assistant、tool 其一，content 不得为空。"

这条误传的真实来源是**三个相邻事实被混为一谈**（这才是需要记住的工程信息）：

1. **K2.5 在开源推理侧撤掉了「默认 system prompt」**（A，K2.5 卡 Changelog 2026-01-29 逐字）："The default system prompt might cause confusion to users and unexpected behaviours, so we remove it." —— 撤的是**聊天模板里自动注入的默认值**，不是 API 的 system role。（更早 K2-0905 时官方还主动 "updated the default system prompt"，B。）
2. **不支持的是 OpenAI 新 role `developer`**，不是 system（C，第三方 harness 修复记录 #5159："使用 system 而非不支持的 developer 消息"）。
3. "把 system 写进首条 user" 是 **DeepSeek-R1 的官方口径**，与 Kimi 无关（K3 模型卡示例确实只用 user/assistant，但平台文档与 FAQ 一直推荐 system）。

> 实操结论：在 Kimi 上**放心用 system role**；但自部署开源权重时要检查 chat template 是否还带自动注入的默认 system——K2.5 之后官方把它撤了，你的 harness 若依赖模板注入人设，会发现「人设凭空消失」。

### 2.2 Kimi 官方的 agent 人设三句铁律（A，逐字）

来自官方 `use-kimi-k3-to-setup-agent`：

> "**System prompt 只描述角色、工作流程和质量边界，把具体工具参数留给工具 schema**"
> "**不要把工具能够完成的工作重复写进冗长的 system prompt**"
> "**不要用 prompt 代替参数约束**"

这是五家里对「人设 vs 工具 schema」分工写得最干净的官方口径：**参数合法性归 JSON schema，行为边界归 system，具体任务归 user**。

### 2.3 长对话里的人设维护：官方要求「定期强化」

A 级逐字（Partial Mode 文档《在长对话中保持角色一致》）：

> "应在系统提示词（system prompt）中提供明确的指令和指南，说明该角色在这些情况下应如何行动；**定期强化角色设定**：如果对话的轮次非常长，可以**定期使用系统提示词（system prompt）强化角色的设定**，特别是当模型开始产生一些偏离时。"

即：Kimi 官方承认长轮次下人设会漂移，**官方给的解法是周期性重发 system**，不是写更长的 system。

### 2.4 K3 的两个 system 新用法（有报错红线）

- **动态工具加载**（A，use-dynamic-tool-loading）：system 消息可**只携带 tools、不携带 content**；"携带 tools 的 system 消息不能再携带 content 字段，否则 400（cannot be used with content）"。
- **多文件问答**（A，file-based-qa）：官方建议"**将每个文件单独放置在一个系统提示词 system prompt 中**"，支持多条 system 消息。
- **时效信息**（A⁻，FAQ）：官方建议"你可以在系统提示词 system prompt 中为 Kimi 大模型提供这样的信息"（指当前日期）。

> ⚠️ 这里有一条**官方文档内部的张力**（我的推断，非官方成文）：FAQ 建议把当前日期写进 system，而 context-caching 又要求"**不要在前缀中插入时间戳、随机 ID 或其他动态字段**"。两者在逐日变化的日期上冲突。稳妥做法：日期若每天变，就放在**消息序列尾部**（user 侧）而不是前缀 system，或接受每天破一次缓存。

---

## 3. 官方《Prompt 最佳实践》九条（A，可逐条照抄）

标题与关键原句照抄（`platform.kimi.com/docs/guide/prompt-best-practice`，2026-10 在线版与 2025-07 Wayback 快照一致，说明规则稳定）：

1. **编写清晰的说明**——"模型无法读懂你的想法……模型越少猜测你的需求，你越有可能得到满意的结果。"
2. **在请求中包含更多细节**——"请保证在输入请求中提供所有重要细节和背景"（附"一般的请求 vs 更好的请求"对照表）。
3. **在请求中要求模型扮演一个角色**——官方示例就是 `role:"system"` 人设消息。
4. **在请求中使用分隔符**——"使用**三重引号 / XML 标签 / 章节标题**等定界符"。
5. **明确完成任务所需的步骤**——"任务建议明确一系列步骤"。
6. **向模型提供输出示例**（few-shot）——"提供一般指导的示例描述，通常比展示任务的所有排列……更加高效"（即**给原则性示例，不要穷举排列**）。
7. **指定期望输出的长度**——官方警告逐字："**指示模型生成特定数量的文字并不具有高精度。模型更擅长生成特定数量的段落或项目符号的输出。**" → 用「3 段」「5 个 bullet」而不是「300 字」。
8. **提供参考文本**（防幻觉官方句式）——"使用提供的文章（用三引号分隔）回答问题。**如果答案在文章中找不到，请写'我找不到答案。'**"
9. **拆分复杂的任务**——按分类路由指令；长对话"总结或过滤之前的对话"（**摘要可作为 system 消息回灌**）；"分块概括长文档，并递归构建完整摘要"。

### 3.1 面向普通用户的官方四要素 + 误区表（A，Kimi 帮助中心）

四要素："明确角色与背景 / 具体描述任务（做什么、输出格式、数量与范围、质量要求）/ 提供示例或参考 / 分步骤拆解复杂任务"。实用技巧：追问迭代、善用文件和链接、指定输出格式、"**利用系统提示和记忆**"（用产品端记忆功能固化长期偏好）。

官方《常见误区》表（A，逐条给修法，日常对话直接用）：

| 误区 | 官方给的替代做法 |
|---|---|
| 一次塞入过多不相关的任务 | 每个独立任务新建会话 |
| 提示过于模糊（如"帮我写点东西"） | 说明写什么、给谁看、什么风格、多少字 |
| 期望一次完美输出 | **先生成初稿，再通过追问迭代优化** |
| 不检查 AI 输出的事实性 | 涉及数据、日期等事实信息时，务必核实 |

---

## 4. Agent 工具层：Kimi 是五家里官方规定最密的

### 4.1 回传铁律（A，逐字）

> "我们推荐直接将 Kimi API 返回的 `choice.message` **'原封不动'地添加到 messages 列表中**。"

配套：

- 思考模型必须**连同 `reasoning_content` 原样回传**，否则"破坏后续工具调用上下文"；单轮工具循环内"应保留上下文中所有的思考内容（reasoning_content）并随请求回传"。
- 每个 tool_call 必须有对应 `tool_call_id` 的 `role=tool` 消息，**缺一即错**（官方专设 `tool_call_id not found` 排查节）。
- 别只保留 content 就回传 assistant 消息（K3 明确警告）；判断字段存在"仅支持通过 `hasattr` 判断 `reasoning_content` 存在"。
- `reasoning_content` **会计入 token 消耗**（A，计费警告）。
- 流式注意：先输出 `delta.content` 再输出 `delta.tool_calls`，须**按 index 拼接 arguments**。

### 4.2 硬性配置（A，逐字）

> "**设置 `max_tokens>=16000`** 以避免无法输出完整的 reasoning_content 和 content"；"**无需设置 temperature**"；"使用流式输出（stream=True）"。

`reasoning_effort` 换档警告（A）："切换档位会破坏前缀缓存命中，**建议在会话开始前确定 effort 档位，避免中途切换**。"

### 4.3 tool_choice 的代际差异（容易踩）

- `kimi-k3` 支持 auto / none / **required**；**K2.6 / K2.7 不支持 required，传入报错**。
- **强制指定单个函数与思考模式互斥**（A）：400 "tool_choice 'specified' is incompatible with thinking enabled"。
- "是否设置 tool_choice **不会破坏前缀缓存**"。

### 4.4 多工具编排的官方模式（A，kimi-k3-tool-calling-best-practice）

> "**不要把所有（上百个）工具定义一次性放进请求**"

官方给的三步：只挂 `search_tools` + 核心工具 → 首轮 `tool_choice:"required"` **强制检索** → 后续恢复 `"auto"` → 用**带 tools 的 system 消息**按需注入工具定义（即 §2.4 的动态加载）。

### 4.5 重复调用治理（官方给了现成模板）

A 级（tool-call-repeat）：业务侧检测**同一工具、同一组参数、连续 3 / 5 / 8 次**时，向 system prompt 追加〈system-reminder〉文本（官方给两段逐字模板），并强调"**仅在同一工具、同一组参数、连续多次重复、工具结果没有新进展同时成立时触发**"。

> 值得直接抄进 harness：这是把「纠偏提醒」做成**按需注入的 system 增量**，而不是预先写进人设——与 §2.2「不要把工具能做的写进冗长 system」一脉相承。

### 4.6 工具描述写法（A）

- "description 描述了工具的**具体作用、以及在什么场合需要使用工具**"（用途 + 触发场合，两件事都要写）。
- schema 侧："将 `additionalProperties` 设为 `false`，并在 `required` 中列出必填字段，**可以减少模型生成无效参数的概率**"。
- "思考后再调用"不需要写咒语：官方口径是模型"原生掌握边思考边使用工具"，你要做的是把一次工具循环内**全部 reasoning_content 留在上下文**里（A）。

### 4.7 自部署 K2 系列的 ID 格式坑（B）

vLLM 官方博客（2025-10-28）：K2 工具调用输出包裹于特殊 begin/end 标记，**工具 ID 必须是 `functions.{name}:{idx}` 格式**——"the Kimi-K2 model expects all tool call IDs in historical messages to follow the functions.func_name:idx format"；**官方 API 会自动归一化历史 tool call ID**（"their API automatically renames all historical tool call IDs"），自建推理必须复刻这层预处理。

配套官方口径（A，K2 文档）："官方 API 版本工具调用准确率接近 100%……**第三方平台部署的开源版本工具调用能力可能会有所下降**"。

---

## 5. 结构化输出（Kimi 独有：schema 方言 + 自检 CLI）

- **JSON Mode 三步**（A，逐字）："1. 在 system 或 user prompt 中定义输出 JSON 的格式……**最佳实践是给出具体的输出示例，并解释每个字段的具体含义**；2. `response_format:{"type":"json_object"}`；3. 解析 `message.content`"。
- **Structured Output**：`json_schema + strict:true`，走 **token 级约束解码**；schema 须符合 **MFJS（Moonshot Flavored JSON Schema）**，官方给 `walle` CLI 自检：`go install github.com/moonshotai/walle/cmd/walle@latest`。
- **模型分级差异**（A，逐字）："kimi-k2.6 在复杂 schema 下偶有不稳定表现，例如 `$ref` 可能返回 Markdown 代码块、`oneOf` 可能被忽略、`partial=true` 可能输出 schema 外字段……**建议优先使用简单 schema，并在业务层做二次校验**"。横评侧还记录到官方给出的稳定性序：**k2.7-code > k3 > k2.6**。
- 防编造技巧（A）：可能缺失的字段用联合类型 `"type": ["integer", "null"]`。
- "是否设置 `response_format` **不会破坏前缀缓存**"；k2.6 上不建议 `response_format` 与 `partial=true` 混用。
- 解析纪律：**只解析 `content`，勿碰 `reasoning_content`**。

---

## 6. 长上下文与检索

- 容量换算（A⁻，FAQ）：256K ≈ 40 万汉字，1M 更大。
- 截断处理链：`estimate-token-count` 预估 → `finish_reason=length` → 接 **Partial Mode 续写**（官方专门为续写做的功能）。
- 超长文档官方策略（最佳实践第 9 条）：**分块概括 → 摘要的摘要 → 递归拼装**。
- 前缀缓存纪律（A，context-caching 逐字）："把稳定的 system prompt、工具定义、参考资料和代码库放在请求前部……**不要在前缀中插入时间戳、随机 ID 或其他动态字段**"。
- **官方未发布**「注意力中段衰减 / lost in the middle」类成文告诫（已检索，记未找到）。
- 联网搜索官方建议（A）：查询词 **1–6 词**、带上**当年年份**、**先搜后开链**；但 K3 快速开始同时提示"联网搜索工具正在更新，近期不建议使用"（**官方工具链临时状态**，用前先看公告）。
- 两条 token 灾难警告（A，FAQ）："使用 base64 编码你的文本内容会导致产生**巨量的 Tokens 消耗**"；"请不要把二进制文件添加到上下文中"；"目前不支持使用文件 file_id 的方式引用文件内容作为上下文"。
- 长文档定位三板斧（D，社区，无官方背书，可与官方引用要求叠加）：提问带**大纲锚点**（复现原文章节编号）、关键词反查段落、先让模型产出**目录树当坐标系**、答案要求"见原文第 N 页"式出处。

---

## 7. 可直接复制的三个模板

### 模板 ① · 通用任务

```text
【system】（Kimi 官方：角色 + 质量边界，不含工具参数细节）
你是{角色}，服务{目标读者}。规则：
- 区分已确认事实、估算与推断；不确定就直说，不得编造        ← 最佳实践§8
- 用与用户相同的语言回答                                    ← agent 指南逐字
- 输出：{段落/表格/编号列表}，按「段数或条目数」限定，不写字数  ← §7 官方警告

【user】
【背景】…                                            ← §2 细节与背景
【任务】明确动词（分析/总结/翻译/对比）                ← §1 清晰的说明
【范围与限制】…
【示例】{一个原则性示例，不穷举排列}                   ← §6 官方 few-shot 口径
【参数】不传 temperature/top_p（传入报错）；k3 用 reasoning_effort 选档
```

### 模板 ② · Kimi Agent 工具调用（k3，官方 setup-agent 骨架）

```python
SYSTEM_PROMPT = """你是{领域}助手。先明确范围，再检索/调用工具并交叉验证，最后输出报告。
要求：区分事实与推断；不得编造数据或来源；报告含摘要、关键发现、限制、来源列表。"""

messages = [{"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": task}]
# 工具：required 列全 + enum + additionalProperties:False（官方：减少无效参数）
# 工具多时：只挂 search_tools + 核心工具，首轮 tool_choice="required" 强制检索，之后回 auto
loop(≤8 轮):
    create(model="kimi-k3", messages=messages, tools=tools,
           max_completion_tokens=8192)     # 思考模型官方要求 max_tokens>=16000
    # 不传 temperature/top_p；思考模式下不要指定单个函数（400 互斥）
    messages.append(response.choices[0].message)      # 原封不动，含 reasoning_content
    for tc in message.tool_calls:
        messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
    # finish_reason=="length" → 提高 max_completion_tokens
    # 同工具同参连续 3 次且无新进展 → 按官方模板向 system 追加〈system-reminder〉
```

### 模板 ③ · 长文档分析（几十万字）

```python
messages = [
  {"role": "system", "content":
    "你是文档分析助手。仅依据给定材料回答；材料中没有就写「我找不到答案。」；"
    "回答须引用原文位置（章节号/页码）。"},                       # ← 官方防幻觉句式 + §7 参考文本
  # 每个文件单独一条 system（官方 file-based-qa 建议），固定前缀放头部吃缓存
  *[{"role": "system", "content": f"〈文档{i}〉{抽取文本}〈/文档{i}〉"} for i, …],
  {"role": "user", "content":
    "第一步：输出带编号大纲；第二步：针对【4.2 数据验证方法】章节……（复现原文编号格式）"}
]
# model=kimi-k3；reasoning_effort="max"（难题）/"low"（抽取类）；会话开始就定档，别中途换
# max_completion_tokens>=16000；stream=True
# 超长：分块概括 → 摘要的摘要 → 拼装（官方§9）；字数控制不可靠 → 分章节模板逐段填充（官方FAQ长文方案）
```

---

## 8. Kimi 敏感度小结（供索引表引用）

- **参数敏感度：最低**——采样参数锁死，行为完全由提示词与工具 schema 决定（A）。
- **system 遵守度：高且官方主推**，但要求 system **保持精简**、工具参数一律下沉 schema（A 三句铁律）；长轮次会漂移，官方解法是「定期强化」。
- **最脆弱点**：回传纪律。`choice.message` 必须原封不动回传、`tool_call_id` 必须齐、思考内容必须留在上下文——任一缺失直接 400 或链路断裂（A）。
- **格式约束**：走 `json_schema + strict` 的 token 级约束解码最可靠；复杂 schema（`$ref`/`oneOf`）按模型分级，k2.6 已知不稳（A）。
- **语言**：官方要求"用与用户相同的语言回答"需显式写进人设（agent 指南逐字），说明它同样存在语言漂移。

---

## 9. 引用清单与存疑

**A 级（官方一手，2026-10-16 前后 `.md` 原文，快照存 `.temp/research/prompt-2026-10/raw/kimi-docs/`）**

`/docs/llms.txt`、`/docs/models`、`/api/models-overview`、`/api/chat`、`/guide/kimi-k3-quickstart`、`/guide/prompt-best-practice`、`/guide/use-kimi-api-to-complete-tool-calls`、`/guide/use-tool-choice`、`/guide/kimi-k3-tool-calling-best-practice`、`/guide/use-dynamic-tool-loading`、`/guide/tool-call-repeat`、`/guide/use-kimi-k3-to-setup-agent`、`/guide/use-thinking-models`、`/guide/response_format`、`/guide/use-json-mode-feature-of-kimi-api`、`/guide/use-partial-mode-feature-of-kimi-api`、`/guide/context-caching`、`/guide/use-kimi-api-for-file-based-qa`、`/hosted-agents/overview`（官方 12 个 agent 设计案例模板库）

模型卡（hf-mirror 取 raw README）：`moonshotai/Kimi-K2-Instruct`、`Kimi-K2-Thinking`、`Kimi-K2.5`（Changelog 2026.1.29）、`Kimi-K2.6`、`Kimi-K2.7-Code`、`Kimi-K3`
GitHub：`MoonshotAI/Kimi-K2` README + `docs/tool_call_guidance.md`
帮助中心（用户向，A）：`kimi.com/zh-cn/help/new-user-guide/what-is-prompt`、`kimi.ai/zh-hans/help/getting-started/what-is-prompt`

**A⁻**：Wayback `platform.moonshot.cn/docs/guide/prompt-best-practice`、`/faq`、`/kimi-k2-quickstart`（2026-03-31 SSR 快照，存 `raw/archive/`）

**B**：vllm.ai/blog/2025-10-28-kimi-k2-accuracy；AWS Bedrock K2-Thinking model card（2025-11-06）；开源中国 361598（2025-07-23 模板更新）；IT之家（K2 下线 2026-05-26）；PChome/Wccftech（K3 时间与 K3.1 传闻）

**C/D**：Pi 中文文档 news（K2.6 developer role 修复 #5159）；php.cn 长文档定位教程；163/woshipm「K2 Thinking 执行回路」提示词文（D）；`asgeirtj/system_prompts_leaks` 里的 Kimi 泄露人设文本（**非官方发布**，只能当写法参考；其中 K3 助手几条挺有意思："Show the outcome, not the machinery"、"search the assumption itself rather than the answer you already have in mind"、"Own and fix your mistakes…no protracted apologies"）；阿里云百炼 kimi 文档（三方部署口径）。

**存疑与未找到一手依据**

1. 「K2 官方建议把 system 并入 user」：**未找到**，判为三个相邻事实的混淆（§2.1）。
2. K2 Thinking 时代 API 文档（`use-kimi-k2-thinking-model`，2025-11）Wayback 只有 JS 壳快照，正文无法排除当时另有 system 告诫 → 记「未找到」。
3. Kimi K3 技术报告 PDF 与 K2.5 技术报告（arXiv 2602.02276）**未逐页研读**，提示词附录未核。
4. 官方「长上下文衰减」成文建议：未找到。
5. 官方 X（@Kimi_Moonshot）prompting tips 专帖：本机无 twitter 工具面，未检索到一手原文。
6. K3.1 截至 2026-10-20 未上架。
7. K2 文档提过的 "Enforcer & Json Mode" 特有功能：现行文档未见专页，推断已被 `tool_choice=required` + strict json_schema 取代（存疑）。
