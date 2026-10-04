---
name: weknora-kb-ops
description: WeKnora 知识库运营面（全局技能）——对指定知识库直接上传 / 查询 / 管理：图片 SHA256 去重上传、重复命中合并标签、标签 CRUD、去重审计、解析失败排查、批量改名与双语描述。适用于任何本地工作空间维护团队知识库/图片资产。当用户要操作某个具体知识库、批量灌图/灌文档、问图片是否重复上传、改条目标签、查图找素材时使用。触发词：指定知识库、长兴博客、上传知识库、图片去重、重复上传、改标签、查图、kb ops。
version: 2.1.0
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

### BPM 知识库（2026-10-04 接入）

| 项 | 值 |
|---|---|
| kb_id | `2d014440-786c-4d6b-84cc-12679f4df1cb` |
| 定位 | BPM（Focus 库）问题处理知识库，多工作空间共用 |
| 消费方 | `E:\work\work-sp\BPM问题处理`、`E:\work\work-sp\BPM需求开发`（知识链第 2 级，两仓 AGENTS.md 的知识库段均由 `scripts/kb-install.ps1` 生成） |
| 标签台账 | [references/tag-registry-bpm.md](references/tag-registry-bpm.md)（主题八标，无 category 前缀体系） |
| 内容 | 8 份 knora 蒸馏文档 + 存量 1 条（REST manual 腿首批入库） |

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

## 上传（按内容形态选腿）

1. **图片 → 灵枢 `memory_remember`（推荐）**：`content` 传图片绝对路径、`kb_id` 传库 id 或库名。
   链路 = 本地算 SHA256 → 库内预检去重（命中即返既有 `knowledge_id`，`deduped:true uploaded:false`，**零字节重传**）
   → 未命中才上传并打 `灵枢记忆` 来源标 + 另写 `image_desc` 记忆节点（以后 `memory_recall` 按图内容语义可召）。
   **注意**：灵枢腿用本地文件名当 file_name——先把文件重命名成语义名再传。
2. **任意文件（不要记忆节点）→ 官方 `create_knowledge_from_file(kb_id, file_path, enable_multimodel, file_name)`**：
   本地路径由 MCP 进程读；`file_name` 可带目录（`docs/spec/x.pdf`）落知识文件夹。图片必开 `enable_multimodel`（默认开），否则 VLM 描述不进索引。
3. **Markdown 文本 → `create_knowledge_from_text(kb_id, title, content[, tag_ids, status="publish"])`**；
   网页 → `create_knowledge_from_url(kb_id, url)`。改已有手工条目 → `update_knowledge_from_text`。
   **⚠️ MCP 未挂载时的降级（必读）**：文本/知识条目改走 **REST 创建手工知识**（cookbook §10，
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

- **references/rest-cookbook.md** — REST 补强面全部菜谱：取 key 范式、去重审计、标签 CRUD、批量改标、failed 排查、manual 更新、存量改名 SQL 腿、双语描述批量写回。要动手跑 REST 时读。
- **references/tag-registry.md** — 长兴库 tag id 全表与挂标范式。新库接入时另建 `tag-registry-<slug>.md`。
- **references/tag-registry-bpm.md** — BPM 库 tag id 全表。
- **scripts/kb-check.ps1** / **scripts/kb-install.ps1** — 体检与安装两条全局流程（见上节）。
