# ArkTS 注入类问题分析指导

## 能力目标

基于 ArkTS 语言特性和 HarmonyOS 框架,通过数据流和上下文分析,判断真实注入风险,识别可达的注入点,区分合法关联和恶意注入。

---

## 前置判断

获取:
- **输入来源**: 用户输入/网络数据(HTTP请求)/Preferences存储/分布式数据/RelationalStore数据库/传感器数据
- **输入类型**: 字符串/JSON/对象/数组/URL/文件路径
- **数据流路径**: 从输入到执行点的完整传递链(跨UIAbility、跨模块、跨进程)
- **编码和转义机制**: 是否有输入验证、过滤、转义、编码
- **执行上下文**: 注入点所处的执行环境(Web组件/数据库/系统命令/文件系统/网络请求)
- **框架和API**: HarmonyOS SDK版本、使用的安全API和防护机制
- **是否使用ORM**: RelationalStore的参数化查询、安全API抽象层

---

## 分析流程

### Step 1 — 识别疑似注入点
定位 ArkTS 中可能的注入执行点:
- **Web组件注入**: `Web({ src: userInput })`, `webController.loadUrl()`, `webController.runJavaScript()`
- **SQL查询**: RelationalStore 的字符串拼接查询、动态 SQL 构建
- **命令执行**: `@ohos.zlib` 压缩解压、Native调用、系统能力调用
- **URL跳转**: `router.pushUrl()`, `want.uri` 拼接
- **文件操作**: `@ohos.file.fs` 的路径拼接、文件读写
- **网络请求**: `@ohos.net.http` 的URL拼接、header注入
- **日志输出**: `hilog.info()` 中的用户输入
- **Preferences存储**: 键值的动态拼接

### Step 2 — 追踪污点数据流
- **广度优先追踪**: 从用户输入(@State/@Prop/@Link/@Provide)到所有可能的影响点
- **反向追踪**: 从注入点回溯数据来源(UIAbility参数、网络响应、数据库查询结果)
- **跨模块追踪**: 识别通过 `import/export`、EventHub、Emitter 传递的数据
- **数据转换链**: 识别 `JSON.parse()`、`JSON.stringify()`、字符串模板等转换操作
- **污点消失点**: 输入验证函数、编码函数、类型转换

### Step 3 — 验证防护机制
- **输入验证**: 正则表达式、长度限制、类型检查、白名单
- **输出编码**: HTML实体编码、URL编码、SQL转义
- **参数化查询**: RelationalStore 的 `?` 占位符、绑定参数
- **权限控制**: `requestPermissionsFromUser()`、系统能力访问权限
- **框架防护**: Web组件的安全配置、CSP策略

### Step 4 — 判断真实风险
- **可达性**: 注入点是否可被外部输入触发(通过UIAbility参数、网络请求、用户输入)
- **可控性**: 攻击者能否控制注入的 payload
- **上下文**: 注入内容在目标上下文中的语法有效性
- **影响范围**: 注入成功后的潜在危害(数据泄露、XSS、文件访问、权限提升)

---

## 风险模式分类

### CAT-0020 命令注入

ArkTS 中虽然没有直接的 shell 命令执行,但可能通过以下方式触发:

**触发条件**:
- 通过 Native 接口(C++/N-API)调用系统命令
- 使用 `@ohos.zlib` 等系统能力时传入不可信路径
- 通过 `@ohos.app.ability.Want` 启动恶意应用
- 文件路径拼接导致路径遍历

**分析方法**:
1. 识别所有 Native 调用和系统能力调用
2. 追踪传递给这些API的参数来源
3. 检查是否对输入进行白名单验证
4. 验证文件路径的规范化处理

**典型漏洞模式**:
```typescript
// 危险: 未验证的文件路径拼接
import fs from '@ohos.file.fs';

@Entry
@Component
struct FileViewer {
  @State filename: string = '';

  loadFile() {
    // 用户输入 "../../../etc/passwd" 可能导致路径遍历
    let filePath = `/data/storage/el2/base/files/${this.filename}`;
    let file = fs.openSync(filePath, fs.OpenMode.READ_ONLY);
    // ... 读取文件
  }
}

// 安全: 路径验证和规范化
import fs from '@ohos.file.fs';

function sanitizeFilename(filename: string): string {
  // 移除路径分隔符和特殊字符
  return filename.replace(/[^a-zA-Z0-9_.-]/g, '');
}

@Entry
@Component
struct FileViewer {
  @State filename: string = '';

  loadFile() {
    let safeFilename = sanitizeFilename(this.filename);
    // 白名单验证
    if (!/^[a-zA-Z0-9_.-]+$/.test(safeFilename)) {
      console.error('Invalid filename');
      return;
    }
    let filePath = `/data/storage/el2/base/files/${safeFilename}`;
    let file = fs.openSync(filePath, fs.OpenMode.READ_ONLY);
    // ... 读取文件
  }
}
```

