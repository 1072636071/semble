# Changelog

## 1.1.0 — 2026-08-27

### Changed

- 固定流程脚本化：步骤 1「探索」改为运行 `scripts/setup.mjs detect`（只读 JSON 报告，逐项区分文件存在/不存在）；步骤 4「写入」改为运行 `scripts/setup.mjs sync-doc`，不再由模型手工创建/编辑文件。
- **自包含**：脚本与测试从共享的 `base/scripts/scaffold.mjs` 迁入本技能目录（`scripts/setup.mjs` + `tests/setup.test.mjs`），种子模板即本目录三份 `.md`，技能可整体拷贝分发，不依赖仓库内其他路径。
- `sync-doc` 新增：`## Agent skills` 块 upsert（就地替换/追加，保留周围内容）、`## 多代理要求` 块自动注入、`--layout`（single|multi）与 `--labels`（triage 标签覆盖）参数、逐文件执行结果日志（`created`/`updated`/`unchanged`/`skipped`）；CLI 默认启用块 upsert，`--no-block` 退化为纯同步。
- 步骤 3 简化为 `--dry-run` 演练确认。
- 块内容的确定性定义单源收敛到 `scripts/setup.mjs`（`buildAgentSkillsBlock`），SKILL.md 不再内嵌块模板。

## 1.2.0 — 2026-08-28

### Changed

- **核心原则转向"默认落盘一键初始化"**：新增 `init` 子命令（未传子命令时的默认入口），一步完成 `detect`（只读扫描现状）+ `sync-doc`（写入）。用户说"全部默认"或未提供任何偏好时，模型直接运行 `init --root <目标仓库>` 把全部配置写入目标仓库，**不再输出模板要求用户手动复制，也不需要用户确认**。
- **读取已有文件自行处理**：`init`/`sync-doc` 读取目标仓库已有 `CLAUDE.md`/`AGENTS.md`，以其为通用规范源做「## Agent skills」块 upsert（就地替换/追加，保留自定义内容）并注入「## 多代理要求」块，再逐字节同步 `CODEBUDDY.md`；都不存在则默认创建两者。三份 `docs/agents/*.md` 始终从种子克隆。操作幂等。
- 脚本打印每份文件动作（`created`/`updated`/`unchanged`），`init` 结束输出「初始化完成」，供模型据实汇报。
- `template` 子命令与 `buildTemplateOutput` 保留，作为**可选的预览手段**（输出内容到 stdout、不落盘），不再作为默认交付方式。
- `sync-doc` 保留，用于仅写入、跳过扫描汇报的场合；`--dry-run` 用于演练不落盘。
- SKILL.md/README.md 相应更新为"一键落盘"哲学，移除"模型不落盘、需用户复制"的旧原则。
- 明确**自包含**：技能运行所需全部资源（脚本、三份种子模板、测试）都在技能目录内，仅用 Node 内置模块，不依赖技能目录外任何路径或共享文件。
- 在初始化写入的 `## Agent skills` 块中新增 `### 临时文件` 子块：临时脚本统一放 `.temp/scripts/`，其他临时文件（脚本输出、日志等）分类放到 `.temp/` 子目录，保证根目录干净。

## Unreleased

- 新增 `template` 子命令与 `buildTemplateOutput`：把要生成的 `AGENTS.md`/`CODEBUDDY.md`/三份 `docs/agents/*.md` 内容输出到 stdout（`=== FILE: <路径> ===` 分隔），不落盘；支持 `--layout`/`--labels` 定制。

## 1.0.0 — 2026-07-06

初始版本。
