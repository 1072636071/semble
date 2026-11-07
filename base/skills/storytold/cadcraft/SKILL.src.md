---
name: cadcraft
description: CadCraft CAD——读 dxf/dwg、转 svg/png/pdf、跑工程图命令脚本、内置样图零输入试手。当要处理 CAD 图纸、dxf 转换、或生成样图时使用。触发词：cadcraft、CAD、dxf、dwg、工程图。不用于：画矢量插画与图标（转 figcraft）、位图修图（转 photocraft）、替代 AutoCAD 或 dwg 编辑器本体、做机械强度计算。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [cadcraft, cad, dxf, dwg, codebuddy]
    description-en: |-
      1. CadCraft CAD: inspect DXF/DWG, convert to svg/png/pdf, run drawing scripts.
      2. Triggered by: cadcraft, CAD, dxf, dwg, engineering drawing.
      3. CLI has built-in samples so a first export needs no input file.
      4. Usage: cadcraft-cli sample bracket out.svg; info f.dxf; convert in.dxf out.svg [FRAMING].
      5. Requires D:\storytoldExe\CADCraft\cadcraft-cli.exe (Windows); directory name has no trailing space.
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# cadcraft (English)

CAD engine CLI for DXF/DWG drawings; build 0.10.0, and `commands` prints the whole registry as JSON
(431 entries, 138 KB) — it rejects `--json`, so parse that output instead of grepping plain text.
Subcommands: `sample bracket|floorplan OUT` (no input file needed), `info FILE`, `convert IN OUT`
(format from the extension), `run` (script text, or repeated `--cmd 'id {json}'`, then `--save`/`--export`).
Raster output is always 2400×1600 and every export takes framing (`--window` / `--view`).
Binary: `D:\storytoldExe\CADCraft\cadcraft-cli.exe` (directory name has no trailing space).
<!--/en-->

# CadCraft：CAD / 工程图

AutoCAD 式引擎，`commands` 输出的注册表实测 **431 条命令**（脚本 0.10.0；JSON 138,853 字节 / 5,726 行）。
CLI 固定落 `D:\storytoldExe\CADCraft\cadcraft-cli.exe`——**目录名没有尾随空格**（旧文档写的 `CADCraft \`
照抄报 `No such file or directory`）。默认 headless，且**内置样图**：没有图纸文件也能先跑通一条链路。

## 何时用 / 不用于

- 用：读 dxf/dwg 出摘要（图层、实体计数、图幅范围）、转 svg/png/pdf、批量出工程图。
- 用：用命令脚本改图（画线、画圆、倒角、偏移、修剪）后另存 dxf / 导出图片。
- 用：没有素材时用内置样图验证本机链路（`sample bracket|floorplan`）。
- 不用于：矢量插画、图标、界面稿（figcraft）；位图修图（photocraft）。
- 不用于：替代 AutoCAD / dwg 编辑器本体；机械强度、公差计算等工程计算不在这里做。

## 输入

- 用户需要给：图纸文件（.dxf / .dwg）路径，或明说「用内置样图」；要的产物格式（dxf/dwg/svg/png/pdf）。
- 可选：取景范围（`--window x0,y0,x1,y1` 或 `--view extents|current`）、画笔/图层、是否需要文字与标注。
- 命令脚本输入：`--script TEXT` / `--script-file F.scr` / 重复 `--cmd 'id {json}'`；`id` 取自 `commands`。
- 参数查法：`commands` 每条带 `params`（**没有 `describe` 子命令**）。

## 最小闭环（2026-10-28 本机实测）

```sh
CAD=/d/storytoldExe/CADCraft/cadcraft-cli.exe
mkdir -p .temp/craft-runs/cadcraft && cd .temp/craft-runs/cadcraft
timeout 180 "$CAD" sample bracket bracket.dxf     # 内置样图：46 个实体，9 个图层
timeout 180 "$CAD" info bracket.dxf               # JSON 摘要：entityCount / counts / layers / extents
timeout 180 "$CAD" convert bracket.dxf conv.svg   # 格式由扩展名决定
timeout 180 "$CAD" run bracket.dxf \
  --cmd 'line {"points":[[0,0],[2200,0]]}' \
  --save mod2.dxf --export mod2.png --window 0,-1473,2200,727
