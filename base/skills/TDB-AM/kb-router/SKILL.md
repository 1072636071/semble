---
name: kb-router
description: 知识路由——决定知识存到/查询哪个知识库：WeKnora（文档 / 知识 / 图片）还是灵枢（记忆 / 技能 / 任务）。当 agent 要保存知识/素材/fact/图片/wiki、或用户问"知识放哪""存到哪个库""WeKnora 和灵枢怎么分工"时使用。触发词：知识路由、知识放哪、WeKnora、灵枢、kb 召回。
version: 0.3.0
x-install: true
metadata:
  version: 0.3.0
  author: tdai-memory-suite
  tags: [kb, router, weknora, lingshu, knowledge, memory]
---

> **真源说明**：本技能真源在本仓库 base/skills/TDB-AM/kb-router/，由 node base/scripts/ship.mjs install
> 分发到各 harness 技能目录（~/.agents/skills、~/.codebuddy/skills …）。**改技能改本仓源，改完重跑
> ship install 刷新已安装副本**；不要直接改已安装副本（会被下次安装覆盖）。
>
> 姊妹技能分工：知识该放哪个库拿不准 → **本技能**；已定库后的上传/查询/管理 → weknora-kb-ops；
> 写新记忆 → tdai-memory-capture 的写入通道或直接 memory_remember；模型内置化/退役 → weknora-model-ops。


# 知识路由：WeKnora（文档/知识/图片）↔ 灵枢（记忆/技能/任务）

> **2026-10-01（PRD 85）**：旧只读门面与旧内核已整体退役，「KS」（旧知识服务）这一侧的记忆 / 技能 / 任务面
> 由**灵枢**（`server/`，MCP 面 `lingshu`）承接。本技能里凡写「KS」的历史措辞一律读作**灵枢**；
> 文档 / 知识 / 图片面仍属 **WeKnora**（直连官方 MCP，见 `agents/dsh/README.md`）。`kb_recall` 与
> `ensure_project_kb` 两把**门面工具**已随旧门面退役，语义迁入灵枢：分层召回 → `memory_recall` 的 kb 路；
> 项目库 ensure → `memory_project_kb`。**移除的是工具，不是能力**。

> **2026-09-20（PRD 56 · ADR-0089）→ 2026-09 派生链升级（PRD 60 · ADR-0092/0093 工单 05）**：WeKnora 库分档定则——**项目级库 = 一个工作区一个**，库名派生链为
> **`workspace_id` 命中的注册表 `kb_name` 映射 > `<git 根 basename>-<ws 段>` > `WEKNORA_PROJECT_KB` > git 根 basename**（本仓的映射是 `TencentDB-Agent-Memory-1646ck3g ↔ ws-1646ck3g`，**人审种入、属部署窗项**（DEPLOY-CHECK B22）；没种入前走派生腿）；**用户级库** = `WEKNORA_USER_KB`（默认 `user-kb`），存跨项目通用知识。查询侧不再逐库挑 kb_id：**灵枢 `memory_recall` 的 kb 路**按 project→user→other 三档分桶排序（桶序判据落在 `server/tools/recall.py`）。沉淀路由口诀随之更新：**只与本工作区相关 → 该区库（带 `workspace_id` 召回）；跨项目通用 → 用户级库（不带区标签即可）**。

> **2026-09-24（PRD 64 · 工单 08 / 工单 10）**：本地 JxKnowledgeBase 早已停服、不再作为任何写入落点。
> 本技能门面据此定稿为终态口径 **WeKnora（文档/知识/图片）↔ 灵枢（记忆/技能/任务）**；
> 上文 dated 修订块作为演进历史保留，其中的措辞只读、不再指导落点选择。

判定口诀：**文档 / 知识 / 图片（团队 wiki、可检索的知识库素材、图片/二进制）→ WeKnora；记忆 / 技能 / 任务（要给 Agent 运行时注入、跨会话经验、tier 信任分级）→ 灵枢。**

