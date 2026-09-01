# tdai-memory-capture 同步跟踪（权威源在 TencentDB-Agent-Memory）

**Status:** done

**Blocked by:** 无——常驻跟踪锚点

**构建内容：** `tdai-memory-capture` 技能进入本仓 `base/skills/TDB-AM/` 桶、随 `tdai-` 家族
ship 分发。本 issue 是**同步纪律的跟踪锚点**：技能正文与端点契约的**唯一权威源**在
TencentDB-Agent-Memory 仓库（随内核 API 演进、随代码 review 维护），本仓桶内只是
分发镜像——**本仓不改内容，只跟随同步**。

## 同步纪律（固定方向）

1. 权威源：`D:\work\space\TencentDB-Agent-Memory\docs\skills\tdai-memory-capture\`
   （SKILL.md + references/，MCP 端点契约核对基准 `MemoryCore/src/gateway/experiment-router.ts` 等）。
2. 本仓库改了 API/文档 → **推本仓**：整目录覆盖 `base/skills/TDB-AM/tdai-memory-capture/`
   （当前无 `SKILL.src.md`，ship 走原样复制 fallback；勿在本仓加派生层造成双权威）。
3. `tdai-` 前缀已注册进 `base/scripts/vendors.json` 的 `managedPrefixes`（残留清理覆盖本族）；
   `TDB-AM` 已注册进 `buckets`。桶名保持工单指定的大写形态。
4. 同步后跑 `node base/scripts/ship.mjs --dry-run` 与 `ship check` 确认 7 厂商产物正确、无脏目录。
5. 凭据：本技能复用 panel-admin 三级供给向导；探测路径同时认本仓库权威位
   （坚果云 `项目机密/TencentDB-Agent-Memory/panel-admin-credentials.json`）与
   JwikisSkills 遗留位（`Secret/tdai-panel-admin.json`），两套都兼容、无需迁移。

## 验收标准

- [x] `base/skills/TDB-AM/tdai-memory-capture/` 镜像就位（2026-09-01 首次同步，源版本 0.2.0）
- [x] `managedPrefixes` 含 `tdai-`、`buckets` 含 `TDB-AM`
- [x] `ship --dry-run` 通过：7 厂商产物含 tdai-memory-capture、无脏目录
- [ ] 后续每次权威源变更 → 按纪律第 2 条同步（在「评论」节记一行：日期 / 源 commit / 本仓 commit）

## 评论

- [2026-09-01] 首建：随 TencentDB-Agent-Memory M8（工单 07-06）落地。权威源
  `docs/skills/tdai-memory-capture/` v0.2.0（含实验联系 references/experiment-link.md、
  experiment-dryrun.md）整目录拷入本桶。
