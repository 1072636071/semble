# mattpocock-skills 更新分析报告

- **仓库**：`三方/mattpocock-skills`（独立 git 仓库，分支 `main`）
- **更新范围**：`d574778` → `84fdeff`（fast-forward）
- **最新提交**：`84fdeff` Merge pull request #788 from mattpocock/grill-me-align
- **变动规模**：119 个文件，+2903 / −1502 行
- **报告生成时间**：2026-08-11

---

## 一、本次更新的核心主题

本次更新不是零散修补，而是一次**结构重组 + 插件化改造 + 文档体系重写**。可归纳为四条主线：

1. **从 Skill 集合到 Claude Code 插件**：新增 `.claude-plugin/`（marketplace.json + plugin.json）、ADR 文档、install-block 等，明确向"官方市场插件"形态演进。
2. **文档体系大修**：`docs/` 下 30+ 个工程/生产力文档几乎全部重写（ask-matt、code-review、wayfinder、teach 等），内容显著增厚，结构统一化。
3. **skills 目录重组**：`skills/in-progress/` 的部分技能毕业为 `skills/engineering/`（wizard 等）；`skills/personal/` 整组删除；`skills/deprecated/` 扩充。
4. **模型调用元数据普及**：大量技能新增 `agents/openai.yaml`，并显式标注 `disable-model-invocation: true`（用户触发型技能）。

---

## 二、新增技能（A = Added）

### 工程类（engineering）
| 技能 | 路径 | 用途 |
| --- | --- | --- |
| **wizard** | `skills/engineering/wizard/`（由 in-progress 毕业，R091） | 生成交互式 bash 向导，引导人类完成只有人能做的步骤（配置基础设施、CI 密钥、第三方后台、一次性迁移/切换）。模板化 stage 流程、隐藏密钥输入、幂等 `.env` 写入、`gh secret` 写入。 |

### 生产力类（productivity）
| 技能 | 路径 | 用途 |
| --- | --- | --- |
| **to-questionnaire** | `skills/productivity/to-questionnaire/` | 把"你一个人答不上来的决策"变成一份问卷 Markdown，交给掌握信息的人异步填写或会议中一起填。核心是"grill 发送方而非主题"——只问收件人角色和你需要收回什么。 |
| **wait-what** | `skills/productivity/wait-what/` | 一句话技能：当上一条消息没听懂，立刻让 agent 用更直白的语言（ASD-STE100 简化技术英语）+ 项目统一语言重新陈述。 |
| **writing-for-agents** | `skills/productivity/writing-for-agents/` | 为 agent 写文档的通用规范（skill / AGENTS.md / CLAUDE.md）。提出 context pointer、context load vs cognitive load、information hierarchy、leading words、pruning 等写作杠杆。含 `SKILL-MECHANICS.md` 配套。 |

### in-progress 实验类
| 技能 | 路径 | 用途 |
| --- | --- | --- |
| **setup-ts-deep-modules** | `skills/in-progress/setup-ts-deep-modules/` | 把 dependency-cruiser 接入 TS 仓库，强制每个 package 成为"深模块"（行为藏子目录，只经入口文件访问）。含 `dependency-cruiser.config.cjs` 配置 + 7 步落地流程 + 规则验证。 |

### 顶层 / 配置新增
- `AGENTS.md`（新增）— 仓库级 agent 指令入口
- `.agents/adr/0002-ship-as-a-claude-code-plugin.md` — "作为 Claude Code 插件发布"的架构决策记录
- `.agents/install-block.md` — 安装阻断说明
- `.claude-plugin/marketplace.json` / `plugin.json` — 插件市场元数据
- `scripts/sync-plugin-version.mjs` — 插件版本同步脚本
- `skills/engineering/ask-matt/PHASE-BOUNDARIES.md` — 阶段边界决策树（Continue / /clear / /handoff / Subagent / /compact 五选一）

---

## 三、删除技能（D = Deleted）

