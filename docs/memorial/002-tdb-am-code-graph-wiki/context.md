# 002-tdb-am-code-graph-wiki

状态：已完成

## 诉求

> Use Skill: jxx-grill-with-memorial
> 这下面的两个技能 E:\work\sp\JwikisSkills\base\skills\TDB-AM，是 E:\work\sp\TencentDB-Agent-Memory 能力的抽象。
> 我希望有一个运维远端的技能，这个技能的配置去这里找，jxc123 是用户名：C:\Users\jxc123\Nutstore\1\我的坚果云\项目机密\TencentDB-Agent-Memory
> 然后我还想我本地的这些代码仓库可以享受 这个项目的代码 Code\_Graph 和 Wiki 知识库 能力，是不是也需要做两个技能。

## 追问记录

### 2026-08-31 事实调查（发起前自查）

**现有 TDB-AM 两技能**（`base/skills/TDB-AM/`）：

* `dsh-tdai-routing`（v0.3.0）：DSH harness ↔ TDAI 路由双向打通。读 DSH `settings.yaml` providers → 注册为 TDAI 上游 → 探活 → E2E 验证 → 回填 DSH `mh` models。凭据：`$PROXY`（缺省 `http://123.206.125.149:8096`）、`$ADMIN`、`$SPACE`。

* `panel-admin`（v0.1.0）：Panel 管理域总入口，显式调用不抢触发词。五个管理域（wiki / code-graph / llm-upstream / agent-团队 / 用量 dashboard）+ chat-memory。三层调用面（Panel 管理面 / KS 数据面 / Agent 只读工具面）。凭据向导 `setup-credentials.mjs` → `tdai-panel-admin.json`（panel\_url / service\_id / user\_key），三级供给含「探测坚果云同步根下的密钥子目录复用既有配置」。

**远端部署实况**（坚果云机密目录 `C:\Users\jxc123\Nutstore\1\我的坚果云\项目机密\TencentDB-Agent-Memory\`，2026-08-29 备份自服务器）：

* 服务器 `123.206.125.149`（OpenCloudOS 9.2，内存 3.5G），部署目录 `/root/tdai-memory/`

* 端口：memory-core **8420** / panel(hub) **8125** / knowledge **8424** / proxy **8096** / clickhouse **8123**（仅容器内）

* 机密文件：`server.env`（= `.env`）、`admin-key.txt`（= `.admin-key`，`sk-mem-...`）、`memory-core-gateway.yaml`、`proxy-config.yaml`（启动时自动生成、勿手改）、`配置说明.md`、`panel-admin-credentials.json`

* SSH 密钥：`配置说明.md` 写「本目录同名 `jiang1.pem` 为同一把」，但 **坚果云目录实测无 .pem（Glob 0 命中）**；已知另一路径 `D:\work\space\xiangs-blog\.deploy-tmp\jiang1.pem` —— **待用户确认密钥实际位置**

* 服务器侧运维脚本（本地构建/启动）：`build-images.sh`（hub/proxy）、`start-memory-core.sh`、`start-memory-hub.sh`、`start-proxy.sh`、`verify-stats.sh`；源码目录 `hub-ctx/`、`proxy-src/`

* 运维坑：CRLF 破坏 shell 脚本（`bash\r`）、NPM\_REGISTRY/APT\_MIRROR 加速、ClickHouse TTL bug 已修、`MEMORY_CORE_GATEWAY_API_KEY` 留空则 8420 无鉴权、`PROXY_FULL_STACK=1` 已开

* 管理面：Panel `http://123.206.125.149:8125/`（admin key 登录）；proxy admin API（`PROXY_ADMIN_API_KEY`）；coding agent 接入 `http://123.206.125.149:8096/proxy/default/v1`（model `jiangall`）

**Code\_Graph 能力**（双份索引，`panel-admin/references/code-graph.md`）：

* 远端份：git clone → KS 索引，Panel 管理（create/sync/delete/allocate），供线上 agent / 其他成员

* 本地份：本地 KS（`MemoryKnowledge/src/local-server.ts`）注册工作区为资产（`source_type=local`，须 git 仓库），查询前增量刷新 + 防抖（默认 5s）+ refresh 逃生门；**只挂 code-graph，不挂 wiki**；可配 `KNOWLEDGE_FALLBACK_BASE_URL` 远端兜底 + remote URL 认亲（本地优先→认亲→原样转发）

