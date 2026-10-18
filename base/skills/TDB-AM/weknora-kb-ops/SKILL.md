---
name: weknora-kb-ops
description: WeKnora 知识库运营面（全局技能）——对指定知识库直接上传 / 查询 / 管理：图片 SHA256 去重上传、重复命中合并标签、标签 CRUD、去重审计、解析失败排查、批量改名与双语描述。适用于任何本地工作空间维护团队知识库/图片资产。当用户要操作某个具体知识库、批量灌图/灌文档、问图片是否重复上传、改条目标签、查图找素材时使用。触发词：指定知识库、长兴博客、上传知识库、图片去重、重复上传、改标签、查图、kb ops。
version: 2.3.0
x-install: true
---

# WeKnora 知识库运营（全局）：上传 / 查询 / 管理 / 图片去重

> **全局技能 · 单一维护源**：源在 **JwikisSkills** `base/skills/TDB-AM/weknora-kb-ops/`，由
> `node base/scripts/ship.mjs install` 分发到各 harness 技能目录（`~/.agents/skills`、`~/.codebuddy/skills` …）。
> **改技能改 JwikisSkills 源，改完重跑 `ship install` 刷新已安装副本**；不要直接改已安装副本（会被下次安装覆盖，且过期副本会让源码里修好的防护失效）。
> 安装 / 体检两条流程已固化为本技能的全局脚本（见下方「安装与体检」节），项目侧不再各写一份。
> 三面分工，别再问「用哪把」：**写图片走灵枢面**（自带 SHA256 去重 + 描述记忆节点）、
> **库内管理走 WeKnora 官方 MCP 面**（31 把，2026-10-04 对 `MyWeKnora/mcp-server/weknora_mcp_server.py`
> 源码与连接缓存双实盘点）、**标签与手工知识状态走 REST 补强面**（官方 MCP 未覆盖）。
> 凭据走统一凭据腿（坚果云 `项目机密\Secret\`）：key 只从文件现取现用，不进仓库 / 文档 / 工单 / 回显。

## 何时用

要对某个**指定** WeKnora 知识库做上传 / 查询 / 管理（批量灌图片/文档、查图找素材、改条目标签、去重审计、解析失败排查）；或任何工作空间要把图片/知识/事实资产沉淀进团队知识库。触发词：指定知识库、长兴博客、上传知识库、图片去重、重复上传、改标签、查图、kb ops。

不适用：知识该放哪个库拿不准 → `kb-router`；模型内置化/退役 → `weknora-model-ops`。

## 在册知识库（多库登记）

每库一段档案；**新工作区/新库接入**：档案表加行 + 坚果云建该库的 key 文件 + `references/tag-registry-<slug>.md` 建标签台账。
**从零建库的完整流程（模板复制 → 改名改描述 → 配置对齐 → 补来源标 → 接入工作区）见下节「## 新建库（新项目 / 新库接入）」，可跑片段见 cookbook §11。**

### BPM 知识库（2026-10-04 接入）

| 项 | 值 |
|---|---|
| kb_id | `2d014440-786c-4d6b-84cc-12679f4df1cb` |
| 定位 | BPM（Focus 库）问题处理知识库，多工作空间共用 |
| 消费方 | `E:\work\work-sp\BPM问题处理`、`E:\work\work-sp\BPM需求开发`（知识链第 2 级，两仓 AGENTS.md 的知识库段均由 `scripts/kb-install.ps1` 生成） |
| 标签台账 | [references/tag-registry-bpm.md](references/tag-registry-bpm.md)（主题八标，无 category 前缀体系） |
| 内容 | 8 份 knora 蒸馏文档 + 存量 1 条（REST manual 腿首批入库） |

### 设备管理知识库（2026-10-11 接入）

| 项 | 值 |
|---|---|
| kb_id | `ff4696b2-606b-4abe-aa51-79ca82a16675` |
| UI | `http://123.206.125.149:8127/platform/knowledge-bases/ff4696b2-606b-4abe-aa51-79ca82a16675` |
| REST | `http://123.206.125.149:8127/api/v1`，头 `X-API-Key`（凭据腿 `项目机密\Secret\WeKnora-知识库-API密钥.md`，key 只现取现用、不回显） |
| 定位 | **项目知识库**：依模板库 `b2d1f93b-725a-4ee5-98bb-b77d57e646e2` 内《知识库 (Knowledge Base) 与 记忆 (Memory) 的设计划分指南》的「**客观 / 共享 / 相对静态**」定位——只放项目客观结论，不放主体经历（经历归灵枢记忆）。建库走 settings-only 模板复制，流程见「## 新建库（新项目 / 新库接入）」 |
| 消费方 | `E:\work\work-sp\设备管理`（AGENTS.md / CODEBUDDY.md 知识库段 + `docs/agents/knowledge-base.md` + `scripts/kb-check.ps1` 转发壳均由 `scripts/kb-install.ps1` 生成；文件内已含 `<!-- project-kb-id: ff4696b2-… -->` 标记行） |
| 标签台账 | [references/tag-registry-shebei.md](references/tag-registry-shebei.md)（来源两标，**暂无领域主题标**） |
| 内容 | 1 条 manual：`e51d9424-8144-4dd0-970e-ee40a298e8e9`「设备管理 项目知识库接入记录（2026-10-11）」，`parse_status=completed` |

