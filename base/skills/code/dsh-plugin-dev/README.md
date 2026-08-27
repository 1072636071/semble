# dsh-plugin-dev

开发、打包、安装与发布 **DeepSeek Harness (dsh)** 插件的技能。dsh 一切皆插件（基于 Cordis 框架），插件是导出 `apply` 函数的 TypeScript 模块，可扩展工具、服务、事件、UI 等九类能力。

## 何时使用

当用户需要：

- 写一个 dsh 插件（工具/服务/事件监听）
- 给 dsh 新增或改写 Agent 工具
- 用 `create-dsh-plugin` 脚手架起步
- 构建 bundle 插件并打包发布到 GitHub/npm
- 用 Schemastery 定义插件配置 schema
- 排查插件加载失败、依赖解析、patch 配置不生效等问题

## 核心能力

- **插件结构**：三个核心导出（`name`/`apply`/`inject`/`Config`）、三种形态（函数/对象/类）、生命周期与自动清理
- **工具开发**：`defineTool` + `parameters`/`output`/`execute` 完整契约
- **服务开发**：`class extends Service` 提供可注入能力
- **配置**：Schemastery schema 静态配置 + `ctx.settings` 运行时设置
- **打包发布**：bundle 结构、`cordis.patch.yml` patch 语义、git/npm/tarball 三种分发
- **排错**：依赖解析（`@deepseek-ai/*` 命名空间）、patch 不生效、构建授权等常见坑

## 资源结构

```
dsh-plugin-dev/
├── SKILL.md                    # 入口：场景决策树 + 核心概念 + 工作流
├── references/
│   ├── plugin-structure.md     # 插件结构、三种形态、生命周期、依赖注入
│   ├── write-tool.md           # 写工具插件完整指南
│   ├── write-service.md        # 写服务插件
│   ├── config-schema.md        # 配置 schema 与运行时设置
│   ├── bundle-publish.md       # 打包、安装、发布、patch 语义
│   └── troubleshooting.md      # 常见坑与排查
└── assets/templates/
    ├── minimal-plugin.ts       # 最小插件模板
    ├── tool-plugin.ts          # 工具插件模板
    ├── service-plugin.ts       # 服务插件模板
    ├── bundle-package.json     # bundle 包 package.json
    └── bundle-cordis.patch.yml # bundle patch 层模板
```

## 官方文档来源

- 官方开发指南：<https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/development.md>
- 第一个插件教程：<https://deepseekdocs.com/docs/learn/dev/hello-plugin>
- 写工具教程：<https://deepseekdocs.com/docs/learn/dev/write-tool>
- 配置与发布：<https://deepseekdocs.com/docs/learn/dev/config-publish>
- 插件解剖：<https://deepseekdocs.com/docs/learn/core/plugin-anatomy>
- GitHub 仓库：<https://github.com/deepseek-ai/deepseek-harness>

> 注意：dsh 是快速迭代的开发者预览版（v0.1），API 一定会有破坏性变更，开发时以官方仓库最新为准。
