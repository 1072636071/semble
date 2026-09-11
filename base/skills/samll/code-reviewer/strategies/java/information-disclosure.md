## 能力目标

基于敏感信息生命周期和数据流分析,判断真实信息泄露风险,识别可达的泄露点,区分合法数据处理和恶意泄露。

---

## 前置判断

获取:
- 敏感信息类型:密码/密钥/令牌/个人信息/配置信息/调试信息
- 数据存储位置:内存/磁盘/缓存/日志/数据库/配置文件
- 传输方式:HTTP/HTTPS/Socket/IPC/命令行参数/环境变量
- 生命周期:创建/使用/存储/传输/销毁
- 访问控制:权限/加密/脱敏/审计日志
- 数据流路径:从生成到销毁的完整传递链

---

## 分析流程

### Step 1 — 识别敏感信息产生点
定位敏感信息的生成和存储:
- 用户输入:密码、信用卡号、个人身份信息
- 配置信息:API密钥、数据库凭证、访问令牌
- 系统信息:文件路径、环境变量、内部IP地址
- 调试信息:堆栈跟踪、异常详情、内部状态
- 临时数据:缓冲区、缓存、中间计算结果

### Step 2 — 追踪敏感信息数据流
- 正向追踪:从敏感信息产生到所有可能的输出位置
- 反向追踪:从日志/错误信息/响应回溯数据来源
- 跨边界追踪:识别跨进程、跨网络、跨分层的数据传递
- 转换点追踪:记录数据格式转换、编码、解码节点

### Step 3 — 验证防护机制
- 加密保护:传输加密(SSL/TLS)、存储加密
- 脱敏处理:日志脱敏、响应脱敏、显示脱敏
- 访问控制:权限验证、最小权限原则
- 清理机制:内存清零、缓存清理、日志轮转
- 安全配置:不回显密码、隐藏敏感配置

### Step 4 — 判断真实泄露风险
- 可达性:泄露点是否可被外部访问
- 暴露范围:泄霽数据的完整性和敏感性
- 可利用性:攻击者能否获取泄露信息
- 影响评估:泄露后的潜在危害

---

## 风险模式分类

### CWD-1275 错误消息中包含敏感信息
应用程序在错误消息中暴露敏感信息,如调试信息、内部路径、数据库详情等。

**触发条件**:
- 异常堆栈跟踪直接返回给用户
- 错误消息包含文件路径、行号或系统信息
- 数据库错误消息暴露表结构、字段名
- 系统错误消息包含内部IP、版本号
- 错误处理未区分内外部环境

**分析方法**:
1. 识别所有异常处理和错误响应位置
2. 检查异常信息是否直接输出到用户
3. 验证是否有错误消息脱敏机制
4. 区分开发和生产环境的错误处理逻辑

**典型漏洞模式**:
```java
// 危险: 直接暴露异常堆栈
} catch (Exception e) {
    response.getWriter().write("Error: " + e.toString());
    e.printStackTrace(response.getWriter());
}

// 危险: 数据库错误暴露详细信息
} catch (SQLException e) {
    response.getWriter().write("Database error: " + e.getMessage());
    // 可能暴露: Table 'users' doesn't exist
}

// 安全: 统一错误处理
} catch (Exception e) {
    logger.error("Error occurred", e);
    response.getWriter().write("An internal error occurred. Please try again.");
}
```

**防护措施**:
- 实现统一的异常处理机制,不向用户暴露内部信息
- 生产环境禁用详细错误输出,记录到服务器日志
- 使用通用错误消息,具体信息仅记录到日志
- 对错误信息进行分类,区分用户错误和系统错误
- 实施错误消息脱敏规则

---

### CWD-1276 调试代码中插入敏感信息
调试或测试代码中硬编码敏感信息,导致信息泄露。

**触发条件**:
- 源代码中硬编码密码、密钥、令牌
- 注释中包含敏感信息
- 调试输出包含敏感数据
- 测试数据使用真实凭证
- 提交到版本控制的配置文件包含密钥

