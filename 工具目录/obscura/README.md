# Obscura

开源无头浏览器引擎，专为 AI Agent 和 Web Scraping 设计。Rust 编写，轻量、隐身、内置 V8 JavaScript 引擎。

- **GitHub**: https://github.com/h4ckf0r0day/obscura
- **License**: Apache-2.0
- **Stars**: 16.3k
- **Rust**，支持 Linux / macOS / Windows / Docker

## 安装

```bash
# Linux x86_64
curl -LO https://github.com/h4ckf0r0day/obscura/releases/latest/download/obscura-x86_64-linux.tar.gz
tar xzf obscura-x86_64-linux.tar.gz

# macOS Apple Silicon
curl -LO https://github.com/h4ckf0r0day/obscura/releases/latest/download/obscura-aarch64-macos.tar.gz
tar xzf obscura-aarch64-macos.tar.gz

# Docker
docker run -d -p 127.0.0.1:9222:9222 h4ckf0r0day/obscura
```

无需 Chrome、Node.js，零依赖。

## MCP Server

启动 MCP 服务供 AI Agent（Claude Desktop、Cursor 等）使用：

```bash
obscura mcp
```

HTTP 传输：

```bash
obscura mcp --http --port 8080
```

### Claude Desktop 配置

```json
{
  "mcpServers": {
    "obscura": {
      "command": "obscura",
      "args": ["mcp"]
    }
  }
}
```

### MCP 工具

| 工具 | 说明 |
|------|------|
| `browser_navigate` | 导航到 URL |
| `browser_snapshot` | 获取页面 URL、标题和正文 |
| `browser_click` | 点击 CSS 选择器元素 |
| `browser_fill` | 设置输入框值 |
| `browser_type` | 向输入框追加文本 |
| `browser_press_key` | 发送键盘事件 |
| `browser_select_option` | 选择 `<option>` |
| `browser_evaluate` | 执行 JavaScript 表达式 |
| `browser_wait_for` | 等待 CSS 选择器出现 |
| `browser_network_requests` | 列出网络请求 |
| `browser_console_messages` | 返回控制台消息 |
| `browser_close` | 关闭页面重置状态 |

## CLI 快速使用

```bash
# 获取页面标题
obscura fetch https://example.com --eval "document.title"

# 提取所有链接
obscura fetch https://example.com --dump links

# 渲染 JS 输出 HTML
obscura fetch https://example.com --dump html

# 启动 CDP 服务
obscura serve --port 9222

# 隐身模式
obscura serve --port 9222 --stealth

# 并行抓取
obscura scrape url1 url2 url3 --concurrency 25 --eval "..." --format json
```

## Puppeteer / Playwright 兼容

```javascript
// Puppeteer
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.connect({ browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser' });

// Playwright
import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP({ endpointURL: 'ws://127.0.0.1:9222' });
```

## 相比 Chrome 的优势

| 指标 | Obscura | Headless Chrome |
|------|---------|-----------------|
| 内存 | **30 MB** | 200+ MB |
| 二进制 | **70 MB** | 300+ MB |
| 反检测 | 内置 | 无 |
| 页面加载 | **85 ms** | ~500 ms |
| 启动 | 瞬时 | ~2s |

## 隐身模式

- 每会话指纹随机化（GPU、屏幕、Canvas、音频、电池）
- `navigator.webdriver = undefined`
- 3520 个域名被拦截（分析、广告、遥测）
