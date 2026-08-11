# Headroom — 全局上下文压缩层

## 简介

Headroom 是一个智能上下文压缩工具，相当于把喂给模型的"十摞资料"整理成一页提纲，同时保留原始内容以便后续检索。实测可减少 60%–95% 的 Token 消耗，且不牺牲回答质量。

适用于：长日志、大文件、RAG 检索结果、多文件代码库上下文等场景。

## 安装方式

### 前置依赖
- Python >= 3.10

### 实际安装（Windows x64）
```bash
pip install headroom-ai
```
安装后的可执行文件位于：
```
%LOCALAPPDATA%\Programs\Python\Python312\Scripts\headroom.exe
```

### 验证
```bash
headroom --version
# headroom, version 0.28.0
```

## 使用

### 基础用法
```bash
# 压缩单个文件
headroom compress ./large-file.log

# 压缩目录
headroom compress ./logs/

# 从 stdin 读取
cat debug-output.txt | headroom compress
```

### 集成到 AI 工作流

**OpenCode / Claude Code 集成**（写入 `.opencode/rules/`）：
```bash
# 自动压缩所有附件
headroom hook install
```

**MCP Server 模式**：
```bash
headroom serve --port 8080
```

然后在 AI 工具的 MCP 配置中添加：
```json
{
  "mcpServers": {
    "headroom": {
      "command": "headroom",
      "args": ["serve"]
    }
  }
}
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `headroom compress <path>` | 压缩文件或目录 |
| `headroom serve` | 启动 MCP Server |
| `headroom hook install` | 安装 Shell Hook |
| `headroom status` | 查看缓存状态 |
| `headroom clear-cache` | 清空缓存 |

### 读取模式

- `summary` — 仅输出摘要（最省 Token，推荐）
- `hybrid` — 摘要 + 关键片段（平衡模式）
- `full` — 全文保留（仅元数据压缩）
