---
name: mzg-init
description: 为目录建 mzg 代码索引，并查状态、重建、接入 harness。触发词：建索引、mzg。
metadata:
  version: 1.0.0
---

# mzg 索引初始化

给任意目录初始化 / 刷新 / 校验 mzg 代码索引。固定流程：跑脚本，读输出，不要手写命令逐条探测。

## 用法

```bash
node <本技能目录>/scripts/mzg-init.mjs [--root <目录>] [选项]
```

`--root` 缺省为当前工作目录（cwd）。常用选项：

| 选项 | 作用 |
| --- | --- |
| `--root <dir>` | 目标目录（缺省 cwd），必须是已存在的绝对/相对路径 |
| `--rebuild` | 删旧索引全量重建（重新解析 + 重新嵌入，慢） |
| `--install <target>` | 建完索引后把 mzg 接入 agent harness（如 `workbuddy`），写 MCP 配置 + 项目 AGENTS.md 指引块 |
| `--embedding <model>` | 指定嵌入模型（缺省走 CLI 内置 `local/potion-code-16m-v2`，离线可用） |
| `--dry-run` | 只探测状态、打印将要执行的命令，不实际建索引 |

示例：

```bash
# 当前目录初始化索引（最常用）
node scripts/mzg-init.mjs

# 指定仓库 + 顺带接入 workbuddy
node scripts/mzg-init.mjs --root E:/work/sp/TencentDB-Agent-Memory --install workbuddy

# 覆盖率不对，全量重建
node scripts/mzg-init.mjs --root E:/work/sp/some-repo --rebuild
```

## mzg CLI 的定位规则（脚本自动完成）

按顺序探测，第一个存在者生效：

1. 环境变量 `MZG_CLI`（显式指定 CLI 入口 js）
2. `<root>/mzg/dist/cli/index.js`（项目内 submodule）
3. `<root>/node_modules/mzg/dist/cli/index.js`
4. 本机固定安装位 `E:\work\sp\TencentDB-Agent-Memory\mzg\dist\cli\index.js`（TDB-AM 仓库的 fork）

都找不到时报错退出，并提示可设 `MZG_CLI` 或先 `npm run mzg:bootstrap` 构建 fork。

## 结果判读

脚本最终以 `zg --status --check-ready` 的退出码为准（非 0 = 未就绪）。状态三态：

| status 文案 | 含义 | 脚本动作 |
| --- | --- | --- |
| `Workspace index is not configured` | 无索引 | 执行 `zg --index <root>` |
| `Workspace index needs an update` | 有索引但过期 | 增量刷新（无 `--rebuild` 时重跑 `--index`） |
| 出现 `Coverage` 且 `--check-ready` 退出 0 | 就绪 | 不动，打印覆盖率后退出 |

末尾输出 `RESULT:` JSON 行（ok / state / root / cli / coverage），供机器读取。

## 硬性坑位（务必遵守）

- **必须 `--mode direct`**（脚本已内置）：daemon/server 模式要在本机监听端口，本机「本地进程监听端口不健康」是既有环境红灯，一律绕开。
- **嵌入模型缺省用本地 `local/potion-code-16m-v2`**：离线、不耗 API key；只有用户明确要求远端模型（如 `qwen/text-embedding-v4`）才传 `--embedding`，且需配 key。
- **首次建索引大仓可能要几分钟**，属正常；`--rebuild` 还会重新下载/解析嵌入模型，更慢。Bash 调用时放开 timeout 或后台跑。
- **`.mzg/` 目录是索引产物**，不要提交进 git；脚本不代写 .gitignore，新仓库首次建完可提醒用户补一条 `.mzg/`。
- **CLI 传路径用 Windows 盘符形式**（`E:/...` 或 `E:\...`），不要传 Git Bash 的 `/e/...` 或 `/tmp`——node 进程解析不了，会报 `ROOT_NOT_FOUND`。
- 状态探测失败的另一常见原因是 root 不存在：先确认目录真实存在再跑。

## 上游参考

- CLI 完整说明：mzg 仓库 `docs/02-cli.md`（上游 fork 自 zvec-ai/zvec-grep）
- TDB-AM 仓开发基线：`.scratch/51-mzg-code-search/BASELINE.md`
- 检索/调用链用法（建完索引后）：`zg <query>` / `zg --call-graph callers|callees|impact:<symbol>`
