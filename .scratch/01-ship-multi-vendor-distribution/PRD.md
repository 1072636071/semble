# 一行命令跨厂商分发 Skills 与 Agent（ship.mjs）

Status: ready-for-agent

## 问题陈述

当前技能分发依赖一份 PowerShell 脚本（`base/skills/安装.md` 内嵌）：平台清单、默认安装名单全部硬编码在脚本里；同一份 `SKILL.md` 被原样复制到 7 家平台目录，从未执行过跨厂商适配（CodeArts 的 name 前缀、5 行编号 description、英文正文等质量门禁全部落空）；Agent 定义（`base/agent/`）完全不在分发范围内；脚本与规范（`docs/cross-vendor/` 三份文档）描述的"单源 + 派生"架构之间存在落差。

维护者新增一个技能时，要手动复制目录到 7 个平台、手动改 CodeArts 专属内容、手工对齐 name 与目录名；稍有不慎就漂移。

## 解决方案

提供一个单一入口命令 `ship.mjs`：零参数即完成"扫描全部桶与 agent 源 → 双模式派生/复制 → 安装到各平台 → SHA256 验证 → 清理残留"的全流程，覆盖并超越现有安装脚本的全部能力；同时提供 `init` / `derive` / `install` / `check` 子命令，支持逐步操作与不落盘预检。平台清单收敛为机器可读的厂商注册表 `vendors.json`，脚本零硬编码；未调研的平台自动走原样复制 fallback，补调研只改配置。

## 用户故事

1. 作为技能维护者，我想要运行一行命令就完成全部平台的技能与 agent 分发，以便不再维护 PowerShell 脚本。
2. 作为技能维护者，我想要用 `init` 子命令从模板生成新的技能/agent 源文件骨架（目录、frontmatter、x-vendors 默认值），以便不用手写重复结构。
3. 作为技能维护者，我想要 `init` 是参数驱动的非交互命令（`--type skill|agent` + `--name`），以便能在脚本与 CI 中调用。
4. 作为技能维护者，我想要源文件含 `SKILL.src.md`/`AGENT.src.md` 的技能走单源派生安装，以便执行规范的跨厂商适配。
5. 作为技能维护者，我想要没有源文件的存量技能走原样复制安装，以便零回归地渐进迁移（ADR 0002）。
6. 作为技能维护者，我想要 CodeArts 派生版自动应用 name 前缀、5 行编号 description、英文块提取规则，以便满足其质量门禁。
7. 作为技能维护者，我想要 openCode 派生版不写 frontmatter name（路径即 ID），以便其可被正确加载。
8. 作为技能维护者，我想要 CodeArts 专属英文内容（5 行 description、英文正文块）缺失时，该厂商安装被硬门禁拦截并报错、命令非零退出，以便失败即时可见（ADR 0004）。
9. 作为技能维护者，我想要 CodeArts 门禁失败不影响其他厂商正常安装，以便不因单家内容缺失阻塞全部分发。
10. 作为技能维护者，我想要 `x-install: false` 的技能/agent 默认不安装，以便清单属性就近声明（co-location）。
11. 作为技能维护者，我想要默认安装到用户级目录，以便与现状习惯一致、零迁移。
12. 作为技能维护者，我想要 `--project` 选项安装到项目级扫描目录，以便团队共享场景可用。
13. 作为技能维护者，我想要 `--user-home <dir>` 把所有用户级目标重定向到指定目录，以便测试与临时演练不污染真实环境。
14. 作为技能维护者，我想要 `--dry-run` 只做派生与校验、不落盘，以便预演变更。
15. 作为技能维护者，我想要安装后对每个技能做 SHA256 验证并报告 OK/MISMATCH/MISSING，以便确认分发正确。
16. 作为技能维护者，我想要残留清理只删除匹配 managedPrefixes 且源中已不存在的目录，以便绝不动用户自有技能。
17. 作为技能维护者，我想要 `check` 子命令在不安装的情况下预检全部技能/agent 的门禁与派生是否通过，以便 CI 中使用。
18. 作为技能维护者，我想要 agents 目录未调研的平台被跳过并打印警告，以便配置补齐即生效、脚本不动（ADR 0003）。
19. 作为技能维护者，我想要新增平台或补调研只改 `vendors.json`，以便零脚本改动（ADR 0001）。
20. 作为技能维护者，我想要中文文件名的 Agent 在双模式下原样复制，以便现状行为不回归。
21. 作为技能维护者，我想要派生与校验逻辑在 Node 内建 `node:test` 下可测，以便不引入第三方依赖。
22. 作为技能维护者，我想要命令所有输出与错误结构化（文件、字段、非零退出码），以便对接 HARNESS-SPEC §3.3 失败信号契约。

