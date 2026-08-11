# HTML 报告格式

架构审查以单个自包含 HTML 文件的形式渲染在操作系统临时目录中。Tailwind 和 Mermaid 都来自 CDN。Mermaid 可靠地处理图形状图表；手工构建的 div 和内联 SVG 处理更具编辑性的可视化（质量图、截面）。两者混用——不要依赖 Mermaid 处理所有内容，它会开始看起来千篇一律。

## 脚手架

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>架构审查 — {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      /* 小型自定义层，用于 Tailwind 无法干净覆盖的内容：
         虚线接缝线、手绘风格箭头等。 */
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## 头部

仓库名称、日期和紧凑的图例：实线框 = 模块，虚线 = 接缝，红色箭头 = 泄漏，粗黑框 = 深模块。无需引言段落——直接进入候选者。

## 候选者卡片

图表承担主要分量。文字稀疏、朴素，使用词汇表术语（来自 `/jxx-codebase-design` 技能），不做修饰。

每个候选者是一个 `<article>`：

- **标题** — 简短，命名深化（例如"折叠订单接收管道"）。
- **徽章行** — 推荐强度（`强烈` = 翠绿色，`值得探索` = 琥珀色，`推测` = 石板色），加上依赖类别标签（`进程内`、`本地可替换`、`端口与适配器`、`mock`）。
- **文件** — 等宽列表，`font-mono text-sm`。
- **前后图** — 核心。两列并排。见下方模式。
- **问题** — 一句话。什么造成了痛苦。
- **方案** — 一句话。什么会改变。
- **收益** — 要点，每条 ≤6 个字。例如"测试命中一个接口"、"定价逻辑停止泄漏"、"删除 4 个浅包装器"。
- **ADR 标注**（如适用）— 琥珀色框中的一行。

不需要解释段落。如果图表需要一段话来理解，就重画图表。

## 图表模式

选择适合候选者的模式。混合使用。不要让每个图表看起来都一样——多样性是重点之一。

### Mermaid 图（依赖/调用流的常用工具）

当重点是"X 调用 Y 调用 Z，看看这混乱"时使用 Mermaid `flowchart` 或 `graph`。将其包裹在 Tailwind 样式的卡片中，使其不显得突兀。使用 classDef 将泄漏边着色为红色，深模块着色为深色。序列图适用于"之前：6 次往返；之后：1 次。"

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[订单处理器] --> B[订单验证器]
      B --> C[订单仓库]
      C -.leak.-> D[定价客户端]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### 手工构建的框和箭头（当 Mermaid 的布局与你作对时）

模块作为带边框和标签的 `<div>`。箭头作为内联 SVG `<line>` 或 `<path>` 元素，在相对容器上绝对定位。当你想让"之后"图看起来像一个粗边框的深模块，内部灰色化时使用——Mermaid 无法以正确的权重渲染。

### 截面（适合分层浅度）

堆叠水平条带（`h-12 border-l-4`）来展示调用经过的层。之前：6 个薄层，每个什么都不做。之后：1 个粗条带标注了合并后的职责。

### 质量图（适合"接口与实现一样宽"）

每个模块两个矩形——一个表示接口表面积，一个表示实现。之前：接口矩形几乎和实现矩形一样高（浅）。之后：接口矩形短，实现矩形高（深）。

### 调用图折叠

之前：函数调用树渲染为嵌套框。之后：同一棵树折叠为一个框，现在内部化的调用在框内以淡色显示。

## 样式指导

- 倾向编辑风格，而非企业仪表盘。宽裕的留白。标题可选衬线字体（`font-serif` 与 stone/slate 搭配良好）。
- 色彩节俭：一种强调色（翠绿或靛蓝）加上红色的泄漏和琥珀色的警告。
- 保持图表高度约 320px，使前后图能舒适地并排无需滚动。
- 图表内模块标签使用 `text-xs uppercase tracking-wider`——它们应读起来像示意图，而非 UI。
- 唯一的脚本是 Tailwind CDN 和 Mermaid ESM 导入。除此之外报告是静态的——没有应用代码，没有超出 Mermaid 自身渲染的交互性。

## 首要推荐部分

一张较大的卡片。候选者名称，一句话说明原因，锚链接到其卡片。就这样。

## 语气

朴实的中文，简洁——但架构名词和动词直接来自 `/jxx-codebase-design` 技能。简洁不是漂移的借口。

**精确使用：** 模块、接口、实现、深度、深、浅、接缝、适配器、杠杆、局部性。

**绝不替换：** 组件、服务、单元（替代模块）· API、签名（替代接口）· 边界（替代接缝）· 层、包装器（替代模块，当你想表达模块时）。

**符合风格的措辞：**

- "订单接收模块是浅的——接口几乎与实现匹配。"
- "定价逻辑跨接缝泄漏。"
- "深化：一个接口，一个测试点。"
- "两个适配器证明了接缝：生产中 HTTP，测试中内存。"

**收益要点**用词汇表术语命名收益：*"局部性：bug 集中在一个模块"*、*"杠杆：一个接口，N 个调用点"*、*"接口缩小；实现吸收包装器"*。不要写*"更容易维护"*或*"更干净的代码"*——这些术语不在词汇表中，也不配出现。

不模棱两可，不铺垫，不写"值得注意的是……"。如果一个句子可以是要点，就做成要点。如果一个要点可以删掉，就删掉。如果一个术语不在 `/jxx-codebase-design` 词汇表中，先找词汇表中的替代，再发明新的。