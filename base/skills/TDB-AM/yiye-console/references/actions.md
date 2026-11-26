# 一叶 action 契约速查

> 真源 = `lingshu-bootstrap-plugin/yiye-contract-v1.json`（`actions.entries` / `definitions` / `error_codes`）。
> 本文只做导读；参数或返回形状以真源为准，漂移时以真源为准并回写本文件。
> 统一入口：单工具 `yiye`，参数 `{action, input, scope?}`；CLI 同构 `node lingshu-bootstrap-plugin/yiye-cli.mjs <action> --input '<json>'`。

## 热路径 action（MCP 可见）

| action | 必填 | 关键约束 |
|---|---|---|
| `add` | `body, scene, matter` | `tree_path` 可选（null 或合法路径）；`scope` 缺省 `project`；不接受 `edges`；传未声明键一律 `schema_validation_failed` 并点名该键 |
| `get` | `ids`（1–20） | 缺失 id 进 `missing` |
| `update` / `retire` / `restore` | `id, expected_revision` | 版本不符回 `revision_conflict`；`retire` 可 `restore` 撤回 |
| `search` | `query` | `limit` 1–100（缺省 5）、`max_chars` 256–100000（缺省 4000，含诊断键最坏位预留）；`include_total` 缺省 false（`total=null` + `total_source='not_requested'`）；`tags` 非空时 AND；`tree_path_prefix` 只取范围内已分层记录，覆盖 ≥80% 时自动放弃裁剪 |
| `brief` | — | `max_chars` 控制简报体量 |
| `merge_candidates` / `merge` | 见真源 `definitions` | 去重候选只读扫描；`merge` 产物按真源 source_refs 语义 |
| `status` / `rebuild` | — | `rebuild` 走官方路径（先建 `rebuild-<seq>.sqlite` 再替换），失败不替换、不手删 index.sqlite |

其余 action（`adopt` / `backfill-tree-path` / `batch` / 生命周期扩展动作等）仅在 CLI 可见，见真源 `actions` 段。

## 四条硬口径

1. **未知键一律拒**：所有 `*_input` 都 `additionalProperties:false`，多传字段直接 `schema_validation_failed`。
2. **tags 精确 AND**：非空 tags 要求每条请求 tag 都存在于记录，不做 OR／模糊匹配。
3. **tree_path 前两段 = scene/matter**：给 `tree_path` 时结构不变式由 `treePathForScene` 校验；段规则见 `yiye-scope.mjs#validateTreePath`。
4. **scope 三值**：`global` / `project` / `both`；缺省 `project`，跨项目查要显式 `both`。

## 错误信封

`failures` 只发 `code` + `error`，不发 `reason`；`verification.pending` 明细键是 `rows`（不是 `items`）。完整码表见真源 `error_codes`。
