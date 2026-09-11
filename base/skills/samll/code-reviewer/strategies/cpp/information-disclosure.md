# C++敏感信息泄露分析指导

## 能力目标

基于敏感信息生命周期和数据流分析，判断真实信息泄露风险，识别可达的泄露点，区分合法数据处理和恶意泄露。针对C++特性（如内存管理、指针、缓冲区、智能指针等）进行专项分析。

---

## 前置判断

获取:
- 敏感信息类型：密码/密钥/令牌/个人信息/配置信息/调试信息
- 数据存储位置：栈内存/堆内存/静态存储/临时文件/日志文件/配置文件
- 传输方式：HTTP/HTTPS/Socket/管道/命令行参数/环境变量
- 生命周期：分配/使用/传输/存储/清零/释放
- 访问控制：权限/加密/脱敏/审计日志
- 数据流路径：从分配到释放的完整传递链
- C++特性：原始指针/智能指针/引用/移动语义/拷贝构造/析构函数

---

## 分析流程

### Step 1 — 识别敏感信息产生点
定位敏感信息的生成和存储：
- 用户输入：密码、信用卡号、个人身份信息
- 配置信息：API密钥、数据库凭证、访问令牌
- 系统信息：文件路径、环境变量、内部IP地址
- 调试信息：堆栈跟踪、异常详情、内部状态
- 临时数据：栈缓冲区、堆分配、字符串对象、STL容器

### Step 2 — 追踪敏感信息数据流
- 正向追踪：从敏感信息产生到所有可能的输出位置
- 反向追踪：从日志/错误信息/响应回溯数据来源
- 跨边界追踪：识别跨进程、跨网络、跨模块的数据传递
- 转换点追踪：记录数据格式转换、编码、解码节点
- 内存追踪：追踪指针传递、拷贝构造、移动语义
- 析构追踪：验证析构函数是否正确清理敏感数据

### Step 3 — 验证防护机制
- 加密保护：传输加密(SSL/TLS)、存储加密
- 脱敏处理：日志脱敏、响应脱敏、显示脱敏
- 访问控制：权限验证、最小权限原则
- 清理机制：内存清零(memset/SecureZeroMemory)、智能指针自定义删除器
- 安全配置：不回显密码、隐藏敏感配置
- RAII保证：使用RAII确保资源清理

### Step 4 — 判断真实泄露风险
- 可达性：泄露点是否可被外部访问
- 暴露范围：泄露数据的完整性和敏感性
- 可利用性：攻击者能否获取泄露信息
- 影响评估：泄露后的潜在危害
- 内存残留：数据是否在内存中长期残留

---

## 风险模式分类

### CWD-1275 错误消息中包含敏感信息
应用程序在错误消息中暴露敏感信息，如调试信息、内部路径、异常详情等。

**触发条件**：
- 异常堆栈跟踪直接输出到标准输出/标准错误
- 错误消息包含文件路径、行号或系统信息
- 数据库错误消息暴露连接字符串、表结构
- 系统错误消息包含内部IP、版本号
- 错误处理未区分内外部环境
- C++异常对象包含敏感信息并被序列化

**分析方法**：
1. 识别所有异常处理和错误响应位置
2. 检查异常信息是否直接输出到用户
3. 验证是否有错误消息脱敏机制
4. 区分开发和生产环境的错误处理逻辑
5. 检查std::exception派生类中的敏感信息

**典型漏洞模式**：
```cpp
// 危险：直接暴露异常详情
try {
    database.connect(connectionString);
} catch (const std::exception& e) {
    // 可能暴露：Connection failed: mysql://admin:password123@db.internal:3306/mydb
    std::cout << "Error: " << e.what() << std::endl;
    // 危险：输出完整调用栈
    std::cerr << "Stack trace: " << boost::stacktrace::stacktrace() << std::endl;
}

// 危险：文件系统错误暴露内部路径
try {
    std::ifstream file("/var/secrets/api_keys.txt");
    if (!file) {
        throw std::runtime_error("Failed to open /var/secrets/api_keys.txt");
    }
} catch (const std::exception& e) {
    // 暴露内部文件路径
    sendErrorResponse(e.what());
}

// 危险：数据库异常暴露详细信息
try {
    executeSql("SELECT * FROM users WHERE password = '" + userInput + "'");
} catch (const pqxx::sql_error& e) {
    // 可能暴露：syntax error at or near "'" in query: SELECT * FROM users WHERE password = ''OR'1'='1'
    logError(e.what());
    std::cout << "Database error: " << e.what() << std::endl;
}

// 安全：统一错误处理，仅记录到日志
try {
    database.connect(connectionString);
} catch (const std::exception& e) {
    // 详细信息记录到安全日志
    logger.error("Database connection failed", e);
    // 用户仅看到通用消息
    std::cout << "Service temporarily unavailable. Please try again later." << std::endl;
}

// 安全：分层错误处理
class SecureException : public std::exception {
private:
    std::string internalMsg;  // 详细信息，仅用于日志
    std::string publicMsg;    // 用户可见消息
public:
    SecureException(const std::string& internal, const std::string& public_)
        : internalMsg(internal), publicMsg(public_) {}
    
    const char* what() const noexcept override { return publicMsg.c_str(); }
    const std::string& getInternalMessage() const { return internalMsg; }
};

try {
    connectToDatabase();
} catch (const SecureException& e) {
    logger.error(e.getInternalMessage());  // 记录详细信息
    std::cout << e.what() << std::endl;     // 仅显示通用消息
}
```

**防护措施**：
- 实现统一的异常处理机制，不向用户暴露内部信息
- 生产环境禁用详细错误输出，记录到服务器日志
- 使用通用错误消息，具体信息仅记录到安全日志
- 对错误信息进行分类，区分用户错误和系统错误
- 自定义异常类分离内部信息和公开信息
- 禁止在生产环境输出stacktrace

---

### CWD-1276 调试代码中插入敏感信息
调试或测试代码中硬编码敏感信息，导致信息泄露。

**触发条件**：
- 源代码中硬编码密码、密钥、令牌
- 注释中包含敏感信息
- 调试输出（std::cout/std::cerr/printf）包含敏感数据
- 测试数据使用真实凭证
- 提交到版本控制的配置文件包含密钥
- 预处理器宏定义包含敏感信息

