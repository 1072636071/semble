## 能力目标

基于并发模型和内存一致性模型,判断真实线程安全风险,识别可触发的竞态条件,区分并发安全和误报场景。

---

## 前置判断

获取:
- 并发模型: 线程/协程/Actor模型/进程
- 内存模型: 内存屏障、可见性、原子性保证
- 共享资源: 全局变量、静态变量、共享数据结构
- 同步机制: 锁、信号量、条件变量、原子操作、无锁数据结构
- 锁粒度对象: 锁的覆盖范围、持锁时间、嵌套层次
- 是否使用线程安全库: 并发容器、原子类型
- 是否存在异步操作: 回调、Future、Promise、async/await

---

## 分析流程

### Step 1 — 识别并发模式
定位并发执行点:
- 线程创建: `pthread_create`、`Thread.start`、`std::thread`
- 协程/任务池: async/await、goroutine、Task
- 线程池执行: `ExecutorService.submit`、`ThreadPool.enqueue`
- 定时器/事件循环: Timer、EventLoop、Scheduler
- 进程间通信: 共享内存、消息队列、Socket
- 中断处理: 信号处理器、ISR

### Step 2 — 追踪共享资源访问
- 识别共享状态: 全局变量、静态变量、堆数据、缓存
- 访问模式: 读-读、读-写、写-写操作
- 数据依赖: 检查-获取-更新(check-then-act)模式
- 错误检查: 验证-然后-修改(validate-then-modify)模式
- 复合操作: 递增、递减、CAS操作

### Step 3 — 验证同步机制
- 锁覆盖范围: 所有对共享资源的访问是否都在锁保护下
- 锁的顺序: 是否存在潜在的死锁环
- 锁粒度: 锁范围是否过大或过小
- 原子操作: 是否适用原子操作替代锁
- 无锁技术: 是否正确使用CAS、内存屏障
- 读写锁: 是否正确区分读写场景

### Step 4 — 检测竞态条件
- 检查-竞-使用(time-of-check-time-of-use, TOCTOU)
- 数据竞争(data race): 无保护的同时读写
- 死锁风险: 多锁顺序不一致
- 活锁风险: 重试逻辑导致的循环等待
- 优先级反转: 高优先级线程被低优先级阻塞
- 内存一致性问题: 缺少内存屏障

---

## 风险模式分类

### CAT-0051 竞争条件
应用程序的执行行为依赖于多个进程或线程的相对执行时机,当执行顺序无法保证时导致不一致状态。

**触发条件**:
- 检查-然后-操作(check-then-act)未原子化
- 多个线程同时修改共享变量: `counter++`
- 文件操作的TOCTOU: `isFile`检查后`open`文件
- 资源泄漏: 分配后释放前被其他线程篡改
- 双重检查锁模式实现不正确

**分析方法**:
1. 识别所有共享状态的修改操作
2. 检查是否存在检查-使用的时间窗口
3. 验证复合操作是否原子化
4. 追踪可能导致不一致的执行路径

**典型漏洞模式**:
```java
// 危险: 检查-竞-使用
if (user == null) {
    user = new User(); // 多个线程可能同时执行
}

// 危险: 非原子递增
count++; // 实际为 read -> modify -> write 三步

// 安全: 使用同步或原子操作
synchronized(lock) {
    if (user == null) {
        user = new User();
    }
}
// 或
user = user != null ? user : new User(); // 原子引用更新
```

**防护措施**:
- 使用同步块保护整个检查-操作序列
- 使用原子操作类: `AtomicInteger`、`AtomicReference`
- 使用并发集合: `ConcurrentHashMap`、`CopyOnWriteArrayList`
- 使用乐观锁: CAS操作、版本号机制
- 使用不可变对象避免状态变更

---

### CAT-0052 锁定不当
锁的使用方式可能导致死锁、活锁、性能下降。

**触发条件**:
- 获取锁顺序不一致: AB顺序 vs BA顺序
- 在持有锁时持有锁: 嵌套锁、回调持有锁
- 锁粒度过大: 持锁时间过长,阻塞其他线程
- 锁粒度过小: 无法保护关键操作
- 使用可重入锁时不注意重入层次