## 实现决策

- **单一入口脚本**：`ship.mjs` + 子命令（零参数 = 全流程；`init` / `derive` / `install` / `check`）。零参数全流程 = 扫描 + 双模式 + 安装 + 验证 + 清理。
- **厂商注册表** `vendors.json`（与脚本同目录）：每平台声明名称、用户级目录、项目级目录、skills 目录、agents 目录（可缺失）、是否有派生规则、managedPrefixes。新增平台只改此文件。
- **派生规则引擎**：仅对已调研 4 家实现——CodeArts（name 前缀映射、description 改写为 5 行编号列表、英文内容提取）、openCode（不写 name 键、路径即 ID）、CodeBuddy/Trae（透传 + 按需注入各自专属字段）。未调研平台无派生规则 → 原样复制。
- **双模式判定**：技能/agent 目录含 `SKILL.src.md`/`AGENT.src.md` 即派生，否则原样复制。
- **CodeArts 硬门禁**：英文 5 行 description、英文正文块缺失 → 该厂商安装失败 + 非零退出；其余厂商不受影响。`check` 复用同一校验。
- **x-install**：frontmatter 字段，缺省 `true`；`false` 时该技能/agent 不在任何平台安装。
- **安装级别**：默认用户级；`--project` 切换项目级；`--user-home` 重定向用户级根目录；`--dry-run` 不落盘。
- **验证与清理**：SHA256 对比（OK/MISMATCH/MISSING）；清理仅针对匹配 managedPrefixes 且源中已不存在的目录。
- **Agent 与 Skills 同权**：`base/agent/` 走同样双模式；agents 目录未声明的平台跳过并告警。
- **非交互**：`init` 参数驱动，缺必填参数报用法错误。
- **脚本语言**：Node `.mjs` + UTF-8 显式处理，符合 HARNESS-SPEC §9。

## 测试决策

- **单一 seam（已确认）**：CLI 本身 + 目录注入——通过 `--user-home` 指向临时目录、`--dry-run` 不落盘，全流程在临时 fixture 上可测；不额外暴露库接口。
- **测试框架**：Node 内建 `node:test`，无第三方依赖。
- **覆盖场景**：init 生成的 src 骨架满足 name 正则与目录一致；derive 对 4 家改写正确（CodeArts name 前缀/5 行列表/英文块、openCode 无 name 键）；`x-install: false` 跳过；无 src 技能原样复制；CodeArts 门禁失败非零退出且不阻塞其他厂商；残留清理只动 managedPrefixes；`--user-home` 重定向生效；`check` 预检。
- **行为测外部、不测实现**：断言输出目录树与文件内容，不断言内部函数调用。
- **先例**：仓库已有 `.mjs` 资产与 Node 脚本（HARNESS-SPEC §9），无既有测试框架，`node:test` 为零依赖增量。

## 超出范围

- Qoder / WorkBuddy / QoderWork 三家元数据调研与派生规则（后续补调研，只改 `vendors.json`）。
- 根目录 `Agent定义/` 与 `base/agent/` 双目录的收敛（另立项）。
- 31 个存量技能的批量迁移与 CodeArts 英文内容补写（随双模式渐进，ADR 0002）。
- 华为云产品专属技能（规则 B，`huawei-cloud-*` 源 name）的模板分支。
- 安装后各平台重启/热加载技能的自动化验证（保持人工）。

## 补充说明

- 本 PRD 对齐 ADR 0001–0004；领域词汇见根 `CONTEXT.md`（单源派生、双模式、厂商注册表、ship、x-install、managedPrefixes、安装级别）。
- 实施完成后需同步：`base/skills/安装.md` 重写为 ship.mjs 用法（PowerShell 退役）；`HARNESS-SPEC.md` §10 与两份 mapping 文档的"生成脚本接口"节标注 ship.mjs 为既定实现；5 个被排除的 productivity 技能补 `x-install: false`。
- 命令命名 `ship` 为仓库级动词，文档与技能描述统一使用。
