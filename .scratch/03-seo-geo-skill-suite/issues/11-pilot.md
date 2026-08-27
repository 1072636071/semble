# 试点：official-domestic-website 端到端验证

**Status:** ready-for-agent

**Blocked by:** 10

**构建内容：** 在 official-domestic-website 项目跑通新体系全流程：ship `--project` 首次安装套件 → `seo-router` 引导 → 审查模板生成 `seo-geo-audit` 子技能 → 写作模板生成 `blog-writer` 子技能 → 真实使用（审查一篇既有资讯、写一篇新资讯）→ 模板版本号 bump 后验证升级模式（diff 确认）。旧手工技能（spz-seo-*、geo-super、news-x、news-review）保留并存，用户试用确认无回归后自行删除。

**验收标准：**

- [ ] 首次安装 + 生成两个子技能走通
- [ ] 生成的子技能不比 news-x / news-review 手工版"笨"（项目知识收集到位：架构事实、分类枚举、渲染约定、图片映射）
- [ ] 升级模式：版本比对 + diff 确认生效，手工微调不被无声覆盖
- [ ] 真实任务验证：审查至少 1 篇既有资讯、写作至少 1 篇新资讯，产出质量用户认可
- [ ] 试点发现的问题回写工单评论，必要时回流修补丁工单

## 评论

- [2026-08-27] 核查说明：试点需在 `E:\work\sp\official-domestic-website` 项目端到端执行（首次安装 → 生成子技能 → 真实任务 → 升级模式），本仓库无法代码修复；试点指引见 `11-pilot-guide.md`。状态保持 ready-for-agent，待试点后回写。

- [2026-08-27] audit-seo 核查：本工单为端到端试点，需在 `E:\work\sp\official-domestic-website` 执行（ship `--project` 安装→seo-router 引导→生成 seo-geo-audit/blog-writer→真实审查/写作→版本 bump 升级）。本仓库内无试点执行痕迹：`## 评论` 无试点完成记录、无已生成子技能（seo-geo-audit/blog-writer）产物、无试点发现的问题回写。验收标准 5 项均未在仓库内验证。前置工单 01-10 已具备（seo-geo 族 8 技能已落地、ship 支持 x-install: project），试点指引见 11-pilot-guide.md。判定：未完成/部分完成（待试点），Status 维持 ready-for-agent，解除阻塞需在试点项目实际跑通后回写。
