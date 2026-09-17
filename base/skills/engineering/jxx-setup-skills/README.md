# jxx-setup-skills

为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局，并检测 OCR（open-code-review CLI）是否可用、未安装时询问用户是否安装。

## 何时使用

首次使用其他工程技能前运行一次，初始化仓库的工程技能基础设施。

## 执行方式

固定流程（探索仓库状态 + 写入 `AGENTS.md`/`CODEBUDDY.md`/`docs/agents/*.md`）由本技能自带的 `scripts/setup.mjs` 脚本确定性完成（自包含、零第三方依赖，种子模板即本目录下的三份 `.md`）。

**一键初始化（默认）**：运行 `init` 即可把全部配置直接写入目标仓库，读取已有文件并自行处理（已有 `CLAUDE.md`/`AGENTS.md` 则在其上 upsert 工程块并同步 `CODEBUDDY.md`；没有则默认创建；三份 `docs/agents/*.md` 仅克隆缺失的），无需用户手动复制：

```bash
node scripts/setup.mjs init --root <目标仓库>    # 一键初始化（默认子命令）
node scripts/setup.mjs detect --root <目标仓库>  # 只读探索（JSON 报告，含与种子的漂移）
node scripts/setup.mjs sync-doc --root <目标仓库> # 仅写入（跳过扫描汇报）
node scripts/setup.mjs template [--layout single|multi] [--labels <json>]  # 输出文件内容到 stdout（不落盘，仅供预览）
node scripts/setup.mjs ocr                                                 # 只读检测 OCR 是否安装（未安装退出码 4）
```

- `--layout single|multi` 领域文档布局（默认 `single`）；`--labels '{"needs-triage":"bug:triage"}'` triage 标签覆盖。
- 未传任何偏好即"全部默认"；模型直接把配置写入目标仓库，不再向用户逐一询问/确认。
- 未传子命令时默认执行 `init`。
- 测试：`node --test tests/setup.test.mjs`。

## 冲突保护（不静默覆盖）

已存在且内容不同的文件**默认一律保留**，动作记为 `conflict`，退出码 `3`；只创建缺失的文件、只追加缺失的工程块。模型读取冲突文件后再决定：保留现状 / 手工合并 / 精确覆盖。

```bash
node scripts/setup.mjs init --root <目标仓库> --overwrite docs/agents/domain.md   # 只覆盖这一个（可重复指定）
node scripts/setup.mjs init --root <目标仓库> --force                             # 覆盖全部冲突（仅当用户明确要求重置）
```

退出码：`0` 完成无冲突；`3` 有冲突已保留（待模型处置）；`2` 一致性 MISMATCH；`1` 参数/运行错误；`4` OCR 未安装。

## OCR 检测（代码审查工具）

OCR 是 `jxx-code-review` 委托模式的依赖：装上启用 **3 维度**审查（标准 + spec + 规则），没装降级为 **2 维度**。

```bash
node scripts/setup.mjs ocr      # {"installed":true,"path":"...","version":"open-code-review v1.12.4 ..."}
```

- `installed: true` → 说明可用；委托模式下**无需配置 LLM**。
- `installed: false`（退出码 4）→ **询问用户**是否安装，不要擅自安装。安装步骤见 `SKILL.md`「步骤 4」（npm / Homebrew / MacPorts / 安装脚本 / GitHub Release 二进制）。

## 自包含

本技能**完全自包含**，运行所需的全部资源都在技能目录内，可整体拷贝分发，不依赖技能目录外任何路径：

- `scripts/setup.mjs` — 确定性 CLI（仅用 Node 内置模块 `fs`/`path`/`url`/`child_process`，零第三方依赖）。
- `issue-tracker-local.md` / `triage-labels.md` / `domain.md` — 三份种子模板，`init`/`sync-doc` 据此生成 `docs/agents/*.md`。
- `tests/setup.test.mjs` — 测试（`node --test tests/setup.test.mjs`），使用系统临时目录，不污染技能目录。

技能不引用仓库内其他技能目录或 `base/scripts` 的共享文件。它把配置写入目标仓库的 `AGENTS.md`/`CODEBUDDY.md`/`docs/agents/*.md`，这些只是输出目标，不构成技能运行依赖。
