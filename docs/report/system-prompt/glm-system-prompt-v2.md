# GLM 系统提示词工程方案 v2（证据门槛：2026-09-01 之后）

> **只讲系统提示词（system prompt）工程**：system 的协议位置、真实构成、分块契约、动态注入、缓存纪律、人设块写法。不含日常提问技巧与用户侧 prompt 公式。
> **门槛声明**：本版只把 **2026-09-01 之后发布或更新的官方文档、官方代码资产**当作「现行规则」。早于门槛的材料一律进 §11 并显式标日期。
> 定稿 2026-10-20。真源：`.temp/research/sysprompt-2026-10/glm.md`（38.9 KB / 6006 中文字，18 次检索、25+ 页正文；原文快照在同目录 `raw/`）。
> **排版约定**：本文所有尖括号用全角〈〉书写（防模板字面量被工具层吞掉），实际写进代码/提示词时必须换回 ASCII 半角。
> 等级：**A** = 智谱官方一手（文档 / 官方代码资产）｜**B** = 官方对端与权威实现（vLLM/DashScope/AWS）｜**C** = 社区可复现｜**D** = 农场（**禁止引用其任何数字**）。

---

## 0. 一句话结论：门槛内的新增知识几乎全在 agent 侧，不在提示词教程侧

`guide/platform/prompt`（更新 2026-10-19）里关于 System Prompt 的那段定义文字**与三年前一致、没有跟进 GLM-5.3**。真正新增的 system 面机制藏在三处：

1. **GLM-5.3 官方 chat_template**（ModelScope，10614 B）——把 `reasoning_effort` 与 `tools` 物理写进 system 块；
2. **`zai-org/ZCode` 开源契约**（提交 2026-10-10T10:57:01Z）——`system-prompt-contract.md` + `meta-user-context.md`，官方 agent 的 system 分层与缓存裁决；
3. **`capabilities/cache`**（中英双页）——站内唯一的 system 长度硬数字（500 Token）。

> ⚠️ **这条推翻上一版手册**：v1 里我写「智谱官方没有发布可照抄的编码 agent 系统提示词全文，官方只提供框架接入 + MCP」。**该结论自 2026-10-10 起失效**——ZCode 已开源，官方 system 分层契约与源码可直接读、可核对提交日期（§3）。

---

## 1. 协议层：system 的合法位置与硬约束

| 条款 | 官方原文/事实 | 出处与日期 | 级 |
|---|---|---|---|
| **唯一硬约束** | 「消息按时间顺序排列，支持四种角色：`system`（系统消息，用于设定 AI 的行为和角色）、`user`、`assistant`、`tool`……**注意不能只包含系统消息或助手消息。**」 | `api-reference/模型-api/对话补全`，2026-10-14 | A |
| 角色枚举 | `system \| user \| assistant \| tool`，`default: system`；**`tool` 角色只对文本对话模型开放**（视觉/音频分支同样写"不能只包含系统或助手消息"） | 同上，2026-10-14 | A |
| system 条数 / 位置 | **站内没有任何条款**要求 system 必须位于 `messages[0]`，也没有禁止多条 system。检索词 `system 多条`、`messages[0]`、`系统消息 位置`、`插入 system` 全部无命中；`cn/faq/api-issues` 通篇不讲 system | 负结果，§12 | A（缺证声明） |
| 中途插入 | 文档层无表述；门槛内的实际答案来自**官方代码资产**：ZCode 契约把 `system[0]/system[1]/system[2]` 三段并列，并在 `# Harness` 原样写入「系统可通过 mid-conversation system turns 发送更新、提醒或规则修改」 | ZCode 契约，2026-10-10 | A |

### 1.1 换协议 = 换 system 承载方式（S13 总表）

这是 GLM 上最容易踩空的一层，四个协议各不相同：

| 协议 | system 承载 | 注意 |
|---|---|---|
| Chat Completions | 可多条、可原位 | 模板侧支持任意位置/任意条数，约束只发生在协议序列化边界 |
| Anthropic 兼容 | 可多块，且带 **cache 断点** | 契约提到 "the existing conversation-tail cache marker within the provider's four-breakpoint limit" |
| **旧式 OpenAI 兼容模板** | **只接受一个开头 system** | 必须**按原序、空分隔符合并**，不得补写空白（`system-message-compat.ts` 注释，A） |
| Responses 兼容 | **没有 system 消息位** | 用顶层 `instructions` 承载（参数表逐字：「instructions \| string \| - \| 系统指令」） |

