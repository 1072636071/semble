// dsh 工具插件模板：给模型新增一个可调用的工具
// 用法：改 name / defineTool 里的字段，然后 ctx.tools.register(defineTool({...}))
import type { Context } from '@deepseek-ai/cordis'
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
      // exec.agent 访问会话/ctx；exec.signal 处理取消
      return `${excited ? 'HELLO' : 'Hello'}, ${name}!`
    },
  }))
}
