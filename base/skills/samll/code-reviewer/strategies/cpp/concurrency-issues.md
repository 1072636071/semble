# C++ 并发问题分析指导文档

## 能力目标

基于C++内存模型和并发特性,判断真实线程安全风险,识别可触发的竞态条件,区分并发安全和误报场景。

---

## 前置判断

获取:
- **并发模型**: `std::thread`、`std::async`、`std::jthread`(C++20)、协程(C++20)、OpenMP、线程池
- **内存模型**: memory_order语义、happens-before关系、sequential consistency
- **共享资源**: 全局变量、静态成员、堆对象、单例模式
- **同步机制**: 
  - 互斥锁: `std::mutex`、`std::recursive_mutex`、`std::shared_mutex`(C++17)
  - 原子操作: `std::atomic<T>`及其内存序
  - 条件变量: `std::condition_variable`
  - 信号量: `std::counting_semaphore`(C++20)、`std::binary_semaphore`(C++20)
  - 栅栏: `std::barrier`(C++20)、`std::latch`(C++20)
- **锁管理**: `std::lock_guard`、`std::unique_lock`、`std::scoped_lock`(C++17)、`std::shared_lock`(C++17)
- **线程安全容器**: 无(C++标准库容器均非线程安全,需自行同步)
- **异步操作**: `std::future`、`std::promise`、`std::async`、协程(coroutines)

---

## 分析流程

### Step 1 — 识别并发模式

定位并发执行点:
```cpp
// 线程创建
std::thread t1(func);
std::jthread t2(func); // C++20,自动join

// 异步任务
auto future = std::async(std::launch::async, func);

// 协程 (C++20)
task<int> my_coroutine() {
    co_await some_operation();
    co_return 42;
}

// OpenMP并行
#pragma omp parallel for
for (int i = 0; i < n; ++i) { /* ... */ }

// 线程池
ThreadPool pool(4);
pool.enqueue(task);
```

### Step 2 — 追踪共享资源访问

- **识别共享状态**: 
  - 全局变量、静态成员变量
  - 堆分配对象的多线程访问
  - 单例模式实例
  - 通过指针/引用传递的对象

```cpp
// 共享资源示例
int global_counter = 0;              // 全局变量
static std::vector<int> data;        // 静态变量

class Service {
    std::map<int, Data> cache_;      // 成员变量
public:
    void update(int key, Data d) {
        cache_[key] = d;             // 潜在竞争
    }
};
```

- **访问模式分析**:
  - 读-读: 通常安全
  - 读-写: 数据竞争(data race)
  - 写-写: 数据竞争
  - 复合操作: `counter++`、check-then-act

### Step 3 — 验证同步机制

```cpp
// 锁覆盖检查
class BankAccount {
    mutable std::mutex mtx_;
    double balance_;
public:
    void deposit(double amount) {
        std::lock_guard<std::mutex> lock(mtx_); // 保护写操作
        balance_ += amount;
    }
    
    double getBalance() const {
        std::lock_guard<std::mutex> lock(mtx_); // 保护读操作
        return balance_;
    }
};

// 原子操作
std::atomic<int> counter{0};
counter.fetch_add(1, std::memory_order_relaxed);

// 读写锁 (C++17)
std::shared_mutex rw_mutex_;
// 读锁
std::shared_lock<std::shared_mutex> read_lock(rw_mutex_);
// 写锁
std::unique_lock<std::shared_mutex> write_lock(rw_mutex_);
```

### Step 4 — 检测竞态条件

- **TOCTOU (Time-of-Check-Time-of-Use)**
- **数据竞争**: 未同步的并发访问(至少一个是写)
- **死锁**: 循环等待锁
- **ABA问题**: CAS操作中的值复用
- **内存序问题**: 错误的`memory_order`导致可见性问题

---

## 风险模式分类

### CAT-0051 竞争条件 (Race Condition)

应用程序的执行行为依赖于线程的相对执行时机,当执行顺序无法保证时导致不一致状态。

**触发条件**:
- Check-then-act模式未原子化
- 复合操作未保护: `counter++`、`vector.push_back()`
- 双重检查锁(DCL)实现不正确
- 懒汉式单例未正确同步
- 共享容器的并发修改

**典型漏洞模式**:

