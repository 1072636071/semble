// 最小 dsh 插件模板（事件监听 + 生命周期示例）
// 复制到项目后：改 name，在 apply 里写自己的逻辑
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-plugin'

export function apply(ctx: Context) {
  // 通过 ctx 注册的一切在插件卸载时自动清理
  ctx.on('session/created', () => {
    console.log(`[${name}] 新会话！`)
  })

  // 手动资源（网络连接、文件句柄、定时器）用 ctx.effect
  ctx.effect(() => {
    const timer = setInterval(() => {
      console.log(`[${name}] heartbeat`)
    }, 5000)
    return () => clearInterval(timer) // 卸载时执行
  })
}
