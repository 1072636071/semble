# ArkTS并发问题分析指导

## 能力目标

基于ArkTS的并发模型和内存一致性模型,判断真实线程安全风险,识别可触发的竞态条件,区分并发安全和误报场景。

---

## 前置判断

获取:
- **并发模型**: TaskPool(任务池)、Worker线程、异步并发(async/await、Promise)
- **内存模型**: Actor模型(隔离内存空间)、共享内存(sendableClass)
- **共享资源**: 
  - Sendable数据: @Sendable装饰的类、collections.Array/Map/Set
  - 跨线程数据: 通过postMessage传递的可序列化对象
  - 全局单例、AppStorage、LocalStorage
- **同步机制**: 
  - ArkTS无传统锁机制,依赖Actor模型
  - 原子操作: Atomics API
  - 消息传递: postMessage/on/once
- **异步操作**: Promise、async/await、回调函数、EventEmitter
- **是否使用Sendable**: collections库、@Sendable类、@Concurrent装饰器

---

## 分析流程

### Step 1 — 识别并发模式

定位并发执行点:
- **TaskPool任务**: `taskpool.execute()`、`Task.constructor()`、`TaskGroup`
- **Worker线程**: `new Worker()`、`worker.postMessage()`
- **异步并发**: `async`函数、`Promise`、`@Concurrent`装饰器
- **定时器**: `setTimeout()`、`setInterval()`
- **UI事件循环**: 组件事件回调、生命周期回调
- **并发容器操作**: `collections.Array`、`collections.Map`的并发访问

**ArkTS并发模型关键特征**:
```typescript
// TaskPool - 轻量级任务并发
import taskpool from '@ohos.taskpool';

@Concurrent
function heavyTask(data: number): number {
  return data * 2;
}

// 任务提交
let task = new taskpool.Task(heavyTask, 100);
taskpool.execute(task).then(result => {
  console.log('Result:', result);
});

// Worker - 独立线程,隔离内存
// main thread
let worker = new worker.ThreadWorker('workers/MyWorker.ts');
worker.postMessage({ type: 'start', data: 100 });
worker.on('message', (msg) => {
  console.log('从Worker收到:', msg);
});
```

### Step 2 — 追踪共享资源访问

**ArkTS特殊性**: 默认采用Actor模型,线程间内存隔离,但存在例外:

- **Sendable数据共享**:
  - `@Sendable`装饰的类可跨线程引用
  - `collections`库的容器(Array/Map/Set)支持并发访问
  - 需检查是否存在数据竞争

- **AppStorage/LocalStorage**:
  - 应用级全局状态,可能被多个组件并发访问
  - 需验证读写保护

- **单例模式**:
  - 静态实例可能在多个并发上下文访问
  - 延迟初始化存在竞态风险

**追踪关键点**:
1. 识别`@Sendable`类和`collections`容器
2. 检查全局状态(AppStorage、单例)的访问模式
3. 分析TaskPool任务间的数据传递
4. 验证Worker消息传递的数据一致性

### Step 3 — 验证同步机制

**ArkTS同步策略**:
1. **Actor模型隔离** (推荐):
   - 每个Worker/TaskPool任务拥有独立内存
   - 通过消息传递通信,自动序列化/反序列化

2. **Sendable + 原子操作**:
   - 使用`Atomics`进行原子读写
   - `collections`容器内置线程安全保证

3. **消息队列**:
   - 通过`postMessage`串行化操作
   - 避免直接共享可变状态

**检查要点**:
- 是否错误假设Sendable对象自动线程安全
- 是否在Sendable类中正确使用原子操作
- 消息传递是否可能导致顺序问题
- 是否存在回调地狱导致的竞态

### Step 4 — 检测竞态条件

**ArkTS特有竞态场景**:
1. **Sendable对象的非原子复合操作**
2. **AppStorage的check-then-act**
3. **Worker消息处理的时序依赖**
4. **TaskPool任务完成顺序的假设**
5. **异步操作与UI更新的竞争**

---

## 风险模式分类

### CAT-0051 竞争条件