**防护措施**:
- 对文件路径进行白名单验证
- 使用 `path.normalize()` 规范化路径
- 验证最终路径在允许的目录范围内
- 最小权限原则访问系统资源

---

### CWD-1073 XSS注入(跨站脚本攻击)

ArkTS 的 Web 组件是主要的 XSS 攻击面。

**触发条件**:
- 用户输入直接作为 Web 组件的 URL: `Web({ src: userInput })`
- 使用 `runJavaScript()` 执行动态构建的脚本
- 通过 `loadData()` 加载包含用户输入的 HTML
- 未对注入到 HTML 中的数据进行转义

**分析方法**:
1. 识别所有 Web 组件的使用
2. 追踪传递给 `src`、`runJavaScript()`、`loadData()` 的数据来源
3. 检查是否使用 HTML 实体编码
4. 验证 Web 组件的安全配置(CSP、JavaScript权限)

**典型漏洞模式**:
```typescript
// 危险: 未转义的用户输入直接插入 HTML
import web_webview from '@ohos.web.webview';

@Entry
@Component
struct WebPage {
  controller: web_webview.WebviewController = new web_webview.WebviewController();
  @State userComment: string = '';

  build() {
    Column() {
      Web({ src: 'about:blank', controller: this.controller })
        .onControllerAttached(() => {
          // 用户输入: <script>alert('XSS')</script>
          let html = `<html><body><div>${this.userComment}</div></body></html>`;
          this.controller.loadData(html, 'text/html', 'UTF-8');
        })
    }
  }
}

// 安全: HTML 实体编码
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

@Entry
@Component
struct WebPage {
  controller: web_webview.WebviewController = new web_webview.WebviewController();
  @State userComment: string = '';

  build() {
    Column() {
      Web({ src: 'about:blank', controller: this.controller })
        .onControllerAttached(() => {
          let safeComment = escapeHtml(this.userComment);
          let html = `<html><body><div>${safeComment}</div></body></html>`;
          this.controller.loadData(html, 'text/html', 'UTF-8');
        })
    }
  }
}

// 更安全: 避免动态 HTML,使用消息传递
@Entry
@Component
struct WebPage {
  controller: web_webview.WebviewController = new web_webview.WebviewController();
  @State userComment: string = '';

  build() {
    Column() {
      Web({ src: 'local://index.html', controller: this.controller })
        .onControllerAttached(() => {
          // 通过安全的消息传递机制传递数据
          this.controller.runJavaScript(
            `window.setComment(${JSON.stringify(this.userComment)})`
          );
        })
    }
  }
}
```

**防护措施**:
- 对所有用户输入进行 HTML 实体编码
- 使用 Web 组件的内容安全策略(CSP)
- 禁用不必要的 JavaScript 执行: `.javaScriptAccess(false)`
- 使用消息传递机制(`postMessage`)而非直接拼接 HTML
- 验证并限制可加载的 URL 域名白名单

---

### CWD-1085 JSON注入

ArkTS 中 JSON 处理不当可能导致数据结构篡改。

**触发条件**:
- 使用字符串拼接构建 JSON: `'{"name":"' + userInput + '"}'`
- 未验证 JSON 解析结果的结构
- 在网络请求中直接使用用户输入构建 JSON body

**分析方法**:
1. 识别 `JSON.parse()` 和 `JSON.stringify()` 的使用
2. 检查是否使用字符串拼接构建 JSON
3. 验证 JSON 解析后的数据结构验证
4. 追踪 JSON 数据在网络请求中的使用

