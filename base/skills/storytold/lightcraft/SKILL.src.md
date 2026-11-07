---
name: lightcraft
description: LightCraft 图库 + RAW 显影——批量显影导出/图库目录/预设。当要显影 RAW、批量导图、管图库时使用。触发词：lightcraft、RAW、显影、图库、Lightroom。不用于：位图修图与图层合成（photocraft）、矢量与排版（vectorcraft / designcraft）、视频（filmcraft）。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [lightcraft, raw, lightroom, photo library, codebuddy]
    description-en: |-
      1. LightCraft photo library and RAW developer: batch develop and export, library management.
      2. Triggered by: lightcraft, RAW develop, photo library, lightroom.
      3. CLI imports, develops with sliders, exports; a demo library needs no input.
      4. Usage: render in.jpg -o out.jpg --set light.exposure=0.5; run --library DIR --import PATH develop.auto ...
      5. Requires D:\storytoldExe\LightCraft\lightcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# lightcraft (English)

LightCraft is a headless Lightroom-style developer and photo library exposing 371 commands (`commands --json`, counted by `"id"`).
Trigger it to develop one file, batch-import and export a folder, set develop sliders or auto-correct, and manage a persistent library.
`render` develops-and-exports one file; `run` chains commands with `key=value` words (`--demo` starts from a procedural library, so no input is needed).
Binary: D:\storytoldExe\LightCraft\lightcraft-cli.exe (Windows, no trailing space in the folder name). Any failed command makes the exit status non-zero.
<!--/en-->

# LightCraft：图库 + RAW 显影

Lightroom 式引擎，`commands --json` 实测 **371 条命令**（数 `"id"` 出现次数），默认 headless。
CLI：`D:\storytoldExe\LightCraft\lightcraft-cli.exe`——目录名**没有尾随空格**。

## 何时用 / 不用于

- 用：单张 / 批量显影导出（`render`、`app.export`）；改滑块与自动（`develop.set` / `develop.auto`）；内置预设（`presets.list`、`--preset`）；导入并管持久图库（`--library`）；零输入试手（`--demo`）。
- 不用于：位图修图与图层合成（photocraft）、矢量与排版（vectorcraft / designcraft）、视频（filmcraft）。真实 RAW 必须给文件路径，别拿编造路径试。

## 输入

- 必给：一张图的路径（`render` / `--import`），或 `--demo`（程序化演示图库，零输入）。
- 可选：`--set light.exposure=0.5`（可重复）、`--size N`（最长边像素）、`--quality 1-100`（默认 92）、`--settings FILE`、`--preset ID`、`--opt KEY=VALUE`。
- 图库：`--library DIR` 会**写目录**，别指向源照片目录。

## 最小闭环（2026-10-28 实测）

```sh
CLI=/d/storytoldExe/LightCraft/lightcraft-cli.exe   # Windows: D:\storytoldExe\LightCraft\lightcraft-cli.exe
cd /e/work/sp/JwikisSkills/.temp/craft-runs/lightcraft
"$CLI" render in.jpg -o out.jpg --set light.exposure=0.5 --size 800
"$CLI" run --demo app.export path='E:/work/sp/JwikisSkills/.temp/craft-runs/lightcraft/demo.jpg' longEdge=1200
"$CLI" run --import in.jpg develop.set control=light.exposure value=0.7 develop.auto \
    app.export path='E:/work/sp/JwikisSkills/.temp/craft-runs/lightcraft/dev.jpg' longEdge=800
"$CLI" run --library lib --import in.jpg app.export path='E:/work/sp/JwikisSkills/.temp/craft-runs/lightcraft/lib.jpg' longEdge=400
```

真实产物：`out.jpg` = 8,414 字节 / 800×600（输入 8,229 字节）；`demo.jpg` = 131,273 字节 / 800×1200（3.3 s）；
`dev.jpg` = 8,414 字节 / 800×600，`develop.auto` 回真实滑块（exposure −0.45、contrast 68、highlights −66、shadows 52、vibrance 30）；
`lib.jpg` = 3,973 字节 / 400×300，图库目录只落 `catalog.snap` / `catalog.log` / `catalog.lock` / `view.json`。

## 命令怎么发现