应用程序的执行行为依赖于多个TaskPool任务或Worker线程的相对执行时机,当执行顺序无法保证时导致不一致状态。

**触发条件**:
- Sendable对象的check-then-act未原子化
- AppStorage的读-改-写操作未同步
- 多个TaskPool任务同时修改共享Sendable数据
- Worker消息处理依赖特定顺序但未保证
- 异步操作完成时机假设错误

**分析方法**:
1. 识别所有Sendable共享状态的修改操作
2. 检查是否存在check-then-act时间窗口
3. 验证复合操作是否使用Atomics原子化
4. 追踪可能导致不一致的TaskPool执行路径

**典型漏洞模式**:

```typescript
// 危险: Sendable对象的非原子递增
@Sendable
class Counter {
  count: number = 0;
  
  increment(): void {
    this.count++; // 非原子: read -> modify -> write
  }
}

let counter = new Counter();
// 多个TaskPool任务并发调用increment会导致计数错误

// 危险: AppStorage的check-then-act
// Task 1
if (AppStorage.get('user') === undefined) {
  // 时间窗口! Task 2可能同时检查并初始化
  AppStorage.setOrCreate('user', new User());
}

// 危险: 依赖TaskPool任务完成顺序
let results: number[] = [];
for (let i = 0; i < 10; i++) {
  taskpool.execute(new taskpool.Task(processData, i))
    .then(result => {
      results.push(result); // 顺序不确定!
    });
}

// 安全: 使用Atomics原子操作
import { collections } from '@kit.ArkTS';

@Sendable
class SafeCounter {
  private buffer: SharedArrayBuffer = new SharedArrayBuffer(4);
  private view: Int32Array = new Int32Array(this.buffer);
  
  increment(): void {
    Atomics.add(this.view, 0, 1); // 原子递增
  }
  
  get count(): number {
    return Atomics.load(this.view, 0);
  }
}

// 安全: 使用TaskGroup保证顺序
let group = new taskpool.TaskGroup();
for (let i = 0; i < 10; i++) {
  group.addTask(new taskpool.Task(processData, i));
}
let results = await taskpool.execute(group); // 结果与任务添加顺序一致

// 安全: 使用collections并发容器
let safeArray = new collections.Array<number>();
// collections容器内部保证线程安全
```

**防护措施**:
- 使用`Atomics` API进行原子操作
- 使用`collections`库的并发安全容器
- 避免在Sendable对象中实现复合操作,改用消息传递
- 使用`TaskGroup`管理任务依赖和顺序
- 将状态封装在单个Actor(Worker)内,避免跨线程共享

---

### CAT-0052 锁定不当

**注意**: ArkTS不提供传统锁机制,但仍存在类似问题:
- Worker消息处理的阻塞
- 异步操作的串行化不当
- 资源访问的串行瓶颈

**触发条件**:
- Worker同步等待其他Worker响应(死锁风险)
- 消息处理函数中阻塞等待异步操作
- 过度串行化导致性能瓶颈
- UI线程被长时间阻塞

**分析方法**:
1. 识别Worker间的消息依赖关系
2. 检查消息处理函数的执行时间
3. 验证是否存在循环等待
4. 评估串行化对性能的影响

**典型漏洞模式**:

```typescript
// 危险: Worker间循环依赖(死锁风险)
// Worker A
worker.postMessage({ type: 'request', target: 'B' });
// 等待B的响应...再继续

// Worker B (同时)
worker.postMessage({ type: 'request', target: 'A' });
// 等待A的响应...再继续
// 结果: 两个Worker相互等待,死锁

// 危险: 消息处理函数阻塞
worker.on('message', async (msg) => {
  // 长时间同步操作阻塞消息处理
  let result = heavyComputation(msg.data); // 阻塞其他消息
  worker.postMessage({ result });
});

// 危险: UI线程过度阻塞
@Entry
@Component
struct MyPage {
  build() {
    Button('处理数据')
      .onClick(async () => {
        // UI线程直接执行耗时操作
        let result = await processHugeData(); // 阻塞UI,卡顿
        this.updateUI(result);
      })
  }
}

// 安全: 避免循环依赖,使用中介者模式
// 使用主线程作为协调者
// Worker A/B只与主线程通信,不直接互联

// 安全: 异步处理消息,避免阻塞
worker.on('message', (msg) => {
  // 立即返回,异步处理
  processMessageAsync(msg).then(result => {
    worker.postMessage({ result });
  });
});

// 安全: 将耗时操作移到TaskPool
@Entry
@Component
struct MyPage {
  build() {
    Button('处理数据')
      .onClick(async () => {
        // 使用TaskPool处理耗时任务
        let task = new taskpool.Task(processHugeData);
        let result = await taskpool.execute(task);
        this.updateUI(result);
      })
  }
}
```

