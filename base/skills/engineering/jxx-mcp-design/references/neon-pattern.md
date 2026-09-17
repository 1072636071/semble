# Neon MCP 实践详解

Neon MCP Server 是渐进式发现范式的典型代表。它没有把 Postgres 的所有操作平铺为工具，而是设计了分层的工作流入口。

## 四层工作流

### 第一层：项目与连接

```
list_projects → describe_project → get_connection_string
```

LLM 先定位到具体项目，获取连接字符串后存入 `.env`。这一层只解决"我在哪、怎么连"的问题。

### 第二层：Schema 探查

```
get_database_tables → describe_table_schema
```

按需了解表结构而非一次性 dump 全库 schema。LLM 需要哪张表就看哪张，不需要的 schema 不占用上下文。

### 第三层：安全变更

```
prepare_database_migration（在临时分支上预览）
    ↓ 验证通过
complete_database_migration（提交到主分支）
```

所有破坏性操作默认在临时分支上执行。LLM 被引导先在分支上验证结果，确认无误后才提交。利用 Neon 的 Copy-on-Write 零拷贝分支技术，创建分支几乎零成本。

### 第四层：高级功能

```
provision_neon_auth（仅在用户明确需要认证时）
autoscaling / scale-to-zero（仅在需要调优时）
```

这些工具存在但不出现在常规工作流中。高级内容之所以被显示，是因为它现在变得相关了。

## 关键机制

**返回值嵌入下一步提示**：每个工具的返回结果中都包含建议的下一步操作，形成自然的发现链路。例如 `list_projects` 的返回会提示"使用 describe_project 查看项目详情"。

**分支即安全沙箱**：所有 DDL 和数据迁移默认在临时分支上执行。这本质上是将人类开发者的 Git 工作流映射到了 AI Agent 的操作模式中。

**渐进式画像**：不在初始连接时要求所有配置。首次连接只需 API Key + 项目选择，后续按需触发高级配置。

## Agent Skills 体系

Neon 推出了 Agent Skills 体系，将最佳实践编码为可复用的 Skill 文件（SKILL.md），而非让 LLM 自由组合裸工具：

```bash
# 安装 Neon 专用 Agent Skill
npx skills add neondatabase/agent-skills --skill neon-postgres-agent -g -y
```

这些 Skill 定义了结构化的工作流模板：

- **分支工作流 Skill**：指导 LLM 区分"普通分支"与"仅模式分支"，自动处理从父分支重置、CI/CD 集成等复杂场景
- **迁移工作流**：不是直接执行 SQL，而是强制走 prepare → test on branch → commit 三步法
- **连接配置 Skill**：根据部署平台自动选择正确的驱动和连接方式，写入 .env 前先读取避免覆盖

## 启示

如果你正在构建自己的 MCP Server，可以从 Neon 的实践中学到：

1. **不要 1:1 暴露 API** — 按用户意图/工作流重新组织工具，而非按 API 文档
2. **工具返回值中嵌入下一步提示** — 让每个工具的 response 成为下一个发现的起点
3. **用 Skill/Prompt 模板约束 LLM 行为** — 比靠 tool description 更可靠
4. **为危险操作设计预览/回滚机制** — 分支、dry-run、事务等都是好手段
5. **分层暴露复杂度** — 简单任务只需 2-3 个工具就能完成，高级功能按需展开