**分析方法**：
1. 搜索常见敏感信息关键词：password、secret、token、key、api_key
2. 检查代码中的字符串常量和宏定义
3. 验证是否有调试代码（#ifdef DEBUG）未清理
4. 检查配置文件和测试文件
5. 搜索std::cout、printf、LOG等调试输出

**典型漏洞模式**：
```cpp
// 危险：硬编码密码
const char* DB_PASSWORD = "admin123";
const std::string API_KEY = "sk-1234567890abcdef";

// 危险：宏定义中的敏感信息
#define SECRET_KEY "my_secret_key_12345"
#define DB_CONN_STRING "postgresql://admin:password@localhost/mydb"

// 危险：注释中的敏感信息
// TODO: Remove this key before release - prod key: sk-9876543210fedcba
// Default password for testing: admin/Admin123!

// 危险：调试输出包含敏感信息
void login(const std::string& username, const std::string& password) {
    std::cout << "Login attempt: " << username << " / " << password << std::endl;
    #ifdef DEBUG
    std::cerr << "API Token: " << getApiToken() << std::endl;
    #endif
    // 连接数据库逻辑
}

// 危险：字符串字面量数组
const char* credentials[] = {
    "admin",
    "password123",
    "api_key_xyz"
};

// 危险：constexpr中的敏感信息
constexpr const char* MASTER_KEY = "0123456789ABCDEF";

// 安全：使用环境变量
std::string getDbPassword() {
    const char* password = std::getenv("DB_PASSWORD");
    if (!password) {
        throw std::runtime_error("DB_PASSWORD environment variable not set");
    }
    return std::string(password);
}

// 安全：使用配置文件（不提交到版本控制）
class SecureConfig {
    std::map<std::string, std::string> secrets;
public:
    void loadFromFile(const std::string& filepath) {
        std::ifstream file(filepath);
        // 解析配置文件（添加到.gitignore）
    }
    std::string get(const std::string& key) const {
        auto it = secrets.find(key);
        if (it != secrets.end()) return it->second;
        throw std::runtime_error("Secret not found: " + key);
    }
};

// 安全：使用密钥管理系统
class KeyVault {
public:
    static std::string getSecret(const std::string& secretName) {
        // 从外部密钥管理系统获取
        // 例如：AWS Secrets Manager, HashiCorp Vault
        return fetchFromVault(secretName);
    }
};

// 安全：条件编译仅用于开发环境
#ifdef PRODUCTION
    #define DEBUG_LOG(msg)  // 空操作
#else
    #define DEBUG_LOG(msg) std::cout << "[DEBUG] " << msg << std::endl
#endif
```

**防护措施**：
- 使用环境变量、配置文件或密钥管理系统存储敏感信息
- 使用.gitignore排除包含敏感信息的文件
- 实施提交前钩子检查敏感信息
- 使用秘密扫描工具检测代码中的敏感信息
- 使用占位符或示例数据替代真实凭证
- 编译时通过宏区分开发和生产环境
- 禁止在生产构建中包含调试输出

---

### CWD-1280 日志中包含敏感信息
日志文件中记录了敏感信息，导致信息泄露。

**触发条件**：
- 日志直接记录用户输入而未过滤
- 日志记录请求参数（如password字段）
- 日志包含完整的请求/响应数据
- 日志记录内部系统信息、凭据、令牌
- 日志文件权限过宽，可被未授权访问
- 使用std::cout/std::cerr输出敏感信息

**分析方法**：
1. 识别所有日志记录调用（LOG、std::cout、spdlog等）
2. 检查日志内容是否包含用户输入或内部数据
3. 验证日志文件的访问权限
4. 检查日志传输和存储是否加密
5. 追踪流式输出操作符重载

**典型漏洞模式**：
```cpp
// 危险：直接记录所有请求数据
void handleRequest(const HttpRequest& req) {
    logger.info("Received request: " + req.toString());
    // toString()可能包含password字段
}

// 危险：记录密码字段
void authenticateUser(const std::string& username, const std::string& password) {
    std::cout << "User login: " << username << ", password: " << password << std::endl;
    // 密码明文记录
}

// 危险：记录认证令牌
void processRequest(const std::string& authToken) {
    LOG(INFO) << "Processing request with token: " << authToken;
}

// 危险：异常日志包含敏感信息
try {
    db.connect("postgresql://user:pass@host/db");
} catch (const std::exception& e) {
    // 可能暴露连接字符串
    logger.error("Database error: " + std::string(e.what()));
}

// 危险：调试日志未移除
#ifdef DEBUG
    std::cerr << "Credit card: " << creditCardNumber << std::endl;
#endif

// 危险：重载操作符暴露敏感信息
struct User {
    std::string username;
    std::string password;
    
    friend std::ostream& operator<<(std::ostream& os, const User& u) {
        os << "User{username=" << u.username << ", password=" << u.password << "}";
        return os;  // 密码会被输出
    }
};

// 安全：实施日志脱敏
class SensitiveDataFilter {
public:
    static std::string sanitize(const std::string& data) {
        std::string result = data;
        // 移除或脱敏敏感字段
        result = std::regex_replace(result, std::regex("password=\\w+"), "password=***");
        result = std::regex_replace(result, std::regex("token=\\S+"), "token=***");
        result = std::regex_replace(result, std::regex("\\d{16}"), "****-****-****-****");
        return result;
    }
};

void handleRequest(const HttpRequest& req) {
    logger.info("Request: " + SensitiveDataFilter::sanitize(req.toString()));
}

// 安全：仅记录必要字段
void authenticateUser(const std::string& username, const std::string& password) {
    logger.info("User login attempt: " + username);
    // 不记录password
}

// 安全：使用白名单记录
class SafeLogger {
    std::set<std::string> allowedFields{"username", "action", "timestamp", "status"};
public:
    void logRequest(const std::map<std::string, std::string>& params) {
        std::ostringstream oss;
        for (const auto& [key, value] : params) {
            if (allowedFields.count(key)) {
                oss << key << "=" << value << " ";
            }
        }
        logger.info(oss.str());
    }
};

// 安全：重载操作符时排除敏感字段
struct User {
    std::string username;
    std::string password;  // 不输出
    
    friend std::ostream& operator<<(std::ostream& os, const User& u) {
        os << "User{username=" << u.username << "}";
        return os;  // 仅输出非敏感字段
    }
};

// 安全：使用RAII确保临时日志文件清理
class SecureLogFile {
    std::ofstream file;
    std::string filepath;
public:
    SecureLogFile(const std::string& path) : filepath(path) {
        file.open(path, std::ios::out | std::ios::app);
        // 设置文件权限为仅所有者可读写
        #ifndef _WIN32
        chmod(path.c_str(), S_IRUSR | S_IWUSR);
        #endif
    }
    
    ~SecureLogFile() {
        file.close();
        // 可选：清理敏感日志文件
        // std::remove(filepath.c_str());
    }
    
    template<typename T>
    SecureLogFile& operator<<(const T& data) {
        file << data;
        return *this;
    }
};
```

