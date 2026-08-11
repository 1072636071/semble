# Ollama — 本地 LLM 运行器

## 简介

Ollama 让你在本地一键运行数百种开源大模型，无需 GPU，无需云服务。支持 Gemma、DeepSeek、Qwen、Mistral、GLM 等主流模型，提供 OpenAI 兼容 API。175k stars。

## 部署

### Windows

```powershell
# 方式一：下载安装
irm https://ollama.com/install.ps1 | iex

# 方式二：手动下载
# 从 https://ollama.com/download 下载 OllamaSetup.exe
```

### macOS / Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Docker

```bash
docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

## 使用

### 拉取并运行模型

```bash
# 运行模型（自动拉取）
ollama run gemma4
ollama run deepseek-r1
ollama run qwen2.5
ollama run llama3.3
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `ollama run <model>` | 运行模型并对话 |
| `ollama pull <model>` | 拉取模型 |
| `ollama list` | 查看已安装模型 |
| `ollama rm <model>` | 删除模型 |
| `ollama cp <src> <dst>` | 复制模型 |
| `ollama push <model>` | 推送模型到仓库 |

### API 调用

Ollama 默认在 `localhost:11434` 提供 OpenAI 兼容 API：

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "gemma4",
  "messages": [{"role": "user", "content": "天空为什么是蓝色的？"}],
  "stream": false
}'
```

### Ollama + Fabric / Open WebUI

Ollama 可作为 Fabric 或 Open WebUI 的后端：

```bash
# Fabric 使用 Ollama
fabric --vendor Ollama -m gemma4 -p summarize

# Open WebUI 自动检测同机 Ollama
# 或设置 OLLAMA_BASE_URL=http://192.168.1.100:11434
```

### Modelfile（自定义模型）

创建 `Modelfile`：

```dockerfile
FROM gemma4
PARAMETER temperature 0.7
PARAMETER top_p 0.9
SYSTEM "你是一个专业的代码审查助手"
```

```bash
ollama create code-reviewer -f Modelfile
ollama run code-reviewer
```
