# Java 资源管理安全指导

## 能力目标

基于 Java 资源管理特性和常见问题模式,识别真实的资源泄漏、不当关闭和并发安全风险,避免模式匹配式误报。

---

## 前置判断

获取:
- Java 版本:Java 7+ 支持 try-with-resources
- 资源类型:文件流、数据库连接、网络连接、线程池等
- 是否实现 `AutoCloseable` 或 `Closeable` 接口
- 多线程环境下的并发访问
- 异常处理机制:是否正确处理资源关闭
- 输入来源:用户输入/网络数据/文件系统

---

## 分析流程

### Step 1 — 识别资源操作点
定位资源相关操作:
- 获取:`new FileInputStream()`、`Connection`、`Socket`、`ExecutorService`
- 关闭:`close()`、`shutdown()`、`disconnect()`
- 读写:`read()`、`write()`、`executeQuery()`
- 流转换:`BufferedReader`、`InputStreamReader`

### Step 2 — 验证资源生命周期
- 检查资源是否在所有代码路径中正确关闭
- 验证异常处理中的资源清理
- 确认 finally 块或 try-with-resources 的使用

### Step 3 — 检查并发安全性
- 多线程访问共享资源是否同步
- 连接池配置是否合理
- 是否存在竞态条件

### Step 4 — 分析引用管理
- 是否持有不必要的强引用
- 集合类中是否清理过期对象
- 缓存是否有淘汰机制

---

## 风险模式分类

### CAT-J001 资源未正确关闭(资源泄漏)
资源(文件、连接、流等)获取后未在所有执行路径中关闭。

**触发**:
- 缺少 `close()` 调用
- 异常路径未关闭资源
- finally 块缺失或不完整
- 未使用 try-with-resources(Java 7+)
- 嵌套资源只关闭外层

**案例**:
```java
// 错误示例:异常时资源泄漏
public void readFile(String path) throws IOException {
    FileInputStream fis = new FileInputStream(path);
    // 如果这里抛出异常,fis 永远不会被关闭
    byte[] data = new byte[1024];
    fis.read(data);
    fis.close(); // 可能永远执行不到
}

// 正确示例:使用 try-with-resources
public void readFileSafe(String path) throws IOException {
    try (FileInputStream fis = new FileInputStream(path)) {
        byte[] data = new byte[1024];
        fis.read(data);
    } // 自动关闭,即使发生异常
}

// 正确示例:传统 finally 方式
public void readFileTraditional(String path) throws IOException {
    FileInputStream fis = null;
    try {
        fis = new FileInputStream(path);
        byte[] data = new byte[1024];
        fis.read(data);
    } finally {
        if (fis != null) {
            try {
                fis.close();
            } catch (IOException e) {
                // 记录日志
            }
        }
    }
}
```

**分析**:
追踪资源从创建到所有可能退出点,验证每个分支的关闭逻辑,检查异常和错误处理,确认嵌套资源的关闭顺序。

---

### CAT-J002 数据库连接未释放
数据库连接、Statement、ResultSet 未正确关闭导致连接池耗尽。

**触发**:
- Connection 未关闭
- PreparedStatement/Statement 未关闭
- ResultSet 未关闭
- 异常时连接未归还连接池
- 事务未提交或回滚

**案例**:
```java
// 错误示例:多个资源泄漏风险
public List<User> getUsers() {
    Connection conn = null;
    PreparedStatement stmt = null;
    ResultSet rs = null;
    try {
        conn = dataSource.getConnection();
        stmt = conn.prepareStatement("SELECT * FROM users");
        rs = stmt.executeQuery();
        List<User> users = new ArrayList<>();
        while (rs.next()) {
            users.add(new User(rs.getString("name")));
        }
        return users;
    } catch (SQLException e) {
        // 异常时三个资源都泄漏
        throw new RuntimeException(e);
    }
    // 正常情况也未关闭
}

// 正确示例:try-with-resources 嵌套
public List<User> getUsersSafe() {
    try (Connection conn = dataSource.getConnection();
         PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users");
         ResultSet rs = stmt.executeQuery()) {
        
        List<User> users = new ArrayList<>();
        while (rs.next()) {
            users.add(new User(rs.getString("name")));
        }
        return users;
    } catch (SQLException e) {
        throw new RuntimeException(e);
    }
    // 所有资源按相反顺序自动关闭
}

// 正确示例:使用 Spring JdbcTemplate(推荐)
public List<User> getUsersSpring() {
    return jdbcTemplate.query("SELECT * FROM users",
        (rs, rowNum) -> new User(rs.getString("name")));
    // 框架自动管理连接
}
```

