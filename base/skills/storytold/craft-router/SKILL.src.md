---
name: craft-router
description: Craft 套件路由——storytold/ArtCraft 全家桶（13 个 CLI 应用 + 1 个 GUI 启动器）按要的产物分流，再取该应用原文干活；子技能原文只在仓内真源与 WeKnora 库 dfaaf6fc 的 craft/ 目录（本仓自研，可运行可改可优化）。当要用某个 craft 工具做设计/制图/表格/文档/PDF/音频/视频/特效/图像/RAW 处理、或问"这个活该用哪个 craft""craft 工具怎么用""figcraft 怎么画图""wordcraft 怎么生成文档"时使用。触发词：craft 路由、ArtCraft、storytold、figcraft、vectorcraft、gridcraft、cadcraft、designcraft、deckcraft、soundcraft、effectcraft、pdfcraft、wordcraft、filmcraft、photocraft、lightcraft。不用于：代替子技能原文现编配方（这里只分流与取原文）、第三方设计软件（Figma/PS 本体）操作。
version: 0.3.0
disable-model-invocation: true
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [craft-router, codebuddy, storytold]
    description-en: |-
      1. Routes tasks to the right ArtCraft/storytold craft app (vector, raster, spreadsheet, CAD, print, slides, audio, video, VFX, photo, RAW, PDF, Word) and then fetches that app's skill text.
      2. Triggered by: craft tool names, "which craft tool", "how do I use figcraft", ArtCraft, storytold.
      3. Every app ships a CLI with commands/describe/run/export and an `mcp` subcommand, so agents can drive them headlessly.
      4. Child skills are not installed since 2026-10-28: read the repo source base/skills/storytold/<app>/SKILL.src.md, or fetch the KB copy from WeKnora dfaaf6fc folder craft/<app> (entry craft-<app>).
      5. Binaries: D:\storytoldExe\<Dir>\<app>-cli.exe (Windows). The directory name has NO trailing space; the launcher is GUI-only.
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# Craft router

The storytold/ArtCraft suite is **our own** clean-room Rust reimplementation of Adobe/Office tools — 13 apps with a
`<app>-cli.exe` plus one GUI launcher. Every CLI exposes `commands`, `run`/`exec`, `export` and `mcp`
(stdio, headless by default); `describe <id>` exists in only 4 of the 13 apps (designcraft, deckcraft, soundcraft,
filmcraft) — elsewhere read the parameters from `commands --json` or `--help`.
repo source `base/skills/storytold/<app>/SKILL.src.md` (only place to edit) or the WeKnora KB copy
(`dfaaf6fc…`, folder `craft/<app>`, entry `craft-<app>`). Binaries: `D:\storytoldExe\<Dir>\<app>-cli.exe`.
The directory names have **no** trailing space, and `D:\storytoldExe\Launcher\artcraft-launcher.exe` is a GUI that
auto-updates every app when started — never launch it from an agent session.
<!--/en-->

# Craft 路由：选应用 → 取原文 → 干活

storytold/ArtCraft 是 Adobe/Office 工具的 Rust 净室重实现，**本仓自研资产**：可运行、可修改、可优化。
13 个应用各有一个 CLI（`<app>-cli.exe`），通用面：`commands`（列命令注册表）/ `run` 或 `exec`（执行命令脚本）/
`export`、`convert`（出产物）/ `mcp`（stdio MCP server，默认 headless 进程内引擎）。**`describe <id>` 只有 4 家**
（designcraft / deckcraft / soundcraft / filmcraft），其余 9 家（figcraft / vectorcraft / gridcraft / cadcraft /
effectcraft / photocraft / lightcraft / wordcraft / pdfcraft）没有——参数只能从 `commands --json` 的 `params`
或 `--help` 读。选应用看产物，取原文见下节。

