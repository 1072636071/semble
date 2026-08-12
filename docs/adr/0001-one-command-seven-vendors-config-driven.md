# ADR 0001：一行命令覆盖 7 家平台，厂商注册表配置驱动

- 日期：2026-08-12
- 状态：已接受

## 上下文

目标：一行命令从模板生成并安装多家厂商的 skills 和 agent，覆盖并超越现有 `base/skills/安装.md`（PowerShell 原样复制 + SHA256 验证 + 残留清理）。

存在的分歧：

- `base/docs/cross-vendor/SKILL-METADATA-MAPPING.md` 只调研了 **4 家**（openCode / CodeBuddy / CodeArts / Trae），并规定了派生改写规则（CodeArts name 前缀、5 行 description、英文块）。
- `安装.md` 实际分发 **7 家**（另含 Qoder / WorkBuddy / QoderWork），全部原样复制、零派生，CodeArts 也未执行过规范中的改写。

备选方案：

1. **7 家全覆盖 + 配置驱动**（本决策）：`vendors.json` 声明全部平台，4 家挂派生规则，3 家未调研的走原样复制 fallback。
2. 只做规范 4 家：一行命令无法覆盖安装.md 现有能力，PowerShell 与 .mjs 两套脚本长期并存。
3. 7 家全覆盖但全部原样复制：放弃派生改写，CodeArts 质量门禁问题依旧，规范核心价值落空。

## 决策

采用方案 1。一行命令 = init（模板脚手架）+ derive（单源派生）+ install（复制/验证/清理）全流程；平台清单收敛为机器可读的厂商注册表 `vendors.json`，脚本零硬编码。

## 后果

- 新增平台或补调研 Qoder/WorkBuddy/QoderWork 时只改配置，不改脚本。
- 规范的 4 家派生规则首次真正落地执行；3 家未调研平台保持现状行为，不产生回归。
- `安装.md` 的 PowerShell 流程被单个 `.mjs` 命令取代后应退役（符合 HARNESS-SPEC §9 脚本规约）。
- 代价：派生规则引擎是脚本中最复杂的部分，需要为 4 家已调研厂商各实现一条改写规则并附校验。