**分析**:
验证所有数据库资源的关闭链,检查异常路径,确认连接池配置合理,识别长时间持有连接的场景。

---

### CAT-J003 流未正确关闭链
I/O 流包装链中内层流泄漏。

**触发**:
- 只关闭外层包装流
- 中间流创建失败导致内层流泄漏
- 流转换时忘记关闭原始流
- 使用 `new BufferedReader(new FileReader())` 模式

**案例**:
```java
// 错误示例:内层流可能泄漏
public String readText(String path) throws IOException {
    BufferedReader reader = null;
    try {
        // 如果 BufferedReader 构造失败,FileReader 会泄漏
        reader = new BufferedReader(new FileReader(path));
        return reader.readLine();
    } finally {
        if (reader != null) {
            reader.close();
        }
    }
}

// 正确示例:嵌套 try-with-resources
public String readTextSafe(String path) throws IOException {
    try (FileReader fr = new FileReader(path);
         BufferedReader reader = new BufferedReader(fr)) {
        return reader.readLine();
    }
}

// 更简洁的正确示例
public String readTextBest(String path) throws IOException {
    try (BufferedReader reader = new BufferedReader(new FileReader(path))) {
        return reader.readLine();
    }
    // 关闭 BufferedReader 会自动关闭内层 FileReader
}

// Java 11+ 最佳实践
public String readTextModern(String path) throws IOException {
    return Files.readString(Path.of(path));
}
```

**分析**:
识别流包装模式,验证每层流的关闭保证,检查构造函数异常处理。

---

### CAT-J004 线程池未正确关闭
ExecutorService 未关闭导致线程泄漏和应用无法退出。

**触发**:
- 创建线程池后未调用 `shutdown()` 或 `shutdownNow()`
- 应用关闭时线程池仍在运行
- 使用 `Executors.newCachedThreadPool()` 无限制创建线程
- 任务提交后未等待完成

**案例**:
```java
// 错误示例:线程池泄漏
public class TaskProcessor {
    public void processTasks(List<Task> tasks) {
        ExecutorService executor = Executors.newFixedThreadPool(10);
        for (Task task : tasks) {
            executor.submit(task::execute);
        }
        // 忘记关闭,线程永远不会释放
    }
}

// 正确示例:确保关闭
public class TaskProcessorSafe {
    public void processTasks(List<Task> tasks) {
        ExecutorService executor = Executors.newFixedThreadPool(10);
        try {
            for (Task task : tasks) {
                executor.submit(task::execute);
            }
        } finally {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                executor.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }
}

// 最佳实践:使用成员变量+生命周期管理
public class TaskProcessorBest {
    private final ExecutorService executor;
    
    public TaskProcessorBest() {
        this.executor = Executors.newFixedThreadPool(10);
    }
    
    public void processTasks(List<Task> tasks) {
        for (Task task : tasks) {
            executor.submit(task::execute);
        }
    }
    
    public void close() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
```

**分析**:
识别线程池创建点,验证关闭逻辑,检查应用关闭钩子,确认任务等待机制。

---

### CAT-J005 集合持有过期对象引用
集合中存储大量不再使用的对象导致内存泄漏。

**触发**:
- 缓存无限增长
- 监听器未注销
- 静态集合持有对象
- 长生命周期对象持有短生命周期对象引用
- Map 中 key 或 value 未清理

