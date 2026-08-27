# 写一个工具插件

工具是 dsh 插件开发最常见场景。工具定义核心 = **`parameters`（JSON-Schema）** + **`output.schema/render`** + **`execute(args, exec)`**。标准入口是 `@deepseek-ai/dsh-tools` 的 `defineTool()`。

## 目录

- [最小工具完整示例](#最小工具完整示例)
- [defineTool 帮你做了什么](#definetool-帮你做了什么)
- [parameters 参数 DSL](#parameters-参数-dsl)
- [output 契约（必须规范）](#output-契约必须规范)
- [execute 与 exec](#execute-与-exec)
- [注册规则](#注册规则)
- [作用域与并行](#作用域与并行)
- [最佳实践](#最佳实践)

## 最小工具完整示例

```ts
import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-greet'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: '向某人打招呼',
    parameters: {
      name: { type: 'string' },
      excited: { type: 'boolean' },
    },
    output: {
      schema: { type: 'string' },
      render(_args, value) {
        return [{ type: 'text', text: typeof value === 'string' ? value : 'ok' }]
      },
    },
    timeoutMs: 10_000,
    async execute({ name, excited }, exec) {
      return `${excited ? 'HELLO' : 'Hello'}, ${name}!`
      // 与 output.schema:{type:'string'} 一致，返回字符串
    },
  }))
}
```

> `defineTool` 只构造 `ToolDefinition`（提供类型推断与字段校验），**注册一律走 `ctx.tools.register()`**——MCP 服务发现工具、运行时动态工具也都是调用它注册。`register()` 返回 `() => void` 卸载函数。

## defineTool 帮你做了什么

| 能力 | 说明 |
| ---- | ---- |
| 类型化参数 | `parameters` 编译成 TS 类型，`execute` 的 `args` 被精确推断 |
| 自动校验 | 执行前校验，缺必填/错类型 → `ToolArgsError`（`INVALID_ARGS`）走普通错误路径 |
| 推断输出 | 从 `output.schema` 推断返回类型与纯渲染 |

## parameters 参数 DSL

支持类型：`string` / `number` / `integer` / `boolean` / `null` / `array` / `object` / `json` / `oneOf`。

可显式 `additionalProperties: true|false`（裸 JSON Schema 保持 open 默认）。

## output 契约（必须规范）

工具**只能返回** `output.schema` 声明的那个规范 JSON 值；注册表校验、冻结再渲染。**缺失/不支持 output → 注册失败；render 缺失会抛 `TypeError`。**

| 字段 | 要求 |
| ---- | ---- |
| `schema` | **强制**，规范 JSON-Schema，声明返回值的"规范形式" |
| `render(args, value)` | **强制**，把规范值渲染成 ContentBlock |
| `presentationMeta(args, value)` | 可选，派生 JSON 元数据（随 tool/result 持久化） |

结果形状：

```ts
// 成功
{ isError: false, value, content, meta?, additionalContexts? }
// 失败（无 value）
{ isError: true, error: { message }, content, meta?, additionalContexts? }
```

## execute 与 exec

`exec`（ToolRunContext）是工具访问作用域/会话/ctx 的**唯一路径**：

- **没有** `exec.scope` / `exec.session` / `exec.ctx`——一律经 **`exec.agent`**（`.id` / `.ctx` / `.session`），agent 由 agent-loop 注入。
- `exec.signal`：AbortSignal，取消契约（**必须转发/观察**，注册表无硬杀）。
- `exec.deferContext(UserMessage)` / 结果 `additionalContexts(UserMessage[])`：执行期把上下文还给循环。
- `exec.concludeTurn()`：把成功结果标记为终结当前轮次。

## 注册规则

| 规则 | 说明 |
| ---- | ---- |
| 必须 `output` | 缺/不支持 → `TypeError` |
| 重名 | 同层抛错 |
| `timeoutMs` | 正数/有限；由 `dsh-tool-call-timeout-policy`（插件 id `timeout-policy`）包装强制，不发给模型 |
| `run_code` | 无条件保留，不可注册/遮蔽 |
| 返回 | `register()` 返回 `() => void`（卸载函数） |
| `isConcurrencySafe(args)` | 返回恰好 `true` 才放行并行；否则 exclusive |

## 作用域与并行

| 注册位置 | 可见性 |
| -------- | ------ |
| 普通插件上下文 | 全局注册 |
| `agent.ctx` | 仅该 agent，遮蔽同名全局工具 |

- 用 `ctx.tools.restrict(filter)` 可给继承工具加 allow/deny 掩码（不影响自己注册的）。
- 工具呈现 mode（native/code/both）由配置决定，工具插件无需关心。
- MCP 桥：`dsh-mcp-client` 把外部 MCP 工具注册进 `ctx.tools`，命名 `mcp__<server>__<raw>`，走同一条流水线。函数名 ≤64 字符、`[A-Za-z0-9_-]`。

## 最佳实践

| 场景 | 用工具 / 别用 |
| ---- | ------------- |
| 给模型一个可调的能力 | 用工具 |
| 多个工具共享逻辑 | 逻辑放**服务**，工具做薄壳 |
| 只需要进程内自己人用 | 服务/方法即可，不必工具 |
| 读一个文件 | `tool-fs` 可能已够，别重复发明 |

## 验证

```bash
dsh web --dump-config | grep -A3 greet   # 查看配置
# 会话里调用一次，查看 tool 事件：
zstdcat ~/.dsh/sessions/*/*/session.jsonl.zstd \
  | jq -r 'select(.type | startswith("tool/"))' | tail -3
```
