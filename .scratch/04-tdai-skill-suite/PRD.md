# tdai-skill-suite：TDB-AM 技能族三件套（运维远端 / 本地 Code_Graph / 本地 Wiki）

Status: ready-for-agent

来源：memorial `docs/memorial/002-tdb-am-code-graph-wiki/`（16 轮 grill、21 项决策、3 份 ADR）。

## 问题陈述

`TDB-AM` 桶已有两个技能（`dsh-tdai-routing` 路由接线、`panel-admin` 管理域），抽象了 TencentDB-Agent-Memory（TDAI）能力的路由与管理面，但缺三块能力：

1. **运维远端**：远端 TDAI 栈（`123.206.125.149`，/root/tdai-memory/）的巡检、容器、配置、构建部署、备份目前靠手工 SSH + 读坚果云机密手册（配置说明.md），无技能化、无脚本、无配置化。
2. **本地 Code_Graph**：本地代码仓库（`E:\work\sp` 下约 40+ 项目）无法享受 Code_Graph 能力——本机开发/调试时查不到工作区真相（含未提交改动），只能靠记忆或翻代码，没有 MCP 工具面。
3. **本地 Wiki**：本地代码仓库无法享受 Wiki 知识库能力——仓库文档没有变成可检索的知识库，编码 agent 引不了仓库知识。

## 解决方案

在 `TDB-AM` 桶新增**三个独立技能**（ship 分发，制品发布 `cnb.cool/hanjiangxue_xiaoxiao/jx-ai`）：

1. **`tdai-remote-ops`（运维远端）**：SSH 为主 + HTTP 快速巡检；**不自动触发、用户显式指定动作**；完整档五组操作（巡检 / 容器管理 / 配置管理 / 构建部署 / 数据备份）；部署范围仅 TDAI 栈；Node `.mjs` + 系统 OpenSSH；向导落地 `tdai-ops.json`（探测坚果云 → 导入既有 → 手填，坚果云路径可探测/可覆盖）。
2. **`tdai-codegraph-local`（本地 Code_Graph）**：本地份 + 远端兜底路由（`KNOWLEDGE_FALLBACK_BASE_URL` + remote URL 认亲）；常驻本地 KS + 用户级 MCP；**单守护进程多仓库**；MemoryKnowledge **编译件 tarball 分发**；本地工作根 `~/.tdai/`。
3. **`tdai-wiki-local`（本地 Wiki）**：数据源**纯手动**（用户每次指定入库文件）；每仓库一个远端 wiki 资产；查询**复用守护进程 MCP 兜底转发**（本地 404 → 远端）；复用 `tdai-panel-admin.json`；对守护进程单向依赖（SKILL.md 写明）。

## 用户故事

