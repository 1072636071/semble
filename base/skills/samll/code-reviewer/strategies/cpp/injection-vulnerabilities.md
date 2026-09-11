# C++注入类问题分析指导文档

## 能力目标

基于数据流和上下文分析，判断C++程序中的真实注入风险，识别可达的注入点，区分合法关联和恶意注入。

---

## 前置判断

获取:
- **输入来源**: 命令行参数(`argv`)、标准输入(`cin`/`scanf`)、文件读取(`fstream`)、网络套接字(`socket`)、环境变量(`getenv`)、共享内存、管道
- **输入类型**: C字符串(`char*`)、C++字符串(`std::string`)、二进制数据、JSON/XML/Protobuf、命令参数、文件路径
- **数据流路径**: 从输入到执行点的完整传递链，包括指针传递、引用传递、容器操作
- **内存安全机制**: 缓冲区边界检查、智能指针使用、RAII模式、输入验证
- **执行上下文**: 系统调用、数据库查询、XML/JSON解析、日志输出、网络响应、文件操作
- **语言特性**: 指针操作、字符串拼接、格式化输出、动态内存、STL容器
- **第三方库**: Boost、libcurl、MySQL Connector、JSON库(nlohmann/json)、XML解析器(libxml2/pugixml)

---

## 分析流程

### Step 1 — 识别疑似注入点
定位可能的注入执行点:
- **命令执行**: `system()`、`popen()`、`execl()`/`execv()`系列、`fork()`+`exec()`、WinAPI的`CreateProcess()`
- **SQL查询**: 原生SQL字符串拼接、动态查询构建(MySQL C API、SQLite、PostgreSQL libpq)
- **格式化字符串**: `printf()`/`sprintf()`/`snprintf()`、`syslog()`、格式化日志输出
- **XML/JSON处理**: libxml2、pugixml、RapidXML、nlohmann/json、Boost.PropertyTree
- **文件操作**: `fopen()`路径拼接、`system()`调用文件工具、文件路径遍历
- **网络输出**: HTTP响应头构建、HTML生成、Socket数据发送
- **日志输出**: syslog、自定义日志系统、格式化日志

### Step 2 — 追踪污点数据流
- **指针和引用追踪**: 追踪`char*`、`std::string&`、智能指针的数据流
- **容器传播**: `std::vector`、`std::map`、`std::string`的数据传递
- **函数调用链**: 跨函数边界的参数传递和返回值
- **内存拷贝**: `strcpy()`、`strcat()`、`memcpy()`、`std::string::append()`
- **类型转换**: C风格字符串与C++字符串互转、`c_str()`使用
- **污点消失点**: 输入验证函数、转义函数、白名单过滤、参数化API

### Step 3 — 验证防护机制
- **输入验证**: 正则表达式(`std::regex`)、字符白名单、长度限制、类型检查
- **输出编码**: HTML实体编码、URL编码、SQL转义、Shell转义
- **参数化查询**: MySQL Prepared Statement、SQLite绑定参数、ORM库
- **安全API**: 使用`execv()`而非`system()`、使用参数数组而非命令字符串
- **边界检查**: `strncpy()`、`snprintf()`、`std::string`自动管理、智能指针
- **编译器防护**: `-D_FORTIFY_SOURCE=2`、地址清理器(ASan)、内存安全编译选项

### Step 4 — 判断真实风险
- **可达性**: 注入点是否可被外部输入触发
- **可控性**: 攻击者能否控制注入的payload(需考虑指针操作、内存布局)
- **上下文**: 注入内容在目标上下文中的语法有效性
- **影响范围**: 代码执行、内存破坏、权限提升、数据泄露

---

## 风险模式分类

### CAT-0020 命令注入
应用程序将不受信任的数据作为命令或命令的一部分传递给操作系统执行器。

**C++特有触发条件**:
- 使用`system()`拼接用户输入
- 使用`popen()`执行包含用户输入的命令
- 不安全的`execl()`/`execlp()`调用(使用shell解释器)
- 格式化字符串构建命令: `sprintf(cmd, "ls %s", user_input)`
- 通过环境变量传递用户输入到shell命令

**分析方法**:
1. 搜索所有`system()`、`popen()`、`exec*`系列函数调用
2. 追踪命令字符串的构建过程，检查是否使用`strcat()`、`sprintf()`、`std::string`拼接
3. 验证是否使用参数数组形式的`execv()`/`execvp()`
4. 检查Shell元字符过滤: `| & ; $ ` ( ) < > \n \t '  "`