**分析方法**:
1. 搜索常见敏感信息关键词:password、secret、token、key、api_key
2. 检查代码中的字符串常量是否包含敏感信息
3. 验证是否有调试代码未清理
4. 检查配置文件和测试文件

**典型漏洞模式**:
```java
// 危险: 硬编码密码
private static final String DB_PASSWORD = "admin123";
private static final String API_KEY = "sk-1234567890abcdef";

// 危险: 注释中的敏感信息
// TODO: Remove this key - prod: sk-9876543210fedcba

// 危险: 调试输出
System.out.println("Connecting with user: admin, pass: password123");

// 安全: 使用配置文件或环境变量
private static final String DB_PASSWORD = System.getenv("DB_PASSWORD");
// 或使用密钥管理系统
```

**防护措施**:
- 使用环境变量、配置文件或密钥管理系统存储敏感信息
- 使用.gitignore排除包含敏感信息的文件
- 实施提交前钩子检查敏感信息
- 使用秘密扫描工具检测代码中的敏感信息
- 使用占位符或示例数据替代真实凭证

---

### CWD-1277 序列化类中包含敏感信息
可序列化的类中包含敏感字段,导致敏感信息被序列化传输或存储。

**触发条件**:
- 敏感字段未标记为transient
- 序列化对象包含密码、密钥、令牌
- 敏感信息字段的getter/setter可被访问
- 序列化数据未加密传输或存储

**分析方法**:
1. 识别所有实现Serializable接口的类
2. 检查类中的字段是否包含敏感信息
3. 验证敏感字段是否标记为transient
4. 检查序列化数据的存储和传输方式

**典型漏洞模式**:
```java
// 危险: 敏感字段未标记为transient
public class User implements Serializable {
    private String username;
    private String password; // 会被序列化
    private String creditCard; // 会被序列化
}

// 危险: 敏感信息通过getter暴露
public class User implements Serializable {
    private transient String password; // 序列化时不包含
    public String getPassword() { return password; } // 仍可通过反射访问
}

// 安全: 使用transient标记敏感字段
public class User implements Serializable {
    private String username;
    private transient String password; // 序列化时不包含
    private transient String apiKey; // 序列化时不包含
}

// 安全: 实现自定义序列化
public class User implements Serializable {
    private String username;
    private String password;

    private void writeObject(ObjectOutputStream out) throws IOException {
        out.defaultWriteObject();
        // 不写入password字段
    }
}
```

**防护措施**:
- 将敏感字段标记为transient,避免序列化
- 实现自定义序列化方法,控制序列化内容
- 对序列化数据进行加密传输和存储
- 考虑使用更安全的格式替代序列化,如JSON
- 限制对敏感字段的访问权限

---

### CWD-1278 缓存中包含敏感信息
缓存机制存储了敏感信息,导致信息泄露风险。

**触发条件**:
- HTTP响应头缓存敏感信息
- 浏览器缓存包含敏感数据
- 服务端缓存(如Redis、Memcached)存储未加密的敏感信息
- CDN缓存敏感资源
- 缓存键包含敏感信息

**分析方法**:
1. 识别所有缓存机制:浏览器缓存、CDN缓存、应用缓存
2. 检查缓存的数据内容是否包含敏感信息
3. 验证缓存键是否包含敏感数据
4. 检查Cache-Control、Set-Cookie等缓存相关头

**典型漏洞模式**:
```java
// 危险: 敏感信息缓存到响应头
response.setHeader("Cache-Control", "max-age=3600");
response.getWriter().write(userData); // 敏感信息可被缓存

// 危险: Set-Cookie未禁止缓存
response.setHeader("Set-Cookie", "token=" + token + "; Path=/");

// 危险: Redis存储未加密的密码
redis.set("user:" + userId + ":password", password);

// 安全: 防止敏感信息被缓存
response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
response.setHeader("Pragma", "no-cache");
response.setHeader("Expires", "0");

// 安全: Cookie设置HttpOnly和Secure
response.setHeader("Set-Cookie",
    "token=" + token + "; Path=/; HttpOnly; Secure; SameSite=Strict");

// 安全: 缓存加密的敏感信息
redis.set("user:" + userId + ":data", encrypt(sensitiveData));
```

