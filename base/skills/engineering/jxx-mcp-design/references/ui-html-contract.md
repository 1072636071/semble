# MCP UI HTML 契约

每个 MCP 必须附带一个 UI HTML。**默认静态、默认不打开、默认不阻塞。**

## 硬约束

1. **不阻塞启动** — server 启动/握手路径不得创建、渲染、打开或等待 UI。
2. **不反向依赖** — UI 缺失或损坏不影响 MCP 可用性，server 不得因 UI 失败而退出。
3. **不常驻服务** — 不为了 UI 起 HTTP 服务、不监听端口、不做双向长连接。

| 禁止 | 允许 |
|------|------|
| 启动时 spawn 浏览器打开 UI | 仅在工具被显式调用时生成/刷新 UI 数据 |
| 启动时 await UI 就绪 | 由 Agent 用 `present_files` 打开静态文件 |
| UI 依赖 CDN / 外网资源 | 单文件内联 CSS/JS，离线可开 |
| UI 起常驻 HTTP 服务 | UI 读本地状态快照 JSON + 手动刷新 |

**判断口诀**：UI 是 server 的**产物**，不是 server 的**依赖**。

## 路径约定

```
<mcp-root>/
├── ui/index.html     # 首选；单文件，零外部依赖
└── ui/state.json     # 可选：由 MCP 导出的状态快照（管理能力用）
```

## 三种形态

| 形态 | 用途 | 数据来源 |
|------|------|----------|
| 静态介绍页 | 能力地图、工具分层、典型链路 | 构建期内嵌，随版本走 |
| 管理面板 | 状态、配置、日志、开关 | 读 `ui/state.json`，不带服务 |
| MCP Apps | 聊天内交互部件：表单、选择器、图表、实时看板 | 工具 description 带 `_meta.ui.resourceUri` 指向 `ui://` 资源；数据双向流 |

### MCP Apps 档

- 工具 description 里声明 `_meta.ui.resourceUri`；host 在调用前即可预加载该资源。
- host 把 HTML 渲染进沙箱 iframe；app 通过 postMessage（JSON-RPC 方言）与 host 双向通信，可请求工具调用、更新模型上下文。
- `_meta.ui` 里可带 `csp`（允许加载的外部源）与 `permissions`（麦克风、摄像头等）。
- host 支持情况参差（Claude、Claude Desktop、VS Code Copilot、M365 Copilot、Goose、Postman 等）；**不支持就降级静态档**，别让能力依赖单一家 host。
- 两档都不得进启动路径——Apps 的 `ui://` 资源是被拉取时才返回，不是 server 起来就推送。

需要动态数据时：MCP 提供导出工具（或定时任务）写 `ui/state.json`，HTML 用 `fetch('./state.json')` + 手动刷新按钮。**禁止为了刷新而常驻端口。**

## 内容骨架（6 段，缺一不可）

1. **是什么** — 一句话定位 + 边界（明确"不做什么"）
2. **能力地图** — 工具按四层渐进式发现分层展示，标出入口工具（哪些是初始暴露的）
3. **典型链路** — 3–5 条：用户意图 → 工具调用序列（与引导技能的 workflows 对齐）
4. **安全边界** — 哪些操作破坏性、哪些走沙箱/预览提交
5. **配置与前置** — 必需/可选参数，标注哪些是运行时按需收集的
6. **排障** — 常见错误码 + 恢复动作，与工具的 `suggested_actions` 保持一致

## 打开方式

- **静态档 Agent 侧**：用户问"这个 MCP 能干什么/怎么配/状态如何"时，用 `present_files` 打开 `ui/index.html` 绝对路径。
- **静态档人类侧**：直接双击文件即可，不需要 server 在运行。
- **Apps 档**：模型调用带 `_meta.ui.resourceUri` 的工具时由 host 渲染，不需要人找文件。

## 反模式

- 启动即弹浏览器 —— 阻塞且打扰，违反硬约束 1
- UI 里塞全量工具参数表 —— 那是引导技能的 `references/` 该干的
- UI 成为唯一文档 —— SKILL 才是入口，UI 只是可视化补充
- 依赖 CDN 的图表库 —— 离线打不开，等于没有