> 契约正文逐字（A，2026-10-10）："OpenAI-compatible adapters therefore concatenate contiguous leading system blocks with an empty separator and never add or infer whitespace. Protocols that support multiple system blocks preserve the original block contents."

**落地规则**：同一份人设在 Anthropic 兼容下可以是三段，在旧式 OpenAI 兼容网关下会被合并成一段——**合并不能插入任何分隔空白**，否则跨协议行为不等价。DSH/opencode 这类框架的 `compat` 配置里「system 放哪个角色」不是可有可无的开关。

---

## 2. GLM 的独特事实：你的 system 前缀不止是你写的那段

**GLM-5.3 官方 chat_template 会把两样东西物理塞进 system**（A，ModelScope `ZhipuAI/GLM-5.3/…/chat_template.jinja` 第 2–3 行逐字）：

```jinja
{gMASK}{sop} 之后第一句：
{%- if effective_reasoning_effort is not none -%}〈|system|〉Reasoning Effort: 〈〈 effective_reasoning_effort | capitalize 〉〉
```

- effort 解析式：`reasoning_effort if reasoning_effort is defined and reasoning_effort in ['low','high'] else 'max'` → **不传或传非法值一律回退 max**。
- `tools` 被序列化成**第二个 system 块**，逐字开头：「〈|system|〉# Tools / You may call one or more functions to assist with the user query. / You are provided with function signatures within 〈tools〉〈/tools〉 XML tags:」，随后逐个 JSON，调用格式为〈tool_call〉{function-name}〈arg_key〉…〈/arg_key〉〈arg_value〉…。

**因此 GLM 的 system 前缀 = ① effort 行 + ② tools 块 + ③ 你写的 system。三者任一变动，前缀缓存整段失效。**

- 「改 `reasoning_effort` 就等于改 system 首块」——**system 的第一个字符已经不属于你了**。这与 Kimi「会话开始就定 effort 档」是同一条物理约束的两种表述。
- 「增删工具会破 system 前缀缓存」也由此得到解释。
- 官方对这个问题的**原生机制答案是 `defer_loading`**：带该标记的工具**不进 system 的 tools 块**，改由〈tool_response〉〈tools〉…按需回灌（A，模板分支）。这就是 GLM 版的「渐进披露」。

### 2.1 代际差异表（官方模板实测，A）

| 代际 | system 里的 effort 行 | 档位 | 门控 | `clear_thinking` 默认 |
|---|---|---|---|---|
| GLM-4.7-Flash / GLM-5 | **无** | 无 | 用 `enable_thinking` | 未定义按 falsy（丢弃末轮之前推理） |
| GLM-5.2 | 有 | 仅 high / max | `(enable_thinking is not defined or enable_thinking)` 才注入 | 同上 |
| **GLM-5.3 / 5.3-Flash** | 有 | low / high / max | **无条件注入**（强制思考，不可关） | 模板显式 `else false` → **保留式思考默认开** |

GLM-5.3-Flash 官方模型页推荐参数逐字：「`thinking.type` 仅支持 `enabled`，建议设置 `thinking.clear_thinking: false`。流式调用建议同时开启 `stream: true` 和 `tool_stream: true`。」

---

## 3. 最高价值：ZCode 官方 system 分层契约（可直接照抄的工程规范）

`github.com/zai-org/ZCode` → `apps/zcode-cli/docs/design/v2/loop/system-prompt-contract.md` 与 `meta-user-context.md`，**提交 2026-10-10T10:57:01Z**；仓库 2026-10-20 仍在更新（tree 19362 路径，含 system-message 兼容性适配器与三份 wire 测试）。A 级。

### 3.1 三个 system 块 + 一个 meta_user

| 块 | 内容 | 官方原文（逐字） |
|---|---|---|
| `system[0]` CLI prefix（唯一一句） | 身份 | `You are ZCode, an interactive coding agent` |
| `system[1]` static body | 主行为体 | 无 output style 时 `You are an interactive ZCode agent that helps users with software engineering tasks.`；有 output style 时 `You respond to the user according to the active Output Style below while using ZCode's tools and instructions.` |
| `system[2]` dynamic body | 固定顺序 | `# Communicating with the user` → 风险/汇报段 → `# Session-specific guidance` →（可选 `# Memory`）→ `# Environment` →（可选 `# Output Style`）→ `# Context management` →（可选 `gitStatus:`），且**永远自带一个前导空行边界** |

