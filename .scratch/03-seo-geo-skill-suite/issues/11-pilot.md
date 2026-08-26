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
