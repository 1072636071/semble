# mattpocock-skills

## 共享安装目录的校验噪音修复 2026-10-17

### 修复（install 每次误报 45 项 MISMATCH）

- **根因**：`vendors.json` 中 opencode 与 kimi 的 `user.skills` 同指 `~/.agents/skills`（该指向由 commit `71e87261` 引入，原 kimi 路径为 `D:\aiData\kimiData\...`）。两家 `derive` 规则不同——kimi 会把 frontmatter 归一化为 `name + description`，opencode 保留完整 frontmatter。install 按 vendors 遍历顺序执行，kimi 排第 8 位后写覆盖，最终磁盘是 kimi 归一化版。
- **现象**：`runVerify` 让每家 vendor 各按自己的派生基准校验同一份磁盘文件，opencode 的基准永远对不上，于是每次 `ship install` 都稳定输出 45 项 MISMATCH。这是**覆盖噪音，不是真实失配**——长期下来会让「MISMATCH」失去信号价值（狼来了）。
- **修法**：`runVerify` 增加共享目标识别——同一 `dest` 被多家写入时，只保留**最后写入者**的基准参与校验，先写者的条目跳过（其结果已被覆盖，无校验意义）。`installed` 项补记 `vendor` / `skillsTarget` 以支撑该判定。真实失配仍会被捕获（最后写入者基准与磁盘不符即报 MISMATCH）。
- **附带修正**：`ship.test.mjs` 中「vendors 声明 4 家有派生规则」的断言与实际（5 家）脱节，改为 5。
- **回归测试**：新增 2 条用例——① 共目录场景只报一条校验结果且为 OK、不出现 MISMATCH；② 磁盘被污染时仍报 MISMATCH（确保不因跳过逻辑漏报）。
- **效果**：`ship install` 从「45 MISMATCH + 335 OK」变为「335 OK、0 问题行」。

## 目录锚定与副本一致性治理 2026-09-16

### 修复（「生成文件的技能」写错目录）

- **`jxx-to-spec` / `jxx-to-tickets` 的 `issue-flow.mjs`**：原先用 `path.join(__dirname, '..','..','.scratch')` 锚定 `.scratch` 根，复制进技能 `scripts/` 与安装到各平台后指错目录且**静默**（编号回落 `01`、`writeFileSafe` 自动建目录树）。改为 `resolveScratchRoot()`：显式 `--root` 优先，否则从 **cwd 向上**找含 `.git`/`.scratch` 的仓库，找不到直接报错退出（退出码 1）。
- **`jxx-tool-intro` 的 `gen-tool-page.mjs`**：原先用 `path.resolve(__dirname, "../../../../../")` 定位仓库根，安装布局下解析成 `C:\Users`（实测报「工具数据源不存在: C:\Users\docs\guide」）。改为从 cwd 向上找含 `.git`/`docs` 的项目根，保留 `--root` / `--src` / `--out` 与 `SRC_DIR` / `OUT_DIR` 覆盖；失败时打印解析到的根与纠正办法。SKILL.src.md 同步改写（`<本技能目录>` 路径 + 去掉「auto-detected from repo root」的假承诺）。
- **`jxx-research`**：严格模式落盘指引补「`--out` 相对 cwd 解析，必须在目标仓库根执行或写绝对路径」。
- 清 `base/scripts/{milestones,report-flow}.mjs` 中未使用的 `__dirname` / `fileURLToPath` 死代码。

### 新增（门禁与护栏）

- **`base/scripts/check-copies.mjs`**：统一的脚本副本一致性门禁。登记 **47 处**副本（`shared/{fs-utils,next-seq,render-template,open-in-browser,report-html}`、`report-flow`、`scaffold`、`milestones`、`issue-flow`），`--check` 校验字节一致（含行尾）、`--fix` 唯一下发通道、并报出**未登记副本**防止私自分叉。
- **`base/scripts/test/copies-parity.test.mjs`**：副本一致 + 无未登记副本 + HTML 资产（`sync-html-template --check`）+ 「不得用固定层级 `__dirname` 上跳定位输出目录」的守则断言。
- **`base/skills/engineering/jxx-tool-intro/tests/gen-tool-page.test.mjs`**：把技能复制到任意深层布局再运行，锁住「锚定 cwd、不锚定脚本位置」，并断言失败路径不静默建目录。
- `base/scripts/shared/README.md` 补「副本分发」纪律（只改本源 → `--fix` 下发；`__dirname` 只用于自带只读资源）。

### 顺带发现（未改，另行处理）