```cpp
// 危险: Check-then-act竞态
class Singleton {
    static Singleton* instance_;
public:
    static Singleton* getInstance() {
        if (instance_ == nullptr) {          // 检查
            instance_ = new Singleton();      // 操作 - 竞态窗口!
        }
        return instance_;
    }
};

// 危险: 非原子递增
int counter = 0;
void increment() {
    counter++;  // 实际为: tmp = counter; tmp++; counter = tmp;
}

// 危险: 双重检查锁错误实现
static Singleton* instance_ = nullptr;
static std::mutex mtx_;

Singleton* getInstance() {
    if (instance_ == nullptr) {              // 第一次检查(无锁)
        std::lock_guard<std::mutex> lock(mtx_);
        if (instance_ == nullptr) {          // 第二次检查(有锁)
            instance_ = new Singleton();     // 问题: 指令重排!
        }
    }
    return instance_;
}
// 问题: new操作分为三步: 1)分配内存 2)构造对象 3)赋值指针
// 指令重排可能导致顺序变为 1->3->2, 其他线程看到非空但未构造完成的对象

// 安全: 使用原子操作
std::atomic<int> counter{0};
void increment() {
    counter.fetch_add(1, std::memory_order_relaxed);
}

// 安全: Meyers单例 (C++11线程安全)
Singleton& getInstance() {
    static Singleton instance;  // C++11保证线程安全初始化
    return instance;
}

// 安全: 正确的双重检查锁 (使用atomic)
static std::atomic<Singleton*> instance_{nullptr};
static std::mutex mtx_;

Singleton* getInstance() {
    Singleton* tmp = instance_.load(std::memory_order_acquire);
    if (tmp == nullptr) {
        std::lock_guard<std::mutex> lock(mtx_);
        tmp = instance_.load(std::memory_order_relaxed);
        if (tmp == nullptr) {
            tmp = new Singleton();
            instance_.store(tmp, std::memory_order_release);
        }
    }
    return tmp;
}
```

**案例: 银行转账竞态**

```cpp
// 危险实现
class Account {
    double balance_;
public:
    bool withdraw(double amount) {
        if (balance_ >= amount) {      // 检查
            balance_ -= amount;         // 操作 - 竞态!
            return true;
        }
        return false;
    }
};

// 场景: 账户余额100元,两个线程同时取100元
// 线程1: 检查通过(100 >= 100)
// 线程2: 检查通过(100 >= 100)
// 线程1: 余额 = 100 - 100 = 0
// 线程2: 余额 = 0 - 100 = -100  (错误!)

// 安全实现
class Account {
    mutable std::mutex mtx_;
    double balance_;
public:
    bool withdraw(double amount) {
        std::lock_guard<std::mutex> lock(mtx_);
        if (balance_ >= amount) {
            balance_ -= amount;
            return true;
        }
        return false;
    }
};
```

**防护措施**:
- 使用互斥锁保护整个检查-操作序列
- 使用`std::atomic<T>`保护简单类型
- 使用`std::call_once`保证只执行一次
- 对单例使用Meyers单例或`std::call_once`
- 避免手动实现双重检查锁,优先用标准方案

---

### CAT-0052 锁定不当 (Improper Locking)

锁的使用方式导致死锁、活锁或性能问题。

**触发条件**:
- 获取多个锁的顺序不一致
- 递归锁误用或过度使用
- 锁粒度过大导致性能瓶颈
- 锁粒度过小无法保护完整操作
- 在持有锁时调用未知代码(回调、虚函数)

**典型漏洞模式**:

```cpp
// 危险: 锁顺序不一致导致死锁
std::mutex mtx_a, mtx_b;

// 线程1
void thread1_func() {
    std::lock_guard<std::mutex> lock_a(mtx_a);
    // ... 一些操作 ...
    std::lock_guard<std::mutex> lock_b(mtx_b);  // AB顺序
    // 临界区
}

// 线程2
void thread2_func() {
    std::lock_guard<std::mutex> lock_b(mtx_b);
    // ... 一些操作 ...
    std::lock_guard<std::mutex> lock_a(mtx_a);  // BA顺序 - 死锁!
    // 临界区
}

// 危险: 持锁调用回调
class EventManager {
    std::mutex mtx_;
    std::function<void()> callback_;
public:
    void trigger() {
        std::lock_guard<std::mutex> lock(mtx_);
        if (callback_) {
            callback_();  // 回调可能尝试获取其他锁,造成死锁
        }
    }
};

// 危险: 锁粒度过大
class DataProcessor {
    std::mutex mtx_;
    std::vector<int> data_;
public:
    void processAll() {
        std::lock_guard<std::mutex> lock(mtx_);
        // 长时间持有锁
        for (auto& item : data_) {
            expensiveComputation(item);     // CPU密集
        }
        slowNetworkCall();                  // IO操作
        writeToDatabase();                  // 阻塞操作
    }
};

// 安全: 使用std::scoped_lock避免死锁 (C++17)
void safe_transfer() {
    std::scoped_lock lock(mtx_a, mtx_b);  // 原子获取多个锁,避免死锁
    // 临界区
}

// 安全: 手动顺序锁定 (C++11)
void safe_manual() {
    std::unique_lock<std::mutex> lock_a(mtx_a, std::defer_lock);
    std::unique_lock<std::mutex> lock_b(mtx_b, std::defer_lock);
    std::lock(lock_a, lock_b);  // 同时获取,避免死锁
    // 临界区
}

// 安全: 缩小锁范围
class DataProcessor {
    std::mutex mtx_;
    std::vector<int> data_;
public:
    void processAll() {
        std::vector<int> local_copy;
        {
            std::lock_guard<std::mutex> lock(mtx_);
            local_copy = data_;  // 快速复制
        }
        // 释放锁后进行耗时操作
        for (auto& item : local_copy) {
            expensiveComputation(item);
        }
    }
};
```

