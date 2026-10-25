---
name: cadcraft
description: CadCraft CAD——读 dxf/dwg、转 svg/png/pdf、跑工程图脚本。当要处理 CAD 图纸、dxf 转换、或生成样图时使用。触发词：cadcraft、CAD、dxf、dwg、工程图。
version: 0.1.0
disable-model-invocation: true
---

<!--en-->
# cadcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# CadCraft：CAD / 工程图

AutoCAD 式引擎，命令注册表 138 KB。CLI：`D:\\storytoldExe\\CADCraft \\cadcraft-cli.exe`。

## 零输入试手

```sh
cadcraft-cli sample bracket out.svg      # 内置样图，直接出 svg
cadcraft-cli sample floorplan out.png    # 另一张样图
```

## 子命令

| 子命令 | 用途 |
|---|---|
| `info FILE.dxf` | 图纸摘要 |
| `convert IN.dxf OUT.(dxf\|dwg\|svg\|png\|pdf) [FRAMING]` | 格式转换 |
| `run [FILE \| --sample \| --metric] [--script TEXT] [--script-file F.scr] [--cmd 'id {json}']... [--save OUT.dxf] [--export OUT.(png\|svg\|pdf)]` | 跑命令改图后保存/导出 |
| `commands [FILTER]` | 列命令 |
| `mcp [--connect HOST:PORT [--lazy] [--launch]]` | stdio MCP |
| `perf [N \| FILE]` | 性能测量 |

**注意 cadcraft 的 `--cmd` 是 `'id {json}'`（空格，不是等号）**，与 gridcraft/designcraft 相反。

## 出图取景（FRAMING）

| 选项 | 行为 |
|---|---|
| 默认 | `convert` 适配图形范围；`run --export` 用当前视图（脚本 zoom/pan 改过）否则适配范围 |
| `--window x0,y0,x1,y1` | 只看这个矩形（绘图单位，x0<x1），居中缩放不变形 |
| `--view extents` | 总是适配图形范围 |
| `--view current` | 当前视图（新开图纸 = 范围 + 10% 边距） |

## 坑

- 输出格式由**扩展名**决定，且只认 dxf/dwg/svg/png/pdf。
- `--cmd` 的空格语法只在 cadcraft 成立，别套到别的应用。
