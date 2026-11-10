# 台账字段与读写

真源：`${DSH_HOME:-~/.dsh}/web-resources/ledger.json`。运行时状态，不进技能仓。
由执行 agent 创建；目录不存在时先建目录。文件不存在时按下面空结构创建，不填任何额度值。

## 结构

```json
{
  "version": 1,
  "entries": []
}
```

## 条目字段

| 字段 | 类型 | 判据 |
| --- | --- | --- |
| `at` | ISO-8601 带时区 | 每次观测一条，唯一；修正条目也新建 `at` |
| `site` | string | 站点 id，见 capabilities.md |
| `capability` | string | `image` / `video` / `web-search` / `chat` |
| `remaining` | number 或 null | **只写页面给的数字**；没给就 null |
| `unit` | string | `次` / `积分` / `秒`，页面没说就 `unknown` |
| `observed` | string | 页面原话逐字摘录，不改写 |
| `source` | string | 页面 URL 或会话 id |
| `confidence` | enum | `observed`（页面明写）/ `reported`（模型自述）/ `unknown` |
| `reason` | string 或 null | remaining 为 null 时必写原因；修正时写修正原因 |
| `supersedes` | string 或 null | 修正条目指向被覆盖旧条目的 `at`；新建观测为 null |

## 写纪律

1. **只追加**：`entries.push(newEntry)` 后整份写回；不 splice、不覆盖旧对象。
2. **不编造**：`remaining` 只能来自本次 `observed` 原话里的数字，且带时点与来源。模型自述的数字标 `reported`，不写进 `remaining`；错误码（如 `403 insufficient_user_quota`）只判「无配额」这一定性，不反推具体剩余数值。
3. **原子写**：先写同目录临时文件再重命名，避免半截 JSON。
4. **修正不删旧**：矛盾时追加新条目 + `supersedes` + `reason`，旧条目原样保留。
5. **不回写技能仓**：台账是运行时状态，任何情况下都不 commit 进仓库。

## 读纪律

- 读不到文件 → `ERR_LEDGER_UNREADABLE`，不重建带值台账。
- JSON 坏 → 报条目下标与错误，跳过坏条目读其余，不静默当空。
- 取「某站点+能力最新有效值」：按 `at` 升序，取最后一条 `supersedes === null` 或未被后续 supersedes 指向的条目。
