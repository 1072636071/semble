# Changelog

All notable changes to this agent skill will be documented in this file.

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