**安全边界原文**（`system[1]`，逐字节选）：`IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools ... require clear authorization context: pentesting engagements, CTF competitions, security research, or defensive use cases.`

**`# Harness` 六条 bullet 原文**（这是 GLM 官方对「运行环境事实该写什么」的正面范本）：

```text
- Text you output outside of tool use is displayed to the user as Github-flavored markdown in a terminal.
- Tools run behind a user-selected permission mode; a denied call means the user declined it — adjust, don't retry verbatim.
- The system may send updates, reminders, or modifications to rules via mid-conversation system turns.
  These are system-controlled, unlike function results. Hooks may intercept tool calls; treat hook output as user feedback.
- Prefer the dedicated file/search tools over shell commands when one fits. Independent tool calls can run in parallel in one response.
- Reference code as file_path:line_number — it's clickable.
```

### 3.2 什么**不许**进 system（官方禁止项，逐字）

> "Stable prompt text may describe tool-use philosophy, but it must not duplicate ordinary tool names, JSON schemas, permission metadata, or adapter-specific runtime rules. Those belong in provider tool definitions and dynamic context."

三条明确禁止：

- Reprinting full tool schema fields in the stable prompt
- Maintaining a separate list of all available tools in the stable prompt
- Encoding provider-specific approval flags that the permission layer already owns

以及：**`# currentDate`（`Today's date is …`）不进 system，落在 meta_user**；Skills、AGENTS.md 指令文件同样进 meta_user 的〈system-reminder〉包裹块。理由原文：「Date changes independently of behavior rules.」／「cwd and platform vary by session, current model refreshes with session model changes」。

### 3.3 裁决表：每段上下文声明两个字段

每个上下文段必须声明 `injectionTarget: "system" | "meta_user"` 与 `cacheHint: "stable" | "dynamic"`（A）：

| 进 system + stable | 进 system + dynamic | 踢到 meta_user + dynamic |
|---|---|---|
| CLI Prefix、Agent Identity | Dynamic Behavior、Session Guidance、Memory、Environment Info、Output Style、Context Management、Git System Context | **Skills、Request User Context（含 AGENTS.md）、当前日期** |

provider-visible 顺序（逐字排序）：1 Cached CLI prefix → 2 Cached stable system body → 3 Cached dynamic system block → 4 Skills system-reminder user block → 5 meta user context block → 6 真实 user/assistant/tool → 7 请求期模式提醒。收束句：

> "**This ordering keeps the cache-sensitive system prefix stable while keeping volatile context close to the user turn.**"

设计目标原文：「ZCode context is split by injection target so **stable behavior instructions can stay cache-friendly while volatile workspace context stays below them**」；Goals 还包括「Avoid reading host time, files, git, or process state from core.」

缓存标记策略（逐字）：「Main's CLI prefix carries no cache marker; the static and dynamic bodies retain their existing ephemeral markers, with no change to scope or TTL.」

一条体积防线值得抄：「`git status --short --untracked-files=all` must be capped to **20 entries** before it enters `EnvInfo.gitStatusLines`; large decompiled or generated workspaces can otherwise make the initial provider request **exceed the context window before the first user message is considered**.」

> **与社区流行写法方向相反**：社区习惯「把日期、技能清单、仓库指令文件全塞进 system」。智谱官方的解法是「**稳定段进 system、易变段进 meta_user、工具按需 defer_loading**」。本手册以官方为准绳。

### 3.4 另两条官方工程口径（P6，逐字要点）

- 「Make **"read before deciding" the default behavior** for repository tasks」；"a denied tool call means the user declined it; the agent adjusts rather than retrying the same call unchanged"。
- **「Keep stable prompt copy English-only so prompt behavior is consistent across locales」**——官方把**稳定 system 文本锁成英文**以求跨语言一致。这是门槛内的新知识点：**人设正文用英文写、把输出语言交给单独一条规则**，比整段中英混排更稳。
- 「The agent reports outcomes faithfully: failed tests, skipped checks, and verified completion are stated plainly」；「treat memory as optional context rather than truth」。
- 环境段边界：「Environment guidance must not include git branch/status/commit details; those belong to the optional `gitStatus:` system context snapshot」。
- ⚠️ **官方自认的一处妥协**：Explore 子代理 "runs in `yolo` mode … **Read-only behavior is therefore enforced by the system prompt's CRITICAL section rather than by the permission layer**"，并自评「**weakens the previous physical isolation**」。**官方明确承认：拿 system 提示当权限层的替代品是有代价的**——写手册时不能把「system 里写只读」当成安全边界。

