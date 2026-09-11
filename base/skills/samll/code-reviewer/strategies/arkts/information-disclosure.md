# ArkTS敏感信息分析指导文档

## 能力目标

基于敏感信息生命周期和数据流分析,判断真实信息泄露风险,识别可达的泄露点,区分合法数据处理和恶意泄露。

---

## 前置判断

获取:
- 敏感信息类型:密码/密钥/令牌/个人信息/配置信息/调试信息/HarmonyOS特有敏感数据
- 数据存储位置:内存/Preferences/RelationalStore/分布式数据/日志/配置文件
- 传输方式:HTTP/HTTPS/DataAbility/IPC/FA通信/Stage模型通信
- 生命周期:创建/使用/存储/传输/销毁
- 访问控制:权限/加密/脱敏/审计日志
- 数据流路径:从生成到销毁的完整传递链

---

## 分析流程

### Step 1 — 识别敏感信息产生点
定位敏感信息的生成和存储:
- 用户输入:密码、手机号、身份证号、设备信息
- 配置信息:AppKey、AppSecret、OAuth令牌、API密钥
- 系统信息:UDID、IMEI、MAC地址、位置信息
- 调试信息:hilog输出、异常详情、内部状态
- 临时数据:缓冲区、缓存、中间计算结果
- HarmonyOS特有:分布式设备ID、Ability上下文信息

### Step 2 — 追踪敏感信息数据流
- 正向追踪:从敏感信息产生到所有可能的输出位置
- 反向追踪:从日志/错误信息/响应回溯数据来源
- 跨边界追踪:识别跨Ability、跨FA/Stage、跨设备的数据传递
- 转换点追踪:记录数据格式转换、编码、解码节点

### Step 3 — 验证防护机制
- 加密保护:网络传输加密、存储加密(HUKS)
- 脱敏处理:日志脱敏、响应脱敏、显示脱敏
- 访问控制:权限验证、最小权限原则
- 清理机制:内存清零、Preferences清理、数据库清理
- 安全配置:不回显密码、隐藏敏感配置

### Step 4 — 判断真实泄露风险
- 可达性:泄露点是否可被外部访问
- 暴露范围:泄露数据的完整性和敏感性
- 可利用性:攻击者能否获取泄露信息
- 影响评估:泄露后的潜在危害

---

## 风险模式分类

### CWD-1275 错误消息中包含敏感信息
应用程序在错误消息中暴露敏感信息,如调试信息、内部路径、数据库详情等。

**触发条件**:
- 异常堆栈跟踪直接返回给用户
- 错误消息包含文件路径、行号或系统信息
- RelationalStore错误消息暴露表结构、字段名
- 系统错误消息包含设备信息、版本号
- 错误处理未区分开发和生产环境

**分析方法**:
1. 识别所有异常处理和错误响应位置
2. 检查异常信息是否直接输出到用户界面
3. 验证是否有错误消息脱敏机制
4. 区分开发和生产环境的错误处理逻辑

**典型漏洞模式**:
```typescript
// 危险: 直接暴露异常堆栈给用户
import promptAction from '@ohos.promptAction';

try {
  // 数据库操作
  rdbStore.executeSql(sql);
} catch (err) {
  // 直接显示完整错误信息
  promptAction.showToast({
    message: `错误: ${err.message}\n堆栈: ${err.stack}`
  });
}

// 危险: 网络请求错误暴露详细信息
httpRequest.request(url, (err, data) => {
  if (err) {
    // 暴露内部URL、参数等
    console.error(`请求失败: ${url}, 错误: ${JSON.stringify(err)}`);
    this.errorMsg = `网络错误: ${err.code} - ${err.data}`;
  }
});

// 安全: 统一错误处理
class ErrorHandler {
  static handle(err: BusinessError, context: string): string {
    // 记录详细日志到文件
    hilog.error(0x0000, 'ErrorHandler', `${context}: ${err.message}`);
    
    // 返回用户友好的通用消息
    return '操作失败,请稍后重试';
  }
}

try {
  rdbStore.executeSql(sql);
} catch (err) {
  let userMsg = ErrorHandler.handle(err as BusinessError, '数据库操作');
  promptAction.showToast({ message: userMsg });
}
```

**防护措施**:
- 实现统一的异常处理机制,不向用户暴露内部信息
- 生产环境禁用详细错误输出,记录到hilog
- 使用通用错误消息,具体信息仅记录到日志文件
- 对错误信息进行分类,区分用户错误和系统错误
- 实施错误消息脱敏规则

---

### CWD-1276 调试代码中插入敏感信息
调试或测试代码中硬编码敏感信息,导致信息泄露。