**案例: 转账死锁**

```cpp
// 危险实现
class BankAccount {
    mutable std::mutex mtx_;
    double balance_;
public:
    void transfer(BankAccount& target, double amount) {
        std::lock_guard<std::mutex> lock1(mtx_);           // 锁定源账户
        std::lock_guard<std::mutex> lock2(target.mtx_);    // 锁定目标账户
        
        if (balance_ >= amount) {
            balance_ -= amount;
            target.balance_ += amount;
        }
    }
};

// 死锁场景:
// 线程1: account_a.transfer(account_b, 100)  锁顺序: a -> b
// 线程2: account_b.transfer(account_a, 50)   锁顺序: b -> a
// 结果: 循环等待,死锁!

// 安全实现: 使用统一锁顺序
class BankAccount {
    mutable std::mutex mtx_;
    double balance_;
    const int account_id_;  // 用于确定锁顺序
public:
    void transfer(BankAccount& target, double amount) {
        // 按账户ID顺序获取锁
        BankAccount& first = (account_id_ < target.account_id_) ? *this : target;
        BankAccount& second = (account_id_ < target.account_id_) ? target : *this;
        
        std::scoped_lock lock(first.mtx_, second.mtx_);
        
        if (balance_ >= amount) {
            balance_ -= amount;
            target.balance_ += amount;
        }
    }
};
```

**防护措施**:
- 建立全局锁顺序并严格遵守
- 使用`std::scoped_lock`同时获取多个锁(C++17)
- 使用`std::lock`函数同时锁定多个互斥量
- 使用`try_lock`设置超时避免死锁
- 缩小锁范围,只保护必要的临界区
- 避免在持锁时调用外部代码或虚函数
- 使用读写锁(`std::shared_mutex`)优化读多写少场景

---

### CWD-1130 缺少同步 (Missing Synchronization)

对共享资源的访问缺少必要同步机制,导致数据竞争或不一致状态。

**触发条件**:
- 共享变量读写未加锁
- 懒惰初始化未同步
- 误以为某些操作是原子的(如指针赋值在某些平台)
- 错误使用`volatile`(不保证原子性和同步)
- STL容器并发访问未保护

**典型漏洞模式**:

```cpp
// 危险: 共享变量未同步
class Counter {
    int count_ = 0;  // 非原子变量
public:
    void increment() { count_++; }      // 数据竞争!
    int get() const { return count_; }  // 数据竞争!
};

// 危险: 容器并发修改
std::vector<int> shared_vec;

void thread1() {
    shared_vec.push_back(1);  // 未同步
}
void thread2() {
    shared_vec.push_back(2);  // 数据竞争,可能崩溃
}

// 危险: volatile不保证线程安全
volatile int counter = 0;
void increment() {
    counter++;  // 仍然是数据竞争! volatile不保证原子性
}

// 危险: 懒惰初始化未同步 (C++11之前)
class Resource {
    static Resource* instance_;
public:
    static Resource* get() {
        if (!instance_) {              // 竞态条件
            instance_ = new Resource();
        }
        return instance_;
    }
};

// 安全: 使用原子变量
class Counter {
    std::atomic<int> count_{0};
public:
    void increment() { count_.fetch_add(1); }
    int get() const { return count_.load(); }
};

// 安全: 使用互斥锁保护容器
std::vector<int> shared_vec;
std::mutex vec_mutex;

void thread_func(int value) {
    std::lock_guard<std::mutex> lock(vec_mutex);
    shared_vec.push_back(value);
}

// 安全: 使用线程安全的初始化
class Resource {
public:
    static Resource& get() {
        static Resource instance;  // C++11保证线程安全
        return instance;
    }
};

// 或使用std::call_once
std::once_flag init_flag;
Resource* instance_ = nullptr;

Resource* get() {
    std::call_once(init_flag, []() {
        instance_ = new Resource();
    });
    return instance_;
}
```