**防护措施**：
- 实施日志脱敏策略，过滤敏感字段
- 使用白名单而非黑名单记录字段
- 设置适当的日志文件权限，限制访问（chmod 600）
- 定期轮转和清理日志文件
- 对敏感系统禁用详细日志，仅记录必要信息
- 使用结构化日志格式便于过滤和审查
- 生产环境禁用调试日志

---

### CWD-1281 在源代码中包含敏感信息
源代码文件中硬编码或注释中包含敏感信息。

**触发条件**：
- 源代码中硬编码数据库连接字符串
- 配置头文件中包含API密钥或访问令牌
- 注释中包含测试凭证或内部信息
- SQL语句中硬编码敏感数据
- 静态常量中包含密钥或令牌

**分析方法**：
1. 扫描源代码中的字符串常量
2. 检查头文件和配置文件中的敏感字段
3. 搜索常见敏感信息模式：密码、密钥、令牌、凭证
4. 验证是否有开发或测试环境的配置被提交
5. 检查constexpr、const、#define中的敏感信息

**典型漏洞模式**：
```cpp
// 危险：硬编码数据库连接字符串
const std::string DB_CONN_STRING = 
    "postgresql://admin:secretpass@db.internal.com:5432/production";

// 危险：头文件中硬编码API密钥
// config.h
#ifndef CONFIG_H
#define CONFIG_H
const char* API_KEY = "sk-1234567890abcdefghijklmnop";
const char* SECRET_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
#endif

// 危险：注释中的敏感信息
// Production credentials:
// Username: admin
// Password: P@ssw0rd123!
// API Key: live_sk_9876543210

// 危险：constexpr中的加密密钥
constexpr uint8_t AES_KEY[32] = {
    0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
    0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c,
    // ... 真实的密钥字节
};

// 危险：命名空间中的敏感常量
namespace secrets {
    const std::string STRIPE_SECRET = "sk_live_abcdef123456";
    const std::string AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
    const std::string AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
}

// 危险：静态成员变量
class DatabaseConfig {
public:
    static constexpr const char* DB_USER = "admin";
    static constexpr const char* DB_PASS = "admin123";
};

// 安全：使用环境变量
std::string getConnectionString() {
    std::ostringstream oss;
    oss << "postgresql://"
        << std::getenv("DB_USER") << ":"
        << std::getenv("DB_PASS") << "@"
        << std::getenv("DB_HOST") << ":"
        << std::getenv("DB_PORT") << "/"
        << std::getenv("DB_NAME");
    return oss.str();
}

// 安全：使用配置文件（排除版本控制）
// config.example.h - 提交到版本控制
#ifndef CONFIG_H
#define CONFIG_H
// Set these environment variables or create config.h from this template
// #define API_KEY "your_api_key_here"
// #define SECRET_TOKEN "your_secret_token_here"
#endif

// config.h - 添加到.gitignore
#ifndef CONFIG_H
#define CONFIG_H
#define API_KEY "actual_key_value"  // 实际值，不提交
#define SECRET_TOKEN "actual_token"
#endif

// 安全：使用配置类从外部加载
class ConfigLoader {
    std::map<std::string, std::string> config;
public:
    void loadFromFile(const std::string& filename) {
        std::ifstream file(filename);
        std::string line;
        while (std::getline(file, line)) {
            auto pos = line.find('=');
            if (pos != std::string::npos) {
                std::string key = line.substr(0, pos);
                std::string value = line.substr(pos + 1);
                config[key] = value;
            }
        }
    }
    
    std::string get(const std::string& key) const {
        auto it = config.find(key);
        if (it != config.end()) return it->second;
        throw std::runtime_error("Config key not found: " + key);
    }
};

// 安全：使用密钥派生函数（KDF）
class SecureKeyManager {
public:
    // 从主密码派生密钥，主密码从环境变量获取
    static std::vector<uint8_t> deriveKey(const std::string& purpose) {
        const char* masterPassword = std::getenv("MASTER_PASSWORD");
        if (!masterPassword) {
            throw std::runtime_error("MASTER_PASSWORD not set");
        }
        // 使用PBKDF2、scrypt或Argon2派生密钥
        return pbkdf2(masterPassword, purpose, 100000);
    }
};
```

**防护措施**：
- 使用环境变量或配置管理系统存储敏感信息
- 提供示例配置文件（.example），排除实际配置
- 使用.gitignore排除敏感文件
- 实施预提交检查，阻止敏感信息提交
- 使用秘密管理服务（如AWS Secrets Manager、HashiCorp Vault）
- 定期轮换密钥和令牌
- 使用密钥派生函数而非硬编码密钥

---

### CWD-1288 敏感信息在存储或传输前处理不当
敏感信息在存储或传输前未进行适当的加密、编码或脱敏处理。

**触发条件**：
- 密码以明文形式存储
- 敏感信息未加密传输（HTTP而非HTTPS）
- 敏感字段使用可逆编码（Base64）而非加密
- 加密使用弱密钥或已弃用算法（DES、MD5）
- 信用卡号未按PCI-DSS要求存储
- 使用ECB模式加密

**分析方法**：
1. 识别所有敏感信息的存储和传输点
2. 检查存储是否使用加密或哈希
3. 验证传输是否使用TLS/SSL
4. 检查加密算法和密钥管理
5. 验证是否符合行业标准（如PCI-DSS）
6. 检查是否使用安全的随机数生成器

