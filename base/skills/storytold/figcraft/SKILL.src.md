---
name: figcraft
description: FigCraft 矢量制图——画插画/图标/SVG/界面稿。当要用 figcraft 画图、生成 SVG、搭矢量场景、导出 png/webp/pdf 时使用。触发词：figcraft、画 SVG、矢量插画、Figma。
version: 0.1.0
disable-model-invocation: true
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [figcraft, codebuddy, svg, vector]
    description-en: |-
      1. FigCraft vector drawing: illustrations, icons, UI mockups, SVG scenes.
      2. Triggered by: figcraft, draw SVG, vector illustration, Figma-like tasks.
      3. CLI builds a scene with a JSON command script, then exports SVG/PNG/PDF in one call.
      4. Usage: frame.create for the canvas → shape.rectangle/ellipse/line, vector.create for paths, text.create → export --format svg.
      5. Requires D:\\storytoldExe\\FigCraft \\figcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# FigCraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# FigCraft：矢量制图出 SVG

Figma 式矢量编辑器，569 条命令。CLI 在 `D:\\storytoldExe\\FigCraft \\figcraft-cli.exe`。
**画一张图 = 写一个 JSON 脚本 + 一条 export**，不需要 GUI。

## 最小闭环（实测通过）

```json
[
  {"command":"frame.create","params":{"x":0,"y":0,"width":800,"height":600,"name":"Scene","props":{"fill":"#eef3f8"}}},
  {"command":"shape.rectangle","params":{"x":20,"y":20,"width":100,"height":80,"parent":2,"props":{"fill":"#3366cc","cornerRadius":10}}},
  {"command":"text.create","params":{"x":20,"y":120,"text":"Hi","parent":2,"props":{"fontSize":24,"fill":"#222"}}}
]
```

```sh
figcraft-cli run scene.json --out scene.figcraft --automation-write-root <DIR>
figcraft-cli export scene.figcraft -o out.svg --format svg --automation-read-root <DIR> --automation-write-root <DIR>
```

两步都打印每步结果（`{"command":…,"ok":true,"result":{"id":N}}`），失败会整卷回滚并指出第几步。

## 关键命令

| id | 用途 | 要点 |
|---|---|---|
| `frame.create` | 建画布 | 返回 `{"id":N}`；**之后所有元素的 `parent` 传这个 N** |
| `shape.rectangle` / `shape.ellipse` / `shape.line` / `shape.polygon` / `shape.star` / `shape.arrow` | 基本形 | `{x,y,width,height,parent,props}` |
| `vector.create` | 任意路径 | `{path: "SVG path d 数据", parent, props}`，画躯干/弧线/头发 |
| `text.create` | 文字 | `{text, x, y, parent, props:{fontSize,fill,fontFamily}}` |
| `node.set` | 改属性 | `fills`/`fill`/`stroke`/`cornerRadius`/`opacity`/`rotation` 等几十个键 |

**图层顺序 = 脚本顺序**：先写的在底层。画人物就背景→椅子→躯干→头→桌子→显示器→键盘。

## props 速查（node.set / 各 shape 通用）

`fill`（色值）、`fills`（多 paint / 渐变 `{type:"linearGradient",stops:["#hex",…]}`）、`stroke` +
`strokeWeight` + `strokeCap`（round 画圆头线）、`cornerRadius`（数或 `[tl,tr,br,bl]`）、
`opacity`（0-1）、`rotation`（度）、`effects`。

## 导出

`export <file> -o <out> [--format png|jpg|svg|webp|pdf|fig] [--scale N] [--page NAME] [--node ID|NAME]`

- `-o` 给**目录** → 每个顶层 frame 一个文件；给**带扩展名的路径** → 单文件。
- 要只导某个节点：`--node ID|NAME`。
- PDF 另吃 `--bleed` / `--crop-marks` / `--cmyk`。
- 渲染不想依赖本机字体：加 `--no-system-fonts`（或 `FIGCRAFT_NO_SYSTEM_FONTS=1`）。

## 坑

- `parent` 只认 **id**，不认名字（传 "Scene" 报 `must be a node id`）。
- `shape.ellipse` 的 x/y 是**外接矩形左上角**，不是圆心；要圆心定位自己算 `x=cx-w/2`。
- 大场景用 `vector.create` 拼路径比堆矩形省步骤。
