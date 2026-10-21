# MiniMax 系统提示词工程方案 v2（证据门槛：2026-09-01 之后）

> **只讲系统提示词（system prompt）工程**：system 的协议入口、与思考/预算的耦合、消息回传纪律、前缀缓存、官方 system 资产现状、人设能力边界。不含日常提问技巧与用户侧 prompt 公式。
> **门槛声明**：只把 2026-09-01 之后发布/更新的官方文档、公告、官方代码资产当「现行规则」；早于门槛的进 §11 并标日期。MiniMax 恰好是四家里门槛内材料最密的——**M3.1-Flash 是 2026-10-19 GA**。
> 定稿 2026-10-20。真源：`.temp/research/sysprompt-2026-10/minimax.md`（23683 B / 102 行 / 3695 汉字，18 次检索、20+ 页正文）。
> **排版约定**：全角〈〉是排版保护（防控制标记被工具层吞掉），实际写进代码/提示词必须换回半角尖括号。
> 等级：**A** = 官方文档/博客/GitHub 代码资产｜**B** = 官方合作伙伴或直供托管平台文档｜**C** = 科技媒体与社区实测｜**D** = 农场（只作辟谣素材）。
> 日期口径：多数文档页不自述「最后更新」，页内日期取本文抓取日（2026-10-20 live 快照）或搜索引擎抓取时间戳（标「爬」）。

---

## 0. 一句话结论：门槛内 MiniMax 的 system 面发生了三件事

1. **M3.1-Flash（10-19 GA）思考常开且关不掉**，传 `disabled` 直接 400 → system 不再需要承担「要不要想」的表达，只管「做什么、怎么交付」。
2. **M2.5 / M2.7 于 10-19 停止新用户、2026-11-18 正式下线**，套餐侧原模型名统一路由到 M3.1-Flash → 旧默认人设 `You are a helpful assistant. Your name is MiniMax-M2.x and is built by MiniMax.` **随模型失效**，「Your name is MiniMax-M2.x」式身份行与后端模型不再对应。
3. **官方把 agent 的 prompt 资产开源了**（`MiniMax-AI/minimax-code`，commit c59cf537 于 **09-18**、d8a32b6b「sync MiniMax Code 0.5.9」于 **09-29**，HEAD 2026-10-20）：静态人设（`prompt-base-all.md` 7678 B）与动态状态（独立模块 `agent-modules/system-reminder`）**物理分离**——这是门槛内最有价值的官方范式（§3）。

---

## 1. 协议层：system 入口三面分立，且「省略时」默认值不一致

| 协议 | system 承载字段 | 官方说法 | 级 |
|---|---|---|---|
| **Anthropic 兼容（官方推荐路径）** | 顶层 `system` 字段 | 「完全支持 系统提示词」 | A（live） |
| OpenAI 兼容 | `messages` 内 `role:"system"` | 标准角色 | A |
| OpenAI Responses 兼容 | 顶层 `instructions` | 描述只有四个字：「系统指令」；InputItem 的 role 枚举含 `system`/`developer` | A |

**官方全部示例的 system 只有一句**：`You are a helpful assistant.`（A，live 两协议快速开始）。

### 1.1 「省略时」的思考默认值——同一模型跨协议不等价（A，live 两张参数表逐字核对）

| 模型 | OpenAI 兼容省略 `thinking` | Anthropic 兼容省略 | 传 `disabled` |
|---|---|---|---|
| M3 | **开** | **关** | 跳过直答 / adaptive 开 |
| M3.1-Flash | 开 | 开 | **400 报错** |
| M2.x | 开 | 开 | 被接收但**不生效** |

> 官方错误原文（A）：`model "MiniMax-M3.1-Flash" requires adaptive thinking; thinking.type="disabled" (including reasoning.effort=none) is not allowed (2013)`

**推论（手册必写）**：同一份 system 在 MiniMax 的两个兼容协议上，**推理行为可能相反**。移植 agent 时必须按协议分别测，不能假设 system 文本决定了行为。

档位：`low / medium / high / xhigh / max`，**省略即 max**；`none`/`minimal` 均被禁（A，工具接入页逐字）：OpenClaw 页「始终开启思考，无法关闭。运行时不要使用 /think off」；Hermes 页「可用档位为 low…max；请勿使用 none 或 minimal」。

