---
name: dsh-agent-studio-config
description: "维护 dsh-agent-studio 配置：提示词集、工具集、技能集、绑定预设。当用户说 studio 配置、提示词集、绑定预设时触发。"
x-install: true
x-scope: global
metadata:
  version: 1.0.0
---

# dsh-agent-studio 配置统一维护

通过 dsh-agent-studio 插件的 HTTP 配置通道（默认 `http://127.0.0.1:3080/api/dsh-agent-studio`）安全地备份、复刻、校验、写入、验证、回滚 studio 配置。所有契约以插件包源码 `lib/config.js` / `lib/api.js` / `lib/http-guard.js`（本机安装位置 `C:/Users/jxc123/.dsh/profiles/web/node_modules/dsh-agent-studio/`，下文引用 file:line 均指该包）与 115-01 工单实测为准。

## 心智模型（先读这个，三条全错一遍就是一次返工）

1. **四池 + 一份绑定**：`agents` / `promptSets` / `toolSets` / `skillSets` 四个数组池 + `bindings.presets`（预设→主代理绑定）。全部是**数组不是字典**（settings 合并语义 = 对象递归合并、**数组整体替换**）。所以 POST 必须**整体给全**：没发的键不参与写入（保持原值），发了的池**整个替换**——「只发增量」在这种语义下极易误删，永远发六池全量。
2. **绑定即接管**：预设绑到代理后，提示词/工具/技能三面**全部**由代理装载的集决定——提示词集不装 = 投递空提示词（覆盖语义，没列出的平台预设段一律不投）；工具集不装 = 一个工具都不给（机制工具 `run_code`/`structured_output` 永远放行）；技能集不装 = 一个 skill 都不暴露。**没绑定 = 完全不干预**。推论：绑定任何预设前必须先把该预设三面完整复刻。
3. **配置错字/错误 POST 即进 live 运行态**：写入端点只做形状/重叠校验，不做语义校验；返回 `{"ok":true,"warnings":[]}` 不代表内容对。所以**每次 POST 后必须 GET 回读对拍**，且 POST 前必须过本地校验脚本。

## 标准操作流（六步，一步不跳）

```
备份 → observation 复刻 → 构造六池 → 脚本校验 → POST → 回读对拍
```

| 步 | 动作 | 用什么 | 验证点 |
|---|---|---|---|
| 1 备份 | GET 现状落盘 | `scripts/studio-config-get.mjs --out backup.json` | JSON 可解析、外层 `{ok,config}`、bindings 与已知现状一致 |
| 2 复刻 | 拿三面真值 | `GET /observation`（get 脚本 `--observation`）；采不到目标预设就降级：复刻现网已装载集 + observation 交叉核验（见 pitfalls ⑤） | 段/工具/技能清单齐全，机制工具 `run_code`/`structured_output` 核对 |
| 3 构造 | 在备份上增改 | 手工/脚本拼新配置（**六池**：agents/promptSets/toolSets/skillSets/runtimeContextOff/bindings 全给） | 新代理默认**不绑定**；不动 bindings |
| 4 校验 | 本地静态校验 | `scripts/studio-config-validate.mjs proposed.json` | 退出码 0、无 error（warning 逐条人审） |
| 4b 体检 | **当前配置哪里会静默失效** | `scripts/studio-config-doctor.mjs`（live）/ `--file proposed.json`（待生效） | error 0 才继续；error = 话术↔三面不一致 / 坑⑮ 双份文本 / 空面 / 悬空引用 / 幽灵技能 |
| 4c 取新快照 | 基于**现状**改配置前重取备份 | `scripts/studio-config-get.mjs --out backup.json` | 过期快照上改配置 = 把 live 已修的项静默改回（doctor --file 会报「与 live 有 N 处差异」） |
| 5 POST | dry-run → apply | `scripts/studio-config-post.mjs proposed.json`（默认 dry-run，`--apply` 才真写） | 返回 `200 {"ok":true,...}`，人审 warnings |
| 6 验证 | 回读对拍 | `scripts/studio-config-verify.mjs proposed.json --backup backup.json` | live 与期望深相等、bindings 与备份逐字未动、diff 只含本次新增/改动条目 |
| 6b 复检 | live 再体检一次 | `scripts/studio-config-doctor.mjs --origin <origin> --root <项目根>` | error 0；warn 逐条裁决（有意留空就在 note 写「无技能面」消警）。要核对实投再加 `--observation live` |

