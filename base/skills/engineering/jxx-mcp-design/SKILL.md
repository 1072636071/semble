---
name: jxx-mcp-design
description: "设计 MCP Server 的渐进式发现架构与工具分层。当用户要设计或重做 MCP、问工具该怎么分层、怎么被发现时触发。不实现业务逻辑。"
disable-model-invocation: false
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-mcp-design, codebuddy]
    description-en: |-
      1. Design MCP Server tool exposure with progressive discovery layers, plus two delivery contracts: non-blocking UI HTML (or MCP Apps) and a progressive-disclosure guide skill.
      2. Triggered by: MCP design, tool stacking, progressive disclosure, MCP UI html, MCP Apps, MCP guide skill.
      3. Prevents context overflow from exposing all API endpoints as tools.
      4. Usage: identify workflow layers → design entry tools → embed next-step hints → ship UI HTML + guide skill.
      5. Requires: MCP Server concept, tool design context.
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
metadata:
  version: 1.2.0
---

# MCP Server 设计

从"工具堆砌"转向**渐进式发现 + 代码模式**。核心判断：LLM 的上下文窗口是稀缺资源，工具描述的质量比数量重要，安全机制应该内建在工具链中而非依赖 LLM 自觉。

规范基线 = MCP spec `2026-07-28`（当前版本，日期版本号，向后兼容的增订不换号）。协议级事实（工具字段、annotations、错误分流、elicitation、弃用特性）见 [references/spec-2026-07-28.md](references/spec-2026-07-28.md)；发现机制与评估方法见 [references/discovery-and-eval.md](references/discovery-and-eval.md)。

## 范式对比

| 维度 | 旧范式：工具堆砌 | 新范式：渐进式发现 + 代码模式 |
|------|------------------|------------------------------|
| 设计思路 | 所有 API 1:1 映射为 MCP Tool | 按工作流分层暴露，LLM 按需逐步发现 |
| LLM 认知负担 | 上下文被大量工具描述占满 | 初始只暴露少量入口工具，后续动态展开 |
| 交互模式 | LLM 直接调用底层工具 | 通过 Skill/代码模板引导 LLM 走正确路径 |
| 安全性 | 依赖 LLM 自觉，风险高 | 分支隔离、elicitation 确认等机制内建安全 |
| 验证方式 | 上线后靠用户报错 | 评估任务集 + 工具调用指标驱动迭代 |

## 先选原语：tools / resources / prompts

三种原语由不同方控制，选错就是把数据硬塞进模型上下文：

| 原语 | 控制方 | 放什么 | 例子 |
|------|--------|--------|------|
| tools | 模型 | 动作：写库、调 API、改文件 | searchFlights、createEvent |
| resources | 应用（host） | 被动只读数据，host 决定何时进上下文 | 文件内容、schema、API 文档 |
| prompts | 用户 | 参数化模板，显式调用 | plan-vacation |

判断：模型要"做" → tool；host 要"供上下文" → resource；人要"复用套路" → prompt。1:1 包 API 的"工具"多数应是 resource 或 prompt——只有模型需要自主决定的动作才值得占工具描述位。

## 四层渐进式发现（server 侧）

不要 1:1 暴露 API。按用户意图/工作流重新组织工具，形成自然的发现链路：

1. **定位** — 少量入口工具帮 LLM 找到目标
2. **探查** — 按需了解结构而非一次性 dump
3. **安全变更** — 破坏性操作走预览→验证→提交三步
4. **高级功能** — 仅在用户明确需要时才暴露

**关键理念**：高级内容之所以被显示，是因为它现在变得相关了。每一步工具的返回结果中都包含下一步的建议操作，形成自然的发现链路。

配套的协议机制（host 侧三层 = catalog → inspect → execute，阈值经验值 = 工具描述占上下文 1–5% 时切换）：提供 `search_tools` 元工具（带 `detail` 参数：name / name+description / full schema）与 `get_tool_details`；`tools/list` 返回确定性排序（提升 prompt cache 命中率）；声明 `listChanged` 能力，工具集变化时发通知。

## 代码模式代替裸工具调用

不要指望 LLM 从工具描述中自行推断最佳实践。将最佳实践编码为可复用的 Skill 文件或代码模板——约束行为序列，而非单个工具的参数。

服务端配合：**每个工具都写 `outputSchema`**——host 靠它生成 code mode 的 typed API，缺了就退化成 `any`。把高频链路上的多个工具合并成一个（`schedule_event` 代替 `list_users` + `list_events` + `create_event`），减少往返与中间结果过上下文。

## 工具命名与命名空间

