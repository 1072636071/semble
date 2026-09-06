# tdai-remote-ops 配置向导

**Status:** done

**Blocked by:** 01

**构建内容：** 用户运行 setup 生成 tdai-ops.json（探测坚果云/导入既有/手填），含 SSH 参数、部署目录、端口表、admin keys；密钥从机密读取不落盘

**验收标准：**

- [x] setup 可探测坚果云根（可覆盖不硬编码）
- [x] 产出 tdai-ops.json 字段齐全
- [x] 单测覆盖三级供给与路径覆盖

## 评论

（评论与对话历史追加于此，新内容置于最前。）

- 2026-08-31 实施完成（M2）：setup-credentials.mjs 三级供给（复用既有 / 探测坚果云自动构建 / 手填）+ `--secrets-root`/`TDAI_SECRETS_ROOT` 覆盖 + `tdai-ops.json` 只存路径不存密钥值；12 用例通过。待 `/jxx-code-review`。
