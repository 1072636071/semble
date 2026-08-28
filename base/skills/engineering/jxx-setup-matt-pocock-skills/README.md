# jxx-setup-matt-pocock-skills

为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局。

## 何时使用

首次使用其他工程技能前运行一次，初始化仓库的工程技能基础设施。

## 执行方式

固定流程（探索仓库状态、输出 `AGENTS.md`/`CODEBUDDY.md`/`docs/agents/*.md` 的**文件内容模板**）由本技能自带的 `scripts/setup.mjs` 脚本确定性完成（自包含、零第三方依赖，种子模板即本目录下的三份 `.md`）：

```bash
node scripts/setup.mjs detect --root <目标仓库根>    # 步骤 1：探索（只读 JSON 报告，可选）
node scripts/setup.mjs template [--layout single|multi] [--labels <json>]  # 步骤 4：输出全部文件内容到 stdout（不落盘）
```

脚本把要生成的 5 份文件内容（`AGENTS.md`/`CODEBUDDY.md`/三份 `docs/agents/*.md`）以 `=== FILE: <路径> ===` 分隔输出到 stdout，供模型展示给用户复制/替换；**模型不落盘、不读取目标仓库文件做确认**。若用户提供布局/标签偏好，用 `--layout`/`--labels` 生成对应定制内容；用户未提供任何配置输入时走**无输入快速通道**，直接用默认参数输出。测试：`node --test tests/setup.test.mjs`。

## 自包含

本技能**完全自包含**，运行所需的全部资源都在技能目录内，可整体拷贝分发，不依赖技能目录外任何路径：

- `scripts/setup.mjs` — 确定性 CLI（仅用 Node 内置模块 `fs`/`path`/`url`，零第三方依赖）。
- `issue-tracker-local.md` / `triage-labels.md` / `domain.md` — 三份种子模板，`template` 子命令据此生成 `docs/agents/*.md`。
- `tests/setup.test.mjs` — 测试（`node --test tests/setup.test.mjs`），使用系统临时目录，不污染技能目录。

技能不引用仓库内其他技能目录或 `base/scripts` 的共享文件。它对目标仓库是只读/纯输出：`detect` 只读扫描，`template` 只把内容打印到 stdout、不落盘。对外部仓库的 `AGENTS.md`/`CODEBUDDY.md`/`docs/agents/*.md` 只是输出目标，不构成技能运行依赖。