**防护措施**:
- 避免Worker间直接依赖,使用星型拓扑(主线程为中心)
- 消息处理函数保持轻量,耗时操作异步化
- 耗时计算使用TaskPool,避免阻塞UI或Worker
- 设计时避免循环等待,使用超时机制
- 合理划分Worker职责,减少跨Worker协作

---

### CWD-1130 缺少同步

对共享资源的访问缺少必要的同步机制,导致数据竞争或不一致状态。

**触发条件**:
- Sendable对象字段未使用原子操作
- AppStorage读写未考虑并发
- 全局单例的延迟初始化未同步
- collections容器误用(假设绝对线程安全)
- 跨Worker的状态同步缺失

**分析方法**:
1. 识别所有`@Sendable`类和共享数据
2. 检查AppStorage/LocalStorage的并发访问
3. 验证单例模式的线程安全性
4. 追踪Worker间的状态一致性

**典型漏洞模式**:

```typescript
// 危险: Sendable类字段未同步
@Sendable
class UserManager {
  private users: Map<string, User> = new Map(); // 非线程安全!
  
  addUser(id: string, user: User): void {
    this.users.set(id, user); // 多个TaskPool任务并发调用会有问题
  }
}

// 危险: AppStorage并发访问未同步
// Component A
let count = AppStorage.get<number>('counter') || 0;
count++; // 时间窗口
AppStorage.set('counter', count); // Component B可能同时修改

// 危险: 单例延迟初始化未同步
class DatabaseManager {
  private static instance?: DatabaseManager;
  
  static getInstance(): DatabaseManager {
    if (!this.instance) { // 竞态条件!
      this.instance = new DatabaseManager();
    }
    return this.instance;
  }
}

// 危险: 误用collections容器
let sharedArray = new collections.Array<number>();
// 虽然容器本身线程安全,但复合操作不是:
if (sharedArray.length === 0) { // 检查
  sharedArray.push(1); // 操作 - 中间可能被其他线程修改!
}

// 安全: 使用collections并发容器
@Sendable
class UserManager {
  private users: collections.Map<string, User> = new collections.Map();
  
  addUser(id: string, user: User): void {
    this.users.set(id, user); // collections.Map保证线程安全
  }
}

// 安全: 使用原子操作保护AppStorage
import { Atomics } from '@kit.ArkTS';

// 使用专门的Counter类配合Atomics
@Sendable
class AppCounter {
  private buffer: SharedArrayBuffer = new SharedArrayBuffer(4);
  private view: Int32Array = new Int32Array(this.buffer);
  
  increment(): number {
    return Atomics.add(this.view, 0, 1);
  }
  
  get value(): number {
    return Atomics.load(this.view, 0);
  }
}

// 安全: 单例使用立即初始化
class DatabaseManager {
  private static readonly instance: DatabaseManager = new DatabaseManager();
  
  static getInstance(): DatabaseManager {
    return this.instance; // 类加载时初始化,线程安全
  }
  
  private constructor() {} // 防止外部实例化
}

// 安全: 原子化复合操作
function addIfEmpty(array: collections.Array<number>, value: number): boolean {
  // 使用原子CAS操作
  let buffer = new SharedArrayBuffer(4);
  let lock = new Int32Array(buffer);
  
  // 尝试获取"锁"
  if (Atomics.compareExchange(lock, 0, 0, 1) === 0) {
    try {
      if (array.length === 0) {
        array.push(value);
        return true;
      }
      return false;
    } finally {
      Atomics.store(lock, 0, 0); // 释放
    }
  }
  return false;
}
```

