<!-- ask-matt-index:start -->

# 未安装技能索引（自动生成 · 勿手改）

生成自 `base/scripts/ask-matt-index.mjs`：共 **22** 个 jxx 技能未随 `ship install` 分发。
这些技能不进环境里的技能列表；用户点名或意图命中时，按下表「真源」直接读文件，不要去 skills 目录找同名技能。

| 技能 | 何时用 | 真源 | 额外资源 | 未装原因 |
| --- | --- | --- | --- | --- |
| `jxx-agnes-image` | Agnes Image 生图与改图；触发：要生成图片 画图 改图 多图合成 风格迁移 做海报封面时 | `base/skills/productivity/jxx-agnes-image/SKILL.src.md` | `scripts` | x-install: false |
| `jxx-agnes-video` | Agnes Video 文生视频、图生视频、首尾帧与参考图/音频；触发：要生成视频 做短片 图生视频 首尾帧动画时 | `base/skills/productivity/jxx-agnes-video/SKILL.src.md` | `scripts` | x-install: false |
| `jxx-claude-handoff` | 将当前对话交接给新的后台 claude agent 立即接手；触发：说交接 handoff 起个后台 agent 时 | `base/skills/in-progress/jxx-claude-handoff/SKILL.md` | — | 桶 in-progress 未分发 |
| `jxx-edit-article` | 编辑改进文章：重组章节、提升清晰度、精炼文字；触发：要修订或改进文章草稿时 | `base/skills/personal/jxx-edit-article/SKILL.md` | — | 桶 personal 未分发 |
| `jxx-grill-me` | grill 计划或设计，逐轮追问到无遗留问题；触发：说 grill 一起决策时 | `base/skills/productivity/jxx-grill-me/SKILL.md` | — | x-inline |
| `jxx-grill-with-docs` | grill 计划或设计，同时产出 ADR 与词汇表；触发：说 grill 讨论设计 且在工作目录里时 | `base/skills/engineering/jxx-grill-with-docs/SKILL.md` | — | x-install: false |
| `jxx-grilling` | 对计划或设计穷追不舍地追问；触发：想在构建前压力测试计划 或使用任何 grill | `base/skills/productivity/jxx-grilling/SKILL.md` | — | x-inline |
| `jxx-mcp-design` | 设计 MCP Server 的渐进式发现架构与工具分层；触发：要设计或重做 MCP 问工具该怎么分层 怎么被发现时 | `base/skills/engineering/jxx-mcp-design/SKILL.md` | `references` | x-install: false |
| `jxx-migrate-to-shoehorn` | 将测试文件从 `as` 类型断言迁移到 @total-typescript/shoehorn；触发：提到 shoehorn 想替换 `as` 或需要部分测试数据时 | `base/skills/misc/jxx-migrate-to-shoehorn/SKILL.md` | — | 桶 misc 未分发 |
| `jxx-obsidian-vault` | 在 Obsidian vault 中搜索、创建、整理笔记，使用 wikilinks 与索引笔记；触发：要在 Obsidian 里找 建或整理笔记时 | `base/skills/personal/jxx-obsidian-vault/SKILL.md` | — | 桶 personal 未分发 |
| `jxx-perf-iteration` | Rust 专用的性能压榨循环：以 criterion 基准为准，一轮一个可判过/不过的硬指标，逐轮审 diff 防作弊，再用质量闸卡住提速…；触发：要把某个 Rust crate 或热路径优化到指定倍数（比 umap-learn xgboost 同类 crate 快  | `base/skills/engineering/jxx-perf-iteration/SKILL.src.md` | `references` | x-install: false |
| `jxx-prototype` | 构建一次性 prototype 回答设计问题；触发：想验证某个状态模型或逻辑是否成立 或要看 UI 长什么样时 | `base/skills/engineering/jxx-prototype/SKILL.md` | `assets`/`references` | x-install: false |
| `jxx-scaffold-exercises` | 创建练习目录结构（sections / problems / solutions / explainers）并过 lint；触发：要搭练习骨架或新建 course section 时 | `base/skills/misc/jxx-scaffold-exercises/SKILL.md` | `scripts` | 桶 misc 未分发 |
| `jxx-setup-pre-commit` | 在仓库配置 Husky pre-commit hooks：lint-staged、typecheck、tests；触发：说 pre-commit husky 时 | `base/skills/misc/jxx-setup-pre-commit/SKILL.md` | `scripts` | 桶 misc 未分发 |
| `jxx-t2i-prompts` | 文生图提示词模板库与组稿流程；触发：要文生图提示词 画图提示词 按平台改组稿时 | `base/skills/productivity/jxx-t2i-prompts/SKILL.src.md` | `references`/`scripts` | x-install: false |
| `jxx-teach` | 在当前工作区内教用户新技能或概念；触发：想学某主题 说教学时 | `base/skills/productivity/jxx-teach/SKILL.md` | `assets`/`references` | x-install: false |
| `jxx-to-questionnaire` | 把对话中 agent 答不了的待决问题转成措辞中立的问卷；触发：说问卷 questionnaire 要问别人时 | `base/skills/productivity/jxx-to-questionnaire/SKILL.md` | — | x-install: false |
| `jxx-wait-what` | 当 agent 刚说过什么而用户没听懂时，用更简单的说法重讲上一段回答；触发：说没看懂 wait what 时 | `base/skills/productivity/jxx-wait-what/SKILL.md` | — | x-install: false |
| `jxx-wizard` | 生成一个交互式 bash 向导，引导人完成手动多步流程。当 agent 卡在一串需要人操作的步骤、checklist 不够用时触发。不替人… | `base/skills/engineering/jxx-wizard/SKILL.md` | `scripts` | x-install: false |
| `jxx-writing-beats` | 写作 exploit 阶段：把原始素材组装成节奏（beat）旅程，每个概念先锚定再使用；触发：有素材要成文时 | `base/skills/in-progress/jxx-writing-beats/SKILL.md` | — | 桶 in-progress 未分发 |
| `jxx-writing-fragments` | 写作 explore 阶段：挖掘原始碎片，暂不构建结构；触发：要先把素材吐出来时 | `base/skills/in-progress/jxx-writing-fragments/SKILL.md` | — | 桶 in-progress 未分发 |
| `jxx-writing-shape` | 写作 exploit 阶段：把原始素材逐段塑造成完整文章；触发：有素材要成文时 | `base/skills/in-progress/jxx-writing-shape/SKILL.md` | — | 桶 in-progress 未分发 |

## 读源规则

1. 「真源」列是相对 **JwikisSkills 仓根**的路径（本机 `E:\work\sp\JwikisSkills`）；在别的工作区用本路由时先定位该仓根，再按相对路径读。
   读 `SKILL.md` / `SKILL.src.md` 全文；相对链接与脚本以该文件所在目录为基准，
   `references/` `scripts/` `assets/` 等随目录一同存在（见「额外资源」列）。
2. `x-inline` 的技能是内联源：正文也可能已注入引用技能的「内联技能原文」段；两处同源于仓内真源，任取其一。
3. 不要修改已安装副本；改这些技能一律改仓内真源。索引过期（卸载/新增/改 description 后）跑
   `node base/scripts/ask-matt-index.mjs` 重新生成，`ship check` 会挡住过期索引。

<!-- ask-matt-index:end -->
