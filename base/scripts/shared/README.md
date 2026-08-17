# 共享工具层（base/scripts/shared）

其余技能/专题 CLI 复用的 Node `.mjs` 工具。仅用 Node 内建模块，零第三方依赖，`node xxx.mjs` 直接可跑。

## 用法

所有脚本均为 ES module，可按需 import：

```js
// 文件系统
import { copyDir, sha256, listFilesRel, rmrf, loadJsonConfig, writeFileSafe } from './fs-cli.mjs';

// 安全追加 md 块（不覆盖、可自定义分隔符）
import { appendFragment } from './append-fragment.mjs';
appendFragment('notes.md', '# 新块', { separator: '---' });
// 已存在时不覆盖：appendFragment(f, txt, { noOverwrite: true })

// 递增编号 + slug（NN 风格目录，默认补 2 位零）
import { nextSeq, slugify } from './next-seq.mjs';
const nn = nextSeq('.scratch');        // '01'
const n3 = nextSeq(dir, { pad: 3 });   // '008'
const raw = nextSeq(dir, { pad: 0 });  // 8
const slug = slugify('Feature One');   // 'feature-one'

// 模板实例化（{{var}} 替换；冲突时按序号不覆盖）
import { renderTemplate, instantiateTemplate } from './render-template.mjs';
const out = instantiateTemplate({ template, vars: { name }, outFile, conflictBump: true });

// HTML 报告（内联 CSS，可写临时目录+时间戳+打开）
import { renderReportHtml, writeReport, writeTempReport } from './report-html.mjs';
const abs = writeTempReport({ title: '评审', cards: [{ name, verdict }], prefix: 'ev', open: true });

// 跨平台打开文件
import { openInBrowser } from './open-in-browser.mjs';
openInBrowser('./report.html');
```

## 约定

- **配置驱动**：需要平台/路径清单的场景用 `loadJsonConfig` 读外部 JSON，脚本内不硬编码路径（对齐 `vendors.json` 思路）。
- **确定性产物**：各函数返回路径/内容，便于在 `node:test` + 临时 fixture 中断言（见 `base/scripts/test/tools.test.mjs`）。
- **TDD**：本层每个函数均有对应单元测试，改函数必改测试。

## 测试

```bash
node --test base/scripts/test/tools.test.mjs
```