**触发条件**:
- 源代码中硬编码AppKey、AppSecret、OAuth令牌
- 注释中包含测试账号密码
- hilog输出包含敏感数据
- 测试数据使用真实凭证
- config.json或module.json5包含敏感配置

**分析方法**:
1. 搜索常见敏感信息关键词:password、secret、token、appKey、appSecret
2. 检查代码中的字符串常量是否包含敏感信息
3. 验证是否有调试代码未清理
4. 检查配置文件和测试文件

**典型漏洞模式**:
```typescript
// 危险: 硬编码AppKey和AppSecret
export class ApiConfig {
  static readonly APP_KEY = 'a1b2c3d4e5f6g7h8';
  static readonly APP_SECRET = 'sk_live_1234567890abcdef';
  static readonly API_URL = 'https://api.example.com';
}

// 危险: 注释中的敏感信息
// TODO: 测试账号 user: admin, pass: admin@123
// 生产环境AppSecret: sk_prod_xyz789abc456def

// 危险: hilog输出敏感信息
hilog.info(0x0000, 'Login', `用户登录: ${username}, 密码: ${password}`);
hilog.debug(0x0000, 'API', `请求Token: ${authToken}`);

// 危险: Preferences中硬编码密钥
const preferences = await dataPreferences.getPreferences(context, 'myStore');
await preferences.put('encryption_key', 'hardcoded_key_12345');

// 安全: 使用环境变量或加密存储
import { EnvironmentVariable } from '@ohos.application.EnvironmentVariable';

export class ApiConfig {
  static getAppKey(): string {
    return EnvironmentVariable.getSync('APP_KEY') || '';
  }
  
  static getAppSecret(): string {
    // 从HUKS获取密钥
    return HuksManager.getSecret('APP_SECRET');
  }
}

// 安全: 不记录敏感信息
hilog.info(0x0000, 'Login', `用户 ${username} 登录成功`);
// 密码不记录到日志

// 安全: 使用HUKS存储密钥
import huks from '@ohos.security.huks';

async function storeSecretKey(alias: string, key: Uint8Array) {
  const options = {
    properties: [
      { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
      { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 }
    ],
    inData: key
  };
  await huks.importKeyItem(alias, options);
}
```

**防护措施**:
- 使用环境变量或HUKS密钥管理系统存储敏感信息
- 使用.gitignore排除包含敏感信息的文件
- 实施预提交检查,阻止敏感信息提交
- 使用秘密扫描工具检测代码中的敏感信息
- 使用占位符或示例数据替代真实凭证
- 定期审计hilog日志输出

---

### CWD-1277 序列化类中包含敏感信息
可序列化的类中包含敏感字段,导致敏感信息被序列化传输或存储。

**触发条件**:
- 序列化对象包含密码、密钥、令牌
- Preferences存储包含敏感信息的对象
- FA间通信传递敏感数据
- 分布式数据同步包含敏感信息
- Want参数包含未加密的敏感数据

**分析方法**:
1. 识别所有序列化对象和数据传递
2. 检查类中的字段是否包含敏感信息
3. 验证序列化数据的存储和传输方式
4. 检查Want、AbilityResult等数据载体

**典型漏洞模式**:
```typescript
// 危险: 用户对象包含敏感信息直接序列化
interface User {
  username: string;
  password: string;      // 敏感信息
  creditCard: string;    // 敏感信息
  sessionToken: string;  // 敏感信息
}

// 直接存储到Preferences
const user: User = {
  username: 'john',
  password: 'password123',
  creditCard: '1234-5678-9012-3456',
  sessionToken: 'token_abc123'
};
await preferences.put('current_user', JSON.stringify(user));

// 危险: Want传递敏感信息
let want: Want = {
  bundleName: 'com.example.app',
  abilityName: 'MainAbility',
  parameters: {
    password: userPassword,
    apiKey: 'sk-1234567890'
  }
};
await context.startAbility(want);

// 危险: 分布式数据包含敏感信息
const kvStore = await distributedKVStore.getKVStore('user_store', {
  createIfMissing: true,
  encrypt: false,  // 未加密
  autoSync: true   // 自动同步到其他设备
});
await kvStore.put('user_credentials', JSON.stringify({
  username: 'admin',
  password: 'admin123'
}));

// 安全: 分离敏感和非敏感数据
interface UserPublic {
  username: string;
  nickname: string;
  avatar: string;
}

interface UserPrivate {
  passwordHash: string;  // 存储哈希而非明文
  sessionToken: string;
}

// 仅存储公开信息到Preferences
await preferences.put('user_public', JSON.stringify(userPublic));

// 敏感信息加密后存储
const encryptedPrivate = await encryptData(JSON.stringify(userPrivate));
await preferences.put('user_private_encrypted', encryptedPrivate);

// 安全: Want传递时使用加密或令牌
let want: Want = {
  bundleName: 'com.example.app',
  abilityName: 'MainAbility',
  parameters: {
    userToken: generateTempToken(),  // 临时令牌
    timestamp: Date.now()
  }
};

// 安全: 分布式数据加密
const kvStore = await distributedKVStore.getKVStore('user_store', {
  createIfMissing: true,
  encrypt: true,  // 启用加密
  autoSync: false // 敏感数据不自动同步
});
```