**防护措施**:
- 对包含敏感信息的响应设置正确的Cache-Control头
- 设置Cookie为HttpOnly和Secure,禁止缓存
- 服务端缓存前对敏感信息加密或哈希处理
- 避免在URL参数中传递敏感信息
- 实施缓存键命名规范,不包含敏感信息

---

### CWD-1279 通过进程调用暴露敏感信息
调用外部进程时,敏感信息通过命令行参数或环境变量泄露。

**触发条件**:
- 密码通过命令行参数传递: `curl -u user:password url`
- 敏感信息通过环境变量传递给不可信进程
- 进程信息(如/proc)中可见命令行参数
- 日志记录了完整的命令行

**分析方法**:
1. 识别所有进程调用:exec、system、ProcessBuilder
2. 检查命令行参数是否包含敏感信息
3. 验证环境变量传递的安全性
4. 检查进程信息是否可被其他用户访问

**典型漏洞模式**:
```bash
# 危险: 密码在命令行参数中
wget --user=admin --password=secret123 http://example.com
# ps aux 可看到完整命令行

# 危险: 通过环境变量传递敏感信息
export API_KEY="sk-1234567890"
./script.sh
# 其他进程可能读取环境变量

# 危险: Shell中直接拼接
mysql -u root -p$password -e "SELECT * FROM users"

# 安全: 使用标准输入传递密码
mysql -u root -p -e "SELECT * FROM users" <<< "password"

# 安全: 使用配置文件
cat > config.txt <<EOF
user=admin
password=secret123
EOF
wget --config=config.txt http://example.com
rm -f config.txt

# 安全: 进程启动后清理环境
unset API_KEY
```

**防护措施**:
- 避免通过命令行参数传递敏感信息
- 使用标准输入、命名管道或Unix域套接字传递敏感数据
- 进程启动后清理环境变量中的敏感信息
- 限制进程信息的访问权限
- 使用短期的临时令牌而非长期凭证

---

### CWD-1280 日志中包含敏感信息
日志文件中记录了敏感信息,导致信息泄露。

**触发条件**:
- 日志直接记录用户输入而未过滤
- 日志记录请求参数(如password字段)
- 日志包含完整的HTTP请求/响应
- 日志记录内部系统信息、凭据、令牌
- 日志文件权限过宽,可被未授权访问

**分析方法**:
1. 识别所有日志记录调用
2. 检查日志内容是否包含用户输入或内部数据
3. 验证日志文件的访问权限
4. 检查日志传输和存储是否加密

**典型漏洞模式**:
```java
// 危险: 直接记录所有请求参数
logger.info("Request: " + request.toString());

// 危险: 记录密码字段
logger.info("User login: " + username + ", password: " + password);

// 危险: 记录认证令牌
logger.info("Auth token: " + request.getHeader("Authorization"));

// 危险: 异常堆栈包含敏感信息
} catch (SQLException e) {
    logger.error("Database error", e); // 可能暴露连接字符串
}

// 安全: 实施日志脱敏
logger.info("User login: " + username);
// 不记录password字段

// 安全: 使用结构化日志并过滤敏感字段
LogEntry entry = new LogEntry()
    .setUsername(username)
    .setAction("login")
    .setTimestamp(now);
logger.info(SecureLogFormatter.format(entry));

// 安全: 自定义异常消息避免敏感信息
} catch (SQLException e) {
    logger.error("Database operation failed: " + e.getErrorCode());
}
```

**防护措施**:
- 实施日志脱敏策略,过滤敏感字段
- 使用白名单而非黑名单在日志中记录字段
- 设置适当的日志文件权限,限制访问
- 定期轮转和清理日志文件
- 对敏感系统禁用详细日志,仅记录必要信息
- 使用结构化日志格式便于过滤和审查

---

### CWD-1281 在源代码中包含敏感信息
源代码文件中硬编码或注释中包含敏感信息。

**触发条件**:
- 源代码中硬编码数据库连接字符串
- 配置文件中包含API密钥或访问令牌
- 注释中包含测试凭证或内部信息
- SQL语句中硬编码敏感数据
- JavaScript文件中包含密钥或令牌