**典型漏洞模式**:
```typescript
// 危险: 字符串拼接构建 JSON
import http from '@ohos.net.http';

@Entry
@Component
struct UserProfile {
  @State username: string = '';

  async updateProfile() {
    // 用户输入: ", "role": "admin
    let jsonStr = `{"username": "${this.username}"}`;
    // 结果: {"username": "", "role": "admin"}
    
    let httpRequest = http.createHttp();
    httpRequest.request('https://api.example.com/user', {
      method: http.RequestMethod.POST,
      header: { 'Content-Type': 'application/json' },
      extraData: jsonStr
    });
  }
}

// 安全: 使用 JSON.stringify()
import http from '@ohos.net.http';

@Entry
@Component
struct UserProfile {
  @State username: string = '';

  async updateProfile() {
    // JSON.stringify 会自动转义特殊字符
    let data = { username: this.username };
    let jsonStr = JSON.stringify(data);
    
    let httpRequest = http.createHttp();
    httpRequest.request('https://api.example.com/user', {
      method: http.RequestMethod.POST,
      header: { 'Content-Type': 'application/json' },
      extraData: jsonStr
    });
  }
}

// 最佳实践: 使用类型安全的对象
import http from '@ohos.net.http';

interface UserProfile {
  username: string;
  email?: string;
}

@Entry
@Component
struct UserProfile {
  @State username: string = '';

  async updateProfile() {
    let profile: UserProfile = {
      username: this.username.trim()
    };
    
    // 输入验证
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(profile.username)) {
      console.error('Invalid username format');
      return;
    }
    
    let httpRequest = http.createHttp();
    httpRequest.request('https://api.example.com/user', {
      method: http.RequestMethod.POST,
      header: { 'Content-Type': 'application/json' },
      extraData: JSON.stringify(profile)
    });
  }
}
```

**防护措施**:
- 始终使用 `JSON.stringify()` 构建 JSON
- 对 JSON 解析结果进行结构和类型验证
- 使用 TypeScript 接口定义预期的数据结构
- 在网络传输前验证数据完整性

---

### CWD-1086 CRLF注入

ArkTS 网络请求中的 HTTP 头注入风险。

**触发条件**:
- 用户输入直接设置 HTTP 请求头
- 响应数据中包含未过滤的换行符
- 日志记录中包含未转义的用户输入

**分析方法**:
1. 检查所有 HTTP 请求头的设置
2. 验证是否过滤 CRLF 字符(`\r\n`)
3. 检查日志输出中的用户输入处理

**典型漏洞模式**:
```typescript
// 危险: 未验证的请求头
import http from '@ohos.net.http';

@Entry
@Component
struct ApiClient {
  @State authToken: string = '';

  async fetchData() {
    // 用户输入: "token\r\nX-Admin: true"
    let httpRequest = http.createHttp();
    httpRequest.request('https://api.example.com/data', {
      method: http.RequestMethod.GET,
      header: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });
  }
}

// 安全: 过滤 CRLF 字符
import http from '@ohos.net.http';

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

@Entry
@Component
struct ApiClient {
  @State authToken: string = '';

  async fetchData() {
    let safeToken = sanitizeHeader(this.authToken);
    
    let httpRequest = http.createHttp();
    httpRequest.request('https://api.example.com/data', {
      method: http.RequestMethod.GET,
      header: {
        'Authorization': `Bearer ${safeToken}`
      }
    });
  }
}
```

**防护措施**:
- 移除或转义所有 CR(`\r`) 和 LF(`\n`) 字符
- 对请求头值进行严格验证
- 使用框架提供的安全API设置请求头
- 避免在日志中记录未转义的用户输入

---

### CWD-1089 日志注入

ArkTS 应用的日志记录安全问题。

**触发条件**:
- 使用 `hilog.info()` 等日志API直接记录用户输入
- 未转义控制字符和换行符
- 日志内容可被解析为日志系统的控制命令

**分析方法**:
1. 识别所有 `hilog` 调用
2. 检查用户输入是否直接写入日志
3. 验证是否转义特殊字符

**典型漏洞模式**:
```typescript
// 危险: 直接记录用户输入
import hilog from '@ohos.hilog';

@Entry
@Component
struct LoginPage {
  @State username: string = '';

  login() {
    // 用户输入: "admin\n[ERROR] Fake error message"
    hilog.info(0x0000, 'LoginTag', `User login attempt: ${this.username}`);
    // 日志输出可能被伪造为错误信息
  }
}

// 安全: 规范化日志内容
import hilog from '@ohos.hilog';

function sanitizeLogMessage(message: string): string {
  return message
    .replace(/[\r\n\t]/g, ' ')  // 替换控制字符为空格
    .replace(/[^\x20-\x7E]/g, '?');  // 替换非打印字符
}

@Entry
@Component
struct LoginPage {
  @State username: string = '';

  login() {
    let safeUsername = sanitizeLogMessage(this.username);
    hilog.info(0x0000, 'LoginTag', `User login attempt: ${safeUsername}`);
  }
}

// 最佳实践: 使用结构化日志
import hilog from '@ohos.hilog';

@Entry
@Component
struct LoginPage {
  @State username: string = '';

  login() {
    // 使用对象记录结构化信息
    let logData = {
      event: 'login_attempt',
      username: this.username.substring(0, 50),  // 限制长度
      timestamp: new Date().toISOString()
    };
    hilog.info(0x0000, 'LoginTag', JSON.stringify(logData));
  }
}
```

