## 能力目标

基于 ArkTS（HarmonyOS）资源生命周期与组件/页面生命周期理解业务场景，判断真实资源管理风险，避免将 GC 语言误当手动内存语言或仅进行语法级模式匹配。

---

## 前置判断

在分析前，明确以下要素：

- 资源类型  
  （文件 / Socket / 数据库连接 / 媒体资源 / Timer / Listener / Native 句柄等）
- 生命周期模型  
  （GC 管理 / 显式 close / release / off）
- 是否存在 **显式释放 API**
- 是否处于 Promise / async / 回调 / 事件驱动环境
- 是否绑定 Page / Component / Ability 生命周期
- 是否涉及 `@ohos.*` 系统或 Native 资源

---

## 分析流程

### Step 1 — 识别资源获取点

定位 ArkTS 中的资源创建或绑定行为：

- 文件 / IO：`fs.open`
- 网络：`socket.connect`、`http.createHttp`
- 数据库：`rdb.getRdbStore`
- 媒体：`media.createAudioPlayer`
- 定时器：`setInterval`、`setTimeout`
- 事件监听：`on(...)`
- 系统 / Native 资源：`@ohos.*` 模块返回对象

**ArkTS 示例**

```arkts
@Entry
@Component
struct FilePage {
  private file?: fs.File

  async aboutToAppear() {
    this.file = await fs.open('/data/test.txt')
  }
}
````

分析要点：

* 是否返回 Promise
* 是否存在失败或提前返回分支
* 是否存在成对的释放 API（`close / release / off`）

---

### Step 2 — 追踪资源生命周期

* **正向追踪**：创建 → 使用 → 所有可能的退出点
* **反向追踪**：释放是否对应有效创建，是否重复释放
* **所有权转移**：资源是否传递给其他组件或异步回调
* **异步流控审查**：

  * Promise 链中是否提前 `return`
  * 是否缺失 `finally`
* **监听器规则**：

  * `on` 必须有 `off`
  * 页面销毁时必须解除
* **ArkTS 核心认知**：

  * GC 只管理 JS 对象
  * 系统 / Native 资源必须显式释放

#### ❌ 错误示例：aboutToAppear 提前 return 导致泄漏

```arkts
@Entry
@Component
struct FilePage {
  private file?: fs.File

  async aboutToAppear() {
    this.file = await fs.open('/data/test.txt')
    if (!this.isEnabled()) {
      return  // ❌ file 未关闭
    }
    await this.readFile()
  }
}
```

#### ✅ 正确示例：finally 中释放资源

```arkts
@Entry
@Component
struct FilePage {
  private file?: fs.File

  async aboutToAppear() {
    this.file = await fs.open('/data/test.txt')
    try {
      if (!this.isEnabled()) return
      await this.readFile()
    } finally {
      await fs.close(this.file)
      this.file = undefined
    }
  }
}
```

---

### Step 3 — 验证初始化完整性

* 是否在资源完全初始化前使用
* Promise 是否 `await`
* 成员变量是否可能处于半初始化状态
* 是否可能为 `undefined / null`

#### ❌ 错误示例：未完成初始化即使用

```arkts
@Entry
@Component
struct PlayerPage {
  private player?: media.AudioPlayer

  async aboutToAppear() {
    this.player = await media.createAudioPlayer()
    this.player.play() // ❌ 尚未 prepare
  }
}
```

#### ✅ 正确示例

```arkts
@Entry
@Component
struct PlayerPage {
  private player?: media.AudioPlayer

  async aboutToAppear() {
    this.player = await media.createAudioPlayer()
    await this.player.prepare()
    this.player.play()
  }
}
```

---

### Step 4 — 检查错误与销毁路径

* 创建失败是否清理已分配资源
* Promise reject 是否释放
* `aboutToDisappear / onDestroy` 是否完整释放
* 页面多次进入是否重复创建资源

#### ❌ 错误示例：监听器未随页面销毁解除

```arkts
@Entry
@Component
struct EventPage {
  private emitter = new EventEmitter()

  aboutToAppear() {
    this.emitter.on('change', this.onChange)
  }