**典型漏洞模式**：
```cpp
// 危险：密码明文存储
void saveUser(const std::string& username, const std::string& password) {
    std::ofstream file("users.txt", std::ios::app);
    file << username << ":" << password << std::endl;
    // 密码明文存储
}

// 危险：使用弱哈希算法（MD5）
std::string hashPassword(const std::string& password) {
    unsigned char digest[MD5_DIGEST_LENGTH];
    MD5(reinterpret_cast<const unsigned char*>(password.c_str()), 
        password.length(), digest);
    // MD5已被破解，不安全
    return toHexString(digest, MD5_DIGEST_LENGTH);
}

// 危险：使用Base64编码而非加密
std::string "encryptPassword"(const std::string& password) {
    return base64_encode(password);  // Base64是编码，不是加密！
}

// 危险：ECB模式加密（不安全）
std::vector<uint8_t> encryptData(const std::vector<uint8_t>& data, 
                                  const uint8_t* key) {
    AES_KEY aesKey;
    AES_set_encrypt_key(key, 128, &aesKey);
    
    std::vector<uint8_t> encrypted(data.size());
    // ECB模式：相同明文产生相同密文，不安全
    for (size_t i = 0; i < data.size(); i += AES_BLOCK_SIZE) {
        AES_encrypt(&data[i], &encrypted[i], &aesKey);
    }
    return encrypted;
}

// 危险：使用弱随机数生成器
int generateSessionId() {
    srand(time(nullptr));  // 不安全的随机数生成器
    return rand();
}

// 危险：明文传输敏感信息
void sendCreditCard(const std::string& cardNumber) {
    // 通过HTTP发送
    httpClient.post("http://api.example.com/payment", cardNumber);
}

// 安全：使用强哈希算法（bcrypt）存储密码
#include <bcrypt/BCrypt.hpp>

void saveUser(const std::string& username, const std::string& password) {
    // 使用bcrypt哈希密码
    std::string hashedPassword = BCrypt::generateHash(password);
    
    std::ofstream file("users.txt", std::ios::app);
    file << username << ":" << hashedPassword << std::endl;
}

bool verifyPassword(const std::string& password, 
                   const std::string& hashedPassword) {
    return BCrypt::validatePassword(password, hashedPassword);
}

// 安全：使用AES-GCM模式加密
#include <openssl/evp.h>

std::vector<uint8_t> encryptAES_GCM(const std::vector<uint8_t>& plaintext,
                                     const uint8_t* key,
                                     const uint8_t* iv) {
    EVP_CIPHER_CTX* ctx = EVP_CIPHER_CTX_new();
    std::vector<uint8_t> ciphertext(plaintext.size() + EVP_MAX_BLOCK_LENGTH);
    std::vector<uint8_t> tag(16);
    
    int len, ciphertext_len;
    
    // 初始化加密操作（AES-256-GCM）
    EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, key, iv);
    
    // 加密数据
    EVP_EncryptUpdate(ctx, ciphertext.data(), &len, 
                     plaintext.data(), plaintext.size());
    ciphertext_len = len;
    
    // 完成加密
    EVP_EncryptFinal_ex(ctx, ciphertext.data() + len, &len);
    ciphertext_len += len;
    
    // 获取认证标签
    EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag.data());
    
    EVP_CIPHER_CTX_free(ctx);
    
    ciphertext.resize(ciphertext_len);
    // 附加认证标签
    ciphertext.insert(ciphertext.end(), tag.begin(), tag.end());
    
    return ciphertext;
}

// 安全：使用加密随机数生成器
#include <random>

std::string generateSecureSessionId() {
    std::random_device rd;
    std::mt19937_64 gen(rd());
    std::uniform_int_distribution<uint64_t> dis;
    
    uint64_t sessionId = dis(gen);
    return std::to_string(sessionId);
}

// 更安全：使用加密库的随机数生成
std::vector<uint8_t> generateSecureRandom(size_t length) {
    std::vector<uint8_t> buffer(length);
    if (RAND_bytes(buffer.data(), length) != 1) {
        throw std::runtime_error("Failed to generate secure random");
    }
    return buffer;
}

// 安全：HTTPS传输敏感信息
void sendCreditCard(const std::string& cardNumber) {
    // 使用HTTPS和证书验证
    httpsClient.setVerifyPeer(true);
    httpsClient.setCACertPath("/etc/ssl/certs/ca-bundle.crt");
    httpsClient.post("https://api.example.com/payment", cardNumber);
}

// 安全：令牌化信用卡号
class PaymentTokenizer {
public:
    std::string tokenize(const std::string& cardNumber) {
        // 将卡号发送到令牌化服务
        // 返回不可逆的令牌
        std::string token = tokenizationService.createToken(cardNumber);
        
        // 存储令牌而非实际卡号
        database.execute("INSERT INTO payments (card_token) VALUES (?)", token);
        
        return token;
    }
};
```

**防护措施**：
- 密码使用强哈希算法（BCrypt、Argon2、scrypt）存储
- 敏感信息使用强加密算法（AES-256-GCM）存储
- 传输时使用TLS 1.2+
- 遵循行业安全标准（GDPR、PCI-DSS、HIPAA）
- 实施密钥管理系统（KMS）
- 定期轮换加密密钥
- 使用加密随机数生成器
- 避免使用ECB模式，优先使用GCM或CBC模式

---

### CWD-1289 敏感信息使用完毕后未清理
敏感信息在内存中保留超过必要时间，存在泄露风险。这是C++特有的高风险问题。

**触发条件**：
- 密码字符串使用后未清零
- 敏感缓冲区复用前未清理
- 临时文件包含敏感信息且未删除
- 核心转储（core dump）包含敏感内存数据
- 分配的敏感内存未及时释放和清零
- std::string析构不保证清零
- 编译器优化可能移除memset清零操作

**分析方法**：
1. 识别所有敏感信息的内存使用
2. 检查敏感数据使用后的清理操作
3. 验证临时文件的生命周期管理
4. 检查是否存在内存转储风险
5. 追踪敏感数据的释放和清理路径
6. 验证memset/SecureZeroMemory是否被编译器优化移除