- `lightcraft-cli commands [--json]`：实测 371 条（`--json | grep -c '"id"'`）。
- `lightcraft-cli --help`：三个子命令 `run` / `mcp` / `render` 的全部选项。
- `run` 里还能调控制协议方法：`presets.list` 实测回内置预设 `lc.warm-glow`、`lc.cool-morning`、`lc.teal-orange`…；`--script FILE|-` 额外吃 jsonl `{"command":id,"params":{…}}`。

## 常用命令族

| 族 | 代表 | 要点 |
|---|---|---|
| 显影 | `develop.set` / `develop.auto` / `develop.reset` | `set` 写 `control=… value=…`，可连写多条 |
| 导出 | `app.export` | `path=` + `longEdge=`；`--opt` 透传 app.export 的全部选项 |
| 导入 | `--import PATH` | 收文件或文件夹，可重复 |
| 预设 | `presets.list` / `--preset ID` / `--settings FILE` | `.lcpreset` 与 XMP 预设走 `--settings` |
| 图库 | `--library DIR` | 持久状态，会写目录 |
| 服务 | `mcp [--demo] [--library DIR] [--compact]` | stdio JSON-RPC 2.0 |

## 输出与校验

- 产物：`render` / `app.export` 按扩展名选编码器（`.jpg/.png/.tif/.webp/.avif/.jxl/.psd/.dng`）；`run` 每个命令打一行 JSON `{"command","ok","result"|"error","ms"}`。
- 读回断言：导出结果自带 `{"bytes","width","height","path","sidecars"}`——实测与磁盘一致（8,414 字节 / 800×600；3,973 字节 / 400×300）。
- 尺寸口诀：`--size` 与 `longEdge` 都指**最长边像素**——800×600 输入给 800 输出仍 800×600；演示图给 600 得 400×600。
- 批量：`--keep-going` 让后续命令继续，但**有失败最终退出码仍为 1**（实测 `1 command(s) failed`）。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| 一行 `{"command":"x","ok":false,"error":"unknown command \`x\`"}` + 末行 `N command(s) failed`，退出 1 | 命令 id 不存在；或把 CLI 子命令当 run 方法（`run --demo commands` 就这么报） | 只用 `commands` 输出的 id 交给 run；`commands` / `--help` 留在 CLI 层 |
| `WARN … import: … (os error 2)` + `nope.jpg: not a readable photo`，退出 1 | 输入不存在或不是可读图片 | 先 `ls` 核对再重跑；RAW 需相机档支持，不支持就换 JPEG/TIFF |
| `lightcraft-cli: unknown option \`--size\`` | 选项放错层：`--size`/`--quality`/`--set`/`--preset` 属 `render`，`run` 只吃 `--demo/--library/--import/--connect/--script/--keep-going` | 改用对的子命令；`run` 里用 `longEdge=` 这类 key=value |
| 图库目录被写脏 / 源照片被动 | `--library` 指到了照片目录 | 图库单独建空目录（实测只生成 `catalog.*` 与 `view.json`） |
| 首次导出 3 s 级才出图 | 解压资源 + 全尺寸显影 | 不是卡死，等着；批量加 `--keep-going` |

## 坑（实测）

- `commands` 是 **CLI 子命令**，不是 run 方法：`run --demo commands` → `unknown command \`commands\``。
- `--demo` 零输入（程序化演示图库），第一次摸 API 用它；导出 800×1200 约 3.3 s，别当卡死。
- 一个没有 `=` 的词就开启下一条命令；值能解析成 JSON 就当 JSON（`0.7`、`true`、`[1,2]`），否则当字符串——路径里有空格要加引号。
- `--library` 是**持久状态**，会写目标目录；`--connect [ADDR]` 要连已在跑的 GUI（`lightcraft --control 7980`，默认 127.0.0.1:7980），本轮 headless 未验证。
- `mcp --compact` 只列 helper 工具，全部命令仍可经 `run_command` 触达（本轮未接客户端验证）。

## MCP / 连 GUI

- `lightcraft-cli mcp [--demo] [--library DIR] [--compact] [--connect [ADDR]] [FILES/FOLDERS…]`：stdio JSON-RPC 2.0，默认 headless 并把给的文件导入。
- `--connect` 驱动运行中的 app，需先起 GUI（`lightcraft --control 7980`）。
