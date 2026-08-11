# lean-ctx — AI 代理上下文运行时系统

## 简介

lean-ctx 是一个面向 AI 代理的上下文运行时系统，提供 49 种工具、10 种读取模式和 90+ 配置策略，通过 Shell Hook 和 MCP Server 与 AI 工具深度集成。不仅做压缩，更强调上下文的动态管理与缓存复用，适合频繁切换项目、多任务并行的开发者。

## 安装方式

### 前置依赖
- 无需运行时依赖，独立的 Rust 二进制程序

### 实际安装（Windows x64）
> `cargo install` 因 `cookie` crate 依赖 `time-0.3.52` API 变更编译失败，改走预编译二进制。

```bash
# 从 GitHub Releases 下载预编译 Windows 二进制
# 最新版：v3.8.17
# URL: https://github.com/yvgude/lean-ctx/releases/latest
# 选择：lean-ctx-x86_64-pc-windows-msvc.zip

# 解压后得到 lean-ctx.exe (约 90MB)
# 已将可执行文件放入目标目录
```

### 验证
```bash
lean-ctx --version
# lean-ctx 3.8.17 (official, https://github.com/yvgude/lean-ctx)
```

## 使用

### Shell Hook 模式
安装后自动拦截 Shell 命令进行上下文管理：
```bash
# 自动分析命令输出并缓存
npm run build
# lean-ctx 自动缓存构建日志，下次不再重复输出
```

### MCP Server 模式
```json
{
  "mcpServers": {
    "lean-ctx": {
      "command": "lean-ctx",
      "args": ["mcp"]
    }
  }
}
```

在 AI 工具中即可使用 `ctx-read`、`ctx-cache`、`ctx-switch` 等工具。

### 工具清单（核心 10 个）

| 工具 | 说明 |
|------|------|
| `ctx-read` | 智能读取文件（10 种模式） |
| `ctx-cache` | 缓存上下文片段 |
| `ctx-switch` | 切换项目上下文 |
| `ctx-summary` | 生成上下文摘要 |
| `ctx-snapshot` | 保存当前上下文快照 |
| `ctx-restore` | 恢复上下文快照 |
| `ctx-diff` | 对比上下文差异 |
| `ctx-clean` | 清理过期缓存 |
| `ctx-stats` | 查看上下文统计 |
| `ctx-search` | 在上下文中搜索 |

### 读取模式（10 种）

| 模式 | 用途 | Token 节省 |
|------|------|------------|
| `auto` | 自动选择最佳模式 | 60-90% |
| `summary` | 仅摘要 | 90-95% |
| `structure` | 仅文件结构 | 80-95% |
| `head` | 前 N 行 | 50-80% |
| `tail` | 后 N 行 | 50-80% |
| `grep` | 仅匹配行 | 70-95% |
| `section` | 按章节提取 | 60-85% |
| `diff` | 仅变更部分 | 80-95% |
| `llm` | 面向 LLM 的优化摘要 | 70-90% |
| `full` | 全文（仅元数据） | 0-10% |