**分析方法**:
1. 绘制锁的调用图,识别嵌套锁路径
2. 检查不同代码路径获取锁的顺序
3. 验证锁的持有时间和覆盖操作
4. 检查是否存在锁的泄漏(未释放)
5. 识别回调中可能持有的锁

**典型漏洞模式**:
```java
// 危险: 获取锁顺序不一致
// 线程1
synchronized(lockA) {
    synchronized(lockB) { ... }
}
// 线程2
synchronized(lockB) {
    synchronized(lockA) { ... } // 可能死锁
}

// 危险: 回调中持有锁
synchronized(lock) {
    callback.apply(() -> {
        // 回调可能获取其他锁,造成死锁
    });
}

// 危险: 锁粒度过大
synchronized(lock) {
    // 持锁时间过长,阻塞其他线程
    heavyCompute();
    networkCall();
    ioOperation();
}

// 安全: 规范锁顺序,缩小锁范围
// 所有线程按固定顺序获取锁
synchronized(lockA) {
    synchronized(lockB) { ... }
}

// 减小锁范围,只保护关键区域
result = precompute();
synchronized(lock) {
    updateState(result);
}
postProcess();
```

**防护措施**:
- 建立统一的锁获取顺序并严格执行
- 尽量避免嵌套锁,使用全局锁替代多个细分锁
- 减小锁粒度,只保护真正需要同步的操作
- 使用`tryLock`设置超时避免死锁
- 使用读写锁(ReadWriteLock)提高读多写少场景性能
- 避免在持有锁时调用回调或外部代码

---

### CWD-1130 缺少同步
对共享资源的访问缺少必要的同步机制,导致数据竞争或不一致状态。

**触发条件**:
- 共享变量读写未加锁: 全局变量、静态变量、类成员变量
- 延迟初始化未同步: static变量的首次赋值
- 缓存未同步: 本地缓存与共享状态不一致
- 发布/订阅未同步: 生产者-消费者模式缺少队列保护
- 使用`volatile`误以为保证原子性

**分析方法**:
1. 识别所有可被多线程访问的变量
2. 检查读写操作是否有同步保护
3. 验证`volatile`使用的正确性(仅保证可见性)
4. 检查延迟初始化模式的安全性
5. 追跨线程的数据传递路径

**典型漏洞模式**:
```java
// 危险: 共享变量未同步
class Counter {
    private int count = 0; // 多个线程并发访问
    public void increment() { count++; }
    public int get() { return count; }
}

// 危险: 延迟初始化未同步
class Singleton {
    private static Singleton instance;
    public static Singleton getInstance() {
        if (instance == null) { // 竞态条件
            instance = new Singleton();
        }
        return instance;
    }
}

// 安全: 使用同步保护
class Counter {
    private int count = 0;
    private final Object lock = new Object();
    public void increment() {
        synchronized(lock) { count++; }
    }
    public int get() {
        synchronized(lock) { return count; }
    }
}

// 安全: 使用原子类
class Counter {
    private final AtomicInteger count = new AtomicInteger(0);
    public void increment() { count.incrementAndGet(); }
    public int get() { return count.get(); }
}
```

**防护措施**:
- 使用`synchronized`关键字或`ReentrantLock`保护共享状态
- 使用线程安全集合: `ConcurrentHashMap`、`CopyOnWriteArrayList`
- 使用原子类: `AtomicInteger`、`AtomicReference`、`AtomicBoolean`
- 对延迟初始化使用双重检查锁(DCL)或静态初始化
- 使用不可变对象避免状态同步问题
- 考虑使用无锁数据结构或算法

---

### CWD-1132 在多线程上下文中对共享数据的非同步访问
在多线程环境中访问共享数据时未正确同步,导致数据竞争或不一致。

**触发条件**:
- 多个线程同时读写共享数据结构: List、Map、Set
- 非线程安全的集合被并发修改: `ArrayList`的`add`/`remove`
- 迭代器在集合被修改时并发迭代: `ConcurrentModificationException`
- 共享对象的字段被多线程并发修改
- 使用ThreadLocal不当,数据泄露到其他线程

**分析方法**:
1. 识别所有可能被多线程访问的数据结构
2. 检查数据结构的类型是否为线程安全
3. 追踪迭代器的使用,检查并发修改
4. 验证ThreadLocal的清理逻辑
5. 检查并发访问的代码路径