**防护措施**:
- 分离敏感和非敏感数据,避免混合存储
- 敏感数据加密后再序列化
- 使用HUKS进行密钥管理和数据加密
- FA/Ability通信时避免传递敏感原始数据
- 分布式数据启用加密,敏感数据不自动同步
- 使用临时令牌替代长期凭证

---

### CWD-1278 缓存中包含敏感信息
缓存机制存储了敏感信息,导致信息泄露风险。

**触发条件**:
- HTTP响应头缓存敏感信息
- Image组件缓存敏感图片
- Web组件缓存包含敏感数据的页面
- Preferences缓存未加密的敏感信息
- 内存缓存包含用户凭证

**分析方法**:
1. 识别所有缓存机制:Preferences、文件缓存、内存缓存、Web缓存
2. 检查缓存的数据内容是否包含敏感信息
3. 验证缓存数据是否加密
4. 检查缓存清理机制

**典型漏洞模式**:
```typescript
// 危险: 敏感信息缓存到Preferences
import dataPreferences from '@ohos.data.preferences';

const preferences = await dataPreferences.getPreferences(context, 'userCache');
await preferences.put('user_password', password);
await preferences.put('credit_card', cardNumber);

// 危险: Web组件缓存敏感页面
@Component
struct WebPage {
  controller: WebviewController = new webview.WebviewController();
  
  build() {
    Web({ 
      src: 'https://bank.example.com/account',
      controller: this.controller 
    })
    .cacheMode(CacheMode.Default) // 默认缓存,可能缓存敏感信息
  }
}

// 危险: Image缓存敏感图片
Image('https://api.example.com/user/id-card.jpg')
  .syncLoad(false)  // 会缓存到本地

// 危险: 全局变量缓存敏感信息
class GlobalCache {
  static userPassword: string = '';
  static apiToken: string = '';
  static sessionData: object = {};
}

// 安全: 敏感信息加密后缓存
import cryptoFramework from '@ohos.security.cryptoFramework';

class SecureCache {
  private static async encrypt(data: string): Promise<string> {
    // 使用HUKS密钥加密
    const cipher = cryptoFramework.createCipher('AES256|GCM|PKCS7');
    // ... 加密实现
    return encryptedData;
  }
  
  static async put(key: string, value: string) {
    const encrypted = await this.encrypt(value);
    await preferences.put(key, encrypted);
  }
}

// 安全: Web组件禁用敏感页面缓存
@Component
struct SecureWebPage {
  controller: WebviewController = new webview.WebviewController();
  
  build() {
    Web({ 
      src: 'https://bank.example.com/account',
      controller: this.controller 
    })
    .cacheMode(CacheMode.None)  // 禁用缓存
    .javaScriptAccess(false)    // 限制JS访问
  }
}

// 安全: 敏感图片不缓存
Image('https://api.example.com/user/id-card.jpg')
  .syncLoad(true)   // 同步加载
  .objectFit(ImageFit.Cover)
  // 使用完后及时清理

// 安全: 使用加密内存缓存
class SecureMemoryCache {
  private cache: Map<string, Uint8Array> = new Map();
  
  set(key: string, value: string) {
    const encrypted = this.encryptInMemory(value);
    this.cache.set(key, encrypted);
  }
  
  clear() {
    this.cache.clear();
  }
}
```

**防护措施**:
- 敏感信息缓存前进行加密
- Web组件对敏感页面禁用缓存
- 敏感图片使用加密传输,不本地缓存
- 实施缓存过期和清理机制
- 应用退出时清理所有敏感缓存
- 避免在全局变量中存储敏感信息

---

### CWD-1280 日志中包含敏感信息
日志文件中记录了敏感信息,导致信息泄露。

**触发条件**:
- hilog直接记录用户输入而未过滤
- 日志记录请求参数(如password字段)
- 日志包含完整的HTTP请求/响应
- 日志记录设备信息、UDID、位置信息
- 日志文件权限过宽,可被未授权访问

**分析方法**:
1. 识别所有hilog调用
2. 检查日志内容是否包含用户输入或敏感数据
3. 验证日志文件的访问权限
4. 检查日志在不同环境的配置