**案例**:
```java
// 错误示例:无限增长的缓存
public class UserCache {
    private static final Map<Long, User> cache = new HashMap<>();
    
    public User getUser(Long id) {
        return cache.computeIfAbsent(id, this::loadUser);
        // 缓存永远不会清理,最终 OOM
    }
    
    private User loadUser(Long id) {
        // 从数据库加载
        return new User(id);
    }
}

// 正确示例:使用 LRU 缓存
public class UserCacheSafe {
    private final Map<Long, User> cache = new LinkedHashMap<Long, User>(
        100, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<Long, User> eldest) {
            return size() > 100; // 限制大小
        }
    };
    
    public synchronized User getUser(Long id) {
        return cache.computeIfAbsent(id, this::loadUser);
    }
}

// 最佳实践:使用 Caffeine/Guava Cache
public class UserCacheBest {
    private final Cache<Long, User> cache = Caffeine.newBuilder()
        .maximumSize(1000)
        .expireAfterAccess(10, TimeUnit.MINUTES)
        .build();
    
    public User getUser(Long id) {
        return cache.get(id, this::loadUser);
    }
}

// 错误示例:监听器泄漏
public class EventPublisher {
    private final List<EventListener> listeners = new ArrayList<>();
    
    public void addListener(EventListener listener) {
        listeners.add(listener);
        // 如果 listener 是 Activity/Fragment,会导致内存泄漏
    }
}

// 正确示例:使用弱引用
public class EventPublisherSafe {
    private final List<WeakReference<EventListener>> listeners = 
        new CopyOnWriteArrayList<>();
    
    public void addListener(EventListener listener) {
        listeners.add(new WeakReference<>(listener));
    }
    
    public void notifyListeners(Event event) {
        listeners.removeIf(ref -> ref.get() == null);
        for (WeakReference<EventListener> ref : listeners) {
            EventListener listener = ref.get();
            if (listener != null) {
                listener.onEvent(event);
            }
        }
    }
}
```

**分析**:
识别长生命周期集合,验证对象移除机制,检查缓存策略,确认监听器注销。

---

### CAT-J006 ClassLoader 泄漏
类加载器未释放导致大量类元数据无法回收。

**触发**:
- 动态类加载后未清理
- Web 应用重部署时类加载器泄漏
- 线程池持有 ClassLoader 引用
- ThreadLocal 持有 ClassLoader 加载的类
- JDBC 驱动未注销

**案例**:
```java
// 错误示例:ThreadLocal 导致 ClassLoader 泄漏
public class RequestContext {
    private static final ThreadLocal<UserSession> context = 
        new ThreadLocal<>();
    
    public static void setSession(UserSession session) {
        context.set(session);
        // 如果线程是线程池中的,ThreadLocal 会持有 session
        // session 持有 ClassLoader 加载的类引用
    }
}

// 正确示例:及时清理 ThreadLocal
public class RequestContextSafe {
    private static final ThreadLocal<UserSession> context = 
        new ThreadLocal<>();
    
    public static void setSession(UserSession session) {
        context.set(session);
    }
    
    public static void clearSession() {
        context.remove(); // 必须清理
    }
    
    public static UserSession getSession() {
        return context.get();
    }
}

// 使用示例(如 Servlet Filter)
public class RequestFilter implements Filter {
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, 
                        FilterChain chain) throws IOException, ServletException {
        try {
            RequestContextSafe.setSession(new UserSession());
            chain.doFilter(request, response);
        } finally {
            RequestContextSafe.clearSession(); // 确保清理
        }
    }
}

// 错误示例:JDBC 驱动泄漏
public class DataSourceConfig {
    static {
        try {
            Class.forName("com.mysql.jdbc.Driver");
            // Web 应用重部署时驱动未注销
        } catch (ClassNotFoundException e) {
            throw new RuntimeException(e);
        }
    }
}

// 正确示例:ServletContextListener 中注销
public class DriverCleanupListener implements ServletContextListener {
    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        Enumeration<Driver> drivers = DriverManager.getDrivers();
        while (drivers.hasMoreElements()) {
            Driver driver = drivers.nextElement();
            try {
                DriverManager.deregisterDriver(driver);
            } catch (SQLException e) {
                // 记录日志
            }
        }
    }
}
```

**分析**:
检查 ThreadLocal 使用,验证 Web 应用关闭钩子,识别动态类加载,确认驱动注销。

