# jxx-setup-skills

为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局，**建立项目技能目录并在 `AGENTS.md` 里维护技能清单**，并检测 OCR（open-code-review CLI）是否可用、未安装时询问用户是否安装。

## 何时使用

- 首次使用其他工程技能前运行一次，初始化仓库的工程技能基础设施。
- **项目技能增删改之后**：重跑 `sync-skills` 刷新 `AGENTS.md` 里的技能清单（不需要重新初始化）。

## 执行方式

固定流程（探索仓库状态 + 写入 `AGENTS.md`/`CODEBUDDY.md`/`docs/agents/*.md` + 建技能目录）由本技能自带的 `scripts/setup.mjs` 脚本确定性完成（自包含、零第三方依赖，种子模板即本目录下的三份 `.md`）。

**一键初始化（默认）**：运行 `init` 即可把全部配置直接写入目标仓库，读取已有文件并自行处理（已有 `CLAUDE.md`/`AGENTS.md` 则在其上 upsert 工程块并同步 `CODEBUDDY.md`；没有则默认创建；三份 `docs/agents/*.md` 仅克隆缺失的），无需用户手动复制：

```bash
node scripts/setup.mjs init --root <目标仓库>     # 一键初始化（默认子命令）
node scripts/setup.mjs detect --root <目标仓库>   # 只读探索（JSON 报告，含与种子的漂移、技能清单状态）
node scripts/setup.mjs sync-doc --root <目标仓库> # 仅写入（跳过扫描汇报）
node scripts/setup.mjs sync-skills --root <目标仓库>  # 维护项目技能清单（技能增删改后跑）
node scripts/setup.mjs template [--layout single|multi] [--labels <json>]  # 输出文件内容到 stdout（不落盘，仅供预览）
node scripts/setup.mjs ocr                                                 # 只读检测 OCR 是否安装（未安装退出码 4）
```

- `--layout single|multi` 领域文档布局（默认 `single`）；`--labels '{"needs-triage":"bug:triage"}'` triage 标签覆盖。
- `--skills-dir <相对路径>` 项目技能目录（默认 `docs/agents/skills`）；`--no-skills` = 不建目录、不写清单小节。
- 未传任何偏好即"全部默认"；模型直接把配置写入目标仓库，不再向用户逐一询问/确认。
- 未传子命令时默认执行 `init`。
- 测试：`node --test tests/setup.test.mjs`。

## 项目技能目录与清单

`init` 会建 `docs/agents/skills/<name>/SKILL.md` 布局 + `README.md`（约定 + 当前技能表 + 同步命令），并在 `AGENTS.md` 的 `## Agent skills` 块里写一节**受管**清单：

```
### 项目技能（`docs/agents/skills/`）
…约定与「改完必须重跑 sync-skills」的说明…
<!-- jxx-setup-skills:skills:start -->
| 技能 | 何时加载 |
| --- | --- |
| `commands` | 本项目命令与环境参考——dev/build/lint |
<!-- jxx-setup-skills:skills:end -->
```

- 清单由**扫描目录**生成（技能名取 frontmatter `name`，「何时加载」取 `description` 首个句读前的子句），不依赖模型措辞，因此幂等。
- `sync-skills` 只重写**标记之间**的表格与 `README.md` 的生成部分；标记之外（含 `<!-- jxx-setup-skills:hand-written -->` 之后的手写补充）逐字不动，也**不需要 `--force`**。
- 仓库若已有**手写**技能清单，脚本**不插第二份**，而是报冲突交模型合并；把既有清单用一对 `skills:start` / `skills:end` 标记包起来即被接管。

## 冲突保护（不静默覆盖）

已存在且内容不同的文件**默认一律保留**，动作记为 `conflict`，退出码 `3`；只创建缺失的文件、只追加缺失的工程块。模型读取冲突文件后再决定：保留现状 / 手工合并 / 精确覆盖。

```bash
node scripts/setup.mjs init --root <目标仓库> --overwrite docs/agents/domain.md   # 只覆盖这一个（可重复指定）
node scripts/setup.mjs init --root <目标仓库> --force                             # 覆盖全部冲突（仅当用户明确要求重置）
```

**受管例外**：受管标记之间的技能表与技能目录 `README.md` 的生成部分是脚本按目录扫描结果生成的，刷新它们不算覆盖定制内容，因此直接落盘（见上一节）。

退出码：`0` 完成无冲突；`3` 有冲突已保留（待模型处置）；`2` 一致性 MISMATCH；`1` 参数/运行错误；`4` OCR 未安装。

## OCR 检测（代码审查工具）

OCR 是 `jxx-code-review` 委托模式的依赖：装上启用 **3 维度**审查（标准 + spec + 规则），没装降级为 **2 维度**。

```bash
node scripts/setup.mjs ocr      # {"installed":true,"path":"...","version":"open-code-review v1.12.4 ..."}
```

- `installed: true` → 说明可用；委托模式下**无需配置 LLM**。
- `installed: false`（退出码 4）→ **询问用户**是否安装，不要擅自安装。安装步骤见 `SKILL.md`「步骤 6」（npm / Homebrew / MacPorts / 安装脚本 / GitHub Release 二进制）。

## 自包含

本技能**完全自包含**，运行所需的全部资源都在技能目录内，可整体拷贝分发，不依赖技能目录外任何路径：

- `scripts/setup.mjs` — 确定性 CLI（仅用 Node 内置模块 `fs`/`path`/`url`/`child_process`，零第三方依赖）。
- `issue-tracker-local.md` / `triage-labels.md` / `domain.md` — 三份种子模板，`init`/`sync-doc` 据此生成 `docs/agents/*.md`。
- `tests/setup.test.mjs` — 测试（`node --test tests/setup.test.mjs`，51 例），使用系统临时目录，不污染技能目录。

技能不引用仓库内其他技能目录或 `base/scripts` 的共享文件。它把配置写入目标仓库的 `AGENTS.md`/`CODEBUDDY.md`/`docs/agents/*.md`，这些只是输出目标，不构成技能运行依赖。