## 何时用

要保存知识/素材/fact/图片/wiki 但不确定放哪个库时；用户问「知识放哪」「存到哪个库」「WeKnora 和灵枢怎么分工」时；或需要判断一块内容属 WeKnora（文档/知识/图片）还是灵枢（记忆/技能/任务）时。触发词：知识路由、知识放哪、WeKnora、灵枢、kb 召回。

## 三步分流（按顺序问）

1. 需要在 Agent 对话运行时自动注入生效？→ **灵枢**（`memory_recall` / 技能面；注入链路只认灵枢门面）。
2. 需要 tier 信任分级（fact/experience/note/hearsay）、记忆 / 技能 / 任务？→ **灵枢**（声明 `tier`，四档为全库标准 ADR-0040）。
   2b. 是**图片/二进制**？→ **WeKnora**（ADR-0095：图片面走 WeKnora）。落地动作 = 灵枢 `memory_remember`（传本地图片路径：SHA256 去重 → WeKnora file 通道 + 多模态解析 → 另写 `image_desc` 记忆节点）；按文本找已入库图片 = 灵枢 `memory_image`。
3. 是**文档 / 团队 wiki / 可检索的知识库素材**？→ **WeKnora**（直连官方 MCP 面：建库 `create_knowledge_base`（先确认 embedding 模型绑定）、查询 `hybrid_search`；面向「本项目优先 + 用户级兜底」的分层召回 → **灵枢 `memory_recall` 的 kb 路**，按 project→user→other 分桶）；要给 Agent 运行时注入的**服务化记忆 / 技能 / 任务** → **灵枢**。

**「本区 / 用户级」是怎么落出来的（PRD 60 · 四域一条规则）**：分档不是按库名猜的，是按**工作区身份**——号在本仓根 `AGENTS.md` 尾部标记行 `<!-- workspace-id: ws-xxxxxxxx -->`，读它用 `tools/lib/workspace-id-core.mjs`（`write:false` 零副作用），**别拿目录名当号**。三条写链各带走法：

| 域 | 带号方式 | 归用户级的做法 |
| --- | --- | --- |
| 知识（WeKnora 库） | 召回/上传传 `workspace_id` → 经注册表映射定到该区库 | **不带区**地写用户级库（`WEKNORA_USER_KB`），任何区都兜底命中 |
| 记忆（L1） | 项目记忆上行自动打 `workspace:<ws-号>` 标签（`tools/lib/memory-file-uplink.mjs`；存量 `repo:<basename>` 只读双归，不回填） | 手填时不打区标签 |
| 技能 | `capture skill` 缺省从标记行透传 `workspace_id`，`workspace:` 标签由**服务端**并入 metadata | `--scope user` 或 `--workspace ""` = 显式用户级 |

带号后桶序统一为 project > user > other，**判据落在灵枢实现**（`server/tools/recall.py` 的 kb 路；原跨包共享件随旧包退役）；**不带号 = 用户级**，任意区都必命中——所以「跨区通用」的判据是**少传一个字段**，不是建另一个库。

## 场景速查

