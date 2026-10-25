---
description: PhotoCraft 图像编辑——psd/图层/批量动作/droplet。当要修图、批量处理图片、放 Photoshop 动作时使用。触发词：photocraft、修图、PSD、批量动作。
version: 0.1.0
disable-model-invocation: true
---

<!--en-->
# photocraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# PhotoCraft：图像编辑

Photoshop 式引擎，918 条命令。CLI：`D:\\storytoldExe\\PhotoCraft \\photocraft-cli.exe`。

## 子命令

| 子命令 | 用途 |
|---|---|
| `convert <in> <out> [--format ext] [--quality 1-100] [--tiff-layers] [--tga-bits 24\|32] [--dpx-bits 8\|10\|12\|16]` | 格式转换（.pcraft/.psd/.png/.jpg/.tif/.webp/.exr/…） |
| `info <file> [--compact]` | 尺寸 / 模式 / 位深 / 图层树（JSON） |
| `run (<file> \| --new <json>) --cmd <id> [--params <json>] ... [--out <file>] [--format ext]` | 开档或新建 → 顺序跑命令 → 保存 |
| `batch --actions <actions.json\|set.atn> [--action <name>] --in <dir> --out <dir> [--in-place]` | 对整个目录放动作 |
| `droplet <file.pcdroplet> <file-or-dir>... [--out <dir>]` | 跑 droplet |
| `commands [--json] [--filter <text>]` | 命令注册表 |
| `mcp` / `serve` | stdio MCP / 常驻 headless 服务 |

## 最小闭环

```sh
# 转换（实测通过）
photocraft-cli convert in.png out.jpg --quality 80
# → warning: lossy compression（正常提示，非错误）

# 从空白画布跑命令
photocraft-cli run --new '{"width":800,"height":600}' --cmd edit.fill --params '{"color":"#3366cc"}' --out out.png
```

## Actions 批量

`batch` 吃两种源：

- **JSON 步骤**：`[id, params]` 对、`{"command":id,"params":{…}}` 对象或裸 id；可裹在
  `{"actions":…}` / `{"steps":…}` / droplet 里。
- **Photoshop Actions 集合（.atn）**：整体载入后按 `--action <name>` 播放（集合里多于一个动作时
  **必须给 `--action`**，否则它的步骤能互相调用会混）。

`--out` 与 `--in` 相同会被拒绝（会覆盖原图），确实要原地改才加 `--in-place`。

## 位深开关

- `--tiff-layers`：TIFF 保留图层（默认拍平）。
- `--tga-bits 32`：写 alpha 通道（没有 alpha 时自动 24）。
- `--dpx-bits`：8 位文档写 8，否则 16。

## 坑

- 每条 `--params` **只作用于它前面那条 `--cmd`**。
- `serve` 的 `--control-token`（64 hex）是给 `--control` GUI 用的，headless 自己跑不用给。
