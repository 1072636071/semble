# 写一个服务插件

服务是插件向其他插件提供能力的载体。与工具的区别：工具是给模型调用的薄壳，服务是进程内其他插件消费的逻辑单元。多个工具共享逻辑时应放服务、工具做薄壳。

## 目录

- [类形式服务](#类形式服务)
- [函数形式提供服务](#函数形式提供服务)
- [服务消费](#服务消费)
- [最佳实践](#最佳实践)

## 类形式服务

服务插件用**类形式**（继承 `Service`）实现：

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

export default class MyService extends Service {
  static inject = ['tools']   // 依赖声明（类形式走 static inject）

  constructor(ctx: Context) {
    super(ctx, 'myService')   // super(ctx, 服务名)，其他插件用该名字注入
    // 构造函数中完成同步初始化（必须同步，不能 await）
  }

  myMethod() {
    return 'hello from service'
  }
}
```

要点：

- `static inject` 声明依赖，经 `Inject.resolve` 归一化——与 `apply` 的 `inject` **不是同一来源**。
- `super(ctx, 'myService')` 注册服务名，消费方用 `inject: ['myService']` 注入。
- **初始化必须同步**：构造函数不能异步初始化；需要异步时考虑函数形式 + `ctx.effect`。
- 类插件的 `name` 默认取包名，可显式设置。

## 函数形式提供服务

无状态场景可以用函数形式直接注册：

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-logger'
export const inject = ['logger']   // 若依赖 logger 服务

export function apply(ctx: Context) {
  // 直接在 ctx 上挂方法或注册回调
  ctx.on('tools/execute', (payload) => {
    console.log('tool executed:', payload.name)
  })
}
```

## 服务消费

任何插件通过 `inject` 声明即可消费服务：

```ts
export const name = 'consumer-plugin'
export const inject = ['myService']

export function apply(ctx: Context) {
  ctx.myService.myMethod()   // 依赖就绪后可用
}
```

动态取用（不在静态 inject 里声明）：

```ts
export function apply(ctx: Context) {
  ctx.inject(['myService'], (svc) => {
    svc.myMethod()
  })
}
```

## 最佳实践

- **服务做逻辑，工具做薄壳**：多个工具共享的逻辑放服务，工具 `execute` 里调服务方法。
- **能力边界**：服务的依赖声明由 loader 审查；未声明访问被 Proxy 拒绝。
- **生命周期**：服务随插件卸载自动清理；需手动释放资源用 `ctx.effect()`。