**典型漏洞模式**:
```typescript
import hilog from '@ohos.hilog';

// 危险: 直接记录所有请求参数
hilog.info(0x0000, 'Network', `请求: ${JSON.stringify(requestParams)}`);

// 危险: 记录密码字段
hilog.info(0x0000, 'Login', 
  `用户登录: username=${username}, password=${password}`);

// 危险: 记录认证令牌
hilog.debug(0x0000, 'Auth', 
  `Authorization: Bearer ${accessToken}`);

// 危险: 记录设备敏感信息
import deviceInfo from '@ohos.deviceInfo';
hilog.info(0x0000, 'Device', 
  `设备信息: UDID=${deviceInfo.udid}, Serial=${deviceInfo.serial}`);

// 危险: 记录完整异常堆栈
try {
  await rdbStore.executeSql(sql);
} catch (err) {
  hilog.error(0x0000, 'Database', 
    `SQL错误: ${sql}\n${err.stack}`); // 可能暴露表结构
}

// 安全: 实施日志脱敏
class SecureLogger {
  private static sensitiveFields = ['password', 'token', 'secret', 'key', 'card'];
  
  static sanitize(obj: any): any {
    if (typeof obj !== 'object') return obj;
    
    const sanitized = { ...obj };
    for (const field of this.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }
    return sanitized;
  }
  
  static info(domain: number, tag: string, data: any) {
    const sanitized = this.sanitize(data);
    hilog.info(domain, tag, JSON.stringify(sanitized));
  }
}

// 使用脱敏日志
SecureLogger.info(0x0000, 'Login', {
  username: username,
  password: password,  // 会被自动脱敏
  timestamp: Date.now()
});

// 安全: 仅记录必要信息
hilog.info(0x0000, 'Login', `用户 ${username} 登录成功`);
// 不记录密码

// 安全: 异常处理脱敏
try {
  await rdbStore.executeSql(sql);
} catch (err) {
  hilog.error(0x0000, 'Database', 
    `数据库操作失败: 错误码 ${err.code}`);
  // 详细堆栈仅在开发环境记录
  if (__DEV__) {
    hilog.debug(0x0000, 'Database', err.stack);
  }
}

// 安全: 条件日志
const LOG_LEVEL = AppStorage.Get('logLevel') || 'INFO';

function logDebug(tag: string, message: string) {
  if (LOG_LEVEL === 'DEBUG' && __DEV__) {
    hilog.debug(0x0000, tag, message);
  }
}
```

**防护措施**:
- 实施日志脱敏策略,过滤敏感字段
- 使用白名单而非黑名单记录字段
- 生产环境降低日志级别,避免DEBUG日志
- 定期清理日志文件
- 对敏感操作使用审计日志而非普通日志
- 实现统一的日志框架,集中管理脱敏规则

---

### CWD-1281 在源代码中包含敏感信息
源代码文件中硬编码或注释中包含敏感信息。

**触发条件**:
- 源代码中硬编码数据库连接字符串
- config.json或module.json5中包含AppKey
- 注释中包含测试账号或内部信息
- ArkTS文件中硬编码API端点和密钥
- 资源文件(rawfile)中包含敏感配置

**分析方法**:
1. 扫描ArkTS源代码中的字符串常量
2. 检查配置文件中的敏感字段
3. 搜索常见敏感信息模式
4. 验证资源文件内容

**典型漏洞模式**:
```typescript
// 危险: 硬编码数据库配置
export const DB_CONFIG = {
  host: '192.168.1.100',
  port: 3306,
  database: 'production_db',
  user: 'admin',
  password: 'P@ssw0rd123!'
};

// 危险: config.json包含敏感信息
{
  "app": {
    "bundleName": "com.example.app",
    "vendor": "example",
    "version": {
      "code": 1000000,
      "name": "1.0.0"
    }
  },
  "apiConfig": {
    "appKey": "1234567890abcdef",
    "appSecret": "secret_key_xyz789",
    "baseUrl": "https://api.example.com"
  }
}

// 危险: 注释中的敏感信息
/**
 * API配置
 * 测试环境: https://test-api.example.com
 * 测试账号: test@example.com / Test@123
 * 生产AppSecret: sk_live_abcdef123456
 */
export class ApiService {
  // ...
}

// 危险: rawfile中的配置文件
// resources/rawfile/config.json
{
  "server": {
    "url": "https://api.example.com",
    "apiKey": "ak-1234567890",
    "apiSecret": "as-abcdefghijk"
  }
}

// 安全: 使用环境变量
import { EnvironmentVariable } from '@ohos.app.ability.EnvironmentVariable';

export class Config {
  static getDbConfig() {
    return {
      host: EnvironmentVariable.getSync('DB_HOST'),
      port: parseInt(EnvironmentVariable.getSync('DB_PORT') || '3306'),
      user: EnvironmentVariable.getSync('DB_USER'),
      password: EnvironmentVariable.getSync('DB_PASSWORD')
    };
  }
}

// 安全: 配置文件使用占位符
// config.json
{
  "app": {
    "bundleName": "com.example.app"
  }
}

// 实际配置在运行时从服务器获取或使用HUKS存储
export class ApiConfig {
  private static config: any = null;
  
  static async load() {
    // 从安全存储加载配置
    this.config = await loadFromSecureStorage();
  }
  
  static getAppKey(): string {
    return this.config?.appKey || '';
  }
}

// 安全: 示例配置文件
// config.example.json
{
  "server": {
    "url": "YOUR_API_URL",
    "apiKey": "YOUR_API_KEY",
    "apiSecret": "YOUR_API_SECRET"
  }
}

// .gitignore
config.json
resources/rawfile/config.json
```