**典型漏洞模式**:
```cpp
// 危险案例1: system()直接拼接
#include <cstdlib>
#include <string>

void bad_ping(const std::string& host) {
    std::string cmd = "ping -c 4 " + host;
    system(cmd.c_str());  // host可能包含 "; rm -rf /"
}

// 危险案例2: sprintf构建命令
void bad_list_files(const char* dirname) {
    char cmd[256];
    sprintf(cmd, "ls -la %s", dirname);  // 缓冲区溢出 + 命令注入
    system(cmd);
}

// 危险案例3: popen注入
void bad_grep(const std::string& pattern, const std::string& file) {
    std::string cmd = "grep '" + pattern + "' " + file;
    FILE* pipe = popen(cmd.c_str(), "r");  // pattern可能包含 ' ; evil_cmd ; '
    // ... 读取输出
    pclose(pipe);
}

// 安全案例1: 使用execv避免shell解释
#include <unistd.h>
#include <vector>

void safe_ping(const std::string& host) {
    // 白名单验证
    if (!is_valid_hostname(host)) {
        throw std::invalid_argument("Invalid hostname");
    }
    
    pid_t pid = fork();
    if (pid == 0) {
        // 子进程: 使用execv直接调用，不经过shell
        const char* args[] = {"ping", "-c", "4", host.c_str(), nullptr};
        execv("/bin/ping", const_cast<char* const*>(args));
        _exit(1);
    }
    // 父进程: 等待子进程
    waitpid(pid, nullptr, 0);
}

// 安全案例2: 白名单验证 + 转义
bool is_valid_hostname(const std::string& host) {
    static const std::regex pattern("^[a-zA-Z0-9.-]+$");
    return std::regex_match(host, pattern) && host.length() < 255;
}

std::string shell_escape(const std::string& input) {
    std::string result;
    for (char c : input) {
        if (strchr("$`\"\\!", c)) {
            result += '\\';
        }
        result += c;
    }
    return result;
}
```

**防护措施**:
- **首选**: 使用`execv()`/`execvp()`配合参数数组，避免shell解释
- **次选**: 严格白名单验证(主机名、文件名、数字参数)
- **最后**: 如必须使用shell，转义所有特殊字符
- 使用`fork()`+`execve()`完全控制子进程环境
- 降低进程权限，使用`setuid()`/`setgid()`
- 限制命令执行的可用路径(chroot、容器隔离)

---

### CWD-1073 XSS注入(跨站脚本攻击)
C++后端生成HTML输出时，未对用户输入进行适当转义。

**C++特有触发条件**:
- CGI/FastCGI程序直接输出HTML
- C++ Web框架(如Crow、Drogon)未转义模板变量
- 使用`std::cout`/`printf`直接输出到HTTP响应
- 手动拼接HTML字符串

**分析方法**:
1. 识别所有HTTP响应输出位置
2. 检查HTML内容构建方式(字符串拼接、模板引擎)
3. 验证是否对特殊HTML字符转义: `< > & " ' /`
4. 区分输出上下文(HTML内容、属性、JavaScript、CSS)

**典型漏洞模式**:
```cpp
// 危险案例1: CGI程序直接输出
#include <iostream>
#include <cstdlib>

void bad_cgi_handler() {
    const char* user_name = getenv("QUERY_STRING");
    
    std::cout << "Content-Type: text/html\r\n\r\n";
    std::cout << "<html><body>";
    std::cout << "<h1>Welcome, " << (user_name ? user_name : "Guest") << "</h1>";
    // 如果user_name是 <script>alert('XSS')</script> 则会执行
    std::cout << "</body></html>";
}

// 危险案例2: Web框架未转义
#include "crow_all.h"

void bad_web_handler(const crow::request& req, crow::response& res) {
    std::string comment = req.url_params.get("comment");
    
    res.write("<div class='comment'>" + comment + "</div>");
    // comment可能包含 </div><script>alert(1)</script><div>
    res.end();
}

// 安全案例1: HTML实体编码
std::string html_encode(const std::string& input) {
    std::string result;
    result.reserve(input.size() * 1.2);
    
    for (char c : input) {
        switch (c) {
            case '<':  result += "&lt;"; break;
            case '>':  result += "&gt;"; break;
            case '&':  result += "&amp;"; break;
            case '"':  result += "&quot;"; break;
            case '\'': result += "&#x27;"; break;
            case '/':  result += "&#x2F;"; break;
            default:   result += c; break;
        }
    }
    return result;
}

void safe_cgi_handler() {
    const char* user_name = getenv("QUERY_STRING");
    std::string safe_name = html_encode(user_name ? user_name : "Guest");
    
    std::cout << "Content-Type: text/html; charset=UTF-8\r\n";
    std::cout << "X-Content-Type-Options: nosniff\r\n";
    std::cout << "X-Frame-Options: DENY\r\n";
    std::cout << "Content-Security-Policy: default-src 'self'\r\n\r\n";
    std::cout << "<html><body>";
    std::cout << "<h1>Welcome, " << safe_name << "</h1>";
    std::cout << "</body></html>";
}

// 安全案例2: 使用模板引擎的自动转义(inja示例)
#include "inja/inja.hpp"

void safe_template_handler(const std::string& user_input) {
    inja::Environment env;
    inja::json data;
    data["user_input"] = user_input;
    
    // inja默认会转义HTML
    std::string html = env.render("<p>{{ user_input }}</p>", data);
    std::cout << html;
}
```

