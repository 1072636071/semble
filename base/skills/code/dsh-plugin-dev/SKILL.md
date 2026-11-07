---
name: dsh-plugin-dev
description: "开发、打包、发布 dsh 插件。当用户说 dsh 插件、Cordis、插件配置时触发。"
metadata:
  version: 1.2.3
x-install: false   # 2026-11-07 起默认不安装：真源留仓，要临时用就手工拷或改回 true 再 ship install
---

# DSH 插件开发

开发 DeepSeek Harness（dsh）插件的完整指南。dsh 没有特权内核——模型路由、工具、沙箱、会话、存储、UI、Agent 循环全部以插件形式发布，底层元框架是 Cordis。

## 启动环境检查（触发后必做）

进入任何场景之前，先运行技能自带的探测脚本获取本机 dsh 环境报告（在技能根目录执行，stdout 输出 JSON，退出码恒为 0）：

```bash
node <本技能目录>/scripts/detect-env.mjs
```

**不要手写 shell 逐条探测环境**——固定流程一律跑脚本。脚本探测项：

- `DSH_PROJECT_PATH`：本地项目/源码 checkout 路径（验证存在性、是否含 `packages/` monorepo）
- `DSH_DEPLOY`：部署方式（约定值 `source` / `npm-global` / `bundle`）
- `DSH_HOME`：profile 根目录（缺省 `~/.dsh`）
- 兜底：定位 dsh CLI、`dsh --version`、校验 Node 版本（`^22.19.0 || >=24.0.0`）

结果处理（读 JSON 字段）：

| JSON 字段 | 动作 |
| --------- | ---- |
| `assumptions` 非空 | 逐条向用户声明假设；涉及本地路径的命令按官方默认生成并注明 |
| `checks.projectPathExists === true` | 优先参考 `DSH_PROJECT_PATH` 下 `packages/` 内置插件源码，而非联网查文档；按 `env.DSH_DEPLOY` 生成对应安装/启动命令 |
| `recommendations` | 逐条执行或转达用户（如 Node 版本不足、CLI 缺失、可设置的环境变量） |

## 场景决策树

收到请求后，先判断用户要做什么：

| 用户说 | 路径 |
| ------ | ---- |
| "写一个工具插件 / 给模型加个工具" | [references/write-tool.md](references/write-tool.md) |
| "写一个服务插件 / 提供某个服务" | [references/write-service.md](references/write-service.md) |
| "写个插件监听事件 / 最简单的插件" | [references/plugin-structure.md](references/plugin-structure.md) |
| "配置怎么定义 / Config schema" | [references/config-schema.md](references/config-schema.md) |
| "打包成 bundle / 发布 / 装到 profile" | [references/bundle-publish.md](references/bundle-publish.md) |
| "插件加载失败 / 解析不了 / patch 不生效" | [references/troubleshooting.md](references/troubleshooting.md) |
| "脚手架起步" | 用 `npx create-dsh-plugin <name> -t <tool\|events\|webui>` |
| 新建插件文件 | 从 [assets/templates](assets/templates) 复制对应模板 |

## 核心概念速查

**一个 dsh 插件 = 导出 `apply` 函数的 TypeScript 模块 + package.json 的 `dsh` 清单字段。**

四个核心导出（函数形式）：

| 导出 | 作用 |
| ---- | ---- |
| `name` | 插件唯一标识，如 `export const name = 'my-plugin'` |
| `apply(ctx, config)` | 入口函数，通过 `ctx` 注册能力 |
| `inject` | 声明依赖的服务，如 `export const inject = ['tools']` |
| `Config` | Schemastery 配置 schema，校验 + 默认值 |

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello-plugin'

