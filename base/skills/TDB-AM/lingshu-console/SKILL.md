---
name: lingshu-console
description: 灵枢资源管理：查改删记忆、找图、管项目库、lumen 全景。触发词：灵枢管理、改记忆、删记忆。
version: 0.1.0
x-scope: global
disable-model-invocation: false
---

# 灵枢资源管理台（lingshu-console）

本技能是**薄 wrapper**（同 `kb-router` / `deploy-router` 的做法）：只给路由、契约与纪律，
**不内嵌实现**——工具契约的唯一权威真源是灵枢门面 `server/tools/*.py` 的 `inputSchema`
（速查见 [references/actions.md](references/actions.md)，漂移时以真源为准并回写本技能）。

## 何时用 / 何时不用

- ✅ 用：看灵枢里有什么数据（记忆 / 对话 / 场景 / 技能 / 蒸馏）、按 id 精确读一条、
  语义召回试查、改记忆、软删/恢复记忆、导出记忆、找已入库图片、管理项目知识库映射。
- ❌ 不用：保存知识/文档/图片素材到 WeKnora（→ `kb-router`）；写新记忆（→ `tdai-memory-capture`
  的写入通道，或直接 `memory_remember`）；部署灵枢服务（→ `deploy-router`）。

## 三步分流（按顺序问）

1. **看数据？** → `memory_list`（精确：类型/时间窗/标签过滤 + 分页 + node_id 深读）、
   `memory_recall`（语义：自然语言找）、`memory_graph`（关系：search 拿 id → neighbors 多跳 → asof 回溯）、
   `memory_manage(action=status)`（健康 + 统计 + 身份）。人要浏览 → 指路 lumen 页（见下）。
2. **改数据？** → `memory_manage` 六动作：`edit`（整块覆盖改）/ `delete`（软删，可撤回）/
   `restore`（撤回删除）/ `export`（导出 JSON/Markdown）/ `sync`（pull 摄取 / push 落盘）。
   **写前纪律见下节，逐字遵守。**
3. **找图 / 管库？** → `memory_image`（按文本找已入库图片，只读）、
   `memory_project_kb`（项目库幂等 ensure，返回 kb_id）。

## 写操作纪律（硬约束，逐字遵守）

1. **写前必读原文**：`edit` / `delete` 前先用 `memory_list`（带 node_id）或 `memory_recall`
   拿到原文并向用户复述「将要把 X 改成 Y / 将要删除 X」；用户未确认不得执行。
2. **delete 恒软删**：内核 trash 可 `restore` 撤回；删前带 `reason`（进遗忘史）。
   任何「彻底删除」诉求先明说「本面只有软删」，不得伪造硬删。
3. **edit 是整块覆盖**：新内容必须包含用户想保留的全部原文——给出 diff 预览再执行。
4. **逐条回报**：每个动作执行后回报 `{ok, node_id, …}` 与可行动错误（门面错误信封是
   中文且带 trace，原样转述，不要吞）。
5. **生产记忆先小步**：批量操作（export → 改 → sync pull）先在单条上走通全链路再放量。

## lumen 全景页（读 + 受控写）

人要在浏览器里看灵枢全部数据时，指路 **lumen**（`https://hanjiangxue.icu:8443/lumen/`，
部署细节见 [references/lumen.md](references/lumen.md)）：跨会话全景统计、记忆列表、
单条详情、recall 试查；自工单 89-04 起页面支持**单条记忆的编辑/删除/恢复**（edit
整块覆盖、delete 恒软删带 reason、restore 撤回，受 `LINGSHU_CONSOLE_WRITE` 独立闸）。
批量治理、状态观测、导出/同步仍走本技能的工具面；人在页面上改了什么没有 agent
留痕，涉及重要记忆的变更建议仍经本技能走「写前复述原文」纪律。

## 保鲜约定

- 工具参数 / 返回形状以 `server/tools/*.py` 的 `inputSchema` 与 `execute()` 为唯一真源；
  门面升级后本技能按漂移回写（判定口诀：**契约进 actions.md，路由进 SKILL.md，页面进 lumen.md**）。
- 本技能真源在 JwikisSkills `base/skills/TDB-AM/lingshu-console/`；本项目仓内 `agents/skills/`
  的同名目录是只读镜像（`ship` 同步），**不要直接改镜像**。