### 儿童成长日记知识库（2026-10-14 登记）

| 项 | 值 |
|---|---|
| kb_id | `af0160f1-fa7e-437e-bf14-3743107d5527` |
| 定位 | 儿童成长日记（tenant 10006「大妞niu」空间，家庭个人向内容） |
| 消费方 | 暂无本地工作区接入 |
| 标签台账 | [references/tag-registry-children.md](references/tag-registry-children.md)（来源两标，暂无领域主题标） |
| 内容 | 0 条（2026-10-14 建，空库） |

⚠️ **本库跨 tenant**：必须用 **tenant 10006 的 key**（`tdai-children-10006`，明文在机密仓
`TencentDB-Agent-Memory/weknora-credentials.md` §9，只此一份、只取不回显）；tenant 10001 的 key 访问它返 **403**
（Permission denied，不是 404、不是 key 失效）。详见下方「多 tenant 库的 key 选择」。

### 长兴博客资源知识库（主库，2026-10-04 实测）

| 项 | 值 |
|---|---|
| kb_id | `26ab29e0-e739-4232-b0e9-30088e760cf1` |
| UI | `http://123.206.125.149:8127/platform/knowledge-bases/<kb_id>` |
| REST | `http://123.206.125.149:8127/api/v1`，头 `X-API-Key`（凭据腿 `项目机密\Secret\WeKnora-知识库-API密钥.md`） |
| 内容 | 博客文章（manual，126 条）+ 图片（file，203 张，**条目名已全量中文化**，见下「文件名纪律」） |
| 标签 | `灵枢记忆`（203，全部图片）· `文档上传`（126，全部文章）+ category/project 标（见 tag-registry）· `工厂` · `deprecated` |
| 图片描述 | **双语**：首行中文摘要 + 空行 + `[EN]` 前缀原英文（203/203 已回写） |
| 消费方 | 国内官网（official-domestic-website）、外贸站（ai-international-trade）的知识链第 2 级与图片资产管理 |

### 长兴库标签台账

tag id 全表见 [references/tag-registry.md](references/tag-registry.md)：category 八标（product/company/report/industry/adr/term/blog-image/process-page）+ 项目标（domestic-site/trade-site）+ 来源标（灵枢记忆/文档上传）+ usage 命名空间（`usage:<页面>` 按需建）。

**文件名纪律（2026-10-04 实证后立规）**：

- 旧口径「图片被正文按文件名引用、改名断链」**已推翻**：全量扫 122 篇文章 chunk 零图片语法引用；
  存储走 `resource://` 句柄（`file_path`）与 `file_name` 解耦；本地落盘名是时间戳.ext；去重走 `file_hash`。改名安全。
- 但 `PUT /knowledge/:id` 不收 `file_name`（只收 title/description/custom_metadata），
  `ReplaceKnowledgeFile` 服务层存在但未挂路由——**存量改名只能 SQL**（范式：事务 + 每行带旧 file_name WHERE +
  `title = 旧名时才同步改 title` 的 CASE，见 cookbook §8）。
