---
name: pdfcraft
description: PDFCraft PDF 工具面——改页面/填表单/OCR/抽文字/真脱敏/签署/校验 PDF-A 与 PDF/UA。当要合并、拆分、填表、抽文本、查伪遮盖、验 PDF-A 时使用。触发词：pdfcraft、PDF、表单、OCR、脱敏、签署。不用于：图片修图（photocraft）、Office 文档生成（wordcraft）、RAW 显影（lightcraft）。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [pdfcraft, pdf, acrobat, ocr, codebuddy]
    description-en: |-
      1. PDFCraft PDF tooling: edit pages, fill forms, OCR, redact, sign, verify PDF/A.
      2. Triggered by: pdfcraft, PDF edit, form fill, OCR, redaction, sign, PDF/A.
      3. CLI exposes 171 tools with JSON Schemas, plus scripted multi-step runs.
      4. Usage: pdfcraft-cli run doc_open args... ; run --script steps.json [--report]; mcp [--compact].
      5. Requires D:\storytoldExe\PdfCraft\pdfcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# pdfcraft (English)

PDFCraft is a headless PDF engine exposing 171 tools with JSON Schemas (48 of them read-only); there is no `commands` or `describe` subcommand.
Trigger it for page editing, form filling, OCR, text extraction, true redaction, signing and PDF/A or PDF/UA verification.
Read a tool's parameters from the `pdfcraft-cli tools` JSON array, then run one tool with `run <tool> key=value…` or chain them with `run --script steps.json --report`.
Binary: D:\storytoldExe\PdfCraft\pdfcraft-cli.exe (Windows, no trailing space in the folder name). Failures exit non-zero.
<!--/en-->

# PDFCraft：PDF 全套

Acrobat 式引擎，**171 个工具**（带 JSON Schema 的工具面，其中 48 个只读），默认 headless。
CLI：`D:\storytoldExe\PdfCraft\pdfcraft-cli.exe`——目录名**没有尾随空格**，写成 `PdfCraft \` 必报 No such file。

## 何时用 / 不用于

- 用：合并 / 拆分 / 抽页（`combine` `split` `extract`）；改页序、旋转、插空白页（`edit`）；抽文本（`text`）；页面转图（`render`）；填表单、OCR、签署、真脱敏、PDF/A 与 PDF/UA 校验；整目录批处理（`batch`）。
- 不用于：Photoshop 式修图（photocraft）、生成 Office 文档（wordcraft）、RAW 显影（lightcraft）。用户没给文件就先问路径，别自己造素材当输入。

## 输入

- 必给：一个或多个 `.pdf` 的 Windows 绝对路径 + 目标动作（合并 / 抽页 / 填表 / 脱敏…）。
- 可选：`--password PW`（加密档）、`--page N`、`--pages 1,3,5-8`、`--dpi 96`（渲染，上限 600）、`--out 路径`。
- 工具面（`run`）：参数写 `key=value`，数组/对象写 JSON，例如 `rect=[10,10,200,60]`。

## 最小闭环（2026-10-28 实测）

```sh
CLI=/d/storytoldExe/PdfCraft/pdfcraft-cli.exe    # Windows: D:\storytoldExe\PdfCraft\pdfcraft-cli.exe
cd /e/work/sp/JwikisSkills/.temp/craft-runs/pdfcraft/verify
cat > steps.json <<'EOF'
[{"tool":"doc_create","args":{"from":"blank","pages":2}},
 {"tool":"page_add_text","args":{"doc":1,"page":1,"text":"PDFCraft smoke test","at":[72,96],"size":24}},
 {"tool":"doc_save","args":{"doc":1,"path":"E:/work/sp/JwikisSkills/.temp/craft-runs/pdfcraft/verify/test.pdf","full":true}}]
