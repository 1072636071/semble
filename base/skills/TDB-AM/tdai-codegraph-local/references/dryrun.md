# tdai-codegraph-local 集成验收 dryrun 清单

> 对应 PRD `.scratch/04-tdai-skill-suite/` 工单 07+08（M4）。本清单覆盖需真实 MemoryKnowledge 编译件 + 守护进程的集成验收项，人工/半自动执行。

## 前置

- [ ] MemoryKnowledge 编译件 tarball 已随技能分发（`assets/memory-knowledge-*.tgz`）
- [ ] 目标仓库存在且为 git 仓库（试点：`E:\work\sp\JwikisSkills` + `E:\work\sp\TencentDB-Agent-Memory`）
- [ ] Node >= 22（原生模块 better-sqlite3 / @node-rs/jieba 需匹配的平台二进制）

## 步骤 1：配置向导

```bash
node scripts/setup.mjs
```

- [ ] 落盘 `~/.tdai/config/tdai-codegraph.json`
- [ ] `tarballPath` 指向技能自带 tarball
- [ ] `repos` 含试点两仓（JwikisSkills 为首=主仓库）
- [ ] `mcp.configPath` 指向用户级 MCP 配置

## 步骤 2：安装编译件

```bash
node scripts/install.mjs
```

- [ ] `~/.tdai/runtime/node_modules/memory-knowledge/` 出现
- [ ] `dist/local-server.js` 与 `dist/mcp/server.js` 存在
- [ ] 原生模块 `better-sqlite3` / `@node-rs/jieba` 已装（平台二进制）

## 步骤 3：启动守护 + 健康检查

```bash
node scripts/daemon.mjs start
node scripts/daemon.mjs status   # 期望：运行中（PID xxx）
node scripts/daemon.mjs health   # 期望：健康（HTTP 200）
```

- [ ] `~/.tdai/state/daemon.pid` 写入 PID
- [ ] 主仓库 `E:\work\sp\JwikisSkills` auto-register 为本地资产（看 daemon.log）
- [ ] `/health` 返回 200

## 步骤 4：MCP 注册 + tools/list 可见

```bash
node scripts/mcp.mjs register
# 重启 harness 会话，调用 MCP tools/list
```

- [ ] 用户级 MCP 配置含 `tdai-codegraph` server 条目
- [ ] harness 会话内 `tools/list` 可见 Code_Graph 工具（explore/search/callers/callees/impact/node/status/files/refresh/get_info）

## 步骤 5：追加仓库（工单 08）

```bash
node scripts/repo.mjs add E:\work\sp\TencentDB-Agent-Memory --alias TencentDB-Agent-Memory
node scripts/repo.mjs list
```

- [ ] 守护进程 `/v3/code-graph/create` 返回 201 + `code_graph_id`
- [ ] `config.repos` 追加成功
- [ ] `E:\work\sp\TencentDB-Agent-Memory\.gitignore` 含 `.codegraph/`（验收项③）

## 步骤 6：远端兜底 + remote URL 认亲

- [ ] 配置 `fallbackBaseUrl` 指向远端 KS（如 `http://123.206.125.149:8421/v3`）
- [ ] 重启守护
- [ ] 查询本地没有的资产 → 转发远端作答
- [ ] 查询本地有但远端也有同 `remote_url` 的资产 → 本地作答（认亲命中）

## 步骤 7：仓库移除

```bash
node scripts/repo.mjs remove TencentDB-Agent-Memory
node scripts/repo.mjs list
```

- [ ] `config.repos` 移除成功，主仓库保留

## 步骤 8：停止守护

```bash
node scripts/daemon.mjs stop
node scripts/daemon.mjs status   # 期望：未运行
```

- [ ] PID 文件清理，进程退出
