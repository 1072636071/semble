# 渐进式发现与评估

设计或重构工具面时读。来源：MCP 官方 Client Best Practices（spec 2026-07-28）+ Anthropic 工程博客（Writing effective tools for AI agents / Code execution with MCP）。

## 问题量级

全量注入所有工具定义：几十个 server、几百个工具时，定义本身可吃掉 ~150k token，模型还没读用户消息就烧掉大半窗口。按需加载可降到 ~2k token。

## 何时切换渐进发现

- 工具少、定义占上下文比例小 → 全量加载即可，别过度设计。
- 占比达**显著比例**时切换；官方建议阈值 = 上下文窗口的 **1–5%**，达到即转入渐进发现。
- 厂商已内置 tool search（OpenAI / Anthropic 平台）时优先用平台的；只在需要领域化排序或权限过滤时自建。

## 三层模式（host 侧）

| 层 | 动作 | 进上下文的内容 |
|----|------|----------------|
| Catalog | `search_tools({ query, detail })` | 仅匹配工具名 + 一句话描述 |
| Inspect | `get_tool_details({ name })` | 单工具的完整 input/output schema + 文档 |
| Execute | `tools/call` | 调用与结果 |

- `search_tools` 必须带 `detail` 参数：name / name+description / full schema，让模型自己选信息量。
- 检索策略：关键词（BM25/regex）/ embedding / 小模型 subagent / hybrid。按场景选，用评估定。
- 可扩展到 server 级：`search_available_servers` → `enable_server` → `tools/list` → 用完 `disable_server` 释放上下文。
- 实现要点：多档细节；host 侧缓存工具定义（避免重复 `tools/list`）；收到 `list_changed` 重索引；按 server 分组呈现。

## 缓存与 prompt cache 的冲突

增删工具定义会使 prompt 前缀缓存失效，一次 miss 的代价可能超过省下的定义。

- 新发现的定义**追加到缓存断点之后**，不要重排 `tools` 数组。
- 或全程走单一稳定的 `call_tool({ name, args })` 元工具，数组永不变。
- server 断开按"会话边界"操作，不要每轮拆接。
- `tools/list` 返回确定性排序（server 侧职责，见规范契约）。

## 代码模式（Programmatic Tool Calling / code mode）

多工具链式任务（读文档 → 转换 → 写别处）时，直调让每个中间结果都过一遍模型上下文；改成模型写脚本、沙箱执行、只回最终摘要。

- host 把工具 schema 转成 typed API；**`outputSchema` 是类型来源**——没有就退化 `any`。server 侧每个工具都该写 `outputSchema`。
- 沙箱无网络；凭证由 host 持有，生成代码只调 stub。
- `isError: true` 在 wrapper 里应转成抛异常，让模型代码能 `try/catch`；未捕获错误终止脚本时，把错误作为脚本结果回给模型自纠。
- 安全：per-call 授权（批准脚本不等于批准它运行时每次调用）；跨 server 数据流按不可信输入对待；限时限内存；输出校验 + 截断后再回模型。

## 工具面设计原则（Anthropic 实践）

- **不 1:1 包 API**：`list_users` + `list_events` + `create_event` → `schedule_event`；`read_logs` → `search_logs`（只回相关行 + 上下文）；`get_customer_by_id` + `list_transactions` + `list_notes` → `get_customer_context`。
- **工具名反映任务的自然切分**：既减少上下文里的工具数与描述量，又把 agent 的计算从上下文挪回工具调用里。
- **返回高信号内容**：丢掉 `uuid`、`256px_image_url`、`mime_type` 这类低层标识；优先 `name`、`image_url`、`file_type`。把任意 UUID 解析成语义化名称（或 0 起始编号）能显著降低检索幻觉。
- 需要同时给"自然语言名"和"技术 id"时，暴露 `response_format` 枚举（`concise` / `detailed`）让 agent 自己选，别一次全给。
- **响应结构（XML / JSON / Markdown）无万灵药**：与模型训练分布的匹配度因任务而异，用自己的评估选。
- **token 效率**：大结果组合使用分页、范围选择、过滤、截断，并给合理默认值。截断时必须在文案里引导 agent 换更省的策略（多次小查询代替一次宽查询）。
- **错误文案 prompt-engineering**：说清具体该怎么改（参数格式、有效取值、示例），别给不透明错误码。
- **工具描述 prompt-engineering**：当给新员工讲解那样写——把隐含的查询格式、术语定义、资源关系显式化。参数名要无歧义（`user_id` 而非 `user`）。小改动可能带来大提升。
- **命名空间**：按 service / resource 加前缀（`asana_search`、`asana_projects_search`）。前缀 vs 后缀的效果因模型而异，用自己的评估定。

## 评估驱动（不是上线后靠报错）

1. **建原型**：先搭本地 MCP server 或 DXT，在真实 host 里试；给 agent 喂所依赖库/SDK 的文档（优先 `llms.txt`）。
2. **生成评估任务**：grounded 在真实用例与真实数据，避免过于简单的沙箱题。强任务通常要多次工具调用（可能几十次）。
3. **配可验证结果**：可以是精确比对，也可以是模型评判；别过度严格（格式、标点、同义表述的差异不该判错）。可附带"期望调用的工具"，但别过拟合到单一策略。
4. **跑评估**：程序化直连 LLM API，一个任务一个 agentic loop（while 循环包住 LLM 调用与工具调用交替）。系统提示里让 agent 先输出推理与反馈块再出结构化结果（触发 CoT）。
5. **收指标**：准确率之外，看单次调用与任务的总耗时、工具调用总数、总 token、工具错误数。冗余调用多 → 分页/上限参数要调；参数错误多 → 描述与示例要加强。
6. **读原始记录**：agent 没说出口的往往比说出口的重要。看它在哪里卡住，看工具调用与响应的原始转录。
7. **迭代**：把转录拼给编码 agent 让它批量重构工具并保持描述与实现自洽。保留 held-out 测试集防过拟合。