---

## 4. 缓存纪律（站内唯一硬数字）

| 条 | 官方原文（逐字） | 出处 | 级 |
|---|---|---|---|
| **最小命中长度** | 「要触发上下文缓存，重复的前缀内容必须足够长（**建议 500 Token 以上**），**两三句话的短系统提示词通常无法命中**。」 | `capabilities/cache`（中） | A |
| 分区放置 | 「**把稳定不变的说明、规范与知识库放在系统提示词前部，把多变的问题放在用户消息中**，这样可以最大化上下文缓存的命中率。」 | 同页 | A |
| 生效延迟 | 「重复的长前缀会被自动缓存……**缓存为异步生效，首次请求后稍等片刻再发起后续请求效果更好**」（解释了示例里首请求 `cached_tokens=0`） | 同页 | A |
| 英文页四条纪律 | "Use stable system prompt templates" / "Process long documents as system messages" / "Avoid overly frequent content changes" / "Design system prompts reasonably to improve reuse rates" | `docs.z.ai/guides/capabilities/cache` | A |
| 整篇文档塞 system 的官方范式 | `{"role": "system", "content": f"Please answer user questions based on the following document content:\n\n{document_content}"}`，注释「Multiple calls with the same document, system prompts will be cached」 | 英文页 | A |
| 命中口径与价 | 命中看 `usage.prompt_tokens_details.cached_tokens`；命中价「通常为标准价格的 50%」 | 中英两页 | A |
| 显式断点（**站内无此 API**） | AWS 侧：隐式缓存默认启用；显式经 `prompt_cache_options` + `prompt_cache_breakpoint`，**每个断点至少 1024 Token** | B，2026-10-06 | B |

> 注意 **500 Token 是建议值、不是接口保证**；中文缓存页未给 TTL、失效规则、显式标记 API（出现次数 0）。GLM-5.3/5.2 在智谱定价侧另有 Cache Write / Cache Read 两个独立价（B，2026-10-15：写 ¥9.5/M、读 ¥1.9/M、输入 ¥7.6/M，读约为输入的 25%）。
> **与 §2 合起来的推论**：既然 effort 行与 tools 块也在 system 前缀里，一个「只有两三句话人设」的 agent 实际上靠前缀里的 tools 块才够 500 Token——**缩短人设不一定打不到缓存，但增删工具一定打不到**。

---

## 5. 人设块（persona）的官方口径：门槛内已改成「只写职责」

**P2 新页 `best-practice/prompt-engineering-general`（门槛内在架，A，逐字）**：

- 「当任务需要特定的专业视角、受众意识或工作职责时，可以用简洁的描述说明模型应该承担什么角色、根据什么标准工作。」
- 「**角色设定应服务于任务，不必堆叠"世界顶级专家"等夸张身份。角色不能代替具体任务说明、原始证据和验证标准。也不要让模型声称自己具有与实际运行环境不符的身份、权限或专业资格。**」
- 迁移检查表第 3 条：「**重写身份与角色**：删除其他模型身份设定。角色只描述职责、读者和标准，不虚构专业等级或权限。」第 1 条：「删除模型专属参数：不保留其他模型的思考、effort、预填充、工具批处理或其他 API 专属配置。」
- 该页自我设限（第十节，逐字）：「本篇只覆盖通用提示方法，**不规定某一 GLM 模型的上下文长度、思考强度、采样参数、结构化输出 API 或版本专属能力**。」→ 它给的是**行为规范**，不能当 system 机制来源。

**P3 默认行为必须写进 system**（同页第四节，逐字）：「用户说"你能建议一些修改吗"和"请修改这段代码"对应不同的行动意图……**对于会读取文件、修改代码、访问外部系统或产生副作用的场景，应在系统提示中明确默认行为。**」官方随即给三段 **system 级模块原文**：