---

### CAT-J007 并发资源访问冲突
多线程不安全地访问共享资源。

**触发**:
- 多线程共享同一连接对象
- 非线程安全的流被多线程使用
- 资源关闭时其他线程仍在使用
- 连接池配置不当导致竞争
- 缺少同步保护

**案例**:
```java
// 错误示例:共享连接
public class DatabaseService {
    private Connection connection; // 共享连接
    
    public void init() throws SQLException {
        connection = DriverManager.getConnection(url, user, password);
    }
    
    public List<String> query(String sql) throws SQLException {
        // 多线程调用会导致冲突
        Statement stmt = connection.createStatement();
        ResultSet rs = stmt.executeQuery(sql);
        // ...
    }
}

// 正确示例:使用连接池
public class DatabaseServiceSafe {
    private final DataSource dataSource;
    
    public DatabaseServiceSafe(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    public List<String> query(String sql) throws SQLException {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            
            List<String> results = new ArrayList<>();
            while (rs.next()) {
                results.add(rs.getString(1));
            }
            return results;
        }
        // 每个线程使用独立连接
    }
}

// 错误示例:共享流
public class LogWriter {
    private FileWriter writer;
    
    public void init(String path) throws IOException {
        writer = new FileWriter(path, true);
    }
    
    public void log(String message) throws IOException {
        writer.write(message + "\n"); // 多线程不安全
    }
}

// 正确示例:同步或使用线程安全的日志库
public class LogWriterSafe {
    private final FileWriter writer;
    private final Object lock = new Object();
    
    public LogWriterSafe(String path) throws IOException {
        this.writer = new FileWriter(path, true);
    }
    
    public void log(String message) throws IOException {
        synchronized (lock) {
            writer.write(message + "\n");
            writer.flush();
        }
    }
    
    public void close() throws IOException {
        synchronized (lock) {
            writer.close();
        }
    }
}

// 最佳实践:使用 slf4j + logback
public class LogWriterBest {
    private static final Logger logger = 
        LoggerFactory.getLogger(LogWriterBest.class);
    
    public void log(String message) {
        logger.info(message); // 框架保证线程安全
    }
}
```

**分析**:
识别共享资源,验证同步机制,检查连接池配置,确认线程安全性。

---

### CAT-J008 资源双重关闭
同一资源被多次关闭导致异常或不一致状态。

**触发**:
- finally 块和 catch 块都调用 close
- try-with-resources 后又手动 close
- 多个变量指向同一资源
- 关闭父资源后又关闭子资源

**案例**:
```java
// 错误示例:双重关闭
public void processFile(String path) throws IOException {
    FileInputStream fis = new FileInputStream(path);
    try {
        // 处理文件
    } catch (IOException e) {
        fis.close(); // 第一次关闭
        throw e;
    } finally {
        fis.close(); // 第二次关闭,可能抛出异常
    }
}

// 正确示例:只在 finally 关闭
public void processFileSafe(String path) throws IOException {
    FileInputStream fis = null;
    try {
        fis = new FileInputStream(path);
        // 处理文件
    } finally {
        if (fis != null) {
            fis.close(); // 只关闭一次
        }
    }
}

// 最佳示例:try-with-resources
public void processFileBest(String path) throws IOException {
    try (FileInputStream fis = new FileInputStream(path)) {
        // 处理文件
    } // 自动关闭,且只关闭一次
}

// 错误示例:包装流重复关闭
public void writeData(OutputStream os) throws IOException {
    BufferedOutputStream bos = new BufferedOutputStream(os);
    try {
        bos.write(data);
        bos.flush();
    } finally {
        bos.close(); // 关闭 BufferedOutputStream
        os.close();  // 又关闭底层流,可能导致问题
    }
}

// 正确示例:只关闭最外层
public void writeDataSafe(OutputStream os) throws IOException {
    try (BufferedOutputStream bos = new BufferedOutputStream(os)) {
        bos.write(data);
        bos.flush();
    } // 只关闭 BufferedOutputStream,会自动关闭底层流
}
```

**分析**:
追踪 close 调用点,验证资源引用关系,检查包装模式。

