# Dify — LLM 应用开发平台

## 简介

Dify 是一个开源 LLM 应用开发平台，提供可视化 AI 工作流编排、RAG 管道、Agent 能力、模型管理、LLMOps。支持 100+ 模型提供商。147k stars。

## 部署

### Docker Compose（推荐）

```bash
git clone https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env
docker compose up -d
```

访问 `http://localhost/install` 完成初始化。

### 最小系统要求

- CPU >= 2 核
- 内存 >= 4 GiB

## 使用

### 核心功能

| 功能 | 说明 |
|------|------|
| Workflow | 可视化 AI 工作流编排（拖拽式） |
| RAG Pipeline | 文档解析 → 分段 → 向量化 → 检索全流程 |
| Agent | Function Calling / ReAct，50+ 内置工具 |
| Prompt IDE | 提示工程、模型对比、版本管理 |
| LLMOps | 日志、标注、性能监控 |
| API | 所有功能通过 REST API 暴露 |

### 构建 AI 应用

1. **创建应用**：工作室 → 创建应用 → 选择类型（聊天机器人 / Agent / 工作流）
2. **编排**：拖拽节点构建流程（LLM、知识库、代码、HTTP 请求等）
3. **发布**：获得 API Endpoint 和 Web 嵌入代码

### API 调用

```bash
curl -X POST http://localhost/v1/chat-messages \
  -H "Authorization: Bearer app-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "什么是 RAG？",
    "user": "user-123",
    "response_mode": "streaming"
  }'
```

### 知识库（RAG）

支持 PDF、DOCX、PPT、TXT、HTML、代码文件自动解析：

1. 知识库 → 创建知识库 → 上传文档
2. 选择分段策略和嵌入模型
3. 在应用设置中关联知识库
4. 对话自动检索

### Agent 配置

```yaml
model: gpt-4
prompt: 你是一个数据分析师
tools:
  - google_search
  - dalle
  - web_scraper
  - code_interpreter
```

### 监控与优化

日志 → 查看每条消息的：
- Token 消耗和成本
- LLM 调用链路
- 用户反馈标注
- 回放调试
