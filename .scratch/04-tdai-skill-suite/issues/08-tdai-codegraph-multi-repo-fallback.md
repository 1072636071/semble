# tdai-codegraph-local 多仓库 + 远端兜底

**Status:** pending-review

**Blocked by:** 07

**构建内容：** 一个守护覆盖试点两仓，本地没有的资产回源远端（认亲命中由本地作答）；支持仓库增删

**验收标准：**

- [x] 主仓库 auto-register + API 追加其余仓库
- [x] 远端兜底 + remote URL 认亲生效
- [x] 仓库增删命令
- [ ] 集成实测通过（验收①追加资产查询刷新/认亲逐资产生效）— 待人工执行 `references/dryrun.md`

## 评论

（评论与对话历史追加于此，新内容置于最前。）
