# 何时使用 Mock

只在 **系统边界** 处 mock：

- 外部 API（支付、邮件等）
- 数据库（有时——优先使用测试数据库）
- 时间/随机性
- 文件系统（有时）

不要 mock：

- 你自己的类/模块
- 内部协作者
- 任何你控制的东西

## 为可 Mock 性设计

在系统边界处，设计易于 mock 的接口：

**1. 使用依赖注入**

将外部依赖传入，而非在内部创建：

```typescript
// 易于 mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// 难以 mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. 偏好 SDK 风格接口而非通用获取器**

为每个外部操作创建专用函数，而非一个带条件逻辑的通用函数：

```typescript
// 好：每个函数可独立 mock
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch("/orders", { method: "POST", body: data }),
};

// 坏：mock 需要内部条件逻辑
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK 方式意味着：

- 每个 mock 返回一个特定的数据形状
- 测试设置中无条件逻辑
- 更容易看出测试涉及哪些端点
- 每个端点有类型安全
