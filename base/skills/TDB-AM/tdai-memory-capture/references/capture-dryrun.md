# tdai-memory-capture 端到端演练清单

> 从属于 `tdai-memory-capture` skill。端点细节见 `./capture-endpoints.md`，通用约定见 `../SKILL.md`。

**基准 commit**：`be3cc5b`（M7）。

**演练环境状态**：本地探测 KS（127.0.0.1:8421）未运行。起整个栈需配置凭据与存储后端，风险高且耗时。**本清单为完整可执行步骤序列，标注「待人工执行」**——在具备运行环境的机器上按序执行并记录实际输出至文末「执行记录」节。

---

## 前置准备

1. **环境变量**（按实际部署填）：

   ```bash
   export KS="http://127.0.0.1:8421/v3"   # KS 数据面基址
   export SID="<service-id>"              # x-tdai-service-id
   export UK="<user-key>"                 # x-tdai-user-key（sk-mem-）
   export TEAM="<team-id>"                # x-tdai-team-id
   export AGENT="<agent-id>"              # x-tdai-agent-id（技能 owner）
   export USER="<user-id>"                # x-tdai-user-id
   ```

2. **凭据前置**：`$UK` 必须是 `sk-mem-` user_key 且属于 `$TEAM` 活跃成员；`$AGENT` 属于 `$TEAM`。缺凭据先跑 `node docs/skills/panel-admin/scripts/setup-credentials.mjs`。

3. **命名空间**：演练统一用 `dryrun-capture-` 前缀（技能名 / session_id），结束清理。

---

## 步骤 1：原始通道 → conversation/add

```bash
curl.exe -sS -X POST "$KS/conversation/add" \
  -H "x-tdai-service-id: $SID" \
  -H "x-tdai-team-id: $TEAM" -H "x-tdai-agent-id: $AGENT" -H "x-tdai-user-id: $USER" \
  -H "content-type: application/json" \
  -d '{
    "session_id": "dryrun-capture-sess-01",
    "messages": [
      { "role": "user", "content": "dryrun：部署顺序固定为 proxy → core → panel，core 起前先跑 migrateSchema。", "timestamp": "2026-09-01T10:00:00Z" },
      { "role": "assistant", "content": "已了解，部署顺序为 proxy → core → panel。" }
    ]
  }'
```

**判定**：✅ `code===0` 且 L0 落库计数与 messages 数一致。

## 步骤 2：精华 · 事实类 → atomic/create

```bash
curl.exe -sS -X POST "$KS/atomic/create" \
  -H "x-tdai-service-id: $SID" \
  -H "x-tdai-team-id: $TEAM" -H "x-tdai-agent-id: $AGENT" -H "x-tdai-user-id: $USER" \
  -H "content-type: application/json" \
  -d '{
    "type": "episodic",
    "content": "dryrun 事实：三件套部署顺序固定为 proxy → core → panel。",
    "background": "dryrun-部署",
    "agent_source": "dryrun-capture"
  }'
```

**判定**：✅ `code===0`，`data.source_ref` 以 `agent-upload:dryrun-capture:` 开头；记下 `data.id` 为 `$L1ID`。

**回读验证**：

```bash
curl.exe -sS -X POST "$KS/atomic/search" \
  -H "x-tdai-service-id: $SID" \
  -H "x-tdai-team-id: $TEAM" -H "x-tdai-agent-id: $AGENT" -H "x-tdai-user-id: $USER" \
  -H "content-type: application/json" \
  -d '{ "query": "部署顺序", "limit": 5 }'
```

**判定**：✅ 命中结果含 `$L1ID`。

## 步骤 3：精华 · 经验类 → skill/create

```bash
curl.exe -sS -X POST "$KS/skill/create" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{
    "user_id": "'"$USER"'", "team_id": "'"$TEAM"'", "agent_id": "'"$AGENT"'",
    "name": "dryrun-capture-deploy",
    "content": "---\nname: dryrun-capture-deploy\ndescription: dryrun 部署顺序经验\n---\n\n1. proxy → 2. core → 3. panel；core 起前先跑 migrateSchema。",
    "metadata": { "source_ref": "conversation/dryrun-capture-sess-01/1-2" }
  }'
```

**判定**：✅ `code===0`；记下 `data.skill_id` 为 `$SKID`、`data.version` 为 `$V1`。

## 步骤 4：patch → 乐观锁

```bash
curl.exe -sS -X POST "$KS/skill/patch" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{ "user_id": "'"$USER"'", "team_id": "'"$TEAM"'", "agent_id": "'"$AGENT"'",
        "skill_id": "'"$SKID"'", "expected_version": '"$V1"',
        "old_string": "1. proxy → 2. core → 3. panel", "new_string": "1. proxy → 2. core（先 migrateSchema）→ 3. panel" }'
```

**判定**：✅ `code===0` 且 `data.version === V1+1`（记为 `$V2`）。

**故意制造冲突**（用旧版本再 patch 一次）：

**判定**：✅ HTTP 409、`code===40901`、`data.current_version === $V2`——用 `current_version` 重试一次成功。

## 步骤 5：set-marks（豁免反思）

```bash
curl.exe -sS -X POST "$KS/skill/set-marks" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{ "user_id": "'"$USER"'", "team_id": "'"$TEAM"'", "agent_id": "'"$AGENT"'",
        "skill_id": "'"$SKID"'", "expected_version": '"$V2"', "user_no_reflect": true }'
```

**判定**：✅ `code===0`；`skill/get` 正文含独立一行 `<!-- user_no_reflect -->`。

## 步骤 6：delete（软删归档）

```bash
curl.exe -sS -X POST "$KS/skill/delete" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{ "user_id": "'"$USER"'", "team_id": "'"$TEAM"'", "agent_id": "'"$AGENT"'",
        "skill_id": "'"$SKID"'", "expected_version": <步骤5返回的 version> }'
```

**判定**：✅ `code===0` 且 `data.archived === true`；面板「记忆治理 → 技能标记」可见该归档技能。

## 步骤 7：清理

1. `atomic/delete` 删 `$L1ID`（`{ "ids": ["$L1ID"] }`）。
2. skill 已归档即达成清理目的；如需物理清理走面板。
3. 残留检查：`atomic/search` 与 `skill/list` 不应再有 `dryrun-capture-` 前缀条目。

---

## 执行记录

（待人工执行后追加：日期、环境、逐步实际输出摘要、偏差说明。）
