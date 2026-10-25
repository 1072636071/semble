---
description: 生成任何 HTML 文件时必须加载的质量与美学底线——保证基本质量（语义、响应式、可访问性、自包含）与精美外观（排版、配色、间距、动效）。触发：生成 HTML、写网页、做报告页、做演示页、导出 HTML、HTML 报告、landing page、单文件页面、美化页面、美化 HTML。只要产物包含 .html 文件（报告、文档、看板、原型、邮件模板、工具页）就必须遵循本技能，与 impeccable（深度设计工作流）互补：轻量产物直接用本技能，重量级设计才升级到 impeccable。
---

<!--en-->
# jxx-html-craft

The quality and aesthetics floor for any HTML deliverable. Load when a task produces a `.html` file — reports, docs, dashboards, prototypes, tool pages, email templates, landing pages.

## When

Auto-trigger: any deliverable containing an `.html` file. Two tiers:

- **Light deliverable** (report page, doc page, export page, single-file tool): follow this skill's floor directly, no ceremony.
- **Heavy design work** (product UI, landing page for a real product, multi-page visual world): use this skill as the floor, then escalate to `impeccable` for direction, modes, and verification passes.

## How

1. Pick the tier, then load `references/craft.md` (quality floor: semantics, responsive, a11y, self-containment) and `references/beauty.md` (visual system: type, color, spacing, motion).
2. Generate the HTML honoring both checklists. Self-contained first: no network dependency to render correctly; inline or embed fonts/CSS/JS/data, or degrade gracefully offline.
3. Before handing off, run the 8-point self-check in `references/craft.md` (title/charset/viewport, semantic landmarks, contrast, focus, breakpoint behavior, no horizontal scroll, no console errors, honest data labels).
4. Fix everything the check shows in one pass. Do not iterate open-endedly — one fix round, one confirm round, stop.

## Rules

- One authored visual world per file: deliberate palette, type scale, spacing rhythm — never browser defaults.
- Semantic HTML landmarks (`header/nav/main/section/footer`), real headings hierarchy, alt text on every image.
- Responsive by default: mobile ≤480px, tablet, desktop all compose correctly; no horizontal scroll.
- Accessibility floor: body text contrast ≥4.5:1, visible keyboard focus, labels on all controls.
- Honest data: label illustrative values; never invent numbers presented as fact.
<!--/en-->

# jxx-html-craft

任何 HTML 产物的质量与美学底线。生成报告页、文档页、看板、原型、工具页、演示页、landing page 等 `.html` 文件时加载。

## 何时用

自动触发：只要本次任务的产物包含 `.html` 文件。分两档：

- **轻量产物**（报告页、文档页、导出页、单文件工具页）：直接按本技能的底线执行，不搞仪式感。
- **重量级设计**（真实产品的 UI、正式 landing page、多页面视觉世界）：本技能是底线，方向、模式、验证轮次升级到 `impeccable`。

## 怎么做

1. 定档后读 `references/craft.md`（质量底线：语义、响应式、可访问性、自包含）和 `references/beauty.md`（视觉系统：字体、配色、间距、动效）。
2. 按两张清单生成 HTML。自包含优先：正确渲染不依赖网络；字体/CSS/JS/数据内联或嵌入，或离线时优雅降级。
3. 交付前过一遍 `references/craft.md` 里的 8 项自检（标题/字符集/viewport、语义地标、对比度、焦点、断点表现、无横向滚动、无控制台报错、数据标注诚实）。
4. 自检发现的问题一轮修完，最多再确认一轮，停止打磨——不搞开放式迭代烧用户的钱。

## 规则

- 每个文件一个完整的视觉世界：刻意的配色、字阶、间距节奏——绝不用浏览器默认样式。
- 语义化 HTML 地标（`header/nav/main/section/footer`）、真实的标题层级、每张图片有 alt。
- 默认响应式：手机 ≤480px、平板、桌面都要正确排版，无横向滚动。
- 可访问性底线：正文对比度 ≥4.5:1、键盘焦点可见、控件有标签。
- 数据诚实：示意值要标注；绝不把编造的数字当事实呈现。
