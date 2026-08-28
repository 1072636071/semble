#!/usr/bin/env node
// dsh 上游文档同步脚本
// 用法：
//   node scripts/sync-docs.mjs            # 拉取上游数据并更新 upstream-status.md
//   node scripts/sync-docs.mjs --dry-run  # 只拉取并打印摘要，不写文件
//   node scripts/sync-docs.mjs --json     # 输出机器可读 JSON 摘要（供自动化判断）
// 退出码：0 正常；网络完全不可达时返回 2（便于外部识别）
// 依赖 Node 18+ 全局 fetch；网络请求无第三方依赖，零安装
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const STATUS_FILE = join(ROOT, 'references', 'upstream-status.md')

const REPO = 'deepseek-ai/deepseek-harness'
const GITHUB_API = 'https://api.github.com'
const NPM_REGISTRY = 'https://registry.npmjs.org'
const CORE_PKGS = ['cordis', 'schemastery', 'dsh-tools', 'dsh-settings', 'dsh-tool-fs']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

async function github(path, token) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      'User-Agent': 'dsh-plugin-dev-sync',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`GitHub ${path} -> HTTP ${res.status}`)
  return res.json()
}

async function npmVersion(pkg, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(pkg)}`, {
        headers: { 'User-Agent': 'dsh-plugin-dev-sync' },
      })
      if (!res.ok) return null
      const data = await res.json()
      const v = data?.['dist-tags']?.latest ?? null
      if (v) return v
    } catch {
      // 偶发网络抖动，重试
    }
    if (i < retries) await new Promise((r) => setTimeout(r, 300 * (i + 1)))
  }
  return null
}

// 并发受限地批量查询版本，避免瞬间打爆 registry 与偶发 5xx
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let idx = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++
      results[cur] = await fn(items[cur])
    }
  })
  await Promise.all(workers)
  return results
}

async function collectToolPackages(token) {
  const tree = await github(`/repos/${REPO}/git/trees/master?recursive=1`, token)
  const candidates = new Set()
  for (const item of tree.tree || []) {
    if (item.type !== 'tree') continue
    const m = item.path.match(/^packages\/[^/]+\/tool-([a-z0-9-]+)$/)
    if (!m) continue
    // 要求该包目录下有 src/，排除纯测试/文档骨架
    const hasSrc = (tree.tree || []).some(
      (t) => t.type === 'tree' && t.path === `${item.path}/src`,
    )
    if (hasSrc) candidates.add(m[1])
  }
  return [...candidates].sort()
}

async function collectPushedAt(token) {
  const meta = await github(`/repos/${REPO}`, token)
  return { pushed_at: meta.pushed_at, description: meta.description }
}

function renderStatus({ date, pushed_at, description, tools, coreVersions, toolVersions }) {
  const toolRows = tools
    .map((t) => `| \`${t}\` | ${toolBlurb(t)} | \`${toolVersions[t] ?? '—'}\` |`)
    .join('\n')
  const versionRows = Object.entries(coreVersions)
    .map(([pkg, ver]) => `| \`@deepseek-ai/${pkg}\` | \`${ver ?? '—'}\` | ${pkgBlurb(pkg)} |`)
    .join('\n')
  return `# 上游状态快照（dsh 官方源核对）

> 本文件由 \`scripts/sync-docs.mjs\` 自动维护，记录 DeepSeek Harness 官方上游的版本、依赖、内置工具包清单与仓库活动状态。
> 每次修改技能源码后，如内容与上游相关，请运行 \`node scripts/sync-docs.mjs\` 重新核对。
> **不要手改**「更新时间」「依赖版本」「内置工具包」三节——它们由脚本覆盖。

## 最近一次核对

- 更新时间：\`${date}\`
- 上游仓库：\`${REPO}\`（默认分支 \`master\`）
- 仓库描述：\`${description ?? '—'}\`
- 上游仓库最近提交（pushed_at）：\`${pushed_at ?? '—'}\`

## 核心依赖版本（@deepseek-ai/*）

| 包 | 最新版本 | 用途 |
| -- | -------- | ---- |
${versionRows}

## 内置工具包清单（@deepseek-ai/dsh-tool-*）

当前上游仓库 \`packages/\` 下共 \`${tools.length}\` 个工具包：

| 包后缀 | 用途 | npm 最新版本 |
| ------ | ---- | ------------ |
${toolRows}

## 上游核对说明

- **数据源**：GitHub API \`api.github.com/repos/${REPO}\`（仓库元数据）+ \`git/trees/master?recursive=1\`（包结构）；npm registry \`registry.npmjs.org/@deepseek-ai/<pkg>\`（版本）。
- **工具包判定规则**：路径形如 \`packages/<组>/tool-<名>\` 的目录视为内置工具包；仅计含 \`src/\` 的正式实现目录。
- **网络不可达时**：脚本保留上次快照不覆盖，并记录 \`syncOk: false\`。
`
}

