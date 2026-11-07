---
name: wordcraft
description: WordCraft 文档——从空白建 docx/转格式/提取文本。当要生成 Word 文档、docx 互转、读文档结构时使用。触发词：wordcraft、Word、docx、文档生成。不用于：幻灯片与表格（走 deckcraft / gridcraft）、印刷级版式与画册（走 designcraft）；不替用户编造正文内容，缺文案先问。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [wordcraft, docx, word, document, codebuddy]
    description-en: |-
      1. WordCraft documents: build docx from scratch, convert formats, extract text and structure.
      2. Triggered by: wordcraft, Word, docx, document generation, format conversion.
      3. CLI runs editing commands headlessly then saves; conversion covers docx/pdf/odt/rtf/html/md/tex.
      4. Usage: run --cmd 'text.insert={"text":"..."}' --save out.docx; convert in.docx out.pdf.
      5. Requires D:\storytoldExe\WordCraft\wordcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# wordcraft (English)

WordCraft is a Word-style document engine with 633 commands, driven headlessly by `wordcraft-cli.exe`.
It builds a docx from a blank document or a template, converts between docx/pdf/odt/rtf/html/md/tex/txt/json/png/xml, and reads back pages, words and block structure.
Triggered by Word document generation, docx conversion or structure extraction; it does not do slides, spreadsheets or print layout.
Typical run: `wordcraft-cli run --cmd 'text.insert={"text":"Hello"}' --save out.docx`, then `info` / `text` / `inspect` to verify.
<!--/en-->

# WordCraft：文档

Word 式文档引擎，633 条命令（2026-10-28 用 `commands --json | grep -c '"id"'` 实测）。
CLI：`D:\storytoldExe\WordCraft\wordcraft-cli.exe`（目录名 `WordCraft` 无尾随空格，可执行全小写），默认 headless。

## 何时用 / 不用于

- 用：从空白建一个 docx；docx ↔ pdf/odt/rtf/html/md/tex/txt 互转；提取纯文本；读文档结构（块、样式、页数、词数）；把页渲染成 PNG。
- 不用于：幻灯片（deckcraft）、表格与公式（gridcraft）、印刷级版面与画册（designcraft）；不替用户编造正文——缺文案先向用户要。

## 输入

- 用户需要给：要写的文字内容；可选模板 docx（`--template T`）或既有文件（`--file F`）；**不给文件也不给模板就是空白文档**。
- 可选参数：`--save OUT` 落盘名、`--author NAME`（批注与修订署名）、`--password` / `--password-file` / 环境变量 `WORDCRAFT_PASSWORD` 处理加密文档、`WORDCRAFT_REGION=en-US` 固定纸张区域。

## 最小闭环（2026-10-28 实测）

```sh
CLI=/d/storytoldExe/WordCraft/wordcraft-cli.exe
"$CLI" run --cmd 'text.insert={"text":"Hello from WordCraft"}' --save out.docx    # → wrote out.docx
"$CLI" info out.docx        # → pages 1, paragraphs 1, words 3
"$CLI" text out.docx        # → Hello from WordCraft
"$CLI" inspect out.docx     # → blocks[{index:0, type:"paragraph", style:"Normal", text:…}]
"$CLI" convert out.docx out.pdf     # → wrote out.pdf
"$CLI" convert out.docx out.md      # → wrote out.md
"$CLI" render out.docx page.png     # → {"bytes":47153,"width":1224,"height":1584}
"$CLI" run --cmd 'text.insert={"text":"Report title"}' --cmd 'text.newParagraph' \
       --cmd 'text.insert={"text":"Body line."}' --save report.docx
```

真实产物：`out.docx` = 6,527 字节；`out.pdf` = 16,538 字节；`out.md` = 21 字节；`page.png` = 47,153 字节（1224×1584）；`report.docx` = 6,531 字节（`info` 读回 paragraphs 2 / words 4）。

## 命令怎么发现

