---
name: vectorcraft
description: VectorCraft 矢量编辑——品牌资产/描边布尔/路径简化/批量导出，headless 跑命令脚本或 stdio MCP 驱动已开的 app。当要用 vectorcraft 改矢量图、批量处理图层、或把设计稿转 svg/pdf/png 时使用。触发词：vectorcraft、矢量编辑、Illustrator。不用于：从零画插画或界面稿（转 figcraft）、位图修图与批量动作（转 photocraft）、CAD 图纸与 dxf（转 cadcraft）、替代 Illustrator 本体。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [vectorcraft, vector, illustrator, codebuddy]
    description-en: |-
      1. VectorCraft vector editing: brand assets, stroke profiles, booleans, path simplification.
      2. Triggered by: vectorcraft, vector editing, Illustrator-like tasks.
      3. Headless sessions run command scripts and export, or an mcp stdio server drives a running app.
      4. Usage: vectorcraft-cli run --cmd ID --params JSON --export out.svg (or mcp --headless for 32 MCP tools).
      5. Requires D:\storytoldExe\VectorCraft\vectorcraft-cli.exe (Windows); directory name has no trailing space.
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# vectorcraft (English)

Illustrator-class vector editor driven by a command registry: `commands --json` parses to 792 commands
(build 0.14.0), though only 127 carry `enabled: true` — that flag is menu availability, not a run gate.
Headless batch: `run --cmd ID --params JSON … --export OUT` writes one JSON line per step. `mcp --headless`
serves a stdio MCP server (32 tools: command_run, draw_shape, draw_path, doc_inspect, export …). File
fences (`--automation-read-root` / `--automation-write-root`) belong to `mcp` only; `run` rejects them.
Binary: `D:\storytoldExe\VectorCraft\vectorcraft-cli.exe` (directory name has no trailing space).
<!--/en-->

# VectorCraft：矢量编辑

Illustrator 式矢量编辑器，命令注册表实测 **792 条**（脚本 0.14.0；JSON 411,347 字节；其中
`enabled: true` 只 127 条）。CLI 固定落 `D:\storytoldExe\VectorCraft\vectorcraft-cli.exe`——**目录名没有
尾随空格**（旧文档写的 `VectorCraft \` 照抄报 `No such file or directory`）。默认 headless。

## 何时用 / 不用于

- 用：改已有矢量图（品牌资产、批量改色、图层整理）、描边/布尔/路径简化这类 Illustrator 专有动作。
- 用：把 ai/eps/psd/dxf 等格式转成 svg/pdf/png（`convert` 一条命令）。
- 用：headless 批量出图（`run`）或让 MCP agent 直接驱动画布（`mcp`）。
- 不用于：从零画插画、界面稿、图标（figcraft 的形状/文字命令更短）。
- 不用于：位图修图与批量动作（photocraft）、CAD 图纸（cadcraft）、替代 Illustrator 本体。

## 输入

- 用户需要给：源文件路径（任意可读格式，含 .ai/.eps/.psd/.dxf），或「从空白文档开始」+ 尺寸与单位。
- 可选：`--scale`（位图倍率，默认 1）、导出格式（由扩展名决定）、`--artboard` / `--range`（多画板）。
- 命令脚本输入：`run --cmd <id> --params '<json>'` 可重复，按顺序执行；`--in FILE` 先开文件。
- 参数查法：`commands --json` 里每条带 `params` 文本（没有 `describe`）。

## 最小闭环（2026-10-28 本机实测）

```sh
VC=/d/storytoldExe/VectorCraft/vectorcraft-cli.exe
mkdir -p .temp/craft-runs/vectorcraft && cd .temp/craft-runs/vectorcraft
timeout 180 "$VC" run \
  --cmd file.new        --params '{"width":800,"height":600,"units":"Pixels"}' \
  --cmd shape.rectangle --params '{"x":20,"y":20,"width":120,"height":80}' \
  --cmd paint.setFill   --params '{"color":"#3366cc"}' \
  --cmd object.move     --params '{"dx":40,"dy":60}' \
  --cmd shape.ellipse   --params '{"x":180,"y":20,"width":100,"height":80}' \
  --cmd select.all      --params '{}' \
  --cmd object.group    --params '{}' \
  --cmd text.create     --params '{"text":"Hi VectorCraft","x":20,"y":140}' \
  --export rec.svg --export rec.png
