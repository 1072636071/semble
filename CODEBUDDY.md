# AGENTS.md

## 多代理要求

AGENTS.md 和 CODEBUDDY.md 内容必须保持一致。

## 与 TencentDB-Agent-Memory 的关系（子项目 · 同时演进）

**JwikisSkills 是 TencentDB-Agent-Memory（`E:\work\sp\TencentDB-Agent-Memory`）的子项目**：jxx 系列技能（`base/skills/engineering/jxx-*`，含统一工作流三技能 jxx-ticket-board / jxx-implement / jxx-implement-spec）**与 TencentDB-Agent-Memory 一起演进**——该项目（含 jxx-ticket 服务端 MyWeKnora fork 与线上 /tickets 看板）的工作流机制变更必须同步反映到本仓技能；本仓 jxx 技能的机制变更也必须同步该项目的服务端与契约文档（`docs/agents/issue-tracker.md` 等）。改 jxx 系列技能时自检：**对端项目是否需要同步改？**（2026-10-01 三技能统一改造：in-project 布局 + 统一看板 + 统一合并流，见 jxx-ticket-board `references/ADR-009-in-project-and-prd-branch.md`）

## Agent skills

### Issue tracker

本仓库的 issue 与 PRD 以本地 markdown 形式存放于仓库 `.scratch/` 下，不使用远程 tracker。参见 `docs/agents/issue-tracker.md`。

> 注意：`.scratch/` 是仓库源码的一部分，**必须提交进 git**（不要写进 `.gitignore`），让 issue / PRD 随仓库一起版本化管理、可回溯、可协作。

### triage 标签

采用五种标准 triage 角色（标签字符串与角色名一致，未覆盖）：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。参见 `docs/agents/triage-labels.md`。

### 领域文档

单一上下文布局：仓库根目录 `CONTEXT.md` + `docs/adr/`。参见 `docs/agents/domain.md`。

### 安装脚本（ship）

`base/scripts/ship.mjs` 负责跨厂商分发 Skills/Agent，缺省跑全流程（派生+安装+验证+清理），子命令 `init`/`derive`/`install`/`check`。厂商清单与安装目录全部由 `base/scripts/vendors.json` 配置驱动，脚本零硬编码。其中 QoderWork 的用户级目标为 `~/.qwenworkcn/skills`。脚本用 `detectUserHome()` 自动定位用户目录（`os.homedir()` → `USERPROFILE`/`HOME` → 常见用户根目录），也可用 `--user-home <dir>` 覆盖。常用：`node ship.mjs install`、`--dry-run` 预览、`check` 门禁预检。

### 临时文件

所有临时脚本统一放在仓库 `.temp/scripts/` 下；其他临时文件（脚本输出、日志等）也要分类，放在 `.temp/` 的子目录下（如 `.temp/output/`、`.temp/logs/`），保证仓库根目录干净。

### 新增 SKILL

使用 `jxx-skill-init` 技能（`base/skills/engineering/jxx-skill-init/`）在本仓库中新建技能。该技能封装了 `ship init` 模板生成 + 仓库约定（桶选择、frontmatter 规范、`x-install`/`x-vendors` 派生字段、evals 目录），确保新技能一次创建即通过 `check` 门禁。