1. 作为用户，我想要调用 `tdai-remote-ops` 由我显式指定要执行的运维动作，以便技能不会擅自对远端栈做任何改动。
2. 作为用户，我想要 `tdai-remote-ops` 提供 HTTP 快速巡检（四端口健康 8420/8424/8096/8125 + proxy admin 状态 + 服务器系统内存/磁盘/docker），以便几秒内判断全栈健康。
3. 作为用户，我想要 `tdai-remote-ops` 提供容器管理（docker ps/logs/restart/stop/start，单容器或全栈），以便日常容器运维。
4. 作为用户，我想要 `tdai-remote-ops` 提供配置管理（读 .env 与配置文件、从坚果云恢复 .env/.admin-key/gateway yaml、改 LLM 上游），以便配置可控可恢复。
5. 作为用户，我想要 `tdai-remote-ops` 提供构建部署（本地源码上传 hub-ctx/proxy-src → build-images 重建镜像 → start-*.sh 重启 → CRLF 修正），以便把 TDAI 栈源码更新上线。
6. 作为用户，我想要 `tdai-remote-ops` 提供数据/备份（verify-stats、ClickHouse 状态、配置备份到坚果云），以便数据可核可备。
7. 作为用户，我想要 `tdai-remote-ops` 通过向导落地 `tdai-ops.json`（探测坚果云 → 导入既有 → 手填），以便配置机器可读、可离线。
8. 作为用户，我想要 `tdai-remote-ops` 的坚果云路径可探测/可覆盖，以便坚果云目录变动不破坏技能。
9. 作为用户，我想要 `tdai-remote-ops` 不把 SSH 密钥 / admin key 落文档、进对话回显，以便密钥纪律被遵守。
10. 作为编码 agent，我想要在本地仓库中通过 MCP 工具查询 Code_Graph（explore/search/callers/callees/impact/node/status/files 等），以便编码时快速定位符号与影响面。
11. 作为编码 agent，我想要 Code_Graph 查询反映工作区未提交改动（本地份），以便不用 push 也能查最新代码。
12. 作为用户，我想要 `tdai-codegraph-local` 一键安装（编译件 tarball → `~/.tdai/runtime`）并启动常驻守护，以便无需源码仓库在场即可用。
13. 作为用户，我想要 `tdai-codegraph-local` 单守护进程服务全部目标仓库（主仓库 auto-register + API 追加），以便一个 MCP 覆盖所有仓库。
14. 作为用户，我想要 `tdai-codegraph-local` 的 MCP 注册到用户级，以便所有会话共享同一套工具。
15. 作为用户，我想要 `tdai-codegraph-local` 配置远端兜底（`KNOWLEDGE_FALLBACK_BASE_URL` + remote URL 认亲），以便本地没有的资产回源远端、认亲命中时由本地作答。
16. 作为用户，我想要 `tdai-codegraph-local` 支持仓库增删命令，以便试点（JwikisSkills + TencentDB-Agent-Memory）后扩展更多仓库。
17. 作为用户，我想要 `tdai-wiki-local` 手动指定仓库文件入库（create → raw 上传 → ingest），以便把选定的文档建成远端 wiki。
18. 作为编码 agent，我想要在对话里检索远端 wiki（search/page/read/graph），以便编码时引用仓库文档知识。
19. 作为用户，我想要 `tdai-wiki-local` 每仓库一个 wiki 资产（按仓库 basename 命名），以便知识库边界清晰。
20. 作为用户，我想要 `tdai-wiki-local` 复用 `tdai-panel-admin.json`，以便不重复配置凭据。
21. 作为用户，我想要 `tdai-wiki-local` 在守护未运行时提示先启动守护，以便查询路径明确。
22. 作为技能仓库维护者，我想要三个技能同置 `TDB-AM/` 桶、`tdai-` 前缀注册进 managedPrefixes，以便 ship 清理覆盖该族、不产生脏目录。
23. 作为技能仓库维护者，我想要 MemoryKnowledge 编译件 tarball 随技能分发并版本化，以便可移植、可追踪版本。
24. 作为技能仓库维护者，我想要技能族未来发布到 `cnb.cool/hanjiangxue_xiaoxiao/jx-ai`，以便制品集中管理。
25. 作为实施者，我想要两个集成验收项（单守护多仓库查询刷新/认亲、wiki 兜底转发透传）有 dryrun 清单，以便真实环境验证。

## 实现决策