**典型漏洞模式**:
```java
// 危险: 非线程安全集合并发访问
List<String> list = new ArrayList<>(); // 非线程安全
// 多个线程同时调用会出问题

// 危险: 迭代时并发修改
for (String item : list) {
    if (shouldRemove(item)) {
        list.remove(item); // ConcurrentModificationException
    }
}

// 危险: 共享对象字段未同步
class SharedObject {
    public String name; // 多个线程同时读写
}

// 安全: 使用线程安全集合
List<String> list = new CopyOnWriteArrayList<>();
List<String> map = new ConcurrentHashMap<>();

// 安全: 同步迭代
synchronized(list) {
    Iterator<String> it = list.iterator();
    while (it.hasNext()) {
        String item = it.next();
        if (shouldRemove(item)) {
            it.remove(); // 使用迭代器移除
        }
    }
}

// 安全: 保护共享对象访问
class SharedObject {
    private String name;
    private final Object lock = new Object();
    public String getName() {
        synchronized(lock) { return name; }
    }
    public void setName(String name) {
        synchronized(lock) { this.name = name; }
    }
}
```

**防护措施**:
- 使用并发集合: `ConcurrentHashMap`、`ConcurrentLinkedQueue`
- 使用适合的防御性拷贝集合: `CopyOnWriteArrayList`、`Collections.synchronizedList`
- 迭代时使用显式同步或并发迭代器
- 使用`BlockingQueue`实现生产者-消费者模式
- 对自定义共享对象添加适当的同步机制
- 正确使用ThreadLocal并及时清理

---

### CWD-1134 同步不正确
同步机制使用不当,仍然无法保证线程安全或导致性能问题。

**触发条件**:
- 锁范围过小,无法保护完整操作
- 使用`volatile`代替`synchronized`保护复合操作
- 同步块锁错对象: 锁`this`而非共享对象
- 使用字符串字面量作为锁对象(可能被优化的池化)
- 忘记释放锁或在异常中未释放

**分析方法**:
1. 验证同步块是否覆盖所有对共享资源的访问
2. 检查锁对象是否正确,是否是共享的还是局部的
3. 验证锁的释放逻辑,包括异常路径
4. 检查`volatile`的使用场景是否正确
5. 识别同步范围过小导致的竞态

**典型漏洞模式**:
```java
// 危险: 锁范围过小
public void transfer(Account from, Account to, int amount) {
    synchronized(from) { // 只锁一个账户
        int balance = from.getBalance();
        if (balance >= amount) {
            synchronized(to) { // 另外一个锁
                from.withdraw(amount);
                to.deposit(amount); // 可能不一致
            }
        }
    }
}

// 危险: 使用局部变量作为锁
public void processData() {
    Object lock = new Object(); // 每次调用创建新锁
    synchronized(lock) { // 无效同步
        // ...
    }
}

// 危险: 使用字符串字面量作为锁
synchronized("MY_LOCK") { // 可能被字符串常量池共享
    // ...
}

// 危险: volatile不保证复合操作原子性
private volatile int counter;
public void increment() { counter++; } // 非原子

// 安全: 正确的锁范围和对象
private final Object transferLock = new Object();
public void transfer(Account from, Account to, int amount) {
    synchronized(transferLock) { // 使用全局锁保护转账
        int balance = from.getBalance();
        if (balance >= amount) {
            from.withdraw(amount);
            to.deposit(amount);
        }
    }
}

// 安全: 使用try-finally确保锁释放
lock.lock();
try {
    // 临界区代码
} finally {
    lock.unlock(); // 确保锁被释放
}
```

**防护措施**:
- 使用专用的锁对象,避免锁错对象
- 使用`final`修饰锁对象,避免被重新赋值
- 使用`try-finally`确保可重入锁(REentrantLock)被释放
- 同步范围要足够覆盖临界区的所有操作
- 理解`volatile`的局限性: 只保证可见性,不保证原子性
- 对于跨越多个方法的操作,使用外部协调而非内部锁

---

### CWD-1135 在同步访问远程资源时未设置超时时间
在同步访问远程资源或服务时未设置超时,可能导致线程被永久阻塞,影响系统可用性。