本地侧不一致（B）：vLLM Ascend 教程 `chat_template_kwargs.thinking_mode` 未设置默认 **adaptive**；而 `MiniMax-AI/MiniMax-M3` README（push 2026-07-11，早于门槛）列 enabled/adaptive/disabled 三模式——**与平台文档只列 adaptive/disabled 不一致**，写解析器要两头兼容。

---

## 2. system 与思考/预算的耦合：官方把「思考」完全划给了参数

- **effort 只由请求字段控制**：Anthropic `output_config.effort`／OpenAI `reasoning_effort`／Responses `reasoning.effort`。官方文档**没有任何**「在 system 里写思考指令」的表述；且 `reasoning_effort` 标注「仅 MiniMax-M3.1-Flash 生效」，**不是通用 M 系列控制项**（A）。
- 官方指引原文（A）：「如需减少思考带来的耗时和 token 用量，**请调低 effort 档位，而不是关闭思考**。」
- 推断（**非官方原文，标明**）：往 system 里塞 `think harder` / `step by step` 类指令在 MiniMax 无官方依据；档位应放请求参数或 harness 配置（Codex 用 `default_reasoning_level`）。
- **思考与回答字段级分离后，system 不再承担「输出隔离」职责**（A，models-intro 逐字）：「思考内容与最终回答分开返回：在 OpenAI 兼容协议下，思考内容固定通过 `reasoning_content` 字段单独给出，`content` 只含最终回答，可以直接用于展示，**不需要从〈think〉标签里自行解析**」。
- `reasoning_split` 现状（A，live）：`true` → thinking 拆到 `reasoning_content`；`false` → thinking 以成对 think 标签保留在 `content` 内；**M3.1-Flash 不支持 `false`**（等于强制 split）；且「reasoning_split **不会开启或关闭 thinking**」（它只管位置，不管开关）。
- 预算联动（A，两协议表逐字）：`max_tokens` / `max_completion_tokens`「**思考 token 也计入此上限，设置过小会导致 finish_reason 为 length 且 content 为空**」→ **写长 system 时必须连带给思考留预算**；档位越高「输出的 thinking token 和响应耗时也越多」。M Plan 文档把 effort 与上下文瘦身并列为两大成本杠杆：「如果额度消耗较快，可以为简单任务选择较低的思考深度，适时开启新会话，并只引入完成任务所需的文件」。

---

## 3. 门槛内核心增量：官方开源的 agent prompt 资产（可直接读、可核提交日期）

`MiniMax-AI/minimax-code`（MIT，created 2026-06-01，快照公开 09-18 / 09-29，HEAD 2026-10-20）。A 级。

### 3.1 静态人设：`packages/local-runtime-v2/assets/agents/_default/prompt-base-all.md`（7678 B）

分节：`Harness` / `Tool Usage` / `Memory` / `Recoverable Deletion` / `Output Conventions` / `Media Output`。三个可直接抄的官方写法要点：

- **Preamble messages 原则**（官方对「工具前言该怎么写」的长度规定）：**「逻辑成组、1–2 句、8–12 词」**。
- **记忆的判据写成一句可操作问题**：「未来的 agent 是否会因为我写的这条而行为更好」——并明确禁写一次性事实与临时事实清单。
- **语言条款**：`Match the user's language naturally`（Output Conventions 节）。
- 交付协议：Media Output 节定义〈deliver-assets〉〈media /〉自述标签。

### 3.2 身份句：`prompt-session-root.md`（284 B，原文逐字）

```text
You are this agent's root session — the user's primary conversation entry point and long-lived continuity owner.
```

另有 `prompt-base-worker.md`（617 B），只保留 Basics + Communication 两节——**官方按角色给不同体量的 system，而不是所有 agent 共用一份长人设**。

### 3.3 动态状态：独立模块 `packages/agent-modules/system-reminder`

`blocks.ts` 头注说明：纯函数产出注入〈system-reminder〉容器的 XML/markdown 块。→ **官方把「静态人设（prompt-base）」与「动态状态（system-reminder 注入）」物理分离**，这就是「静态前置/动态后置」在 agent harness 层的实现方式（与 §4 的前缀顺序互为因果）。

