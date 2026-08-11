# graphify

将代码、文档、PDF、图片、视频等任意输入转化为可查询的知识图谱。适用于 Claude Code、Codex、OpenCode、Cursor、Gemini CLI 等 20+ AI 编码助手。

- **GitHub**: https://github.com/safishamsi/graphify
- **License**: MIT
- **Stars**: 73.8k
- **Python 3.10+**，YC S26

## 安装

```bash
# 推荐（隔离环境）
uv tool install graphifyy

# 备选
pipx install graphifyy

# 注册到你的 AI 助手
graphify install
```

用完即走：

```bash
graphify .
```

输出三个文件：

```
graphify-out/
├── graph.html       浏览器打开 — 点击节点、过滤、搜索
├── GRAPH_REPORT.md  亮点：关键概念、意外关联、建议问题
└── graph.json       完整图谱，随时查询
```

## 常用命令

```
/graphify .                         # 为当前目录构建图
/graphify ./docs --update           # 只重新提取变更文件
/graphify query "auth 和数据库的连接?"  # 查询图
/graphify path "UserService" "DatabasePool"  # 路径查找
/graphify explain "RateLimiter"     # 解释节点
graphify export callflow-html       # 导出 Mermaid 架构图
graphify hook install               # git commit 后自动重建
```

## Windows 注意

PowerShell 中 `/graphify .` 的斜杠会被视为路径分隔符，使用 `graphify .` 替代。

可选 extras：`uv tool install "graphifyy[pdf]"` `graphifyy[office]` `graphifyy[video]` `graphifyy[mcp]` `graphifyy[neo4j]` 等。

## MCP 服务

```bash
python -m graphify.serve graphify-out/graph.json
```

实现结构化访问：`query_graph`、`get_node`、`get_neighbors`、`shortest_path`。

支持 HTTP 传输共享给整个团队：

```bash
python -m graphify.serve graphify-out/graph.json --transport http --port 8080 --api-key "$SECRET"
```

## 支持的文件类型

- 代码（36 种 tree-sitter 语法）：.py .ts .js .go .rs .java .c .cpp .rb .cs .kt .php .swift .lua .zig 等
- 文档：.md .mdx .html .txt .rst .yaml .yml
- PDF、图片、音视频
- Office：.docx .xlsx
- YouTube 链接
- MCP 配置文件、包清单
- Terraform / HCL、Salesforce Apex 等

## 隐私

- 代码文件本地处理（tree-sitter），不离开机器
- 音视频本地转写（faster-whisper）
- 文档/PDF/图片通过 AI 助手模型 API 提取
- 无遥测、无使用追踪