**防护措施**:
- 对所有输出进行上下文感知的编码(HTML实体、JavaScript、URL)
- 使用带自动转义的模板引擎(Jinja2 C++、Mustache)
- 实施内容安全策略(CSP)头
- 对富文本使用白名单过滤器
- 设置`HttpOnly`和`Secure` Cookie标志

---

### CAT-0024 SQL注入
应用程序将不受信任的数据拼接到SQL查询中。

**C++特有触发条件**:
- 使用MySQL C API的`mysql_query()`拼接SQL字符串
- SQLite3的`sqlite3_exec()`直接执行拼接查询
- 使用`sprintf()`/`std::string`构建SQL语句
- ORM框架不当使用(如SOCI的动态SQL)

**分析方法**:
1. 识别所有数据库查询执行点
2. 检查SQL语句构建方式(字符串拼接 vs 参数化)
3. 追踪用户输入如何进入SQL字符串
4. 验证是否使用Prepared Statement或参数绑定

**典型漏洞模式**:
```cpp
// 危险案例1: MySQL C API字符串拼接
#include <mysql/mysql.h>
#include <string>

void bad_mysql_query(MYSQL* conn, const std::string& username) {
    std::string query = "SELECT * FROM users WHERE name='" + username + "'";
    // username可能是 ' OR '1'='1
    
    if (mysql_query(conn, query.c_str())) {
        fprintf(stderr, "%s\n", mysql_error(conn));
    }
}

// 危险案例2: SQLite字符串拼接
#include <sqlite3.h>

void bad_sqlite_query(sqlite3* db, const char* email) {
    char sql[256];
    sprintf(sql, "DELETE FROM users WHERE email='%s'", email);
    // email可能是 ' OR '1'='1
    
    char* err_msg = nullptr;
    sqlite3_exec(db, sql, nullptr, nullptr, &err_msg);
}

// 危险案例3: sprintf构建复杂查询
void bad_complex_query(MYSQL* conn, const char* table_name, int user_id) {
    char query[512];
    // table_name可能包含注入: users; DROP TABLE users; --
    sprintf(query, "SELECT * FROM %s WHERE id=%d", table_name, user_id);
    mysql_query(conn, query);
}

// 安全案例1: MySQL Prepared Statement
void safe_mysql_query(MYSQL* conn, const std::string& username) {
    MYSQL_STMT* stmt = mysql_stmt_init(conn);
    const char* query = "SELECT * FROM users WHERE name=?";
    
    mysql_stmt_prepare(stmt, query, strlen(query));
    
    MYSQL_BIND bind[1];
    memset(bind, 0, sizeof(bind));
    
    unsigned long str_length = username.length();
    bind[0].buffer_type = MYSQL_TYPE_STRING;
    bind[0].buffer = (char*)username.c_str();
    bind[0].buffer_length = username.length();
    bind[0].length = &str_length;
    
    mysql_stmt_bind_param(stmt, bind);
    mysql_stmt_execute(stmt);
    
    // 处理结果...
    mysql_stmt_close(stmt);
}

// 安全案例2: SQLite参数绑定
void safe_sqlite_query(sqlite3* db, const char* email) {
    sqlite3_stmt* stmt;
    const char* sql = "DELETE FROM users WHERE email=?";
    
    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
    sqlite3_bind_text(stmt, 1, email, -1, SQLITE_TRANSIENT);
    
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
}

// 安全案例3: 使用ORM(SOCI示例)
#include <soci/soci.h>

void safe_orm_query(soci::session& sql, const std::string& username) {
    std::string name;
    int id;
    
    // SOCI自动处理参数绑定
    sql << "SELECT id, name FROM users WHERE name=:name",
        soci::use(username), soci::into(id), soci::into(name);
}

// 安全案例4: 表名白名单验证
bool is_valid_table_name(const std::string& table) {
    static const std::set<std::string> allowed_tables = {
        "users", "orders", "products", "sessions"
    };
    return allowed_tables.count(table) > 0;
}

void safe_dynamic_table(MYSQL* conn, const std::string& table_name, int user_id) {
    if (!is_valid_table_name(table_name)) {
        throw std::invalid_argument("Invalid table name");
    }
    
    // 表名验证通过后可以安全拼接(但用户输入仍需参数化)
    std::string query = "SELECT * FROM " + table_name + " WHERE id=?";
    
    MYSQL_STMT* stmt = mysql_stmt_init(conn);
    mysql_stmt_prepare(stmt, query.c_str(), query.length());
    
    MYSQL_BIND bind[1];
    memset(bind, 0, sizeof(bind));
    bind[0].buffer_type = MYSQL_TYPE_LONG;
    bind[0].buffer = &user_id;
    
    mysql_stmt_bind_param(stmt, bind);
    mysql_stmt_execute(stmt);
    mysql_stmt_close(stmt);
}
```

