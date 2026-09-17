# 020 · AI agent 维护改造清单

> 来源：memorial `020-ai-agent-maintainability`（context.md 含 10 条决策与全部追问记录；adr/ 含 4 个决策记录）。
> 实测依据：工单 001（各包机器可验证性）、002（MemoryCore strict 错误实测）、003（并行隔离与共享单例）。
> 约束：**从轻** —— 单脚本 + grep 能落地的不上两层架构；**不引入 monorepo**。
> 总纲（ADR-0001）：**凡质量结论，必附可被独立复核的证据。**

## 靶心

三条痛点是同一个病：**所有质量判断的输入都是 agent 自己的话**。

| 痛点 | 根因 | 归属线 |
|---|---|---|
| 没信号（改错了测不出来） | 闸门不全：Core 零类型检查、CI 只 2/7 包、6 包零 linter | P0 |
| 看不懂（大 diff 无法 review） | 无粒度纪律、无范围比对 | P1 |
| 漏需求（框勾了活没干） | 验收框勾选是「判断」不是「证据」 | P1 |

---

## P0 · 立闸门（让「改坏了」能被发现）

| # | 动作 | 验收（机器可判定） | 量级 |
|---|---|---|---|
| P0-1 | **MemoryCore 补根 `tsconfig.json`（`strict: true`）+ `typecheck` script**，按批 0→5 修完 254 条（ADR-0004） | `cd MemoryCore && npx tsc --noEmit` **exit 0** | 254 条 / 53 文件；批 0 消 95 条（37%） |
| P0-2 | **CI 扩到 7 个包**（每包 typecheck + test + build） | `pr-ci.yml` 出现 7 个包 job；对任一包注入类型错误 ⇒ CI 红 | 改 1 个 yml |
| P0-3 | **全仓 biome 单配置** + 每包 `lint` script | `biome check` exit 0；对任一包注入 lint 错误 ⇒ CI 红 | 1 份配置 + 7 处 script |
| P0-4 | **修 MemoryCore 僵尸 script**（`build:seed-v2` 指向不存在的 `scripts/seed-v2/`、`test:oss` 指向不存在的 `vitest.oss.config.ts`、`__tests__/` 不存在） | `cd MemoryCore && npm run build` **exit 0** | 4 处 script |
| P0-5 | **跨包依赖显式化**：MemoryGateway → MemoryMCP/Core/Knowledge（实测 13 处相对 import，含测试）+ CI 交叉检查「改了被依赖包 ⇒ 触发依赖包 job」 | 依赖写入 `package.json`；改动 MemoryMCP 时 Gateway CI 自动跑 | 13 处 + CI 矩阵 |
| P0-6 | **每包补 `AGENTS.md`**（含：怎么跑、怎么验、本机隐性门槛） | 7 个包各有 `AGENTS.md` 且含可执行命令 | 7 份；Gateway/Admin 连 README 都没有 |

