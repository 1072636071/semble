# jxx-design-system

基于 Google [DESIGN.md](https://github.com/google-labs-code/design.md) 格式的项目级设计系统技能——确立并维护 UI 风格一致性。

## 做什么

在项目开始时引导用户确立设计系统（配色、字体、圆角、间距），以 `DESIGN.md`（YAML 设计令牌 + Markdown 理念）作为项目单一设计数据源。自带 10 种主流风格预设作起点。后续每次生成 UI 都引用令牌而非硬编码值，配色变更只改 `DESIGN.md` 一处即全站一致更新。

## 10 种内置风格预设

Material Design 3、Apple HIG、Fluent Design、Linear Aesthetic、Minimalist Modern、Cyberpunk、Skeuomorphism、Glassmorphism、Neo-Brutalism、Shadcn/Tailwind Neutral。

## 何时使用

- 新前端项目开始，项目根尚无 `DESIGN.md`
- 用户提及设计令牌 / 主题 / 配色 / UI 风格一致性 / DESIGN.md
- 组件配色或字体出现不一致，需要回头校准

## CLI 工具链

基于 `@google/design.md` 提供 lint（校验结构与 WCAG 对比度）、export（导出为 Tailwind/CSS/DTCG 格式）、spec（规范注入上下文）三条命令。详见 SKILL.md 步骤 5。

## 相关技能

- `/jxx-prototype`、`/jxx-implement`：在令牌边界内生成 UI 代码
- `/jxx-grill-me`：风格确立时逐项追问的纪律
