# 第三方官方skills 库标签台账（tag-registry-skills）

> kb `dfaaf6fc-1e5d-4385-a290-58c847d71bcb`（第三方官方skills · tenant 10001 · 与项目库同 tenant，
> 用现有 tenant 10001 key 即可，不会 403）· 建库 2026-10-20 16:29，creator `std04b`，
> 定位「各种第三方官方skills」= 收录第三方厂商官方发布的 agent skills 的 **SKILL.md 原文**。
> 类型两标 2026-10-20 16:51 建、当日 16:5x 挂载；下表 tag id / color / sort_order / 引用数均为当日 REST 回读值。
>
> 挂标前先取 id；批量改标是 **replace 语义**（`PUT /knowledge/tags`），必须先读旧标取并集（主技能 cookbook §4）。
> 本库为**新增库，无存量同义标**——建库即按通用类型标口径建 `type:experience` / `type:material` 两枚，不再另建同义标。

## 标签全表

| name | tag id | color | sort_order | 用途 | 当前引用数 |
|---|---|---|---|---|---|
| `type:material` | `7b162c17-660c-4d65-b9d9-44ae4c0016bf` | `#34a853` | 100 | 通用类型标：项目使用到的资料——第三方官方 SKILL.md 原文 + 本仓自研 craft 子技能快照（主技能「通用类型标」节） | 113 |
| `type:experience` | `3c6f9c9a-ba11-44aa-8dc6-3ebd5081a867` | `#4285f4` | 101 | 通用类型标：项目自身的踩坑 / 接入实录——本库自身的接入与灌装记录 | 1 |

**本库暂无来源标**（`文档上传` / `灵枢记忆`）与领域主题标（2026-10-20 快照）。原因见「待挂清单与判据」。
后续新增主题标在此登记，`sort_order` **接续**现有档位（类型两标占 100/101，主题标从 200 起，别再撞）。

## 已入库条目·Hostinger（2026-10-20 快照 · 灌装中）

REST `GET /knowledge-bases/{kb}/knowledge` 全量翻页回读：**57 条，全部 `type=manual`、`parse_status=finalizing`、
`source=manual`、`channel=web`、`metadata.status=publish`、`tags` 原为全 null（一条都没挂标签）**。
`knowledge_count=57` / `chunk_count=0`（灌装仍在进行，chunk 未落定）。

**内容构成**：Hostinger 官方两个技能包的 SKILL.md 原文 + 1 条自撰总索引：

| 类 | 条数 | 说明 |
|---|---|---|
| 总索引（自撰） | 1 | `53c1e362-1e47-46f9-b348-2737588734d0`「README-Hostinger-技能索引」——本库定位、两个技能包、条目命名约定、同步脚本说明（**本项目自撰**，同时挂 `type:material` + `type:experience`） |
| 顶层技能原文 | 30 | `hostinger-<skill>`：vps / dns / domains / hosting / billing / reach / ecommerce / horizons（`hostinger-agent-skills` 仓）+ hostinger-hostinger-headless / deploy-to-hosting / connect-domain / maintain-wordpress / migrate-to-hosting / audit-hosting / troubleshoot-website（`api-mcp-server` 仓）+ 9 个 `hostinger-headless-step-*` |
| headless 附属文件 | 26 | `hostinger-headless-aux-NN-*`（`c9297b2a-…` ～ `5e0712ab-…`）——总纲因单条体积上限拆出的 bootstrap / 各 AI 工具接入说明 / run-log / report schema / 各步骤 SKILL 原文，**与总纲条目 `29df77ae-06c6-48a2-bdf4-0dddb1ae88c1` 配套阅读** |

**全部 57 条已挂 `type:material`**（`knowledge_count=57` 回读值），其中 1 条（总索引）另挂 `type:experience`。
条目头部均带来源注释（仓库 / 分支 / 仓库内路径），例：`hostinger/api-mcp-server` 仓 `main` 分支 `skills/headless/SKILL.md`。

**目录布局（2026-10-21 调整）**：15 个顶层技能目录全部移入 `hostinger/` 顶层目录（`hostinger/<skill>`；
headless 子树 `hostinger/headless/steps/…` 随迁不变），为后续其他厂商技能目录腾出根级命名空间；
自撰总索引 README 留在库根（`root_document_count=1`，全库 57 条 = hostinger 56 + 根 1）。
操作走 `PUT /knowledge-bases/{kb}/knowledge/folders` 的 `{from, to}` 整目录重命名（15/15 成功，
moved 合计 56，仅调整归类不重解析）。后续新厂商技能灌库时按同口径建 `<vendor>/` 顶层目录。

## 已入库条目·乐享 lexiang（2026-10-28 灌装 · 30 条）

