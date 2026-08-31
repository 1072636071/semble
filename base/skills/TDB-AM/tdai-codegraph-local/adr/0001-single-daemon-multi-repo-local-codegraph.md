# ADR 0001: tdai-codegraph-local 用单守护进程服务全部本地仓库

状态：已接受（2026-08-31）

## 背景

`tdai-codegraph-local` 技能让本地 coding agent 通过常驻服务 + MCP 享受 Code_Graph 能力（本地份 + 远端兜底）。MemoryKnowledge 的 `local-server.ts` 主设计是**每进程单工作区**自动注册（`KNOWLEDGE_LOCAL_WORKSPACE`），一个仓库一条进程。但用户本地有约 40+ 仓库，且选定"常驻服务 + 用户级 MCP"形态，仓库多则进程/端口/MCP 配置爆炸。

## 决策

单守护进程（一个本地 KS）服务全部目标仓库：

1. 以配置清单**首个仓库**（试点 = `E:\work\sp\JwikisSkills`）为 `KNOWLEDGE_LOCAL_WORKSPACE` 启动（自动注册为本地资产）。
2. 其余仓库经 `/code-graph/create(source_type=local)`（`allowLocalSource:true` 已开）追加为同一进程的本地资产。
3. 一个 MCP 桥（`bin/mcp.mjs`，`KNOWLEDGE_API_URL` 指向守护进程）覆盖全部仓库。
4. 查询前增量刷新按 `source_type==="local"` 逐资产生效；远端兜底/认亲遍历全部本地资产。

## 为什么

- 常驻 + 用户级 MCP 下，一仓库一进程意味着 N 个端口 + N 条 MCP 配置，运维与 agent 侧负担随仓库数线性增长。
- 单守护进程一个端口、一个 MCP、一份配置，仓库增删只改配置清单 + API 追加，契合"多仓库试点再扩展"的取向。
- 源码确认多资产路径可行：`createCodeGraphRoutes({allowLocalSource:true})`、查询刷新按 `source_type==="local"` 判断、兜底/认亲遍历全部本地资产。

## 被否决的替代方案

- **一仓库一进程（多常驻）**：完全贴合单工作区主设计、互不干扰，但端口/MCP 配置随仓库数膨胀，与"省心"取向相悖。
- **按需起停**：资源最省，但与"常驻 + MCP"形态冲突，每次会话要起停进程。

## 影响

- 追加资产的查询前刷新/认亲逐资产生效**需实测验证**（现有测试只覆盖单工作区）——列入实施验收项。
- 非首仓库的 `.gitignore` 追加 `.codegraph/` 由谁保证：启动仅对主工作区调 `ensureCodegraphIgnored`，追加仓库需技能脚本自行处理。
- 后续若发现多资产路径有未覆盖行为，可回退到"一仓库一进程"（ADR 仍记录此权衡）。