**防护措施**:
- 移除或转义控制字符(CRLF、制表符)
- 使用结构化日志格式(JSON)
- 限制日志内容长度
- 对敏感信息进行脱敏处理

---

### CAT-0022 代码注入

ArkTS 中的动态代码执行风险。

**触发条件**:
- 使用 Web 组件的 `runJavaScript()` 执行动态代码
- 通过 `eval()` 或 `Function()` 构造器(虽然不推荐)
- 动态导入不可信模块
- Native 层的代码注入

**分析方法**:
1. 识别 `runJavaScript()` 的使用
2. 检查传递的脚本内容来源
3. 验证是否有输入验证机制

**典型漏洞模式**:
```typescript
// 危险: 动态拼接 JavaScript 代码
import web_webview from '@ohos.web.webview';

@Entry
@Component
struct Calculator {
  controller: web_webview.WebviewController = new web_webview.WebviewController();
  @State expression: string = '';

  calculate() {
    // 用户输入: "1; alert(document.cookie); "
    let script = `calculate('${this.expression}')`;
    this.controller.runJavaScript(script);
  }

  build() {
    Column() {
      Web({ src: 'local://calculator.html', controller: this.controller })
    }
  }
}

// 安全: 使用 JSON 传递数据
import web_webview from '@ohos.web.webview';

@Entry
@Component
struct Calculator {
  controller: web_webview.WebviewController = new web_webview.WebviewController();
  @State expression: string = '';

  calculate() {
    // 使用 JSON.stringify 安全传递数据
    let script = `calculate(${JSON.stringify(this.expression)})`;
    this.controller.runJavaScript(script);
  }

  build() {
    Column() {
      Web({ src: 'local://calculator.html', controller: this.controller })
    }
  }
}

// 最佳实践: 使用消息传递而非代码执行
import web_webview from '@ohos.web.webview';

@Entry
@Component
struct Calculator {
  controller: web_webview.WebviewController = new web_webview.WebviewController();
  @State expression: string = '';

  calculate() {
    // 验证输入格式
    if (!/^[0-9+\-*/().\s]+$/.test(this.expression)) {
      console.error('Invalid expression');
      return;
    }
    
    // 使用 postMessage 安全传递
    this.controller.postMessage('calculate', {
      expression: this.expression
    });
  }

  build() {
    Column() {
      Web({ src: 'local://calculator.html', controller: this.controller })
        .onMessageEvent((event) => {
          // 接收计算结果
        })
    }
  }
}
```

**防护措施**:
- 避免使用 `runJavaScript()` 执行动态代码
- 使用 `postMessage()` 进行安全的消息传递
- 对必须执行的脚本内容进行严格验证
- 使用 `JSON.stringify()` 安全传递数据
- 实施白名单机制限制可执行的操作

---

### CAT-0023 资源注入

ArkTS 中的文件路径遍历和 SSRF 风险。

**触发条件**:
- 用户输入直接用作文件路径
- URL 由用户输入构建
- 未验证文件路径的合法性

**分析方法**:
1. 识别所有文件操作和网络请求
2. 检查路径和 URL 的构建方式
3. 验证路径规范化和白名单机制

