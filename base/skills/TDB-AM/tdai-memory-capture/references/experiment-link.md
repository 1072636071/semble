# tdai-memory-capture · 实验联系（标记编码 → 真实工作区验证 → 自动应用/撤销）

> 从属于 `tdai-memory-capture` skill（工单 06-09 · 方案 03 §六）。主文件见 `../SKILL.md`。
>
> **基准 commit**：`c3838ba`（M7）+ M8 实验联系端点。字段与
> `MemoryCore/src/gateway/experiment-router.ts`、`core/roles/experiment/` 逐一核对。

## 语义一句话

「联系→实验→观察→验证」闭环：把思考者/反馈者标注的**优化点（假设）**，经本地 agent 在
**真实工作区**跑实验，变成**经过验证的事实**。验证通过 → 内核自动应用修订并给段落打
`verified` 免反思标记；证伪 → 撤销该标注。**不用云端沙箱、不用 fixture**。

## 何时触发

用户主动发起——用户在管理台（记忆治理 → 偏差队列）或对话里看到某个优化点/偏差的
**标记编码**（形如 `dev-01J...`，即 `report_id`），把它报给 agent：
「验证一下 dev-xxx」。**没有标记编码就不自作主张挑目标**——可以引导用户去面板偏差队列找。

## 流程（四步）

```
用户报标记编码 → ① POST /experiment/run 领实验指示
                → ② 在真实工作区执行三类验证（实际操作 / 新旧对照 / 关联核实）
                → ③ POST /experiment/result 回传（outcome + evidence [+ change + verified_section]）
                → ④ 内核落地：verified → 自动应用 + verified 标记 + 资产成熟度流转；
                       falsified → 撤销标注（dismissed）
```

## 端点与凭据

两条通道任选（同一内核、同一 ExperimentOrchestrator，仅鉴权面不同）：

| 通道 | 基址 | 鉴权 | 适用 |
| --- | --- | --- | --- |
| 数据面 | `$KS/experiment/{run,result}` | `x-tdai-service-id` + `x-tdai-user-key: $UK`（`sk-mem-`） | proxy 机体 / 面板可达内网 |
| agent 面 | `<KS基址>/v3/agent/experiment/{run,result}` | `x-tdai-service-id` + `x-tdai-mcp-token`（`sk-mcp-`） | 绑死 LLM 的 MCP 机体 |

身份规则与既有约定一致：agent 面**禁止**自报 `team_id/user_id/agent_id`（出现即 400），
数据面权限 = 该偏差所属 team 的活跃成员。

## 第 ① 步：领指示（run）

```bash
curl.exe -sS -X POST "$KS/experiment/run" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{ "report_id": "dev-01JZ..." }'
```

响应 `data`：

| 字段 | 说明 |
| --- | --- |
| `status` | `"experimenting"`（偏差记录进入实验态；重复 run = 重新出指示，允许） |
| `instruction.objective` | 实验要回答的问题 |
| `instruction.target` | 资产定位；skill 时含 `skill_name` 与 **`skill_version`（记下来，回传 change 时作乐观锁基线）**、`excerpt` 原文摘录 |
| `instruction.checks` | 三类验证恒在：`hands_on`（实际操作）、`old_new_comparison`（新旧对照）、`related_verification`（关联核实） |
| `instruction.report_back` | 回传契约（含本条 report_id） |

终态守卫：该编码已 `applied`/`dismissed` → `400 experiment_terminal`（一条编码只闭环一次，新反馈走新上报）。

## 第 ② 步：在真实工作区执行

按 `checks` 逐条来，每条留**可复核证据**（命令、输出片段、路径、版本号）：

- **实际操作**：把目标技能声称的步骤真的跑一遍（真实环境、真实项目）。
- **新旧对照**：`expected`（旧声称）vs 实际观察，逐点判断哪边可信。
- **关联核实**：涉及的命令/API/文件/依赖是否仍然存在、版本是否匹配。