**防护措施**:
- Sendable类内部使用`collections`容器或`Atomics`
- AppStorage操作原子化或限制在单线程
- 单例使用立即初始化或双重检查锁(DCL)模式
- 理解collections容器的线程安全边界
- 优先使用消息传递而非共享状态

---

### CWD-1132 在多线程上下文中对共享数据的非同步访问

在TaskPool或Worker环境中访问共享数据时未正确同步,导致数据竞争或不一致。

**触发条件**:
- 非Sendable对象被多个TaskPool任务访问
- 普通Array/Map在并发环境使用
- Worker间共享引用(通过序列化规避)
- UI状态与后台任务状态不一致

**分析方法**:
1. 识别所有TaskPool任务访问的数据
2. 检查数据类型是否为Sendable/collections
3. 追踪Worker postMessage的数据流向
4. 验证UI状态更新的同步性

**典型漏洞模式**:

```typescript
// 危险: 非Sendable对象在TaskPool中共享
class Config { // 非@Sendable
  settings: Map<string, string> = new Map();
}

let config = new Config();

@Concurrent
function updateConfig(key: string, value: string): void {
  config.settings.set(key, value); // 错误! 非Sendable对象
}

// 多个任务并发修改会导致问题
taskpool.execute(new taskpool.Task(updateConfig, 'k1', 'v1'));
taskpool.execute(new taskpool.Task(updateConfig, 'k2', 'v2'));

// 危险: 普通集合在并发环境
let dataList: Array<number> = []; // 非collections.Array

@Concurrent
function addData(value: number): void {
  dataList.push(value); // 非线程安全!
}

// 危险: UI状态与后台任务竞争
@Entry
@Component
struct DataView {
  @State data: string[] = [];
  
  aboutToAppear() {
    // 后台任务修改data
    taskpool.execute(new taskpool.Task(loadData))
      .then(result => {
        this.data = result; // 竞态: 用户可能同时交互
      });
    
    // 用户交互同时修改data
    this.data.push('user input');
  }
}

// 安全: 使用Sendable和collections
@Sendable
class Config {
  settings: collections.Map<string, string> = new collections.Map();
}

let config = new Config();

@Concurrent
function updateConfig(cfg: Config, key: string, value: string): void {
  cfg.settings.set(key, value); // 安全: collections保证线程安全
}

// 安全: 使用collections并发容器
let dataList: collections.Array<number> = new collections.Array();

@Concurrent
function addData(list: collections.Array<number>, value: number): void {
  list.push(value); // 线程安全
}

// 安全: 串行化UI更新
@Entry
@Component
struct DataView {
  @State data: string[] = [];
  private loading: boolean = false;
  
  aboutToAppear() {
    this.loading = true;
    taskpool.execute(new taskpool.Task(loadData))
      .then(result => {
        if (this.loading) { // 检查是否仍在加载
          this.data = result;
          this.loading = false;
        }
      });
  }
  
  onUserInput(input: string) {
    if (!this.loading) { // 等待加载完成
      this.data.push(input);
    }
  }
}
```

**防护措施**:
- TaskPool任务只使用Sendable数据或通过参数传递副本
- 使用`collections`库替代普通集合
- Worker通信依赖序列化,避免共享引用
- UI状态更新使用单向数据流
- 后台任务结果通过消息传递而非直接修改共享状态

---

### CWD-1134 同步不正确

同步机制使用不当,仍然无法保证线程安全或导致性能问题。

**触发条件**:
- Atomics使用范围过小,无法保护完整操作
- collections容器的复合操作假设原子性
- 消息传递的顺序依赖未保证
- Worker生命周期管理不当导致消息丢失

**分析方法**:
1. 验证Atomics操作是否覆盖完整的临界区
2. 检查collections容器的复合操作
3. 追踪消息传递的时序依赖
4. 验证Worker的创建和销毁时机