**案例: 配置管理器**

```cpp
// 危险实现
class ConfigManager {
    std::map<std::string, std::string> config_;
    bool loaded_ = false;
public:
    void load() {
        if (!loaded_) {                    // 竞态条件
            // 从文件加载配置
            config_ = loadFromFile();
            loaded_ = true;                // 数据竞争
        }
    }
    
    std::string get(const std::string& key) {
        return config_[key];               // 数据竞争
    }
};

// 问题: 多个线程调用load()可能重复加载
// 问题: get()和load()并发执行导致map损坏

// 安全实现
class ConfigManager {
    std::map<std::string, std::string> config_;
    mutable std::shared_mutex rw_mutex_;   // 读写锁
    std::once_flag load_flag_;
    
    void doLoad() {
        config_ = loadFromFile();
    }
    
public:
    void load() {
        std::call_once(load_flag_, &ConfigManager::doLoad, this);
    }
    
    std::string get(const std::string& key) const {
        std::shared_lock<std::shared_mutex> lock(rw_mutex_);  // 读锁
        auto it = config_.find(key);
        return it != config_.end() ? it->second : "";
    }
    
    void set(const std::string& key, const std::string& value) {
        std::unique_lock<std::shared_mutex> lock(rw_mutex_);  // 写锁
        config_[key] = value;
    }
};
```

**防护措施**:
- 对所有共享变量访问添加适当同步
- 使用`std::atomic<T>`保护简单类型
- 使用互斥锁保护复杂数据结构
- 不要依赖`volatile`实现线程同步
- 使用`std::call_once`保证初始化只执行一次
- 使用不可变对象避免同步问题
- 优先使用Meyers单例模式

---

### CWD-1132 在多线程上下文中对共享数据的非同步访问

在多线程环境中访问共享数据时未正确同步,导致数据竞争或不一致。

**触发条件**:
- STL容器并发访问(所有STL容器都不是线程安全的)
- 迭代器失效: 一个线程迭代,另一个线程修改
- 智能指针的并发操作
- 对象生命周期管理问题

**典型漏洞模式**:

```cpp
// 危险: 容器并发读写
std::vector<int> data;

void reader() {
    for (int val : data) {      // 迭代器可能失效
        process(val);
    }
}

void writer() {
    data.push_back(42);         // 可能导致重新分配,迭代器失效
}

// 危险: shared_ptr的线程安全误解
std::shared_ptr<Data> global_ptr = std::make_shared<Data>();

void thread1() {
    global_ptr = std::make_shared<Data>();  // 数据竞争!
    // shared_ptr的控制块是线程安全的,但指针本身的赋值不是
}

void thread2() {
    auto local = global_ptr;                // 数据竞争!
}

// 危险: map并发访问
std::map<int, std::string> cache;

void update(int key, const std::string& value) {
    cache[key] = value;         // operator[]非线程安全
}

std::string query(int key) {
    return cache[key];          // 数据竞争
}

// 安全: 保护容器访问
std::vector<int> data;
std::mutex data_mutex;

void reader() {
    std::lock_guard<std::mutex> lock(data_mutex);
    for (int val : data) {
        process(val);
    }
}

void writer() {
    std::lock_guard<std::mutex> lock(data_mutex);
    data.push_back(42);
}

// 安全: 保护shared_ptr赋值
std::shared_ptr<Data> global_ptr = std::make_shared<Data>();
std::mutex ptr_mutex;

void thread1() {
    auto new_ptr = std::make_shared<Data>();
    std::lock_guard<std::mutex> lock(ptr_mutex);
    global_ptr = new_ptr;
}

void thread2() {
    std::lock_guard<std::mutex> lock(ptr_mutex);
    auto local = global_ptr;
}

// 或使用atomic<shared_ptr> (C++20)
std::atomic<std::shared_ptr<Data>> global_ptr = std::make_shared<Data>();

void thread1() {
    global_ptr.store(std::make_shared<Data>());
}

void thread2() {
    auto local = global_ptr.load();
}
```

**案例: 生产者-消费者队列**