**分析方法**:
1. 扫描源代码中的字符串常量
2. 检查配置文件中的敏感字段
3. 搜索常见敏感信息模式:密码、密钥、令牌、凭证
4. 验证是否有开发或测试环境的配置被提交

**典型漏洞模式**:
```java
// 危险: 硬编码数据库连接字符串
String connStr = "jdbc:mysql://db.example.com:3306/mydb?user=admin&password=secret";

// 危险: 配置文件包含API密钥
// config.properties
paypal.client_id=AX-1234567890abcdef
paypal.client_secret=EK-xxx1234567890abcdef

// 危险: JavaScript中包含密钥
var apiKey = "AIzaSyBd-Yl-xxx"; // Google Maps API Key

// 安全: 使用环境变量
String connStr = String.format(
    "jdbc:mysql://%s:%d/%s?user=%s&password=%s",
    System.getenv("DB_HOST"),
    Integer.parseInt(System.getenv("DB_PORT")),
    System.getenv("DB_NAME"),
    System.getenv("DB_USER"),
    System.getenv("DB_PASSWORD")
);

// 安全: 使用配置管理服务
String apiKey = ConfigService.getValue("paypal.client_secret");

// 安全: 使用示例配置文件并排除
// config.example.properties
paypal.client_id=YOUR_CLIENT_ID_HERE
paypal.client_secret=YOUR_CLIENT_SECRET_HERE
```

**防护措施**:
- 使用环境变量或配置管理系统存储敏感信息
- 提供示例配置文件,排除实际配置
- 使用.gitignore排除敏感文件
- 实施预提交检查,阻止敏感信息提交
- 使用秘密管理服务(如AWS Secrets Manager、HashiCorp Vault)
- 定期轮换密钥和令牌

---

### CWD-1287 WSDL文件包含敏感信息
WSDL(Web服务描述语言)文件中暴露敏感信息或内部实现细节。

**触发条件**:
- WSDL文件暴露内部服务端点URL
- 描述中包含内部系统信息
- WSDL文件包含调试信息或注释
- WSDL可被未授权用户访问
- WSDL暴露了未计划公开的服务接口

**分析方法**:
1. 识别所有WSDL文件和SOAP服务端点
2. 检查WSDL内容的敏感信息
3. 验证WSDL文件的访问控制
4. 检查WSDL是否暴露了内部服务结构

**典型漏洞模式**:
```xml
<!-- 危险: WSDL暴露内部端点 -->
<wsdl:service name="InternalService">
    <wsdl:port name="InternalServicePort" binding="tns:InternalServiceBinding">
        <soap:address location="http://internal-server:8080/service"/>
    </wsdl:port>
</wsdl:service>

<!-- 危险: WSDL包含敏感信息描述 -->
<wsdl:documentation>
    This service accesses internal database at 10.0.1.50
    with credentials: admin/admin123
</wsdl:documentation>

<!-- 安全: 使用生产端点 -->
<wsdl:service name="PublicService">
    <wsdl:port name="PublicServicePort" binding="tns:PublicServiceBinding">
        <soap:address location="https://api.example.com/service"/>
    </wsdl:port>
</wsdl:service>

<!-- 安全: 实施WSDL访问控制 -->
// 在web.xml中限制访问
<security-constraint>
    <web-resource-collection>
        <web-resource-name>WSDL</web-resource-name>
        <url-pattern>*.wsdl</url-pattern>
    </web-resource-collection>
    <auth-constraint>
        <role-name>developer</role-name>
    </auth-constraint>
</security-constraint>
```

**防护措施**:
- 对WSDL访问实施认证授权
- WSDL中使用生产环境端点而非内部地址
- 清理WSDL中的敏感描述和调试信息
- 定期审计公开的WSDL文档
- 考虑使用其他更安全的API描述格式(如OpenAPI)
- 生产环境禁用或限制WSDL访问

---

### CWD-1288 敏感信息在存储或传输前处理不当
敏感信息在存储或传输前未进行适当的加密、编码或脱敏处理。