**典型漏洞模式**:
```typescript
// 危险: 路径遍历
import fs from '@ohos.file.fs';

@Entry
@Component
struct FileManager {
  @State filename: string = '';

  openFile() {
    // 用户输入: "../../../etc/sensitive_data"
    let path = `/data/storage/el2/base/files/${this.filename}`;
    let file = fs.openSync(path, fs.OpenMode.READ_ONLY);
  }
}

// 危险: SSRF
import http from '@ohos.net.http';

@Entry
@Component
struct ImageViewer {
  @State imageUrl: string = '';

  loadImage() {
    // 用户输入: "http://internal-server/admin"
    let httpRequest = http.createHttp();
    httpRequest.request(this.imageUrl);
  }
}

// 安全: 路径验证
import fs from '@ohos.file.fs';
import util from '@ohos.util';

@Entry
@Component
struct FileManager {
  @State filename: string = '';
  private readonly baseDir = '/data/storage/el2/base/files/';

  openFile() {
    // 规范化文件名,移除路径分隔符
    let safeFilename = this.filename.replace(/[/\\]/g, '');
    
    // 验证文件名格式
    if (!/^[a-zA-Z0-9_.-]+$/.test(safeFilename)) {
      console.error('Invalid filename');
      return;
    }
    
    let path = this.baseDir + safeFilename;
    
    // 验证最终路径在允许范围内
    if (!path.startsWith(this.baseDir)) {
      console.error('Path traversal detected');
      return;
    }
    
    try {
      let file = fs.openSync(path, fs.OpenMode.READ_ONLY);
      // 处理文件
    } catch (err) {
      console.error('File operation failed', err);
    }
  }
}

// 安全: URL 白名单验证
import http from '@ohos.net.http';

@Entry
@Component
struct ImageViewer {
  @State imageUrl: string = '';
  private readonly allowedDomains = ['cdn.example.com', 'images.example.com'];

  loadImage() {
    // 解析 URL
    let url: URL;
    try {
      url = new URL(this.imageUrl);
    } catch (err) {
      console.error('Invalid URL');
      return;
    }
    
    // 验证协议
    if (url.protocol !== 'https:') {
      console.error('Only HTTPS is allowed');
      return;
    }
    
    // 验证域名白名单
    if (!this.allowedDomains.includes(url.hostname)) {
      console.error('Domain not allowed');
      return;
    }
    
    // 检查内网 IP
    if (this.isInternalIP(url.hostname)) {
      console.error('Internal IP not allowed');
      return;
    }
    
    let httpRequest = http.createHttp();
    httpRequest.request(this.imageUrl);
  }
  
  private isInternalIP(hostname: string): boolean {
    // 检查私有 IP 范围
    let ipPattern = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
    return ipPattern.test(hostname);
  }
}
```

**防护措施**:
- 规范化路径并验证其在允许的范围内
- 使用白名单限制可访问的文件和 URL
- 对 URL 进行域名限制和内网 IP 检查
- 移除路径中的 `../` 等危险模式
- 使用最小权限原则访问资源

---

### CAT-0024 SQL注入

ArkTS RelationalStore 中的 SQL 注入风险。

**触发条件**:
- 字符串拼接构建 SQL 语句
- 未使用参数化查询
- 动态构建 WHERE 子句

**分析方法**:
1. 识别所有数据库操作
2. 检查 SQL 语句的构建方式
3. 验证是否使用占位符和绑定参数

**典型漏洞模式**:
```typescript
// 危险: SQL 字符串拼接
import relationalStore from '@ohos.data.relationalStore';

@Entry
@Component
struct UserList {
  @State searchName: string = '';
  private store: relationalStore.RdbStore;

  async searchUsers() {
    // 用户输入: "' OR '1'='1"
    let sql = `SELECT * FROM users WHERE name = '${this.searchName}'`;
    // 结果: SELECT * FROM users WHERE name = '' OR '1'='1'
    let resultSet = await this.store.querySql(sql);
  }
}

// 安全: 使用参数化查询
import relationalStore from '@ohos.data.relationalStore';

@Entry
@Component
struct UserList {
  @State searchName: string = '';
  private store: relationalStore.RdbStore;

  async searchUsers() {
    // 使用占位符
    let sql = 'SELECT * FROM users WHERE name = ?';
    let resultSet = await this.store.querySql(sql, [this.searchName]);
  }
}

// 最佳实践: 使用 RdbPredicates
import relationalStore from '@ohos.data.relationalStore';

@Entry
@Component
struct UserList {
  @State searchName: string = '';
  private store: relationalStore.RdbStore;

  async searchUsers() {
    // 使用 RdbPredicates 自动参数化
    let predicates = new relationalStore.RdbPredicates('users');
    predicates.equalTo('name', this.searchName);
    
    let resultSet = await this.store.query(predicates, ['id', 'name', 'email']);
  }
  
  async searchUsersWithPattern() {
    // 模糊查询也使用参数化
    let predicates = new relationalStore.RdbPredicates('users');
    predicates.like('name', `%${this.searchName}%`);
    
    let resultSet = await this.store.query(predicates);
  }
}

// 复杂查询示例
import relationalStore from '@ohos.data.relationalStore';

@Entry
@Component
struct AdvancedSearch {
  @State name: string = '';
  @State minAge: number = 0;
  @State status: string = '';
  private store: relationalStore.RdbStore;

  async searchUsers() {
    let predicates = new relationalStore.RdbPredicates('users');
    
    // 链式调用构建复杂查询
    if (this.name) {
      predicates.like('name', `%${this.name}%`);
    }
    if (this.minAge > 0) {
      predicates.greaterThanOrEqualTo('age', this.minAge);
    }
    if (this.status) {
      predicates.equalTo('status', this.status);
    }
    
    predicates.orderByAsc('name');
    predicates.limitAs(100);
    
    let resultSet = await this.store.query(predicates);
  }
}
```