**本机隐性门槛必须入库**（目前只存在于 `.workbuddy/memory/`，不在仓库）：node 版本按包不同（MemoryKnowledge 需系统 node 24 / ABI 137，knowledge-web 需 node 22）、必须置空 `NODE_OPTIONS` 停 shim、Git Bash 管道吞输出需重定向、`D:\` 上 pnpm 符号链接必炸需 `--node-linker=hoisted`。

---

## P1 · 立证据（让「做没做」可被独立复核）

| # | 动作 | 验收 | 依赖 |
|---|---|---|---|
| P1-1 | `jxx-implement` 硬出口新增**分流步骤**：每条验收框二选一 —— ①机器可验 ⇒ 附证据 ②机器不可验 ⇒ 进人工清单。**禁止"勾了完事"** | skill 文本含该步骤 + 清单模板 | — |
| P1-2 | **验收框证据格式 + 可复现性校验脚本**：证据 = 用例名（可被 grep 到）/ 命令（`exit 0`）/ 文件:行 | 脚本能抓出「写了不存在的用例名」的工单 | P0 完成（否则无证据可附） |
| P1-3 | **人工验证清单本地落点**：`.scratch/<NN>-<effort>/HUMAN-CHECK.md`（**禁止放 `.temp/`**） | 格式含：验证点 / 步骤 / 预期 / 未验证的后果 / 来源验收框 | P1-1 |
| P1-4 | **线上落点**：AgentTask 新增 `task_type=human_verify`，**按工单聚合一张卡**（防刷屏，复用既有「待抽取待办卡」模式） | 任务看板可见该卡；agent 面能列/领 | P1-3 |
| P1-5 | **独立复核 agent**（ADR-0006 的 C 部分）：复核者必须自己跑命令、按验收框逐条核对（vs 执行者隔离） | 复核报告含实际命令输出 | P1-2 |
| P1-6 | `issue-tracker.md` **done 硬闸增两条**：① 证据可复现 ② 无未勾选的人工验证项 | grep 核验脚本能挡住不合规的关单 | P1-2/3 |

**分流判据（ADR-0002）**：不是按文件类型，而是按**验证目标的性质** —— 「这个验收点能不能写成一条程序断言？」
- 能（功能是否存在 / 是否能用）⇒ **AI / 机器**
- 不能（好不好用 / 体验 / 视觉 / 手感）+ **UI 交互** ⇒ **人**
- 举证责任在 agent：默认必须给机器验；白名单只剩 UI 一类（脚本只需覆盖「diff 触及 `MemoryPanel/web`、`knowledge-web` 等前端交互层却无人工清单条目」）。

---

## P2 · 卫生与并行（后置，前两阶段完成后再谈）

> 工单 003 结论：**不要先上 worktree**。并行失败的第一因是共享单例，且最危险的失败是静默的（不同 worktree + 端口只错开一半 ⇒ Panel/Admin/Gateway 默认 URL 永远连先起的实例，**静默写错库**）。

| # | 动作 | 验收 | 备注 |
|---|---|---|---|
| P2-1 | **端口组 + 默认 URL 配对 env 化** | 两套实例可同时起且互不串（端口+URL 必须成套覆盖） | 8421 / 8123 / 8096 / 8424 |
| P2-2 | **数据目录改绝对路径 env** | `KNOWLEDGE_DATA_DIR`、`baseDir` 等全部可注入；实测两个实例数据互不可见 | 现状默认 `./data` 相对路径；`knowledge.db-wal` 482KB、`codegraph.db-wal` 927KB 未 checkpoint |
| P2-3 | **`.scratch` / ADR 编号去竞争** | 编号分配不再「扫最大+1」；重号可被检测 | **已发生两组重号**：`01-code-graph-local-index` vs `01-multi-llm-upstream`；`13-scholar-role-rename` vs `13-thinker-ticket-skill` |
| P2-4 | `AGENTS.md` / `CODEBUDDY.md` 一致性 CI 校验 | 两者不一致 ⇒ CI 红 | 现状 md5 相同但纯靠人肉双写 |
| P2-5 | `.gitignore` 补齐（`.workbuddy/`、`.codeartsdoer/`、`.trash/`） | `git status` 无这些目录 | 当前 11 条脏状态中 3 条来自它们 |
| P2-6 | **（最后考虑）worktree 并行** | 多 agent 各工作树并行且互不干扰 | 成本：`node_modules` **4.1GB/份**（Core 2.6GB）+ 踩坑级重装；`node_modules` 已是 real dir（非 symlink），共用不可行 |

---

## 不做的事（已明确否决）

| 项 | 结论 | 理由 |
|---|---|---|
| monorepo（根 `package.json` + workspace） | **否** | 与「从轻」冲突；依赖显式化用 P0-5 达成 |
| 放宽 `SQLInputValue` 接受 `undefined\|null`（−44 条） | **否** | 会放行「真可能传 undefined 进 SQL」的真 bug；且会成为后续所有 agent 的默认行为模板 |
| 按目录分批开 strict | **否** | 机制上做不到：tsc 的 `exclude` 只管 glob 展开，管不住 import 传递闭包（实测：exclude core+metadata 后仍编译 204 文件、109 条错误照报） |
| 一次性给全仓上 project references | **否** | 353 文件拆 composite 的成本远高于修 254 条错误 |
| 重型校验服务 / 新框架 | **否** | 用户明确「不要特别重」；单脚本 + grep 落地 |

---

## 与本次改造一并暴露的「真 bug」（P0-1 过程中必须真修，不是加标注）

| 位置 | 问题 | 后果 |
|---|---|---|
| `MemoryCore/src/core/skill/conversation-add/add-handler.ts:276,311` | 对象字面量**重复键**（TS1117） | 运行期后一个静默覆盖前一个 |
| `MemoryCore/src/gateway/server.ts`（6 处：2507/2524/2531/2537/2635/2638/2646） | `SkillCoreError` **未 import 就使用** | 分支走到即 `ReferenceError` |
| `MemoryCore/src/services/pipeline-worker.ts:806-807` | `buildPipelineTimerMember` 未定义 | 同上 |
| `MemoryCore/src/metadata/store/mongodb-adapter.ts:144`、`sqlite-adapter.ts:137` | 找不到 `IMetadataStore` | 两个 1000+/2700+ 行 adapter 的 `implements` 形同虚设 |
| `MemoryCore/src/offload/index.ts` | 11 个属性构造未赋值（TS2564）+ 2 处初始化前使用（TS2729） | 加 `!` 会掩盖「忘了初始化」 |
| `MemoryCore/src/integrations/**`（11 处 import） | 目录在仓库中**不存在**，被 `try/catch` 动态 import（故意的可选依赖） | 需设计决策：`@ts-expect-error` 豁免 vs 抽接口 + 空实现 |
| `MemoryCore/src/gateway/generated/schemas.ts`（51 条） | kubb 生成物，缺 wiki/codeGraph path | **文件头写明 "Do not edit manually"** —— 必须重新生成，不能手改 |
| `MemoryCore/src/offload/benchmark-token-estimate.ts:4` | 路径多了一层 `../src/` | 纯笔误 |