- 全量：`wordcraft-cli commands`（纯文本 633 行，本家与 JSON 计数一致）；`commands --json | grep -c '"id"'` = 633。
- 命名空间 Top（实测）：`para` 50 / `table` 48 / `insert` 44 / `format` 39 / `review` 35 / `file` 28——按前缀猜族比按名字猜准。
- 单条参数：`commands --json` 里每条都带 `params` / `mutates` 字段，按 id 过滤取；**没有 `describe` 子命令**（`describe text.insert` → `unknown command`）。
- 子命令用法：`wordcraft-cli help run`。
- 子命令全集：`convert` / `info` / `text` / `inspect` / `render` / `run` / `mcp` / `--version`。
- 脚本化：`run --script FILE|-`（`-` 是 stdin，相对路径按脚本所在目录解析），文件内 `{"file"?, "template"?, "commands":[{command, params}]}`。

## 常用命令族

| 族 | 代表 id | 要点 |
|---|---|---|
| 文本输入 | `text.insert` `text.newParagraph` `text.pageBreak` | `text.insert` 必填 `text`；`text.lineBreak` / `tab` / `backspace` / `delete` / `nbsp` 与符号命令（emDash / copyright / ellipsis） |
| 光标 | `caret.left/right/up/down` `caret.docStart/docEnd` | 16 条 `caret.*`，先移光标再编辑 |
| 段落与字符格式 | `para.alignLeft` `format.bold` `format.font` | 段落是 `para.*`（50 条）、字符格式是 `format.*`（39 条）；**没有 `paragraph.*` / `style.*`（实测为空）** |
| 批注修订 | `review.newComment` `review.trackChanges` | 批注与修订全在 `review.*`（35 条），不是 `comment.*` / `trackChanges.*` |

## 输出与校验

- 落盘提示是 `wrote out.docx`（**不带字节数**，与 gridcraft 不同）——字节数用 `ls -l` 或 `stat` 取。
- 读回断言：`info`（pages / words / paragraphs / properties）、`text`（纯文本比对）、`inspect`（块结构 JSON）。
- `render` 自带 `{"bytes","width","height"}` 回执，是唯一能自证尺寸的产物。
- `convert` 的 `--markup` 把批注与修订画进 pdf/png/html/md/txt；`.xml` 默认 Flat OPC，`--format wordml2003` 出 Word 2003 XML。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| text.insert: bad parameters: text (string) is required，exit 1 | JSON 里没写 `text` | 补齐 `{"text":"…"}`；本家参数错误会明说，可放心试 |
| `nothere.docx: 系统找不到指定的文件。 (os error 2)`，exit 1 | 路径错或工作目录不对 | 让用户给绝对路径，先 `ls` 确认 |
| `--cmd` 里 JSON 引号全乱、报参数错 | 用了 PowerShell 的 `""` 转义（旧文档的错法） | bash 里用单引号包整条：`--cmd 'id={"k":"v"}'` |
| 页数与预期差一页、PDF 纸张是 Letter | 纸张跟随系统区域（A4 / Letter） | 需要确定纸张时设 `WORDCRAFT_REGION=en-US`（或目标区域） |
| 打开加密文档报错 | 缺密码 | 用 `--password-file` 或 `WORDCRAFT_PASSWORD`，别把密码写进命令行（其他进程可读） |

## 坑（实测）

- `wrote <file>` 不带字节数：别照抄 gridcraft 的「字节数在 stdout」习惯，用 `ls -l` 取。
- 旧正文的示例是 PowerShell 写法（`""text""`），在 bash / sh 里直接跑会解析失败——本轮实测用的是单引号包 JSON。
- `convert` 按输出扩展名判格式，`.md` 只出纯文本结构（21 字节即一行正文），复杂版式要 `.docx` / `.pdf`。
- 纸张由区域决定（A4 / Letter 视 `LC_ALL`/`LC_PAPER`/`LANG`），同一台机器换区域输出会变；要可比就固定 `WORDCRAFT_REGION`。
- 密码给在命令行上会被其他进程读到，优先 `--password-file` 或 `WORDCRAFT_PASSWORD`。

## MCP / 连 GUI

- `wordcraft-cli mcp [--connect HOST:PORT | --author NAME] [--automation-read-root DIR] [--automation-write-root DIR]`：stdio MCP；两个 root 把 agent 能读写的文件限制在这两个目录里。
- `--connect` 桥到运行中的 app——**需先起 GUI，未在本轮 headless 验证**。
