---
name: wordcraft
description: WordCraft 文档——从空白建 docx/转格式/提取文本。当要生成 Word 文档、docx 互转、读文档结构时使用。触发词：wordcraft、Word、docx、文档生成。
---

<!--en-->
# wordcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# WordCraft：文档

Word 式引擎，633 条命令。CLI：`D:\\storytoldExe\\WordCraft \\wordcraft-cli.exe`。

## 最小闭环（实测通过：从空白建一个 docx）

```sh
wordcraft-cli run --cmd "text.insert={""text"":""Hello from WordCraft""}" --save out.docx
# → wrote out.docx
```

**不给 `--file` / `--template` 就是空白文档**，`text.insert` 直接打字。

## 子命令

| 子命令 | 用途 |
|---|---|
| `convert <in> <out> [--markup] [--update-fields] [--format wordml2003\|flatopc]` | docx/doc(读)/pdf/odt/rtf/html/md/tex/txt/json/png/xml 互转 |
| `info <file>` | 页数 / 词数 / 段数 / 属性（JSON） |
| `text <file>` | 纯文本 |
| `inspect <file>` | 文档结构（JSON） |
| `render <file> <out.png> [--page N] [--scale S]` | 页面渲染成图 |
| `run [--file F \| --template T] [--script FILE\|-] --cmd 'id={json}' ... [--save OUT] [--print] [--author NAME]` | headless 跑命令后保存 |

## 文本输入命令（最常用族）

`text.insert`（必填 `text`）、`text.newParagraph`、`text.lineBreak`、`text.pageBreak`、
`text.tab`、`text.backspace`、`text.delete`、`text.copyright` / `text.emDash` 等符号、
`text.toggleUnicode` / `text.typeCode`（码位输入）。光标移动是 `caret.left/right/up/down` 族。

**参数错了会明说**：`text.insert` 缺 `text` 报 `bad parameters: \`text\` (string) is required`——
不像 designcraft 那样静默忽略，所以可以放心试。

## 坑

- `--cmd` 吃 `ID=JSON`（等号）；PowerShell 里 JSON 引号写成 `""`。
- `--author` 决定批注与修订的作者名。
- `--markup` 把批注/修订画进 pdf/png/html/md/txt 输出。
- `convert` 的 `.xml` 输出默认是 Flat OPC，`--format wordml2003` 出 Word 2003 XML。