**防护措施**:
- **强制要求**: 始终使用Prepared Statement和参数绑定
- 对动态SQL部分(表名、列名、排序字段)使用严格白名单
- 使用ORM框架的参数化查询功能
- 最小权限数据库账户(只读、禁止DROP/DELETE)
- 输入验证: 类型检查、长度限制、格式验证
- 避免在存储过程中拼接动态SQL

---

### CWD-1114 格式化字符串漏洞
C++特有的格式化函数使用不当，可能导致信息泄露或代码执行。

**C++特有触发条件**:
- 用户输入直接作为`printf()`系列函数的格式字符串
- 使用`syslog()`时用户输入作为格式参数
- 自定义日志系统未正确处理格式化
- `std::format`(C++20)使用不当

**分析方法**:
1. 搜索所有格式化输出函数:`printf`、`fprintf`、`sprintf`、`snprintf`、`syslog`
2. 检查格式字符串参数是否可被用户控制
3. 验证是否使用固定格式字符串配合参数
4. 识别格式化字符串攻击向量: `%s`、`%x`、`%n`

**典型漏洞模式**:
```cpp
// 危险案例1: printf格式化字符串注入
#include <cstdio>
#include <syslog.h>

void bad_printf(const char* user_input) {
    printf(user_input);  // user_input可能是 %x%x%x%x 或 %s%s%s%n
    // %x 可泄露栈数据, %n 可写入内存地址
}

// 危险案例2: syslog注入
void bad_syslog(const char* username) {
    syslog(LOG_INFO, username);  // username可能包含 %n 导致内存破坏
}

// 危险案例3: sprintf缓冲区溢出 + 格式化注入
void bad_sprintf(const char* user_data) {
    char buffer[64];
    sprintf(buffer, user_data);  // 缓冲区溢出 + 格式化注入
}

// 安全案例1: 使用固定格式字符串
void safe_printf(const char* user_input) {
    printf("%s", user_input);  // 格式字符串固定，用户输入作为参数
}

void safe_syslog(const char* username) {
    syslog(LOG_INFO, "User login: %s", username);
}

// 安全案例2: 使用std::cout避免格式化
#include <iostream>

void safe_output(const std::string& user_input) {
    std::cout << "User input: " << user_input << std::endl;
    // std::cout不存在格式化字符串问题
}

// 安全案例3: snprintf限制缓冲区
void safe_snprintf(const char* user_data) {
    char buffer[64];
    snprintf(buffer, sizeof(buffer), "Data: %s", user_data);
    buffer[sizeof(buffer) - 1] = '\0';  // 确保null终止
}

// 安全案例4: C++20 std::format(类型安全)
#include <format>  // C++20

void safe_format(const std::string& user_input) {
    std::string result = std::format("User: {}", user_input);
    // std::format是类型安全的，不存在格式化字符串注入
}
```

