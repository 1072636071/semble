# ArkTS 内存安全指导文档

## 能力目标

基于 ArkTS 语言特性和运行时行为,识别真实内存安全风险,包括生命周期管理、并发访问、原生交互等场景,避免模式匹配式误报。

---

## 前置判断

获取:
- 语言特性:ArkTS 基于 TypeScript,具有自动垃圾回收(GC),但需关注生命周期管理
- 是否使用原生交互(Native/C++ FFI)
- 数据共享方式:SharedArrayBuffer、TaskPool、Worker
- 并发模型:多线程访问、异步操作
- 输入来源:用户输入/网络数据/文件系统/IPC通信
- UI组件生命周期管理

---

## 分析流程

### Step 1 — 识别内存操作点
定位内存相关操作:
- 大对象分配:数组、集合、图片/视频资源
- 原生内存交互:Native API、ArrayBuffer、TypedArray
- 资源管理:文件句柄、数据库连接、网络连接
- UI组件:@State、@Link、@Provide装饰器引用
- 全局变量和单例对象

### Step 2 — 验证边界完整性
- 检查数组访问索引是否越界
- 验证 ArrayBuffer/TypedArray 操作边界
- 确认字符串切片和拼接的长度限制
- 检查循环迭代边界条件

### Step 3 — 检查输入约束
- 外部输入是否有类型和范围验证
- 网络数据反序列化是否安全
- 文件读取大小是否受控
- IPC 消息参数是否验证

### Step 4 — 分析对象生命周期
- UI组件销毁后的引用访问
- 异步回调中的对象使用
- Worker/TaskPool 中的数据传递
- 循环引用导致的内存泄漏
- 访问已释放的原生资源

---

## 风险模式分类

### CAT-A001 未正确分配大对象
大对象分配可能导致内存耗尽或性能问题。

**触发**:
- 分配超大数组或集合未检查可用内存
- 循环中重复创建大对象
- 图片/视频资源加载未限制尺寸
- 用户可控的数组长度参数未验证

**示例**:

```arkts
// 错误示例:用户输入直接控制数组大小
function createBuffer(size: number): Uint8Array {
  return new Uint8Array(size); // size 可能是恶意的超大值
}

// 正确示例:验证输入范围
function createBufferSafe(size: number): Uint8Array {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (size <= 0 || size > MAX_SIZE) {
    throw new Error(`Invalid size: ${size}`);
  }
  return new Uint8Array(size);
}
```

**分析**:
验证所有大对象分配的大小参数,检查是否有上限约束,确认异常情况的处理。

---

### CAT-A002 数组索引越界
访问数组时使用无效索引。

**触发**:
- 负数索引访问(ArkTS 不支持负索引)
- 索引大于等于数组长度
- 循环边界错误:`i <= arr.length` 应为 `i < arr.length`
- 用户输入的索引未验证

**示例**:

```arkts
// 错误示例:未检查索引边界
function getElement(arr: number[], index: number): number {
  return arr[index]; // 可能返回 undefined
}

// 正确示例:边界检查
function getElementSafe(arr: number[], index: number): number | null {
  if (index < 0 || index >= arr.length) {
    return null;
  }
  return arr[index];
}

// 错误示例:循环越界
const data: string[] = ['a', 'b', 'c'];
for (let i = 0; i <= data.length; i++) { // 应该是 i < data.length
  console.log(data[i]); // 最后一次迭代访问 undefined
}
```

**分析**:
验证所有数组访问的索引来源,检查边界条件,确认循环迭代的正确性。

---

### CAT-A003 TypedArray 和 ArrayBuffer 边界溢出
操作二进制数据时超出分配范围。

**触发**:
- ArrayBuffer 分配大小与实际使用不匹配
- TypedArray 视图超出底层 buffer 范围
- 偏移量和长度参数计算错误
- 与原生代码交互时边界不一致

**示例**:

