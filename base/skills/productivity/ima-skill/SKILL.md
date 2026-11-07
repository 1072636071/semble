---
name: ima-skill
version: 2.0.0
x-install: false
description: "IMA（腾讯 ima.qq.com）OpenAPI 引导程序：笔记管理与知识库操作的原文已迁入 WeKnora 知识库 dfaaf6fc。当用户提到知识库、资料库、笔记、备忘录、记事，或要上传文件、添加网页到知识库、搜索知识库内容、创建/编辑笔记时触发。"
---

# IMA（ima-skill）引导程序

**本技能不含操作细节**：IMA 官方技能包（入口 + `knowledge-base` + `notes` 两个子模块，10 个文件 ≈126 KB）
已于 2026-10-28 从所有 agent 技能目录卸载，原文与脚本存放在 WeKnora 知识库
`dfaaf6fc-1e5d-4385-a290-58c847d71bcb`（第三方官方 skills 知识库，目录 `ima/`）。
要做 IMA 任务，先按本文取原文与脚本，再照原文执行。

## 固定边界（不变）

- Base URL 只有 `https://ima.qq.com`，所有请求 `POST` + JSON body。
- 凭证只作 HTTP 头发给 `ima.qq.com`；文件上传用 API 返回的**临时 COS 凭证**（`*.myqcloud.com`），主凭证绝不发往 COS。
- 凭证来源优先级：环境变量 `IMA_OPENAPI_CLIENTID` / `IMA_OPENAPI_APIKEY` → 配置文件 `~/.config/ima/client_id` + `~/.config/ima/api_key`。申请页 `https://ima.qq.com/agent-interface`。
- 缺凭证时 `node ima_api.cjs ...` 以 `code: -100` 退出：先引导用户配置，再发任何请求。
- 任一前置检查 / 上传 / 写入失败即停，按响应 `msg` 向用户说明；不用原始 URL 或未校验文件兜底。

## 取原文与脚本（三步）

所有请求头带 `X-API-Key`（现取现用：凭据腿 `~\Nutstore\1\我的坚果云\项目机密\Secret\WeKnora-知识库-API密钥.md`，
不落盘、不回显、不进产出物）。REST 根 `http://123.206.125.149:8127/api/v1`，库 id `dfaaf6fc-1e5d-4385-a290-58c847d71bcb`，
UI `http://123.206.125.149:8127/platform/knowledge-bases/dfaaf6fc-1e5d-4385-a290-58c847d71bcb`。

1. **查索引**：读条目 `ima-技能索引`（库根），确认走哪个模块。
2. **取原文**，两条腿：
   - **语义腿**（首选）：`POST /knowledge-bases/<kb>/hybrid-search`，body `{"query_text":"<模块> <动作>","limit":5}`。
   - **确定腿**（语义腿返 `code=1007` 或 embedding 连接失败时）：`GET /knowledge-bases/<kb>/knowledge?folder_path=ima/<模块>&page_size=50` → `GET /knowledge/<id>` 读 `metadata.content`。不依赖向量服务。
3. **脚本落盘再跑**：库里 `ima-skill-aux-01-ima_api` 就是 `ima_api.cjs` 原文，取下来写到临时目录
   （如 `<temp>/ima/ima_api.cjs`）后 `node <temp>/ima/ima_api.cjs <action> ...`；子模块脚本同理
   （`ima-knowledge-base-aux-02..03`、`ima-notes-aux-02`）。用完可留可删，别写进技能目录。

## 模块决策（细节都在原文里，这里只判路由）

| 用户意图 | 模块（库内目录） | 关键动作 |
|---|---|---|
| 搜索 / 浏览 / 读 / 创建 / 追加笔记、笔记插图 | `ima/notes` | `search_doc`、`get_doc_content`、`import_doc`、`append_doc` |
| 上传文件、加网页、搜知识库、看原文 | `ima/knowledge-base` | `create_media` → COS → `add_knowledge`、`get_media_info` |
| 入口规则 / 易混淆场景 / 跨模块读序 | `ima/ima-skill` | 全局规则表 |

- 目标是**笔记内容**（读 / 写 / 追加）→ notes；目标是**知识库条目**（传文件、加链接、关联笔记）→ knowledge-base。
- 意图同时涉及两者，或响应揭示需要另一模块（`media_type=11` = 笔记），**必须先读两个子模块 SKILL.md** 再动手。
- 「添加到笔记里」但没指定哪篇 → 先问用户是新建还是追加到已有笔记，不要猜。
- 笔记插图换链必须由 notes 模块完成，不许用知识库的 `create_media` / `add_knowledge` 代替。
