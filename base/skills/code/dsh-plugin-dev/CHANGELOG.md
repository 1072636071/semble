# Changelog

All notable changes to this agent skill will be documented in this file.

## [1.2.1] - 2026-09-01

### Changed

- 同步上游官方文档：`references/upstream-status.md` 刷新至 `2026-09-01` 快照（上游最近提交 `2026-08-31T16:03:39Z`）。
- 核心依赖版本更新：`@deepseek-ai/cordis` `4.0.1` → `4.0.2`，`@deepseek-ai/schemastery` `3.18.1` → `3.18.2`。
- 内置工具包清单（23 个）无增删，各包 npm 版本无变化。

## [1.2.0] - 2026-08-28

### Added

- `scripts/sync-docs.mjs`：上游文档同步脚本，从 GitHub API + npm registry 拉取 DeepSeek Harness 官方数据（仓库活动状态、核心依赖版本、内置工具包清单与 npm 版本），自动更新 `references/upstream-status.md`。支持 `--dry-run` / `--json`；网络不可达时保留上次快照并退出码 2。
- `references/upstream-status.md`：上游状态快照（由 sync 脚本维护），记录核心依赖精确版本（`@deepseek-ai/cordis`、`schemastery` 等）与全部 23 个 `dsh-tool-*` 内置工具包清单。
- SKILL.md「内置能力参考」：补齐九类可替换能力的完整映射表；工具包清单改为引用 upstream-status.md（由 sync 维护，SKILL.md 不再重复硬编码，避免清单过期）。

### Changed

- SKILL.md 内置工具包清单从静态硬编码改为动态引用上游状态文档，消除「21 个 vs 实际数量」的手工维护偏差。
- sync 脚本版本查询支持重试与并发限流，规避 npm registry 偶发超时。

## [1.1.0] - 2026-08-27

### Added

- SKILL.md 新增「启动环境检查」段：触发后先探测 `DSH_PROJECT_PATH` / `DSH_DEPLOY` / `DSH_HOME` 环境变量，再进入场景决策树。
- `scripts/detect-env.mjs`：环境探测脚本，固定流程不再以代码示例呈现，Agent 直接运行脚本读取 JSON 报告（含 CLI 定位、Node 版本校验、assumptions/recommendations）。
- `tests/detect-env.test.mjs`：探测脚本的 unit/e2e 测试（node:test，6 用例）。
- evals 新增环境探测触发用例（id 6）。

### Fixed

- 修正「三个核心导出」表述为「四个核心导出」（plugin-structure.md、README.md）。
- 统一 bundle-publish.md 与 config-schema.md 的配置加载顺序描述。
- 修正 bundle-package.json 模板 `main`/`files` 与 `lib/` 构建产物路径不一致。

## [1.0.0] - 2026-08-27

### Added

- Initial release of dsh-plugin-dev skill.
- 核心文档：SKILL.md（场景决策树、核心概念速查、开发工作流、通用护栏）。
- 参考文档：插件结构/三种形态/生命周期、工具插件开发、服务插件开发、配置 schema、打包安装发布、常见坑排查。
- 代码模板：最小插件、工具插件、服务插件、bundle package.json、bundle patch 层。
- evals 测试套件：4 个触发 + 1 个不触发用例。

### Fixed

NA