```arkts
// 错误示例:偏移量可能越界
function writeData(buffer: ArrayBuffer, offset: number, data: Uint8Array): void {
  const view = new Uint8Array(buffer);
  for (let i = 0; i < data.length; i++) {
    view[offset + i] = data[i]; // offset + i 可能超出 buffer 大小
  }
}

// 正确示例:边界验证
function writeDataSafe(buffer: ArrayBuffer, offset: number, data: Uint8Array): void {
  const view = new Uint8Array(buffer);
  if (offset < 0 || offset + data.length > view.length) {
    throw new Error(`Buffer overflow: offset=${offset}, data.length=${data.length}, buffer.length=${view.length}`);
  }
  view.set(data, offset);
}

// 错误示例:TypedArray 视图越界
const buffer = new ArrayBuffer(16);
const view = new Uint32Array(buffer, 0, 5); // 错误:需要 20 字节但 buffer 只有 16 字节
```

**分析**:
追踪 ArrayBuffer 大小和所有 TypedArray 视图的偏移量、长度参数,验证边界条件。

---

### CAT-A004 UI组件生命周期后访问
在组件销毁后仍然访问组件状态或方法。

**触发**:
- aboutToDisappear() 后异步回调访问 @State
- 定时器未清理导致访问已销毁组件
- 事件监听器未移除继续触发
- 页面跳转后仍然更新旧页面状态

**示例**:

```arkts
// 错误示例:组件销毁后定时器仍在运行
@Entry
@Component
struct BadComponent {
  @State counter: number = 0;
  private timerId: number = -1;

  aboutToAppear() {
    this.timerId = setInterval(() => {
      this.counter++; // 组件销毁后仍然执行
    }, 1000);
  }

  build() {
    Text(`${this.counter}`)
  }
}

// 正确示例:在销毁时清理定时器
@Entry
@Component
struct GoodComponent {
  @State counter: number = 0;
  private timerId: number = -1;

  aboutToAppear() {
    this.timerId = setInterval(() => {
      this.counter++;
    }, 1000);
  }

  aboutToDisappear() {
    if (this.timerId !== -1) {
      clearInterval(this.timerId);
      this.timerId = -1;
    }
  }

  build() {
    Text(`${this.counter}`)
  }
}
```

**分析**:
检查所有异步操作、定时器、事件监听器,确认在 aboutToDisappear() 中正确清理。

---

### CAT-A005 循环引用导致内存泄漏
对象间相互引用导致 GC 无法回收。

**触发**:
- 父子组件相互持有强引用
- 闭包捕获大对象
- 全局变量持有组件引用
- 事件监听器持有 this 引用
- 缓存未设置清理策略

**示例**:

```arkts
// 错误示例:闭包导致内存泄漏
class DataManager {
  private largeData: Uint8Array = new Uint8Array(10 * 1024 * 1024);
  
  registerCallback() {
    // 闭包持有 this,导致 largeData 无法释放
    globalEventBus.on('update', () => {
      console.log(this.largeData.length);
    });
  }
}

// 正确示例:使用弱引用或及时清理
class DataManagerSafe {
  private largeData: Uint8Array = new Uint8Array(10 * 1024 * 1024);
  private callbackId: string = '';
  
  registerCallback() {
    this.callbackId = globalEventBus.on('update', () => {
      console.log(this.largeData.length);
    });
  }
  
  destroy() {
    if (this.callbackId) {
      globalEventBus.off('update', this.callbackId);
      this.callbackId = '';
    }
    this.largeData = null; // 显式释放
  }
}

// 错误示例:全局缓存无限增长
class GlobalCache {
  private static cache: Map<string, Object> = new Map();
  
  static set(key: string, value: Object) {
    this.cache.set(key, value); // 永不清理
  }
}

// 正确示例:LRU缓存
class LRUCache {
  private cache: Map<string, Object> = new Map();
  private maxSize: number = 100;
  
  set(key: string, value: Object) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

**分析**:
追踪对象引用关系,检查全局变量和闭包,验证清理逻辑的完整性。

---

### CAT-A006 Worker/TaskPool 数据传递错误
跨线程数据传递时的所有权和生命周期问题。

**触发**:
- 传递不可序列化的对象
- 传递后继续访问已转移的 ArrayBuffer
- SharedArrayBuffer 并发访问未同步
- Worker 消息处理中的数据竞争

**示例**:

```arkts
// 错误示例:传递后继续使用 ArrayBuffer
function sendToWorker(worker: Worker, buffer: ArrayBuffer) {
  worker.postMessage(buffer, [buffer]); // 转移所有权
  const view = new Uint8Array(buffer); // 错误:buffer 已分离
  console.log(view[0]); // 运行时错误
}

