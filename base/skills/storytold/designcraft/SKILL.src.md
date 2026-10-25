---
name: designcraft
description: DesignCraft 印刷排版——画册/报告/epub/idml，脚本可引用前步结果。当要排版出版物、导 PDF、生成页面时使用。触发词：designcraft、排版、InDesign、画册、epub。
version: 0.1.0
disable-model-invocation: true
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [designcraft, print, indesign, epub, codebuddy]
    description-en: |-
      1. DesignCraft print layout: brochures, reports, epub/idml; scripts reference earlier results.
      2. Triggered by: designcraft, print layout, InDesign-like tasks, epub export.
      3. Command scripts run headless and export png/pdf/epub/idml in one run.
      4. Usage: designcraft-cli script page.dcs --save page.designcraft --export page.pdf --export page.png.
      5. Requires D:\\storytoldExe\\DesignCraft \\designcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# designcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# DesignCraft：印刷排版

InDesign 式排版引擎，521 条命令。CLI：`D:\\storytoldExe\\DesignCraft \\designcraft-cli.exe`。

## 三条驱动面

| 面 | 何时用 | 入口 |
|---|---|---|
| CLI | 一次性任务 / CI | `run` / `script` |
| MCP | Claude 等客户端，页面图随内容回传 | `mcp` |
| 控制通道 | 自建客户端驱动运行中的 app | `designcraft --control 7979` |

## 脚本（.dcs）：一行一命令，可引用前步结果

```
frame.create {"rect":[72,72,540,300],"content":"text","text":"Results of the survey"}
text.select  {"story":"$0.story","anchor":0,"focus":0}
footnote.insert {"text":"Survey run in 2026."}
frame.create {"rect":[72,320,540,500],"content":"text","text":"See ."}
text.select  {"story":"$3.story","anchor":4,"focus":4}
xref.insert  {"paragraph":"Results","format":"Paragraph Text & Page Number"}
```

```sh
designcraft-cli script page.dcs --save page.designcraft --export page.pdf --export page.png
```

**引用语法**：`$N.path` 取第 N 步（0 起）结果里的字段（`$0.story`、`$3.ids.0`），`$last` 是上一步；
包在 `\u007bN.path}` 里可插进长字符串；`$$` 写字面 `$`。文本参数里 `\n` 起新段。

## run 的顺序语义

`run [--in FILE | --sample] [--cmd ID[=JSON]]... [--page N] [--scale S] [--pdf-options JSON] [--export OUT] [--all-pages DIR]`

`--page` / `--scale` / `--pdf-options` **只作用于它们后面的 `--export`**，所以一次 run 能出多个尺寸：

```sh
designcraft-cli run --sample --scale 0.5 --export small.png --scale 2 --export large.png
```

## 导出格式

`--export` 按扩展名判类型：`.png`/`.jpg`（页）、`.pdf`、`.designcraft`、`.idml`、`.epub`、`.html`、
`.rtf`/`.txt`（编辑中的 story 或所选 frame）。**无扩展名 = 页面 PNG**，其他扩展名报错。

## 坑

- **`--cmd` 吃 `ID=JSON`**（等号），PowerShell 里 JSON 引号写 `""`；实测 `--cmd "frame.create={""rect"":[72,72,540,300],""content"":""text"",""text"":""Hi""}" --export p.png` 通过。
- 命令名别猜：`commands footnote` 按 id/label/menu 过滤，`describe xref.insert` 看单条参数。
- 多数命令**忽略不认识的参数**而不是报错，所以参数名错了会静默失效——用 `describe` 核对。
