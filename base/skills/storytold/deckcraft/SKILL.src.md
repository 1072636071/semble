---
name: deckcraft
description: DeckCraft 幻灯片——做 ppt/改幻灯片/渲染页图。当要做演示文稿、转 pptx、渲染幻灯片时使用。触发词：deckcraft、幻灯片、PPT、演示文稿。不用于：Word 文档与表格（走 wordcraft / gridcraft）、印刷级画册排版（走 designcraft）；不替用户编造讲稿内容，缺标题与要点先问。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [deckcraft, slides, pptx, codebuddy]
    description-en: |-
      1. DeckCraft slides: build presentations, convert to pptx, render slides to PNG.
      2. Triggered by: deckcraft, slides, pptx, presentation.
      3. CLI edits a presentation by running commands, then saves or exports it.
      4. Usage: deckcraft-cli run --cmd 'slide.new={"title":"Q3 results"}' --save q3.deckcraft; info/render/convert.
      5. Requires D:\storytoldExe\DeckCraft\deckcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# deckcraft (English)

DeckCraft is a PowerPoint-style presentation engine with 321 commands, driven headlessly by `deckcraft-cli.exe` on `.deckcraft` and `.pptx` files.
A presentation is edited by running commands (`--cmd 'slide.new={"title":"Q3 results"}'`), then saved or exported as deckcraft/pptx/pdf/png/jpg/gif.
Triggered by building a deck, converting to pptx or rendering slides; it does not do Word documents, spreadsheets or print layout.
`run` succeeds silently — verify by `info`, by the listed bytes, or by exporting a PNG and checking its size.
<!--/en-->

# DeckCraft：幻灯片

PowerPoint 式演示引擎，321 条命令（2026-10-28 实测：`commands` 纯文本一行一条，共 321 行，全部符 `id — 描述` 格式）。
CLI：`D:\storytoldExe\DeckCraft\deckcraft-cli.exe`（目录名 `DeckCraft` 无尾随空格，可执行全小写），默认 headless；支持 `.deckcraft` 与 `.pptx`。

## 何时用 / 不用于

- 用：从空建一套幻灯片并转 `.pptx`；在既有 deck 上加页/改标题；把某页渲染成 PNG 交给用户看；导出 pdf/gif；读 layouts 与 theme。
- 不用于：Word 文档与表格（wordcraft / gridcraft）、印刷级版面（designcraft）；不替用户编造讲稿——缺标题与要点先向用户要。

## 输入

- 用户需要给：标题与每页要点（文字内容）、页数与版式意图；可选既有 `.deckcraft` / `.pptx` 文件路径（`--in` 或作第一个参数）。
- 可选参数：`--save OUT` 落盘、`--export OUT` 导出（按扩展名定格式）、`--export-params JSON` 传 `file.export` 选项、`--cmd` 可重复；出图用 `render` 的 `--slide N` / `--all` / `--scale`；主题与模板走 `file.new` 的 `theme` / `template` 参数（`file.templates` 列可用的起始模板）。

## 最小闭环（2026-10-28 实测）

```sh
CLI=/d/storytoldExe/DeckCraft/deckcraft-cli.exe
"$CLI" run --cmd 'slide.new={"title":"Q3 results"}' --save q3.deckcraft   # 静默成功，无 stdout
"$CLI" info q3.deckcraft          # → JSON：slides / layouts / theme 与 fonts
"$CLI" convert q3.deckcraft q3.pptx    # → 22600 字节
"$CLI" render q3.deckcraft slide.png   # → slide.png (1920×1080)
"$CLI" info q3.pptx               # → 往返读回，第 2 页 title = "Q3 results"
"$CLI" describe slide.new         # → 参数：layout / at / title
```

真实产物：`q3.deckcraft` = 4,651 字节；`q3.pptx` = 22,600 字节；`slide.png` = 42,799 字节（1920×1080）。
**页数比命令多一页**：新演示自带 1 张空白标题页，所以 `slide.new` 后 `info` 读到 2 页（第 1 页空白，`slide.png` 渲染的就是它）——要干净就 `--cmd 'slide.delete={"index":0}'`，或先渲染 `--slide 1`。
多步就重复 `--cmd`；`slide.new` 在 `title` 之外还收 `layout`（title/titleAndContent/blank/…）与 `at`。