---

### CAT-J009 外部输入路径遍历
使用未验证的外部输入构造文件路径导致路径遍历攻击。

**触发**:
- 用户输入直接拼接到文件路径
- 包含 `../` 的路径未规范化
- 文件名未验证允许访问任意文件
- 符号链接绕过限制

**案例**:
```java
// 错误示例:路径遍历漏洞
public File loadUserFile(String filename) {
    // 用户传入 "../../etc/passwd" 可访问系统文件
    return new File("/app/userfiles/" + filename);
}

// 正确示例:路径验证
public File loadUserFileSafe(String filename) throws IOException {
    // 规范化路径
    Path basePath = Paths.get("/app/userfiles").toRealPath();
    Path filePath = basePath.resolve(filename).normalize();
    
    // 验证最终路径在允许的目录内
    if (!filePath.startsWith(basePath)) {
        throw new SecurityException("Invalid file path");
    }
    
    // 验证文件名不包含危险字符
    if (filename.contains("..") || filename.contains("/") || 
        filename.contains("\\")) {
        throw new SecurityException("Invalid filename");
    }
    
    return filePath.toFile();
}

// 最佳实践:白名单验证
public File loadUserFileBest(String filename) throws IOException {
    // 只允许字母数字和部分符号
    if (!filename.matches("^[a-zA-Z0-9_.-]+$")) {
        throw new SecurityException("Invalid filename format");
    }
    
    Path basePath = Paths.get("/app/userfiles").toRealPath();
    Path filePath = basePath.resolve(filename).toRealPath();
    
    if (!filePath.startsWith(basePath)) {
        throw new SecurityException("Path traversal detected");
    }
    
    return filePath.toFile();
}
```

**分析**:
追踪文件路径来源,验证输入校验,检查路径规范化,确认权限控制。

---

### CAT-J010 资源限制缺失
未限制资源使用导致拒绝服务。

**触发**:
- 读取文件未限制大小
- 网络请求未设置超时
- 上传文件无大小限制
- 递归深度无限制
- 集合大小无限制

**案例**:
```java
// 错误示例:无限制读取
public String readFile(String path) throws IOException {
    StringBuilder sb = new StringBuilder();
    try (BufferedReader reader = new BufferedReader(new FileReader(path))) {
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line);
            // 恶意文件可能是 GB 级别,导致 OOM
        }
    }
    return sb.toString();
}

// 正确示例:限制大小
public String readFileSafe(String path, long maxSize) throws IOException {
    File file = new File(path);
    if (file.length() > maxSize) {
        throw new IOException("File too large: " + file.length());
    }
    
    StringBuilder sb = new StringBuilder();
    long bytesRead = 0;
    try (BufferedReader reader = new BufferedReader(new FileReader(path))) {
        String line;
        while ((line = reader.readLine()) != null) {
            bytesRead += line.length();
            if (bytesRead > maxSize) {
                throw new IOException("File content exceeds limit");
            }
            sb.append(line).append("\n");
        }
    }
    return sb.toString();
}

// 错误示例:HTTP 请求无超时
public String fetchUrl(String url) throws IOException {
    URLConnection conn = new URL(url).openConnection();
    try (InputStream is = conn.getInputStream();
         BufferedReader reader = new BufferedReader(
             new InputStreamReader(is))) {
        // 如果服务器不响应,永远阻塞
        return reader.lines().collect(Collectors.joining("\n"));
    }
}

// 正确示例:设置超时和大小限制
public String fetchUrlSafe(String url) throws IOException {
    URLConnection conn = new URL(url).openConnection();
    conn.setConnectTimeout(5000);  // 连接超时 5 秒
    conn.setReadTimeout(10000);    // 读取超时 10 秒
    
    final long MAX_SIZE = 1024 * 1024; // 1MB
    
    try (InputStream is = conn.getInputStream();
         ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
        
        byte[] data = new byte[8192];
        int bytesRead;
        long totalRead = 0;
        
        while ((bytesRead = is.read(data)) != -1) {
            totalRead += bytesRead;
            if (totalRead > MAX_SIZE) {
                throw new IOException("Response too large");
            }
            buffer.write(data, 0, bytesRead);
        }
        
        return buffer.toString(StandardCharsets.UTF_8);
    }
}
```

