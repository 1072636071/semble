---
name: figcraft
description: FigCraft 矢量制图——画插画/图标/界面稿/SVG，用 JSON 命令脚本搭场景后导出 svg/png/pdf。当要用 figcraft 画图、生成 SVG、搭矢量场景、批量出图时使用。触发词：figcraft、画 SVG、矢量插画、Figma。不用于：修照片或改位图（转 photocraft）、CAD 图纸与 dxf（转 cadcraft）、已有矢量图的描边/布尔清理（转 vectorcraft）、替代 Figma 应用本身。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [figcraft, codebuddy, svg, vector]
    description-en: |-
      1. FigCraft vector drawing: illustrations, icons, UI mockups, SVG scenes.
      2. Triggered by: figcraft, draw SVG, vector illustration, Figma-like tasks.
      3. CLI builds a scene with a JSON command script, then exports SVG/PNG/PDF in one call.
      4. Usage: frame.create for the canvas → shape.rectangle/ellipse/line, vector.create for paths, text.create → export --format svg.
      5. Requires D:\storytoldExe\FigCraft\figcraft-cli.exe (Windows); the directory name has no trailing space.
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# FigCraft (English)

Figma-style vector drawing CLI; `commands --json` reports 569 commands (build 0.8.0), headless by default.
Drive it as: `run` a JSON array of {"command","params"} steps into a `.figcraft` file, then `export` that file
to svg/png/pdf — a directory target writes one file per top-level frame. Coordinates are page units with y
down, `parent` takes a node id and never a layer name, and a failing step rolls the whole script back.
Binary: `D:\storytoldExe\FigCraft\figcraft-cli.exe` (directory name has no trailing space); `mcp` serves stdio.
<!--/en-->

# FigCraft：矢量制图出 SVG

Figma 式矢量编辑器，`commands --json` 实测 **569 条命令**（脚本 0.8.0）。CLI 固定落
`D:\storytoldExe\FigCraft\figcraft-cli.exe`——**目录名没有尾随空格**（旧文档写的 `FigCraft \` 照抄报
`No such file or directory`）。默认 headless：**一张图 = 一个 JSON 命令脚本 + 一条 export**，不用起 GUI。

## 何时用 / 不用于

- 用：画插画、图标、界面稿、流程示意；把结构化数据渲染成 SVG；批量出 png/webp/pdf。
- 用：在已有 `.figcraft` 文件上继续加元素（`run --in`）；只导某个节点（`export --node`）。
- 不用于：位图修图/抠图/批量动作（photocraft）；CAD 图纸、dxf/dwg（cadcraft）。
- 不用于：已有矢量图的描边转填充、布尔、路径简化（vectorcraft）——那类活它命令更专门。
- 不用于：需要协作或打开 Figma 云端文件的场景——本工具只吃本地文件。

## 输入

- 用户需要给：产物用途 + 画布尺寸（宽高，当 px 用）+ 文案原文（要真字，别用占位符再返工）。
- 可选：配色（hex）、字体族、导出格式与倍数、是否只用内置字体。
- 脚本输入：JSON 数组（或 JSON Lines），每项 `{"command": "<id>", "params": {…}}`。
- 已有图纸：给 `.figcraft` 路径走 `run --in`，脚本只写增量。

## 最小闭环（2026-10-28 本机实测）

```sh
FIG=/d/storytoldExe/FigCraft/figcraft-cli.exe
mkdir -p .temp/craft-runs/figcraft && cd .temp/craft-runs/figcraft
cat > scene.json <<'EOF'
[
  {"command":"frame.create","params":{"x":0,"y":0,"width":800,"height":600,"name":"Scene","props":{"fill":"#eef3f8"}}},
  {"command":"shape.rectangle","params":{"x":20,"y":20,"width":120,"height":80,"parent":2,"props":{"fill":"#3366cc","cornerRadius":10}}},
  {"command":"shape.ellipse","params":{"x":180,"y":20,"width":100,"height":80,"parent":2,"props":{"fill":"#f4a261"}}},
  {"command":"vector.create","params":{"path":"M 320 60 C 380 10, 440 110, 500 60","parent":2,"props":{"stroke":"#222","strokeWeight":6,"strokeCap":"round"}}},
  {"command":"text.create","params":{"x":20,"y":140,"text":"Hi FigCraft","parent":2,"props":{"fontSize":24,"fill":"#222"}}}
]
EOF
DIR="$(pwd -W)"                     # git-bash 的 Windows 路径；围栏目录必须已存在
timeout 180 "$FIG" run scene.json --out scene.figcraft --automation-write-root "$DIR"
timeout 180 "$FIG" export scene.figcraft -o out.svg --format svg \
  --automation-read-root "$DIR" --automation-write-root "$DIR"
timeout 180 "$FIG" export scene.figcraft -o out.png --format png \
  --automation-read-root "$DIR" --automation-write-root "$DIR"