## 命令怎么发现

- 全量：`deckcraft-cli commands`（纯文本，一行一条：`id — 标签: 参数`），共 321 行。
- **`commands --json` 返回空**（本家不认这个开关）——数命令只认纯文本行，或按 `^id — ` 前缀过滤计数。
- 单条：`deckcraft-cli describe slide.new` 打印标签、菜单路径、快捷键与逐项参数（本家有 `describe`）。
- 子命令全集：`info` / `render` / `render-transition` / `convert` / `run` / `commands` / `describe` / `app` / `mcp` / `bench` / `links` / `--version`。

## 常用命令族

| 族 | 代表 id | 要点 |
|---|---|---|
| 文件 | `file.new` `file.open` `file.save` `file.saveAs` | `file.save` 的 `format` 取 deckcraft 或 pptx |
| 页 | `slide.new` `slide.delete` `slide.duplicate` | `slide.new` 收 `{layout?, at?, title?}` |
| 导出 | `file.export` | `format` 取 png/jpeg/pptx/deckcraft/outline/pdf/gif；`slide` / `all` / `scale` / `dpi` |
| 模板主题 | `file.templates` `file.saveTemplate` | 起始模板与主题名 |

## 输出与校验

- **`run` 成功时不打印任何东西**（stdout 0 字节）：别等 `wrote …`，用 `ls -l` 取字节数，或 `info` 读回。
- 读回断言：`info <file>`（slides / layouts / theme / fonts / dirty，JSON，不带 `--json` 也是 JSON）。
- 视觉断言：`render <file> <out.png>` 打印 `slide.png (1920×1080)`，PNG 字节数可再核一次。
- 往返断言：`convert x.deckcraft x.pptx` 后 `info x.pptx`，比 `title` 与页数——本轮实测 title 保持 `Q3 results`。
- `convert` 支持的扩展名：`.deckcraft` `.pptx` `.potx` `.ppsx` `.pdf` `.png` `.jpg` `.jpeg` `.gif` `.txt` `.md`。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| 报 unknown command（如 nope.zzz），exit 1 | 命令 id 猜错 | `commands` 里 grep id，或 `describe <id>` 核对 |
| `nothere.pptx: 系统找不到指定的文件。 (os error 2)`，exit 1 | 路径错或工作目录不对 | 让用户给绝对路径，先 `ls` 确认 |
| `unsupported output format .xyz (supported: …)`，exit 1 | 导出扩展名不在白名单 | 换成 `.pptx` / `.pdf` / `.png` / `.gif` 等；报错信息自带全集 |
| `--cmd 'slide.new'` 退出码 0 但以为没生效 | 不带 `=` 时用默认参数执行（仍会加一页，不是空操作） | 要指定参数就写 `--cmd 'slide.new={"title":"…"}'` |
| `run` 没输出、以为失败 | 成功本来就静默 | 看 `ls -l` 与 `info`，别以 stdout 判成败 |
| no DeckCraft app on port 7979 … start it with deckcraft --control 7979 | 用了 `app` 子命令但 GUI 没起 | 先以 `deckcraft.exe --control 7979` 起 GUI，或改用 headless 子命令 |

## 坑（实测）

- **`commands --json` 返回空**：本家不认 `--json`，别用它数命令（会得到 0）。
- **`run` 成功零输出**：与 gridcraft（`wrote … (N bytes)`）、designcraft（`wrote … (WxH, … ms)`）不同。
- **新演示自带 1 张空白标题页**：页数 = 命令里 `slide.new` 次数 + 1；只 `render` 第一页会得到空白图。
- **`--cmd` 不带 `=` 不是空操作**：用默认参数执行（实测 `--cmd 'slide.new'` 让页数 1 → 2）；`help run` 也写明「不需要参数的命令就是它的 id」。
- `describe` 可用，`--json` 不可用：本家只支持 `describe` 这种单条查询。
- `info` 不带 `--json` 也输出 JSON，别把 `--json` 当必需项。

## MCP / 连 GUI

- `deckcraft-cli mcp`：stdio MCP，把 321 条命令暴露给 agent。
- `deckcraft-cli app [--port PORT] COMMAND [JSON]`：驱动运行中的 GUI（需先 `deckcraft.exe --control 7979`）——**需先起 GUI，未在本轮 headless 验证**。