**防护措施**:
- 始终使用参数化查询(占位符 `?`)
- 优先使用 `RdbPredicates` API
- 输入验证和类型检查
- 限制查询结果数量
- 使用最小权限的数据库账户
- 对敏感操作添加额外验证

---

### CWD-1113 CSV注入

ArkTS 中导出 CSV 文件的安全问题。

**触发条件**:
- 用户输入直接写入 CSV 单元格
- 未转义公式字符(`=`, `-`, `+`, `@`)
- 导出的 CSV 在 Excel 等应用中打开

**分析方法**:
1. 识别 CSV 导出操作
2. 检查用户输入是否直接写入
3. 验证是否转义危险字符

**典型漏洞模式**:
```typescript
// 危险: 未转义的 CSV 导出
import fs from '@ohos.file.fs';

@Entry
@Component
struct DataExporter {
  @State userData: Array<{name: string, email: string}> = [];

  exportToCsv() {
    let csvContent = 'Name,Email\n';
    this.userData.forEach(user => {
      // 用户输入: "=cmd|' /C calc'!A0"
      csvContent += `${user.name},${user.email}\n`;
    });
    
    let filePath = '/data/storage/el2/base/files/export.csv';
    let file = fs.openSync(filePath, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY);
    fs.writeSync(file.fd, csvContent);
    fs.closeSync(file);
  }
}

// 安全: 转义危险字符
import fs from '@ohos.file.fs';

function escapeCsvField(field: string): string {
  // 如果字段以公式字符开头,添加单引号前缀
  if (/^[=+\-@]/.test(field)) {
    field = "'" + field;
  }
  
  // 如果字段包含逗号、引号或换行符,用双引号包围并转义内部引号
  if (/[",\r\n]/.test(field)) {
    field = '"' + field.replace(/"/g, '""') + '"';
  }
  
  return field;
}

@Entry
@Component
struct DataExporter {
  @State userData: Array<{name: string, email: string}> = [];

  exportToCsv() {
    let csvContent = 'Name,Email\n';
    this.userData.forEach(user => {
      let safeName = escapeCsvField(user.name);
      let safeEmail = escapeCsvField(user.email);
      csvContent += `${safeName},${safeEmail}\n`;
    });
    
    let filePath = '/data/storage/el2/base/files/export.csv';
    let file = fs.openSync(filePath, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY);
    fs.writeSync(file.fd, csvContent);
    fs.closeSync(file);
  }
}

// 更安全的实现: 使用 CSV 库
import fs from '@ohos.file.fs';

class CsvWriter {
  private fields: string[][] = [];
  
  addRow(row: string[]) {
    this.fields.push(row.map(field => this.escapeField(field)));
  }
  
  private escapeField(field: string): string {
    // 移除或转义危险字符
    let safe = field.replace(/[\r\n]/g, ' ');
    
    // 处理公式注入
    if (/^[=+\-@]/.test(safe)) {
      safe = "'" + safe;
    }
    
    // 处理特殊字符
    if (/[",]/.test(safe)) {
      safe = '"' + safe.replace(/"/g, '""') + '"';
    }
    
    return safe;
  }
  
  toString(): string {
    return this.fields.map(row => row.join(',')).join('\n');
  }
}

@Entry
@Component
struct DataExporter {
  @State userData: Array<{name: string, email: string}> = [];

  exportToCsv() {
    let csv = new CsvWriter();
    csv.addRow(['Name', 'Email']);
    
    this.userData.forEach(user => {
      csv.addRow([user.name, user.email]);
    });
    
    let filePath = '/data/storage/el2/base/files/export.csv';
    let file = fs.openSync(filePath, fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY);
    fs.writeSync(file.fd, csv.toString());
    fs.closeSync(file);
  }
}
```