**分析**:
识别外部输入点,验证大小限制,检查超时配置,确认边界控制。

---

## 代码分析视角

### 1. 资源生命周期分析
追踪资源从获取到释放的完整路径,验证所有退出点的清理逻辑。

### 2. 异常路径分析
检查异常情况下的资源清理,验证 finally 块和 try-with-resources 使用。

### 3. 并发安全分析
验证多线程环境下的资源访问,检查同步机制和线程局部存储。

### 4. 引用链分析
追踪对象引用关系,识别内存泄漏风险,验证缓存和集合清理。

---

## 典型触发条件

| 风险模式 | 高频触发条件 |
|---------|-------------|
| 文件流泄漏 | 异常处理缺失、未使用 try-with-resources |
| 数据库连接泄漏 | ResultSet/Statement 未关闭、事务未完成 |
| 线程池泄漏 | 未调用 shutdown、应用关闭时仍运行 |
| 集合泄漏 | 静态集合、缓存无限增长、监听器未注销 |
| ClassLoader 泄漏 | ThreadLocal 未清理、JDBC 驱动未注销 |
| 并发冲突 | 共享连接、流被多线程访问 |
| 路径遍历 | 用户输入未验证、路径未规范化 |
| 资源耗尽 | 无大小限制、无超时设置 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+风险类型]

## 资源操作详情
- 资源类型: [文件流/数据库连接/线程池/网络连接]
- 操作位置: [文件:行号] [方法名]
- 获取方式: [new FileInputStream/getConnection等]
- 关闭状态: [已关闭/未关闭/部分路径未关闭]

## 证据链与逻辑推理
1. 代码证据:具体代码行
2. 资源生命周期:获取到释放的路径
3. 异常路径:是否处理异常时的清理
4. 问题描述:具体的资源管理问题

## 真实触发条件
输入条件、异常场景、并发情况、外部依赖

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 资源泄漏风险 | 高/中/低 | 长期运行导致 OOM/连接耗尽 |
| 并发安全性 | 高/中/低 | 数据损坏/异常/不一致 |
| 安全风险 | 高/中/低 | 路径遍历/信息泄露/DoS |

## 修改建议
方案一:使用 try-with-resources
```java
// 代码示例
```

方案二:传统 finally 方式
```java
// 代码示例
```

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
- 正确使用 try-with-resources 且资源实现 AutoCloseable
- 框架自动管理的资源(如 Spring 管理的 DataSource)
- 已在 finally 块中正确关闭资源
- 使用连接池且配置合理
- 缓存有明确的淘汰策略和大小限制
- 内部方法调用,资源由调用方管理
- 测试代码中的临时资源

---

## 资源管理最佳实践

| 场景 | 传统方式 | 推荐方式 | 注意事项 |
|------|---------|---------|---------|
| 文件 I/O | finally 关闭 | try-with-resources | Java 7+ |
| 数据库访问 | 手动关闭连接 | 连接池 + try-with-resources | 使用 HikariCP/Druid |
| HTTP 请求 | 手动关闭流 | HttpClient 4.5+/Java 11 HttpClient | 设置超时 |
| 线程池 | 手动管理 | ExecutorService + shutdown | 应用关闭时清理 |
| 缓存 | HashMap | Caffeine/Guava Cache | 限制大小和过期 |
| 日志 | FileWriter | slf4j + logback/log4j2 | 框架管理 |
| 定时任务 | Timer | ScheduledExecutorService | 支持并发 |

---

## Java 版本差异

| 特性 | Java 版本 | 说明 |
|------|----------|------|
| try-with-resources | Java 7+ | 自动资源管理 |
| try-with-resources 多资源 | Java 9+ | 可使用 effectively final 变量 |
| Stream API | Java 8+ | 流资源需要关闭 |
| HttpClient | Java 11+ | 现代 HTTP 客户端 |
| Files API | Java 7+ | NIO.2 文件操作 |

---

**文档版本**: v1.0 | **适用语言**: Java 8+