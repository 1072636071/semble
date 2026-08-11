# Screenpipe — AI 记忆记录器

## 简介

Screenpipe 24/7 记录你的屏幕和音频，构建本地、私密、可搜索的 AI 记忆。支持自然语言搜索、MCP 集成、自动化 AI 代理（Pipes）。19.6k stars，YC S26。

## 部署

### Windows / macOS

```bash
# 下载桌面应用
# 从 https://screenpi.pe/onboarding 下载安装包

# 或通过 CLI 运行
npx screenpipe record
```

### 验证

```bash
# 确认服务运行
curl http://localhost:3030/health
```

## 使用

### MCP 集成（推荐）

```bash
# Claude Code
claude mcp add screenpipe -- npx -y screenpipe-mcp@latest

# 然后向 Claude 提问：
# "我最近5分钟看到了什么？"
# "总结今天的对话"
```

### 搜索

```bash
# API 搜索
curl "http://localhost:3030/search?q=meeting+notes&limit=10"

# 搜索音频转录
curl "http://localhost:3030/search?q=budget&content_type=audio"
```

### Pipes（AI 自动化代理）

在 `~/.screenpipe/pipes/` 创建 `daily-summary.pipe.md`：

```yaml
---
schedule: "0 18 * * *"
prompt: |
  基于今天的屏幕记录，生成一份工作日报：
  1. 今天完成了什么
  2. 有哪些未完成事项
  3. 明天的计划
---
```

### SDK

```typescript
import { pipe } from "@screenpipe/js";

const results = await pipe.queryScreenpipe({
  q: "项目截止日期",
  contentType: "all",
  limit: 20,
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
});
```

### 配置

编辑 `~/.screenpipe/config.json`：

```json
{
  "fps": 0.5,
  "exclude_apps": ["浏览器", "VS Code"],
  "audio_enabled": true,
  "whisper_model": "large-v3-turbo",
  "storage": {
    "retention_days": 30
  }
}
```
