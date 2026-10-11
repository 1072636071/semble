# 数据模型与校验规则参考

schema 真源：`lib/config.js`（dsh-agent-studio@0.1.5），顶层 `Config` 在 config.js:149-167；代理 `AgentSchema` config.js:62-82；段 `SectionSchema` config.js:44-48；装载重叠 `findLoadConflict` config.js:413-432。所有字段 `.volatile()`——这是写入通道准入条件（不标 volatile 平台设置服务拒绝写入，config.js:24-30），也意味着**改配置热生效不重启**。

## 顶层配置（六池）

```
{
  "version": 2,                    // schema 默认 2；POST patch 不收这个键
  "createdPresets": [ … ],         // 本插件自建预设的定义原文；面板不渲染；POST patch 不收
  "agents":         [ Agent ],     // 代理池
  "promptSets":     [ PromptSet ], // 提示词集池
  "toolSets":       [ ToolSet ],   // 工具集池
  "skillSets":      [ SkillSet ],  // 技能集池
  "runtimeContextOff": ["agentId"],// 关闭运行时环境快照注入的「代理 id」名单（默认空=照常注入）
  "bindings": { "presets": [ { "presetId": "…", "agentId": "…" } ] }  // 预设→主代理绑定
}
```

- POST /config 的 patch 只收 `agents / promptSets / toolSets / bindings`（必填四件套）+ `skillSets / runtimeContextOff`（可选，建议总发全）；`version`/`createdPresets` 不在白名单（api.js:279-291）。
- **全部池是数组不是字典**（config.js:16-22）：settings 合并语义是「对象递归合并、数组整体替换」，字典形态下界面永远删不掉成员（v1 的 `entries` 就栽在这里）。数组整体替换天然支持增删与重排，代价是**唯一性自己保证**（写入端点 `findLoadConflict` 把关）。

## Agent（config.js:62-82）

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `id` | string | 必填 | 池内唯一；`studio_delegate` 的 `agent` 参数、花名册 id |
| `name` | string | `''` | 显示名；空名写入端点兜底补「未命名代理」（config.js:320-326,351-364） |
| `note` | string | `''` | **模型决定派活给谁的依据**（`studio_list_subagents` 按它渲染名册，delegate.js:168-177），要写清职责 |
| `model` | {provider,model,reasoningEffort?} | {} | provider+model **必须成对**（delegate.js:199-207 只翻译成对值）；缺省继承会话模型 |
| `maxRetries` | int ≥0 | 5 | 降级链每个候选各自的重试上限；0 = 不重试失败即换 |
| `fallbacks` | Model[] | [] | 备用候选链（有序，可跨供应商）；空 = 降级不接管 |
| `background` | `'always-background'\|'foreground'\|'model-decides'` | `'model-decides'` | 仅当**被子代理派**时生效（delegate.js:337-339） |
| `toolPresentation` | `'follow'\|'native'\|'ptc'` | `'follow'` | 跟随预设 / 强制原生 / 强制 PTC |
| `promptSets` | string[]（有序） | [] | 已装提示词集 id；集顺序 = 段投递顺序（config.js:74-75） |
| `toolSets` | string[] | [] | 已装工具集 id；装了 = 工具面收窄到并集 |
| `skillSets` | string[] | [] | 已装技能集 id；装了 = 只暴露并集里的 skill |
| `children` | string[] | [] | 子代理花名册：指向 agents 池其它成员的 id（悬空引用在列名册时被滤掉，delegate.js:125-136） |

## 提示词集 / 工具集 / 技能集

```
PromptSet = { id, name, note, sections: [ { name, enabled: true, text? } ] }
ToolSet   = { id, name, note, tools:   [ 工具名字符串 ] }
SkillSet  = { id, name, note, skills:  [ skill 名字符串 ] }
```

- **Section**（config.js:44-48）：`name` 必填且 = 平台段名（引用平台预设段时不带 `text`；带 `text` = 自定义段/覆盖平台正文，apply.js:469-471）；`enabled:false` 的段不投递（apply.js:467-468）。段文本 `{{var}}` 由平台渲染期插值，**变量白名单内置三变量 `provider/model/cwd`**（config.js:506）+ 已观察到的插件注册变量；写没注册的变量会让那次请求直接抛错（config.js:546-558）。
- **无名段**：写入端点补默认名「未命名段 N」（不会静默消失，config.js:244-249,333-344），但名字应显式给。
- **段引用的平台预设不存在时**（没带 text）：静默不投递（apply.js:472-473）——复刻错预设名 = 静默丢段。

## 绑定语义：绑定即接管

- `bindings.presets`：`{presetId, agentId}`，`presetId` 在数组内唯一（config.js:104-115）。同一预设只能绑一个代理。
- 绑定后该预设的三面**全部**由代理装载集决定，**没有中间态**（apply.js:20-24）：
  - 段面：覆盖语义——清单即投递全部内容，没点名的平台预设段一律不投；一个集没装 = 投空清单（apply.js:440-445）；
  - 工具面：并集即清单，空 = 一个工具不给；机制工具 `run_code`/`structured_output` 永远放行（apply.js:69-79）；
  - 技能面：并集即清单，空 = 全隐藏（agent 层同名覆盖翻 `modelInvocable`，apply.js:654-706；用户手动调用不受影响）。
- **没绑定 = 完全不干预**（apply.js:283-291）。删预设端点会顺带清指向它的悬空绑定（presets.js:278-282,322-325）。

## 装载重叠规则（findLoadConflict，config.js:413-504）

写入端点保存前的硬校验（界面装载时也拦一次）：

1. 四池各自 **id 重复 → 拒**（config.js:414-425）；
2. 每个代理的已装集两两之间**不许重叠**（config.js:455-504）：
   - 两个已装提示词集含**同名段** → 拒；
   - 两个已装工具集含**同名工具** → 拒；
   - 两个已装技能集含**同名技能** → 拒；
3. 豁免名单（天然重复、不算撞车）：段 `tools:sdk` / `tools:ptc-only`（`PTC_REQUIRED_SECTIONS`，config.js:440）与工具 `skill`（`REQUIRED_TOOLS`，config.js:451）——它们在每个集里都有一份，真投递时 `mergeSections`/`mergeToolNames` 保序去重（config.js:234-259,267-284），不会投两遍。

结论：**新增集从零建就不会撞**；要给已有集加内容，加在集本身上（POST 全量替换自然生效），不要给同一代理挂两个重叠的集。

## 数组整体替换语义（POST 时怎么想）

- settings 合并写（mergeLayers）：**对象递归合并、数组整体替换、undefined 跳过**（api.js:240-248 注释原文）。
- 推论：
  - 想删池成员 / 删绑定 / 删段：POST 一份**不含它**的全量数组即可；
  - 想保留：POST 里原样带上（逐字节未动）；
  - 漏发键 ≠ 删空：四件套缺一 400 拒绝；`skillSets`/`runtimeContextOff` 漏发 = 保持原值（api.js:288-291）。**不要依赖「漏发保护」，六池全量是唯一可靠姿势**。
