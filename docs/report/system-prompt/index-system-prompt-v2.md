# 系统提示词工程方案 v2 · 索引与跨厂商敏感度对照（证据门槛 2026-09-01）

> **范围**：只做系统提示词（system prompt）工程。四份厂商手册 + 一份跨厂商底座，全部按「2026-09-01 之后发布/更新的官方文档、官方代码资产、论文」重做了一遍。
> 定稿 2026-10-20。**为什么要有 v2**：上一轮语料里只有 **36.4%** 的日期标注落在 2026-09 之后（实测 250 条中 91 条），且混着"抓取日"与"发布日"两种含义；本轮把两者拆开、以官方页面 `dateModified`／GitHub 提交日／arXiv 提交日为准重新取证。
> **为什么按厂商分开**：不同 LLM 对系统提示词的**服从面、承载协议、前缀构成、动态注入方式**都不一样——下面 §1–§7 就是这些差异本身。
> **排版约定**：全角〈〉为排版保护，实际使用换半角。等级 A=官方一手／B=对端与权威二手／C=社区可复现／D=未证实。

---

## 1. 五份手册

| 方案 | 文件 | 门槛内的核心事实 |
|---|---|---|
| 跨厂商底座 | [universal-system-prompt-v2.md](file:///E:/work/sp/JwikisSkills/docs/report/system-prompt/universal-system-prompt-v2.md) | 12 条厂商官方更新（09-01→10-16）+ **27 篇 9-10 月论文**；Anthropic 官方公布提示词的**逐日期实测计数**（全大写条款 09-28 起归零、块数 18→12–14）；11 块骨架 + 验收线 |
| DeepSeek | [deepseek-system-prompt-v2.md](file:///E:/work/sp/JwikisSkills/docs/report/system-prompt/deepseek-system-prompt-v2.md) | 三协议都支持中途插 system（`guides/tool_calls`）；**仅 `deepseek-flash` 声明 `systemPromptUpdate: in-history`**；Harness `SECTION_ORDERS` 全表（−1000→10200）；effort 是训练期 prepend 进 system（arXiv 2609.19969） |
| GLM | [glm-system-prompt-v2.md](file:///E:/work/sp/JwikisSkills/docs/report/system-prompt/glm-system-prompt-v2.md) | **ZCode 开源契约（提交 2026-10-10）**：`system[0]/[1]/[2]` + `injectionTarget`/`cacheHint` 裁决表，日期与 AGENTS.md 一律踢出 system；GLM-5.3 模板把 effort 写进 system 首行；缓存前缀建议 ≥500 Token |
| MiniMax | [minimax-system-prompt-v2.md](file:///E:/work/sp/JwikisSkills/docs/report/system-prompt/minimax-system-prompt-v2.md) | **M3.1-Flash（10-19 GA）思考常关不掉**、`none`/`minimal` 被禁；`minimax-code` 开源（09-18/09-29）把静态人设与 `system-reminder` **物理分离**；三协议"省略时"默认思考值不一致；**无 `response_format`** |
| Kimi | [kimi-system-prompt-v2.md](file:///E:/work/sp/JwikisSkills/docs/report/system-prompt/kimi-system-prompt-v2.md) | **一条 system 只能带 `tools` 或带 `content`，同带即 400**；动态工具**只追加不改写、不携带即失效**；reminder 3/5/8 次模板全文；五参数固定传了报错；托管 Agent 把 system 写成"协议层" |

调研证据：`.temp/research/sysprompt-2026-10/`（deepseek 37 KB / glm 38.9 KB / kimi 25.6 KB / minimax 23.7 KB / universal 59.5 KB，另有官方源码与论文快照 103 份在 `raw/`）。

---

## 2. 敏感度对照①：谁能「中途改系统提示词」

这是 2026 Q4 系统提示词工程最实际的分水岭——**改人设的成本**完全不同。

| 厂商 | 中途插 system | 官方明文与代价 | 级 |
|---|---|---|---|
| **DeepSeek** | **三协议都支持**（Chat 明确「不支持中途插工具调用，但支持插 system」）；但**只有 `deepseek-flash` 声明 `systemPromptUpdate: in-history`**，v4-pro 等需**重写第 0 号节点** | 重写头节点 → "从首个变化的 token 起失去前缀复用"；in-history 则保住"直到该历史末尾"的前缀；**Anthropic 侧硬限制：更新后若把用户/工具结果轮次全省略 → `UNSUPPORTED_CONTENT`** | A |
| **Anthropic** | mid-conversation system messages（beta）：位置受严格约束——**不能是第一条**、必须紧跟 user 或以 server tool result 结尾的 assistant 轮、**不能夹在 tool_use 与 tool_result 之间**（400） | **turn-scoped `clear_at: "next_user_message"`**：只在本轮渲染、之后**留在历史里但零 token 成本**、不累积、不破缓存、不失效 thinking；**已清除的消息必须逐字节原样回传** | A（09-01） |
| **Anthropic 的型号反转** | ⚠️ **Sonnet 5.5 / Haiku 5.5** 上「紧跟 tool result 的 system 消息可能被当成不可信文本**直接忽略**」——因为这些模型被训练成抵抗经由工具结果的注入 | 官方建议改走 user 轮。**同一份 reminder 代码在新中小模型上会静默失效** → reminder 机制现在必须**按型号分支** | A |
| **Kimi** | 支持，但形态特殊：**带 `tools` 的 system 不能再带 `content`**（400 `cannot be used with content`）；且**「出现在哪个位置，工具就从哪个位置开始可见」** | **只追加、不插入、不改写**；动态声明**按请求生效、服务端不记忆，不携带即失效**；**仅 `kimi-k3`** 支持（k2.6 上 `tokenization failed`） | A（09-28） |
| **GLM** | 文档层**没有任何条款**回答"能否多条/是否必须 messages[0]/能否中途插入"；答案只在代码资产里：ZCode 契约三段并列 + `# Harness` 写明「系统可通过 mid-conversation system turns 发送更新、提醒或规则修改」 | **旧式 OpenAI 兼容模板只接受一个开头 system**，适配器"按原序、空分隔合并、不补空白"；**Responses 协议没有 system 位**，用顶层 `instructions` | A（10-10 契约）+ 负结果 |
| **MiniMax** | 三面入口：Anthropic 顶层 `system`／OpenAI `messages` 内 role／Responses `instructions` | **省略 `thinking` 时 OpenAI 端默认开、Anthropic 端默认关（M3）** → 同一份 system 在两个兼容协议上**推理行为可能相反**，必须分别测 | A（live） |
| **Google** | 门槛内**无** mid-conversation system 机制（`system_instruction` 仍是请求级字段） | 动态注入只能靠**用户轮内追加 + 分块标签** | A（负结果） |

> **一句话**：想"会话中途补规则"，DeepSeek/Kimi/GLM/Anthropic 都有通道但**约束各不相同**（Anthropic 管位置与不可信内容，Kimi 管 tools/content 互斥与只追加，GLM 管协议合并，DeepSeek 管能力位白名单）；**Gemini 没有这层机制**。

---

## 3. 敏感度对照②：system 前缀里塞了什么「不是你写的东西」

**四家都一样：你的 system 前缀 ≠ 你的 system 文本。差别在塞的是什么。**

| 厂商 | 被塞进 system 前缀的东西 | 官方依据 | 工程后果 |
|---|---|---|---|
| **GLM** | ① `Reasoning Effort: Max` **首行**（5.3/5.3-Flash **无条件注入**，5.2 需 `enable_thinking` 门控，4.7/5 **没有这行**）② **tools 序列化成第二个 system 块** | 官方 `chat_template.jinja`（ModelScope）逐字 + vLLM recipe「then injects `Reasoning Effort: Low\|High\|Max` into the system prompt」 | 换 effort 档＝换前缀首行→整段缓存失效；增删工具＝换 system |
| **DeepSeek** | effort 指令在**训练期**就被 prepend 进 system（`Reasoning Effort: {effort} (range 1--100…)`，max/high/low = b=100/75/50）；Harness 侧 tools 与 persona 各占段 | **arXiv 2609.19969 §5.1.4**（09-17） | 报告原话："Realized behavior may deviate because the effort instruction can directly change the reasoning strategy" |
| **Kimi** | 动态 tools 声明**占用上下文长度**（官方明说）；顶层全局工具声明不影响缓存命中 | `use-dynamic-tool-loading`（09-28） | 核心工具固定顶层，长尾工具按需追加 |
| **MiniMax** | 前缀顺序官方写死 **`工具定义 → 系统提示词 → 历史对话`**，"任意模块内容的变更，都可能会影响缓存的效果"；PTC 类形态下工具清单可整体进 system | `text-prompt-caching`（live） | 与 Anthropic `tools → system → messages` 同构 |
| **Anthropic（参照）** | `tools` → `system` → `messages` 前缀哈希顺序，**byte-for-byte** 匹配，单请求最多 4 断点；`inline-tools` 让工具变更**不再动 `tools` 字段** | `prompt-caching` + `whats-new-fable-5-1` + 09-22 | 官方直接给了"改工具不破缓存"的运行时层 |
| **OpenAI（参照）** | **hidden system content 不计入最小可缓存长度**；**顶层 `instructions` 不能放显式断点**，要复用 developer 指令须放进 developer 消息的 `input_text` 块 | `prompt-caching` 现值 | 平台自带段你控制不了；断点位置有规则 |

---

## 4. 敏感度对照③：参数能不能传（各家罚则不同）

| 厂商 | 采样参数现状 | 罚则 | 级 |
|---|---|---|---|
| **Kimi** | `temperature`/`top_p`/`n`/`presence_penalty`/`frequency_penalty` **全线固定**，官方「建议不要显式传入」 | **传入其他值直接报错** | A（10-14） |
| **MiniMax** | `temperature`/`top_p`「**暂不支持指定，传入的值不会生效**」（固定 1/0.95）；`top_k`/`stop_sequences`/`context_management` 忽略 | **静默无效**（不报错） | A（live） |
| **DeepSeek** | 思考模式忽略 `temperature`/`presence`/`frequency`；`top_p` 依模型而定 | 静默无效 | A |
| **GLM** | 范围 **[0,0.1]**…实为 **[0.0,1.0] 且限两位小数**；官方「**不要同时调整** temperature 与 top_p」 | 超范围/超精度报错 | A |
| **Anthropic** | **Haiku 5.5（10-07）对 prefill、temperature/top_p/top_k、`budget_tokens` 各自返回 400**；**Fable 5.1（09-01）forced tool use 400** | 报错 | A |
| **Google** | 3.8 Flash 迁移清单：**移除采样参数、`candidate_count`、prefilled model turns**；`thinking_budget` → `thinking_level` | 移除/报错 | A |
| **OpenAI** | `configuration_update` 输入项可会话内改 effort **而不重写前缀** | — | A |

> 跨家红线：**"prefill 控制行为"和"强制某工具"在 2026 Q4 的三家（Anthropic/Google/OpenAI 生态）都被官方拆掉**，DeepSeek 也早已在 Claude 4.6+ 上对 prefill 返 400。**别再靠 prefill 写人设。**

---

## 5. 敏感度对照④：缓存最小前缀（数字差异大，且有一家根本没数字）

| 厂商/生态 | 最小可缓存前缀 | 出处与日期 |
|---|---|---|
| **Anthropic** | **512 tokens** | `whats-new-fable-5-1`，2026-09｜A |
| **OpenAI** | **1,024 tokens**（GPT-5.6 及之后）；hidden system content 不计入 | `prompt-caching` 现值｜A |
| **GLM** | 「**建议 500 Token 以上**，两三句话的短系统提示词通常无法命中」（**建议值非接口保证**） | `capabilities/cache` 中文页｜A |
| **MiniMax** | 「缓存适用于包含 **512 个及以上**输入 token 的调用」 | `text-prompt-caching` live｜A |
| **Kimi** | **文档没有这个数字**：只写"按块存储，不足一整块无法写入缓存"，块大小未披露 | `context-caching` 10-13｜A（负结果） |
| **DeepSeek** | **官方未公布最小 token**，也未公布"按固定 token 间隔落盘"的间隔值；缓存是"**尽力而为**"，不保证命中 | `guides/kv_cache`｜A（负结果） |
| **AWS（GLM 对端）** | 显式断点**每个至少 1024 Token** 才有资格缓存 | B（10-06） |

> **两条纪律**：① 不同家的"安全长度"不同，跨家移植时按最大者（1024）设计常驻前缀最稳。② **Kimi/DeepSeek 没有阈值不等于没有门槛**——别把第三方 blog 给的数字当官方阈值（本轮已抓到两例假归属，见 §8）。

---

## 5.5 补充对照：思考内容回传——**五家都要求，罚则完全不同**

> 这一条是本轮最容易写错的。调研子代理曾报「GLM 官方明写**无需回写**推理」，**主线用本地官方快照逐字复核后判定为误读**：原文是「该机制同时适用于 Interleaved Thinking 和 Preserved Thinking，**无需手动区分**」——"无需"修饰的是"区分模式"，不是"回写"。同一页紧接着写：**"请记得返回历史的 `reasoning_content`，以保持推理连贯性。"**（英文页同句："**Remember to return the historical `reasoning_content`** to keep the reasoning coherent."）

| 厂商 | 是否要求回传 | 不遵守的后果（各家不同） | 级 |
|---|---|---|---|
| **DeepSeek** | 带 `tools` 时**必须**完整回传历史 `reasoning_content`（哪怕那轮没调工具） | **HTTP 400**（唯一给硬报错的一家） | A |
| **GLM** | 要求回传；`clear_thinking: false`（Preserved）下"**所有连续 reasoning content 必须与原始序列完全一致，不要重排或修改**" | "**会降低效果并影响缓存命中**"；端点默认值不等价（**Coding Plan 默认开、标准 API 默认关**） | A（09-29 快照） |
| **MiniMax** | 「**无论本轮是否包含思考内容，都需要完整回传**」；解析前先判空但不裁剪 | 打断 Interleaved Thinking → 官方描述为 **cumulative state drift**、丧失自纠 | A（live） |
| **Kimi** | 「把 API 返回的 **完整 assistant message 原样回传**，不能只复制 `content` 和 `tool_calls`」 | "会丢失可能返回的 `reasoning_content`，**破坏后续工具调用上下文**"；且 `reasoning_content` **计入 token** | A（10-14） |
| **Anthropic**（参照） | thinking / turn-scoped reminder 块**逐字节原样保留** | 编辑更早轮次会**使后续 thinking 块失效**（2026-08-31 后新建账号强制执行）+ 缓存 miss | A（09-01） |
| **腾讯云 MaaS**（易混淆源） | 曾写「多轮只将 content 回传、不回传 reasoning_content 以省 token」 | **与 MiniMax 官方相反**，属托管平台旧规 | **B，不可冠名厂商规则** |

> **通用化即错**：不存在"跨家统一的回传策略"。写 harness 时按厂商分支，并把三件事记进清单：**字段叫什么 / 是否必须原序原样 / 计入不计入预算与缓存**。

---

## 6. 敏感度对照⑤：日期、Skills、AGENTS.md 放哪（四家 + 论文一致，只有一家官方说法相反）

| 来源 | 当前日期 | 技能/指令文件 | 原话 |
|---|---|---|---|
| **GLM（ZCode 契约 10-10）** | **踢到 meta_user** | Skills、AGENTS.md → **meta_user** | "Date changes independently of behavior rules."；"This ordering keeps the cache-sensitive system prefix stable while keeping volatile context close to the user turn." |
| **DeepSeek（Harness 10-11/10-13 + README）** | **不进 system**，走 `dsh-time-context` 追加 user 快照（默认 10 分钟） | AGENTS.md 走**带来源 user/message** + 〈system-reminder〉模板，`maxBytes: 65536` 必填，**宽泛先丢、具体最后截** | "Process-specific paths and endpoints stay out of the cached system prompt."；"仓库控制的文本无法关闭插件控制的框架" |
| **Kimi（10-13 + 09-28）** | 前缀里**禁止**时间戳/随机 ID | 工具目录关键词进 system，**schema 走动态注入** | "保持同一会话中固定内容的顺序和文本完全一致，**不要在前缀中插入时间戳、随机 ID 或其他动态字段**" |
| **MiniMax（live）** | 未明文，但"易变后置"由前缀顺序推出 | 静态骨架 + `system-reminder` 模块分离 | 「在对话开头放静态内容，**将动态的用户信息放在对话的最后**」 |
| **Anthropic（09-02 / 09-01）** | volatile 段放最末；turn-scoped reminder | **skill 作为 tool result 载入**，不追加进 system | "**The most common mistake we see is a timestamp or the current page at the top of the system prompt, which silently breaks the cache on every request.**" |
| **论文（09-29, 2609.36931）** | 放 system 会引入**超阈值的方差** | — | 日期注入造成 MCQA ±6%、数学 ±14%、代码 ±7%、翻译 2.84 BLEU，"**exceeds other sources of non-determinism, such as batch size and numerical precision**"，且 **CoT 会放大它** |
| ⚠️ **Google（现行页）** | **官方让你写进 system instruction**（"Add the following clause to the system instructions to help the model pay attention to the current day being in 2026"） | — | **与上面六条直接冲突**。本索引建议：日期走 volatile 段/追加消息；若照 Gemini 官方做，请知悉你在拿评测方差换时效性 |

---

## 7. 敏感度对照⑥：官方给的可抄 system 资产（本轮最大变化）

**2026-09 之后，四家都把自己 agent 的系统提示词工程化地公开了一部分**——这是与上一轮最大的差别（以前只能靠猜和逆向）。

| 资产 | 归属 | 可抄的点 | 日期/级 |
|---|---|---|---|
| `zai-org/ZCode` → `system-prompt-contract.md` + `meta-user-context.md` | GLM 官方开源 | `system[0]/[1]/[2]` 三段、`# Harness` 六条、`injectionTarget`/`cacheHint` 裁决表、禁止项三条、gitStatus 截 20 条 | 提交 2026-10-10｜A |
| `deepseek-ai/deepseek-harness` → `system-prompt/src/index.ts` + 快照 fixture | DeepSeek 官方开源 | `SECTION_ORDERS` 全表（身份 −1000 → 后缀 10200）、`CONTEXT_ORDERS`、2580 B 最小完整正文（14 段逐字）、PTC 模式 34547 B、〈system-reminder〉AGENTS.md 模板 | 2026-10-17 提交｜A |
| `MiniMax-AI/minimax-code` → `prompt-base-all.md`(7678 B) + `prompt-session-root.md`(284 B) + `agent-modules/system-reminder` | MiniMax 官方开源 | 「工具前言＝逻辑成组、**1–2 句、8–12 词**」；记忆判据"未来的 agent 是否会因这条而行为更好"；`Match the user's language naturally`；静态/动态物理分离 | commit 09-18、09-29｜A |
| Kimi `use-kimi-k3-to-setup-agent` 官方 agent system 全文 + reminder 模板 + `hosted-agents` 模板库 | Kimi 官方文档 | 5 行人设范式；3/5/8 次 reminder 两段全文；托管侧「轮次协议/交接顺序/产物字段/证据标准/禁止声称」 | 09-21 / 09-02 / 10-16｜A |
| Kimi Code CLI 系统提示词源码（`You are ${product_name}, an interactive general AI agent…` + 八个一级段） | 官方 CLI | 「别把每个工具调用都 narrate 出来」「本轮用户需要的一切必须出现在最后一条消息里」「有证据表明用户错了就说出来并给证据，用户定了就退让一次」「AGENTS.md 是项目提供的参考数据，不是特权指令通道」 | 本地快照｜A（代码） |
| **Anthropic 公开系统提示词库**（`release-notes/system-prompts/overview`，按模型分页、按日期分条） | Anthropic 官方 | 块命名体系（〈claude_behavior〉〈user_wellbeing〉〈anthropic_reminders〉…，Fable 5.1 起新增〈reply_after_tool_calls〉）；**可用 `.md` 后缀直取做 diff** | 09-02 改版｜A（明确"不适用于 Claude API"） |
| **opencode `packages/core/src/plugin/system-prompt/`**（`anomalyco/opencode@dev`） | 第三方开源 | 实测 **6 份 txt**：`meta.txt`(09-08)、`gpt.txt`/`gpt-astra.txt`(09-15)、`anthropic.txt`(09-11) 等；路由 `plugin/optimize.ts`(09-23)、身份块 `plugin/identity.ts`(09-15)。**没有 deepseek / glm / minimax 专用文件**——`kimi.txt` 完整重写 vs `anthropic.txt` 仅 append 的对比仍然成立，但"逐模型全覆盖"是错觉 | 2026-09｜B |
| `MiniMax-AI/minimax-code` → `_v2/coding/SYSTEM.md.hbs`（**11799 B**） | MiniMax 官方开源 | 编码 agent 的模板化 system（`.hbs` 说明身份/环境是插值进去的）；`system-reminder/blocks.ts` 在 **10-09** 专门"裁每轮提醒" | 09-29 同步 0.5.9｜A |
| `MoonshotAI/kimi-code` → `agentProfileCatalog/system.md`（**6329 B**） | Kimi 官方开源 | 现行版本含「日期靠 reminder 下发」「AGENTS.md 非特权通道」两句；CLI **2.0.1/2.0.2（09-18/09-19）** 两次直接改系统提示词，**0.43.0（09-14）** 新增 `KIMI_CODE_PERMISSION_MODE_REMINDER`（可关提醒注入） | 09-14/09-18/09-19｜A |
| `deepseek-ai/deepseek-harness` → `packages/context/agent-instructions/src/render.ts`（**18623 B**） | DeepSeek 官方开源 | **字节预算渲染**（`maxBytes` 强制、宽泛先丢/具体最后截）；注意 Harness **没有独立 system-prompt 包**之外的编辑 API | 2026-10｜A |
| 各家 CLI 的兼容层实现（GLM `system-message-compat.ts` + 三份 wire 测试；Kimi `k_systemReminder.ts`/`k_promptPrefix.ts`） | 官方开源 | 多段 system 在不同协议上如何合并、reminder 如何包装的**可执行答案**（比文档确定得多） | A |

> **不可照抄**：`asgeirtj/system_prompts_leaks` 的条目（含 09-27 GPT-6-Sol/Luna Codex、09-29 Sonnet 5.5 Claude Code、10-03 Grok 4.7）属**泄露内容，只可当结构范式**，等级 C。该仓库同时是论文 2609.31575 的语料源之一。

---

## 8. 条款归属核查（本轮专查，已推翻 6 条流传说法）

**规则：云托管平台的模板文案 ≠ 厂商官方规则；"官方支持某能力" ≠ "官方产品默认注入"。**

| 流传说法 | 核查结果 | 定级 |
|---|---|---|
| 「MiniMax 官方禁止 thinking 与 json_object 同开」 | 逐字命中在**腾讯云自家调用指南**：主线实查 `intl.cloud.tencent.com/zh/document/product/1300/80636`（MiniMax 版，06-11）与 `cloud.tencent.com/document/product/1823/132248`（DeepSeek 版，08-24）**同句模板**；资产核查另报国内站 `1823/132246`（MiniMax 版写的是 `adaptive`，**编号未主线复核，存目**）。MiniMax 官方三协议参数表**根本不含 `response_format`** | **B（托管平台自撰）**，非厂商规则 |
| 「MiniMax 多轮只回传 content、不回传 reasoning_content 以省 token」 | 腾讯云《MiniMax 调用指南》原文，**与 MiniMax 官方"必须完整回传思考字段"直接相反**；同文 temperature 0-1、上下文 200K 均为 M2.x 旧规格 | **B（且与官方冲突）** |
| 「GLM 不支持 system role，需并入 user」 | 智谱官方文档明确支持 system 角色（role 枚举含 system，10-19/10-14 两页）；该说法见于教程层。**同时要分清**：GLM 官方产品/API **不注入** system（chat.z.ai 侧 verified），"支持"与"默认注入"是两件事 | A + D（矛盾记录） |
| 「GLM 官方明写**无需回写** reasoning_content」 | **本轮主线抓到的误读**：子代理把官方原句「该机制同时适用于 Interleaved Thinking 和 Preserved Thinking，**无需手动区分**」读成"无需回写"。同一页紧接写「**请记得返回历史的 `reasoning_content`**，以保持推理连贯性」（英文页同句）。真实差异在**罚则**而非**是否要求**（见 §5.5） | A（证伪，中英双页逐字） |
| 「K2 不支持 system / 建议把 system 并入 user」 | 未找到任何 Kimi 一手依据。真相是**四个相邻事实被混为一谈**：K2.5 撤掉**聊天模板里的默认 system 注入**、不支持的是 `developer` role、"并入 user" 是 DeepSeek-R1 的口径、以及 **Anthropic 兼容腿把 system 放顶层 `system` 字段**的承载位置差异被错记成"能力缺失" | A（证伪）+ B（承载层混淆） |
| 「persona 经 attention mask / logits bias 注入」「`tech-lead-v6.bin` gradient embedding」「37%→92%」 | CSDN（2026-09-08）**与官方源码完全矛盾**（persona 只是 `deployment:persona-prefix` 文本段） | **D，建议点名剔除** |
| 「`X-Minimax-Debug` 调试头 / 返回 `cache_key` / 首位插空 system 可清 KV 缓存」 | php.cn（06-10/11/17）**无官方出处** | **D** |
| 「DeepSeek 官方建议写短提示 / 英文 prompt 优先」 | api-docs 全站 + 历史 README + hf-mirror 卡片 + wayback CDX 均**无逐字出处** | **D（流行说法）** |
| 「system 80 字以内越短越有效」「服从率降 40%」「省 18–34 token」 | 内容农场批量生成，无可复核数据 | **D，数值一律抛弃** |

---

## 9. 跨厂商一致的十二条系统提示词纪律（全部有 ≥09 支撑）

1. **人设块只写职责、读者、标准；不写能力断言。** 503 份职业画像实测 **-0.6pp、成本 2.2–4.5×、工具任务 -10pp**（2610.00084）；"请匹配角色能力水平"也治不好 voice-vs-capability 裂口（2609.39846）。
2. **常驻规则按容量算，不是按需要算。** 有限注意力容量下「**加一条规则不会提高其余规则的遵守率**」，最优文件规模**存在上界**（2610.11007）；官方实测落点在 **12–18 块 / 3k–4.3k 词**（§3 计数）。
3. **删规则不能只看"没人用过"。** 缺失只在造成伤害时才产生反馈，"删除被忽略的指令必然可能删掉有用的"（2610.11007）；瘦身要用 OpenAI 的「删一组→同评测复跑」，且**45 题的小评测抓不到 13 分差**（2610.04433）。
4. **强调词是零和资源。** "If you emphasize many lines, none of them stands out."（Claude Code）；Anthropic 消费者端提示词**09-28 起全大写条款归零**。
5. **矛盾指令的代价是早停，不是多想。** OpenAI 09-11 与 GPT-6 指南两处；Claude Code `/doctor prompt-audit` 把"矛盾的指导文件"列首位。
6. **安全沉 harness，别沉 system。** 机制证据：安全条款的表征移动"与最小基线统计不可区分"、与"你没有任何限制"近乎同路径（CKA 0.997），70B 仍 <10% penetration（2609.38205）；行为证据：**只改 system 就能让 ASR 从 0.2% 跳到 43%**（2610.23254）；官方口径："enforcement lives in the harness"、"hooks are deterministic, CLAUDE.md is advisory"。
7. **一定给失败态命名。** 官方框架的 shipped prompt **九个里零个**规定了工具失败时怎么办；补一句 `retrieval_status: OK or FAILED` 把不诚实率 **14.10% → 0.87%**（2609.14758）。
8. **SOP 不进 system，走工具/协议逐步下发。** adherence 76–95% → 95–99%；且 prompt 下发时 **31–49% 的"正确结果"其实没走流程**（2610.07817）。
9. **频率决定 system 还是 skill：命中 ≥1/3 流量才进 system；安全/法务/品牌/关键用户事实恒进 system。** skill **作为 tool result 载入**，别追加进 system（Anthropic 09-02）。
10. **日期、当前页、会话 id、记忆一律后置。** "system 顶部放时间戳是最常见错误"（Anthropic）；GLM/DeepSeek 官方实现都把它踢出 system；论文实测日期方差超过 batch/精度且 **CoT 放大**（2609.36931）。⚠️ Gemini 官方说法相反，冲突已在 §6 呈现。
11. **别在 system 里放外部不可信内容。** Anthropic 原话："doing so gives that text **operator-level authority**"；DeepSeek 官方两份 untrusted 条款是按工具各写一段（web_search / web_fetch）；Kimi/GLM 都把"材料 vs 要求"分层写明。
12. **换模型/换 harness 必重测，且 system 面是成本主项。** 同模型同任务同价目表，**跨 harness 每任务成本差最多 3×**，差距"在第一次调用就由 system prompt + 工具 schema 的 preamble 决定，再乘以步数"；而 harness 对**分数**的影响落在噪声内（2610.04433）。

---

## 10. 落地检查清单（写/改一份 agent 系统提示词时逐条过）

**结构层**
- [ ] 身份句一句话，含"跑在哪、为谁服务"，无能力等级断言
- [ ] 授权边界写成判断式；**principal 是谁写明确**（它会改变行为，2609.17989）
- [ ] 完成定义与停止条件写在**末尾**，且从会话第一轮就在
- [ ] **失败态契约**：工具返回不可用值时先报 `retrieval_status: FAILED`
- [ ] 工具规则只写"跨工具会选错"处；单工具规则沉 description，**窄触发**
- [ ] 冲突优先级写明「用户指令 > skill/文件」，并附**点名污染源**的诊断句
- [ ] 块数 12–18、常驻英文词 3k–4.3k 以内、全大写强调 = 0、example ≤3

**协议层**
- [ ] 确认目标协议怎么承载 system（顶层字段 / messages role / instructions）
- [ ] 旧式 OpenAI 兼容网关：多段 system 能否合并、**是否只接受一个开头 system**
- [ ] 中途更新：该模型是否有 in-history 能力位（DeepSeek 仅 flash；Kimi 仅 k3；Anthropic 需按型号防忽略）
- [ ] 需要 tools 与 content 分开（Kimi 互斥）？动态工具是否"不携带即失效"？
- [ ] 采样参数：该家会报错还是静默忽略；prefill 是否已被禁
- [ ] 思考内容回传规则：字段名 / 是否必须原样 / 是否计入预算

**缓存与成本层**
- [ ] 常驻前缀 ≥ 目标阈值（按最大者 1024 设计最稳）
- [ ] 顺序 `tools → system → messages`，前缀 byte 级稳定
- [ ] 日期 / 会话 id / cwd 清单 / 记忆 **不在 system 顶部**
- [ ] effort 档会话开始就定（GLM 5.3 关不掉、Kimi 换档毁缓存、MiniMax 省略即 max）
- [ ] 命中率目标 90–99%；TTL 与定时任务间隔匹配（Kimi TTL 首写锁定不可改）

**治理层**
- [ ] 版本化：像 Kimi Managed Agents 那样把 system 当**不可变配置快照**管
- [ ] 可复现：记录每次请求的 system + tools + 参数（Claude Code 10-14 的做法）
- [ ] 每版跑一次"删一组指令→同评测复跑"；`/doctor prompt-audit` 类审计
- [ ] 条款归属分层记账：厂商 API 文档 / 兼容层 / 云平台 / 教程，**别把平台模板当厂商规则**

---

## 11. 门槛内查不到（各卷汇总，别当已知）

1. DeepSeek：system 条数与长度上限、多条 system 的裁决规则、缓存最小 token、官方"短提示"原话、Search/Fetch 的 system 模板、open-weight `chat_template`（ModelScope `tokenizer_config.json` **不含该字段**）。
2. GLM：任何"system 能否多条/必须 messages[0]/能否中途插入"的**文档条款**（只有模板与契约可推）；官方 system 长度上限；**指令遵循率/幻觉率量化数字**；GLM-5.3 技术报告一手（`z.ai/blog/glm-5.3` 返回 598 B 空壳）。
3. MiniMax：≥09 的官方 system **写法指引**；"要 JSON 时 system 怎么写"；新人设能力边界口径；effort 各档延迟/token 数字；≥09 的产品端泄漏样本；M3.1 权重（称 10-23 开放、许可未公布）。
4. Kimi：缓存最小命中 token（**不存在该数字**）；`prompt-best-practice` 的 2026-10 版（停在 08-16）；托管模板的 system 原文全文（只有关键句）。
5. 跨厂商：OpenAI Model Spec ≥09 修订（最后 08-18）；Gemini system instruction 量化条款/新机制；Mistral·Qwen·xAI 官方章节；IFScale/ManyIFEval 的直接续作；"判断式 vs 禁令式比例"的权威统计（§3 是脚本自测，不可与论文口径互推）。
6. **日期不确定声明**：Kimi/GLM 文档页日期取自 JSON-LD `dateModified` 或索引快照，存在 ±1 日级不确定；DeepSeek api-docs **所有页面无"最后更新"字段**，只能靠更新日志条目与 HTTP 头定年；MiniMax 多数页面不自述更新时间，标注为 live（2026-10-20）或「爬」（引擎抓取戳）。