**触发条件**:
- 密码以明文形式存储
- 敏感信息未加密传输(HTTP而非HTTPS)
- 敏感字段使用可逆编码而非加密
- 加密使用弱密钥或已弃用算法
- 信用卡号未按PCI-DSS要求存储

**分析方法**:
1. 识别所有敏感信息的存储和传输点
2. 检查存储是否使用加密或哈希
3. 验证传输是否使用TLS/SSL
4. 检查加密算法和密钥管理
5. 验证是否符合行业标准(如PCI-DSS)

**典型漏洞模式**:
```java
// 危险: 密码明文存储
public void saveUser(String username, String password) {
    db.execute("INSERT INTO users (username, password) VALUES (?, ?)",
        username, password);
}

// 危险: 明文传输敏感信息
httpClient.post("http://example.com/api/credit-card", cardInfo);

// 危险: 使用弱哈希算法
String hashedPassword = MD5.hash(password);

// 危险: ECB模式加密
 Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");

// 安全: 强哈希存储密码
public void saveUser(String username, String password) {
    String hashedPassword = BCrypt.hashpw(password, BCrypt.gensalt());
    db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)",
        username, hashedPassword);
}

// 安全: HTTPS传输敏感信息
httpsClient.post("https://example.com/api/credit-card", cardInfo);

// 安全: 使用强加密
 Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
// 安全: 按PCI-DSS规范处理信用卡号
String token = tokenizationService.tokenize(cardNumber);
db.execute("INSERT INTO payments (card_token, ...) VALUES (?, ?)", token, ...);
```

**防护措施**:
- 密码使用强哈希算法(BCrypt、Argon2、PBKDF2)存储
- 敏感信息使用强加密算法(AES-256)存储
- 传输时使用TLS 1.2+
- 遵循行业安全标准(GDPR、PCI-DSS、HIPAA)
- 实施密钥管理系统(KMS)
- 定期轮换加密密钥

---

### CWD-1289 敏感信息使用完毕后未清理
敏感信息在内存中保留超过必要时间,存在泄露风险。

**触发条件**:
- 密码字符数组使用后未清零
- 敏感缓冲区复用前未清理
- 临时文件包含敏感信息且未删除
- 调试转储包含敏感内存数据
- 分配的敏感内存未及时释放

**分析方法**:
1. 识别所有敏感信息的内存使用
2. 检查敏感数据使用后的清理操作
3. 验证临时文件的生命周期管理
4. 检查是否存在内存转储风险
5. 追踪敏感数据的释放和清理路径

**典型漏洞模式**:
```java
// 危险: String密码无法清理
public boolean login(String password) {
    boolean authenticated = checkPassword(password);
    // password字符串仍在内存中,GC前可被访问
    return authenticated;
}

// 危险: 数组使用后未清理
public void processCreditCard(String cardNumber) {
    // 处理逻辑
    cardInfo = cardNumber;
    // cardNumber仍在堆中,未清理
}

// 危险: 临时文件未删除
File tempFile = File.createTempFile("temp", ".dat");
writeSensitiveData(tempFile);
// 忘记删除tempFile

// 安全: 使用char[]并清理
public boolean login(char[] password) {
    boolean authenticated = checkPassword(password);
    char[] passwordCopy = password.clone();
    checkPassword(passwordCopy); // 使用副本
    Arrays.fill(password, '\0'); // 清理密码
    Arrays.fill(passwordCopy, '\0'); // 清理副本
    return authenticated;
}

// 安全: 使用后清理敏感数据
public void processCreditCard(String cardNumber) {
    try {
        // 处理逻辑
        char[] cardChars = cardNumber.toCharArray();
        ...
        Arrays.fill(cardChars, '\0'); // 清理
    } finally {
        cardNumber = null; // 帮助GC
    }
}

// 安全: 自动删除临时文件
File tempFile = File.createTempFile("temp", ".dat");
tempFile.deleteOnExit();
writeSensitiveData(tempFile);
```

**防护措施**:
- 使用char[]而非String存储密码,使用后清零
- 敏感数据不再使用时立即清理
- 临时文件设置deleteOnExit()或主动删除
- 避免敏感数据经过不必要的中间存储
- 使用安全字符串库自动清理
- 限制内存转储的生产环境

