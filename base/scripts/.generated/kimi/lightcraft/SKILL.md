---
name: lightcraft
description: LightCraft 图库 + RAW 显影——批量显影导出/图库管理。当要显影 RAW、批量导图、管图库时使用。触发词：lightcraft、RAW、显影、图库、Lightroom。
---

<!--en-->
# lightcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# LightCraft：图库 + RAW 显影

Lightroom 式引擎，371 条命令。CLI：`D:\\storytoldExe\\LightCraft \\lightcraft-cli.exe`。

## 子命令

| 子命令 | 用途 |
|---|---|
| `run [OPTIONS] COMMAND [key=value \| '{json}']... [COMMAND …]…` | 顺序跑多条，每条打一行 JSON `{"command","ok","result"\|"error","ms"}` |
| `mcp [--connect [ADDR]] [--demo] [--library DIR] [--compact] [FILES/FOLDERS…]` | stdio MCP |
| `render <IN> -o <OUT> [--set CONTROL=VALUE]... [--settings FILE] [--preset ID] [--size N] [--quality Q]` | 显影单张并导出 |

## run 的取值语法

**一个没有 `=` 的词开启下一条命令**；值能解析成 JSON 就是 JSON（`1`、`true`、`[1,2]`、`{…}`），
否则当字符串：

```sh
lightcraft-cli run --import ~/Photos/a.jpg develop.set control=light.exposure value=0.7 \
    develop.auto app.export path=/tmp/a.jpg longEdge=1600
```

## run 的选项

| 选项 | 用途 |
|---|---|
| `--demo` | headless + 程序化演示图库（**零输入试手**） |
| `--library DIR` | 开（或建）一个持久图库，编辑会保存 |
| `--import PATH` | 先导入文件/文件夹（可重复） |
| `--connect [ADDR]` | 驱动运行中的 app（`lightcraft --control 7980`，默认 127.0.0.1:7980） |
| `--script FILE\|-` | 额外跑 jsonl `{"command":id,"params":{…}}` |
| `--keep-going` | 一条失败后继续 |

## render 导出格式

`.jpg` `.png` `.tif` `.webp` `.avif` `.jxl` `.psd` `.dng`（按扩展名），用与 app 导出对话框同一编码器。
`--set CONTROL=VALUE` 可重复（如 `--set light.exposure=0.5`）；`--lcpreset` / XMP 预设走 `--settings`。

## 坑

- **命令失败即非零退出**，批量时配 `--keep-going`。
- `mcp` 的 `--compact` 只列 helper 工具，全部命令仍可经 `run_command` 触达。
- 图库是**持久状态**：`--library` 指向的目录会被写，别指到源照片目录。
