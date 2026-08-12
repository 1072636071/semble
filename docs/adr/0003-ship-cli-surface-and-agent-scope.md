# ADR 0003：ship.mjs 入口形态与 Agent 分发范围

- 日期：2026-08-12
- 状态：已接受

## 上下文

ADR 0001/0002 确定了"一行命令 + 7 家配置驱动 + 双模式迁移"，余下两个接口级决策：

1. 命令形态。备选：(a) 单一入口 + 子命令；(b) 全局命令（npm link / PATH）；(c) npm scripts。(b) 换机器需重复配置且 Windows PATH 易踩坑；(c) 需 cd + package.json，无实质增益。
2. Agent 是否纳入分发。现状 Agent 从未被安装流程覆盖（agent-generator 直接写 `~/.codebuddy/agents/`），`base/agent/` 与根 `Agent定义/` 两处并存且未收敛。需求原文明确要求"skills **和** agent"。Qoder/WorkBuddy/QoderWork 的 agents 目录未调研。

## 决策

1. 单一 `.mjs` 入口 `base/scripts/ship.mjs` + 子命令：
   - 零参数：扫描全部桶与 `base/agent/`，双模式派生/复制 + 安装 + hash 验证 + 残留清理（覆盖安装.md 全部能力）；
   - 子命令 `init`（模板脚手架）/ `derive` / `install` / `check` 按需单独使用。
2. Agent 与 Skills 同权：`vendors.json` 每平台同时声明 `skillsDir` 与 `agentsDir`；`base/agent/` 走同样双模式（`AGENT.src.md` 派生 / 普通 `.md` 原样复制）；agents 目录未调研的平台跳过并打印警告。

## 后果

- 克隆即用，无全局配置依赖；CI 中同样可直接调用。
- Agent 首次纳入分发流程，4 家立即可用，3 家待补调研——配置补齐即生效，脚本不动。
- 根 `Agent定义/` 与 `base/agent/` 的双目录问题不在本 ADR 范围，需后续收敛（建议收敛至 `base/agent/`）。
- 脚本名 `ship` 成为仓库级动词，文档与技能描述中统一使用。
