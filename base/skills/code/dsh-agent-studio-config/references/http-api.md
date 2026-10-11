# HTTP 配置通道参考

前缀 `/api/dsh-agent-studio`（api.js:33 `API_PREFIX`，路由挂载 api.js:337-406）。默认 origin `http://127.0.0.1:3080`（面板地址即服务地址，可用 `--origin` 覆盖）。下文 file:line 以 dsh-agent-studio@0.1.5（`lib/api.js` / `lib/http-guard.js` 等）为准。

## 读写围栏（http-guard.js）

| 围栏 | 读端点 | 写端点 |
|---|---|---|
| host 校验（回环或 trustedHosts，host 头须规范形式） | ✅ validateRequestOrigin（http-guard.js:80-105） | ✅ 同左（写围栏内叠加，http-guard.js:116-118） |
| `sec-fetch-site: cross-site` | 403（http-guard.js:91-92） | 403 |
| `Origin` 头 | **带了才校验**：必须与 Host 一致（http-guard.js:93-103） | 同左 |
| `x-dsh-agent-studio: 1` | — | 必须（http-guard.js:14,119-121），缺失 403 `forbidden mutation request` |
| `content-type` | — | 必须 `application/json`（http-guard.js:122-129），否则 415 |
| 请求体上限 | — | 1 MiB（http-guard.js:16,177-179），超限 413 |

细节与结论：

- host 必须是回环（`localhost` / `[::1]` / `127.x.x.x`）或 `webRuntime.trustedHosts` 显式信任项（http-guard.js:45-70,87）。
- **没有 Origin 头的请求（curl / Node fetch 默认）读端点也放行**——Origin 校验只在带了该头时比对 Host。脚本对读写统一带 `Origin: <origin>` 最稳（与面板行为一致）。
- **studio 本地 HTTP 不用 API key / token**：围栏就是上表这些头，不要发明鉴权。实测（115-01）加写头 + Origin + JSON content-type 即 200。
- 错误响应统一 `{ok:false, error}` + 4xx/5xx；未知方法+路径 404 `unknown action`（api.js:403）。

## 端点全表

| 方法 + 路径 | 作用 | 成功响应形状 | 源码 |
|---|---|---|---|
| GET `/config` | 读当前生效配置 | `{ok:true, config:<六池对象或null>}` | api.js:367-370 |
| POST `/config` | 整体写配置（四件套必给全） | `{ok:true, warnings:string[]}` | api.js:391-394 → handleConfigUpdate api.js:257-325 |
| GET `/observation` | 各会话实际投递的段/工具/技能 + 机制工具名单 | `{ok:true, sessions:[…], cached:{…按预设}, mechanismTools:['run_code','structured_output']}` | api.js:355-365 |
| GET `/skills` | 技能集候选（活 agent 视角 ∪ 预设视角并集去重；读不到退观察缓存） | `{ok:true, source:'live'\|'cache', skills:[{name,description,source,whenToUse,resourceBase}]}` | api.js:371-374 → api.js:198-210 |
| GET `/presets` | 平台预设清单 | `{ok:true, authorable:bool, presets:[{id,name,description,order,broken,source,writable,promptFixed,snapshotFixed}]}`（source=`'plugin'\|'shipped'`） | api.js:379-382 → presets.js:119-141 |
| POST `/presets/create` | 从已有预设新建（构成声明取自来源预设，body `{from,id,name?,description?}`） | `{ok:true, id}` | api.js:395-397 → presets.js:194-264 |
| POST `/presets/delete` | 删除本插件自建预设（顺带清悬空绑定，body `{id}`） | `{ok:true}` | api.js:399-401 → presets.js:298-336 |
| GET `/models` | provider + 模型清单（面板三级联动） | `{ok:true, providers:[{id,name,models:[{id,name}]}], warnings}` | api.js:383-386 → models.js:20-46 |
| GET `/models/efforts?provider=&model=` | 某模型推理档位 | `{ok:true, efforts:[{id,name}], defaultEffort}` | api.js:387-390 → models.js:53-78 |
| GET `/client-parts/*.js` | 面板运行时部件（每次请求读盘，刷新即生效） | JS 文本 | api.js:221-239,375-378 |

