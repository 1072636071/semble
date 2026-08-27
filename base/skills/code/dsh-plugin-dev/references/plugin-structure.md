# 插件结构、形态与生命周期

## 目录

- [插件本质](#插件本质)
- [三个核心导出](#三个核心导出)
- [三种插件形态](#三种插件形态)
- [生命周期与自动清理](#生命周期与自动清理)
- [依赖注入](#依赖注入)
- [事件监听](#事件监听)
- [作用域](#作用域)

## 插件本质

一个 dsh 插件 = **cordis 插件**（`function apply(ctx, config)` 或 `class extends Service`）+ **package.json 的 `dsh` 字段清单**（告诉 loader 怎么挂载、依赖什么）。

> 不存在 `dsh.plugin.json` 文件——真实清单只有 package.json 的 `dsh` 字段。

## 三个核心导出

函数形式插件的最简结构：

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-plugin'        // 插件唯一标识
export const inject = ['tools']        // 依赖声明（可选）
export function apply(ctx: Context) { // 入口函数
  // 依赖就绪后 apply 才会被调用
}
```

| 导出 | 作用 | 可选性 |
| ---- | ---- | ------ |
| `name` | 插件在组合中的唯一 id | 必选 |
| `apply` | 入口函数，注册能力 | 必选 |
| `inject` | 声明依赖的服务 | 可选 |
| `Config` | 配置 schema（Schemastery） | 可选 |

## 三种插件形态

| 形态 | 适用场景 | 写法 |
| ---- | -------- | ---- |
| **函数形式** | 大多数情况，挂工具、监听事件、无状态 | `export function apply(ctx, config)` |
| **对象形式** | 需要显式声明 name/inject | `export default { name, inject, apply(ctx) }` |
| **类形式** | 需要向其他插件提供服务 | `class MyService extends Service` |

### 函数形式

```ts
import { Context } from '@deepseek-ai/cordis'

export const name = 'my-plugin'
export const inject = ['tools']

export function apply(ctx: Context, config: { greeting: string }) {
  const dispose = ctx.tools.register({ ... })
  return dispose  // 返回 cleanup 函数
}
```

### 对象形式

```ts
export default {
  name: 'my-plugin',
  inject: ['tools'],
  apply(ctx) {
    // ...
  },
}
```

### 类形式（服务）

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

export default class MyService extends Service {
  static inject = ['tools']  // 注意：类的依赖走 static inject，与 apply 的 inject 不是同一来源

  constructor(ctx: Context) {
    super(ctx, 'myService')  // 服务名
    // 构造函数中完成同步初始化（必须同步，不能异步）
  }
}
```

类形式的依赖经 `Inject.resolve` 归一化。初始化必须同步。

## 生命周期与自动清理

- **自动清理**：通过 `ctx` 注册的一切（事件监听、工具、定时器）在插件卸载时自动清理，无需手动 `removeListener` 或 `clearInterval`。
- **手动资源**：网络连接、文件句柄等用 `ctx.effect()`：

```ts
export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(() => console.log('heartbeat'), 5000)
    // 返回的函数在插件卸载时执行
    return () => clearInterval(timer)
  })
}
```

## 依赖注入

- 依赖**静态声明**，加载时 loader 审查批准。
- 框架保证依赖服务就绪后才加载插件。
- 未声明的服务访问被上下文 Proxy 拒绝（**capability-based**）。
- 动态取用：`ctx.inject(['x'], cb)` 异步获取。

```ts
export const name = 'my-tool-plugin'
export const inject = ['tools']

export function apply(ctx: Context) {
  // 到这里 ctx.tools 已经就绪
  ctx.tools.register(/* ... */)
}
```

> **注意**：inject ≠ 权限。inject 管"够不够得着服务"，权限/沙箱管"允不允许做"。

## 事件监听

通过 `ctx.on(event, handler)` 监听事件，卸载自动清理：

```ts
export const name = 'hello-dsh'

export function apply(ctx: Context) {
  ctx.on('session/created', () => {
    console.log('[hello-dsh] 新会话！')
  })
}
```

完整事件清单参见官方文档 [事件系统](https://deepseekdocs.com/docs/learn/core/event-system)。常用事件有 `session/created` 等会话生命周期事件与工具流水线事件（`tools/pre-execute`、`tools/execute`、`tools/post-execute`、`tools/result`）。

## 作用域

| 注册位置 | 可见性 |
| -------- | ------ |
| 普通插件上下文 | 全局注册 |
| `agent.ctx` | 仅该 agent，遮蔽同名全局工具 |