EOF
"$CLI" run --script steps.json --report    # 造 PDF：doc_create 必须给 from
"$CLI" info   test.pdf                      # pages / file_size / pdf_version …
"$CLI" render test.pdf --page 1 --dpi 96 --out page1.png
"$CLI" text   test.pdf                      # 两页之间是换页符 \f
```

真实产物：`test.pdf` = 957 字节（2 页，612×792 pt，PDF 1.7）；`page1.png` = 12,342 字节 = 816×1056 px（96 dpi，3 ms）。
同批接续：`extract --pages 1` → `p1.pdf` 939 字节；`combine test.pdf p1.pdf` → `combined.pdf` 1,067 字节 / 3 页。

## 命令怎么发现

- `pdfcraft-cli --help`：子命令全表（`info/render/text/edit/combine/extract/split/check/audit/batch/tools/run/mcp/ui`）。
- `pdfcraft-cli tools`：**全部 171 个工具 + 输入 JSON Schema**（本轮输出 211,557 字节，字段 `name/description/input_schema/read_only`）。
- 本 app **没有** `commands`，也**没有** `describe`（`describe doc_open` → `unknown command 'describe'`）：参数一律从 `tools` 的 JSON 里取。

## 常用命令族

| 族 | 代表工具 | 要点 |
|---|---|---|
| 文档 | `doc_open/info/save/create/combine/split/reduce/flatten/protect/compare` | `doc` 是 1 起整数 id，只在本进程有效 |
| 页面 | `page_render/rotate/delete/move/insert_blank/insert_file/extract/replace/duplicate` | `page_render` 出 PNG，默认 96 dpi |
| 内容 | `page_add_text/page_add_image/content_list/content_update/text_edit/text_lines` | 改已有对象用 `content_update` |
| 表单 | `form_fields/form_fill/form_add_field/form_detect_fields/form_merge_data` | 先 `form_detect_fields` 再 `form_fill` |
| 签名 | `sign_list/sign_id_create/sign_document/sign_trust` | 需证书；签名链本轮未验证 |
| 脱敏 | `redact_mark/redact_apply/redact_clear` + `doc_audit_redactions` | 标记 ≠ 删除，必须 `redact_apply` |
| OCR | `ocr_recognize/ocr_recognize_files/ocr_status` | 走 `models/` 本地模型 |
| 无障碍 | `accessibility_check/autotag_apply/set_alt/report` | PDF/UA 向 |
| 校验 | `pdfa_verify/pdfa_convert/print_readiness` | `pdfa_verify` 不合格即失败 |
| 批处理 | `doc_batch`（`batch` 子命令） | convert/ocr/optimize 走文件夹，`--recursive`、`--stop-on-error` |
| 脚本 | `js_run/js_document_scripts/js_set_document_script` | 文档内 JS，安全面自己把关 |

## 输出与校验

- 产物：`render` 写 `.png/.jpg/.tif/.pam`（实测 816×1056 px @96 dpi）；`doc_save`/`extract`/`split`/`combine` 写 PDF；`info`/`text` 只打 stdout。
- 读回断言：`info <file>` 给 `pages`/`file_size`/`first_page_pt`/`pdf_version`/`pdfa`/`pdfua`；脱敏成功判据是 `text` 里**搜不到**原文（实测 `PDFCraft smoke` → `PDFCraft `）。
- 脚本化：`run --script steps.json --report` 打一整份 JSON 报告（每步 `status/tool/result`），全对时顶层 `"ok": true`。
- 字节基线：2 页空白 + 1 段文字 = 957 字节；抽 1 页 939 字节；与原 2 页合并 3 页 1,067 字节。同一输入两次跑字节数应一致。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| `pdfcraft-cli: xxx.pdf: 系统找不到指定的文件。 (os error 2)`，退出 1 | 路径错（`PdfCraft \` 尾随空格、盘符写错） | 用 `D:\storytoldExe\PdfCraft\pdfcraft-cli.exe` 的正确路径；先 `ls` 确认存在，再向用户核对真实路径 |
| `render --page 9` 报错并退出 1 | 页码越界（2 页文档给第 9 页） | 先 `info` 读 `pages` 再给 N |
| `audit` 退出 1 + `N faux redaction(s) found` | 画上去的黑框（内容仍可提取），或 `redact_mark` 后没 `redact_apply` | 它是检测器不是修复器：`redact_mark` → `redact_apply` → `doc_save` → 再 `audit` 复验，别只盖黑框 |
| `pdfcraft-cli: run: unknown option --automation-read-root` | 围栏参数只有 `mcp` 接受 | `run` 直接给绝对路径；要围栏改用 `mcp --automation-read-root/--automation-write-root` |
| `doc_create: missing argument from` | `doc_create` 必填 `from`（`blank`/`images`/`text`） | 补 `from=blank`，或 `from=text text=…` |
| 加密档读不出页信息 | 有打开密码 | 要 `--password PW`；用户不给密码就停在这里追问 |

## 坑（实测）

- **`grep -c '"name":'` 数工具会虚胖**：得 179，真值 171——7 个工具自身有一个叫 `name` 的参数（其中一个在 schema 里出现两次）。精确数法：把 `tools` 落盘后 `JSON.parse(...).length`。
- `tools` 输出是**一整份 JSON 数组**（约 200 KB），`| head` 会把尾部切掉得到非法 JSON；先重定向到文件再解析。
- `edit` 的选项**按给定顺序执行**，后续 `--delete/--move` 的页码指前面选项处理**之后**的文档。
- 工具名是蛇形（`doc_open`），别按别的 craft 应用的点号习惯写成 `file.new`。
- 跨进程 `doc` id 不保留：多步必须塞进同一份 `--script`，单次 `run` 只跑一个工具。
- `audit` 干净时打 `{"count":0,...}` 并退出 0，发现即退出 1——脚本里别把它的非零退化当崩溃。

## MCP / 连 GUI

- `pdfcraft-cli mcp [--root DIR] [--compact] [--automation-read-root DIR] [--automation-write-root DIR]`：stdio MCP，**只有它吃围栏**（不给 write root = 禁写，read root 同理）。`--compact` 只列核心工具 + `tool_search`/`tool_call`（渐进式披露）。
- `pdfcraft-cli ui --control FILE <method>` 驱动运行中的 app——需先起 GUI，本轮 headless 未验证。
