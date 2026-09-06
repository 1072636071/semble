# tdai-codegraph-local 集成验收清单

> 对应 PRD `.scratch/04-tdai-skill-suite/` 实施验收项①（memorial `002-tdb-am-code-graph-wiki`）。本文件记录需真实环境验证的集成行为，单测无法覆盖。

## 验收项①：单守护多仓库的查询前刷新/认亲逐资产生效

**来源**：ADR `adr/0001-single-daemon-multi-repo-local-codegraph.md` 影响 + memorial 实施验收项①。

**背景**：单守护进程服务多仓库是 ADR 0001 的核心决策。现有 MemoryKnowledge 测试只覆盖单工作区 auto-register；追加资产（`/code-graph/create(source_type=local)`）后的查询前增量刷新（`QueryRefreshCoordinator`）与远端兜底认亲是否逐资产遍历生效，需实测验证。

**通过条件**：

- [ ] 主仓库（JwikisSkills）auto-register 后，查询 `explore`/`search` 返回主仓库符号
- [ ] 追加仓库（TencentDB-Agent-Memory）后，**不重启守护**，查询该仓库符号能命中
- [ ] 追加仓库工作区有未提交改动，查询反映最新代码（查询前刷新生效）
- [ ] 防抖窗口内（默认 5s）连续查询不重复刷新（看 daemon.log 的 refresh 日志）
- [ ] 配置 `KNOWLEDGE_FALLBACK_BASE_URL` 后，查询本地没有的资产 → 远端作答
- [ ] 远端资产 `remote_url` 与某本地资产 `remote_url` 归一化相同 → 本地作答（认亲命中）

**执行方式**：按 `dryrun.md` 步骤 5+6 半自动执行，人工核对查询结果。

## 验收项③：非主仓库 .codegraph/ gitignore 追加

**来源**：ADR 0001 影响 + memorial 实施验收项③。

**背景**：local-server.ts 启动时仅对主工作区调 `ensureCodegraphIgnored`；追加仓库的 `.codegraph/` gitignore 由技能脚本（`repo.mjs` 的 `ensureCodegraphIgnored`）保证。

**通过条件**：

- [ ] `node repo.mjs add <path>` 后，`<path>/.gitignore` 含 `.codegraph/` 行
- [ ] 已有 `.gitignore` 不被破坏（仅追加一行）
- [ ] 已含 `.codegraph/` 时不重复追加

**执行方式**：单测 `repo.test.mjs` 的 `ensureCodegraphIgnored` 三例覆盖；集成时按 `dryrun.md` 步骤 5 核对。

## 验收项②：wiki 兜底转发参数透传

**归属**：`tdai-wiki-local` 技能（M5 工单 10），本文件仅引用关联——wiki 查询复用本技能守护进程 MCP 兜底转发，透传行为需在 M5 验收。见 `../tdai-wiki-local/references/integration-acceptance.md`（待 M5 创建）。