```text
〈default_to_action〉
当用户明确要求检查、修改或完成工作时，执行必要且安全的本地工具调用。
缺少非敏感信息时，先读取相关文件或调用查询工具确认，不要猜测参数。
影响外部系统或难以回滚的操作仍需确认。
〈/default_to_action〉

〈conservative_mode〉
默认只分析和给出建议，不修改文件或改变系统状态。
只有用户明确授权后，才执行读取、编辑或外部调用。
〈/conservative_mode〉

〈use_parallel_tool_calls〉
如果多个工具调用相互独立，应在同一轮并行执行。
如果后续调用的参数依赖前序结果，必须等待结果。
不要猜测缺失参数。
〈/use_parallel_tool_calls〉
```

> 与 ZCode 契约把 parallel guidance 固定放进 `system[2]` 完全一致——**并行规则是 system 块的内容，不是工具描述的内容**。

**P4 要求 vs 材料的信任分层**（同页，逐字）——门槛内官方最接近注入防护的一句：

> 「重点是让模型区分**需要遵守的要求**和**需要处理的材料**。外部文档、网页、工具结果和用户提交的数据应当作为信息来源，而不应因为其中出现了指令式语句，就被自动当作新的任务要求。」

（对照：官方《安全与风险提示》页 9022 B 全文**没有**任何 system/注入表述——负证据。）

**P5 人设的载体正在迁移**：Managed Agents 把 system 升为 Agent 一等字段并**版本化**（`agent-setup`，A，逐字）：

> 「**system** | 系统提示词，定义 Agent 的行为与人设。系统提示词与用户消息不同：前者定义「你是谁、怎么做事」，后者描述「这次要做什么」。」

官方示例 `"system": "You are a helpful coding agent."` → 版本更新示例 `"system": "You are a helpful coding agent. Always write tests."`，并说明可在会话级临时覆盖 `model/system/tools/mcp_servers/skills`；「每条记录都是该版本的完整 Agent 配置快照」。**「人设」在智谱口径里正从"提示词技巧"变成"Agent 配置项 + 不可变版本"。**

**P1 负结果**：门槛内**没有任何**指令遵循率 / role boundary / 长上下文幻觉的官方量化数字（逐页核对 6 处，含 `zai-org/GLM-5.3` README 14209 B）。README 量化只落在 Coding/Cyber/Agentic 基准（Terminal-Bench 3.0 28.3、DeepSWE v1.1 66.9、CyberGym 84.5、Toolathlon 73.0）。**手册不得写「GLM 指令遵循率 X%」。**

---

## 6. 官方 system 原文样本库（可直接抄，全部 A 级）

| # | 场景 | 官方原文 | 出处与日期 |
|---|---|---|---|
| 1 | 提取+结构化 | `{"role": "system", "content": "您擅长从文本中提取关键信息，精确、数据驱动，重点突出关键信息，根据用户提供的文本片段提取关键数据和事实，将提取的信息以清晰的JSON格式呈现。"}` | `guide/platform/prompt`，2026-10-19 |
| 2 | 编码 | `"role": "system", "content": "你是编程助手，擅长写简洁高效的代码。"` | 对话补全参考，2026-10-14 |
| 3 | **知识库+RAG（约 1000 Token，官方用作缓存演示）** | 「你是智谱开放平台（BigModel）的官方技术支持助手。请严格依据以下知识库回答开发者问题；知识库未覆盖的问题请如实告知，并引导开发者查阅官方文档或提交工单。」内部用【知识库开始】/【知识库结束】/【知识库补充：开发者进阶指南】分区 | `capabilities/cache`（中文页）——**门槛内最新的一份官方 system 写法范本** |
| 4 | agent 示例里唯一 system | `{"role": "system", "content": "You are an assistant"}` | `capabilities/thinking-mode`——官方 agent 示例的 system 就这么薄，其余全靠 tools 与 reasoning 序列 |
| 5 | 结构化输出 | 「你是一个情感分析专家。请按照以下 JSON 格式返回分析结果：{…}」／「请按照以下 JSON Schema 格式返回情感分析结果：{json.dumps(schema)}」 | `capabilities/struct-output`（12 处，示例 model 一律 `glm-5.2`） |
| 6 | Agent 配置字段 | `"system": "You are a helpful coding agent. Always write tests."` | `managed-agents/agent-setup` |
| 7 | 生产级三段式 | §3.1 的 `system[0]/[1]/[2]` + `# Harness` 六条 | ZCode 契约，2026-10-10 |

