# OpenCode 社区插件目录

> 数据来源：[opencode.ai/docs/ecosystem](https://opencode.ai/docs/ecosystem)、[awesome-opencode](https://github.com/awesome-opencode/awesome-opencode)、npm registry
> 更新时间：2026-07-08

## 安装方式

在 `opencode.json` 的 `plugin` 数组中添加包名即可：

```json
{
  "plugin": ["plugin-name"]
}
```

或从 npm 指定版本：`"plugin-name@1.0.0"`

---

## 一、认证与模型接入

### opencode-openai-codex-auth
用 ChatGPT Plus/Pro 订阅代替 API 按量付费。OAuth 登录后即可使用 OpenAI Codex 后端，适合不想额外付 API 费用的用户。
- **npm**: v4.4.0 | 最后发布 2026-01-09（6 个月前）
- **状态**: ⚠️ 维护放缓

### opencode-gemini-auth
用已有 Gemini 订阅代替 API 计费。Google OAuth 认证，即开即用。
- **npm**: v1.4.15 | 最后发布 2026-05-10（2 个月前）
- **状态**: ✅ 正常维护

### opencode-antigravity-auth
通过 Antigravity IDE 认证免费使用 Gemini 和 Anthropic 模型。
- **npm**: v1.6.0 | 最后发布 2026-02-20（5 个月前）
- **状态**: ⚠️ 维护放缓

### opencode-google-antigravity-auth
Google Antigravity OAuth 插件，支持 Google Search 搜索，更完善的 API 处理。
- **npm**: v0.2.15 | 最后发布 2026-01-30（5 个月前）
- **状态**: ⚠️ 维护放缓

### opencode-claude-auth
复用已有的 Claude Code 凭证连接 OpenCode。
- **npm**: v1.5.4 | 最后发布 2026-05-15（2 个月前）
- **状态**: ✅ 正常维护

---

## 二、多 Agent 编排

### oh-my-opencode
最全面的多 Agent 编排套件：后台 agent、预构建的 LSP/AST/MCP 工具、精选 agent、Claude Code 兼容模式，一站安装。
- **npm**: v4.16.0 | 最后发布 2026-07-07（1 天前 🔥）
- **状态**: 🟢 非常活跃

### opencode-workspaces
捆绑式多 Agent 编排工具集，支持 TUI 工作区管理和 Git worktree 切换。
- **npm**: v0.2.1 | 最后发布 2026-04-15（3 个月前）
- **状态**: ⚠️ 可能停更

### opencode-background-agents
Claude Code 风格的异步后台 agent，支持上下文持久化和异步委派。
- **npm**: v0.1.1 | 最后发布 2026-03-13（4 个月前）
- **状态**: ⚠️ 可能停更

### oh-my-openagent
多 Agent 编排系统（Sisyphus / Hephaestus / Prometheus 三个角色），并行编码的支持。
- **npm**: v4.16.0 | 最后发布 2026-07-07（1 天前 🔥）
- **状态**: 🟢 非常活跃

### opencode-conductor
协议驱动的开发流程自动化：Context → Spec → Plan → Implement 全生命周期。
- **npm**: v1.0.6 | 最后发布 2025-12-19（7 个月前）
- **状态**: 🔴 可能停更

### opencode-goal-plugin
会话级 `/goal` 工作流，目标始终保持在上下文中，自动继续执行直到完成。
- **npm**: v0.5.0 | 最后发布 2026-07-08（今天 🔥）
- **状态**: 🟢 非常活跃

---

## 三、安全与隐私

### opencode-vibeguard
在发送给 LLM 之前将敏感信息（密码、密钥、PII）替换为占位符，响应后原地还原。保护隐私的推荐方案。
- **npm**: v0.1.0 | 最后发布 2026-02-28（4 个月前）
- **状态**: ⚠️ 维护放缓

### @jfrog/opencode-jfrog-plugin
JFrog 官方插件，将 OpenCode 集成到 JFrog 平台，统一管理制品和依赖。
- **npm**: v0.1.0 | 最后发布 2026-06-29（9 天前 🟢）
- **状态**: 🟢 活跃（JFrog 官方维护）

---

## 四、开发效率

### @nick-vi/opencode-type-inject
在文件读取时自动注入 TypeScript/Svelte 类型定义，配合查找工具让 agent 更准确地理解代码。
- **npm**: v1.5.2 | 最后发布 2026-04-18（3 个月前）
- **状态**: ✅ 正常维护

### opencode-morph-fast-apply
通过 Morph Fast Apply API 实现 10x 更快的代码编辑，带有惰性编辑标记。
- **npm**: 未发布 | GitHub 项目
- **状态**: 🔶 需手动安装

### opencode-morph-plugin
集成 Fast Apply 编辑、WarpGrep 代码搜索和上下文压缩（通过 Morph）。
- **npm**: 未发布 | GitHub 项目
- **状态**: 🔶 需手动安装

### opencode-md-table-formatter
LLM 输出的 Markdown 表格格式清理工具，避免排版混乱。
- **npm**: 未发布 | GitHub 项目
- **状态**: 🔶 需手动安装

### opencode-shell-strategy
非交互式 shell 命令优化，防止 TTY 依赖操作导致命令挂起。
- **npm**: 未发布 | GitHub 项目
- **状态**: 🔶 需手动安装

### opencode-pty
允许 AI agent 在 PTY（伪终端）中运行后台进程并发送交互式输入。
- **npm**: v1.4.15 | 最后发布 2026-07-05（3 天前 🟢）
- **状态**: 🟢 活跃

### opencode-websearch-cited
为支持 provider 添加带引用的原生 Web 搜索能力（Google Grounded 风格）。
- **npm**: v1.2.0 | 最后发布 2026-01-10（6 个月前）
- **状态**: ⚠️ 维护放缓

### opencode-skillful
允许 agent 按需惰性加载提示词，通过技能发现和注入扩展能力。
- **npm**: 未发布 | GitHub 项目
- **状态**: 🔶 需手动安装

---

## 五、监控与通知

### opencode-sentry-monitor
通过 Sentry AI Monitoring 追踪和调试 AI agent，定位性能瓶颈和错误。
- **npm**: v1.5.0 | 最后发布 2026-03-19（4 个月前）
- **状态**: ⚠️ 维护放缓

### opencode-wakatime
将 OpenCode 使用数据同步到 Wakatime，统计编程时长。
- **npm**: v1.3.8 | 最后发布 2026-05-13（2 个月前）
- **状态**: ✅ 正常维护

### opencode-helicone-session
自动注入 Helicone 会话头用于请求分组，方便在 Helicone 仪表盘追踪。
- **npm**: v0.2.15 | 最后发布 2025-12-10（7 个月前）
- **状态**: 🔴 可能停更

### @mohak34/opencode-notifier
针对权限请求、任务完成、错误等事件发送桌面通知和声音。
- **npm**: v0.2.9-beta.0 | 最后发布 2026-06-10（1 个月前 ✅）
- **状态**: ✅ 正常维护

### opencode-notify
原生 OS 通知，任务完成时立即知道。
- **npm**: v0.3.1 | 最后发布 2026-02-03（5 个月前）
- **状态**: ⚠️ 维护放缓

### opencode-notificator
OpenCode 会话的桌面通知和声音提醒，不错过任务完成事件。
- **npm**: 未发布 | GitHub 项目
- **状态**: 🔶 需手动安装

---

## 六、会话与环境管理

### @daytona/opencode
在隔离的 Daytona 沙箱中自动运行 OpenCode 会话，支持 Git 同步和实时预览。
- **npm**: v0.190.1 | 最后发布 2026-06-23（2 周前 🟢）
- **状态**: 🟢 非常活跃（Daytona 团队维护）

### opencode-devcontainers
多分支 DevContainer 隔离，浅克隆 + 自动分配端口，适合并行开发。
- **npm**: v0.1.4 | 最后发布 2026-02-20（5 个月前）
- **状态**: ⚠️ 维护放缓

### opencode-worktree
零配置的 Git Worktree 管理，让 agent 在不同分支间无缝切换。
- **npm**: v0.4.1 | 最后发布 2026-03-03（4 个月前）
- **状态**: ⚠️ 维护放缓

### @tarquinen/opencode-dcp（动态上下文裁剪）
通过裁剪过时的工具输出来优化 Token 用量，减少上下文膨胀。
- **npm**: v3.1.14 | 最后发布 2026-07-04（4 天前 🟢）
- **状态**: 🟢 非常活跃

> 另有社区分支 `opencode-dynamic-context-pruning`（v0.1.7），功能类似。

### opencode-mem
跨会话持久记忆，agent 能记住之前的对话和上下文。
- **npm**: v2.18.0 | 最后发布 2026-07-07（1 天前 🔥）
- **状态**: 🟢 非常活跃

### opencode-zellij-namer
基于 OpenCode 上下文自动为 Zellij 会话命名，多终端管理更清晰。
- **npm**: v1.1.3 | 最后发布 2025-12-20（7 个月前）
- **状态**: 🔴 可能停更

### opencode-scheduler
使用 launchd (Mac) 或 systemd (Linux) 按 cron 语法调度定时任务。
- **npm**: v1.3.0 | 最后发布 2026-02-17（5 个月前）
- **状态**: ⚠️ 维护放缓

---

## 七、工作流与编排

### @openspoon/subtask2
将 OpenCode `/commands` 扩展为强大的编排系统，支持细粒度流程控制。
- **npm**: v0.3.9 | 最后发布 2026-01-31（5 个月前）
- **状态**: ⚠️ 维护放缓

### @plannotator/opencode
交互式计划审查，支持可视化标注和私密/离线分享。
- **npm**: v0.22.0 | 最后发布 2026-07-05（3 天前 🟢）
- **状态**: 🟢 非常活跃

### micode
结构化脑暴→计划→实现的工作流，保持会话连续性。
- **npm**: v0.10.0 | 最后发布 2026-03-10（4 个月前）
- **状态**: ⚠️ 维护放缓

### octto
交互式浏览器 UI 用于 AI 脑暴，支持多问题表单。
- **npm**: v0.3.1 | 最后发布 2026-03-08（4 个月前）
- **状态**: ⚠️ 维护放缓

---

## 八、搜索与数据

### opencode-firecrawl
通过 Firecrawl CLI 进行网页抓取、爬虫和搜索，用于 RAG 和数据分析。
- **npm**: 未发布 | GitHub 创建 2026-02-10
- **状态**: 🔶 需手动安装

### opencode-supermemory
跨会话持久记忆（使用 Supermemory），agent 能记住之前的上下文。
- **npm**: v2.0.8 | 最后发布 2026-06-21（2 周前 🟢）
- **状态**: 🟢 活跃

---

## 九、其他社区 Agent 项目

（非插件，但值得关注）

| 项目 | 说明 |
|------|------|
| Agentic | 模块化 AI agent 和命令，结构化开发工作流 |
| opencode-agents | 配置、提示词、agent 和插件的增强工作流集合 |

---

## 维护状态图例

| 图标 | 含义 |
|------|------|
| 🟢 非常活跃 | 近 1 个月内有更新 |
| ✅ 正常维护 | 近 3 个月内有更新 |
| ⚠️ 维护放缓 | 3-6 个月未更新 |
| 🔴 可能停更 | 超过 6 个月未更新 |
| 🔶 需手动安装 | npm 未发布 |

**提示**：只要将 `.ts`/`.js` 文件放入 `~/.config/opencode/plugins/` 目录，OpenCode 启动时会自动加载。npm 插件在启动时由 Bun 自动安装到 `~/.cache/opencode/node_modules/`。