---

### CWD-1292 文件描述符泄露
文件描述符、Socket句柄等资源未正确关闭,可能导致信息泄露。

**触发条件**:
- 文件打开后未关闭
- Socket连接未及时关闭
- 临时文件描述符泄露
- 错误路径中资源未清理
- 异常导致资源未关闭

**分析方法**:
1. 识别所有文件和Socket操作
2. 追踪资源分配和释放的配对关系
3. 检查所有执行路径的资源清理
4. 验证异常处理中的资源释放
5. 检查是否有资源泄露监控

**典型漏洞模式**:
```java
// 危险: 文件未关闭
public void readFile(String path) {
    FileInputStream fis = new FileInputStream(path);
    byte[] data = new byte[1024];
    fis.read(data);
    // fis未关闭,文件描述符泄露
}

// 危险: 异常未处理导致资源泄露
public void readFile(String path) {
    FileInputStream fis = new FileInputStream(path);
    byte[] data = new byte[1024];
    fis.read(data);
    processData(data);
    fis.close(); // processData抛异常时不会执行
}

// 安全: 使用try-with-resources
public void readFile(String path) {
    try (FileInputStream fis = new FileInputStream(path)) {
        byte[] data = new byte[1024];
        fis.read(data);
        processData(data);
    } // 自动关闭
}

// 安全: finally中清理资源
public void readFile(String path) {
    FileInputStream fis = null;
    try {
        fis = new FileInputStream(path);
        byte[] data = new byte[1024];
        fis.read(data);
        processData(data);
    } finally {
        if (fis != null) {
            fis.close();
        }
    }
}
```

**防护措施**:
- 使用try-with-resources或RAII自动管理资源
- 在finally块中确保资源释放
- 实施资源泄露监控和告警
- 限制同时打开的文件描述符数量
- 定期审计代码中的资源管理

---

### CWD-1286 持久性Cookie中包含敏感信息
Cookie中存储了敏感信息且持久保存,增加信息泄露风险。

**触发条件**:
- Cookie包含密码或凭据信息
- Cookie包含会话令牌且未设置HttpOnly和Secure
- Cookie设置过长的过期时间
- Cookie未设置SameSite属性
- 多个敏感信息存储在同一个Cookie中

**分析方法**:
1. 识别所有Set-Cookie操作
2. 检查Cookie内容是否包含敏感信息
3. 验证Cookie的安全属性(HttpOnly, Secure, SameSite)
4. 检查Cookie的过期时间设置
5. 验证Cookie的域和路径设置

**典型漏洞模式**:
```java
// 危险: Cookie包含密码
Cookie cookie = new Cookie("user", username + ":" + password);
cookie.setMaxAge(86400); // 24小时
response.addCookie(cookie);

// 危险: 敏感Cookie未设置安全属性
Cookie sessionCookie = new Cookie("session", sessionId);
response.addCookie(cookie);

// 危险: 过长的过期时间
Cookie authCookie = new Cookie("auth", authToken);
authCookie.setMaxAge(31536000); // 1年
response.addCookie(authCookie);

// 安全: 仅存储会话ID,设置安全属性
Cookie sessionCookie = new Cookie("JSESSIONID", sessionId);
sessionCookie.setHttpOnly(true);
sessionCookie.setSecure(true);
sessionCookie.setSameSite(Cookie.SameSite.STRICT);
sessionCookie.setMaxAge(-1); // 会话Cookie
response.addCookie(sessionCookie);

// 安全: 使用短期令牌
Cookie authCookie = new Cookie("access_token", accessToken);
authCookie.setHttpOnly(true);
authCookie.setSecure(true);
authCookie.setSameSite(Cookie.SameSite.LAX);
authCookie.setMaxAge(3600); // 1小时
response.addCookie(authCookie);
```

**防护措施**:
- Cookie中仅存储会话标识符,不存储敏感信息
- 设置HttpOnly防止XSS访问Cookie
- 设置Secure确保Cookie仅通过HTTPS传输
- 设置SameSite防止CSRF攻击
- 设置合理的过期时间,避免永久Cookie
- 定期轮换会话令牌

