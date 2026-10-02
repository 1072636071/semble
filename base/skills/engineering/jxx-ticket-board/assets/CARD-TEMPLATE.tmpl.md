# {{ID}}

- 标题: {{TITLE}}
- 难度: {{LEVEL}}
- 模型档位: {{MODEL}}
- Harness:
- LLM:
- 开始处理:
- 结束处理:
- 依赖: {{DEPS}}
- labels: {{LABELS}}
- doc_ref: {{DOC_REF}}
- PRD: （投卡带 --ticket-file 自动填工单绝对路径）
- 合入目标: （一律 main，v0.14.0 起默认回合主分支：审查通过、确认没影响后直合；技术受阻时合并专员按 PRD 指针暂存 PRD 分支 ticket/<NN>-<slug> 并汇报原因，见 PROTOCOL §3）
- 目标: （一句话，领导者填写）

<!-- 三态 + 标签正交（D9 / ADR-008）：目录 = 生命周期（open/ 未收口 · done/ 已收口 · archived/ 废弃让位），
     文件名后缀 = 执行态（open/<id>.md 待领 · .claimed.md 在办 · .review.md 待终审），
     本行 labels = triage 下一步（五标签：ready-for-agent / ready-for-human / needs-info / needs-triage / wontfix）。
     受阻不再靠 blocked/ 目录表达：`card-move --to blocked` 会把卡留在 open/ 并自动打上 needs-info。
     doc_ref 是服务器工单 URL（`<部署域>/tickets/<工单id>`；服务器优先口径下优先经 jxx_ticket_push/pull 投影自动带出，手填仅作兼容）；
     本地工单文件路径写 PRD 行，两者别混。留空 = 尚未上行服务器。
     处理计时四行（Harness / LLM / 开始处理 / 结束处理）是**统计面**：`card-move` 进 claimed 位自动盖开始、离开时盖结束，
     harness 名与 LLM 模型名由领卡会话用 `--harness <名> --llm <名>` 自报；这四行**不参与判位**（位置的唯一真源是文件名后缀），留空不影响流转。
     确定性路径（card read 实时推导，不占卡面）：分支 ticket/{{ID}} · worktree {{ROOT}}/wt/{{ID}}/ · 推进 /jxx-implement（PROTOCOL §2） -->

## 领取记录

（领取者 / 领取时间 / 依赖核对——分支与 worktree 为确定性路径，由 card read 推导）

## 外部契约

（**本卡若消费别仓/别分支的服务端契约，必须写取证坐标**：仓库 + 分支 + commit SHA + `文件:行`，例 `MyWeKnora` 分支 `fork/<卡id>` @ `0b2e3cdc` · `internal/router/routes_jxx_ticket.go:25`。`/jxx-code-review` 步骤 0b 与合并专员终审都按该坐标**只读**取证：`git -C <仓> show <SHA>:<路径>`，禁 checkout 对方分支（PROTOCOL §3 尚未列这一步，欠账登记在口径正文）。**本节留空 = 判定为无外部契约**；若实现明显消费了外部接口而本节空着，审查按发现项报「契约坐标缺失」。口径正文见 `docs/agents/external-contract-evidence.md`。）

## 交付记录

（提交范围 + 审查报告指针，交付时由开发组追加）

## 终审待验清单

（交付时由开发组逐条列出"终审需实证的事项"：验收标准关键项、自报结论、越界与豁免声明；合并专员按 §3 先审后合逐项打 ✓/✗）

## 流转追加段

（每次状态流转一行：时间 | from->to | 角色 | 一句话原因）