```cpp
// 危险实现
std::queue<Task> task_queue;

void producer() {
    Task task = createTask();
    task_queue.push(task);      // 数据竞争
}

void consumer() {
    if (!task_queue.empty()) {  // 检查
        Task task = task_queue.front();  // 操作 - TOCTOU竞态!
        task_queue.pop();
        process(task);
    }
}

// 安全实现: 使用互斥锁和条件变量
std::queue<Task> task_queue;
std::mutex queue_mutex;
std::condition_variable cv;

void producer() {
    Task task = createTask();
    {
        std::lock_guard<std::mutex> lock(queue_mutex);
        task_queue.push(task);
    }
    cv.notify_one();
}

void consumer() {
    std::unique_lock<std::mutex> lock(queue_mutex);
    cv.wait(lock, []{ return !task_queue.empty(); });
    
    Task task = task_queue.front();
    task_queue.pop();
    lock.unlock();  // 尽早释放锁
    
    process(task);
}

// 更安全: 封装为线程安全队列
template<typename T>
class ThreadSafeQueue {
    std::queue<T> queue_;
    mutable std::mutex mtx_;
    std::condition_variable cv_;
public:
    void push(T value) {
        {
            std::lock_guard<std::mutex> lock(mtx_);
            queue_.push(std::move(value));
        }
        cv_.notify_one();
    }
    
    bool try_pop(T& value) {
        std::lock_guard<std::mutex> lock(mtx_);
        if (queue_.empty()) return false;
        value = std::move(queue_.front());
        queue_.pop();
        return true;
    }
    
    void wait_and_pop(T& value) {
        std::unique_lock<std::mutex> lock(mtx_);
        cv_.wait(lock, [this]{ return !queue_.empty(); });
        value = std::move(queue_.front());
        queue_.pop();
    }
};
```

**防护措施**:
- 所有STL容器并发访问都需要外部同步
- 使用互斥锁保护容器的完整操作序列
- 使用条件变量实现等待机制
- 封装线程安全的容器类
- 注意`shared_ptr`的指针本身不是线程安全的
- 使用`std::atomic<std::shared_ptr<T>>`(C++20)

---

### CWD-1134 同步不正确 (Incorrect Synchronization)

同步机制使用不当,仍然无法保证线程安全。

**触发条件**:
- 锁的作用域不正确
- 错误的内存序(memory_order)
- 原子变量的非原子操作
- 忘记锁定所有访问路径
- RAII锁管理器使用不当

**典型漏洞模式**:

```cpp
// 危险: 锁作用域过小
class BankAccount {
    std::mutex mtx_;
    double balance_;
public:
    void transfer(BankAccount& target, double amount) {
        {
            std::lock_guard<std::mutex> lock(mtx_);
            balance_ -= amount;
        }  // 锁过早释放
        
        // 中间状态,钱已扣除但未存入
        
        {
            std::lock_guard<std::mutex> lock(target.mtx_);
            target.balance_ += amount;
        }
        // 不是原子操作,可能出现不一致
    }
};

// 危险: 错误的内存序
std::atomic<bool> ready{false};
int data = 0;

void producer() {
    data = 42;
    ready.store(true, std::memory_order_relaxed);  // 错误!可能重排序
}

void consumer() {
    while (!ready.load(std::memory_order_relaxed));
    assert(data == 42);  // 可能失败!
}

// 危险: 原子变量的非原子操作
std::atomic<int> counter{0};

void increment() {
    int old = counter.load();
    counter.store(old + 1);     // 非原子! 应使用fetch_add
}

// 危险: 临时锁对象
void bad_lock() {
    std::lock_guard<std::mutex>(mtx_);  // 临时对象,立即析构!
    // 这里没有锁保护
    shared_data++;
}

// 安全: 正确的锁范围
class BankAccount {
    std::mutex mtx_;
    double balance_;
public:
    void transfer(BankAccount& target, double amount) {
        std::scoped_lock lock(mtx_, target.mtx_);  // 同时锁定
        if (balance_ >= amount) {
            balance_ -= amount;
            target.balance_ += amount;
        }
    }
};

// 安全: 正确的内存序
std::atomic<bool> ready{false};
int data = 0;

void producer() {
    data = 42;
    ready.store(true, std::memory_order_release);  // 建立happens-before
}

void consumer() {
    while (!ready.load(std::memory_order_acquire));
    assert(data == 42);  // 保证正确
}

// 安全: 原子操作
std::atomic<int> counter{0};

void increment() {
    counter.fetch_add(1, std::memory_order_relaxed);
}

// 安全: 正确使用RAII
void good_lock() {
    std::lock_guard<std::mutex> lock(mtx_);  // 命名对象
    shared_data++;
}
```

**案例: 双缓冲区**