**防护措施**:
- 使用环境变量或运行时配置
- 提供示例配置文件,排除实际配置
- 使用.gitignore排除敏感文件
- 使用HUKS或加密Preferences存储密钥
- 配置从服务器动态获取
- 实施代码审查,检查硬编码敏感信息

---

### CWD-1288 敏感信息在存储或传输前处理不当
敏感信息在存储或传输前未进行适当的加密、编码或脱敏处理。

**触发条件**:
- 密码以明文形式存储到Preferences
- 敏感信息未加密传输(HTTP而非HTTPS)
- 使用弱加密算法或已废弃方法
- RelationalStore存储明文密码
- 分布式数据未启用加密

**分析方法**:
1. 识别所有敏感信息的存储和传输点
2. 检查存储是否使用加密或哈希
3. 验证传输是否使用HTTPS
4. 检查加密算法和密钥管理
5. 验证是否使用HUKS管理密钥

**典型漏洞模式**:
```typescript
import dataPreferences from '@ohos.data.preferences';
import relationalStore from '@ohos.data.relationalStore';
import http from '@ohos.net.http';

// 危险: 密码明文存储到Preferences
const preferences = await dataPreferences.getPreferences(context, 'user');
await preferences.put('password', userPassword);

// 危险: 明文传输敏感信息
const httpRequest = http.createHttp();
httpRequest.request('http://api.example.com/user', {
  method: http.RequestMethod.POST,
  extraData: {
    username: username,
    password: password,  // HTTP明文传输
    creditCard: cardNumber
  }
});

// 危险: 数据库存储明文密码
const store = await relationalStore.getRdbStore(context, {
  name: 'user.db',
  securityLevel: relationalStore.SecurityLevel.S1
});

const values = {
  username: username,
  password: password,  // 明文存储
  email: email
};
await store.insert('users', values);

// 危险: 使用弱加密
import cryptoFramework from '@ohos.security.cryptoFramework';

// MD5已不安全
function weakHash(data: string): string {
  const md = cryptoFramework.createMd('MD5');
  // ...
  return md.digest();
}

// 安全: 使用哈希存储密码
import cryptoFramework from '@ohos.security.cryptoFramework';

async function hashPassword(password: string, salt: string): Promise<string> {
  const pbkdf2 = cryptoFramework.createKdf('PBKDF2|SHA256');
  const spec: cryptoFramework.PBKDF2Spec = {
    algName: 'PBKDF2',
    password: new Uint8Array(Buffer.from(password)),
    salt: new Uint8Array(Buffer.from(salt)),
    iterations: 10000,
    keySize: 32
  };
  const key = await pbkdf2.generateSecret(spec);
  return Buffer.from(key.data).toString('hex');
}

// 存储哈希后的密码
const salt = generateSalt();
const passwordHash = await hashPassword(password, salt);
await preferences.put('password_hash', passwordHash);
await preferences.put('salt', salt);

// 安全: HTTPS传输敏感信息
const httpRequest = http.createHttp();
httpRequest.request('https://api.example.com/user', {  // HTTPS
  method: http.RequestMethod.POST,
  extraData: {
    username: username,
    passwordHash: passwordHash  // 传输哈希而非明文
  }
});

// 安全: 使用HUKS加密存储
import huks from '@ohos.security.huks';

async function encryptWithHuks(alias: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const encryptOptions: huks.HuksOptions = {
    properties: [
      { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
      { tag: huks.HuksTag.HUKS_TAG_PURPOSE, value: huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT },
      { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 },
      { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_PKCS7 },
      { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_GCM }
    ],
    inData: plaintext
  };
  
  const result = await huks.initSession(alias, encryptOptions);
  const encrypted = await huks.finishSession(result.handle, encryptOptions);
  return encrypted.outData;
}

// 使用HUKS加密后存储
const sensitiveData = new Uint8Array(Buffer.from(JSON.stringify(userData)));
const encrypted = await encryptWithHuks('user_data_key', sensitiveData);
await preferences.put('user_data', Buffer.from(encrypted).toString('base64'));
```

