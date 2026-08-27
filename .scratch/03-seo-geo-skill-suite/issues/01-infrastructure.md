# 基础设施：seo-geo 桶 + seo- 前缀 + x-install: project

**Status:** done

**Blocked by:** 无——可立即开始

**构建内容：** 技能仓库能把"仅项目级"技能族正确分发：大写 `SEO2GEO/` 空桶改名为小写 `seo-geo/`；`vendors.json` 的 `managedPrefixes` 增加 `seo-`（残留清理覆盖该族）；ship 支持 `x-install: project` 新取值——标记该值的技能在用户级安装中跳过、仅在 `--project` 项目级安装中出现。CHANGELOG 与安装文档同步更新。

**验收标准：**

- [ ] 桶改名完成，仓库内引用同步更新
- [ ] `vendors.json` managedPrefixes 含 `seo-`
- [ ] 行为测试：标记 `x-install: project` 的技能不出现在用户级安装结果、出现在 `--project` 结果中（不测内部解析细节）
- [ ] `ship check` 对新语义无报错
- [ ] CHANGELOG 与安装文档已更新

## 评论

- [2026-08-27] audit-seo 核查：验收标准逐项结论（5/5 满足）。①桶改名：`base/skills/SEO2GEO/`→`seo-geo/`，仓库无 SEO2GEO 代码残留（仅 CHANGELOG/memorial 历史提及）；②vendors.json `managedPrefixes` 含 `seo-`、`buckets` 含 `seo-geo`（`base/scripts/vendors.json:3`）；③行为测试：`base/scripts/test/ship.test.mjs:280-293` 覆盖 `x-install: project` 不进用户级/进项目级，实际运行 `node --test base/scripts/test/ship.test.mjs` 23/23 pass；④`node base/scripts/ship.mjs check` 输出"全部通过"；⑤CHANGELOG（`base/CHANGELOG.md:11-23`）与安装文档（`base/skills/安装.md:30-39`）已更新。判定已完成第一轮开发，待代码审查。