* Agent 只读消费：`tools/list` → `tools/call`（10 工具：get\_info / explore / search / callers / callees / impact / node / status / files / refresh）；或 MCP stdio

* 本地份需要**本地部署 MemoryKnowledge**（pnpm build + node dist/local-server.js），非纯技能即可完成

**Wiki 能力**（`panel-admin/references/wiki.md`）：

* **只在远端存在**；本地 KS 不挂载 wiki

* 生命周期：create 建壳 → raw/write 上传 → ingest（LLM 抽页面建图谱）→ page 查询/搜索/图谱 → allocate 给 Agent

* 管理走 panel-admin skill；只读查询走 MCP / tools/call

**JwikisSkills 技能组织**：桶结构 `base/skills/<bucket>/`（code / engineering / in-progress / kimi / misc / personal / productivity / TDB-AM）；TDB-AM 桶已有两技能；分发由 `vendors.json` 驱动（`ship.mjs`）。

**本地代码仓库**（`E:\work\sp\`）：约 40+ 项目（JwikisSkills、TencentDB-Agent-Memory、CBStoU9、Joder、U9C开发、imageTUTU、jnode、jvsShow、jx-baa、mSkills、qiweidoc、san3、threejs、vpn、博客小程序、游戏素材、testSpB……）——**哪些仓库要享受能力待澄清**。

### 2026-08-31 Q1 运维边界（用户已答）

* **决策 1**：运维远端技能 = **SSH 为主 + HTTP 快速巡检**（方案 3）。

* **决策 2**：技能**不自动触发、不自动做事**——由用户显式指定动作（对齐 panel-admin「由用户显式调用」约定）。

* **决策 3**：允许**很笨重**——可内置大量脚本，覆盖范围含**项目部署**等。

* **事实补充**：SSH 密钥实际在坚果云**上级目录** `C:\Users\jxc123\Nutstore\1\我的坚果云\项目机密\jiang1.pem`（非 TDB-AM 子目录；配置说明.md 表述有误）；`D:\work\space\xiangs-blog\.deploy-tmp\jiang1.pem` 不存在。另发现坚果云已存 `panel-admin-credentials.json`（panel\_url=`http://123.206.125.149:8125/api/v1`、service\_id=`default`、user\_key=`sk-mem-...`），恰为 panel-admin 凭据向导产出格式，可复用。

### 2026-08-31 Q2 项目部署边界（用户已答）

* **决策 4**：运维对象的**部署范围 = 仅 TDAI 栈**（MemoryCore / MemoryKnowledge / MemoryPanel / MemoryProxy 四组件）。部署=源码上传 + 重建镜像 + 启停容器 + 配置恢复，对齐配置说明.md 的 `build-images.sh` / `start-*.sh` 流程。不做通用项目部署。

### 2026-08-31 Q3 脚本载体与 SSH 机制（用户已答）

* **决策 5**：运维技能脚本 = **Node** **`.mjs`** **+ 系统 OpenSSH**。脚本零第三方依赖、可单测；SSH/SCP 用 Windows 自带 `ssh.exe`/`scp.exe -i <pem>`。

