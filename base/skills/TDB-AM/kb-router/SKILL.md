---
name: kb-router
description: "知识路由：一份内容该存到或查哪里——一叶记忆（项目/全局）、WeKnora（文档/图片/wiki）、mzg（代码）。当用户问知识放哪、要不要进知识库时触发。不执行上传。"
version: 0.5.0
x-scope: global
x-install: true
metadata:
  version: 0.5.0
  author: tdai-memory-suite
  tags: [kb, router, weknora, yiye, knowledge, memory]
---

> **真源说明**：本技能真源在本仓库 base/skills/TDB-AM/kb-router/，由 node base/scripts/ship.mjs install
> 分发到各 harness 技能目录（~/.agents/skills、~/.codebuddy/skills …）。**改技能改本仓源，改完重跑
> ship install 刷新已安装副本**；不要直接改已安装副本（会被下次安装覆盖）。
>
> 姊妹技能分工：知识该放哪个库拿不准 → **本技能**；已定库后的上传/查询/管理 → weknora-kb-ops；
> 记忆读写 → 一叶工具面（本技能「一叶记忆面」节）；模型内置化/退役 → weknora-model-ops。
>
> **2026-11-21（PRD 159 R4 · ADR-0144）**：记忆类落点只有一叶。本技能的口诀据此改写：**记忆 = 一叶**。

# 知识路由：一叶（记忆）↔ WeKnora（文档/图片/wiki）

## 判定口诀（唯一判据）

| 知识类型 | 落点 |
|---|---|
| 项目约定、技术选型、项目偏好 | **一叶 project scope**——主检出根 `.memory`（关联 worktree 共用主检出根；非 Git 目录取会话 cwd） |
| 用户全局偏好、跨项目约定、通用经验技能 | **一叶 global scope**——`~/.agent-memory`，`TDAI_GLOBAL_MEMORY_DIR` 可覆盖 |
| 文档、图片、wiki | **WeKnora**（不变） |


代码仓库符号 / 调用链 / 影响分析 → **mzg**（本仓唯一对外代码索引 MCP 入口）。

> 一句话口径：**要能被 agent 读写、按作用域分源的记忆 → 一叶；要被团队检索的文档/图片/知识 → WeKnora；找代码 → mzg。**

## 何时用

要保存知识/素材/fact/图片/wiki 但不确定放哪时；用户问「知识放哪」「存到哪个库」「记忆和知识库怎么分工」时；
或需要判断一块内容属一叶（记忆）还是 WeKnora（文档/图片）时。

## 一叶记忆面（实测行为，2026-11-21）

**工具面**：MCP 单工具 `yiye`（`lingshu-bootstrap-plugin/yiye-mcp.mjs`，`serverInfo.name = 'yiye'`），
热路径 12 个 action：`add` / `get` / `update` / `retire` / `restore` / `organize` / `merge` / `history` /
`search` / `brief` / `rebuild` / `merge_candidates`。低频动作（`adopt` / `migrate` / `init` / `route` /
`takeover` / `conflict_*` / `backfill-tree-path` / `batch`）只在 CLI：`node lingshu-bootstrap-plugin/yiye-cli.mjs <action> --input '<json>'`。

| 要做的事 | 怎么调 |
|---|---|
| 写一条记忆（项目） | `yiye` 的 `add`，必填 `body` / `scene` / `matter`；`scope` 缺省 `project` |
| 写一条记忆（全局） | 同上，`scope: 'global'`（落 `~/.agent-memory`） |
| 按语义/标签查 | `search`（`query` / `tags` / `scene` / `matter` / `tree_path_prefix` / `limit`） |
| 按 id 精确读 | `get`（`ids` 1–20；不存在的 id 进 `missing`，仍回 ok） |
| 改一条 | `update`（`id` + `expected_revision`；版本不符回 `revision_conflict`） |
| 软删 / 撤回 | `retire` / `restore`（均要 `expected_revision`） |
| 简报 | `brief`（`max_chars`，回 `{text, truncated}`） |
| 查重候选 | `merge_candidates` → 再 `merge` 执行合并 |

**已实测的四条硬口径**：

1. **未知键一律拒**（R7）：传 `content` / `no_atomize` 这类非契约键 ⇒ `schema_validation_failed` 并点名该键，**不静默丢弃**。
2. **`tags` 是精确匹配 + AND 语义**：`tags: ['session']` **不会**命中 `session:abc`（不存在「段边界前缀」匹配）；要按前缀找用 `tree_path_prefix`。
3. **`tree_path` 前两段必须等于 `scene` / `matter`**；未分层（null）是合法值。画像约定 `tree_path = profile/<fact_key>`（`scene=profile`），实测可按 `tree_path_prefix: 'profile'` 召回。
4. **`scope` 三值，但两档调用面不一致**：MCP 的 `yiye` 工具接受 `project` / `global` / `both`（`both` 实测两库各回一条）；**CLI 只认 `project` / `global`**——`--input '{"scope":"both"}'` 与 `--scope both` 都回 `invalid_scope`（2026-11-21 实测）。要走 `both` 请用 MCP 面。

