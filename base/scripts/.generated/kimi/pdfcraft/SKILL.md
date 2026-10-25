---
name: pdfcraft
description: PDFCraft PDF 工具——编辑/表单/OCR/红action/签署。当要处理 PDF（合并、拆分、表单、OCR、脱敏）时使用。触发词：pdfcraft、PDF、表单、OCR、红action。
---

<!--en-->
# pdfcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# PDFCraft：PDF 全套

Acrobat 式引擎，**171 个工具**（不是命令族，是带 JSON Schema 的工具面）。CLI：
`D:\\storytoldExe\\PdfCraft \\pdfcraft-cli.exe`。

## 两层用法

**A. 直接子命令**（常用操作有专门入口，参数短）：

```
pdfcraft-cli info   <file.pdf> [--password PW]
pdfcraft-cli render <file.pdf> --page N [--dpi 96] --out x.png      # .png/.jpg/.tif/.pam
pdfcraft-cli text   <file.pdf> [--page N]
pdfcraft-cli edit   <in.pdf> --out out.pdf [--rotate 1,3:90] [--delete 2,4] [--move 5:1] [--insert-blank 1] [--title T] [--author A] [--full]
pdfcraft-cli combine <a.pdf> <b.pdf> ... --out combined.pdf
pdfcraft-cli extract <in.pdf> --pages 1,3,5-8 --out out.pdf
pdfcraft-cli split   <in.pdf> (--every N | --before 3,7) [--out-dir DIR]
pdfcraft-cli audit  <file.pdf> [--password PW]     # 找假红action，找到即失败
```

`edit` 的选项**按给定顺序执行**，页码指**前几个选项处理后的文档**。

**B. 工具面**（脚本化多步，`pdfcraft-cli tools` 打出全部 171 个工具及其 JSON Schema）：

```sh
pdfcraft-cli run <tool> [key=value ...] [--root DIR] [--out image.png]
pdfcraft-cli run --script steps.json [--root DIR] [--report]
# steps.json = [{"tool":"doc_open","args":{...}}, ...]
```

## 工具族速查（171 个里的大头）

| 族 | 例 |
|---|---|
| 文档 | `doc_open/info/save/close/combine/split/create/reduce/flatten/protect/compare` |
| 页面 | `page_render/rotate/delete/move/insert_blank/insert_file/extract/replace/duplicate/transition_set` |
| 内容 | `page_add_text/page_add_image/content_list/content_update/text_edit/text_edit_layout` |
| 表单 | `form_fields/form_fill/form_add_field/form_merge_data/form_detect_fields/form_actions` |
| 签名 | `sign_list/sign_id_create/sign_windows_ids/sign_keychain_ids/sign_document/sign_trust` |
| 红action | `redact_mark/redact_apply/redact_clear` + `doc_audit_redactions` / `doc_hidden_info` / `doc_remove_hidden` |
|  OCR | `ocr_recognize/ocr_recognize_files/ocr_status` |
| 无障碍 | `accessibility_check/autotag_apply/report/set_alt/tags`（PDF/UA 向） |
| 校验 | `pdfa_verify` / `pdfa_convert` / `print_readiness` |
| 批处理 | `doc_batch`（convert/ocr/optimize 走文件夹，`--recursive`、`--stop-on-error`） |
| 脚本 | `js_run` / `js_document_scripts` / `js_set_document_script` |

## 围栏

`mcp` 与 `run` 都吃 `--automation-read-root DIR` / `--automation-write-root DIR`（可重复）：
agent 的工具能读/写什么全限制在目录内，**不给 write root = 禁写**。`--root`（给了 `mcp` 时）额外叠加。
`--compact` 只列核心工具 + `tool_search` / `tool_call`（渐进式披露）。

## 坑

- `audit` **找到假红action 就非零退出**——它是检测器，不是修复器；修要用 `redact_apply`。
- 工具名是蛇形（`doc_open`），跟 craft 别的应用的点号命令（`file.new`）不是一套。
- `--report` 让 `run --script` 打一整份 JSON 运行报告，便于审计。
- `ui --control FILE <method>` 驱动运行中的 app，与 headless 面无关。