- `base/scripts/ship.mjs` 有在途 WIP（含整文件 CRLF 化），本轮未改动；`check-copies.mjs` 建议后续接进 `ship check`。

## ship 跨厂商分发 2026-08-27（01-ship-multi-vendor-distribution，工单 01-06）

### 重大变更

- **单一入口 `ship.mjs`**：`base/scripts/ship.mjs` 提供 `init` / `derive` / `install` / `check` 子命令，零参数触发全流程（扫描 → 双模式派生/复制 → 安装 → SHA256 验证 → 残留清理）。
- **`vendors.json` 配置驱动**：7 家平台（OpenCode/CodeBuddy/CodeArts/Trae/Qoder/WorkBuddy/QoderWork），4 家有派生规则、3 家走原样复制 fallback；`managedPrefixes` 限定残留清理范围。
- **双模式迁移**：技能含 `SKILL.src.md` 走单源派生（CodeArts 前缀+5 行英文 description、openCode 无 name 键、CodeBuddy/Trae 透传注入），不含走原样复制；Agent 同理（`AGENT.src.md` 为派生开关）。
- **CodeArts 硬门禁**：`x-vendors.codearts.description-en` 或 `<!--en-->` 英文块缺失时 `check` 非零退出、跳过该厂安装但不阻塞其余厂商。
- **`x-install` 就近声明**：`true`/缺省 = 用户级+项目级都装；`false` = 不装且不派生；`project` = 仅项目级装。5 个 productivity 排除项技能（jxx-teach/jxx-wait-what/skill-creator/skill-reviewer/skill-tester）已补 `x-install: false`。
- **PS 脚本退役**：`base/skills/install.ps1` / `verify.ps1` 删除，能力收敛进 `install` / `check`。
- **文档同步**：`base/skills/安装.md` 重写为 ship 用法并消除硬编码路径；cross-vendor 两份 mapping 与 HARNESS-SPEC 标注 `ship.mjs` 为既定实现；CONTEXT.md「单源派生」状态更新为已落地。
- **测试**：`base/scripts/test/ship.test.mjs` 24 用例覆盖 init/install/derive/check/agent 全流程（`--config` + `--user-home` + `--dry-run` seam，零第三方依赖）。

### 待办

- 工单 02/03 修复项已回写并补齐（`x-install: false` 清单、derive 层跳过）；工单 06 文档同步完成。
- 后续 effort 02-js-ification、03-seo-geo-skill-suite 见下方记录。

## jxx-setup-skills 脚本化 2026-08-27

- **脚本自包含迁移**：setup-skills（原名 jxx-setup-matt-pocock-skills）的 `detect`/`sync-doc` 从共享 `base/scripts/scaffold.mjs` 迁入技能目录 `scripts/setup.mjs`（测试迁至 `tests/setup.test.mjs`，种子模板即技能目录三份 `.md`），技能可整体拷贝分发；`scaffold.mjs` 保留 memorial/exercises/precommit 子命令。
- **`detect` 子命令**：步骤 1「探索」脚本化，输出只读 JSON 报告（canonical 选择、五文件存在性、块检测、CODEBUDDY 一致性、目录与既有产物清单），逐项区分「文件存在/不存在」。
- **`sync-doc` 增强**：`## Agent skills` 块 upsert（就地替换/追加、保留周围内容）、`## 多代理要求` 块自动注入、`--layout`/`--labels` 参数化、逐文件执行结果日志（`created`/`updated`/`unchanged`/`skipped`）；CLI 默认启用块 upsert，`--no-block` 退化为纯同步。块内容单源收敛到 `buildAgentSkillsBlock()`。
- **技能 SKILL.md 改写**（v1.1.0）：步骤 1/3/4 全部改为跑脚本，不再由模型手工写文件；步骤 3 简化为 `--dry-run` 演练确认。
- **测试**：`tests/setup.test.mjs` 15/15 通过（块构建/注入/upsert 幂等、actions 日志、detect 三场景、CLI e2e）；`scaffold.test.mjs` 剩余 18/18 通过。

## seo-geo 基础设施 2026-08-26（工单 01：03-seo-geo-skill-suite）

### 重大变更

- **桶改名**：`base/skills/SEO2GEO/`（空桶）→ `base/skills/seo-geo/`，对齐小写桶名风格。
- **`vendors.json`**：`buckets` 增加 `seo-geo`；`managedPrefixes` 增加 `seo-`（残留清理覆盖该族）。
- **`ship` 支持 `x-install: project` 新取值**（ADR 0005）：标记该值的技能在用户级安装（`ship install`）中跳过，仅在项目级安装（`ship install --project`）中出现。原有 `x-install: true / false` 语义不变。
- **行为测试**：`ship.test.mjs` 新增 3 个用例——`x-install: project` 不进用户级、进项目级、`seo-` 前缀残留清理。