**一叶没有的面**（别按旧技能找）：无图片入库/找图腿、无图谱查询、无项目库创建口、无独立画像工具（画像按上条 `tree_path` 约定写）。
这些能力原由旧记忆服务承载，服务已下线；替代路径见下节。

## WeKnora 面（文档 / 图片 / wiki）

**工具面**：官方注册表 34 把，默认 `WEKNORA_MCP_SURFACE=minimal` ⇒ `tools/list` 只报**极简可见 7 把**
（`list_knowledge_bases` / `get_knowledge_base` / `hybrid_search` / `list_knowledge` /
`create_knowledge_from_text` / `create_knowledge_base` / `list_knowledge_folders`），其余隐藏 27 把经 raw 面或
逃生桥 `node scripts/weknora-call.mjs --tool <name> --args '<json>'` 可达。缓存口径见 `weknora-kb-ops`。

**库怎么定位**：走工作区配置 `<工作区根>/.agents/kb.json`（ADR-0132），细节见下节「工作区知识库配置」。

**建库**：项目库唯一创建口 = WeKnora `create_knowledge_base`（旧记忆服务已下线）。
现役建库 = WeKnora 官方 `create_knowledge_base(name, description)`（极简可见），或按 `weknora-kb-ops`
「新建库」节的模板复制流程（settings-only 复制模板库 `b2d1f93b-725a-4ee5-98bb-b77d57e646e2`）。
**建库前先确认 embedding 模型**（`list_models` 无参看 `type`，或给 `create_knowledge_base` 显式传 `embedding_model_id`）——
不绑模型时条目会永卡 processing。建完把 `kb_id` 写进 `.agents/kb.json` 的槽位，agent 之后不必再手抄 UUID。

**图片**：图片在 WeKnora（可被文本检索的知识条目）。自动解析腿现状：原由旧记忆服务 `memory_remember`
的图片路径腿承担（SHA256 去重 → WeKnora file 通道 → 多模态解析 → 另写 `image_desc` 记忆节点，ADR-0095），
一叶无对应实现；旧服务下线后该腿不可用。当前可确定的路径是 `create_knowledge_from_file`（服务器本地路径）
或人工在 WeKnora 面上传，并按纪律显式挂 `type:material`。

**检索**：确定库内查 → `hybrid_search(kb_id, query)`。

**不知道在哪个库 → 走分层召回 CLI**（真源仓 TDB-AM）：

```bash
node tools/weknora-tiered-recall.mjs --query "<要找的>" --top 5      # 人读报告
node tools/weknora-tiered-recall.mjs --query "<要找的>" --json       # 机器可读
node tools/weknora-tiered-recall.mjs --dry-run                       # 只看会按什么顺序查哪些库
```

判据（真源 `tools/lib/weknora-tiered-recall-core.mjs`）：

- **顺序 = 库优先级** `project → user → other`（`--order` 可改）；每库取 top-N，按库优先级拼接，**不按分数全局重排**；
- **提前终止**：某库命中数已达 top ⇒ 后续库一次都不调；
- **单库失败不中断**：记进 `errors[]` 后继续下一个库，人读面单列「失败库 N 个」；**全部失败**才判失败（退出 1）；
- **全部零命中 = 合法结果**（退出 0，「查过且没有」≠ 失败）；**回包形状坏**记为该库失败，绝不读成零命中；
- 库列表读工作区 `.agents/kb.json`（ADR-0132）：**读不到 / 槽位为空 ⇒ 明确报错**（退出 3），不静默返回空；
- `--query` 空白 ⇒ `schema_validation_failed`（退出 2）。

库怎么归到三档：槽位 `tier` 字段 > 槽位键名（`project` / `user` / `other`，可带 `-` / `_` 前缀）> 兜底 `other`；**不从槽位 `name` 猜**（name 是人读备注）。

不新建 MCP 工具面（PRD 130），故这条路径只有 CLI。原「两步法」只承接**同库内按类型标分型**（先按 `type:experience` / `type:material` 过滤拿候选，再语义读），不承接跨库优先级——两者是互补的两件事。

## 工作区知识库配置（ADR-0132 · 未变）

