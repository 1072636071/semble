# Open WebUI — 自托管 AI 平台

## 简介

Open WebUI 是一个功能丰富的自托管 AI 界面，支持 Ollama 和 OpenAI 兼容 API，内置 RAG、多模型对话、图像生成、RBAC 权限管理、插件系统。144k stars。

## 部署

### Docker（推荐）

```bash
# 与 Ollama 同机部署
docker run -d -p 3000:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v open-webui:/app/backend/data \
  --name open-webui --restart always \
  ghcr.io/open-webui/open-webui:main

# 含内置 Ollama
docker run -d -p 3000:8080 \
  -v ollama:/root/.ollama \
  -v open-webui:/app/backend/data \
  --name open-webui --restart always \
  ghcr.io/open-webui/open-webui:ollama

# 仅用 OpenAI
docker run -d -p 3000:8080 \
  -e OPENAI_API_KEY=your_key \
  -v open-webui:/app/backend/data \
  --name open-webui --restart always \
  ghcr.io/open-webui/open-webui:main
```

### pip 安装

```bash
pip install open-webui
open-webui serve
```

访问 `http://localhost:3000`

## 使用

### 连接模型

- 自动发现同机 Ollama 模型
- 设置中添加 OpenAI、Anthropic、Gemini 等 API Key
- 支持 LMStudio、GroqCloud、OpenRouter 等任意 OpenAI 兼容端点

### 核心功能

| 功能 | 说明 |
|------|------|
| RAG | 上传文档，自动向量化，对话中检索 |
| 多模型对话 | 同一对话同时调度多个模型 |
| 插件系统 | MCP / MCPO / OpenAPI 工具服务器 |
| RBAC | 用户角色、群组、权限管理 |
| 管道 | 输入/输出过滤器，审批流 |
| Web 搜索 | 集成 SearXNG、Brave、Google PSE 等 |
| 图像生成 | DALL·E、ComfyUI、AUTOMATIC1111 |
| 语音 | 本地 Whisper + TTS 多引擎 |

### RAG 使用

1. 工作区 → 知识库 → 上传文件（PDF、DOCX、TXT、代码）
2. 对话中输入 `#` 选择知识库
3. 自动检索相关内容注入上下文

### MCP 配置

设置 → MCP 服务器 → 添加：

```json
{
  "name": "filesystem",
  "url": "http://localhost:3001/mcp"
}
```

### 权限管理

管理面板 → 用户与权限：

- 角色：管理员 / 编辑 / 查看者
- 群组：根据不同群组限制模型和知识库访问
- API：生成 API Key 用于外部集成
