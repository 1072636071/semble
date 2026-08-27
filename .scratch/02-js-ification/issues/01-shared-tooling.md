# 共享工具层（base/scripts/shared）

**Status:** done

**Blocked by:** 无——可立即开始

**构建内容：** 在 `base/scripts/shared/` 落地一组跨技能复用的纯函数库 `.mjs`，供后续各专题 CLI import——`fs-utils.mjs`（递归复制/哈希校验/配置驱动）、`append-fragment.mjs`（安全追加 md，分隔符/不覆盖）、`next-seq.mjs`（目录扫描递增编号 + slug）、`render-template.mjs`（模板实例化 + 冲突加序号不覆盖）、`report-html.mjs`（结构化数据 → 自包含 HTML + 临时目录 + 时间戳 + 跨平台打开）、`open-in-browser.mjs`。全部用 Node 内建模块，零第三方依赖，`node:test` 可测（沿用 ship.test.mjs 范式）。

**验收标准：**

- [ ] `base/scripts/shared/` 下共享工具 `.mjs` 落地，每个脚本对应一张 `*.test.mjs`（置于 `base/scripts/test/`），经 `node:test` 单元断言覆盖边界（追加不覆盖、编号冲突、模板冲突加序号、HTML 落盘+打开）
- [ ] 依赖仅 Node 内建模块，无需 npm install，被专题 CLI import 即用
- [ ] 提供一份调用示例/文档，后续专题能直接 import 复用

## 评论

- [2026-08-27] audit-js 核查：验收标准逐项结论（3/3 满足），验证方式（base/scripts/shared/ 下 6 个共享模块 fs-utils/append-fragment/next-seq/render-template/report-html/open-in-browser.mjs 全部落地，各自对应 test/*.test.mjs 存在且 `node --test "base/scripts/test/*.test.mjs"` 全绿（135 项，含本批 append-fragment/fs-utils/next-seq/render-template/report-html/open-in-browser）；仅用 Node 内建模块零第三方依赖；shared/README.md 提供 import 用法示例），判定为已完成第一轮开发，待代码审查。

（评论与对话历史追加于此，新内容置于最前。）