**防护措施**:
- 密码使用强哈希算法(PBKDF2、Argon2)存储
- 敏感信息使用HUKS进行加密存储
- 传输时使用HTTPS
- 禁用弱加密算法(MD5、DES)
- 使用AES-256-GCM等强加密算法
- 定期轮换加密密钥

---

### CWD-1289 敏感信息使用完毕后未清理
敏感信息在内存中保留超过必要时间,存在泄露风险。

**触发条件**:
- 密码字符串使用后未清理
- 敏感缓冲区复用前未清理
- 页面销毁时未清理敏感状态
- Ability销毁时未清理缓存
- 全局变量中的敏感信息未清除

**分析方法**:
1. 识别所有敏感信息的内存使用
2. 检查组件生命周期的清理操作
3. 验证Ability生命周期的清理
4. 追踪敏感数据的释放路径

**典型漏洞模式**:
```typescript
// 危险: 页面状态中的敏感信息未清理
@Entry
@Component
struct LoginPage {
  @State username: string = '';
  @State password: string = '';  // 敏感信息
  @State token: string = '';     // 敏感信息
  
  async login() {
    this.token = await authService.login(this.username, this.password);
    router.pushUrl({ url: 'pages/Home' });
    // password和token仍在内存中
  }
  
  build() {
    // ...
  }
}

// 危险: 全局存储未清理
class GlobalState {
  static currentUser: any = null;
  static authToken: string = '';
  static sessionData: any = {};
}

// 危险: Ability中敏感数据未清理
export default class EntryAbility extends UIAbility {
  private userPassword: string = '';
  private apiKeys: string[] = [];
  
  onDestroy() {
    // 未清理敏感数据
    hilog.info(0x0000, 'Ability', 'Ability销毁');
  }
}

// 安全: 组件销毁时清理敏感信息
@Entry
@Component
struct SecureLoginPage {
  @State username: string = '';
  @State password: string = '';
  @State token: string = '';
  
  async login() {
    try {
      this.token = await authService.login(this.username, this.password);
      // 立即清理密码
      this.password = '';
      
      // 存储token到安全位置
      await SecureStorage.setToken(this.token);
      
      // 清理内存中的token
      this.token = '';
      
      router.pushUrl({ url: 'pages/Home' });
    } catch (err) {
      this.password = '';  // 失败时也要清理
    }
  }
  
  aboutToDisappear() {
    // 页面销毁时确保清理
    this.password = '';
    this.token = '';
  }
  
  build() {
    // ...
  }
}

// 安全: 提供清理方法
class SecureGlobalState {
  private static data: Map<string, any> = new Map();
  
  static set(key: string, value: any) {
    this.data.set(key, value);
  }
  
  static get(key: string): any {
    return this.data.get(key);
  }
  
  static clear() {
    this.data.clear();
  }
  
  static clearSensitive() {
    const sensitiveKeys = ['token', 'password', 'secret'];
    for (const key of sensitiveKeys) {
      this.data.delete(key);
    }
  }
}

// 安全: Ability清理敏感数据
export default class SecureAbility extends UIAbility {
  private sensitiveData: Map<string, any> = new Map();
  
  onDestroy() {
    // 清理所有敏感数据
    this.sensitiveData.clear();
    SecureGlobalState.clear();
    
    // 清理Preferences中的临时数据
    this.clearPreferences();
    
    hilog.info(0x0000, 'Ability', 'Ability销毁,已清理敏感数据');
  }
  
  private async clearPreferences() {
    const preferences = await dataPreferences.getPreferences(this.context, 'temp');
    await preferences.clear();
    await preferences.flush();
  }
}
```

**防护措施**:
- 敏感信息使用后立即清理
- 在组件aboutToDisappear()中清理敏感状态
- 在Ability onDestroy()中清理所有敏感数据
- 使用完毕后清空全局变量中的敏感信息
- 实现统一的敏感数据管理类
- 定期检查内存中的敏感信息残留

---

### CWD-1286 持久性存储中包含敏感信息
Preferences或数据库中长期存储敏感信息,增加信息泄露风险。

**触发条件**:
- Preferences包含明文密码或令牌
- 未设置过期时间的长期令牌
- 数据库存储完整的信用卡号
- 分布式数据包含敏感信息且自动同步
- 备份文件包含敏感数据

**分析方法**:
1. 识别所有持久化存储操作
2. 检查存储内容是否包含敏感信息
3. 验证存储的安全属性和加密
4. 检查数据的生命周期管理