- **技能数量与结构**（决策11）：三个独立技能 `tdai-remote-ops` / `tdai-codegraph-local` / `tdai-wiki-local`；Wiki 对守护进程单向依赖（SKILL.md 写明"缺守护提示先起"）。
- **运维边界**（决策1/2）：SSH 为主 + HTTP 快速巡检；不自动触发、用户显式指定；部署范围仅 TDAI 栈（MemoryCore/Knowledge/Panel/Proxy）。
- **运维清单**（决策5）：完整档五组——巡检 / 容器管理 / 配置管理（含坚果云恢复）/ 构建部署 / 数据备份。
- **脚本载体**（决策3）：Node `.mjs` + 系统 OpenSSH（`ssh.exe`/`scp.exe -i <pem>`），零第三方依赖、可单测。
- **运维配置**（决策4）：向导落地 `tdai-ops.json`（三级供给：探测坚果云 → 导入既有 → 手填）；坚果云路径可探测/可覆盖、不硬编码。
- **Code_Graph 部署形态**（决策6）：本地份 + 远端兜底路由（`KNOWLEDGE_FALLBACK_BASE_URL` + remote URL 认亲）。
- **Code_Graph 运行形态**（决策7/15）：常驻本地 KS + 用户级 MCP 注册；技能负责安装/常驻配置/MCP 注册/起停/健康/仓库增删。
- **常驻粒度**（决策8，ADR 0001）：单守护进程 + 多仓库——主仓库 auto-register，其余经 `/code-graph/create(source_type=local)` 追加；一个 MCP 覆盖全部；**追加资产行为需实测**。
- **MemoryKnowledge 分发**（决策16，ADR 0002）：编译件 tarball（npm pack）随技能分发、版本化；安装到 `~/.tdai/runtime/`（npm install 解析原生依赖）；运行时不依赖源码仓库。
- **本地工作根**（决策17）：`~/.tdai/`——runtime/（编译件）、config/（JSON）、state/（PID/日志）、data/（SQLite）；`.codegraph/` 索引留各仓库（gitignore）。
- **Wiki 数据源**（决策9）：纯手动——用户每次指定入库文件，不做自动收集。
- **Wiki 查询**（决策10，ADR 0001）：复用守护进程 MCP 兜底转发——本地 KS 透传 wiki 工具 + 远端兜底，本地 404 → 原样转发远端；**转发透传需实测**。
- **Wiki 资产粒度**：每仓库一个 wiki 资产（按仓库 basename 命名）；复用 `tdai-panel-admin.json`。
- **配置管理**（决策14）：各技能独立 setup 脚本（ops→`tdai-ops.json`；codegraph→守护配置；wiki→复用 panel-admin 配置）。
- **目标仓库**（决策13）：试点 `E:\work\sp\JwikisSkills` + `E:\work\sp\TencentDB-Agent-Memory`，后续可扩展。
- **桶与分发**（决策12/18）：`TDB-AM/` 桶、ship 分发、`tdai-` 前缀注册进 managedPrefixes；制品发布 `cnb.cool/hanjiangxue_xiaoxiao/jx-ai`（私有）。
- **密钥纪律**：SSH 密钥 / admin key / cnb token 均从坚果云机密读取（如 `项目机密\Secret\我的服务器.md` 的 cnb 段），不硬编码、不落文档/对话回显。

## 测试决策

- **Seam（测试接缝）**（优先复用既有接缝，最高层）：
  1. **脚本层单测**（每技能 `scripts/*.test.mjs`）——mock SSH/HTTP/子进程，覆盖确定性逻辑：配置解析（坚果云探测/落地 JSON）、SSH 命令构建、HTTP 巡检、守护进程管理（PID/状态/仓库增删）。先例：`panel-admin/scripts/setup-credentials.test.mjs`。
  2. **集成验收清单**（`references/*-dryrun.md` + `integration-acceptance.md`）——覆盖两个需实测项（单守护多仓库的查询前刷新/认亲逐资产生效、wiki 兜底转发参数透传），需真实 MemoryKnowledge + 远端服务器，人工/半自动执行。先例：`panel-admin/references/*-dryrun.md`。
- **好测试的标准**：只断言外部可观察行为（配置字段、发出的 SSH 命令、HTTP 请求/响应、守护进程 PID/状态、MCP 工具可见），不测内部实现细节。
- 不新建测试基础设施；沿用 `.mjs` 零依赖单测先例。

## 超出范围

- 通用项目部署（非 TDAI 栈）——被否（决策2）。
- 运维技能自动触发/自动做事——被否（决策1）。
- Wiki 自动收集（README/docs 扫描）——被否（决策9）。
- 远端份 Code_Graph 的 allocate/管理——属 `panel-admin` 域，不在本技能族。
- 单源派生（`SKILL.src.md`）——本批直写 `SKILL.md` 走原样复制 fallback（仓库现状）。
- 新厂商平台接入。

## 补充说明

- 全部决策过程与追问记录见 memorial：`docs/memorial/002-tdb-am-code-graph-wiki/`。
- 架构约束（技能目录内 ADR）：`tdai-codegraph-local/adr/0001`（单守护多仓库）、`tdai-codegraph-local/adr/0002`（编译件分发）、`tdai-wiki-local/adr/0001`（wiki 兜底转发）；回写后 CONTEXT.md 已含「TDB-AM 桶 / `tdai-` 前缀家族」词条。
- 实施验收项（memorial「实施验收项」）：① 单守护多仓库的查询前刷新/认亲逐资产生效；② wiki 兜底转发参数透传；③ 非主仓库 `.codegraph/` gitignore 追加由技能脚本保证。
- 密钥纪律：SSH 密钥 / admin key / cnb token 均从坚果云机密读取，不硬编码。
