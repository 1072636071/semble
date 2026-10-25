---
name: craft-router
description: Craft 套件路由—— storytold/ArtCraft 全家桶（17 个已编译应用）按任务分流到本仓对应子技能。当要用某个 craft 工具做设计/制图/表格/文档/PDF/音频/视频/特效/图像/RAW 处理、或问"这个活该用哪个 craft""craft 工具怎么用""figcraft 怎么画图""wordcraft 怎么生成文档"时使用。触发词：craft 路由、ArtCraft、storytold、figcraft、vectorcraft、gridcraft、cadcraft、designcraft、deckcraft、soundcraft、effectcraft、pdfcraft、wordcraft、filmcraft、photocraft、lightcraft。
---

<!--en-->
# Craft router

The storytold/ArtCraft suite is a set of clean-room Rust reimplementations of Adobe/Office tools.
Every app ships a CLI (`<app>-cli.exe`) with a `run` / `exec` subcommand (command scripts),
`commands` (registry listing), `describe` (one command's parameters) and an `mcp` subcommand
(stdio MCP server, headless by default). Pick the app by the artifact the user wants, then read
the child skill in this repository (`base/skills/storytold/`) for the exact recipe.
<!--/en-->

# Craft 路由：把任务指到本仓的子技能

storytold/ArtCraft 是 Adobe/Office 工具的 Rust 净室重实现。**每个应用都有 CLI**（`<app>-cli.exe`），
通用四件套：`commands`（列命令注册表）/ `describe <id>`（单命令参数）/ `run` 或 `exec`（执行命令脚本）/
`mcp`（stdio MCP server，默认 headless 进程内引擎）。二进制在 **`D:\\storytoldExe\\<App>\\`**（目录名带尾随空格，见下表）。

## 分流表（先选应用，再读子技能）

**二进制路径**（注意每个目录名都有**尾随空格**，写路径时别丢）：

| 应用 | CLI 路径 |
|---|---|
| figcraft | `D:\\storytoldExe\\FigCraft \\figcraft-cli.exe` |
| vectorcraft | `D:\\storytoldExe\\VectorCraft \\vectorcraft-cli.exe` |
| gridcraft | `D:\\storytoldExe\\GridCraft \\gridcraft-cli.exe` |
| cadcraft | `D:\\storytoldExe\\CADCraft \\cadcraft-cli.exe` |
| designcraft | `D:\\storytoldExe\\DesignCraft \\designcraft-cli.exe` |
| deckcraft | `D:\\storytoldExe\\DeckCraft \\deckcraft-cli.exe` |
| soundcraft | `D:\\storytoldExe\\SoundCraft \\soundcraft-cli.exe` |
| filmcraft | `D:\\storytoldExe\\FilmCraft \\filmcraft-cli.exe` |
| effectcraft | `D:\\storytoldExe\\EffectCraft \\effectcraft-cli.exe` |
| photocraft | `D:\\storytoldExe\\PhotoCraft \\photocraft-cli.exe` |
| lightcraft | `D:\\storytoldExe\\LightCraft \\lightcraft-cli.exe` |
| pdfcraft | `D:\\storytoldExe\\PdfCraft \\pdfcraft-cli.exe` |
| wordcraft | `D:\\storytoldExe\\WordCraft \\wordcraft-cli.exe` |
| launcher（无 CLI） | `D:\\storytoldExe\\Launcher\\artcraft-launcher.exe` |

| 你要做的东西 | 应用 | 本仓子技能 | 一句话 |
|---|---|---|---|
| 矢量插画 / SVG / 图标 / 界面稿 | figcraft | [figcraft](../figcraft/SKILL.md) | Figma 式矢量编辑器，`run` 脚本 + `export --format svg` |
| 矢量编辑 / 品牌资产 / 描边变形 | vectorcraft | [vectorcraft](../vectorcraft/SKILL.md) | Illustrator 式，569 条命令 |
| 表格 / 公式 / xlsx | gridcraft | [gridcraft](../gridcraft/SKILL.md) | Excel 式，`eval` 算公式、`convert` 转 xlsx |
| CAD / 工程图 / dxf-dwg | cadcraft | [cadcraft](../cadcraft/SKILL.md) | AutoCAD 式，`sample` 出样图 |
| 印刷排版 / 画册 / epub | designcraft | [designcraft](../designcraft/SKILL.md) | InDesign 式，脚本引用前步结果 |
| 幻灯片 / pptx | deckcraft | [deckcraft](../deckcraft/SKILL.md) | PowerPoint 式 |
| 音频 / 多轨 / 母带 | soundcraft | [soundcraft](../soundcraft/SKILL.md) | DAW，`--demo` 直接开演 |
| 视频剪辑 / 序列渲染 | filmcraft | [filmcraft](../filmcraft/SKILL.md) | Premiere 式，jsonl 脚本 + 异步导出 |
| 动态特效 / 合成 | effectcraft | [effectcraft](../effectcraft/SKILL.md) | After Effects 式，`render-frame` 单帧 |
| 图像编辑 / psd / 批量动作 | photocraft | [photocraft](../photocraft/SKILL.md) | Photoshop 式，`batch` 放动作 |
| RAW 显影 / 图库 | lightcraft | [lightcraft](../lightcraft/SKILL.md) | Lightroom 式，`render` 出图 |
| PDF 编辑 / 表单 / OCR / 红act | pdfcraft | [pdfcraft](../pdfcraft/SKILL.md) | Acrobat 式，171 个工具 |
| 文档 / docx / 报告 | wordcraft | [wordcraft](../wordcraft/SKILL.md) | Word 式，`run` 从空白建文档 |
| 统一入口 / 装应用 / 配模型 | craft-launcher | —（见下） | 启动器本身不是干活工具 |

**两个库没有 CLI**（编译产物只有 `.rlib`，agent 不直接调）：`winprint.rs`（打印管线）、
`craft-ai-integrations`（AI 连接层）。**`AniCraft` / `demo` 不是 Rust 包**（无 Cargo.toml）。

## 三步用法（任何子技能同构）

1. **发现命令**：`<app>-cli commands [FILTER]`，或 `describe <id>` 看参数。几百条命令，别背。
2. **跑脚本**：多数应用吃 JSON——`run --cmd 'id={json}'`（可重复）或 jsonl/JSON 数组脚本文件；
   filmcraft/effectcraft/lightcraft 用 `exec <id> key=value` 或 `run <script.jsonl>`。
3. **出产物**：`--export` / `--save` / `--out` / `convert` 落盘；矢量为 `.svg`，位图 `.png/.jpg`。

## 给 agent 用（MCP）

每个 CLI 都有 `mcp` 子命令（stdio JSON-RPC，默认 headless 进程内引擎）：

```sh
D:\\storytoldExe\\FigCraft \\figcraft-cli.exe mcp
```

把它配进 Claude Desktop / Cursor 等 MCP 客户端即可。**13 个 CLI 的 `mcp` 默认都是 headless stdio**（已逐个实测应答）；
唯一例外是 vectorcraft——它默认先尝试连 `127.0.0.1:7979` 上运行中的 app，失败才回落 headless，要确定 headless 得显式加 `--headless`。
连 GUI 的旗标各应用不同名：`--connect PORT`（gridcraft / wordcraft / designcraft / deckcraft / soundcraft / lightcraft）、
`--connect HOST:PORT`（cadcraft）、`--connect ADDR`（vectorcraft）、`--attach PORT`（figcraft）、`--bridge <127.0.0.1:port>`（filmcraft / effectcraft / photocraft）。
注意两类参数族：

- `--connect PORT` / `--attach PORT` / `--bridge HOST:PORT`：驱动**已运行的 GUI 应用**（先用
  `<app>.exe --control <port>` 起），否则 fallback 到进程内引擎。
- `--automation-read-root DIR` / `--automation-write-root DIR`：把 agent 能读/写的文件限制在目录内，
  可重复。**不给 write root = 禁止写**。

## 已知坑

- **designcraft / gridcraft 的 `--cmd` 吃 `ID=JSON`**，不是 `ID JSON`；PowerShell 里 JSON 引号要写成 `""`。
- **figcraft 的 `parent` 必须传节点 id**（`frame.create` 返回 `{"id":N}`），传名字报错。
- **filmcraft 的导出是异步 job**：jsonl 里给 `file.exportMedia` 传 `"wait":true`，否则进程退出 job 就丢；
  PNG 序列输出会带帧号后缀（`out0000.png`）。
- **重型 GUI crate 编译慢**：photocraft / vectorcraft 首次全量编译以十分钟计，别当卡死。
