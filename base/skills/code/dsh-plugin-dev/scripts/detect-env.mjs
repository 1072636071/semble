#!/usr/bin/env node
// dsh 开发环境探测脚本
// 用法：node scripts/detect-env.mjs
// 输出：stdout 打印 JSON 报告，退出码恒为 0（探测失败不致命，体现在 JSON 字段中）
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'

const ENV_KEYS = ['DSH_PROJECT_PATH', 'DSH_DEPLOY', 'DSH_HOME']

function tryExec(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 }).trim() || null
  } catch {
    return null
  }
}

const env = {}
for (const key of ENV_KEYS) env[key] = process.env[key] || null

const report = {
  env,
  checks: {},
  fallback: {},
  assumptions: [],
  recommendations: [],
}

// 1. 本地项目路径
if (env.DSH_PROJECT_PATH) {
  const exists = existsSync(env.DSH_PROJECT_PATH)
  report.checks.projectPathExists = exists
  if (exists) {
    report.checks.isMonorepo = existsSync(join(env.DSH_PROJECT_PATH, 'packages'))
    report.recommendations.push('优先参考本地 checkout 的 packages/ 内置插件源码，而非联网查文档')
  } else {
    report.assumptions.push(`DSH_PROJECT_PATH 已设置但路径不存在：${env.DSH_PROJECT_PATH}`)
  }
} else {
  report.assumptions.push('DSH_PROJECT_PATH 未设置：无法引用本地 dsh 源码，API 细节以官方仓库为准')
}

// 2. 部署方式
const KNOWN_DEPLOY_MODES = ['source', 'npm-global', 'bundle']
if (env.DSH_DEPLOY) {
  report.checks.deployModeKnown = KNOWN_DEPLOY_MODES.includes(env.DSH_DEPLOY)
  if (!report.checks.deployModeKnown) {
    report.assumptions.push(`DSH_DEPLOY=${env.DSH_DEPLOY} 非约定值（${KNOWN_DEPLOY_MODES.join('/')}），按原值使用`)
  }
} else {
  report.assumptions.push('DSH_DEPLOY 未设置：按 npm 全局安装生成安装/启动命令')
}

// 3. DSH_HOME
report.checks.dshHome = env.DSH_HOME || join(os.homedir(), '.dsh')
if (!env.DSH_HOME) report.assumptions.push(`DSH_HOME 未设置：按默认 ${report.checks.dshHome} 处理`)

// 4. 兜底：定位 dsh CLI 与版本
const whichCmd = os.platform() === 'win32' ? 'where' : 'which'
report.fallback.dshCliPath = tryExec(whichCmd, ['dsh'])
report.fallback.dshVersion = tryExec('dsh', ['--version'])
if (!report.fallback.dshCliPath) {
  report.recommendations.push('未找到 dsh CLI，先完成安装（见 references/bundle-publish.md 或官方文档）')
}

// 5. Node 版本要求（^22.19.0 || >=24.0.0）
const [major, minor] = process.versions.node.split('.').map(Number)
report.checks.nodeVersion = process.versions.node
report.checks.nodeVersionOk = (major === 22 && minor >= 19) || major >= 24
if (!report.checks.nodeVersionOk) {
  report.recommendations.push(`Node ${process.versions.node} 不满足 ^22.19.0 || >=24.0.0，请先升级`)
}

// 6. 汇总建议：提示用户设置缺失的环境变量
const missing = ENV_KEYS.filter((k) => !env[k])
if (missing.length > 0) {
  const ps = missing.map((k) => `[Environment]::SetEnvironmentVariable('${k}', '<值>', 'User')`).join('; ')
  report.recommendations.push(`可设置缺失的环境变量以获得精确指引（PowerShell 用户级）：${ps}`)
}

process.stdout.write(JSON.stringify(report, null, 2) + '\n')
