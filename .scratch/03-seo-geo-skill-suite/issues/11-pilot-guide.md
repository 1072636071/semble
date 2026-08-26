# 试点指引：official-domestic-website 端到端验证（工单 11）

> 本文档由工单 11 准备。试点需在 `official-domestic-website` 项目执行，验收新体系全流程。

## 前置条件

- seo-geo 族 8 个技能已在本仓库 `base/skills/seo-geo/` 落地（工单 01–10 完成）
- `ship` 已支持 `x-install: project`（工单 01）
- 试点项目：`E:\work\sp\official-domestic-website`

## 试点流程

### Step 1：首次安装套件

在 `official-domestic-website` 项目根目录执行：

```powershell
node E:\work\sp\JwikisSkills\base\scripts\ship.mjs install --project
```

验证：项目级技能目录（如 `.codebuddy/skills/`）下出现 8 个 seo-* 技能。

### Step 2：seo-router 引导

在项目对话中输入「SEO help」或「帮我做 SEO」：

- 验证 `seo-router` 被触发
- 验证路由表列出全家技能

### Step 3：生成审查子技能

输入「生成审查技能」或「configure audit skill」：

- 验证 `seo-audit-template` 被触发，进入追问收参
- 回答项目参数（项目代号、域名、语言/地区、目标搜索引擎、目标 AI 引擎、品牌口吻、行业主题域、竞品列表、内容集合路径、数据源路径表）
- 验证生成 `.codebuddy/skills/seo-geo-audit/SKILL.md`，frontmatter 含 `x-template: seo-audit-template@1.0.0` + 参数快照
- 验证子技能含三维审查结构 + Primary next skill 互链

### Step 4：生成写作子技能

输入「生成写作技能」或「configure blog writer」：

- 验证 `seo-blog-template` 被触发，进入追问收参
- 回答项目内容架构知识（内容集合、frontmatter 契约、分类枚举、渲染约定、缩略图映射、设计令牌）
- 验证生成 `.codebuddy/skills/blog-writer/SKILL.md`，frontmatter 含 `x-template: seo-blog-template@1.0.0` + 参数快照
- 验证子技能含架构事实表 + Frontmatter 契约 + 样式模板 + 自检 checklist

### Step 5：真实使用——审查

输入「审查资讯 dotp-production-technology」：

- 验证 `seo-router` 优先路由到已生成的 `seo-geo-audit` 子技能
- 验证三维度审查（真实性 + SEO/GEO + 样式一致性）产出结构化报告与评分
- **验收硬标准**：生成物不比 news-review 手工版"笨"（项目知识收集到位）

### Step 6：真实使用——写作

输入「写一篇关于 DOTP 市场趋势的资讯」：

- 验证 `seo-router` 优先路由到已生成的 `blog-writer` 子技能
- 验证追问收集 title/slug/category/summary/date/正文
- 验证生成的 Markdown 符合项目 frontmatter 契约与样式规范
- 验证过 GEO 可引用性 checklist

### Step 7：升级模式

1. 修改 `seo-audit-template` 的 `metadata.version`（如 bump 到 1.0.1）
2. 输入「升级审查技能」
3. 验证进入升级模式：比对版本 → 用旧参数重新生成 → diff 展示 → 确认后覆盖
4. **验收硬标准**：手工微调不被无声覆盖（diff 确认生效）

## 验收标准（对齐工单 11）

- [ ] 首次安装 + 生成两个子技能走通
- [ ] 生成的子技能不比 news-x / news-review 手工版"笨"（项目知识收集到位：架构事实、分类枚举、渲染约定、图片映射）
- [ ] 升级模式：版本比对 + diff 确认生效，手工微调不被无声覆盖
- [ ] 真实任务验证：审查至少 1 篇既有资讯、写作至少 1 篇新资讯，产出质量用户认可
- [ ] 试点发现的问题回写工单评论，必要时回流修补丁工单

## 旧技能保留

旧手工技能（`spz-seo-*`、`geo-super-geo-agent-readiness`、`news-x`、`news-review`）在试用期间保留并存，用户试用确认无回归后自行删除（D16）。

## 试点后

- 试点发现的问题回写 `.scratch/03-seo-geo-skill-suite/issues/11-pilot.md` 评论
- 必要时回流修补丁工单（01–10）
- 试点成功后推广到其他项目
