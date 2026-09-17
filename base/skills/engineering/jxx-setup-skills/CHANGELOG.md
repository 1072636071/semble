# Changelog

## 1.4.0 — 2026-09-17

### Changed

- **技能改名**：`jxx-setup-matt-pocock-skills` → `jxx-setup-skills`（目录、`SKILL.md` 的 `name`、全仓库引用均已同步）。技能标题由「设置 Matt Pocock 的工程技能」改为「设置工程技能环境」。
- **新增 OCR 检测与安装能力**：流程新增「步骤 4：检查 OCR（代码审查工具）」。
  - 新增 `ocr` 子命令（`scripts/setup.mjs ocr`）：**只读**检测 `ocr` CLI 是否在 PATH 上可用，输出 `{installed, path, version, error}`；未安装时退出码 `4`。
  - 新增 `findOnPath()`（跨平台 PATH 查找，Windows 依次尝试 `.exe/.cmd/.bat`）与 `detectOcr()`。Windows 下 PATH 命中的常是 npm 包装的 `.cmd`，直接 spawn 会报 `EINVAL`，须经 `cmd.exe /c` 调用。
  - 未安装时**必须询问用户**是否安装，不得擅自执行（安装会改动全局环境，是「无输入快速通道」的唯一例外）。SKILL.md 内置各平台安装步骤（npm / Homebrew / MacPorts / 安装脚本 / GitHub Release 二进制）与 Windows 多 Node 并存时的注意事项。
  - 装上 OCR 后 `jxx-code-review` 启用委托模式 **3 维度**审查（标准 + spec + 规则），未装则降级为 **2 维度**；委托模式由宿主 Agent 用自身 LLM 审查，**无需配置 LLM**。

## 1.3.1 — 2026-09-11

### Changed

- `buildAgentSkillsBlock` 的「### Issue tracker」段新增注意项：\`.scratch/\` 是仓库源码的一部分，**必须提交进 git**（不要写进 \`.gitignore\`），让 issue / PRD 随仓库一起版本化管理。生成的 AGENTS.md 与 CODEBUDDY.md 均含此说明。

## 1.3.0 — 2026-08-28

### Changed

- **冲突保护（破坏性行为修正）**：`init`/`sync-doc` 不再覆盖任何"已存在且内容不同"的文件。此前 `docs/agents/*.md` 会被种子无条件覆盖、`CODEBUDDY.md` 会被源文件无条件逐字节覆盖，已有 `## Agent skills` 块被定制过也会被静默替换——**已有配置会被冲掉**。现在这些一律原样保留，动作记为 `conflict`。
- 写入策略收敛为"**只补缺失，不静默覆盖**"：缺失文件 `created`；内容相同 `unchanged`；内容不同且未授权 `conflict`（不落盘）。
- 新增 `--overwrite <file>`（可重复，路径相对仓库根）做**精确覆盖**，新增 `--force` 覆盖全部冲突（默认都不给）。
- 新增退出码 `3`：存在未处置冲突。冲突时打印清单与处置提示（`--overwrite <文件>`／`--force`），且不再输出"初始化完成"。`0` 无冲突、`2` 一致性 MISMATCH、`1` 运行错误。
- `detect` 增加漂移信息：`docsAgents[].{exists,matchesSeed}` 与 `agentSkillsBlockMatches`，供模型在写入前就判断哪些文件会冲突。
- 新增 `extractAgentSkillsBlock(content)`（提取已有工程块）与 `normRel`（路径归一化）。
- dry-run 演练同样如实报出冲突（只影响落盘，不影响动作分类）。
- SKILL.md 新增「冲突处置」流程：出现 `conflict` 时先读取文件，再在保留现状／手工合并／精确覆盖之间决断，默认不加 `--force`。

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

## 1.0.0 — 2026-07-06

初始版本。
