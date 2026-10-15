# Changelog

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