# 已有文件上改一条 + 落原生格式
timeout 180 "$VC" convert rec.svg conv.pdf
```

真实产物：`rec.svg` = **790 字节**、`rec.png` = **5,226 字节（800×600）**、由 `rec.svg` 转出的
`conv.pdf` = **10,790 字节**。更小的四步版（file.new / rectangle / ellipse / text.create）= `out.svg` 769 +
`out.png` 4,550 字节。

## 命令怎么发现

- `vectorcraft-cli commands --json`：唯一目录口，解析数组长度 = **792**（`grep -c '"id"'` 同值；
  别用管道截断 JSON，截断后数出来的是前半段）。
- 每条字段：`id` / `label` / `menu` / `params` / `shortcut` / `enabled`。
- **没有 `describe` 子命令**（实测报 `unknown subcommand`），参数读 `params`。
- `info FILE` 读回文档摘要；`bench FILE` / `perf` 量性能（本轮未跑）。

## 常用命令族（id 取自 0.14.0 注册表；标 ✔ 的已实测跑通）

| 族 | 代表 id | 要点 |
|---|---|---|
| 文档 | ✔ `file.new`、`document.inspect`、`document.export` | `file.new` 吃 `width/height/units`；`document.inspect` 回图层树 |
| 形状文字 | ✔ `shape.rectangle` / `shape.ellipse`、✔ `text.create`、`path.create` | `path.create` 吃 `d`（SVG path）或 `anchors` |
| 上色 | ✔ `paint.setFill`、`paint.setStroke`、`swatch.new` | 作用在当前选择上，先建形再上色 |
| 变换 | ✔ `object.move`、`object.rotate`、`object.arrange.bringToFront` | 支持 `ids`，缺省用选择 |
| 选择分组 | ✔ `select.all`、`select.set`、✔ `object.group`、`object.ungroup` | 分组返回新 id |
| 路径/描边 | `path.close`、`path.reverse`、`path.join`、`type.createOutlines` | 转曲/简化都在这一族 |
| 图层蒙版 | `layer.new`、`layer.setProps`、`transparency.makeOpacityMask` | 透明度蒙版 17 条 |
| 透视 | `perspective.grid.set`、`perspective.attach` | 25 条，新版本专有 |

## 输出与校验

- `run` 每步一行 JSON：`{"command":…,"result":…,"step":"cmd"}`；导出步给
  `{"result":{"bytes":790,"format":"svg","path":"rec.svg","warnings":[]},"step":"export"}`——**bytes 自带**。
- 结构断言：`document.inspect`（在 `run` 里当一条命令）回 `objects`、`artboards[]`、`layers[]`、`selection`。
- 文件断言：`vectorcraft-cli info conv.pdf` 回 `artboards` / `fonts`（含 `missing`）/ `objects`。
- 字节与像素：`ls -l rec.svg` = 790；`node -e "const b=require('fs').readFileSync('rec.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"` → `800x600`。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| `unknown run option '--automation-write-root'` | 围栏只属 `mcp`，`run` 不收 | 去掉围栏改用 `cd` 到目标目录；要围栏就走 `mcp` |
| `unknown subcommand 'describe'` | 0.14.0 无 describe | 读 `commands --json` 的 `params` |
| `unknown command 'shape.xxx'`，退出码 1 | id 拼错或该版本没有 | 回注册表核对 `id`；本文件表里的 id 已核对 |
| `commands --json` 数字偏小 | 管道被截断（如 `head -c`） | 先落盘再解析数组长度，别看截断后的 grep |
| `mcp` 连不上 7979 后拉起 headless，行为与预期不同 | 默认先连 GUI | 要确定性 headless 就显式 `mcp --headless` |
| 源文件读进来提示 `warnings` / `missingLinks` | 格式降级（如 EPS 只读到预览） | 读 `info`/`run` 的 `warnings`；降级影响交付就向用户追问原始格式或矢量源 |

## 坑（实测）

- 注册表 792 条，但 `enabled: true` 仅 127 条：`enabled` 是菜单可用性，**不是** `run --cmd` 的执行条件
  （`shape.rectangle` 标 `enabled:false` 照样跑通）。
- `run` 不吃 `--automation-*`（0.14.0 实测报 `unknown run option`）；旧文档「围栏对 mcp 与普通子命令同时生效」是错的。
- 旧文档的常用命令族表（`vector.flatten` / `vector.outlineStroke` / `vector.simplify` / `vector.offset` /
  `select.sameText` / `selection.setPaint` 等 10 个 id）在 0.14.0 注册表里**一个都不存在**，已整表换成真实 id。
- `text.create` 的 `y` 是基线附近的一半，返回的 `bounds.y` 比传入 `y` 小（实测传 140 → bounds.y 128），
  对齐设计要求时读 `bounds` 再校正。
- `--scale` 只影响位图导出（400×300 文档 `--scale 2` → `big.png` 800×600、2,396 字节）。
- `mcp` 默认先试 `127.0.0.1:7979`（需 `vectorcraft --control 7979` 的 GUI 在跑），失败才回落 headless。

## MCP / 连 GUI

- `vectorcraft-cli mcp --headless`：stdio MCP，实测 `initialize` + `tools/list` 通，**32 个工具**：
  `command_list` / `command_run` / `command_batch` / `doc_inspect` / `render_preview` / `draw_shape` /
  `draw_path` / `set_paint` / `export` / `open_file` / `save_file` 等。
- 驱动已开的 GUI：`vectorcraft.exe --control 7979` 后 `vectorcraft-cli mcp --connect 127.0.0.1:7979`
  ——需先起 GUI，本轮未验证 GUI 一侧。
- 围栏只在 `mcp` 上：`mcp --headless --automation-read-root DIR --automation-write-root DIR`（目录须存在）。