**一份配置决定「这次调用用哪个库」，agent 不再手抄 UUID。** 落点 `<工作区根>/.agents/kb.json`，从工作区内任意目录向上逐级找第一个（判据只看 `.git` 存在性——目录或文件都算，worktree 的 `.git` 是文件）。

schema（`version` 当前只有 1）：

```json
{
  "version": 1,
  "workspace_id": "ws-…",
  "default": "main",
  "slots": {
    "main": { "kb_id": "<uuid>", "name": "项目经验", "usage": "人读备注" }
  }
}
```

**怎么定位工作区**：调 WeKnora 工具时多传影子参数 `workspace`（工作区内任意深度子目录都行）。解析序 = `arguments.workspace` > env `WEKNORA_WORKSPACE_ROOT` > 都没有 ⇒ 回 `needs_workspace`。

**槽位解析序**（真源 `tools/lib/kb-config.mjs` 的 `resolveKbTarget`）：

1. 显式 `kb_id` → 直接用它，**不读配置**；
2. `kb` 是 UUID 字面 → 直接用它，**不读配置**（优先于同名槽位：UUID 无歧义）；
3. `kb` = `slots` 的键 → 该槽；
4. `kb` = 某槽的 `name` → 该槽；
5. `kb` 缺省 → `default` 槽；
6. `kb` 传了但 2/3/4 都不命中 ⇒ **报错并列出可用槽位，不回落 default**（静默回落 = 把经验写进素材库）。

**缺配置怎么办（`needs_kb_config` 带三条出路，顺序固定）**：`pick-existing`（`list_knowledge_bases` 列候选，让用户挑 `kb_id`）→ `create-new`（自建库后写配置，**必须绑 embed + summary 模型**）→ `skip`（本会话只写本地产出，不落库）。

**MCP 自己不写配置文件**——写配置是人的动作（或人指派的 agent 用编辑器写）。配置坏了（坏 JSON / 缺 default / `kb` 不命中）工具侧走 fail-open，不会替你修。

**改 / 删 / 取单条不需要槽位**：`update_knowledge_from_text` / `delete_knowledge` / `get_knowledge` 只吃 `knowledge_id`。

**单库 + 标签的现行口径（不变）**：一个工作区一个库，经验与资料**不拆库**，用 `type:experience` / `type:material` 两个类型标分型（memorial 057；ADR-0132 D1 维持）。`slots` 是多槽扩展位，当前只启用 `default` 一个槽——别自建「经验库 / 素材库」两槽绕过标签分型。

## 场景速查

| 场景 | 去向 |
|---|---|
| 项目内约定 / 技术选型 / 项目偏好 | **一叶 project scope**（`.memory`） |
| 用户全局偏好 / 跨项目约定 | **一叶 global scope**（`~/.agent-memory`） |
| 通用经验技能 | 一叶 global scope（`tree_path = skills/<bucket>/<name>` 约定；走整理链产出） |
| 短平快定论 / 经验速记 | 一叶（`add`，`importance` / `evidence_count` / `verification_state` / `layer` 可选） |
| 场景叙事（跨多轮成型的模式/流程） | 一叶（`tree_path = scenarios/<session>/t<N>`，整理链的词表口径） |
| 图片素材（设计稿/截图/图标）入库 | **WeKnora**（`create_knowledge_from_file` 或人工上传；自动解析腿待确认） |
| 团队文档 / wiki / 可检索的知识库素材 | **WeKnora**（`create_knowledge_from_*` + `hybrid_search`；wiki 由库的 `wiki_enabled` 决定） |
| `type:experience` / `type:material` 分型检索 | **WeKnora 两步法**（先按类型标过滤拿候选，再语义读），见 `weknora-kb-ops` |
| 代码仓库符号 / 调用链 / 影响分析 | **mzg** |
| 敏感素材不上云、离线可用 | 留本地文件自管（无云落点） |


## 零碎知识的三层判据

能独立引用的原子结论 → 一叶（`add`）；跨多轮成型的模式/流程 → 一叶场景（`tree_path = scenarios/…`）；
**零碎但有用 → 当前工作区对应的 WeKnora 项目库**；三者都不满足 → **不上传**。

## 证据

- 一叶工具面与 12 个热路径 action：`lingshu-bootstrap-plugin/yiye-mcp.mjs`（`HOT_ACTIONS` / `TOOL_SCHEMA`）。
- 契约真源：`lingshu-bootstrap-plugin/yiye-contract-v1.json`（`add_input` / `update_input` / `actions` 段）。
- 作用域根：`lingshu-bootstrap-plugin/yiye-scope.mjs`（`resolveGlobalMemoryDir` / `resolveProjectScopeRoot`）。
- 记忆主体迁移：`docs/adr/0144-yiye-replaces-lingshu.md`。
