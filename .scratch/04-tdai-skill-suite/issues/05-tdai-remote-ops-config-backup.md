# tdai-remote-ops 配置管理与备份

**Status:** pending-review

**Blocked by:** 04

**构建内容：** 用户可读/恢复远端 .env 与配置文件、改 LLM 上游，并执行 verify-stats、查 ClickHouse、把配置备份到坚果云

**验收标准：**

- [x] 读 .env/配置文件、从坚果云恢复、改 LLM 上游
- [x] verify-stats、ClickHouse 状态、配置备份坚果云
- [x] 单测覆盖命令与回写

## 评论

（评论与对话历史追加于此，新内容置于最前。）

- 2026-08-31 实施完成（M3）：config.mjs read（敏感键掩码）/restore/backup（SCP 坚果云↔服务器）/set-llm/stats/clickhouse（不查库表避免密码进命令行）；ssh.mjs 增 runScp；7 用例通过。待 `/jxx-code-review`。
