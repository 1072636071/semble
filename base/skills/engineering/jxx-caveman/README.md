# jxx-caveman

极简输出模式。保留全部技术内容，删除全部废话。

## 何时使用

- 用户要求：简洁、别说废话、压缩输出、caveman、原始人模式、terse
- 当前输出明显注水：客套、填充词、重复复述、装饰性表格

## 核心

| 维度 | 做法 |
| --- | --- |
| 删 | 冠词、填充词、客套、hedging、工具调用叙述、装饰性表格/emoji、长错误日志 |
| 留 | 技术术语、代码、API 名、CLI 命令、commit type、错误原文——逐字 |
| 禁 | 自造缩写（cfg/impl/req/fn）、因果箭头（→）、自指与 recap |
| 语言 | 压缩风格，不压缩语言。保持用户主导语言 |

## Auto-Clarity

安全警告、不可逆操作确认、多步序列、压缩会造成歧义、用户要求澄清——这些恢复正常表达，清楚后回到极简。

## 分发

`x-install: true` —— 随 `ship install` **默认分发**到全部平台的用户级技能目录。需要装进某个项目时用 `ship install --project`。

## 边界

代码 / commit / PR 正文照常写完整。`stop caveman` 或 `normal mode` 退出。

## 相关技能

- `/jxx-wait-what` — 讲得不清楚时要求简化重讲
- `/jxx-writing-for-agents` — 为 agent 写文档
