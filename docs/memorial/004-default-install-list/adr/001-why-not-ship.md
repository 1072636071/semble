# ADR 001 — 为何不复用 ship.mjs 做「推荐安装」

- 状态：已接受（accepted）
- 日期：2026-09-18
- 关联决策：D1（形态 = 清单 + 通用 runner）

## 背景

需要一个机制：新同事来了之后，一键自动安装我推荐的插件。
仓库已有 `base/scripts/ship.mjs`（由 `base/scripts/vendors.json` 驱动），负责把**本仓库拥有的技能/agent** 跨厂商派生 + 安装 + 验证。

## 决策

不复用 `ship.mjs`。新建独立的声明式清单 `tools/recommended-setup.json` + 通用 runner `tools/bootstrap-setup.mjs`。

## 理由

1. **语义不匹配**：`ship.mjs` 面向「本仓库拥有的技能/agent」的分发；两个必装项（Tencent BrowserSkill、alibaba open-code-review）是**外部工具**，不归本仓库所有。
2. **安装形态各异**：外部工具的安装方式包括 curl/ps1 安装脚本、npm -g、交互式 `bsk install-skill --harness`、npx skills add、以及纯人工的浏览器扩展。`ship.mjs` 的 vendor 抽象不覆盖这些。
3. **需求不同**：推荐名单要求「数据驱动、可扩展、跨平台、幂等、容错报告」，独立 runner 更贴合；`ship.mjs` 的 derive 流程对外部工具是多余负担。

## 后果

- 仓库出现两套安装机制：`ship.mjs` 管本仓库技能/agent 的跨厂商分发；`bootstrap-setup.mjs` 管外部推荐插件的本地安装。
- 需在文档/README 明确二者分工，避免混淆。