- **图片条目名 = 中文语义名**（如 `皮尔卡丹运动鞋垫.webp`；存量 203 张已两批改名：UUID 批 → 英文 kebab 批 → 中文批，ASCII slug 清零）。
  站内资产文件（URL 引用）仍按各站命名规范（英文 kebab），与 KB 条目名互不影响。
  MCP/REST 腿直接传 `fileName=中文名`；灵枢图片腿用本地文件名——先把文件复制为中文名副本再传。
- 图片 `title` = 中文短句（句号结尾，与条目名一致）；description = **中文优先**：
  `中文摘要（含品牌缩写开头亦可，如 SGS 报告：…）。\n\n[EN] 原英文`——英文保留为附录供英文检索。

## 多 tenant 库的 key 选择（2026-10-14 实证）

WeKnora 按 **tenant 隔离**知识库：一把 key 只够得到自己 tenant 下的库，**跨 tenant 一律 403**
（`Permission denied to access this knowledge base`）——**不是 404、不是 key 失效**。

所以「从凭据腿取到第一把能连通（`GET /knowledge-bases` 返 200）的 key 就收工」是错的：连通只证明
key 有效，不证明它够得到目标库。**换库先确认 tenant**：

1. 目标库不在当前 key 可见的 `/knowledge-bases` 列表里 → 先按 tenant 找 key，别反复重试同一把。
2. 有该 tenant 的 key（归档在机密仓 `TencentDB-Agent-Memory/weknora-credentials.md`，按 §号分空间）→ 直接用。
3. 没有 → 走「JWT 登录（管理员账号）→ `POST /auth/switch-tenant {tenant_id}` →
   `POST /tenants/{id}/api-keys`，body `{"scope_type":"tenant","name":"...","full_access":true}`（缺 `scope_type` 返 400）」新建，
   明文只在创建响应 `data.token`；`data.api_key` 是 enc:v1 信封，别拿去归档。
4. 归档与取用纪律同凭据腿总口径：**key 不回显 / 不落盘 / 不进产出物 / 不进 commit message**，
   任何输出只出现 key 名称与末 4 位指纹。

`scripts/kb-check.ps1` 已按此口径改为**按目标库选 key**：对每个 target 挑一把 ① 能连且 ② 其
`/knowledge-bases` 列表里含该 kb_id 的 key（多个 target 可各用不同 key），并把报错区分为
「无权访问（tenant 隔离）」/「不存在」/「未找到可用 key」三种，不再混为一谈。

## 新建库（新项目 / 新库接入）

> 2026-10-11 设备管理库建库实证。下文标「源码」者为读 `TencentDB-Agent-Memory\MyWeKnora` 源码所得（含行号），
> 标「实测」者为当日对 `http://123.206.125.149:8127` 的 REST 回读所得；可跑片段见 [references/rest-cookbook.md](references/rest-cookbook.md) §11。
> 五步：**复制模板 → 改名改描述 → 与模板对齐配置 → 补来源标 + 回读核验 → 接入本地工作区**。
> 模板源库 = `b2d1f93b-725a-4ee5-98bb-b77d57e646e2`（`TencentDB-Agent-Memory-1646ck3g`，内含 1 条 manual
> `d399ea07-bd14-4045-8fce-28f278f0f2f1` =《知识库 (Knowledge Base) 与 记忆 (Memory) 的设计划分指南》）。

### 1. 首选：settings-only 模板复制（`POST /knowledge-bases/{id}/duplicate`）

> ⚠️ **本节（与 cookbook §11b）经源码核实但本次未实跑**：2026-10-11 设备管理库实际走的是
> 手搓 `POST /knowledge-bases` + `PUT /knowledge-bases/{id}` 的 `config` 整段对齐（见下方「### 建库实测记录」）。
> 首次真实走 duplicate 建库时，请对照实际响应体修正本节与 cookbook §11b 的片段。

服务端 = `DuplicateKnowledgeBase`（`MyWeKnora/internal/application/service/knowledgebase.go:1269-1333`）
+ `cloneKnowledgeBaseConfiguration`（同文件 `:1402-1415`）：源库**整份 JSON 深拷贝**后重设
id / tenant / name / 时间戳 / 计数器（`KnowledgeCount`·`ChunkCount`·`ShareCount` 归零，`IsPinned`·`IsTemporary` 复位，
`GeneratedProfile` 置 nil），再落库。源码注释原文：**`A duplicate copies settings, not content`**——
**只复制配置，不带任何条目 / 分块 / FAQ / 索引 / wiki 页 / 分享**。