**典型漏洞模式**:

```typescript
// 危险: Atomics范围过小
@Sendable
class BankAccount {
  private balanceBuffer: SharedArrayBuffer = new SharedArrayBuffer(4);
  private balance: Int32Array = new Int32Array(this.balanceBuffer);
  
  transfer(amount: number): boolean {
    let current = Atomics.load(this.balance, 0);
    if (current >= amount) {
      // 时间窗口! 其他任务可能同时检查并转账
      Atomics.sub(this.balance, 0, amount); // 不保护整个操作
      return true;
    }
    return false;
  }
}

// 危险: collections复合操作非原子
let userMap = new collections.Map<string, User>();

function addUserIfAbsent(id: string, user: User): boolean {
  if (!userMap.has(id)) { // 检查
    userMap.set(id, user); // 操作 - 中间可能被插入
    return true;
  }
  return false;
}

// 危险: 消息顺序假设
// 主线程
worker.postMessage({ type: 'init', data: config });
worker.postMessage({ type: 'process', data: input });
// 假设process一定在init之后执行 - 不保证!

// 危险: Worker提前销毁
let worker = new worker.ThreadWorker('workers/MyWorker.ts');
worker.postMessage({ type: 'task', data: largeData });
worker.terminate(); // 立即销毁,消息可能丢失!

// 安全: 使用CAS保护完整操作
@Sendable
class BankAccount {
  private balanceBuffer: SharedArrayBuffer = new SharedArrayBuffer(4);
  private balance: Int32Array = new Int32Array(this.balanceBuffer);
  
  transfer(amount: number): boolean {
    while (true) {
      let current = Atomics.load(this.balance, 0);
      if (current < amount) {
        return false; // 余额不足
      }
      
      let newBalance = current - amount;
      // CAS: 如果current未变,则更新为newBalance
      let result = Atomics.compareExchange(
        this.balance, 0, current, newBalance
      );
      
      if (result === current) {
        return true; // 成功
      }
      // 失败则重试
    }
  }
}

// 安全: 单个原子操作或加锁
function addUserIfAbsent(
  userMap: collections.Map<string, User>,
  id: string,
  user: User
): boolean {
  // 方案1: 直接set,使用返回值判断
  let oldValue = userMap.set(id, user);
  return oldValue === undefined;
  
  // 方案2: 使用自定义锁机制
  // (需要配合Atomics实现)
}

// 安全: 使用状态机保证消息顺序
class WorkerController {
  private worker: worker.ThreadWorker;
  private state: 'init' | 'ready' | 'processing' = 'init';
  private pendingTasks: Array<any> = [];
  
  constructor() {
    this.worker = new worker.ThreadWorker('workers/MyWorker.ts');
    this.worker.on('message', (msg) => {
      if (msg.type === 'ready') {
        this.state = 'ready';
        this.processPendingTasks();
      }
    });
  }
  
  sendTask(data: any) {
    if (this.state === 'ready') {
      this.worker.postMessage({ type: 'process', data });
      this.state = 'processing';
    } else {
      this.pendingTasks.push(data);
    }
  }
  
  private processPendingTasks() {
    while (this.pendingTasks.length > 0) {
      let data = this.pendingTasks.shift();
      this.sendTask(data);
    }
  }
}

// 安全: 等待Worker完成后再销毁
let worker = new worker.ThreadWorker('workers/MyWorker.ts');
worker.postMessage({ type: 'task', data: largeData });

worker.once('message', (msg) => {
  if (msg.type === 'done') {
    worker.terminate(); // 任务完成后销毁
  }
});
```

**防护措施**:
- 使用CAS循环保护复合操作的原子性
- 为collections容器的复合操作添加额外保护
- 实现消息顺序控制机制或状态机
- Worker销毁前确保所有消息已处理
- 设计时减少对消息顺序的依赖

---

### CWD-1135 在同步访问远程资源时未设置超时时间

在同步访问远程资源或服务时未设置超时,可能导致TaskPool任务或Worker被永久阻塞。

