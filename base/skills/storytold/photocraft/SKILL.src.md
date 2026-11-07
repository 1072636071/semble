---
name: photocraft
description: PhotoCraft 图像编辑——PSD 图层/格式互转/批量动作/droplet/位深开关。当要修图、批量处理图片、放 Photoshop 动作时使用。触发词：photocraft、修图、PSD、批量动作。不用于：PDF 页面与表单（pdfcraft）、RAW 显影与图库（lightcraft）、矢量与排版（vectorcraft / designcraft）。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [photocraft, photoshop, image, psd, codebuddy]
    description-en: |-
      1. PhotoCraft image editing: PSD layers, format conversion, batch actions and droplets.
      2. Triggered by: photocraft, photo editing, PSD, batch actions, droplet.
      3. CLI converts formats, runs engine commands, and replays Photoshop Actions (.atn) over folders.
      4. Usage: convert in.png out.jpg --quality 80; batch --actions a.json --in dir --out dir; run --new '{...}' --cmd id --params '{...}'.
      5. Requires D:\storytoldExe\PhotoCraft\photocraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# photocraft (English)

PhotoCraft is a headless Photoshop-style engine whose command registry holds 918 ids (162 enabled, 756 gated on an open document).
Trigger it to convert image formats, inspect a PSD layer tree, build a canvas from scratch, or replay JSON action lists and .atn sets over a folder.
Discover ids with `photocraft-cli commands --json` (their `params` string is the schema), then `run`, `batch` or `droplet`.
Binary: D:\storytoldExe\PhotoCraft\photocraft-cli.exe (Windows, no trailing space in the folder name). Failures exit non-zero.
<!--/en-->

# PhotoCraft：图像编辑

Photoshop 式引擎，命令注册表**实测 918 条**（162 条 enabled、756 条 disabled，多数是没开文档），默认 headless。
CLI：`D:\storytoldExe\PhotoCraft\photocraft-cli.exe`——目录名**没有尾随空格**。

## 何时用 / 不用于

- 用：格式互转（`.psd/.png/.jpg/.tif/.webp/.exr/.pcraft`，含 TIFF 保图层、TGA alpha、DPX 位深）；PSD 图层树与通道（`info`）；新建画布跑引擎命令；按 JSON 动作或 `.atn` 对整目录批处理；跑 droplet。
- 不用于：PDF 页面 / 表单 / OCR（pdfcraft）、RAW 显影与图库（lightcraft）、矢量与排版（vectorcraft / designcraft）。没有输入图就先问路径，别拿无关文件占位。

## 输入

- 必给：输入图路径，或 `run --new '{"width":800,"height":600}'` 的空白画布；再加输出格式 / 路径。
- 可选：`--quality 1-100`、`--tiff-layers`、`--tga-bits 24|32`、`--dpx-bits 8|10|12|16`、`--format ext`。
- 批量：`--actions <json|.atn>`（JSON 是 `[id, params]` 对、`{"command":id,"params":{…}}` 或裸 id）+ `--in` / `--out` 两个目录。

## 最小闭环（2026-10-28 实测）

```sh
CLI=/d/storytoldExe/PhotoCraft/photocraft-cli.exe   # Windows: D:\storytoldExe\PhotoCraft\photocraft-cli.exe
cd /e/work/sp/JwikisSkills/.temp/craft-runs/photocraft
"$CLI" run --new '{"width":800,"height":600}' --cmd edit.fill --params '{"color":"#3366cc"}' --out out.png
"$CLI" info out.png --compact
"$CLI" convert out.png out.jpg --quality 80          # stderr 只有一行 warning: lossy compression
echo '[["image.adjustments.desaturate",{}],["edit.transform.rotate90Cw",{}]]' > acts.json
"$CLI" batch --actions acts.json --in in --out out    # in/ 里放 320×240 图两张
```

真实产物：`out.png` = 2,733 字节 / 800×600 / Rgb / 8 位 / 1 图层；`out.jpg` = 8,229 字节（退出 0）。
`batch` 打两行 `ok in\a.png -> out\a.png` 与 `2 succeeded, 0 failed`，`out/a.png` = 894 字节（源 764 字节）。

## 命令怎么发现