自动命名 = `buildDuplicateKnowledgeBaseName`（`:1363-1400`）：`<源名>` + 语言后缀，zh locale 的后缀见
`duplicateKBCopySuffix`（`:1335-1347`）= **` 副本`**；重名则 `… 副本 2`、`… 副本 3` 递增。
→ **建完必须再 PUT 改名 + 改描述**。响应 = HTTP **201** `{success, data:{source_id, target_id, message, knowledge_base}}`
（`DuplicateKnowledgeBaseResponse`，`internal/handler/knowledgebase.go:901-906`、`:1115-1123`），新库 id 取 `data.target_id`。

### 2. 别拿 `POST /knowledge-bases/copy` 建空库

`copy` 是**异步、连条目一起复制**（`internal/handler/knowledgebase.go:920` 的 swagger 注释
「将一个知识库的内容复制到另一个知识库（异步任务）」；body `{source_id, target_id}`，返回 `task_id`，
进度 `GET /knowledge-bases/copy/progress/{task_id}`，客户端 `client/knowledgebase.go:483,528`）。
拿它做「模板建空库」会把模板库的条目一并搬进新库——**模板库里的指南类文档要保持单一权威源**，不做多库副本。

### 3. 手搓 `POST /knowledge-bases` 的硬要求（否则建出半成品库）

`POST /knowledge-bases` 的 body 就是 `types.KnowledgeBase` 本身（`internal/handler/knowledgebase.go:389,401`），
服务端 `CreateKnowledgeBase`（`service/knowledgebase.go:121-180`）**只填 id / 时间戳 / tenant 就落库**，
不校验模型与分块字段；`EnsureDefaults()`（`internal/types/knowledgebase.go:737-782`）**只补**
`type`（document）与 `indexing_strategy`（vector+keyword），**不补 embedding 模型、不补 chunk 尺寸**（源码）。

只传 `name` / `description` 会**当成功返回（201 + `{success:true}`，没有任何告警）**，但建成的是**半成品库**：
`embedding_model_id` 空、`chunking_config` 全零（`chunk_size=0`）、wiki 关。后果（2026-10-11 实测）：
之后入库的条目**永卡 processing**，且 **PUT 改不回来**——`UpdateKnowledgeBaseRequest` 只有
name / description / config 三个字段（`internal/handler/knowledgebase.go:714-719`），config 里也没有 embedding；
服务层虽有 `SetEmbeddingModel`（`service/knowledgebase.go:1121`）但**未挂路由**（全仓仅该处定义，无 handler / 路由引用）。
→ 只能删库重建。

要手搓就必须带齐 **`embedding_model_id` + `summary_model_id` + `chunking_config` + `indexing_strategy`**
（模型 id 从 `GET /models` **现取**，别抄旧库——同一模型在不同库 / 部署里 id 会变）。
**优先仍走 §1 的 duplicate**：整份配置复制，不会漏字段。

### 4. `PUT /knowledge-bases/{id}` 的 `config` 是整段覆盖

body = `{ "name": <必填>, "description": …, "config": {…} }`（`UpdateKnowledgeBaseRequest`，
`internal/handler/knowledgebase.go:714-719`，`name` 是 `binding:"required"`）。服务层**不做字段级合并**
（`service/knowledgebase.go:532-567`，源码）：

| config 字段 | 语义 | 漏传 / 传 null 的后果 |
|---|---|---|
| `chunking_config` | value（`kb.ChunkingConfig = config.ChunkingConfig`） | **清零**（chunk_size 归 0） |
| `image_processing_config` | value（`kb.ImageProcessingConfig = …`） | **清零**（模型绑定归空） |
| `faq_config` / `wiki_config` / `auto_tag_config` / `profile_config` | 指针（`!= nil` 才覆盖） | 保留原值 |
| `indexing_strategy` | 指针，且**传了就必须至少开一路** | 传了但全关 → 400 `at least one indexing strategy must be enabled` |

