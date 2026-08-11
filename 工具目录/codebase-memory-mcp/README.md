# codebase-memory-mcp

高性能代码智能 MCP 服务器。将代码库索引为持久化知识图谱，支持 158 种语言、亚毫秒查询、99% 更少 token 消耗。单一静态二进制，零依赖。

- **GitHub**: https://github.com/DeusData/codebase-memory-mcp
- **License**: MIT
- **Stars**: 20k
- **C 语言实现**，支持 macOS / Linux / Windows

## 安装

### 一键安装（macOS / Linux）

```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
```

带图谱可视化 UI：

```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --ui
```

### Windows（PowerShell）

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile install.ps1
.\install.ps1
```

### 通过 Claude Code 安装

```
帮我安装这个 MCP 服务器：https://github.com/DeusData/codebase-memory-mcp
```

重启 Agent，说 **"Index this project"** 即可。

## 在 opencode.json 中配置

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "command": "C:\\path\\to\\codebase-memory-mcp.exe",
      "args": []
    }
  }
}
```

## MCP 工具（14 个）

| 工具 | 用途 |
|------|------|
| `index_repository` | 索引代码库到知识图谱 |
| `list_projects` | 列出所有已索引项目 |
| `delete_project` | 删除项目及图谱数据 |
| `index_status` | 检查索引状态 |
| `search_graph` | 按标签/名称/文件等结构化搜索 |
| `trace_path` | BFS 调用链路追踪（谁调了谁） |
| `detect_changes` | Git diff 影响范围分析 |
| `query_graph` | Cypher 查询（如 `MATCH (f:Function) RETURN f.name`） |
| `get_graph_schema` | 获取图谱节点/边类型 |
| `get_code_snippet` | 按 qualified name 读取源码 |
| `get_architecture` | 代码架构概览 |
| `search_code` | 图增强的文本搜索 |
| `manage_adr` | 架构决策记录（ADR）管理 |
| `ingest_traces` | 导入运行时链路数据 |

## 性能

| 操作 | 耗时 |
|------|------|
| Linux 内核全量索引（28M LOC, 75K 文件） | 3 分钟（481 万节点, 772 万边） |
| Django 全量索引 | ~6 秒（4.9 万节点） |
| Cypher 查询 | <1ms |
| 调用链路追踪（depth=5） | <10ms |

## 核心特性

- **158 种语言** tree-sitter AST 解析，编译进二进制
- **Hybrid LSP**：Python/TS/JS/Go/C/C++/Java/Rust/Kotlin/C#/PHP 的类型解析
- **跨服务链接**：HTTP/gRPC/GraphQL 路由识别
- **跨仓库智能**：CROSS_* 边链接多个项目
- **内置 3D 图谱可视化**：`localhost:9749`
- **自动检测 11 种 Agent**：Claude Code、Codex CLI、Gemini CLI、OpenCode、Cursor、Windsurf 等
- **团队共享图谱**：提交 `.codebase-memory/graph.db.zst` 到仓库，队友免重新索引

## CLI 模式

```bash
codebase-memory-mcp cli search_graph '{"name_pattern": ".*Handler.*"}'
codebase-memory-mcp cli list_projects
codebase-memory-mcp cli --raw query_graph '{"query": "MATCH (f:Function) RETURN f.name LIMIT 5"}'
```