**典型漏洞模式**：
```cpp
// 危险：std::string密码无法安全清理
void authenticate(const std::string& password) {
    bool authenticated = checkPassword(password);
    // password字符串析构时，数据可能仍在堆中
    // 且std::string不保证清零内存
}

// 危险：字符数组使用后未清零
void processPassword(const char* password) {
    char buffer[256];
    strcpy(buffer, password);
    
    // 处理密码...
    authenticate(buffer);
    
    // buffer未清零，栈上仍有密码残留
}

// 危险：动态分配未清零
void processCreditCard(const std::string& cardNumber) {
    char* card = new char[cardNumber.size() + 1];
    strcpy(card, cardNumber.c_str());
    
    // 处理信用卡号...
    
    delete[] card;  // 内存释放但未清零
}

// 危险：memset可能被编译器优化移除
void insecureClear(char* buffer, size_t size) {
    // 处理敏感数据...
    
    memset(buffer, 0, size);  // 编译器可能优化移除此行
    // 因为之后buffer没有被读取
}

// 危险：临时文件未删除
void processSensitiveData(const std::string& data) {
    std::ofstream tmpFile("/tmp/sensitive_data.txt");
    tmpFile << data;
    tmpFile.close();
    // 临时文件未删除，敏感信息残留
}

// 危险：core dump包含敏感信息
void handleCrash() {
    char apiKey[128];
    loadApiKey(apiKey);
    
    // 程序崩溃时，apiKey会在core dump中
}

// 安全：使用SecureString类自动清理
class SecureString {
private:
    char* data;
    size_t length;
    
public:
    SecureString(const std::string& str) {
        length = str.length();
        data = new char[length + 1];
        memcpy(data, str.c_str(), length + 1);
    }
    
    ~SecureString() {
        // 显式清零内存
        #ifdef _WIN32
        SecureZeroMemory(data, length);
        #else
        explicit_bzero(data, length);  // 不会被优化移除
        #endif
        delete[] data;
    }
    
    // 禁止拷贝
    SecureString(const SecureString&) = delete;
    SecureString& operator=(const SecureString&) = delete;
    
    const char* c_str() const { return data; }
    size_t size() const { return length; }
};

// 安全：使用RAII和explicit_bzero
void authenticate(const std::string& password) {
    SecureString securePass(password);
    bool authenticated = checkPassword(securePass.c_str());
    // securePass析构时自动清零
}

// 安全：手动清零栈缓冲区
void processPassword(const char* password) {
    char buffer[256];
    strcpy(buffer, password);
    
    // 处理密码...
    authenticate(buffer);
    
    // 显式清零（不会被优化移除）
    #ifdef _WIN32
    SecureZeroMemory(buffer, sizeof(buffer));
    #else
    explicit_bzero(buffer, sizeof(buffer));
    #endif
}

// 安全：使用智能指针和自定义删除器
void processCreditCard(const std::string& cardNumber) {
    auto deleter = [](char* p) {
        if (p) {
            size_t len = strlen(p);
            explicit_bzero(p, len);
            delete[] p;
        }
    };
    
    std::unique_ptr<char[], decltype(deleter)> card(
        new char[cardNumber.size() + 1], deleter);
    strcpy(card.get(), cardNumber.c_str());
    
    // 处理信用卡号...
    
    // card析构时自动清零并释放
}

// 安全：使用volatile防止优化
void secureClear(volatile char* buffer, size_t size) {
    volatile char* p = buffer;
    while (size--) {
        *p++ = 0;
    }
}

// 或使用C11的memset_s（如果可用）
void secureClearC11(char* buffer, size_t size) {
    #ifdef __STDC_LIB_EXT1__
    memset_s(buffer, size, 0, size);
    #else
    explicit_bzero(buffer, size);
    #endif
}

// 安全：RAII自动删除临时文件
class SecureTempFile {
    std::string filepath;
    std::ofstream file;
public:
    SecureTempFile(const std::string& path) : filepath(path) {
        file.open(path, std::ios::binary | std::ios::out);
        // 设置文件权限
        #ifndef _WIN32
        chmod(path.c_str(), S_IRUSR | S_IWUSR);
        #endif
    }
    
    ~SecureTempFile() {
        file.close();
        // 覆写文件内容后删除
        overwriteFile(filepath);
        std::remove(filepath.c_str());
    }
    
    std::ofstream& get() { return file; }
    
private:
    void overwriteFile(const std::string& path) {
        std::ofstream f(path, std::ios::binary | std::ios::out);
        f.seekp(0, std::ios::end);
        size_t fileSize = f.tellp();
        f.seekp(0);
        
        std::vector<char> zeros(fileSize, 0);
        f.write(zeros.data(), fileSize);
    }
};

// 安全：禁用core dump
void disableCoreDump() {
    #ifndef _WIN32
    struct rlimit rl;
    rl.rlim_cur = 0;
    rl.rlim_max = 0;
    setrlimit(RLIMIT_CORE, &rl);
    #endif
}

// 安全：使用mlock防止敏感内存被交换到磁盘
class SecureMemory {
    void* ptr;
    size_t size;
public:
    SecureMemory(size_t s) : size(s) {
        ptr = malloc(size);
        if (!ptr) throw std::bad_alloc();
        
        #ifndef _WIN32
        // 锁定内存，防止交换到磁盘
        if (mlock(ptr, size) != 0) {
            free(ptr);
            throw std::runtime_error("Failed to lock memory");
        }
        #else
        VirtualLock(ptr, size);
        #endif
    }
    
    ~SecureMemory() {
        // 清零内存
        explicit_bzero(ptr, size);
        
        #ifndef _WIN32
        munlock(ptr, size);
        #else
        VirtualUnlock(ptr, size);
        #endif
        
        free(ptr);
    }
    
    void* get() { return ptr; }
};
```

**防护措施**：
- 使用SecureString或自定义RAII类管理敏感数据
- 使用explicit_bzero/SecureZeroMemory而非memset清零
- 使用智能指针配合自定义删除器自动清零
- 敏感数据不再使用时立即清理
- 临时文件使用RAII自动删除
- 使用mlock防止敏感内存被交换到磁盘
- 禁用核心转储或加密核心转储
- 避免使用std::string存储密码，使用char[]或SecureString
- 使用volatile或编译器特定函数防止优化移除清零操作