所以「把已建库对齐成模板」的正确姿势 = 先从模板库 `GET /knowledge-bases/{模板id}` **现取全量**
`chunking_config / wiki_config / indexing_strategy / image_processing_config / auto_tag_config / profile_config`，
再整段 PUT 回去（片段见 cookbook §11c）。

- `extract_config` / `question_generation_config` **不在 PUT 可写集**——`types.KnowledgeBaseConfig`
  （`internal/types/knowledgebase.go:159-176`）只有 chunking / image_processing / faq / wiki / auto_tag / profile / indexing 七项。
  它们的 nil 与模板里的显式 `{enabled:false}` **行为等价**（`defaultQuestionGenerationConfig(nil)`、
  `derefExtractConfig(nil)` 均返零值，`internal/application/service/knowledge_process_config.go:239-251`），
  **不必追平，也别硬塞**（PUT 塞不进去）。

### 5. 建库后基线（不补就体检 FAIL）

1. **补来源标** `文档上传`、`灵枢记忆`，`color=#9aa0a6`、`sort_order=900`（与既有库口径一致）。
   `POST /knowledge-bases/{kb}/tags` 的 body 收 `{name, color, sort_order}`（`internal/handler/tag.go:113-117`、
   `service/tag.go:133-183`）——一次传全，别只传 name 再补 PUT。
   **不补则 `scripts/kb-check.ps1` 直接 FAIL「标签 0 个」。**
2. **GET 回读核验**：`wiki_enabled` / `chunk_size` / `embedding_model_id` 三项与模板一致才算建成（cookbook §11c 尾段）。
3. **登记台账**：标签 id / color / sort_order / 引用数写进 `references/tag-registry-<slug>.md`。

### 6. 接入本地工作区（顺序有坑）

```powershell
pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "<库名>" -Workspace . -Anchor "Agent skills"
```

随后把 `<!-- project-kb-id: <uuid> -->` 标记行放在**知识库段之前**（通常紧跟文件顶部，即
`## Agent skills` 块**之外**）。**别图省事放文件末尾**：jxx-setup-skills 提取「## Agent skills」块的口径是
**自该标题取到下一个 `## ` 标题，没有就到文件末尾**（`base/skills/engineering/jxx-setup-skills/scripts/setup.mjs:54-64`
的 `extractAgentSkillsBlock`）——放在末尾的标记行会被算进块内，与规范块不等，
于是**每次重跑 setup 都报 `conflict`**（exit 3），幂等性当场破功。

### 建库实测记录（2026-10-11 · 设备管理库）

实际**没走 §1 的 duplicate**（§1 标注：源码核实、本次未实跑），走的是手搓 create + PUT `config` 对齐：

1. **手搓 `POST /knowledge-bases` 建库**——body 一次带齐 `embedding_model_id` + `summary_model_id` +
   `chunking_config`（380 / 40）+ `indexing_strategy`（vector + keyword + wiki），库名「设备管理」与描述
   **建库时一次给对**：**没有走 rename，也没有调用过 duplicate**（§3 的硬要求就是这次首建踩出来的，见下）。
2. **对齐模板配置**——`GET` 模板库 `b2d1f93b` 现取全量 `chunking_config / wiki_config / indexing_strategy /
   image_processing_config / auto_tag_config / profile_config`，用 `PUT /knowledge-bases/{id}` 的 `config` 段
   **整段覆盖**（§4）。
3. **补两枚来源标**（`文档上传` / `灵枢记忆`，§5）。
4. **核验与接入**——`kb-check.ps1 -Kb ff4696b2-…` **FAIL=0 / WARN=0** →
   `kb-install.ps1 -Anchor "Agent skills"` 接入 `E:\work\work-sp\设备管理`。

**本次两处踩坑（都真实发生）**：

- **首建的教训**：第一次 `POST /knowledge-bases` 只传 `name` / `description`，服务端返回 200 但建出的是
  **半成品库**（`embedding_model_id` 空、`chunk_size=0`、wiki 关），之后入库的条目**永卡 processing**；
  `PUT` 改不回来 → **只能删库重建**。这就是上文 §3 的实测来源。
