# base/skills 脚本 JS 化改造（程序总纲｜按专题拆分）

Status: ready-for-agent

## 问题陈述

`base/skills/` 下 40+ 个技能的"机械/确定性"步骤目前分散在多种语言与"无脚本全靠 AI 即兴"两种状态里：确定性任务（脚手架、编号分配、模板实例化、格式校验、报告渲染、文件同步）若靠模型在对话中即兴执行，易出错、不可复现、跨轮漂移；现存脚本语言混杂——Python（skill-creator 的 `init_skill.py`/`quick_validate.py`/`package_skill.py`、skill-tester 的 `run_eval.py`）、bash（jxx-wizard 的 `template.sh`、jxx-diagnosing-bugs 的 `hitl-loop.template.sh`）、PowerShell（根目录 `install.ps1`/`verify.ps1`，且硬编码本机绝对路径），零统一、零共享、零跨平台。维护者每新增或改一个固化流程，都要在对话里重写一遍模型即兴步骤，摩擦大。

仓库已确立的路径是 Node：`base/scripts/ship.mjs`（ADR 0001/0003）与 `node:test` 零依赖测试范式（`base/scripts/test/ship.test.mjs`）。本程序把这一约定推广到全部技能的确定性流程。

## 解决方案

以 Node（`.mjs`）为唯一脚本语言，建立 `base/scripts/shared/` 共享工具层（纯函数库）与 `base/scripts/` 下各专题 CLI，把每个技能的"确定性流程"从"模型对话即兴"收敛为"调用脚本"；把现存 Python/bash/PowerShell 脚本跨平台重写为 `.mjs`；根目录 `install.ps1`/`verify.ps1` 的能力收敛进 `ship.mjs` 既有 `install`/`check` 子命令（对齐 ADR 0001/0003 单一入口），PS 脚本退役。程序按专题拆分为多份 PRD（见下"超出范围"中的专题清单），本 PRD 定义总纲——共享工具层、统一 seam、依赖策略、专题划分与优先序。

## 用户故事

**程序层（本 PRD 覆盖）**

1. 作为技能维护者，我想要全部技能的确定性流程统一由 `.mjs` 脚本执行，以便不再在对话中手工即兴执行机械步骤。
2. 作为技能维护者，我想要一个共享工具层（`base/scripts/shared/*.mjs`，纯函数库）可被任意技能引用，以便各专题不各写一套重复工具。
3. 作为技能维护者，我想要每个专题 CLI 用 `node:test` + 临时 fixture 注入可测，以便保持仓库零第三方依赖的既有约定（对齐 ADR 0001 与 ship.test.mjs 范式）。
4. 作为技能维护者，我想要现存 Python/bash/PowerShell 脚本被等效重写为 `.mjs`，以便跨平台、无解释器依赖、命令入口统一为 `node xxx.mjs`。
5. 作为技能维护者，我想要根目录 `install.ps1`/`verify.ps1` 的能力（递归安装 + SHA256 校验 + 残留清理）收敛进 `ship.mjs` 既有 `install`/`check` 子命令并补齐 `--user-home`/`--dry-run`，以便消除硬编码路径、可跨平台，且不产生与 ADR 0001/0003 冲突的平行入口。
6. 作为技能维护者，我想要被迁移的技能同步更新其 SKILL.md 中的命令引用（`python/ps1/bash` → `node xxx.mjs`）与任何 pytest，以便文档与脚本一致。
7. 作为技能维护者，我想要拆分多个专题 PRD（每专题一个 `.scratch/NN-*/PRD.md`），以便实施可按专题独立推进、独立审阅与验收。
8. 作为技能维护者，我想要 `jxx-setup-matt-pocock-skills` 初始化时写入"临时文件"约定（临时脚本统一 `.temp/scripts/`，其他临时文件分类入 `.temp/` 子目录），以便各技能产出的临时文件不污染仓库根目录（本条已随共享工具层批次先行落地）。

## 实现决策

- **唯一脚本语言**：Node `.mjs`，UTF-8 显式处理，符合仓库 `HARNESS-SPEC` §9 既有口径。
- **共享工具层**：新建 `base/scripts/shared/` 下跨技能复用的纯函数库 `.mjs`——`append-fragment.mjs`（安全追加 md，分隔符/不覆盖）、`next-seq.mjs`（目录扫描递增编号 + slug）、`render-template.mjs`（模板实例化 + 冲突加序号不覆盖）、`report-html.mjs`（结构化数据 → 自包含 HTML + 临时目录 + 时间戳 + 跨平台打开）、`fs-utils.mjs` / `open-in-browser.mjs`（递归复制/哈希校验/配置驱动、跨平台打开）。共享工具被各专题 CLI import，只留各专题的特有编排逻辑。
- **依赖策略**：除 skill 生命周期专题的 frontmatter/YAML 解析（引入 `front-matter` 包）与交互式确认菜单外，其余均只用 Node 内建模块，保证 `node xxx.mjs` 零装包即用。
- **CLI 形态**：本条款约束各**专题 CLI 脚本**——以参数/子命令暴露（与 `ship.mjs` 的 `init|derive|install|check` 同调试操作风格），支持 `--dry-run` 类不落盘预演。共享工具层（`base/scripts/shared/`）为纯函数库，由专题 CLI import，不自带 CLI 表面与 `--dry-run`（预演由调用方 CLI 实现）。
- **专题划分与优先序**（详见"超出范围"中各自 PRD）：① 根目录 install/verify；② skill 生命周期三件套（creator/reviewer/tester + run_eval）；③ `.goals/` 流水线（goal-contract/execute/plan-review）；④ 脚手架类（setup-matt-pocock / grill-with-memorial / scaffold-exercises / setup-pre-commit）；⑤ 编号/报告类（to-spec/to-tickets / agent-generator / research 严谨模式 / improve-codebase-architecture / design-system / impeccable 的 document token 提取与 audit 计分）。
- **迁移范围边界**：仅"确定性/可机械化"流程脚本化；创造与判读（评审、文案、方向推导、TDD 语义、编辑加工）保持模型与子代理，不强行脚本化（详见各专题 PRD 的"超出范围"）。

