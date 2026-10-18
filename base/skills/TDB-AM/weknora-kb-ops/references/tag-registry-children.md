# 儿童成长日记库标签台账（tag-registry-children）

> kb `af0160f1-fa7e-437e-bf14-3743107d5527`（儿童成长日记 · tenant 10006「大妞niu」空间 · 家庭个人向内容）·
> 来源两标 2026-10-14 建，下表的 tag id / color / sort_order / 引用数均为当日 REST 回读值 ·
> 挂标前先取 id；批量改标是 **replace 语义**（`PUT /knowledge/tags`），必须先读旧标取并集（主技能 cookbook §4）。
>
> ⚠️ **本库跨 tenant**：必须用 tenant 10006 的 key（`tdai-children-10006`，明文在机密仓
> `TencentDB-Agent-Memory/weknora-credentials.md` §9，只此一份、只取不回显）；tenant 10001 的 key 访问本库一律 **403**
> （Permission denied，不是 404、不是 key 失效）——WeKnora 按 tenant 隔离知识库。

## 标签全表

| name | tag id | color | sort_order | 用途 | 当前引用数 |
|---|---|---|---|---|---|
| 文档上传 | `ddf4461e-d627-450a-a397-5b682b20ec9b` | `#9aa0a6` | 900 | 来源标：文档 / 手工文本笔入库挂这枚 | 0 |
| 灵枢记忆 | `bce2539c-f760-45ee-add6-0fabd7b4776c` | `#9aa0a6` | 900 | 来源标：图片笔经灵枢 `memory_remember` 入库挂这枚 | 0 |

本库**暂无领域主题标**（2026-10-14 建库，0 条内容）。后续新增主题标在此登记，`sort_order` **接续**现有档位
（来源两标占 900，主题标别再撞 900；按领域归组递增即可）。

## 已入库条目

**暂无**（2026-10-14 REST 回读：全库 0 条 knowledge，空库）。

## 建标方式

`POST /knowledge-bases/{kb}/tags`，body `{"name":"…","color":"#9aa0a6","sort_order":900}`
（`name` 必填，`color`/`sort_order` 可在建标时一次带上，见主技能 cookbook §3）。只传 `name` 也能建，
但 color / sort_order 会落默认值——本库口径是**一次传全**。同名重复建库内唯一，重发同名返 409（`标签名称已存在`）。
本库两枚来源标即按此口径于 2026-10-14 一次传全建成（先查后建，未发重复请求）。

## 新增主题标的登记口径

按「一条结论挂 1 枚领域标 + 必要来源标」的最小口径走；主题标语义与长兴库（tag-registry.md）、
BPM 库（tag-registry-bpm.md）、设备管理库（tag-registry-shebei.md）**不共用 id**——每库标签空间独立，别跨库抄 id。
