# Changelog

## 1.5.1 — 2026-10-26

- 发布前自检改调本技能目录的 `scripts/ac-audit.mjs`（副本随技能分发），并补缺失时的降级。

## 1.5.0 — 2026-10-25

**涉及 UI 的功能写 PRD 前先问「UI 验收谁做」**：第 2 步末尾新增询问（默认 agent 不代验——不开浏览器、不截图，UI 体验项进 `HUMAN-CHECK.md`；用户要求代验时 PRD 对应 AC 记 `验证:人工 <HUMAN-CHECK 第 n 条>` 并标授权）；模板「验收点（AC）」节补一句口径，pointer 指向 `jxx-to-tickets/references/acceptance-criteria.md` §二之一（唯一权威源，不复制判据）。起因：下游 developer 拿浏览器做 UI 验收，单卡多轮取证拖慢交付。

## 1.4.0 — 2026-10-23

**PRD「后续修订」改指 ticket-flow**：状态 / 标签 / 认领用写腿（`--set status=… --set labels=a,b`）、打卡与评论附 `--comment`，一条命令完成「改本地 md + 推服务器」；正文整篇修订改完 md 后跑只读腿 `--file <PRD.md>` 收敛（内部 get 最新版 + `version_conflict` 重试一次）。写腿不 create，首次上行仍走 `ticket-uplink` / `jxx_ticket_call create`（`ticket_no`/`id`/`version` 留痕口径不变）；项目无该 CLI 时回退 MCP 双写（`get` 最新 `version` → `update`，409 先对账再推）。

## 1.3.1 — 2026-10-21

生产闸口径统一：`0` 放行；`2` 仅在 PRD 全 defer、AC 交工单层时放行并写明落地位置；`3` 是调用错误必须修正重跑；`1` 不得发布。模板里重复的覆盖矩阵要求删掉，只留「用户故事」节一处 + 指针；写死的「12 类」改为「覆盖清单（14 类，见规范 §一）」。

生成器侧同步（复审高危项）：`scripts/issue-flow.mjs` 的 `to-spec` 缺省骨架补 `## 验收点（AC）` 节（用户故事之后、实现决策之前），含 4 条 AC 草案行（主路径 / 错误路径 / 回归 / 负向，带 `AC-<n>`、`[类别]` 与 `验证:机器` 载荷）——避免「有验收点节却零 AC 行」被 `ac-audit` 判硬问题；`Status:` 行按 issue-tracker 约定改为粗体 `**Status:** ready-for-agent`（原纯文本，脚本与审查读不到）。生成动作后打印 `下一步自检：node <脚本目录>/scripts/ac-audit.mjs <功能目录> --strict`。三份副本经 `check-copies --fix` 同步、0 漂移。

## 1.3.0 — 2026-10-21

**PRD 层落验收点（AC）草案，堵住下游少做 / 假做**：spec 模板在「用户故事」与「实现决策」之间新增「## 验收点（AC）」节，要求按用户故事给出 AC 草案；格式与编号规则 pointer 指向 `jxx-to-tickets/references/acceptance-criteria.md`（唯一权威源，不复制正文）。要点：

- 模板新增「## 验收点（AC）」节：每条用户故事 ≥1 条 AC，编号 `AC-<n>` 从 1 连续、本 PRD 内唯一；PRD 层 AC 是承诺下限，工单层可细分但不得少于、不得删条、不得降级。
- 「用户故事」节加硬要求：每条用户故事必须被 ≥1 条 AC 覆盖，覆盖自检结果落 `.scratch/<NN>-<slug>/map.md` 的「## AC 覆盖矩阵」。
- 流程新增步骤 4「发布前自检」：`ac-audit.mjs <功能目录> --strict`，硬问题 0 才发布。
- 写明 defer 边界：PRD 阶段可只写用户故事、AC 由 `jxx-to-tickets` 落地，此时脚本退出码 2（无工单类文件）属预期，不得卡死 PRD 发布；带 `**Status:**` 行的 PRD 会被当工单审（退出码 1），故推荐在 PRD 层就写 AC 草案，此时必须退出码 0。

## 1.2.0 — 2026-10-15

**服务器上行与本地落盘同属发布动作（默认纪律）**：项目已接入服务器工单时，PRD 落盘必须立即上行 jxx-ticket（labels 带 `prd:<NN>-<slug>` 归组，回写 ticket_no/id/version 留痕），未经上行的 PRD 视为发布未完成；后续修订乐观锁双写、批量 push 的 id 必须实测核对（2026-10-15 T131–T135 串位事故教训）、离线 `sync` 收口。

## 1.1.2 — 2026-09-18

根因补充与二次加固：1.1.1 改对了本源，但**已安装副本不会自动更新**——`~/.workbuddy/skills/jxx-to-spec/scripts/issue-flow.mjs` 仍留着旧的 `__dirname` 锚定版，实际执行时依旧写错目录。本次：

- `resolveScratchRoot()` 增加可疑根拦截：cwd 落在工具安装目录段（`.workbuddy` / `.codebuddy` / `.claude` / `.qwenworkcn`）内，或就是用户 home 本身时直接报错，不再向上"找到" home 下的 dotfiles 仓库而把产出写进 `~/.scratch`。
- 新增 `suspectRootReason()` 与 `resolveDirArg()`：`--dir` 传相对路径且 cwd 可疑时同样报错，而非按错误的 cwd 解析。
- 测试补 4 例（home 命中、安装目录段命中、dotfiles 误判场景、相对 `--dir` 拒绝）。
- SKILL.md 调用改用绝对路径示例，并写明"改完必须跑 `ship install` 刷新已安装副本"。

## 1.1.1 — 2026-09-16

修 `.scratch` 根解析写错目录：`issue-flow.mjs` 原先用 `path.join(__dirname, '..', '..', '.scratch')` 锚定，复制进技能 `scripts/`（`../../` 落到 `base/skills/engineering/`）并安装到 `~/.workbuddy/skills/<skill>/scripts/`（落到 `~/.workbuddy/skills/`）后失效，且是**静默**失效（编号回落 01、自动建目录树）。现改为 `resolveScratchRoot()`：显式 `--root` 优先，否则从 cwd 向上寻找含 `.git`/`.scratch` 的仓库；找不到直接报错退出。SKILL.md 调用示例补 `--root` 与执行位置说明；三份副本由 `base/scripts/check-copies.mjs --fix` 统一同步、并有 parity 门禁兜底。

## 1.1.0 — 2026-07-09

同步 SRC 8515a08→d574778：`to-prd` 重命名为 `to-spec`，术语从 PRD 更新为规格文档(spec)，模板标签从 `<prd-template>` 更新为 `<spec-template>`。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
