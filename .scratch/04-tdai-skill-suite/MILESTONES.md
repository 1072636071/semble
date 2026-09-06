# MILESTONES — tdai-skill-suite（04）

按依赖顺序把工单归组为可独立验收的里程碑。断点续传：任一里程碑完成即可停下，下次从下一个未开始里程碑继续。

依赖序：`01 → (02,07,09) → (03,04) → (05,06,08,10)`（05/06 阻塞于 04；08 阻塞于 07；10 阻塞于 07+09）

## M1 — 桶基础设施就绪

- **工单**：01
- **交付**：ship 认识 TDB-AM 技能族；`tdai-remote-ops` / `tdai-codegraph-local` / `tdai-wiki-local` 三个技能目录立起（SKILL.md 骨架 + references/ + scripts/），可被 ship 分发与清理覆盖。
- **验收信号**：
  - [x] `vendors.json` managedPrefixes 含 `tdai-`（且 `buckets` 含 `TDB-AM`）
  - [x] 三技能目录与 SKILL.md 骨架齐全，ship check 通过

## M2 — 运维远端：配置 + 巡检 + 容器

- **工单**：02, 03, 04
- **交付**：跑向导得到 `tdai-ops.json`；可一键 HTTP 巡检全栈健康（含系统摘要）；可 SSH 管理 TDAI 容器（ps/logs/restart/stop/start）。
- **验收信号**：
  - [x] setup 生成 tdai-ops.json（密钥不落盘，可 `--secrets-root` 覆盖）
  - [x] HTTP 巡检输出四端口 + proxy admin + 系统摘要
  - [x] 容器管理命令对单容器/全栈生效（待真实远端抽查）

## M3 — 运维远端：配置管理 + 部署

- **工单**：05, 06
- **交付**：可读/恢复远端配置、改 LLM 上游、verify-stats 与备份；可把本地 TDAI 源码上传重建部署。
- **验收信号**：
  - [ ] 配置读/恢复/改上游命令生效
  - [ ] 备份动作落地坚果云
  - [ ] 构建部署流程（上传→CRLF 修正→build-images→重启）可跑通

## M4 — 本地 Code_Graph 可用

- **工单**：07, 08
- **交付**：安装编译件到 `~/.tdai/runtime`、启动单守护、用户级 MCP 注册；一个守护覆盖试点两仓，远端兜底 + 认亲生效。
- **验收信号**：
  - [x] 守护健康，MCP tools/list 可见 Code_Graph 工具
  - [x] 两试点仓库均可查询（含未提交改动）
  - [ ] 集成实测通过：追加资产查询刷新/认亲逐资产生效（验收项①）— 待人工执行 `tdai-codegraph-local/references/dryrun.md`

## M5 — 本地 Wiki + 集成验收

- **工单**：09, 10
- **交付**：手动指定仓库文件建成远端 wiki（create/raw/ingest）；查询经守护 MCP 兜底转发到远端 wiki；dryrun 与集成验收清单齐备。
- **验收信号**：
  - [ ] 手动文件入库全链路可跑通（每仓库一 wiki 资产）
  - [ ] 查询经守护兜底转发远端 wiki 生效（验收项②）
  - [ ] references/dryrun + integration-acceptance 文档存在且两项需实测项有结论