- **PUT 的第二个坑**：把 `chunking_config` / `embedding_model_id` 等**平铺在 body 顶层**（不放进 `config`）提交时，
  服务端**静默忽略**——name / description 与现值相同时，整次 PUT 相当于 no-op，且**不报任何错**。
  配置必须整体放进 `config` 段（§4）。

建库后 REST 回读与模板**逐字段一致**（实测）：

| 字段 | 值（新库 = 模板，逐字可比） |
|---|---|
| `embedding_model_id` | `7b0be267-40b3-4752-811f-d9ad171024a4`（GTE-Qwen2） |
| `summary_model_id` | `9da32b0f-3bc4-4fb7-9573-24e33a0dffce`（agnes-3.0-flash） |
| `chunking_config` | `chunk_size` 380 / `chunk_overlap` 40 / `parent_chunk_size` 4096 / `child_chunk_size` 384 / `separators` `["\n\n","\n"]` / `parser_engine_rules`：pdf·docx·doc·pptx·ppt → `mineru_cloud`，csv·md·markdown·txt·json·图片·音频 → `simple` |
| `indexing_strategy` | `{vector:true, keyword:true, wiki:true, graph:false}` |
| `wiki_config` | `{extraction_granularity:"standard", synthesis_model_id:9da32b0f-…, max_pages_per_ingest:0}` |

⚠️ **`enable_parent_child` 是 `omitempty` 的 bool：新库与模板的 GET 响应里都不出现该键 = false**（2026-10-11 实测），
但 `parent_chunk_size` / `child_chunk_size` 已预置 4096 / 384。要真开父子分块，得在 PUT 的 `chunking_config`
里**显式传 `"enable_parent_child": true`**——光有尺寸不算开。

## 上传（按内容形态选腿）

1. **图片 → 灵枢 `memory_remember`（推荐）**：`content` 传图片绝对路径、`kb_id` 传库 id 或库名。
   链路 = 本地算 SHA256 → 库内预检去重（命中即返既有 `knowledge_id`，`deduped:true uploaded:false`，**零字节重传**）
   → 未命中才上传并打 `灵枢记忆` 来源标 + 另写 `image_desc` 记忆节点（以后 `memory_recall` 按图内容语义可召）。
   **注意**：灵枢腿用本地文件名当 file_name——先把文件重命名成语义名再传。
2. **任意文件（不要记忆节点）→ 官方 `create_knowledge_from_file(kb_id, file_path, enable_multimodel, file_name)`**：
   本地路径由 MCP 进程读；`file_name` 可带目录（`docs/spec/x.pdf`）落知识文件夹。图片必开 `enable_multimodel`（默认开），否则 VLM 描述不进索引。
3. **Markdown 文本 → `create_knowledge_from_text(kb_id, title, content[, tag_ids, status="publish"])`**；
   网页 → `create_knowledge_from_url(kb_id, url)`。改已有手工条目 → `update_knowledge_from_text`。
   **⚠️ MCP 未挂载时的降级（必读）**：文本/知识条目改走 **REST 创建手工知识**（cookbook §6b，
   `POST /knowledge-bases/{kb}/knowledge/manual`，不依赖任何 MCP，任何 harness 都能走）。
   **严禁**拿灵枢 `memory_remember` 顶替——它只收**图片**（图片腿才进 WeKnora），文本会写进灵枢记忆
   而不是知识库（真实事故：2026-10-04 外贸站会话因此假完成）。

## 图片重复上传：三层真实现状（2026-10-04 实证）

| 层 | 机制 | 重复时行为 |
|---|---|---|
| WeKnora 服务端（内建） | file 通道按 `file_hash`（+file_name/size/type）查重（`knowledge_create.go:79-117`） | **409** `{code:"duplicate_file", data:<既有条目>}`，不入库、**不改标签** |
| 灵枢图片腿（门面预检） | SHA256 + 文件名比对列表第一页 100 条（`server/tools/remember.py:151-214`、`weknora.py:84 find_entry`） | 命中返既有 id，`uploaded:false`；未命中才传。**库 >100 条时预检可能漏，由服务端 409 兜底** |
| 官方 MCP `create_knowledge_from_file` | 无预检，`raise_for_status` | 重复 → 工具报错，但响应体 `data` 就是既有条目（id 可直接捞） |

**没有任何一层在重复时自动改标签。** 要「重复不重传、改为合并原图标签」用下面的 playbook（全部现役 API，无需改服务端）。