```cpp
// 危险实现
class DoubleBuffer {
    std::vector<int> buffers_[2];
    std::atomic<int> current_{0};
    
public:
    void write(const std::vector<int>& data) {
        int next = 1 - current_.load(std::memory_order_relaxed);
        buffers_[next] = data;              // 写入备用缓冲区
        current_.store(next, std::memory_order_relaxed);  // 切换 - 问题!
    }
    
    std::vector<int> read() {
        int idx = current_.load(std::memory_order_relaxed);
        return buffers_[idx];               // 可能读到不完整的数据
    }
};

// 问题: memory_order_relaxed不保证写入完成后才切换

// 安全实现
class DoubleBuffer {
    std::vector<int> buffers_[2];
    std::atomic<int> current_{0};
    
public:
    void write(const std::vector<int>& data) {
        int next = 1 - current_.load(std::memory_order_relaxed);
        buffers_[next] = data;
        // release保证数据写入happens-before索引更新
        current_.store(next, std::memory_order_release);
    }
    
    std::vector<int> read() {
        // acquire保证读取索引happens-before读取数据
        int idx = current_.load(std::memory_order_acquire);
        return buffers_[idx];
    }
};
```

**防护措施**:
- 确保锁覆盖完整的临界区
- 正确使用内存序: acquire-release语义
- 对原子变量使用原子操作,不要load后再store
- 使用命名的RAII锁管理器,避免临时对象
- 理解`std::memory_order`的含义和使用场景
- 使用`std::scoped_lock`同时获取多个锁

---

### CWD-1135 在同步访问远程资源时未设置超时时间

在同步访问阻塞操作时未设置超时,可能导致线程永久阻塞。

**触发条件**:
- 互斥锁获取无超时: `mutex.lock()`可能永久等待
- 条件变量等待无超时: `cv.wait()`
- `future.get()`无超时
- 网络IO操作无超时
- 文件IO可能阻塞

**典型漏洞模式**:

```cpp
// 危险: 互斥锁无超时
std::mutex mtx;

void thread_func() {
    mtx.lock();         // 如果锁被占用,永久等待
    // 临界区
    mtx.unlock();
}

// 危险: 条件变量无超时
std::mutex mtx;
std::condition_variable cv;
bool ready = false;

void waiter() {
    std::unique_lock<std::mutex> lock(mtx);
    cv.wait(lock, []{ return ready; });  // 如果never ready, 永久等待
    // ...
}

// 危险: future无超时
auto future = std::async(std::launch::async, long_running_task);
auto result = future.get();  // 可能永久阻塞

// 危险: 网络socket无超时
int sock = socket(AF_INET, SOCK_STREAM, 0);
connect(sock, ...);     // 可能长时间阻塞
recv(sock, buffer, size, 0);  // 可能永久阻塞

// 安全: 使用timed_lock
std::timed_mutex mtx;

void thread_func() {
    if (mtx.try_lock_for(std::chrono::seconds(30))) {
        // 临界区
        mtx.unlock();
    } else {
        // 处理超时
        std::cerr << "Failed to acquire lock within 30s" << std::endl;
    }
}

// 安全: 条件变量设置超时
void waiter() {
    std::unique_lock<std::mutex> lock(mtx);
    if (cv.wait_for(lock, std::chrono::seconds(60), []{ return ready; })) {
        // ready为true
    } else {
        // 超时
        std::cerr << "Timeout waiting for condition" << std::endl;
    }
}

// 安全: future设置超时
auto future = std::async(std::launch::async, long_running_task);
if (future.wait_for(std::chrono::seconds(30)) == std::future_status::ready) {
    auto result = future.get();
} else {
    std::cerr << "Task timeout" << std::endl;
}

// 安全: socket设置超时
int sock = socket(AF_INET, SOCK_STREAM, 0);
struct timeval timeout;
timeout.tv_sec = 30;
timeout.tv_usec = 0;
setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &timeout, sizeof(timeout));
```

**案例: 任务调度器**

```cpp
// 危险实现
class TaskScheduler {
    std::queue<Task> tasks_;
    std::mutex mtx_;
    std::condition_variable cv_;
    
public:
    void worker() {
        while (true) {
            std::unique_lock<std::mutex> lock(mtx_);
            cv_.wait(lock, [this]{ return !tasks_.empty(); });
            // 问题: 如果永远没有任务,线程永久阻塞
            
            Task task = tasks_.front();
            tasks_.pop();
            lock.unlock();
            
            task.execute();
        }
    }
};

// 安全实现
class TaskScheduler {
    std::queue<Task> tasks_;
    std::mutex mtx_;
    std::condition_variable cv_;
    std::atomic<bool> stop_{false};
    
public:
    void worker() {
        while (!stop_) {
            std::unique_lock<std::mutex> lock(mtx_);
            
            // 等待任务或超时
            if (cv_.wait_for(lock, std::chrono::seconds(60),
                            [this]{ return !tasks_.empty() || stop_; })) {
                if (stop_) break;
                
                Task task = tasks_.front();
                tasks_.pop();
                lock.unlock();
                
                task.execute();
            } else {
                // 超时,可以执行清理或心跳
                lock.unlock();
                heartbeat();
            }
        }
    }
    
    void shutdown() {
        stop_ = true;
        cv_.notify_all();
    }
};
```

