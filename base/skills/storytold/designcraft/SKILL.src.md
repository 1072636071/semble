---
name: designcraft
description: DesignCraft 印刷排版——画册/报告/epub/idml，脚本可引用前步结果。当要排版出版物、导 PDF、生成页面时使用。触发词：designcraft、排版、InDesign、画册、epub。不用于：幻灯片与 Word 文档（走 deckcraft / wordcraft）、表格公式（走 gridcraft）；不替用户编造文案，缺正文先要。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [designcraft, print, indesign, epub, codebuddy]
    description-en: |-
      1. DesignCraft print layout: brochures, reports, epub/idml; scripts reference earlier results.
      2. Triggered by: designcraft, print layout, InDesign-like tasks, epub export.
      3. Command scripts run headless and export png/pdf/epub/idml in one run.
      4. Usage: designcraft-cli script page.dcs --save page.designcraft --export page.pdf --export page.png.
      5. Requires D:\storytoldExe\DesignCraft\designcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# designcraft (English)

DesignCraft is an InDesign-style print layout engine with 521 commands, driven headlessly by `designcraft-cli.exe`.
It runs command scripts (`.dcs`, one command per line, `$0.field` references an earlier step's result) and exports png/jpg/pdf/designcraft/idml/epub/pptx/html/rtf/txt in a single run.
Triggered by brochure, report or book layout and PDF/epub export; it does not do slides, Word documents or spreadsheets.
`--page`, `--scale` and `--pdf-options` apply only to the exports that follow them, so one run can emit several sizes.
<!--/en-->

# DesignCraft：印刷排版

InDesign 式排版引擎，521 条命令（2026-10-28 实测：`commands` 直接输出 JSON 文本，`grep -c '"id":'` = 521）。
CLI：`D:\storytoldExe\DesignCraft\designcraft-cli.exe`（目录名 `DesignCraft` 无尾随空格，可执行全小写），默认 headless。

## 何时用 / 不用于

- 用：排版画册/报告并一次导出 pdf + png；生成 `.dcs` 脚本批量建帧、插脚注、插交叉引用；导 epub/idml/pptx；把版面按多个缩放各出一张图。
- 不用于：幻灯片与 Word 文档（deckcraft / wordcraft）、表格公式（gridcraft）；不替用户编造文案——缺正文与图先向用户要。

## 输入

- 用户需要给：正文文字与图（图给绝对路径，用 `file.place`）、页面尺寸/出血意图（`file.new` 的 `preset` / `width` / `height` / `margins`）、要出哪些格式。
- 可选参数：`--in FILE | --sample`（样例文档）、`--save OUT` 存 `.designcraft`、`--export OUT` 可重复、`--page N` / `--scale S` / `--pdf-options JSON`（**只作用于其后的 `--export`**）、`--keep-going`（脚本遇错继续）。

## 最小闭环（2026-10-28 实测）

```sh
CLI=/d/storytoldExe/DesignCraft/designcraft-cli.exe
# page.dcs：frame.create → text.select → footnote.insert → frame.create → text.select → xref.insert
"$CLI" script page.dcs --save page.designcraft --export page.pdf --export page.png
# → {"completed":6,...}；page.designcraft / page.pdf / page.png
"$CLI" run --in page.designcraft --cmd 'document.inspect={}'   # 读回：pageCount 1、2 个文本帧、2 个 story
"$CLI" run --sample --scale 0.5 --export small.png --scale 2 --export large.png
"$CLI" run --cmd 'frame.create={"rect":[72,72,540,300],"content":"text","text":"Hi"}' --export hi.png
echo 'frame.create {"rect":[72,72,300,150],"content":"text","text":"stdin ok"}' | "$CLI" script - --save stdin.designcraft --export stdin.png
```

真实产物：`page.designcraft` = 8,630 字节；`page.pdf` = 7,328 字节；`page.png` = 65,198 字节；
`small.png` = 81,094 字节（315×405）；`large.png` = 552,702 字节（1260×1620）；`hi.png` = 11,824 字节（612×792，2 glyphs）；`stdin.png` = 43,362 字节。

## 命令怎么发现

- 全量：`designcraft-cli commands`——**它本来就输出 JSON**，`grep -c '"id":'` = 521。
- **`commands --json` 会返回 `[]`**：`--json` 被当成位置过滤器（`commands [FILTER]`），匹配不到才空。
- 过滤：`designcraft-cli commands inspect` 按 id/label/参数文本过滤。
- 单条：`designcraft-cli describe xref.insert` 打印 label / menu / params；**id 写错时会给出 similar 命令清单**（`describe file.export` → `no command, similar: file.exportPdf, file.exportEpub, …`）。
- 子命令全集：`run` / `commands` / `describe` / `script` / `app` / `mcp` / `perf` / `bench` / `links` / `--version`；**没有 `info`**。

## 常用命令族

| 族 | 代表 id | 要点 |
|---|---|---|
| 帧 | `frame.create` `file.place` | `frame.create` 收 `{rect, content: text/graphic, text?, shape?}`；`file.place` 把图/文本/docx/xlsx 放进帧（`frame?` 或 `rect?` 建新帧） |
| 文本 | `text.select` `text.*` | 先 `text.select {story, anchor, focus}` 再改 |
| 脚注/引用 | `footnote.insert` `xref.insert` | `xref.insert` 收 `{paragraph, format}`，目标移动时自动更新 |
| 导出 | `file.exportPdf` `file.exportEpub` `file.exportHtml` `file.exportPptx` `file.exportIdml` `file.package` | 每个格式一个命令，没有统一的 `file.export` |

`.dcs` 引用语法（实测）：`$N.path` 取第 N 步（0 起）结果字段（`$0.story`、`$3.story`）；`$$` 写字面 `$`（`"Literal $$5"` 落成 `Literal $5`）；不是引用的裸 `$` 原样保留（`"Cost $5 only"` 落成 `Cost $5 only`）。

## 输出与校验

- 导出按 `--export` 扩展名判类型：`.png` `.jpg` `.pdf` `.designcraft` `.idml` `.epub` `.pptx` `.html` `.rtf` `.txt`；无扩展名 = 页面 PNG，其他扩展名报错并列出全集。
- `run --export` 回执带尺寸与字形数：`wrote small.png (315×405, 109.1 ms, 103 glyphs)`——这是最省的断言。
- `script` 回执是逐条结果数组：`{"completed":6,"results":[…]}`，`completed` 应等于脚本行数。
- 读回断言：`run --in x.designcraft --cmd 'document.inspect={}'` → `pageCount` / `spreads[].items[]` / `stories[]{length, overset, preview}` / `settings.pageWidth`（Letter = 612×792）。
- `.designcraft` 是 zip（magic `PK`），`page.designcraft` 8,630 字节可直接核大小。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| 报 unknown command（如 nope.zzz），exit 1 | 命令 id 猜错 | `describe <id>` 看 similar 清单，或 `commands <关键词>` 过滤 |
| invalid parameters for frame.create: unknown parameter …; the command takes: …，exit 1 | 参数名错（**本家会报错，不是静默忽略**） | 按报错列出的参数名改；旧文档说「静默失效」是错的 |
| `nothere.designcraft: 系统找不到指定的文件。 (os error 2)`，exit 1 | 路径错或工作目录不对 | 让用户给绝对路径，先 `ls` 确认 |
| `--export …: unknown file type (.png, .jpg, …)`，exit 1 | 导出扩展名不在白名单 | 换成白名单里的扩展名；`--export` 无扩展名按 PNG 处理 |
| `designcraft-cli info …` 打印 usage | 本家没有 `info` 子命令 | 改用 `run --in FILE --cmd 'document.inspect={}'` |
| `run` 的 `--cmd` 里 JSON 报错 | bash 引号/转义没用单引号 | `--cmd 'id={"k":"v"}'`；PowerShell 才需要 `""` |

## 坑（实测）

- **`commands --json` 返回 `[]`**：`--json` 被当过滤器；全量 JSON 是 `commands` 的默认输出（521 条）。
- **没有 `info` 子命令**：读回只能走 `document.inspect` 命令。
- **未知参数会报错并列出全部可用参数**——旧文档写「多数命令忽略不认识的参数，参数名错了会静默失效」，实测 exit 1 且报错，旧结论已废。
- `describe <错 id>` 不是干巴巴的报错，会附 similar 清单，是找对 id 的最快路径。
- `$$` 才是字面 `$`：写 `$$5` 得 `$5`；裸 `$5` 不展开也不报错，看读回文本才能确认到底写进去什么。
- `--page` / `--scale` / `--pdf-options` **只影响它后面的 `--export`**：写在 `--export` 之后等于没用。
- `<app>-cli --control 7979` 不合法（打印 usage）；GUI 控制通道是 `designcraft.exe --control 7979`，再用 `designcraft-cli app [--port PORT]` 连。

## MCP / 连 GUI

- `designcraft-cli mcp [--connect PORT] [--sample] [--automation-read-root DIR] [--automation-write-root DIR]`：stdio MCP；两个 root 把 agent 能读写的文件限制在指定目录（项目内服务器，与 `--connect` 冲突）。
- `designcraft-cli app [--port PORT] COMMAND [JSON]`：驱动运行中的 GUI——**需先起 GUI，未在本轮 headless 验证**。
- `designcraft-cli perf [--pages N] [--runs N] [--strict]` / `bench FILE [--runs N]`：计时，用来做回归基线。