- `photocraft-cli commands [--filter <text>] [--json]`：实测 **918 条**（JSON 358,860 字节），每条带 `id/label/menu/params/enabled/disabledReason`；`--filter flip` 命中 4 条。
- 没有 `describe`（`describe edit.fill` → `unknown command 'describe'`）：参数读 `commands --json` 里每条的 `params` 字符串，形如 `{"width":1..300000=1920,…}`。
- `info <file> --compact`：尺寸 / 模式 / 位深 / 图层树，做断言比翻日志快。

## 常用命令族

| 族 | 代表 id | 要点 |
|---|---|---|
| 画布 | `file.new` / `image.imageSize` / `image.canvasSize` / `image.crop` | `run --new` 走的就是 `file.new` |
| 编辑 | `edit.fill` / `edit.stroke` / `edit.clear` / `edit.transform.*` | 每条 `--params` 只跟它前面那条 `--cmd` |
| 变换 | `edit.transform.rotate90Cw` / `edit.transform.flipHorizontal` / `image.imageRotation.flipCanvasHorizontal` | 没有 `image.flip` 这种简写 |
| 调色 | `image.adjustments.*`（desaturate/levels/curves/exposure/vibrance/hueSaturation…） | 批量动作最常用 |
| 批量 | `batch` / `droplet` | `.atn` 集合多动作时必须 `--action <name>` |
| 服务 | `mcp`（另有未列入 `--help` 的 `serve`） | stdio |

## 输出与校验

- 产物：`convert` / `run --out` 写目标格式；`batch` 按 `--out` 目录对位写；`droplet` 写 `--out`。
- 读回断言：`info --compact` 的 `width/height/mode/depth/layers` + 文件字节数（实测 800×600 Rgb 8 位 = 2,733 字节；320×240 灰化 + 旋转 = 894 字节）。
- 批量断言：末行 `N succeeded, M failed`，失败文件**不落盘**（实测 `out/` 只有成功那两张）。
- 有损转换时 stderr 出一行 `warning: lossy compression`——提示，不是失败（退出码仍 0）。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| `unknown command \`image.flip\`` + 末行 `error: 2 file(s) failed`，退出 1 | 命令 id 编错（翻转是 `edit.transform.flipHorizontal` 或 `image.imageRotation.flipCanvasHorizontal`） | 先 `commands --filter flip` 拿到真 id 再写动作 |
| `error: --out in is the --in folder, so the results would replace the originals…`，退出 1 | `--out` 与 `--in` 同一目录（会覆盖原图） | 换独立 `--out`；确实要原地改才加 `--in-place`，且**动手前向用户确认**哪些文件会被覆盖 |
| `error: I/O: nope.png: 系统找不到指定的文件。 (os error 2)`，退出 1 | 输入路径不存在 | 先 `ls` 核对，再向用户追问准确路径 |
| `disabledReason: "no document open"` | 命令要开档才可用（918 条里 756 条默认 disabled） | 用 `run` / `batch` 开档执行，别指望裸调注册表 |
| `unknown command \`describe\`` | 本 app 没有这个子命令 | 用 `commands --json` 的 `params` |

## 坑（实测）

- **918 是注册表规模，不是能跑的数量**：162 条 enabled、756 条 disabled（多数 `no document open`）。
- `--out` 等于 `--in` 一律拒绝——那是防覆盖原图的保护，别用 `--in-place` 绕过去省事；批量覆盖不可逆，先要用户确认。
- `serve` 不在 `--help` 里但实测可用（空 stdin 立即退 0），别再找 `serve --help`。
- `.atn` 集合里多于一个动作时**必须** `--action <name>`，否则集合内动作互相调用会串味。
- `--tiff-layers` 才保图层（默认拍平）；`--tga-bits 32` 写 alpha（无 alpha 自动 24）；`--dpx-bits` 8 位文档写 8，否则 16。
- GUI 侧能力本轮未验证：`--bridge` / `--control-token` 连的是正在跑的 app。

## MCP / 连 GUI

- `photocraft-cli mcp [--bridge 127.0.0.1:port] [--control-token 64-hex | --control-token-file path] [--automation-read-root DIR] [--automation-write-root DIR]`：stdio MCP，围栏只在这里生效。
- `--control-token` 是 GUI 控制通道的凭据，headless 自己跑不用给；用前需先起 GUI，本轮未验证。