// 正确示例:传递副本或检查所有权
function sendToWorkerSafe(worker: Worker, buffer: ArrayBuffer) {
  const copy = buffer.slice(0); // 创建副本
  worker.postMessage(copy, [copy]);
  // 原 buffer 仍可使用
  const view = new Uint8Array(buffer);
  console.log(view[0]);
}

// 错误示例:SharedArrayBuffer 无同步
const shared = new SharedArrayBuffer(4);
const view = new Int32Array(shared);

// 线程 1
view[0]++; // 数据竞争

// 线程 2
view[0]++; // 数据竞争

// 正确示例:使用 Atomics
const sharedSafe = new SharedArrayBuffer(4);
const viewSafe = new Int32Array(sharedSafe);

// 线程 1
Atomics.add(viewSafe, 0, 1);

// 线程 2
Atomics.add(viewSafe, 0, 1);
```

**分析**:
检查所有 Worker 消息传递,验证 ArrayBuffer 转移后的使用,确认 SharedArrayBuffer 的同步机制。

---

### CAT-A007 原生代码交互内存问题
ArkTS 与 C++/Native 交互时的内存管理问题。

**触发**:
- 传递给原生代码的指针在回调前已释放
- 原生代码返回的内存未正确释放
- 字节序不匹配导致数据解析错误
- 缓冲区大小不一致

**示例**:

```arkts
// 错误示例:传递局部变量到原生异步调用
function callNative() {
  const buffer = new ArrayBuffer(1024);
  // 假设 nativeAsyncCall 会在稍后使用 buffer
  nativeAsyncCall(buffer, (result) => {
    // buffer 可能已被 GC 回收
    console.log(result);
  });
}

// 正确示例:确保生命周期
class NativeCallManager {
  private activeBuffers: Set<ArrayBuffer> = new Set();
  
  callNative(buffer: ArrayBuffer) {
    this.activeBuffers.add(buffer); // 保持引用
    nativeAsyncCall(buffer, (result) => {
      this.activeBuffers.delete(buffer); // 释放引用
      console.log(result);
    });
  }
}

// 原生接口定义示例
interface NativeAPI {
  // 错误:未说明谁负责释放内存
  allocateMemory(size: number): ArrayBuffer;
  
  // 正确:明确内存所有权
  allocateMemory(size: number): ArrayBuffer; // 调用者负责管理返回的 buffer
  freeMemory(buffer: ArrayBuffer): void; // 显式释放方法
}
```

**分析**:
追踪所有原生 API 调用,验证内存所有权,检查异步场景下的生命周期。

---

### CAT-A008 资源泄漏
未正确释放系统资源。

**触发**:
- 文件句柄未关闭
- 数据库连接未断开
- 网络请求未取消
- 图片资源未释放
- Camera/Audio 等硬件资源未释放

**示例**:

```arkts
// 错误示例:文件未关闭
async function readFileBad(path: string): Promise<string> {
  const file = await fs.open(path);
  const content = await file.read();
  return content; // file 未关闭
}

// 正确示例:使用 try-finally
async function readFileGood(path: string): Promise<string> {
  const file = await fs.open(path);
  try {
    const content = await file.read();
    return content;
  } finally {
    await file.close();
  }
}

// 错误示例:图片资源泄漏
@Component
struct ImageList {
  @State images: PixelMap[] = [];
  
  loadImages(urls: string[]) {
    urls.forEach(url => {
      image.createPixelMap(url).then(pixelMap => {
        this.images.push(pixelMap);
      });
    });
  }
  // 组件销毁时未释放 PixelMap
}

// 正确示例:清理资源
@Component
struct ImageListSafe {
  @State images: PixelMap[] = [];
  