**触发条件**:
- HTTP请求未设置超时
- Worker消息等待未设置超时
- Promise未设置超时保护
- 文件IO操作未设置超时
- 数据库查询未设置超时

**分析方法**:
1. 识别所有网络/IO操作
2. 检查是否设置超时参数
3. 验证超时后的处理逻辑
4. 评估阻塞操作对系统的影响

**典型漏洞模式**:

```typescript
// 危险: HTTP请求未设置超时
import http from '@ohos.net.http';

@Concurrent
async function fetchData(url: string): Promise<string> {
  let httpRequest = http.createHttp();
  // 未设置超时,服务器无响应时永久等待
  let response = await httpRequest.request(url);
  return response.result.toString();
}

// 危险: Worker消息等待未超时
function sendAndWait(worker: worker.ThreadWorker, data: any): Promise<any> {
  return new Promise((resolve) => {
    worker.postMessage(data);
    worker.once('message', (msg) => {
      resolve(msg); // 如果Worker never响应,永久pending
    });
  });
}

// 危险: Promise链未设置超时
async function processData(data: any): Promise<void> {
  let step1 = await longOperation1(data);
  let step2 = await longOperation2(step1); // 可能永久等待
  let step3 = await longOperation3(step2);
}

// 危险: 文件读取未设置超时
import fs from '@ohos.file.fs';

@Concurrent
async function readFile(path: string): Promise<string> {
  let file = fs.openSync(path, fs.OpenMode.READ_ONLY);
  // 读取大文件时可能长时间阻塞
  let content = fs.readSync(file.fd, new ArrayBuffer(1024 * 1024));
  fs.closeSync(file);
  return content.toString();
}

// 安全: HTTP设置超时
import http from '@ohos.net.http';

@Concurrent
async function fetchData(url: string): Promise<string> {
  let httpRequest = http.createHttp();
  let response = await httpRequest.request(url, {
    method: http.RequestMethod.GET,
    connectTimeout: 10000, // 连接超时10秒
    readTimeout: 30000,    // 读取超时30秒
  });
  return response.result.toString();
}

// 安全: Worker消息等待设置超时
function sendAndWait(
  worker: worker.ThreadWorker,
  data: any,
  timeoutMs: number = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      reject(new Error('Worker response timeout'));
    }, timeoutMs);
    
    worker.postMessage(data);
    worker.once('message', (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

// 安全: Promise设置超时包装器
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    )
  ]);
}

async function processData(data: any): Promise<void> {
  let step1 = await withTimeout(longOperation1(data), 10000);
  let step2 = await withTimeout(longOperation2(step1), 10000);
  let step3 = await withTimeout(longOperation3(step2), 10000);
}

// 安全: 文件操作使用分块和超时
@Concurrent
async function readFileSafe(path: string): Promise<string> {
  let startTime = Date.now();
  let maxTime = 30000; // 30秒超时
  
  let file = fs.openSync(path, fs.OpenMode.READ_ONLY);
  let chunks: ArrayBuffer[] = [];
  let buffer = new ArrayBuffer(64 * 1024); // 64KB chunks
  
  try {
    while (true) {
      if (Date.now() - startTime > maxTime) {
        throw new Error('File read timeout');
      }
      
      let bytesRead = fs.readSync(file.fd, buffer);
      if (bytesRead === 0) break;
      
      chunks.push(buffer.slice(0, bytesRead));
    }
    
    return chunks.map(c => new TextDecoder().decode(c)).join('');
  } finally {
    fs.closeSync(file);
  }
}
```

**防护措施**:
- 为所有HTTP请求设置`connectTimeout`和`readTimeout`
- Worker消息等待使用`Promise.race`实现超时
- 为Promise链添加超时包装器
- 大文件IO使用分块读取配合超时检查
- 数据库查询设置语句超时参数
- 超时后进行清理和重试逻辑

---

### CWD-1137 在并发上下文中使用不当的函数

在TaskPool或Worker环境中使用不适合并发的API或模式,可能导致数据损坏或意外行为。

**触发条件**:
- TaskPool任务中访问UI相关API
- @Concurrent函数中使用非Sendable参数
- Worker中直接操作DOM或组件状态
- 回调函数中修改外部闭包变量
- 使用全局状态但未考虑并发

