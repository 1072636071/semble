/** board.mjs CLI 薄封装——卡操作唯一通道（状态闸门/依赖闸门/账本/刷板都在它里面）。 */
import { execFile } from 'node:child_process'

function run(script, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [script, ...args],
      { cwd, timeout: 120_000, encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const first = String(stderr || '').trim().split('\n')[0] || error.message
          reject(new Error(`board.mjs ${args[0]} 失败：${first}`))
          return
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) })
      },
    )
  })
}

export class Board {
  /** @param {string} script board.mjs 绝对路径 */
  constructor(script) {
    this.script = script
  }

  /** 看板就位（幂等；in-project 自动判定）。 */
  async init(root) {
    return run(this.script, ['init', '--root', root], root)
  }

  /** 投卡。已存在 = 幂等打印跳过（board.mjs 语义），不视为错误。 */
  async newCard(root, { id, ticketFile, level = 'L2', model = 'auto', deps = [], keepInbox = false }) {
    const args = ['new-card', '--root', root, '--id', id, '--level', level, '--model', model]
    if (ticketFile) args.push('--ticket-file', ticketFile)
    if (deps.length > 0) args.push('--deps', deps.join(','))
    if (keepInbox) args.push('--keep-inbox')
    const { stdout } = await run(this.script, args, root)
    return { created: !/已存在/.test(stdout), output: stdout.trim() }
  }

  async cardMove(root, { id, to, actor = 'jxx-driver', reason }) {
    const args = ['card-move', '--root', root, '--id', id, '--to', to, '--actor', actor]
    if (reason) args.push('--reason', reason)
    await run(this.script, args, root)
  }

  /** 五路对账；exit 5 = 有出入（不抛错，由调用方看 code）。 */
  async verify(root) {
    try {
      const { stdout } = await run(this.script, ['verify', '--root', root], root)
      return { ok: true, output: stdout }
    } catch (error) {
      return { ok: false, output: error.message }
    }
  }
}