---

## 代码分析视角

### 数据流分析
- **敏感源识别**: 识别所有敏感信息的产生位置
- **污点追踪**: 从敏感源追踪到所有可能的泄露点
- **汇聚点分析**: 识别日志、响应、文件、网络等输出汇聚点
- **清理验证**: 验证敏感数据在使用后是否被正确清理

### 生命周期分析
- **创建阶段**: 敏感信息如何产生和初始化
- **使用阶段**: 敏感信息如何在系统中流动和被处理
- **存储阶段**: 敏感信息如何被存储(内存、磁盘、数据库)
- **传输阶段**: 敏感信息如何在不同组件间传输
- **销毁阶段**: 敏感信息如何被清理和删除

### 安全控制分析
- **加密保护**: 验证存储和传输加密
- **脱敏处理**: 验证日志和响应脱敏
- **访问控制**: 验证敏感信息的访问权限
- **清理机制**: 验证资源释放和数据清理

---

## 典型触发条件

| 泄露类型 | 高频触发条件 |
|---------|-------------|
| 错误消息泄露 | 异常抛给用户、堆栈跟踪输出 |
| 调试代码泄露 | 硬编码密钥、注释中的凭证 |
| 序列化泄露 | 敏感字段未transient、自定义序列化缺失 |
| 缓存泄露 | Cache-Control未设置、Cookie不当配置 |
| 进程调用泄露 | 命令行参数包含敏感信息、环境变量泄露 |
| 日志泄露 | 直接记录用户输入、日志包含凭据 |
| 源代码泄露 | 硬编码连接字符串、配置文件未排除 |
| WSDL泄露 | 暴露内部端点、访问控制缺失 |
| 存储传递不当 | 密码明文存储、HTTP传输敏感数据 |
| 未清理敏感信息 | String密码未清理、临时文件未删除 |
| 文件描述符泄露 | 资源未关闭、异常处理缺失 |
| 持久性Cookie泄露 | Cookie包含凭据、安全属性缺失 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+泄露类型]

## 敏感信息与泄露点
- 敏感信息类型: [密码/密钥/个人信息等]
- 产生位置: [文件:行号] [函数名]
- 泄露点: [日志/响应/文件/进程等]
- 数据流路径: [详细的数据流追踪]

## 证据链与逻辑推理
1. 代码证据:具体代码行和敏感信息
2. 数据流追踪:从产生到泄露的完整路径
3. 漏洞描述:具体的信息泄露风险
4. 推理:为何导致信息泄露

## 真实触发条件
输入条件、数据流路径、可利用性评估

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 攻击者获取难度 |
| 信息敏感性 | 高/中/低 | 数据敏感程度 |
| 影响范围 | 高/中/低 | 账户接管/数据泄露/系统入侵 |
| 合规性影响 | 高/中/低 | GDPR/PCI-DSS等 |

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
- 使用环境变量或密钥管理系统的正确实现
- 配置文件已通过.gitignore排除
- 日志已实施脱敏过滤
- 敏感字段已标记为transient
- Cookie已设置HttpOnly和Secure属性
- 使用强哈希或强加密的正确实现
- 使用try-with-resources的资源管理
- 仅对可信内部系统的信息共享
- 脱敏后的示例或测试数据
- 合规的数据匿名化处理

---

## 敏感信息识别模式

### 常见敏感信息类型
- **凭证类**: password, passwd, pwd, secret, apiKey, accessToken, token, credential
- **连接信息**: connection_string, jdbc_url, mongo_uri, postgres_url
- **加密密钥**: private_key, public_key, signing_key, encryption_key, secret_key
- **个人信息**: ssn, credit_card, passport, bank_account, email, phone, address
- **配置信息**: config, setting, environment, db_host, db_user, db_pass
- **IP地址**: ip, hostname, server, endpoint, url

### 敏感信息位置
- 源代码中的字符串常量
- 配置文件(.properties, .yaml, .json, .ini)
- 环境变量
- 日志文件
- 数据库
- 版本控制历史

---

**文档版本**: v1.0 | **适用语言**: 多语言通用