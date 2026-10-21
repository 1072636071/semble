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
| `type:material` | `7b162c17-660c-4d65-b9d9-44ae4c0016bf` | `#34a853` | 100 | 通用类型标：项目使用到的资料——第三方官方 SKILL.md 原文（主技能「通用类型标」节） | 57 |
| `type:experience` | `3c6f9c9a-ba11-44aa-8dc6-3ebd5081a867` | `#4285f4` | 101 | 通用类型标：项目自身的踩坑 / 接入实录——本库自身的接入与灌装记录 | 1 |

**本库暂无来源标**（`文档上传` / `灵枢记忆`）与领域主题标（2026-10-20 快照）。原因见「待挂清单与判据」。
后续新增主题标在此登记，`sort_order` **接续**现有档位（类型两标占 100/101，主题标从 200 起，别再撞）。

## 已入库条目（2026-10-20 快照 · 灌装中）

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

## 待挂清单与判据

**无待挂类型标的条目**（57/57 已挂 `type:material`）。但有两条**待补**项，判据如下：

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