### 3.4 官方身份句的另一处：Codex `base_instructions`（A，2026-09-20 爬）

官方对该字段的释义：「Codex 使用该模型时附加的基础 system prompt，**可用于声明模型身份和协作方式**」。M3 版原文（10-19 前快照）：

```text
You are Codex, a coding agent based on MiniMax-M3. You and the user share the same workspace and collaborate to achieve the user's goals.
```

M3.1-Flash 版仅换模型名。这是门槛内**官方亲自撰写并维护的「身份 + 协作方式」两段式人设范式**。

### 3.5 仍在但已停更的资产

- `MiniMax-AI/Mini-Agent` 的 `mini_agent/config/system_prompt.md`：最后提交 **2025-11-07**（7a3b2481），**2026-09 后无变更**，HEAD 2026-02-14；现行文件 3208 B。范式＝分类小节 + 短命令式 bullet：`Be concise but thorough in responses`、`Don't guess - use tools to discover missing information`、`Stay focused - stop when the task is fulfilled`；含 **Progressive Disclosure 三级技能加载协议**（Metadata → get_skill → Resources）与 `{SKILLS_METADATA}` 占位符——即「静态骨架 + 动态插槽」的标准实现（**早于门槛，仍可作范式引用，但不得称 9 月后新口径**）。
- **平台文档 `grep "Your name is" 零命中**（A，live）：M3/M3.1 时代官方**未再发布**带身份行的默认 system。

---

## 4. 缓存与前缀纪律（system 长度的真实约束）

- 前缀顺序（A，live text-prompt-caching 逐字）：「缓存采用前缀匹配的方式，以**「工具定义 - 系统提示词 - 历史对话内容」为顺序**构建，**任意模块内容的变更，都可能会影响缓存的效果**」。
- 最佳实践（A 逐字）：「在对话的开头部分放置静态的或重复的内容（包括工具定义、系统提示词，历史对话内容），将动态的用户信息放在对话的最后，以最大程度利用 cache」。
- **门槛值 512 token**（A）：「缓存适用于包含 **512 个及以上**的输入 token 数量的 API 调用」→ system 过短就进不了缓存。
- 命中计量字段：Anthropic 侧 `usage.cache_read_input_tokens`；OpenAI 侧 `usage.prompt_tokens_details.cached_tokens`（A）。
- ⚠️ **显式断点 API 面临失效**（A→失效风险）：09-10 抓到的「Anthropic 主动缓存」页曾给 `cache_control` 断点、前缀顺序 `tools → system → messages`、单断点 + 最长前缀检查 + 「20 块回溯窗口」；**2026-10-20 实测该 URL 已改为承载「Prompt 缓存（自动）」页**。→ 手册应以「**前缀顺序**」为规则、把「断点 API」当可能失效的实现。
- 成本含义（A）：M3.1-Flash 输入 ¥1.00/百万、**缓存读取 ¥0.10/百万**（英文版 $0.15 / $0.015）→ system 前缀命中后成本约 **1/10**。官方 Codex 集成文档实测口径：「512K 与 1M 窗口下的平均模型表现接近，**512K 的估算费用低约 20%**」，并解释 MSA 稀疏注意力下窗口越大单 token 计算越贵 → **1M 上下文 + 长 system + 全历史回传是主要成本面**。
- 官方缓存示例的 system 原文（A，注意结尾带换行符 `\n`，属缓存前缀敏感字符）：`You are an AI assistant tasked with analyzing literary works. Your goal is to provide insightful commentary on themes, characters, and writing style.`

---

## 5. 消息回传纪律：system 之外最大的一条 prompt 工程约束（全 A，逐字）

- Anthropic 页：「将**完整的 `response.content`（包含 thinking/text/tool_use 等所有块）**添加到消息历史」；「必须完整回传」；「当响应包含 thinking 内容块时，后续轮次中应**原样保留**这些内容块，尤其是在工具调用对话中」。
- OpenAI 页：含 tool_calls 的完整 response_message 入历史；「MiniMax-M3.1-Flash 的模型思考内容通过 `reasoning_content` 字段单独提供，**同样需要完整保留**」。
- text-m3-function-call 指南：「它的核心是：**回传每一次模型 Response 的全部信息，尤其是其中的思考字段（thinking / reasoning_content）**」；「**解析时请先判断字段是否存在，无论本轮是否包含思考内容，都需要完整回传模型返回的消息**」；「重要提醒：为了保证 Interleaved Thinking 的生效、模型思维链不被打断……必须被保留在 Message History 中，在下一轮调用中回传给模型。如此才能发挥模型的最佳性能！」

**这条不该写进 system**（写进去也不解决问题），它是**客户端契约**；但它决定了 system 的一个写法约束：**别在 system 里要求模型「记住上一轮想过的东西」**——记忆由回传的思考序列承载，不是由提示词承诺承载。

---

## 6. 结构化输出：MiniMax 是四家里最「不提供 schema 通道」的一家

- **三个协议的参数表均无 `response_format`**（A：全文档 dump 检索 `response_format` 仅命中语音/ASR/文件接口）。
- 官方文字里唯一的 JSON 出口是官方 CLI 的一行功能名：`mmx text chat`「多轮对话、流式输出、系统提示词、JSON 输出」（A，minimax-cli 页 10-03 爬）。
- **官方没有给出「system 里怎么写 JSON」的任何条款**（A，负结果）。
- 采样面连带结论（A）：`temperature` / `top_p`「**暂不支持指定，传入的值不会生效**」（固定 1 / 0.95，Anthropic 侧标"忽略"）；`top_k`、`stop_sequences`、`context_management` 一律"忽略"；官方**未提供经 system 改采样行为的通道**。

**落地做法**：JSON 约束只能写进 prompt 文本（建议写成 system 的输出契约 + 一个字段清单示例），业务层必做二次校验；**别写 `response_format`**，那是中继站卡片里的假能力（§8.3）。

---

## 7. 人设能力边界的官方口径（以及一条要紧的第三方信号）

- 门槛内**未找到**官方新的 role-boundary 表述。现行官方口径仍是 **M2.7 发布文（2026-03-18，早于门槛，保留）** 原文：

  > "role boundaries, adversarial reasoning, protocol adherence, and behavioral differentiation — **these cannot be achieved through prompting alone** and must be internalized as native capabilities of the model."

  同文：「On MM Claw testing, M2.7 maintained a **97% skill compliance** rate across 40 complex skills (each exceeding 2,000 tokens)」。
- **M3.1-Flash 发布文（10-19）通篇无人设/system 相关表述**（已全文核对）——能力叙事全走基准与价格。
- M3 发布文（2026-06，早于门槛）承认基准口径：「When using Claude Code, **the default system prompt was overridden**」→ 官方自己说明：跑分里的人设由脚手架覆盖，**不是模型默认**。
- **C 级要紧信号**（10-20 亿邦转述 AA 评测）：M3.1-Flash「会尝试回答所有问题，遇到不确定的内容**极少拒答**，幻觉率 93%」——**官方未回应**。手册结论：**拒答/事实校验类约束不能指望人设自带，必须由 harness 护栏（工具校验、引用要求、二次核验）承担**。

---

## 8. 条款归属澄清（本轮专查，5 条）

| # | 流传条款 | 真实出处 | 结论 |
|---|---|---|---|
| 1 | 「多轮对话**只将 content 回传、不回传 reasoning_content** 以省 token」 | 腾讯云《MiniMax 调用指南》（B，06-11 爬） | **与 MiniMax 官方"完整回传思考字段"直接相反**。属托管平台自家旧规（同文 temperature 0-1 默认 0.9、上下文 200K 均为 M2.x 旧规格）。**不可冠名"MiniMax 官方要求"** |
| 2 | 「M2.5 于 8/7 下线」「m3 自 8/4 下线」「M2.1 于 7/9 下架」 | 腾讯云 TokenHub/CloudBase、火山引擎、阿里云百炼 | **各家时间表互不适用**。MiniMax 官方口径＝**停新用户 10-19、正式下线 11-18**。百炼页自证「以上模型为 MiniMax 直供，非部署在阿里云百炼服务器上」→ **直供调用 ≠ 其文档为官方文档** |
| 3 | 「MiniMax 支持 json_schema 强制输出 / 合规率 100%」 | apiyi 等中继站模型卡片（"结构化输出 ✅"）+ php.cn 农场文（08-13，还虚构 `response_format` 用法） | **均属第三方声称**（D）。官方参数表零命中 |
| 4 | 「`x-cache: HIT` 响应头 / `X-Minimax-Debug` 调试头 / 返回 `cache_key` / 在 messages 首位插入空 system 可清除历史 KV 缓存 / 禁用 system prompt 强制清空上下文」 | php.cn（06-10/06-11/06-17） | **农场假官方，全部不采信**（D） |
| 5 | 「xhigh 是编程甜点 / 七档」 | 微博 07-01、CSDN 05-29 | 讲的是 **Anthropic Opus 4.8 / Claude Code**，不是 MiniMax。**MiniMax 官方仅定义五档名称、默认 max 与"越高越充分"，未发布任何场景推荐档** |

---

## 9. 可直接落地的 MiniMax 系统提示词骨架（每块标出处）

```text
【system（Anthropic 兼容走顶层 system；旧式 OpenAI 网关合并成一段，别指望多块）】