- 长度 1–128，字符限 ASCII 字母、数字、`_`、`-`、`.`；server 内唯一。
- 按 service / resource 加前缀：`asana_search`、`asana_projects_search`。跨 server 撞名只能靠 client 加前缀消歧，server 管不着——自己的名字先自带命名空间。
- 前缀式 vs 后缀式命名空间对工具选择的影响因模型而异，用自己的评估定，别照抄。

## 分支即安全沙箱

所有破坏性操作默认在临时分支/沙箱上执行，验证通过后才提交。本质是将人类开发者的 Git 工作流映射到 AI Agent 的操作模式中。

协议级加持：用 tool **annotations**（`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`）标注行为，但客户端只在信任的 server 才采信——不能替代真确认；破坏性操作用 **elicitation**（form mode）向人要确认，别赌 LLM 自觉；密钥/令牌走 elicitation 的 URL mode，不进上下文。规范要求始终保留人能否决工具调用的能力。

## 协议级机制优先于自定义约定

能用协议原语就别自造：跨调用状态用**显式 handle**（创建工具返回、后续调用传入；opaque、寿命写进 description、过期返回可自愈错误）；缺参数用 `input_required` + `elicitation/create` 按需收集；错误分两层（协议错误 vs `isError: true` 的可自纠执行错误，后者必须带可行动的修正文案）。弃用特性别用（roots / sampling / logging 推送 / HTTP+SSE）。细节见 [references/spec-2026-07-28.md](references/spec-2026-07-28.md)。

## 交付契约一：不阻塞启动的 UI HTML（或 MCP Apps）

每个 MCP 都要有一个 UI，用来介绍能力或做管理。三条硬约束：**不阻塞启动、不反向依赖、不常驻服务**。

UI 是 server 的**产物**，不是 server 的**依赖**——启动时不得创建、渲染、打开或等待它；它缺失时 MCP 照常可用。需要动态数据就导出 `ui/state.json` 给页面读，不为此起 HTTP 服务。

两档形态：

| 档 | 用途 | 机制 |
|----|------|------|
| 静态离线 HTML | 能力地图、管理面板，人类双击可开 | `ui/index.html` 单文件，Agent 用 `present_files` 打开 |
| MCP Apps | 聊天内交互部件（表单、图表、看板） | 工具 description 带 `_meta.ui.resourceUri` 指向 `ui://` 资源，host 在沙箱 iframe 渲染 |

Apps 依赖 host 支持（Claude、Claude Desktop、VS Code Copilot、M365 Copilot、Goose 等），不支持就降级静态 HTML；两档都不得进启动路径。静态档内容至少 6 段：是什么（含边界）、能力地图（按四层分层标出入口工具）、典型链路、安全边界、配置与前置、排障。

## 交付契约二：披露式配套引导技能

每个 MCP 都要有一个引导技能，教 Agent 怎么用。**详细介绍，但分层披露**：SKILL.md 只留触发场景 + 3–5 步最小可用路径 + 每篇 reference 的「何时读」，全量细节下沉 `references/`（能力地图、典型工作流、参数契约、失败恢复、UI 指针、安全边界）。SKILL.md 里声明本技能依赖哪些 MCP server——host 可只在技能触发时才连接，进一步省上下文。

引导技能与 UI HTML 内容同源（工具名、链路、错误码一致），前者面向 Agent 约束行为，后者面向人类做可视化。

## 深入

- **规范契约 2026-07-28** — 见 [references/spec-2026-07-28.md](references/spec-2026-07-28.md)：工具字段、annotations、outputSchema、错误分流、显式 handle、elicitation、弃用清单、命名规则、安全 MUST。写或审任何 MCP 工具前读。
- **发现与评估** — 见 [references/discovery-and-eval.md](references/discovery-and-eval.md)：三层发现与阈值、缓存与 prompt cache、代码模式落地、评估任务与指标信号。设计工具集或重构工具面时读。
- **Neon MCP 实践详解** — 见 [references/neon-pattern.md](references/neon-pattern.md)：四层工作流、分支即沙箱、Agent Skills 体系的具体实现。当需要参考真实案例时读。
- **工具设计模式库** — 见 [references/tool-patterns.md](references/tool-patterns.md)：MCP 工具组织模式及适用场景。当设计具体工具集时读。
- **UI HTML 契约** — 见 [references/ui-html-contract.md](references/ui-html-contract.md)：不阻塞启动的三条硬约束、路径约定、静态档与 MCP Apps 两档、6 段内容骨架、反模式。当给 MCP 做（或补）UI 时读。
- **配套引导技能** — 见 [references/guide-skill.md](references/guide-skill.md)：披露式技能的目录结构、内容清单、与 UI 的分工。当为某个 MCP 编写使用引导技能时读。
- **设计检查清单** — 见 [references/checklist.md](references/checklist.md)：可验证的设计准则。当审查或验收 MCP 设计时读。
