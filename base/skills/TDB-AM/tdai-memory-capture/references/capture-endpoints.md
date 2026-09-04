# tdai-memory-capture 端点参考

> 从属于 `tdai-memory-capture` skill。主文件通用约定与分流判定见 `../SKILL.md`。
>
> **基准 commit**：`be3cc5b`（M7）。字段与 `MemoryCore/src/gateway/{v2-schemas,skill-schemas}.ts` 逐一核对。

下文占位符：`$KS` = KS 数据面基址（如 `http://127.0.0.1:8421/v3`）；`$SID` = service id；`$UK` = user key（`sk-mem-`）。

---

## 1. 原始通道：`POST /v3/conversation/add`

对话原文入 L0，内核异步触发蒸馏管线（L1 抽取 → L2/L3）。同步落 L0、异步蒸馏——**响应成功 ≠ 蒸馏完成**。

```bash
curl.exe -sS -X POST "$KS/conversation/add" \
  -H "x-tdai-service-id: $SID" \
  -H "x-tdai-team-id: $TEAM" -H "x-tdai-agent-id: $AGENT" -H "x-tdai-user-id: $USER" \
  -H "content-type: application/json" \
  -d '{
    "session_id": "sess-20260901-01",
    "messages": [
      { "role": "user", "content": "部署时先跑 migrateSchema 再起服务", "timestamp": "2026-09-01T10:00:00Z" },
      { "role": "assistant", "content": "已记录。" }
    ]
  }'
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `session_id` | string | 否 | 会话键；缺省落兼容桶。**建议显式传**，蒸馏与溯源都按它组织 |
| `messages` | array | 是 | 1–100 条；每条见下 |

**`messages[]`（ConversationItem）**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `role` | `"user" \| "assistant"` | 是 | L0 仅两种角色（tool 往返请先并入 content 叙述） |
| `content` | string | 是 | 1–8192 字符 |
| `timestamp` | string (date-time) | 否 | 消息实际发生时间；缺省用服务端接收时间 |
| `recorded_at` | string (date-time) | 否 | 历史导入时的原始入库时间 |

**身份**：不在 body——由隔离头 `x-tdai-team-id` / `x-tdai-agent-id` / `x-tdai-user-id` 解析（v3 强 isolation，缺头 **422**）。

**响应**：`data` 含落库计数与会话键。蒸馏完成后由技能/记忆管线异步产出，随后可用 `atomic/search`、`skill/search`（走 memory-mcp 查询面）检索到。

---

## 2. 精华通道 · 事实落点：`POST /v3/atomic/create`

外部写入 L1 的唯一入口（工单 07-02 / ADR-0023）。同步落库、立即可检索。

```bash
curl.exe -sS -X POST "$KS/atomic/create" \
  -H "x-tdai-service-id: $SID" \
  -H "x-tdai-team-id: $TEAM" -H "x-tdai-agent-id: $AGENT" -H "x-tdai-user-id: $USER" \
  -H "content-type: application/json" \
  -d '{
    "type": "episodic",
    "content": "2026-09-01 决定：三件套部署顺序固定为 proxy → core → panel。",
    "background": "部署",
    "agent_source": "codebuddy"
  }'
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | `"episodic" \| "persona" \| "instruction"` | 是 | 语义归属由刚完成本地蒸馏的一方指定（不含 work_*） |
| `content` | string | 是 | 1–8192 字符。精华本就该短 |
| `background` | string ≤200 | 否 | 场景名（L1 scene_name） |
| `agent_source` | string 1–120 | 否 | 上传来源标签；缺省回落 caller 的 agent_id |
| `priority` | int −1–100 | 否 | −1=全局指令；缺省 50 |

**响应 `data`**：`{ id, type, version, created_at, source_ref }`。`source_ref` 形如 `agent-upload:<agent_source>:<ISO>`——与对话蒸馏来源可区分（证据溯源 D31），**检索命中后据此判断这是手工上传的精华**。

**写入后验证**：`POST $KS/atomic/search`（同样带隔离头）应能按关键词命中该条。

---

## 3. 精华通道 · 经验落点：`POST /v3/skill/create`

经验/做法类进技能库。技能以 canonical SKILL.md 形式存储（frontmatter + 正文）。

