---
name: gridcraft
description: GridCraft 表格——公式计算/xlsx-csv 互转/数据核对。当要算公式、转 xlsx、读表格内容、校验 XLSX 保真时使用。触发词：gridcraft、表格、xlsx、公式。不用于：幻灯片与 docx 排版（走 deckcraft / wordcraft）、页面印刷渲染（走 designcraft）；单元格数值不靠猜，缺数据先向用户要。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [gridcraft, spreadsheet, excel, codebuddy]
    description-en: |-
      1. GridCraft spreadsheets: evaluate formulas, convert xlsx/csv/json/html, verify round-trip fidelity.
      2. Triggered by: gridcraft, spreadsheet, xlsx, formula, table conversion.
      3. Headless CLI opens a file or a built-in sample, runs commands, prints ranges.
      4. Usage: gridcraft-cli eval '<formula>' --in f.xlsx; run --sample budget --cmd 'id={json}' --print A1:B3; convert in.xlsx out.csv.
      5. Requires D:\storytoldExe\GridCraft\gridcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# gridcraft (English)

GridCraft is an Excel-style spreadsheet engine: 341 commands and 514 spreadsheet functions, driven headlessly by `gridcraft-cli.exe`.
It evaluates formulas, opens a built-in sample, prints used ranges, converts xlsx/csv/tsv/json/html by output extension, and audits cached values against a recalculation oracle.
Triggered by spreadsheet math, xlsx generation, reading table content or round-trip fidelity checks; it does not do slide or document layout.
Zero-setup start: `gridcraft-cli run --sample budget --out sample.xlsx`, then `check sample.xlsx` to prove the file is consistent.
<!--/en-->

# GridCraft：表格与公式

Excel 式表格引擎，341 条命令 + 514 个函数（2026-10-28 用 `commands --json` / `functions --json` 实测）。
CLI：`D:\storytoldExe\GridCraft\gridcraft-cli.exe`（目录名 `GridCraft` 无尾随空格，可执行全小写），默认 headless——不开窗口，跑完即退。

## 何时用 / 不用于

- 用：算一个公式看结果；xlsx ↔ csv/tsv/json/html 互转；读表格某片区域的内容；给 xlsx 做「缓存值 vs 重算」保真校验；用内置样例零文件起步。
- 不用于：幻灯片与 Word 文档排版（deckcraft / wordcraft）、页面印刷与 PDF 版式（designcraft）、图像与 RAW（photocraft / lightcraft）；单元格数值不臆造——缺数据先向用户要文件。

## 输入

- 用户需要给：xlsx/csv/tsv 文件绝对路径，或允许用内置样例（`budget` / `sales` / `grades`）；要读的区域（`A1:D20` 形式）；要算的公式（`=SUM(B3:E3)`）。
- 可选参数：`--sheet NAME` 选表、`--json` 出结构化结果、`--tolerance 1e-9` 定 `check` 容差、`--out FILE` 定落盘名、`--cell A1` 指定求值上下文格。

## 最小闭环（2026-10-28 实测）

```sh
CLI=/d/storytoldExe/GridCraft/gridcraft-cli.exe
"$CLI" run --sample budget --out sample.xlsx     # → wrote sample.xlsx (7682 bytes)
"$CLI" info sample.xlsx                          # → * Budget: used B2:F15, 61 cells
"$CLI" check sample.xlsx                         # → 24 formulas: 24 matched, round trip ok（exit 0）
"$CLI" convert sample.xlsx sample.csv            # → wrote sample.csv (626 bytes)
"$CLI" cat sample.xlsx --range B3:C4 --csv       # → 读回单元格内容
"$CLI" run --in sample.xlsx --cmd 'cell.set={"cell":"B3","input":1234}' --out fixed.xlsx
```

真实产物：`sample.xlsx` = 7,682 字节；`sample.csv` = 626 字节；`roundtrip.xlsx`（csv→xlsx）= 4,719 字节；`edited.xlsx` = 7,689 字节；`fixed.xlsx` = 7,694 字节。
`info` 读回：`B2:F15 / 61 cells / 1 个 BarClustered 图（H3, 2 series）`。

## 命令怎么发现