**典型漏洞模式**:
```typescript
import dataPreferences from '@ohos.data.preferences';
import relationalStore from '@ohos.data.relationalStore';

// 危险: Preferences存储明文敏感信息
const preferences = await dataPreferences.getPreferences(context, 'userInfo');
await preferences.put('user_password', password);
await preferences.put('credit_card', '1234-5678-9012-3456');
await preferences.put('api_token', longLivedToken);

// 危险: 数据库存储完整敏感信息
const store = await relationalStore.getRdbStore(context, {
  name: 'payment.db',
  securityLevel: relationalStore.SecurityLevel.S1
});

await store.insert('cards', {
  cardNumber: '1234567890123456',  // 完整卡号
  cvv: '123',                       // CVV
  expiryDate: '12/25'
});

// 危险: 分布式数据自动同步敏感信息
const kvStore = await distributedKVStore.getKVStore('user_data', {
  createIfMissing: true,
  encrypt: false,
  autoSync: true,  // 自动同步到其他设备
  kvStoreType: distributedKVStore.KVStoreType.DEVICE_COLLABORATION
});

await kvStore.put('user_credentials', JSON.stringify({
  username: 'admin',
  password: 'password123',
  token: 'long_lived_token'
}));

// 安全: 使用HUKS加密存储
class SecurePreferences {
  private static async encrypt(data: string): Promise<string> {
    const plainData = new Uint8Array(Buffer.from(data));
    const encrypted = await encryptWithHuks('app_data_key', plainData);
    return Buffer.from(encrypted).toString('base64');
  }
  
  private static async decrypt(encrypted: string): Promise<string> {
    const encryptedData = new Uint8Array(Buffer.from(encrypted, 'base64'));
    const decrypted = await decryptWithHuks('app_data_key', encryptedData);
    return Buffer.from(decrypted).toString('utf8');
  }
  
  static async putSecure(preferences: dataPreferences.Preferences, 
                         key: string, value: string) {
    const encrypted = await this.encrypt(value);
    await preferences.put(key, encrypted);
  }
  
  static async getSecure(preferences: dataPreferences.Preferences, 
                         key: string): Promise<string> {
    const encrypted = await preferences.get(key, '');
    if (!encrypted) return '';
    return await this.decrypt(encrypted as string);
  }
}

// 使用加密存储
await SecurePreferences.putSecure(preferences, 'api_token', token);

// 安全: 数据库存储Token化的敏感信息
const tokenizedCard = await tokenizeCardNumber(cardNumber);
await store.insert('cards', {
  cardToken: tokenizedCard,  // Token而非原始卡号
  lastFourDigits: cardNumber.slice(-4),
  expiryDate: expiryDate
});

// 安全: 敏感数据不自动同步
const kvStore = await distributedKVStore.getKVStore('user_data', {
  createIfMissing: true,
  encrypt: true,     // 启用加密
  autoSync: false,   // 禁用自动同步
  backup: false      // 禁用备份
});

// 存储时进一步加密
const encryptedData = await encryptSensitiveData(userData);
await kvStore.put('user_data', encryptedData);

// 安全: 使用短期令牌
interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

class TokenManager {
  static async saveToken(token: TokenInfo) {
    // 仅存储加密的短期令牌
    const encrypted = await this.encrypt(JSON.stringify(token));
    await preferences.put('token_data', encrypted);
  }
  
  static async getToken(): Promise<TokenInfo | null> {
    const encrypted = await preferences.get('token_data', '');
    if (!encrypted) return null;
    
    const tokenInfo = JSON.parse(await this.decrypt(encrypted as string));
    
    // 检查是否过期
    if (Date.now() > tokenInfo.expiresAt) {
      await this.clearToken();
      return null;
    }
    
    return tokenInfo;
  }
  
  static async clearToken() {
    await preferences.delete('token_data');
  }
}
```

**防护措施**:
- Preferences中仅存储加密的敏感信息
- 使用HUKS管理加密密钥
- 数据库使用Token化处理敏感数据
- 设置合理的数据过期时间
- 分布式敏感数据禁用自动同步
- 定期清理过期的敏感数据
- 备份时排除敏感信息

---

## HarmonyOS特有风险

### 分布式数据泄露
HarmonyOS的分布式能力可能导致敏感数据意外同步到其他设备。

**防护措施**:
- 敏感数据禁用分布式同步
- 使用设备认证和数据加密
- 限制跨设备数据访问权限

### Ability间数据传递泄露
FA或Stage模型中Ability间传递数据可能泄露敏感信息。

**防护措施**:
- Want参数避免传递敏感原始数据
- 使用临时令牌或加密数据
- 验证目标Ability的可信性

### Web组件安全风险
Web组件可能缓存或暴露敏感信息。

**防护措施**:
- 敏感页面禁用缓存
- 限制JavaScript访问权限
- 使用安全的通信通道

---

## 代码分析视角

