---
name: jxx-migrate-to-shoehorn
description: 将测试文件从 `as` 类型断言（type assertion）迁移到 @total-typescript/shoehorn；当用户提到 shoehorn、想在测试中替换 `as` 或需要部分测试数据时触发。
metadata:
  version: 1.0.0
---

# 迁移到 Shoehorn

## 为什么用 shoehorn？

`shoehorn` 让你在测试中传入部分数据，同时保持 TypeScript 的类型安全。它用类型安全的替代方案替换 `as` 断言。

**仅用于测试代码。** 绝不在生产代码中使用 shoehorn。

测试中 `as` 的问题：

- 我们被训练不要使用它
- 必须手动指定目标类型
- 故意传错数据时需要双重断言（`as unknown as Type`）

## 安装

```bash
npm i @total-typescript/shoehorn
```

## 迁移模式

### 大量属性的对象只需少量属性

迁移前：

```ts
type Request = {
  body: { id: string };
  headers: Record<string, string>;
  cookies: Record<string, string>;
  // ...20 more properties
};

it("gets user by id", () => {
  // Only care about body.id but must fake entire Request
  getUser({
    body: { id: "123" },
    headers: {},
    cookies: {},
    // ...fake all 20 properties
  });
});
```

迁移后：

```ts
import { fromPartial } from "@total-typescript/shoehorn";

it("gets user by id", () => {
  getUser(
    fromPartial({
      body: { id: "123" },
    }),
  );
});
```

### `as Type` → `fromPartial()`

迁移前：

```ts
getUser({ body: { id: "123" } } as Request);
```

迁移后：

```ts
import { fromPartial } from "@total-typescript/shoehorn";

getUser(fromPartial({ body: { id: "123" } }));
```

### `as unknown as Type` → `fromAny()`

迁移前：

```ts
getUser({ body: { id: 123 } } as unknown as Request); // wrong type on purpose
```

迁移后：

```ts
import { fromAny } from "@total-typescript/shoehorn";

getUser(fromAny({ body: { id: 123 } }));
```

## 何时使用各函数

| 函数            | 用途                                     |
| --------------- | ---------------------------------------- |
| `fromPartial()` | 传入仍能通过类型检查的部分数据           |
| `fromAny()`     | 传入故意错误的数据（保留自动补全）       |
| `fromExact()`   | 强制完整对象（稍后可替换为 fromPartial） |

## 工作流

1. **收集需求** — 询问用户：
   - 哪些测试文件有 `as` 断言导致问题？
   - 是否涉及大量属性但只需少量属性的对象？
   - 是否需要传入故意错误的数据进行错误测试？

2. **安装并迁移**：
   - [ ] 安装：`npm i @total-typescript/shoehorn`
   - [ ] 查找含 `as` 断言的测试文件：`grep -r " as [A-Z]" --include="*.test.ts" --include="*.spec.ts"`
   - [ ] 将 `as Type` 替换为 `fromPartial()`
   - [ ] 将 `as unknown as Type` 替换为 `fromAny()`
   - [ ] 添加 `@total-typescript/shoehorn` 的导入
   - [ ] 运行类型检查验证
