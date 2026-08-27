# 打包、安装与发布

## 目录

- [两个核心概念：bundle 与 profile](#两个核心概念bundle-与-profile)
- [bundle 包结构](#bundle-包结构)
- [安装到 profile](#安装到-profile)
- [patch 层语义](#patch-层语义)
- [配置加载顺序](#配置加载顺序)
- [发布](#发布)
- [git 安装的构建坎](#git-安装的构建坎)
- [发布检查清单](#发布检查清单)

## 两个核心概念：bundle 与 profile

| 概念 | 位置/作用 | manifest 声明 | 回答的问题 |
| ---- | --------- | ------------- | ---------- |
| **组合包（bundle）** | 附带一个配置层的 npm 包 | `dsh.bundle` | "这个包贡献什么？" |
| **profile** | `$DSH_HOME/profiles/<name>` 目录，描述可启动组合 | `dsh.profile` | "这套配置由哪些组合包按什么顺序组成？" |

> 组合包是开发者编写并分发的东西；profile 是用户用 `dsh --profile <name>` 启动的东西。没有东西同时是两者。

## bundle 包结构

```
hello-plugin/
├── package.json       # 声明 dsh.bundle
├── cordis.patch.yml   # 该组合包贡献的配置层
└── index.js           # patch 行引用的插件模块
```

**package.json**：

```json
{
  "name": "dsh-hello-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "files": ["index.js", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

**cordis.patch.yml**（与 `--patch overlay` 相同格式，区别是按包名引用插件）：

```yaml
- insert:
    - id: hello
      name: dsh-hello-plugin
```

> 没有 `dsh.bundle` 声明的包仍可安装，但只作为普通依赖，不会激活任何配置层。

`dsh` 字段三种声明：

| 字段 | 含义 |
| ---- | ---- |
| `dsh.bundle.patch` | 声明本包是带 patch 层的 Bundle 插件（字符串，不是数组） |
| `dsh.client` | 声明 dual-face 插件的浏览器半部存在（配 `exports["./client"]`） |
| `dsh.profile.bundles` | 声明某 profile 依赖哪些 bundle |

## 安装到 profile

```bash
# 本地 checkout / 本地目录
dsh plugin --profile demo add ./hello-plugin
dsh plugin --profile demo add link:/path/to/my-plugin

# git 源
dsh plugin --profile demo add github:you/hello-plugin

# 验证层、启动
dsh --profile demo --dump-config    # 显示 "# == dsh-hello-plugin" 层
dsh --profile demo

# 卸载
dsh plugin --profile demo remove dsh-hello-plugin
```

首次使用会初始化 profile（`@deepseek-ai/dsh-base` 作为第一个组合包），自动生成：

```json
{
  "name": "dsh-profile-demo",
  "private": true,
  "dependencies": { "dsh-hello-plugin": "link:/path/to/hello-plugin" },
  "dsh": {
    "profile": { "bundles": ["@deepseek-ai/dsh-base", "dsh-hello-plugin"] }
  }
}
```

> profile manifest **从不需要手写**，`dsh plugin` 负责创建和维护。

`dsh plugin --profile <name> <args>` 本质是**很薄的 pnpm 转发器**：首次使用初始化 profile → 在 profile 目录跑 `pnpm <args>` → reconcile `dsh.profile.bundles` 层列表 vs 已安装状态。按"已安装状态"而非依赖 diff 来 reconcile，所以 `update` 能激活"新版本里才多了 `dsh.bundle` 声明"的包。

## patch 层语义

`cordis.patch.yml` 是**顶层 YAML 数组**，一条目只有两种操作：

1. **`insert`**（缩进子列表）：按 id 在目标 group 追加 1+ 行
2. **按 id 覆盖整行**：不带 `insert`，`id` 定位已有行，可改 `name`/`config`/`disabled`/`inject`/`group`/`isolate`/`intercept`

三条易踩约束：

| 约束 | 说明 |
| ---- | ---- |
| `config` 是**整行替换**，非深合并 | patch 给多少字段，插件拿到多少（缺的用 schema 默认） |
| `name` 不符 → **静默跳过** | patch 带 `name` 且与目标行不符，loader 只 warn、条失效 |
| 没有 `replace`/`ignore` 动词 | insert 出的行可被后续 patch 按 id 配置/禁用 |

## 配置加载顺序

生效配置在**空根**之上按以下顺序逐层组合：

1. `dsh.profile.bundles` 列表中的各组合包 patch（按列表顺序）
2. profile 自己的 `cordis.patch.yml`
3. home 级 `$DSH_HOME/cordis.patch.yml`（各 profile 共享的机器本地偏好）
4. 每个 `--patch <path>` overlay（按 argv 顺序）

**两条规则**：
- 后应用的层**按行胜出**；patch 会**替换**目标行的整个 config 值（不做深度合并）。
- 覆盖某行时必须重述该行所需的**每一个键**，而非只写改动的部分。

> 根 `cordis.yml` 每次启动被重写为空 `[]`——真实配置树 100% 由 patch 层组成。

给组合包作者的推论：优先给出用户大概率会保留的配置默认值；用户可在自己的 `cordis.patch.yml` 中覆盖你的行，无需改动你的包。

## 发布

1. **仓库清单**：package.json 的 `dsh` 字段（见上）。
2. **提交到 GitHub**：推公开仓库。
3. **打 `dsh-plugin` topic**：这是官方可发现性约定，awesome 列表会索引该话题。
4. **README 注明测试所用 harness 版本**：dsh 是开发者预览版，一定有破坏性变更。钉定目标版本，关注 GitHub Discussions。
5. **用户一行安装**：`dsh plugin --profile web add "github:dsh-external/my-plugin#main"`。

## git 安装的构建坎

git 安装拉取的是**源码而非构建产物**，没有任何环节运行 build 脚本。需要两边配合：

**作者侧**：提供 `prepare` 脚本，pnpm 在 git 安装后运行它；必须自包含（不能依赖 monorepo checkout 等仅开发环境存在的上下文）。示例：用专用 tsdown 配置直接转译 `src/`。

**用户侧**：pnpm ≥10 默认拒绝运行 git 依赖的 prepare 脚本，需在 profile 的 `pnpm-workspace.yaml` 显式授权：

```yaml
allowBuilds:
  dsh-hello-plugin: true
```

> **安全提醒**：授权意味着允许该包代码在安装时于你的机器上执行，**且不在 agent 的沙箱之内**。只对源码可信的包授权，并锁定 commit（`github:you/hello-plugin#<sha>`）。

**免构建权限的发布方式**（不让用户做 build 授权）：
- 发布到 npm：`pnpm publish` 时构建好 `lib/`，`dsh plugin add your-package` 安装预构建代码。
- 交付 tarball：`pnpm pack` 打包，用户 `dsh plugin add ./hello-plugin-0.1.0.tgz`。

## 发布检查清单

| 检查项 | 要求 |
| ------ | ---- |
| 构建产物 | `lib/` 已入库，或构建脚本可用 |
| 依赖完整 | 注意裸名依赖，必要时将裸名装进插件自身 `node_modules` |
| 组合正常 | `dsh web --dump-config` 无异常 |
| 文档 | 中英文 README（组织惯例：README.md + README.zh.md） |
| schema | `Config` / `ctx.settings` schema 都声明了默认值 |

**验证发布**（干净环境模拟用户安装）：

```bash
dsh plugin --profile web add "github:dsh-external/my-plugin#main"
dsh web --dump-config | grep my-plugin
```