二进制固定落 **`D:\storytoldExe\<Dir>\<app>-cli.exe`**——**目录名没有尾随空格**（2026-10-28 实测；旧文档写的
`FigCraft \` 是错的，照抄报 `No such file or directory`）。目录名首字母大写、exe 全小写。

## 子技能去哪了（2026-10-28 起）

13 个子技能**不再安装**到任何 agent 技能目录（各源 `SKILL.src.md` 已标 `x-install: false`），只留两处：

- **仓内真源**：`base/skills/storytold/<app>/SKILL.src.md`（JwikisSkills 仓）——唯一可改的地方。
- **库内副本**：WeKnora 库 `dfaaf6fc-1e5d-4385-a290-58c847d71bcb` 目录 `craft/<app>`，条目 `craft-<app>`——任意工作区可取。

## 30 秒分流表（先选应用，再取原文）

“注册表条数”= 本轮 `commands` 实测值，**随 app 版本变，别当契约**。

| 你要的产物 | 应用 | CLI 目录（`D:\storytoldExe\` 下） | 注册表条数 | 库条目 |
|---|---|---|---|---|
| 矢量插画 / SVG / 图标 / 界面稿 | figcraft | `FigCraft\figcraft-cli.exe` | 569 | `craft-figcraft` |
| 矢量编辑 / 品牌资产 / 描边变形 | vectorcraft | `VectorCraft\vectorcraft-cli.exe` | 792 | `craft-vectorcraft` |
| 表格 / 公式 / xlsx | gridcraft | `GridCraft\gridcraft-cli.exe` | 341 | `craft-gridcraft` |
| CAD / 工程图 / dxf-dwg | cadcraft | `CADCraft\cadcraft-cli.exe` | 431 | `craft-cadcraft` |
| 印刷排版 / 画册 / epub | designcraft | `DesignCraft\designcraft-cli.exe` | 521 | `craft-designcraft` |
| 幻灯片 / pptx | deckcraft | `DeckCraft\deckcraft-cli.exe` | 321 | `craft-deckcraft` |
| 音频 / 多轨 / 母带 | soundcraft | `SoundCraft\soundcraft-cli.exe` | 480 | `craft-soundcraft` |
| 视频剪辑 / 序列渲染 | filmcraft | `FilmCraft\filmcraft-cli.exe` | 701 | `craft-filmcraft` |
| 动态特效 / 合成 | effectcraft | `EffectCraft\effectcraft-cli.exe` | 731 | `craft-effectcraft` |
| 图像编辑 / psd / 批量动作 | photocraft | `PhotoCraft\photocraft-cli.exe` | 491 | `craft-photocraft` |
| RAW 显影 / 图库 | lightcraft | `LightCraft\lightcraft-cli.exe` | 371 | `craft-lightcraft` |
| PDF 编辑 / 表单 / OCR / 涂红 | pdfcraft | `PdfCraft\pdfcraft-cli.exe` | 171 个工具 | `craft-pdfcraft` |
| 文档 / docx / 报告 | wordcraft | `WordCraft\wordcraft-cli.exe` | 633 | `craft-wordcraft` |
| 装应用 / 配模型 / 更新版本 | craft-launcher | `Launcher\artcraft-launcher.exe` | —（GUI，无 CLI） | —（不是干活工具） |

## 取原文（三级，先确定后语义）

**L0 本仓真源（有 JwikisSkills 工作区时最准）**：直接读 `base/skills/storytold/<app>/SKILL.src.md`。

**L1 库内确定性腿（跨工作区）**——`curl` + 列表 + 详情，不依赖向量服务。凭据腿
`~\Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md`（现取现用，不回显）：

```bash
KEY=$(grep -o 'sk-[A-Za-z0-9_-]*' "$HOME/Nutstore/1/我的坚果云/项目机密/Secret/WeKnora-知识库-API密钥.md" | head -1)
KB=dfaaf6fc-1e5d-4385-a290-58c847d71bcb; API=http://123.206.125.149:8127/api/v1
ID=$(curl -s -H "X-API-Key: $KEY" "$API/knowledge-bases/$KB/knowledge?folder_path=craft/figcraft&page_size=20" \
     | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data[0].id))")
curl -s -H "X-API-Key: $KEY" "$API/knowledge/$ID" \
     | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.metadata.content))"
```

```powershell
$key = [regex]::Match((Get-Content -Raw "$env:USERPROFILE\Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md"), 'sk-[A-Za-z0-9_\-]+').Value
$base = 'http://123.206.125.149:8127/api/v1'; $kb = 'dfaaf6fc-1e5d-4385-a290-58c847d71bcb'
$id = (Invoke-RestMethod -Headers @{'X-API-Key'=$key} "$base/knowledge-bases/$kb/knowledge?folder_path=craft/figcraft").data[0].id
(Invoke-RestMethod -Headers @{'X-API-Key'=$key} "$base/knowledge/$id").data.metadata.content
```

**L2 语义腿（可选，当前不可用）**：`POST $API/knowledge-bases/$KB/hybrid-search`，body `{"query_text":"craft figcraft 画 SVG","limit":5}`。
2026-10-28 实测返回 **500**：embedding 后端 `http://www.erp.sdcxslzj.com:11235/v1/embeddings` 连不上——
向量路挂了就走 L1，别在检索上耗时间。

库根另有索引条目 `craft-技能索引`（分流表 + 条目总表 + 维护口径）。**库副本是快照**：改行为一律改 L0 真源。

## 通用 CLI 形状（13 个应用同构，先看 help 再动手）

| 动作 | 命令 | 备注 |
|---|---|---|
| 列命令 | `<app>-cli commands [FILTER]` | `--json` **不是都有**：cadcraft 不认该旗标、designcraft/cadcraft 直接吐 JSON 文本、deckcraft/soundcraft 吐 `id — 描述` 行、pdfcraft 用 `tools`（蛇形工具名 + JSON Schema） |
| 看参数 | `<app>-cli describe <id>`（**仅 designcraft / deckcraft / soundcraft / filmcraft**） | 其余 9 家没有：读 `commands --json` 里的 `params`，或 `--help` |
| 跑脚本 | `run` / `exec` / `script` | JSON 数组、jsonl、或 `--cmd 'id={json}'`；**参数分隔符各应用不同**（见坑） |
| 出产物 | `export` / `--save` / `--out` / `convert` | 格式一般由**扩展名**定 |
| 给 agent | `<app>-cli mcp` | stdio JSON-RPC，默认 headless；`--automation-read-root` / `--automation-write-root` 限定可读写目录，**不给 write root = 禁写**；围栏**只属 `mcp`**——figcraft / vectorcraft / pdfcraft 的 `run` 传这两个旗标直接 `unknown option` |