  private onChange() {
    // ...
  }
}
```

#### ✅ 正确示例

```arkts
@Entry
@Component
struct EventPage {
  private emitter = new EventEmitter()

  aboutToAppear() {
    this.emitter.on('change', this.onChange)
  }

  aboutToDisappear() {
    this.emitter.off('change', this.onChange)
  }

  private onChange() {
    // ...
  }
}
```

---

## 风险模式

### 1. 资源泄漏 (CAT-0005)

系统或 Native 资源未在所有路径显式释放。

**触发**：

* Promise 提前 return
* 页面销毁未关闭文件 / Socket / Player
* Listener / Timer 未移除

---

### 2. 初始化不正确 (CAT-0053)

使用未完成初始化的资源对象。

---

### 3. 未受控的资源消耗 (CAT-0054)

资源创建频率或数量未受限制。

#### 示例：页面反复进入创建定时器

```arkts
@Entry
@Component
struct TimerPage {
  private timerId?: number

  aboutToAppear() {
    this.timerId = setInterval(() => {
      this.doWork()
    }, 1000)
  }
  // ❌ 未 clearInterval
}
```

---

### 4. 不受信任数据的反序列化 (CWD-1171)

从不可信来源反序列化数据且未验证。

---

### 5. 修改假定不可变数据 (CWD-1172)

修改外部或共享的预期只读对象。

---

### 6. protected/private 成员被不正确访问 (CWD-1176)

使用 `as any`、动态属性访问绕过封装。

---

### 7. clone 方法实现不正确 (CWD-1177)

复制对象时错误共享资源句柄。

---

### 8. 沙箱或路径边界不正确 (CWD-1180)

文件或数据访问路径未限制。

---

### 9. 类型转换不正确 (CAT-0055)

错误的类型断言导致资源误用。

---

### 10. 资源的跨作用域引用 (CAT-0056)

#### ❌ 示例：页面销毁后异步回调仍使用资源

```arkts
@Entry
@Component
struct AsyncPage {
  private file?: fs.File

  async aboutToAppear() {
    this.file = await fs.open('/data/a.txt')
    asyncTask().then(() => {
      fs.read(this.file!) // ❌ 页面可能已销毁
    })
  }

  onDestroy() {
    this.file && fs.close(this.file)
  }
}
```

---

### 11. 访问已过期或关闭的资源 (CAT-0057)

释放后继续使用资源对象。

---

### 12. 资源未关闭或释放不正确 (CAT-0058)

释放顺序错误、部分释放、竞态释放。

#### 示例：媒体资源未 release

```arkts
@Entry
@Component
struct PlayerPage {
  private player?: media.AudioPlayer

  async aboutToAppear() {
    this.player = await media.createAudioPlayer()
    await this.player.prepare()
    this.player.play()
  }

  // ❌ 未 release
}
```

---

## 代码分析视角

### 控制流分析

关注 Promise 链、生命周期钩子、提前 return。

### 数据流分析

追踪资源对象：创建 → 使用 → 释放。

### 所有权分析

明确资源由哪个 Page / Component / Ability 负责释放。

### 并发分析

分析异步回调、事件并发与竞态风险。

---

## 结论模板

```
## 结论
[问题存在 + 严重性:高/中/低 + 风险类型]

## 资源类型与生命周期
- 资源类型: [文件 / Socket / Listener / Native 句柄等]
- 创建位置: [文件:行号] [生命周期函数]
- 释放位置: [文件:行号] 或“未释放”
- 生命周期归属: [Page / Component / Ability]

## 证据链与逻辑推理
1. 代码证据
2. 生命周期路径
3. 缺陷描述
4. 推理过程
```

---

## 非“执行逻辑”

本文档仅作为 ArkTS 资源管理的知识与推理指南，不执行自动扫描、不生成修复代码。模型应结合 ArkTS 生命周期与业务语义进行判断，而非机械匹配。

---

## 典型误报场景

不应报告：

* 纯 JS 对象（无系统或 Native 资源）
* 框架托管生命周期的内部资源
* 明确的池化 / 复用设计
* 全局单例的系统资源

```

---