### 整组删除
| 组 | 删除内容 |
| --- | --- |
| **skills/personal/** | 整组删除：`README.md`、`edit-article/SKILL.md`、`obsidian-vault/SKILL.md`（个人知识/文章类技能被放弃） |
| **skills/productivity/writing-great-skills/** | `SKILL.md` + `GLOSSARY.md`（201 行术语表）被删除，功能由新增的 `writing-for-agents` 取代 |
| **skills/deprecated/** | 4 个老技能被移入 deprecated 并删除：`design-an-interface`、`qa`、`request-refactor-plan`、`ubiquitous-language`（合计约 385 行） |

**趋势解读**：仓库在"瘦身"——把零散/个人向/已过时的技能清理掉，集中到工程与生产力两条主线，并引入 `writing-for-agents` 作为统一的"如何写技能"方法论替代原先的 `writing-great-skills`。

---

## 四、重命名 / 迁移（R = Renamed）

| 旧路径 | 新路径 | 相似度 |
| --- | --- | --- |
| `skills/in-progress/wizard/SKILL.md` | `skills/engineering/wizard/SKILL.md` | 78% |
| `skills/in-progress/wizard/template.sh` | `skills/engineering/wizard/template.sh` | 91% |

**解读**：`wizard` 从"进行中"毕业为正式"工程"技能，是 in-progress → engineering 通道的首个落地案例，说明该仓库开始建立技能"毕业"机制。

---

## 五、修改量较大的技能（M，按增量排序）

| 技能 | 增量 | 说明 |
| --- | --- | --- |
| `skills/engineering/codebase-design/...` | 91 | 深模块设计词汇增强 |
| `skills/engineering/wayfinder/SKILL.md` | 107（含 SKILL 19 行） | 巨型工作规划技能重写 |
| `skills/engineering/improve-codebase-architecture/SKILL.md` | 104 | 架构深化扫描增强 |
| `skills/engineering/triage/SKILL.md` | 101 | 状态机重写 |
| `skills/engineering/diagnosing-bugs/SKILL.md` | 97 + 新增 openai.yaml + hitl-loop.template.sh | 诊断循环加 HITL 模板 |
| `skills/engineering/setup-matt-pocock-skills/SKILL.md` | 97 | 安装流程重写 |
| `skills/engineering/implement/SKILL.md` | 94 | 实现流程增强 |
| `skills/productivity/teach/SKILL.md` | 106 | 教学技能重写 |

几乎每个工程技能都新增了 `agents/openai.yaml` 元数据文件——这是把"模型可调用"约定显式化的信号。

---

## 六、对本地 JwikisSkills 仓库的启示

1. **插件化范式**：mattpocock 正向"官方市场插件 + 用户可 fork 编辑"双形态演进。本仓库的 `技能市场参考/` 若收录其本地化版本，应同步 `.claude-plugin/` 形态。
2. **技能毕业机制**：in-progress → engineering 的迁移证明"实验态技能"需要明确生命周期，值得在本仓库 `Skills技能库/工具包/码道的/` 的 skill-creator 规范中借鉴。
3. **统一写作方法论**：`writing-for-agents` 取代 `writing-great-skills`，其 context pointer / information hierarchy / leading words 概念与本仓库 AGENTS.md 强调的"name + description 是匹配核心"一致，可吸收进本地化 skill 编写规范。
4. **用户体验型技能补充**：`to-questionnaire`、`wait-what` 是轻量交互类技能，本仓库 `Skills技能库/通用类/` 暂无对应，可考虑引入"决策问卷"与"重新陈述"类技能。

---

## 七、变动清单总表（按类型）

### 新增文件（A，共 47）
- 顶层：AGENTS.md、.claude-plugin/marketplace.json、scripts/sync-plugin-version.mjs
- .agents/：adr/0002-ship-as-a-claude-code-plugin.md、install-block.md
- docs/engineering/：wizard.md
- docs/productivity/：to-questionnaire.md、wait-what.md、writing-for-agents.md
- skills/ 下大量 `agents/openai.yaml`（约 30 个）+ 3 个全新 SKILL.md（to-questionnaire、writing-for-agents、setup-ts-deep-modules）+ PHASE-BOUNDARIES.md

### 删除文件（D，共 9）
- skills/personal/ ×3、skills/productivity/writing-great-skills/ ×2、skills/deprecated/ ×4

### 重命名（R，共 2）
- skills/in-progress/wizard → skills/engineering/wizard（SKILL.md 与 template.sh）

### 修改（M，共 61）
- 全部 docs/ 文档、全部工程技能 SKILL.md、README/CHANGELOG/CLAUDE/CONTEXT、package.json、release.yml 等

> 完整 `--name-status` 输出见本次分析所用的 `git diff --name-status d574778 84fdeff`，可随时复现。