**防护措施**:
- **永远不要**将用户输入作为格式字符串参数
- 使用固定格式字符串配合参数: `printf("%s", user_input)`
- 优先使用`std::cout`、`std::format`(C++20)等类型安全API
- 使用`snprintf`而非`sprintf`限制缓冲区大小
- 编译时启用`-Wformat -Wformat-security`警告
- 运行时使用`-D_FORTIFY_SOURCE=2`加固

---

### CAT-0023 资源注入(路径遍历)
应用程序允许用户输入指定文件路径，未进行适当验证。

**C++特有触发条件**:
- 使用`fopen()`、`std::ifstream`打开用户指定文件
- 使用`std::filesystem::path`拼接路径未验证
- 文件操作函数未检查路径遍历: `../`、`..\\`、绝对路径
- 使用`dlopen()`加载用户指定的动态库

**分析方法**:
1. 识别所有文件/资源打开操作
2. 追踪路径字符串的构建过程
3. 检查是否进行路径规范化
4. 验证路径是否在允许的目录范围内

**典型漏洞模式**:
```cpp
// 危险案例1: 路径遍历
#include <fstream>
#include <string>

void bad_read_file(const std::string& filename) {
    std::string path = "/var/www/uploads/" + filename;
    // filename可能是 ../../etc/passwd
    
    std::ifstream file(path);
    if (file.is_open()) {
        std::string content((std::istreambuf_iterator<char>(file)),
                            std::istreambuf_iterator<char>());
        // 可能读取任意文件
    }
}

// 危险案例2: C风格文件操作
void bad_fopen(const char* user_path) {
    FILE* file = fopen(user_path, "r");  // 无任何验证
    if (file) {
        // 处理文件
        fclose(file);
    }
}

// 危险案例3: 动态库加载
#include <dlfcn.h>

void bad_load_plugin(const char* plugin_name) {
    std::string path = "./plugins/" + std::string(plugin_name);
    // plugin_name可能是 ../../../lib/malicious.so
    
    void* handle = dlopen(path.c_str(), RTLD_LAZY);
    // 加载恶意动态库
}

// 安全案例1: 路径规范化和白名单验证
#include <filesystem>
#include <stdexcept>

namespace fs = std::filesystem;

std::string safe_get_file_path(const std::string& filename, 
                                const std::string& base_dir) {
    // 1. 构建完整路径
    fs::path full_path = fs::path(base_dir) / filename;
    
    // 2. 规范化路径(解析 . 和 ..)
    full_path = fs::canonical(full_path);
    
    // 3. 规范化基础目录
    fs::path canonical_base = fs::canonical(base_dir);
    
    // 4. 检查路径是否在基础目录内
    auto mismatch_pair = std::mismatch(
        canonical_base.begin(), canonical_base.end(),
        full_path.begin(), full_path.end()
    );
    
    if (mismatch_pair.first != canonical_base.end()) {
        throw std::runtime_error("Path traversal detected");
    }
    
    return full_path.string();
}

void safe_read_file(const std::string& filename) {
    try {
        std::string safe_path = safe_get_file_path(filename, "/var/www/uploads");
        std::ifstream file(safe_path);
        
        if (file.is_open()) {
            // 安全读取文件
        }
    } catch (const std::exception& e) {
        std::cerr << "Security error: " << e.what() << std::endl;
    }
}

// 安全案例2: 文件名白名单
bool is_safe_filename(const std::string& filename) {
    // 1. 长度限制
    if (filename.empty() || filename.length() > 255) {
        return false;
    }
    
    // 2. 不允许路径分隔符
    if (filename.find('/') != std::string::npos ||
        filename.find('\\') != std::string::npos) {
        return false;
    }
    
    // 3. 不允许特殊符号
    if (filename.find("..") != std::string::npos) {
        return false;
    }
    
    // 4. 字符白名单
    static const std::regex safe_pattern("^[a-zA-Z0-9_.-]+$");
    return std::regex_match(filename, safe_pattern);
}

// 安全案例3: realpath验证
#include <climits>
#include <cstdlib>

bool is_path_safe(const char* user_path, const char* base_dir) {
    char resolved_path[PATH_MAX];
    char resolved_base[PATH_MAX];
    
    if (!realpath(user_path, resolved_path) || 
        !realpath(base_dir, resolved_base)) {
        return false;
    }
    
    // 检查解析后的路径是否以base_dir开头
    return strncmp(resolved_path, resolved_base, strlen(resolved_base)) == 0;
}
```