姜先生 2026-10-28 指示：乐享（lexiang）相关技能全部卸载，原文放入本库，本地只留一个引导程序。
实际执行 30 条 manual（29 条技能原文 + 1 条自撰索引），全部 `publish`、全挂 `type:material`：

| 类 | 条数 | 说明 |
|---|---|---|
| 自撰索引 | 1 | `lexiang-技能索引`（`6f932043-…`，留库根）——目录布局、条目命名、两条取原文腿、域对照、恢复本地技能口径 |
| 顶层技能原文 | 7 | `lexiang`（路由）+ `lexiang-setup` / `lexiang-search` / `lexiang-writer` / `lexiang-blocks` / `lexiang-files` / `lexiang-connectors`，各 1 条 = 原 `SKILL.md` |
| 附属文件 | 22 | `<技能名>-aux-NN-<相对路径>`（路径 `/` 写 `__`、去扩展名）：block schema / 主题 / 示例 / markdown 转换 / 上传脚本 / 常见错误 / doc 模板 等 |

**目录布局**：`lexiang/<技能名>`（7 个文件夹，与 `hostinger/<skill>` 同口径），索引留库根
（`root_document_count=2`；全库 87 条 = hostinger 56 + 根 1 + lexiang 30）。落盘走
`POST /knowledge/folder`，body `{kb_id, knowledge_ids, folder_path:"lexiang/<技能名>"}`（目标目录不存在自动建；
每批上限 200 条；空路径 = 回库根）。

### 两个必记的坑（2026-10-28 实测）

1. **manual 建条目缺 `status` 落 `draft`，不进索引**。payload 是 `types.ManualKnowledgePayload`
   （`title` / `content` / `status` / `tag_ids` / `channel`），`status` 取值 `draft|publish`，
   **不传即 draft**（`parse_status=draft`、`file_size=0`、`GET /chunks/<id>` 空集）。
   补救：`PUT /knowledge/manual/<id>` 带 `{title, content, status:"publish"}` → `parse_status` 转 `pending` 并入队。
   注意字段是 **`tag_ids` 数组**，老口径的单数 `tag_id` 会被静默忽略（首轮 30 条 tags 全 null 就是这么来的）。
2. **挂标批量上限 20 条**：`PUT /knowledge/tags` 一次超过 20 个 `knowledge_ids` 返
   `400 {"message":"at most 20 documents"}`，按 20 一批切。

### 检索现状（2026-10-28 15:4x）

向量腿全局不可用：`POST /knowledge-bases/<kb>/hybrid-search` 返
`code=1007 embedding ... Post "http://www.erp.sdcxslzj.com:11235/v1/embeddings": connection refused`
（外部 embedding 端点宕，**与本库无关，全库通用**）；`GET /knowledge/search` 因此在分块未落定时返空集。
兜底腿：`GET /knowledge-bases/<kb>/knowledge?folder_path=lexiang/<技能名>` 列条目 →
`GET /knowledge/<id>` 读 `metadata.content`（原文全文存这里，不依赖分块与向量，恒可读）。
embedding 恢复后应对 30 条补 `POST /knowledge/<id>/reparse` 让分块与向量落定。

## 已入库条目·IMA ima-skill（2026-10-28 灌装 · 11 条）

同口径迁入（入口技能 + 两个子模块 + 脚本），全部 `publish`、全挂 `type:material`：

| 类 | 条数 | 说明 |
|---|---|---|
| 自撰索引 | 1 | `ima-技能索引`（`7b959c62-…`，留库根）——目录布局、条目总表、两条取原文腿、运行时要点 |
| 顶层技能原文 | 1 | `ima-skill`（入口：全局规则 / 模块决策表 / 易混淆场景 / 跨模块读序 / 凭证 / 调用模板） |
| 入口附属 | 2 | `ima-skill-aux-01-ima_api`（= `ima_api.cjs`，两子模块共用的调用助手）、`-aux-06-meta`（`meta.json` 运行时依赖） |
| knowledge-base 模块 | 4 | `ima-knowledge-base` + `references/api.md` + `scripts/cos-upload.cjs` + `scripts/preflight-check.cjs` |
| notes 模块 | 3 | `ima-notes` + `references/api.md` + `scripts/note-images.cjs` |

**目录布局**：`ima/ima-skill`（3 条）、`ima/knowledge-base`（4 条）、`ima/notes`（3 条），索引留库根。
全库 98 条 = hostinger 57 + 根 3（三条自撰索引）+ lexiang 29 + ima 10。