GET `/observation` 的会话快照字段（observe.js:248-257）：`sessionId / presetId / bornPreset / sections:[{name,textLength,text}] / variables / tools:{visible,known,restrictable,reachable,owners} / skills / observedAt`。`sessions` 是本进程采到的（上限 50 会话，observe.js:30），`cached` 是上次进程留下的按预设快照——冷启动只有 cached 能把工具候选列全。

## GET 外壳 vs POST 纯体（坑③）

- **GET /config 回包是 `{ok,config}` 外壳**：配置本体在 `.config` 里。把 GET 回包整包回 POST = 请求体里没有 agents/promptSets/toolSets/bindings → 400「agents、promptSets、toolSets、bindings 必须一起给全」（api.js:292-296）。备份文件保留外壳便于与 live 对拍，POST 前必须 `.config` 剥壳。
- **POST 体是六池纯体**：`{agents, promptSets, toolSets, bindings, skillSets?, runtimeContextOff?}`：
  - `agents/promptSets/toolSets/bindings` 四键**必须一起给全**，缺一 400（api.js:279-296）；
  - `skillSets` / `runtimeContextOff` 可选：不发 = 保持原值（合并写跳过 undefined，api.js:288-291）——**推荐总是发全**，避免「忘了发」与「故意不发」分不清；
  - `version` / `createdPresets` 不在 patch 白名单（handleConfigUpdate 只取六键），发了也被忽略，POST 体不必带。

## 写入端点的校验链（api.js:297-320，校验脚本同款复刻）

1. `applyDefaultNames` 空名兜底（config.js:374-393）：agents/toolSets/skillSets 与各 promptSet.sections 里空 `name` 补「未命名…」默认名。
2. `findLoadConflict`（config.js:413-432）：四池 id 唯一 + 每个代理已装集之间无重叠（段名/工具/技能名；豁免 `tools:sdk`/`tools:ptc-only` 与 `skill`）。命中 400。
3. `validatePromptVariables`（config.js:560-583）：段文本 `{{var}}`——malformed 总拒；unknown 变量在已知清单可用时拒，清单不可用（冷启动）时收进响应 `warnings`。
4. `scope.update(normalized)`：settings 服务**用户层**热生效，落盘 profile `cordis.patch.yml` 的 `agent-studio` 行（不改宿主预设文件，重启不丢）。

## 热生效语义

- POST 成功即热生效：下一次会话装配（system-prompt/assemble）起用新配置；**已存在会话的下一次装配也用新配置**（装配瀑布每次现读配置，apply.js:268）。运行中请求的当次装配不受影响。
- 新增子代理要新会话 `studio_delegate` 派活验证；旧会话可能带着旧工具快照（坑⑦），配完一律新开会话验证。
- `toolPresentation` 三档的声明挂点在创建窗口/预设切换，装配期只保状态——改档后当会话第一条可能仍旧呈现（apply.js:10-19,198-225）。

## 写请求最小样例（PowerShell 5.1 实测姿势，115-01 §3 原样）

```powershell
$cfg = (([IO.File]::ReadAllText("$art\studio-config.backup.json")) | ConvertFrom-Json).config | ConvertTo-Json -Depth 100
Invoke-WebRequest -Uri 'http://127.0.0.1:3080/api/dsh-agent-studio/config' -Method POST -ContentType 'application/json' -Headers @{ 'x-dsh-agent-studio'='1'; Origin='http://127.0.0.1:3080' } -Body $cfg
```

坑④：PS 5.1 的 `-Body <字符串>` 走默认编码，中文会被刷成 `?`——中文内容必须 `[Text.Encoding]::UTF8.GetBytes($cfg)` 发字节且 content-type 带 `; charset=utf-8`。生产操作用 `scripts/studio-config-post.mjs`（Node 发 UTF-8 字节），别手搓。
