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

/**
 * 已存在卡的幂等形态（PRD 108 收口 retro P0-1）：看板脚本对已存在卡打印
 * `exists: <绝对路径>` 且 exit 0（2026-10-09 起）；旧版 die() exit 1 的形态
 * 一并兼容识别（exit code 非零但 stderr 含「已存在」），调用方都拿到复用语义。
 * 返回 { created, reused, output }：reused 供调用方区分「新投」与「复用」。
 */
function parseExisting(stdout, stderr) {
  const existsLine = String(stdout).split('\n').find((l) => l.includes('exists: '))
  if (existsLine) {
    const path = existsLine.split('exists: ')[1]?.trim() ?? ''
    return { reused: true, path, output: stdout.trim() }
  }
  if (/已存在/.test(String(stdout))) return { reused: true, path: '', output: stdout.trim() }
  if (/已存在/.test(String(stderr))) return { reused: true, path: '', output: String(stderr).trim() }
  return null
}

export function _parseExistingForTest(stdout, stderr = '') {
  return parseExisting(stdout, stderr)
}

export class Board {
  /** @param {string} script board.mjs 绝对路径 */
  constructor(script) {
    this.script = script
    /** 测试注入口：可替换 run 的实现（默认真实 execFile）。签名 = (script, args, cwd) → { stdout, stderr }，抛错 = CLI 失败。 */
    this._runImpl = run
  }

  /** 看板就位（幂等；in-project 自动判定）。 */
  async init(root) {
    return this._runImpl(this.script, ['init', '--root', root], root)
  }

  /** 投卡。已存在 = 幂等复用（新看板脚本 exit 0 打 `exists:`；旧版 die exit 1 也兼容识别），不视为错误。 */
  async newCard(root, { id, ticketFile, level = 'L2', model = 'auto', deps = [], keepInbox = false }) {
    const args = ['new-card', '--root', root, '--id', id, '--level', level, '--model', model]
    if (ticketFile) args.push('--ticket-file', ticketFile)
    if (deps.length > 0) args.push('--deps', deps.join(','))
    if (keepInbox) args.push('--keep-inbox')
    let stdout = ''
    try {
      ;({ stdout } = await this._runImpl(this.script, args, root))
    } catch (e) {
      // 旧版看板脚本对已存在卡 die() exit 1——错误消息命中「已存在」时降级为复用语义。
      if (/已存在/.test(String(e.message))) {
        return { created: false, reused: true, path: '', output: String(e.message) }
      }
      throw e
    }
    const existing = parseExisting(stdout)
    if (existing) {
      return { created: false, reused: existing.reused, path: existing.path, output: existing.output }
    }
    return { created: true, reused: false, path: '', output: stdout.trim() }
  }

  async cardMove(root, { id, to, actor = 'jxx-driver', reason }) {
    const args = ['card-move', '--root', root, '--id', id, '--to', to, '--actor', actor]
    if (reason) args.push('--reason', reason)
    await this._runImpl(this.script, args, root)
  }

  /** 五路对账；exit 5 = 有出入（不抛错，由调用方看 code）。 */
  async verify(root) {
    try {
      const { stdout } = await this._runImpl(this.script, ['verify', '--root', root], root)
      return { ok: true, output: stdout }
    } catch (error) {
      return { ok: false, output: error.message }
    }
  }
}