const TOOL_BLURBS = {
  'agent-team': '多 Agent 团队协作',
  'ask-user': '向用户提问/收集输入',
  bash: '执行 Bash 命令',
  'bash-persistent': '持久化 Bash 会话',
  cordis: 'Cordis 元框架能力工具',
  fs: '文件系统读写',
  'fs-search': '文件系统搜索',
  goal: '目标追踪',
  jobs: '后台任务/作业',
  lsp: '语言服务器协议（代码语义）',
  pwsh: '执行 PowerShell 命令',
  'pwsh-persistent': '持久化 PowerShell 会话',
  ralph: '工作流编排引擎',
  'session-query': '会话查询',
  skill: '技能相关工具',
  'str-replace-editor': '字符串/文本替换编辑器',
  subagent: '子代理',
  'subagent-control': '子代理控制/管理',
  'subagent-report': '子代理报告',
  terminal: '终端交互',
  todo: '待办/任务清单',
  web: '网页抓取/搜索',
  workflow: '工作流编排',
}

const PKG_BLURBS = {
  cordis: '底层元框架（Context / Service）',
  schemastery: '配置 schema 定义与校验',
  'dsh-tools': '工具注册 API',
  'dsh-settings': '运行时设置服务',
  'dsh-tool-fs': '文件系统工具包',
}

function toolBlurb(t) {
  return TOOL_BLURBS[t] ?? '—'
}
function pkgBlurb(p) {
  return PKG_BLURBS[p] ?? '—'
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const jsonOnly = args.includes('--json')
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null

  let summary
  try {
    const tools = await collectToolPackages(token)
    // 核心框架包（@deepseek-ai/<name>）与工具包（@deepseek-ai/dsh-tool-<name>）分开查
    const coreVersions = Object.fromEntries(
      await mapLimit(CORE_PKGS, 6, async (p) => [p, await npmVersion(`@deepseek-ai/${p}`)]),
    )
    const toolVersions = Object.fromEntries(
      await mapLimit(tools, 6, async (t) => [t, await npmVersion(`@deepseek-ai/dsh-tool-${t}`)]),
    )
    const [{ pushed_at, description }] = await Promise.all([collectPushedAt(token)])
    summary = {
      syncOk: true,
      date: todayISO(),
      repo: REPO,
      branch: 'master',
      pushed_at,
      description,
      toolCount: tools.length,
      tools,
      coreVersions,
      toolVersions,
    }
  } catch (err) {
    summary = {
      syncOk: false,
      date: todayISO(),
      error: String(err && err.message || err),
    }
    if (jsonOnly) {
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
      process.exit(2)
    }
    console.error(`[sync-docs] 上游拉取失败：${summary.error}`)
    console.error('[sync-docs] 保留上次快照，未改写 upstream-status.md。')
    process.exit(2)
  }

  if (jsonOnly) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
    return
  }

  const content = renderStatus(summary)
  if (dryRun) {
    console.log('[sync-docs] --dry-run：将写入 upstream-status.md（未落盘）')
    console.log(content)
    return
  }
  writeFileSync(STATUS_FILE, content)
  console.log(`[sync-docs] 已更新 ${STATUS_FILE}`)
  console.log(`[sync-docs] 工具包 ${summary.tools.length} 个，最近提交 ${summary.pushed_at}`)
}

main().catch((err) => {
  console.error('[sync-docs] 未捕获错误：', err)
  process.exit(1)
})