  loadImages(urls: string[]) {
    urls.forEach(url => {
      image.createPixelMap(url).then(pixelMap => {
        this.images.push(pixelMap);
      });
    });
  }
  
  aboutToDisappear() {
    this.images.forEach(pixelMap => {
      pixelMap.release(); // 释放原生资源
    });
    this.images = [];
  }
}
```

**分析**:
检查所有资源获取操作,验证对应的释放逻辑,确认异常路径的清理。

---

### CAT-A009 空指针/未定义访问
访问 null、undefined 或不存在的属性。

**触发**:
- 未检查函数返回值是否为 null/undefined
- 可选链操作符使用不当
- 对象属性不存在就访问
- 数组元素可能为 undefined
- JSON 解析结果未验证

**示例**:

```arkts
// 错误示例:未检查 null
function processUser(user: User | null) {
  console.log(user.name); // user 可能为 null
}

// 正确示例:空值检查
function processUserSafe(user: User | null) {
  if (user === null) {
    return;
  }
  console.log(user.name);
}

// 或使用可选链
function processUserOptional(user: User | null) {
  console.log(user?.name ?? 'Unknown');
}

// 错误示例:JSON 解析未验证
function parseConfig(json: string): Config {
  const obj = JSON.parse(json);
  return {
    host: obj.host, // obj.host 可能不存在
    port: obj.port
  };
}

// 正确示例:验证结构
function parseConfigSafe(json: string): Config | null {
  try {
    const obj = JSON.parse(json);
    if (typeof obj.host !== 'string' || typeof obj.port !== 'number') {
      return null;
    }
    return { host: obj.host, port: obj.port };
  } catch (e) {
    return null;
  }
}
```

**分析**:
追踪所有可能为 null/undefined 的值,检查访问前的验证逻辑。

---

### CAT-A010 不受信任的输入未验证
来自外部的数据直接使用导致安全问题。

**触发**:
- 网络数据未验证类型和范围
- 用户输入直接用于数组索引或大小分配
- 文件内容未检查格式
- URL 参数未净化
- IPC 消息参数未验证

**示例**:

```arkts
// 错误示例:网络数据直接使用
async function loadUserData(userId: string) {
  const response = await http.get(`/api/user/${userId}`);
  const data = JSON.parse(response.body);
  const buffer = new ArrayBuffer(data.bufferSize); // data.bufferSize 未验证
  return buffer;
}

// 正确示例:验证和限制
async function loadUserDataSafe(userId: string) {
  const response = await http.get(`/api/user/${userId}`);
  const data = JSON.parse(response.body);
  
  // 验证类型
  if (typeof data.bufferSize !== 'number') {
    throw new Error('Invalid bufferSize type');
  }
  
  // 验证范围
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (data.bufferSize <= 0 || data.bufferSize > MAX_SIZE) {
    throw new Error(`Invalid bufferSize: ${data.bufferSize}`);
  }
  
  const buffer = new ArrayBuffer(data.bufferSize);
  return buffer;
}

// 错误示例:URL参数直接使用
function navigateToPage(params: Record<string, string>) {
  const index = parseInt(params.index);
  const items = getItems();
  return items[index]; // index 可能越界或为 NaN
}

// 正确示例:参数验证
function navigateToPageSafe(params: Record<string, string>) {
  const index = parseInt(params.index);
  if (isNaN(index)) {
    return null;
  }
  
  const items = getItems();
  if (index < 0 || index >= items.length) {
    return null;
  }
  
  return items[index];
}
```

**分析**:
识别所有外部输入源,验证使用前的检查逻辑,确认边界和类型约束。

---

### CAT-A011 异步竞态条件
并发访问导致的数据不一致。

**触发**:
- 多个异步操作修改同一状态
- 检查-使用时间窗口(TOCTOU)
- Promise 竞态导致状态混乱
- 异步更新 UI 状态冲突

**示例**:

```arkts
// 错误示例:竞态条件
@Component
struct Counter {
  @State count: number = 0;
  
  async increment() {
    const current = this.count;
    await someAsyncOperation();
    this.count = current + 1; // 如果多次调用,可能丢失更新
  }
}