**防护措施**:
- 使用`std::filesystem::canonical()`规范化路径
- 验证规范化后的路径在允许的目录范围内
- 文件名白名单: 只允许字母数字和有限的符号
- 拒绝包含`..`、`/`、`\`的输入
- 使用`realpath()`获取绝对路径并验证
- 使用chroot限制文件系统访问范围
- 对动态库加载使用严格的白名单

---

### CWD-1086 CRLF注入
应用程序在HTTP响应头或日志中使用用户输入，未过滤换行符。

**C++特有触发条件**:
- CGI/FastCGI程序手动构建HTTP响应头
- 日志系统直接记录用户输入
- Email系统拼接邮件头
- 使用`std::cout`输出HTTP响应

**分析方法**:
1. 识别所有HTTP响应头设置位置
2. 检查日志输出中用户输入的处理
3. 验证是否过滤`\r\n`字符
4. 检查重定向URL的构建

**典型漏洞模式**:
```cpp
// 危险案例1: HTTP响应头注入
#include <iostream>

void bad_set_cookie(const std::string& session_id) {
    std::cout << "Content-Type: text/html\r\n";
    std::cout << "Set-Cookie: session=" << session_id << "\r\n";
    // session_id可能是 abc\r\nX-Injected-Header: evil
    std::cout << "\r\n";
}

// 危险案例2: 日志注入
#include <fstream>

void bad_log(const std::string& username) {
    std::ofstream log("/var/log/app.log", std::ios::app);
    log << "User logged in: " << username << std::endl;
    // username可能是 admin\n[ERROR] Fake error message
}

// 危险案例3: HTTP重定向注入
void bad_redirect(const std::string& target) {
    std::cout << "HTTP/1.1 302 Found\r\n";
    std::cout << "Location: " << target << "\r\n";
    // target可能是 /page\r\nContent-Length: 0\r\n\r\n<html>XSS</html>
    std::cout << "\r\n";
}

// 安全案例1: 过滤CRLF字符
std::string remove_crlf(const std::string& input) {
    std::string result;
    result.reserve(input.size());
    
    for (char c : input) {
        if (c != '\r' && c != '\n') {
            result += c;
        }
    }
    return result;
}

void safe_set_cookie(const std::string& session_id) {
    std::string safe_id = remove_crlf(session_id);
    
    std::cout << "Content-Type: text/html\r\n";
    std::cout << "Set-Cookie: session=" << safe_id << "\r\n";
    std::cout << "\r\n";
}

// 安全案例2: 日志转义
std::string escape_log(const std::string& input) {
    std::string result;
    result.reserve(input.size() * 1.2);
    
    for (char c : input) {
        switch (c) {
            case '\r': result += "\\r"; break;
            case '\n': result += "\\n"; break;
            case '\t': result += "\\t"; break;
            case '\\': result += "\\\\"; break;
            default:   result += c; break;
        }
    }
    return result;
}

void safe_log(const std::string& username) {
    std::string safe_name = escape_log(username);
    std::ofstream log("/var/log/app.log", std::ios::app);
    log << "User logged in: " << safe_name << std::endl;
}

// 安全案例3: 使用Web框架的安全API
#include "crow_all.h"

void safe_web_cookie(crow::response& res, const std::string& session_id) {
    // Crow框架会自动处理响应头安全
    res.add_header("Set-Cookie", "session=" + session_id);
    // 框架内部会验证和转义
}

// 安全案例4: URL白名单验证
bool is_safe_redirect_url(const std::string& url) {
    // 只允许相对路径或同域名URL
    if (url.empty()) return false;
    
    if (url[0] == '/') {
        // 相对路径: 确保不包含CRLF
        return url.find('\r') == std::string::npos &&
               url.find('\n') == std::string::npos;
    }
    
    // 绝对URL: 白名单域名
    static const std::vector<std::string> allowed_domains = {
        "https://example.com",
        "https://www.example.com"
    };
    
    for (const auto& domain : allowed_domains) {
        if (url.substr(0, domain.length()) == domain) {
            return url.find('\r') == std::string::npos &&
                   url.find('\n') == std::string::npos;
        }
    }
    
    return false;
}
```

**防护措施**:
- 移除或转义所有`\r`(0x0D)和`\n`(0x0A)字符
- 使用Web框架的响应头设置API
- 对日志输出进行转义或使用结构化日志(JSON)
- URL重定向使用白名单验证
- HTTP响应头验证: 不允许包含CRLF的值

---

### CWD-1089 日志注入
应用程序将用户输入直接记录到日志，可能导致日志伪造。

**典型漏洞模式**:
```cpp
// 危险案例: 日志注入可能导致日志伪造
#include <syslog.h>