- 全量：`gridcraft-cli commands`（纯文本 682 行 = 命令 + 参数续行，**别数这个**）；`commands --json | grep -c '"id"'` = 341。
- 按需：`gridcraft-cli commands --search cell` 按 id/label 过滤，顺带打印参数行。
- **没有 `describe` 子命令**：`describe chart.add` → `unknown subcommand`；参数一律走 `commands --search <id>`。
- 函数：`functions --json`（514 个，字段 `name/category/signature/description`）、`--search X`、`--category MathTrig`。
- 子命令用法：`gridcraft-cli help run`；版本 `gridcraft-cli version`。

## 常用命令族

| 族 | 代表 id | 要点 |
|---|---|---|
| 单元格 | `cell.set` `cell.get` | 参数 `{cell?, input, sheet?}`；**值是 `input`** |
| 图表 | `insert.chart` `insert.recommendedCharts` | `insert.chart` 收 `{range?, type?, subtype?, title?, at?: "H2", width?, height?}`；`recommendedCharts` 按数据形状给题型，第一条即推荐 |
| 文件 | `file.new` `file.open` `file.saveAs` | `file.new` 收 `{sample?}`，取值 budget、sales、grades |
| 表结构 | `sheet.*` `name.*` | `commands --search sheet` 看全集 |

## 输出与校验

- 落盘：`--out FILE` 写 xlsx，stdout 打印 `wrote <file> (<N> bytes)`——以这行字节数为准（或用 `file.saveAs` 命令）。
- 读回断言：`info --json`（sheets / used ranges / charts / names）、`cat --range --csv`（读数）、`cat --range --formulas`（读公式）。
- 强校验：`check <file>` 比「文件里缓存的值」与「重算的值」并做 XLSX 往返保真；`help` 写明有差 exit 1 并逐条列差（本轮只实测了通过路径：24 checked / 24 matched）。
- 公式结果：`eval '=SUM(1,2,3)'` 打印 `6`；`--json` 打印带类型的值（如 `12.0`）。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| `nothere.xlsx: 系统找不到指定的文件。 (os error 2)`，exit 1 | 路径错或工作目录不对 | 让用户给绝对路径，先 `ls` 确认 |
| `step 1 (--cmd, nope.zzz): unknown command`，exit 1 | 命令 id 猜错 | `commands --search <关键词>` 取真实 id |
| `invalid parameters for cell.set: missing input (or value)`，exit 1 | 参数名错 | `commands --search cell.set` 看参数行 |
| 值落在 A1 而不是目标格，exit 0 | 参数写成 `range`，被静默忽略 | 改成 `{"cell":"B3","input":…}` 后重跑 |
| `eval '=NOPE(1)'` 打印 `#NAME?`，exit 0 | 公式错误只落进结果值，不算失败 | 自己看输出是否 `#` 开头，别只信 exit code |
| 转出来格式不对 | `convert` 只按**输出扩展名**判格式 | 扩展名写对：`.xlsx` / `.csv` / `.tsv` / `.json` / `.html` |

## 坑（实测）

- **没有 `describe`**：只有 `commands --search` 与 `functions --search`；照别家的 `describe <id>` 抄会报 unknown subcommand。
- **`cell.set` 收 `input`**：`{"range":"B3","value":999}` 不报错，把 999 写进了当前格 A1（`range` 被忽略）。
- 纯文本 `commands` 682 行是「命令 + 参数续行」，按行数报命令数会翻倍（341 → 682）。
- 错误公式（`#NAME?`）退出码是 0：exit code 只反映「有没有跑完」，不反映算式对不对。
- `check` 对没有公式的文件也说「通过」（`0 checked, round trip ok`），别把通过当成公式都对。
- csv → xlsx 不带公式（CSV 本身没有），`check roundtrip.xlsx` 显示 0 formulas 属正常。

## MCP / 连 GUI

- `gridcraft-cli mcp [--connect PORT] [--in FILE | --sample NAME]`：stdio MCP 给 Claude 等客户端。
- `gridcraft-cli send <port> <method> [json]`：单条控制通道请求，需先以 `gridcraft.exe --control 7979` 起 GUI——**需先起 GUI，未在本轮 headless 验证**。
