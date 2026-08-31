# ADR 0002: MemoryKnowledge 以编译件 tarball 分发而非引用源码

状态：已接受（2026-08-31）

## 背景

`tdai-codegraph-local` 的常驻守护依赖 MemoryKnowledge（`local-server.ts`）。MemoryKnowledge 是 TypeScript 项目，tsdown 产出 dist/ 下三个 ESM bundle（`local-server.js` / `server.js` / `mcp/server.js`），依赖**全部外部化**（neverBundle），且含原生模块（`better-sqlite3`、`@node-rs/jieba`）——非单一可移植二进制。技能默认方案是"引用源码仓库 + 本机构建"，但依赖 `E:\work\sp\TencentDB-Agent-Memory` 在场。

## 决策

MemoryKnowledge 以**编译件 tarball 分发**（`npm pack`）：

1. 发布流程（分离）：从源码 `MemoryKnowledge` 构建 → `npm pack` → 产物 tarball（版本化）随技能分发（如 `assets/`）。
2. 安装流程：技能 setup 把 tarball 安装到 `~/.tdai/runtime/`（`npm install <tarball>` 自动从 registry 解析依赖，含原生模块二进制）。
3. 运行时执行 `~/.tdai/runtime/.../dist/local-server.js`，**不依赖源码仓库在场**。

## 为什么

- 用户明确选择"打包编译件分发"——技能安装在任意机器都不再要求 TencentDB-Agent-Memory 源码在场，可移植、可离线缓存。
- 编译件 + node_modules 是 MemoryKnowledge 依赖外部化 + 原生模块约束下的现实形态；`npm install` 天然解决平台原生二进制。
- 发布/安装流程分离：日常安装不触发构建，更新时才需重打包。

## 被否决的替代方案

- **源码引用 + 首次构建缓存**：最简单，但换机器/换目录要重配源码路径，与"分发到用户级技能"的可移植性冲突。
- **跑源码 dev 模式（tsx）**：免 build，但依赖源码 + devDeps、启动慢、不稳定，不适合常驻服务。

## 影响

- 需要维护"重打包"流程：MemoryKnowledge 上游更新时重新 `npm pack` 更新技能内产物与版本号。
- tarball 含版本化命名，技能需记录当前依赖的 MemoryKnowledge 版本以便追踪。
- 技能体积增大（编译件 + 依赖元数据），`ship` 分发需确认包含 assets/。
- **制品归属**：TDB-AM 技能族（含本编译件 tarball）未来发布到 `https://cnb.cool/hanjiangxue_xiaoxiao/jx-ai`，tarball 与该族文档随该仓库分发。
