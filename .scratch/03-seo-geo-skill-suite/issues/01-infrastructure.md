# 基础设施：seo-geo 桶 + seo- 前缀 + x-install: project

**Status:** ready-for-agent

**Blocked by:** 无——可立即开始

**构建内容：** 技能仓库能把"仅项目级"技能族正确分发：大写 `SEO2GEO/` 空桶改名为小写 `seo-geo/`；`vendors.json` 的 `managedPrefixes` 增加 `seo-`（残留清理覆盖该族）；ship 支持 `x-install: project` 新取值——标记该值的技能在用户级安装中跳过、仅在 `--project` 项目级安装中出现。CHANGELOG 与安装文档同步更新。

**验收标准：**

- [ ] 桶改名完成，仓库内引用同步更新
- [ ] `vendors.json` managedPrefixes 含 `seo-`
- [ ] 行为测试：标记 `x-install: project` 的技能不出现在用户级安装结果、出现在 `--project` 结果中（不测内部解析细节）
- [ ] `ship check` 对新语义无报错
- [ ] CHANGELOG 与安装文档已更新

## 评论