```

真实产物：`bracket.dxf` = **42,690 字节**（46 实体）→ `conv.svg` = **99,891 字节**；`conv.png` =
**345,216 字节（2400×1600）**；`run` 后 `mod2.dxf` = **42,838 字节**、`mod2.png` = **86,593 字节**。
零输入另一条：`sample floorplan floorplan.png` = **252,174 字节（2400×1600）**；`sample bracket bracket.svg`
= **99,335 字节**。

## 命令怎么发现

- `cadcraft-cli commands`：**直接就是 JSON 文本**（5,726 行 / 138,853 字节），解析数组长度 = **431**；
  `grep -c '"id"'` 同值（`"id"` 每条一次）。
- `cadcraft-cli commands line`：带过滤参数，只回匹配项（实测 `commands line` 回 `line` 等）。
- **不认 `--json`**：加了这个旗标直接报 `commands: unknown option --json`（0.10.0 实测）。
- 每条字段：`id` / `aliases` / `label` / `menu` / `params` / `interactive` / `enabled` / `shortcut`。

## 常用命令族（id 取自 0.10.0 注册表；标 ✔ 的已实测跑通）

| 族 | 代表 id | 要点 |
|---|---|---|
| 试手/文件 | ✔ `sample`、✔ `info`、✔ `convert`、✔ `run`、`new`、`open`、`qsave` | `open` 也吃 base64 `data` |
| 画几何 | ✔ `line`、✔ `circle`、`arc`、`text`、`mtext` | `line` 吃 `{points:[[x,y]...], closed?}`；`circle` 吃 `center+radius` 或 `p1,p2` |
| 修改 | `move`、`copy`、`rotate`、`scale`、`erase`、`offset` | 改类命令用 `handles`，缺省作用于选择集；返回 `{handle}` 或 `{handles:[…]}` |
| 编辑 | `trim`、`extend`、`fillet`、`chamfer` | 要 `pick`/`fence` 点坐标，不是「选一条线」 |
| 标注 | `dim`、`dimlinear`、`hatch` | `hatch` 吃 `points` 或封闭对象 `handles` + `pattern`（如 `ANSI31`） |
| 视图/布局 | ✔ `zoom`、`view`、`plot`、✔ `export` | `plot` 不给 path 时回 base64；`export` 的 `format` 缺省跟随扩展名 |
| 块 | `block`、`insert` | `insert` 可 `"*NAME"` 拆开插入 |

## 输出与校验

- 所有写盘命令打 `wrote <file> (<N> bytes)`——**字节数自带**，直接抄进交付说明。
- 结构断言：`info FILE.dxf` 回 `entityCount` / `counts`（按实体类型计数）/ `layers[]` / `dimStyles[]` / `extents`。
  实测 `bracket.dxf` → `entityCount 46`，`counts {Circle:7, Dimension:6, Hatch:4, Line:16, MText:1, Polyline:6, Text:6}`，
  9 个图层（`0`/`Defpoints`/`Outline`/`Center`/`Hidden`/`Dimensions`/`Hatch`/`Notes`/`Title`）。
- 像素断言：png 恒 **2400×1600**（`node -e "const b=require('fs').readFileSync('conv.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"`）。
- 编辑回执：`run` 每步一行 JSON，画图步回 `{"handles":["12E"]}` 或 `{"handle":"12F"}`。
- 往返校验要小心：`info conv.svg` 只报 `Polyline 505`——**svg 读回会丢实体类型**，要保结构就留 dxf。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| `commands: unknown option --json` | cadcraft 的 `commands` 本来就是 JSON | 去掉 `--json`，直接解析输出 |
| `unsupported file type 'bmp'`，退出码 1 | 扩展名不在 dxf/dwg/svg/png/pdf 内 | 换支持格式；格式由**扩展名**决定 |
| `unknown command 'line={"points":…}'` | `--cmd` 写成了等号语法 | 改 `'id {json}'`（id 与 JSON 之间是空格） |
| `info conv.svg` 只剩 Polyline | svg 往返丢类型 | 需要图层/实体结构就交 dxf；svg 只当出图 |
| `run` 没报错但图面空白 | 命令画在视口外，或 `--export` 用了当前视图 | 补 `--view extents` 或 `--window x0,y0,x1,y1` 重导 |
| 图纸单位/比例不明 | 用户给的图没有单位说明 | 向用户追问绘图单位与目标图幅，别猜缩放 |

## 出图取景（FRAMING）

| 选项 | 行为 |
|---|---|
| 默认 | `convert` 适配图形范围；`run --export` 用当前视图（脚本 zoom/pan 改过）否则适配范围 |
| `--window x0,y0,x1,y1` | 只看这个矩形（绘图单位，x0<x1），居中缩放不变形 |
| `--view extents` | 总是适配图形范围 |
| `--view current` | 当前视图（新开图纸 = 范围 + 10% 边距） |

- 实测同一张 `bracket.dxf`：默认与 `--view extents` 完全一致（都 **345,216 字节**）；
  用 `--window 0,-1473,2200,727`（就是 extents 那个矩形）→ **86,548 字节**——窗口取景比适配范围更紧，
  因为范围导出带边距。**同一张图不同取景字节数不同，比对前先固定取景。**

## 坑（实测）

- 目录名无尾随空格；`D:\storytoldExe\` 下是 `CADCraft`（首字母大写）+ `cadcraft-cli.exe`（全小写）。
- 旧文档「命令注册表 138 KB」是把 **JSON 文件大小**当成了规模指标——真正条数是 **431**（该 JSON 就是 138,853 字节）。
- `--cmd` 的**空格**语法只在 cadcraft 成立（实测 `'line {…}'` 通、`'line={…}'` 报 `unknown command`）；
  别把等号写法套过来，也别把空格写法套到别的应用。
- 没有 `describe`；注册表里没有 `polyline` / `rectangle` 这两个 id（直线叫 `line`），存盘叫 `qsave` 不叫 `save`。
- png 恒 2400×1600，要别的尺寸靠取景窗口，不靠 `--scale`。
- `sample` 只认 `bracket|floorplan` 两个名字（写别的报 `unknown sample 'xxx' (bracket, floorplan)`），
  样图按你给的扩展名落 dxf/dwg/svg/png。

## MCP / 连 GUI

- `cadcraft-cli mcp [--connect HOST:PORT [--lazy] [--launch]]`：**只走 connect 路线**，需要正在运行的
  CadCraft GUI（`--launch` 会尝试拉起应用）——本轮未在 headless 下验证，别在无 GUI 环境里指望它。
- 无 GUI 的自动化一律走 `run` / `convert` / `sample` 三条子命令，它们都不需要窗口。