**防护措施**:
- 使用`std::timed_mutex`和`try_lock_for/try_lock_until`
- 条件变量使用`wait_for/wait_until`设置超时
- `std::future`使用`wait_for/wait_until`检查状态
- 网络socket设置`SO_RCVTIMEO/SO_SNDTIMEO`
- 为阻塞操作设置合理的超时时间
- 提供优雅关闭机制,避免线程永久阻塞

---

### CWD-1137 在并发上下文中使用不可重入函数

在信号处理器或异步上下文中调用不可重入函数,可能导致数据损坏或死锁。

**触发条件**:
- 信号处理器中调用非异步信号安全函数
- 信号处理器中使用互斥锁
- 信号处理器中分配/释放内存
- 信号处理器中调用C++标准库函数
- 中断处理中使用不可重入函数

**典型漏洞模式**:

```cpp
// 危险: 信号处理器中使用printf
#include <csignal>
#include <cstdio>

void signal_handler(int sig) {
    printf("Signal %d received\n", sig);  // 非异步信号安全!
    // printf内部使用锁,可能死锁
}

int main() {
    signal(SIGINT, signal_handler);
    while (true) {
        printf("Main loop\n");  // 如果信号在这里触发...
    }
}

// 危险: 信号处理器中使用malloc
void signal_handler(int sig) {
    char* buffer = new char[1024];  // new/malloc不可重入!
    // ...
    delete[] buffer;
}

// 危险: 信号处理器中使用互斥锁
std::mutex global_mutex;

void signal_handler(int sig) {
    std::lock_guard<std::mutex> lock(global_mutex);  // 可能死锁!
    // ...
}

// 危险: 信号处理器修改全局状态
int global_counter = 0;

void signal_handler(int sig) {
    global_counter++;  // 数据竞争!
}

// 安全: 使用异步信号安全函数
#include <unistd.h>

void signal_handler(int sig) {
    const char msg[] = "Signal received\n";
    write(STDOUT_FILENO, msg, sizeof(msg) - 1);  // write是异步信号安全
}

// 安全: 使用原子变量
#include <atomic>

std::atomic<int> global_counter{0};

void signal_handler(int sig) {
    global_counter.fetch_add(1, std::memory_order_relaxed);
}

// 安全: 只设置标志,主循环处理
volatile sig_atomic_t signal_received = 0;

void signal_handler(int sig) {
    signal_received = 1;  // sig_atomic_t保证原子访问
}

int main() {
    signal(SIGINT, signal_handler);
    while (true) {
        if (signal_received) {
            signal_received = 0;
            handle_signal();  // 在主循环处理
        }
        // 正常工作
    }
}
```

**案例: SIGALRM定时器**

```cpp
// 危险实现
#include <csignal>
#include <iostream>
#include <vector>

std::vector<std::string> log_buffer;

void alarm_handler(int sig) {
    // 多个问题:
    log_buffer.push_back("Alarm triggered");  // vector非线程安全
    std::cout << "Alarm!" << std::endl;       // cout使用锁,可能死锁
}

// 安全实现: 信号处理器只设置标志
#include <csignal>
#include <atomic>
#include <iostream>

std::atomic<bool> alarm_triggered{false};

void alarm_handler(int sig) {
    alarm_triggered.store(true, std::memory_order_release);
}

void main_loop() {
    signal(SIGALRM, alarm_handler);
    alarm(5);  // 5秒后触发
    
    while (true) {
        if (alarm_triggered.exchange(false, std::memory_order_acquire)) {
            // 在主线程安全处理
            std::cout << "Processing alarm" << std::endl;
            // 执行需要的操作
            alarm(5);  // 重新设置
        }
        
        // 正常工作
        do_work();
    }
}
```

**C++异步信号安全函数(POSIX)**:
- `write()`, `read()`, `_exit()`
- `signal()`, `sigaction()`, `kill()`, `raise()`
- `sleep()`, `pause()`
- 原子操作: `std::atomic<T>`, `volatile sig_atomic_t`

**禁止在信号处理器中使用**:
- `printf`, `std::cout`, `std::cerr`
- `malloc`, `free`, `new`, `delete`
- `std::mutex`, `std::lock_guard`
- 大部分C++标准库函数
- 非线程安全的POSIX函数

**防护措施**:
- 信号处理器只设置`volatile sig_atomic_t`标志或原子变量
- 实际处理在主循环或专用线程进行
- 使用`write()`替代`printf()`
- 避免在信号处理器中分配内存
- 避免在信号处理器中使用锁
- 考虑使用`signalfd`或其他现代机制替代传统信号