**防护措施**:
- 对以 `=`, `-`, `+`, `@` 开头的单元格添加单引号前缀
- 转义 CSV 特殊字符(逗号、引号、换行符)
- 使用安全的 CSV 处理库
- 过滤或替换危险函数名
- 提供安全导出选项说明

---

## 代码分析视角

### 污点分析
- **污点源**: 
  - `@State`/`@Prop`/`@Link` 装饰的用户输入变量
  - `router.getParams()` 获取的路由参数
  - `http.request()` 的响应数据
  - `Preferences.get()` 的存储数据
  - `RelationalStore.query()` 的查询结果
- **污点传播**: 
  - 变量赋值、函数参数传递
  - 字符串模板拼接、数组操作
  - JSON 序列化/反序列化
  - 跨 UIAbility 的数据传递
- **污点汇聚**: 
  - Web 组件的 `src`/`runJavaScript()`/`loadData()`
  - 数据库的 `querySql()`/`executeSql()`
  - 文件系统的 `openSync()`/`readSync()`
  - 网络请求的 `request()`
- **污点消毒**: 
  - 输入验证函数(`test()`/正则表达式)
  - 编码函数(`encodeURIComponent()`/`JSON.stringify()`)
  - 类型转换和白名单过滤

### 上下文分析
- **Web 上下文**: HTML内容、属性、JavaScript、CSS、URL
- **SQL 上下文**: WHERE子句、ORDER BY、LIKE模式
- **文件路径上下文**: 绝对路径、相对路径、沙箱限制
- **网络请求上下文**: URL、Header、Body

### 数据流分析
- **正向追踪**: 从 `@State` 到 `Web` 组件的完整路径
- **反向追踪**: 从 `querySql()` 回溯到用户输入源
- **跨 UIAbility 追踪**: 通过 `want.parameters` 传递的数据
- **跨模块追踪**: 通过 `import/export` 共享的数据

### 验证机制分析
- **输入验证**: 正则表达式、长度限制、类型检查
- **输出编码**: HTML转义、URL编码、SQL转义
- **参数化查询**: `RdbPredicates`、占位符 `?`
- **框架防护**: Web 组件的 CSP、JavaScript 权限控制

---

## 典型触发条件

| 注入类型 | 高频触发条件 (ArkTS) |
|---------|---------------------|
| XSS注入 | `Web({ src: userInput })`、`runJavaScript()` 拼接 |
| SQL注入 | `querySql()` 字符串拼接、未使用 `RdbPredicates` |
| 命令注入 | Native调用、文件路径拼接 `../` |
| JSON注入 | 字符串拼接构建JSON、未使用 `JSON.stringify()` |
| CRLF注入 | HTTP Header 未过滤 `\r\n` |
| 日志注入 | `hilog.info()` 直接记录用户输入 |
| 资源注入 | 文件路径未验证、URL未白名单检查 |
| 代码注入 | `runJavaScript()` 动态拼接脚本 |
| CSV注入 | 导出时未转义公式字符 `=+-@` |

---

## ArkTS 特有风险点

### UIAbility 参数传递
```typescript
// 危险: 未验证的路由参数
import router from '@ohos.router';

@Entry
@Component
struct DetailPage {
  @State userId: string = '';

  aboutToAppear() {
    let params = router.getParams() as Record<string, string>;
    this.userId = params['userId'];  // 可能被注入
    this.loadUserData();
  }

  loadUserData() {
    // 直接使用未验证的参数
    let sql = `SELECT * FROM users WHERE id = '${this.userId}'`;
  }
}

// 安全: 验证路由参数
import router from '@ohos.router';

@Entry
@Component
struct DetailPage {
  @State userId: string = '';

  aboutToAppear() {
    let params = router.getParams() as Record<string, string>;
    let rawUserId = params['userId'];
    
    // 验证参数格式
    if (rawUserId && /^[0-9]+$/.test(rawUserId)) {
      this.userId = rawUserId;
      this.loadUserData();
    } else {
      console.error('Invalid userId parameter');
      router.back();
    }
  }

  loadUserData() {
    // 使用参数化查询
    let predicates = new relationalStore.RdbPredicates('users');
    predicates.equalTo('id', this.userId);
  }
}
```

