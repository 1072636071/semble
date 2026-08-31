---
name: tdai-remote-ops
description: 运维远端 TencentDB-Agent-Memory（TDAI）栈——SSH 为主 + HTTP 快速巡检，覆盖巡检/容器管理/配置管理/构建部署/数据备份五组操作。由用户显式指定动作、不自动触发。
version: 0.1.0
---

## 目的与适用

运维远端 TDAI 栈（`123.206.125.149`，部署目录 `/root/tdai-memory/`）：MemoryCore / MemoryKnowledge / MemoryPanel / MemoryProxy 四组件及其容器。

* **SSH 为主 + HTTP 快速巡检**：日常巡检走 HTTP，变更类运维（容器/配置/构建部署/备份）走 SSH。

* **由用户显式指定动作**：不自动触发、不擅自对远端栈做任何改动。

* **部署范围仅 TDAI 栈**：不做通用项目部署。

## 凭据与配置

运行向导落地 `tdai-ops.json`（探测坚果云机密目录 → 导入既有 → 手填）：

```bash
node <skills-dir>/tdai-remote-ops/scripts/setup-credentials.mjs
```

**密钥纪律**：SSH 密钥 / admin key 视为机密——不进文档、不进对话回显、不进仓库、不进日志。全部从坚果云机密目录读取，坚果云路径可探测/可覆盖（目录可能变动），不硬编码。

## 操作域

| 操作域                                                     | 状态                                                 |
| ------------------------------------------------------- | -------------------------------------------------- |
| HTTP 快速巡检（四端口健康 + proxy admin 状态 + 系统摘要）                       | ✅ 已实现（`scripts/inspect.mjs`）                       |
| 容器管理（docker ps/logs/restart/stop/start，单容器或全栈）          | ✅ 已实现（`scripts/container.mjs` + `scripts/ssh.mjs`） |
| 配置管理（读 .env/配置文件、从坚果云恢复、改 LLM 上游）                       | 待实现（工单 05）                                         |
| 构建部署（源码上传 → build-images 重建 → start-\*.sh 重启 → CRLF 修正） | 待实现（工单 06）                                         |
| 数据/备份（verify-stats、ClickHouse 状态、配置备份坚果云）               | 待实现（工单 05）                                         |

## 使用方式

```bash
# 1) 配置向导 → tdai-ops.json（复用既有 / 探测坚果云自动构建 / 手填）
node scripts/setup-credentials.mjs
#    坚果云路径变动时显式指定机密目录（含 配置说明.md）：
node scripts/setup-credentials.mjs --secrets-root "<机密目录绝对路径>"
#    或环境变量：$env:TDAI_SECRETS_ROOT = "<机密目录绝对路径>"

# 2) HTTP 快速巡检（四端口健康 + proxy admin 状态 + 系统摘要）
node scripts/inspect.mjs

# 3) 容器管理（单容器或全栈四容器）
node scripts/container.mjs ps
node scripts/container.mjs logs [container]
node scripts/container.mjs restart|stop|start [container]
```

## 验证成功标准

* 各操作域脚本可独立执行并返回结构化结果。

* SSH/HTTP 调用不泄露任何密钥明文。