---

## C++内存模型要点

### Memory Order语义

```cpp
// Relaxed: 无同步,仅保证原子性
std::atomic<int> counter{0};
counter.fetch_add(1, std::memory_order_relaxed);

// Acquire-Release: 建立happens-before关系
std::atomic<bool> ready{false};
int data = 0;

// Producer
data = 42;
ready.store(true, std::memory_order_release);  // 释放语义

// Consumer
while (!ready.load(std::memory_order_acquire));  // 获取语义
assert(data == 42);  // 保证看到data的修改

// Sequential Consistency: 全局顺序(默认,开销最大)
std::atomic<int> x{0}, y{0};
x.store(1, std::memory_order_seq_cst);
int r = y.load(std::memory_order_seq_cst);
```

### 常见内存序使用

| 场景 | 推荐内存序 |
|------|-----------|
| 简单计数器 | `memory_order_relaxed` |
| 标志位同步 | `memory_order_acquire/release` |
| 发布-订阅 | `memory_order_release/acquire` |
| 需要全局顺序 | `memory_order_seq_cst` |

---

## 典型触发条件总结

| 并发类型 | 高频触发条件 |
|---------|------------|
| 竞争条件 | check-then-act、复合操作、双重检查锁、懒汉单例 |
| 锁定不当 | 锁顺序不一致、嵌套锁、持锁调用回调、粒度不当 |
| 缺少同步 | STL容器并发、共享变量未保护、懒惰初始化、volatile误用 |
| 非同步访问 | 容器迭代器失效、shared_ptr并发、map并发访问 |
| 同步不正确 | 错误内存序、锁作用域错误、原子变量非原子操作 |
| 未设置超时 | mutex.lock()、cv.wait()、future.get()、网络IO |
| 不可重入函数 | 信号处理器中printf/malloc/锁、修改全局状态 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+并发类型]

## 并发上下文与共享资源
- 并发类型: [数据竞争/死锁/原子性违反/内存序错误]
- 问题位置: [文件:行号] [函数名]
- 共享资源: [变量/容器/对象]
- 内存模型: [memory_order使用/happens-before关系]
- 数据流: [详细的数据流和执行路径分析]

## 证据链与逻辑推理
1. 代码证据: 具体代码段和并发访问模式
2. 并发分析: 线程交错场景和可能的执行序列
3. 漏洞描述: 具体的并发安全问题
4. 推理: C++内存模型角度的分析

## 真实触发条件
1. 线程调度: [具体的调度场景]
2. 执行序列: [导致问题的指令序列]
3. 可利用性: [高/中/低]

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 触发难度 |
| 影响范围 | 高/中/低 | 数据损坏/崩溃/死锁 |
| 稳定性 | 高/中/低 | 系统可靠性影响 |
| 性能 | 高/中/低 | 性能下降程度 |

## 修复建议
### 方案一: [推荐方案]
```cpp
// 修复代码
```
**优点**: ...
**缺点**: ...

### 方案二: [备选方案]
```cpp
// 修复代码
```
**优点**: ...
**缺点**: ...

**推荐**: 方案X, 原因...

## 边界与不确定性
- 确定事实: ...
- 需验证假设: ...
- 建议调查: ...
```

---

## 非"执行逻辑"声明

本文档仅作知识参考和分析指南,不执行代码、自动扫描或生成最终裁决。应结合具体业务场景、性能要求和可维护性进行综合判断。

---

## 典型误报场景

**不应报告**:
- 使用`std::atomic<T>`的正确原子操作
- 使用互斥锁正确保护的共享资源
- Meyers单例模式(C++11保证线程安全)
- 使用`std::call_once`的初始化
- 仅在单线程上下文访问的变量
- 不可变对象(const数据成员)
- 线程局部存储(`thread_local`)
- 正确使用`std::scoped_lock`的多锁获取
- 正确使用acquire-release语义的原子操作
- 使用RAII正确管理锁的代码

---

## C++并发工具速查

### C++11
- `std::thread`, `std::mutex`, `std::atomic<T>`
- `std::lock_guard`, `std::unique_lock`
- `std::condition_variable`, `std::future/promise`

### C++14
- `std::shared_timed_mutex`

### C++17
- `std::scoped_lock` (多锁RAII)
- `std::shared_mutex` (读写锁)

### C++20
- `std::jthread` (自动join)
- `std::counting_semaphore`, `std::binary_semaphore`
- `std::latch`, `std::barrier`
- `std::atomic<std::shared_ptr<T>>`
- Coroutines (协程)

---

**文档版本**: v1.0  
**适用语言**: C++11/14/17/20  
**最后更新**: 2025-01