void bad_auth_log(const char* username, bool success) {
    if (success) {
        syslog(LOG_INFO, "Login successful: %s", username);
        // username可能是 admin\n[ERROR] System compromised by admin
    } else {
        syslog(LOG_WARNING, "Login failed: %s", username);
    }
}

// 安全案例: 结构化日志
#include "nlohmann/json.hpp"
#include <fstream>

using json = nlohmann::json;

void safe_structured_log(const std::string& username, bool success) {
    json log_entry = {
        {"timestamp", std::time(nullptr)},
        {"event", "login"},
        {"username", username},  // JSON会自动转义特殊字符
        {"success", success}
    };
    
    std::ofstream log("/var/log/app.json", std::ios::app);
    log << log_entry.dump() << std::endl;
}
```

**防护措施**:
- 使用结构化日志格式(JSON、syslog格式)
- 转义控制字符: `\r\n\t`
- 对敏感信息脱敏
- 使用专业日志库(spdlog、glog)

---

### CAT-0022 代码注入(C++特有)
C++特有的代码执行风险。

**C++特有触发条件**:
- 使用`dlopen()`/`LoadLibrary()`加载不受信任的动态库
- JIT编译执行用户提供的代码
- 使用脚本引擎(Lua、Python嵌入)执行用户输入
- 通过函数指针执行不受信任的代码

**典型漏洞模式**:
```cpp
// 危险案例1: 动态库加载
#include <dlfcn.h>

void bad_plugin_system(const std::string& plugin_path) {
    void* handle = dlopen(plugin_path.c_str(), RTLD_NOW);
    // plugin_path可能指向恶意so文件
    
    if (handle) {
        typedef void (*init_func)();
        init_func init = (init_func)dlsym(handle, "plugin_init");
        init();  // 执行恶意代码
    }
}

// 危险案例2: Lua脚本注入
#include <lua.hpp>

void bad_lua_eval(const char* user_script) {
    lua_State* L = luaL_newstate();
    luaL_openlibs(L);
    
    luaL_dostring(L, user_script);  // 执行任意Lua代码
    // user_script可能是 os.execute("rm -rf /")
    
    lua_close(L);
}

// 安全案例1: 插件白名单和签名验证
#include <openssl/evp.h>

bool verify_plugin_signature(const std::string& plugin_path) {
    // 验证插件的数字签名
    // 实现略...
    return true;
}

void safe_plugin_system(const std::string& plugin_name) {
    // 1. 白名单验证
    static const std::set<std::string> allowed_plugins = {
        "safe_plugin1.so", "safe_plugin2.so"
    };
    
    if (allowed_plugins.count(plugin_name) == 0) {
        throw std::runtime_error("Plugin not in whitelist");
    }
    
    // 2. 构建安全路径
    std::string plugin_path = "/usr/lib/app/plugins/" + plugin_name;
    
    // 3. 验证签名
    if (!verify_plugin_signature(plugin_path)) {
        throw std::runtime_error("Invalid plugin signature");
    }
    
    // 4. 加载插件
    void* handle = dlopen(plugin_path.c_str(), RTLD_NOW | RTLD_LOCAL);
    // 处理插件...
}