### 关联

- ADR 0005（仅项目级分发 + router 兼任安装器）、ADR 0006（skill-as-generator + 版本戳升级）已回写为 `docs/adr/0005`、`docs/adr/0006`。
- 后续工单 02–10 将在 `seo-geo/` 桶下落地 8 个技能（审查模板、写作模板、五件套、seo-router）。

## seo-geo 技能族落地 2026-08-26（工单 02–10：03-seo-geo-skill-suite）

### 新增技能（8 个，均在 `base/skills/seo-geo/` 桶下，`x-install: project`）

- **`seo-audit-template`**（工单 02+03）— SEO/GEO 审查模板（skill-as-generator）：追问收参 → 生成 `seo-geo-audit` 子技能 → 版本戳升级。内置三维审查模型（真实性 + SEO/GEO + 样式一致性）。references 含 geo-super 全量中文化（SKILL.md + 10 references 约 166KB）+ 三个通用 checklist + 五件套 GEO 增量素材清单。
- **`seo-blog-template`**（工单 09）— SEO/GEO 写作模板（skill-as-generator）：追问收参 → 生成 `blog-writer` 子技能 → 版本戳升级。news-x 项目知识抽象为生成参数；`seo-content-writing` 中文产物作为 references；样式模板与审查子技能共用同一基准（写审一致）。
- **`seo-keyword-research`**（工单 04）— 关键词研究中文版（含 GEO 增量：搜索词 + AI 引用问句式）。
- **`seo-competitor-analysis`**（工单 05）— 竞品分析中文版（含 GEO 增量：传统排名 + AI 引擎品牌提及）。
- **`seo-backlink-analysis`**（工单 06）— 外链分析中文版（含 GEO 增量：链接权重 + AI 引用源权威性）。
- **`seo-content-writing`**（工单 07）— 内容写作中文版（含 GEO 增量：SEO + GEO 可引用性双 checklist）。
- **`seo-technical-audit`**（工单 08）— 技术审计中文版（含 GEO 增量：llms.txt/JSON-LD/agent readiness）。
- **`seo-router`**（工单 10）— 族内路由器 + 项目内安装器：中英双语触发词覆盖全域意图，路由到 8 个技能 + 2 个生成子技能；套件缺失时引导安装。

### 中文化素材

- geo-super 全量中文化（SKILL.md 20KB + 10 references 146KB ≈ 166KB），术语保留英文（GEO/llms.txt/E-E-A-T/JSON-LD/MCP 等），ahrefs 2026 实证研究保留为 grounding。
- 五件套 GEO 增量统一指针引用 `seo-audit-template/references/geo-increment-materials.md`（单源派生，同一论据不翻译两次）。

### 质量门禁

- 8 个技能均通过 `skill-reviewer` 7/7 合规检查。
- `evals/evals.json` 触发测试套件已创建（真实触发测试需 opencode CLI，试点时跑）。

### 待办

- 工单 11（试点）：需在 `official-domestic-website` 项目端到端验证，试点指引见 `.scratch/03-seo-geo-skill-suite/issues/11-pilot-guide.md`。

## 同步 2026-08-11（上游 1.0.1 → 1.4.0，`d574778f..84fdeffd`）

### 重大变更

- **`jxx-writing-great-skills` 移除**，由 **`jxx-writing-for-agents`** 取代（`SKILL.md` + `SKILL-MECHANICS.md`）：为 agent 写文档的通用参考——context pointer、两种 load、信息层级、leading word、pruning；技能专用机制（调用方式、路由技能）在 SKILL-MECHANICS.md。

### 新增技能

- **`jxx-wizard`**（engineering）— 生成引导人完成手动多步流程的交互式 bash 向导（含 `template.sh`）。
- **`jxx-wait-what`**（productivity，用户调用）— 让 agent 用简化技术英语重讲刚才的解释。
- **`jxx-to-questionnaire`**（productivity，用户调用）— 将未决决策转化为可交付的问卷文档。

### 技能更新