export function apply(ctx: Context) {
  console.log('[hello-plugin] plugin loaded!')
}
```

关键规则（详情见各 reference）：

- **依赖必须导入 `@deepseek-ai/*` 命名空间包**：`import { Context } from '@deepseek-ai/cordis'`，`import z from '@deepseek-ai/schemastery'`。裸名 `cordis`/`schemastery` 会解析失败。
- **生命周期**：通过 `ctx` 注册的一切（事件、工具、定时器）在插件卸载时自动清理；手动资源用 `ctx.effect()`。
- **依赖注入**：`inject` 声明后框架保证依赖就绪才调用 `apply`；未声明的服务访问被 capability Proxy 拒绝。
- **配置即契约**：`Config` 是 Schemastery schema，patch 层给到的 config 是整行替换、不做深合并。
- **版本警告**：dsh 是快速迭代的开发者预览版（v0.1），一定会有破坏性变更。发布插件时在 README 注明目标 harness 版本。当前核对的依赖版本、内置工具包清单与上游仓库活动时间见 [references/upstream-status.md](references/upstream-status.md)。

## 开发工作流

### 1. 起步

```bash
# 环境要求：Node.js ^22.19.0 || >=24.0.0，pnpm
# 方式 A：官方脚手架（推荐）
npx create-dsh-plugin my-plugin -t tool        # tool / events / webui 三种模板
# 方式 B：源码检出（monorepo，可参考内置插件）
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness && pnpm install && pnpm run build
```

### 2. 写插件

按用户需求选择对应 reference 和 [assets/templates](assets/templates) 模板：
- 最小插件 / 事件监听 → `minimal-plugin.ts`
- 工具插件 → `tool-plugin.ts` + write-tool.md
- 服务插件 → `service-plugin.ts` + write-service.md

### 3. 本地挂载验证

```bash
# 方式 A：patch 层手动挂载（scratch 开发，不用打包）
dsh web --patch ./cordis.yml   # cordis.yml 里 name 必须是绝对路径
# 方式 B：bundle 本地目录安装
dsh plugin --profile demo add link:/path/to/my-plugin
# 验证挂载
dsh web --dump-config | grep my-plugin
```

### 4. 打包与发布

```bash
# 打包 bundle（结构见 assets/templates/bundle-*）
dsh plugin --profile demo add ./hello-plugin      # 本地安装验证
dsh plugin --profile demo remove dsh-hello-plugin # 卸载
# 发布：推公开 GitHub 仓库 + 打 dsh-plugin topic，README 注明 harness 版本
```

详细步骤见 [references/bundle-publish.md](references/bundle-publish.md)。

## 内置能力参考（九类可替换）

模型供应商、工具、技能、会话、沙箱、存储、Agent 循环、调度、UI——全部可用插件替换。开发前先查内置包，避免重复发明。

| 能力类别 | 说明 | 常见内置包 |
| -------- | ---- | ---------- |
| 工具 | 给模型/Agent 暴露可执行操作 | `dsh-tool-bash`、`dsh-tool-pwsh`、`dsh-tool-fs`、`dsh-tool-web`、`dsh-tool-lsp` 等 |
| 服务 | 跨插件共享的可注入能力 | 任意 `Service` 类插件 |
| 技能 | 定义技能行为 | `dsh-tool-skill` |
| 会话 | 会话生命周期/上下文 | `dsh-tool-session-query` |
| 沙箱 | 隔离执行环境 | `dsh-tool-bash`、`dsh-tool-terminal` |
| 存储 | 持久化读写 | `dsh-tool-fs`、`dsh-tool-goal`、`dsh-tool-jobs` |
| Agent 循环 | 子代理/编排 | `dsh-tool-subagent`、`dsh-tool-workflow`、`dsh-tool-agent-team` |
| 调度 | 定时/触发 | 由 `ctx.effect` + `ctx.setInterval` 实现 |
| UI | 界面/网页能力 | `dsh-tool-web`、`dsh-tool-ask-user` |

**官方内置工具包（`@deepseek-ai/dsh-tool-*`）**：完整清单与每个包的最新版本/用途，由 [references/upstream-status.md](references/upstream-status.md) 统一维护，通过 `scripts/sync-docs.mjs` 自动从上游 GitHub 仓库核对更新。**SKILL.md 不重复维护该清单**，开发时以上游状态文档为准，避免清单过期。

> 提示：工具包名会随上游演进增删。不确定某个能力有没有现成内置包时，先跑 `node <本技能目录>/scripts/sync-docs.mjs --json` 拉最新清单，或查 [upstream-status.md](references/upstream-status.md) 的「内置工具包清单」小节。

## 通用护栏

- **不硬编码**：不同部署可能要改的参数都定义成配置字段，别写死。
- **无效配置响亮报错**：schema 校验失败要明确提示，不要静默吞掉。
- **不编造 API**：dsh 快速迭代，API 以官方仓库为准。不确定时查 [官方开发指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/development.md) 或 `packages/` 下内置包源码。
- **依赖声明纪律**：访问 `ctx.xxx` 前先 `inject` 声明，否则被 Proxy 拒绝。

## 资源索引

| 资源 | 何时读 |
| ---- | ------ |
| [references/plugin-structure.md](references/plugin-structure.md) | 理解插件结构、三种形态、生命周期 |
| [references/write-tool.md](references/write-tool.md) | 写工具插件 |
| [references/write-service.md](references/write-service.md) | 写服务插件 |
| [references/config-schema.md](references/config-schema.md) | 定义配置 schema 与运行时设置 |
| [references/bundle-publish.md](references/bundle-publish.md) | 打包、安装、发布、patch 语义 |
| [references/troubleshooting.md](references/troubleshooting.md) | 排查问题 |
| [references/upstream-status.md](references/upstream-status.md) | 上游依赖版本、内置工具包清单、仓库活动状态（sync 维护） |
| [assets/templates](assets/templates) | 直接复制使用的代码模板 |
| [scripts/detect-env.mjs](scripts/detect-env.mjs) | 启动环境探测脚本（触发后先跑） |
| [scripts/sync-docs.mjs](scripts/sync-docs.mjs) | 从上游官方源核对并更新版本/工具清单 |

## 反模式

- **手写 shell 逐条探测环境**：固定流程直接跑 `node <本技能目录>/scripts/detect-env.mjs`，读 JSON 报告。
- **用裸名 cordis/schemastery**：解析失败，必须用 `@deepseek-ai/*`。
- **未声明 inject 就访问服务**：Proxy 拒绝。
- **patch config 只写改动的字段**：config 是整行替换，没写的字段走 schema 默认。
- **git 源拉源码后不提供 prepare 脚本**：git 安装不跑 build，TypeScript 包必须自带 `prepare` 脚本。
- **导出 TS interface 而非 schema**：`Config` 必须导出 Schemastery schema，interface 无校验无默认值。