### 数据流分析
- **敏感源识别**: 用户输入、设备信息、Preferences、数据库
- **污点追踪**: 从敏感源追踪到hilog、网络、存储、跨Ability传递
- **汇聚点分析**: hilog、HTTP请求、Want参数、Preferences、数据库
- **清理验证**: aboutToDisappear、onDestroy中的清理操作

### 生命周期分析
- **Ability生命周期**: onCreate、onDestroy中的敏感数据处理
- **Component生命周期**: aboutToAppear、aboutToDisappear中的数据清理
- **数据持久化**: Preferences、数据库的加密和清理
- **分布式同步**: 跨设备数据传输的安全性

### 安全控制分析
- **HUKS使用**: 密钥管理和数据加密
- **权限控制**: 敏感权限的申请和使用
- **网络安全**: HTTPS使用和证书验证
- **日志脱敏**: hilog输出的敏感信息过滤

---

## 典型触发条件

| 泄露类型 | 高频触发条件 |
|---------|-------------|
| 错误消息泄露 | 异常直接显示给用户、hilog记录完整堆栈 |
| 调试代码泄露 | 硬编码AppKey、hilog输出敏感数据 |
| 序列化泄露 | Want传递明文密码、分布式同步敏感数据 |
| 缓存泄露 | Preferences明文存储、Web组件缓存敏感页面 |
| 日志泄露 | hilog记录密码、设备UDID等 |
| 源代码泄露 | 硬编码配置、注释中的凭证 |
| 存储传递不当 | Preferences明文存储、HTTP传输 |
| 未清理敏感信息 | 页面销毁未清理状态、Ability销毁未清理数据 |
| 持久性存储泄露 | 长期存储明文令牌、分布式自动同步 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+泄露类型]

## 敏感信息与泄露点
- 敏感信息类型: [密码/密钥/个人信息/设备信息等]
- 产生位置: [文件:行号] [组件/Ability名称]
- 泄露点: [hilog/网络请求/Preferences/分布式数据等]
- 数据流路径: [详细的数据流追踪]

## 证据链与逻辑推理
1. 代码证据: 具体代码行和敏感信息
2. 数据流追踪: 从产生到泄露的完整路径
3. 漏洞描述: 具体的信息泄露风险
4. 推理: 为何导致信息泄露

## 真实触发条件
输入条件、数据流路径、可利用性评估

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 攻击者获取难度 |
| 信息敏感性 | 高/中/低 | 数据敏感程度 |
| 影响范围 | 高/中/低 | 账户接管/数据泄露/设备控制 |
| 合规性影响 | 高/中/低 | 个人信息保护法/数据安全法 |

## 修改建议
### 方案一: 使用HUKS加密存储
```typescript
// 代码示例
```
优点: 安全性高、密钥管理规范
缺点: 实现复杂度较高

### 方案二: 实施日志脱敏
```typescript
// 代码示例
```
优点: 实现简单、立即生效
缺点: 需要维护脱敏规则

推荐: 方案一(长期)+ 方案二(短期)

## 边界与不确定性
- 确定事实: [已确认的问题]
- 不确定假设: [需要验证的点]
- 建议调查点: [需要进一步检查的地方]
```

---

## 非"执行逻辑"

本文档仅作知识参考和结构化指南,不执行代码、自动扫描、生成修复脚本或最终裁决。模型应结合具体业务场景推理,非机械匹配。

---

## 典型误报场景

不应报告:
- 使用HUKS或加密Preferences的正确实现
- 配置文件已排除或使用占位符
- hilog已实施脱敏过滤
- 分布式数据已启用加密且禁用自动同步
- 使用HTTPS和证书验证的网络请求
- 使用强哈希(PBKDF2、Argon2)的正确实现
- 组件和Ability生命周期正确清理敏感数据
- 仅在内部可信环境的数据共享
- 脱敏后的示例或测试数据
- 符合个人信息保护法的合规处理

---

## ArkTS敏感信息识别模式

### 常见敏感信息类型
- **凭证类**: password, secret, token, appKey, appSecret, accessToken, apiKey
- **连接信息**: serverUrl, apiEndpoint, databaseUrl
- **设备信息**: udid, imei, serialNumber, deviceId, mac
- **个人信息**: idCard, phone, email, address, creditCard, bankAccount
- **位置信息**: longitude, latitude, location, gps
- **生物识别**: fingerprint, faceId, biometric

### 敏感信息位置
- ArkTS源代码中的字符串常量
- config.json、module.json5配置文件
- resources/rawfile资源文件
- Preferences数据存储
- RelationalStore数据库
- hilog日志输出
- Want参数传递
- 分布式KVStore

---

**文档版本**: v1.0 | **适用语言**: ArkTS (HarmonyOS)