| 场景 | 去向 |
| --- | --- |
| 图片素材（设计稿/截图/图标）入库、要能被文本检索召回 | **WeKnora**：灵枢 `memory_remember`（VLM 解析后描述进索引；ADR-0095） |
| 短平快定论/经验速记（50~200 字 fact）、记忆可信度分级 | 灵枢（`tier`/`trust_state` 声明，四档 ADR-0040） |
| 版本化、可回滚的记忆/技能变更集 | 灵枢（变更集版本化 ADR-0033） |
| 跨项目全局搜素材 | 灵枢（namespace 标签 + project 过滤；**`project:` 与 `workspace:` 是两条正交轴**——前者「为什么做」后者「在哪做」，别互相挪用，ADR-0093 决策 4） |
| 查「这类问题别人踩过什么坑」（只要经验） | **WeKnora 两步法**：REST 按 `type:experience` 过滤拿候选集 → 语义读。库上百条后必须走两步，全库语义检索会漏（实测 687 条库漏掉排不进前 6 的真经验）。路径与判据见 `weknora-kb-ops`「查询」节 |
| 查「项目用到哪些资料/素材」 | **WeKnora 两步法**：REST 按 `type:material` 过滤 → 语义读。同上 |
| 敏感素材不上云、离线可用 | 无对应云落点；此类内容不入服务器，留本地文件自管 |
| 团队文档 → 结构化 Wiki、按图谱检索 | **WeKnora**（直连官方 MCP 面；ADR-0083） |
| 代码仓库符号/调用链/影响分析 | **mzg**（本仓唯一对外代码索引 MCP 入口，ADR-0094 / PRD 61） |
| 对话运行时自动注入知识给编码 Agent | **灵枢** |
| **零碎但有用的知识** | **当前仓库对应的 WeKnora 项目级库**（先 `memory_project_kb` 拿 kb_id，库名按工作目录派生，见下节） |
| **本项目文档批量入库 + 要 wiki 页** | **`memory_project_kb`**（拿 kb_id，wiki 默认开）→ `create_knowledge_from_text/file/url`（PRD 83） |

## 零碎知识 → WeKnora 项目库（工作目录派生 · ADR-0089 / 0092；承接方 = 灵枢）

**判断顺序（三层判据见工单 15，这里只给路由）：**
能独立引用的原子结论 → L1；跨多轮成型的模式/流程 → L2；**零碎但有用 → 当前仓库对应的知识库**；三者都不满足 → **不上传**。

> **口径升级注记**：原「按 git 地址认领知识库」面（工单 13/14/15 · ADR-0075）已整体下线——
> `knowledge_list` / `knowledge_create` / `knowledge_git_mapping_update` 随块文档栈物理摘除
> （PRD 52 工单 13），**不存在 git→库映射工具，勿再尝试认领流程**。零碎知识的落点改由
> WeKnora 项目级库承接（ADR-0089 工作目录懒建库 + ADR-0092 workspace_id 注册表映射）。

**库怎么定位（不再询问认领，按派生链）：** 项目库名解析序 = **`workspace_id` 注册表 `kb_name` 映射 > `<git 根 basename>-<ws 段>` > `WEKNORA_PROJECT_KB` > git 根 basename**（本仓映射 `TencentDB-Agent-Memory-1646ck3g ↔ ws-1646ck3g`）。**建库 / 召回 / 图片 / 图片检索四条腿共用同一份解析器**（灵枢 `server/tools/weknora.py:resolve_kb`，PRD 85 工单 10 迁入并补齐派生腿），故「建库的库 = 召回的库 = 图片落的库」是构造出来的，不是靠约定。

**给本项目灌文档的推荐入口（PRD 83 工单 02 语义，现由灵枢承接）：`memory_project_kb(workspace_id=…, workspace=…)`** ——
一步确保本项目专属库存在并**返回 `{kb_id, kb_name, created, wiki_enabled}`**，拿 `kb_id` 直接喂下面的 `create_knowledge_from_*`。它比手搓派生链好在三点：① **返回 kb_id**（官方写工具都要显式 id）；② **wiki 默认开**（`wiki` 缺省 true ⇒ 灌进去的文档自动生成 wiki 页）；③ **幂等**（首次 `created:true`，之后 `created:false` 零写入）。**入参 identity 至少给一个**（`workspace_id` 或 `workspace`）——它会真建库，不拿门面 cwd 兜底。

不加它时仍可手工定位：先 `list_knowledge_bases`（WeKnora 官方面）确认目标库在列；不在列 → `create_knowledge_base(name, description)` 建库（只对本次真正用到的库建，勿广撒网）。 **成本提示（工单 74-03）**：`list_knowledge_bases` 返回的是**每个库的全量配置**（embedding / chunking / storage / vlm / wiki / profile…），**5 个库就约 600 行 JSON**——**一次拿完、整段留在上下文里复用**即可；不要为「一共有几个库」「某个库在不在列」这类问题反复重调。只要库名清单就从同一次返回里读，别重跑。

