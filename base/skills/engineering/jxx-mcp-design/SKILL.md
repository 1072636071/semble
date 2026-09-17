---
name: jxx-mcp-design
description: 设计 MCP Server 的渐进式发现架构与工具分层，并落实两项交付契约：不阻塞启动的 UI HTML、披露式配套引导技能。
disable-model-invocation: true
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-mcp-design, codebuddy]
    description-en: |-
      1. Design MCP Server tool exposure with progressive discovery layers, plus two delivery contracts: non-blocking UI HTML and a progressive-disclosure guide skill.
      2. Triggered by: MCP design, tool stacking, progressive disclosure, MCP UI html, MCP guide skill.
      3. Prevents context overflow from exposing all API endpoints as tools.
      4. Usage: identify workflow layers → design entry tools → embed next-step hints → ship UI HTML + guide skill.
      5. Requires: MCP Server concept, tool design context.
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
metadata:
  version: 1.1.0
---

# MCP Server 设计

从"工具堆砌"转向**渐进式发现 + 代码模式**。核心判断：LLM 的上下文窗口是稀缺资源，工具描述的质量比数量重要，安全机制应该内建在工具链中而非依赖 LLM 自觉。

## 范式对比

| 维度 | 旧范式：工具堆砌 | 新范式：渐进式发现 + 代码模式 |
|------|------------------|------------------------------|
| 设计思路 | 所有 API 1:1 映射为 MCP Tool | 按工作流分层暴露，LLM 按需逐步发现 |
| LLM 认知负担 | 上下文被大量工具描述占满 | 初始只暴露少量入口工具，后续动态展开 |
| 交互模式 | LLM 直接调用底层工具 | 通过 Skill/代码模板引导 LLM 走正确路径 |
| 安全性 | 依赖 LLM 自觉，风险高 | 分支隔离、迁移预览等机制内建安全 |

## 四层渐进式发现

不要 1:1 暴露 API。按用户意图/工作流重新组织工具，形成自然的发现链路：

1. **定位** — 少量入口工具帮 LLM 找到目标
2. **探查** — 按需了解结构而非一次性 dump
3. **安全变更** — 破坏性操作走预览→验证→提交三步
4. **高级功能** — 仅在用户明确需要时才暴露

**关键理念**：高级内容之所以被显示，是因为它现在变得相关了。每一步工具的返回结果中都包含下一步的建议操作，形成自然的发现链路。

## 代码模式代替裸工具调用

不要指望 LLM 从工具描述中自行推断最佳实践。将最佳实践编码为可复用的 Skill 文件或代码模板——约束行为序列，而非单个工具的参数。

## 分支即安全沙箱

所有破坏性操作默认在临时分支/沙箱上执行，验证通过后才提交。本质是将人类开发者的 Git 工作流映射到 AI Agent 的操作模式中。

## 交付契约一：不阻塞启动的 UI HTML

每个 MCP 都要有一个 UI HTML，用来介绍能力或做管理。三条硬约束：**不阻塞启动、不反向依赖、不常驻服务**。

UI 是 server 的**产物**，不是 server 的**依赖**——启动时不得创建、渲染、打开或等待它；它缺失时 MCP 照常可用。需要动态数据就导出 `ui/state.json` 给页面读，不为此起 HTTP 服务。

内容至少 6 段：是什么（含边界）、能力地图（按四层分层标出入口工具）、典型链路、安全边界、配置与前置、排障。

## 交付契约二：披露式配套引导技能

每个 MCP 都要有一个引导技能，教 Agent 怎么用。**详细介绍，但分层披露**：SKILL.md 只留触发场景 + 3–5 步最小可用路径 + 每篇 reference 的「何时读」，全量细节下沉 `references/`（能力地图、典型工作流、参数契约、失败恢复、UI 指针、安全边界）。

引导技能与 UI HTML 内容同源（工具名、链路、错误码一致），前者面向 Agent 约束行为，后者面向人类做可视化。

## 深入

- **Neon MCP 实践详解** — 见 [references/neon-pattern.md](references/neon-pattern.md)：四层工作流、分支即沙箱、Agent Skills 体系的具体实现。当需要参考真实案例时读。
- **工具设计模式库** — 见 [references/tool-patterns.md](references/tool-patterns.md)：9 种 MCP 工具组织模式及适用场景。当设计具体工具集时读。
- **UI HTML 契约** — 见 [references/ui-html-contract.md](references/ui-html-contract.md)：不阻塞启动的三条硬约束、路径约定、6 段内容骨架、反模式。当给 MCP 做（或补）UI 页面时读。
- **配套引导技能** — 见 [references/guide-skill.md](references/guide-skill.md)：披露式技能的目录结构、内容清单、与 UI 的分工。当为某个 MCP 编写使用引导技能时读。
- **设计检查清单** — 见 [references/checklist.md](references/checklist.md)：9 条可验证的设计准则。当审查或验收 MCP 设计时读。
