// dsh 服务插件模板：向其他插件提供服务能力
// 类形式：static inject 声明依赖，super(ctx, '服务名') 注册服务
import { Service, type Context } from '@deepseek-ai/cordis'

export default class MyService extends Service {
  static inject = ['tools'] // 依赖声明（类形式走 static inject）

  constructor(ctx: Context) {
    super(ctx, 'myService') // 服务名，消费方用 inject: ['myService'] 注入
    // 构造函数中完成同步初始化（必须同步）
  }

  greet(name: string): string {
    return `Hello from myService, ${name}!`
  }
}

// 消费方用法：
// export const name = 'consumer'
// export const inject = ['myService']
// export function apply(ctx: Context) {
//   ctx.myService.greet('world')
// }