**S1 官方定义逐字**（唯一对 System Prompt 下定义的教程页，2026-10-19）：「System Prompt 用于设定 AI 助手行为模式的工具，包括角色设定、语言风格、任务模式和针对特定问题的具体行为指导。」
**S6 智能体平台侧定义**（`platform/intelligent-agent`，2026-09-01，边缘达标）：「System Prompt 通常是指由模型开发者或使用者设计的、用来指导模型行为的指令或上下文。这些提示可以是固定的格式，也可以是针对特定任务定制的。」

**S4 分隔符口径变了**（值得单独记）：老页只教三重双引号 `"""…"""`（且**未给 system 专用分隔符**）；新页 `prompt-engineering-general` 改成——「标签名应描述内容用途，并在同一系统或同一任务中保持一致。**XML 标签是清晰的分隔手段，但不应被描述为对所有 GLM 版本都必然优于 Markdown**；是否更合适，应在自己的任务上比较。」
**S5 长度告诫只针对输出**：「指定按照具体的长度的输出内容，但是让模型精确的生成一个特定的字数难以实现。」**官方从未对 system 本身给字数上限**；唯一长度类硬数字是缓存页的 500 Token。

---

## 7. 工具政策与结构化输出：写在 system 还是 schema

- **`tool_choice` 默认且仅支持 `auto`**（`capabilities/function-calling`，逐字：「控制函数调用策略，默认且仅支持 `auto`」）→ 别按 OpenAI 习惯传 `required`。
- 流式：`stream=true` **且** `tool_stream=true`，并流式拼接 `delta.tool_calls[*].function.arguments`（迁移 checklist 逐字）。
- **tools 在 token 层就是 system 文本**（§2），但 ZCode 契约禁止在稳定 prompt 里重印 schema/工具清单（§3.2）→ **裁决：工具面写进 provider tool definitions，system 只写「工具使用哲学 + 并行/依赖规则 + 权限语义」。**
- 官方对提示词效力的边界（新页逐字）：「工具能否真正被调用，取决于应用是否提供相应能力和权限。**提示词不能替代实际的工具配置、权限检查与执行结果校验。**」
- **结构化输出**：`capabilities/struct-output` 在门槛内仍写「**`messages`：在系统消息中定义期望的 JSON 结构和字段要求**」；核心参数只有 `{"type": "json_object"}`；**该页 `json_schema` 出现 0 次**。
  → 结论：**智谱官方只承诺 `json_object` 模式，schema 约束靠 system 正文表达；`json_schema` 严格模式在站内文档不成立**（阿里云百炼对 GLM 提供 json_schema 属**对端实现**，B）。

### 7.1 思考序列是 system 之外的第二条隐式契约（T3，A，09-29 快照）

- 逐字：「注意：当您在使用"交错思考 + 工具"时，**必须显式保留 Reasoning content，并在返回工具结果时一并返回**」。
- Preserved thinking：「该能力在 **Coding Plan 端点默认开启、标准 API 端点默认关闭**……通过「`"clear_thinking": False`」在 API 端点中开启，并需要将**完整、未修改**的 reasoning content 传回 API。**所有连续的 reasoning content 必须与模型在原始请求期间生成的序列完全一致，不要重新排序或修改这些 content，否则会降低效果并影响缓存命中。**」
- DashScope 侧更严表述（B，2026-10-13）：「必须在 messages 中**完整、未修改、按原顺序**透传历史 reasoning_content，缺失、裁剪、改写或重排会导致效果下降或无法生效。」

→ 手册结论：**别把「请保留思考」写进 system**——它不是提示词能解决的事，是客户端回传纪律；同一份 system 在 Coding Plan 与标准 API 上**行为不等价**（前者默认带推理序列）。

---

## 8. 可直接落地的 GLM 系统提示词骨架（每块标出处）