**分析方法**:
1. 识别TaskPool/@Concurrent函数的上下文
2. 检查是否使用了UI线程专属API
3. 验证参数类型是否为Sendable
4. 追踪闭包变量的访问模式
5. 检查全局状态的并发安全性

**典型漏洞模式**:

```typescript
// 危险: TaskPool任务访问UI API
@Concurrent
function processAndUpdate(data: number[]): void {
  let result = heavyComputation(data);
  // 错误! TaskPool任务不能直接访问UI
  AppStorage.set('result', result); // 可能崩溃或未定义行为
}

// 危险: @Concurrent函数使用非Sendable参数
class ComplexData { // 非@Sendable
  items: Array<number> = [];
  metadata: Map<string, string> = new Map();
}

@Concurrent
function process(data: ComplexData): void {
  // 错误! ComplexData不是Sendable
  // TaskPool会尝试序列化但可能失败
  for (let item of data.items) {
    console.log(item);
  }
}

// 危险: Worker修改外部闭包变量
let globalCounter = 0;

function startWorker() {
  let worker = new worker.ThreadWorker('workers/CounterWorker.ts');
  worker.on('message', (msg) => {
    globalCounter += msg.increment; // 数据竞争!
  });
}

// 危险: 回调中修改共享状态
let sharedArray: number[] = [];

for (let i = 0; i < 10; i++) {
  taskpool.execute(new taskpool.Task(compute, i))
    .then(result => {
      sharedArray.push(result); // 非线程安全!
    });
}

// 安全: TaskPool任务返回数据,UI线程更新
@Concurrent
function processData(data: number[]): number {
  return heavyComputation(data);
}

// 主线程
taskpool.execute(new taskpool.Task(processData, inputData))
  .then(result => {
    AppStorage.set('result', result); // UI线程安全操作
  });

// 安全: 使用Sendable类型
@Sendable
class ComplexData {
  items: collections.Array<number> = new collections.Array();
  metadata: collections.Map<string, string> = new collections.Map();
}

@Concurrent
function process(data: ComplexData): void {
  // 正确: ComplexData是Sendable
  for (let item of data.items) {
    console.log(item);
  }
}

// 安全: 使用Sendable Counter配合Atomics
@Sendable
class SafeCounter {
  private buffer: SharedArrayBuffer = new SharedArrayBuffer(4);
  private view: Int32Array = new Int32Array(this.buffer);
  
  increment(value: number): void {
    Atomics.add(this.view, 0, value);
  }
  
  get value(): number {
    return Atomics.load(this.view, 0);
  }
}

let globalCounter = new SafeCounter();

function startWorker() {
  let worker = new worker.ThreadWorker('workers/CounterWorker.ts');
  worker.postMessage({ counter: globalCounter });
  // Worker内部调用counter.increment()
}

// 安全: 使用collections并发容器
let sharedArray = new collections.Array<number>();

for (let i = 0; i < 10; i++) {
  taskpool.execute(new taskpool.Task(compute, i))
    .then(result => {
      sharedArray.push(result); // collections保证线程安全
    });
}
```

**防护措施**:
- TaskPool任务只进行计算,结果返回主线程更新UI
- @Concurrent函数参数必须是Sendable或基本类型
- Worker通过消息传递与主线程通信,避免直接访问外部状态
- 使用collections容器或Atomics保护共享状态
- 设计时遵循"计算在TaskPool,状态在主线程"原则
- 避免在并发上下文中使用闭包捕获可变变量

---

## 代码分析视角

### 并行分析
- **TaskPool任务图**: 绘制任务提交和依赖关系
- **Worker通信图**: 追踪消息传递和数据流
- **执行路径分析**: 识别可能的并发执行路径
- **资源竞争分析**: 定位Sendable对象和collections容器的竞争访问

### 同步分析
- **Atomics使用检查**: 验证原子操作的覆盖范围
- **消息顺序分析**: 检查消息依赖和时序假设
- **collections容器分析**: 评估复合操作的原子性
- **内存模型验证**: 确认数据传递方式(序列化vs共享)