// 安全案例2: Lua沙箱
void safe_lua_eval(const char* user_script) {
    lua_State* L = luaL_newstate();
    
    // 只加载安全的库
    luaL_requiref(L, "base", luaopen_base, 1);
    luaL_requiref(L, "table", luaopen_table, 1);
    luaL_requiref(L, "string", luaopen_string, 1);
    luaL_requiref(L, "math", luaopen_math, 1);
    
    // 移除危险函数
    lua_pushnil(L);
    lua_setglobal(L, "dofile");
    lua_pushnil(L);
    lua_setglobal(L, "loadfile");
    lua_pushnil(L);
    lua_setglobal(L, "require");
    
    // 沙箱执行
    luaL_dostring(L, user_script);
    
    lua_close(L);
}
```

**防护措施**:
- 动态库白名单和数字签名验证
- 脚本引擎沙箱配置
- 禁用危险的库函数(`os`、`io`库)
- 使用安全的执行环境(容器、虚拟机)

---

## 代码分析视角

### 污点分析
- **污点标记**: 标记所有外部输入(argv、cin、socket recv、文件读取)
- **污点传播**: 追踪指针/引用/容器的数据流
- **污点汇聚**: 识别危险函数调用(system、mysql_query、printf格式化)
- **污点消毒**: 识别验证/转义/参数化函数

### 内存安全分析
- **缓冲区边界**: 检查strcpy、sprintf、gets的使用
- **指针安全**: 追踪悬挂指针、野指针、double-free
- **类型安全**: 检查类型转换(reinterpret_cast、C风格转换)
- **RAII模式**: 验证资源管理(智能指针、析构函数)

### 上下文分析
- **执行上下文**: Shell命令、SQL查询、HTML输出、日志记录
- **编码需求**: HTML实体、SQL转义、Shell转义、URL编码
- **API安全性**: 区分安全API(execv)和危险API(system)

---

## 典型触发条件

| 注入类型 | C++高频触发条件 |
|---------|----------------|
| 命令注入 | `system()`拼接输入、`popen()`未转义 |
| SQL注入 | 字符串拼接SQL、未用Prepared Statement |
| 格式化字符串 | 用户输入作为printf格式参数 |
| XSS注入 | CGI输出未转义HTML |
| 路径遍历 | `fopen()`未验证路径、缺少`canonical()`检查 |
| CRLF注入 | HTTP响应头未过滤`\r\n` |
| 日志注入 | 直接记录用户输入到日志 |
| 代码注入 | `dlopen()`加载不受信任的so、Lua脚本执行 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+注入类型]

## 注入点与数据流
- 注入类型: [命令注入/SQL注入/格式化字符串等]
- 注入位置: [文件:行号] [函数名]
- 输入来源: [argv/cin/socket/文件/环境变量]
- 污点传播路径: [详细的数据流追踪，包括指针传递]

## C++特有风险
- 内存安全问题: [缓冲区溢出/UAF/double-free]
- 类型安全问题: [不安全的类型转换]
- API使用问题: [使用危险C API而非安全C++ API]

## 证据链与逻辑推理
1. 代码证据: 具体代码行和数据流
2. 污点追踪: 输入如何传递到注入点
3. 漏洞描述: 具体的注入漏洞
4. 推理: 为何导致注入攻击

## 真实触发条件
输入条件、数据流路径、可利用性评估

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 攻击者控制难度 |
| 影响范围 | 高/中/低 | 代码执行/内存破坏/数据泄露 |
| 业务影响 | 高/中/低 | 系统可用性/数据完整性 |

## 修复建议
### 方案一: [推荐] 使用安全API
```cpp
// 修复代码示例
```
优点: XXX
缺点: XXX

### 方案二: 输入验证和转义
```cpp
// 修复代码示例
```
优点: XXX
缺点: XXX

## 边界与不确定性
确定事实、不确定假设、建议调查点
```

---

## C++特有防护措施

### 编译时防护
```bash
# 编译选项
g++ -Wall -Wextra -Wformat -Wformat-security \
    -D_FORTIFY_SOURCE=2 \
    -fstack-protector-strong \
    -fPIE -pie \
    -Wl,-z,relro,-z,now \
    -o app app.cpp

# 使用AddressSanitizer
g++ -fsanitize=address -g -o app app.cpp

# 使用UndefinedBehaviorSanitizer
g++ -fsanitize=undefined -g -o app app.cpp
```

### 运行时防护
- 使用Valgrind检测内存错误
- 启用ASLR(地址空间布局随机化)
- 使用seccomp限制系统调用
- 容器隔离(Docker、LXC)

### 代码审查清单
- [ ] 所有`system()`/`popen()`调用都使用参数化
- [ ] SQL查询使用Prepared Statement
- [ ] 格式化函数使用固定格式字符串
- [ ] 文件路径使用`canonical()`验证
- [ ] HTTP响应头过滤CRLF
- [ ] 日志输出转义控制字符
- [ ] 使用智能指针管理内存
- [ ] 避免使用`strcpy`/`sprintf`等危险函数
- [ ] 编译时启用所有安全选项

---

## 典型误报场景

不应报告:
- 正确使用Prepared Statement的SQL查询
- 格式化函数使用固定格式字符串
- 经过`canonical()`验证的文件路径
- 使用`execv()`配合参数数组的命令执行
- 白名单验证后的表名/列名
- 使用安全C++ API(`std::string`、`std::format`)
- 内部数据流，非外部可触发
- 智能指针管理的内存操作

---

**文档版本**: v1.0 | **适用语言**: C/C++ | **更新日期**: 2026-01-27