# Agent-Reach

给 AI Agent 一键装上互联网能力。读取 & 搜索 Twitter、Reddit、YouTube、GitHub、Bilibili、小红书等平台，零 API 费用。

- **GitHub**: https://github.com/Panniantong/Agent-Reach
- **License**: MIT
- **Python 3.10+**

## 安装

复制给 AI Agent 执行：

```
帮我安装 Agent Reach：https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md
```

安全模式：

```
帮我安装 Agent Reach（安全模式）：https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md
安装时使用 --safe 参数
```

更新：

```
帮我更新 Agent Reach：https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/update.md
```

## 使用方法

安装后告诉 Agent 即可，无需记命令（Agent 通过注册的 SKILL.md 自动识别）：

| 场景 | 示例指令 |
|------|----------|
| 读网页 | "帮我看看这个链接" |
| GitHub 仓库 | "这个 GitHub 仓库是做什么的" |
| YouTube 视频 | "这个 YouTube 视频讲了什么" |
| B站搜索 | "B站搜一下 AI 教程" |
| 全网搜索 | "全网搜一下 LLM 框架对比" |
| RSS 订阅 | "订阅这个 RSS" |

**需登录的平台**（小红书、Twitter、Reddit），告诉 Agent「帮我配 XXX」即可引导配置。

## 诊断

```
agent-reach doctor
```

一条命令查看每个渠道的状态、当前走哪条后端路由。

## 卸载

```
agent-reach uninstall
```

## 支持平台

- 网页（Jina Reader，零配置）
- YouTube（yt-dlp 字幕提取，零配置）
- RSS（feedparser，零配置）
- 全网搜索（Exa via MCP，零配置）
- GitHub（gh CLI，需认证）
- Twitter/X（twitter-cli，需 Cookie）
- B站（bili-cli，零配置搜索）
- Reddit（OpenCLI / rdt-cli，需登录态）
- 小红书（OpenCLI / xiaohongshu-mcp，需登录态）
- LinkedIn（linkedin-scraper-mcp / Jina Reader）
- V2EX（零配置）
- 雪球（需配置）
- 小宇宙播客（Whisper 转录，需配置）