**与 lexiang 的差异**：IMA 是真要跑脚本的技能（4 个 `.cjs`），本地卸载后 `ima_api.cjs` 也得从
`ima-skill-aux-01-ima_api` 取出来落临时目录再 `node` 跑。引导技能 `ima-skill` 已写明这一步，
否则 agent 会去 `./ima_api.cjs` 找不存在的文件。

## 已入库条目·quarkclouddrive 夸克网盘（2026-11-06 灌装 · 22 条）

姜先生 2026-11-06 决定：quarkclouddrive / lexiang / ima-skill 三者**全局卸载**，仓内保留原文、库内留检索快照
（这三者不常用）。夸克这批是本库唯一**含可执行 CLI 的第三方技能**，因此比 lexiang/ima 多一条踩坑记录。

| 类 | 条数 | 说明 |
|---|---|---|
| 自撰索引 | 1 | `quarkclouddrive-技能索引`（`7260fb2e-…`，留库根，另挂 `type:experience`） |
| 原文 | 1 | `quarkclouddrive` = 原 `SKILL.md`（319 行 / 39,953 B） |
| references | 12 | `quarkclouddrive-aux-01..12-references__*`（auth / assistant / file-ops / file-read / file-search / file-share / file-upload / file-rename / file-saveas / file-organize / file-batch-organize / membership-benefits） |
| scripts | 3 + 6 | `aux-13/14/20-scripts__*`（hash-worker.cjs / install.sh / uninstall.sh）+ `quark-drive.cjs.b64-part01..06` |

**目录布局**：`quarkclouddrive`（根 1）、`quarkclouddrive/references`（12）、`quarkclouddrive/scripts`（9），
索引留库根。全库 136 条。

### 必记的坑：manual 通道会内容过滤掉 minified JS 并**直接断连**

`scripts/quark-drive.cjs`（645,910 B，esbuild 单行 minified）原样 POST 到
`/knowledge-bases/<kb>/knowledge/manual` 返回的不是错误码，是 **TCP ECONNRESET**——服务端读完 body 直接关连接，
客户端只看到 `fetch failed`。multipart 的 `/knowledge/file` 同样断。

排查结论（2026-11-06 实测，逐条可复现）：

| 变量 | 实测 |
|---|---|
| 体积 | **无关**。`A`×1,200,000 纯填充走 multipart 200；该文件只 2,000 B 前缀也 RESET |
| 扩展名 | 无关。同样内容各扩展名都同样断 |
| 内容 | **相关**。同一文件换 base64 后，120,000 rune/段全部 200 |
| 稳定性 | 同一 payload 连测 5 次，5 次全 RESET；干净 payload 5 次全 200 —— 不是抖动/限流 |

所以处置是：**base64 存储，分段 ≤160,000 rune**（manual 上限 200,000 rune，留头部说明的余量），
每段头部写段号 + 全文 sha256 + 重组口径。**不要**尝试"再传一遍"或加 retry —— 它一定会失败。

还原：取 6 段 `metadata.content` → 删掉每段头部 4 行 `>` → 按序**首尾相连（不插换行）** → `base64 -d`。
2026-11-06 已按此法回读重组，`sha256=b19755822486…`，645,910 B，与仓内文件逐字节一致。

**同类风险**：以后往本库传任何 minified JS / 单行超长文件的原文，先按 base64 处理，别先怀疑体积。

### 登录态

删除安装副本前已把 `.agents/skills/quarkclouddrive/deepseek/config.json` 备份到
`~/.quarkclouddrive/backup/config-deepseek-20261106.json`（与既有的 `~/.quarkclouddrive/login-deepseek.json` 同源同 size）。
临时用成套技能时放回 `<副本>/deepseek/config.json` 即可免重新授权。

## 已入库条目·Craft 自研子技能（2026-10-28 灌装 · 13 条）

storytold/ArtCraft 是本仓自研套件（Adobe/Office 工具的 Rust 净室重实现）。13 个子技能不再外装，
真源留仓（`base/skills/storytold/<app>/SKILL.src.md`，frontmatter 标 `x-install: false`），
原文副本入本库 **目录 `craft/<app>`、条目 `craft-<app>`**，全 `publish`、全挂 `type:material`：
figcraft / vectorcraft / gridcraft / cadcraft / designcraft / deckcraft / soundcraft / filmcraft /
effectcraft / photocraft / lightcraft / pdfcraft / wordcraft（各 1 条）。索引 `craft-技能索引`（`dab1d23d-…`）留库根。

**与另外三批的差别**：本批**不是三方技能**，是本仓可改可优化的自研资产 —— 库内是**快照**，
改行为改仓内真源，改完 `ship install` 并用 `PUT /api/v1/knowledge/manual/<id>` 带
`{title, content, status:"publish"}` 回灌对应条目；否则库里就是过期文档，agent 照过期配方干活。

