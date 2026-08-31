# ADR 0001: 本地 Wiki 查询复用守护进程 MCP 兜底转发

状态：已接受（2026-08-31）

## 背景

`tdai-wiki-local` 技能让本地 coding agent 检索仓库文档建成的远端 wiki。Wiki 引擎只存在于远端（本地 KS 不挂 wiki，本地 wiki 资产永远 404）。存在多条"查询消费"路径：复用本地守护进程兜底转发、直接远端 REST、远端 allocate + proxy 注入。用户选定与 Code_Graph 共用一套 MCP，故查询走本地守护进程的兜底转发。

## 决策

Wiki 查询消费路径 = **复用本地守护进程的 MCP 兜底转发**：

1. 本地 KS 的 tools 面**保留 wiki 工具定义**（有意透传，见 `local-server.ts` 头注释）。
2. 对远端 wiki 资产的只读查询（`/tools/{list,call}`）本地 404 → 兜底中间件**原样转发远端 KS** 作答。
3. agent 一套 MCP 同时拿到 Code_Graph（本地）+ Wiki（远端转发）工具，体验统一。

## 为什么

- 用户已选定"常驻守护 + 用户级 MCP"为本地知识层的基础设施，复用同一 MCP 最省：agent 无需两套工具面、无额外配置。
- 直接远端 REST 需每次跑命令、非 MCP 原生；allocate + proxy 注入要求 agent 走 proxy 会话，链路最绕。
- 本地 KS 明确保留了 wiki 工具定义并设计兜底转发语义（`FORWARD_PATH_RE` 含 `/tools/(list|call)`），此路径是既有能力而非新造。

## 被否决的替代方案

- **直接远端 REST（复用 panel-admin 只读端点）**：可控、不依赖守护进程，但非 MCP 原生、每会话跑命令，agent 体验差。
- **远端 allocate + proxy `<knowledge_tools>` 注入**：产品原生路径，但强依赖 agent 走 proxy 会话，链路长、与本机常驻守护形态冲突。

## 影响

- wiki 兜底转发对 wiki 资产的**参数透传需实测验证**（认亲只改写 code-graph id，wiki id 原样透传；tools/call 的 wiki 参数是否完整转发）——列入实施验收项。
- `tdai-wiki-local` 对守护进程形成**单向依赖**（查询需守护在跑），SKILL.md 需写明"缺守护提示先起"。
- 守护未配置 `KNOWLEDGE_FALLBACK_BASE_URL` 时兜底不生效——技能配置必须显式声明远端兜底地址。
