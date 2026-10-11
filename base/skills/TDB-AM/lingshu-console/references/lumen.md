# lumen · 灵枢全景页（读 + 受控写）

**入口**：`https://hanjiangxue.icu:8443/lumen/`（挂现役灵枢服务器 :8000 的 console 面，PRD 89 工单 89-01）。

## 是什么

kiosk 的数据超集，人用浏览器直接看灵枢全部数据：

- **overview**：跨会话全量统计（会话数 / md 文件数 / 数据量 / 层级分布）+ 服务健康观测；
- **memories**：选会话看记忆条目（类型/层级/标签过滤 + 分页），单条点开读全文；
- **记忆管理（工单 89-04，页面写能力）**：每条记忆可「编辑 / 删除 / 恢复」——
  edit 是整块覆盖（页面预填原文、确认后提交），delete 恒软删（必填 reason，进
  回收站），restore 撤回软删（支持直接填节点 id 恢复）；
- **recall 试查**：输入自然语言问题做语义检索（只读白名单）；
- **会话文件树**：各会话 md 落盘浏览（kiosk 原有能力，`/kiosk/api/*` 原样保留）。

## 安全边界（三层，与 kiosk 同源）

1. nginx 注入共享密钥头（`X-Lingshu-Kiosk`，密钥只在服务端 secrets）；
2. 请求自带 WeKnora 凭据（页面读 `localStorage['weknora_token']`）反送 `/auth/me` 验真；
3. 白名单：读限 `memory_list` / `memory_recall`；写（工单 89-04）限 `memory_manage` 的
   edit/delete/restore 三个动作，且受独立写闸 `LINGSHU_CONSOLE_WRITE`（缺省开）。

**管理动作两条路**：改/删/恢复既可在本页直接操作（edit 整块覆盖、delete 恒软删带
reason、restore 撤回），也可继续走 `lingshu-console` 技能的工具面；批量/复杂治理
建议走技能面，单条修正用页面更直接。

## 机制要点（排障用）

- 「看所有数据」的口径：文件层跨会话聚合（overview）；内核层**按会话查看**
  （灵枢数据按 `MDCG_ROOT=data_root/<session_id>` 分根，memories/recall 落在目标会话
  自己的内核上——缺省取最近活跃会话，可 `?session=<id>` 显式指定）。
- 未配密钥/验真腿或 `LINGSHU_CONSOLE_ENABLED=0` 时整面 404；直连 :8000 无密钥 401。
- 写能力由 `LINGSHU_CONSOLE_WRITE` 独立闸控（缺省开；显式关闭时写端点 404、页面
  收起编辑/删除入口回退纯只读，读不受影响）。
- **软删深读有 readcache 可见性窗口（E16 实测）**：delete 后短窗内单条深读仍返回
  删除前内容（列表即时消失为准），restore 后首读也可能拿到缓存旧版；以列表命中为
  判准，删后立刻深读验证要绕开缓存窗。前端已带 `truncWarn` 截断防护（长条目深读
  是截断视图，页面编辑自动禁用，防截断内容覆盖真原文）。
- 部署形态：FastAPI 直出页面（payload 自带 `lumen_static/`），nginx 只需一条
  `location /lumen/` 反代 + 注密钥头；部署步骤见 `docs/deploy-lingshu-server-tencent-cloud.md`
  与 `.scratch/DEPLOY-CHECK.md` E12 行。
