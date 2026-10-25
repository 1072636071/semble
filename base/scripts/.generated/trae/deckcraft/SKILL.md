---
name: deckcraft
description: DeckCraft 幻灯片——做 ppt/改幻灯片/渲染页图。当要做演示文稿、转 pptx、渲染幻灯片时使用。触发词：deckcraft、幻灯片、PPT、演示文稿。
version: 0.1.0
disable-model-invocation: true
---

<!--en-->
# deckcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# DeckCraft：幻灯片

PowerPoint 式演示引擎，321 条命令。CLI：`D:\\storytoldExe\\DeckCraft \\deckcraft-cli.exe`。
支持 `.deckcraft` 与 `.pptx`。

## 子命令

| 子命令 | 用途 |
|---|---|
| `info` | slides / layouts / theme（JSON） |
| `render` | 幻灯片画成 PNG |
| `render-transition` | 过渡动画逐帧 PNG |
| `convert` | 按 OUT 扩展名另存 |
| `run` | 跑命令后保存/导出 |
| `commands` / `describe` | 列命令 / 单条参数 |
| `app` / `mcp` | 控制通道 / stdio MCP |
| `bench` | 计时机 |

## 最小闭环

```sh
deckcraft-cli run --cmd 'slide.new={"title":"Q3 results"}' --save q3.deckcraft
```

多步就重复 `--cmd`；脚本/单条详解用 `deckcraft-cli help run`（它解释了怎么写一条命令）。

## 坑

- `--cmd` 用 `ID=JSON`（等号）。
- `help SUBCOMMAND` 与 `SUBCOMMAND --help` 等价。
