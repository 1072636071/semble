# MinerU

高精度文档解析引擎，专为 LLM / RAG / Agent 工作流设计。将 PDF、DOCX、PPTX、XLSX、图片、网页转换为结构化 Markdown / JSON。

- **GitHub**: https://github.com/opendatalab/MinerU
- **License**: MinerU Open Source License（基于 Apache 2.0）
- **Stars**: 71.7k
- **Python 3.10+**

## 安装

```bash
# pip 安装
pip install mineru

# 或使用在线版本（零安装）
# https://mineru.net/OpenSourceTools/Extractor
```

## 使用方法

### CLI 命令行

```bash
# 解析 PDF 文件
mineru extract input.pdf

# 解析图片
mineru extract document.png

# 指定输出格式
mineru extract input.pdf --output-format md,json
```

### MCP Server（与 AI 编程工具集成）

MinerU 提供 MCP Server，可直接在 Cursor、Claude Desktop、Windsurf 中使用：

```json
{
  "mcpServers": {
    "mineru": {
      "command": "mineru",
      "args": ["mcp"]
    }
  }
}
```

### Python SDK

```python
from mineru import MinerU

parser = MinerU()
result = parser.extract("input.pdf")
print(result.markdown)
```

### Docker

```bash
docker run --gpus all -p 8000:8000 opendatalab/mineru:latest
```

## 支持的输入格式

- PDF（含扫描件、手写体）
- DOCX（原生解析，无需转 PDF）
- PPTX（原生解析）
- XLSX（原生解析）
- 图片（PNG、JPG 等）
- 网页

## 核心能力

- 公式 → LaTeX，表格 → HTML
- 多栏布局、跨页表格合并
- 页眉/页脚/页码自动去除，语义连贯输出
- VLM + OCR 双引擎，109 语言 OCR 识别
- 支持纯 CPU / GPU / MPS 推理
- 输出：Markdown、JSON（阅读顺序）、HTML

## 集成生态

| 场景 | 方案 |
|------|------|
| AI 编程工具 | MCP Server（Cursor、Claude Desktop、Windsurf） |
| RAG 框架 | LangChain、LlamaIndex、RAGFlow、Dify、FastGPT |
| 开发 | Python SDK、Go SDK、TypeScript SDK、CLI、REST API、Docker |
| 无代码 | mineru.net 在线版、Gradio WebUI、桌面客户端 |

## API 服务

```bash
# 启动 API 服务
mineru-api --host 0.0.0.0 --port 8000

# 请求解析
curl -X POST http://localhost:8000/file_parse \
  -F "file=@document.pdf"
```
