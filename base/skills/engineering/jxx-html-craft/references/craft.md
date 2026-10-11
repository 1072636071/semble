# craft.md — 质量底线

生成 HTML 时逐条落实。这些都是"做了才算做了"的检查项，不是意图。

## 文件头（缺一不可）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>具体而有信息量的标题</title>
</head>
```

- `lang` 与正文语言一致（中文 `zh-CN`，英文 `en`）。
- `<title>` 说清这是什么页面，不用 "Untitled" / "Document" / 纯文件名。

## 语义与结构

- 地标元素：`header` / `nav` / `main` / `section` / `article` / `footer`，不用一锅 `<div>`。
- 标题层级连续：一个 `h1`，不跳级（`h1 → h3` 是错误）。
- 图片有 `alt`；装饰图 `alt=""`；图标按钮有 `aria-label`。
- 列表用 `ul/ol`，数据用 `table`（含 `th` scope），引用用 `blockquote`——不拿排版模拟结构。

## 自包含（单文件优先）

除非用户明确要求分离资源，HTML 默认自包含：

- CSS 内联 `<style>`，JS 内联 `<script>`（放 `</body>` 前）。
- 字体：`@font-face` 内嵌 base64，或系统字体栈兜底——离线打开不能变成宋体/衬线灾难。中文界面推荐系统栈：`-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`。
- 数据/图标：内联 SVG 而非外链；截图和图表能 canvas/SVG 生成就不依赖 CDN。
- 确需外链（如 Google Fonts）时，必须声明完整兜底栈，页面离线仍可读。

## 响应式

- 断点至少覆盖：≤480px 手机、481–1024 平板、>1024 桌面。
- 无横向滚动：长词 `overflow-wrap: break-word`，代码块 `overflow-x: auto`，表格容器可横向滚动（表格自身不撑破页面）。
- 图片 `max-width: 100%; height: auto`。
- 触控目标 ≥44×44px；手机上不出现 hover-only 的信息。

## 可访问性

- 正文对比度 ≥4.5:1，大字（≥24px 或 ≥18.7px bold）≥3:1。灰字压彩底是重灾区——次要文字从主色调衍生或加深，不用纯灰。
- 键盘焦点可见：`:focus-visible` 有清晰样式，Tab 顺序符合视觉顺序。
- 表单控件都有 `<label>`；错误提示说明问题和恢复方式。
- 动效尊重 `prefers-reduced-motion`：关掉非必要动画。

## 健壮性

- 打开无控制台报错；所有内联 JS 语法有效。
- 所有链接 `href` 有效（锚点存在、外链完整）。
- 空状态有内容（"暂无数据"而不是空白洞）。
- 示意数据必须标注"示意/示例"；不得把编造数字呈现为事实。

## 交付前 8 项自检

1. `<!DOCTYPE>` + `lang` + `charset` + `viewport` + `<title>` 五件套齐全
2. 语义地标与标题层级正确
3. 正文对比度 ≥4.5:1
4. 键盘 Tab 走一遍，焦点全程可见
5. 手机宽度（375px）排版正确、无横向滚动
6. 离线打开（断网）页面仍完整可读
7. 控制台无报错
8. 示意数据已标注，真实数据有来源

发现问题一轮修完，最多再确认一轮，停止。

## 自检脚本

第 1/2/7 项与对比度有确定性脚本，不必现场手写（脚本位于本技能 `scripts/` 目录，零依赖，`node <script> <file>` 运行）：

- `scripts/html-selfcheck.mjs <file.html>` — 链接/锚点可达性、标题层级跳级、关键标签配平、head 五件套、外链与 alt 清点
- `scripts/contrast-check.mjs` — 按页面实际 HSL 配色对修改脚本内的色值配对后运行，输出每组 WCAG 对比度

其余项（键盘焦点、375px、离线、控制台）仍需 agent 打开页面人工核。