**消费路径**：`craft-router`（v0.2.0，唯一本地安装的 craft 技能）负责分流 + 取原文两条腿 + 维护口径；
13 个子技能目录已从 7 处技能根（含 `.codeartsdoer` 的 `huawei-cloud-codebuddy-*` 前缀变体）删净，共 91 个目录。

## 待挂清单与判据

**无待挂类型标的条目**（113/113 已挂 `type:material`，其中 lexiang 30 条 + IMA 11 条 + craft 13 条于 2026-10-28 批量挂载）。但有两条**待补**项，判据如下：

1. **来源标未建、条目未挂来源标**——本库 57 条 `tags` 原为全 null，连上传腿的来源标都没有
   （该库的灌装腿未走灵枢 / 批量文档上行通道，是直接 manual 建条目）。
   按建库基线口径（主技能「## 新建库」§5）应补 `文档上传` / `灵枢记忆` 两枚来源标并回挂。
   **本次未建**：本库灌装由外部脚本直建 manual 条目，尚无灵枢图片腿或批量上行腿接入，
   补了来源标也没有对应条目可挂（会重演「建了标没人挂」反模式）。待灌装收口、确认接入哪条上传腿后再补。
2. **`parse_status` 全为 `finalizing`（57/57），`chunk_count=0`**——灌装仍在进行（用户建库后立刻批量导入）。
   **本条不是挂标的阻塞项**：已实证 `finalizing` 条目可以挂标（16:5x 单条试挂 + 57 条批量挂载均 `success:true`，
   回读 `knowledge_count` 57）。但 chunk 未落定意味着**描述回写要等**：cookbook §9 的写回时机口径是
   **必须等 `parse_status=completed` 再 PUT title/description**，否则会被流水线覆盖。
   目前仅 3 条有 VLM 描述（`hostinger-dns` / `hostinger-deploy-to-hosting` / `hostinger-audit-hosting`），其余 description 为空。

## 建标方式

`POST /knowledge-bases/{kb}/tags`，body `{"name":"type:material","color":"#34a853","sort_order":100}`
一次传全（`name` 必填，`color`/`sort_order` 建标时带上，见主技能 cookbook §3；只传 name 会落默认值）。
本库两枚类型标即按此口径于 2026-10-20 16:51 建成（**先查后建**：建前 `GET /knowledge-bases/{kb}/tags`
回读 `total=0`、`data=[]`，未发重复请求，无 409）。

⚠️ **类型标是逐库建的，不共用 tag id**（每库标签空间独立）——本库两枚 id 与长兴库 / 设备管理库 /
TencentDB-Agent-Memory-1646ck3g 库的同名标**不是同一个 id**，别跨库抄。同名标在库内唯一，重发同名返 409。

**color 口径说明**：主技能「## 新建库」§5 给来源标定的是 `#9aa0a6` / `sort_order=900`；本库两枚是
**类型标**（不是来源标），故用类型标自己的色档（material 绿 `#34a853`、experience 蓝 `#4285f4`）与
`sort_order=100/101`（类型标档位，让位于后续主题标的 200 起）。若后续补来源标，仍按 §5 口径
`#9aa0a6` / `sort_order=900` 建，与本表两枚不冲突。

## 新增主题标的登记口径

按「一条结论挂 1 枚领域标 + 必要类型标 + 必要来源标」的最小口径走；主题标语义与长兴库（tag-registry.md）、
BPM 库（tag-registry-bpm.md）、设备管理库（tag-registry-shebei.md）、儿童成长日记库（tag-registry-children.md）
**不共用 id**——每库标签空间独立，别跨库抄 id。

本库预期的主题标方向（灌装收口后再建，先不建空标）：

- 按厂商 / 仓库分（如 `vendor:hostinger`、`vendor:anthropics`…）——第三方 skills 天然按厂商组织；
- 按技能包分（如 `pkg:hostinger-agent-skills`、`pkg:api-mcp-server`）。

## 检索面（消费方）

- 库内语义查：`hybrid_search(kb_id, query)`（MCP 腿）或 REST `POST /knowledge-bases/{kb}/hybrid-search`，
  **body 字段是 `query_text`（不是 `query`）**（cookbook §0a 尾段）。
- 「找技能」时的检索源之一：全局技能 `find-skills` 已把本库列为外部生态之外的本机 WeKnora 技能源
  （同列 `b822071a-fb95-4e98-b05d-aa33da685a42`「生成技能」）。
- 按类型标两步法（REST `GET /knowledge-bases/{kb}/knowledge?tag_ids=<type:material id>` → 语义读）见主技能「查询」节。
