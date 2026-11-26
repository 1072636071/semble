---
name: yiye-console
description: "一叶记忆控制台：查/写/改/软删/简报/查重合并，以及落盘文件与索引维护。当用户说查记忆、改记忆、删记忆、记忆过时、重新记忆、一叶管理时触发。删前先与用户核实。"
version: 1.0.0
x-scope: global
disable-model-invocation: false
metadata:
  version: 1.0.0
  author: tdai-memory-suite
  tags: [yiye, console, memory, ops, reference]
---

# 一叶记忆控制台（yiye-console）

> **定位**：一叶是全局记忆与项目记忆的唯一读写入口。日常查、写、改、软删、简报、查重合并全部走一叶工具面 `yiye`。
> 本技能给路由、契约与纪律，不内嵌实现——action 契约的唯一权威真源是
`lingshu-bootstrap-plugin/yiye-contract-v1.json`（速查见 [references/actions.md](references/actions.md)）。

## 落点与作用域

| 作用域 | 落点 | 说明 |
|---|---|---|
| 全局 | `~/.agent-memory`（`TDAI_GLOBAL_MEMORY_DIR` 可覆盖） | 用户偏好、跨项目经验；本机当前经 Junction 指向 `E:\.agent-memory` |
| 项目 | 同一物理库，靠 `tree_path` 前缀 `project/<workspace-id>/` 分区 | 项目约定与偏好；不再各建一个库 |

作用域根解析入口：`lingshu-bootstrap-plugin/yiye-scope.mjs#resolveGlobalMemoryDir`。
`search` 不传 `tree_path_prefix` 时只搜本项目分区；显式 `tree_path_prefix: null` 是跨库逃生口。

## 日常入口

| 要做的事 | 入口 |
|---|---|
| 查记忆（语义 / 标签 / 分层） | `yiye` 的 `search`（`query` / `tags` / `scene` / `matter` / `tree_path_prefix` / `limit` / `scope`） |
| 按 id 精确读 | `get`（`ids` 1–20；缺失进 `missing`） |
| 写一条记忆 | `add`（必填 `body` / `scene` / `matter`；`scope` 缺省 `project`） |
| 改 / 软删 / 撤回 | `update` / `retire` / `restore`（均需 `expected_revision`，冲突回 `revision_conflict`） |
| 简报 | `brief`（`max_chars`） |
| 查重候选 / 合并 | `merge_candidates` / `merge` |
| 重建索引 / 诊断 | `rebuild` / `status` |
| 文档 / 图片 / wiki | 走 WeKnora 面（见 `memory-gateway-weknora` 技能） |

12 个热路径 action 与四条硬口径（未知键一律拒、`tags` 精确 AND、`tree_path` 前两段 = scene/matter、`scope` 三值含 `both`）见 `kb-router` 技能的「一叶记忆面」节。

## 何时用 / 何时不用

- ✅ 用：查、写、改、软删、撤回、简报、查重合并、索引重建、落盘文件排查。
- ❌ 不用：保存知识/文档/图片素材到 WeKnora（→ `kb-router` / `memory-gateway-weknora`）；记项目当天日记（→ 主检出根 `.memory/`，由 agent 实写）。

## 写操作纪律（硬约束，逐字遵守）

1. **写前必读原文**：`update` / `retire` 前先 `get` 拿原文并向用户复述「将要把 X 改成 Y / 将要删除 X」；用户未确认不得执行。
2. **记忆过时失效**（结论已变 / 事实已翻 / 凭据已退役）属同一纪律：先向用户核实这条是否可删，拿到确认再动，不自行判定记忆该不该活。
3. **软删 + 重记**：一叶 `retire` 可 `restore` 撤回；过时记忆的正确处置是「软删（带 reason）→ 立刻写干净新版」，不让知识出现空窗。自己刚写就被后续结论推翻的中间态记录同样清扫。
4. **逐条回报**：每个动作执行后回报 `{ok, id, …}` 与可行动错误，不吞错误信封。
5. **批量先小步**：批量操作先在单条上走通全链路再放量。
6. **受保护层不是「不能动」，是「不能改」**：不可篡改层写入会被拒。不要试图绕过写保护，按「软删 + 重记」处置。

## 浏览落盘文件

一叶正文是本地 Markdown，可直接读：

- 全局记忆：`~/.agent-memory/memories/<scene>/<matter>/*.md`
- 项目记忆：`~/.agent-memory/memories/project/<workspace-id>/<scene>/<matter>/*.md`
- 索引：`~/.agent-memory/.index/index.sqlite`；索引坏时走 `rebuild` 官方路径，不手改索引文件。

## 保鲜约定

- 工具参数 / 返回形状以 `lingshu-bootstrap-plugin/yiye-contract-v1.json` 为唯一真源；契约升级后本技能按漂移回写。
- **契约进 actions.md，路由进 SKILL.md**。
- 本技能真源在 JwikisSkills `base/skills/TDB-AM/yiye-console/`；各 harness 的 `~/.agents/skills/` 是 ship 安装副本，**不要直接改副本**。