**触发条件**:
- 网络请求未设置超时: HTTP请求、数据库查询、FTP上传
- 套接字读写未设置超时: `socket.read()`、`socket.write()`
- 获取锁未设置超时: `lock.lock()`可能导致死锁
- 等待条件变量未设置超时: `condition.wait()`可能永久等待
- 远程调用未设置超时: RPC调用、消息队列消费

**分析方法**:
1. 识别所有阻塞操作: 网络、IO、锁、等待
2. 检查是否设置了合理的超时时间
3. 验证超时后的处理逻辑
4. 检查是否使用带超时的API
5. 评估阻塞操作对系统可用性的影响

**典型漏洞模式**:
```java
// 危险: HTTP请求未设置超时
HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create(url))
    .build();
HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
// 如果服务端无响应,线程永久阻塞

// 危险: 网络套接字未设置超时
Socket socket = new Socket(host, port);
InputStream in = socket.getInputStream();
byte[] buffer = new byte[1024];
in.read(buffer); // 可能永久阻塞

// 危险: 获取锁未设置超时
lock.lock(); // 如果锁被占用,线程永久等待
// 临界区
lock.unlock();

// 危险: 等待条件未设置超时
synchronized(condition) {
    condition.wait(); // 可能永久等待
}

// 安全: HTTP请求设置超时
HttpClient client = HttpClient.newBuilder()
    .connectTimeout(Duration.ofSeconds(30))
    .build();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create(url))
    .timeout(Duration.ofSeconds(60))
    .build();
HttpResponse<String> response = client.send(request, BodyHandlers.ofString());

// 安全: Socket设置超时
Socket socket = new Socket();
socket.connect(new InetSocketAddress(host, port), 5000);
socket.setSoTimeout(10000);
InputStream in = socket.getInputStream();
byte[] buffer = new byte[1024];
in.read(buffer); // 最多等待10秒

// 安全: 锁设置超时
if (lock.tryLock(30, TimeUnit.SECONDS)) {
    try {
        // 临界区
    } finally {
        lock.unlock();
    }
} else {
    // 处理获取锁超时
}
```

**防护措施**:
- 为所有网络请求设置连接和读取超时
- 为套接字操作设置超时: `setSoTimeout`
- 使用`tryLock`替代`lock`,设置超时时间
- 使用带超时版本的等待方法: `wait(timeout)`
- 为RPC调用设置合理的超时时间
- 为消息消费设置超时以避免无限等待
- 超时后进行适当的错误处理和重试逻辑

---

### CWD-1137 在并发上下文中使用不可重入函数
在多线程环境或中断上下文中调用不可重入函数,可能导致数据损坏或死锁。

**触发条件**:
- 信号处理器中调用不可重入函数
- 异步信号处理中使用非异步信号安全函数
- 线程池回调中使用不可重入函数
- 定时器回调中使用共享状态且未同步
- 多个线程同时调用共享库的不可重入API

**分析方法**:
1. 识别所有异步执行的上下文: 信号处理、中断、回调
2. 检查这些上下文中调用的函数
3. 验证这些函数是否为可重入或线程安全
4. 检查是否有共享状态访问
5. 确认是否使用了异步信号安全函数

**典型漏洞模式**:
```c
// 危险: 信号处理器调用不可重入函数
#include <signal.h>
#include <stdio.h>

void signal_handler(int sig) {
    printf("Signal received\n"); // printf不可重入!
}

int main() {
    signal(SIGINT, signal_handler);
    while(1);
    return 0;
}

// 危险: 异步信号中使用malloc
#include <signal.h>
#include <stdlib.h>

void signal_handler(int sig) {
    void* ptr = malloc(1024); // malloc不可重入!
    free(ptr);
}

// 危险: 修改全局状态
int global_counter = 0;

void signal_handler(int sig) {
    global_counter++; // 数据竞争!
}

// 安全: 使用可重入函数
#include <signal.h>
#include <unistd.h>

void signal_handler(int sig) {
    write(STDOUT_FILENO, "Signal\n", 7); // write是异步信号安全函数
}

// 安全: 使用原子操作
#include <signal.h>
#include <stdatomic.h>

atomic_int global_counter = ATOMIC_VAR_INIT(0);

void signal_handler(int sig) {
    atomic_fetch_add(&global_counter, 1);
}
```

