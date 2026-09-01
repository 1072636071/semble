# tdai-memory-capture · 实验联系演练清单（人工执行）

> 端点契约与判定规则见 `experiment-link.md`。**待人工执行**——需要真实内核环境 +
> 一个真实可跑的偏差/优化点标注。基准：M8 代码面（`/v3/experiment/{run,result}` +
> `/v3/agent/experiment/{run,result}`）。

## 前置

- 环境变量沿用 `capture-dryrun.md`：`$KS` / `$SID` / `$UK` / `$TEAM` / `$AGENT` / `$USER`；
  另备一把 `sk-mcp-` token（agent 面核验用，面板签发）。
- 演练统一使用 `dryrun-exp-` 前缀命名空间：先 `skill/create` 造一个含**故意写错步骤**的
  技能（如 `dryrun-exp-demo`，正文写「跑 `dryrun-exp-fake-cmd` 命令」）。
- 造标记编码：`POST $KS/skill/get-by-name` 拿 `skill_id`（skill 创建时自动登记的 meta 资产
  以它为 `asset_id`），`POST $KS/meta/deviation/report`（或 `/v3/agent/deviation`，带
  `x-tdai-user-key: $UK`）上报一条 `asset_id=<skill_id>` 的偏差
  （observed=「`dryrun-exp-fake-cmd` 不存在，实际应跑 `echo ok`」，suggestion=update）→
  记下返回的 `report_id`（即标记编码）。

## 清单（按序执行，全部走通才算过）

1. [ ] **run 出指示**：`POST $KS/experiment/run {report_id}` → 200；`data.status="experimenting"`；
   `instruction.checks` 恰含 `hands_on` / `old_new_comparison` / `related_verification` 三类；
   `target.skill_version` 回显。
2. [ ] **真实执行**：在工作区实际跑「fake 命令 → 失败；echo ok → 成功」，记录证据。
3. [ ] **verified + change 回传**：`result {outcome:"verified", evidence, change:{mode:"patch",
   expected_version:<步骤1回显值>, old_string:"dryrun-exp-fake-cmd", new_string:"echo ok"},
   verified_section:"<修订后该段首行原文>"}` → 200，`data.applied` 报 from/to version。
4. [ ] **落库核验**：`skill/get`（带 `raw:true` 或走面板）确认正文已改 **且** 该段前有
   `<!-- verified -->`；`deviation/get` 确认 `status="applied"`、`applied=true`、
   `experiment_result` 留痕含指示+证据+应用信息；`asset/get` 确认 status/confidence 已流转。
5. [ ] **剥离核验**：普通 `skill/get`（raw 缺省）返回内容**不含**标记注释行。
6. [ ] **乐观锁核验**：对另一条编码，run 后先手动 `skill/patch` 推进版本，再带旧
   `expected_version` 回传 → 409 `SKILL_VERSION_STALE`；不带 expected_version 重试 → 成功。
7. [ ] **falsified 撤销核验**：再造一条偏差 → run → `result {outcome:"falsified", evidence}` →
   200 `status="dismissed"`；技能正文与版本**无变化**；再 run 该编码 → 400 `experiment_terminal`。
8. [ ] **agent 面核验**：`/v3/agent/experiment/run` 凭 `x-tdai-mcp-token` 走通步骤 1；
   body 带 `team_id` → 400；未接线环境（无 experiment 装配）→ 501 而非 403。
9. [ ] **清理**：`skill/delete` 删除演练技能；演练偏差记录留存（留痕语义，不删）。

## 执行记录

（执行日期 / 执行人 / 逐条结果，追加于此，新内容置顶。）