### EventHub 数据传递
```typescript
// 危险: 未验证的事件数据
import common from '@ohos.app.ability.common';

@Entry
@Component
struct ReceiverPage {
  private context = getContext(this) as common.UIAbilityContext;

  aboutToAppear() {
    this.context.eventHub.on('updateUser', (data) => {
      // 直接使用事件数据
      this.updateDatabase(data.username, data.email);
    });
  }

  updateDatabase(username: string, email: string) {
    let sql = `UPDATE users SET email = '${email}' WHERE name = '${username}'`;
  }
}

// 安全: 验证事件数据
import common from '@ohos.app.ability.common';

interface UserUpdateData {
  username: string;
  email: string;
}

@Entry
@Component
struct ReceiverPage {
  private context = getContext(this) as common.UIAbilityContext;

  aboutToAppear() {
    this.context.eventHub.on('updateUser', (data: UserUpdateData) => {
      // 验证数据结构和内容
      if (this.isValidUserData(data)) {
        this.updateDatabase(data.username, data.email);
      } else {
        console.error('Invalid user data received');
      }
    });
  }

  private isValidUserData(data: any): data is UserUpdateData {
    return typeof data === 'object' &&
           typeof data.username === 'string' &&
           typeof data.email === 'string' &&
           /^[a-zA-Z0-9_]{3,20}$/.test(data.username) &&
           /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  }

  updateDatabase(username: string, email: string) {
    let predicates = new relationalStore.RdbPredicates('users');
    predicates.equalTo('name', username);
    let valuesBucket = { email: email };
    this.store.update(valuesBucket, predicates);
  }
}
```

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+注入类型]

## 注入点与数据流
- 注入类型: [XSS/SQL注入/命令注入等]
- 注入位置: [文件:行号] [组件/函数名]
- 输入来源: [@State变量/router参数/网络响应/数据库查询等]
- 污点传播路径: [详细的数据流追踪]
- 执行上下文: [Web组件/RelationalStore/文件系统/网络请求]

## 证据链与逻辑推理
1. 代码证据: 具体代码行和数据流
2. 污点追踪: 从输入源到注入点的完整路径
3. 漏洞描述: 具体的注入漏洞机制
4. 推理: 为何导致注入攻击,ArkTS特有的风险因素

## 真实触发条件
- 输入条件: 用户如何提供恶意输入
- 数据流路径: 数据如何到达注入点
- 可利用性评估: 攻击者能否实际触发

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 攻击者控制难度,ArkTS环境限制 |
| 影响范围 | 高/中/低 | 数据泄露/XSS/文件访问/权限提升 |
| 业务影响 | 高/中/低 | 用户数据安全/应用稳定性 |

## 修改建议

### 方案一: 输入验证
```typescript
// 示例代码
function validateInput(input: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(input);
}
```
**优点**: 简单直接,早期拦截
**缺点**: 可能过于严格,影响用户体验

### 方案二: 使用安全API (推荐)
```typescript
// 示例代码
let predicates = new relationalStore.RdbPredicates('users');
predicates.equalTo('name', username);
```
**优点**: 框架级防护,不易出错
**缺点**: 需要重构现有代码

## ArkTS 特有防护建议
- 使用 `RdbPredicates` 替代字符串拼接 SQL
- Web 组件启用严格的安全配置
- 对 router 参数进行强制验证
- EventHub 数据传递前验证类型和格式
- 启用 TypeScript 严格模式增强类型安全

## 边界与不确定性
- 确定事实: [已确认的代码问题]
- 不确定假设: [需要运行时验证的情况]
- 建议调查点: [需要进一步检查的代码路径]
```

---

## 典型误报场景

不应报告:
- `RdbPredicates` API 的正确使用
- 使用 `JSON.stringify()` 构建 JSON
- Web 组件中使用 `JSON.stringify()` 传递数据给 JavaScript
- 输入经过正则表达式严格验证后的使用
- 框架提供的自动转义机制(如 ArkUI 的数据绑定)
- 使用白名单验证的文件路径
- 内部固定数据流,非外部可触发
- 已被安全函数处理的输出
- TypeScript 类型系统提供的安全保障

---

## 非"执行逻辑"

本文档仅作知识参考和结构化指南,不执行代码、自动扫描、生成修复脚本或最终裁决。分析者应结合 ArkTS 语言特性、HarmonyOS 框架能力和具体业务场景进行推理,非机械匹配。

---

**文档版本**: v1.0 | **适用语言**: ArkTS (HarmonyOS) 