```

真实产物：`scene.json` = 665 字节 → `scene.figcraft` = **8,154 字节**；`out.svg` = **5,857 字节**；
`out.png` = **18,510 字节（800×600）**；`out.pdf` = **8,330 字节**。加 `--scale 2 --no-system-fonts`
的 png = **54,412 字节（1600×1200）**；两帧图 `export -o outdir` 得 `A.png` 5,064 + `B.png` 3,283 字节。

## 命令怎么发现

- `figcraft-cli commands`：纯文本目录，实测 **1138 行** = 命令行 + 参数续行，**别用行数估条数**。
- `figcraft-cli commands --json`：结构化目录，`grep -c '"id"'` = **569**。
- `figcraft-cli commands --filter text`：关键字过滤，同时给出参数写法（最省事的查参数路子）。
- **没有 `describe` 子命令**（0.8.0 实测报 `unknown subcommand`）：参数只从上面两种输出的 `params` 读。

## 常用命令族

| id | 用途 | 要点 |
|---|---|---|
| `frame.create` | 建画布 | 返回 `{"id":N}`；之后所有元素的 `parent` 传这个 N |
| `shape.rectangle` / `ellipse` / `line` / `polygon` / `star` / `arrow` | 基本形 | `{x,y,width,height,parent,props}`；ellipse 的 x/y 是外接矩形左上角 |
| `vector.create` | 任意路径 | `{path:"M…", parent, props:{stroke,strokeWeight,strokeCap:"round"}}`，曲线比堆矩形省步 |
| `text.create` | 文字 | `{text,x,y,parent,props:{fontSize,fill,fontFamily}}` |
| `node.set` / `node.create` | 改属性 / 通用建层 | props 键表见 `commands --json` 的 `params`（`fills`/`stroke`/`cornerRadius`…） |

- 图层顺序 = 脚本顺序：先写的在底层，画人物就背景 → 主体 → 细节 → 文字。

## 输出与校验

- `run` 每步一行 JSON（`{"command":…,"ok":true,"result":{"id":N},"step":i}`），末行 `wrote <file>`。
- `export` 成功只打输出路径（`out.svg`）；`-o` 给目录 → 每顶层 frame 一个文件；给带扩展名的路径 → 单文件。
- 结构断言：`figcraft-cli info scene.figcraft` → `Untitled (6 nodes …)` + `2 FRAME "Scene" 800.0×600.0`；
  `info --json` 给 `nodes` / `pages[].frames[]`。
- 像素断言：`node -e "const b=require('fs').readFileSync('out.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"`
  → `800x600`。字节数断言：`ls -l out.svg` = 5,857。
- 围栏一致性：同一份 svg 带围栏与不带围栏导出都是 5,857 字节——围栏只限范围，不改渲染。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| `error: unknown subcommand 'describe'` | 0.8.0 无 describe | 改 `commands --filter KEY` 或 `commands --json` 的 `params` |
| `parent` must be a node id (got "Scene")，附带 `the script's document changes were rolled back` | `parent` 传了图层名 | 传 `frame.create` 返回的 id；整卷已回滚，改脚本重跑 |
| `error: --automation-write-root … os error 2` | 围栏目录不存在 | 先 `mkdir -p`，围栏只认已存在目录 |
| 退出码 1、无产物、日志有 `"ok":false` | 某步参数不合法 | 逐行读 `step` 定位；修脚本重跑（不会留半成品文件） |
| 导出文字与设计稿不一致 | 走了本机字体索引 | 加 `--no-system-fonts`（或 `FIGCRAFT_NO_SYSTEM_FONTS=1`）只用内置字体 |
| 尺寸/文案缺失 | 输入不全 | 向用户追问宽高与文案原文，不编占位数字 |

## 坑（实测）

- 目录名无尾随空格；`D:\storytoldExe\` 下是 `FigCraft`（首字母大写）+ `figcraft-cli.exe`（全小写）。
- 无 `describe`；无围栏也能跑（按当前用户权限读写，实测 export 成功）——批量跑仍给围栏，免得写飞。
- `--scale` 只影响位图（png 1600×1200），svg/pdf 不吃；pdf 另有 `--bleed` / `--crop-marks` / `--cmyk`。
- `run --in base.figcraft --out next.figcraft` 可在已有图上加元素（实测 8,154 → 8,216 字节）。
- 首次文本布局会索引本机字体（慢不等于卡死）；单条命令用 `timeout 180` 兜住。

## MCP / 连 GUI

- `figcraft-cli mcp`：默认 headless 进程内引擎，实测 `initialize` + `tools/list` 通。
- `mcp --attach PORT` 连已起的 GUI（另一侧 `figcraft --control PORT`），本轮未验证 GUI 侧。
- 围栏对 `mcp` 同样生效：`mcp --automation-read-root DIR --automation-write-root DIR`。
