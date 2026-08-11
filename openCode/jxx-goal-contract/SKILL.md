---
name: jxx-goal-contract
description: 目标契约固化（goal contract）——将模糊任务收敛为可执行的 GOAL.md 契约，支持多目标隔离存储、重复与追加；三种模式：默认推进、发现优先、Grilling 追问。
---

# 目标契约固化

将模糊任务收敛为可执行的 `GOAL.md` 契约。契约是目标模式循环的唯一判停依据。

## 目标存储结构

所有目标统一存储在工作区根目录的 `.goals/` 下，按目标名称隔离：

```
.goals/
├── _index.md                    # 目标索引
├── {name}/
│   ├── GOAL.md                  # 契约文件
│   ├── PROGRESS.md              # 执行进度
│   └── EVIDENCE.md              # 交付证据
```

状态取值：`契约中` / `执行中` / `已暂停` / `已完成` / `已失败`。目标名称从交付物中提取简短英文 kebab-case，唯一不可重名。

## Guidelines

- 新建目标：确定名称，创建 `.goals/{name}/` 目录，走契约固化流程，写入 GOAL.md，初始化 PROGRESS.md，更新 `_index.md` 状态=`契约中`。
- 继续目标不经过本技能——由 `jxx-goal-mode` 直接路由到 `jxx-goal-execute` 断点恢复。仅当用户要在继续前修改契约时才走"追加到已有目标"流程。
- 重复目标：读取旧 GOAL.md 作为起点，询问原样重复还是调整。原样重复则复制 GOAL.md、重置 PROGRESS.md、状态改回`契约中`；调整则以旧契约为起点走对应模式流程。
- 追加到已有目标：先读取旧契约，以旧契约为起点，仅对新增部分走对应模式流程，合并后写入。
- 异常处理：写入序列（GOAL.md → PROGRESS.md → `_index.md`）中途失败时，清理已写入部分回到写入前状态。完整处理表见 [references/error-recovery.md](references/error-recovery.md)。
- 契约一旦固化后即冻结。后续如需调整，不擅自改——停下来向用户说明并取得确认后再改。

## 契约结构

契约由 5 个字段组成：Goal、Acceptance、Constraints、Budget、Pause Conditions。模板见 [references/goal-contract.md](references/goal-contract.md)。关键设计：Pause Conditions 独立于 Constraints——Constraints 划技术边界（不可逾越的线），Pause Conditions 列高风险场景（需要人类决策才能继续）。

## 模式选择

| 任务特征 | 模式 | 理由 |
|----------|------|------|
| 低风险 + 领域熟悉 | 默认推进 | 不拦用户填表，直接给推荐版 |
| 低风险 + 陌生领域 | 发现优先 | 先调研再实施 |
| 高风险（账号/付费/生产/法律/版权） | Grilling | 必须逐维度确认 |
| 用户要求详细追问 | Grilling | 尊重用户偏好 |

### 默认推进模式

低风险不确定性不拦用户填表，直接给最佳默认方案。流程：重述为结果（把用户请求改写为具体交付物）→ 选保守默认 → 目标确认门（一句话反馈用户确认，不可跳过；目标模糊则委托 `jxx-grill-me` 收敛）→ 生成草稿（不展示）→ 自检-修正内循环（对照否决门逐条检查，通过后启动独立 subagent 检查）→ 输出推荐执行版（附默认理由和编号选择题）。

模糊词（"高级""有质感""专业"）不删除，翻译为验证条件（截图检查、对照参考站点、列出覆盖项清单、走通核心流程）。

### 发现优先模式

陌生领域不假装懂，先调研再实施。在 Goal 中加入"先读取项目文档/样例数据/现有脚本"；Acceptance 加入"识别并读取权威参考资料"；Constraints 加入"不编造领域结论/数据语义/合规声明"；Budget 预留 1-2 轮给发现阶段；Pause Conditions 列出该领域的高风险暂停场景。

### Grilling 模式

高风险任务或用户要求时，逐维度追问直到契约各维度可执行。一次只问一个维度（Goal → Acceptance → Constraints → Budget → Pause Conditions），每个问题附推荐答案，最多 3 轮追问。详细问题模板见 [references/grilling-guide.md](references/grilling-guide.md)。

## 验收标准设计

每条 Acceptance 必须满足：可观测（指向外部可见的状态或行为）、可判定（存在明确的通过/失败判定）、独立来源（证据来自 AI 之外）、绑定验证命令（末尾以 `（验证：`<命令>`）` 绑定一条可执行命令）。确实无法命令化的（如视觉走查），降级为绑定具体外部产物 + 检查清单。"人工看看""我觉得 OK"一律否决。好/坏对照见 [references/acceptance-patterns.md](references/acceptance-patterns.md)。

## 契约否决门

契约写入 GOAL.md 前必须通过全部否决门。任一否决 = 不可写入，必须修正后重新检查。

| 门 | 检查内容 | 否决条件 |
|----|----------|----------|
| V1 | Goal 只说"什么"不含"怎么做" | 出现动词短语描述步骤 |
| V2 | Goal 包含交付物形态 + 意图 | 缺少形态或意图 |
| V3 | 每条 Acceptance 可观测、可判定、独立来源 | 出现主观词/同义反复/无独立证据 |
| V4 | Acceptance ≥ 3 条 | 少于 3 条 |
| V5 | Constraints 只划边界不写步骤 | 出现"先…再…最后…"等过程描述 |
| V6 | Constraints ≥ 3 条（技术栈 + 范围 + 保护性） | 少于 3 条或缺少任一 |
| V7 | 无执行计划/拆解步骤混入契约 | 出现"阶段""步骤""第一步"等 |
| V8 | Budget 有最大轮数 + 时间上限 | 缺少任一 |
| V9 | Pause Conditions 显式声明 | 缺失（即使为"无"也必须显式声明） |
| V10 | 每条 Acceptance 绑定可执行验证命令 | 缺少 `（验证：...）` 或绑定物是"人工确认/AI 自评" |

检查方式：自检（主 agent 逐门显式回答）→ 独立检查（启动独立 subagent，只接收契约草稿原文 + 否决门规则，不接收生成过程）→ 双重通过才可输出。降级路径：宿主无 subagent 能力时降级为换视角复检——抛开生成过程，以第三方姿态仅凭契约原文逐门检查。

## 反模式

- 模糊目标——"做好一个网站"。回 grilling 磨清。
- 验收同义反复——"功能正常工作"。替换为具体可检查的行为。
- 约束过死——详述"怎么做"，退化回过程模式。
- 占位符——`[Outcome]`、`TODO`、`待定` 出现在推荐执行版中。
- 模糊词当验收——"高级""有质感"作为完成标准。翻译为截图/检查/迭代规则。
- 无命令验收——验收只写断言不绑定验证命令。
- 无限循环——没有预算上限。设上限。
- 目标名称冲突——新建目标与已有目标同名但不打算继续/重复。

## References

- [references/goal-contract.md](references/goal-contract.md) — 契约模板与填写示例。
- [references/error-recovery.md](references/error-recovery.md) — 异常处理完整表。
- [references/grilling-guide.md](references/grilling-guide.md) — Grilling 模式问题模板。
- [references/acceptance-patterns.md](references/acceptance-patterns.md) — 验收标准好/坏对照。
- [references/constraint-design.md](references/constraint-design.md) — 约束设计指南。