1. 身份 + 协作方式（两段式，锁一句）        ← A：Codex base_instructions 官方范式
   "You are {产品名}, a {领域} agent based on MiniMax-M3.1-Flash.
    You and the user share the same workspace and collaborate to achieve the user's goals."
   ⚠ 模型名换代后必须同步改（M2.x 身份行已随下线失效）

2. Harness 事实（终端渲染/权限模式/被拒即调整/并行独立调用）  ← A：prompt-base-all.md `Harness` 节
3. 工具前言规则：逻辑成组、1–2 句、8–12 词    ← A：官方 Preamble 原则（照抄这三段长度纪律）
4. 记忆判据：只写「未来的 agent 是否会因这条而行为更好」的内容 ← A：Memory 节
5. 输出契约：`Match the user's language naturally` + JSON 时给字段清单与示例 ← A/C §6
6. 删除与不可逆动作的显式边界               ← A：Recoverable Deletion 节

【不要写进 system】
- 「请深度思考 / step by step / think harder」   ← A：effort 只由请求字段控制，官方无 system 思考指令
- 「请保留上一轮思考」                       ← A：属客户端回传纪律（§5）
- response_format / json_schema 相关承诺        ← A：参数表无此字段
- 温度、top_p、stop、penalty 相关期望          ← A：传入不生效/被忽略

