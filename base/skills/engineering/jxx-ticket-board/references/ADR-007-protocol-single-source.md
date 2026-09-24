# ADR-007：协议以 control/PROTOCOL.md 单一真源承载，agent 靠固定启动行入职

- 状态：已接受（2026-09-21）
- 关联：memorial 001 D8；ADR-002、ADR-004

## 背景

公告板协议要生效，每个被用户拉起的 agent 必须在行动前完整获知规则。候选：固化为全局技能、写入仓库 AGENTS.md、单一协议文档 + 启动行。worker 领卡时尚未进入任何 worktree，"仓库内文档"存在鸡生蛋问题；技能触发靠 description 匹配不保证命中，且协议演化期固化过早。

## 决策

1. `control/PROTOCOL.md` 是协议唯一真源：卡模板、目录状态机 move 规矩、命名、开发卡/审查/合并卡规则、禁止事项。
2. 用户拉起任何 agent（领导者/开发/合并专员）时贴同一句启动行："先完整阅读 `<绝对路径>\control\PROTOCOL.md`，工作规则以它为准"。
3. control/ 下按角色提供启动提示词模板（leader/dev/merger），拉起时复制即用。
4. 协议稳定后，可升级为技能（如 `jxx-ticket-board`）以省去贴启动行——届时另立决策。

## 后果

- 正面：真源唯一、随试随改、零 harness 依赖；角色差异体现在模板而非协议分叉。
- 负面：漏贴启动行 = agent 无规则运行，靠人的一步纪律；PROTOCOL.md 本身无版本化（在 git 外），重大修订应在卡目录旁留 CHANGELOG 或定期快照。
