## 能力目标

基于 Java 资源生命周期、异常模型与并发语义理解业务场景，判断真实资源管理风险，避免将 GC 语言误当作“无需资源管理”的模式匹配式扫描。

---

## 前置判断

在分析前，明确以下关键要素：

- 资源类型  
  （文件 / Socket / 数据库连接 / 线程 / 线程池 / 锁 / IO 流 / NIO Channel 等）
- 生命周期模型  
  （GC 管理对象 + 显式 close / release / shutdown）
- 是否实现 `AutoCloseable / Closeable`
- 是否使用 `try-with-resources`
- 是否存在多线程 / 线程池 / 异步执行
- 是否涉及容器或框架托管资源（Spring / Servlet / Netty 等）

---

## 分析流程

### Step 1 — 识别资源获取点

定位 Java 中的资源创建或获取行为：

- 文件 / IO：`new FileInputStream`、`Files.newInputStream`
- 网络：`Socket`、`ServerSocket`、`HttpClient`
- 数据库：`DataSource.getConnection`
- NIO：`FileChannel.open`
- 并发：`new Thread`、`Executors.newFixedThreadPool`
- 锁：`Lock.lock`
- 外部资源：JNI / 本地句柄

**Java 示例**

```java
Connection conn = dataSource.getConnection();
````

分析要点：

* 是否实现 `AutoCloseable`
* 是否存在异常路径
* 是否存在明确的释放 API（`close / unlock / shutdown`）

---

### Step 2 — 追踪资源生命周期

* **正向追踪**：创建 → 使用 → 所有正常与异常出口
* **反向追踪**：释放是否对应有效创建
* **所有权转移**：资源是否跨方法 / 线程 / 回调传递
* **异常流控审查**：

  * 是否在 `catch` 前释放
  * 是否缺失 `finally`
* **并发审查**：

  * 是否在线程结束前释放
  * 是否在任务完成后归还资源

#### ❌ 错误示例：异常路径导致连接泄漏

```java
public void query() throws SQLException {
    Connection conn = dataSource.getConnection();
    Statement stmt = conn.createStatement();
    ResultSet rs = stmt.executeQuery("SELECT * FROM t");
    // ❌ 若 executeQuery 抛异常，conn 永不关闭
}
```

#### ✅ 正确示例：try-with-resources

```java
public void query() throws SQLException {
    try (Connection conn = dataSource.getConnection();
         Statement stmt = conn.createStatement();
         ResultSet rs = stmt.executeQuery("SELECT * FROM t")) {
        // use rs
    }
}
```

---

### Step 3 — 验证初始化完整性

* 是否在资源完全构造前使用
* 是否忽略返回状态
* 是否存在“部分初始化对象”
* 成员变量是否可能处于非法状态

#### ❌ 错误示例：未检查初始化成功

```java
Socket socket = new Socket(host, port);
socket.getOutputStream().write(data); // ❌ 可能未连接成功
```

---

### Step 4 — 检查错误与销毁路径

* 构造失败是否释放已创建资源
* 异常路径是否一致释放
* 生命周期方法（`destroy / close / shutdown`）是否完整
* 是否存在多次创建、少次释放

---

## 风险模式

### 1. 资源泄漏 (CAT-0005)

实现了 `Closeable / AutoCloseable` 的资源未在所有路径释放。

**触发**：

* 未使用 try-with-resources
* 异常路径遗漏 close
* 提前 return
* 连接 / 流未归还

---

### 2. 初始化不正确 (CAT-0053)

使用未完全初始化的资源。

**触发**：

* 构造失败仍继续使用
* 成员资源延迟初始化但无状态保护

---

### 3. 未受控的资源消耗 (CAT-0054)

资源创建频率或数量未受限制。

#### 示例：无界线程创建

```java
public void handle() {
    new Thread(() -> doWork()).start(); // ❌ 无上限
}
```

**关注资源**：

* 线程 / 线程池
* 数据库连接
* 文件句柄
* Socket

---

### 4. 不受信任数据的反序列化 (CWD-1171)

从不可信来源反序列化对象。

**触发**：

* `ObjectInputStream.readObject`
* 未校验数据来源与类型

---

### 5. 修改假定不可变数据 (CWD-1172)

修改应只读或共享的数据结构。

**触发**：

* 修改传入集合
* 修改缓存对象
* 多线程下修改共享数据

---

### 6. protected/private 成员被不正确访问 (CWD-1176)

绕过访问控制机制。

**触发**：

* 反射访问私有字段
* `setAccessible(true)`

---

### 7. clone 方法实现不正确 (CWD-1177)

对象克隆导致资源共享或泄漏。

**触发**：

* clone 后共享 Connection / Stream
* 浅拷贝持有外部资源

---

### 8. 沙箱或路径边界不正确 (CWD-1180)

文件路径未限制。

**触发**：

* 路径拼接未校验
* 使用用户输入作为文件路径

---

### 9. 类型转换不正确 (CAT-0055)

不安全的类型转换。

**触发**：

* 向下转型未校验
* 泛型擦除误判

---

### 10. 资源的跨作用域引用 (CAT-0056)

资源生命周期短于使用周期。

#### ❌ 示例：跨线程使用已关闭连接

```java
Connection conn = dataSource.getConnection();
executor.submit(() -> use(conn));
conn.close(); // ❌
```

---

### 11. 访问已关闭或失效的资源 (CAT-0057)

关闭后继续使用。

---

### 12. 资源未关闭或释放不正确 (CAT-0058)

释放顺序或方式错误。

#### 示例：锁未在 finally 中释放

```java
lock.lock();
doWork();
// ❌ 未 unlock
```

---

### 13. 不安全的反射 (CWD-1612)

反射绕过安全控制。

---

### 14. 绑定不受限制的网络地址 (CWD-1624)

服务暴露面过大。

---

### 15. 将可变对象暴露给不受信任域 (CWD-1625)

返回内部可变对象引用。

---

### 16. 不安全的临时文件 (CAT-0059)

临时文件处理不当。

---

## 代码分析视角

### 控制流分析

检查 try / catch / finally、提前 return。

### 数据流分析

追踪资源：创建 → 使用 → 释放。

### 所有权分析

明确资源由哪个方法 / 线程 / 组件负责释放。

### 并发分析

关注线程安全、竞态与资源共享。

---

## 结论模板

```
## 结论
[问题存在 + 严重性:高/中/低 + 风险类型]

## 资源类型与生命周期
- 资源类型: [文件 / 连接 / 线程 / 锁等]
- 创建位置: [文件:行号] [方法名]
- 释放位置: [文件:行号] 或“未释放”
- 所有权模型: [独有 / 共享 / 池化]

## 证据链与逻辑推理
1. 代码证据
2. 生命周期追踪
3. 缺陷描述
4. 推理过程
```

---

## 非“执行逻辑”

本文档为 Java 资源管理的推理与认知指南，不执行扫描、不自动修复。模型应结合异常模型、并发语义与业务上下文进行判断，而非机械规则匹配。

---

## 典型误报场景

不应报告：

* try-with-resources 管理的资源
* 容器托管生命周期（如 Spring 管理的 DataSource）
* 明确的连接池归还操作
* 全局单例线程池（有明确 shutdown 策略）

```

---