## 测试决策

- **统一 seam（已确认）**：每个专题 CLI 暴露为 CLI 子命令，通过"临时目录/临时输入文件注入 + 断言输出（文件树/文件内容/退出码）"测试；共享工具层直接对纯函数做单元断言。不额外暴露库接口，不测内部调用。
- **测试框架**：Node 内建 `node:test` + `node:assert/strict`，零第三方依赖（除 skill 生命周期 YAML 相关封装件做纯函数测试）。先例：`base/scripts/test/ship.test.mjs`。
- **覆盖场景**：共享工具各命令的边界（追加不覆盖、递增编号冲突、模板冲突加序号、HTML 落盘+打开）；install/verify 的配置驱动与哈希比对；各专题脚本在 fixture 上的确定性产物断言。
- **行为测外部、不测实现**：断言输出产物，不断言内部函数调用。

## TDD 强制约定

本程序下**每一个脚本/CLI 都必有测试用例**，采用测试驱动开发（`/jxx-tdd`）：

- **先红后绿**：每个切片先写失败测试，再只写刚好可通过的最小实现；随后按 `/jxx-code-review` 进入重构/审查阶段（重构不属于红→绿循环）。
- **垂直切片，非水平切片**：不许"先批量写完所有测试、再批量实现"（水平切片反模式）。每轮一个 seam、一个测试、一段最小实现。
- **每个脚本一张测试**：落地时每个 `.mjs` 脚本都有对应 `*.test.mjs`（置于 `base/scripts/test/` or 与脚本同目录的 `__tests__`），且验证可 `node --test` 一键运行。
- **同义反复禁止**：期望值必须来自独立权威来源（已知正确字面量、手工验证的演算示例、spec），不得用与实现相同的方式重算。
- **实现耦合禁止**：测试透过公共接口（CLI/纯函数）验证行为，不 mock 内部协作者、不测私有实现。
- **验收即测试通过**：任何工单/脚本标记完成前，其测试必须先行存在并通过——测试是验收标准的一部分，缺测试即未完成。

## 超出范围

本 PRD 为总纲，落地分别发文，各专题独立 PRD/目录（编号按创建先后递增）：

- **03-`install-verify-node`**：根目录 `install.ps1`/`verify.ps1` 的能力收敛进 `ship.mjs` 既有 `install`/`check` 子命令（配置驱动、消除硬编码路径、补 `--user-home`/`--dry-run`），PS 脚本退役——不新建与 ADR 0001/0003 单一入口决策冲突的平行 `install.mjs`/`verify.mjs`。
- **04-`skill-lifecycle-node`**：skill-creator 三脚本 + skill-tester `run_eval.py` + skill-reviewer（规则形式化）→ `.mjs`；同步其 `tests/`（pytest→node）与 SKILL.md 命令引用。
- **05-`goals-pipeline`**：goal-contract（V1–V10 否决门）+ goal-execute（PROGRESS/EVIDENCE）+ plan-review（REVIEW/判定映射）的 `.goals/` 文件流水线。
- **06-`scaffold-skills`**：setup-matt-pocock（AGENTS↔CODEBUDDY 一致性 + "临时文件"约定，后者已先行落地）、grill-with-memorial（NNN/脚手架/归档）、scaffold-exercises（目录树）、setup-pre-commit（lock 驱动）。
- **07-`seq-report-skills`**：to-spec/to-tickets（`.scratch/` 编号流水线）、agent-generator（frontmatter/落盘）、research 严谨模式（文件名/版本冲突）、improve-codebase-architecture（HTML 报告）、design-system（模板实例化）、impeccable document token 提取与 audit 计分。
- **中/低优先级专题**（各批并入上述或另文，详见 `base/skills/JS化改造分析报告.md`）：jxx-migrate-to-shoehorn、jxx-wizard 生成器、jxx-teach、jxx-obsidian-vault「建笔记」、写作三件套的共享 `append-fragment.mjs` 等。
- **不脚本化**（保持模型/子代理）：纯路由器技能（ask-matt / goal-mode / grill-me）与纯语义创意技能（tdd / prototype / resolve-merge / edit-article / 写作三件套主体等）及 impeccable 的评审/方向推导/文案环节。

## 补充说明

- 本 PRD 对齐 ADR 0001（配置驱动、`ship.mjs` 单一入口）与 0003（CLI 表面与 agent 范围）；领域词汇见根 `CONTEXT.md`（桶、运算符、安装级别等），本程序复用其"配置驱动、零硬编码、Node 单一语言"精神，但聚焦技能内部脚本而不是厂商分发。
- 每个专题 PRD 需明确：目标脚本清单、输入/输出、优先级、需要同步的 SKILL.md 命令引用与测试、验收门。
- 共享工具层先落地（收益高、各专题可复用），再推进各专题；共享工具位于 `base/scripts/shared/`，其测试与各专题 CLI 测试并入现有 `base/scripts/test/` 一套 `node --test`（每脚本一张 `*.test.mjs`）。
- 命令以 `base/scripts/` 为注册中心（专题 CLI 落于此，共享纯函数库位于其 `shared/` 子目录）；各技能 SKILL.md 中调用路径统一指向共享工具与其专题 CLI，不再就地复制脚本。