---

### CWD-1292 文件描述符和资源泄露
文件描述符、Socket句柄等资源未正确关闭，可能导致信息泄露。

**触发条件**：
- 文件打开后未关闭
- Socket连接未及时关闭
- 临时文件描述符泄露
- 错误路径中资源未清理
- 异常导致资源未关闭
- 未使用RAII管理资源

**分析方法**：
1. 识别所有文件和Socket操作
2. 追踪资源分配和释放的配对关系
3. 检查所有执行路径的资源清理
4. 验证异常处理中的资源释放
5. 检查是否有资源泄露监控
6. 验证是否使用RAII模式

**典型漏洞模式**：
```cpp
// 危险：文件未关闭
void readSensitiveFile(const char* path) {
    FILE* file = fopen(path, "r");
    char buffer[1024];
    fread(buffer, 1, sizeof(buffer), file);
    
    processData(buffer);
    // file未关闭，文件描述符泄露
}

// 危险：异常导致资源泄露
void processFile(const std::string& path) {
    std::ifstream file(path);
    std::string data;
    file >> data;
    
    parseData(data);  // 可能抛出异常
    
    file.close();  // 异常时不会执行
}

// 危险：Socket未关闭
void sendData(const std::string& data) {
    int sock = socket(AF_INET, SOCK_STREAM, 0);
    connect(sock, ...);
    send(sock, data.c_str(), data.length(), 0);
    // sock未关闭
}

// 危险：早期返回导致资源泄露
void authenticateUser(const std::string& username, const std::string& password) {
    FILE* credFile = fopen("/etc/credentials", "r");
    
    char storedUser[256], storedPass[256];
    fscanf(credFile, "%s %s", storedUser, storedPass);
    
    if (strcmp(username.c_str(), storedUser) != 0) {
        return;  // credFile未关闭
    }
    
    // 验证密码...
    fclose(credFile);
}

// 危险：条件分支导致资源泄露
void processRequest(bool condition) {
    int* buffer = new int[1024];
    
    if (condition) {
        // 处理逻辑...
        return;  // buffer未释放
    }
    
    delete[] buffer;
}

// 安全：使用RAII（std::ifstream自动关闭）
void readSensitiveFile(const std::string& path) {
    std::ifstream file(path);
    if (!file) {
        throw std::runtime_error("Failed to open file");
    }
    
    std::string data;
    std::getline(file, data);
    
    processData(data);
    // file析构时自动关闭
}

// 安全：使用unique_ptr管理FILE*
struct FileCloser {
    void operator()(FILE* f) const {
        if (f) fclose(f);
    }
};

void readFile(const char* path) {
    std::unique_ptr<FILE, FileCloser> file(fopen(path, "r"));
    if (!file) {
        throw std::runtime_error("Failed to open file");
    }
    
    char buffer[1024];
    fread(buffer, 1, sizeof(buffer), file.get());
    
    processData(buffer);
    // file自动关闭
}

// 安全：Socket RAII包装
class Socket {
    int fd;
public:
    Socket(int domain, int type, int protocol) {
        fd = socket(domain, type, protocol);
        if (fd < 0) {
            throw std::runtime_error("Failed to create socket");
        }
    }
    
    ~Socket() {
        if (fd >= 0) {
            close(fd);
        }
    }
    
    // 禁止拷贝
    Socket(const Socket&) = delete;
    Socket& operator=(const Socket&) = delete;
    
    // 支持移动
    Socket(Socket&& other) noexcept : fd(other.fd) {
        other.fd = -1;
    }
    
    int get() const { return fd; }
};

void sendData(const std::string& data) {
    Socket sock(AF_INET, SOCK_STREAM, 0);
    
    // 连接和发送...
    connect(sock.get(), ...);
    send(sock.get(), data.c_str(), data.length(), 0);
    
    // sock析构时自动关闭
}

// 安全：使用shared_ptr管理动态内存
void processRequest(bool condition) {
    auto buffer = std::make_unique<int[]>(1024);
    
    if (condition) {
        // 处理逻辑...
        return;  // buffer自动释放
    }
    
    // buffer自动释放
}

// 安全：使用std::vector代替原始数组
void processData() {
    std::vector<int> buffer(1024);
    
    // 使用buffer...
    
    // 自动管理内存
}

// 安全：复杂资源使用RAII类
class DatabaseConnection {
    void* conn;
public:
    DatabaseConnection(const std::string& connString) {
        conn = connectToDatabase(connString);
        if (!conn) {
            throw std::runtime_error("Failed to connect");
        }
    }
    
    ~DatabaseConnection() {
        if (conn) {
            disconnectDatabase(conn);
            clearSensitiveData();
        }
    }
    
    void execute(const std::string& query) {
        executeQuery(conn, query);
    }
    
private:
    void clearSensitiveData() {
        // 清理连接中的敏感信息
    }
};
```

**防护措施**：
- 始终使用RAII管理资源（文件、Socket、内存）
- 使用std::ifstream/ofstream代替FILE*
- 使用std::unique_ptr/shared_ptr管理动态内存
- 使用std::vector代替原始数组
- 为非标准资源创建RAII包装类
- 实施资源泄露检测工具（Valgrind、AddressSanitizer）
- 限制同时打开的文件描述符数量
- 定期审计代码中的资源管理

---

### CWD-1286 持久性Cookie中包含敏感信息
（此部分与Web应用相关，C++后端需注意）

**触发条件**：
- HTTP响应头中Set-Cookie包含密码或凭据
- Cookie包含会话令牌且未设置HttpOnly和Secure
- Cookie设置过长的过期时间
- Cookie未设置SameSite属性

**典型漏洞模式**：
```cpp
// 危险：Cookie包含敏感信息
void setCookie(HttpResponse& response, const std::string& username, 
               const std::string& password) {
    std::ostringstream cookie;
    cookie << "Set-Cookie: user=" << username << ":" << password 
           << "; Max-Age=86400";
    response.addHeader(cookie.str());
}

// 危险：Cookie未设置安全属性
void setSessionCookie(HttpResponse& response, const std::string& sessionId) {
    response.addHeader("Set-Cookie: SESSIONID=" + sessionId);
    // 缺少HttpOnly, Secure, SameSite
}

// 安全：仅存储会话ID，设置安全属性
void setSecureCookie(HttpResponse& response, const std::string& sessionId) {
    std::ostringstream cookie;
    cookie << "Set-Cookie: SESSIONID=" << sessionId 
           << "; HttpOnly; Secure; SameSite=Strict; Max-Age=3600; Path=/";
    response.addHeader(cookie.str());
}
```

