# 设备管理库标签台账（tag-registry-shebei）

> kb `ff4696b2-606b-4abe-aa51-79ca82a16675`（设备管理 · 项目知识库 · 消费方 `E:\work\work-sp\设备管理`）·
> 来源两标 2026-10-11 建库时落档，下表的 tag id / color / sort_order / 引用数均为当日与建库后 REST 回读值 ·
> 挂标前先取 id；批量改标是 **replace 语义**（`PUT /knowledge/tags`），必须先读旧标取并集（主技能 cookbook §4）。

## 标签全表

| name | tag id | color | sort_order | 用途 | 当前引用数 |
|---|---|---|---|---|---|
| 文档上传 | `24fbefd1-c150-490b-af5a-714dfed05719` | `#9aa0a6` | 900 | 来源标：文档 / 手工文本笔入库挂这枚 | 1 |
| 灵枢记忆 | `dcfcfeb5-0c38-4cc4-ad3a-43c1f51e57ca` | `#9aa0a6` | 900 | 来源标：图片笔经灵枢 `memory_remember` 入库挂这枚 | 0 |

本库**暂无领域主题标**。后续新增主题标在此登记，`sort_order` **接续**现有档位（来源两标占 900，
主题标别再撞 900；按领域归组递增即可）。

## 已入库条目（2026-10-11 首批）

| knowledge_id | title | 标签 |
|---|---|---|
| `e51d9424-8144-4dd0-970e-ee40a298e8e9` | 设备管理 项目知识库接入记录（2026-10-11） | 文档上传 |

`parse_status=completed`；全库共 1 条 manual（2026-10-11 REST 回读）。

## 建标方式

`POST /knowledge-bases/{kb}/tags`，body `{"name":"…","color":"#9aa0a6","sort_order":900}`
（`name` 必填，`color`/`sort_order` 可在建标时一次带上，见主技能 cookbook §3）。只传 `name` 也能建，
但 color / sort_order 会落默认值——本库口径是**一次传全**。同名重复建库内唯一，重发同名返 409（`标签名称已存在`）。

## 新增主题标的登记口径

按「一条结论挂 1 枚领域标 + 必要来源标」的最小口径走；主题标语义与长兴库（tag-registry.md）、
BPM 库（tag-registry-bpm.md）**不共用 id**——每库标签空间独立，别跨库抄 id。