**防护措施**:
- 在信号处理器中只使用异步信号安全函数(如`write`、`_exit`)
- 避免在异步上下文中调用内存分配函数(`malloc`/`free`)
- 使用原子操作或`volatile sig_atomic_t`类型保护共享状态
- 信号处理器中只设置标志位,主循环处理实际逻辑
- 使用线程本地存储避免共享状态
- 检查函数文档,确认其可重入性和线程安全性
- 在中断上下文(ISR)中使用专门的锁机制(如自旋锁)

---

## 代码分析视角

### 并行分析
- **线程图分析**: 绘制线程创建和通信图,识别并发点
- **执行路径分析**: 追踪不同线程的可能执行路径
- **交错场景分析**: 识别关键的交错执行导致的问题
- **资源竞争分析**: 识别对共享资源的竞争访问

### 同步分析
- **锁图分析**: 绘制锁的获取和释放图,识别死锁环
- **锁粒度分析**: 评估锁的覆盖范围和持锁时间
- **同步机制匹配**: 验证读写操作的同步一致性
- **内存模型分析**: 检查内存可见性和重排序问题

### 竞态检测
- **数据竞争检测**: 识别无保护的并发读写
- **TOCTOU检测**: 识别检查-时间-使用竞态窗口
- **原子性验证**: 检查复合操作的原子性保证
- **一致性问题**: 识别可能导致不一致状态的场景

---

## 典型触发条件

| 并发类型 | 高频触发条件 |
|---------|------------|
| 竞争条件 | check-then-act未原子、复合操作、双重检查锁不正确 |
| 锁定不当 | 锁顺序不一致、嵌套锁、持锁时间长、锁泄漏 |
| 缺少同步 | 共享变量未加锁、延迟初始化未同步、volatile误用 |
| 非同步访问 | 非线程安全集合、迭代器并发修改、共享对象字段 |
| 同步不正确 | 锁范围过小、锁错对象、锁未释放、volatile滥用 |
| 未设置超时 | 网络请求、Socket操作、锁获取、条件等待 |
| 不可重入函数 | 信号处理器调用非异步安全函数、中断中使用共享状态 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+并发类型]

## 并发上下文与共享资源
- 并发类型: [竞争条件/锁定不当/缺少同步等]
- 问题位置: [文件:行号] [函数名]
- 共享资源: [变量/数据结构/对象]
- 数据竞争路径: [详细的数据流追踪]

## 证据链与逻辑推理
1. 代码证据:具体代码行和并发访问模式
2. 并发分析:线程执行路径和交错场景
3. 漏洞描述:具体的并发安全问题
4. 推理:为何导致线程安全问题

## 真实触发条件
线程调度条件、执行顺序、可利用性评估

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 触发条件难度 |
| 影响范围 | 高/中/低 | 数据不一致/死锁/DoS/未定义行为 |
| 稳定性 | 高/中/低 | 死锁/活锁/性能下降 |
| 可用性 | 高/中/低 | 线程阻塞/系统挂起 |

## 修改建议
方案一+代码示例+优缺点
推荐:XXX

## 边界与不确定性
确定事实、不确定假设、建议调查点
```

---

## 非"执行逻辑"

本文档仅作知识参考和结构化指南,不执行代码、自动扫描、生成修复脚本或最终裁决。模型应结合具体业务场景推理,非机械匹配。

---

## 典型误报场景

不应报告:
- 使用线程安全库和并发集合的正确使用
- 共享变量仅在单线程环境访问
- 使用原子变量保护的单步操作
- 正确实现的同步机制和锁顺序
- ThreadLocal变量未跨线程传递
- 不可变对象的并发访问
- 每次调用独立创建的独立对象
- 经过严格同步检查的代码区域
- 使用try-finally确保锁释放

---

## 异步信号安全函数列表

在信号处理器中只能使用以下函数:
- `write()`、`read()`、`_exit()`
- `sig_atomic_t`类型的原子操作
- `signal()`、`sigaction()`
- `kill()`
- `pause()`

避免使用: `printf`、`malloc`、`free`、`fprintf`、`strcat`等

---

**文档版本**: v1.0 | **适用语言**: C/C++/Java/Python等多语言通用