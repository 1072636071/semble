# 当前订单流程

- `src/orders/event-bus.mjs` 已提供 `order.created.v1` 主题和通用 `publish`。
- 总线至少投递一次；消费者必须幂等。
- `src/orders/legacy-api.mjs` 的 `POST /orders` 被三个内部调用方使用。
- 测试使用 `node:test`，不引入新的测试框架。