```bash
curl.exe -sS -X POST "$KS/skill/create" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{
    "user_id": "u-1", "team_id": "t-1", "agent_id": "a-1",
    "name": "deploy-order",
    "content": "---\nname: deploy-order\ndescription: 三件套部署顺序与检查点\n---\n\n1. proxy → 2. core → 3. panel；core 起前先跑 migrateSchema。",
    "metadata": { "source_ref": "conversation/sess-20260901-01/1-2" }
  }'
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `user_id` | string | 写接口要求 | 写入者（审计列） |
| `team_id` | string | 有 agent_id 时必填 | agent 必须以 team 为命名空间 |
| `agent_id` | string | 否 | 技能 owner agent；owner 可写 |
| `name` | string 1–64 | 是 | `(team_id, agent_id, name)` 唯一 |
| `content` | string | 是 | canonical SKILL.md 全文 |
| `resources` | array ≤100 | 否 | 附件 `{path, content, encoding: "utf-8"|"base64", mime_type?, is_executable?}` |
| `metadata` | object | 否 | 建议落 `source_ref`（证据溯源） |

**响应 `data`**：技能摘要（含 `skill_id`、`version`）。**记录 `skill_id` 与 `version`**——后续所有写操作都要用。

**错误**：`42201` 名称重复 → 先 `POST $KS/skill/get-by-name`（`{team_id, agent_id, skill_name}`）拿现有技能，改走 `update`/`patch`。

---

## 4. 技能全生命周期

所有写操作带 `expected_version`（乐观锁）。写前先读：

```bash
curl.exe -sS -X POST "$KS/skill/get" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{ "team_id": "t-1", "skill_id": "skl-xxx", "include_content": true }'
```

响应 `data.version` 即当前 head 版本。

### 4.1 update（整篇替换）

```bash
curl.exe -sS -X POST "$KS/skill/update" \
  -H "x-tdai-service-id: $SID" -H "x-tdai-user-key: $UK" \
  -H "content-type: application/json" \
  -d '{ "user_id": "u-1", "team_id": "t-1", "agent_id": "a-1",
        "skill_id": "skl-xxx", "expected_version": 3, "content": "<整篇新内容>" }'
```

### 4.2 patch（局部替换）

```bash
-d '{ "user_id": "u-1", "team_id": "t-1", "agent_id": "a-1",
      "skill_id": "skl-xxx", "expected_version": 4,
      "old_string": "旧片段", "new_string": "新片段", "replace_all": false }'
```

`old_string` 在正文中不唯一 → `42202` SKILL_PATCH_NOT_UNIQUE（加长片段或开 `replace_all`）。

### 4.3 delete（软删 → archived）

```bash
-d '{ "user_id": "u-1", "team_id": "t-1", "agent_id": "a-1",
      "skill_id": "skl-xxx", "expected_version": 5 }'
```

响应 `data: { skill_id, archived: true }`。归档后不再注入；面板「记忆治理 → 技能标记」可见，可由用户彻底删除。

### 4.4 set-marks（豁免标记）

```bash
-d '{ "user_id": "u-1", "team_id": "t-1", "agent_id": "a-1",
      "skill_id": "skl-xxx", "expected_version": 6, "user_no_reflect": true }'
```

`user_no_reflect: true` = 该技能整跳过反思管线。标记以正文注释承载，未变化时幂等不产生新版本。

### 4.5 乐观锁纪律（必须遵守）

| 错误码 | 含义 | 恢复动作 |
| --- | --- | --- |
| `40901`（HTTP 409）SKILL_VERSION_STALE | `expected_version` 落后于 head | 响应 `data.current_version` 已带最新版——**用它重试一次**；再冲突则 `skill/get` 重新对比内容，禁止盲目循环 |
| `41001`（HTTP 410）SKILL_VERSION_EXPIRED | 目标版本已被 TTL 清理 | `skill/get` 读最新版，基于它重做修改 |
| `40301` | 非 owner（agent_id 不是该技能 owner） | 换 owner 身份，或由 owner agent 执行 |
| `40401` | 技能不存在 | 确认 skill_id / team_id |

纪律口诀：**读 → 改 → 写，一气呵成；409 用 `current_version` 重试一次；两次冲突必须停下重新读。**

---

## 5. 鉴权与通道小结

| 端点 | 鉴权 | 身份来源 |
| --- | --- | --- |
| `/v3/conversation/add` | `x-tdai-service-id`（内网信任） | 隔离头 team/agent/user |
| `/v3/atomic/create` | `x-tdai-service-id` | 隔离头 team/agent/user |
| `/v3/skill/*` | `x-tdai-service-id` + `x-tdai-user-key` | body 的 user_id/team_id/agent_id |

- `sk-mem-` user_key：本 skill 全部写操作。`sk-mcp-` MCP token：**只读，禁用于本 skill**。
- 直连 KS 仅限受控内网；对外一律经 Panel 代理（`/api/v1/skill/*` 等，鉴权同 panel-admin 约定）。
