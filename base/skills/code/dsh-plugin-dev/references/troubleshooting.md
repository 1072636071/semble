# 常见坑与排查

## 目录

- [快速排查表](#快速排查表)
- [依赖与解析](#依赖与解析)
- [patch 配置](#patch-配置)
- [安装与构建](#安装与构建)
- [运行时](#运行时)

## 快速排查表

| 症状 | 原因 | 解法 |
| ---- | ---- | ---- |
| 裸名 `cordis`/`schemastery` 解析失败 | 框架装载闭包只含 `@deepseek-ai/*` 包 | 用 `@deepseek-ai/cordis`、`@deepseek-ai/schemastery`；必要时把裸名装进插件自身 node_modules |
| 访问 `ctx.xxx` 被 Proxy 拒绝 | 未声明 inject 就访问服务 | 先 `export const inject = ['xxx']` |
| patch 改了不生效 | `name` 不符静默跳过；或 `config` 整行替换非深合并 | 对齐 id/name；`--dump-config` 核对；重述所有需要的键 |
| bundle 装了不生效 | 需重启 | 重启 `dsh web` |
| 卸载后仍报错 | remove 不回写 patch 层 | 手动删 `cordis.patch.yml` 对应 insert 行 |
| `--patch` 路径写相对路径 | loader 用 profile 目录解析模块路径 | patch 文件里插件路径必须是绝对路径，用 `pwd` 的结果拼 |
| 只导 `Config` interface 不导同名 schema | 无校验无默认值 | 导出 Schemastery schema 变量 |
| git 安装的 TS 包无法运行 | git 拉源码不跑 build | 作者加 `prepare` 脚本；用户侧授权 `allowBuilds` |
| config 缺字段 | 整行替换 | 补全字段或依赖 schema 默认值 |

## 依赖与解析

- **框架 vendor 化后只发布为 `@deepseek-ai/*` scoped 包**，插件必须 `import from '@deepseek-ai/cordis'`、`import z from '@deepseek-ai/schemastery'`；直接用裸名 `cordis`/`schemastery` 会解析失败（官方 issue #554）。
- 依赖解析（rescope）元数据约束：profile 目录使用 **bundle 名双锚点解析**（先 bundle 安装目录，后 profile 目录）+ `$DSH_HOME/profiles/node_modules` 扁平闭包 fallback，让 out-of-tree 插件解析到**同一个 cordis 实例**。
- 插件想要裸名依赖时，在插件目录自身 node_modules 安装缺失裸名。

## patch 配置

- **热更新边界**：只有 profile 自身的 `cordis.patch.yml` 会被 `watchUserPatches` 热应用；`--patch` 覆盖层和 bundle 的 patch 文件改动需要重启生效。
- 热应用失败时框架保留上一个好树并广播 `hmr/config-update-failed`。
- patch 带 `name` 且与目标行不符：loader 只 warn、条失效（静默跳过）。
- 覆盖某行必须重述该行所需的每一个键，config 是整行替换。

## 安装与构建

- git 源安装拉源码不跑 build；TS 包需要 `prepare` 脚本（pnpm 安装后运行），脚本必须自包含。
- 首次 `add` 会被 pnpm 的 `allowBuilds` 拦截——按报错把允许 key 写进 profile 的 `pnpm-workspace.yaml` 再重试。
- 不想让用户授权 → 发布到 npm 或交付 `pnpm pack` 的 tarball。

## 运行时

- **验证组合树**：`dsh web --dump-config | grep -B1 -A2 my-plugin`（看插件挂载与层来源注释）。
- **看 profile 的 bundle 层列表**：`node -e "console.log(require('./profiles/web/package.json').dsh?.profile?.bundles)"`。
- **工具执行问题**：查看会话日志中的 `tool/*` 事件：`zstdcat ~/.dsh/sessions/*/*/session.jsonl.zstd | jq -r 'select(.type | startswith("tool/"))' | tail -3`。
- **dsh 快速迭代**：API 以官方仓库为准。遇到未覆盖问题去 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)（官方支持渠道）。
