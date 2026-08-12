# map：ship 跨厂商分发

## 已做决策

- 单入口 `ship.mjs` + 子命令；零参数 = 全流程（ADR 0003）
- 7 家平台，`vendors.json` 配置驱动；4 家有派生规则、3 家原样复制 fallback（ADR 0001）
- 双模式渐进迁移：有 src 派生、无 src 原样复制（ADR 0002）
- CodeArts 英文内容人工维护、缺失即硬门禁非零退出（ADR 0004）
- `x-install` frontmatter 开关就近声明；managedPrefixes 限定残留清理范围
- 默认用户级 + `--project`；`--user-home`/`--dry-run` 为测试 seam（已确认）
- 测试：CLI 单 seam + Node `node:test`，零第三方依赖

## 参考

- PRD：`PRD.md`（Status: ready-for-agent）
- 领域词汇：根 `CONTEXT.md`；ADR：`docs/adr/0001–0004`
- 工单：`issues/01–06`，按依赖顺序 01 可立即开始

## 迷雾

- Qoder/WorkBuddy/QoderWork 的元数据调研（超出范围，补调研只改配置）
- 根 `Agent定义/` 与 `base/agent/` 双目录收敛（另立项）