```text
【块 0｜身份句 —— 进 system[0]，唯一一句，锁英文】
You are {产品名}, an interactive {领域} agent
  ↑ A：ZCode `cli-prefix.ts`（2026-10-10）；A：契约 "Keep stable prompt copy English-only"

【块 1｜静态体 —— system[1]，cacheHint: stable】
You are an interactive {产品名} agent that helps users with {任务域}.
# Harness                      ← A：# Harness 六条是官方正面范本
- 文本输出以 GitHub-flavored markdown 显示在终端。
- 工具在用户选择的权限模式下运行；被拒绝的调用＝用户拒绝，调整而非原样重试。
- 系统可能通过 mid-conversation system turns 下发更新/提醒/规则修改（受系统控制，不同于 function result）。
- 优先专用文件/检索工具；相互独立的调用在同一轮并行。
- 引用代码用 file_path:line_number。
# Safety boundaries            ← A：契约 IMPORTANT 段（授权场景 + 拒绝清单）
# Default behavior             ← A：P3 官方三模块之一（default_to_action 或 conservative_mode，二选一，别并存）
# Role（只写职责/读者/标准）      ← A：P2「不必堆叠"世界顶级专家"」「不得虚构权限与资格」
# Parallel tool calls          ← A：〈use_parallel_tool_calls〉模块原文

【块 2｜动态体 —— system[2]，cacheHint: dynamic，固定顺序 + 前导空行边界】
# Communicating with the user（含「只用与用户相同的语言回答」这一条，独立成规则）
# Session-specific guidance → # Memory(可选) → # Environment → # Output Style(可选) → # Context management → # gitStatus:(可选，条目截 20)
  ↑ A：ZCode 契约排序；A：EnvInfo.gitStatusLines 上限 20

【不进 system，改放 meta_user（第 5 位）的〈system-reminder〉包裹块】
当前日期、Skills 清单、AGENTS.md/指令文件内容
  ↑ A：§3.2 禁止项与裁决表（"Date changes independently of behavior rules."）

【块 3｜结构化输出（仅当要 JSON）】
在 system 正文里写定期望 JSON 结构与字段要求；请求带 response_format={"type":"json_object"}
  ↑ A：struct-output 逐字；该页 json_schema 出现 0 次 → 别指望 strict schema

【协议与参数侧（不是 system 内容，但决定 system 是否成立）】
- Chat Completions：可多条 system；旧式 OpenAI 兼容网关：按原序空分隔合并，不补空白
- Responses 协议：system 位不存在 → 用顶层 instructions
- effort 一旦会话开始就固定（它被注入 system 首行，换档=破缓存；5.3 系关不掉）
- tools 用 defer_loading 按需回灌以保持前缀稳定；稳定 prompt 不重印 schema
- 流式工具调用：stream=true + tool_stream=true，拼接 delta.tool_calls[*].function.arguments
- 缓存：前缀 ≥500 Token 才有命中率（建议值）；异步生效，首请求后稍等再打第二发
```

---

## 9. 反模式（门槛内证据）

| 反模式 | 为什么 | 级 |
|---|---|---|
| 把当前日期 / Skills 清单 / AGENTS.md 塞进 system | 官方明确踢到 meta_user；且破缓存 | A |
| 在稳定 prompt 里重印工具 schema 或工具全清单 | 契约三条禁止项之一；且 tools 本身会被模板序列化进 system，重复即双倍成本 | A |
| 堆「世界顶级专家」式身份 | 官方："不必堆叠…不虚构专业等级或权限" | A |
| 让模型声称与运行环境不符的权限/资格 | 官方禁止；且与 ZCode「身份由 CLI prefix 固定，caller 不得拼」冲突 | A |
| 把「只读」安全边界只写在 system 里 | 官方自认这是**弱化了物理隔离**（Explore 子代理 yolo 模式靠 CRITICAL 段兜），须由权限层承担 | A |
| 期望 `json_schema` strict 约束 | 站内结构化输出页 `json_schema` 出现 0 次；只有 `json_object` | A |
| 传 `tool_choice: "required"` | 官方仅支持 `auto` | A |
| 在 system 里写「请保留思考」 | 属客户端回传纪律，不是提示词可控项；且端点默认值不同 | A |
| 保留其他模型的 effort/预填充/工具批处理参数名 | 迁移 checklist 第 1 条明令删除 | A |
| 中英混排的稳定 system 文本 | 官方把稳定文本锁英文，语言一致性交给单独规则 | A |
| **引用农场数字** | 「标签内强约束识别率高 47%」「两个连续换行时 83% 只返回前 12 字」「system 从 320 字压到 87 字成本降 41%」及伪参数 `auto_max_tokens`、顶层 `system_prompt` 字段——**一律禁止** | D |

---

