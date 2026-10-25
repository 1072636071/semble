# MCP 工具设计模式库

常见的 MCP 工具组织模式及适用场景。

## 工作流入口模式（Workflow Entry）

**问题**：API 表面太大，LLM 不知道从何开始。

**方案**：设计少量入口工具，每个入口对应一个用户意图/工作流。入口工具的返回值中包含下一步建议。

```
list_projects → describe_project → get_connection_string
```

**适用**：任何有多个资源/项目需要选择的场景。

**反模式**：一次性暴露 `get_all_resources` 让 LLM 自己翻。

## 沙箱隔离模式（Sandbox Isolation）

**问题**：破坏性操作（DDL、批量更新、删除）直接在生产环境执行风险太高。

**方案**：所有破坏性操作默认在临时分支/沙箱/事务中执行，验证通过后才提交。

```
prepare_migration（沙箱中预览）→ validate → complete_migration（提交）
```

**适用**：数据库变更、文件系统写入、配置修改等不可逆操作。

**关键**：沙箱创建必须零成本或低成本（Copy-on-Write、临时事务、内存文件系统等），否则 LLM 会跳过沙箱直接操作。

## 预览提交模式（Preview-Commit）

**问题**：LLM 需要看到变更效果才能确认正确性，但直接执行又太危险。

**方案**：将变更分为"预览"和"提交"两个工具。预览工具返回变更的 diff 或影响范围，提交工具才真正执行。

```
preview_changes → 返回 diff → confirm_changes → 实际执行
```

**适用**：代码修改、配置文件更新、数据迁移等需要人工确认的场景。

## 动态展开模式（Progressive Expansion）

**问题**：高级功能不常用，但偶尔需要。全部暴露会污染初始工具集。

**方案**：初始只暴露基础工具。基础工具的返回值中，在特定条件下提示高级工具的存在。

```
get_database_tables → 返回表列表
    ↓ 用户提到"优化"
suggest_index_tuning → 暴露索引调优工具
```

**适用**：性能调优、高级配置、 rarely-used 的管理功能。

**关键**：高级工具的暴露必须由当前上下文触发，而非静态列出。

## 意图路由模式（Intent Routing）

**问题**：用户意图多样，单一工具难以覆盖所有参数组合。

**方案**：设计一个路由工具，根据用户输入返回应该调用的具体工具和参数。

```
route_request("备份数据库") → { tool: "create_backup", params: {...} }
route_request("查看日志") → { tool: "get_logs", params: {...} }
```

**适用**：CLI 风格的 MCP Server，用户输入是自然语言命令。

**注意**：路由工具本身需要良好的描述，让 LLM 知道什么时候用它。

## 批量操作模式（Batch Operation）

**问题**：单个操作太慢，LLM 需要循环调用几百次。

**方案**：提供批量版本工具，一次处理多个项目。

```
create_item（单个）→ create_items_batch（批量）
```

**适用**：导入、初始化、批量更新等场景。

**注意**：批量工具应该有明确的限制（如最大批量大小），避免一次请求过大。

## 缓存/记忆模式（Cache/Memory）

**问题**：某些查询结果不常变化，但 LLM 每次都要重新获取。

**方案**：提供缓存工具，让 LLM 可以显式地缓存和刷新数据。

```
cache_query_result(key, data) → 后续用 get_cached_result(key) 获取
```

**适用**：schema 信息、配置数据、用户偏好等相对静态的数据。

## 错误恢复模式（Error Recovery）

**问题**：工具调用失败时，LLM 不知道该如何恢复。

**方案**：执行错误返回 `isError: true`，正文里带**可行动的恢复指引**，而不仅仅是错误码。协议没有定义 `suggested_actions` 字段——恢复建议写在错误文本里，或用 `structuredContent` 带结构化错误体。

```json
{
  "content": [
    {
      "type": "text",
      "text": "无法连接到数据库：连接串 host 解析失败。请检查 DSN 的 host 与端口；可调用 test_connection 诊断，或调用 list_available_drivers 查看支持的驱动。"
    }
  ],
  "isError": true
}
```

**适用**：所有可能失败的操作，尤其是网络调用和文件操作。

## 模式选择决策树

```
变更是否可逆？
├─ 是 → 是否需要预览？
│   ├─ 是 → 预览提交模式
│   └─ 否 → 直接执行 + 错误恢复
└─ 否 → 沙箱隔离模式

操作是否批量？
├─ 是 → 批量操作模式
└─ 否 → 单操作 + 错误恢复

功能是否高级/不常用？
├─ 是 → 动态展开模式
└─ 否 → 工作流入口模式

## 链路合并模式（Workflow Consolidation）

**问题**：一条常见用户意图要模型串 3–5 个工具，每个中间结果都过一遍上下文；模型还可能选错顺序。

**方案**：把整条链路合并成一个面向意图的工具，底层在服务端串完。返回时只给最终结论 + 关键中间标识。

```
list_users + list_events + create_event  →  schedule_event
read_logs（全量）                       →  search_logs（只回相关行 + 上下文）
get_customer_by_id + list_transactions
  + list_notes                         →  get_customer_context
```

**适用**：评估指标显示"同一条链路被反复重复调用"时。合并是渐进披露的补充，不是替代——合并后仍可能触发高级工具。

**关键**：合并粒度按**用户意图**切，不按底层 API 切；合并后的工具仍要写 `outputSchema`。

## 显式句柄模式（Explicit Handle）

**问题**：状态要跨多次工具调用保存（购物车、事务、浏览器上下文），但 MCP 没有协议级会话。

**方案**：创建工具返回不透明 handle，后续调用把它当参数传回。

```
create_basket → { basket_id: "bsk_a1b2c3" }
add_item(basket_id: "bsk_a1b2c3", ...)
```

**适用**：任何跨调用状态。**关键**：handle 要 opaque；寿命写进创建工具的 description；每次调用校验授权；对过期/未知 handle 返回明确执行错误，让模型能重建。