// 正确示例:原子操作
@Component
struct CounterSafe {
  @State count: number = 0;
  private updating: boolean = false;
  
  async increment() {
    if (this.updating) {
      return; // 防止并发
    }
    
    this.updating = true;
    try {
      await someAsyncOperation();
      this.count++; // 直接递增
    } finally {
      this.updating = false;
    }
  }
}

// 错误示例:TOCTOU
class CacheManager {
  private cache: Map<string, Data> = new Map();
  
  async get(key: string): Promise<Data> {
    if (!this.cache.has(key)) { // 检查
      const data = await fetchData(key);
      this.cache.set(key, data); // 使用,可能被多次调用
    }
    return this.cache.get(key)!;
  }
}

// 正确示例:避免 TOCTOU
class CacheManagerSafe {
  private cache: Map<string, Data> = new Map();
  private loading: Set<string> = new Set();
  
  async get(key: string): Promise<Data> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    if (this.loading.has(key)) {
      // 等待正在加载的请求
      while (this.loading.has(key)) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return this.cache.get(key)!;
    }
    
    this.loading.add(key);
    try {
      const data = await fetchData(key);
      this.cache.set(key, data);
      return data;
    } finally {
      this.loading.delete(key);
    }
  }
}
```

**分析**:
识别所有并发访问点,检查同步机制,验证状态更新的原子性。

---

### CAT-A012 字符串操作越界
字符串处理时的边界错误。

**触发**:
- substring/slice 参数超出字符串长度
- 正则表达式匹配结果未检查
- 字符串拼接导致内存过大
- Unicode 处理不当

**示例**:

```arkts
// 错误示例:未检查索引
function getSubstring(str: string, start: number, length: number): string {
  return str.substring(start, start + length); // 可能越界
}

// 正确示例:边界检查
function getSubstringSafe(str: string, start: number, length: number): string | null {
  if (start < 0 || start >= str.length) {
    return null;
  }
  const end = Math.min(start + length, str.length);
  return str.substring(start, end);
}

// 错误示例:正则匹配未检查
function extractEmail(text: string): string {
  const match = text.match(/[\w.-]+@[\w.-]+/);
  return match[0]; // match 可能为 null
}

// 正确示例:检查匹配结果
function extractEmailSafe(text: string): string | null {
  const match = text.match(/[\w.-]+@[\w.-]+/);
  return match ? match[0] : null;
}
```

**分析**:
检查所有字符串操作的边界参数,验证正则表达式结果处理。

---

## 代码分析视角

### 1. 数据流分析
追踪数据从输入到使用的完整路径,验证每个转换点的类型和边界约束。

### 2. 生命周期分析
检查对象、组件、资源的创建和销毁配对,验证异步场景下的有效性。

### 3. 并发分析
识别多线程访问点,验证同步机制,检查竞态条件。

### 4. 类型分析
追踪值的类型变化,检查 null/undefined 处理,验证类型断言的安全性。

---

## 典型触发条件

| 风险模式 | 高频触发条件 |
|---------|-------------|
| 数组越界 | 用户输入索引、循环边界错误 |
| 内存泄漏 | 定时器未清理、事件监听器未移除、全局变量引用 |
| 生命周期错误 | 组件销毁后访问、异步回调中使用已失效对象 |
| 资源泄漏 | 文件/连接未关闭、图片资源未释放 |
| 空指针 | 未检查 null/undefined、可选属性直接访问 |
| 并发冲突 | SharedArrayBuffer 无同步、状态并发更新 |
| 原生交互 | 缓冲区大小不匹配、生命周期管理错误 |
| 输入验证 | 网络数据直接使用、用户输入未检查 |
| TypedArray 越界 | 偏移量错误、长度计算错误 |
| 竞态条件 | TOCTOU、Promise 并发、状态检查后修改 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+风险类型]

## 内存/资源操作详情
- 操作类型: [分配/访问/释放/传递]
- 操作位置: [文件:行号] [函数/组件名]
- 资源类型: [数组/ArrayBuffer/UI组件/文件/网络]
- 风险点: [具体的操作或函数调用]

## 证据链与逻辑推理
1. 代码证据:具体代码行和上下文
2. 数据流追踪:输入来源到危险操作
3. 边界验证:大小/长度/索引检查
4. 生命周期分析:对象有效性窗口
5. 漏洞描述:具体的内存/资源安全问题

## 真实触发条件
输入条件、触发路径、外部可控性、时序要求

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 攻击者控制难度 |
| 影响范围 | 高/中/低 | 应用崩溃/数据泄露/拒绝服务 |
| 稳定性 | 高/中/低 | 触发概率和环境依赖 |

## 修复建议
方案一:边界检查/输入验证 + 代码示例
方案二:生命周期管理 + 代码示例
方案三:资源清理 + 代码示例
推荐:XXX

## 边界与不确定性
确定事实、不确定假设、建议调查点、需要的上下文信息
```

