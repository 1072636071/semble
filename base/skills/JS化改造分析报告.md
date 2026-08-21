# base/skills 技能 JS 化改造分析报告

> 生成时间：2026-08-17
> 分析范围：`E:\work\sp\JwikisSkills\base\skills\`（engineering / productivity / in-progress / misc / personal 全部技能 + 根目录 install.ps1 / verify.ps1）
> 目标：找出「固化流程」与「现存脚本」，评估如何用 JS（.mjs）写脚本、减少 AI 在对话中即兴执行机械步骤的摩擦。
> 方法：四路并行分析（impeccable / engineering-jxx / productivity / 其余），本次仅只读分析，未修改任何文件。

---

## 一、全局结论

1. **「创造与判读」和「机械与确定性」是两条截然不同的线。** 脚本化只对后者有效。固话判断：凡是「输入确定 → 输出确定（文件/文本/校验结果）」的步骤都应 JS 化；凡是「靠模型语义创意/评审/文案」的步骤不应脚本化，脚本化反而劣化。
2. **现存脚本语言分布**：impeccable 已高度 .mjs 化（70+ 文件，架构成熟）；其余技能里现存的少量脚本是 **Python**（skill-creator 的 3 个 + skill-tester 的 run_eval.py）和 **bash**（wizard 的 template.sh、diagnosing-bugs 的 hitl-loop.template.sh）以及 **PowerShell**（根目录 install/verify）；**大量技能零脚本**，纯靠模型即兴。
3. **最值得 JS 化的是一批「脚手架 / 编号分配 / 模板实例化 / 格式校验 / 报告渲染」的确定性动作**，以及**现有 Python/bash/PowerShell 脚本的跨平台 Node 重写**。
4. **共享工具层**：多个技能重复出现「安全追加 md」「递增编号分配」「模板实例化」「跨平台打开/落盘临时目录」——应提炼为共享 .mjs 工具，避免各技能各写一套。

---

## 二、现存脚本总表（JS 化对象的直接来源）

| 脚本 | 技能 | 语言 | 作用 | JS 化优先级 |
|---|---|---|---|---|
| `scripts/init_skill.py` | skill-creator | py | 技能脚手架生成 | 高 |
| `scripts/quick_validate.py` | skill-creator | py | frontmatter/命名/结构校验（依赖 yaml） | 高 |
| `scripts/package_skill.py` | skill-creator | py | 打包 `.skill`（zip） | 高 |
| `scripts/run_eval.py` | skill-tester | py | 并行走 eval、LLM-judge、汇总报告 | 高 |
| `scripts/template.sh` | jxx-wizard | bash | 向导运行库 + 示例 STAGES | 中（改为 JS 生成器）|
| `scripts/hitl-loop.template.sh` | jxx-diagnosing-bugs | bash | 人在回路复现循环辅助 | 中低 |
| `install.ps1` / `verify.ps1` | 根目录 | ps1 | 跨平台技能安装 / SHA256 校验 | 高（且能消除硬编码）|

---

## 三、JS 化优先级清单

### 🟢 高优先级（强烈建议 JS 化）

**B. skill 生命周期脚本（三件套，需连同 pytest 与 SKILL.md 命令一并迁移）**
- `skill-creator`：`init_skill.py→init-skill.mjs`（脚手架）、`quick_validate.py→validate-skill.mjs`（需引入 `yaml` npm 依赖或 `front-matter` 包）、`package_skill.py→package-skill.mjs`（zip，Node 内置 zlib/fs 可做简单 zip，或引入 `archiver`）、补交互菜单 `confirm-skill.mjs`（`@clack/prompts`）。
- `skill-tester`：`run_eval.py→run-eval.mjs`（读 evals.json、子进程并发 Promise.all、LLM-judge、汇总），补 `confirm-eval.mjs`。
- `skill-reviewer`：把 `references/skill-coding-rules.md` **形式化**为结构化规则（JSON），做 `review-skill.mjs` 机械扫描出问题清单；再让模型读取清单按模板出报告。

**C. 脚手架类（文件写密集、确定性最高）**
- `jxx-setup-matt-pocock-skills`：AGENTS.md 与 CODEBUDDY.md 逐字节一致同步 + 三份 `docs/agents/*.md` 模板实例化 + 文件选择互斥规则。
- `jxx-grill-with-memorial`：NNN 递增编号、slug、目录脚手架、context.md 模板、C1–C5 checklist、归档移动（`memorial.mjs new|resume|archive|checklist`）。
- `jxx-with-scaffold-exercises`（misc）：计划 → 目录/readme 树递归创建（`scaffold-exercises.mjs <plan> --dry-run`）。
- `jxx-setup-pre-commit`（misc）：读 lock 判断包管理器 → 写 `.husky/pre-commit`、`.lintstagedrc`、`.prettierrc` + 校验。

**D. 编号/模板/报告类**
- `jxx-to-spec` / `jxx-to-tickets`：NN 编号分配、slug、阻塞边 `Blocked by:` 文本行、依赖排序、`.scratch/<NN>-<slug>/...` 脚手架（`ticket.mjs init|next-id|dependency-order`）。
- `jxx-improve-codebase-architecture`：把候选者结构化数组 → 渲染自包含 HTML 报告（Tailwind+Mermaid 骨架、卡片、徽章、临时目录+时间戳+跨平台打开）。
- `jxx-agent-generator`：frontmatter 字段组装、命名正则校验、落盘 `~/.codebuddy/agents/`、改名新旧文件处理。
- `jxx-research`（严格模式）：`{前缀}-{slug}-{版本}` 文件名分配、`docs/report/` 脚手架、模板骨架实例化（冲突加 `-2` 不覆盖）。

- `impeccable/document`（F6，最大空白）：CSS vars / Tailwind config / theme 文件 → 自动提取 tokens 生成结构化 JSON 草稿，模型只做语义命名与 prose。

**E. 根目录安装/校验**
- `install.ps1` / `verify.ps1`：Node 重写 → `install.mjs` + `verify.mjs`，纯 fs 递归复制 + crypto hash 比对 + 清理，把源/目标/清单外置为 `skills.config.json` 消除硬编码路径，天然跨平台。

### 🟡 中优先级

- `jxx-migrate-to-shoehorn`（misc）：两种 `as` 断言 → `fromPartial/fromAny` 正则改写 + 自动补 import + 类型检查（`migrate-to-shoehorn.mjs <dir>`）。
- `jxx-wizard`：用 JS 生成器（结构化 stage 输入 → 渲染成品向导脚本），消除手工 shell 语法错误与 TOTAL_STAGES 同步问题。
- `jxx-teach`：工作区脚手架 + 递增编号 + 跨平台打开（`teach-init.mjs` / `teach-next-id.mjs` / `teach-open.mjs`）。
- `jxx-obsidian-vault`（personal）：仅「创建笔记」部分——标题大小写/层级编号规范化 + 底部 `[[wikilinks]]` + 落盘；搜索仍用 Grep/Glob。
- `jxx-code-review`：git diff/log 采集 + 时间戳落盘到 `/.temp/` + 异味基线渲染进子 agent 提示。
- `jxx-domain-modeling` / `jxx-grill-with-docs`：ADR/CONTEXT 格式 + 递增编号 + 三条件 checklist 向导。
- `jxx-diagnosing-bugs`：唯一 `[DEBUG-xxxx]` 标签生成 + 清理 grep 残留。
- `jxx-handoff`：跨平台写临时目录并打开（内容仍由模型写）。
- `jxx-triage` / `jxx-wayfinder`：免责声明注入、needs-info 固定双段模板、状态机合法转换校验、索引行追加。

### 🟠 低价值（不建议脚本化，收益≈成本）

- 纯路由器：`jxx-ask-matt`、`jxx-grill-me`。
- 纯语义/创意：`jxx-codebase-design`、`jxx-loop-me`、`jxx-tdd`、`jxx-resolving-merge-conflicts`、`jxx-prototype`、`jxx-implement`、`jxx-edit-article`（personal）、`jxx-wait-what`。
- 写作三件套（in-progress `jxx-writing-beats / fragments / shape`）：核心是创意交互；仅「安全追加单块 md」可提炼为共享工具 `append-fragment.mjs`（`\n---\n` 分隔、首行 H1、不覆盖）。
- `jxx-claude-handoff`（in-progress）：摘要内容不可脚本化，命令调用本身已简单。

---

## 四、共享工具层建议（避免各技能重复造轮子）

抽取一组跨技能复用的 `.mjs`：

1. `append-fragment.mjs` — 安全追加一块文本到 md（分隔符/不覆盖）→ 服务 mjs 写作三件套、jxx-teach、jxx-research。
2. `next-seq.mjs` — 目录扫描取最大递增编号 + slug 化 → 服务 jxx-to-spec/tickets、jxx-grill-with-memorial、jxx-research、jxx-teach、impeccable。
3. `render-template.mjs` — 模板实例化（读模板 + 注入变量 + 落盘，冲突加序号不覆盖）→ 服务 agent-generator、setup-matt-pocock、domain-modeling、design-system、grill-with-docs。
4. `report-html.mjs` — 结构化数据 → 自包含 HTML（Tailwind+Mermaid 骨架）+ 临时目录 + 时间戳 + 跨平台打开 → 服务 improve-codebase-architecture。
5. `fs-utils.mjs` / `open-in-browser.mjs` — 递归复制/校验哈希/配置驱动、跨平台打开文件。

> 统一依赖策略：除 skill-creator 的 validate（YAML 解析）与 skill-tester 的交互菜单外，其余均只用 Node 内置模块，保证 `node xxx.mjs` 零装包即用。

---

## 五、落地建议

1. 新建 `base/scripts/`（或 `base/skills/scripts/`）放置所有共享 `.mjs`，各技能的 `scripts/*.mjs` 引用之。
2. 迁移顺序建议：**先共享工具层 + 根目录 install/verify**（成本低、即见效、即可用于迁移其他），再 **skill 三件套（creator/reviewer/tester，绑定处理 pytest/SKILL.md 命令引用）**，再 **`.goals/` 流水线**，再脚手架类，最后编号/报告类。
3. 每个被迁移技能需同步：更新 SKILL.md 中 `python/ps1/bash` 调用 → `node xxx.mjs`；同步 `tests/` 或用 Node test runner 重写断言。
4. 用 `skills.config.json` 配置驱动 install/verify，路径不再硬编码。

---

## 六、一句话总结

**确定性扫描/脚手架/编号/模板/校验/报告渲染 → 全部 JS 化；创意与评审 → 保持模型+子代理。** 当前最大的 JS 化赢面是：skill 三件套与 run_eval 的 Python→Node、根目录 install/verify 的 PS→Node、`.goals/` 流水线、`.scratch/` 编号流水线，以及 impeccable 最大的空白——DESIGN.md token 提取与 audit 计分。