* **事实验证**：本机 OpenSSH 可用（`OpenSSH_for_Windows_9.5p2, LibreSSL 3.8.2`；`scp.exe` 存在于 `C:\WINDOWS\System32\OpenSSH\`）。

### 2026-08-31 Q4 配置获取方式（用户已答）

* **决策 6**：运维技能配置 = **向导落地** **`tdai-ops.json`**（对齐 panel-admin 三级供给：探测坚果云 → 导入既有 → 手填），运行时只读 JSON。

* **⚠️ 约束（用户强调）**：**坚果云目录可能会变**——向导不得硬编码坚果云路径，须可探测/可覆盖（如环境变量 / CLI 参数指定机密根），并校验目标文件存在。

### 2026-08-31 Q5 运维操作清单（用户已答）

* **决策 7**：首版运维清单 = **完整档五组全覆盖**：

  1. 巡检：HTTP 健康检查（8420/8424/8096/8125）+ proxy admin 状态（upstreams、usage/stats 等价 verify-stats）+ 服务器系统（内存/磁盘/docker）
  2. 容器管理：docker ps / logs / restart / stop / start（单容器或全栈）
  3. 配置管理：读 .env 与配置文件、从坚果云恢复 .env/.admin-key/gateway yaml、改 LLM 上游
  4. 构建与部署：本地源码上传（hub-ctx/proxy-src）→ build-images.sh 重建镜像 → start-\*.sh 重启 → CRLF 修正
  5. 数据/备份：verify-stats.sh、ClickHouse 状态、配置备份到坚果云

* 部署实现细节（源自配置说明.md）：镜像在服务器本地构建，源码目录 `hub-ctx/`、`proxy-src/` 在服务器；部署=本地仓库子项目上传覆盖服务器对应源码目录后重建。源码来源映射待实施时确认。

### 2026-08-31 Q6 Code\_Graph 本地部署形态（用户已答）

* **决策 8**：本地仓库 Code\_Graph 能力 = **本地份 + 远端兜底路由**（方案 3）：本机部署 MemoryKnowledge（`pnpm install + build`，Node≥22），每目标仓库启动本地 KS（`local-server.ts`，`source_type=local`），配 `KNOWLEDGE_FALLBACK_BASE_URL` 远端兜底 + remote URL 认亲（本地优先→认亲命中本地作答→否则远端）。

* **事实**：MemoryKnowledge 本机未构建（无 dist/）；`bin/local.mjs` / `dev:local` 为本地份入口；需要 Node≥22 + pnpm。

### 2026-08-31 Q7 Code\_Graph 运行形态（用户已答）

* **决策 9**：Code\_Graph 技能 = **常驻服务 + MCP 注册**（方案 3）：本机常驻本地 KS，注册到 agent 的 MCP（`bin/mcp.mjs` stdio 桥，`KNOWLEDGE_API_URL` 指向本地 KS），agent 原生 MCP 工具消费。技能负责：安装（build）、常驻配置、MCP 注册、起停、健康检查、仓库增删。

* **源码确认**：`local-server.ts` 每进程**单工作区**自动注册（`KNOWLEDGE_LOCAL_WORKSPACE` 必填）；但同进程 `allowLocalSource:true` 下可经 `/code-graph/create(source_type=local)` 追加其他本地资产；查询前刷新按 `source_type==="local"` 逐资产生效；远端兜底/认亲遍历全部本地资产。→ **多仓库常驻可行性需在 Q8 定粒度**。

### 2026-08-31 Q8 常驻粒度（用户已答）

* **决策 10**：常驻粒度 = **单守护进程 + 多仓库**（方案 2）：以主仓库启动本地 KS，其余目标仓库经 `/code-graph/create(source_type=local)` 追加为本地资产，同一进程、一个 MCP 覆盖全部仓库。技能需**实测验证**追加资产的查询前刷新/认亲逐资产生效（现有测试只覆盖单工作区）。主仓库选谁待定（见待澄清）。

### 2026-08-31 Q9 Wiki 数据源（用户已答）

* **决策 11**：本地仓库 Wiki 数据源 = **纯手动**：用户每次指定要入库的仓库文件（上传为 raw → ingest），技能不做自动收集（README/docs 自动扫描均不做）。前提确认：Wiki 能力 = 每个仓库自己的文档建成远端知识库供 coding agent 检索。

* 目标仓库清单未答——仍待澄清。

### 2026-08-31 Q10 Wiki 查询消费路径（用户已答）

* **决策 12**：Wiki 查询 = **复用本地守护进程 MCP 兜底转发**（方案 1）：本地 KS 透传 wiki 工具 + 远端兜底，wiki 资产本地 404 → 原样转发远端 KS 作答；agent 一套 MCP 同时拿到 Code\_Graph（本地）+ Wiki（远端转发）。wiki 转发行为**需实测验证**。

* **结构含义**：Code\_Graph 与 Wiki 两技能**共享守护进程/MCP 基础设施** → Q11 定技能数量与结构。

### 2026-08-31 Q11 技能数量与结构（用户已答）

* **决策 13**：落地 **三个独立技能**（方案 1）：

  1. 运维远端（管远端 TDAI 栈：巡检/容器/配置/构建部署/备份）
  2. 本地 Code\_Graph（管本地守护进程 + MCP 注册 + 仓库 CG 资产增删 + 查询）
  3. 本地 Wiki（管远端 wiki 建库/上传/ingest/查询；文档写明"查询依赖守护进程，缺则提示先起"）

* Wiki 技能对守护进程有**单向依赖**（需在 SKILL.md 写清）。

### 2026-08-31 Q12 命名与桶（用户已答）

* **决策 14**：命名 = **方案 1**：

  * `tdai-remote-ops`（运维远端）

  * `tdai-codegraph-local`（本地 Code\_Graph：守护+MCP+CG）

  * `tdai-wiki-local`（本地 Wiki：远端 wiki 生命周期+查询）

* **决策 15**：三技能同置 `base/skills/TDB-AM/` 桶、走 `ship` 分发（与 `dsh-tdai-routing` / `panel-admin` 一致）。

### 2026-08-31 Q13 目标仓库清单（用户已答）

* **决策 16**：目标仓库 = **核心两仓先试点**：`E:\work\sp\JwikisSkills` + `E:\work\sp\TencentDB-Agent-Memory`。守护进程按此注册，后续可扩展加仓（技能设计需支持增删仓库）。

### 2026-08-31 Q14 配置管理（用户已答）

* **决策 17**：三技能配置 = **各技能独立 setup 脚本**（方案 1）：`tdai-remote-ops` 自带 setup → `tdai-ops.json`；`tdai-codegraph-local` 自带 setup → 守护配置（MemoryKnowledge 路径/仓库清单/端口/兜底/MCP）；`tdai-wiki-local` 复用 `tdai-panel-admin.json`。

### 2026-08-31 Q15 MCP 注册层级（用户已答）

* **决策 18**：守护进程 MCP = **用户级注册**（方案 1）：MCP 配置写入用户级 agent 配置（对应 harness 用户级 MCP 位置，harness 可配，默认当前环境），所有会话共享同一套 Code\_Graph/Wiki 工具。

* 待澄清项按默认处理（用户未提异议视为接受）：

  * **主仓库**（守护 auto-register）：取配置清单首个仓库（试点=JwikisSkills），其余经 API 追加。

  * **Wiki 资产粒度**：每仓库一个 wiki 资产（按仓库 basename 命名）。

  * **MemoryKnowledge 源码路径**：`E:\work\sp\TencentDB-Agent-Memory\MemoryKnowledge`，配置可改。

### 2026-08-31 Q16 MemoryKnowledge 获取方式与本地布局（用户已答）

* **决策 19**：MemoryKnowledge = **打包编译件分发（npm pack）**：构建 → `npm pack` → tarball 产物随技能分发（版本化），技能 setup 安装该包到运行时目录（`npm install` 自动解析原生依赖 better-sqlite3/@node-rs/jieba）；**运行时不再依赖源码仓库在场**。发布流程（源码→重打包更新产物）与安装流程分离。

* **决策 20**：本地工作根 = `~/.tdai/`：`runtime/`（MemoryKnowledge 编译件 + node\_modules）、`config/`（tdai-\*.json）、`state/`（PID/日志）、`data/`（SQLite DB，守护 cwd 固定于此）；`.codegraph/` 索引留在各仓库（自动 gitignore，设计如此）。

### 2026-08-31 制品仓库信息（用户补充）

* **决策 21**：TDB-AM 技能族（含三新技能与 MemoryKnowledge 编译件）**未来发布到制品仓库** **`https://cnb.cool/hanjiangxue_xiaoxiao/jx-ai`**（私有，匿名不可访问）。此仓库为技能族的分发/制品归属地——编译件 tarball（ADR `tdai-codegraph-local/adr/0002`）与该族文档应随该仓库发布。