### 重复命中 → 合并标签 playbook

> ⚠️ 批量改标是 **replace 语义**（`knowledge.go:1006` → `SetKnowledgeTags` 去重后整组替换，
> 测试 `TestSetKnowledgeTags_DedupesAndReplaces`）。**必须先读出旧标取并集再写**，直写新标 = 丢旧标。

1. 定位既有条目：`list_knowledge` 或 REST `GET /knowledge-bases/{kb}/knowledge?page=N&page_size=100`（返回自带 `tags` 数组与 `file_hash`）。
2. 新标签不存在先建：REST `POST /knowledge-bases/{kb}/tags` `{"name":"..."}`（同名返 409，先查后建）。
3. 合并写入：REST `PUT /knowledge/tags`，body `{"updates": {"<knowledge_id>": ["旧标id...","新标id..."]}, "kb_id": "<kb>"}`。

## 查询

- 库内语义查 → `hybrid_search(kb_id, query[, vector_threshold, keyword_threshold, match_count])`。
- 跨库/跨档模糊查 → 灵枢 `memory_recall`（带 `workspace_id` 走 kb 路分桶）。
- 条目列举/详情/分块 → `list_knowledge`（可按 `folder_path`、tag 过滤）/ `get_knowledge` / `list_chunks`。
- wiki 三件 → `wiki_search` / `wiki_read_page` / `wiki_index_view`。

## 管理

- **去重审计**：全量翻页按 `file_hash` / `file_name` / manual `title` 分组找 >1 组。长兴库 2026-10-04 实测三维零重复（329 条）。现成 pwsh 脚本见 [references/rest-cookbook.md](references/rest-cookbook.md)。
- **标签 CRUD**（REST 面）：`GET/POST /knowledge-bases/{kb}/tags`、`PUT/DELETE /knowledge-bases/{kb}/tags/{tag_id}`；批量改标 `PUT /knowledge/tags`（replace 语义，见上）。
- **解析失败排查**：列表按 `parse_status=failed` 过滤。长兴库现存 4 条 failed，均为 2026-09 批次改过标题的 manual 条目。
- **手工知识改内容/标题**：REST `PUT /knowledge/manual/{id}`，body `{"title","content","status"}`——**`status` 不可省略**，缺省被后端置 `draft`（凭据腿文档原话）；保留原状态显式传 `"publish"`。
- **删除**：`delete_knowledge` / `delete_chunk` / `delete_knowledge_base`（高危，先备份确认）。

## 纪律

- REST 面 base 与 key 一律从**凭据腿**现取（每库一个文件，键形如 `sk-...`，pwsh 取 key 范式见 cookbook），**任何产出物里不出现 key 值**。
- 删图前先查正文引用与 usage 标（改名已实证安全：正文零引用、存储句柄解耦、去重走 file_hash）。
- 工具数以源码真值为准；本技能写死的「31 把」是 2026-10-04 的实盘点快照，变了以 `MyWeKnora/mcp-server/weknora_mcp_server.py` 为准。

## 项目侧强制约束（范式，写进各工作区 AGENTS.md/CODEBUDDY.md）

接入本技能的工作区应在自己的 AGENTS.md 知识段加「强制约束（硬性 · 任务完成前逐条核验）」三条，口径随项目替换路径与项目标：

1. **图片资源全量入库**——项目新增/替换的任何图片资产，任务完成前必须上传知识库（语义文件名 + 中文 title + 双语 description + 项目标 + `usage:<页面>` + category 标）；页面引用了库里查不到的图 = 任务未完成。
2. **确认事实必须上传**——经用户确认或权威来源核实的事实**当日**入库（挂领域标 + usage 标）；站点/项目文案一律以知识库为准。
3. **事实冲突必须修正**——文案/代码与知识库条目冲突时禁止只改一边：先定权威（用户输入与代码 > 知识库 > 记忆），过时一方用 `update_knowledge_from_text` 或改标立即修正，改到逐字一致才收工；错条目直接改，不留「待核对」。

已落地参照：official-domestic-website 与 ai-international-trade 两仓 AGENTS.md（2026-10-04）。

