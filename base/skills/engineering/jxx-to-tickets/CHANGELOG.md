# Changelog

## 1.3.0 — 2026-10-15

**服务器上行与本地落盘同属发布动作（默认纪律）**：项目已接入服务器工单时，第 5 步工单落盘必须同批上行 jxx-ticket（labels 带 `prd:` 归组，回写 ticket_no/id/version 留痕），未经上行的工单视为发布未完成；后续修订乐观锁双写、离线 `sync` 收口、删除走 `archived` 软删。新增「批量 push 的 id 必须实测核对」条款——2026-10-15 实测事故：凭表格手抄 id 批量 push，T131–T135 四条串位把正文写进邻居工单，靠乐观锁 409 + 标签过滤 `list` 对账才发现。

## 1.2.3 — 2026-09-18

根因补充与二次加固：1.2.2 改对了本源，但**已安装副本不会自动更新**——`~/.workbuddy/skills/jxx-to-tickets/scripts/issue-flow.mjs` 仍是旧的 `__dirname` 锚定版，实际执行时依旧写错目录。本次同步 `jxx-to-spec` 1.1.2：可疑根拦截（工具安装目录段 / 用户 home 本身）、`--dir` 相对路径在可疑 cwd 下拒绝、测试补 4 例、SKILL.md 改绝对路径示例并写明"改完必须跑 `ship install` 刷新已安装副本"。

## 1.2.2 — 2026-09-16

修 `.scratch` 根解析写错目录：`issue-flow.mjs` 原先用 `path.join(__dirname, '..', '..', '.scratch')` 锚定，复制进技能 `scripts/`（`../../` 落到 `base/skills/engineering/`）并安装到 `~/.workbuddy/skills/<skill>/scripts/`（落到 `~/.workbuddy/skills/`）后失效，且是**静默**失效（编号回落 01、自动建目录树）。现改为 `resolveScratchRoot()`：显式 `--root` 优先，否则从 cwd 向上寻找含 `.git`/`.scratch` 的仓库；找不到直接报错退出。SKILL.md 调用示例补 `--root` 与执行位置说明；三份副本由 `base/scripts/check-copies.mjs --fix` 统一同步、并有 parity 门禁兜底。

## 1.2.1 — 2026-08-30

里程碑环节改为委托 `/jxx-to-milestones`：工单多、改动大或需分批上线时，由该技能生成 `MILESTONES.md` 并按里程碑交付，本技能不再自行生成另一套里程碑格式。

## 1.2.0 — 2026-08-26

新增可选"里程碑"能力：发布工单后可**按需**生成 `MILESTONES.md`，按依赖顺序归组为可独立验收、可断点续传的里程碑；仅在工单多、改动大、涉及广泛重构或大变动时顺带询问，其余不主动提。

## 1.1.0 — 2026-07-09

同步 SRC 8515a08→d574778：`to-issues` 重命名为 `to-tickets`，新增阻塞边(blocking edges)概念、广泛重构的扩展-收缩模式、本地文件 `tickets.md` 模板、HITL/AFK 工单类型区分。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