**防护措施**：
- Cookie中仅存储会话标识符，不存储敏感信息
- 设置HttpOnly防止XSS访问Cookie
- 设置Secure确保Cookie仅通过HTTPS传输
- 设置SameSite防止CSRF攻击
- 设置合理的过期时间，避免永久Cookie
- 定期轮换会话令牌

---

### CWD-1279 通过进程调用暴露敏感信息
调用外部进程时，敏感信息通过命令行参数或环境变量泄露。

**触发条件**：
- 密码通过命令行参数传递
- 敏感信息通过环境变量传递给不可信进程
- 进程信息（如/proc）中可见命令行参数
- 使用system()执行包含敏感信息的命令

**典型漏洞模式**：
```cpp
// 危险：密码在命令行参数中
void backupDatabase(const std::string& password) {
    std::string cmd = "mysqldump -u root -p" + password + " mydb > backup.sql";
    system(cmd.c_str());
    // ps aux可以看到完整命令行，包括密码
}

// 危险：通过环境变量传递API密钥
void callExternalService(const std::string& apiKey) {
    setenv("API_KEY", apiKey.c_str(), 1);
    system("./external_script.sh");
    // 其他进程可能读取环境变量
}

// 危险：命令注入和敏感信息泄露
void processFile(const std::string& filename, const std::string& secret) {
    std::string cmd = "convert " + filename + " -watermark " + secret + " output.jpg";
    system(cmd.c_str());  // 命令注入风险 + 敏感信息暴露
}

// 安全：使用管道传递密码
void backupDatabase(const std::string& password) {
    FILE* pipe = popen("mysqldump -u root -p mydb", "w");
    if (pipe) {
        fprintf(pipe, "%s\n", password.c_str());
        pclose(pipe);
    }
}

// 安全：使用配置文件而非命令行参数
void backupDatabase(const std::string& password) {
    // 创建临时配置文件
    SecureTempFile configFile("/tmp/.mysql_config");
    configFile.get() << "[client]\n";
    configFile.get() << "password=" << password << "\n";
    configFile.get().close();
    
    // 使用配置文件
    std::string cmd = "mysqldump --defaults-file=/tmp/.mysql_config mydb > backup.sql";
    system(cmd.c_str());
    
    // configFile析构时自动删除
}

// 安全：使用fork/exec代替system
void executeSecurely(const std::vector<std::string>& args) {
    pid_t pid = fork();
    if (pid == 0) {
        // 子进程
        std::vector<char*> argv;
        for (const auto& arg : args) {
            argv.push_back(const_cast<char*>(arg.c_str()));
        }
        argv.push_back(nullptr);
        
        execvp(argv[0], argv.data());
        exit(1);
    } else if (pid > 0) {
        // 父进程
        int status;
        waitpid(pid, &status, 0);
    }
}

// 安全：清理环境变量
void callExternalService(const std::string& apiKey) {
    setenv("API_KEY", apiKey.c_str(), 1);
    system("./external_script.sh");
    unsetenv("API_KEY");  // 立即清理
}

// 安全：使用进程间通信而非环境变量
void secureIPC(const std::string& secret) {
    int pipefd[2];
    pipe(pipefd);
    
    pid_t pid = fork();
    if (pid == 0) {
        // 子进程
        close(pipefd[1]);  // 关闭写端
        
        char buffer[256];
        read(pipefd[0], buffer, sizeof(buffer));
        
        // 使用secret...
        explicit_bzero(buffer, sizeof(buffer));
        
        close(pipefd[0]);
        exit(0);
    } else {
        // 父进程
        close(pipefd[0]);  // 关闭读端
        
        write(pipefd[1], secret.c_str(), secret.length());
        close(pipefd[1]);
        
        waitpid(pid, nullptr, 0);
    }
}
```

**防护措施**：
- 避免通过命令行参数传递敏感信息
- 使用管道、命名管道或Unix域套接字传递敏感数据
- 进程启动后立即清理环境变量中的敏感信息
- 使用fork/exec代替system，避免shell注入
- 使用临时配置文件（使用后删除）
- 限制进程信息的访问权限

---

## 代码分析视角

### 数据流分析
- **敏感源识别**：识别所有敏感信息的产生位置（cin、getenv、文件读取）
- **污点追踪**：从敏感源追踪到所有可能的泄露点
- **汇聚点分析**：识别cout、文件输出、网络发送等输出汇聚点
- **清理验证**：验证敏感数据在使用后是否被正确清理（explicit_bzero）
- **指针传播**：追踪指针和引用的传递路径
- **拷贝分析**：识别拷贝构造、赋值操作导致的数据复制

### 生命周期分析
- **分配阶段**：敏感信息如何分配（栈/堆/静态）
- **使用阶段**：敏感信息如何在系统中流动和被处理
- **存储阶段**：敏感信息如何被存储（内存/文件/数据库）
- **传输阶段**：敏感信息如何在不同组件间传输
- **销毁阶段**：敏感信息如何被清零和释放
- **异常路径**：异常情况下的资源清理

### 内存安全分析
- **栈溢出**：检查固定大小缓冲区的边界
- **堆溢出**：检查动态分配的边界检查
- **UAF**：检查释放后使用（Use-After-Free）
- **内存泄露**：检查未释放的敏感内存
- **双重释放**：检查重复释放导致的问题

### 安全控制分析
- **加密保护**：验证存储和传输加密
- **脱敏处理**：验证日志和响应脱敏
- **访问控制**：验证敏感信息的访问权限
- **清理机制**：验证资源释放和数据清理
- **RAII保证**：验证使用RAII确保资源清理

---

## 典型触发条件

