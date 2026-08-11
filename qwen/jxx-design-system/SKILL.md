---
name: jxx-design-system
description: 基于 Google DESIGN.md 格式确立项目级 Design System（设计系统），以 DESIGN.md 为单一设计数据源维护跨生成一致性，提供 10 种风格预设（Material 3、Apple HIG、Fluent、Linear、Minimalist Modern、Cyberpunk、Skeuomorphism、Glassmorphism、Neo-Brutalism、Shadcn/Tailwind）。当项目需要确立或维护 UI 设计规范、生成 UI 前需对齐设计令牌时使用。触发词："设计系统""DESIGN.md""配色规范""UI 风格""设计规范"。不适用于单次 UI 原型（改用 jxx-prototype 技能）或具体组件实现（改用 jxx-implement 技能）。
metadata:
  version: 1.1.0
---

# Design System（DESIGN.md 驱动）

基于 Google [DESIGN.md](https://github.com/google-labs-code/design.md) 格式，确立项目级设计系统并保证跨生成的一致性。核心是让项目根的 `DESIGN.md` 成为**单一设计数据源**：YAML frontmatter 提供精确令牌值（colors / typography / rounded / spacing / components），Markdown body 解释设计理念。所有 UI 代码引用令牌而非硬编码值——配色变更只改一处，全站一致更新。

## 工作流

### 1. 检测与启动

检查项目根是否存在 `DESIGN.md`。

- **存在** → 读取它，后续生成均引用其令牌。按步骤 5 校验是否过时。
- **不存在** → 进入步骤 2，引导用户确立设计系统。

### 2. 引导用户确立设计系统

一次问一个维度（每个附推荐答案，追问纪律参考 jxx-grill-me 技能）：

1. **风格预设**——从 10 种主流风格选一个作起点（见下方索引），或完全自定义。展示每种风格的"适用场景"帮用户选。
2. **配色基调**——主色调偏好、明暗模式（light / dark / both）。
3. **技术栈**——决定导出格式：Tailwind v4（`css-tailwind`）、Tailwind v3（`json-tailwind`）、CSS 变量（`css-vars`）、W3C DTCG（`dtcg`）。
4. **品牌约束**——是否有必须沿用的既有品牌色/字体。

不要一次抛四个问题——逐个确认。

### 3. 生成 DESIGN.md

基于所选预设（`references/themes/`），定制后写入项目根 `DESIGN.md`：

- 从预设复制 YAML tokens，按用户配色基调调整 `colors`。
- 保留 Markdown body 的设计理念，按项目语境微调。
- 确保含 `primary` 颜色（缺失则 lint 警告、代理会自动生成）。
- 运行 lint 检查 orphaned tokens 与对比度（见步骤 5）。

空白模板见 [assets/DESIGN.template.md](assets/DESIGN.template.md)。

### 4. 一致性维护（跨生成）

**这是本技能的核心价值。** 一旦 `DESIGN.md` 存在，每次生成 UI 代码时：

- **先读** `DESIGN.md`，令牌值是唯一颜色/字体/圆角/间距来源。
- **用令牌引用**，不硬编码。组件配色写令牌引用或对应 CSS 变量 / Tailwind 类，而非裸 `#1A1C1E`。
- **配色变更只改 `DESIGN.md`**，不散落改各处代码。
- 与 jxx-prototype、jxx-implement 技能协作：它们生成 UI 代码时引用 `DESIGN.md` 令牌，本技能提供令牌边界。

### 5. 验证与导出

- **lint**——校验结构、令牌引用、WCAG 对比度。Windows PowerShell 下用 `npx -p @google/design.md designmd lint DESIGN.md`（`.md` 后缀会冲突）。
- **export**——导出为框架配置（`--format css-tailwind` / `json-tailwind` / `css-vars` / `dtcg`）。
- **spec**——`npx @google/design.md spec` 将规范注入上下文。

CLI 用法详见 [references/lint-export.md](references/lint-export.md)；DESIGN.md 格式规范见 [references/design-md-spec.md](references/design-md-spec.md)。

## 10 种主流风格预设

每个预设是一个完整 DESIGN.md（YAML tokens + 理念 + 适用场景）。选一个作起点再按项目定制：

| #   | 风格                                                                       | 气质                         | 适用场景                            |
| --- | -------------------------------------------------------------------------- | ---------------------------- | ----------------------------------- |
| 1   | [Material Design 3](references/themes/01-material-design-3.md)             | Google 动态主题、层级表达    | Android/Material 应用、跨平台一致性 |
| 2   | [Apple HIG](references/themes/02-apple-hig.md)                             | 清晰留白、高级呼吸感         | 高端消费、效率工具、iOS/macOS       |
| 3   | [Fluent Design](references/themes/03-fluent-design.md)                     | 微软亚克力、深度、光照       | Windows 应用、企业内部工具          |
| 4   | [Linear Aesthetic](references/themes/04-linear-aesthetic.md)               | 精密细线、微光、暗色玻璃     | 开发者工具、AI 平台、SaaS           |
| 5   | [Minimalist Modern](references/themes/05-minimalist-modern.md)             | 电蓝渐变、双字体、微交互     | 官网首页、仪表盘、文档站            |
| 6   | [Cyberpunk](references/themes/06-cyberpunk.md)                             | 高对比霓虹、故障、终端       | 游戏/营销/加密/沉浸叙事             |
| 7   | [Skeuomorphism](references/themes/07-skeuomorphism.md)                     | 拟真材质、光照、物理触感     | 智能家居、专业音频、游戏            |
| 8   | [Glassmorphism](references/themes/08-glassmorphism.md)                     | 毛玻璃模糊、半透明、柔和渐变 | 现代营销、作品集、轻应用            |
| 9   | [Neo-Brutalism](references/themes/09-neo-brutalism.md)                     | 粗边硬阴影、高饱和撞色       | 创意机构、独立产品、实验项目        |
| 10  | [Shadcn/Tailwind Neutral](references/themes/10-shadcn-tailwind-neutral.md) | 中性实用、可访问、组件化     | 后台管理、内部工具、通用基线        |

## 反模式

- **硬编码颜色**——代码散落裸 `#1A1C1E` 而非引用令牌。一致性立即瓦解。
- **绕过 lint**——WCAG 对比度不达标就上线。先 lint 再交付。
- **多个设计源**——`DESIGN.md` 与散落的 `tailwind.config` / `theme.css` 各自定义颜色。`DESIGN.md` 是唯一源，其余由 export 生成。
- **不读就生成**——生成 UI 前不读 `DESIGN.md`，凭记忆配色。每次生成都先读。

## 与其他技能的关系

- 风格确立需追问时：使用 jxx-grill-me 技能的纪律（一次一问、每问附推荐）。
- 导出 Tailwind 后的组件开发衔接 jxx-tdd、jxx-implement 技能。