【请求侧（决定 system 能否成立）】
thinking 必为 adaptive（M3.1 传 disabled→400）；effort 显式写、别依赖「省略即 max」
按协议分别测（M3 在 OpenAI 端省略→开、Anthropic 端省略→关）
max_tokens 给思考留预算（过小 → finish_reason=length 且 content 空）
前缀顺序 tools→system→messages，system ≥512 token 才进缓存（命中约 1/10 价）
工具按需加载以稳住前缀；动态状态走〈system-reminder〉注入（官方 system-reminder 模块范式）
```

---

## 10. 反模式（门槛内证据）

| 反模式 | 后果/依据 | 级 |
|---|---|---|
| 用 `thinking.type:"disabled"` 关 M3.1-Flash 思考 | **400**，错误码 2013 | A |
| 依赖「省略 effort」 | 省略即**最重的 max 档**；社区批评「想让它快，得自己动手往下调」 | A + C |
| 用 `none` / `minimal` 档 | 官方明令禁止（Hermes 页） | A |
| 在 system 里写思考指令 | 无官方依据；档位属请求参数 | A（缺证声明）+ 推断标明 |
| 期望 `response_format` 生效 | 三协议参数表零命中，中继卡片假能力 | A + D |
| 只回传 `content`（腾讯云口径） | 与官方相反，打断 Interleaved Thinking | B（误归属） |
| 把日期/技能清单/临时状态写进静态 system | 官方把动态状态放进 `system-reminder` 模块；且破 512-token 前缀缓存 | A |
| 长 system 不给思考预算 | `content` 空 + `finish_reason=length` | A |
| 沿用 `Your name is MiniMax-M2.x` 身份行 | 模型 11-18 下线、套餐已路由 M3.1-Flash，身份与后端不再对应 | A |
| 靠人设兜「拒答/不幻觉」 | 第三方评测指其极少拒答（幻觉率 93%，官方未回应）→ 必须 harness 护栏 | C |

---

## 11. 门槛外残留证据（早于 2026-09-01，仅在无更新数据时保留）

M1 README「两个杠杆＝推理参数 + System Prompt」（无 9 月后替代文档）｜M2.x 身份行 system（README 最后更新 2025-02~2026-04）｜Mini-Agent `system_prompt.md`（2025-11-07）｜M2.7 人设边界与 97% skill compliance（2026-03-18）｜M3 博客 default-system-override（2026-06）｜M2-her 角色规范页（`guides/text-chat` 10-09 仍在架，但 faq/models 10-19 已列 M2-her 下线——**文档与模型状态失同步，引用需谨慎**；其「system 定义 AI 的基本行为、`user_system` 定义用户身份」「用 `sample_message_user`/`sample_message_ai` 给 1–3 个示例对话」仍是官方唯一的"用户人设"专章）｜主动缓存断点页（09-10 爬，现被并入自动缓存页）｜泄漏库 `Misc/minimax-m2.5.md`（捕获 2026-02-25，5224 B）｜vLLM Ascend `thinking_mode` 默认 adaptive｜M3 README enabled/adaptive/disabled（2026-07-11 push）。

**公开样本范式（C，不可照抄）**：M2.5 泄漏人设的结构是「机器提醒开场（声明本消息非用户消息）→ 编号绝对规则块（RULE 0 先查工具与 system／RULE 1 编码·设计·调研必须先调 deep_thinking／RULE 3 web 项目 playwright 测试-修复-重部署／RULE 4 引用规范指针）→ 「违规＝失败」式验收语」。可取的是**短命令式 + 显式验收 + 把思考工具化前置**这三点结构。

**门槛内社区实操（C，只作结构参考）**：① PowerContext 插件（cnblogs 2026-10-09）在系统级提示词注入工具路由规则「查历史必须调 search_memory、记录必须调 remember_memory，严禁盲目翻本地文件」；② evolink 协议清单（10-20）「追加工具结果前，先写入完整 assistant 响应。Chat 保留存在时的 reasoning_content 和所有 tool_calls；Messages 保留完整内容块列表。**简单轮次可能没有思考字段，要允许缺失**」；③ cnblogs 09-28 建议把档位策略写进 harness 配置而非依赖 model 默认；④ margrop 09-27 的「默认 Medium / 极速 Low / 攻坚 Max」三分法（**该文称"四档"与官方五档不符：采其分法、弃其数**）。

---

## 12. 门槛内未找到（如实记录，不作臆断）

1. 2026-09+ 官方针对 M3.1-Flash / M3 的 **system prompt 模板或写法指引**（搜遍 platform 全站、博客、README；M3.1 发布文零提及）。
2. **官方「要 JSON 时 system 怎么写」**的任何条款（搜 `response_format`、结构化输出、`json_object`、JSON 输出：仅 CLI 一行功能名）。
3. system 提示词的**长度上限 / 计费专项条款**（只有通用 512-token 缓存门槛与 `max_tokens` 预算条款）。
4. 2026-09+ **官方新人设能力边界表述**（`role boundary` / `protocol adherence` 类口径无 9 月后新文；"MiniMax prompting alone" 仅命中 03-18 旧文）。
5. 2026-09+ **捕获的 MiniMax 产品端泄漏 system prompt**（泄漏库仅 2026-02-25 一条；MCode 开源的是 prompt-base 组件 + reminder 模块，**未见产品端完整装配全文公开**）。
6. effort **各档位的延迟/token 官方数字**（cocoloop 09-28 亦指出文档未给；M 档 vs max 档实测对比缺失）。
7. M3.1-Flash 的 `service_tier` 是否将支持、官方缓存命中率数字。
8. MiniMax Agent（agent.minimax.io）现行端侧默认人设原文（changelog 仅披露计费拆分项：**按消息、工具、技能、系统提示词、记忆拆开展示上下文占用**——09-07 爬，值得注意：官方产品把 system 单列为一个计费/占用维度）。
9. HuggingFace 直连不可达，**M3.1-Flash 权重页（官方称 2026-10-23 开放、许可未公布）未验证**。