| 泄露类型 | 高频触发条件 |
|---------|-------------|
| 错误消息泄露 | 异常输出到cout/cerr、堆栈跟踪打印 |
| 调试代码泄露 | 硬编码密钥、#define中的凭证、DEBUG宏 |
| 日志泄露 | 直接输出用户输入、日志包含凭据 |
| 源代码泄露 | 硬编码连接字符串、头文件未排除 |
| 存储传输不当 | 密码明文存储、HTTP传输、ECB模式加密 |
| 未清理敏感信息 | std::string密码、memset被优化移除、临时文件未删除 |
| 资源泄露 | 文件未关闭、异常未处理、未使用RAII |
| 进程调用泄露 | system()包含密码、环境变量泄露 |
| 内存残留 | 核心转储、内存未锁定、析构未清零 |

---

## C++特有风险点

### 内存管理风险
- std::string不保证析构时清零敏感数据
- 栈缓冲区未清零导致数据残留
- 堆内存释放后未清零
- 编译器优化可能移除memset清零操作
- 核心转储可能包含敏感内存

### 编译器和优化
- -O2/-O3优化可能移除"无用"的memset
- 内联可能导致敏感数据跨函数传播
- RVO（返回值优化）可能改变对象生命周期
- 寄存器分配可能在寄存器中保留敏感数据

### STL容器风险
- std::string、std::vector析构不保证清零
- 容器重新分配时旧内存未清零
- 共享指针延长对象生命周期
- 迭代器失效可能导致敏感数据访问

### 多线程风险
- 线程局部存储中的敏感数据
- 线程间共享的敏感数据未保护
- 竞态条件导致敏感数据泄露

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+泄露类型]

## 敏感信息与泄露点
- 敏感信息类型: [密码/密钥/个人信息等]
- 产生位置: [文件:行号] [函数名]
- 泄露点: [cout/日志/文件/网络等]
- 数据流路径: [详细的数据流追踪]
- 内存状态: [栈/堆/静态] [是否清零]

## 证据链与逻辑推理
1. 代码证据：具体代码行和敏感信息
2. 数据流追踪：从分配到泄露的完整路径
3. 内存分析：敏感数据在内存中的残留情况
4. 漏洞描述：具体的信息泄露风险
5. 推理：为何导致信息泄露

## 真实触发条件
输入条件、数据流路径、可利用性评估、内存残留时长

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 攻击者获取难度 |
| 信息敏感性 | 高/中/低 | 数据敏感程度 |
| 影响范围 | 高/中/低 | 账户接管/数据泄露/系统入侵 |
| 合规性影响 | 高/中/低 | GDPR/PCI-DSS等 |
| 内存残留风险 | 高/中/低 | 核心转储/内存扫描风险 |

## 修改建议
方案一+代码示例+优缺点
推荐：XXX

## 边界与不确定性
确定事实、不确定假设、建议调查点
```

---

## 非"执行逻辑"

本文档仅作知识参考和结构化指南，不执行代码、自动扫描、生成修复脚本或最终裁决。模型应结合具体业务场景推理，非机械匹配。

---

## 典型误报场景

不应报告：
- 使用环境变量或密钥管理系统的正确实现
- 配置文件已通过.gitignore排除
- 日志已实施脱敏过滤
- 使用SecureString或RAII正确清理的敏感数据
- 使用explicit_bzero/SecureZeroMemory的清零操作
- Cookie已设置HttpOnly和Secure属性
- 使用bcrypt/Argon2的正确哈希实现
- 使用AES-GCM的正确加密实现
- 使用智能指针配合自定义删除器的正确实现
- 仅对可信内部系统的信息共享
- 脱敏后的示例或测试数据
- 合规的数据匿名化处理
- 使用mlock锁定的敏感内存
- 禁用core dump的安全配置

---

## 敏感信息识别模式

### 常见敏感信息类型
- **凭证类**：password、passwd、pwd、secret、apiKey、accessToken、token、credential
- **连接信息**：connection_string、db_url、conn_str
- **加密密钥**：private_key、public_key、signing_key、encryption_key、secret_key、aes_key
- **个人信息**：ssn、credit_card、passport、bank_account、email、phone、address
- **配置信息**：config、setting、environment、db_host、db_user、db_pass
- **IP地址**：ip、hostname、server、endpoint、url

### 敏感信息位置（C++特有）
- 源代码中的字符串字面量
- 头文件中的const/constexpr常量
- 预处理器宏定义（#define）
- 配置文件（.ini、.conf、.yaml）
- 环境变量
- 命令行参数
- 日志文件
- 内存（栈、堆、静态存储区）
- 核心转储文件
- 版本控制历史

### C++特有检测点
- std::string对象（不安全清理）
- char数组（未清零）
- 动态分配内存（new/delete）
- STL容器（vector、map等）
- 智能指针（shared_ptr、unique_ptr）
- 全局/静态变量
- 线程局部存储
- Lambda捕获
- 函数参数（值传递、引用传递）
- 返回值（RVO/NRVO）

---

## C++安全编码最佳实践

### 1. 优先使用RAII
```cpp
// 好：自动管理资源
std::ifstream file("sensitive.dat");
SecureString password = getPassword();
```

### 2. 使用智能指针
```cpp
// 好：自动释放内存
auto data = std::make_unique<SensitiveData>();
```

### 3. 显式清零敏感数据
```cpp
// 好：不会被优化移除
explicit_bzero(buffer, size);
SecureZeroMemory(buffer, size);
```

### 4. 避免使用std::string存储密码
```cpp
// 不好
std::string password = getUserPassword();

// 好
SecureString password = getUserPassword();
```

### 5. 使用mlock锁定敏感内存
```cpp
char sensitiveData[256];
mlock(sensitiveData, sizeof(sensitiveData));
// 使用...
explicit_bzero(sensitiveData, sizeof(sensitiveData));
munlock(sensitiveData, sizeof(sensitiveData));
```

### 6. 禁用核心转储
```cpp
struct rlimit rl;
rl.rlim_cur = 0;
rl.rlim_max = 0;
setrlimit(RLIMIT_CORE, &rl);
```

### 7. 使用编译标志
```bash
# 启用安全检查
g++ -D_FORTIFY_SOURCE=2 -fstack-protector-strong -pie -fPIE
# 启用地址检测器
g++ -fsanitize=address -g
```

---

**文档版本**：v1.0 | **适用语言**：C++ (C++11及以上)