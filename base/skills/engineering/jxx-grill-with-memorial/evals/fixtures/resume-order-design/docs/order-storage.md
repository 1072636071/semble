# 订单存储现状

## 2026-11-01 数据驻留约束

- 订单记录现在包含手机号与收货地址，属于个人信息。
- 未完成合规评估前，禁止把订单记录复制到 `eu-west-1`。
- 当前主库位于 `ap-southeast-1`；`src/orders/replica-client.mjs` 仍把报表副本指向 `eu-west-1`。
- 停用该副本会中断现有报表；新建同区域副本需要新增基础设施与预算。
- 订单创建事件仍使用 `order.created.v1`，由 `src/orders/event-bus.mjs` 发布。
