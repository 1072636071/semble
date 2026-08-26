# mattpocock-skills

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