> ⚠️ **模型未绑风险（ADR-0089 决策 2，随迁入如实继承）**：官方 `create_knowledge_base` **不绑模型**，
> 两个 `*_model_id` 缺省走 WeKnora 租户默认；**若该租户无默认 embedding 模型，条目会永卡 processing**。
> 灵枢 `memory_project_kb` 的纪律是**建库前先 `GET /models` 现取**（取不到再退回 env
> `WEKNORA_KB_EMBED_MODEL_ID` / `WEKNORA_KB_SUMMARY_MODEL_ID`；两者皆无 ⇒ 报可行动中文错误，**绝不盲建**）。
> 手工建库路径请同样先 `list_models()`（无参，出参含各模型 `type`）确认有默认 Embedding 模型，
> 或给 `create_knowledge_base` 显式传 `embedding_model_id`。

**怎么写：** 先拿库 → 再灌文档。**推荐一步**：`memory_project_kb(workspace_id, workspace)` 拿 `kb_id`（本项目专属库，wiki 默认开）；然后 `create_knowledge_from_text(kb_id, title, content[, status])`——`status` 可选、缺省 `publish`（即时进索引；解析/索引在后端异步，回执成功 ≠ 立即可检索），`draft` 存而不索引；`kb_id` 在这条调用点上支持库名自动解析成 UUID。同族另有 `create_knowledge_from_file` / `create_knowledge_from_url`（同样要 `kb_id`）——三条写工具都在 WeKnora 官方 MCP 面。

**入库自带来源标（PRD 73 工单 02）：** 三条写路自动打来源标签，人面据此区分「agent 运行时沉淀」与「人上传的文档」——灵枢 `memory_remember` 图片腿打 **`灵枢记忆`**；批量文档上行腿打 **`文档上传`**。标签是 **KB 子资源**，逐库按名幂等 get-or-create（同名已存在则复用，不重复建）；**打标是增强腿**——标签面不可达/无权限时只记字段与告警，绝不阻断入库。过滤用 `GET /knowledge?tag_ids=`。

**怎么查：** 跨档模糊查 → **灵枢 `memory_recall`**（`workspace_id` 给上即走 kb 路，按 project→user→other 分桶）；确定在某个库内查 → WeKnora 官方面 `hybrid_search(kb_id, query)`。

**何时仍需问用户：** 仅当 `list_knowledge_bases` 里出现**多个候选库名相近**、无法按派生链唯一确定目标库时，把候选库名转述给用户拍板；派生链能唯一命中就自行执行，不再多问一轮。

## 分层：终态 WeKnora ↔ 灵枢

- **WeKnora 是文档 / 知识 / 图片面**：团队 wiki、可检索的知识库素材、图片/二进制在此（建库 `create_knowledge_base`、库内检索 `hybrid_search`、上传经灵枢 `memory_remember`；ADR-0083 / ADR-0095）。
- **灵枢是记忆 / 技能 / 任务与唯一权威**：全部记忆 / 技能 / 任务直接写服务器，tier 四档原生支持，不再反向搬迁数据；分层召回在其 `memory_recall` 的 kb 路。
- **本地 Agent 查询**：记忆 / 技能 / 任务走灵枢 MCP 面（`lingshu`）；文档 / 知识 / 图片走 WeKnora 官方 MCP 面；找代码走 `mzg`。
- **历史**：本地 JxKnowledgeBase 早已停服、数据只读备查，不再作为写入落点。

## 证据与完整对比

能力差距对照、源码出处与补齐优先级见仓库报告：`docs/report/jxk-vs-memoryknowledge-gap.html`（第五章即本路由的展开版；报告本身为历史史料，口径以本技能为准）。