---

## 非"执行逻辑"

本文档仅作知识参考和结构化指南,不执行代码、自动扫描、生成修复脚本或最终裁决。模型应结合 ArkTS 运行时特性和具体业务场景推理,非机械匹配。

---

## 典型误报场景

不应报告:
- 使用 TypeScript 类型系统正确标注的可选属性访问(带可选链)
- 经过边界检查的数组访问
- 使用 try-finally 正确清理的资源
- 框架自动管理的组件生命周期(如简单 @State)
- 经过验证的内部函数调用
- 正确使用 Atomics 的 SharedArrayBuffer 操作
- 正常的 GC 管理对象(非大对象、非原生资源)

---

## 安全实践建议

### 1. 边界检查
```arkts
// 总是验证数组索引
if (index >= 0 && index < arr.length) {
  return arr[index];
}

// 验证输入范围
if (size <= 0 || size > MAX_SIZE) {
  throw new Error('Invalid size');
}
```

### 2. 空值检查
```arkts
// 使用可选链和空值合并
const name = user?.profile?.name ?? 'Unknown';

// 或显式检查
if (user && user.profile) {
  console.log(user.profile.name);
}
```

### 3. 资源清理
```arkts
// UI组件生命周期
aboutToDisappear() {
  // 清理定时器
  if (this.timerId !== -1) {
    clearInterval(this.timerId);
  }
  
  // 移除监听器
  this.eventBus.off('update', this.callback);
  
  // 释放原生资源
  this.pixelMap?.release();
}

// 文件操作
try {
  // 使用资源
} finally {
  await file.close();
}
```

### 4. 并发安全
```arkts
// SharedArrayBuffer 使用 Atomics
Atomics.add(sharedArray, index, 1);
const value = Atomics.load(sharedArray, index);

// 避免竞态条件
if (!this.loading) {
  this.loading = true;
  try {
    await operation();
  } finally {
    this.loading = false;
  }
}
```

### 5. 输入验证
```arkts
function validateInput(data: unknown): Data | null {
  // 类型检查
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  
  // 结构验证
  const obj = data as Record<string, unknown>;
  if (typeof obj.name !== 'string' || typeof obj.age !== 'number') {
    return null;
  }
  
  // 范围检查
  if (obj.age < 0 || obj.age > 150) {
    return null;
  }
  
  return obj as Data;
}
```

---

## ArkTS 特定注意事项

### 1. @State 和 @Link 引用
- @State 变量在组件销毁后不应被访问
- @Link 引用的父组件数据可能已失效
- 避免在异步回调中访问可能已销毁的组件状态

### 2. Worker 和 TaskPool
- 理解 ArrayBuffer 转移语义
- SharedArrayBuffer 必须使用 Atomics
- 序列化限制:不能传递函数、循环引用对象

### 3. 原生交互
- 明确内存所有权
- 注意字节序和对齐
- 验证缓冲区大小匹配

### 4. UI渲染
- 避免在渲染函数中分配大对象
- 图片资源及时释放
- 长列表使用虚拟滚动

---

**文档版本**: v1.0 | **适用语言**: ArkTS (基于 TypeScript)
**目标平台**: HarmonyOS/OpenHarmony
**更新日期**: 2026-01