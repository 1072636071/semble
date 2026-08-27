# 配置 Schema（Schemastery）与运行时设置

## 目录

- [静态配置 Config](#静态配置-config)
- [用户覆盖配置（patch 层）](#用户覆盖配置patch-层)
- [运行时用户配置 ctx.settings](#运行时用户配置-ctxsettings)
- [最佳实践](#最佳实践)

## 静态配置 Config

通过 `@deepseek-ai/schemastery`（导入名 `z`）定义配置 schema：

```ts
import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-plugin'

export const Config = z.object({
  greeting: z.string().default('你好'),
  maxItems: z.number().step(1).min(1).default(10),
})

export function apply(ctx: Context, config: typeof Config) {
  // config 是经过 schema 校验后的配置，缺失字段走默认值
  console.log(config.greeting, config.maxItems)
}
```

要点：

- 必须用 `@deepseek-ai/schemastery`，裸名 `schemastery` 解析失败。
- 导出的是 **schema 变量** `Config`（首字母大写），不是 TS interface。只导出 interface 无校验无默认值。
- `apply(ctx, config)` 的 `config` 参数是校验后的配置。

常用校验器：

| 写法 | 说明 |
| ---- | ---- |
| `z.string().default('x')` | 字符串 + 默认值 |
| `z.number().step(1).min(1)` | 整数（step 1）+ 最小值 |
| `z.boolean()` | 布尔 |
| `z.array(z.string())` | 字符串数组 |
| `z.object({...})` | 嵌套对象 |

## 用户覆盖配置（patch 层）

用户可在 `cordis.patch.yml` 中按插件 id 覆盖静态配置：

```yaml
# profile 的 cordis.patch.yml
- id: my-plugin
  name: '@dsh-external/my-plugin'
  config:
    greeting: 嗨
    maxItems: 5
```

规则：

- patch 按 **entry id** 定位，不要求 id 等于注册名。
- `config` 是**整行替换，不是深合并**——patch 给多少字段，插件拿到多少（缺的用 schema 默认）。覆盖时必须重述需要的每一个键。
- 应用顺序：`profile.bundles → win32 shell 层 → profile 自身 cordis.patch.yml → $DSH_HOME/cordis.patch.yml（机器级）→ --patch overlays → agent-presets → telemetry`。后应用层按行胜出。

## 运行时用户配置 ctx.settings

要让最终用户在 UI/Settings 中动态修改配置，使用 `ctx.settings`（需要 `@deepseek-ai/dsh-settings`）：

```ts
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { Context } from '@deepseek-ai/cordis'

const ns = settingsNamespace('my-plugin')

const schema = z.object({
  greeting: z.string().default('你好'),
  maxItems: z.number().step(1).min(1).default(10),
})

export async function apply(ctx: Context) {
  const scope = ctx.settings.register(ns, schema)
  const s = await ctx.settings.get(ns)
  // 解析顺序：schema 默认 → composition base → 用户层
  // 用户更新：
  // const updated = await scope.update({ greeting: '嗨' })
}
```

- 文件提供者 `dsh-settings-file` 默认读取 `$DSH_HOME/settings.yaml`，支持热发布外部编辑。
- 使用乐观并发 `revision`；通过 `settings/document-updated` 事件让 UI 和插件同步。

## 最佳实践

- **凡不同部署可能要改的参数都定义成配置字段，别硬编码。**
- **每个 schema 字段都声明默认值**（官方发布检查清单要求）。
- **无效配置在加载时响亮报错**，不要静默吞掉。
