# ADR 0006: 模板技能即生成器（skill-as-generator）+ 版本戳升级

状态：已接受（2026-08-25）
来源：memorial 001-seo-geo-skill-templates / adr/0002

## 背景

SEO/GEO 技能族要求"审查模板技能"与"博客写作模板技能"能按项目生成子技能，项目中使用子技能做事。模板与子技能的关系机制是体系骨架决策。

## 决策

1. 模板技能本身不直接干活，被调用时追问收集项目参数（项目代号、域名、语言/地区、目标搜索引擎、目标 AI 引擎、品牌口吻、行业主题域、竞品列表），在目标项目 `.codebuddy/skills/` 生成静态子技能。
2. 粒度为一模板 → 一子技能：`seo-geo-audit` / `blog-writer` 固定名，子技能内部用路由表按需加载 references。
3. 子技能 frontmatter 写 `x-template: <模板名>@<版本>` + 生成参数快照；模板检测到既有子技能时进入升级模式——比对版本、用旧参数重新生成、diff 展示待确认后覆盖。
4. 子技能骨架范式参照 news-review 实例结构：Quick Start + Skill Contract（Expected output / Reads / Writes / Done when / Primary next skill）+ 数据源表；子技能间以 `Primary next skill` 互链。

## 为什么

- 子技能是落盘静态文件：agent 加载快、context 开销固定；news-x / news-review 两个"手工生成的子技能实例"已验证该模式成立。
- 参数快照使重新生成不丢参数；diff 确认防止手工微调被无声覆盖。

## 被否决的替代方案

- **模板 + 项目配置文件**（运行时参数化，不生成子技能）：每次调用加载两层 context；特化程度受配置文件表达力限制。
- **脚本渲染生成**：确定性最强，但缺少 agent 交互式追问的参数收集能力。
- **一模板 → 多子技能**：参数广播多处，升级需批量跑，繁琐。

## 影响

- 模板技能的 frontmatter 需声明版本号（版本戳的源头）。
- 写作侧与审查侧共享同一套样式模板/样式 checklist，保证写审一致。
