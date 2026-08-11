# RTK — 命令行输出精简器

## 简介

RTK（Reduced Token Kit）专注于命令行输出的极致精简，能自动过滤进度条、重复日志、模板代码，仅保留关键信息。在 `git status`、`npm test` 等命令上可节省 75%–90% 的 Token，启动开销低于 10ms，完全无感接入。

## 安装方式

### 前置依赖
- Rust 1.70+（编译用，或用预编译二进制）

### 实际安装（Windows x64）
```bash
cargo install rtk
```
安装后二进制位于：
```
%USERPROFILE%\.cargo\bin\rtk.exe
```

### 验证
```bash
rtk --version
# rtk 0.1.0
```

## 使用

### 基础用法
```bash
# 精简命令输出
git status | rtk
npm test 2>&1 | rtk

# 直接管道压缩任意文本
cat long-output.txt | rtk
```

### Shell Hook 自动接入（推荐）

**PowerShell**（写入 `$PROFILE`）：
```powershell
Invoke-Expression (&{rtk hook powershell})
```

**Bash / Zsh**：
```bash
eval "$(rtk hook bash)"
```

### 集成到 AI 工具
在 AI 工具的 Shell 配置中设置预处理器：
```json
{
  "shell": {
    "command": "cmd.exe",
    "args": ["/c", "rtk"]
  }
}
```

### 自定义规则
创建 `~/.rtkrc.toml`：
```toml
[filters]
max_lines = 200
strip_patterns = [
  "^(\\d+%)",           # 进度条
  "^\\[\\d+ms\\]",       # 时间戳
  "node_modules/",
]
keep_patterns = [
  "error",
  "warning",
  "FAIL",
  "Error:",
]
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `cmd \| rtk` | 精简命令输出 |
| `rtk hook <shell>` | 生成 Hook 脚本 |
| `rtk config` | 编辑配置 |
| `rtk stats` | 查看统计（已节省 Token 数） |