判定纪律：**只有当三类验证支持"按指示修订后正确"才算 verified**；证据不足以下结论时
不回传（保持 experimenting，可再 run 细化），不要为了闭环而硬选一边。

## 第 ③ 步：回传（result）

```bash
curl.exe -sS -X POST "$KS/experiment/result" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{
    "report_id": "dev-01JZ...",
    "outcome": "verified",
    "evidence": "本机 pnpm build 成功、npm 不存在（node v22 + pnpm 9）；对照见 observed",
    "change": { "mode": "patch", "expected_version": 3, "old_string": "跑 npm build", "new_string": "跑 pnpm build" },
    "verified_section": "第一步：跑 pnpm build。\n旧说法。"
  }'
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `outcome` | 是 | `"verified" \| "falsified"` |
| `evidence` | 建议必带 | 真实观察记录（进留痕，审计与复盘依据） |
| `change` | 否 | 验证通过且**需要改内容**时给：`mode:"patch"`（`old_string`/`new_string`/`replace_all?`）或 `mode:"update"`（整篇 `content`）。**带上 run 回显的 `expected_version`**——指示与执行之间技能被人改过会得到 409，防止覆盖新改动 |
| `verified_section` | 否 | 验证通过的段落**原文首行起**（与技能正文行内容一致）；内核在该段前注入 `<!-- verified -->`，反思器此后免改该段。多段可分别验证、逐段打标 |
| 省略 `change` 与 `verified_section` | — | 纯确认型实验（如关联核实证明现状成立）：只流转成熟度，不写技能 |

### 第 ④ 步：内核落地（无需你操作）

**响应 `data`**：`{ report_id, status, outcome, applied }`。若传了 `verified_section` 但未匹配到技能正文段落（常见于随 change 一起传了**修订前**的原文），响应会额外带 `warning`——本次 applied 照常生效、verified 标记未注入；按修订后的段落原文重新 run/result 补打标即可。

- `verified` → 应用 change（乐观锁）→ 段落打 verified 标记 → 资产 `status/confidence`
  单步上调（成熟度联动）→ 偏差记录 `applied=true`，`experiment_result` 内含
  指示 + 证据 + 应用信息全留痕。
- `falsified` → **撤销标注**：偏差置 `dismissed`，技能/记忆原样不动。

## 错误码速查

| HTTP / code | 含义 | 恢复 |
| --- | --- | --- |
| 400 `experiment_not_running` | 没先 run 就回传 | 先 `run` 领指示 |
| 400 `experiment_terminal` | 编码已 applied/dismissed | 用新上报，不复用终态编码 |
| 400 `experiment_change_unsupported` | 非 skill 资产给了 change | 技能写才支持自动应用；记忆类只回传结论 |
| 404 `deviation_not_found` | 编码不存在 | 核对用户给的 `dev-…` |
| 403 `permission_denied` | 非该 team 成员 | 换凭据 / 确认 team |
| 409 `SKILL_VERSION_STALE` | `change.expected_version` 落后 head | 重 `run` 拿新 `skill_version`，基于最新内容重做 change 再回传 |
| 400 `SKILL_PATCH_NOT_UNIQUE` | `old_string` 不唯一/不存在 | 加长片段；或 `update` 整篇 |
| 503 `not_available` | 内核未接技能面 | 上报环境管理员 |

## 与相邻机制的关系

- 标记编码的产生：`/v3/agent/deviation` 上报、思考者反思标注（`actor:"scholar"`）、
  辩论家讨论收敛后的裁决——都在同一条偏差记录上，实验是它的最后一段生命周期。
- 实验通过打的 `verified` 段落标记与 `user_no_reflect`（技能级豁免）互不冲突：
  前者免改单段，后者整技能跳过反思（见 `capture-endpoints.md` §4.4）。
- 返回给 agent 读技能时标记会被剥离（agent 看干净正文）；**给 `verified_section`
  时按干净正文的行内容传即可**（内核按段落首行精确匹配注入标记）。
