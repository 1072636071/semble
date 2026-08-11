# Fabric — AI 增强框架

## 简介

Fabric 是一个开源的 AI 增强框架，将日常任务拆分为可复用的 AI 提示模板（称为 Patterns）。支持 10+ AI 供应商（OpenAI、Anthropic、Ollama、Gemini 等），通过 CLI 或 REST API 调用。42.7k stars。

## 部署

### Windows

```powershell
iwr -useb https://raw.githubusercontent.com/danielmiessler/fabric/main/scripts/installer/install.ps1 | iex

# 或通过 winget
winget install danielmiessler.Fabric
```

### macOS / Linux

```bash
# 一键安装
curl -fsSL https://raw.githubusercontent.com/danielmiessler/fabric/main/scripts/installer/install.sh | bash

# 或通过 Go 安装
go install github.com/danielmiessler/fabric/cmd/fabric@latest
```

### 初始化

```bash
# 配置 API Key 和默认模型
fabric --setup
```

设置环境变量：

```bash
# 以 Ollama 为后端
export OPENAI_BASE_URL=http://localhost:11434/v1
export DEFAULT_MODEL=gemma4
```

## 使用

### 内置 Patterns（100+）

```bash
# 提取视频/文章中的精华
fabric -p extract_wisdom

# 总结内容
fabric -p summarize

# 撰写文章
fabric -p write_essay

# 解释代码
fabric -p explain_code

# 分析 YouTube 视频
fabric -y "https://youtube.com/watch?v=xxx" -p summarize

# 抓取网页
fabric -u "https://example.com" -p extract_wisdom
```

### 管道模式

```bash
# 管道输入
cat article.txt | fabric -p summarize

# 输出到文件
cat code.py | fabric -p explain_code -o explanation.md

# 流式输出
echo "给我一个创业想法" | fabric -p write_essay --stream
```

### REST API 模式

```bash
# 启动 API 服务器
fabric --serve

# 调用 API
curl http://localhost:8080/api/chat -d '{
  "pattern": "summarize",
  "input": "要总结的内容..."
}'
```

### 自定义 Pattern

创建 `~/.config/fabric/patterns/my-pattern/system.md`：

```markdown
# 角色

你是一个资深技术翻译，将英文技术文章翻译为中文。

# 要求

1. 保留技术术语原文
2. 用词专业简洁
3. 保持代码块不变
```

```bash
fabric -p my-pattern < english-article.md
```
