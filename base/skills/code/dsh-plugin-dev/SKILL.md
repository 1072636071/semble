---
name: dsh-plugin-dev
description: 开发、打包、安装与发布 DeepSeek Harness (dsh) 插件。dsh 一切皆插件，基于 Cordis 框架，插件即导出 apply 函数的 TypeScript 模块，可扩展工具、服务、事件、UI 等九类能力。当用户需要：(1) 写一个 dsh 插件（工具/服务/事件监听），(2) 给 dsh 新增或改写 Agent 工具，(3) 用 create-dsh-plugin 脚手架起步，(4) 构建 bundle 插件并打包发布到 GitHub/npm，(5) 用 Schemastery 定义插件配置 schema，(6) 排查插件加载失败、依赖解析、patch 配置不生效等问题时使用。含代码模板与完整示例。
metadata:
  version: 1.0.0
---

# DSH 插件开发

开发 DeepSeek Harness（dsh）插件的完整指南。dsh 没有特权内核——模型路由、工具、沙箱、会话、存储、UI、Agent 循环全部以插件形式发布，底层元框架是 Cordis。

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
- **版本警告**：dsh 是快速迭代的开发者预览版（v0.1），一定会有破坏性变更。发布插件时在 README 注明目标 harness 版本。

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

模型供应商、工具、技能、会话、沙箱、存储、Agent 循环、调度、UI——全部可用插件替换。官方内置参考实现包为 `@deepseek-ai/dsh-tool-*`（bash、fs、web、lsp、subagent 等 21 个）。开发前先查内置包，避免重复发明（如读文件用 `tool-fs`，跑命令用 `tool-bash`）。

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
| [assets/templates](assets/templates) | 直接复制使用的代码模板 |

## 反模式

- **用裸名 cordis/schemastery**：解析失败，必须用 `@deepseek-ai/*`。
- **未声明 inject 就访问服务**：Proxy 拒绝。
- **patch config 只写改动的字段**：config 是整行替换，没写的字段走 schema 默认。
- **git 源拉源码后不提供 prepare 脚本**：git 安装不跑 build，TypeScript 包必须自带 `prepare` 脚本。
- **导出 TS interface 而非 schema**：`Config` 必须导出 Schemastery schema，interface 无校验无默认值。
