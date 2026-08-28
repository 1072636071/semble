# Changelog

## 1.1.0 — 2026-08-27

### Changed

- 固定流程脚本化：步骤 1「探索」改为运行 `scripts/setup.mjs detect`（只读 JSON 报告，逐项区分文件存在/不存在）；步骤 4「写入」改为运行 `scripts/setup.mjs sync-doc`，不再由模型手工创建/编辑文件。
- **自包含**：脚本与测试从共享的 `base/scripts/scaffold.mjs` 迁入本技能目录（`scripts/setup.mjs` + `tests/setup.test.mjs`），种子模板即本目录三份 `.md`，技能可整体拷贝分发，不依赖仓库内其他路径。
- `sync-doc` 新增：`## Agent skills` 块 upsert（就地替换/追加，保留周围内容）、`## 多代理要求` 块自动注入、`--layout`（single|multi）与 `--labels`（triage 标签覆盖）参数、逐文件执行结果日志（`created`/`updated`/`unchanged`/`skipped`）；CLI 默认启用块 upsert，`--no-block` 退化为纯同步。
- 步骤 3 简化为 `--dry-run` 演练确认。
- 块内容的确定性定义单源收敛到 `scripts/setup.mjs`（`buildAgentSkillsBlock`），SKILL.md 不再内嵌块模板。

## Unreleased

- 新增 `template` 子命令与 `buildTemplateOutput`：把要生成的 `AGENTS.md`/`CODEBUDDY.md`/三份 `docs/agents/*.md` 内容输出到 stdout（`=== FILE: <路径> ===` 分隔），不落盘；支持 `--layout`/`--labels` 定制。
- 统一核心原则：**无论默认与否，都由脚本输出文件内容模板供用户复制/替换；模型不落盘、不读取目标仓库文件做确认**。移除 SKILL.md 中手工内置的大段原型（由脚本 `template` 单源生成，避免内容漂移）。
- 新增"无输入快速通道"：用户未提供任何配置输入时（未回答决策、未表达偏好），跳过步骤 2-3 的逐一询问与确认，直接用默认参数运行 `template` 输出文件内容，全程不再提问。
- `sync-doc` 保留但仅在明确要求写盘时使用；正常流程一律走 `template`。
- 明确**自包含**：技能运行所需全部资源（脚本、三份种子模板、测试）都在技能目录内，仅用 Node 内置模块，不依赖技能目录外任何路径或共享文件。
- 在初始化写入的 `## Agent skills` 块中新增 `### 临时文件` 子块：临时脚本统一放 `.temp/scripts/`，其他临时文件（脚本输出、日志等）分类放到 `.temp/` 子目录，保证根目录干净。

## 1.0.0 — 2026-07-06

初始版本。