连正在跑的 GUI（否则回落进程内引擎）：`--connect PORT`（gridcraft/wordcraft/designcraft/deckcraft/soundcraft/lightcraft）、
`--connect HOST:PORT`（cadcraft）、`--connect ADDR`（vectorcraft）、`--attach PORT`（figcraft）、
`--bridge 127.0.0.1:port`（filmcraft/effectcraft/photocraft）。GUI 侧用 `<app>.exe --control <port>` 起。

## 坑（本轮实测，按踩到顺序）

1. **目录名没有尾随空格**——`D:\storytoldExe\FigCraft\figcraft-cli.exe`；写成 `FigCraft \` 必失败。
2. **别在会话里跑 `artcraft-launcher.exe`**：它是 GUI，启动即对 13 个应用排队自动更新（实测会拉 GitHub `.msi`，
   网络通时会直接覆盖二进制）。要升级让用户自己点启动器。
3. **`commands --json` 不是通用旗标**：cadcraft/designcraft 直接输出 JSON 文本（designcraft 的 `--json` 还回 `[]`）、
   deckcraft/soundcraft 输出 `id — 描述` 文本、**pdfcraft 连 `commands` / `describe` 都没有**（schema 只能从 `tools` 读）。
   数条数：解析 JSON 数组长度，别数文本行（含参数续行会翻倍），也别 `grep` 字面（pdfcraft 自带 7 个叫 `name` 的参数，会虚胖 8）。
4. **`--cmd` 分隔符两派**：designcraft/gridcraft 是 `ID=JSON`；cadcraft 是 `'id {json}'`（空格）。
5. **figcraft `parent` 只认节点 id**：新文档里页面是 1、第一个 frame 是 2；对已有文件用 `--in` 时 id 会变，
   别把 2 当常量。`shape.ellipse` 的 x/y 是外接矩形左上角。
6. **filmcraft 导出是异步 job**：jsonl 里给 `"wait":true`，否则进程退 job 丢；PNG 序列带帧号后缀。
7. **两个库没有 CLI**：`winprint.rs`（打印管线）、`craft-ai-integrations`（AI 连接层）只有 `.rlib`；
   `AniCraft` / `demo` 不是 Rust 包（无 `Cargo.toml`）——别往这上面派活。
8. **重型 crate 首编慢**：photocraft / vectorcraft 全量编译以十分钟计，慢不等于卡死。

## 维护闭环（改真源后四步，缺一步就漂移）

1. 改 `base/skills/storytold/<app>/SKILL.src.md`（**不要**改库副本、不要改安装副本）。
2. `node base/scripts/ship.mjs install` 刷新分发，再 `node base/scripts/ship.mjs check`。
3. `node base/scripts/skill-lint.mjs --strict` 过技能宪章闸（P0/P1 必须为 0）。
4. **回灌库**：`PUT $API/knowledge/manual/<id>`，body `{title, content, status:"publish"}`
   （`status` 缺省会落 `draft` 不进索引）；`content` 开头两行 provenance：

   ```markdown
   > 来源：JwikisSkills 仓 `base/skills/storytold/<app>/SKILL.src.md`（自研技能真源）｜<日期> 迁入本库
   > 本仓自研技能，可运行、可改、可优化；改行为请改仓内真源，不要改本副本。
   ```

   改完顺手同步索引条目 `craft-技能索引`（分流表 + 条目总表）。

**写库属高风险动作，按这条纪律走**：覆写前先 `GET` 目标条目核对 `id` + `title`（防串位），覆写后回读比对长度与首行；
一次只改一张条目，批改前先在本地 `git diff` 确认只动了预期文件；API key 只在进程内活，脱敏口径是**只打末 4 位**，
不写文件、不进日志与提交信息。改错了用同一 PUT 恢复上一版内容（库内按版本留痕，可回滚）。

恢复某个子技能成本地安装：把它的 `x-install` 改回 `true`，再 `ship install`。

## 边界与失败出口

| 情况 | 出口 |
|---|---|
| 库不可达 / 语义检索 500 | 走 L1 确定性腿；仍失败就用 L0 真源 |
| 真源与库都拿不到 | 明确告诉用户缺哪份 `<app>` 原文，**别凭记忆现编命令** |
| 用户要的产物不在 13 应用范围 | 直说这套不支持，别硬套最近的应用 |
| 没有 write root / 目录不存在 | 拒绝写入并要用户给出可写目录 |
| 需要 GUI 的能力（`--connect` 等） | 说明需先由用户起 GUI，headless 面不覆盖 |