* **凭据位置**：cnb.cool 发布凭据（令牌名 `jiangall` / Git Username `cnb` / Token 掩码）存于坚果云 `项目机密\Secret\我的服务器.md` 的 "cnb" 段。**密钥纪律**：Token 不落文档/仓库/对话，发布脚本从该机密文件读取（同 tdai-ops.json 三级供给的坚果云探测），不硬编码。

* 回写全局文档（CONTEXT.md 术语 / docs/adr/ 同步）的最终取舍待用户确认（见收尾）。

## 决策汇总

1. **运维远端技能 = SSH 为主 + HTTP 快速巡检**（2026-08-31）：不自动触发/不自动做事，用户显式指定动作；可笨重、可多脚本、含项目部署。
2. **部署范围 = 仅 TDAI 栈**（2026-08-31）：MemoryCore/MemoryKnowledge/MemoryPanel/MemoryProxy 四组件，源码上传+重建镜像+启停+配置恢复；不做通用项目部署。
3. **脚本载体 = Node** **`.mjs`** **+ 系统 OpenSSH**（2026-08-31）：零第三方依赖、可单测；SSH/SCP 用本机 `ssh.exe`/`scp.exe -i <pem>`（本机已装 OpenSSH 9.5p2）。
4. **配置 = 向导落地** **`tdai-ops.json`**（2026-08-31）：三级供给（探测坚果云→导入既有→手填）；**坚果云路径可探测/可覆盖、不硬编码**（目录可能变）。
5. **运维清单 = 完整档五组**（2026-08-31）：巡检 / 容器管理 / 配置管理 / 构建部署 / 数据备份全覆盖。
6. **本地 Code\_Graph = 本地份 + 远端兜底路由**（2026-08-31）：本机部署 MemoryKnowledge，本地 KS 注册 `source_type=local` 资产，配 `KNOWLEDGE_FALLBACK_BASE_URL` + remote URL 认亲。
7. **Code\_Graph 运行形态 = 常驻服务 + 用户级 MCP 注册**（2026-08-31）：技能负责安装/常驻配置/MCP 注册/起停/健康/仓库增删。
8. **常驻粒度 = 单守护进程 + 多仓库**（2026-08-31）：主仓库 auto-register + API 追加本地资产，一个 MCP 覆盖全部；**追加资产行为需实测验证**。
9. **本地 Wiki 数据源 = 纯手动**（2026-08-31）：用户每次指定入库文件，技能不做自动收集。
10. **Wiki 查询 = 复用守护进程 MCP 兜底转发**（2026-08-31）：本地 KS 透传 wiki 工具 + 远端兜底，本地 404 → 原样转发远端；**转发透传需实测验证**。
11. **技能数量 = 三个独立技能**（2026-08-31）：运维远端 / 本地 Code\_Graph / 本地 Wiki；Wiki 对守护进程有单向依赖（SKILL.md 写明）。
12. **命名 =** **`tdai-remote-ops`** **/** **`tdai-codegraph-local`** **/** **`tdai-wiki-local`**（2026-08-31）：同置 `TDB-AM/` 桶、走 ship 分发。
13. **目标仓库 = 核心两仓试点**（2026-08-31）：`E:\work\sp\JwikisSkills` + `E:\work\sp\TencentDB-Agent-Memory`，后续可扩展。
14. **配置管理 = 各技能独立 setup 脚本**（2026-08-31）：ops→`tdai-ops.json`；codegraph→守护配置；wiki→复用 `tdai-panel-admin.json`。
15. **MCP 注册层级 = 用户级**（2026-08-31）：所有会话共享同一套 Code\_Graph/Wiki 工具（harness 可配，默认当前环境）。
16. **MemoryKnowledge = 打包编译件分发（npm pack）**（2026-08-31）：tarball 随技能分发，安装时 `npm install` 解析原生依赖；运行时不依赖源码仓库。
17. **本地工作根 =** **`~/.tdai/`**（2026-08-31）：`runtime/`（编译件）、`config/`（JSON）、`state/`（PID/日志）、`data/`（SQLite）；`.codegraph/` 索引留各仓库（gitignore）。
18. **制品发布 = cnb.cool jx-ai**（2026-08-31）：TDB-AM 技能族（含三新技能与 MemoryKnowledge 编译件）未来发布到 `https://cnb.cool/hanjiangxue_xiaoxiao/jx-ai`（私有）；编译件 tarball（ADR `tdai-codegraph-local/adr/0002`）随该仓库分发。

## 实施验收项

1. **单守护多仓库**：追加资产的查询前刷新/认亲逐资产生效需实测（ADR `tdai-codegraph-local/adr/0001`）。
2. **wiki 兜底转发**：wiki 参数经本地守护兜底转发完整透传需实测（ADR `tdai-wiki-local/adr/0001`）。
3. 非主仓库的 `.codegraph/` gitignore 追加由技能脚本保证。

## 待澄清

（无）

## ADR

ADR 权威源随技能走（回写决策，避免双写漂移）；memorial 不保留副本，此处引用路径：

* `base/skills/TDB-AM/tdai-codegraph-local/adr/0001-single-daemon-multi-repo-local-codegraph.md`

* `base/skills/TDB-AM/tdai-codegraph-local/adr/0002-memoryknowledge-tarball-distribution.md`

* `base/skills/TDB-AM/tdai-wiki-local/adr/0001-wiki-query-via-daemon-fallback.md`