**不要再手抄这段**：用 `scripts/kb-install.ps1` 生成（幂等 upsert，两份规则文件逐字一致）。本技能内置的四条通用约束
（结论当日入库 / 入库前先查重 / 事实冲突双向修正 / 每条结论必须可回溯）加上 `-ExtraRules` 传入的项目专属约束，
就是本节的机器化版本。

## 安装与体检（全局脚本）

两个 PowerShell 脚本随本技能分发到各 harness（`scripts/`），**项目侧只留转发壳，逻辑零重复**。

### 体检 `scripts/kb-check.ps1`

对任意库跑：凭据腿取 key（**不回显**）→ 库级能力 → 全量条目 → 去重审计（hash / 文件名 / 标题）→ 标签台账 → 混合检索冒烟。
以 `FAIL` / `WARN` 计数收口，**退出码非 0 即有 FAIL**。

``````powershell
pwsh -File kb-check.ps1 -Kb <kb_id>                       # 指定库
pwsh -File kb-check.ps1 -Workspace .                      # 从工作区 AGENTS.md 自动读 kb_id
pwsh -File kb-check.ps1 -All                              # 体检在册档案全部库
pwsh -File kb-check.ps1 -Workspace . -Query "审批流","窗体"   # 体检 + 检索冒烟
pwsh -File kb-check.ps1 -Workspace . -Json                # 机器可读输出（供别的脚本消费）
``````

诊断口径：`parse_status=failed` 才是真问题；`finalizing` 通常只是状态未落定，**内容照样可被检索命中**，别急着重传。

### 安装 `scripts/kb-install.ps1`

把一个知识库接入到任意本地工作区，四件事一次做完：

1. 幂等 upsert `AGENTS.md` + `CODEBUDDY.md` 的知识库段（`<!-- weknora-kb-ops:begin/end -->` 标记块，两份逐字一致）
2. 生成 `docs/agents/knowledge-base.md` 规范骨架（已存在则跳过，`-Force` 才覆盖）
3. 生成体检转发壳 `scripts/kb-check.ps1`（零逻辑，运行时探测技能目录并转发）
4. 可选 `-Check` 紧接着跑一次体检

``````powershell
pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "BPM" -Workspace .
pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "BPM" -Workspace . -Check
pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "X" -Workspace . -Position Append
pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "X" -Workspace . -Anchor "Agent skills"
pwsh -File kb-install.ps1 -Kb <kb_id> -KbName "X" -Workspace . -ExtraRules "**不越权写库**——SQL 交用户执行。"
``````

| 参数 | 作用 |
| --- | --- |
| `-Position Top\|Append` | 知识库段插入位置：`Top`（默认，插到二级标题之前）/ `Append`（文末） |
| `-Anchor <标题片段>` | `Top` 模式下插到**含该片段的二级标题之前**（如 `-Anchor "Agent skills"`）；不填则用首个二级标题。找不到指定标题时回退到首个二级标题，不静默追加到文末 |
| `-ExtraRules <string[]>` | 追加项目专属强制约束（编号自动接在通用四条之后） |
| `-Force` | 连 `docs/agents/knowledge-base.md` 一起覆盖 |
| `-Check` | 装完立即调转发壳跑体检，退出码透传 |

幂等性由标记块 upsert 保证：**连跑任意多次产物逐字节一致**（已在 short / long / 无二级标题三种种子文件上验证）。

## 深入

- **references/rest-cookbook.md** — REST 补强面全部菜谱：取 key 范式、去重审计、标签 CRUD、批量改标、failed 排查、manual 更新、存量改名 SQL 腿、双语描述批量写回、**新建库与配置对齐（§11）**。要动手跑 REST 时读。
- **references/tag-registry.md** — 长兴库 tag id 全表与挂标范式。新库接入时另建 `tag-registry-<slug>.md`。
- **references/tag-registry-bpm.md** — BPM 库 tag id 全表。
- **references/tag-registry-shebei.md** — 设备管理库 tag id 全表（来源两标，暂无主题标）。
- **references/tag-registry-children.md** — 儿童成长日记库 tag id 全表（tenant 10006，来源两标，暂无主题标）。
- **scripts/kb-check.ps1** / **scripts/kb-install.ps1** — 体检与安装两条全局流程（见上节）。
