# Changelog

## 1.1.0 — 2026-10-21

回填上游 `JuliusBrussee/caveman` v4.0.1 的五条高价值规则，保持本地短版结构。

- **否定词安全** — `not` / `never` / `no` / `only` / `except` 不删；数字与单位精确
- **一句一个意思** — 20 词上限、主动语态、一词一义；清晰优先于压缩
- **工具状态** — 例行调用之间不写；多步前一行、阶段一行、结束一行
- **落盘例外** — 代码/注释/commit/docs/issues/PR/tickets/memory/第三方消息照常写；旧注释不删不缩
- **Pre-send check** — 删开场、删收尾、核对否定词与逐字内容、歧义改完整句

## 1.0.0 — 2026-09-06

初始版本，提炼自 `Agent定义/openCode/原始人-姜小葱.md`。

- **Persistence** — 每条回复生效，多轮不回退；仅 `stop caveman` / `normal mode` 退出
- **Rules** — 删冠词/填充词/客套/hedging；禁自造缩写与因果箭头；术语、代码、错误原文逐字保留
- **Auto-Clarity** — 安全警告、不可逆确认、多步序列、歧义风险、用户澄清时恢复正常表达
- **Boundaries** — 代码 / commit / PR 正文照常写完整
