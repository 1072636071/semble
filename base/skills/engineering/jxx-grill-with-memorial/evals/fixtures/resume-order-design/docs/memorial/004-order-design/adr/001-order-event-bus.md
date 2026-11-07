# ADR 001：订单创建沿用现有事件总线

状态：已接受（2026-10-20）

- 决策：订单创建继续发布 `order.created.v1`。
- 级别与来源：L3 / 用户。
- 原因：保留现有消费者契约，避免同时迁移发布方与订阅方。
- 当前重验：续接时核对 `src/orders/event-bus.mjs` 与 `docs/order-storage.md`。