- **`jxx-diagnosing-bugs`** — 新增"脱敏（Redact）"章节（安全审计修复）：展示命令/输出/产物前必须脱敏，循环基于环境变量构建；`hitl-loop.template.sh` 增加 capture 回显警告。
- **`jxx-grilling`** — 重写为按轮推进的 frontier 访谈：一轮问完当前未解决的极小决策集，编号问题 + 推荐答案；事实查找派后台 agent。
- **`jxx-ask-matt`** — 新增 `PHASE-BOUNDARIES.md` 阶段边界决策树（continue → `/clear` → handoff → 子 agent → `/compact`）；智能区域阈值更新为 ~150k；独立技能列表扩充。
- **`jxx-prototype`** — logic 分支从终端应用改为单文件 HTML 交互 demo（状态面板 + 自由按钮 + 可选场景运行器）；完成后的处置从"删除或吸收"改为"捕获到 `prototype/<name>` 分支"。
- **`jxx-code-review` / `jxx-codebase-design` / `jxx-improve-codebase-architecture`** — 子 agent 派发措辞 harness 中立化（不再绑定特定 harness 的工具名与 agent 类型）。

## 1.0.1

### 补丁变更

- [`d20ee26`](https://github.com/mattpocock/skills/commit/d20ee2684e2a9442698ac3c1e0f2c5b68c4cf296) 感谢 [@mattpocock](https://github.com/mattpocock)！- 让 **`teach`** 技能优先复用。课程现在由 `./assets/` 中可复用的**组件**构建——样式表、测验小部件、模拟器、图表助手。复用是默认行为：agent 在编写课程前先读取 `./assets/`，基于已有内容构建，并将新的可复用部分提取为组件，而非内联编写。

## 1.0.0

### 重大变更

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 新增 **`ask-matt`** 技能——用户调用的路由器，将你引导到适合当前场景的技能或流程。

  **破坏性变更：** `ask-matt` 路由到本仓库中其他用户可调用的技能，因此需要它们已安装。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 新增共享设计技能，并将现有技能重新接入。

  - 新增 **`codebase-design`** 技能——深度模块词汇（模块、接口、深度、接缝、适配器）以及将大量行为放在小接口背后的原则。之前位于 `improve-codebase-architecture/LANGUAGE.md` 的语言现在移到这里，并泛化以供多个技能复用。
  - 新增 **`domain-modeling`** 技能——主动构建和打磨项目的领域模型，用词汇表压力测试术语，并保持 `CONTEXT.md` 和 ADR 更新。
  - `improve-codebase-architecture` 现在从 `/codebase-design` 获取架构词汇，从 `/domain-modeling` 获取领域模型。
  - `tdd` 现在依赖 `/codebase-design` 提供接口设计指导——其内联的 `deep-modules.md` / `interface-design.md` 笔记已移除，改用共享技能。
  - `grill-with-docs` 现在通过 `/domain-modeling` 内联构建领域模型。

  **破坏性变更：** 这些技能现在依赖新的 `codebase-design` / `domain-modeling` 技能，必须一并安装。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 移除 **`caveman`** 和 **`zoom-out`** 技能。

  - `caveman` 是我测试中的另一个技能的重复版本，从未打算公开发布。
  - `zoom-out` 在实践中未被使用，因此已从仓库中移除。

  **破坏性变更：** 两个技能已被移除。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 将 **`diagnose`** 技能重命名为 **`diagnosing-bugs`**。

  **破坏性变更：** 以 `/diagnosing-bugs` 调用——旧的 `/diagnose` 名称不再存在。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 用 **`writing-great-skills`** 替换 **`write-a-skill`**。

  - 移除了 `write-a-skill`。
  - 新增 `writing-great-skills`（及其 `GLOSSARY.md`）——编写和编辑优秀技能的参考：让技能可预测的词汇和原则，将空操作追踪到句子级别。
  - 将 `grilling` 作为模型调用技能公开——`grill-me` 和 `grill-with-docs` 背后的可复用访谈循环。

  **破坏性变更：** `write-a-skill` 已移除；请改用 `writing-great-skills`。

### 次要变更

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 新增 **`resolving-merge-conflicts`** 技能——用于解决进行中的 git 合并或变基冲突的循环。独立运行，不依赖其他技能。

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 将技能分类法从 **命令/技能** 重命名为 **用户调用/模型调用**，并新增 `docs/invocation.md` 定义划分：用户调用技能仅在输入时可达，用于编排；模型调用技能在任务匹配时也可被自动调用。用户调用技能可调用模型调用技能，但绝不能调用另一个用户调用技能。

### 补丁变更

- [`47bde84`](https://github.com/mattpocock/skills/commit/47bde84da032afb2e5058f997f3bbca47d321dbd) 感谢 [@mattpocock](https://github.com/mattpocock)！- 收紧 **`review`** 技能：快速失败引用检查、单一来源规则、空操作裁剪。
