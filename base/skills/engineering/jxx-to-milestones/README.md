# jxx-to-milestones

把一批已发布的工单归组为**可独立上线的里程碑**，生成 `MILESTONES.md`，并按里程碑逐个交付。

核心不变量：**任何一个里程碑结束时，代码库都能直接上线给用户，而不需要等后面的里程碑。**

## 何时使用

- 工单多、改动大，一次性上线风险过高，需要分批发布
- 涉及广泛重构、破坏性变更或不可逆数据迁移，需要每批都能单独回滚
- 工作可能跨多个会话，需要中断后续传
- 在 `/jxx-to-tickets` 生成工单之后，需要把它们组织成可交付的批次

## 工作流

1. **扫描** — 读取 `issues/` 下工单的编号、状态与 `Blocked by:` 依赖
2. **归组** — 按依赖层分层 + 相邻层贪心合并（脚本），再按"独立上线"硬规则做语义调整
3. **校验** — `check` 判定循环依赖、跨里程碑回头依赖、工单遗漏/重复/空组
4. **生成** — `render` 产出 `MILESTONES.md` 骨架，由模型补全用户视角交付、可独立上线判据、回滚方式、验收信号
5. **交付** — 里程碑间严格串行，里程碑内按组内顺序逐工单 `/jxx-implement`；里程碑末尾过上线门禁后置 `shipped`

## 脚本

```bash
node <本技能目录>/scripts/milestones.mjs scan --dir <dir>                       # 工单清单
node <本技能目录>/scripts/milestones.mjs plan --dir <dir> --target 4 --max 6    # 里程碑建议
node <本技能目录>/scripts/milestones.mjs check --dir <dir> --groups "01,02|03"  # 硬约束校验
node <本技能目录>/scripts/milestones.mjs render --dir <dir> --title "<功能名>"  # 生成 MILESTONES.md
node <本技能目录>/scripts/milestones.mjs status --dir <dir>                     # 进度与门禁就绪度
node <本技能目录>/scripts/milestones.mjs set-status --dir <dir> --milestone M1 --status shipped
```

零第三方依赖。确定性环节（解析、分层、校验、渲染、进度回读）交给脚本；判读性内容（里程碑命名、交付描述、回滚方式、验收信号语义）留给模型。

## 产出

`<功能目录>/MILESTONES.md` — 进度总览 + 每个里程碑的工单、组内顺序、用户视角交付、可独立上线判据、回滚方式、验收信号 + 交付规则 + 评论。

## 相关技能

- `jxx-to-spec` — 上游：生成规格文档
- `jxx-to-tickets` — 上游：把规格拆成工单（本技能的输入）
- `jxx-implement` / `jxx-code-review` — 下游：逐工单实现与审查
