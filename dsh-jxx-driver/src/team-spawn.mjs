/**
 * team-spawn 层（PRD 110 工单 01 / ADR-0121）：
 * 宿主智能体团队模式（agentTeams）的懒解析、队友名字池、复用预算与 SETTLED 机读行解析。
 * 本模块零依赖、零行为接线——只提供纯函数/工厂；编排器接入（spawn 路由/消息收割）在工单 02。
 *
 * 设计要点：
 *  - resolveAgentTeams 走鸭子类型懒解析，不进 index.mjs 的 inject 静态声明——
 *    无该服务的宿主必须还能装载（现有 ctx.get('commands') 同款可选解析先例）。
 *  - 名字池：角色前缀（dev/merger）+ 字母递增（dev-a、dev-b…）；被占用/重建过的名字跳过；
 *    生成名遵守 lower-kebab-case、≤64、不得为 lead（宿主硬约束）；池耗尽响亮报错转人工。
 *  - 复用预算：每队友完成任务计数；超过 reuseLimit 由 maybeRetire 判 retire，
 *    供上层换名重建 fresh 后继（换名重建本体在工单 03）。
 */

/** 懒解析宿主 agentTeams 服务：ctx 缺失 / 无 get / 服务缺三方法之一 → undefined（不抛）。 */
export function resolveAgentTeams(ctx) {
  if (!ctx || typeof ctx.get !== 'function') return undefined
  let service
  try {
    service = ctx.get('agentTeams')
  } catch {
    return undefined
  }
  if (!service || typeof service !== 'object') return undefined
  for (const method of ['spawnTeammate', 'sendMessage', 'interrupt']) {
    if (typeof service[method] !== 'function') return undefined
  }
  return service
}

/** 宿主硬约束：队友名 lower-kebab-case、≤64、不得为 lead。 */
export function isValidName(name) {
  return (
    typeof name === 'string' &&
    name.length <= 64 &&
    name !== 'lead' &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
  )
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

/**
 * 队友名字池工厂。taken/retired 里的名字永久跳过（宿主约束：名字永不复用）；
 * 池耗尽响亮报错转人工，不静默兜底。
 */
export function createNamePool({ taken = [], retired = [] } = {}) {
  const used = new Set([...taken, ...retired])
  return {
    /** 取该角色前缀下一个可用名（dev-a、dev-b…），取出即占用。 */
    next(role) {
      // 与 isValidName 同一 kebab 规则（禁止尾连字符），杜绝产出 dev--a 这类过不了自家校验的名字
      if (typeof role !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(role)) {
        throw new Error(`jxx-driver: 名字池角色前缀非法：${JSON.stringify(role)}`)
      }
      for (const letter of LETTERS) {
        const candidate = `${role}-${letter}`
        if (used.has(candidate)) continue
        used.add(candidate)
        return candidate
      }
      throw new Error(`jxx-driver: 名字池耗尽（${role}-a..z 全部被占用/重建过）——转人工处置`)
    },
  }
}

/**
 * 队友复用预算账本：recordCompletion 计数，maybeRetire 按「完成任务数 > reuseLimit」判 retire
 * （工单原文「超过 reuseLimit」= 严格大于；恰好等于不退，测试钉死边界）。
 */
export function createReuseLedger({ reuseLimit } = {}) {
  if (!Number.isSafeInteger(reuseLimit) || reuseLimit < 1) {
    throw new Error(`jxx-driver: reuseLimit 必须是 ≥1 的整数，收到 ${JSON.stringify(reuseLimit)}`)
  }
  const counts = new Map()
  return {
    /** 记一次任务完成。 */
    recordCompletion(name) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    },
    completedCount(name) {
      return counts.get(name) ?? 0
    },
    /** 超过 reuseLimit → retire: true，供上层停发并换名重建（本单不实现重建）。 */
    maybeRetire(name) {
      return { retire: (counts.get(name) ?? 0) > reuseLimit }
    },
  }
}

/**
 * 机读行解析：匹配正文中的 `SETTLED: <卡id>` 行，返回卡 id 或 undefined。
 * fail-closed：非字符串 / 无匹配行 / 小写 settled: / 冒号后同行无内容 一律 undefined，宁缺勿错。
 * （spec 原式 `/^SETTLED:\s*(.+)\s*$/m` 的冒号后 `\s*` 可跨行吞下一行——审查发现项，改为逐行
 * 切分 + 仅同行 `[ \t]` 空白，卡 id 空白兜底 undefined；首个命中行即定论，不 scavenging 后续行。）
 */
export function parseSettled(text) {
  if (typeof text !== 'string') return undefined
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^SETTLED:[ \t]*(.*)$/.exec(rawLine)
    if (m) {
      const id = m[1].trim()
      return id === '' ? undefined : id
    }
  }
  return undefined
}