### 竞态检测
- **Sendable对象竞态**: 检查非原子复合操作
- **AppStorage竞态**: 识别check-then-act模式
- **任务完成顺序**: 验证是否依赖任务执行顺序
- **UI与后台竞争**: 检查状态更新的冲突

---

## 典型触发条件

| 并发类型 | 高频触发条件 |
|---------|------------|
| 竞争条件 | Sendable对象非原子操作、AppStorage check-then-act、TaskPool顺序依赖 |
| 阻塞问题 | Worker循环等待、消息处理阻塞、UI线程耗时操作 |
| 缺少同步 | 非Sendable共享、普通集合并发、单例未同步 |
| 非同步访问 | 普通对象在TaskPool、UI状态与后台竞争 |
| 同步不正确 | Atomics范围过小、collections复合操作、消息顺序假设 |
| 未设置超时 | HTTP无超时、Worker消息等待、Promise无超时保护 |
| 不当API使用 | TaskPool访问UI、非Sendable参数、闭包变量修改 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+并发类型]

## 并发上下文与共享资源
- 并发类型: [竞争条件/阻塞问题/缺少同步等]
- 问题位置: [文件:行号] [函数名]
- 共享资源: [Sendable对象/collections容器/AppStorage]
- 数据竞争路径: [详细的TaskPool/Worker执行流程]

## 证据链与逻辑推理
1. 代码证据: 具体代码行和并发访问模式
2. 并发分析: TaskPool任务/Worker线程执行路径
3. 漏洞描述: 具体的并发安全问题
4. 推理: 为何导致线程安全问题

## 真实触发条件
TaskPool调度条件、Worker消息时序、UI交互时机

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 触发条件难度 |
| 影响范围 | 高/中/低 | 数据不一致/应用崩溃/性能下降 |
| 稳定性 | 高/中/低 | 阻塞/卡顿/ANR |
| 可用性 | 高/中/低 | UI冻结/Worker hung |

## 修改建议
方案一+ArkTS代码示例+优缺点
推荐: XXX

## 边界与不确定性
确定事实、不确定假设、建议调查点
```

---

## 非"执行逻辑"

本文档仅作知识参考和结构化指南,不执行代码、自动扫描、生成修复脚本或最终裁决。模型应结合ArkTS具体业务场景推理,非机械匹配。

---

## 典型误报场景

不应报告:
- 使用`collections`容器的单一操作(已保证线程安全)
- 仅在主线程访问的AppStorage/LocalStorage
- Worker通过序列化传递数据(无共享引用)
- TaskPool任务使用Sendable参数和返回值
- 使用Atomics正确保护的操作
- 立即初始化的单例(类加载时)
- UI组件的@State/@Prop(框架保证线程安全)
- TaskGroup管理的有序任务执行
- 正确使用超时和错误处理的异步操作

---

## ArkTS并发安全最佳实践

### 核心原则
1. **优先使用Actor模型**: Worker线程隔离,通过消息传递通信
2. **最小化共享状态**: 能用消息传递就不用共享内存
3. **Sendable + collections**: 必须共享时使用官方并发容器
4. **Atomics for primitives**: 简单原子操作使用Atomics API
5. **UI线程单一职责**: UI更新只在主线程,计算在TaskPool

### 设计模式
- **计算密集**: TaskPool + @Concurrent装饰器
- **独立线程**: Worker + 消息传递
- **共享数据**: @Sendable类 + collections容器
- **原子操作**: Atomics API
- **顺序保证**: TaskGroup或消息队列

### 性能优化
- TaskPool适合大量短任务(自动调度)
- Worker适合长期运行的独立线程
- 避免频繁跨线程通信(序列化开销)
- 批量传递数据减少消息次数
- 使用TypedArray和SharedArrayBuffer优化大数据传递

---

**文档版本**: v1.0  
**适用平台**: HarmonyOS NEXT (API 12+)  
**ArkTS版本**: 5.0+  
**更新日期**: 2026-01-27