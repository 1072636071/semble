---
name: gridcraft
description: GridCraft 表格——公式计算/xlsx-csv 互转/数据核对。当要算公式、转 xlsx、读表格内容、校验 XLSX 保真时使用。触发词：gridcraft、表格、xlsx、公式。
---

<!--en-->
# gridcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# GridCraft：表格与公式

Excel 式表格引擎，341 条命令。CLI：`D:\\storytoldExe\\GridCraft \\gridcraft-cli.exe`。

## 不用建文件就能跑

`--sample budget|sales|grades` 直接开内置样例工作簿：

```sh
gridcraft-cli run --sample sales --print A1:B3
```

## 常用子命令

| 子命令 | 用途 |
|---|---|
| `eval <formula> [--in FILE] [--sheet S] [--cell A1] [--json]` | 算一个公式 |
| `info <file> [--json]` | sheets / used ranges / tables / charts / names |
| `cat <file> [--range A1:D20] [--sheet S] [--formulas] [--csv]` | 读内容 |
| `convert <in> <out> [--sheet NAME]` | xlsx/csv/tsv/json/html 按扩展名互转 |
| `check <文件或目录>... [--tolerance 1e-9]` | 缓存值 vs 计算 oracle + XLSX 往返保真，有差退出码 1 |
| `run [--in FILE | --sample NAME] [--cmd 'id={json}']... [--script FILE.jsonl] [--out FILE] [--print RANGE]` | 跑命令脚本 |
| `commands [--json] [--search X]` / `functions [--json] [--category C]` | 列命令 / 列函数 |
| `mcp [--connect PORT] [--in FILE | --sample NAME]` | stdio MCP |
| `send <port> <method> [json]` | 单条控制通道请求（`gridcraft --control 7979`） |

## 坑

- **`--cmd` 的格式是 `ID=JSON`**（等号连着），JSON 在 PowerShell 里引号写 `""`。
- `check` 是 CI 向工具：它比的是「文件里缓存的值」与「重算的值」，不一致就 exit 1。
- 转换只按**输出扩展名**判格式，写错扩展名就是另一个格式。