## 10. 与上一版（v1）的差异（诚实记录）

| v1 说法 | v2 结论 |
|---|---|
| 「智谱官方没有可照抄的编码 agent 系统提示词全文」 | **已过期**：ZCode 开源（2026-10-10 提交契约），三段式 system + meta_user 裁决可直接用（§3） |
| 「GLM 官方产品与 API 都不注入 system prompt，人设完全靠调用方」 | 仍成立于 chat.z.ai/API，但**ZCode 宿主注入三段 system**，且 `zai-org/feedback` issue #78 所谓「ZCode 原生 system 仅一句」已被 10-10 契约推翻（现为 3 块 + 6 条 Harness） |
| 「XML 工具标记属 D 级存疑」 | **升级为 A**：GLM-5.3 官方 chat_template 逐字给出〈tool_call〉/〈arg_key〉/〈arg_value〉序列化，且 tools 是**第二个 system 块**（§2） |
| 「Preserved thinking 标准端点默认关、Coding Plan 默认开」 | 确认（09-29 快照，A），并补齐 5.3 模板 `clear_thinking` 默认 false = **保留式思考默认开** |
| 「官方未给 system 长度数字」 | 确认无上限，但**缓存侧有 500 Token 建议下限**（A，§4） |
| 内容含「日常提问技巧」「参数温度表」 | v2 已剔除（超出系统提示词工程范围） |

---

## 11. 门槛外残留证据（早于 2026-09-01，仅背景）

1. GLM-5.3 / 5.3-Flash 发布 2026-08-14 / 08-19 / 08-26 —— 早于门槛，机制以门槛内文档与模板为准。
2. GLM-4.7 ModelScope 卡片（2026-08-19 抓取）：Preserved thinking 代际起点 `"chat_template_kwargs": {"enable_thinking": true, "clear_thinking": false}`，门槛内已被 09-29 `thinking-mode` 泛化改写。
3. ZCode 3.0 发布 2026-06-13（切自研内核）；其 `Commands` 文档只暴露用户侧 `Prompt` 字段，**不提供官方 system 模板**（该结论门槛内仍成立）。
4. 智谱清言智能体 system 模板逆向（2026-02-03，D）：把用户设定与「当前日期」一起塞进模板化 system——**恰是 ZCode 契约 10-10 起明确禁止的做法**。
5. 社区「格式约束放 system 更守规矩」（2026-05-15，D）：方向与官方范式一致，无 GLM 实测。

---

## 12. 门槛内没找到什么（负结果，勿编）

1. 没有任何官方条款回答「system 能否多条 / 必须 messages[0] / 能否中途插入」——只有模板与契约可推（属代码资产，非文档承诺）。
2. 没有官方 system 长度/字数上限。
3. 没有指令遵循率 / role boundary / 长上下文幻觉的官方量化数字（搜过 `GLM-5.3 instruction following`、`role boundary`、`指令遵循 提升 官方`、`system prompt 遵循 率`）。
4. 没有 GLM-5.3 技术报告一手（`z.ai/blog/glm-5.3` 直连返回 598 B 空壳，jina 仅取到 655 B）→ **无法逐字引官方发布文**。
5. 没有 `zai-org/Cookbook` 仓库（raw 404）、没有 09 月后新增的 prompting 章节；`zai-org/GLM-5` README（更新至 2026-10-15）新增内容只有基准与部署。
6. 没有官方给 Claude Code / OpenCode / Cline 的 system 片段（`cn/coding-plan/tool/others` 18228 B 通篇只有 base_url / 模型名 / 权限，`system` 仅出现在 `System.out.println`）。
7. 中文站没有显式缓存 API（`prompt_cache_breakpoint` / `cache_control` / TTL 在缓存页出现 0 次）；结构化输出页没有 `json_schema`（0 次）。
8. **文档日期不确定**：各页 `Last-Modified` 恒等于抓取时刻，devbook 源为私有仓；本报告日期来自索引快照 PublishedTime 与 GitHub 提交日期，存在 ±1 日级不确定。
9. 没有门槛内可复现的社区「GLM system 分层」实测数据集（搜过 linux.do / V2EX 相关词，命中集中在农场文，已按 D 排除）。
10. 没有 chat.z.ai / 智谱清言 / 桌面版 ZCode **当前** system 原文的官方披露（§3-7 是开源 CLI 的契约与源码）。