回滚：`scripts/studio-config-rollback.mjs backup.json`（默认 dry-run，`--apply` 才写）——从 `{ok,config}` 备份剥壳出纯体 POST 回去。四个端到端流程（新建未绑定代理 / 改提示词段 / 绑定解绑 / 回滚）见 [references/workflows.md](references/workflows.md)。

## 配完如何新开会话验证（最干净的验证路径，坑⑦）

改完配置**必须新开会话**验证——旧会话/本会话的函数快照可能不含 studio_* 工具、面也可能停在旧配置。清单：

1. 新会话里主代理 `studio_list_subagents` 能看到新花名册、`studio_delegate` 派得出活；
2. 三面逐面核对：提醒段/角色段出现、工具清单 = 工具集并集（话术让用的工具都在）、技能目录只含技能集并集；
3. 未绑定的预设另开会话确认零变化（照常是原接待台）。

完整核对清单见 [references/workflows.md](references/workflows.md) §验证。

## 硬约束

- **危险动作默认 dry-run**：POST/rollback 脚本不加 `--apply` 只预演，绝不默认真写。
- **不硬编码端口/密钥**：端口默认 `http://127.0.0.1:3080`，可用 `--origin` 改；studio 本地 HTTP **不用 API key**（围栏是 Origin/host 校验 + 写头 `x-dsh-agent-studio:1`），不要发明鉴权。
- **UTF-8 无 BOM + LF**：所有配置 JSON 与脚本产物用 UTF-8（无 BOM）+ LF。PowerShell 5.1 发中文 body 必须发字节（`[Text.Encoding]::UTF8.GetBytes`），字符串 body 会把中文刷成 `?`（坑④）。
- **话术与工具面必须一致**：提示词段里让 agent 用某工具，该工具就必须在它装载的 toolSets 并集里，否则执行期 guard 拦（「能看不能调」）（坑①/M1）。

## 资源索引

| 资源 | 何时读 |
| ---- | ------ |
| [references/http-api.md](references/http-api.md) | 端点全表、读写头差异、GET 外壳 vs POST 纯体、热生效语义 |
| [references/data-model.md](references/data-model.md) | 四池+bindings schema、字段表、装载重叠规则、数组整体替换 |
| [references/pitfalls.md](references/pitfalls.md) | 14 条坑（现象→根因→预防/修法），动手前过一遍 |
| [references/workflows.md](references/workflows.md) | 四个端到端流程 + 新会话验证清单 |
| [references/config-recipe.md](references/config-recipe.md) | 115-01 实录层：十条坑逐条展开 + 实操坑 A–H + 33 项自检方法论 + 提交前 checklist（数字为 2026-10-10/11 时点实测，复刻以当次为准） |
| [scripts/studio-config-get.mjs](scripts/studio-config-get.mjs) | GET /config 落盘备份（只读） |
| [scripts/studio-config-validate.mjs](scripts/studio-config-validate.mjs) | POST 前本地校验（只读） |
| [scripts/studio-config-doctor.mjs](scripts/studio-config-doctor.mjs) | **配置体检**（只读）：全景表 + 一致性发现项。动配置前后各跑一次 |
| [scripts/studio-config-post.mjs](scripts/studio-config-post.mjs) | 安全 POST（默认 dry-run） |
| [scripts/studio-config-verify.mjs](scripts/studio-config-verify.mjs) | POST 后验证（只读） |
| [scripts/studio-config-rollback.mjs](scripts/studio-config-rollback.mjs) | 回滚（默认 dry-run） |

## 反模式

- **拿 GET 回包当 POST 体**：GET 外层是 `{ok,config}`，直接回 POST 等于发了个没有四件套的空壳（400）。要 `.config` 剥壳（坑③）。
- **只发改动的池**：数组整体替换语义下「增量 POST」= 没发的键不参与、发了的整池替换；漏发 `bindings` 虽不报错但极易误删/误改绑定，永远发六池全量。
- **手搓 curl/Invoke-RestMethod 带中文体直发**：先过校验脚本、用 POST 脚本（UTF-8 字节 + 写头），别绕开护栏。
- **绑定先行**：先绑预设再补三面 = 中间态会话三面全空。永远「复刻完 → 验证 → 最后才绑」。
- **把推测写成事实**：契约字段以源码 file:line 为准（见各 reference），没实测的标「待实测」。